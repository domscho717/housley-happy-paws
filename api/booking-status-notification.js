/* Booking Status Notification API
 * Sends email to client when Rachel accepts/declines/modifies their booking request.
 */

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, name, service, status, scheduledDate, scheduledTime, adminNotes, paymentLink, estimatedTotal, priceBreakdown, autoCharged, recurrencePattern, dateDetails } = req.body || {};

  if (!email || !name || !service || !status) {
    return res.status(400).json({ error: 'Missing required fields: email, name, service, status' });
  }

  let subject, body;

  if (status === 'accepted') {
    subject = `Your ${service} booking is confirmed! - Housley Happy Paws`;

    // Build invoice/price section
    let invoiceSection = '';
    if (estimatedTotal && estimatedTotal > 0) {
      const breakdownLines = priceBreakdown
        ? priceBreakdown.split(' | ').map(line => `  - ${line}`).join('\n')
        : `  - ${service}`;
      invoiceSection = [
        `\n--- Invoice ---`,
        breakdownLines,
        `  ─────────────`,
        `  Total: $${Number(estimatedTotal).toFixed(2)}`,
        `--- End Invoice ---`,
      ].join('\n');
    }

    // Build recurring schedule section
    let recurringSection = '';
    if (recurrencePattern) {
      const rp = typeof recurrencePattern === 'string' ? JSON.parse(recurrencePattern) : recurrencePattern;
      if (rp.type === 'per_card' && rp.schedules) {
        const lines = rp.schedules.map(s => {
          const freqLabel = s.frequency === 'weekly' ? 'Every week' : 'Every other week';
          const startFmt = new Date(s.start_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
          const endPart = s.ongoing ? 'until stopped' : (s.end_date ? `until ${new Date(s.end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : '');
          const timePart = s.time ? ` at ${s.time}` : '';
          return `  • ${freqLabel} starting ${startFmt}${timePart} — ${endPart}`;
        });
        recurringSection = [
          `\n📅 Recurring Schedule:`,
          ...lines,
          `\n💳 Billing: You will be automatically charged the day before each appointment.`,
          `   Cancel anytime by contacting Rachel.`,
        ].join('\n');
      }
    }

    // Build multi-date section
    let dateDetailsSection = '';
    if (dateDetails && Array.isArray(dateDetails) && dateDetails.length > 1) {
      const dateLines = dateDetails.map(dd => {
        const dateFmt = new Date(dd.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const petNames = dd.pets && dd.pets.length > 0 ? dd.pets.map(p => p.name).join(', ') : '';
        return `  • ${dateFmt}${dd.time ? ' at ' + dd.time : ''}${petNames ? ' — ' + petNames : ''}`;
      });
      dateDetailsSection = `\n📋 Your Appointments:\n${dateLines.join('\n')}`;
    }

    const paymentLine = autoCharged
      ? `\n✅ Your card on file has been charged $${Number(estimatedTotal).toFixed(2)}.`
      : paymentLink
        ? `\nTo complete your booking, please submit payment here:\n${paymentLink}`
        : recurringSection
          ? '' // Recurring billing explained in recurringSection
          : `\nPayment will be handled at the time of service.`;

    body = [
      `Hi ${name}!\n`,
      `Great news! Rachel has confirmed your booking request.\n`,
      `Service: ${service}`,
      `Date: ${scheduledDate}`,
      scheduledTime ? `Time: ${scheduledTime}` : '',
      adminNotes ? `\nNote from Rachel: ${adminNotes}` : '',
      dateDetailsSection,
      recurringSection,
      invoiceSection,
      paymentLine,
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
