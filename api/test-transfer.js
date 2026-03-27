const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;

  const results = {
    connectedAccountId: connectedAccountId || 'NOT SET',
    tests: [],
  };

  // Test 1: Check connected account details
  try {
    const account = await stripe.accounts.retrieve(connectedAccountId);
    results.tests.push({
      test: 'Retrieve connected account',
      success: true,
      type: account.type,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      capabilities: account.capabilities,
      details_submitted: account.details_submitted,
    });
  } catch (e) {
    results.tests.push({
      test: 'Retrieve connected account',
      success: false,
      error: e.message,
      code: e.code,
      type: e.type,
    });
  }

  // Test 2: Try a $1 destination charge (will refund immediately)
  try {
    const pi = await stripe.paymentIntents.create({
      amount: 100,
      currency: 'usd',
      customer: 'cus_UC0bu7MrQ7vwac',
      payment_method: (await stripe.paymentMethods.list({ customer: 'cus_UC0bu7MrQ7vwac', type: 'card', limit: 1 })).data[0]?.id,
      off_session: true,
      confirm: false, // Don't actually charge, just see if creation works
      transfer_data: {
        destination: connectedAccountId,
        amount: 15, // 15 cents
      },
    });
    results.tests.push({
      test: 'Create PI with transfer_data (not confirmed)',
      success: true,
      piId: pi.id,
      status: pi.status,
    });
    // Cancel it immediately
    await stripe.paymentIntents.cancel(pi.id);
  } catch (e) {
    results.tests.push({
      test: 'Create PI with transfer_data',
      success: false,
      error: e.message,
      code: e.code,
      type: e.type,
    });
  }

  res.status(200).json(results);
};
