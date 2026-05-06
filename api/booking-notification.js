/**
 * Booking Notification API
 * Sends email to Rachel when a client submits a new booking request.
 * Uses Resend via shared _email module.
 */

const { sendToRachel, escHtml, fmt12, SITE_URL } = require('./_email');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://www.housleyhappypaws.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    service, date, startDate, endDate, time, name, email, phone,
    pets, address, notes, estimatedTotal, isRecurring, isHouseSitting,
  } = req.body || {};

  if (!service || !name) {
    return res.status(400).json({ error: 'Missing required fields: service, name' });
  }

  try {
    const safeName = escHtml(name);
    const safeService = escHtml(service);
    const safePets = escHtml(pets);
    const safeAddress = escHtml(address);
    const safeNotes = escHtml(notes);
    const safeEmail = escHtml(email);
    const safePhone = escHtml(phone);
    const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    // Format date display — handle house sitting date ranges
    let dateDisplay = date || 'TBD';
    if (isHouseSitting && startDate && endDate) {
      var opts = { weekday: 'short', month: 'short', day: 'numeric' };
      var s = new Date(startDate + 'T12:00:00');
      var e = new Date(endDate + 'T12:00:00');
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        var nights = Math.round((e - s) / (1000 * 60 * 60 * 24));
        dateDisplay = s.toLocaleDateString('en-US', opts) + ' → ' +
          e.toLocaleDateString('en-US', opts) + ' (' + nights + ' night' + (nights !== 1 ? 's' : '') + ')';
      }
    } else if (startDate && !date) {
      // Single date — format nicely
      var d = new Date(startDate + 'T12:00:00');
      if (!isNaN(d.getTime())) {
        dateDisplay = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      }
    } else if (date && date.indexOf(' to ') !== -1) {
      // Legacy format "YYYY-MM-DD to YYYY-MM-DD" — parse and format
      var parts = date.split(' to ');
      var s2 = new Date(parts[0].trim() + 'T12:00:00');
      var e2 = new Date(parts[1].trim() + 'T12:00:00');
      if (!isNaN(s2.getTime()) && !isNaN(e2.getTime())) {
        var nights2 = Math.round((e2 - s2) / (1000 * 60 * 60 * 24));
        var opts2 = { weekday: 'short', month: 'short', day: 'numeric' };
        dateDisplay = s2.toLocaleDateString('en-US', opts2) + ' → ' +
          e2.toLocaleDateString('en-US', opts2) + ' (' + nights2 + ' night' + (nights2 !== 1 ? 's' : '') + ')';
      }
    }

    const timeDisplay = time ? fmt12(time) : '';

    const bodyHTML = `
      <div style="background:#fdf6ec;border-radius:12px;padding:20px;margin-bottom:16px;border-left:4px solid #c8963e">
        <div style="font-weight:700;font-size:1.1rem;color:#3d5a47;margin-bottom:12px">📅 New Booking Request</div>
        <div style="margin-bottom:10px">
          <strong>Service:</strong> ${safeService}${isHouseSitting ? ' 🏡' : ''}
        </div>
        <div style="margin-bottom:10px">
          <strong>Client:</strong> ${safeName}
        </div>
        <div style="margin-bottom:10px">
          <strong>Date:</strong> ${escHtml(dateDisplay)}
        </div>
        ${timeDisplay ? `<div style="margin-bottom:10px"><strong>Time:</strong> ${escHtml(timeDisplay)}</div>` : ''}
        ${safePets ? `<div style="margin-bottom:10px"><strong>Pets:</strong> ${safePets}</div>` : ''}
        ${estimatedTotal ? `<div style="margin-bottom:10px"><strong>Estimated Total:</strong> $${Number(estimatedTotal).toFixed(2)}</div>` : ''}
        <div style="margin-bottom:10px">
          <strong>Received:</strong> ${now}
        </div>
      </div>

      ${safeAddress ? `
      <div style="background:#f5f0e6;border-radius:10px;padding:14px;margin-bottom:12px">
        <strong>📍 Address:</strong> ${safeAddress}
      </div>` : ''}

      ${safeNotes ? `
      <div style="background:#f5f0e6;border-radius:10px;padding:14px;margin-bottom:12px">
        <strong>📝 Notes:</strong> ${safeNotes}
      </div>` : ''}

      <div style="margin-top:16px;padding:12px;background:#eef4ef;border-radius:8px;font-size:0.85rem;color:#3d5a47">
        <strong>Contact:</strong> ${safeEmail}${safePhone ? ' · ' + safePhone : ''}<br>
        <a href="${SITE_URL}" style="color:#3d5a47;font-weight:700">View in Dashboard →</a>
      </div>
    `;

    const emoji = isHouseSitting ? '🏡' : '📅';
    const result = await sendToRachel({
      subject: `${emoji} New ${safeService} Request from ${safeName} — Housley Happy Paws`,
      title: 'New Booking Request',
      bodyHTML,
    });

    return res.status(200).json({
      success: true,
      emailSent: result ? result.success : false,
    });
  } catch (err) {
    console.error('[booking-notification] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
