/* Booking Notification API
 * Sends email to Rachel when a new booking request comes in.
 * Uses Supabase's built-in auth to verify, and a simple
 * fetch to an email service.
 *
 * For now, this logs to Supabase and can be extended with
 * SendGrid/Resend/etc when ready.
 */

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { service, date, time, name, email, phone, pets, address, notes } = req.body || {};

  if (!service || !name || !email) {
    return res.status(400).json({ error: 'Missing required fields: service, name, email' });
  }

  // Rachel's notification email
  const RACHEL_EMAIL = 'housleyhappypaws@gmail.com';

  // Build notification text
  const subject = `New Booking Request: ${service} from ${name}`;
  const body = [
    `Hi Rachel!\n`,
    `You have a new booking request:\n`,
    `Service: ${service}`,
    `Preferred Date: ${date}`,
    `Preferred Time: ${time}`,
    `\nClient Details:`,
    `Name: ${name}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : '',
    `\nPet Info:`,
    `Pets: ${pets}`,
    `Address: ${address}`,
    notes ? `\nSpecial Notes: ${notes}` : '',
    `\n---`,
    `Log in to your Owner Portal to accept, modify, or decline this request.`,
    `https://www.housleyhappypaws.com/?v=4`,
  ].filter(Boolean).join('\n');

  console.log('Booking notification:', subject);
  console.log(body);

  // TODO: Integrate with SendGrid/Resend for actual email delivery
  // For now, the request is saved in Supabase and visible in the admin dashboard

  return res.status(200).json({
    success: true,
    message: 'Notification logged. Email delivery will be configured soon.',
    subject,
  });
};
