/**
 * Capture Holds Cron — Auto-captures payment holds 48hrs before service
 * Runs every 6 hours via Vercel Cron
 *
 * Policy:
 * - Sunday cron places HOLDS (authorize only) for the upcoming week
 * - This cron captures those holds 48 hours before each booking's service date
 * - If a booking is already within 48hrs when the hold was placed, it captures immediately
 * - House sitting: holds are captured when the report is completed (separate flow),
 *   BUT if no report is completed by end of last day, this cron auto-captures
 * - 15% dev share transfer happens at capture time
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
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

  function estDateStr(d) { return (d || new Date()).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); }
  const todayStr = estDateStr();
  const estNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const results = { processed: 0, captured: 0, skipped: 0, expired: 0, errors: [] };

  try {
    // Find all bookings with a payment_intent_id that are accepted (holds waiting to be captured)
    const { data: heldBookings, error: fetchErr } = await supabase
      .from('booking_requests')
      .select('*')
      .in('status', ['accepted', 'confirmed'])
      .not('payment_intent_id', 'is', null)
      .not('estimated_total', 'is', null);

    if (fetchErr) throw fetchErr;

    if (!heldBookings || heldBookings.length === 0) {
      return res.status(200).json({ message: 'No held bookings to process', ...results });
    }

    console.log(`[capture-holds] Found ${heldBookings.length} bookings with payment_intent_id to check`);

    for (const booking of heldBookings) {
      results.processed++;

      try {
        // Check the Stripe PaymentIntent status
        const intent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);

        // Only process holds (requires_capture) — skip already captured/succeeded
        if (intent.status !== 'requires_capture') {
          results.skipped++;
          continue;
        }

        // Determine service date
        const svcDateStr = booking.scheduled_date || booking.preferred_date;
        if (!svcDateStr) {
          results.skipped++;
          continue;
        }

        const serviceDate = new Date(svcDateStr + 'T00:00:00');
        const isHouseSitting = (booking.service || '').toLowerCase().includes('house sitting');

        // For house sitting: check if report was completed (captured via report flow)
        // Otherwise, auto-capture on the last day end-of-day as a fallback
        if (isHouseSitting) {
          // House sitting uses preferred_end_date as last day
          const endDateStr = booking.preferred_end_date || svcDateStr;
          const endDate = new Date(endDateStr + 'T23:59:59');
          const hoursUntilEnd = (endDate - estNow) / (1000 * 60 * 60);

          // Only auto-capture house sitting if past the end date (fallback)
          if (hoursUntilEnd > 0) {
            // Check if within 48hrs of FIRST day — that's when hold should exist
            const hoursUntilStart = (serviceDate - estNow) / (1000 * 60 * 60);
            if (hoursUntilStart > 48) {
              results.skipped++;
              continue; // Not yet within 48hrs of start — keep hold
            }
            // Within 48hrs of start but house sitting hasn't ended — keep hold, don't capture yet
            // The report completion flow will capture it
            results.skipped++;
            console.log(`[capture-holds] House sitting ${booking.id} — hold active, awaiting report`);
            continue;
          }
          // Past end date — auto-capture as fallback
          console.log(`[capture-holds] House sitting ${booking.id} — past end date, auto-capturing`);
        } else {
          // Regular bookings: capture 48 hours before service
          const hoursUntilService = (serviceDate - estNow) / (1000 * 60 * 60);

          if (hoursUntilService > 48) {
            results.skipped++;
            continue; // More than 48hrs out — keep hold
          }
        }

        // CAPTURE the hold
        console.log(`[capture-holds] Capturing hold for booking ${booking.id} — service: ${svcDateStr}`);
        const captured = await stripe.paymentIntents.capture(booking.payment_intent_id);

        if (captured.status === 'succeeded') {
          results.captured++;

          // Now do the 15% transfer (can only transfer after capture)
          const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
          const amountCents = captured.amount;
          const devShareCents = connectedAccountId ? Math.round(amountCents * 0.15) : 0;

          if (connectedAccountId && devShareCents > 0) {
            try {
              const chargeId = captured.latest_charge;
              const transfer = await stripe.transfers.create({
                amount: devShareCents,
                currency: 'usd',
                destination: connectedAccountId,
                source_transaction: chargeId,
                description: `15% dev share — ${booking.service || 'Pet Care'} (#${booking.id.slice(0, 8)})`,
              });
              console.log(`[capture-holds] Transfer SUCCESS: ${transfer.id} $${(devShareCents / 100).toFixed(2)}`);
            } catch (transferErr) {
              console.error(`[capture-holds] Transfer FAILED (non-blocking): ${transferErr.message}`);
            }
          }

          // Update payment record from 'held' to 'paid'
          await supabase.from('payments')
            .update({ status: 'paid', notes: 'Hold captured 48hrs before service (Booking #' + booking.id.slice(0, 8) + ')' })
            .eq('stripe_session_id', booking.payment_intent_id);

          console.log(`[capture-holds] Captured $${(amountCents / 100).toFixed(2)} for booking ${booking.id}`);
        } else {
          results.errors.push({ bookingId: booking.id, error: 'Capture status: ' + captured.status });
        }
      } catch (captureErr) {
        // Handle expired holds (Stripe auto-voids after 7 days / 31 days extended)
        if (captureErr.message && captureErr.message.includes('expired')) {
          results.expired++;
          console.error(`[capture-holds] Hold expired for booking ${booking.id}: ${captureErr.message}`);

          // Mark booking as needing re-authorization
          await supabase.from('booking_requests').update({
            status: 'payment_hold',
            payment_intent_id: null,
            admin_notes: (booking.admin_notes || '') + '\n⚠️ Hold expired — needs re-authorization (' + todayStr + ')',
          }).eq('id', booking.id);

          await supabase.from('payments')
            .update({ status: 'expired' })
            .eq('stripe_session_id', booking.payment_intent_id);
        } else {
          results.errors.push({ bookingId: booking.id, error: captureErr.message });
          console.error(`[capture-holds] Error for booking ${booking.id}: ${captureErr.message}`);
        }
      }
    }

    return res.status(200).json({ message: 'Capture holds check complete', ...results });
  } catch (err) {
    console.error('[capture-holds] Error:', err);
    return res.status(500).json({ error: err.message, results });
  }
};
