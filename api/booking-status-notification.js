/**
 * Booking Status Notification API
 * Sends email to client when Rachel accepts/declines/modifies their booking.
 * Uses Resend for email delivery.
 */

const { sendEmail, fmt12, escHtml, SITE_URL } = require('./_email');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    email, name, service, status,
    scheduledDate, scheduledTime, adminNotes,
    paymentLink, estimatedTotal, priceBreakdown,
    autoCharged, recurrencePattern, dateDetails,
    isOwnerNotification, clientName, clientAddress, mapLink
  } = req.body || {};

  if (!email || !name || !service || !status) {
    return res.status(400).json({ error: 'Missing required fields: email, name, service, status' });
  }

  // Validate status is one of the expected values
  if (!['accepted', 'modified', 'declined', 'payment_hold', 'payment_decline_warning', 'payment_auto_canceled', 'canceled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be: accepted, modified, declined, canceled, payment_hold, payment_decline_warning, or payment_auto_canceled' });
  }

  try {
  const safeName = escHtml(name);
  const safeService = escHtml(service);
  const safeNotes = escHtml(adminNotes);

  let subject, bodyHTML;
  const dateFmt = scheduledDate ? new Date(scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
  const timeFmt = fmt12(scheduledTime) || '';

  // ── Owner notification: client accepted/canceled time change ──
  if (isOwnerNotification && (status === 'accepted' || status === 'canceled')) {
    const safeClientName = escHtml(clientName || 'Client');
    const safeAddress = escHtml(clientAddress || '');

    if (status === 'accepted') {
      subject = `✅ ${safeClientName} accepted the time change — ${safeService}`;
      const mapHTML = mapLink ? `
        <div style="background:#eef4ef;border-radius:10px;padding:16px;margin:16px 0;border:1px solid #c5d8c9">
          <div style="font-weight:700;margin-bottom:8px">📍 Client Address</div>
          <div style="margin-bottom:8px">${safeAddress}</div>
          <a href="${escHtml(mapLink)}" style="display:inline-block;padding:10px 24px;background:#3d5a47;color:white;border-radius:8px;text-decoration:none;font-weight:700">🗺️ Open in Google Maps →</a>
        </div>` : '';
      const payNote = autoCharged ? `<div style="background:#d4edda;border-radius:8px;padding:12px;margin:12px 0;color:#155724;font-weight:600">💳 Payment of $${Number(estimatedTotal).toFixed(2)} charged automatically.</div>` : '';
      bodyHTML = `
        <p>Hi ${escHtml(name)}!</p>
        <p><strong>${safeClientName}</strong> has accepted the time change for <strong>${safeService}</strong>.</p>
        <div style="background:#eef4ef;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #3d5a47">
          <div style="font-weight:700;font-size:1.05rem;margin-bottom:8px">${safeService}</div>
          ${dateFmt ? `<div style="margin-bottom:4px">📅 ${dateFmt}</div>` : ''}
          ${timeFmt ? `<div style="margin-bottom:4px">🕐 ${timeFmt}</div>` : ''}
        </div>
        ${payNote}
        ${mapHTML}
        ${safeNotes ? `<div style="background:#fdf7ee;border-radius:10px;padding:14px;margin:16px 0;border:1px solid #e8e0d4"><div style="font-style:italic;color:#5c3d1e">${safeNotes}</div></div>` : ''}
        <div style="margin-top:20px">
          <a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#3d5a47;color:white;border-radius:8px;text-decoration:none;font-weight:700">View in Owner Portal →</a>
        </div>
      `;
    } else {
      // canceled
      subject = `❌ ${safeClientName} declined the time change — ${safeService}`;
      bodyHTML = `
        <p>Hi ${escHtml(name)}!</p>
        <p><strong>${safeClientName}</strong> declined the suggested time change for <strong>${safeService}</strong> and has canceled the booking.</p>
        <div style="background:#fde8e8;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #c62828">
          <div style="font-weight:700;margin-bottom:8px;color:#c62828">Booking Canceled</div>
          ${dateFmt ? `<div style="margin-bottom:4px">📅 Was scheduled: ${dateFmt}</div>` : ''}
          ${timeFmt ? `<div style="margin-bottom:4px">🕐 ${timeFmt}</div>` : ''}
        </div>
        ${safeNotes ? `<div style="background:#fdf7ee;border-radius:10px;padding:14px;margin:16px 0;border:1px solid #e8e0d4"><div style="font-style:italic;color:#5c3d1e">${safeNotes}</div></div>` : ''}
        <div style="margin-top:20px">
          <a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#3d5a47;color:white;border-radius:8px;text-decoration:none;font-weight:700">View in Owner Portal →</a>
        </div>
      `;
    }

  } else if (status === 'accepted') {
    subject = `✅ Your ${safeService} booking is confirmed! — Housley Happy Paws`;

    // Build invoice section
    let invoiceHTML = '';
    if (estimatedTotal && estimatedTotal > 0) {
      const breakdownLines = priceBreakdown
        ? priceBreakdown.split(' | ').map(line => `<div style="padding:4px 0;border-bottom:1px solid #e8e0d4">${line}</div>`).join('')
        : `<div style="padding:4px 0">${service}</div>`;
      invoiceHTML = `
        <div style="background:#f5f0e8;border-radius:10px;padding:16px;margin:16px 0;border:1px solid #e8e0d4">
          <div style="font-weight:700;margin-bottom:8px">Invoice</div>
          ${breakdownLines}
          <div style="padding:8px 0 0;font-weight:700;font-size:1.05rem;border-top:2px solid #c8963e;margin-top:8px">Total: $${Number(estimatedTotal).toFixed(2)}</div>
        </div>`;
    }

    // Build recurring section
    let recurringHTML = '';
    if (recurrencePattern) {
      try {
        const rp = typeof recurrencePattern === 'string' ? JSON.parse(recurrencePattern) : recurrencePattern;
        if (rp.type === 'per_card' && rp.schedules) {
          const lines = rp.schedules.map(s => {
            const freqLabel = s.frequency === 'weekly' ? 'Every week' : 'Every other week';
            const startFmt = new Date(s.start_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            const endPart = s.ongoing ? 'until stopped' : (s.end_date ? `until ${new Date(s.end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : '');
            const timePart = s.time ? ` at ${fmt12(s.time)}` : '';
            return `<div style="padding:4px 0">🔄 ${freqLabel} starting ${startFmt}${timePart} — ${endPart}</div>`;
          }).join('');
          recurringHTML = `
            <div style="background:#eef4ef;border-radius:10px;padding:16px;margin:16px 0;border:1px solid #c5d8c9">
              <div style="font-weight:700;margin-bottom:8px">📅 Recurring Schedule</div>
              ${lines}
              <div style="margin-top:10px;font-size:0.85rem;color:#3d5a47">💳 You will be automatically charged on Sunday the week of each appointment. You can also pay early from your appointments page. Cancel anytime by contacting Rachel.</div>
            </div>`;
        }
      } catch (e) { /* ignore parse errors */ }
    }

    // Build multi-date section
    let dateDetailsHTML = '';
    if (dateDetails && Array.isArray(dateDetails) && dateDetails.length > 1) {
      const dateLines = dateDetails.map(dd => {
        const dFmt = new Date(dd.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const petNames = dd.pets && dd.pets.length > 0 ? dd.pets.map(p => p.name).join(', ') : '';
        return `<div style="padding:4px 0">• ${dFmt}${dd.time ? ' at ' + fmt12(dd.time) : ''}${petNames ? ' — ' + petNames : ''}</div>`;
      }).join('');
      dateDetailsHTML = `
        <div style="background:#fdf7ee;border-radius:10px;padding:16px;margin:16px 0">
          <div style="font-weight:700;margin-bottom:8px">📋 Your Appointments</div>
          ${dateLines}
        </div>`;
    }

    // Payment line
    let paymentHTML = '';
    if (autoCharged) {
      paymentHTML = `<div style="background:#d4edda;border-radius:8px;padding:12px;margin:12px 0;color:#155724;font-weight:600">✅ Your card on file has been charged $${Number(estimatedTotal).toFixed(2)}.</div>`;
    } else if (paymentLink) {
      paymentHTML = `
        <div style="margin:16px 0">
          <p>To complete your booking, please submit payment:</p>
          <a href="${paymentLink}" style="display:inline-block;padding:12px 28px;background:#c8963e;color:white;border-radius:8px;text-decoration:none;font-weight:700">💳 Complete Payment →</a>
        </div>`;
    } else if (!recurringHTML) {
      paymentHTML = `<p style="color:#8c6b4a">Payment will be handled at the time of service.</p>`;
    }

    bodyHTML = `
      <p>Hi ${safeName}!</p>
      <p>Great news! Rachel has <strong>confirmed</strong> your booking request. 🎉</p>

      <div style="background:#eef4ef;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #3d5a47">
        <div style="font-weight:700;font-size:1.05rem;margin-bottom:8px">${safeService}</div>
        ${dateFmt ? `<div style="margin-bottom:4px">📅 ${dateFmt}</div>` : ''}
        ${timeFmt ? `<div style="margin-bottom:4px">🕐 ${timeFmt}</div>` : ''}
      </div>

      ${safeNotes ? `<div style="background:#fdf7ee;border-radius:10px;padding:14px;margin:16px 0;border:1px solid #e8e0d4"><div style="font-weight:700;margin-bottom:6px">Note from Rachel:</div><div style="font-style:italic;color:#5c3d1e">${safeNotes}</div></div>` : ''}
      ${dateDetailsHTML}
      ${recurringHTML}
      ${invoiceHTML}
      ${paymentHTML}

      <div style="margin-top:20px">
        <a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#3d5a47;color:white;border-radius:8px;text-decoration:none;font-weight:700">View in Your Portal →</a>
      </div>
      <p style="font-size:0.85rem;color:#8c6b4a;margin-top:16px">Questions? Reply to this email or call 717-715-7595</p>
    `;

  } else if (status === 'modified') {
    subject = `📝 Booking update: Rachel suggested a new time — Housley Happy Paws`;
    bodyHTML = `
      <p>Hi ${safeName}!</p>
      <p>Rachel reviewed your <strong>${safeService}</strong> request and suggested a different time:</p>
      <div style="background:#fff3cd;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #c8963e">
        ${dateFmt ? `<div style="margin-bottom:4px">📅 <strong>New Date:</strong> ${dateFmt}</div>` : ''}
        ${timeFmt ? `<div style="margin-bottom:4px">🕐 <strong>New Time:</strong> ${timeFmt}</div>` : ''}
      </div>
      ${adminNotes ? `<div style="background:#fdf7ee;border-radius:10px;padding:14px;margin:16px 0;border:1px solid #e8e0d4"><div style="font-weight:700;margin-bottom:6px">Rachel's note:</div><div style="font-style:italic;color:#5c3d1e">${adminNotes}</div></div>` : ''}
      <p>Please visit the website or reply to this email to confirm.</p>
      <div style="margin-top:16px"><a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#c8963e;color:white;border-radius:8px;text-decoration:none;font-weight:700">View in Portal →</a></div>
    `;

  } else if (status === 'declined') {
    subject = `Booking update — Housley Happy Paws`;
    bodyHTML = `
      <p>Hi ${safeName}!</p>
      <p>Unfortunately, Rachel is unable to accommodate your <strong>${safeService}</strong> request at this time.</p>
      ${safeNotes ? `<div style="background:#fdf7ee;border-radius:10px;padding:14px;margin:16px 0;border:1px solid #e8e0d4"><div style="font-weight:700;margin-bottom:6px">Note from Rachel:</div><div style="font-style:italic;color:#5c3d1e">${safeNotes}</div></div>` : ''}
      <p>Please feel free to request a different date or time!</p>
      <div style="margin-top:16px"><a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#c8963e;color:white;border-radius:8px;text-decoration:none;font-weight:700">Book a New Time →</a></div>
    `;

  } else if (status === 'payment_hold') {
    const safeDeclineMsg = escHtml(req.body?.declineMessage || 'Your payment could not be processed.');
    subject = `⚠️ Payment issue with your ${safeService} booking — Housley Happy Paws`;
    bodyHTML = `
      <p>Hi ${safeName}!</p>
      <p>Rachel would love to confirm your <strong>${safeService}</strong> booking, but there was an issue with your payment:</p>

      <div style="background:#fff3cd;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #ffc107">
        <div style="font-weight:700;margin-bottom:8px;color:#856404">⚠️ Payment Issue</div>
        <div style="color:#856404">${safeDeclineMsg}</div>
      </div>

      ${dateFmt ? `<div style="margin-bottom:4px">📅 Requested date: ${dateFmt}</div>` : ''}
      ${timeFmt ? `<div style="margin-bottom:4px">🕐 Requested time: ${timeFmt}</div>` : ''}
      ${estimatedTotal ? `<div style="margin-bottom:4px">💰 Total: $${Number(estimatedTotal).toFixed(2)}</div>` : ''}

      <p style="margin-top:16px">Please log in and update your payment method so we can confirm your booking:</p>

      <div style="margin-top:16px">
        <a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#c8963e;color:white;border-radius:8px;text-decoration:none;font-weight:700">Update Payment Method →</a>
      </div>

      <p style="font-size:0.85rem;color:#8c6b4a;margin-top:16px">Your booking is on hold and will be confirmed once payment is resolved. Questions? Reply to this email or call 717-715-7595.</p>
    `;

  } else if (status === 'payment_decline_warning') {
    const safeDeclineMsg = escHtml(req.body?.declineMessage || 'Your card was declined.');
    subject = `🚨 Action Required: Payment declined for your ${safeService} booking — Housley Happy Paws`;
    bodyHTML = `
      <p>Hi ${safeName}!</p>
      <p>Your <strong>${safeService}</strong> appointment is coming up soon, but we were unable to process your payment:</p>

      <div style="background:#fde8e8;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #c62828">
        <div style="font-weight:700;margin-bottom:8px;color:#c62828">❌ Payment Declined</div>
        <div style="color:#c62828">${safeDeclineMsg}</div>
      </div>

      ${dateFmt ? `<div style="margin-bottom:4px">📅 Appointment: ${dateFmt}</div>` : ''}
      ${timeFmt ? `<div style="margin-bottom:4px">🕐 Time: ${timeFmt}</div>` : ''}
      ${estimatedTotal ? `<div style="margin-bottom:4px">💰 Amount due: $${Number(estimatedTotal).toFixed(2)}</div>` : ''}

      <div style="background:#fff3cd;border-radius:10px;padding:16px;margin:16px 0;border:1px solid #ffc107">
        <div style="font-weight:700;color:#856404;margin-bottom:6px">⏰ You have 24 hours to update your payment method</div>
        <div style="color:#856404">If payment is not resolved within 24 hours, your booking will be automatically canceled.</div>
      </div>

      <p>Please log in and update your card to keep your appointment:</p>

      <div style="margin-top:16px">
        <a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#c62828;color:white;border-radius:8px;text-decoration:none;font-weight:700">Update Payment Now →</a>
      </div>

      <p style="font-size:0.85rem;color:#8c6b4a;margin-top:16px">Need help? Reply to this email or call 717-715-7595.</p>
    `;

  } else if (status === 'payment_auto_canceled') {
    subject = `❌ Booking canceled — payment not received for ${safeService} — Housley Happy Paws`;
    bodyHTML = `
      <p>Hi ${safeName},</p>
      <p>Unfortunately, your <strong>${safeService}</strong> booking has been automatically canceled because we were unable to process your payment within the 24-hour grace period.</p>

      ${dateFmt ? `<div style="margin-bottom:4px">📅 Original date: ${dateFmt}</div>` : ''}
      ${timeFmt ? `<div style="margin-bottom:4px">🕐 Original time: ${timeFmt}</div>` : ''}

      <p>We'd love to still see you! You can update your payment method and book a new appointment anytime:</p>

      <div style="margin-top:16px">
        <a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#c8963e;color:white;border-radius:8px;text-decoration:none;font-weight:700">Book Again →</a>
      </div>

      <p style="font-size:0.85rem;color:#8c6b4a;margin-top:16px">Questions? Reply to this email or call 717-715-7595.</p>
    `;
  }

  const result = await sendEmail({
    to: email,
    subject,
    title: isOwnerNotification ? (status === 'accepted' ? 'Time Change Accepted' : 'Booking Canceled') : status === 'accepted' ? 'Booking Confirmed!' : status === 'canceled' ? 'Booking Canceled' : status === 'payment_hold' ? 'Payment Issue' : status === 'payment_decline_warning' ? 'Payment Declined' : status === 'payment_auto_canceled' ? 'Booking Canceled' : status === 'modified' ? 'Booking Update' : 'Booking Update',
    bodyHTML,
  });

  return res.status(200).json({
    success: true,
    emailSent: result.success,
    emailId: result.id || null,
    emailError: result.error || null,
    message: result.success ? 'Status notification emailed to client.' : 'Notification logged (email not configured).',
    subject,
  });
  } catch (err) {
    console.error('[booking-status-notification] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
