/* Booking Status Notification API
 * Sends email to client when Rachel accepts/declines/modifies their booking request.
 */

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, name, service, status, scheduledDate, scheduledTime, adminNotes } = req.body;

  let subject, body;

  if (status === 'accepted') {
    subject = `Your ${service} booking is confirmed! - Housley Happy Paws`;
    body = [
      `Hi ${name}!\n`,
      `Great news! Rachel has confirmed your booking request.\n`,
      `Service: ${service}`,
      `Date: ${scheduledDate}`,
      `Time: ${scheduledTime}`,
      adminNotes ? `\nNote from Rachel: ${adminNotes}` : '',
      `\nPayment will be handled at the time of service.`,
      `\nThank you for choosing Housley Happy Paws!`,
      `Questions? Reply to this email or call 717-715-7595`,
    ].filter(Boolean).join('\n');
  } else if (status === 'modified') {
    subject = `Booking update: Rachel suggested a new time - Housley Happy Paws`;
    body = [
      `Hi ${name}!\n`,
      `Rachel reviewed your ${service} request and suggested a different time:\n`,
      `New Date: ${scheduledDate}`,
      `New Time: ${scheduledTime}`,
      adminNotes ? `\nRachel's note: ${adminNotes}` : '',
      `\nPlease visit the website or reply to this email to confirm.`,
      `https://www.housleyhappypaws.com`,
    ].filter(Boolean).join('\n');
  } else if (status === 'declined') {
    subject = `Booking update - Housley Happy Paws`;
    body = [
      `Hi ${name}!\n`,
      `Unfortunately, Rachel is unable to accommodate your ${service} request at this time.`,
      adminNotes ? `\nNote: ${adminNotes}` : '',
      `\nPlease feel free to request a different date/time!`,
      `https://www.housleyhappypaws.com`,
    ].filter(Boolean).join('\n');
  }

  console.log('Status notification to client:', subject);
  console.log(body);

  // TODO: Integrate with SendGrid/Resend for actual email delivery

  return res.status(200).json({
    success: true,
    message: 'Status notification logged.',
    subject,
  });
};
