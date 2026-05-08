/**
 * Complete House Sitting — Adjusts nights if needed, marks complete
 *
 * POST /api/complete-housesitting
 * Body: {
 *   bookingRequestId: string,      // required
 *   adjustedNights: number|null,    // null = keep original, otherwise the final night count
 *   reportNotes: string,            // owner's notes about the stay
 *   reportRating: number|null,      // 1-5 pet behavior rating (optional)
 * }
 *
 * Rover-model flow (payment already captured at acceptance):
 * 1. Fetch booking + validate it's a house sitting
 * 2. Calculate final amount (original or adjusted)
 * 3. If fewer nights: issue partial refund for the difference
 * 4. If more nights: charge extra for additional nights
 * 5. 15% dev share transfer on any extra charge
 * 6. Store report in service_reports table
 * 7. Update booking status to 'completed'
 * 8. Send notification to client
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check — require valid Bearer token (owner/staff only)
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const supabaseForAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  );
  const { data: { user }, error: authErr } = await supabaseForAuth.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Role check — only owner/staff can complete a service.
  // Without this any logged-in client could trigger refunds or extra charges on their own bookings.
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!callerProfile || (callerProfile.role !== 'owner' && callerProfile.role !== 'staff')) {
    return res.status(403).json({ error: 'Forbidden: owner/staff access required' });
  }

  const { bookingRequestId, adjustedNights, reportNotes, reportRating } = req.body || {};

  if (!bookingRequestId) {
    return res.status(400).json({ error: 'Missing bookingRequestId' });
  }

  try {
    // 1. Fetch booking
    const { data: booking, error: fetchErr } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('id', bookingRequestId)
      .single();

    if (fetchErr || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (!booking.service || !booking.service.toLowerCase().includes('house sitting')) {
      return res.status(400).json({ error: 'Not a house sitting booking' });
    }

    // 2. Calculate nights and amounts
    const originalStart = new Date(booking.preferred_date + 'T12:00:00');
    const originalEnd = new Date(booking.preferred_end_date + 'T12:00:00');
    const originalNights = Math.round((originalEnd - originalStart) / (1000 * 60 * 60 * 24));
    const perNightRate = originalNights > 0 ? booking.estimated_total / originalNights : booking.estimated_total;

    const finalNights = (adjustedNights !== null && adjustedNights !== undefined) ? adjustedNights : originalNights;
    const finalAmount = Math.round(perNightRate * finalNights * 100) / 100; // round to cents
    const finalAmountCents = Math.round(finalAmount * 100);
    const originalAmountCents = Math.round(booking.estimated_total * 100);

    const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;

    console.log(`[hs-complete] Booking ${bookingRequestId}: ${originalNights} nights → ${finalNights} nights, $${booking.estimated_total} → $${finalAmount}`);

    // 3. Handle payment adjustments
    //    Payment was already captured at acceptance — just adjust the difference
    let extraChargeId = null;

    if (finalAmountCents < originalAmountCents && booking.payment_intent_id) {
      // Fewer nights — issue partial refund
      const refundAmount = originalAmountCents - finalAmountCents;
      try {
        await stripe.refunds.create({
          payment_intent: booking.payment_intent_id,
          amount: refundAmount,
        }, {
          idempotencyKey: `hs-refund-${bookingRequestId}-${refundAmount}`,
        });
        console.log(`[hs-complete] Refunded $${(refundAmount / 100).toFixed(2)} for fewer nights (${originalNights} → ${finalNights})`);

        // Update payment record
        await supabase.from('payments')
          .update({
            amount: finalAmount,
            notes: `House sitting — adjusted ${originalNights} → ${finalNights} nights, partial refund $${(refundAmount / 100).toFixed(2)}`,
          })
          .eq('stripe_session_id', booking.payment_intent_id);
      } catch (refundErr) {
        console.error('[hs-complete] Partial refund failed:', refundErr.message);
      }
    } else if (finalAmountCents > originalAmountCents) {
      // More nights — charge the difference
      const diffCents = finalAmountCents - originalAmountCents;
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id, email, full_name')
        .eq('user_id', booking.client_id)
        .maybeSingle();

      if (profile && profile.stripe_customer_id) {
        const methods = await stripe.paymentMethods.list({
          customer: profile.stripe_customer_id,
          type: 'card',
          limit: 1,
        });

        if (methods.data.length > 0) {
          try {
            const extraCharge = await stripe.paymentIntents.create({
              amount: diffCents,
              currency: 'usd',
              customer: profile.stripe_customer_id,
              payment_method: methods.data[0].id,
              off_session: true,
              confirm: true,
              capture_method: 'automatic',
              description: `Housley Happy Paws — ${booking.service} extra ${finalNights - originalNights} night(s)`,
              metadata: {
                booking_request_id: booking.id,
                type: 'house_sitting_extra_nights',
              },
            }, {
              idempotencyKey: `hs-extra-${bookingRequestId}-${diffCents}`,
            });
            extraChargeId = extraCharge.id;
            console.log(`[hs-complete] Extra charge $${(diffCents / 100).toFixed(2)} for ${finalNights - originalNights} extra night(s)`);

            // 15% dev share transfer on extra charge
            if (connectedAccountId) {
              const extraDevShare = Math.round(diffCents * 0.15);
              if (extraDevShare > 0) {
                try {
                  const extraPI = await stripe.paymentIntents.retrieve(extraCharge.id);
                  const extraChargeRef = extraPI.latest_charge;
                  if (extraChargeRef) {
                    await stripe.transfers.create({
                      amount: extraDevShare,
                      currency: 'usd',
                      destination: connectedAccountId,
                      source_transaction: extraChargeRef,
                      description: `15% dev share — ${booking.service} extra nights (#${booking.id.slice(0, 8)})`,
                    }, {
                      idempotencyKey: `hs-extra-transfer-${extraCharge.id}`,
                    });
                  }
                } catch (transferErr) {
                  console.error('[hs-complete] Extra nights transfer error (non-blocking):', transferErr.message);
                }
              }
            }

            // Insert payment record for extra charge
            await supabase.from('payments').insert({
              stripe_session_id: extraCharge.id,
              client_email: profile.email,
              client_name: profile.full_name,
              client_id: booking.client_id,
              amount: diffCents / 100,
              service: booking.service + ' (extra nights)',
              status: 'paid',
              notes: `Extra ${finalNights - originalNights} night(s) charge`,
              paid_at: new Date().toISOString(),
            });
          } catch (chargeErr) {
            console.error('[hs-complete] Extra nights charge failed:', chargeErr.message);

            // Card declined — set to payment_hold so retry cron picks it up
            await supabase.from('booking_requests').update({
              status: 'payment_hold',
              charge_attempts: 1,
              last_charge_attempt: new Date().toISOString(),
              pending_charge_amount: diffCents / 100,
              admin_notes: (booking.admin_notes || '') + '\n⚠️ House sitting completed but extra night charge failed (' + new Date().toLocaleDateString() + '): ' + chargeErr.message,
            }).eq('id', bookingRequestId);

            // Store service report even though payment failed
            await supabase.from('service_reports').insert({
              booking_id: bookingRequestId,
              client_id: booking.client_id,
              author_id: booking.owner_id || null,
              service: booking.service || 'House Sitting',
              report_date: new Date().toISOString().split('T')[0],
              duration: finalNights + ' nights',
              personal_note: reportNotes || '',
              pet_name: booking.pet_names || '',
              mood: reportRating ? ['😟 Poor', '😐 Fair', '🙂 Good', '😊 Great', '⭐ Excellent'][reportRating - 1] : null,
              media: {
                original_nights: originalNights,
                final_nights: finalNights,
                per_night_rate: perNightRate,
                original_total: booking.estimated_total,
                final_total: finalAmount,
                rating: reportRating || null,
              },
              arrival_time: booking.preferred_time || null,
              departure_time: booking.preferred_end_time || null,
            });

            // Notify client about failed charge
            try {
              await fetch((process.env.NEXT_PUBLIC_SITE_URL || 'https://www.housleyhappypaws.com') + '/api/booking-status-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: profile.email,
                  name: profile.full_name || 'Client',
                  service: booking.service || 'House Sitting',
                  status: 'payment_hold',
                  scheduledDate: booking.preferred_date,
                  estimatedTotal: diffCents / 100,
                  declineMessage: chargeErr.message || 'Your card was declined for the extra night charge.',
                }),
              });
            } catch (notifErr) {
              console.warn('[hs-complete] Failed to send decline notification:', notifErr.message);
            }

            // Notify owner
            try {
              await fetch((process.env.NEXT_PUBLIC_SITE_URL || 'https://www.housleyhappypaws.com') + '/api/booking-status-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: process.env.OWNER_EMAIL || '',
                  name: 'Rachel',
                  service: booking.service || 'House Sitting',
                  status: 'owner_payment_decline_alert',
                  scheduledDate: booking.preferred_date,
                  estimatedTotal: diffCents / 100,
                  clientName: profile.full_name || 'Unknown client',
                  clientEmail: profile.email || '',
                  declineMessage: chargeErr.message || 'Card was declined for extra nights.',
                }),
              });
            } catch (ownerNotifErr) {
              console.warn('[hs-complete] Failed to send owner decline notification:', ownerNotifErr.message);
            }

            return res.status(200).json({
              success: true,
              paymentFailed: true,
              originalNights,
              finalNights,
              originalAmount: booking.estimated_total,
              finalAmount,
              message: `House sitting completed but extra night charge of $${(diffCents / 100).toFixed(2)} failed — will retry automatically`,
            });
          }
        }
      }
    }

    // 4. Update original payment record with completion note
    if (booking.payment_intent_id && finalAmountCents === originalAmountCents) {
      await supabase.from('payments')
        .update({ notes: `House sitting completed — ${finalNights} nights, $${finalAmount.toFixed(2)}` })
        .eq('stripe_session_id', booking.payment_intent_id);
    }

    // 5-7. Compute end date, then run report insert + booking update + client profile fetch in parallel
    const newEndDate = adjustedNights !== null && adjustedNights !== undefined && adjustedNights !== originalNights
      ? (() => {
          const d = new Date(booking.preferred_date + 'T12:00:00');
          d.setDate(d.getDate() + finalNights);
          return d.toISOString().split('T')[0];
        })()
      : booking.preferred_end_date;

    const [, , { data: clientProfile }] = await Promise.all([
      // 6. Store service report
      supabase.from('service_reports').insert({
        booking_id: bookingRequestId,
        client_id: booking.client_id,
        author_id: booking.owner_id || null,
        service: booking.service || 'House Sitting',
        report_date: new Date().toISOString().split('T')[0],
        duration: finalNights + ' nights',
        personal_note: reportNotes || '',
        pet_name: booking.pet_names || '',
        mood: reportRating ? ['😟 Poor', '😐 Fair', '🙂 Good', '😊 Great', '⭐ Excellent'][reportRating - 1] : null,
        media: {
          original_nights: originalNights,
          final_nights: finalNights,
          per_night_rate: perNightRate,
          original_total: booking.estimated_total,
          final_total: finalAmount,
          rating: reportRating || null,
        },
        arrival_time: booking.preferred_time || null,
        departure_time: booking.preferred_end_time || null,
      }),
      // 7. Update booking status
      supabase.from('booking_requests')
        .update({
          status: 'completed',
          preferred_end_date: newEndDate,
          estimated_total: finalAmount,
          admin_notes: (booking.admin_notes || '') + '\n✅ House sitting completed — ' + finalNights + ' nights, $' + finalAmount.toFixed(2) + ' (' + new Date().toLocaleDateString() + ')',
        })
        .eq('id', bookingRequestId),
      // 5. Fetch client profile for notifications
      supabase.from('profiles')
        .select('email, full_name')
        .eq('user_id', booking.client_id)
        .maybeSingle(),
    ]);

    // 8. Send notifications in parallel (message + in-app + email)
    const nightLabel = finalNights === 1 ? '1 night' : finalNights + ' nights';
    const adjustNote = finalNights !== originalNights
      ? ` (adjusted from ${originalNights} to ${finalNights} nights)`
      : '';

    const notifPromises = [];
    if (booking.client_id) {
      notifPromises.push(
        supabase.from('messages').insert({
          sender_id: booking.owner_id || booking.client_id,
          receiver_id: booking.client_id,
          message: `🏠 House Sitting Report\n\nYour house sitting stay${adjustNote} has been completed!\n\n📅 ${booking.preferred_date} → ${newEndDate} (${nightLabel})\n💰 Final charge: $${finalAmount.toFixed(2)}\n\n${reportNotes ? '📝 Notes from your sitter:\n' + reportNotes : ''}`,
          read: false,
        }),
        supabase.from('notifications').insert({
          user_id: booking.client_id,
          title: 'House Sitting Complete',
          body: `Your ${nightLabel} house sitting stay is complete! Final charge: $${finalAmount.toFixed(2)}`,
          type: 'report',
          read: false,
        })
      );
    }
    notifPromises.push(
      fetch((process.env.NEXT_PUBLIC_SITE_URL || 'https://www.housleyhappypaws.com') + '/api/service-completed-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: clientProfile ? clientProfile.email : booking.contact_email,
          clientName: clientProfile ? clientProfile.full_name : booking.contact_name,
          service: booking.service,
          date: booking.preferred_date + ' → ' + newEndDate,
          notes: reportNotes || 'No notes provided.',
          amount: finalAmount.toFixed(2),
        }),
      }).catch(emailErr => console.warn('[hs-complete] Email failed:', emailErr.message))
    );
    await Promise.all(notifPromises);

    return res.status(200).json({
      success: true,
      originalNights,
      finalNights,
      originalAmount: booking.estimated_total,
      finalAmount,
      message: `House sitting completed — ${finalNights} nights, $${finalAmount.toFixed(2)} charged`,
    });

  } catch (err) {
    console.error('[hs-complete] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
