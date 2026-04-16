const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Authentication - any authenticated user (client) can tip
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.replace('Bearer ', '');
  const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  try {
    const { bookingRequestId, serviceReportId, tipAmount, service, petNames } = req.body;

    if (!tipAmount || typeof tipAmount !== 'number' || tipAmount <= 0) {
      return res.status(400).json({ error: 'tipAmount must be a positive number' });
    }
    if (tipAmount > 500) {
      return res.status(400).json({ error: 'Tip amount cannot exceed $500' });
    }

    // Check if client already tipped this booking
    if (bookingRequestId) {
      const { data: existingTip } = await supabase
        .from('tips')
        .select('id')
        .eq('booking_request_id', bookingRequestId)
        .eq('client_id', user.id)
        .eq('status', 'succeeded')
        .maybeSingle();

      if (existingTip) {
        return res.status(400).json({ error: 'already_tipped', message: 'You have already left a tip for this service.' });
      }
    }

    // Get client profile and Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, full_name, email')
      .eq('user_id', user.id)
      .maybeSingle();

    let stripeCustomerId = profile?.stripe_customer_id || null;

    // Fallback: search Stripe by email
    if (!stripeCustomerId && profile?.email) {
      const existing = await stripe.customers.list({ email: profile.email, limit: 1 });
      if (existing.data.length > 0) {
        stripeCustomerId = existing.data[0].id;
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('user_id', user.id);
      }
    }

    if (!stripeCustomerId) {
      return res.status(400).json({ error: 'no_card', message: 'No saved payment method found. Please add a card first.' });
    }

    // Get saved payment method
    const methods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
      limit: 1,
    });

    if (methods.data.length === 0) {
      return res.status(400).json({ error: 'no_card', message: 'No saved card found.' });
    }

    const paymentMethodId = methods.data[0].id;
    const amountCents = Math.round(tipAmount * 100);
    const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
    const devShareCents = connectedAccountId ? Math.round(amountCents * 0.15) : 0;

    console.log('[tip] Charging tip of $' + tipAmount + ' for ' + (service || 'Pet Care'));

    // Create and confirm payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      capture_method: 'automatic',
      description: 'Housley Happy Paws - Tip for ' + (service || 'Pet Care Service'),
      metadata: {
        type: 'tip',
        booking_request_id: bookingRequestId || '',
        service_report_id: serviceReportId || '',
        client_name: profile.full_name || '',
        service: service || '',
      },
    });

    console.log('[tip] PaymentIntent:', paymentIntent.id, 'status:', paymentIntent.status);

    if (paymentIntent.status === 'succeeded') {
      // 15% dev share transfer (same split as services)
      if (connectedAccountId && devShareCents > 0) {
        try {
          const chargeId = paymentIntent.latest_charge;
          const transfer = await stripe.transfers.create({
            amount: devShareCents,
            currency: 'usd',
            destination: connectedAccountId,
            source_transaction: chargeId,
            description: '15% dev share - Tip for ' + (service || 'Pet Care'),
          });
          console.log('[tip] Transfer SUCCESS:', transfer.id);
        } catch (transferErr) {
          console.error('[tip] Transfer FAILED (non-blocking):', transferErr.message);
        }
      }

      // Record in tips table
      await supabase.from('tips').insert({
        booking_request_id: bookingRequestId || null,
        service_report_id: serviceReportId || null,
        client_id: user.id,
        client_email: profile.email,
        client_name: profile.full_name,
        amount: tipAmount,
        service: service || 'Pet Care',
        pet_names: petNames || null,
        stripe_payment_intent_id: paymentIntent.id,
        status: 'succeeded',
      });

      // Also record in payments table for unified payment history
      await supabase.from('payments').insert({
        stripe_session_id: paymentIntent.id,
        client_email: profile.email,
        client_name: profile.full_name,
        client_id: user.id,
        amount: tipAmount,
        service: (service || 'Pet Care') + ' (Tip)',
        status: 'paid',
        notes: 'Tip' + (bookingRequestId ? ' for booking #' + bookingRequestId.slice(0, 8) : ''),
        paid_at: new Date().toISOString(),
      });
    }

    res.status(200).json({
      success: paymentIntent.status === 'succeeded',
      status: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
      amount: tipAmount,
    });

  } catch (err) {
    console.error('Tip charge error:', err.message, err.code || '');

    const declineCode = err.decline_code || err.code || 'unknown';
    const isCardDecline = err.type === 'StripeCardError' || err.code === 'card_declined';
    const isAuthRequired = err.code === 'authentication_required';

    const declineMessages = {
      'card_declined': 'Your card was declined. Please try a different card.',
      'insufficient_funds': 'Your card has insufficient funds.',
      'expired_card': 'Your card has expired. Please update your payment method.',
      'authentication_required': 'Your card requires authentication. Please try again.',
    };

    const friendlyMessage = declineMessages[declineCode] || declineMessages[err.code] || 'Your card was declined. Please try again.';

    if (isCardDecline || isAuthRequired) {
      return res.status(402).json({
        error: 'card_declined',
        declineCode: declineCode,
        message: friendlyMessage,
      });
    }

    res.status(500).json({ error: err.message });
  }
};
