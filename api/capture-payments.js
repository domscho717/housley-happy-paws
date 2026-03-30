/**
 * Capture Payments Cron Job — Weekly Sunday Charge for Recurring Services
 * Runs every Sunday at 6AM EST (11:00 UTC) via Vercel Cron
 * Retry runs 12 hours later at 6PM EST (23:00 UTC)
 *
 * Rover-model payment system:
 * - One-time bookings are charged immediately at acceptance (charge-saved-card.js)
 * - This cron ONLY handles recurring services' future weeks
 * - Charges are immediate (capture_method: 'automatic') — no holds
 * - Card decline → payment_hold status → retry 12hrs later → auto-cancel if still fails
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

  const isRetry = req.query?.retry === 'true';

  // Helper: YYYY-MM-DD in Eastern Time
  function estDateStr(d) { return (d || new Date()).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); }

  const todayStr = estDateStr();
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const results = {
    processed: 0,
    charged: 0,
    skipped: 0,
    failed: 0,
    retried: 0,
    autoCanceled: 0,
    weekRange: '',
    errors: [],
  };

  // Calculate the week range: NEXT Monday through Sunday
  // The cron runs Sunday morning — charge for the UPCOMING Mon-Sun week
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() + 1); // Monday (tomorrow)
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6); // Sunday (end of upcoming week)

  const weekStartStr = estDateStr(weekStart);
  const weekEndStr = estDateStr(weekEnd);
  results.weekRange = `${weekStartStr} to ${weekEndStr}`;

  const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;

  console.log(`[cron] ${isRetry ? 'RETRY' : 'Sunday'} charge run — week: ${weekStartStr} to ${weekEndStr}`);

  try {
    // ───────────────────────────────────────────────────────────
    // 1. RECURRING SERVICES — charge for next week's occurrences
    //    Only process bookings that are recurring AND accepted
    // ───────────────────────────────────────────────────────────
    if (!isRetry) {
      const { data: recurringBookings, error: fetchErr } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('status', 'accepted')
        .not('recurrence_pattern', 'is', null);

      if (fetchErr) throw fetchErr;

      console.log(`[cron] Found ${(recurringBookings || []).length} active recurring bookings`);

      for (const booking of (recurringBookings || [])) {
        // Determine if this booking has an occurrence in the upcoming week
        const nextOccurrence = getNextOccurrence(booking, weekStartStr, weekEndStr);
        if (!nextOccurrence) {
          results.skipped++;
          continue;
        }

        // Check if this date is in the canceled_dates array
        const canceledDates = Array.isArray(booking.canceled_dates) ? booking.canceled_dates : [];
        if (canceledDates.includes(nextOccurrence)) {
          console.log(`[cron] Skipping canceled date ${nextOccurrence} for booking ${booking.id}`);
          results.skipped++;
          continue;
        }

        // Skip free services
        if (!booking.estimated_total || booking.estimated_total <= 0) {
          results.skipped++;
          continue;
        }

        // Check if already charged for this date (avoid double-charging)
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id')
          .eq('notes', 'ilike', `%${nextOccurrence}%`)
          .eq('stripe_session_id', 'ilike', `%pi_%`)
          .limit(1);

        // Better check: look for payment with this booking + date in notes
        const { data: existingCharge } = await supabase
          .from('payments')
          .select('id')
          .ilike('notes', `%${booking.id.slice(0, 8)}%`)
          .ilike('notes', `%${nextOccurrence}%`)
          .limit(1);

        if (existingCharge && existingCharge.length > 0) {
          console.log(`[cron] Already charged for ${nextOccurrence} on booking ${booking.id}`);
          results.skipped++;
          continue;
        }

        results.processed++;

        // Look up client profile
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

          // Charge immediately — no holds
          const chargeCents = Math.round(booking.estimated_total * 100);
          const devShareCents = connectedAccountId ? Math.round(chargeCents * 0.15) : 0;

          const paymentIntent = await stripe.paymentIntents.create({
            amount: chargeCents,
            currency: 'usd',
            customer: profile.stripe_customer_id,
            payment_method: methods.data[0].id,
            off_session: true,
            confirm: true,
            capture_method: 'automatic',
            description: `Housley Happy Paws — ${booking.service || 'Pet Care Service'} (recurring ${nextOccurrence})`,
            metadata: {
              booking_request_id: booking.id,
              client_name: profile.full_name || '',
              service: booking.service || '',
              service_date: nextOccurrence,
              type: 'recurring_weekly',
            },
          });

          if (paymentIntent.status === 'succeeded') {
            results.charged++;

            // 15% dev share transfer
            if (connectedAccountId && devShareCents > 0) {
              try {
                const chargeId = paymentIntent.latest_charge;
                await stripe.transfers.create({
                  amount: devShareCents,
                  currency: 'usd',
                  destination: connectedAccountId,
                  source_transaction: chargeId,
                  description: `15% dev share — ${booking.service || 'Pet Care'} recurring ${nextOccurrence} (#${booking.id.slice(0, 8)})`,
                });
              } catch (transferErr) {
                console.error('[cron] Transfer FAILED (non-blocking):', transferErr.message);
              }
            }

            await supabase.from('payments').insert({
              stripe_session_id: paymentIntent.id,
              client_email: profile.email,
              client_name: profile.full_name,
              amount: booking.estimated_total,
              service: booking.service || 'Pet Care',
              status: 'paid',
              notes: `Sunday recurring charge for ${nextOccurrence} (Booking #${booking.id.slice(0, 8)})`,
              paid_at: new Date().toISOString(),
            });

            console.log(`[cron] Charged $${booking.estimated_total} for recurring booking ${booking.id} — date ${nextOccurrence}`);
          } else {
            results.failed++;
            results.errors.push({ bookingId: booking.id, error: 'Payment status: ' + paymentIntent.status });
          }
        } catch (chargeErr) {
          // Card declined — put on payment hold
          await supabase.from('booking_requests').update({
            status: 'payment_hold',
            admin_notes: (booking.admin_notes || '') + '\n⚠️ Sunday charge failed (' + todayStr + '): ' + chargeErr.message,
          }).eq('id', booking.id);
          results.failed++;
          results.errors.push({ bookingId: booking.id, error: chargeErr.message });
          console.error(`[cron] Failed to charge booking ${booking.id}:`, chargeErr.message);

          // Send decline notification to client
          const notifUrl = (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://housleyhappypaws.com') + '/api/booking-status-notification';
          try {
            await fetch(notifUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: profile.email,
                name: profile.full_name || 'Client',
                service: booking.service || 'Pet Care',
                status: 'payment_decline_warning',
                scheduledDate: nextOccurrence,
                scheduledTime: booking.scheduled_time || booking.preferred_time,
                estimatedTotal: booking.estimated_total,
                declineMessage: chargeErr.message || 'Your card was declined.',
              }),
            });
            console.log(`[cron] Sent decline warning to ${profile.email}`);
          } catch (notifErr) {
            console.warn('[cron] Failed to send decline notification:', notifErr.message);
          }

          // Also notify owner about the decline
          try {
            await fetch(notifUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: process.env.OWNER_EMAIL || '',
                name: 'Rachel',
                service: booking.service || 'Pet Care',
                status: 'owner_payment_decline_alert',
                scheduledDate: nextOccurrence,
                scheduledTime: booking.scheduled_time || booking.preferred_time,
                estimatedTotal: booking.estimated_total,
                clientName: profile.full_name || 'Unknown client',
                clientEmail: profile.email || '',
                declineMessage: chargeErr.message || 'Card was declined.',
              }),
            });
          } catch (ownerNotifErr) {
            console.warn('[cron] Failed to send owner decline notification:', ownerNotifErr.message);
          }
        }
      }
    }

    // ───────────────────────────────────────────────────────────
    // 2. RETRY — payment_hold bookings (12hr window then auto-cancel)
    //    Runs on both initial Sunday run and the retry run
    // ───────────────────────────────────────────────────────────
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
                metadata: {
                  booking_request_id: booking.id,
                  client_name: profile.full_name || '',
                  service: booking.service || '',
                },
              });

              if (retryIntent.status === 'succeeded') {
                retrySuccess = true;

                // 15% dev share transfer
                if (connectedAccountId && retryDevShare > 0) {
                  try {
                    const chargeId = retryIntent.latest_charge;
                    await stripe.transfers.create({
                      amount: retryDevShare,
                      currency: 'usd',
                      destination: connectedAccountId,
                      source_transaction: chargeId,
                      description: `15% dev share — ${booking.service || 'Pet Care'} retry (#${booking.id.slice(0, 8)})`,
                    });
                  } catch (transferErr) {
                    console.error('[cron-retry] Transfer FAILED (non-blocking):', transferErr.message);
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

                results.retried++;
                results.charged++;
                console.log(`[cron-retry] Charged $${booking.estimated_total} for booking ${booking.id}`);
              }
            }
          } catch (retryErr) {
            console.log(`[cron-retry] Failed for booking ${booking.id}: ${retryErr.message}`);
          }
        }

        // If retry failed AND 12 hours have passed — auto-cancel
        if (!retrySuccess && hoursSinceHold >= 12) {
          await supabase.from('booking_requests').update({
            status: 'canceled',
            admin_notes: (booking.admin_notes || '') + '\n❌ Auto-canceled: payment not resolved within 12 hours (' + todayStr + ')',
          }).eq('id', booking.id);

          results.autoCanceled++;

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

    return res.status(200).json({
      message: `${isRetry ? 'Retry' : 'Sunday'} payment run for week of ${weekStartStr}`,
      ...results,
    });
  } catch (err) {
    console.error('[cron] Capture payments error:', err);
    return res.status(500).json({ error: err.message, results });
  }
};

/**
 * Determine the next occurrence date of a recurring booking within a given week range.
 * Returns YYYY-MM-DD string if there's an occurrence, or null if not.
 */
