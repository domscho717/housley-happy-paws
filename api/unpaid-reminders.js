/**
 * Unpaid Booking Reminders — Vercel Cron Job
 *
 * Runs ONCE daily at 8 AM EST (1 PM UTC, controlled via vercel.json).
 * In a single pass it sends both:
 *   • "day of" reminders for TODAY's unpaid bookings  (🚨)
 *   • "day before" reminders for TOMORROW's unpaid bookings (⚠️)
 *
 * For each unpaid booking it sends in-app messages to:
 *   • The CLIENT who booked
 *   • The OWNER (Rachel)
 *   • Any STAFF member assigned (if applicable)
 *
 * "Unpaid" means: booking status is 'accepted' or 'confirmed',
 * but no matching payment exists in the payments table.
 */

const { createClient } = require('@supabase/supabase-js');
const { sendEmail, sendToRachel, fmt12, SITE_URL } = require('./_email');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth — verify cron secret
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

  // Calculate today and tomorrow in Eastern time (auto-adjusts for DST)
  function estDateStr(d) { return (d || new Date()).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); }
  const todayStr = estDateStr();
  const estNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const tomorrow = new Date(estNow);
  tomorrow.setDate(estNow.getDate() + 1);
  const tomorrowStr = estDateStr(tomorrow);

  const results = { today_reminders: 0, tomorrow_reminders: 0, errors: [] };

  try {
    // ── 1. Find all accepted/confirmed bookings for today AND tomorrow ──
    const { data: bookings, error: fetchErr } = await supabase
      .from('booking_requests')
      .select('id, service, preferred_date, preferred_time, contact_name, contact_email, client_id, estimated_total, pet_names, status, booking_dates, staff_id, payment_intent_id')
      .in('status', ['accepted', 'confirmed'])
      .or(`preferred_date.eq.${todayStr},preferred_date.eq.${tomorrowStr}`);

    if (fetchErr) throw fetchErr;

    // Also check bookings with multi-date booking_dates arrays
    const { data: multiDateBookings, error: mdErr } = await supabase
      .from('booking_requests')
      .select('id, service, preferred_date, preferred_time, contact_name, contact_email, client_id, estimated_total, pet_names, status, booking_dates, staff_id, payment_intent_id')
      .in('status', ['accepted', 'confirmed'])
      .not('booking_dates', 'is', null);

    if (mdErr) throw mdErr;

    // Merge: add multi-date bookings that have today or tomorrow in their dates
    const allBookings = [...(bookings || [])];
    const seenIds = new Set(allBookings.map(b => b.id));

    (multiDateBookings || []).forEach(b => {
      if (seenIds.has(b.id)) return;
      const dates = Array.isArray(b.booking_dates) ? b.booking_dates : [];
      const hasRelevantDate = dates.some(d => {
        const dateStr = typeof d === 'string' ? d : (d.date || '');
        return dateStr === todayStr || dateStr === tomorrowStr;
      });
      if (hasRelevantDate) {
        allBookings.push(b);
        seenIds.add(b.id);
      }
    });

    if (!allBookings.length) {
      return res.status(200).json({ message: 'No bookings found for today/tomorrow', ...results });
    }

    // ── 2. Check which bookings have been paid ──
    // Look up payments by client email + service match, or by booking request id in notes
    const clientEmails = [...new Set(allBookings.map(b => b.contact_email).filter(Boolean))];

    const { data: payments, error: payErr } = await supabase
      .from('payments')
      .select('client_email, service, notes, stripe_session_id')
      .in('status', ['paid', 'succeeded']);

    if (payErr) throw payErr;

    // Build a set of "paid" booking fingerprints
    const paidSet = new Set();
    (payments || []).forEach(p => {
      // Match by email + service (loose match)
      if (p.client_email && p.service) {
        paidSet.add((p.client_email + '::' + p.service).toLowerCase());
      }
      // Also check if notes contain a booking ID
      if (p.notes) {
        const idMatch = p.notes.match(/booking[_\s]*(?:id|request)?[:\s]*([a-f0-9-]{36})/i);
        if (idMatch) paidSet.add('id::' + idMatch[1]);
      }
    });

    // Also check payment_intent_id on booking itself
    function isBookingPaid(booking) {
      // If booking has a payment_intent_id, it was charged
      if (booking.payment_intent_id) return true;
      // Check email + service match
      if (booking.contact_email && booking.service) {
        if (paidSet.has((booking.contact_email + '::' + booking.service).toLowerCase())) return true;
      }
      // Check by booking ID in notes
      if (paidSet.has('id::' + booking.id)) return true;
      return false;
    }

    // ── 3. Find the owner user_id (Rachel) ──
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();

    const ownerUserId = ownerProfile ? ownerProfile.user_id : null;

    // ── 4. Look up staff assignments so we can notify assigned staff ──
    const { data: staffAssignments } = await supabase
      .from('staff_assignments')
      .select('staff_id, client_id');

    // Build client_id → [staff_id] map
    const clientStaffMap = {};
    (staffAssignments || []).forEach(a => {
      if (!clientStaffMap[a.client_id]) clientStaffMap[a.client_id] = [];
      if (!clientStaffMap[a.client_id].includes(a.staff_id)) {
        clientStaffMap[a.client_id].push(a.staff_id);
      }
    });

    // ── 5. For each unpaid booking, send reminders ──
    // Use a "system" sender — the owner's user_id since there's no system account
    const systemSenderId = ownerUserId;

    for (const booking of allBookings) {
      if (isBookingPaid(booking)) continue;

      const isToday = booking.preferred_date === todayStr;
      const isTomorrow = booking.preferred_date === tomorrowStr;
      // Also check multi-dates
      const dates = Array.isArray(booking.booking_dates) ? booking.booking_dates : [];
      const todayInDates = dates.some(d => (typeof d === 'string' ? d : (d.date || '')) === todayStr);
      const tomorrowInDates = dates.some(d => (typeof d === 'string' ? d : (d.date || '')) === tomorrowStr);

      const dayLabel = (isToday || todayInDates) ? 'today' : 'tomorrow';
      const urgency = dayLabel === 'today' ? '🚨' : '⚠️';
      const amount = booking.estimated_total ? '$' + Number(booking.estimated_total).toFixed(2) : 'amount due';
      const timePart = booking.preferred_time ? ' at ' + booking.preferred_time : '';

      // ── Message + Email to CLIENT ──
      if (booking.client_id) {
        const clientMsg = `${urgency} Payment Reminder: Your ${booking.service} appointment is ${dayLabel}${timePart} and has not been paid yet (${amount}). Please complete payment as soon as possible so your appointment can proceed smoothly. You can pay through your portal under Billing, or contact Rachel if you need help.`;

        try {
          await supabase.from('messages').insert({
            sender_id: systemSenderId,
            recipient_id: booking.client_id,
            body: clientMsg
          });
        } catch (e) {
          results.errors.push({ booking_id: booking.id, target: 'client', error: e.message });
        }

        // Send email to client
        if (booking.contact_email) {
          try {
            await sendEmail({
              to: booking.contact_email,
              subject: `${urgency} Payment Reminder: ${booking.service} is ${dayLabel} — Housley Happy Paws`,
              title: 'Payment Reminder',
              bodyHTML: `
                <p>Hi ${booking.contact_name || 'there'}!</p>
                <p>Your <strong>${booking.service}</strong> appointment is <strong>${dayLabel}${timePart ? ' at ' + fmt12(booking.preferred_time) : ''}</strong> and has not been paid yet.</p>
                <div style="background:#fff3cd;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #c8963e">
                  <div style="font-weight:700;font-size:1.1rem;margin-bottom:4px">Amount Due: ${amount}</div>
                  ${booking.pet_names ? `<div>Pets: ${booking.pet_names}</div>` : ''}
                </div>
                <p>Please complete payment so your appointment can proceed smoothly.</p>
                <div style="margin:16px 0"><a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#c8963e;color:white;border-radius:8px;text-decoration:none;font-weight:700">💳 Pay Now in Portal →</a></div>
                <p style="font-size:0.85rem;color:#8c6b4a">Questions? Contact Rachel at 717-715-7595</p>
              `
            });
          } catch (e) {
            results.errors.push({ booking_id: booking.id, target: 'client-email', error: e.message });
          }
        }
      }

      // ── Message to OWNER ──
      if (ownerUserId && booking.client_id !== ownerUserId) {
        const ownerMsg = `${urgency} Unpaid Booking Alert: ${booking.contact_name || 'A client'}'s ${booking.service} is ${dayLabel}${timePart} but has NOT been paid (${amount}). Client: ${booking.contact_name || 'Unknown'}${booking.contact_email ? ' (' + booking.contact_email + ')' : ''}${booking.pet_names ? ' | Pets: ' + booking.pet_names : ''}.`;

        try {
          // Send as a self-note by inserting with both sender and recipient as owner
          // Or send from client to owner context
          await supabase.from('messages').insert({
            sender_id: booking.client_id || systemSenderId,
            recipient_id: ownerUserId,
            body: ownerMsg
          });
        } catch (e) {
          results.errors.push({ booking_id: booking.id, target: 'owner', error: e.message });
        }
      }

      // ── Message to STAFF (if assigned directly or via staff_assignments) ──
      const staffIds = new Set();
      if (booking.staff_id) staffIds.add(booking.staff_id);
      // Also check staff_assignments for this client
      if (booking.client_id && clientStaffMap[booking.client_id]) {
        clientStaffMap[booking.client_id].forEach(sid => staffIds.add(sid));
      }
      // Remove owner from staff list (already notified above)
      if (ownerUserId) staffIds.delete(ownerUserId);

      for (const staffId of staffIds) {
        const staffMsg = `${urgency} Heads Up: ${booking.contact_name || 'A client'}'s ${booking.service} ${dayLabel}${timePart} has not been paid yet (${amount}). The client and owner have been notified. The appointment may still proceed — check with Rachel if you're unsure.`;

        try {
          await supabase.from('messages').insert({
            sender_id: systemSenderId,
            recipient_id: staffId,
            body: staffMsg
          });
        } catch (e) {
          results.errors.push({ booking_id: booking.id, target: 'staff-' + staffId, error: e.message });
        }
      }

      // Track which type of reminder was sent
      if (isToday || todayInDates) results.today_reminders++;
      if (isTomorrow || tomorrowInDates) results.tomorrow_reminders++;
    }

    // ── 6. Log results ──
    console.log(`[unpaid-reminders] Today: ${todayStr}, Tomorrow: ${tomorrowStr}`);
    console.log(`[unpaid-reminders] Checked ${allBookings.length} bookings, sent ${results.today_reminders} day-of + ${results.tomorrow_reminders} day-before reminders`);
    if (results.errors.length) console.warn('[unpaid-reminders] Errors:', results.errors);

    return res.status(200).json({
      success: true,
      today: todayStr,
      tomorrow: tomorrowStr,
      bookings_checked: allBookings.length,
      ...results
    });

  } catch (err) {
    console.error('[unpaid-reminders] Fatal error:', err);
    return res.status(500).json({ error: err.message });
  }
};
