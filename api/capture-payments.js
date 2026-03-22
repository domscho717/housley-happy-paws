/**
 * Capture Payments Cron Job
 * Runs daily via Vercel Cron — captures payment intents for bookings scheduled today
 *
 * Flow:
 * 1. Query booking_requests where status='accepted' AND scheduled_date = today AND payment_intent_id IS NOT NULL
 * 2. For each, capture the Stripe payment intent
 * 3. Handle recurring invoices: queries recurring_invoices where service_date = today AND status != 'captured'
 * 4. Logs results
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // Allow manual trigger via POST or cron via GET
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret (Vercel sets this automatically for cron jobs)
  // Also allow manual trigger with a secret header
  const cronSecret = req.headers['authorization'];
  const manualSecret = req.headers['x-cron-secret'];
  const envSecret = process.env.CRON_SECRET;

  // In production, verify the secret. Skip for development.
  if (envSecret && cronSecret !== `Bearer ${envSecret}` && manualSecret !== envSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  // Today's date in YYYY-MM-DD
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const results = {
    processed: 0,
    captured: 0,
    skipped: 0,
    failed: 0,
    recurringProcessed: 0,
    errors: [],
  };

  try {
    // 1. Capture payment intents for one-time bookings scheduled today
    const { data: bookings, error: fetchErr } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('status', 'accepted')
      .eq('scheduled_date', todayStr)
      .not('payment_intent_id', 'is', null);

    if (fetchErr) throw fetchErr;

    if (bookings && bookings.length > 0) {
      for (const booking of bookings) {
        results.processed++;

        try {
          const intent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);

          if (intent.status === 'requires_capture') {
            // Capture the payment
            await stripe.paymentIntents.capture(booking.payment_intent_id);
            results.captured++;

            // Update payment status in Supabase (check both session_id and payment_intent_id)
            await supabase
              .from('payments')
              .update({ status: 'paid' })
              .or('stripe_session_id.eq.' + booking.payment_intent_id + ',stripe_payment_intent_id.eq.' + booking.payment_intent_id);

            console.log(`Captured payment for booking ${booking.id}: ${booking.payment_intent_id}`);
          } else if (intent.status === 'succeeded') {
            // Already captured
            results.skipped++;
          } else {
            // Some other status (canceled, failed, etc.)
            results.skipped++;
            console.log(`Payment intent ${booking.payment_intent_id} status: ${intent.status}`);
          }
        } catch (captureErr) {
          results.failed++;
          results.errors.push({
            bookingId: booking.id,
            paymentIntentId: booking.payment_intent_id,
            error: captureErr.message,
          });
          console.error(`Failed to capture payment for booking ${booking.id}:`, captureErr.message);
        }
      }
    }

    // 2. Handle recurring invoices scheduled for today
    const { data: recurringInvoices, error: recurringErr } = await supabase
      .from('recurring_invoices')
      .select('*')
      .eq('service_date', todayStr)
      .not('status', 'in', '("captured","voided","failed")');

    if (recurringErr) {
      console.error('Failed to fetch recurring invoices:', recurringErr.message);
    } else if (recurringInvoices && recurringInvoices.length > 0) {
      for (const invoice of recurringInvoices) {
        results.recurringProcessed++;

        try {
          // If invoice has a stripe_invoice_id, finalize/send it if not already
          if (invoice.stripe_invoice_id && invoice.status === 'sent') {
            const stripeInvoice = await stripe.invoices.retrieve(invoice.stripe_invoice_id);

            if (stripeInvoice.status === 'open' || stripeInvoice.status === 'draft') {
              // Finalize and send if needed
              if (stripeInvoice.status === 'draft') {
                await stripe.invoices.finalizeInvoice(invoice.stripe_invoice_id);
              }
              if (!stripeInvoice.paid) {
                await stripe.invoices.sendInvoice(invoice.stripe_invoice_id);
              }
            }

            // Mark as captured/paid
            await supabase
              .from('recurring_invoices')
              .update({ status: 'captured' })
              .eq('id', invoice.id);

            console.log(`Processed recurring invoice for booking ${invoice.booking_request_id} on ${todayStr}`);
          }
        } catch (invoiceErr) {
          console.error(`Failed to process recurring invoice ${invoice.id}:`, invoiceErr.message);
          results.errors.push({
            recurringInvoiceId: invoice.id,
            error: invoiceErr.message,
          });
        }
      }
    }

    return res.status(200).json({
      message: `Payment capture processed for ${todayStr}`,
      ...results,
    });
  } catch (err) {
    console.error('Capture payments cron error:', err);
    return res.status(500).json({ error: err.message, results });
  }
};
