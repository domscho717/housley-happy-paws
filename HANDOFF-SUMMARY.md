# Housley Happy Paws — Handoff Summary for Next Chat Session

**Date:** March 17, 2026
**Owner:** Domenic (domscho717@gmail.com) building for Rachel Housley's pet care business in Lancaster, PA

---

## PROJECT OVERVIEW

Single-page application website for a pet care business. All code lives in one main folder:
- **Main HTML:** `/housley-happy-paws/index.html` (~3000+ lines, single-page app with view switching)
- **Auth:** `/housley-happy-paws/js/auth-client.js` (Supabase auth with role-based portals)
- **Booking:** `/housley-happy-paws/js/booking-system.js` (booking requests + pricing)
- **Photos:** `/housley-happy-paws/js/cloudinary-client.js` (Cloudinary upload widget for site images)
- **Site Content:** `/housley-happy-paws/js/site-content-client.js` (Edit Website persistence to Supabase)
- **Profiles:** `/housley-happy-paws/js/profiles.js`
- **Gallery:** `/housley-happy-paws/js/gallery.js`
- **Enhancements:** `/housley-happy-paws/js/enhancements.js`
- **Avatar:** `/housley-happy-paws/js/avatar-system.js`

## TECH STACK

- **Frontend:** Vanilla HTML/CSS/JS (no framework), single `index.html` with `switchView()` for page switching
- **Database:** Supabase (project ID: `niysrippazlkpvdkzepp`, URL: `https://niysrippazlkpvdkzepp.supabase.co`)
- **Auth:** Supabase Auth with roles: `owner`, `staff`, `client`
- **Image Uploads:** Cloudinary (cloud name: `dg1p1zjgv`, preset: `hhp_unsigned`)
- **Payments:** Stripe (test mode) with payment links
- **Hosting:** Vercel (connected)

## SUPABASE TABLES

- `profiles` — user profiles with role, full_name, email, pet_names, avatar_url, etc. (RLS enabled, 1 row)
- `booking_requests` — service booking requests with preferred_date, preferred_end_date, status (RLS enabled)
- `payments` — Stripe payment records (RLS enabled)
- `bookings` — confirmed bookings (RLS enabled)
- `site_content` — key/value store for Edit Website content (RLS enabled, 3 rows)
- `site_photos` — Cloudinary photo references by slot_id (RLS enabled, 2 rows)
- `gallery_photos` — photo gallery uploads (RLS enabled)
- `walk_notes` — notes attached to bookings (RLS enabled)
- `staff_assignments` — staff-to-client assignments (RLS enabled)
- `staff_schedule` — staff availability (RLS enabled)
- `service_reports` — **JUST CREATED** (see below) — stores service reports sent to clients (RLS enabled)

## IMPORTANT QUIRKS

1. **Git Push Blocked from VM:** Every `git push` from the Cowork VM fails with a 403 proxy error. Domenic must push from his Windows PC manually.
2. **OneDrive Git Lock:** OneDrive sync creates `.git/HEAD.lock` files. Fix: `Remove-Item .git\HEAD.lock -Force` on his PC before committing.
3. **Supabase Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5peXNyaXBwYXpsa3B2ZGt6ZXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTcxNDYsImV4cCI6MjA3OTA3MzE0Nn0.miAoNZQtOTTbnruWcj1WVn8ZGYtQZB5rh8FbBAS7VZU`

---

## WHAT WAS COMPLETED IN PREVIOUS SESSIONS

1. **House Sitting date range feature** — multi-night pricing with start/end date fields
2. **House Sitting pricing** — Dog $125/night, Cat $80/night, Mixed always $140/night, additional dog $35, additional cat $15, 3+ animals $35 each
3. **House Sitting split** — Two separate entries in booking dropdown: "House Sitting (Dog)" and "House Sitting (Cat)"
4. **Pet combo filtering** — dropdown filters based on selected House Sitting type (dog HS hides cat-only options, etc.)
5. **Rubber-band bounce fix** — `overscroll-behavior: none` on html and body
6. **Edit Website in owner portal** — House Sitting added to pricing/service editors
7. **Cross-device persistence** — Supabase is source of truth for site content (flipped merge order in `loadSiteContent()`)
8. **Invite New Client modal** — copy signup link + email invite via mailto
9. **Page reload stays on current page** — uses `sessionStorage` (`hhp_last_view`) to restore view on reload instead of redirecting to portal
10. **Auth flow fixes** — `_handledSessionId` prevents duplicate `handleSession` calls; distinguishes session restore from fresh login

## WHAT WAS COMPLETED IN THIS SESSION (partially)

### 1. Portal Flash Fix on Reload
Added a `<style id="early-hide">` tag as the VERY FIRST thing in `<head>` that applies `display:none!important;visibility:hidden!important` to `#pg-client, #pg-staff, #pg-owner`. This is removed by `switchView()` after auth settles. An inline script in `<head>` removes it immediately if user was on public page. Still shows for a very brief moment but Domenic said it's acceptable.

