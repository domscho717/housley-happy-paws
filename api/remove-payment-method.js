/**
 * Remove Payment Method API
 * Detaches a payment method from a Stripe customer.
 */

const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { paymentMethodId } = req.body || {};

  if (!paymentMethodId) {
    return res.status(400).json({ error: 'paymentMethodId is required' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    // Detach the payment method from the customer
    await stripe.paymentMethods.detach(paymentMethodId);

    return res.status(200).json({ success: true, message: 'Payment method removed.' });
  } catch (err) {
    console.error('[remove-payment-method] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
