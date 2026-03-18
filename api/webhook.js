const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

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

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
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

      // Save payment record to Supabase
      try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        await supabase.from('payments').insert({
          stripe_session_id: session.id,
          client_email: session.customer_email || '',
          amount: session.amount_total / 100,
          service: session.metadata?.service || '',
          client_name: session.metadata?.clientName || '',
          pet_names: session.metadata?.petNames || '',
          status: 'paid',
          paid_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.error('Failed to save payment to Supabase:', dbErr.message);
      }

      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const meta = invoice.metadata || {};
      console.log('Invoice paid!', {
        id: invoice.id,
        amount: invoice.amount_paid,
        email: invoice.customer_email,
        metadata: meta,
      });

      try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

        // 1. Record the payment
        await supabase.from('payments').insert({
          stripe_session_id: invoice.id,
          client_email: invoice.customer_email || '',
          amount: invoice.amount_paid / 100,
          service: meta.service || 'Pet Care',
          client_name: meta.clientName || '',
          pet_names: meta.petNames || '',
          status: 'paid',
          notes: 'Paid via Stripe invoice' + (meta.source === 'owner_invoice' ? ' (sent from owner portal)' : ''),
          paid_at: new Date().toISOString(),
        });

        // 2. If this invoice was sent from the owner portal and has a service date, create a booking
        if (meta.source === 'owner_invoice' && meta.serviceDate) {
          // Look up client_id from profiles by email
          let clientId = null;
          if (invoice.customer_email) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', invoice.customer_email)
              .single();
            if (profile) clientId = profile.id;
          }

          await supabase.from('booking_requests').insert({
            service: meta.service || 'Pet Care',
            preferred_date: meta.serviceDate,
            preferred_end_date: meta.endDate || null,
            scheduled_date: meta.serviceDate,
            contact_name: meta.clientName || '',
            contact_email: invoice.customer_email || '',
            pet_names: meta.petNames || '',
            estimated_total: invoice.amount_paid / 100,
            client_id: clientId,
            status: 'accepted',
            special_notes: 'Booked via owner invoice #' + invoice.number,
          });

          console.log('Booking created from paid invoice:', invoice.id);
        }
      } catch (dbErr) {
        console.error('Failed to process invoice.paid:', dbErr.message);
      }

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
