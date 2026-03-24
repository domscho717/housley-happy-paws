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
    const { bookingRequestId, canceledBy, cancelSingle, cancelDate } = req.body;

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
    let stripeActionResult = null;

    // 4. Handle Stripe payment/invoice actions
    if (cancellationType === 'free') {
      // Free cancel: try to cancel uncaptured payment intent or void open invoice
      if (booking.payment_intent_id) {
        try {
          // Try to cancel the payment intent (for uncaptured holds)
          const intent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
          if (intent.status === 'requires_capture') {
            await stripe.paymentIntents.cancel(booking.payment_intent_id);
            stripeActionResult = { action: 'canceled_intent', paymentIntentId: booking.payment_intent_id };
            refunded = true;
          } else if (intent.status === 'succeeded') {
            // Already captured - would need to refund instead
            // For now, note this case
            stripeActionResult = { action: 'intent_already_captured', note: 'May need manual refund' };
          }
        } catch (stripeErr) {
          console.error('Failed to cancel payment intent:', stripeErr.message);
          stripeActionResult = { action: 'cancel_intent_failed', error: stripeErr.message };
        }
      }

      // Check for open Stripe invoices (for recurring)
      if (isRecurring && booking.contact_email) {
        try {
          const invoices = await stripe.invoices.list({
            customer: null,
            limit: 100,
            status: 'draft,open',
          });

          const relevantInvoices = invoices.data.filter(inv =>
            inv.customer_email === booking.contact_email &&
            inv.metadata?.booking_request_id === booking.id
          );

          for (const invoice of relevantInvoices) {
            if (isSingleCancel && cancelDate) {
              // Only void if it's for the canceled date
              if (invoice.metadata?.service_date === cancelDate) {
                await stripe.invoices.voidInvoice(invoice.id);
                refunded = true;
              }
            } else {
              // Cancel all invoices for this booking
              await stripe.invoices.voidInvoice(invoice.id);
              refunded = true;
            }
          }
        } catch (invoiceErr) {
          console.error('Failed to void invoices:', invoiceErr.message);
        }
      }
    } else if (cancellationType === 'late') {
      // Late cancel: capture any uncaptured payment intent
      if (booking.payment_intent_id) {
        try {
          const intent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
          if (intent.status === 'requires_capture') {
            await stripe.paymentIntents.capture(booking.payment_intent_id);
            stripeActionResult = { action: 'captured_intent', paymentIntentId: booking.payment_intent_id };
          }
        } catch (stripeErr) {
          console.error('Failed to capture payment intent:', stripeErr.message);
          stripeActionResult = { action: 'capture_intent_failed', error: stripeErr.message };
        }
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

    // 6. For recurring single-day cancel, also cancel/capture the specific recurring_invoice
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
            // Void the invoice
            await stripe.invoices.voidInvoice(recurringInvoice.stripe_invoice_id);
            await supabase
              .from('recurring_invoices')
              .update({ status: 'voided' })
              .eq('id', recurringInvoice.id);
          } else if (cancellationType === 'late') {
            // Finalize and mark as captured
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
    const feeNote = cancellationType === 'late'
      ? '<div style="background:#fff3cd;border-radius:8px;padding:12px;margin:12px 0;color:#856404;font-weight:600">⚠️ Late cancellation — the cancellation fee will be charged per policy.</div>'
      : '<div style="background:#d4edda;border-radius:8px;padding:12px;margin:12px 0;color:#155724;font-weight:600">✅ Canceled before the 48-hour window — no charge.</div>';

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
      } else if (canceledBy === 'owner' && booking.contact_email) {
        // Owner canceled → Notify client
        await sendEmail({
          to: booking.contact_email,
          subject: `Booking Canceled — ${safeService} — Housley Happy Paws`,
          title: 'Booking Canceled',
          bodyHTML: `
            <p>Hi ${safeName}!</p>
            <p>Your <strong>${safeService}</strong> booking has been canceled by Rachel.</p>
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
      }
    } catch (emailErr) {
      console.error('Failed to send cancellation email:', emailErr.message);
      // Don't fail the cancellation if email fails
    }

    // 8. Return success response
    res.status(200).json({
      success: true,
      cancellationType,
      refunded,
      message: cancellationType === 'free'
        ? 'Booking canceled. No charge applied.'
        : 'Booking canceled. Late cancellation fee applied.',
      details: {
        isSingleCancel,
        cancelDate: isSingleCancel ? cancelDate : null,
        stripeAction: stripeActionResult,
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
 * Late cancel = after that cutoff
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
