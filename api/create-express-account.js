const Stripe = require('stripe');

/**
 * One-time endpoint to create an Express connected account for the 15% split.
 * Hit: GET /api/create-express-account?email=domscho717@gmail.com
 * Returns the new account ID and onboarding URL.
 * After onboarding, set STRIPE_CONNECTED_ACCOUNT_ID in Vercel to the new account ID.
 */
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://housleyhappypaws.com';
  const email = req.query.email || 'domscho717@gmail.com';

  try {
    // Create an Express connected account (supports transfers from platform)
    const account = await stripe.accounts.create({
      type: 'express',
      email: email,
      capabilities: {
        transfers: { requested: true },
      },
      metadata: {
        role: 'platform_partner',
        fee_percentage: '15',
      },
    });

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${siteUrl}?connect=refresh`,
      return_url: `${siteUrl}?connect=success&account_id=${account.id}`,
      type: 'account_onboarding',
    });

    res.status(200).json({
      message: 'Express account created! Complete onboarding at the URL below, then update STRIPE_CONNECTED_ACCOUNT_ID in Vercel.',
      accountId: account.id,
      onboardingUrl: accountLink.url,
      email: email,
      type: 'express',
    });
  } catch (err) {
    console.error('Create express account error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
