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

    // Build PaymentIntent params
    const piParams = {
      amount: Math.round(amount * 100), // cents
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      capture_method: 'manual', // Hold authorization until captured later
      description: `Housley Happy Paws — ${service || 'Pet Care Service'}`,
      metadata: {
        booking_request_id: bookingRequestId || '',
        client_name: profile.full_name || '',
        service: service || '',
      },
    };

    // Apply 15% platform fee if connected account is configured
    const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
    if (connectedAccountId) {
      const totalCents = Math.round(amount * 100);
      const feeCents = Math.round(totalCents * 0.15);
      piParams.application_fee_amount = feeCents;
      piParams.transfer_data = { destination: connectedAccountId };
    }

    // Create and confirm a PaymentIntent off-session with manual capture
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create(piParams);
    } catch (stripeErr) {
      // If connected account fails, retry without platform fee
      if (connectedAccountId && stripeErr.message && stripeErr.message.includes('No such')) {
        console.warn('Connected account error, retrying without platform fee:', stripeErr.message);
        delete piParams.application_fee_amount;
        delete piParams.transfer_data;
        paymentIntent = await stripe.paymentIntents.create(piParams);
      } else {
        throw stripeErr;
      }
    }

    // Log payment to Supabase and store payment_intent_id on booking_request
    if (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded') {
      const { error: payInsertErr } = await supabase.from('payments').insert({
        stripe_session_id: paymentIntent.id,
        client_email: profile.email,
        client_name: profile.full_name,
        amount: amount,
        service: service || 'Pet Care',
        status: paymentIntent.status === 'requires_capture' ? 'authorized' : 'paid',
        notes: bookingRequestId ? 'Auto-charged on booking accept (Request #' + bookingRequestId.slice(0, 8) + ')' : 'Auto-charged',
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
