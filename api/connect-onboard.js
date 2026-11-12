const Stripe = require('stripe');
const { getCaller } = require('./_caller');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // R78 - this used to hand anyone on the internet a Stripe onboarding link
  // for the connected payout account (or create a new connected account on
  // Rachel's Stripe). Nothing on the site calls it; it is a setup tool. Owner only.
  const caller = await getCaller(req);
  if (!caller) return res.status(401).json({ error: 'Not signed in' });
  if (!caller.isOwner) return res.status(403).json({ error: 'Owner access required' });

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

    // If connected account already exists, generate a new onboarding link for it
    if (process.env.STRIPE_CONNECTED_ACCOUNT_ID) {
      const accountLink = await stripe.accountLinks.create({
        account: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
        refresh_url: `${siteUrl}?connect=refresh`,
        return_url: `${siteUrl}?connect=success&account_id=${process.env.STRIPE_CONNECTED_ACCOUNT_ID}`,
        type: 'account_onboarding',
      });
      return res.status(200).json({
        message: 'Onboarding link generated for existing connected account',
        accountId: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
        onboardingUrl: accountLink.url,
      });
    }

    // Create an Express connected account (supports transfers from platform)
    const account = await stripe.accounts.create({
      type: 'express',
      email: email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
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
