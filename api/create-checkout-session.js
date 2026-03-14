const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const { service, price, clientName, clientEmail, petNames, notes } = req.body;

    // Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: clientEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Housley Happy Paws — ${service}`,
              description: petNames
                ? `Pet(s): ${petNames}${notes ? ' · ' + notes : ''}`
                : notes || 'Pet care service',
              images: [], // Add Cloudinary image URL later
            },
            unit_amount: Math.round(price * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        clientName: clientName || '',
        petNames: petNames || '',
        service: service || '',
        notes: notes || '',
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://housleyhappypaws.com'}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://housleyhappypaws.com'}?payment=cancelled`,
    });

    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
