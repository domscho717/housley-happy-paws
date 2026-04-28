/**
 * Contact Form API
 * Sends email to Rachel when someone submits the contact form.
 * Uses Resend via shared _email module.
 */

const { sendToRachel, escHtml, SITE_URL } = require('./_email');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, contact, question } = req.body || {};

  if (!name || !contact || !question) {
    return res.status(400).json({ error: 'Missing required fields: name, contact, question' });
  }

  try {
    const safeName = escHtml(name);
    const safeContact = escHtml(contact);
    const safeQuestion = escHtml(question);
    const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    const bodyHTML = `
      <div style="background:#fdf6ec;border-radius:12px;padding:20px;margin-bottom:16px;border-left:4px solid #c8963e">
        <div style="font-weight:700;font-size:1.1rem;color:#3d5a47;margin-bottom:12px">📬 New Contact Form Submission</div>
        <div style="margin-bottom:10px">
          <strong>Name:</strong> ${safeName}
        </div>
        <div style="margin-bottom:10px">
          <strong>Contact Info:</strong> ${safeContact}
        </div>
        <div style="margin-bottom:10px">
          <strong>Received:</strong> ${now}
        </div>
      </div>

      <div style="background:#f5f0e6;border-radius:10px;padding:16px;margin-bottom:16px">
        <div style="font-weight:700;margin-bottom:8px;color:#5c3d1e">Their Message:</div>
        <div style="font-size:0.95rem;line-height:1.6;color:#1e1306;white-space:pre-wrap">${safeQuestion}</div>
      </div>

      <div style="margin-top:16px;padding:12px;background:#eef4ef;border-radius:8px;font-size:0.85rem;color:#3d5a47">
        <strong>Reply to:</strong> ${safeContact}<br>
        <a href="${SITE_URL}" style="color:#3d5a47;font-weight:700">View in Dashboard →</a>
      </div>
    `;

    const result = await sendToRachel(
      `📬 New Message from ${safeName} — Housley Happy Paws`,
      'New Contact Form',
      bodyHTML
    );

    return res.status(200).json({
      success: true,
      emailSent: result ? result.success : false,
    });
  } catch (err) {
    console.error('[contact-form] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
