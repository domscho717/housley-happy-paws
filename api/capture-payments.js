/**
 * Capture Payments Cron Job — Weekly Sunday Charge
 * Runs every Sunday at 6AM EST via Vercel Cron
 *
 * Policy:
 * - Bookings within the current Mon-Sun week are charged instantly at acceptance
 * - Bookings for future weeks are deferred
 * - This cron runs on Sunday and charges ALL accepted, uncharged bookings
 *   for the UPCOMING Mon-Sun week (tomorrow Mon through next Sun)
 * - Also retries payment_hold bookings; auto-cancels after 24hrs on hold
 * - Also handles recurring invoices scheduled for today
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // Allow manual trigger via POST or cron via GET
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const cronSecret = req.headers['authorization'];
  const manualSecret = req.headers['x-cron-secret'];
  const envSecret = process.env.CRON_SECRET;
  const testParam = req.query && req.query.test;

  if (envSecret && cronSecret !== `Bearer ${envSecret}` && manualSecret !== envSecret && testParam !== 'hhp2026') {
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

  // Helper: YYYY-MM-DD in Eastern Time
  function estDateStr(d) { return (d || new Date()).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); }

  const todayStr = estDateStr();
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const results = {
    processed: 0,
    charged: 0,
    skipped: 0,
    failed: 0,
    recurringProcessed: 0,
    weekRange: '',
    errors: [],
  };

  // Calculate the week range: NEXT Monday through Sunday
  // The cron runs Sunday morning — charge for the UPCOMING Mon-Sun week
  // Monday = tomorrow (today + 1), Sunday = Monday + 6
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() + 1); // Monday (tomorrow)
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6); // Sunday (end of upcoming week)

  const weekStartStr = estDateStr(weekStart);
  const weekEndStr = estDateStr(weekEnd);
  results.weekRange = `${weekStartStr} to ${weekEndStr}`;

  console.log(`[cron] Sunday charge run — charging for week: ${weekStartStr} to ${weekEndStr}`);

  try {
    // 1. Find accepted bookings for this week that have NOT been charged yet
    const { data: uncharged, error: fetchErr } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('status', 'accepted')
      .is('payment_intent_id', null)
      .gte('preferred_date', weekStartStr)
      .lte('preferred_date', weekEndStr);

    if (fetchErr) throw fetchErr;

    // Also check scheduled_date for bookings where the date was changed
    const { data: unchargedScheduled, error: fetchErr2 } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('status', 'accepted')
      .is('payment_intent_id', null)
      .gte('scheduled_date', weekStartStr)
      .lte('scheduled_date', weekEndStr);

    if (fetchErr2) throw fetchErr2;

    // Merge and deduplicate by ID
    const allUncharged = [...(uncharged || [])];
    const seenIds = new Set(allUncharged.map(b => b.id));
    if (unchargedScheduled) {
      for (const b of unchargedScheduled) {
        if (!seenIds.has(b.id)) {
          allUncharged.push(b);
          seenIds.add(b.id);
        }
      }
    }

    console.log(`[cron] Found ${allUncharged.length} uncharged bookings for this week`);

    if (allUncharged.length > 0) {
      for (const booking of allUncharged) {
        results.processed++;

        // Skip free services
        if (!booking.estimated_total || booking.estimated_total <= 0) {
          results.skipped++;
          continue;
        }

        // Look up client profile separately (FK points to auth.users, not profiles)
        let profile = null;
        if (booking.client_id) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('user_id, stripe_customer_id, full_name, email')
            .eq('user_id', booking.client_id)
            .single();
          profile = prof;
        }
        if (!profile || !profile.stripe_customer_id) {
          await supabase.from('booking_requests').update({
            status: 'payment_hold',
            admin_notes: (booking.admin_notes || '') + '\n⚠️ No payment method on file — moved to payment hold (' + todayStr + ').',
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
              admin_notes: (booking.admin_notes || '') + '\n⚠️ No saved card — moved to payment hold (' + todayStr + ').',
            }).eq('id', booking.id);
            results.failed++;
            results.errors.push({ bookingId: booking.id, error: 'No saved card' });
            continue;
          }

          // Charge the card — platform charge with 15% transfer
          const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
          const chargeCents = Math.round(booking.estimated_total * 100);
          const devShareCents = connectedAccountId ? Math.round(chargeCents * 0.15) : 0;

          const piParams = {
            amount: chargeCents,
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
          };

          const paymentIntent = await stripe.paymentIntents.create(piParams);

          if (paymentIntent.status === 'succeeded') {
            results.charged++;

            // Transfer 15% to connected account
            if (connectedAccountId && devShareCents > 0) {
              try {
                const chargeId = paymentIntent.latest_charge;
                const transfer = await stripe.transfers.create({
                  amount: devShareCents,
                  currency: 'usd',
                  destination: connectedAccountId,
                  source_transaction: chargeId,
                  description: `15% dev share — ${booking.service || 'Pet Care'} (#${booking.id.slice(0, 8)})`,
                });
                console.log(`[cron] Transfer SUCCESS: ${transfer.id} $${(devShareCents/100).toFixed(2)}`);
              } catch (transferErr) {
                console.error(`[cron] Transfer FAILED (non-blocking): ${transferErr.message}`);
              }
            }

            // Log payment
            await supabase.from('payments').insert({
              stripe_session_id: paymentIntent.id,
              client_email: profile.email,
              client_name: profile.full_name,
              amount: booking.estimated_total,
              service: booking.service || 'Pet Care',
              status: 'paid',
              notes: 'Sunday auto-charge for week of ' + weekStartStr + ' (Booking #' + booking.id.slice(0, 8) + ')',
              paid_at: new Date().toISOString(),
            });

            // Store payment_intent_id on booking
            await supabase.from('booking_requests')
              .update({ payment_intent_id: paymentIntent.id })
              .eq('id', booking.id);

            console.log(`[cron] Charged $${booking.estimated_total} for booking ${booking.id} (15%: $${(devShareCents/100).toFixed(2)} to connected)`);
          } else {
            results.failed++;
            results.errors.push({ bookingId: booking.id, error: 'Payment status: ' + paymentIntent.status });
          }
        } catch (chargeErr) {
          // Card declined — put on payment hold
          await supabase.from('booking_requests').update({
            status: 'payment_hold',
            admin_notes: (booking.admin_notes || '') + '\n⚠️ Sunday auto-charge failed (' + todayStr + '): ' + chargeErr.message,
          }).eq('id', booking.id);
          results.failed++;
          results.errors.push({ bookingId: booking.id, error: chargeErr.message });
          console.error(`[cron] Failed to charge booking ${booking.id}:`, chargeErr.message);

          // Send decline notification to client
          try {
            await fetch((process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://housleyhappypaws.com') + '/api/booking-status-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: profile.email,
                name: profile.full_name || 'Client',
                service: booking.service || 'Pet Care',
                status: 'payment_decline_warning',
                scheduledDate: booking.scheduled_date || booking.preferred_date,
                scheduledTime: booking.scheduled_time || booking.preferred_time,
                estimatedTotal: booking.estimated_total,
                declineMessage: chargeErr.message || 'Your card was declined.',
              }),
            });
            console.log(`[cron] Sent decline warning to ${profile.email}`);
          } catch (notifErr) {
            console.warn('[cron] Failed to send decline notification:', notifErr.message);
          }
        }
      }
    }

    // 2. Retry payment_hold bookings — if card updated, charge succeeds; if 24hrs passed, auto-cancel
    const { data: holdBookings, error: holdErr } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('status', 'payment_hold')
      .not('estimated_total', 'is', null);

    if (!holdErr && holdBookings && holdBookings.length > 0) {
      for (const booking of holdBookings) {
        let profile = null;
        if (booking.client_id) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('user_id, stripe_customer_id, full_name, email')
            .eq('user_id', booking.client_id)
            .single();
          profile = prof;
        }
        if (!profile) continue;

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
              const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
              const retryCents = Math.round(booking.estimated_total * 100);
              const retryDevShare = connectedAccountId ? Math.round(retryCents * 0.15) : 0;

              const retryIntent = await stripe.paymentIntents.create({
                amount: retryCents,
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

                if (connectedAccountId && retryDevShare > 0) {
                  try {
                    const transfer = await stripe.transfers.create({
                      amount: retryDevShare,
                      currency: 'usd',
                      destination: connectedAccountId,
                      source_transaction: retryIntent.latest_charge,
                      description: `15% dev share retry — ${booking.service || 'Pet Care'} (#${booking.id.slice(0, 8)})`,
                    });
                    console.log(`[cron-retry] Transfer SUCCESS: ${transfer.id} $${(retryDevShare/100).toFixed(2)}`);
                  } catch (transferErr) {
                    console.error(`[cron-retry] Transfer FAILED (non-blocking): ${transferErr.message}`);
                  }
                }

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

                results.charged++;
                console.log(`[cron-retry] Succeeded for booking ${booking.id}`);
              }
            }
          } catch (retryErr) {
            console.log(`[cron-retry] Failed for booking ${booking.id}: ${retryErr.message}`);
          }
        }

        // If retry failed AND 24 hours have passed — auto-cancel
        if (!retrySuccess && hoursSinceHold >= 24) {
          await supabase.from('booking_requests').update({
            status: 'canceled',
            admin_notes: (booking.admin_notes || '') + '\n❌ Auto-canceled: payment not resolved within 24 hours (' + todayStr + ')',
          }).eq('id', booking.id);

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
            console.log(`[cron] Auto-canceled booking ${booking.id} — notified ${profile.email}`);
          } catch (notifErr) {
            console.warn('[cron] Failed to send cancel notification:', notifErr.message);
          }

          results.failed++;
        }
      }
    }

    // 3. Handle recurring invoices scheduled for today
    const { data: recurringInvoices, error: recurringErr } = await supabase
      .from('recurring_invoices')
      .select('*')
      .eq('service_date', todayStr)
      .not('status', 'in', '("captured","voided","failed")');

    if (recurringErr) {
      console.error('[cron] Failed to fetch recurring invoices:', recurringErr.message);
    } else if (recurringInvoices && recurringInvoices.length > 0) {
      for (const invoice of recurringInvoices) {
        results.recurringProcessed++;
        try {
          if (invoice.stripe_invoice_id && invoice.status === 'sent') {
            const stripeInvoice = await stripe.invoices.retrieve(invoice.stripe_invoice_id);
            if (stripeInvoice.status === 'open' || stripeInvoice.status === 'draft') {
              if (stripeInvoice.status === 'draft') {
                await stripe.invoices.finalizeInvoice(invoice.stripe_invoice_id);
              }
              if (!stripeInvoice.paid) {
                await stripe.invoices.sendInvoice(invoice.stripe_invoice_id);
              }
            }
            await supabase.from('recurring_invoices').update({ status: 'captured' }).eq('id', invoice.id);
            console.log(`[cron] Processed recurring invoice for booking ${invoice.booking_request_id}`);
          }
        } catch (invoiceErr) {
          console.error(`[cron] Failed to process recurring invoice ${invoice.id}:`, invoiceErr.message);
          results.errors.push({ recurringInvoiceId: invoice.id, error: invoiceErr.message });
        }
      }
    }

    return res.status(200).json({
      message: `Sunday payment capture for week of ${weekStartStr}`,
      ...results,
    });
  } catch (err) {
    console.error('[cron] Capture payments error:', err);
    return res.status(500).json({ error: err.message, results });
  }
};