function getNextOccurrence(booking, weekStartStr, weekEndStr) {
  const pattern = (booking.recurrence_pattern || '').toLowerCase();
  const bookingDates = Array.isArray(booking.booking_dates) ? booking.booking_dates : [];
  const dateDetails = booking.date_details;

  // If booking has explicit booking_dates array, check if any fall in this week
  if (bookingDates.length > 0) {
    for (const d of bookingDates) {
      if (d >= weekStartStr && d <= weekEndStr) return d;
    }
  }

  // Weekly recurrence — figure out which day of the week the service is on
  if (pattern === 'weekly' || pattern === 'biweekly' || pattern === 'every week') {
    const baseDate = booking.scheduled_date || booking.preferred_date;
    if (!baseDate) return null;

    const base = new Date(baseDate + 'T12:00:00');
    const baseDayOfWeek = base.getDay(); // 0=Sun..6=Sat

    // Find the date in the upcoming week that matches this day of week
    const weekStart = new Date(weekStartStr + 'T12:00:00');
    const targetDate = new Date(weekStart);
    const weekStartDay = weekStart.getDay();

    // Calculate days until the target day
    let daysUntil = baseDayOfWeek - weekStartDay;
    if (daysUntil < 0) daysUntil += 7;
    targetDate.setDate(targetDate.getDate() + daysUntil);

    const targetStr = targetDate.toISOString().split('T')[0];
    if (targetStr >= weekStartStr && targetStr <= weekEndStr) {
      // For biweekly, check if this is the right week
      if (pattern === 'biweekly') {
        const daysDiff = Math.round((targetDate - base) / (1000 * 60 * 60 * 24));
        const weeksDiff = Math.round(daysDiff / 7);
        if (weeksDiff % 2 !== 0) return null; // Skip odd weeks
      }
      return targetStr;
    }
  }

  // For date_details with specific weekdays
  if (dateDetails && typeof dateDetails === 'object') {
    const weekStart = new Date(weekStartStr + 'T12:00:00');
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(weekStart);
      checkDate.setDate(checkDate.getDate() + i);
      const checkStr = checkDate.toISOString().split('T')[0];
      const dayName = dayNames[checkDate.getDay()];

      if (dateDetails[dayName] || dateDetails[checkStr]) {
        return checkStr;
      }
    }
  }

  return null;
}
