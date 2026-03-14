# Deploying Housley Happy Paws to Vercel

## Step 1: Push to GitHub

If you already have the `housley-happy-paws` repo:

```bash
cd housley-happy-paws
# Replace all files with the new project structure
git add .
git commit -m "v9: Vercel project with Stripe integration"
git push origin main
```

If starting fresh:

```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/housley-happy-paws.git
git add .
git commit -m "v9: Vercel project with Stripe integration"
git push -u origin main
```

## Step 2: Connect to Vercel

1. Go to **vercel.com/new**
2. Import your `housley-happy-paws` GitHub repo
3. Framework Preset: **Other** (not Next.js)
4. Build command: leave empty
5. Output directory: leave empty
6. Click **Deploy**

## Step 3: Set Environment Variables

In Vercel dashboard: **Settings > Environment Variables**

Add these (for ALL environments: Production, Preview, Development):

| Variable | Value |
|----------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_51TADQQGXeWFMBaIc3ev5hi...` (your full test key) |
| `STRIPE_WEBHOOK_SECRET` | (set up in Step 5) |
| `NEXT_PUBLIC_SITE_URL` | `https://housleyhappypaws.com` |

## Step 4: Add Custom Domain

1. Vercel dashboard > **Settings > Domains**
2. Add `housleyhappypaws.com`
3. Follow DNS instructions (point A record or CNAME to Vercel)
4. SSL auto-provisions within minutes

## Step 5: Set Up Stripe Webhook

1. Go to **dashboard.stripe.com/test/webhooks** (use test mode first)
2. Click **Add endpoint**
3. URL: `https://housleyhappypaws.com/api/webhook`
4. Select events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (`whsec_...`)
7. Add it as `STRIPE_WEBHOOK_SECRET` in Vercel environment variables
8. **Redeploy** the project (Settings > Deployments > redeploy latest)

## Step 6: Test a Payment

1. Open your site
2. Go to Owner Portal > Send Invoice
3. Send a test invoice to your own email
4. Use Stripe test card: `4242 4242 4242 4242` (any future date, any CVC)
5. Verify payment shows in Stripe dashboard

## Going Live with Real Payments

When ready to accept real money:

1. Complete Stripe account verification (identity + bank account)
2. In Vercel, change `STRIPE_SECRET_KEY` from `sk_test_...` to `sk_live_...`
3. Create a new webhook endpoint for production (same URL, same events)
4. Update `STRIPE_WEBHOOK_SECRET` with the new live signing secret
5. Redeploy
