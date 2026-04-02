/**
 * Retry Failed Payments Cron — Retries declined charges up to 3 times in 1 day
 * Runs every 8 hours via Vercel Cron: 0 6,14,22 * * *
 *
 * Handles:
 * - Bookings in 'payment_hold' status (from acceptance declines, house sitting extra charges, etc.)
 * - Tracks charge_attempts (max 3)
 * - Auto-cancels after 3 failed attempts and notifies client + owner
 * - If retry succeeds: restores booking to correct status (accepted or completed)
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret
  const cronSecret = req.headers['authorization'];
  const manualSecret = req.headers['x-cron-secret'];
  const envSecret = process.env.CRON_SECRET;
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

  const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.housleyhappypaws.com';
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const results = { retried: 0, charged: 0, failed: 0, autoCanceled: 0, errors: [] };

  try {
    // Fetch all payment_hold bookings
    const { data: holdBookings, error: fetchErr } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('status', 'payment_hold');

    if (fetchErr) throw fetchErr;
    if (!holdBookings || holdBookings.length === 0) {
      return res.status(200).json({ message: 'No payment_hold bookings to retry', ...results });
    }

    console.log(`[retry-payments] Found ${holdBookings.length} payment_hold bookings`);

    for (const booking of holdBookings) {
      const attempts = (booking.charge_attempts || 0);

      // If already at 3 attempts — auto-cancel
      if (attempts >= 3) {
        await supabase.from('booking_requests').update({
          status: 'canceled',
          admin_notes: (booking.admin_notes || '') + '\n❌ Auto-canceled: payment failed after ' + attempts + ' attempts (' + todayStr + ')',
        }).eq('id', booking.id);

        results.autoCanceled++;

        // Notify client
        let profile = null;
        if (booking.client_id) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .eq('user_id', booking.client_id)
            .single();
          profile = prof;
        }

        if (profile) {
          try {
            await fetch(siteUrl + '/api/booking-status-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: profile.email,
                name: profile.full_name || 'Client',
                service: booking.service || 'Pet Care',
                status: 'payment_auto_canceled',
                scheduledDate: booking.scheduled_date || booking.preferred_date,
                scheduledTime: booking.scheduled_time || booking.preferred_time,
                estimatedTotal: booking.pending_charge_amount || booking.estimated_total,
              }),
            });
          } catch (notifErr) {
            console.warn('[retry-payments] Cancel notification failed:', notifErr.message);
          }

          // Notify owner
          try {
            await fetch(siteUrl + '/api/booking-status-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: process.env.OWNER_EMAIL || '',
                name: 'Rachel',
                service: booking.service || 'Pet Care',
                status: 'owner_payment_decline_alert',
                scheduledDate: booking.scheduled_date || booking.preferred_date,
                estimatedTotal: booking.pending_charge_amount || booking.estimated_total,
                clientName: profile.full_name || 'Unknown',
                clientEmail: profile.email || '',
                declineMessage: 'Auto-canceled after ' + attempts + ' failed payment attempts.',
              }),
            });
          } catch (ownerNotifErr) {
            console.warn('[retry-payments] Owner cancel notification failed:', ownerNotifErr.message);
          }
        }

        console.log(`[retry-payments] Auto-canceled booking ${booking.id} after ${attempts} attempts`);
        continue;
      }

      // Try to charge
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
        results.failed++;
        results.errors.push({ bookingId: booking.id, error: 'No stripe customer' });
        continue;
      }

      results.retried++;
      let chargeSuccess = false;

      try {
        const methods = await stripe.paymentMethods.list({
          customer: profile.stripe_customer_id,
          type: 'card',
          limit: 1,
        });

        if (methods.data.length === 0) {
          // No card — increment attempts
          await supabase.from('booking_requests').update({
            charge_attempts: attempts + 1,
            last_charge_attempt: new Date().toISOString(),
            admin_notes: (booking.admin_notes || '') + '\n⚠️ Retry #' + (attempts + 1) + ' failed: no card on file (' + todayStr + ')',
          }).eq('id', booking.id);
          results.failed++;
          continue;
        }

        // Determine charge amount — use pending_charge_amount if set (extra nights), otherwise estimated_total
        const chargeAmount = booking.pending_charge_amount || booking.estimated_total;
        const chargeCents = Math.round(chargeAmount * 100);
        const devShareCents = connectedAccountId ? Math.round(chargeCents * 0.15) : 0;

        const isExtraNights = booking.pending_charge_amount && booking.pending_charge_amount !== booking.estimated_total;
        const description = isExtraNights
          ? `Housley Happy Paws — ${booking.service || 'House Sitting'} extra nights (retry #${attempts + 1})`
          : `Housley Happy Paws — ${booking.service || 'Pet Care'} (retry #${attempts + 1})`;

        const paymentIntent = await stripe.paymentIntents.create({
          amount: chargeCents,
          currency: 'usd',
          customer: profile.stripe_customer_id,
          payment_method: methods.data[0].id,
          off_session: true,
          confirm: true,
          capture_method: 'automatic',
          description,
          metadata: {
            booking_request_id: booking.id,
            client_name: profile.full_name || '',
            service: booking.service || '',
            retry_attempt: String(attempts + 1),
          },
        });

        if (paymentIntent.status === 'succeeded') {
          chargeSuccess = true;

          // 15% dev share transfer
          if (connectedAccountId && devShareCents > 0) {
            try {
              const chargeId = paymentIntent.latest_charge;
              await stripe.transfers.create({
                amount: devShareCents,
                currency: 'usd',
                destination: connectedAccountId,
                source_transaction: chargeId,
                description: `15% dev share — ${booking.service || 'Pet Care'} retry #${attempts + 1} (#${booking.id.slice(0, 8)})`,
              });
            } catch (transferErr) {
              console.error('[retry-payments] Transfer failed (non-blocking):', transferErr.message);
            }
          }

          // Determine what status to restore to
          // If there's a service report, it was completed — mark as completed
          // Otherwise it was an acceptance decline — mark as accepted
          const { data: existingReport } = await supabase
            .from('service_reports')
            .select('id')
            .eq('booking_id', booking.id)
            .limit(1);

          const restoreStatus = (existingReport && existingReport.length > 0) ? 'completed' : 'accepted';

          await supabase.from('booking_requests').update({
            status: restoreStatus,
            payment_intent_id: paymentIntent.id,
            charge_attempts: 0,
            last_charge_attempt: null,
            pending_charge_amount: null,
            admin_notes: (booking.admin_notes || '') + '\n✅ Payment retry #' + (attempts + 1) + ' succeeded — $' + chargeAmount.toFixed(2) + ' charged (' + todayStr + ')',
          }).eq('id', booking.id);

          // Record payment
          await supabase.from('payments').insert({
            stripe_session_id: paymentIntent.id,
            client_email: profile.email,
            client_name: profile.full_name,
            amount: chargeAmount,
            service: booking.service + (isExtraNights ? ' (extra nights)' : ''),
            status: 'paid',
            notes: `Retry #${attempts + 1} succeeded (Booking #${booking.id.slice(0, 8)})`,
            paid_at: new Date().toISOString(),
          });

          results.charged++;
          console.log(`[retry-payments] Retry #${attempts + 1} succeeded for booking ${booking.id} — $${chargeAmount}`);
        }
      } catch (chargeErr) {
        console.log(`[retry-payments] Retry #${attempts + 1} failed for booking ${booking.id}: ${chargeErr.message}`);

        await supabase.from('booking_requests').update({
          charge_attempts: attempts + 1,
          last_charge_attempt: new Date().toISOString(),
          admin_notes: (booking.admin_notes || '') + '\n⚠️ Retry #' + (attempts + 1) + ' failed: ' + chargeErr.message + ' (' + todayStr + ')',
        }).eq('id', booking.id);

        results.failed++;
        results.errors.push({ bookingId: booking.id, attempt: attempts + 1, error: chargeErr.message });

        // Send decline notification on each retry
        try {
          await fetch(siteUrl + '/api/booking-status-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: profile.email,
              name: profile.full_name || 'Client',
              service: booking.service || 'Pet Care',
              status: 'payment_decline_warning',
              scheduledDate: booking.scheduled_date || booking.preferred_date,
              estimatedTotal: booking.pending_charge_amount || booking.estimated_total,
              declineMessage: chargeErr.message || 'Your card was declined. Please update your payment method.',
            }),
          });
        } catch (notifErr) {
          console.warn('[retry-payments] Decline notification failed:', notifErr.message);
        }
      }
    }

    return res.status(200).json({
      message: 'Payment retry run complete',
      ...results,
    });
  } catch (err) {
    console.error('[retry-payments] Error:', err);
    return res.status(500).json({ error: err.message, results });
  }
};
