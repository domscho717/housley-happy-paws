/**
 * Service Completed Notification API
 * Sends email to client when their service is completed with report summary.
 * Uses Resend for email delivery.
 */

const { sendEmail, fmt12, SITE_URL } = require('./_email');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    clientEmail, clientName, service, petNames,
    reportDate, duration, arrivalTime, departureTime,
    distance, mood, personalNote, staffName, mediaCount
  } = req.body || {};

  if (!clientEmail || !service) {
    return res.status(400).json({ error: 'Missing required fields: clientEmail, service' });
  }

  const moodEmojis = { great: '😄', happy: '😊', calm: '😌', shy: '🙈', energetic: '⚡' };
  const moodDisplay = mood ? (moodEmojis[mood.toLowerCase()] || '😊') + ' ' + mood : '';

  const dateFmt = reportDate
    ? new Date(reportDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const subject = `✅ ${petNames ? petNames + "'s" : 'Your'} ${service} is complete! — Housley Happy Paws`;

  const bodyHTML = `
    <p>Hi ${clientName || 'there'}!</p>
    <p>${staffName || 'Rachel'} has completed ${petNames ? `<strong>${petNames}</strong>'s` : 'your'} <strong>${service}</strong>! Here's a summary:</p>

    <div style="background:#eef4ef;border-radius:10px;padding:20px;margin:16px 0;border-left:4px solid #3d5a47">
      <div style="font-weight:700;font-size:1.1rem;margin-bottom:12px;color:#3d5a47">Service Report</div>

      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <div style="background:white;border-radius:8px;padding:8px 14px;flex:1;min-width:120px">
          <div style="font-size:0.72rem;color:#8c6b4a;text-transform:uppercase;font-weight:700">Date</div>
          <div style="font-weight:600">${dateFmt}</div>
        </div>
        <div style="background:white;border-radius:8px;padding:8px 14px;flex:1;min-width:120px">
          <div style="font-size:0.72rem;color:#8c6b4a;text-transform:uppercase;font-weight:700">Duration</div>
          <div style="font-weight:600">${duration || 'N/A'}</div>
        </div>
      </div>

      ${arrivalTime || departureTime ? `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        ${arrivalTime ? `<div style="background:white;border-radius:8px;padding:8px 14px;flex:1;min-width:120px"><div style="font-size:0.72rem;color:#8c6b4a;text-transform:uppercase;font-weight:700">Arrival</div><div style="font-weight:600">${arrivalTime}</div></div>` : ''}
        ${departureTime ? `<div style="background:white;border-radius:8px;padding:8px 14px;flex:1;min-width:120px"><div style="font-size:0.72rem;color:#8c6b4a;text-transform:uppercase;font-weight:700">Departure</div><div style="font-weight:600">${departureTime}</div></div>` : ''}
      </div>` : ''}

      ${distance ? `<div style="margin-bottom:8px">📏 <strong>Distance:</strong> ${distance}</div>` : ''}
      ${moodDisplay ? `<div style="margin-bottom:8px">😊 <strong>Pet Mood:</strong> ${moodDisplay}</div>` : ''}
      ${mediaCount && mediaCount > 0 ? `<div style="margin-bottom:8px">📷 <strong>${mediaCount} photo${mediaCount > 1 ? 's' : ''}/video${mediaCount > 1 ? 's' : ''}</strong> captured — view in your portal!</div>` : ''}
    </div>

    ${personalNote ? `
    <div style="background:#fdf7ee;border-radius:10px;padding:16px;margin:16px 0;border:1px solid #e8e0d4">
      <div style="font-weight:700;margin-bottom:8px">📝 Note from ${staffName || 'Rachel'}:</div>
      <div style="color:#5c3d1e;line-height:1.7;white-space:pre-wrap">${personalNote}</div>
    </div>` : ''}

    <div style="margin-top:20px">
      <a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#3d5a47;color:white;border-radius:8px;text-decoration:none;font-weight:700">View Full Report in Portal →</a>
    </div>
    <p style="font-size:0.85rem;color:#8c6b4a;margin-top:16px">Thank you for trusting Housley Happy Paws with ${petNames || 'your pet'}! 🐾</p>
  `;

  const result = await sendEmail({
    to: clientEmail,
    subject,
    title: 'Service Completed!',
    bodyHTML,
  });

  return res.status(200).json({
    success: true,
    emailSent: result.success,
    emailId: result.id || null,
    emailError: result.error || null,
  });
};
