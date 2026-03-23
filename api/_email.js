/**
 * Shared Email Utility — Housley Happy Paws
 * Uses Resend for all transactional emails.
 *
 * Environment variable required: RESEND_API_KEY
 * From address: onboarding@resend.dev (until custom domain verified)
 *   then switch to: rachel@housleyhappypaws.com
 */

const { Resend } = require('resend');

const RACHEL_EMAIL = 'housleyhappypaws@gmail.com';
const FROM_NAME = 'Housley Happy Paws';
// Use Resend's default until custom domain is set up
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://housleyhappypaws.com';

/**
 * Escape HTML special characters to prevent XSS in email templates
 */
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — emails will be logged only');
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

/**
 * Build a branded HTML email template
 */
function buildHTML(title, bodyContent) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fdfaf5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:20px">
  <div style="text-align:center;padding:24px 0;border-bottom:2px solid #e8e0d4">
    <div style="font-family:Georgia,serif;font-size:1.6rem;font-weight:700;color:#1e1409">
      Housley <span style="color:#c8963e">Happy</span> Paws
    </div>
    <div style="font-size:0.8rem;color:#8c6b4a;margin-top:4px">Lancaster, PA · Rachel Housley</div>
  </div>
  <div style="padding:28px 0">
    <h2 style="color:#1e1409;font-size:1.2rem;margin:0 0 16px">${title}</h2>
    <div style="color:#333;font-size:0.95rem;line-height:1.7">
      ${bodyContent}
    </div>
  </div>
  <div style="border-top:2px solid #e8e0d4;padding:20px 0;text-align:center;font-size:0.78rem;color:#8c6b4a">
    <div>Housley Happy Paws · Lancaster, PA</div>
    <div style="margin-top:4px">📞 717-715-7595 · 📧 housleyhappypaws@gmail.com</div>
    <div style="margin-top:8px"><a href="${SITE_URL}" style="color:#c8963e;text-decoration:none">Visit Our Website</a></div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Send an email via Resend
 * @param {Object} opts
 * @param {string} opts.to - Recipient email
 * @param {string} opts.subject - Email subject
 * @param {string} opts.title - Email heading (in template)
 * @param {string} opts.bodyHTML - HTML body content (inserted into template)
 * @param {string} [opts.replyTo] - Optional reply-to
 * @returns {Object} { success, id, error }
 */
async function sendEmail({ to, subject, title, bodyHTML, replyTo }) {
  const resend = getResend();

  // Always log
  const fromAddr = `${FROM_NAME} <${FROM_EMAIL}>`;
  console.log(`[email] To: ${to} | From: ${fromAddr} | Subject: ${subject}`);

  if (!resend) {
    console.error('[email] RESEND_API_KEY is not set!');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  console.log('[email] Resend client created, API key starts with:', process.env.RESEND_API_KEY?.substring(0, 6) + '...');

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddr,
      to: [to],
      subject: subject,
      html: buildHTML(title || subject, bodyHTML),
      reply_to: replyTo || RACHEL_EMAIL,
    });

    if (error) {
      console.error('[email] Resend API error:', JSON.stringify(error));
      return { success: false, error: error.message || JSON.stringify(error) };
    }

    console.log('[email] Sent successfully, ID:', data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[email] Send exception:', err.message, err.statusCode || '');
    return { success: false, error: err.message };
  }
}

/**
 * Send email to Rachel (owner notifications)
 */
async function sendToRachel({ subject, title, bodyHTML }) {
  return sendEmail({ to: RACHEL_EMAIL, subject, title, bodyHTML });
}

/**
 * Helper: build a Google Maps directions link from current location to address
 */
function mapsLink(address) {
  if (!address) return '';
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/**
 * Helper: format a 24h time to 12h
 */
function fmt12(t) {
  if (!t || t.indexOf(':') === -1) return t || '';
  var p = t.split(':'), h = parseInt(p[0]), m = p[1];
  var ap = h >= 12 ? 'PM' : 'AM';
  h = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return h + ':' + m + ' ' + ap;
}

module.exports = {
  sendEmail,
  sendToRachel,
  buildHTML,
  mapsLink,
  fmt12,
  escHtml,
  RACHEL_EMAIL,
  SITE_URL,
};
