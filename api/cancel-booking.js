const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

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
    const cancellationType = calculateCancellationType(booking, isSingleCancel ? cancelDate : null);

    let refunded = false;
    let stripeActionResult = null;

    // 4. Handle Stripe payment/invoice actions
    if (cancellationType === 'free') {
      if (booking.payment_intent_id) {
        try {
          const intent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
          if (intent.status === 'requires_capture') {
            await stripe.paymentIntents.cancel(booking.payment_intent_id);
            stripeActionResult = { action: 'canceled_intent', paymentIntentId: booking.payment_intent_id };
            refunded = true;
          } else if (intent.status === 'succeeded') {
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
              if (invoice.metadata?.service_date === cancelDate) {
                await stripe.invoices.voidInvoice(invoice.id);
                refunded = true;
              }
            } else {
              await stripe.invoices.voidInvoice(invoice.id);
              refunded = true;
            }
          }
        } catch (invoiceErr) {
          console.error('Failed to void invoices:', invoiceErr.message);
        }
      }
    } else if (cancellationType === 'late') {
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

    // 7. Return success response
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
  const serviceDate = specificDate || booking.scheduled_date || booking.preferred_date;
  if (!serviceDate) {
    return 'late';
  }
  const serviceDateObj = new Date(serviceDate + 'T00:00:00-05:00');
  const cutoffTime = new Date(serviceDateObj);
  cutoffTime.setDate(cutoffTime.getDate() - 2);
  cutoffTime.setHours(23, 59, 59, 999);
  return now <= cutoffTime ? 'free' : 'late';
}
