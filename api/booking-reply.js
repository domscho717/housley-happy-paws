/**
 * Booking Reply — owner-side endpoint that emails a reply to the client.
 *
 * Rachel can type a message in the booking-request card and Send. The
 * server emails the client via Resend with the message + the booking
 * details + a link back to the portal. A copy of the reply (timestamped
 * + author) is appended to booking_requests.admin_notes for history.
 *
 * Body: { bookingId, message }
 *
 * Auth: requires owner or staff bearer token.
 */

const { createClient } = require('@supabase/supabase-js');
const { sendEmail, escHtml, fmt12, SITE_URL } = require('./_email');

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
  const supabaseAuth = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized — invalid token' });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing' });
  }
  const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!callerProfile || (callerProfile.role !== 'owner' && callerProfile.role !== 'staff')) {
    return res.status(403).json({ error: 'Forbidden: owner or staff access required' });
  }

  const { bookingId, message } = req.body || {};
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'message is required' });
  const trimmed = String(message).trim().slice(0, 4000); // cap to keep emails reasonable

  try {
    const { data: booking, error: bkErr } = await supabase
      .from('booking_requests')
      .select('id, service, contact_name, contact_email, preferred_date, preferred_time, scheduled_date, scheduled_time, pet_names, address, status, special_notes, admin_notes, estimated_total, contact_phone')
      .eq('id', bookingId)
      .maybeSingle();
    if (bkErr || !booking) return res.status(404).json({ error: 'Booking not found' });
    if (!booking.contact_email) return res.status(400).json({ error: 'Booking has no client email on file' });

    const dateStr = booking.scheduled_date || booking.preferred_date || '';
    const dateFmt = dateStr
      ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : 'TBD';
    const timeFmt = fmt12(booking.scheduled_time || booking.preferred_time || '');
    const safeFirst = escHtml((booking.contact_name || 'there').split(/\s+/)[0]);
    const safeService = escHtml(booking.service || 'Pet Care');
    const safePets = escHtml(booking.pet_names || '');
    const safeMessage = escHtml(trimmed).replace(/\n/g, '<br>');
    const fromName = callerProfile.full_name || 'Rachel';
    const safeFromName = escHtml(fromName);

    const bodyHTML = `
      <p>Hi ${safeFirst},</p>
      <p>${safeFromName} sent you a reply about your booking request:</p>
      <div style="background:#fdf7ee;border-left:4px solid #c8963e;border-radius:10px;padding:16px;margin:16px 0;color:#5c3d1e;font-style:italic;line-height:1.6">
        ${safeMessage}
      </div>
      <p style="margin:18px 0 6px;font-size:0.86rem;color:#5c3d1e"><strong>Booking we're discussing:</strong></p>
      <div style="background:#eef4ef;border-radius:10px;padding:14px 18px;border-left:4px solid #3d5a47">
        <div style="font-weight:700;margin-bottom:6px">${safeService}</div>
        <div style="margin-bottom:4px">📅 ${escHtml(dateFmt)}${timeFmt ? ' · ' + escHtml(timeFmt) : ''}</div>
        ${safePets ? `<div style="margin-bottom:4px">🐾 ${safePets}</div>` : ''}
        <div style="margin-bottom:4px;font-size:0.82rem;color:#5c3d1e">Status: ${escHtml(booking.status || '')}</div>
      </div>
      <p style="margin-top:18px"><a href="${SITE_URL}/?tab=appointments" style="display:inline-block;padding:12px 24px;background:#3d5a47;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Open your portal to reply →</a></p>
      <p style="font-size:0.82rem;color:#8c6b4a;margin-top:18px">You can reply by opening your portal and using the message thread, or just reply to this email — it'll come straight to ${escHtml(callerProfile.email || 'Rachel')}.</p>
    `;

    const result = await sendEmail({
      to: booking.contact_email,
      subject: `Re: your ${booking.service || 'booking'} request — Housley Happy Paws`,
      title: 'A reply about your booking',
      bodyHTML,
      replyTo: callerProfile.email || undefined,
    });

    // Append a timestamped record to admin_notes so the thread is auditable.
    try {
      const noteLine = '\n[' + new Date().toISOString() + ' · ' + fromName + ' → client]: ' + trimmed;
      const combined = ((booking.admin_notes || '') + noteLine).slice(0, 8000);
      await supabase.from('booking_requests').update({ admin_notes: combined }).eq('id', bookingId);
    } catch (noteErr) {
      console.warn('[booking-reply] admin_notes update failed (non-fatal):', noteErr.message);
    }

    return res.status(200).json({
      sent: !!(result && result.success),
      emailId: result && result.id || null,
      error: result && result.error || null,
    });
  } catch (err) {
    console.error('[booking-reply] error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
