const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { sendEmail, sendToRachel, fmt12, escHtml, SITE_URL } = require('./_email');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // --- Authentication: require valid Bearer token ---
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — missing token' });
  }
  const token = authHeader.replace('Bearer ', '');
  const supabaseAuth = createClient(
    process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  );
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser(token);
  if (authErr || !user) {
    return res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  try {
    const { bookingRequestId, canceledBy, cancelSingle, cancelDate, issueRefund, stopRecurring } = req.body;

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

    // --- Authorization: caller must be the booking's client, OR owner/staff ---
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    const callerRole = callerProfile ? callerProfile.role : 'client';
    const isOwnerOrStaff = callerRole === 'owner' || callerRole === 'staff';
    const isBookingOwner = booking.client_id === user.id || booking.contact_email === user.email;
    if (!isOwnerOrStaff && !isBookingOwner) {
      return res.status(403).json({ error: 'Forbidden — you can only cancel your own bookings' });
    }

    // 2. Determine if this is single occurrence or full booking cancel
    const isRecurring = !!booking.recurrence_pattern;
    const isSingleCancel = cancelSingle && isRecurring;

    // Validate that cancelDate is provided for single occurrence cancel
    if (isSingleCancel && !cancelDate) {
      return res.status(400).json({ error: 'cancelDate is required for single-occurrence cancellation' });
    }

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
          // Check if this payment intent is shared by multiple bookings (batch charge)
          const { data: sharedBookings } = await supabase
            .from('booking_requests')
            .select('id, estimated_total, status')
            .eq('payment_intent_id', booking.payment_intent_id);

          const isBatchPayment = sharedBookings && sharedBookings.length > 1;
          const refundAmount = isBatchPayment
            ? Math.round((booking.estimated_total || 0) * 100) // Partial: just this booking's amount in cents
            : undefined; // Full refund (Stripe defaults to full amount)

          const refundParams = {
            payment_intent: booking.payment_intent_id,
            reason: 'requested_by_customer',
          };
          if (refundAmount) refundParams.amount = refundAmount;

          const refund = await stripe.refunds.create(refundParams, {
            idempotencyKey: `cancel-refund-${bookingRequestId}-${refundAmount || 'full'}`,
          });
          refunded = true;
          refundResult = { action: isBatchPayment ? 'partial_refund' : 'refunded', refundId: refund.id, amount: refund.amount / 100 };
          console.log('[cancel] ' + (isBatchPayment ? 'Partial' : 'Full') + ' refund issued:', refund.id, 'Amount: $' + (refund.amount / 100).toFixed(2));

          // Update payment record — only mark as refunded if ALL bookings on this payment are canceled
          if (isBatchPayment) {
            const activeBookings = sharedBookings.filter(b => b.id !== bookingRequestId && b.status !== 'canceled');
            if (activeBookings.length === 0) {
              // All bookings canceled — mark payment as fully refunded
              await supabase.from('payments')
                .update({ status: 'refunded', notes: 'All batch bookings canceled — fully refunded' })
                .eq('stripe_session_id', booking.payment_intent_id);
            } else {
              // Some bookings still active — mark as partially refunded
              await supabase.from('payments')
                .update({ status: 'partial_refund', notes: 'Partial refund — ' + activeBookings.length + ' booking(s) still active' })
                .eq('stripe_session_id', booking.payment_intent_id);
            }
          } else {
            await supabase.from('payments')
              .update({ status: 'refunded', notes: 'Free cancellation — auto-refund' })
              .eq('stripe_session_id', booking.payment_intent_id);
          }
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
          // Check if batch payment — partial refund only this booking's amount
          const { data: sharedBookings } = await supabase
            .from('booking_requests')
            .select('id, estimated_total, status')
            .eq('payment_intent_id', booking.payment_intent_id);

          const isBatchPayment = sharedBookings && sharedBookings.length > 1;
          const refundParams = {
            payment_intent: booking.payment_intent_id,
            reason: 'requested_by_customer',
          };
          if (isBatchPayment) {
            refundParams.amount = Math.round((booking.estimated_total || 0) * 100);
          }

          const refund = await stripe.refunds.create(refundParams, {
            idempotencyKey: `cancel-override-${bookingRequestId}`,
          });
          refunded = true;
          refundResult = { action: 'owner_refunded', refundId: refund.id, amount: refund.amount / 100 };
          console.log('[cancel] Owner override ' + (isBatchPayment ? 'partial ' : '') + 'refund:', refund.id, 'Amount: $' + (refund.amount / 100).toFixed(2));

          if (isBatchPayment) {
            const activeBookings = sharedBookings.filter(b => b.id !== bookingRequestId && b.status !== 'canceled');
            if (activeBookings.length === 0) {
              await supabase.from('payments')
                .update({ status: 'refunded', notes: 'All batch bookings canceled — owner override refund' })
                .eq('stripe_session_id', booking.payment_intent_id);
            } else {
              await supabase.from('payments')
                .update({ status: 'partial_refund', notes: 'Owner override partial refund — ' + activeBookings.length + ' booking(s) still active' })
                .eq('stripe_session_id', booking.payment_intent_id);
            }
          } else {
            await supabase.from('payments')
              .update({ status: 'refunded', notes: 'Owner/staff override refund' })
              .eq('stripe_session_id', booking.payment_intent_id);
          }
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

    // Handle "Stop Recurring" — mark as completed, not canceled
    const isStopRecurring = stopRecurring && isRecurring;

    if (isStopRecurring) {
      updateData.status = 'completed';
      updateData.cancellation_type = 'stop_recurring';
      try {
        const pattern = typeof booking.recurrence_pattern === 'string'
          ? JSON.parse(booking.recurrence_pattern) : booking.recurrence_pattern;
        const todayEST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const todayStr = todayEST.toLocaleDateString('en-CA');
        if (pattern.type === 'per_card' && Array.isArray(pattern.schedules)) {
          pattern.schedules.forEach(s => { s.ongoing = false; s.end_date = todayStr; });
        } else {
          pattern.end_date = todayStr;
        }
        updateData.recurrence_pattern = pattern;
      } catch(pe) { console.warn('Pattern update error:', pe); }
    } else if (isSingleCancel && cancelDate) {
      const currentCanceledDates = Array.isArray(booking.canceled_dates) ? booking.canceled_dates : [];
      if (!currentCanceledDates.includes(cancelDate)) {
        currentCanceledDates.push(cancelDate);
        updateData.canceled_dates = currentCanceledDates;
      }
    } else {
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

    // 5b. For stop recurring, handle this week's charge based on 48-hour policy
    if (isStopRecurring) {
      try {
        const todayEST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const todayStr = todayEST.toLocaleDateString('en-CA');
        const { data: futureInvoices } = await supabase
          .from('recurring_invoices')
          .select('*')
          .eq('booking_request_id', bookingRequestId)
          .gte('service_date', todayStr)
          .eq('status', 'sent');

        if (futureInvoices && futureInvoices.length > 0) {
          for (const inv of futureInvoices) {
            const svcCancelType = calculateCancellationType(booking, inv.service_date);
            if (svcCancelType === 'free' && inv.stripe_invoice_id) {
              try {
                if (inv.stripe_invoice_id.startsWith('pi_')) {
                  const intent = await stripe.paymentIntents.retrieve(inv.stripe_invoice_id);
                  if (intent.status === 'succeeded') {
                    await stripe.refunds.create({ payment_intent: inv.stripe_invoice_id, reason: 'requested_by_customer' });
                  }
                } else if (inv.stripe_invoice_id.startsWith('in_')) {
                  await stripe.invoices.voidInvoice(inv.stripe_invoice_id);
                }
                await supabase.from('recurring_invoices').update({ status: 'voided' }).eq('id', inv.id);
              } catch(voidErr) { console.warn('Void future invoice:', voidErr.message); }
            } else if (svcCancelType === 'late') {
              await supabase.from('recurring_invoices').update({ status: 'captured' }).eq('id', inv.id);
            }
          }
        }
      } catch(stopErr) { console.error('Stop recurring invoice handling:', stopErr); }
    }

    // 6. For recurring single-day cancel, also handle the specific recurring_invoice
    if (isSingleCancel && cancelDate) {
      const { data: recurringInvoice } = await supabase
        .from('recurring_invoices')
        .select('*')
        .eq('booking_request_id', bookingRequestId)
        .eq('service_date', cancelDate)
        .maybeSingle();

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
    const cancelLabel = isStopRecurring ? 'the recurring service (stopped by client)' : (isSingleCancel ? 'a single visit' : 'the booking');
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
    if (isStopRecurring) message = 'Recurring service stopped. No further charges will be made.';
    else if (refunded) message = cancellationType === 'free' ? 'Booking canceled. Full refund issued.' : 'Booking canceled. Refund issued by owner.';
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
  // Get current time in Eastern timezone
  const nowEastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));

  // Determine the service date to check
  const serviceDate = specificDate || booking.scheduled_date || booking.preferred_date;
  if (!serviceDate) {
    return 'late'; // Default to late if no date found
  }

  // Parse service date as midnight in local Eastern timezone
  const serviceDateObj = new Date(serviceDate + 'T00:00:00');
  const cutoffTime = new Date(serviceDateObj);
  cutoffTime.setDate(cutoffTime.getDate() - 2); // 2 days before
  cutoffTime.setHours(23, 59, 59, 999); // 11:59 PM on cutoff date

  // Compare current time with cutoff
  return nowEastern <= cutoffTime ? 'free' : 'late';
}
