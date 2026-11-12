/**
 * Remove Payment Method API
 * Detaches a payment method from a Stripe customer.
 */

const Stripe = require('stripe');
const { getCaller } = require('./_caller');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // R78 - this used to remove any saved card from any customer for anyone who
  // sent its id; the sign-in token the site already sends was never read.
  // Now the caller must be signed in, and the card must be on their own
  // Stripe customer. The owner may remove any card.
  const caller = await getCaller(req);
  if (!caller) return res.status(401).json({ error: 'Not signed in' });

  const { paymentMethodId } = req.body || {};

  if (!paymentMethodId) {
    return res.status(400).json({ error: 'paymentMethodId is required' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    if (!caller.isOwner) {
      const mine = caller.profile && caller.profile.stripe_customer_id;
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      const pmCustomer = pm && (typeof pm.customer === 'string' ? pm.customer : (pm.customer && pm.customer.id)) || null;
      if (!mine || !pmCustomer || pmCustomer !== mine) {
        return res.status(403).json({ error: 'That payment method is not on your account.' });
      }
    }

    // Detach the payment method from the customer
    await stripe.paymentMethods.detach(paymentMethodId);

    return res.status(200).json({ success: true, message: 'Payment method removed.' });
  } catch (err) {
    console.error('[remove-payment-method] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
