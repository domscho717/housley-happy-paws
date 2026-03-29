/**
 * Complete House Sitting — Captures hold, adjusts nights if needed, marks complete
 *
 * POST /api/complete-housesitting
 * Body: {
 *   bookingRequestId: string,      // required
 *   adjustedNights: number|null,    // null = keep original, otherwise the final night count
 *   reportNotes: string,            // owner's notes about the stay
 *   reportRating: number|null,      // 1-5 pet behavior rating (optional)
 * }
 *
 * Flow:
 * 1. Fetch booking + validate it's a house sitting with a hold
 * 2. Calculate final amount (original or adjusted)
 * 3. If same or less: capture partial/full hold amount
 * 4. If more nights: capture full hold + create new charge for the difference
 * 5. 15% dev share transfer on captured amount
 * 6. Store report in service_reports table
 * 7. Update booking status to 'completed'
 * 8. Send notification to client
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

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

    if (!booking.payment_intent_id) {
      return res.status(400).json({ error: 'No payment hold found for this booking' });
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

    // 3. Check hold status
    const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
    let capturedAmount = 0;
    let extraChargeId = null;

    if (paymentIntent.status === 'requires_capture') {
      // Hold is still active — capture it
      if (finalAmountCents <= originalAmountCents) {
        // Same or fewer nights — capture partial or full amount
        const captureResult = await stripe.paymentIntents.capture(booking.payment_intent_id, {
          amount_to_capture: finalAmountCents,
        });
        capturedAmount = finalAmountCents;
        console.log(`[hs-complete] Captured $${(finalAmountCents / 100).toFixed(2)} of $${(originalAmountCents / 100).toFixed(2)} hold`);
      } else {
        // More nights — capture full hold + charge the difference
        const captureResult = await stripe.paymentIntents.capture(booking.payment_intent_id);
        capturedAmount = originalAmountCents;
        console.log(`[hs-complete] Captured full hold $${(originalAmountCents / 100).toFixed(2)}`);

        // Charge difference
        const diffCents = finalAmountCents - originalAmountCents;
        if (diffCents > 0) {
          // Get client's payment method
          const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id, email, full_name')
            .eq('id', booking.client_id)
            .single();

          if (profile && profile.stripe_customer_id) {
            const methods = await stripe.paymentMethods.list({
              customer: profile.stripe_customer_id,
              type: 'card',
            });

            if (methods.data.length > 0) {
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
              });
              extraChargeId = extraCharge.id;
              capturedAmount += diffCents;
              console.log(`[hs-complete] Extra charge $${(diffCents / 100).toFixed(2)} for ${finalNights - originalNights} extra night(s)`);
            }
          }
        }
      }
    } else if (paymentIntent.status === 'succeeded') {
      // Already captured (maybe by cron) — just adjust if needed
      capturedAmount = paymentIntent.amount;
      console.log(`[hs-complete] Hold already captured — $${(capturedAmount / 100).toFixed(2)}`);

      // If fewer nights, issue partial refund
      if (finalAmountCents < capturedAmount) {
        const refundAmount = capturedAmount - finalAmountCents;
        await stripe.refunds.create({
          payment_intent: booking.payment_intent_id,
          amount: refundAmount,
        });
        console.log(`[hs-complete] Refunded $${(refundAmount / 100).toFixed(2)} for fewer nights`);
        capturedAmount = finalAmountCents;
      }
      // If more nights, charge the difference
      else if (finalAmountCents > capturedAmount) {
        const diffCents = finalAmountCents - capturedAmount;
        const { data: profile } = await supabase
          .from('profiles')
          .select('stripe_customer_id, email, full_name')
          .eq('id', booking.client_id)
          .single();

        if (profile && profile.stripe_customer_id) {
          const methods = await stripe.paymentMethods.list({
            customer: profile.stripe_customer_id,
            type: 'card',
          });
          if (methods.data.length > 0) {
            const extraCharge = await stripe.paymentIntents.create({
              amount: diffCents,
              currency: 'usd',
              customer: profile.stripe_customer_id,
              payment_method: methods.data[0].id,
              off_session: true,
              confirm: true,
              capture_method: 'automatic',
              description: `Housley Happy Paws — ${booking.service} extra ${finalNights - originalNights} night(s)`,
              metadata: { booking_request_id: booking.id, type: 'house_sitting_extra_nights' },
            });
            extraChargeId = extraCharge.id;
            capturedAmount += diffCents;
          }
        }
      }
    } else {
      // Hold expired or canceled
      console.log(`[hs-complete] Hold status: ${paymentIntent.status} — creating fresh charge`);

      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id, email, full_name')
        .eq('id', booking.client_id)
        .single();

      if (profile && profile.stripe_customer_id) {
        const methods = await stripe.paymentMethods.list({
          customer: profile.stripe_customer_id,
          type: 'card',
        });
        if (methods.data.length > 0) {
          const freshCharge = await stripe.paymentIntents.create({
            amount: finalAmountCents,
            currency: 'usd',
            customer: profile.stripe_customer_id,
            payment_method: methods.data[0].id,
            off_session: true,
            confirm: true,
            capture_method: 'automatic',
            description: `Housley Happy Paws — ${booking.service} (${finalNights} nights)`,
            metadata: { booking_request_id: booking.id },
          });
          capturedAmount = finalAmountCents;
          extraChargeId = freshCharge.id;
          console.log(`[hs-complete] Fresh charge $${(finalAmountCents / 100).toFixed(2)}`);
        }
      }
    }

    // 4. 15% dev share transfer
    if (connectedAccountId && capturedAmount > 0) {
      const devShareCents = Math.round(capturedAmount * 0.15);
      if (devShareCents > 0) {
        try {
          // Get the charge ID from the captured payment intent
          const capturedPI = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
          const chargeId = capturedPI.latest_charge;
          if (chargeId) {
            await stripe.transfers.create({
              amount: devShareCents,
              currency: 'usd',
              destination: connectedAccountId,
              source_transaction: chargeId,
              description: `15% dev share — ${booking.service} (#${booking.id.slice(0, 8)})`,
            });
            console.log(`[hs-complete] Transfer $${(devShareCents / 100).toFixed(2)} to connected account`);
          }

          // If there was an extra charge, transfer from that too
          if (extraChargeId) {
            const extraPI = await stripe.paymentIntents.retrieve(extraChargeId);
            const extraChargeRef = extraPI.latest_charge;
            if (extraChargeRef) {
              const extraDevShare = Math.round((finalAmountCents - originalAmountCents) * 0.15);
              if (extraDevShare > 0) {
                await stripe.transfers.create({
                  amount: extraDevShare,
                  currency: 'usd',
                  destination: connectedAccountId,
                  source_transaction: extraChargeRef,
                  description: `15% dev share — ${booking.service} extra nights (#${booking.id.slice(0, 8)})`,
                });
              }
            }
          }
        } catch (transferErr) {
          console.error('[hs-complete] Transfer error (non-blocking):', transferErr.message);
        }
      }
    }

    // 5. Update payments table
    await supabase.from('payments')
      .update({ status: 'paid', notes: `House sitting completed — ${finalNights} nights, $${finalAmount.toFixed(2)}` })
      .eq('stripe_session_id', booking.payment_intent_id);

    // Fetch client profile for notifications
    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', booking.client_id)
      .single();

    // Also insert if extra charge
    if (extraChargeId) {
      await supabase.from('payments').insert({
        stripe_session_id: extraChargeId,
        client_email: clientProfile ? clientProfile.email : '',
        client_name: clientProfile ? clientProfile.full_name : '',
        amount: (finalAmountCents - originalAmountCents) / 100,
        service: booking.service + ' (extra nights)',
        status: 'paid',
        notes: `Extra ${finalNights - originalNights} night(s) charge`,
        paid_at: new Date().toISOString(),
      });
    }

    // 6. Store service report

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
      media: JSON.stringify({
        original_nights: originalNights,
        final_nights: finalNights,
        per_night_rate: perNightRate,
        original_total: booking.estimated_total,
        final_total: finalAmount,
        rating: reportRating || null,
      }),
      arrival_time: booking.preferred_time || null,
      departure_time: booking.preferred_end_time || null,
    });

    // 7. Update booking status
    const newEndDate = adjustedNights !== null && adjustedNights !== undefined && adjustedNights !== originalNights
      ? (() => {
          const d = new Date(booking.preferred_date + 'T12:00:00');
          d.setDate(d.getDate() + finalNights);
          return d.toISOString().split('T')[0];
        })()
      : booking.preferred_end_date;

    await supabase.from('booking_requests')
      .update({
        status: 'completed',
        preferred_end_date: newEndDate,
        estimated_total: finalAmount,
        admin_notes: (booking.admin_notes || '') + '\n✅ House sitting completed — ' + finalNights + ' nights, $' + finalAmount.toFixed(2) + ' (' + new Date().toLocaleDateString() + ')',
      })
      .eq('id', bookingRequestId);

    // 8. Send notification to client
    if (booking.client_id) {
      const nightLabel = finalNights === 1 ? '1 night' : finalNights + ' nights';
      const adjustNote = finalNights !== originalNights
        ? ` (adjusted from ${originalNights} to ${finalNights} nights)`
        : '';

      await supabase.from('messages').insert({
        sender_id: booking.owner_id || booking.client_id,
        receiver_id: booking.client_id,
        message: `🏠 House Sitting Report\n\nYour house sitting stay${adjustNote} has been completed!\n\n📅 ${booking.preferred_date} → ${newEndDate} (${nightLabel})\n💰 Final charge: $${finalAmount.toFixed(2)}\n\n${reportNotes ? '📝 Notes from your sitter:\n' + reportNotes : ''}`,
        read: false,
      });

      // In-app notification
      await supabase.from('notifications').insert({
        user_id: booking.client_id,
        title: 'House Sitting Complete',
        body: `Your ${nightLabel} house sitting stay is complete! Final charge: $${finalAmount.toFixed(2)}`,
        type: 'report',
        read: false,
      });
    }

    // Send email notification
    try {
      await fetch((process.env.NEXT_PUBLIC_SITE_URL || 'https://www.housleyhappypaws.com') + '/api/service-completed-notification', {
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
      });
    } catch (emailErr) {
      console.warn('[hs-complete] Email notification failed (non-blocking):', emailErr.message);
    }

    return res.status(200).json({
      success: true,
      originalNights,
      finalNights,
      originalAmount: booking.estimated_total,
      finalAmount,
      captured: capturedAmount / 100,
      message: `House sitting completed — ${finalNights} nights, $${finalAmount.toFixed(2)} charged`,
    });

  } catch (err) {
    console.error('[hs-complete] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
