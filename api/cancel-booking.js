const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { sendEmail, sendToRachel, fmt12, escHtml, SITE_URL } = require('./_email');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  try {
    const { bookingRequestId, canceledBy, cancelSingle, cancelDate, issueRefund } = req.body;

    if (!bookingRequestId || !canceledBy) {
      return res.status(400).json({ error: 'bookingRequestId and canceledBy are required' });
    }

    // 1. Fetch the booking_request
    const { data: booking, error: fetchErr } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('id', bookingRequestId)
      .single();

    if (fetchErr || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'canceled') {
      return res.status(400).json({ error: 'Booking is already canceled' });
    }

    // 2. Determine if this is single occurrence or full booking cancel
    const isRecurring = !!booking.recurrence_pattern;
    const isSingleCancel = cancelSingle && isRecurring;

    // 3. Calculate if it's a free or late cancel based on policy
    // Policy: Free cancel = before midnight, 2 days before booking (EST)
    const cancellationType = calculateCancellationType(booking, isSingleCancel ? cancelDate : null);

    let refunded = false;
    let refundResult = null;

    // 4. Handle Stripe refund/payment actions based on Rover model
    //    Payment is already captured — free cancel = refund, late cancel = no refund
    if (cancellationType === 'free' && booking.payment_intent_id) {
      try {
        const intent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);

        if (intent.status === 'succeeded') {
          // Payment was captured — issue a full refund
          const refund = await stripe.refunds.create({
            payment_intent: booking.payment_intent_id,
            reason: 'requested_by_customer',
          });
          refunded = true;
          refundResult = { action: 'refunded', refundId: refund.id, amount: refund.amount / 100 };
          console.log('[cancel] Free cancel refund issued:', refund.id, 'Amount: $' + (refund.amount / 100).toFixed(2));

          // Update payment record to reflect refund
          await supabase.from('payments')
            .update({ status: 'refunded', notes: 'Free cancellation — auto-refund' })
            .eq('stripe_session_id', booking.payment_intent_id);
        } else if (intent.status === 'requires_capture') {
          // Edge case: if somehow still uncaptured, just cancel the intent
          await stripe.paymentIntents.cancel(booking.payment_intent_id);
          refunded = true;
          refundResult = { action: 'canceled_intent', paymentIntentId: booking.payment_intent_id };
          console.log('[cancel] Canceled uncaptured intent:', booking.payment_intent_id);
        } else {
          refundResult = { action: 'no_refund_needed', intentStatus: intent.status };
        }
      } catch (stripeErr) {
        console.error('[cancel] Refund failed:', stripeErr.message);
        refundResult = { action: 'refund_failed', error: stripeErr.message };
      }
    } else if (cancellationType === 'late') {
      // Late cancel — no refund, payment stays captured
      console.log('[cancel] Late cancel — no refund. Payment retained.');
      refundResult = { action: 'late_cancel_no_refund' };
    }

    // 4b. OVERRIDE REFUND — Owner/staff chose to refund regardless of policy
    if (issueRefund && booking.payment_intent_id && !refunded && (canceledBy === 'owner' || canceledBy === 'staff')) {
      try {
        const intent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);

        if (intent.status === 'succeeded') {
          const refund = await stripe.refunds.create({
            payment_intent: booking.payment_intent_id,
            reason: 'requested_by_customer',
          });
          refunded = true;
          refundResult = { action: 'owner_refunded', refundId: refund.id, amount: refund.amount / 100 };
          console.log('[cancel] Owner override refund:', refund.id, 'Amount: $' + (refund.amount / 100).toFixed(2));

          await supabase.from('payments')
            .update({ status: 'refunded', notes: 'Owner/staff override refund' })
            .eq('stripe_session_id', booking.payment_intent_id);
        }
      } catch (refundErr) {
        console.error('[cancel] Override refund failed:', refundErr.message);
        refundResult = { action: 'refund_failed', error: refundErr.message };
      }
    }

    // 5. Update booking_requests
    const updateData = {
      canceled_at: new Date().toISOString(),
      canceled_by: canceledBy,
      cancellation_type: cancellationType,
    };

    if (isSingleCancel && cancelDate) {
      // For single occurrence cancel, add to canceled_dates array
      const currentCanceledDates = Array.isArray(booking.canceled_dates) ? booking.canceled_dates : [];
      if (!currentCanceledDates.includes(cancelDate)) {
        currentCanceledDates.push(cancelDate);
        updateData.canceled_dates = currentCanceledDates;
      }
    } else {
      // For full booking cancel, set status to canceled
      updateData.status = 'canceled';
    }

    const { error: updateErr } = await supabase
      .from('booking_requests')
      .update(updateData)
      .eq('id', bookingRequestId);

    if (updateErr) {
      console.error('Failed to update booking:', updateErr.message);
      return res.status(500).json({ error: 'Failed to update booking cancellation status' });
    }

    // 6. For recurring single-day cancel, also handle the specific recurring_invoice
    if (isSingleCancel && cancelDate) {
      const { data: recurringInvoice } = await supabase
        .from('recurring_invoices')
        .select('*')
        .eq('booking_request_id', bookingRequestId)
        .eq('service_date', cancelDate)
        .single();

      if (recurringInvoice && recurringInvoice.stripe_invoice_id) {
        try {
          if (cancellationType === 'free') {
            await stripe.invoices.voidInvoice(recurringInvoice.stripe_invoice_id);
            await supabase
              .from('recurring_invoices')
              .update({ status: 'voided' })
              .eq('id', recurringInvoice.id);
          } else if (cancellationType === 'late') {
            await supabase
              .from('recurring_invoices')
              .update({ status: 'captured' })
              .eq('id', recurringInvoice.id);
          }
        } catch (invoiceErr) {
          console.error('Failed to handle recurring invoice:', invoiceErr.message);
        }
      }
    }

    // 7. Send cancellation email notifications (non-blocking)
    const safeName = escHtml(booking.contact_name || 'Client');
    const safeService = escHtml(booking.service || 'Pet Care');
    const serviceDate = cancelDate || booking.scheduled_date || booking.preferred_date || '';
    const dateFmt = serviceDate
      ? new Date(serviceDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : 'TBD';
    const timeFmt = booking.preferred_time ? fmt12(booking.preferred_time) : '';
    const cancelLabel = isSingleCancel ? 'a single visit' : 'the booking';
    const refundAmount = refundResult && refundResult.amount ? '$' + refundResult.amount.toFixed(2) : (booking.estimated_total ? '$' + Number(booking.estimated_total).toFixed(2) : '');
    const refundNote = refunded
      ? `<div style="background:#d4edda;border-radius:8px;padding:12px;margin:12px 0;color:#155724;font-weight:600">💳 A full refund of ${refundAmount} has been issued to your card on file. Please allow 5-10 business days for it to appear.</div>`
      : '';
    const feeNote = cancellationType === 'late' && !refunded
      ? '<div style="background:#fff3cd;border-radius:8px;padding:12px;margin:12px 0;color:#856404;font-weight:600">⚠️ Late cancellation (within 48 hours) — no refund per cancellation policy.</div>'
      : (refundNote || '<div style="background:#d4edda;border-radius:8px;padding:12px;margin:12px 0;color:#155724;font-weight:600">✅ Canceled before the 48-hour window — full refund issued.</div>');

    try {
      if (canceledBy === 'client') {
        // Client canceled → Notify Rachel (owner)
        await sendToRachel({
          subject: `🔴 Booking Canceled: ${safeService} — ${safeName}`,
          title: 'Booking Canceled by Client',
          bodyHTML: `
            <p><strong>${safeName}</strong> has canceled ${cancelLabel} for <strong>${safeService}</strong>.</p>
            <div style="background:#fef2f2;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #c62828">
              <div style="font-weight:700;font-size:1.05rem;margin-bottom:8px">${safeService}</div>
              ${dateFmt !== 'TBD' ? `<div style="margin-bottom:4px">📅 ${dateFmt}</div>` : ''}
              ${timeFmt ? `<div style="margin-bottom:4px">🕐 ${timeFmt}</div>` : ''}
              <div style="margin-top:8px;font-size:0.85rem;color:#666">Canceled by: ${safeName}</div>
            </div>
            ${feeNote}
            <div style="margin-top:20px">
              <a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#3d5a47;color:white;border-radius:8px;text-decoration:none;font-weight:700">View in Dashboard →</a>
            </div>
          `,
        });
      } else if ((canceledBy === 'owner' || canceledBy === 'staff') && booking.contact_email) {
        // Owner/Staff canceled → Notify client (email)
        const canceledByName = canceledBy === 'owner' ? 'Rachel' : 'your pet care provider';
        await sendEmail({
          to: booking.contact_email,
          subject: `Booking Canceled${refunded ? ' — Refund Issued' : ''} — ${safeService} — Housley Happy Paws`,
          title: refunded ? 'Booking Canceled — Refund Issued' : 'Booking Canceled',
          bodyHTML: `
            <p>Hi ${safeName}!</p>
            <p>Your <strong>${safeService}</strong> booking has been canceled by ${canceledByName}. We sincerely apologize for any inconvenience.</p>
            <div style="background:#fef2f2;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #c62828">
              <div style="font-weight:700;font-size:1.05rem;margin-bottom:8px">${safeService}</div>
              ${dateFmt !== 'TBD' ? `<div style="margin-bottom:4px">📅 ${dateFmt}</div>` : ''}
              ${timeFmt ? `<div style="margin-bottom:4px">🕐 ${timeFmt}</div>` : ''}
            </div>
            ${feeNote}
            <p>If you have any questions, please don't hesitate to reach out.</p>
            <div style="margin-top:20px">
              <a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#3d5a47;color:white;border-radius:8px;text-decoration:none;font-weight:700">View in Your Portal →</a>
            </div>
            <p style="font-size:0.85rem;color:#8c6b4a;margin-top:16px">Questions? Reply to this email or call 717-715-7595</p>
          `,
        });

        // Also notify Rachel when STAFF cancels so she's in the loop
        if (canceledBy === 'staff') {
          try {
            await sendToRachel({
              subject: `🔴 Staff Canceled: ${safeService} — ${safeName}${refunded ? ' (Refund Issued)' : ''}`,
              title: 'Booking Canceled by Staff',
              bodyHTML: `
                <p>A staff member has canceled ${cancelLabel} for <strong>${safeName}</strong>'s <strong>${safeService}</strong>.</p>
                <div style="background:#fef2f2;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #c62828">
                  <div style="font-weight:700;font-size:1.05rem;margin-bottom:8px">${safeService}</div>
                  ${dateFmt !== 'TBD' ? `<div style="margin-bottom:4px">📅 ${dateFmt}</div>` : ''}
                  ${timeFmt ? `<div style="margin-bottom:4px">🕐 ${timeFmt}</div>` : ''}
                </div>
                ${refunded ? `<div style="background:#e8f5e9;border-radius:8px;padding:12px;margin:12px 0;color:#2e7d32;font-weight:600">💳 Full refund of ${refundAmount} was issued to the client.</div>` : ''}
                <div style="margin-top:20px">
                  <a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#3d5a47;color:white;border-radius:8px;text-decoration:none;font-weight:700">View in Dashboard →</a>
                </div>
              `,
            });
          } catch(e) { console.error('Failed to notify owner of staff cancel:', e.message); }
        }
      }

      // 7b. In-app notification to client
      if (booking.client_id && (canceledBy === 'owner' || canceledBy === 'staff')) {
        try {
          const msgBody = refunded
            ? `Your ${safeService} booking has been canceled and a full refund of ${refundAmount} has been issued to your card.`
            : `Your ${safeService} booking has been canceled.`;
          await supabase.from('messages').insert({
            sender_id: null,
            sender_name: 'Rachel Housley',
            recipient_id: booking.client_id,
            body: '📋 ' + msgBody,
            is_alert: true,
          });
        } catch(e) { console.error('Failed to send in-app notification:', e.message); }
      }
    } catch (emailErr) {
      console.error('Failed to send cancellation email:', emailErr.message);
      // Don't fail the cancellation if email fails
    }

    // 8. Return success response
    let message = 'Booking canceled.';
    if (refunded) message = cancellationType === 'free' ? 'Booking canceled. Full refund issued.' : 'Booking canceled. Refund issued by owner.';
    else if (cancellationType === 'free') message = 'Booking canceled. No charge applied.';
    else if (cancellationType === 'late') message = 'Booking canceled. Late cancellation — no refund per policy.';

    res.status(200).json({
      success: true,
      cancellationType,
      refunded,
      message,
      details: {
        isSingleCancel,
        cancelDate: isSingleCancel ? cancelDate : null,
        refund: refundResult,
      },
    });
  } catch (err) {
    console.error('Cancel booking error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Calculate cancellation type based on booking date and current time
 * Policy: Free cancel = before midnight EST, 2 days before booking date
 * Late cancel = after that cutoff (within 48 hours of service)
 */
function calculateCancellationType(booking, specificDate) {
  const now = new Date();

  // Determine the service date to check
  const serviceDate = specificDate || booking.scheduled_date || booking.preferred_date;
  if (!serviceDate) {
    return 'late'; // Default to late if no date found
  }

  // Convert service date to EST midnight (2 days before)
  const serviceDateObj = new Date(serviceDate + 'T00:00:00-05:00'); // EST
  const cutoffTime = new Date(serviceDateObj);
  cutoffTime.setDate(cutoffTime.getDate() - 2); // 2 days before
  cutoffTime.setHours(23, 59, 59, 999); // Midnight EST (11:59 PM)

  // Compare current time with cutoff
  return now <= cutoffTime ? 'free' : 'late';
}