### 2. Service Reports — IN PROGRESS (this is where the next chat picks up)

**What's done:**
- **Supabase table created:** `service_reports` with columns:
  - `id` (uuid PK)
  - `client_id` (uuid, FK to profiles.id)
  - `author_id` (uuid, FK to auth.users.id)
  - `service` (text)
  - `report_date` (date, default CURRENT_DATE)
  - `duration` (text, default '30 min')
  - `distance` (text, nullable)
  - `personal_note` (text, nullable)
  - `media` (jsonb, default '[]' — stores array of Cloudinary URLs/IDs for photos+videos)
  - `pet_name` (text, nullable)
  - `mood` (text, default 'great')
  - `created_at`, `updated_at` (timestamptz)
  - RLS: owner/staff can manage all, clients can read their own
  - Indexes on `client_id` and `report_date DESC`

- **Owner report form HTML updated** (in `index.html` at `#o-reports` panel, ~line 1454):
  - Client dropdown: `id="rpt-client"` — needs to be populated dynamically from profiles table
  - Service dropdown: `id="rpt-service"` with `onchange="toggleReportDistance()"` — includes all services + House Sitting
  - Date field: `id="rpt-date"` — set to `readonly` with gray background, needs JS to auto-set to today
  - Duration dropdown: `id="rpt-duration"` — options: "30 Minutes" (30 min) and "1 Hour" (1 hour)
  - Distance field: `id="rpt-distance"` inside `id="rpt-distance-wrap"` — only visible when "Dog Walk" selected
  - Mood dropdown: `id="rpt-mood"` — great/happy/calm/shy/energetic
  - Media upload area: `id="rpt-media-grid"` for thumbnails + button calls `openReportMediaUpload()`
  - AI Note section: same as before (oAiQ1, oAiQ2, oAiQ3, ownerNote)
  - Submit button: calls `submitServiceReport()`

**What still needs to be built (JavaScript):**

1. **`toggleReportDistance()`** — show/hide `#rpt-distance-wrap` based on service selection (only show for "Dog Walk")

2. **Auto-set date** — on page load or when report panel opens, set `#rpt-date` value to today's date

3. **Populate client dropdown** — fetch clients from `profiles` table where `role='client'`, populate `#rpt-client` with `<option value="PROFILE_ID">Client Name</option>`

4. **`openReportMediaUpload()`** — create a Cloudinary upload widget instance that:
   - Allows multiple uploads
   - Accepts images (jpg, png, webp) AND videos (mp4, mov)
   - Uses `resourceType: 'auto'` instead of 'image' to support videos
   - Stores uploaded media in an array (e.g. `window._reportMedia = []`)
   - On each successful upload, adds a thumbnail/preview to `#rpt-media-grid`
   - Each thumbnail should have a remove button

5. **`submitServiceReport()`** — validate form, insert into `service_reports` table:
   - Read client_id from `#rpt-client`
   - Read service from `#rpt-service`
   - report_date from `#rpt-date`
   - duration from `#rpt-duration`
   - distance from `#rpt-distance` (only if Dog Walk)
   - personal_note from `#ownerNote`
   - media: JSON array from `window._reportMedia`
   - pet_name from `#oAiQ2`
   - mood from `#rpt-mood`
   - author_id: `HHP_Auth.currentUser.id`
   - After insert: show success toast, reset form, send email notification

6. **Email notification** — when report is submitted, send email to the client notifying them a new report is available. Could use a Supabase Edge Function or a simple mailto fallback.

