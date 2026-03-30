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

    // Validate amount field
    if (typeof amount !== 'number') {
      return res.status(400).json({ error: 'amount must be a number' });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: 'amount must be positive' });
    }
    if (amount >= 10000) {
      return res.status(400).json({ error: 'amount must be less than 10000' });
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

    // Charge immediately — Rover model: charge at acceptance, refund on cancel
    const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
    const amountCents = Math.round(amount * 100);
    const devShareCents = connectedAccountId ? Math.round(amountCents * 0.15) : 0;

    console.log(`[charge] Charging $${amount} immediately for ${service || 'Pet Care'}`);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      capture_method: 'automatic',
      description: `Housley Happy Paws — ${service || 'Pet Care Service'}`,
      metadata: {
        booking_request_id: bookingRequestId || '',
        client_name: profile.full_name || '',
        service: service || '',
      },
    });

    console.log('[charge] PaymentIntent:', paymentIntent.id, 'status:', paymentIntent.status);

    if (paymentIntent.status === 'succeeded') {
      // 15% dev share transfer
      if (connectedAccountId && devShareCents > 0) {
        try {
          const chargeId = paymentIntent.latest_charge;
          const transfer = await stripe.transfers.create({
            amount: devShareCents,
            currency: 'usd',
            destination: connectedAccountId,
            source_transaction: chargeId,
            description: `15% dev share — ${service || 'Pet Care'} (#${bookingRequestId ? bookingRequestId.slice(0, 8) : ''})`,
          });
          console.log('[charge] Transfer SUCCESS:', transfer.id, '$' + (devShareCents / 100).toFixed(2));
        } catch (transferErr) {
          console.error('[charge] Transfer FAILED (non-blocking):', transferErr.message);
        }
      }

      await supabase.from('payments').insert({
        stripe_session_id: paymentIntent.id,
        client_email: profile.email,
        client_name: profile.full_name,
        amount: amount,
        service: service || 'Pet Care',
        status: 'paid',
        notes: bookingRequestId ? 'Charged at acceptance (Request #' + bookingRequestId.slice(0, 8) + ')' : 'Charged',
        paid_at: new Date().toISOString(),
      });
    }

    if (bookingRequestId && paymentIntent.status === 'succeeded') {
      await supabase
        .from('booking_requests')
        .update({ payment_intent_id: paymentIntent.id })
        .eq('id', bookingRequestId);
    }

    res.status(200).json({
      success: true,
      status: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
      amount: amount,
    });
  } catch (err) {
    console.error('Charge saved card error:', err.message, err.code || '');

    // Classify the error for the frontend
    const declineCode = err.decline_code || err.code || 'unknown';
    const isCardDecline = err.type === 'StripeCardError' || err.code === 'card_declined';
    const isAuthRequired = err.code === 'authentication_required';
    const isExpired = declineCode === 'expired_card';

    // Friendly decline messages for the client
    const declineMessages = {
      'card_declined': 'The card was declined. Please try a different card.',
      'insufficient_funds': 'The card has insufficient funds.',
      'expired_card': 'The card has expired. Please update your payment method.',
      'incorrect_cvc': 'The CVC code is incorrect.',
      'processing_error': 'A processing error occurred. Please try again.',
      'authentication_required': 'The card requires authentication. Please complete payment manually.',
      'lost_card': 'The card has been reported lost. Please use a different card.',
      'stolen_card': 'The card has been reported stolen. Please use a different card.',
      'do_not_honor': 'The card issuer declined the charge. Please contact your bank or try a different card.',
    };

    const friendlyMessage = declineMessages[declineCode] || declineMessages[err.code] || 'The card was declined. Please update your payment method and try again.';

    if (isCardDecline || isAuthRequired) {
      return res.status(402).json({
        error: 'card_declined',
        declineCode: declineCode,
        message: friendlyMessage,
        paymentIntentId: err.raw?.payment_intent?.id || null,
        needsNewCard: isExpired || declineCode === 'lost_card' || declineCode === 'stolen_card',
      });
    }

    res.status(500).json({ error: err.message });
  }
};
