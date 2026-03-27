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

  // Today's date in YYYY-MM-DD (Eastern time, auto-adjusts for DST)
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const todayStr = today.toISOString().split('T')[0];

  const results = {
    processed: 0,
    charged: 0,
    skipped: 0,
    failed: 0,
    recurringProcessed: 0,
    errors: [],
  };

  // Calculate the date 2 days from now (48-hour window)
  const twoDaysOut = new Date(today);
  twoDaysOut.setDate(twoDaysOut.getDate() + 2);
  const twoDaysStr = twoDaysOut.toISOString().split('T')[0];

  try {
    // 1. Find accepted bookings within the next 48 hours that have NOT been charged yet
    //    (no payment_intent_id means payment was deferred when accepted)
    const { data: uncharged, error: fetchErr } = await supabase
      .from('booking_requests')
      .select('*, profiles!booking_requests_client_id_fkey(user_id, stripe_customer_id, full_name, email)')
      .eq('status', 'accepted')
      .is('payment_intent_id', null)
      .gte('scheduled_date', todayStr)
      .lte('scheduled_date', twoDaysStr);

    if (fetchErr) throw fetchErr;

    if (uncharged && uncharged.length > 0) {
      for (const booking of uncharged) {
        results.processed++;

        // Skip free services
        if (!booking.estimated_total || booking.estimated_total <= 0) {
          results.skipped++;
          continue;
        }

        const profile = booking.profiles;
        if (!profile || !profile.stripe_customer_id) {
          // No Stripe customer — put on payment hold
          await supabase.from('booking_requests').update({
            status: 'payment_hold',
            admin_notes: (booking.admin_notes || '') + '\n⚠️ No payment method on file — moved to payment hold.',
          }).eq('id', booking.id);
          results.failed++;
          results.errors.push({ bookingId: booking.id, error: 'No stripe_customer_id' });
          continue;
        }

        try {
          // Get the client's default card
          const methods = await stripe.paymentMethods.list({
            customer: profile.stripe_customer_id,
            type: 'card',
            limit: 1,
          });

          if (methods.data.length === 0) {
            await supabase.from('booking_requests').update({
              status: 'payment_hold',
              admin_notes: (booking.admin_notes || '') + '\n⚠️ No saved card — moved to payment hold.',
            }).eq('id', booking.id);
            results.failed++;
            results.errors.push({ bookingId: booking.id, error: 'No saved card' });
            continue;
          }

          // Charge the card now
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(booking.estimated_total * 100),
            currency: 'usd',
            customer: profile.stripe_customer_id,
            payment_method: methods.data[0].id,
            off_session: true,
            confirm: true,
            capture_method: 'automatic',
            description: `Housley Happy Paws — ${booking.service || 'Pet Care Service'}`,
            metadata: {
              booking_request_id: booking.id,
              client_name: profile.full_name || '',
              service: booking.service || '',
            },
          });

          if (paymentIntent.status === 'succeeded') {
            results.charged++;

            // Log payment
            await supabase.from('payments').insert({
              stripe_session_id: paymentIntent.id,
              client_email: profile.email,
              client_name: profile.full_name,
              amount: booking.estimated_total,
              service: booking.service || 'Pet Care',
              status: 'paid',
              notes: 'Auto-charged 48hrs before service (Booking #' + booking.id.slice(0, 8) + ')',
              paid_at: new Date().toISOString(),
            });

            // Store payment_intent_id on booking
            await supabase.from('booking_requests')
              .update({ payment_intent_id: paymentIntent.id })
              .eq('id', booking.id);

            // Transfer 15% to connected account
            const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
            if (connectedAccountId && paymentIntent.latest_charge) {
              try {
                const devShareCents = Math.round(Math.round(booking.estimated_total * 100) * 0.15);
                await stripe.transfers.create({
                  amount: devShareCents,
                  currency: 'usd',
                  destination: connectedAccountId,
                  source_transaction: paymentIntent.latest_charge,
                  description: `15% dev share — auto-charged for booking #${booking.id.slice(0, 8)}`,
                });
              } catch (transferErr) {
                console.warn('Transfer failed (non-blocking):', transferErr.message);
              }
            }

            console.log(`Charged $${booking.estimated_total} for booking ${booking.id}`);
          } else {
            results.failed++;
            results.errors.push({ bookingId: booking.id, error: 'Payment status: ' + paymentIntent.status });
          }
        } catch (chargeErr) {
          // Card declined or other error — put on payment hold
          await supabase.from('booking_requests').update({
            status: 'payment_hold',
            admin_notes: (booking.admin_notes || '') + '\n⚠️ Auto-charge failed (' + todayStr + '): ' + chargeErr.message,
          }).eq('id', booking.id);
          results.failed++;
          results.errors.push({ bookingId: booking.id, error: chargeErr.message });
          console.error(`Failed to charge booking ${booking.id}:`, chargeErr.message);

          // Send 24-hour warning notification to client
          try {
            const notifBody = {
              email: profile.email,
              name: profile.full_name || 'Client',
              service: booking.service || 'Pet Care',
              status: 'payment_decline_warning',
              scheduledDate: booking.scheduled_date || booking.preferred_date,
              scheduledTime: booking.scheduled_time || booking.preferred_time,
              estimatedTotal: booking.estimated_total,
              declineMessage: chargeErr.message || 'Your card was declined.',
            };
            await fetch((process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://housleyhappypaws.com') + '/api/booking-status-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(notifBody),
            });
            console.log(`Sent decline warning to ${profile.email} for booking ${booking.id}`);
          } catch (notifErr) {
            console.warn('Failed to send decline notification:', notifErr.message);
          }
        }
      }
    }

    // 2. Retry payment_hold bookings — if card is updated, charge succeeds; if 24hrs passed, auto-cancel
    const { data: holdBookings, error: holdErr } = await supabase
      .from('booking_requests')
      .select('*, profiles!booking_requests_client_id_fkey(user_id, stripe_customer_id, full_name, email)')
      .eq('status', 'payment_hold')
      .not('scheduled_date', 'is', null);

    if (!holdErr && holdBookings && holdBookings.length > 0) {
      for (const booking of holdBookings) {
        const profile = booking.profiles;
        if (!profile) continue;

        // Check how long it's been on payment_hold
        const holdSince = new Date(booking.updated_at);
        const hoursSinceHold = (today - holdSince) / (1000 * 60 * 60);

        // Try to charge again (client may have updated their card)
        let retrySuccess = false;
        if (profile.stripe_customer_id) {
          try {
            const methods = await stripe.paymentMethods.list({
              customer: profile.stripe_customer_id,
              type: 'card',
              limit: 1,
            });

            if (methods.data.length > 0) {
              const retryIntent = await stripe.paymentIntents.create({
                amount: Math.round(booking.estimated_total * 100),
                currency: 'usd',
                customer: profile.stripe_customer_id,
                payment_method: methods.data[0].id,
                off_session: true,
                confirm: true,
                capture_method: 'automatic',
                description: `Housley Happy Paws — ${booking.service || 'Pet Care'} (retry)`,
                metadata: { booking_request_id: booking.id, client_name: profile.full_name || '', service: booking.service || '' },
              });

              if (retryIntent.status === 'succeeded') {
                retrySuccess = true;
                // Payment succeeded — restore booking to accepted
                await supabase.from('booking_requests').update({
                  status: 'accepted',
                  payment_intent_id: retryIntent.id,
                  admin_notes: (booking.admin_notes || '') + '\n✅ Payment retry succeeded (' + todayStr + ')',
                }).eq('id', booking.id);

                await supabase.from('payments').insert({
                  stripe_session_id: retryIntent.id,
                  client_email: profile.email,
                  client_name: profile.full_name,
                  amount: booking.estimated_total,
                  service: booking.service || 'Pet Care',
                  status: 'paid',
                  notes: 'Retry charge succeeded (Booking #' + booking.id.slice(0, 8) + ')',
                  paid_at: new Date().toISOString(),
                });

                // Transfer 15%
                const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
                if (connectedAccountId && retryIntent.latest_charge) {
                  try {
                    const devShareCents = Math.round(Math.round(booking.estimated_total * 100) * 0.15);
                    await stripe.transfers.create({
                      amount: devShareCents, currency: 'usd', destination: connectedAccountId,
                      source_transaction: retryIntent.latest_charge,
                      description: `15% dev share — retry charge for booking #${booking.id.slice(0, 8)}`,
                    });
                  } catch (te) { console.warn('Transfer failed (non-blocking):', te.message); }
                }

                results.charged++;
                console.log(`Retry succeeded for booking ${booking.id}`);
              }
            }
          } catch (retryErr) {
            console.log(`Retry failed for booking ${booking.id}: ${retryErr.message}`);
          }
        }

        // If retry failed AND 24 hours have passed — auto-cancel
        if (!retrySuccess && hoursSinceHold >= 24) {
          await supabase.from('booking_requests').update({
            status: 'canceled',
            admin_notes: (booking.admin_notes || '') + '\n❌ Auto-canceled: payment not resolved within 24 hours (' + todayStr + ')',
          }).eq('id', booking.id);

          // Notify client their booking was canceled
          try {
            await fetch((process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://housleyhappypaws.com') + '/api/booking-status-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: profile.email,
                name: profile.full_name || 'Client',
                service: booking.service || 'Pet Care',
                status: 'payment_auto_canceled',
                scheduledDate: booking.scheduled_date || booking.preferred_date,
                scheduledTime: booking.scheduled_time || booking.preferred_time,
                estimatedTotal: booking.estimated_total,
              }),
            });
            console.log(`Auto-canceled booking ${booking.id} — notified ${profile.email}`);
          } catch (notifErr) {
            console.warn('Failed to send cancel notification:', notifErr.message);
          }

          results.failed++;
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
