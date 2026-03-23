/**
 * Test Email Endpoint — temporary, remove after debugging
 * GET /api/test-email?to=rlhousley05@gmail.com
 */
const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  const results = {
    RESEND_API_KEY_set: !!process.env.RESEND_API_KEY,
    RESEND_API_KEY_prefix: process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.substring(0, 6) + '...' : 'NOT SET',
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'NOT SET (using default)',
  };

  if (!process.env.RESEND_API_KEY) {
    return res.status(200).json({ ...results, error: 'RESEND_API_KEY is not set in environment variables' });
  }

  const to = req.query.to || 'rlhousley05@gmail.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const fromAddr = `Housley Happy Paws <${fromEmail}>`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: fromAddr,
      to: [to],
      subject: 'Test Email — Housley Happy Paws',
      html: '<h2>This is a test email</h2><p>If you received this, email is working correctly!</p>',
    });

    if (error) {
      results.status = 'FAILED';
      results.resendError = error;
    } else {
      results.status = 'SENT';
      results.emailId = data?.id;
    }
  } catch (err) {
    results.status = 'EXCEPTION';
    results.exception = err.message;
    results.statusCode = err.statusCode || null;
  }

  return res.status(200).json(results);
};
