# Housley Happy Paws — Handoff Summary (March 19, 2026)

**Owner:** Domenic (domscho717@gmail.com) building for Rachel Housley's pet care business in Lancaster, PA

---

## PROJECT OVERVIEW

Single-page application website for a pet care business. Everything lives in one main folder: `/housley-happy-paws/`

### Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS (no framework), single `index.html` (6,639 lines) with `switchView()` for page switching
- **Database:** Supabase (project ID: `niysrippazlkpvdkzepp`, URL: `https://niysrippazlkpvdkzepp.supabase.co`)
- **Auth:** Supabase Auth with roles: `owner`, `staff`, `client`
- **Image Uploads:** Cloudinary (cloud name: `dg1p1zjgv`, preset: `hhp_unsigned`)
- **Payments:** Stripe (test mode, account: `acct_1TADQQGXeWFMBaIc`)
- **Hosting:** Vercel (auto-deploys from GitHub `main` branch)
- **Live URL:** https://www.housleyhappypaws.com
- **GitHub:** https://github.com/domscho717/housley-happy-paws

### File Structure
```
housley-happy-paws/
├── index.html                   # Main SPA (6,639 lines)
├── ux-patch.js                  # 93KB — Mobile nav, drawer, greetings, responsive CSS
├── links.html                   # QR code links page
├── vercel.json                  # Rewrites, CORS headers, cron jobs
├── package.json                 # Dependencies
├── .env                         # Environment vars (gitignored)
├── .env.example                 # Template
├── js/
│   ├── auth-client.js           # 19KB — Supabase auth, role routing, session mgmt
│   ├── booking-system.js        # 124KB — Full booking system (biggest file)
│   ├── messaging.js             # 45KB — Real-time messaging with Supabase subscriptions
│   ├── gallery.js               # 35KB — Photo gallery with lightbox
│   ├── cloudinary-client.js     # 24KB — Photo upload & management
│   ├── notifications.js         # 22KB — Bell icon, announcements, real-time
│   ├── avatar-system.js         # 13KB — Avatar upload/display
│   ├── profiles.js              # 12KB — User profiles, pet management
│   ├── employee-mgmt.js         # 10KB — Staff management
│   ├── site-content-client.js   # 7KB — Edit Website persistence to Supabase
│   └── stripe-client.js         # 4KB — Stripe payment integration
├── api/
│   ├── booking-notification.js      # Email on new booking (NOT SENDING — see bugs)
│   ├── booking-status-notification.js # Email on status change (NOT SENDING — see bugs)
│   ├── cancel-booking.js            # Booking cancellation with refund logic
│   ├── capture-payments.js          # Cron: capture authorized payments
│   ├── recurring-invoices.js        # Cron: auto-generate recurring invoices
│   ├── create-checkout-session.js   # Stripe checkout session creator
│   ├── create-invoice-link.js       # Stripe invoice link generator
│   ├── create-setup-session.js      # Stripe saved card setup
│   ├── get-payment-methods.js       # List saved payment methods
│   ├── charge-saved-card.js         # Charge a saved card
│   ├── webhook.js                   # Stripe webhook handler
│   ├── payments.js                  # Payment processing
│   ├── cloudinary-sign.js           # Sign Cloudinary uploads
│   ├── cloudinary-delete.js         # Delete from Cloudinary
│   ├── ai-chat.js                   # AI chat endpoint (needs ANTHROPIC_API_KEY)
│   ├── site-content.js              # Site content API
│   ├── add-cancellation-fields.sql  # SQL migration for cancellation columns
│   ├── setup-supabase.sql           # Initial DB setup SQL
│   └── CANCELLATION_API_REFERENCE.md
└── public/
    └── (static assets)
```

### Supabase Tables
- `profiles` — user profiles with role, full_name, email, pet_names, avatar_url, etc.
- `booking_requests` — service booking requests with preferred_date, status
- `bookings` — confirmed bookings with date, service, client_id, staff_id, status
- `payments` — Stripe payment records
- `service_reports` — reports sent to clients after service (media, mood, note, duration)
- `site_content` — key/value store for Edit Website content
- `site_photos` — Cloudinary photo references by slot_id
- `gallery_photos` — photo gallery uploads
- `walk_notes` — notes attached to bookings
- `staff_assignments` — staff-to-client assignments
- `staff_schedule` — staff availability
- `messages` — chat messages between users
- `pets` — client pets (name, breed, etc.)

