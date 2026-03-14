const Stripe = require('stripe');

// Vercel doesn't parse the body for webhooks — we need the raw body
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      // For development without webhook signing
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('Payment successful!', {
        id: session.id,
        amount: session.amount_total,
        email: session.customer_email,
        metadata: session.metadata,
      });

      // TODO: When Supabase is connected, save payment record:
      // await supabase.from('payments').insert({
      //   stripe_session_id: session.id,
      //   client_email: session.customer_email,
      //   amount: session.amount_total / 100,
      //   service: session.metadata.service,
      //   client_name: session.metadata.clientName,
      //   pet_names: session.metadata.petNames,
      //   status: 'paid',
      //   paid_at: new Date().toISOString(),
      // });

      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object;
      console.log('Checkout expired:', session.id);
      break;
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object;
      console.log('Payment failed:', intent.id, intent.last_payment_error?.message);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
};
