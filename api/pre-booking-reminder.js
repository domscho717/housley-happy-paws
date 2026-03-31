/**
 * Pre-Booking Reminder — Vercel Cron Job
 * Runs every 15 minutes. Checks for bookings starting within the next 30 minutes.
 * Sends email + in-app message to owner/staff with Google Maps directions link.
 *
 * Cron schedule: every 15 minutes
 */

const { createClient } = require('@supabase/supabase-js');
const { sendEmail, sendToRachel, mapsLink, fmt12, SITE_URL } = require('./_email');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
  const cronSecret = req.headers['authorization'];
  const manualSecret = req.headers['x-cron-secret'];
  const envSecret = process.env.CRON_SECRET;
  if (envSecret && cronSecret !== `Bearer ${envSecret}` && manualSecret !== envSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  // Calculate current time and 30-min window in Eastern time (auto-adjusts for DST)
  const now = new Date();
  const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  // Current time in HH:MM format
  const currentHH = String(estNow.getHours()).padStart(2, '0');
  const currentMM = String(estNow.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHH}:${currentMM}`;

  // 30 minutes from now
  const thirtyMin = new Date(estNow.getTime() + 30 * 60000);
  const futureHH = String(thirtyMin.getHours()).padStart(2, '0');
  const futureMM = String(thirtyMin.getMinutes()).padStart(2, '0');
  const futureTime = `${futureHH}:${futureMM}`;

  // 45 minutes from now (upper bound to avoid missing due to cron timing)
  const fortyFiveMin = new Date(estNow.getTime() + 45 * 60000);
  const ff_HH = String(fortyFiveMin.getHours()).padStart(2, '0');
  const ff_MM = String(fortyFiveMin.getMinutes()).padStart(2, '0');
  const upperTime = `${ff_HH}:${ff_MM}`;

  const results = { checked: 0, reminded: 0, errors: [] };

  try {
    // Get all confirmed bookings for today
    const { data: bookings, error } = await supabase
      .from('booking_requests')
      .select('id, service, scheduled_date, scheduled_time, preferred_date, preferred_time, contact_name, contact_email, pet_names, address, client_id, recurrence_pattern')
      .in('status', ['accepted', 'confirmed'])
      .or(`scheduled_date.eq.${todayStr},preferred_date.eq.${todayStr}`);

    if (error) throw error;

    // Also get recurring bookings
    const { data: recurringBookings } = await supabase
      .from('booking_requests')
      .select('id, service, scheduled_date, scheduled_time, preferred_date, preferred_time, contact_name, contact_email, pet_names, address, client_id, recurrence_pattern, canceled_dates')
      .in('status', ['accepted', 'confirmed'])
      .not('recurrence_pattern', 'is', null);

    const allBookings = [...(bookings || [])];
    const seenIds = new Set(allBookings.map(b => b.id));

    // Check recurring bookings that fall on today
    if (recurringBookings) {
      for (const rb of recurringBookings) {
        if (seenIds.has(rb.id)) continue;
        // Simple check: is today a recurring date?
        const pattern = typeof rb.recurrence_pattern === 'string' ? JSON.parse(rb.recurrence_pattern) : rb.recurrence_pattern;
        if (isRecurringToday(todayStr, pattern, rb)) {
          allBookings.push(rb);
          seenIds.add(rb.id);
        }
      }
    }

    // Find owner user_id
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .eq('role', 'owner')
      .limit(1)
      .single();
    const ownerUserId = ownerProfile ? ownerProfile.user_id : null;
    const ownerName = ownerProfile ? ownerProfile.full_name : 'Rachel';

    // Check for bookings that already got a reminder (use a simple approach: check messages)
    // We'll use a unique marker in the message body to avoid duplicates

    for (const booking of allBookings) {
      results.checked++;

      const bookingTime = booking.scheduled_time || booking.preferred_time;
      if (!bookingTime) continue;

      // Check if booking time is within our 30-min window
      // bookingTime is "HH:MM" or "HH:MM:SS"
      const bt = bookingTime.substring(0, 5);

      // Is the booking time between currentTime and upperTime?
      if (bt < currentTime || bt > upperTime) continue;

      // Check if we already sent a reminder for this booking today
      const reminderMarker = `[PRE-REMINDER:${booking.id}:${todayStr}]`;
      const { data: existingReminder } = await supabase
        .from('messages')
        .select('id')
        .like('body', `%${reminderMarker}%`)
        .limit(1);

      if (existingReminder && existingReminder.length > 0) continue; // Already reminded

      // Build the reminder
      const address = booking.address || '';
      const mapUrl = mapsLink(address);
      const timeFmt = fmt12(bt);
      const petInfo = booking.pet_names || '';

      // ── In-app message to owner ──
      if (ownerUserId) {
        const inAppMsg = `⏰ Reminder: ${booking.service} for ${booking.contact_name || 'client'} ${petInfo ? '(' + petInfo + ') ' : ''}starts at ${timeFmt}!${address ? '\n📍 Address: ' + address : ''}${mapUrl ? '\n🗺️ Directions: ' + mapUrl : ''}\n${reminderMarker}`;

        try {
          await supabase.from('messages').insert({
            sender_id: ownerUserId,
            recipient_id: ownerUserId,
            body: inAppMsg
          });
        } catch (e) {
          results.errors.push({ booking_id: booking.id, target: 'owner-msg', error: e.message });
        }
      }

      // ── Email to owner ──
      const emailBody = `
        <p>Hi ${ownerName}!</p>
        <p>You have a booking starting in <strong>~30 minutes</strong>:</p>

        <div style="background:#fff3cd;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #c8963e">
          <div style="font-weight:700;font-size:1.05rem;margin-bottom:8px">${booking.service}</div>
          <div style="margin-bottom:4px">🕐 <strong>Time:</strong> ${timeFmt}</div>
          <div style="margin-bottom:4px">👤 <strong>Client:</strong> ${booking.contact_name || 'N/A'}</div>
          ${petInfo ? `<div style="margin-bottom:4px">🐾 <strong>Pets:</strong> ${petInfo}</div>` : ''}
          ${address ? `<div style="margin-bottom:4px">📍 <strong>Address:</strong> ${address}</div>` : ''}
        </div>

        ${mapUrl ? `
        <div style="margin:16px 0">
          <a href="${mapUrl}" style="display:inline-block;padding:14px 28px;background:#3d5a47;color:white;border-radius:10px;text-decoration:none;font-weight:700;font-size:1rem">🗺️ Get Directions →</a>
        </div>
        <p style="font-size:0.82rem;color:#8c6b4a">Opens Google Maps with directions from your current location to the service address.</p>
        ` : ''}

        <div style="margin-top:16px">
          <a href="${SITE_URL}/?v=4" style="display:inline-block;padding:10px 24px;background:#c8963e;color:white;border-radius:8px;text-decoration:none;font-weight:700">Open Portal →</a>
        </div>
      `;

      await sendToRachel({
        subject: `⏰ In 30 min: ${booking.service} for ${booking.contact_name || 'client'}`,
        title: 'Upcoming Appointment Reminder',
        bodyHTML: emailBody,
      });

      // ── Also notify assigned staff (if any) ──
      const { data: staffAssignments } = await supabase
        .from('staff_assignments')
        .select('staff_id')
        .eq('client_id', booking.client_id);

      if (staffAssignments && staffAssignments.length > 0) {
        for (const sa of staffAssignments) {
          if (sa.staff_id === ownerUserId) continue;

          // Get staff email
          const { data: staffProfile } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .eq('id', sa.staff_id)
            .single();

          if (staffProfile) {
            // In-app message
            try {
              await supabase.from('messages').insert({
                sender_id: ownerUserId,
                recipient_id: staffProfile.user_id,
                body: `⏰ Reminder: ${booking.service} for ${booking.contact_name || 'client'} ${petInfo ? '(' + petInfo + ') ' : ''}starts at ${timeFmt}!${address ? '\n📍 ' + address : ''}${mapUrl ? '\n🗺️ ' + mapUrl : ''}\n${reminderMarker}`
              });
            } catch (e) {}
          }
        }
      }

      results.reminded++;
    }

    return res.status(200).json({
      success: true,
      currentTime,
      window: `${currentTime} - ${upperTime}`,
      ...results,
    });

  } catch (err) {
    console.error('[pre-booking-reminder] Error:', err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Simple recurring date check (matches backend logic)
 */
function isRecurringToday(todayStr, pattern, booking) {
  if (!pattern) return false;
  const target = new Date(todayStr + 'T12:00:00');

  // Check canceled dates
  if (booking.canceled_dates && Array.isArray(booking.canceled_dates) && booking.canceled_dates.includes(todayStr)) return false;

  if (pattern.type === 'per_card' && Array.isArray(pattern.schedules)) {
    for (const s of pattern.schedules) {
      if (!s.start_date) continue;
      const start = new Date(s.start_date + 'T12:00:00');
      if (target < start) continue;
      if (!s.ongoing && s.end_date && target > new Date(s.end_date + 'T23:59:59')) continue;
      if (target.getDay() !== start.getDay()) continue;
      const daysDiff = Math.round((target - start) / (24 * 60 * 60 * 1000));
      const interval = s.frequency === 'biweekly' ? 14 : 7;
      if (daysDiff % interval !== 0) continue;
      return true;
    }
  }

  if (pattern.days && Array.isArray(pattern.days)) {
    const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    if (!pattern.days.some(d => dayMap[d] === target.getDay())) return false;
    if (pattern.frequency === 'biweekly') {
      const startD = new Date((booking.preferred_date || booking.scheduled_date) + 'T12:00:00');
      const weeksDiff = Math.round((target - startD) / (7 * 24 * 60 * 60 * 1000));
      if (weeksDiff % 2 !== 0) return false;
    }
    return true;
  }

  return false;
}