---

## IMPORTANT QUIRKS

1. **Git Push Blocked from VM:** Every `git push` from the Cowork VM fails with 403 proxy error. Domenic must push from his Windows PC manually.
2. **OneDrive Git Lock:** OneDrive sync creates `.git/HEAD.lock` files. Fix: `Remove-Item .git\HEAD.lock -Force` on his PC before committing.
3. **Supabase Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5peXNyaXBwYXpsa3B2ZGt6ZXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTcxNDYsImV4cCI6MjA3OTA3MzE0Nn0.miAoNZQtOTTbnruWcj1WVn8ZGYtQZB5rh8FbBAS7VZU`

---

## WHAT'S WORKING (confirmed via code audit)

1. **Auth / Login / Roles** — Supabase auth with email/password, magic links, role-based portal routing (`owner` → `#pg-owner`, `client` → `#pg-client`, `staff` → `#pg-staff`). Session restore on reload using `sessionStorage('hhp_last_view')`. Portal flash prevention via `<style id="early-hide">`. `_handledSessionId` prevents duplicate session handling.

2. **Public Site** — Hero section with slideshow, About Rachel, Services & Pricing (Dog Walk, Drop-in Visit, House Sitting Dog/Cat), Reviews carousel, Coming Soon (Boarding/Day Care interest form), Calendar.

3. **Owner Portal — Activity Log** (`#o-activity`, lines 2295–3029 in index.html) — Month/year/week selectors, type filters (messages, bookings, signups, cancellations), day grouping with icons, queries `messages`, `bookings`, `profiles` tables. Stats cards show total events, messages, bookings, sign-ups, cancellations. Profile names resolved via `_resolveActivityNames()` with caching.

4. **Owner Portal — Service Reports** (lines 5906–6375) — Form with client dropdown (`populateReportClients()`), service selector, auto-date, duration, distance (Dog Walk only via `toggleReportDistance()`), mood, Cloudinary media upload (`openReportMediaUpload()` with photo+video support), AI note section, submit to Supabase (`submitServiceReport()`), form reset (`resetReportForm()`). Staff form mirrors this. Client portal feed (`loadClientReports()`) and detail modal (`openReportDetail()`) also implemented.

5. **Owner Portal — Dashboard Stats** (`loadDashboardStats()`, lines 6462–6627) — Active clients, new sign-ups, bookings this month, avg rating, today's jobs, jobs this week, week revenue, new inquiries. Also loads stats for client and staff dashboards.

6. **Owner Portal — Clients, Schedule, Staff, Messages, Calendar, Edit Website, Photos, Payments** — All functional.

7. **Booking System** (124KB `booking-system.js`) — Multi-date picker, recurring support, price calculator with holiday surcharges and puppy fees, admin dashboard for accepting/modifying/declining, and calendar integration. House Sitting split into Dog/Cat with per-type pricing.

8. **Messaging** (45KB `messaging.js`) — Real-time Supabase subscriptions, proper privacy model (clients see their thread, staff see assigned clients, owner sees all), unread badges.

9. **Notifications** (22KB `notifications.js`) — Bell icon, announcements system, real-time updates.

10. **Gallery** (35KB `gallery.js`) — Photo gallery with lightbox, upload via Cloudinary.

11. **Mobile/Responsive** (`ux-patch.js`) — Hamburger menu, portal drawer, responsive CSS injection, greeting emojis with pet birthday detection, view switcher, Stripe booking integration.

12. **Vercel Config** — Rewrites (SPA fallback + `/links` route), CORS headers on `/api/*`, two cron jobs (recurring invoices at 8am, capture payments at 6am daily).

---

## BUGS & PROBLEMS TO FIX (prioritized)

### RED — Critical / Broken

