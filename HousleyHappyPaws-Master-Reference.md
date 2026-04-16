# Housley Happy Paws — Master Reference Guide

**Last Updated:** March 15, 2026
**Business Owner:** Rachel Housley
**Developer Contact:** Domenic (domscho717@gmail.com)

---

## Live Website

**URL:** https://www.housleyhappypaws.com
**Location:** Lancaster, PA
**Business Email:** housleyhappypaws@gmail.com

---

## Services & Technology Stack

### Hosting & Deployment — Vercel
- **Dashboard:** https://vercel.com/domscho717-9458s-projects/housley-happy-paws
- **Project ID:** prj_KCYbY1JCv74X1IyD4rvYMYiOJRjS
- **Team ID:** team_dKL6PuCtiEGITAJSNySzapUt
- **Auto-deploys** from GitHub on every push to `main` branch
- **Custom domain:** www.housleyhappypaws.com

### Source Code — GitHub
- **Repository:** https://github.com/domscho717/housley-happy-paws
- **Branch:** main
- **Account:** domscho717

### Database & Auth — Supabase
- **Dashboard:** https://supabase.com/dashboard/project/niysrippazlkpvdkzepp
- **Project ID:** niysrippazlkpvdkzepp
- **Organization:** Essmedia
- **Features used:** Authentication (email/password, magic links), PostgreSQL database, Row-Level Security
- **User roles:** Owner, Staff, Client

### Payments — Stripe
- **Account ID:** acct_1TADQQGXeWFMBaIc
- **Display Name:** HousleyHappyPaws sandbox
- **Dashboard:** https://dashboard.stripe.com/acct_1TADQQGXeWFMBaIc
- **API Keys:** https://dashboard.stripe.com/acct_1TADQQGXeWFMBaIc/apikeys
- **Features used:** Checkout sessions, invoicing, payment history

### Image Hosting — Cloudinary
- **Upload Widget:** Used for owner photo management (hero, about, service photos)
- **Features used:** Upload widget, image transformations, responsive delivery

---

## Site Architecture

### Single-Page Application
The site is a single `index.html` file (~208 KB) with multiple portal views switched via JavaScript:

| View | Who Sees It | Key Features |
|------|------------|--------------|
| **Public** | Everyone | Homepage, About Rachel, Services & Pricing, Calendar, Reviews, Coming Soon |
| **Client Portal** | Logged-in clients | Appointments, messages, payment history |
| **Staff Portal** | Staff members | Schedule, client list, job management |
| **Owner Portal** | Rachel (Owner) | Full dashboard: overview, clients, schedule, reports, staff, messages, calendar, availability, AI studio, edit website, photos, payments, specials |

### JavaScript Files (Load Order)

| # | File | Purpose |
|---|------|---------|
| 1 | supabase.min.js (CDN) | Supabase client library |
| 2 | cloudinary upload widget (CDN) | Image upload widget |
| 3 | enhancements.js | UI enhancements and interactive features |
| 4 | gallery.js | Photo gallery functionality |
| 5 | ux-upgrades.js | Earlier UX improvements (some overridden by ux-patch.js) |
| 6 | **ux-patch.js (v5)** | Comprehensive mobile/responsive fixes, hamburger menu, greeting emojis, footer email, preview tool |
| 7 | stripe-client.js | Stripe payment integration |
| 8 | auth-client.js | Supabase authentication & role management |
| 9 | cloudinary-client.js | Photo upload & management |
| 10 | fixes.js | Bug fixes and patches |
| 11 | site-content-client.js | Dynamic site content management |
| 12 | profiles.js | User profile management |
| 13 | employee-mgmt.js | Staff/employee management |

### CSS Breakpoints
- **Desktop:** > 1024px
- **Tablet:** 768px - 1024px
- **Phone:** max-width 767px (hamburger menu activates)
- **Small phone:** max-width 400px

### API Routes (Vercel Serverless Functions)
Located in `/api/`:
- `cloudinary-delete.js` — Delete photos from Cloudinary
- `cloudinary-sign.js` — Sign Cloudinary upload requests
- `create-checkout-session.js` — Create Stripe checkout sessions
- `create-invoice-link.js` — Generate Stripe invoice links
- `payments.js` — Payment processing
- `webhook.js` — Stripe webhook handler

---

## Key Fixes Applied (ux-patch.js v5)

1. **Greeting emojis** — Fixed garbled encoding, now shows sunrise/sun/moon based on time of day
2. **Hero section** — Shrunk slideshow, enlarged text, "Meet Rachel" button styled as light rectangle
3. **About Rachel** — Enlarged slideshow
4. **Footer email** — Set to housleyhappypaws@gmail.com
5. **Mobile responsive** — Comprehensive CSS for all portal views at phone/tablet breakpoints
6. **Hamburger menu** — Fully functional dropdown nav on mobile (replaces broken `.nav-right-group` targeting from ux-upgrades.js)
7. **Portal sidebar** — Full-screen overlay on mobile with close button
8. **Viewport preview** — Desktop/Tablet/Phone toggle tool in Edit Website panel

---

## Known Issues (Non-Critical)

1. **Cloudflare email-decode.min.js** — Script tag hardcoded in index.html but site isn't behind Cloudflare, causing harmless console SyntaxError. Can be removed by deleting the `<script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js">` tag from index.html.

2. **ux-upgrades.js overlap** — This file targets `.nav-right-group` (which doesn't exist) for mobile nav hiding. ux-patch.js v5 overrides this with correct `.nav-right` targeting using `!important`. Both files load but ux-patch.js wins.

---

## How Deployment Works

```
Code change → Push to GitHub (main branch) → Vercel auto-detects → Builds & deploys → Live at housleyhappypaws.com
```

Typical deploy time: ~30-60 seconds from push to live.

---

## Quick Access Links

| Service | URL |
|---------|-----|
| Live site | https://www.housleyhappypaws.com |
| GitHub repo | https://github.com/domscho717/housley-happy-paws |
| Vercel dashboard | https://vercel.com/domscho717-9458s-projects/housley-happy-paws |
| Supabase dashboard | https://supabase.com/dashboard/project/niysrippazlkpvdkzepp |
| Stripe dashboard | https://dashboard.stripe.com/acct_1TADQQGXeWFMBaIc |
| Stripe API keys | https://dashboard.stripe.com/acct_1TADQQGXeWFMBaIc/apikeys |
