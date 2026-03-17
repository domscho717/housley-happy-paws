const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  try {
    const profileId = req.query?.profileId || req.body?.profileId;
    const email = req.query?.email || req.body?.email;

    if (!profileId && !email) return res.status(400).json({ error: 'profileId or email required' });

    // Get stripe_customer_id from profile
    let stripeCustomerId = null;
    if (profileId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', profileId)
        .single();
      stripeCustomerId = profile?.stripe_customer_id || null;
    }

    // Fallback: search by email
    if (!stripeCustomerId && email) {
      const existing = await stripe.customers.list({ email, limit: 1 });
      if (existing.data.length > 0) {
        stripeCustomerId = existing.data[0].id;
        // Save it to profile for next time
        if (profileId) {
          await supabase
            .from('profiles')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('id', profileId);
        }
      }
    }

    if (!stripeCustomerId) {
      return res.status(200).json({ methods: [], hasCard: false });
    }

    // Fetch saved payment methods
    const methods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });

    const cards = methods.data.map(m => ({
      id: m.id,
      brand: m.card.brand,
      last4: m.card.last4,
      expMonth: m.card.exp_month,
      expYear: m.card.exp_year,
      isDefault: false, // Will be set below
    }));

    // Check default payment method
    if (cards.length > 0) {
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      const defaultPM = customer.invoice_settings?.default_payment_method;
      cards.forEach(c => { c.isDefault = c.id === defaultPM; });
      // If no default set, mark first card as default
      if (!cards.some(c => c.isDefault) && cards.length > 0) {
        cards[0].isDefault = true;
      }
    }

    res.status(200).json({ methods: cards, hasCard: cards.length > 0, customerId: stripeCustomerId });
  } catch (err) {
    console.error('Get payment methods error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