#### 1. Email Notifications Are NOT Actually Sending
**Files:** `api/booking-notification.js`, `api/booking-status-notification.js`
**Problem:** Both endpoints build the email body but have `TODO: Integrate with SendGrid/Resend` comments. They construct the response with email data but never call any email API. The `sendReportEmailNotification()` function in `index.html` (line 6163) uses a `mailto:` fallback which opens the user's email client instead of sending automatically.
**Impact:** No one gets email notifications — not on new bookings, status changes, or service reports.
**Fix:** Integrate a real email service (Resend, SendGrid, or Supabase's built-in email). Add the API key to Vercel env vars.

#### 2. Stripe Webhook Secret Is a Placeholder
**File:** `.env` line 3
**Problem:** `STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here` — This means `api/webhook.js` will fail signature verification on every webhook from Stripe.
**Impact:** Stripe payment events (completed checkout, invoice paid, etc.) are NOT being processed. Payments may complete in Stripe but the `payments` table in Supabase won't get updated.
**Fix:** Go to Stripe Dashboard → Webhooks → copy the signing secret → add to Vercel env vars as `STRIPE_WEBHOOK_SECRET`.

#### 3. Missing Environment Variables in Vercel
**Variables that need to be set in Vercel dashboard:**
- `STRIPE_WEBHOOK_SECRET` — Real webhook signing secret (see above)
- `CRON_SECRET` — Required by both cron jobs (`capture-payments.js` line ~5, `recurring-invoices.js` line ~5). Without it, the cron endpoints are either unprotected or will reject Vercel's cron calls.
- `SUPABASE_SERVICE_ROLE_KEY` — Used by `webhook.js` to write to Supabase with elevated privileges. Without it, webhook writes will fail RLS.
- `ANTHROPIC_API_KEY` — Required by `api/ai-chat.js`. Without it, the AI chat feature returns errors.

#### 4. Booking Notification API Endpoints Missing CORS Handling
**Files:** `api/booking-notification.js`, `api/booking-status-notification.js`
**Problem:** These endpoints don't handle OPTIONS preflight requests. While `vercel.json` sets CORS headers globally, the actual endpoint handlers don't return proper responses for OPTIONS method, which can cause frontend `fetch()` calls to fail in browsers.
**Fix:** Add `if (req.method === 'OPTIONS') return res.status(200).end();` at the top of each handler.

### YELLOW — Moderate / Needs Attention

#### 5. Dashboard Stats Query References Non-Existent Columns
**File:** `index.html` lines 6500–6510
**Problem:** `loadDashboardStats()` queries `service_reports.rating` — but the `service_reports` table schema (from the handoff) has no `rating` column. Also queries `profiles.avg_rating` and `profiles.total_earnings` which may not exist.
**Impact:** Client dashboard "Avg Rating Given", staff "Your Rating" and "This Month earnings", and owner "Avg Rating" stats will silently show "—" because the queries return null.
**Fix:** Either add `rating` column to `service_reports` table (and `avg_rating`/`total_earnings` to `profiles`), or remove/replace those stat cards.

#### 6. Dashboard Stats Also Queries `pets` Table
**File:** `index.html` line 6512
**Problem:** `loadDashboardStats()` queries `sb.from('pets')` — but `pets` was not listed in the Supabase tables. It may not exist.
**Impact:** "Pets in Care" stat on client dashboard will show "0" or error silently.
**Fix:** Verify if `pets` table exists in Supabase. If not, create it or remove the stat card.

#### 7. Stacked Event Listeners in ux-patch.js
**File:** `ux-patch.js` lines ~1424–1436
**Problem:** `injectPortalNav()` adds a `document.addEventListener('click', ...)` every time it runs. If triggered by auth changes or window resizes, listeners stack up → memory leak.
**Fix:** Use a flag to prevent duplicate attachment, or use `{ once: true }`, or remove the listener before re-adding.

#### 8. Dead Code in ux-patch.js
**File:** `ux-patch.js` lines ~1343–1442 and ~1672–1694
**Problem:** `injectPortalNav()` creates a desktop dropdown nav that's immediately hidden by `cleanDesktopHeader()` at line ~1668 and a CSS `!important` override at line ~1840. ~100 lines of dead code. `addHomeToMobileMenu()` adds a Home link to the drawer but `updateDrawerContent()` wipes the drawer's innerHTML immediately after.
**Impact:** No functional impact but makes debugging harder and adds page weight.
**Fix:** Remove the dead functions or integrate them properly.

#### 9. Three MutationObservers Run Indefinitely
**File:** `ux-patch.js` lines ~1494, ~1862, ~1877
**Problem:** Quick Save observer, Nav guard observer, and Head observer all run forever with no cleanup or disconnect logic.
**Impact:** Minor memory concern on long sessions.
**Fix:** Add `observer.disconnect()` when no longer needed, or at least limit their scope.

#### 10. `index_clean.html` Is a Stale Copy
**File:** `housley-happy-paws/index_clean.html` (209KB vs current index.html at 431KB)
**Problem:** This appears to be an older version of index.html from before many features were added. If anyone accidentally serves it or references it, they'll get a broken experience.
**Fix:** Delete `index_clean.html` or add it to `.gitignore`.

### GREEN — Minor / Cosmetic

#### 11. Cloudflare email-decode.min.js Still Referenced
**File:** `index.html` (search for `cloudflare-static/email-decode.min.js`)
**Problem:** Site isn't behind Cloudflare. This script fails to load on every page view → harmless console error.
**Fix:** Delete the `<script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js">` tag.

#### 12. Stripe Payment Links Are Test-Mode URLs
**File:** `js/booking-system.js`
**Problem:** All Stripe payment links use test mode. Fine for development but need to be swapped before going live.
**Fix:** When ready for production, replace all `buy.stripe.com` test links with live ones and switch `STRIPE_SECRET_KEY` from `sk_test_` to `sk_live_`.

#### 13. `.env` Contains Real Test API Keys
**File:** `.env`
**Problem:** While properly gitignored, the `.env` file contains real Stripe test secret key, Cloudinary API secret, etc. If OneDrive syncs this to the cloud or the file leaks, those keys are exposed.
**Impact:** Low — test keys only grant access to test data. But Cloudinary API secret is shared.
**Fix:** Consider using Vercel env vars exclusively and keeping `.env` minimal for local dev only.

---

## KEY FUNCTIONS & PATTERNS

### View Switching
```javascript
switchView(view)     // Removes 'active' from all .page elements, adds to target
sTab(portal, panelId) // Switches panels within a portal (e.g. sTab('o','o-activity'))
                     // 'o' = owner, 'c' = client, 's' = staff
```

### Supabase Access
```javascript
HHP_Auth.supabase      // The Supabase client
HHP_Auth.currentUser   // Current user object (has .id)
HHP_Auth.currentRole   // 'owner', 'staff', or 'client'
window.HHP_supabase    // Global alias set after auth init

// Getting client's profile ID:
// profiles.user_id = auth user id
// profiles.id = profile row id (used as FK in service_reports.client_id)
```

### Cloudinary Upload
```javascript
HHP_Photos.CLOUD_NAME   // 'dg1p1zjgv'
HHP_Photos.UPLOAD_PRESET // 'hhp_unsigned'
HHP_Photos.FOLDER       // 'housley-happy-paws'
```

### Toast Messages
```javascript
toast('Message here');  // Shows a toast notification
```

### Auth-Ready Callbacks
```javascript
window.onHHPAuthReady(function() {
  // Runs after auth is initialized
});
```

---

## VERCEL CRON JOBS

| Job | Schedule | File | Notes |
|-----|----------|------|-------|
| Recurring Invoices | Daily at 8am UTC | `api/recurring-invoices.js` | Needs `CRON_SECRET` env var |
| Capture Payments | Daily at 6am UTC | `api/capture-payments.js` | Needs `CRON_SECRET` env var |

---

## DECISIONS ALREADY MADE (don't ask again)

- Media storage: **Cloudinary** (same as existing image uploads)
- Client reports layout: **Timeline/feed style** (scrollable list, newest first)
- Notifications: **Email notification** when report is submitted (currently mailto fallback)
- House Sitting split: Two separate entries — "House Sitting (Dog)" and "House Sitting (Cat)"
- House Sitting pricing: Dog $125/night, Cat $80/night, Mixed $140/night, +$35 per extra dog, +$15 per extra cat, 3+ animals $35 each

---

## LAST SESSION CONTEXT

Domenic was past the service reports feature and was fixing the **Activity Log** in the owner portal, making sure everything ran correctly. The session crashed mid-work. The activity log code (lines 2295–3029) appears complete and functional — it has month/year/week selectors, type filters, day grouping, profile name resolution, and stats cards. The question is whether there were specific bugs Domenic was seeing that still need to be addressed.

The service reports feature (lines 5906–6375) is also fully implemented — owner form, staff form, Cloudinary media upload, client feed, detail modal, form reset, and date auto-set are all coded. The main gap is the email notification being a `mailto:` fallback instead of a real email sender.
