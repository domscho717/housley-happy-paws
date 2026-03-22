/**
 * Booking Notification API
 * Sends email to Rachel when a new booking request comes in.
 * Uses Resend for email delivery.
 */

const { sendToRachel, mapsLink, fmt12, SITE_URL } = require('./_email');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { service, date, time, name, email, phone, pets, address, notes, estimatedTotal, isRecurring } = req.body || {};

  if (!service || !name || !email) {
    return res.status(400).json({ error: 'Missing required fields: service, name, email' });
  }

  const dateFmt = date ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Not specified';
  const timeFmt = fmt12(time) || 'Not specified';
  const mapUrl = mapsLink(address);

  const subject = `🐾 New Booking Request: ${service} from ${name}`;

  const bodyHTML = `
    <p>Hi Rachel!</p>
    <p>You have a <strong>new booking request</strong>:</p>

    <div style="background:#f5f0e8;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #c8963e">
      <div style="font-weight:700;font-size:1.05rem;margin-bottom:8px">${service}${isRecurring ? ' 🔄 <span style="color:#3d5a47;font-size:0.85rem">Recurring</span>' : ''}</div>
      <div style="margin-bottom:4px">📅 <strong>Date:</strong> ${dateFmt}</div>
      <div style="margin-bottom:4px">🕐 <strong>Time:</strong> ${timeFmt}</div>
      ${estimatedTotal ? `<div style="margin-bottom:4px">💰 <strong>Total:</strong> $${Number(estimatedTotal).toFixed(2)}</div>` : ''}
    </div>

    <div style="background:#eef4ef;border-radius:10px;padding:16px;margin:16px 0">
      <div style="font-weight:700;margin-bottom:8px">Client Details</div>
      <div style="margin-bottom:4px">👤 <strong>Name:</strong> ${name}</div>
      <div style="margin-bottom:4px">📧 <strong>Email:</strong> <a href="mailto:${email}" style="color:#c8963e">${email}</a></div>
      ${phone ? `<div style="margin-bottom:4px">📞 <strong>Phone:</strong> <a href="tel:${phone}" style="color:#c8963e">${phone}</a></div>` : ''}
      <div style="margin-bottom:4px">🐾 <strong>Pets:</strong> ${pets || 'Not specified'}</div>
      ${address ? `<div style="margin-bottom:4px">📍 <strong>Address:</strong> ${address}</div>` : ''}
    </div>

    ${address && mapUrl ? `<div style="margin:16px 0"><a href="${mapUrl}" style="display:inline-block;padding:10px 20px;background:#3d5a47;color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.9rem">📍 Get Directions</a></div>` : ''}

    ${notes ? `<div style="background:#fdf7ee;border-radius:10px;padding:14px;margin:16px 0;border:1px solid #e8e0d4"><div style="font-weight:700;margin-bottom:6px">Special Notes:</div><div style="font-style:italic;color:#5c3d1e">${notes}</div></div>` : ''}

    <div style="margin-top:20px">
      <a href="${SITE_URL}/?v=4" style="display:inline-block;padding:12px 28px;background:#c8963e;color:white;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.95rem">Open Owner Portal →</a>
    </div>
    <p style="font-size:0.85rem;color:#8c6b4a;margin-top:16px">Log in to accept, modify, or decline this request.</p>
  `;

  const result = await sendToRachel({ subject, title: 'New Booking Request', bodyHTML });

  return res.status(200).json({
    success: true,
    emailSent: result.success,
    emailId: result.id || null,
    emailError: result.error || null,
    message: result.success ? 'Notification emailed to Rachel.' : 'Notification logged (email not configured).',
    subject,
  });
};
