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
    const { bookingRequestId, amount, service, clientProfileId } = req.body;
    if (!amount || !clientProfileId) {
      return res.status(400).json({ error: 'amount and clientProfileId are required' });
    }

    // Get the client's Stripe customer ID
    // Note: clientProfileId is the auth user ID, profiles use user_id column
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, full_name, email')
      .eq('user_id', clientProfileId)
      .single();

    let stripeCustomerId = profile?.stripe_customer_id || null;

    // Fallback: search Stripe by email if no customer ID stored
    if (!stripeCustomerId && profile?.email) {
      const existing = await stripe.customers.list({ email: profile.email, limit: 1 });
      if (existing.data.length > 0) {
        stripeCustomerId = existing.data[0].id;
        // Save it to profile for next time
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('user_id', clientProfileId);
      }
    }

    if (!stripeCustomerId) {
      return res.status(400).json({ error: 'no_card', message: 'Client has no saved payment method. Use a payment link instead.' });
    }

    // Get the default payment method
    const methods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
      limit: 1,
    });

    if (methods.data.length === 0) {
      return res.status(400).json({ error: 'no_card', message: 'No saved card found for this client.' });
    }

    const paymentMethodId = methods.data[0].id;

    // Determine if service is within 48 hours — charge immediately vs hold
    let captureMethod = 'manual'; // default: hold for future bookings
    if (bookingRequestId) {
      const { data: booking } = await supabase
        .from('booking_requests')
        .select('preferred_date, recurrence_pattern')
        .eq('id', bookingRequestId)
        .single();

      if (booking?.preferred_date) {
        const estNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const serviceDate = new Date(booking.preferred_date + 'T12:00:00');
        const hoursUntilService = (serviceDate - estNow) / (1000 * 60 * 60);

        // If service is within 48 hours and NOT a recurring booking, charge immediately
        if (hoursUntilService <= 48 && !booking.recurrence_pattern) {
          captureMethod = 'automatic';
          console.log('[charge] Service within 48hrs — charging immediately');
        } else {
          console.log('[charge] Service >48hrs or recurring — holding authorization');
        }
      }
    }

    // Build PaymentIntent params
    const piParams = {
      amount: Math.round(amount * 100), // cents
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      capture_method: captureMethod,
      description: `Housley Happy Paws — ${service || 'Pet Care Service'}`,
      metadata: {
        booking_request_id: bookingRequestId || '',
        client_name: profile.full_name || '',
        service: service || '',
      },
    };

    // Create and confirm PaymentIntent (Rachel collects full amount)
    let paymentIntent;
    paymentIntent = await stripe.paymentIntents.create(piParams);

    // Transfer 15% to Dom's connected account after successful charge
    const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
    if (connectedAccountId && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture')) {
      try {
        const devShareCents = Math.round(Math.round(amount * 100) * 0.15);
        // For immediate charges (succeeded), transfer now
        // For holds (requires_capture), transfer happens when capture-payments runs
        if (paymentIntent.status === 'succeeded') {
          await stripe.transfers.create({
            amount: devShareCents,
            currency: 'usd',
            destination: connectedAccountId,
            source_transaction: paymentIntent.latest_charge,
            description: `15% dev share — ${service || 'Pet Care'} (${bookingRequestId ? '#' + bookingRequestId.slice(0, 8) : ''})`,
          });
          console.log('[charge] Transferred 15% ($' + (devShareCents / 100).toFixed(2) + ') to connected account');
        } else {
          // Store that transfer is pending — capture-payments.js will handle it
          console.log('[charge] Hold placed — 15% transfer ($' + (devShareCents / 100).toFixed(2) + ') will happen on capture');
        }
      } catch (transferErr) {
        // Don't fail the whole charge if transfer fails (Dom's account may not be ready)
        console.warn('[charge] Transfer to connected account failed (non-blocking):', transferErr.message);
      }
    }

    // Log payment to Supabase and store payment_intent_id on booking_request
    if (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded') {
      const payStatus = paymentIntent.status === 'succeeded' ? 'paid' : 'authorized';
      const payNote = paymentIntent.status === 'succeeded'
        ? (bookingRequestId ? 'Charged on booking accept (Request #' + bookingRequestId.slice(0, 8) + ')' : 'Charged')
        : (bookingRequestId ? 'Hold on booking accept (Request #' + bookingRequestId.slice(0, 8) + ') — captures after service' : 'Authorized hold');
      const { error: payInsertErr } = await supabase.from('payments').insert({
        stripe_session_id: paymentIntent.id,
        client_email: profile.email,
        client_name: profile.full_name,
        amount: amount,
        service: service || 'Pet Care',
        status: payStatus,
        notes: payNote,
        paid_at: new Date().toISOString(),
      });
      if (payInsertErr) console.error('Payment insert error:', payInsertErr.message);

      // Store payment_intent_id on booking_request for later capture/cancellation
      if (bookingRequestId) {
        const { error: bkUpdateErr } = await supabase
          .from('booking_requests')
          .update({ payment_intent_id: paymentIntent.id })
          .eq('id', bookingRequestId);
        if (bkUpdateErr) console.error('Booking update error:', bkUpdateErr.message);
      }
    }

    res.status(200).json({
      success: true,
      status: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
      amount: amount,
    });
  } catch (err) {
    console.error('Charge saved card error:', err.message);

    // Handle card authentication required (SCA)
    if (err.code === 'authentication_required') {
      return res.status(402).json({
        error: 'authentication_required',
        message: 'Card requires authentication. Client will need to pay manually.',
        paymentIntentId: err.raw?.payment_intent?.id,
      });
    }

    res.status(500).json({ error: err.message });
  }
};
