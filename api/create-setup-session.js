const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // R65 - this endpoint took `profileId` and `email` straight from the
    //       request body and then, with the SERVICE ROLE key, overwrote that
    //       profile's stripe_customer_id. There was no authentication of any
    //       kind, so anyone who could POST here could repoint any client's
    //       saved-card relationship at a Stripe customer they controlled.
    //
    //       The caller is now identified from their own access token, and the
    //       body's profileId and email are ignored entirely - you can only
    //       ever set up a card for yourself. The front end already sent this
    //       header (index.html ~13480), so nothing on the client changes.
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ error: 'Not signed in' });

    const supabaseAuth = createClient(
      process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    );
    const { data: authData, error: authErr } = await supabaseAuth.auth.getUser(token);
    if (authErr || !authData || !authData.user) {
      return res.status(401).json({ error: 'Not signed in' });
    }

    const profileId = authData.user.id;
    const email = authData.user.email;
    const { name } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Account has no email address' });

    // Check if profile already has a Stripe customer
    // Note: profileId is the auth user ID, profiles use user_id column
    let stripeCustomerId = null;
    if (profileId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('user_id', profileId)
        .maybeSingle();
      stripeCustomerId = profile?.stripe_customer_id || null;
    }

    // Find or create Stripe Customer
    if (!stripeCustomerId) {
      // Search for existing customer by email
      const existing = await stripe.customers.list({ email, limit: 1 });
      if (existing.data.length > 0) {
        stripeCustomerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email,
          name: name || undefined,
          metadata: { hhp_profile_id: profileId || '' },
        });
        stripeCustomerId = customer.id;
      }

      // Save to profiles table
      if (profileId) {
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('user_id', profileId);
      }
    }

    // Create Checkout Session in setup mode (saves card without charging)
    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://housleyhappypaws.com'}?card_saved=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://housleyhappypaws.com'}?card_saved=cancelled`,
    });

    res.status(200).json({ url: session.url, sessionId: session.id, customerId: stripeCustomerId });
  } catch (err) {
    console.error('Setup session error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
