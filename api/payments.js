const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const { email, limit = 25 } = req.query;

    const sessions = await stripe.checkout.sessions.list({
      limit: Math.min(parseInt(limit), 100),
      status: 'complete',
      expand: ['data.line_items'],
    });

    let payments = sessions.data;
    if (email) {
      payments = payments.filter(s => s.customer_email === email);
    }

    const formatted = payments.map(s => ({
      id: s.id,
      date: new Date(s.created * 1000).toISOString(),
      amount: (s.amount_total || 0) / 100,
      email: s.customer_email,
      clientName: s.metadata?.clientName || '',
      service: s.metadata?.service || s.line_items?.data?.[0]?.description || 'Pet Care',
      petNames: s.metadata?.petNames || '',
      status: s.payment_status,
    }));

    res.status(200).json({ payments: formatted, total: formatted.length });
  } catch (err) {
    console.error('Payment list error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
