// ============================================================
// Housley Happy Paws — UX Patch v18 (ux-patch.js)
// Merged: v9 architecture (hamburger=public links, drawer=portal nav)
//       + v7 robust implementations (footer, meet&greet, preview, CSS)
// Changes from v17:
//   - Payments & Bank mobile layout fix
//   - Remove Owner Portal desktop button + left drawer-tab hamburger
//   - Add Home link to mobile hamburger menu
//   - Password show/hide eye toggle on login
//   - Enhanced owner dropdown with Staff/Clients overview
//   - Stripe direct links in Payments section
// Changes from v16:
//   - Stripe payment integration: booking confirm → checkout, Pay Now on service cards
// Changes from v15:
//   - Mobile fixes for Availability, AI Studio, Edit Website, Photos & Media
// Changes from v14:
//   - Removed Quick Save floating button (CSS hide + DOM removal + MutationObserver)
// Changes from v13:
//   - Right hamburger now opens portal drawer (not public nav) when logged in
//   - Drawer closes and hamburger resets when overlay clicked
// Changes from v12:
//   - Fixed drawer tab visible CSS rule (was missing, drawer stayed hidden)
//   - Fixed scroll-to-top: removed global scroll-behavior:smooth
// Changes from v11:
//   - Fixed Sign In button not working on mobile (using HHP_Auth.showLoginScreen)
//   - Fixed drawer tab visibility with CSS class system
//   - Rearranged mobile header layout (sign-in btn, logo centered, hamburger)
// Previous changes from v9:
//   - Both hamburger & drawer use 3-line (☰) icon
//   - All text in both menus is BLACK
//   - Restored v7 footer email (Cloudflare __cf_email__ handling)
//   - Restored v7 Meet & Greet (Supabase booking query)
//   - Restored v7 preview tool (iframe-based)
//   - Restored v7 comprehensive mobile CSS
//   - Restored v7 view switcher (targets viewDropdown select)
//   - Restored v7 about photo (inline styles)
//   - Restored v7 sidebar helpers for legacy compatibility
// ============================================================
(function() {
  'use strict';

  // Prevent duplicate execution if script loads multiple times
  if (window.__uxPatchApplied) return;
  window.__uxPatchApplied = true;

  var scrollPos = 0;
  var HAMBURGER_LINES = '<span class="hhp-hline"></span><span class="hhp-hline"></span><span class="hhp-hline"></span>';
  var CLOSE_X = '\u2715';

  function onReady(fn) {
    if (document.readyState !== 'loading') setTimeout(fn, 800);
    else document.addEventListener('DOMContentLoaded', function() { setTimeout(fn, 800); });
  }

  // ─────────────────────────────────────────────
  // FIX VIEWPORT
  // ─────────────────────────────────────────────
  function fixViewport() {
    var viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    } else {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
      document.head.appendChild(viewport);
    }

    var html = document.documentElement;
    html.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';
  }

  // ─────────────────────────────────────────────
  // FIX GREETINGS — replace with time-of-day OR pet birthday greeting
  // ─────────────────────────────────────────────
  // Cache birthday pets so we don't re-query every 60 s
  var _birthdayPetsCache = null;
  var _birthdayCacheDate = null;

  async function _checkBirthdayPets() {
    var today = new Date();
    var cacheKey = today.toISOString().split('T')[0];
    if (_birthdayCacheDate === cacheKey && _birthdayPetsCache !== null) return _birthdayPetsCache;

    var sb = window.HHP_Auth && window.HHP_Auth.supabase;
    var user = window.HHP_Auth && window.HHP_Auth.currentUser;
    if (!sb || !user) return [];

    try {
      var mm = String(today.getMonth() + 1).padStart(2, '0');
      var dd = String(today.getDate()).padStart(2, '0');
      var suffix = '-' + mm + '-' + dd;

      // For clients: only their own pets. For owner/staff: all pets with birthdays today
      var role = (window.HHP_Auth && window.HHP_Auth.currentRole) || 'client';
      var query = sb.from('pets').select('name, species, owner_id').ilike('birthday', '%' + suffix);
      if (role === 'client') query = query.eq('owner_id', user.id);

      var { data: pets, error } = await query;
      if (error || !pets) { _birthdayPetsCache = []; } else { _birthdayPetsCache = pets; }
      _birthdayCacheDate = cacheKey;
    } catch (e) {
      _birthdayPetsCache = [];
      _birthdayCacheDate = cacheKey;
    }
    return _birthdayPetsCache;
  }

  function _buildBirthdayGreeting(pets, personName) {
    if (!pets || pets.length === 0) return null;
    var names = pets.map(function(p) { return p.name || 'your pet'; });
    var petList;
    if (names.length === 1) {
      petList = names[0];
    } else if (names.length === 2) {
      petList = names[0] + ' & ' + names[1];
    } else {
      petList = names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
    }
    var cakeIcon = '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f382.png" alt="cake" style="width:32px;height:32px;vertical-align:middle;margin-left:8px;display:inline-block;">';
    return { text: 'Happy Birthday, ' + petList + '!', icon: cakeIcon };
  }

  async function fixGreetings() {
    // Set a flag so ux-upgrades.js initGreetings() defers to us
    window._hhpGreetingHandled = true;

    var hour = new Date().getHours();
    var greeting, iconHTML;

    if (hour >= 5 && hour < 12) {
      greeting = 'Good morning';
      iconHTML = '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f305.png" alt="sunrise" style="width:32px;height:32px;vertical-align:middle;margin-left:8px;display:inline-block;">';
    } else if (hour >= 12 && hour < 17) {
      greeting = 'Good afternoon';
      iconHTML = '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2600.png" alt="sun" style="width:32px;height:32px;vertical-align:middle;margin-left:8px;display:inline-block;">';
    } else {
      greeting = 'Good evening';
      iconHTML = '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f319.png" alt="moon" style="width:32px;height:32px;vertical-align:middle;margin-left:8px;display:inline-block;">';
    }

    // Check for pet birthdays today
    var bdayPets = await _checkBirthdayPets();

    // Fix owner portal greeting
    var ownerGreet = document.querySelector('#o-overview .ob-h');
    if (ownerGreet) {
      var text = ownerGreet.textContent;
      if (text.includes('Good morning') || text.includes('Good afternoon') || text.includes('Good evening') || text.includes('Happy Birthday')) {
        var nameMatch = text.match(/,\s*([A-Za-z]+)(?:\s|!|$)/);
        var name = nameMatch ? nameMatch[1] : 'Rachel';
        // Owner sees birthday pets across all clients
        var ownerBday = _buildBirthdayGreeting(bdayPets, name);
        if (ownerBday) {
          ownerGreet.innerHTML = ownerBday.text + ' ' + ownerBday.icon;
        } else {
          ownerGreet.innerHTML = greeting + ', ' + name + ' ' + iconHTML;
        }
      }
    }

    // Fix client portal greeting
    var clientPortal = document.getElementById('pg-client');
    if (clientPortal) {
      clientPortal.querySelectorAll('h1, h2, .p-title').forEach(function(el) {
        var t = el.textContent;
        if (t.includes('Good morning') || t.includes('Good afternoon') || t.includes('Good evening') || t.includes('Happy Birthday') || t.includes('Welcome to your Client Portal')) {
          var nm = t.match(/,\s*([A-Za-z]+)/);
          var n = nm ? nm[1] : 'there';
          // Client sees only their own pets' birthdays
          var clientBday = _buildBirthdayGreeting(bdayPets, n);
          if (clientBday) {
            el.innerHTML = clientBday.text + ' ' + clientBday.icon;
          } else {
            el.innerHTML = greeting + ', ' + n + '! ' + iconHTML;
          }
        }
      });
    }

    // Fix staff portal greeting
    var staffPortal = document.getElementById('pg-staff');
    if (staffPortal) {
      staffPortal.querySelectorAll('h1, h2, .p-title, .ob-h, .hhp-staff-greet div').forEach(function(el) {
        var t = el.textContent;
        if (t.includes('Good morning') || t.includes('Good afternoon') || t.includes('Good evening') || t.includes('Happy Birthday')) {
          var nm = t.match(/,\s*([A-Za-z]+)/);
          var n = nm ? nm[1] : 'there';
          var staffBday = _buildBirthdayGreeting(bdayPets, n);
          if (staffBday) {
            el.innerHTML = staffBday.text + ' ' + staffBday.icon;
          } else {
            el.innerHTML = greeting + ', ' + n + '! ' + iconHTML;
          }
        }
      });
    }

    setTimeout(fixGreetings, 60000);
  }

  // ─────────────────────────────────────────────
  // INJECT ALL CSS — Comprehensive (restored from v7 + v9 drawer)
  // ─────────────────────────────────────────────
  function injectAllCSS() {
    var css = document.createElement('style');
    css.id = 'hhp-ux-patch-css';
    css.textContent =

      /* ===== GLOBAL: Prevent horizontal overflow / bounce on mobile ===== */
      'html, body {' +
        'overflow-x: hidden !important;' +
        'max-width: 100vw !important;' +
        '-webkit-overflow-scrolling: touch !important;' +
      '}' +
      'html { scroll-behavior: auto !important; }' +
      '*, *::before, *::after { max-width: 100vw; }' +
      '.nav, .hero, section, footer, .portal-wrap, .portal-main,' +
      '#pg-public, #pg-client, #pg-staff, #pg-owner {' +
        'overflow-x: hidden !important;' +
        'max-width: 100% !important;' +
      '}' +

      /* ===== HIDE Quick Save floating button (each page has its own save) ===== */
      '#qs-float, [id^="qs-float"], button[style*="Quick Save"],' +
      'button[style*="z-index: 9000"][style*="position: fixed"] {' +
        'display: none !important; visibility: hidden !important;' +
      '}' +

      /* ===== NAVBAR: hide gold Book Meet & Greet everywhere ===== */
      '.nbtn-gold[onclick*="mgModal"] { display: none !important; }' +

      /* ===== DESKTOP (>1024px): View Switcher — ensure visible ===== */
      '@media (min-width: 1025px) {' +
        '#viewSwitcher {' +
          'display: inline-flex !important; visibility: visible !important;' +
          'opacity: 1 !important; position: relative !important;' +
        '}' +
        '#viewDropdown {' +
          'display: block !important; visibility: visible !important;' +
          'background: #fdfaf5 !important; border: 1.5px solid #c8963e !important;' +
          'border-radius: 8px !important; padding: 8px 38px 8px 14px !important;' +
          'font-family: Jost, sans-serif !important; font-size: 0.82rem !important;' +
          'font-weight: 600 !important; color: #1e1409 !important;' +
          'cursor: pointer !important; min-width: 120px !important;' +
        '}' +
      '}' +

      /* ===== DESKTOP: Hero + About tweaks ===== */
      '.hero { grid-template-columns: 1.2fr 0.8fr !important; }' +
      '.hero .hero-photo-col { max-width: 500px !important; justify-self: center !important; }' +
      '.hero h1 { font-size: 4.5rem !important; line-height: 1.05 !important; }' +
      '.hero .hero-sub, .hero p:not(.trust-row):not(.section-eyebrow) { font-size: 1.15rem !important; line-height: 1.6 !important; }' +
      '.hero .btn-ink { padding: 18px 42px !important; font-size: 1.1rem !important; border-radius: 14px !important; }' +
      '.hero .btn-outline { padding: 16px 36px !important; font-size: 1.05rem !important; border-radius: 14px !important; }' +

      /* Meet Rachel CTA — wide rectangle */
      '.hero .hero-photo-sm-cta {' +
        'width: auto !important; min-width: 180px !important; height: auto !important;' +
        'max-height: 48px !important; background: #faf6f1 !important;' +
        'border: 1.5px solid rgba(30,20,9,0.12) !important; border-radius: 14px !important;' +
        'padding: 12px 32px !important; flex-direction: row !important;' +
        'align-items: center !important; justify-content: center !important;' +
        'gap: 8px !important; box-shadow: 0 1px 4px rgba(30,20,9,0.06) !important;' +
        'cursor: pointer !important; aspect-ratio: auto !important;' +
      '}' +
      '.hero .hero-photo-sm-cta .paw-icon, .hero .hero-photo-sm-cta svg, .hero .hero-photo-sm-cta img {' +
        'width: 18px !important; height: 18px !important; flex-shrink: 0 !important;' +
      '}' +
      '.hero .hero-photo-sm-cta div, .hero .hero-photo-sm-cta span {' +
        'font-size: 0.85rem !important; font-weight: 600 !important; color: #1e1409 !important;' +
        'white-space: nowrap !important; line-height: 1 !important;' +
      '}' +
      '.hero .hero-photo-row { justify-content: center !important; margin-top: 10px !important; }' +
      '.about-grid { grid-template-columns: 1fr 1fr !important; }' +
      '.about-photos { min-height: 440px !important; border-radius: 18px !important; }' +
      '.about-photos img { object-fit: cover !important; width: 100% !important; height: 100% !important; }' +

      /* ===== TABLET (768–1024px) ===== */
      '@media (min-width: 768px) and (max-width: 1024px) {' +
        '.hero { grid-template-columns: 1fr 1fr !important; }' +
        '.hero h1 { font-size: 3rem !important; }' +
        '.about-photos { min-height: 360px !important; }' +
        '#pg-owner .sidebar, #pg-client .sidebar, #pg-staff .sidebar {' +
          'flex-direction: row !important; flex-wrap: wrap !important;' +
          'gap: 4px !important; padding: 10px 12px !important;' +
        '}' +
        '.hhp-portal-hamburger { display: none !important; }' +
        '.services-grid { grid-template-columns: repeat(2, 1fr) !important; }' +
        '.future-grid { grid-template-columns: repeat(2, 1fr) !important; }' +
      '}' +

      /* ===== PHONE (max 767px) — COMPREHENSIVE (restored from v7) ===== */
      '@media (max-width: 767px) {' +

        /* -- Nav: hide desktop elements -- */
        '.nav { padding: 0 12px !important; height: 56px !important; display: flex !important; align-items: center !important; justify-content: space-between !important; position: relative !important; }' +
        '.nav-logo { font-size: 1.35rem !important; position: absolute !important; left: 50% !important; transform: translateX(-50%) !important; text-align: center !important; pointer-events: auto !important; white-space: nowrap !important; }' +
        '.nav-center { display: none !important; }' +
        '.nav-right { display: none !important; }' +
        '#viewSwitcher { display: none !important; }' +

        /* -- OLD hamburger (public nav) — HIDDEN, replaced by drawer-tab -- */
        '.hhp-hamburger-v10 { display: none !important; }' +
        /* -- Old mobile nav overlay — HIDDEN (replaced by drawer) -- */
        '.hhp-mobile-nav-v10 { display: none !important; }' +
        '.hhp-mobile-nav-v10.hhp-mnav-open { display: none !important; }' +

        /* -- Mobile sign-in button in nav (plain text, no box) -- */
        '.hhp-mobile-signin-btn {' +
          'display: block !important; order: 0 !important; margin: 0 !important;' +
          'padding: 6px 8px !important; border: none !important;' +
          'background: transparent !important; color: #1e1409 !important;' +
          'font-weight: 600 !important; font-size: 0.78rem !important;' +
          'border-radius: 0 !important; cursor: pointer !important;' +
          'white-space: nowrap !important; line-height: 1 !important;' +
          'z-index: 9998 !important; -webkit-tap-highlight-color: transparent !important;' +
          '-webkit-text-fill-color: #1e1409 !important; flex-shrink: 0 !important;' +
        '}' +

        /* -- Hero (restored from v7) -- */
        '.hero { grid-template-columns: 1fr !important; padding: 76px 16px 36px !important; min-height: auto !important; gap: 20px !important; }' +
        '.hero h1 { font-size: 2rem !important; line-height: 1.1 !important; margin-bottom: 12px !important; }' +
        '.hero .hero-p, .hero p:not(.trust-row):not(.section-eyebrow) { font-size: 0.9rem !important; line-height: 1.55 !important; margin-bottom: 20px !important; }' +
        '.hero-tag { font-size: 0.68rem !important; padding: 5px 12px !important; }' +
        '.hero-photo-col { max-width: 100% !important; }' +
        '.hero-actions { flex-direction: column !important; gap: 10px !important; }' +
        '.hero-actions .btn { width: 100% !important; justify-content: center !important; padding: 14px 20px !important; }' +
        '.hero .btn-ink { padding: 14px 24px !important; font-size: 0.95rem !important; width: 100% !important; justify-content: center !important; }' +
        '.hero .btn-outline { padding: 12px 20px !important; font-size: 0.92rem !important; width: 100% !important; justify-content: center !important; }' +
        '.hero-trust { flex-direction: column !important; gap: 8px !important; }' +
        '.trust-chip { font-size: 0.78rem !important; }' +
        '.hero .hero-photo-sm-cta { min-width: 140px !important; padding: 10px 24px !important; }' +

        /* -- About (restored from v7) -- */
        '.about-section { padding: 48px 16px !important; }' +
        '.about-grid { grid-template-columns: 1fr !important; gap: 24px !important; }' +
        '.about-photos { min-height: 280px !important; max-width: 100% !important; width: 100% !important; border-radius: 16px !important; }' +
        '.section-h { font-size: 1.75rem !important; }' +
        '.section-p { font-size: 0.88rem !important; }' +

        /* -- Services (restored from v7) -- */
        '.services-section { padding: 48px 16px !important; }' +
        '.services-grid { grid-template-columns: 1fr !important; gap: 14px !important; }' +
        '.service-card { padding: 20px !important; }' +
        '.sc-name { font-size: 1.1rem !important; }' +
        '.sc-price { font-size: 1.15rem !important; }' +

        /* -- Calendar (restored from v7) -- */
        '.cal-section { padding: 48px 16px !important; }' +
        '.cal-wrap { margin-top: 20px !important; }' +
        '.cal-grid .cal-day { min-height: 48px !important; padding: 4px !important; }' +
        '.cal-day-num { font-size: 0.7rem !important; }' +
        '.cal-event-dot { font-size: 0.55rem !important; }' +
        '.cal-dow { font-size: 0.62rem !important; padding: 4px 0 !important; }' +

        /* -- Reviews: one card at a time (restored from v7) -- */
        '.reviews-section { padding: 48px 16px !important; overflow: hidden !important; }' +
        '.reviews-track {' +
          'display: flex !important; grid-template-columns: none !important;' +
          'overflow-x: auto !important; scroll-snap-type: x mandatory !important;' +
          'gap: 0px !important; -webkit-overflow-scrolling: touch !important;' +
          'scroll-behavior: auto !important; padding: 0 !important;' +
        '}' +
        '.reviews-track .review-card {' +
          'flex: 0 0 100% !important; width: 100% !important; min-width: 100% !important;' +
          'scroll-snap-align: start !important; padding: 24px !important;' +
          'box-sizing: border-box !important; margin: 0 !important;' +
        '}' +

        /* -- Coming Soon / Future (restored from v7) -- */
        '.future-section { padding: 40px 16px !important; }' +
        '.future-grid { grid-template-columns: 1fr !important; gap: 14px !important; }' +

        /* -- Footer (restored from v7) -- */
        'footer { padding: 36px 16px 20px !important; }' +
        '.footer-grid { grid-template-columns: 1fr !important; gap: 20px !important; }' +
        '.footer-bottom { flex-direction: column !important; gap: 8px !important; text-align: center !important; }' +

        /* -- Portal sidebar: hidden on mobile (restored from v7) -- */
        '#pg-owner .portal-wrap > .sidebar,' +
        '#pg-client .portal-wrap > .sidebar,' +
        '#pg-staff .portal-wrap > .sidebar,' +
        '#pg-owner .sidebar, #pg-client .sidebar, #pg-staff .sidebar,' +
        '.portal-wrap > .sidebar, div.sidebar {' +
          'display: none !important; visibility: hidden !important;' +
          'width: 0 !important; min-width: 0 !important; height: 0 !important;' +
          'overflow: hidden !important; position: absolute !important;' +
          'left: -9999px !important; pointer-events: none !important;' +
        '}' +

        /* -- Portal main: full width (restored from v7) -- */
        '.portal-wrap { display: block !important; }' +
        '.portal-wrap > .portal-main, .portal-main {' +
          'width: 100% !important; max-width: 100% !important;' +
          'padding: 12px !important; margin-left: 0 !important;' +
        '}' +

        /* -- Portal cards & stats (restored from v7) -- */
        '.stats-row { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }' +
        '.stat-box { padding: 12px !important; }' +
        '.stat-num { font-size: 1.4rem !important; }' +
        '.stat-lbl { font-size: 0.68rem !important; }' +
        '.card { padding: 14px !important; margin-bottom: 12px !important; }' +
        '.form-row { grid-template-columns: 1fr !important; }' +
        '.report-stats { grid-template-columns: repeat(2, 1fr) !important; }' +
        '.report-photos { grid-template-columns: repeat(2, 1fr) !important; }' +

        /* -- Owner banner (restored from v7) -- */
        '.owner-banner { padding: 18px !important; border-radius: 12px !important; }' +
        '.ob-top { flex-direction: column !important; gap: 10px !important; }' +
        '.ob-h { font-size: 1.3rem !important; }' +
        '.ob-stats { flex-wrap: wrap !important; gap: 12px !important; }' +

        /* -- Tabs (restored from v7) -- */
        '.tabs { flex-wrap: wrap !important; gap: 2px !important; }' +
        '.tab { padding: 6px 10px !important; font-size: 0.74rem !important; }' +

        /* -- Appointments (restored from v7) -- */
        '.appt-row { flex-direction: column !important; align-items: flex-start !important; gap: 6px !important; }' +
        '.appt-meta { text-align: left !important; }' +
        '.job-card { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }' +

        /* -- Availability (restored from v7) -- */
        '.avail-grid { grid-template-columns: repeat(7, 1fr) !important; gap: 3px !important; }' +
        '.avail-day { padding: 6px 2px !important; font-size: 0.65rem !important; }' +

        /* -- Messages (restored from v7) -- */
        '.msg-in, .msg-out { max-width: 88% !important; }' +
        '.msg-input-row { gap: 6px !important; }' +

        /* -- Modals (restored from v7) -- */
        '.overlay { padding: 12px !important; }' +
        '.modal { padding: 20px !important; margin: 8px !important; max-height: 92vh !important; }' +
        '.modal-title { font-size: 1.4rem !important; }' +

        /* -- Auth overlay (restored from v7) -- */
        '.auth-card { padding: 28px 20px !important; margin: 12px !important; }' +
        '.auth-logo { font-size: 1.5rem !important; }' +

        /* -- Toast (restored from v7) -- */
        '.toast { bottom: 16px !important; right: 16px !important; left: 16px !important; max-width: none !important; }' +

        /* -- Floating book button (restored from v7) -- */
        '#floatingBookBtn { bottom: 16px !important; right: 16px !important; }' +

        /* -- Payment steps (restored from v7) -- */
        '.pay-step { padding: 10px !important; }' +
        '.pay-step-num { font-size: 1.2rem !important; }' +

        /* -- Client list (restored from v7) -- */
        '.client-row { padding: 10px 0 !important; }' +
        '.cl-ava { width: 36px !important; height: 36px !important; font-size: 0.78rem !important; }' +

        /* -- Portal form inputs -- */
        '.form-group input, .form-group textarea { font-size: 16px !important; }' +

        /* -- Availability section (mobile fix) -- */
        '#o-avail .card > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; gap: 12px !important; }' +
        '#o-avail .form-row { grid-template-columns: 1fr !important; }' +

        /* -- AI Studio section (mobile fix) -- */
        '#o-studio > div > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; gap: 12px !important; }' +
        '#o-studio .card { max-width: 100% !important; overflow-x: hidden !important; }' +
        '#aiChatLog { max-height: 50vh !important; }' +
        '#aiQuickBtns { flex-wrap: wrap !important; gap: 6px !important; }' +

        /* -- Edit Website section (mobile fix) -- */
        '#o-content > div > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; gap: 12px !important; }' +
        '#contentSections { flex-direction: column !important; gap: 4px !important; }' +
        '#contentSections > div { width: 100% !important; }' +
        '.content-edit-panel { padding: 12px !important; }' +
        '.content-edit-panel .form-group textarea { min-height: 80px !important; }' +
        '#contentEditArea { max-width: 100% !important; overflow-x: hidden !important; }' +
        '#pricingEditorRows, #serviceDescRows { flex-direction: column !important; gap: 8px !important; }' +
        '#pricingEditorRows > div, #serviceDescRows > div { width: 100% !important; }' +

        /* -- Photos & Media section (mobile fix) -- */
        '#o-photos > div > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; gap: 12px !important; }' +
        '#o-photos div[style*="grid-template-columns: 1fr 1fr 1fr"],' +
        '#o-photos div[style*="grid-template-columns:1fr 1fr 1fr"],' +
        '#o-photos div[style*="grid-template-columns: repeat(3"],' +
        '#o-photos div[style*="grid-template-columns:repeat(3"] {' +
          'grid-template-columns: 1fr 1fr !important; gap: 8px !important;' +
        '}' +
        '.photo-upload-slot { width: 100% !important; max-width: 100% !important; }' +
        '#heroPhotoPreview { max-width: 100% !important; }' +
        '#heroPhotoPreview img { max-width: 100% !important; height: auto !important; }' +
        '/* -- Payments & Bank mobile -- */' +
        '#o-payments > div[style*="grid-template-columns: 1fr 1fr"], #o-payments > div[style*="grid-template-columns:1fr 1fr"] { grid-template-columns: 1fr !important; gap: 14px !important; }' +
        '#o-payments .card { max-width: 100% !important; overflow-x: hidden !important; }' +
        '#o-payments div[style*="grid-template-columns: repeat(4"], #o-payments div[style*="grid-template-columns:repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }' +
        '.pay-step-lbl { font-size: 0.68rem !important; }' +
        /* -- Drawer tab (hamburger in navbar, top-right) -- */
        '.hhp-drawer-tab {' +
          'display: none !important; flex-direction: column !important;' +
          'position: static !important;' +
          'order: 2 !important;' +
          'width: 44px !important; height: 44px !important; z-index: 9999 !important;' +
          'background: transparent !important; border: none !important;' +
          'border-radius: 10px !important; cursor: pointer !important;' +
          'align-items: center !important; justify-content: center !important;' +
          'padding: 0 !important; gap: 5px !important;' +
          'flex-shrink: 0 !important;' +
          '-webkit-tap-highlight-color: transparent !important; touch-action: manipulation !important;' +
          'box-shadow: none !important;' +
        '}' +
        '.hhp-drawer-tab.hhp-drawer-tab-visible {' +
          'display: flex !important;' +
        '}' +
        '.hhp-drawer-tab .hhp-dline {' +
          'display: block !important; width: 26px !important; height: 3px !important;' +
          'background: #1a1008 !important; border-radius: 2px !important;' +
        '}' +

        /* -- Pull-out drawer panel -- */
        '.hhp-drawer {' +
          'display: none !important; position: fixed !important; left: 0 !important;' +
          'top: 56px !important; width: 75vw !important; height: calc(100vh - 56px) !important;' +
          'z-index: 9995 !important; background: #fefcf8 !important;' +
          'box-shadow: 2px 0 8px rgba(0,0,0,0.1) !important;' +
          'overflow-y: auto !important; -webkit-overflow-scrolling: touch !important;' +
          'padding-bottom: 140px !important;' +
        '}' +
        '.hhp-drawer.hhp-drawer-open {' +
          'display: block !important;' +
        '}' +

        /* -- Drawer overlay -- */
        '.hhp-drawer-overlay {' +
          'display: none !important; position: fixed !important; top: 0 !important;' +
          'left: 0 !important; width: 100vw !important; height: 100vh !important;' +
          'z-index: 9994 !important; background: rgba(0,0,0,0.3) !important;' +
        '}' +
        '.hhp-drawer-overlay.hhp-drawer-open {' +
          'display: block !important;' +
        '}' +

        /* -- Drawer header -- */
        '.hhp-drawer-header {' +
          'display: flex !important; align-items: center !important;' +
          'justify-content: space-between !important; padding: 16px 20px !important;' +
          'border-bottom: 2px solid #e0d5c5 !important; background: #fefcf8 !important;' +
        '}' +
        '.hhp-drawer-title {' +
          'font-size: 1.1rem !important; font-weight: 700 !important;' +
          'color: #000000 !important; -webkit-text-fill-color: #000000 !important;' +
        '}' +
        '.hhp-drawer-close {' +
          'background: transparent !important; border: none !important;' +
          'font-size: 22px !important; color: #000000 !important; cursor: pointer !important;' +
          'padding: 4px 8px !important; -webkit-text-fill-color: #000000 !important;' +
        '}' +

        /* -- Drawer items -- */
        '.hhp-drawer-item {' +
          'display: block !important; width: 100% !important; padding: 16px 20px !important;' +
          'border-bottom: 1px solid #e0d5c5 !important; color: #000000 !important;' +
          'font-weight: 600 !important; font-size: 1.05rem !important;' +
          'text-decoration: none !important; cursor: pointer !important;' +
          'background: transparent !important; border-left: none !important;' +
          'border-right: none !important; border-top: none !important;' +
          'text-align: left !important; -webkit-text-fill-color: #000000 !important;' +
        '}' +
        '.hhp-drawer-item:hover {' +
          'background: rgba(200,150,62,0.08) !important;' +
        '}' +

      '}' +

      /* ===== SMALL PHONE (max 400px) — restored from v7 ===== */
      '@media (max-width: 400px) {' +
        '.hero { padding: 68px 12px 28px !important; }' +
        '.hero h1 { font-size: 1.7rem !important; }' +
        '.section-h { font-size: 1.45rem !important; }' +
        '.service-card { padding: 16px !important; }' +
        '.sc-name { font-size: 1rem !important; }' +
        '.review-card { padding: 16px 18px !important; }' +
        '.cal-grid .cal-day { min-height: 40px !important; }' +
        '.stat-box { padding: 8px !important; }' +
        '.stat-num { font-size: 1.2rem !important; }' +
        '.stats-row { grid-template-columns: 1fr 1fr !important; }' +
        '.ob-h { font-size: 1.1rem !important; }' +
      '}' +

      /* ===== HIDE OLD elements ===== */
      '.hhp-hamburger:not(.hhp-hamburger-v10) { display: none !important; }' +
      '.hhp-mobile-nav:not(.hhp-mobile-nav-v10) { display: none !important; }' +
      '.hhp-portal-hamburger { display: none !important; }' +

      /* ===== DESKTOP (>1024px): hide mobile-only elements ===== */
      '@media (min-width: 1025px) {' +
        '.hhp-drawer-tab { display: none !important; }' +
        '.hhp-drawer { display: none !important; }' +
        '.hhp-drawer-overlay { display: none !important; }' +
        '.hhp-hamburger-v10 { display: none !important; }' +
        '.hhp-mobile-nav-v10 { display: none !important; }' +
        '.hhp-mobile-signin-btn { display: none !important; }' +
      '}' +

      /* ===== TABLET/iPad (768–1024px): use hamburger nav ===== */
      '@media (min-width: 768px) and (max-width: 1024px) {' +
        '.nav-center { display: none !important; }' +
        '.nav-right { display: none !important; }' +
        '#viewSwitcher { display: none !important; }' +
        '.hhp-hamburger-v10 {' +
          'display: flex !important; flex-direction: column !important; order: 99 !important; margin-left: auto !important;' +
          'background: transparent !important; border: none !important;' +
          'width: 44px !important; height: 44px !important; border-radius: 10px !important;' +
          'align-items: center !important; justify-content: center !important;' +
          'cursor: pointer !important; padding: 0 !important; z-index: 9999 !important;' +
          'gap: 5px !important;' +
        '}' +
        '.hhp-hamburger-v10 .hhp-hline {' +
          'display: block !important; width: 26px !important; height: 3px !important;' +
          'background: #1a1008 !important; border-radius: 2px !important;' +
        '}' +
        '.hhp-mobile-nav-v10 { display: none !important; }' +
        '.hhp-mobile-nav-v10.hhp-mnav-open {' +
          'display: flex !important; flex-direction: column !important;' +
          'position: fixed !important; top: 0 !important; left: 0 !important;' +
          'width: 100vw !important; height: 100vh !important;' +
          'z-index: 9997 !important; background: #fdfaf5 !important;' +
          'padding: 70px 20px 20px !important; overflow-y: auto !important;' +
        '}' +
        '.hhp-mnav-link {' +
          'display: block; padding: 14px 0; font-size: 1.1rem; font-weight: 600;' +
          'color: #000000 !important; text-decoration: none; border-bottom: 1px solid #e8ddd0;' +
          'cursor: pointer; -webkit-text-fill-color: #000000 !important;' +
        '}' +
        '.hhp-mnav-signin {' +
          'display: inline-block; margin-top: 16px; padding: 12px 28px;' +
          'background: transparent; border: none; border-radius: 0;' +
          'color: #1e1409 !important; font-weight: 600; font-size: 0.95rem; cursor: pointer;' +
          '-webkit-text-fill-color: #1e1409 !important;' +
        '}' +
        '.hhp-mobile-signin-btn {' +
          'display: block !important; order: 0 !important; margin: 0 !important;' +
          'padding: 6px 8px !important; border: none !important;' +
          'background: transparent !important; color: #1e1409 !important;' +
          'font-weight: 600 !important; font-size: 0.78rem !important;' +
          'border-radius: 0 !important; cursor: pointer !important;' +
          '-webkit-text-fill-color: #1e1409 !important; flex-shrink: 0 !important;' +
        '}' +
        '.about-grid { grid-template-columns: 1fr !important; gap: 24px !important; }' +
      '}' +

      /* ===== Preview tool styles (restored from v7) ===== */
      '.hhp-preview-bar {' +
        'display: flex; gap: 8px; margin-bottom: 16px; padding: 12px 16px;' +
        'background: #f5f0ea; border-radius: 12px; align-items: center; flex-wrap: wrap;' +
      '}' +
      '.hhp-preview-bar .preview-label { font-weight: 700; font-size: 0.9rem; color: #1e1409; margin-right: 8px; }' +
      '.hhp-preview-btn {' +
        'padding: 8px 16px; border-radius: 8px; border: 1.5px solid rgba(30,20,9,0.12);' +
        'background: white; cursor: pointer; font-size: 0.82rem; font-weight: 600;' +
        'color: #1e1409; transition: all 0.2s;' +
      '}' +
      '.hhp-preview-btn:hover, .hhp-preview-btn.active {' +
        'background: var(--gold, #c8963e); color: white; border-color: var(--gold, #c8963e);' +
      '}' +
      '.hhp-preview-frame-wrap {' +
        'border: 2px solid rgba(30,20,9,0.1); border-radius: 12px; overflow: hidden;' +
        'margin-bottom: 20px; background: white; transition: width 0.3s ease;' +
        'margin-left: auto; margin-right: auto;' +
      '}' +
      '.hhp-preview-frame-wrap iframe { width: 100%; border: none; display: block; }';

    document.head.appendChild(css);
  }

  // ─────────────────────────────────────────────
  // FOOTER EMAIL — restored from v7 (Cloudflare __cf_email__ handling)
  // ─────────────────────────────────────────────
  function fixFooterEmail() {
    var footer = document.querySelector('footer');
    if (!footer) return;
    footer.querySelectorAll('a').forEach(function(a) {
      var text = a.textContent.trim();
      if (text.includes('[email') || text.includes('email protected') || text.includes('email\u00a0protected')) {
        a.href = 'mailto:housleyhappypaws@gmail.com';
        a.textContent = '';
        a.innerHTML = '\uD83D\uDCE7 housleyhappypaws@gmail.com';
        a.removeAttribute('data-cfemail');
        a.classList.remove('__cf_email__');
      }
    });
    footer.querySelectorAll('.__cf_email__, [data-cfemail]').forEach(function(el) {
      el.textContent = 'housleyhappypaws@gmail.com';
      el.removeAttribute('data-cfemail');
    });
  }

  // ─────────────────────────────────────────────
  // MOBILE SIDEBAR — force-hide on mobile (restored from v7)
  // ─────────────────────────────────────────────
  function fixMobileSidebar() {
    var isMobile = window.innerWidth <= 1024;
    if (!isMobile) return;

    // Force-hide all sidebars via inline style
    document.querySelectorAll('.sidebar').forEach(function(sidebar) {
      sidebar.style.setProperty('display', 'none', 'important');
      sidebar.style.setProperty('visibility', 'hidden', 'important');
      sidebar.style.setProperty('width', '0', 'important');
      sidebar.style.setProperty('height', '0', 'important');
      sidebar.style.setProperty('overflow', 'hidden', 'important');
      sidebar.style.setProperty('position', 'absolute', 'important');
    });

    // Hide portal hamburger from old versions
    var portalHamburger = document.querySelector('.hhp-portal-hamburger');
    if (portalHamburger) {
      portalHamburger.style.setProperty('display', 'none', 'important');
    }

    // Force-hide nav-right on mobile
    var navRight = document.querySelector('.nav-right');
    if (navRight) {
      navRight.style.setProperty('display', 'none', 'important');
    }
  }

  // ─────────────────────────────────────────────
  // CLEANUP OLD MOBILE NAV (v10 hamburger+overlay removed — drawer-tab is the only system now)
  // ─────────────────────────────────────────────
  function createMobileNav() {
    // Remove any leftover v10 hamburger or overlay elements from the DOM
    document.querySelectorAll('.hhp-hamburger-v10, .hhp-mobile-nav-v10').forEach(function(el) {
      el.remove();
    });
  }

  // ─────────────────────────────────────────────
  // ADD MOBILE SIGN IN BUTTON
  // ─────────────────────────────────────────────
  function addMobileSignIn() {
    var nav = document.getElementById('mainNav');
    if (!nav) return;

    if (!document.querySelector('.hhp-mobile-signin-btn')) {
      var signInBtn = document.createElement('button');
      signInBtn.className = 'hhp-mobile-signin-btn';
      signInBtn.textContent = 'Sign In';
      signInBtn.setAttribute('type', 'button');
      signInBtn.style.color = '#000';
      signInBtn.style.setProperty('-webkit-text-fill-color', '#000', 'important');
      nav.insertBefore(signInBtn, nav.firstChild);

      signInBtn.addEventListener('click', function() {
        if (typeof HHP_Auth !== 'undefined' && HHP_Auth.isAuthenticated && HHP_Auth.isAuthenticated()) {
          if (HHP_Auth.logout) HHP_Auth.logout();
        } else {
          if (typeof HHP_Auth !== 'undefined' && HHP_Auth.showLoginScreen) {
          HHP_Auth.showLoginScreen();
        } else {
          var overlay = document.getElementById('authOverlay');
          if (overlay) overlay.style.display = 'flex';
        }
        }
      });
    }

    updateMobileSignInBtn();
  }

  function updateMobileSignInBtn() {
    var btn = document.querySelector('.hhp-mobile-signin-btn');
    if (btn && typeof HHP_Auth !== 'undefined') {
      if (HHP_Auth.isAuthenticated && HHP_Auth.isAuthenticated()) {
        btn.textContent = 'Sign Out';
      } else {
        btn.textContent = 'Sign In';
      }
    }
    // Also update the sign-in link inside the mobile nav overlay
    var mobileSignIn = document.getElementById('hhp-mnav-signin-link');
    if (mobileSignIn && typeof HHP_Auth !== 'undefined') {
      if (HHP_Auth.isAuthenticated && HHP_Auth.isAuthenticated()) {
        mobileSignIn.textContent = 'Sign Out';
      } else {
        mobileSignIn.textContent = 'Sign In';
      }
    }
    // Show/hide Book Meet & Greet button (owner only)
    var bookBtn = document.getElementById('hhp-mnav-book-btn');
    if (bookBtn && typeof HHP_Auth !== 'undefined') {
      if (HHP_Auth.isAuthenticated && HHP_Auth.isAuthenticated() && HHP_Auth.currentRole === 'owner') {
        bookBtn.style.display = 'block';
      } else {
        bookBtn.style.display = 'none';
      }
    }
  }

  // ─────────────────────────────────────────────
  // CHECK IF USER IS AUTHENTICATED
  // ─────────────────────────────────────────────
  function isUserAuthenticated() {
    if (typeof HHP_Auth === 'undefined') return false;
    if (HHP_Auth.isAuthenticated && HHP_Auth.isAuthenticated()) return true;
    if (HHP_Auth.currentUser) return true;
    return false;
  }

  // ─────────────────────────────────────────────
  // KILL OLD UX-UPGRADES.JS ELEMENTS
  // ─────────────────────────────────────────────
  function killOldMobileNav() {
    // Remove old .hhp-mobile-nav (from ux-upgrades.js) entirely from DOM
    document.querySelectorAll('.hhp-mobile-nav:not(.hhp-mobile-nav-v10)').forEach(function(el) {
      el.remove();
    });
    // Remove old .hhp-hamburger (from ux-upgrades.js) entirely from DOM
    document.querySelectorAll('.hhp-hamburger:not(.hhp-hamburger-v10)').forEach(function(el) {
      el.remove();
    });
    // Remove old portal hamburger
    document.querySelectorAll('.hhp-portal-hamburger').forEach(function(el) {
      el.remove();
    });
  }

  // ─────────────────────────────────────────────
  // CREATE PORTAL DRAWER (Pull-out from Left, 3-line icon)
  // ─────────────────────────────────────────────
  function createPortalDrawer() {
    // Create drawer elements if not exist
    if (!document.querySelector('.hhp-drawer-tab')) {
      var tab = document.createElement('div');
      tab.className = 'hhp-drawer-tab';
      // 3 horizontal lines icon
      tab.innerHTML = '<span class="hhp-dline"></span><span class="hhp-dline"></span><span class="hhp-dline"></span>';
      tab.setAttribute('role', 'button');
      tab.setAttribute('tabindex', '0');
      tab.classList.remove('hhp-drawer-tab-visible');
      // Put drawer tab INSIDE the navbar (not floating on body)
      var nav = document.getElementById('mainNav');
      if (nav) { nav.appendChild(tab); } else { document.body.appendChild(tab); }

      var drawer = document.createElement('div');
      drawer.className = 'hhp-drawer';
      document.body.appendChild(drawer);

      var overlay = document.createElement('div');
      overlay.className = 'hhp-drawer-overlay';
      document.body.appendChild(overlay);

      // Tab click handler
      tab.addEventListener('click', toggleDrawer);
      tab.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleDrawer();
        }
      });

      // Overlay click handler
      overlay.addEventListener('click', closeDrawer);
    }

    updateDrawerContent();
  }

  function toggleDrawer() {
    var drawer = document.querySelector('.hhp-drawer');
    var overlay = document.querySelector('.hhp-drawer-overlay');

    if (drawer.classList.contains('hhp-drawer-open')) {
      closeDrawer();
    } else {
      drawer.classList.add('hhp-drawer-open');
      overlay.classList.add('hhp-drawer-open');
      scrollPos = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = -scrollPos + 'px';
    }
  }

  function closeDrawer() {
    var drawer = document.querySelector('.hhp-drawer');
    var overlay = document.querySelector('.hhp-drawer-overlay');

    drawer.classList.remove('hhp-drawer-open');
    overlay.classList.remove('hhp-drawer-open');
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
    window.scrollTo(0, scrollPos);
    var hamburger = document.querySelector('.hhp-hamburger-v10');
    if (hamburger && hamburger.textContent === CLOSE_X) {
      hamburger.innerHTML = HAMBURGER_LINES;
      hamburger.style.fontSize = '';
      hamburger.style.color = '';
    }
  }

  // Detect which portal is currently active
  function getActivePortal() {
    var portals = ['pg-owner', 'pg-staff', 'pg-client'];
    for (var i = 0; i < portals.length; i++) {
      var el = document.getElementById(portals[i]);
      if (!el) continue;
      // Check computed style — the element might not have inline style
      var computed = window.getComputedStyle(el);
      if (computed.display !== 'none' && el.offsetParent !== null) {
        return portals[i];
      }
    }
    // Fallback: check inline style
    for (var j = 0; j < portals.length; j++) {
      var el2 = document.getElementById(portals[j]);
      if (el2 && el2.style.display !== 'none' && el2.style.display !== '') {
        return portals[j];
      }
    }
    return null;
  }

  function updateDrawerContent() {
    var drawer = document.querySelector('.hhp-drawer');
    if (!drawer) return;

    // Clear drawer
    drawer.innerHTML = '';

    // Always show drawer tab on mobile/tablet
    var tab = document.querySelector('.hhp-drawer-tab');
    if (tab && window.innerWidth <= 1024) tab.classList.add('hhp-drawer-tab-visible');

    var loggedIn = isUserAuthenticated();
    var activePortal = getActivePortal();

    // ── CLOSE BUTTON at the very top of drawer ──
    var closeHeader = document.createElement('div');
    closeHeader.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;padding:12px 16px 4px;';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.innerHTML = '\u2715';
    closeBtn.style.cssText = 'background:transparent;border:none;font-size:22px;color:#000;cursor:pointer;padding:4px 8px;-webkit-text-fill-color:#000;';
    closeBtn.addEventListener('click', closeDrawer);
    closeHeader.appendChild(closeBtn);
    drawer.appendChild(closeHeader);

    // ── PUBLIC NAV LINKS (only shown when NOT logged in) ──
    if (!loggedIn) {
      var navSection = document.createElement('div');
      navSection.className = 'hhp-drawer-nav-section';
      navSection.style.cssText = 'padding: 0 20px 8px; border-bottom: 1px solid #d4c4ad; margin-bottom: 8px;';

      var publicLinks = [
        { text: 'About Rachel', scroll: '.about-section' },
        { text: 'Services & Pricing', scroll: '.services-section' },
        { text: 'Calendar', scroll: '.cal-section' },
        { text: 'Reviews', scroll: '.reviews-section' },
        { text: 'Coming Soon', scroll: '.future-section' },
      ];

      publicLinks.forEach(function(item) {
        var link = document.createElement('button');
        link.className = 'hhp-drawer-item';
        link.textContent = item.text;
        link.type = 'button';
        link.style.cssText = 'color:#000!important;-webkit-text-fill-color:#000!important;display:block;width:100%;text-align:left;background:none;border:none;padding:12px 0;font-size:0.95rem;font-weight:600;cursor:pointer;border-bottom:1px solid #e8ddd0;';
        link.addEventListener('click', function() {
          if (typeof switchView === 'function') switchView('public');
          setTimeout(function() {
            var target = document.querySelector(item.scroll);
            if (target) target.scrollIntoView({ behavior: 'auto' });
          }, 100);
          closeDrawer();
        });
        navSection.appendChild(link);
      });
      drawer.appendChild(navSection);
    }

    // ── VIEW SWITCHER (only if logged in) ──
    if (loggedIn) {
      var role = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentRole) ? HHP_Auth.currentRole : null;
      var viewSection = document.createElement('div');
      viewSection.style.cssText = 'padding: 8px 20px; border-bottom: 1px solid #d4c4ad; margin-bottom: 8px;';
      var label = document.createElement('div');
      label.style.cssText = 'font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;color:#000!important;font-weight:700;margin-bottom:6px;-webkit-text-fill-color:#000!important;';
      label.textContent = 'Switch View';
      viewSection.appendChild(label);

      var allowedViews = [{ value: 'public', label: 'Home' }];
      if (role === 'client' || role === 'staff' || role === 'owner') allowedViews.push({ value: 'client', label: 'Client Portal' });
      if (role === 'staff' || role === 'owner') allowedViews.push({ value: 'staff', label: 'Staff Portal' });
      if (role === 'owner') allowedViews.push({ value: 'owner', label: 'Owner Portal' });

      allowedViews.forEach(function(v) {
        var btn = document.createElement('button');
        btn.className = 'hhp-drawer-item';
        btn.textContent = v.label;
        btn.type = 'button';
        btn.style.cssText = 'color:#000!important;-webkit-text-fill-color:#000!important;display:block;width:100%;text-align:left;background:none;border:none;padding:10px 0;font-size:0.9rem;font-weight:500;cursor:pointer;';
        if (activePortal === 'pg-' + v.value || (!activePortal && v.value === 'public')) {
          btn.style.fontWeight = '700';
          btn.style.color = '#c8963e';
          btn.style.setProperty('-webkit-text-fill-color', '#c8963e', 'important');
        }
        btn.addEventListener('click', function() {
          if (typeof switchView === 'function') switchView(v.value);
          closeDrawer();
          setTimeout(updateDrawerContent, 300);
        });
        viewSection.appendChild(btn);
      });
      drawer.appendChild(viewSection);
    }

    // ── PORTAL SIDEBAR ITEMS (only if logged in and on a portal) ──
    if (!loggedIn || !activePortal) return;

    // Determine portal name
    var portalNames = {
      'pg-owner': 'Owner Portal',
      'pg-staff': 'Staff Portal',
      'pg-client': 'Client Portal'
    };
    var portalName = portalNames[activePortal] || 'Portal';

    // Add portal title header (close button is already at the top)
    var header = document.createElement('div');
    header.className = 'hhp-drawer-header';
    header.style.cssText = 'display:flex;align-items:center;padding:8px 20px 12px;border-bottom:2px solid #e0d5c5;';
    header.innerHTML = '<span class="hhp-drawer-title" style="color:#000!important;-webkit-text-fill-color:#000!important;font-size:1.1rem;font-weight:700;">' + portalName + '</span>';
    drawer.appendChild(header);

    // Read ALL .sb-item buttons from the active portal's sidebar
    var portalEl = document.getElementById(activePortal);
    if (!portalEl) return;

    var sidebarItems = portalEl.querySelectorAll('.sidebar .sb-item');

    sidebarItems.forEach(function(sbItem) {
      var link = document.createElement('button');
      link.className = 'hhp-drawer-item';
      link.textContent = sbItem.textContent.trim();
      link.type = 'button';
      link.style.color = '#000';
      link.style.setProperty('-webkit-text-fill-color', '#000', 'important');

      // Extract the onclick sTab call from the original sidebar item
      var onclickAttr = sbItem.getAttribute('onclick');
      if (onclickAttr) {
        // Parse sTab('o','o-overview') pattern
        var match = onclickAttr.match(/sTab\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/);
        if (match) {
          var tabPortal = match[1];
          var tabPanel = match[2];
          link.addEventListener('click', function() {
            // Call sTab directly
            if (typeof sTab === 'function') {
              sTab(tabPortal, tabPanel);
            }
            closeDrawer();
          });
        } else {
          // Fallback: try clicking the original element
          link.addEventListener('click', function() {
            sbItem.click();
            closeDrawer();
          });
        }
      } else {
        link.addEventListener('click', function() {
          sbItem.click();
          closeDrawer();
        });
      }

      drawer.appendChild(link);
    });

    // If no sidebar items found, show a message
    if (sidebarItems.length === 0) {
      var msg = document.createElement('div');
      msg.style.cssText = 'padding:20px;color:#000;font-size:0.95rem;';
      msg.textContent = 'No navigation items available.';
      drawer.appendChild(msg);
    }
  }

  // ─────────────────────────────────────────────
  // FIX ABOUT PHOTO — force full width (restored from v7)
  // ─────────────────────────────────────────────
  function fixAboutPhoto() {
    if (window.innerWidth > 1024) return;
    var aboutPhotos = document.querySelector('.about-photos');
    if (!aboutPhotos) return;
    aboutPhotos.style.setProperty('width', '100%', 'important');
    aboutPhotos.style.setProperty('max-width', '100%', 'important');
    aboutPhotos.style.setProperty('min-height', '280px', 'important');
    aboutPhotos.style.setProperty('border-radius', '16px', 'important');
    aboutPhotos.style.setProperty('overflow', 'hidden', 'important');
    aboutPhotos.querySelectorAll('img').forEach(function(img) {
      img.style.setProperty('width', '100%', 'important');
      img.style.setProperty('height', '100%', 'important');
      img.style.setProperty('object-fit', 'cover', 'important');
    });
    var aboutGrid = document.querySelector('.about-grid');
    if (aboutGrid) {
      aboutGrid.style.setProperty('grid-template-columns', '1fr', 'important');
      aboutGrid.style.setProperty('gap', '24px', 'important');
    }
  }

  // ─────────────────────────────────────────────
  // FIX VIEW SWITCHER — restored from v7 (targets viewDropdown select)
  // ─────────────────────────────────────────────
  function fixViewSwitcher() {
    // Both desktop and mobile dropdowns
    var dropdowns = [
      document.getElementById('viewDropdown'),
      document.getElementById('hhpMobileViewDD')
    ];

    var role = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentRole) ? HHP_Auth.currentRole : null;
    var isLoggedIn = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentUser) ? true : false;

    dropdowns.forEach(function(dd) {
      if (!dd) return;
      Array.from(dd.options).forEach(function(opt) {
        var val = opt.value;
        if (val === 'public') {
          opt.style.display = '';
          opt.disabled = false;
        } else if (!isLoggedIn) {
          opt.style.display = 'none';
          opt.disabled = true;
        } else if (role === 'owner') {
          opt.style.display = '';
          opt.disabled = false;
        } else if (role === 'staff') {
          if (val === 'staff' || val === 'client') {
            opt.style.display = '';
            opt.disabled = false;
          } else {
            opt.style.display = 'none';
            opt.disabled = true;
          }
        } else if (role === 'client') {
          if (val === 'client') {
            opt.style.display = '';
            opt.disabled = false;
          } else {
            opt.style.display = 'none';
            opt.disabled = true;
          }
        } else {
          if (val !== 'public') {
            opt.style.display = 'none';
            opt.disabled = true;
          }
        }
      });
    });

    // Update mobile nav portal section (v10 hamburger view switcher)
    var mobilePortalSection = document.getElementById('hhp-mnav-portal-section');
    if (mobilePortalSection) {
      mobilePortalSection.style.display = isLoggedIn ? 'block' : 'none';
      if (isLoggedIn) {
        var mobileSelect = document.getElementById('hhp-mnav-view-switcher');
        if (mobileSelect) {
          var allowedOptions = ['public'];
          if (role === 'client') allowedOptions.push('client');
          if (role === 'staff') { allowedOptions.push('staff'); allowedOptions.push('client'); }
          if (role === 'owner') allowedOptions = ['public', 'client', 'staff', 'owner'];

          mobileSelect.innerHTML = '<option value="">-- Switch View --</option>';
          allowedOptions.forEach(function(opt) {
            var opt_el = document.createElement('option');
            opt_el.value = opt;
            opt_el.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
            mobileSelect.appendChild(opt_el);
          });

          // Remove old listeners by cloning
          var newSelect = mobileSelect.cloneNode(true);
          mobileSelect.parentNode.replaceChild(newSelect, mobileSelect);
          newSelect.addEventListener('change', function() {
            if (this.value) {
              if (typeof switchView === 'function') switchView(this.value);
              this.value = '';
              var mobileNav = document.querySelector('.hhp-mobile-nav-v10');
              if (mobileNav) mobileNav.classList.remove('hhp-mnav-open');
              document.body.style.overflow = '';
              setTimeout(updateDrawerContent, 300);
            }
          });
        }
      }
    }

    // Also hide SWITCH VIEW section in old mobile nav if present
    var oldMobileNav = document.querySelector('.hhp-mobile-nav');
    if (oldMobileNav) {
      var switchDiv = oldMobileNav.children[5];
      if (switchDiv && switchDiv.tagName === 'DIV') {
        switchDiv.style.display = isLoggedIn ? '' : 'none';
      }
    }
  }

  // ─────────────────────────────────────────────
  // MEET & GREET — restored from v7 (Supabase booking query)
  // ─────────────────────────────────────────────
  function fixMeetGreetButton() {
    var isLoggedIn = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentUser) ? true : false;
    var role = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentRole) ? HHP_Auth.currentRole : null;

    // Only check for clients
    if (!isLoggedIn || role !== 'client') return;

    var userId = HHP_Auth.currentUser.id;
    if (!userId) return;

    var supabase = HHP_Auth.supabase;
    if (!supabase) return;

    supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single()
      .then(function(profileResult) {
        if (!profileResult.data || profileResult.error) return;
        var profileId = profileResult.data.id;
        return supabase
          .from('bookings')
          .select('id')
          .eq('client_id', profileId)
          .limit(1);
      })
      .then(function(result) {
        if (result && result.data && result.data.length > 0) {
          hideMeetGreetButtons();
        }
      })
      .catch(function() {
        // If query fails, don't hide anything
      });
  }

  function hideMeetGreetButtons() {
    document.querySelectorAll('a, button').forEach(function(el) {
      var text = el.textContent.trim().toLowerCase();
      if (text.includes('meet') && text.includes('greet')) {
        el.style.display = 'none';
      }
    });
    var floatingBtn = document.getElementById('floatingBookBtn');
    if (floatingBtn) {
      var txt = floatingBtn.textContent.trim().toLowerCase();
      if (txt.includes('meet') && txt.includes('greet')) {
        floatingBtn.style.display = 'none';
      }
    }
  }

  // ─────────────────────────────────────────────
  // FIX REVIEW ARROWS
  // ─────────────────────────────────────────────
  function fixReviewArrows() {
    var track = document.querySelector('.reviews-track');
    if (!track) return;

    window.scrollReviews = function(direction) {
      var card = track.querySelector('.review-card');
      if (!card) return;
      var cardWidth = card.offsetWidth;

      if (direction === 'left') {
        track.scrollBy({ left: -cardWidth, behavior: 'auto' });
      } else {
        track.scrollBy({ left: cardWidth, behavior: 'auto' });
      }
    };

    // Clone and rebind nav buttons
    var buttons = document.querySelectorAll('.rev-nav-btn');
    buttons.forEach(function(btn) {
      var newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', function() {
        var direction = this.classList.contains('rev-nav-prev') ? 'left' : 'right';
        window.scrollReviews(direction);
      });
    });
  }

  // ─────────────────────────────────────────────
  // INJECT PREVIEW TOOL — restored from v7 (iframe-based)
  // ─────────────────────────────────────────────
  function injectPreviewTool() {
    var editPanel = document.getElementById('o-edit-site');
    if (!editPanel) return;
    if (editPanel.querySelector('.hhp-preview-bar')) return;

    var bar = document.createElement('div');
    bar.className = 'hhp-preview-bar';
    bar.innerHTML = '<span class="preview-label">Preview Site:</span>' +
      '<button class="hhp-preview-btn active" data-width="100%" data-height="600">Desktop</button>' +
      '<button class="hhp-preview-btn" data-width="768px" data-height="600">Tablet</button>' +
      '<button class="hhp-preview-btn" data-width="375px" data-height="667">Phone</button>';

    var wrap = document.createElement('div');
    wrap.className = 'hhp-preview-frame-wrap';
    wrap.style.width = '100%';
    wrap.style.height = '600px';

    var iframe = document.createElement('iframe');
    iframe.src = window.location.origin + '/?preview=1';
    iframe.style.height = '100%';
    iframe.title = 'Site Preview';
    wrap.appendChild(iframe);

    var firstChild = editPanel.firstChild;
    editPanel.insertBefore(wrap, firstChild);
    editPanel.insertBefore(bar, wrap);

    bar.querySelectorAll('.hhp-preview-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        bar.querySelectorAll('.hhp-preview-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        wrap.style.width = btn.getAttribute('data-width');
        wrap.style.height = btn.getAttribute('data-height') + 'px';
        iframe.style.height = '100%';
      });
    });
  }

  // ─────────────────────────────────────────────
  // INJECT PORTAL NAV (Desktop Dropdowns)
  // ─────────────────────────────────────────────
  function injectPortalNav() {
    if (window.innerWidth < 768) return;

    var navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    var isAuth = typeof HHP_Auth !== 'undefined' && HHP_Auth.isAuthenticated && HHP_Auth.isAuthenticated();
    var role = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentRole) ? HHP_Auth.currentRole : '';

    if (!isAuth) return;

    if (document.getElementById('hhp-portal-nav')) return;

    // Don't create portal nav on desktop — the view switcher dropdown handles it
    if (window.innerWidth > 1024) return;

    var dropdowns = [];

    if (role === 'client') {
      dropdowns = [{
        label: 'Client Portal',
        items: [
          { text: 'Overview', selector: 'c-overview' },
          { text: 'My Pet', selector: 'c-pets' },
          { text: 'Account', selector: 'c-account' }
        ]
      }];
    } else if (role === 'staff') {
      dropdowns = [{
        label: 'Staff Portal',
        items: [
          { text: 'My Work', selector: 's-work' },
          { text: 'Communication', selector: 's-comm' }
        ]
      }];
    } else if (role === 'owner') {
      dropdowns = [{
        label: 'Owner Portal',
        items: [
          { text: 'Overview', selector: 'o-overview' },
          { text: 'All Clients', selector: 'o-clients' },
          { text: 'Staff Management', selector: 'o-staff' },
          { text: 'Calendar', selector: 'o-calendar' },
          { text: 'Payments & Bank', selector: 'o-payments' },
          { text: 'Home (Public Site)', selector: '__home__' }
        ]
      }];
    }

    var wrapper = document.createElement('div');
    wrapper.id = 'hhp-portal-nav';
    wrapper.style.display = 'inline-flex';

    dropdowns.forEach(function(dropdown) {
      var btn = document.createElement('button');
      btn.textContent = dropdown.label + ' \u25BC';
      btn.style.cssText = 'background: transparent; border: none; color: #c8963e; font-weight: 600; cursor: pointer; position: relative; padding: 8px 12px;';
      btn.className = 'hhp-portal-dropdown-btn';

      var menu = document.createElement('div');
      menu.style.cssText = 'display: none; position: absolute; top: 100%; left: 0; background: white; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000; min-width: 150px;';

      dropdown.items.forEach(function(item) {
        var link = document.createElement('a');
        link.textContent = item.text;
        link.href = '#';
        link.style.cssText = 'display: block; padding: 10px 16px; color: #1e1409; text-decoration: none; border-bottom: 1px solid #eee; cursor: pointer;';
        link.addEventListener('mouseenter', function() { this.style.background = '#f5f5f5'; });
        link.addEventListener('mouseleave', function() { this.style.background = 'transparent'; });
        link.addEventListener('click', function(e) {
          e.preventDefault();
          if (item.selector === '__home__') { if (typeof switchView === 'function') switchView('public'); menu.style.display = 'none'; return; }
          var targetItem = document.querySelector('.sb-item[onclick*="' + item.selector + '"]');
          if (targetItem) targetItem.click();
          menu.style.display = 'none';
        });
        menu.appendChild(link);
      });

      btn.appendChild(menu);

      btn.addEventListener('click', function() {
        var isOpen = menu.style.display !== 'none';
        document.querySelectorAll('.hhp-portal-dropdown-btn div').forEach(function(m) {
          m.style.display = 'none';
        });
        menu.style.display = isOpen ? 'none' : 'block';
      });

      document.addEventListener('click', function(e) {
        if (!btn.contains(e.target)) {
          menu.style.display = 'none';
        }
      });

      wrapper.appendChild(btn);
    });

    navRight.appendChild(wrapper);
  }

  // ─────────────────────────────────────────────
  // HANDLE RESIZE
  // ─────────────────────────────────────────────
  function handleResize() {
    killOldMobileNav();
    updateDrawerContent();
    fixMobileSidebar();
    fixAboutPhoto();

    if (window.innerWidth >= 768) {
      // Close mobile nav on desktop
      var mobileNav = document.querySelector('.hhp-mobile-nav-v10');
      if (mobileNav) mobileNav.classList.remove('hhp-mnav-open');
      // Show nav-right
      var navRight = document.querySelector('.nav-right');
      if (navRight) navRight.style.removeProperty('display');
      // Hide old mobile nav
      var oldMobileNav = document.querySelector('.hhp-mobile-nav');
      if (oldMobileNav) {
        oldMobileNav.classList.remove('hhp-mobile-nav-open');
        oldMobileNav.classList.remove('open');
        oldMobileNav.style.setProperty('display', 'none', 'important');
      }
    }
  }

  // ─────────────────────────────────────────────
  // HANDLE AUTH STATE CHANGE
  // ─────────────────────────────────────────────
  function handleAuthChange() {
    setTimeout(function() {
      killOldMobileNav();
      fixViewSwitcher();
      fixMeetGreetButton();
      updateMobileSignInBtn();
      updateDrawerContent();
      if (window.innerWidth >= 768) {
        injectPortalNav();
      }
    }, 500);
  }

  // ─────────────────────────────────────────────
  // HIDE QUICK SAVE BUTTON
  // ─────────────────────────────────────────────
  function hideQuickSave() {
    document.querySelectorAll('button').forEach(function(btn) {
      if (btn.textContent && btn.textContent.indexOf('Quick Save') !== -1) btn.remove();
    });
    document.querySelectorAll('button[style*="z-index: 9000"]').forEach(function(b) { b.remove(); });
    if (!window.__hhpQuickSaveObserver) {
      window.__hhpQuickSaveObserver = new MutationObserver(function(muts) {
        muts.forEach(function(m) {
          m.addedNodes.forEach(function(n) {
            if (n.nodeType === 1) {
              if (n.tagName === 'BUTTON' && n.textContent && n.textContent.indexOf('Quick Save') !== -1) n.remove();
              var qs = n.querySelectorAll ? n.querySelectorAll('button') : [];
              qs.forEach(function(b) { if (b.textContent && b.textContent.indexOf('Quick Save') !== -1) b.remove(); });
            }
          });
        });
      });
      window.__hhpQuickSaveObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  // ─────────────────────────────────────────────
  // MAIN INIT
  // ─────────────────────────────────────────────
  onReady(function() {
    fixViewport();
    injectAllCSS();
    killOldMobileNav();
    fixGreetings();
    fixFooterEmail();
    fixMobileSidebar();
    createMobileNav();
    addMobileSignIn();
    createPortalDrawer();
    fixAboutPhoto();
    fixViewSwitcher();
    fixMeetGreetButton();
    fixReviewArrows();
    injectPreviewTool();
    injectPortalNav();
    hideQuickSave();

    // Event listeners
    window.addEventListener('resize', handleResize);
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('sb-item') || (e.target.closest && e.target.closest('.sb-item'))) {
        setTimeout(function() {
          updateDrawerContent();
          injectPreviewTool();
        }, 300);
      }
    });

    // Auth listener
    if (typeof HHP_Auth !== 'undefined' && HHP_Auth.supabase && HHP_Auth.supabase.auth) {
      HHP_Auth.supabase.auth.onAuthStateChange(function() {
        handleAuthChange();
      });
    }

    console.log('\uD83D\uDC3E HHP UX Patch v18 applied (auth-gated drawer, old nav removed, hamburger=public, drawer=portal, black text, 3-line icons)');
  });

  // ── Stripe Payment Integration (v17) ──
  function wireStripeBooking() {
    // Payment links map (test mode - switch to live links for production)
    var STRIPE_LINKS = {
      'walk30': 'https://buy.stripe.com/test_7sY5kDcu661Mgzx4Lx1kA00',
      'walk60': 'https://buy.stripe.com/test_cNieVdbq2gGqbfdguf1kA01',
      'dropin20': 'https://buy.stripe.com/test_cNi28rdya75Q3MLdi31kA02',
      'dropin40': 'https://buy.stripe.com/test_fZu6oHdya9dYdnlem71kA03',
      'cat20': 'https://buy.stripe.com/test_3cI6oH51Ebm6831guf1kA04',
      'cat40': 'https://buy.stripe.com/test_aFaaEX8dQ75Q8315PB1kA05',
      'housesit': 'https://buy.stripe.com/test_aFa9AT65I9dYbfd5PB1kA06',
      'housesit_holiday': 'https://buy.stripe.com/test_cNifZhgKmbm65UT4Lx1kA07',
      'housesit_puppy': 'https://buy.stripe.com/test_28E28r65Icqa6YX3Ht1kA08',
      'housesit_cat': 'https://buy.stripe.com/test_6oUbJ13XA3TE2IH7XJ1kA09'
    };

    // Map booking modal select options to payment link keys
    function getPayLinkFromSelect(val) {
      val = (val || '').toLowerCase();
      if (val.indexOf('walk') !== -1 && val.indexOf('30') !== -1) return STRIPE_LINKS.walk30;
      if (val.indexOf('walk') !== -1 && val.indexOf('60') !== -1) return STRIPE_LINKS.walk60;
      if (val.indexOf('drop') !== -1 && val.indexOf('20') !== -1) return STRIPE_LINKS.dropin20;
      if (val.indexOf('drop') !== -1 && val.indexOf('40') !== -1) return STRIPE_LINKS.dropin40;
      if (val.indexOf('cat') !== -1 && val.indexOf('20') !== -1) return STRIPE_LINKS.cat20;
      if (val.indexOf('cat') !== -1 && val.indexOf('40') !== -1) return STRIPE_LINKS.cat40;
      if (val.indexOf('board') !== -1 || val.indexOf('house') !== -1 || val.indexOf('sit') !== -1) return STRIPE_LINKS.housesit;
      return STRIPE_LINKS.walk30; // fallback
    }

    // Override old bookModal to redirect to the new booking request modal
    var bookModal = document.getElementById('bookModal');
    if (bookModal) {
      var confirmBtn = bookModal.querySelector('.submit-btn');
      if (confirmBtn) {
        confirmBtn.onclick = function() {
          if (typeof closeModal === 'function') closeModal('bookModal');
          if (typeof window.openBookingModal === 'function') {
            setTimeout(function() { window.openBookingModal(); }, 200);
          }
        };
        confirmBtn.textContent = 'Submit Request';
        confirmBtn.style.background = 'var(--ink, #1e1409)';
      }
    }

    // Add "Book & Pay" buttons to paid service cards (skip Meet & Greet and Coming Soon)
    var cards = document.querySelectorAll('.service-card:not(.mg-card):not(.coming)');
    var cardLabels = [
      { text: 'Request a Walk', service: 'Dog Walking' },
      { text: 'Request a Visit', service: 'Drop-In Visit' },
      { text: 'Request a Visit', service: 'Cat Care Visit' },
      { text: 'Request a Stay', service: 'House Sitting' }
    ];
    cards.forEach(function(card, i) {
      if (i < cardLabels.length && !card.querySelector('.stripe-pay-btn')) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'stripe-pay-btn';
        btn.textContent = cardLabels[i].text;
        btn.style.cssText = 'display:block;width:auto;text-align:center;margin:14px auto 0;padding:8px 20px;background:var(--ink, #1e1409);color:#fff;border:none;border-radius:8px;font-weight:600;font-size:0.82rem;text-decoration:none;transition:opacity 0.2s;cursor:pointer;font-family:inherit;';
        btn.onmouseover = function() { this.style.opacity = '0.85'; };
        btn.onmouseout = function() { this.style.opacity = '1'; };
        (function(svc) {
          btn.addEventListener('click', function() {
            if (typeof window.openBookingModal === 'function') window.openBookingModal(svc);
            else if (typeof openModal === 'function') openModal('bookModal');
          });
        })(cardLabels[i].service);
        card.appendChild(btn);
      }
    });

    console.log('Service request buttons wired to booking flow');
  }

  wireStripeBooking();


  // ── v18 Fixes ──

  // 1. Password show/hide eye toggle
  function addPasswordEyeToggle() {
    var pwGroup = document.getElementById('authPasswordGroup');
    var pwInput = document.getElementById('authPassword');
    if (!pwGroup || !pwInput) return;
    if (pwGroup.querySelector('.pw-eye-btn')) return;
    pwGroup.style.position = 'relative';
    var eyeBtn = document.createElement('button');
    eyeBtn.type = 'button';
    eyeBtn.className = 'pw-eye-btn';
    eyeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    eyeBtn.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--mid);padding:4px;z-index:2;margin-top:10px;';
    eyeBtn.addEventListener('click', function() {
      var isHidden = pwInput.type === 'password';
      pwInput.type = isHidden ? 'text' : 'password';
      this.style.color = isHidden ? 'var(--gold)' : 'var(--mid)';
      this.innerHTML = isHidden
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    });
    pwGroup.appendChild(eyeBtn);
    pwInput.style.paddingRight = '40px';
  }

  // 2. Remove Owner Portal button text on desktop (keep dropdown functional)
  function cleanDesktopHeader() {
    if (window.innerWidth < 768) return;
    var portalNav = document.getElementById('hhp-portal-nav');
    if (!portalNav) return;
    // The dropdown btn already serves as the portal nav - it is fine.
    // But we should hide the standalone "Owner Portal" label if it exists as a separate element
    // Actually the user wants to remove the whole "Owner Portal ▼" button from desktop
    // since the view switcher dropdown already handles navigation
    // Let's check: on desktop they have the view switcher AND the portal dropdown
    // User says "no need for this button" pointing at Owner Portal ▼
    // So hide the portal nav on desktop
    portalNav.style.display = 'none';
  }

  // 3. Add Home link to mobile hamburger menu
  function addHomeToMobileMenu() {
    if (window.innerWidth >= 768) return;
    var hamburger = document.querySelector('.hhp-hamburger-v10');
    if (!hamburger) return;
    // The hamburger opens a drawer. Let's add a Home item to the drawer content
    // Check if drawer already has Home link
    var drawer = document.querySelector('.hhp-drawer');
    if (!drawer) return;
    if (drawer.querySelector('.hhp-home-link')) return;
    var homeLink = document.createElement('a');
    homeLink.href = '#';
    homeLink.className = 'hhp-home-link';
    homeLink.innerHTML = '<span style="margin-right:8px">🏠</span> Home';
    homeLink.style.cssText = 'display:flex;align-items:center;padding:14px 20px;color:var(--ink);font-weight:700;font-size:0.95rem;text-decoration:none;border-bottom:1px solid var(--border);background:var(--warm);';
    homeLink.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof switchView === 'function') switchView('public');
      // Close drawer
      var overlay = document.querySelector('.hhp-drawer-overlay');
      if (overlay) overlay.click();
    });
    drawer.insertBefore(homeLink, drawer.firstChild);
  }

  // 4. Add direct Stripe dashboard link to Payments section
  function enhancePaymentsSection() {
    var stripeCard = document.querySelector('#o-payments .card');
    if (!stripeCard) return;
    var openBtn = stripeCard.querySelector('a[href="https://stripe.com"]');
    if (openBtn) {
      openBtn.href = 'https://dashboard.stripe.com';
      openBtn.textContent = 'Open Stripe Dashboard →';
    }
  }

  addPasswordEyeToggle();
  cleanDesktopHeader();
  addHomeToMobileMenu();
  enhancePaymentsSection();

  // ── LATE OVERRIDE: neutralize conflicting nav CSS from fixes.js & booking-system.js ──
  // This runs after all scripts AND repeats to catch late-loading conflicts
  function applyNavOverride() {
    var isMobileOrTablet = window.innerWidth <= 1024;

    // Remove conflicting style/DOM elements from other scripts
    ['hhp-mobile-nav-fix', 'ham-fix-style', 'nav-hotfix-css', 'hhp-nav-fix-css', 'drawer-fix-style'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });
    ['hhpMobileSignIn', 'hhpHamburgerBtn', 'hhpMobileMenu'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });

    if (isMobileOrTablet) {
      // Force-hide desktop nav elements
      var navRight = document.querySelector('.nav-right');
      if (navRight) navRight.style.setProperty('display', 'none', 'important');
      var navCenter = document.querySelector('.nav-center');
      if (navCenter) navCenter.style.setProperty('display', 'none', 'important');
      var viewSwitcher = document.getElementById('viewSwitcher');
      if (viewSwitcher) viewSwitcher.style.setProperty('display', 'none', 'important');

      // Hide old hamburger, show drawer tab
      var oldHam = document.querySelector('.hhp-hamburger-v10');
      if (oldHam) oldHam.style.setProperty('display', 'none', 'important');

      // Ensure drawer tab is visible and in navbar
      var drawerTab = document.querySelector('.hhp-drawer-tab');
      if (drawerTab) {
        drawerTab.classList.add('hhp-drawer-tab-visible');
        drawerTab.style.setProperty('display', 'flex', 'important');
        drawerTab.style.setProperty('position', 'static', 'important');
        drawerTab.style.setProperty('order', '2', 'important');
        // Make sure it's inside the nav
        var nav = document.getElementById('mainNav');
        if (nav && drawerTab.parentElement !== nav) {
          nav.appendChild(drawerTab);
        }
      }

      // Show mobile sign-in button
      var mobileSignin = document.querySelector('.hhp-mobile-signin-btn');
      if (mobileSignin) mobileSignin.style.setProperty('display', 'block', 'important');

      // Update drawer content (adds nav links + portal items)
      updateDrawerContent();
    } else {
      // Desktop: show nav-right, hide mobile stuff
      var navRight = document.querySelector('.nav-right');
      if (navRight) navRight.style.setProperty('display', 'flex', 'important');
      var oldHam = document.querySelector('.hhp-hamburger-v10');
      if (oldHam) oldHam.style.setProperty('display', 'none', 'important');
      var drawerTab = document.querySelector('.hhp-drawer-tab');
      if (drawerTab) drawerTab.style.setProperty('display', 'none', 'important');
      var mobileSignin = document.querySelector('.hhp-mobile-signin-btn');
      if (mobileSignin) mobileSignin.style.setProperty('display', 'none', 'important');
      var viewSwitcher = document.getElementById('viewSwitcher');
      if (viewSwitcher) viewSwitcher.style.setProperty('display', 'inline-flex', 'important');
      var viewDropdown = document.getElementById('viewDropdown');
      if (viewDropdown) {
        viewDropdown.style.setProperty('display', 'block', 'important');
        viewDropdown.style.setProperty('border', '1.5px solid #c8963e', 'important');
      }
    }
  }

  // Run override multiple times to catch late-loading scripts
  setTimeout(applyNavOverride, 300);
  setTimeout(applyNavOverride, 800);
  setTimeout(applyNavOverride, 1500);
  setTimeout(applyNavOverride, 3000);
  window.addEventListener('resize', applyNavOverride);

  // Inject final-authority CSS as well (belt and suspenders)
  if (!document.getElementById('ux-patch-final-override')) {
    var finalCSS = document.createElement('style');
    finalCSS.id = 'ux-patch-final-override';
    finalCSS.textContent =
      // Phone + iPad: clean mobile nav
      '@media (max-width: 1024px) {' +
        '.nav { padding: 0 12px !important; height: 56px !important; display: flex !important; align-items: center !important; justify-content: space-between !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; z-index: 9999 !important; background: rgba(253,250,245,0.97) !important; }' +
        '.nav-logo { font-size: 1.35rem !important; position: absolute !important; left: 50% !important; transform: translateX(-50%) !important; text-align: center !important; pointer-events: auto !important; white-space: nowrap !important; }' +
        '.nav-center { display: none !important; }' +
        '.nav-right { display: none !important; }' +
        '#viewSwitcher { display: none !important; }' +
        '.nbtn-gold { display: none !important; }' +
        '.hhp-hamburger-v10 { display: none !important; }' +
        '.hhp-mobile-nav-v10 { display: none !important; }' +
        '.hhp-mobile-nav-v10.hhp-mnav-open { display: none !important; }' +
        // Drawer tab = the ONE hamburger
        '.hhp-drawer-tab.hhp-drawer-tab-visible {' +
          'display: flex !important; flex-direction: column !important; order: 2 !important;' +
          'position: static !important; background: transparent !important; border: none !important;' +
          'width: 44px !important; height: 44px !important; box-shadow: none !important;' +
          'align-items: center !important; justify-content: center !important;' +
          'cursor: pointer !important; padding: 0 !important; gap: 5px !important;' +
          'border-radius: 10px !important; flex-shrink: 0 !important;' +
          'transform: none !important; top: auto !important; left: auto !important;' +
        '}' +
        '.hhp-drawer-tab .hhp-dline {' +
          'display: block !important; width: 26px !important; height: 3px !important;' +
          'background: #1a1008 !important; border-radius: 2px !important;' +
        '}' +
        // Sign-in button (plain text, no box)
        '.hhp-mobile-signin-btn {' +
          'display: block !important; order: 0 !important;' +
          'padding: 6px 8px !important; border: none !important;' +
          'background: transparent !important; color: #1e1409 !important;' +
          'font-weight: 600 !important; font-size: 0.78rem !important;' +
          'border-radius: 0 !important; cursor: pointer !important;' +
          'white-space: nowrap !important; flex-shrink: 0 !important;' +
          '-webkit-text-fill-color: #1e1409 !important;' +
        '}' +
        '#hhpHamburgerBtn { display: none !important; }' +
        '#hhpMobileMenu { display: none !important; }' +
        '#hhpMobileSignIn { display: none !important; }' +
      '}' +
      // Desktop (>1024px): show view switcher, hide mobile stuff
      '@media (min-width: 1025px) {' +
        '.hhp-hamburger-v10 { display: none !important; }' +
        '.hhp-mobile-nav-v10 { display: none !important; }' +
        '.hhp-mobile-signin-btn { display: none !important; }' +
        '.nbtn-gold { display: none !important; }' +
        '#hhpHamburgerBtn { display: none !important; }' +
        '#hhpMobileMenu { display: none !important; }' +
        '#hhpMobileSignIn { display: none !important; }' +
        '#hhp-portal-nav { display: none !important; }' +
        '#viewSwitcher {' +
          'display: inline-flex !important; visibility: visible !important;' +
        '}' +
        '#viewDropdown {' +
          'display: block !important; visibility: visible !important;' +
          'background: #fdfaf5 !important; border: 1.5px solid #c8963e !important;' +
          'border-radius: 8px !important; padding: 8px 38px 8px 14px !important;' +
          'font-size: 0.82rem !important; font-weight: 600 !important;' +
          'color: #1e1409 !important; cursor: pointer !important; min-width: 120px !important;' +
        '}' +
      '}';
    document.head.appendChild(finalCSS);

    console.log('🐾 UX Patch: final nav CSS override applied');
  }

  // ── MUTATION OBSERVER: enforce mobile nav whenever any script tries to change it ──
  function startNavGuard() {
    var navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    var observer = new MutationObserver(function() {
      if (window.innerWidth <= 1024) {
        if (navRight.style.display !== 'none') {
          navRight.style.setProperty('display', 'none', 'important');
        }
        var vs = document.getElementById('viewSwitcher');
        if (vs && vs.style.display !== 'none') {
          vs.style.setProperty('display', 'none', 'important');
        }
      }
    });

    observer.observe(navRight, { attributes: true, attributeFilter: ['style'] });

    // Also watch for new style elements being injected that conflict
    var headObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.tagName === 'STYLE' && node.id &&
              ['ham-fix-style', 'nav-hotfix-css', 'hhp-nav-fix-css', 'drawer-fix-style'].indexOf(node.id) !== -1) {
            node.remove();
          }
        });
      });
    });
    headObserver.observe(document.head, { childList: true });
  }

  setTimeout(startNavGuard, 500);

})();
