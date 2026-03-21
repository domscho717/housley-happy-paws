const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe is not configured.' });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://housleyhappypaws.com';

  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if connected account already exists
    if (process.env.STRIPE_CONNECTED_ACCOUNT_ID) {
      return res.status(200).json({
        message: 'Connected account already configured',
        accountId: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
      });
    }

    // Create a Standard connected account
    const account = await stripe.accounts.create({
      type: 'standard',
      email: email,
      metadata: {
        role: 'platform_partner',
        fee_percentage: '15',
      },
    });

    // Create an account onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${siteUrl}?connect=refresh`,
      return_url: `${siteUrl}?connect=success&account_id=${account.id}`,
      type: 'account_onboarding',
    });

    res.status(200).json({
      accountId: account.id,
      onboardingUrl: accountLink.url,
      message: 'Save this account ID as STRIPE_CONNECTED_ACCOUNT_ID in Vercel env vars: ' + account.id,
    });
  } catch (err) {
    console.error('Connect onboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