7. **Client Portal Reports Feed** (`#c-reports` panel, ~line 1208):
   - Currently shows "No reports yet" placeholder
   - Needs to be replaced with a dynamic timeline/feed
   - On panel load, fetch from `service_reports` where `client_id` matches current user's profile ID, ordered by `report_date DESC`
   - Each report card should show: date, service type, duration, distance (if walk), mood, media thumbnails (clickable to view full), personal note
   - Scrollable feed, newest first
   - "No reports yet" message when empty

8. **Report detail modal** — the existing `#reportModal` (line ~2056-2082) has placeholder content. When a client clicks a report card in the feed, open this modal populated with real data from that report.

### Staff report form (`#s-reports` at line ~1312)
This is a separate form for staff members with the same structure but different IDs (aiQ1, aiQ2, aiQ3, reportNote). It was NOT updated yet. It should get the same treatment as the owner form (auto-date, duration dropdown, conditional distance, photo/video upload). The staff form currently uses plain text inputs for all fields.

---

## KEY FUNCTIONS & PATTERNS TO FOLLOW

### View Switching
```javascript
function switchView(view) {
  // Removes 'active' from all .page elements
  // Adds 'active' to target page
  // Removes 'loading-auth' and 'early-hide'
}
function sTab(portal, panelId) {
  // Switches panels within a portal (e.g. sTab('o','o-reports'))
  // 'o' = owner, 'c' = client, 's' = staff
}
```

### Supabase Access
```javascript
// From auth-client.js
HHP_Auth.supabase  // The Supabase client
HHP_Auth.currentUser  // Current user object (has .id)
HHP_Auth.currentRole  // 'owner', 'staff', or 'client'

// Getting client's profile ID (profiles table, not auth users table):
// profiles.user_id = auth user id
// profiles.id = profile row id (used as FK in service_reports.client_id)
```

### Cloudinary Upload
```javascript
// Existing pattern from cloudinary-client.js:
HHP_Photos.CLOUD_NAME  // 'dg1p1zjgv'
HHP_Photos.UPLOAD_PRESET  // 'hhp_unsigned'
HHP_Photos.FOLDER  // 'housley-happy-paws'

// For the report media widget, create a NEW widget instance that supports video:
cloudinary.createUploadWidget({
  cloudName: 'dg1p1zjgv',
  uploadPreset: 'hhp_unsigned',
  folder: 'housley-happy-paws/reports',
  sources: ['local', 'camera'],
  multiple: true,  // Allow multiple uploads
  resourceType: 'auto',  // Support both images AND videos
  maxFileSize: 50000000,  // 50MB for videos
  clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov'],
  // ... same theme/palette as existing widget
}, callback);
```

### Toast Messages
```javascript
toast('Message here');  // Shows a toast notification
```

### Fetching Clients (existing pattern from gallery.js line 551):
```javascript
HHP_Auth.supabase.from('profiles').select('id, full_name, email').eq('role', 'client')
```

---

## FILE STRUCTURE
```
housley-happy-paws/
├── index.html              # Main SPA (~3000+ lines)
├── js/
│   ├── auth-client.js      # Auth flow, roles, session management
│   ├── booking-system.js   # Booking modal, pricing, requests
│   ├── cloudinary-client.js # Photo upload via Cloudinary widget
│   ├── site-content-client.js # Edit Website persistence
│   ├── profiles.js         # Profile management
│   ├── gallery.js          # Photo gallery
│   ├── enhancements.js     # UI enhancements, pet name saving
│   └── avatar-system.js    # Avatar upload/display
├── api/
│   └── site-content.js     # Vercel serverless API for site content
├── css/                    # (most CSS is inline in index.html)
├── ux-patch.js             # Additional UI patches
└── .env.example            # Environment variables template
```

---

## SUMMARY OF REMAINING WORK (in priority order)

### 1. FINISH SERVICE REPORTS FEATURE (current task)
- Write all JavaScript functions: `toggleReportDistance()`, `openReportMediaUpload()`, `submitServiceReport()`, auto-date init, populate client dropdown
- Build client portal reports feed (replace placeholder in `#c-reports`)
- Wire up report detail modal (`#reportModal`) to show real report data
- Add email notification on report submission
- Optionally update staff report form (`#s-reports`) with same improvements

### 2. Any additional items Domenic brings up after reports are done

---

## DECISIONS ALREADY MADE (don't ask again)
- Media storage: **Cloudinary** (same as existing image uploads)
- Client reports layout: **Timeline/feed style** (scrollable list, newest first)
- Notifications: **Email notification** when report is submitted
