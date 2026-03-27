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

  // Test 2: Try destination charge (transfer_data)
  try {
    const pi = await stripe.paymentIntents.create({
      amount: 100,
      currency: 'usd',
      customer: 'cus_UC0bu7MrQ7vwac',
      payment_method: (await stripe.paymentMethods.list({ customer: 'cus_UC0bu7MrQ7vwac', type: 'card', limit: 1 })).data[0]?.id,
      off_session: true,
      confirm: false,
      transfer_data: {
        destination: connectedAccountId,
        amount: 15,
      },
    });
    results.tests.push({ test: 'Destination charge (transfer_data)', success: true, piId: pi.id });
    await stripe.paymentIntents.cancel(pi.id);
  } catch (e) {
    results.tests.push({ test: 'Destination charge (transfer_data)', success: false, error: e.message, code: e.code });
  }

  // Test 3: Try separate transfer (using most recent succeeded charge)
  try {
    const charges = await stripe.charges.list({ limit: 1 });
    const chargeId = charges.data[0]?.id;
    if (chargeId) {
      const transfer = await stripe.transfers.create({
        amount: 100,
        currency: 'usd',
        destination: connectedAccountId,
        source_transaction: chargeId,
        description: 'Test transfer — will reverse',
      });
      results.tests.push({ test: 'Separate transfer (stripe.transfers.create)', success: true, transferId: transfer.id });
      // Reverse it immediately
      await stripe.transfers.createReversal(transfer.id, { amount: 100 });
      results.tests.push({ test: 'Reversed test transfer', success: true });
    }
  } catch (e) {
    results.tests.push({ test: 'Separate transfer', success: false, error: e.message, code: e.code });
  }

  res.status(200).json(results);
};
