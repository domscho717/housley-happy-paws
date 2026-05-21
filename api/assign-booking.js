/**
 * Assign Booking — owner-side endpoint that notifies the assigned staff
 * member by email. The actual DB write happens client-side (RLS allows
 * owner to update booking_requests directly). This endpoint only sends
 * the email so the staff member knows they have new work.
 *
 * Body: { bookingId, staffUserId }
 *   bookingId    — UUID of the booking_requests row
 *   staffUserId  — UUID of the profile.user_id receiving the assignment
 *
 * Auth: requires owner or staff bearer token. Owners can assign anything;
 * a staff member can only "unassign from themselves" (not implemented yet
 * — for now we just notify and let RLS gate the DB write).
 */

const { createClient } = require('@supabase/supabase-js');
const { sendEmail, escHtml, mapsLink, fmt12, SITE_URL } = require('./_email');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.housleyhappypaws.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — missing token' });
  }
  const token = authHeader.replace('Bearer ', '');

  const supabaseUrl = process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co';
  const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized — invalid token' });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing' });
  }
  const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!callerProfile || (callerProfile.role !== 'owner' && callerProfile.role !== 'staff')) {
    return res.status(403).json({ error: 'Forbidden: owner or staff access required' });
  }

  const { bookingId, staffUserId } = req.body || {};
  if (!bookingId || !staffUserId) return res.status(400).json({ error: 'bookingId and staffUserId are required' });

  try {
    const { data: booking, error: bkErr } = await supabase
      .from('booking_requests')
      .select('id, service, contact_name, contact_email, contact_phone, preferred_date, preferred_time, scheduled_date, scheduled_time, pet_names, address, status, special_notes, estimated_total')
      .eq('id', bookingId)
      .maybeSingle();
    if (bkErr || !booking) return res.status(404).json({ error: 'Booking not found' });

    const { data: staffProf, error: spErr } = await supabase
      .from('profiles')
      .select('email, full_name, role')
      .eq('user_id', staffUserId)
      .maybeSingle();
    if (spErr || !staffProf) return res.status(404).json({ error: 'Staff profile not found' });
    if (!staffProf.email) return res.status(400).json({ error: 'Assigned staff has no email on file — cannot notify' });

    const timeFmt = fmt12(booking.scheduled_time || booking.preferred_time || '');
    const dateStr = booking.scheduled_date || booking.preferred_date || 'TBD';
    const dateFmt = dateStr !== 'TBD'
      ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : 'TBD';
    const map = mapsLink(booking.address || '');

    const subject = `New assignment: ${booking.service || 'Pet Care'} — ${booking.contact_name || 'Client'} on ${dateFmt}`;
    const bodyHTML = `
      <p>Hi ${escHtml(staffProf.full_name || 'there')},</p>
      <p>${escHtml(callerProfile.full_name || 'Rachel')} just assigned this booking to you.</p>
      <div style="background:#eef4ef;border-radius:10px;padding:14px 18px;margin:16px 0;border-left:4px solid #3d5a47">
        <div style="font-weight:700;font-size:1.05rem;margin-bottom:6px">${escHtml(booking.service || 'Pet Care')}</div>
        <div style="margin-bottom:4px">📅 ${escHtml(dateFmt)}${timeFmt ? ' at ' + escHtml(timeFmt) : ''}</div>
        <div style="margin-bottom:4px"><strong>Client:</strong> ${escHtml(booking.contact_name || '')}</div>
        ${booking.contact_phone ? `<div style="margin-bottom:4px"><strong>Phone:</strong> ${escHtml(booking.contact_phone)}</div>` : ''}
        ${booking.contact_email ? `<div style="margin-bottom:4px"><strong>Email:</strong> ${escHtml(booking.contact_email)}</div>` : ''}
        ${booking.pet_names ? `<div style="margin-bottom:4px"><strong>Pets:</strong> ${escHtml(booking.pet_names)}</div>` : ''}
        ${booking.address ? `<div style="margin-bottom:4px"><strong>Address:</strong> ${escHtml(booking.address)}${map ? ` · <a href="${map}">Open in Maps</a>` : ''}</div>` : ''}
        <div style="margin-bottom:4px"><strong>Booking ID:</strong> <code>${escHtml(bookingId)}</code></div>
      </div>
      ${booking.special_notes ? `<div style="background:#fff8e1;border-radius:10px;padding:14px 18px;margin:16px 0;border:1px solid #e0d5c5"><strong>Client notes:</strong><br>${escHtml(booking.special_notes).replace(/\n/g, '<br>')}</div>` : ''}
      <p style="margin-top:18px"><a href="${SITE_URL}/?tab=appointments" style="color:#3d5a47;font-weight:600">Open staff portal →</a></p>
    `;

    const result = await sendEmail({
      to: staffProf.email,
      subject,
      title: 'New Assignment',
      bodyHTML,
    });

    return res.status(200).json({
      sent: result.success,
      emailId: result.id || null,
      error: result.error || null,
    });
  } catch (err) {
    console.error('[assign-booking] error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
