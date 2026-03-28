/* ============================================================
   Housley Happy Paws - Booking Request System + UI Fixes
   v1.0 - March 2026

   This file handles:
   1. Desktop scroll fix (ux-patch.js loads 6x, causing scroll issues)
   2. Mobile nav redesign (Sign In left | Logo center | Hamburger right)
   3. Mobile landscape fix
   4. Booking request form (replaces direct Stripe checkout)
   5. Admin dashboard for managing booking requests
   6. Calendar integration for accepted bookings
   ============================================================ */

(function() {
  'use strict';

  // ── SUPABASE CLIENT ──
  var sbUrl = 'https://niysrippazlkpvdkzepp.supabase.co';
  var sbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5peXNyaXBwYXpsa3B2ZGt6ZXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTcxNDYsImV4cCI6MjA3OTA3MzE0Nn0.miAoNZQtOTTbnruWcj1WVn8ZGYtQZB5rh8FbBAS7VZU';

  function getSB() {
    // Always prefer the auth client to avoid creating duplicate GoTrueClient instances
    if (window.HHP_Auth && window.HHP_Auth.supabase) return window.HHP_Auth.supabase;
    // Fallback: reuse existing singleton if auth not ready yet
    if (window._hhpSB) return window._hhpSB;
    return null;
  }

  // ── Service price map (cents) — used to create dynamic checkout sessions ──
  // No more hardcoded payment links! Checkout sessions are created on-the-fly
  // via /api/create-checkout-session, so test↔live is just an env var swap.
  var SERVICE_PRICES = {
    'Dog Walking - 30 min':          25.00,
    'Dog Walking - 60 min':          45.00,
    'Dog Walking - 1 hour':          45.00,
    'Drop-In Visit - 20 min':        18.00,
    'Drop-In Visit - 30 min':        25.00,
    'Drop-In Visit - 40 min':        25.00,
    'Drop-In Visit - 1 hour':        45.00,
    'Cat Care Visit - 20 min':       18.00,
    'Cat Care Visit - 30 min':       20.00,
    'Cat Care Visit - 40 min':       30.00,
    'Cat Care Visit - 1 hour':       35.00,
    'House Sitting - Per Night':    125.00,
    'House Sitting - Cat Care':      50.00,
    'House Sitting - Puppy Rate':   140.00,
    'House Sitting - Holiday Rate': 150.00,
    'House Sitting':                125.00,
  };

  // ── Active Deals Cache — fetched from Supabase, auto-applied to pricing ──
  var _activeDealsCache = [];
  var _dealsLoaded = false;
  var _clientUsedDealIds = []; // deal IDs the current client has already redeemed

  async function _fetchActiveDeals() {
    var sb = getSB();
    if (!sb) return;
    try {
      var res = await sb.from('deals').select('*').eq('is_active', true);
      _activeDealsCache = (res.data || []).filter(function(d) { return d.discount_value > 0; });
      _dealsLoaded = true;

      // Fetch which deals the current client has already used (for once_per_client limits)
      _clientUsedDealIds = [];
      var clientId = window.HHP_Auth && window.HHP_Auth.currentUser ? window.HHP_Auth.currentUser.id : null;
      if (clientId) {
        var usageRes = await sb.from('booking_requests')
          .select('deal_id')
          .eq('client_id', clientId)
          .not('deal_id', 'is', null);
        if (usageRes.data) {
          _clientUsedDealIds = usageRes.data.map(function(r) { return r.deal_id; });
        }
      }
    } catch (e) { console.warn('Failed to load active deals:', e); }
  }

  // Public refresh function called when owner adds/deactivates deals
  window._refreshActiveDeals = function() {
    _fetchActiveDeals().then(function() {
      if (typeof window._brmUpdatePrice === 'function') window._brmUpdatePrice();
    });
  };

  // Load deals on startup — retry until auth is ready so _clientUsedDealIds is accurate
  function _initDeals() {
    _fetchActiveDeals().then(function() {
      // If clientId was null (auth not ready), retry once auth resolves
      var clientId = window.HHP_Auth && window.HHP_Auth.currentUser ? window.HHP_Auth.currentUser.id : null;
      if (!clientId) {
        // Auth not ready — schedule retries
        setTimeout(_initDeals, 2000);
      }
    });
    // Subscribe to realtime deal changes so pricing updates everywhere automatically
    var sb = getSB();
    if (sb && sb.channel && !window._dealsRealtimeSubscribed) {
      try {
        window._dealsRealtimeSubscribed = true;
        sb.channel('deals-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, function() {
            _fetchActiveDeals();
          })
          .subscribe();
      } catch(e) { console.warn('Deals realtime sub:', e); }
    }
  }
  setTimeout(_initDeals, 1200);
  // Also re-fetch deals whenever auth state changes (login/logout)
  if (typeof window.onHHPAuthReady === 'function') {
    window.onHHPAuthReady(function() { _fetchActiveDeals(); });
  }

  // Find the best matching deal for a service name (basePrice used to compare % vs $ fairly)
  function _findDealForService(serviceName, basePrice) {
    if (!serviceName || _activeDealsCache.length === 0) return null;
    var svc = serviceName.toLowerCase();
    var bestDeal = null;
    var bestDiscount = 0;
    basePrice = basePrice || 0;

    _activeDealsCache.forEach(function(deal) {
      // Skip once_per_client deals already used by this client
      if (deal.usage_limit === 'once_per_client' && _clientUsedDealIds.indexOf(deal.id) !== -1) {
        return;
      }

      var matches = false;
      var at = deal.applies_to || 'all';

      if (at === 'all') matches = true;
      else if (at === 'dog_walking' && svc.indexOf('walk') !== -1) matches = true;
      else if (at === 'drop_in' && svc.indexOf('drop') !== -1) matches = true;
      else if (at === 'cat_care' && svc.indexOf('cat') !== -1) matches = true;
      else if (at === 'house_sitting' && (svc.indexOf('house') !== -1 || svc.indexOf('sit') !== -1)) matches = true;

      if (matches) {
        // Calculate actual savings to compare deals fairly (percent vs fixed)
        var actualSavings = 0;
        if (deal.discount_type === 'percent') {
          actualSavings = basePrice * (deal.discount_value / 100);
        } else {
          actualSavings = Math.min(deal.discount_value, basePrice);
        }
        if (actualSavings > bestDiscount) {
          bestDiscount = actualSavings;
          bestDeal = deal;
        }
      }
    });

    return bestDeal;
  }

  // Apply a deal to a price, returns { discountedTotal, savingsAmount, deal }
  function _applyDeal(deal, originalTotal) {
    if (!deal || !originalTotal || originalTotal <= 0) return { discountedTotal: originalTotal, savingsAmount: 0, deal: null };
    var savings = 0;
    if (deal.discount_type === 'percent') {
      savings = originalTotal * (deal.discount_value / 100);
    } else {
      savings = Math.min(deal.discount_value, originalTotal); // Don't go below $0
    }
    savings = Math.round(savings * 100) / 100;
    return { discountedTotal: Math.max(0, originalTotal - savings), savingsAmount: savings, deal: deal };
  }

  function getServicePrice(serviceName) {
    if (!serviceName) return 0;
    var svc = serviceName.toLowerCase();
    // Exact match
    for (var key in SERVICE_PRICES) {
      if (svc === key.toLowerCase()) return SERVICE_PRICES[key];
    }
    // Fuzzy match
    if (svc.indexOf('walk') !== -1 && (svc.indexOf('hour') !== -1 || svc.indexOf('60') !== -1)) return SERVICE_PRICES['Dog Walking - 1 hour'];
    if (svc.indexOf('walk') !== -1) return SERVICE_PRICES['Dog Walking - 30 min'];
    if (svc.indexOf('drop') !== -1 && (svc.indexOf('hour') !== -1 || svc.indexOf('60') !== -1 || svc.indexOf('40') !== -1)) return SERVICE_PRICES['Drop-In Visit - 1 hour'];
    if (svc.indexOf('drop') !== -1 && svc.indexOf('40') !== -1) return SERVICE_PRICES['Drop-In Visit - 40 min'];
    if (svc.indexOf('drop') !== -1) return SERVICE_PRICES['Drop-In Visit - 30 min'];
    if (svc.indexOf('cat') !== -1 && (svc.indexOf('hour') !== -1 || svc.indexOf('60') !== -1)) return SERVICE_PRICES['Cat Care Visit - 1 hour'];
    if (svc.indexOf('cat') !== -1 && svc.indexOf('40') !== -1) return SERVICE_PRICES['Cat Care Visit - 40 min'];
    if (svc.indexOf('cat') !== -1) return SERVICE_PRICES['Cat Care Visit - 30 min'];
    if (svc.indexOf('holiday') !== -1) return SERVICE_PRICES['House Sitting - Holiday Rate'];
    if (svc.indexOf('puppy') !== -1) return SERVICE_PRICES['House Sitting - Puppy Rate'];
    if ((svc.indexOf('house') !== -1 || svc.indexOf('sit') !== -1) && svc.indexOf('cat') !== -1) return SERVICE_PRICES['House Sitting - Cat Care'];
    if (svc.indexOf('house') !== -1 || svc.indexOf('sit') !== -1) return SERVICE_PRICES['House Sitting'];
    return 0;
  }

  // Creates a dynamic Stripe checkout session and returns the URL
  // overridePrice: optional — pass the booking's estimated_total to use the deal-discounted price
  async function createCheckoutForService(serviceName, clientEmail, clientName, petNames, notes, overridePrice) {
    var price = overridePrice || getServicePrice(serviceName);
    if (!price) return '';
    try {
      var resp = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: serviceName,
          price: price,
          clientEmail: clientEmail || '',
          clientName: clientName || '',
          petNames: petNames || '',
          notes: notes || '',
        }),
      });
      var data = await resp.json();
      return (data && data.url) ? data.url : '';
    } catch (e) {
      console.warn('Checkout session creation failed:', e);
      return '';
    }
  }

  // Backward-compatible sync wrapper — returns '' and logs warning
  // Use createCheckoutForService() (async) instead wherever possible
  function getStripePaymentLink(serviceName) {
    console.warn('getStripePaymentLink is deprecated — use createCheckoutForService() instead');
    return '';
  }

  // ════════════════════════════════════════════════════════════
  // 1. DESKTOP SCROLL FIX
  // ════════════════════════════════════════════════════════════
  (function fixDesktopScroll() {
    var css = document.createElement('style');
    css.id = 'hhp-scroll-fix';
    css.textContent = [
      'html { overflow-y: scroll !important; overflow-x: hidden !important; scroll-behavior: auto !important; }',
      'body { overflow-y: auto !important; overflow-x: hidden !important; scroll-behavior: auto !important; }',
      '#pg-public, #pg-client, #pg-staff, #pg-owner { overflow: visible !important; }',
      '.reviews-track { scroll-snap-type: x mandatory !important; scroll-behavior: auto !important; }',
    ].join('\n');
    document.head.appendChild(css);

    // Prevent duplicate script loading by tracking loaded scripts
    var loadedScripts = {};
    var origCreateElement = document.createElement.bind(document);
    // We won't override createElement to avoid breaking things,
    // but we'll remove duplicate event listeners after load

    // After page loads, remove duplicate scroll listeners
    function cleanupScrollListeners() {
      // Ensure scroll works by removing any blocking inline styles
      document.documentElement.style.scrollBehavior = 'auto';
      // Remove any inline overflow styles that block scrolling
      var pgPublic = document.getElementById('pg-public');
      if (pgPublic) {
        pgPublic.style.overflow = 'visible';
        pgPublic.style.overflowY = 'visible';
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(cleanupScrollListeners, 1000);
        setTimeout(cleanupScrollListeners, 3000);
      });
    } else {
      setTimeout(cleanupScrollListeners, 500);
      setTimeout(cleanupScrollListeners, 2000);
    }
  })();

  // ════════════════════════════════════════════════════════════
  // 2. MOBILE NAV REDESIGN
  // ════════════════════════════════════════════════════════════
  (function fixMobileNav() {
    return; // Mobile nav fully handled by ux-patch.js v18
    var css = document.createElement('style');
    css.id = 'hhp-mobile-nav-fix';
    css.textContent = [
      // ── Mobile portrait (up to 768px) ──
      '@media (max-width: 768px) {',
      '  .site-nav {',
      '    display: flex !important;',
      '    align-items: center !important;',
      '    justify-content: space-between !important;',
      '    padding: 10px 16px !important;',
      '    position: fixed !important;',
      '    top: 0 !important;',
      '    left: 0 !important;',
      '    right: 0 !important;',
      '    z-index: 9999 !important;',
      '    background: #FFFDF8 !important;',
      '    box-shadow: 0 1px 4px rgba(0,0,0,0.08) !important;',
      '    height: 56px !important;',
      '    box-sizing: border-box !important;',
      '  }',
      '',
      '  /* Hide desktop nav links on mobile */',
      '  .site-nav .nav-center,',
      '  .site-nav .nav-links,',
      '  .site-nav > a:not(.nav-logo):not(#hhpMobileSignIn),',
      '  .site-nav > div:not(.nav-left):not(.nav-right):not(#hhpMobileSignIn):not(#hhpHamburgerBtn) {',
      '    display: none !important;',
      '  }',
      '',
      '  /* LEFT: Sign In/Out button */',
      '  #hhpMobileSignIn {',
      '    order: 1 !important;',
      '    display: flex !important;',
      '    align-items: center !important;',
      '    font-size: 13px !important;',
      '    color: var(--gold, #C8963E) !important;',
      '    background: none !important;',
      '    border: 1px solid var(--gold, #C8963E) !important;',
      '    border-radius: 20px !important;',
      '    padding: 5px 14px !important;',
      '    cursor: pointer !important;',
      '    white-space: nowrap !important;',
      '    min-width: 70px !important;',
      '    justify-content: center !important;',
      '    text-decoration: none !important;',
      '    font-family: inherit !important;',
      '  }',
      '',
      '  /* CENTER: Logo */',
      '  .site-nav .nav-logo,',
      '  .site-nav .logo,',
      '  .site-nav a[href="/"],',
      '  .site-nav .brand {',
      '    order: 2 !important;',
      '    flex: 1 !important;',
      '    text-align: center !important;',
      '    font-size: 16px !important;',
      '    white-space: nowrap !important;',
      '    display: block !important;',
      '  }',
      '',
      '  /* RIGHT: Hamburger */',
      '  #hhpHamburgerBtn {',
      '    order: 3 !important;',
      '    display: flex !important;',
      '    align-items: center !important;',
      '    justify-content: center !important;',
      '    width: 40px !important;',
      '    height: 40px !important;',
      '    background: none !important;',
      '    border: none !important;',
      '    cursor: pointer !important;',
      '    padding: 0 !important;',
      '    flex-shrink: 0 !important;',
      '  }',
      '  #hhpHamburgerBtn span {',
      '    display: block !important;',
      '    width: 22px !important;',
      '    height: 2px !important;',
      '    background: var(--ink, #2C2C2C) !important;',
      '    margin: 4px 0 !important;',
      '    transition: all 0.3s !important;',
      '  }',
      '',
      '  /* Hide old nav elements */',
      '  .nav-right, .nav-left { display: none !important; }',
      '  #viewDropdown, #viewSwitcher, .hhp-view-switcher { display: none !important; }',
      '  .hhp-hamburger, .hhp-mobile-nav { display: none !important; }',
      '',
      '  /* Mobile menu overlay */',
      '  #hhpMobileMenu {',
      '    display: none;',
      '    position: fixed !important;',
      '    top: 56px !important;',
      '    left: 0 !important;',
      '    right: 0 !important;',
      '    bottom: 0 !important;',
      '    background: #FFFDF8 !important;',
      '    z-index: 9998 !important;',
      '    padding: 20px !important;',
      '    overflow-y: auto !important;',
      '    flex-direction: column !important;',
      '  }',
      '  #hhpMobileMenu.open { display: flex !important; }',
      '  #hhpMobileMenu a {',
      '    display: block !important;',
      '    padding: 16px 20px !important;',
      '    font-size: 18px !important;',
      '    color: var(--ink, #2C2C2C) !important;',
      '    text-decoration: none !important;',
      '    border-bottom: 1px solid var(--gold-light, #F5E6CC) !important;',
      '    font-family: inherit !important;',
      '  }',
      '  #hhpMobileMenu a:hover { color: var(--gold, #C8963E) !important; }',
      '',
      '  /* Push page content below fixed nav */',
      '  body { padding-top: 56px !important; }',
      '',
      '  /* Hide any other hamburger/menu buttons from ux-patch */',
      '  .hhp-hamburger-btn, .hamburger-btn, [class*="hamburger"] { display: none !important; }',
      '}',
      '',
      // ── Mobile landscape (up to 900px AND short height) ──
      '@media (max-width: 900px) and (max-height: 500px) {',
      '  .site-nav {',
      '    display: flex !important;',
      '    align-items: center !important;',
      '    justify-content: space-between !important;',
      '    padding: 6px 16px !important;',
      '    position: fixed !important;',
      '    top: 0 !important;',
      '    left: 0 !important;',
      '    right: 0 !important;',
      '    z-index: 9999 !important;',
      '    background: #FFFDF8 !important;',
      '    height: 44px !important;',
      '  }',
      '  .site-nav .nav-center,',
      '  .site-nav .nav-links,',
      '  .nav-right, .nav-left { display: none !important; }',
      '  #hhpMobileSignIn { display: flex !important; order: 1 !important; font-size: 12px !important; padding: 4px 10px !important; }',
      '  .site-nav .nav-logo, .site-nav .logo, .site-nav a[href="/"], .site-nav .brand { order: 2 !important; flex: 1 !important; text-align: center !important; font-size: 14px !important; }',
      '  #hhpHamburgerBtn { display: flex !important; order: 3 !important; }',
      '  body { padding-top: 44px !important; }',
      '  #hhpMobileMenu { top: 44px !important; }',
      '}',
    ].join('\n');
    document.head.appendChild(css);

    // Create mobile nav elements after DOM ready
    function createMobileNavElements() {
      var nav = document.querySelector('.site-nav');
      if (!nav || document.getElementById('hhpMobileSignIn')) return;

      // Sign In/Out button
      var signBtn = document.createElement('button');
      signBtn.id = 'hhpMobileSignIn';
      signBtn.textContent = 'Sign In';
      signBtn.onclick = function() {
        if (window.HHP_Auth && window.HHP_Auth.isAuthenticated()) {
          window.HHP_Auth.logout();
          signBtn.textContent = 'Sign In';
        } else {
          // Show auth overlay
          var overlay = document.getElementById('authOverlay');
          if (overlay) overlay.style.display = 'flex';
        }
      };
      nav.appendChild(signBtn);

      // Hamburger button
      var hamBtn = document.createElement('button');
      hamBtn.id = 'hhpHamburgerBtn';
      hamBtn.setAttribute('aria-label', 'Menu');
      hamBtn.innerHTML = '<div><span></span><span></span><span></span></div>';
      hamBtn.onclick = function() {
        var menu = document.getElementById('hhpMobileMenu');
        if (menu) {
          menu.classList.toggle('open');
          hamBtn.classList.toggle('active');
        }
      };
      nav.appendChild(hamBtn);

      // Mobile menu overlay
      var menu = document.createElement('div');
      menu.id = 'hhpMobileMenu';

      var menuLinks = [
        { text: 'About Rachel', target: '.about-section' },
        { text: 'Services & Pricing', target: '.services-section' },
        { text: 'Book a Service', target: '#bookingRequestModal', action: 'booking' },
        { text: 'Calendar', target: '.cal-section' },
        { text: 'Reviews', target: '.reviews-section' },
        { text: 'Coming Soon', target: '.future-section' },
      ];

      menuLinks.forEach(function(item) {
        var a = document.createElement('a');
        a.textContent = item.text;
        a.href = '#';
        a.onclick = function(e) {
          e.preventDefault();
          menu.classList.remove('open');
          hamBtn.classList.remove('active');

          if (item.action === 'booking') {
            openBookingModal();
            return;
          }

          var target = document.querySelector(item.target);
          if (target) {
            target.scrollIntoView({ behavior: 'auto', block: 'start' });
          }
        };
        menu.appendChild(a);
      });

      document.body.appendChild(menu);

      // Update sign button state based on auth
      function updateSignBtn() {
        if (window.HHP_Auth && window.HHP_Auth.isAuthenticated()) {
          signBtn.textContent = 'Sign Out';
        } else {
          signBtn.textContent = 'Sign In';
        }
      }

      setTimeout(updateSignBtn, 1000);
      setTimeout(updateSignBtn, 3000);
      // Listen for auth state changes instead of polling
      if (window._hhpAuthCallbacks) window._hhpAuthCallbacks.push(updateSignBtn);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(createMobileNavElements, 1500);
        setTimeout(createMobileNavElements, 4000);
      });
    } else {
      setTimeout(createMobileNavElements, 500);
      setTimeout(createMobileNavElements, 2000);
    }
  })();

  // ════════════════════════════════════════════════════════════
  // 3. BOOKING REQUEST MODAL & FORM
  // ════════════════════════════════════════════════════════════

  // Services list for the form
  var SERVICES = [
    { name: 'Dog Walking - 30 min', price: '$25', base: 25, type: 'dog', group: 'Dog Walking', extraPet: 15, puppy: 5, holiday: 10 },
    { name: 'Dog Walking - 1 hour', price: '$45', base: 45, type: 'dog', group: 'Dog Walking', extraPet: 15, puppy: 5, holiday: 10 },
    { name: 'Drop-In Visit - 30 min', price: '$25', base: 25, type: 'dog', group: 'Drop-In Visit', extraPet: 15, puppy: 5, holiday: 10 },
    { name: 'Drop-In Visit - 1 hour', price: '$45', base: 45, type: 'dog', group: 'Drop-In Visit', extraPet: 15, puppy: 5, holiday: 10 },
    { name: 'Cat Care Visit - 30 min', price: '$20', base: 20, type: 'cat', group: 'Cat Care Visit', extraPet: 10, puppy: 0, holiday: 10 },
    { name: 'Cat Care Visit - 1 hour', price: '$35', base: 35, type: 'cat', group: 'Cat Care Visit', extraPet: 10, puppy: 0, holiday: 10 },
    { name: 'House Sitting (Dog)', price: '$125/night', base: 125, type: 'dog', group: 'House Sitting', extraPet: 35, extraCat: 15, extra3plus: 35, puppy: 5, holiday: 10 },
    { name: 'House Sitting (Cat)', price: '$80/night', base: 80, type: 'cat', group: 'House Sitting', extraPet: 35, extraCat: 15, extra3plus: 35, puppy: 0, holiday: 10 },
    { name: 'Meet & Greet', price: 'Free', base: 0, type: 'any', group: 'Meet & Greet', extraPet: 0, puppy: 0, holiday: 0 },
  ];

  // Holiday dates (month-day format, add more as needed)
  var HOLIDAYS = [
    '01-01', // New Year's Day
    '01-20', // MLK Day (approx)
    '02-17', // Presidents Day (approx)
    '05-26', // Memorial Day (approx)
    '07-04', // Independence Day
    '09-01', // Labor Day (approx)
    '10-13', // Columbus Day (approx)
    '11-11', // Veterans Day
    '11-27', // Thanksgiving (approx)
    '11-28', // Day after Thanksgiving
    '12-24', // Christmas Eve
    '12-25', // Christmas Day
    '12-31', // New Year's Eve
  ];

  function isHoliday(dateStr) {
    if (!dateStr) return false;
    var md = dateStr.slice(5); // "YYYY-MM-DD" -> "MM-DD"
    return HOLIDAYS.indexOf(md) !== -1;
  }

  function calculatePrice(serviceName, numPets, isPuppy, isHolidayDate, petType, nights) {
    var svc = null;
    for (var i = 0; i < SERVICES.length; i++) {
      if (SERVICES[i].name === serviceName) { svc = SERVICES[i]; break; }
    }
    if (!svc || svc.base === 0) return { total: 0, breakdown: 'Free', base: 0 };

    nights = nights || 1;
    var isMultiNight = svc.group === 'House Sitting' && nights > 0;

    var baseRate = svc.base;
    var parts = [];

    if (isMultiNight) {
      parts.push(svc.name + ': $' + baseRate + '/night x ' + nights + ' night' + (nights > 1 ? 's' : '') + ' = $' + (baseRate * nights));
    } else {
      parts.push(svc.name + ': $' + baseRate);
    }

    // Additional pets — per night for house sitting, flat for others
    var extraPetCost = 0;
    if (numPets > 1) {
      var extraCount = numPets - 1;
      // House Sitting 3+ animals: all additional at flat $35 rate regardless of type
      if (isMultiNight && numPets >= 3 && svc.extra3plus) {
        var extraRate = svc.extra3plus;
        extraPetCost = extraCount * extraRate * nights;
        parts.push(extraCount + ' extra pet(s) (3+): +$' + extraRate + '/night x ' + nights + ' = $' + extraPetCost);
      } else if (petType === 'both') {
        // Mixed (1 dog + 1 cat): always $140/night for House Sitting
        if (isMultiNight) {
          baseRate = 140;
          parts[0] = 'House Sitting (Mixed): $140/night x ' + nights + ' night' + (nights > 1 ? 's' : '') + ' = $' + (140 * nights);
        } else {
          var extraRate = svc.extraPet || 15;
          extraPetCost = extraRate;
          parts.push('Additional pet: +$' + extraRate);
        }
      } else {
        var extraRate = (petType === 'cat' && svc.extraCat) ? svc.extraCat : (svc.extraPet || 0);
        extraPetCost = extraCount * extraRate * (isMultiNight ? nights : 1);
        if (extraPetCost > 0) parts.push(extraCount + ' extra ' + (petType === 'cat' ? 'cat(s)' : 'dog(s)') + ': +$' + extraRate + (isMultiNight ? '/night x ' + nights + ' = $' + extraPetCost : ''));
      }
    }

    // Puppy surcharge (dog services only) — per night for house sitting
    var puppyCost = 0;
    if (isPuppy && svc.puppy > 0 && petType !== 'cat') {
      puppyCost = svc.puppy * (isMultiNight ? nights : 1);
      parts.push('Puppy surcharge: +$' + svc.puppy + (isMultiNight ? '/night x ' + nights + ' = $' + puppyCost : ''));
    }

    // Holiday surcharge — per night for house sitting
    var holidayCost = 0;
    if (isHolidayDate && svc.holiday > 0) {
      holidayCost = svc.holiday * (isMultiNight ? nights : 1);
      parts.push('Holiday rate: +$' + svc.holiday + (isMultiNight ? '/night x ' + nights + ' = $' + holidayCost : ''));
    }

    var total = (isMultiNight ? baseRate * nights : baseRate) + extraPetCost + puppyCost + holidayCost;

    return { total: total, breakdown: parts.join(' | '), base: baseRate, nights: nights };
  }

  // Calculate number of nights between two dates (used by price estimator and submit)
  function calcNights(startStr, endStr) {
    if (!startStr || !endStr) return 1;
    var start = new Date(startStr + 'T12:00:00');
    var end = new Date(endStr + 'T12:00:00');
    var diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }

  function createBookingModal() {
    if (document.getElementById('bookingRequestModal')) return;

    var modal = document.createElement('div');
    modal.id = 'bookingRequestModal';
    modal.innerHTML = [
      '<div class="brm-backdrop" onclick="closeBookingModal()"></div>',
      '<div class="brm-content">',
      '  <button class="brm-close" onclick="closeBookingModal()" aria-label="Close">✕</button>',
      '  <div id="brm-greeting" style="display:none;background:linear-gradient(135deg,#f9f6f0,#fff);border:1px solid #e0d5c5;border-radius:10px;padding:14px 16px;margin-bottom:16px">',
      '    <span style="font-size:1.1rem;font-weight:700;color:var(--ink,#2C2C2C)">Hi, <span id="brm-greeting-name"></span>!</span>',
      '    <span style="font-size:0.85rem;color:#6b5c4d;margin-left:6px">Your info is pre-filled below.</span>',
      '  </div>',
      '  <h2 class="brm-title">Request a Booking</h2>',
      '  <p class="brm-subtitle">Fill out the details below and Rachel will get back to you to confirm your booking!</p>',
      '  <form id="bookingRequestForm" onsubmit="submitBookingRequest(event)">',
      '',
      '    <label class="brm-label">Service *</label>',
      '    <select id="brm-service" class="brm-input" required>',
      '      <option value="">Choose a service...</option>',
             (function() {
               var seen = {};
               return SERVICES.map(function(s) {
                 if (seen[s.group]) return '';
                 seen[s.group] = true;
                 if (s.group === 'House Sitting') return '';
                 if (s.group === 'Meet & Greet') return '<option value="Meet & Greet">Meet & Greet - Free</option>';
                 return '<option value="' + s.group + '">' + s.group + '</option>';
               }).join('') +
               '<option value="House Sitting (Dog)">House Sitting (Dog) - $125/night</option>' +
               '<option value="House Sitting (Cat)">House Sitting (Cat) - $80/night</option>';
             })(),
      '    </select>',
      '',
      '    <div id="brm-duration-col" style="display:none;margin-bottom:4px">',
      '      <label class="brm-label">Duration *</label>',
      '      <select id="brm-duration" class="brm-input">',
      '        <option value="30 min">30 Minutes</option>',
      '        <option value="1 hour">1 Hour</option>',
      '      </select>',
      '    </div>',
      '',
      '    <!-- Hidden fields: keep brm-date/brm-time for House Sitting & recurring compat -->',
      '    <div id="brm-hs-date-row" style="display:none">',
      '      <div class="brm-row">',
      '        <div class="brm-col">',
      '          <label class="brm-label" id="brm-date-label">Start Date *</label>',
      '          <input type="date" id="brm-date" class="brm-input">',
      '        </div>',
      '        <div class="brm-col" id="brm-enddate-col">',
      '          <label class="brm-label">End Date *</label>',
      '          <input type="date" id="brm-enddate" class="brm-input">',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <input type="hidden" id="brm-time" value="">',
      '    <div id="brm-endtime-display" style="display:none"></div>',
      '',
      '    <!-- Unified date picker: tap dates on calendar to select -->',
      '    <div id="brm-multidate-section" style="margin:6px 0 14px">',
      '      <label class="brm-label">Tap the dates you want to book</label>',
      '      <div id="brm-cal-picker" style="background:#f9f6f0;border:1px solid #e0d5c5;border-radius:10px;padding:12px;margin-bottom:10px"></div>',
      '      <input type="hidden" id="brm-add-date-input" value="">',
      '      <div id="brm-dates-list" style="display:flex;flex-direction:column;gap:8px"></div>',
      '      <div id="brm-no-dates-msg" style="text-align:center;color:#a08a6e;font-size:0.82rem;padding:12px;background:#f9f6f0;border:1px dashed #e0d5c5;border-radius:8px">Tap dates on the calendar to add them to your booking</div>',
      '    </div>',
      '    <!-- Hidden recurring fields for backward compat (populated from per-card recurring) -->',
      '    <input type="hidden" id="brm-recur-toggle" value="">',
      '    <div id="brm-recur-options" style="display:none"></div>',
      '    <input type="hidden" id="brm-recur-start" value="">',
      '    <input type="hidden" id="brm-recur-end" value="">',
      '    <input type="hidden" id="brm-recur-freq" value="">',
      '    <div id="brm-recur-preview" style="display:none"></div>',
      '',
      '    <label class="brm-label">Your Name *</label>',
      '    <input type="text" id="brm-name" class="brm-input" placeholder="Full name" required>',
      '',
      '    <div class="brm-row">',
      '      <div class="brm-col">',
      '        <label class="brm-label">Email *</label>',
      '        <input type="email" id="brm-email" class="brm-input" placeholder="you@email.com" required>',
      '      </div>',
      '      <div class="brm-col">',
      '        <label class="brm-label">Phone</label>',
      '        <input type="tel" id="brm-phone" class="brm-input" placeholder="(717) 555-1234">',
      '      </div>',
      '    </div>',
      '',
      '    <label class="brm-label">Select Your Pet(s) <span style="color:#c25656;font-weight:700">*</span></label>',
      '    <div id="brm-pet-checkboxes" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">',
      '      <div style="color:#8c6b4a;font-size:0.84rem">Loading your pets...</div>',
      '    </div>',
      '    <input type="hidden" id="brm-pets" value="">',
      '    <input type="hidden" id="brm-petcombo" value="">',
      '    <input type="hidden" id="brm-pettype" value="dog">',
      '    <input type="hidden" id="brm-numpets" value="1">',
      '    <input type="hidden" id="brm-pets-selected-ids" value="">',
      '    <input type="hidden" id="brm-puppy" value="">',
      '',
      '    <div id="brm-price-estimate" style="display:none;background:linear-gradient(135deg,#f9f6f0,#fff);border:1px solid #e0d5c5;border-radius:10px;padding:14px 16px;margin:10px 0 14px">',
      '      <div style="font-weight:700;font-size:0.88rem;margin-bottom:6px">Estimated Total</div>',
      '      <div id="brm-price-breakdown" style="font-size:0.82rem;color:#6b5c4d;line-height:1.6"></div>',
      '      <div id="brm-per-service-list" style="margin-top:6px;font-size:0.8rem"></div>',
      '      <div style="font-weight:700;font-size:1.15rem;color:#1e1409;margin-top:6px">$<span id="brm-price-total">0</span></div>',
      '      <div id="brm-policy-notice" style="margin-top:10px;padding:10px 12px;background:#fff8e1;border:1px solid #e0d5c5;border-radius:8px;font-size:0.76rem;color:#6b5c4d;line-height:1.5">',
      '        <strong style="color:#bf5d00">Cancellation Policy:</strong> Cancellations made within 48 hours of your scheduled appointment will be charged the full service fee. Cancellations made more than 48 hours in advance are fully refundable.',
      '      </div>',
      '      <div style="margin-top:8px;padding:10px 12px;background:#f0f7f0;border:1px solid #c5dcc5;border-radius:8px;font-size:0.76rem;color:#3d5c3d;line-height:1.5">',
      '        <strong style="color:#2e7d32">💳 Payment Info:</strong> Once your booking is accepted, appointments this week are charged immediately. Appointments for future weeks will be charged automatically on Sunday the week of your service. You can also pay early anytime from your appointments page.',
      '      </div>',
      '    </div>',
      '',
      '    <label class="brm-label">Home Address <span style="color:var(--rose,#c25656);font-weight:700">*</span></label>',
      '    <input type="text" id="brm-address" class="brm-input" placeholder="Enter your street address" required>',
      '',
      '    <label class="brm-label">Special Notes</label>',
      '    <textarea id="brm-notes" class="brm-input brm-textarea" rows="4" placeholder="Medication schedules, behavioral notes, access instructions, alarm codes, anything Rachel should know..."></textarea>',
      '',
      '    <div id="brm-error" class="brm-error"></div>',
      '    <div id="brm-success" class="brm-success"></div>',
      '',
      '    <button type="submit" id="brm-submit" class="brm-submit-btn">Send Request to Rachel</button>',
      '  </form>',
      '</div>',
    ].join('\n');

    document.body.appendChild(modal);

    // Pre-fill if user is logged in
    setTimeout(function() {
      if (window.HHP_Auth && window.HHP_Auth.currentUser) {
        var u = window.HHP_Auth.currentUser;
        var p = u.profile || {};
        var nameEl = document.getElementById('brm-name');
        var emailEl = document.getElementById('brm-email');
        var petsEl = document.getElementById('brm-pets');
        var phoneEl = document.getElementById('brm-phone');
        var addrEl = document.getElementById('brm-address');
        if (nameEl && !nameEl.value && p.full_name) nameEl.value = p.full_name;
        if (emailEl && !emailEl.value && u.email) emailEl.value = u.email;
        if (petsEl && !petsEl.value && p.pet_names) petsEl.value = p.pet_names;
        if (phoneEl && !phoneEl.value && p.phone) phoneEl.value = p.phone;
        if (addrEl && !addrEl.value && p.address) addrEl.value = p.address;
      }
    }, 300);

    // Set min date to today (prevents booking in the past, but no auto-fill)
    var today = _localDateStr();
    var dateInput = document.getElementById('brm-date');
    if (dateInput) { dateInput.setAttribute('min', today); dateInput.value = ''; }
    var endDateInput = document.getElementById('brm-enddate');
    if (endDateInput) { endDateInput.setAttribute('min', today); endDateInput.value = ''; }

    // Resolve full service name from group dropdown + duration dropdown
    window._resolveBookingServiceName = resolveServiceName;
    function resolveServiceName() {
      var svcGroup = document.getElementById('brm-service').value;
      if (!svcGroup) return '';
      var isHS = svcGroup.toLowerCase().indexOf('house sitting') !== -1;
      var isMG = svcGroup === 'Meet & Greet';
      if (isHS || isMG) return svcGroup;
      var dur = document.getElementById('brm-duration') ? document.getElementById('brm-duration').value : '30 min';
      return svcGroup + ' - ' + dur;
    }

    // Show/hide duration dropdown based on service
    function toggleDurationField() {
      var svcGroup = document.getElementById('brm-service').value;
      var durCol = document.getElementById('brm-duration-col');
      if (!durCol) return;
      var isHS = svcGroup.toLowerCase().indexOf('house sitting') !== -1;
      var isMG = svcGroup === 'Meet & Greet';
      var isEmpty = !svcGroup;
      durCol.style.display = (isEmpty || isHS || isMG) ? 'none' : '';
    }

    // Live price estimator
    window._brmUpdatePrice = updatePriceEstimate;
    function updatePriceEstimate() {
      var svcName = resolveServiceName();
      var numPets = parseInt(document.getElementById('brm-numpets').value) || 1;
      var petType = document.getElementById('brm-pettype').value;
      var isPuppy = document.getElementById('brm-puppy').value === 'true';
      var dateVal = document.getElementById('brm-date').value;
      var holidayFlag = isHoliday(dateVal);

      var estimateEl = document.getElementById('brm-price-estimate');
      var breakdownEl = document.getElementById('brm-price-breakdown');
      var totalEl = document.getElementById('brm-price-total');

      if (!svcName || svcName === 'Meet & Greet') {
        if (estimateEl) estimateEl.style.display = svcName === 'Meet & Greet' ? 'block' : 'none';
        if (svcName === 'Meet & Greet') {
          if (breakdownEl) breakdownEl.textContent = 'Meet & Greet is free!';
          if (totalEl) totalEl.textContent = '0 (Free)';
        }
        return;
      }

      var nights = 1;
      if (svcName.toLowerCase().indexOf('house sitting') !== -1) {
        nights = calcNights(document.getElementById('brm-date').value, document.getElementById('brm-enddate').value);
      }
      var result = calculatePrice(svcName, numPets, isPuppy, holidayFlag, petType, nights);
      if (estimateEl) estimateEl.style.display = 'block';
      if (breakdownEl) breakdownEl.innerHTML = result.breakdown.split(' | ').join('<br>');

      // Count total dates (from date cards + any recurring expansions)
      var isHS = svcName.toLowerCase().indexOf('house sitting') !== -1;
      var totalDates = 1;
      var hasAnyRecurring = window._brmAnyCardRecurring ? window._brmAnyCardRecurring() : false;
      var hasOngoingRecur = false;
      if (!isHS) {
        var cardCount = window._brmGetDateCardsData ? window._brmGetDateCardsData().length : 0;
        if (cardCount > 0) totalDates = cardCount;
        // Check for "until stopped" (ongoing) recurring cards
        if (hasAnyRecurring) {
          document.querySelectorAll('#brm-dates-list > div[data-date]').forEach(function(card) {
            var cIdx = card.id.replace('brm-dc-', '');
            var onEl = document.getElementById('brm-dc-ongoing-' + cIdx);
            if (onEl && onEl.checked) hasOngoingRecur = true;
          });
          // Add finite recurring dates
          if (window._brmGetRecurDates) {
            var allRecurDates = window._brmGetRecurDates();
            var cardDates = [];
            if (window._brmGetDateCardsData) {
              window._brmGetDateCardsData().forEach(function(c) { cardDates.push(c.date); });
            }
            allRecurDates.forEach(function(rd) {
              if (cardDates.indexOf(rd) === -1) cardDates.push(rd);
            });
            if (cardDates.length > 0) totalDates = cardDates.length;
          }
        }
      }

      // Per-service list (shows each date card's price individually)
      var perServiceEl = document.getElementById('brm-per-service-list');

      // Recurring pricing: show per-appointment cost, billed the day before each visit
      if (hasAnyRecurring && !isHS) {
        var recurringCount = 0;
        var oneTimeCards = 0;
        var recurringSchedules = [];
        document.querySelectorAll('#brm-dates-list > div[data-date]').forEach(function(card) {
          var cIdx = card.id.replace('brm-dc-', '');
          var rCb = document.getElementById('brm-dc-recur-' + cIdx);
          var cardDate = card.getAttribute('data-date');
          if (rCb && rCb.checked) {
            recurringCount++;
            var freqEl = document.getElementById('brm-dc-freq-' + cIdx);
            var ongoingEl = document.getElementById('brm-dc-ongoing-' + cIdx);
            var endEl = document.getElementById('brm-dc-recur-end-' + cIdx);
            var freq = freqEl ? freqEl.value : 'weekly';
            var isOngoing = ongoingEl && ongoingEl.checked;
            recurringSchedules.push({ date: cardDate, freq: freq, ongoing: isOngoing, end: endEl ? endEl.value : '' });
          } else { oneTimeCards++; }
        });
        var oneTimeTotal = result.total * oneTimeCards;
        if (breakdownEl) {
          breakdownEl.innerHTML += '<br><span style="font-weight:600;color:#c8963e">Recurring: $' + result.total.toFixed(2) + '/appointment</span>';
          if (recurringCount > 1) {
            breakdownEl.innerHTML += '<br><span style="font-size:0.82rem">' + recurringCount + ' recurring schedules</span>';
          }
          if (oneTimeCards > 0) {
            breakdownEl.innerHTML += '<br><span style="font-size:0.82rem">+ $' + oneTimeTotal.toFixed(2) + ' one-time (' + oneTimeCards + ' session' + (oneTimeCards > 1 ? 's' : '') + ')</span>';
          }
          breakdownEl.innerHTML += '<br><span style="font-size:0.78rem;color:#8c6b4a">Charged the day before each appointment</span>';
        }
        // Show recurring schedule details
        if (perServiceEl && recurringSchedules.length > 0) {
          var recurHTML = '<div style="border-top:1px solid #e0d5c5;margin-top:6px;padding-top:6px">';
          recurHTML += '<div style="font-weight:600;font-size:0.78rem;color:#6b5c4d;margin-bottom:4px">Recurring Schedule:</div>';
          recurringSchedules.forEach(function(rs) {
            var dFmt = new Date(rs.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            var freqLabel = rs.freq === 'weekly' ? 'Every week' : rs.freq === 'biweekly' ? 'Every 2 weeks' : rs.freq === 'monthly' ? 'Monthly' : rs.freq;
            var endLabel = rs.ongoing ? 'Until stopped' : (rs.end ? 'Until ' + new Date(rs.end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
            recurHTML += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:0.76rem">';
            recurHTML += '<span>' + svcName + ' — ' + dFmt + '</span>';
            recurHTML += '<span style="color:#8c6b4a">' + freqLabel + (endLabel ? ' · ' + endLabel : '') + '</span></div>';
            recurHTML += '<div style="font-size:0.72rem;color:#8c6b4a;padding-left:8px">$' + result.total.toFixed(2) + '/visit · Charged the day before each appointment</div>';
          });
          recurHTML += '</div>';
          perServiceEl.innerHTML = recurHTML;
        }
        if (totalEl) totalEl.textContent = result.total.toFixed(2) + '/appt';
      } else if (totalDates > 1 && !isHS) {
        var multiTotal = result.total * totalDates;
        if (breakdownEl) breakdownEl.innerHTML += '<br><span style="font-weight:600">' + totalDates + ' appointments x $' + result.total.toFixed(2) + '</span>';
        // Show per-date-card breakdown
        if (perServiceEl && window._brmGetDateCardsData) {
          var cards = window._brmGetDateCardsData();
          if (cards.length > 1) {
            var listHTML = '<div style="border-top:1px solid #e0d5c5;margin-top:6px;padding-top:6px">';
            listHTML += '<div style="font-weight:600;font-size:0.78rem;color:#6b5c4d;margin-bottom:4px">Per Appointment:</div>';
            cards.forEach(function(dc, idx) {
              var dFmt = new Date(dc.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              var tFmt = dc.time ? ((typeof fmt12h === 'function') ? fmt12h(dc.time) : dc.time) : '';
              listHTML += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:0.76rem">';
              listHTML += '<span>' + svcName + ' — ' + dFmt + (tFmt ? ' at ' + tFmt : '') + '</span>';
              listHTML += '<span style="font-weight:600">$' + result.total.toFixed(2) + '</span></div>';
            });
            listHTML += '</div>';
            perServiceEl.innerHTML = listHTML;
          } else {
            perServiceEl.innerHTML = '';
          }
        }
        if (totalEl) totalEl.textContent = multiTotal.toFixed(2);
      } else {
        if (perServiceEl) perServiceEl.innerHTML = '';
        if (totalEl) totalEl.textContent = result.total.toFixed(2);
      }

      if (holidayFlag && dateVal) {
        var holidayNote = breakdownEl.querySelector('.brm-holiday-note');
        if (!holidayNote) {
          var note = document.createElement('div');
          note.className = 'brm-holiday-note';
          note.style.cssText = 'color:#c8963e;font-size:0.78rem;margin-top:4px;font-style:italic';
          note.textContent = 'Holiday rate applies for this date';
          breakdownEl.appendChild(note);
        }
      }

      // ── Apply active deal discount ──
      var activeDeal = _findDealForService(svcName, result.total);
      // Remove old discount note if present
      var oldDealNote = breakdownEl ? breakdownEl.querySelector('.brm-deal-note') : null;
      if (oldDealNote) oldDealNote.remove();

      if (activeDeal && result.total > 0) {
        // Calculate the displayed total (could be multi-date or single)
        var displayedTotal = result.total;
        if (totalDates > 1 && !isHS) displayedTotal = result.total * totalDates;
        else if (isHS) displayedTotal = result.total;

        var dealResult = _applyDeal(activeDeal, displayedTotal);
        if (dealResult.savingsAmount > 0) {
          // Update the total display with strikethrough + new price
          if (totalEl) {
            var origText = totalEl.textContent;
            totalEl.innerHTML = '<span style="text-decoration:line-through;color:var(--mid);font-weight:400;font-size:0.85em">$' + displayedTotal.toFixed(2) + '</span> $' + dealResult.discountedTotal.toFixed(2);
          }
          // Show discount banner
          if (breakdownEl) {
            var dealNote = document.createElement('div');
            dealNote.className = 'brm-deal-note';
            dealNote.style.cssText = 'background:linear-gradient(135deg,rgba(61,90,71,0.08),rgba(61,90,71,0.03));border:1px solid rgba(61,90,71,0.2);border-radius:8px;padding:8px 12px;margin-top:8px';
            var discLabel = activeDeal.discount_type === 'percent' ? activeDeal.discount_value + '% off' : '$' + Number(activeDeal.discount_value).toFixed(0) + ' off';
            dealNote.innerHTML = '<div style="font-weight:700;font-size:0.82rem;color:var(--forest)">🏷️ ' + (activeDeal.name || 'Special') + ' — ' + discLabel + '</div>' +
              '<div style="font-size:0.78rem;color:var(--forest)">You save $' + dealResult.savingsAmount.toFixed(2) + '!</div>';
            breakdownEl.appendChild(dealNote);
          }
          // Store discounted total on window for submit to pick up
          window._brmDealDiscount = { deal: activeDeal, savings: dealResult.savingsAmount, discountedTotal: dealResult.discountedTotal, originalTotal: displayedTotal };
        } else {
          window._brmDealDiscount = null;
        }
      } else {
        window._brmDealDiscount = null;
      }
    }

    // Show estimated end time based on start time + duration
    function updateEndTimeDisplay() {
      var display = document.getElementById('brm-endtime-display');
      if (!display) return;
      var timeVal = (document.getElementById('brm-time') || {}).value;
      var svcGroup = (document.getElementById('brm-service') || {}).value || '';
      var isHS = svcGroup.toLowerCase().indexOf('house sitting') !== -1;
      var isMG = svcGroup === 'Meet & Greet';

      if (!timeVal || isHS) { display.style.display = 'none'; return; }

      // Determine duration in minutes
      var durMinutes = 30; // default
      if (isMG) {
        durMinutes = 15; // Meet & Greet is quick
      } else {
        var durVal = (document.getElementById('brm-duration') || {}).value || '30 min';
        durMinutes = durVal.indexOf('hour') !== -1 || durVal.indexOf('60') !== -1 ? 60 : 30;
      }

      // Parse start time (HH:MM)
      var parts = timeVal.split(':');
      var startH = parseInt(parts[0]);
      var startM = parseInt(parts[1]);
      var totalMin = startH * 60 + startM + durMinutes;
      var endH = Math.floor(totalMin / 60) % 24;
      var endM = totalMin % 60;

      // Format as 12-hour
      var hr12 = endH > 12 ? endH - 12 : (endH === 0 ? 12 : endH);
      var ampm = endH >= 12 ? 'PM' : 'AM';
      var endStr = hr12 + ':' + (endM === 0 ? '00' : endM < 10 ? '0' + endM : endM) + ' ' + ampm;

      // Format start as 12-hour too
      var sHr12 = startH > 12 ? startH - 12 : (startH === 0 ? 12 : startH);
      var sAmpm = startH >= 12 ? 'PM' : 'AM';
      var startStr = sHr12 + ':' + (startM === 0 ? '00' : startM < 10 ? '0' + startM : startM) + ' ' + sAmpm;

      display.style.display = '';
      display.textContent = 'Est. ' + startStr + ' → ' + endStr + ' (' + (durMinutes >= 60 ? (durMinutes / 60) + ' hr' : durMinutes + ' min') + ')';
    }
    window._updateEndTimeDisplay = updateEndTimeDisplay;

    // Map pet combo dropdown to hidden fields
    function syncPetCombo() {
      var combo = document.getElementById('brm-petcombo');
      var typeEl = document.getElementById('brm-pettype');
      var numEl = document.getElementById('brm-numpets');
      if (!combo || !typeEl || !numEl) return;

      var map = {
        '1dog':    { type: 'dog',  num: 1 },
        '1cat':    { type: 'cat',  num: 1 },
        '2dogs':   { type: 'dog',  num: 2 },
        '2cats':   { type: 'cat',  num: 2 },
        '1dog1cat':{ type: 'both', num: 2 },
        '3plus':   { type: 'dog',  num: 3 },
      };

      var val = map[combo.value];
      if (val) {
        typeEl.value = val.type;
        numEl.value = val.num;
      }
      updatePriceEstimate();
    }

    // Show/hide end date field for House Sitting
    function toggleHouseSittingFields() {
      toggleDurationField();
      var svcName = (document.getElementById('brm-service').value || '').toLowerCase();
      var isHS = svcName.indexOf('house sitting') !== -1;
      var endCol = document.getElementById('brm-enddate-col');
      var endInput = document.getElementById('brm-enddate');
      var dateLabel = document.getElementById('brm-date-label');
      var timeCol = document.getElementById('brm-time-col');

      if (endCol) endCol.style.display = isHS ? '' : 'none';
      if (endInput) endInput.required = isHS;
      if (dateLabel) dateLabel.textContent = isHS ? 'Start Date *' : 'Preferred Date *';
      // Block past dates on House Sitting date inputs
      var todayISO = _localDateStr();
      var startInput = document.getElementById('brm-date');
      if (startInput) startInput.setAttribute('min', todayISO);
      if (endInput) endInput.setAttribute('min', todayISO);
      // Also set end date min to start date if start date is selected
      if (startInput && startInput.value) {
        if (endInput) endInput.setAttribute('min', startInput.value);
      }
      // For house sitting, change time label to check-in time
      if (timeCol) {
        var timeLabel = timeCol.querySelector('.brm-label');
        if (timeLabel) timeLabel.textContent = isHS ? 'Check-In Time *' : 'Preferred Time *';
      }

      // Filter pet combo options based on selected service
      var combo = document.getElementById('brm-petcombo');
      if (combo) {
        var isDogHS = svcName.indexOf('house sitting (dog)') !== -1;
        var isCatHS = svcName.indexOf('house sitting (cat)') !== -1;
        var allOpts = [
          { val: '',          lbl: 'How many pets?',  show: true },
          { val: '1dog',      lbl: '1 Dog',           show: !isCatHS },
          { val: '1cat',      lbl: '1 Cat',           show: !isDogHS },
          { val: '2dogs',     lbl: '2 Dogs',          show: !isCatHS },
          { val: '2cats',     lbl: '2 Cats',           show: !isDogHS },
          { val: '1dog1cat',  lbl: '1 Dog & 1 Cat',   show: true },
          { val: '3plus',     lbl: '3 or More+',       show: true },
        ];
        var curVal = combo.value;
        combo.innerHTML = allOpts.filter(function(o){ return o.show; }).map(function(o){
          return '<option value="' + o.val + '">' + o.lbl + '</option>';
        }).join('');
        // Restore selection if still valid, otherwise reset
        combo.value = curVal;
        if (combo.selectedIndex <= 0 && curVal) {
          combo.selectedIndex = 0;
          syncPetCombo();
        }
      }

      // Auto-set end date to next day if start date is set and end date is empty
      if (isHS && endInput) {
        var startDate = document.getElementById('brm-date').value;
        if (startDate && !endInput.value) {
          var next = new Date(startDate + 'T12:00:00');
          next.setDate(next.getDate() + 1);
          endInput.value = _localDateStr(next);
        }
        // Set min of end date to day after start
        if (startDate) {
          var minEnd = new Date(startDate + 'T12:00:00');
          minEnd.setDate(minEnd.getDate() + 1);
          endInput.setAttribute('min', _localDateStr(minEnd));
        }
      }
    }

    // Attach listeners for live update
    setTimeout(function() {
      ['brm-service', 'brm-date', 'brm-enddate'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', function() {
          if (id === 'brm-service') { toggleHouseSittingFields(); updateEndTimeDisplay(); }
          if (id === 'brm-date') toggleHouseSittingFields(); // update end date min/default
          updatePriceEstimate();
        });
      });
      var durEl = document.getElementById('brm-duration');
      if (durEl) durEl.addEventListener('change', function() { updatePriceEstimate(); updateEndTimeDisplay(); });

      // Time + duration → estimated end time
      var timeEl = document.getElementById('brm-time');
      if (timeEl) timeEl.addEventListener('change', updateEndTimeDisplay);
      var comboEl = document.getElementById('brm-petcombo');
      if (comboEl) comboEl.addEventListener('change', syncPetCombo);
      var puppyEl = document.getElementById('brm-puppy');
      if (puppyEl) puppyEl.addEventListener('change', updatePriceEstimate);

      // Build the visual calendar date picker
      window._brmCalPickerYear = new Date().getFullYear();
      window._brmCalPickerMonth = new Date().getMonth();
      window._buildBrmCalPicker();


      // Toggle between House Sitting (date range) vs regular services (date cards)
      var svcEl = document.getElementById('brm-service');
      if (svcEl) {
        svcEl.addEventListener('change', function() {
          var isHS = (svcEl.value || '').toLowerCase().indexOf('house sitting') !== -1;
          var multiSec = document.getElementById('brm-multidate-section');
          var hsRow = document.getElementById('brm-hs-date-row');
          // House Sitting: show date range, hide cards
          if (multiSec) multiSec.style.display = isHS ? 'none' : '';
          if (hsRow) hsRow.style.display = isHS ? '' : 'none';
        });
      }
    }, 100);

    // ── Multi-date: unified date cards with time + pet per date ──
    window._brmDateCards = []; // { date, time, pets[] }
    var _brmDateCardIdx = 0;

    // Generate time options HTML (same as main time picker)
    function _brmTimeOptionsHTML() {
      var opts = '<option value="">Time...</option>';
      for (var h = 5; h <= 22; h++) {
        for (var m = 0; m < 60; m += 30) {
          var hr12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
          var ampm = h >= 12 ? 'PM' : 'AM';
          var mm = m === 0 ? '00' : '30';
          var label = hr12 + ':' + mm + ' ' + ampm;
          var val24 = (h < 10 ? '0' : '') + h + ':' + mm;
          opts += '<option value="' + val24 + '">' + label + '</option>';
        }
      }
      return opts;
    }

    // Generate compact pet checkboxes for a date card
    function _brmPetChipsHTML(cardIdx) {
      var pets = window._bookingPetsData || [];
      if (pets.length === 0) return '';
      var html = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">';
      pets.forEach(function(pet) {
        var icon = pet.species === 'cat' ? '🐱' : '🐶';
        html += '<label style="display:flex;align-items:center;gap:4px;padding:4px 10px;' +
          'background:#fff;border:1.5px solid #e0d5c5;border-radius:8px;cursor:pointer;' +
          'font-size:0.8rem;font-weight:600;transition:all 0.15s" class="brm-dc-pet-label">' +
          '<input type="checkbox" class="brm-dc-pet" data-card="' + cardIdx + '" ' +
          'value="' + pet.id + '" data-name="' + (pet.name || '').replace(/"/g, '&quot;') + '" ' +
          'data-species="' + (pet.species || 'dog') + '" ' +
          'onchange="this.closest(\'label\').style.borderColor=this.checked?\'#c8963e\':\'#e0d5c5\';' +
          'this.closest(\'label\').style.background=this.checked?\'#fff8ec\':\'#fff\'" ' +
          'style="width:14px;height:14px;accent-color:#c8963e">' +
          icon + ' ' + (pet.name || 'Pet') + '</label>';
      });
      html += '</div>';
      return html;
    }

    // Sync hidden brm-date and brm-time from the first date card (for backward compat)
    function _syncPrimaryFromCards() {
      var cards = window._brmGetDateCardsData();
      var dateEl = document.getElementById('brm-date');
      var timeEl = document.getElementById('brm-time');
      if (cards.length > 0) {
        if (dateEl) dateEl.value = cards[0].date;
        if (timeEl) timeEl.value = cards[0].time || '';
      } else {
        if (dateEl) dateEl.value = '';
        if (timeEl) timeEl.value = '';
      }
      // Toggle helper message
      var msg = document.getElementById('brm-no-dates-msg');
      if (msg) msg.style.display = cards.length > 0 ? 'none' : '';
      // Update selected-dates chip strip
      _updateSelectedChips();
    }

    // Render a row of small date chips above the calendar showing selected dates
    function _updateSelectedChips() {
      var container = document.getElementById('brm-selected-chips');
      if (!container) return;
      var cardData = window._brmDateCards || [];
      if (cardData.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
      }
      container.style.display = 'flex';
      var html = '';
      cardData.forEach(function(c) {
        if (!c) return;
        var d = new Date(c.date + 'T12:00:00');
        var label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        html += '<span style="display:inline-flex;align-items:center;gap:4px;background:#c8963e;color:#fff;' +
          'border-radius:20px;padding:4px 10px;font-size:0.78rem;font-weight:600;white-space:nowrap">' +
          label +
          '<button type="button" onclick="window._brmRemoveDateCard(' + c.idx + ')" ' +
          'style="background:none;border:none;color:rgba(255,255,255,0.8);cursor:pointer;font-size:14px;line-height:1;padding:0 2px;font-weight:700">&times;</button>' +
          '</span>';
      });
      container.innerHTML = html;
    }

    window._brmAddDateCard = function() {
      var dateInput = document.getElementById('brm-add-date-input');
      if (!dateInput || !dateInput.value) {
        dateInput && dateInput.focus();
        return;
      }
      var dateVal = dateInput.value;

      // Prevent past dates
      var todayStr = _localDateStr();
      if (dateVal < todayStr) {
        if (typeof toast === 'function') toast('Please select a future date.');
        dateInput.value = '';
        return;
      }

      // Check for duplicate
      var isDupe = window._brmDateCards.some(function(c) { return c && c.date === dateVal; });
      if (isDupe) {
        if (typeof toast === 'function') toast('That date is already added.');
        dateInput.value = '';
        return;
      }

      var idx = _brmDateCardIdx++;
      window._brmDateCards.push({ idx: idx, date: dateVal });

      var container = document.getElementById('brm-dates-list');
      if (!container) return;

      // Format the date for display
      var d = new Date(dateVal + 'T12:00:00');
      var dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      var monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      // Build the recurring options HTML for this card
      // No default end date — let the client choose their own
      var todayStr = _localDateStr();

      var card = document.createElement('div');
      card.id = 'brm-dc-' + idx;
      card.setAttribute('data-date', dateVal);
      card.style.cssText = 'background:#f9f6f0;border:1px solid #e0d5c5;border-radius:10px;padding:12px 14px;position:relative';
      card.innerHTML =
        '<button type="button" onclick="window._brmRemoveDateCard(' + idx + ')" style="position:absolute;top:8px;right:10px;background:none;border:none;color:#c4756a;cursor:pointer;font-size:18px;line-height:1">&times;</button>' +
        '<div style="font-weight:700;font-size:0.92rem;color:#1e1409;margin-bottom:6px">' +
          '<span style="color:#c8963e">' + dayName + '</span> ' + monthDay +
        '</div>' +
        '<div id="brm-dc-times-' + idx + '">' +
          '<div class="brm-time-slot" data-slot="0" style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
            '<select id="brm-dc-time-' + idx + '" class="brm-input brm-dc-time-sel" data-card="' + idx + '" onchange="window._brmSyncPrimary();updatePriceEstimate()" style="flex:1;min-width:120px;max-width:180px;margin:0;padding:6px 8px;font-size:0.82rem">' +
              _brmTimeOptionsHTML() +
            '</select>' +
          '</div>' +
        '</div>' +
        '<button type="button" onclick="window._brmAddTimeSlot(' + idx + ')" style="background:none;border:1px dashed #c8963e;color:#c8963e;border-radius:6px;padding:4px 12px;font-size:0.78rem;font-weight:600;cursor:pointer;margin-top:2px;margin-bottom:4px">+ Add another time</button>' +
        '<div style="margin-top:8px;border-top:1px dashed #e0d5c5;padding-top:8px">' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;cursor:pointer;color:#6b5c4d;font-weight:600">' +
            '<input type="checkbox" id="brm-dc-recur-' + idx + '" onchange="window._brmToggleCardRecur(' + idx + ')" style="accent-color:#c8963e">' +
            ' Make this recurring' +
          '</label>' +
          '<div id="brm-dc-recur-opts-' + idx + '" style="display:none;margin-top:8px;background:#fff;border:1px solid #e8dece;border-radius:8px;padding:10px">' +
            '<div style="display:flex;flex-direction:column;gap:8px">' +
              '<div>' +
                '<label style="font-size:0.75rem;font-weight:600;color:#8c6b4a;display:block;margin-bottom:3px">Frequency</label>' +
                '<select id="brm-dc-freq-' + idx + '" class="brm-input" onchange="window._brmUpdateCardRecurPreview(' + idx + ')" style="margin:0;padding:6px 10px;font-size:0.85rem;width:100%;box-sizing:border-box;height:38px;border:1px solid #d4c5b0;border-radius:6px;background:#fff;color:#4a3728">' +
                  '<option value="weekly">Every week</option>' +
                  '<option value="biweekly">Every other week</option>' +
                '</select>' +
              '</div>' +
              '<div id="brm-dc-end-wrap-' + idx + '">' +
                '<label style="font-size:0.75rem;font-weight:600;color:#8c6b4a;display:block;margin-bottom:3px">Until</label>' +
                '<input type="date" id="brm-dc-recur-end-' + idx + '" class="brm-input" value="" min="' + dateVal + '" onchange="window._brmUpdateCardRecurPreview(' + idx + ')" style="margin:0;padding:6px 10px;font-size:0.85rem;width:100%;box-sizing:border-box;height:38px;-webkit-appearance:none;appearance:none;border:1px solid #d4c5b0;border-radius:6px;background:#fff;color:#4a3728">' +
              '</div>' +
              '<label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;color:#6b5c4d;cursor:pointer">' +
                '<input type="checkbox" id="brm-dc-ongoing-' + idx + '" onchange="window._brmToggleOngoing(' + idx + ')" style="accent-color:#c8963e;width:16px;height:16px"> Until stopped (no end date)' +
              '</label>' +
            '</div>' +
            '<div id="brm-dc-recur-preview-' + idx + '" style="margin-top:8px;font-size:0.78rem;color:#6b5c4d;max-height:80px;overflow-y:auto"></div>' +
          '</div>' +
        '</div>';
      container.appendChild(card);

      // Clear the date input for next selection
      dateInput.value = '';
      dateInput._lastVal = '';
      _syncPrimaryFromCards();
      updatePriceEstimate();
    };

    window._brmRemoveDateCard = function(idx) {
      var card = document.getElementById('brm-dc-' + idx);
      if (card) card.remove();
      window._brmDateCards = window._brmDateCards.filter(function(c) { return c && c.idx !== idx; });
      _syncPrimaryFromCards();
      updatePriceEstimate();
      // Refresh calendar picker to un-highlight removed date
      if (typeof window._buildBrmCalPicker === 'function') window._buildBrmCalPicker();
    };

    // Expose sync for time dropdown changes
    window._brmSyncPrimary = _syncPrimaryFromCards;

    // Add another time slot to a date card
    window._brmAddTimeSlot = function(cardIdx) {
      var container = document.getElementById('brm-dc-times-' + cardIdx);
      if (!container) return;
      var slots = container.querySelectorAll('.brm-time-slot');
      var slotIdx = slots.length;
      var div = document.createElement('div');
      div.className = 'brm-time-slot';
      div.setAttribute('data-slot', slotIdx);
      div.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px';
      div.innerHTML =
        '<select class="brm-input brm-dc-time-sel" data-card="' + cardIdx + '" onchange="window._brmSyncPrimary();updatePriceEstimate()" style="flex:1;min-width:120px;max-width:180px;margin:0;padding:6px 8px;font-size:0.82rem">' +
          _brmTimeOptionsHTML() +
        '</select>' +
        '<button type="button" onclick="window._brmRemoveTimeSlot(this,' + cardIdx + ')" style="background:none;border:none;color:#c4756a;cursor:pointer;font-size:16px;line-height:1;padding:2px 6px">&times;</button>';
      container.appendChild(div);
      _syncPrimaryFromCards();
      updatePriceEstimate();
    };

    // Remove a time slot from a date card
    window._brmRemoveTimeSlot = function(btn, cardIdx) {
      var slot = btn.closest('.brm-time-slot');
      if (slot) slot.remove();
      _syncPrimaryFromCards();
      updatePriceEstimate();
    };

    // ── Visual calendar date picker ──
    window._buildBrmCalPicker = function() {
      var container = document.getElementById('brm-cal-picker');
      if (!container) return;
      var year = window._brmCalPickerYear;
      var month = window._brmCalPickerMonth;
      var names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      var dayLabels = ['Su','Mo','Tu','We','Th','Fr','Sa'];
      var firstDay = new Date(year, month, 1).getDay();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var today = new Date();
      var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      var isCurrentMonth = (month === today.getMonth() && year === today.getFullYear());

      // Get selected dates from cards
      var selectedDates = {};
      (window._brmDateCards || []).forEach(function(c) { if (c) selectedDates[c.date] = true; });

      // Get holidays
      var monthHolidays = (typeof getMonthHolidays === 'function') ? getMonthHolidays(year, month) : {};

      // Get owner blocked dates
      var ownerBlocked = window._calOwnerBlocks || {};

      var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
      html += '<button type="button" onclick="window._brmCalPickerMonth--;if(window._brmCalPickerMonth<0){window._brmCalPickerMonth=11;window._brmCalPickerYear--;}window._buildBrmCalPicker()" style="background:none;border:1px solid #e0d5c5;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:1rem;color:#1e1409">&#8592;</button>';
      html += '<span style="font-weight:700;font-size:0.9rem;color:#1e1409">' + names[month] + ' ' + year + '</span>';
      html += '<button type="button" onclick="window._brmCalPickerMonth++;if(window._brmCalPickerMonth>11){window._brmCalPickerMonth=0;window._brmCalPickerYear++;}window._buildBrmCalPicker()" style="background:none;border:1px solid #e0d5c5;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:1rem;color:#1e1409">&#8594;</button>';
      html += '</div>';

      if (!isCurrentMonth) {
        html += '<div style="text-align:center;margin-bottom:6px"><button type="button" onclick="window._brmCalPickerMonth=new Date().getMonth();window._brmCalPickerYear=new Date().getFullYear();window._buildBrmCalPicker()" style="background:#fff8ec;border:1px solid #c8963e;border-radius:6px;padding:3px 12px;cursor:pointer;font-size:0.75rem;font-weight:600;color:#1e1409">Back to Today</button></div>';
      }

      html += '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;text-align:center">';
      dayLabels.forEach(function(dl) {
        html += '<div style="font-size:0.7rem;font-weight:700;color:#8c6b4a;padding:4px 0">' + dl + '</div>';
      });

      for (var i = 0; i < firstDay; i++) {
        html += '<div></div>';
      }

      for (var d = 1; d <= daysInMonth; d++) {
        var key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var isPast = key < todayStr;
        var isToday = key === todayStr;
        var isSelected = selectedDates[key] || false;
        var holiday = monthHolidays[key] || null;
        var isBlocked = ownerBlocked[key] ? true : false;

        var bg = 'white';
        var color = '#1e1409';
        var border = '1px solid #e8dece';
        var cursor = 'pointer';
        var opacity = '1';
        var fontWeight = '600';

        if (isPast) { bg = '#f5f2ed'; color = '#bbb'; cursor = 'default'; opacity = '0.5'; }
        else if (isBlocked) { bg = '#fce8e6'; color = '#c4756a'; cursor = 'not-allowed'; }
        else if (isSelected) { bg = '#c8963e'; color = '#fff'; border = '1px solid #a07830'; }
        else if (isToday) { bg = '#fff8ec'; border = '1px solid #c8963e'; }

        var onclick = '';
        if (!isPast && !isBlocked) {
          onclick = ' onclick="window._brmToggleCalDate(\'' + key + '\')"';
        }

        var title = '';
        if (holiday) title = holiday;
        if (isBlocked) title = (title ? title + ' — ' : '') + 'Rachel is unavailable';

        html += '<div' + onclick + ' title="' + title + '" style="';
        html += 'background:' + bg + ';color:' + color + ';border:' + border + ';';
        html += 'border-radius:8px;padding:6px 2px;cursor:' + cursor + ';opacity:' + opacity + ';';
        html += 'font-size:0.82rem;font-weight:' + fontWeight + ';position:relative;min-height:32px;';
        html += 'display:flex;flex-direction:column;align-items:center;justify-content:center;';
        html += 'transition:all 0.15s;user-select:none">';
        html += d;
        if (holiday) html += '<div style="font-size:0.5rem;line-height:1;color:' + (isSelected ? 'rgba(255,255,255,0.8)' : '#c8963e') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">' + holiday + '</div>';
        if (isBlocked && !isPast) html += '<div style="font-size:0.5rem;line-height:1;color:#c4756a">closed</div>';
        html += '</div>';
      }
      html += '</div>';

      // Selected count
      var selCount = Object.keys(selectedDates).length;
      if (selCount > 0) {
        html += '<div style="margin-top:8px;text-align:center;font-size:0.82rem;color:#6b5c4d;font-weight:600">' + selCount + ' date' + (selCount > 1 ? 's' : '') + ' selected</div>';
      }

      container.innerHTML = html;
    };

    // Toggle a date on/off from the calendar picker
    window._brmToggleCalDate = function(dateStr) {
      // Check if already selected
      var existingIdx = -1;
      window._brmDateCards.forEach(function(c, i) {
        if (c && c.date === dateStr) existingIdx = i;
      });

      if (existingIdx >= 0) {
        // Remove this date
        var cardData = window._brmDateCards[existingIdx];
        if (cardData) {
          var cardEl = document.getElementById('brm-dc-' + cardData.idx);
          if (cardEl) cardEl.remove();
        }
        window._brmDateCards.splice(existingIdx, 1);
        _syncPrimaryFromCards();
        updatePriceEstimate();
      } else {
        // Add this date — set hidden input and call existing add function
        var addInput = document.getElementById('brm-add-date-input');
        if (addInput) addInput.value = dateStr;
        window._brmAddDateCard();
      }
      // Refresh calendar to show updated selection
      window._buildBrmCalPicker();

      // Update no-dates message
      var noMsg = document.getElementById('brm-no-dates-msg');
      if (noMsg) noMsg.style.display = (window._brmDateCards.length > 0) ? 'none' : '';
    };

    // Get all selected date cards data (used by submission)
    // Returns one entry per time slot — so a day with 2 times = 2 entries
    window._brmGetDateCardsData = function() {
      var results = [];
      var cards = document.querySelectorAll('#brm-dates-list > div[data-date]');
      cards.forEach(function(card) {
        var dateVal = card.getAttribute('data-date');
        var idx = card.id.replace('brm-dc-', '');
        // Collect all time slots for this card
        var timeSelects = card.querySelectorAll('.brm-dc-time-sel');
        if (timeSelects.length === 0) {
          // Fallback: legacy single select
          var timeEl = document.getElementById('brm-dc-time-' + idx);
          results.push({ date: dateVal, time: timeEl ? timeEl.value : '', pets: [] });
        } else {
          timeSelects.forEach(function(sel) {
            results.push({ date: dateVal, time: sel.value || '', pets: [] });
          });
        }
      });
      return results;
    };

    // Legacy _brmExtraDates getter for backward compatibility with price calc
    Object.defineProperty(window, '_brmExtraDates', {
      get: function() {
        // Return all cards EXCEPT the first one (since first = primary date)
        var cards = (window._brmDateCards || []);
        return cards.slice(1).map(function(c) { return c ? c.date : null; });
      },
      configurable: true,
      enumerable: true
    });

    // ── Per-card recurring: toggle, preview, and date generation ──
    window._brmToggleCardRecur = function(idx) {
      var cb = document.getElementById('brm-dc-recur-' + idx);
      var opts = document.getElementById('brm-dc-recur-opts-' + idx);
      if (!cb || !opts) return;
      opts.style.display = cb.checked ? '' : 'none';
      if (cb.checked) {
        window._brmUpdateCardRecurPreview(idx);
      }
      updatePriceEstimate();
    };

    // Toggle "until stopped" checkbox — hides/shows the end date field
    window._brmToggleOngoing = function(idx) {
      var ongoing = document.getElementById('brm-dc-ongoing-' + idx);
      var endWrap = document.getElementById('brm-dc-end-wrap-' + idx);
      if (!ongoing) return;
      if (endWrap) endWrap.style.display = ongoing.checked ? 'none' : '';
      window._brmUpdateCardRecurPreview(idx);
    };

    window._brmUpdateCardRecurPreview = function(idx) {
      var preview = document.getElementById('brm-dc-recur-preview-' + idx);
      if (!preview) return;
      var ongoing = document.getElementById('brm-dc-ongoing-' + idx);
      var isOngoing = ongoing && ongoing.checked;
      var freq = (document.getElementById('brm-dc-freq-' + idx) || {}).value || 'weekly';
      var freqLabel = freq === 'weekly' ? 'every week' : 'every other week';
      var card = document.getElementById('brm-dc-' + idx);
      var startDate = card ? card.getAttribute('data-date') : '';

      if (isOngoing) {
        var startFmt = startDate ? new Date(startDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : '';
        preview.innerHTML = '<span style="color:#c8963e;font-weight:600">Repeats ' + freqLabel + '</span> starting ' + startFmt + '<br><em>Charged the day before each visit · continues until you cancel</em>';
      } else {
        var dates = _getCardRecurDates(idx);
        if (dates.length === 0) {
          preview.innerHTML = '<em>Set an end date to see your recurring dates.</em>';
        } else {
          var formatted = dates.map(function(d) {
            return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          });
          preview.innerHTML = '<strong>' + dates.length + ' appointment' + (dates.length > 1 ? 's' : '') + ':</strong><br>' +
            formatted.map(function(f) { return '<span class="brm-date-tag">' + f + '</span>'; }).join(' ');
        }
      }
      updatePriceEstimate();
    };

    // Generate recurring dates for a specific card (only for cards with end dates)
    function _getCardRecurDates(idx) {
      var card = document.getElementById('brm-dc-' + idx);
      if (!card) return [];
      var startDate = card.getAttribute('data-date');
      if (!startDate) return [];
      var cb = document.getElementById('brm-dc-recur-' + idx);
      if (!cb || !cb.checked) return [];
      // If "until stopped", no finite date list
      var ongoing = document.getElementById('brm-dc-ongoing-' + idx);
      if (ongoing && ongoing.checked) return [];
      var freq = (document.getElementById('brm-dc-freq-' + idx) || {}).value || 'weekly';
      var endStr = (document.getElementById('brm-dc-recur-end-' + idx) || {}).value;
      if (!endStr) return [];

      var intervalDays = freq === 'biweekly' ? 14 : 7;
      var start = new Date(startDate + 'T12:00:00');
      var end = new Date(endStr + 'T12:00:00');
      var dates = [];

      // Start from the card's date, repeat at same day-of-week
      for (var d = new Date(start); d <= end; d.setDate(d.getDate() + intervalDays)) {
        dates.push(_localDateStr(d));
      }
      return dates;
    }

    // Check if a card is "ongoing" (until stopped)
    function _isCardOngoing(idx) {
      var ongoing = document.getElementById('brm-dc-ongoing-' + idx);
      return ongoing && ongoing.checked;
    }

    // Get ALL recurring dates across ALL cards (for submission + price calc)
    function getRecurDates() {
      var allDates = [];
      var cards = document.querySelectorAll('#brm-dates-list > div[data-date]');
      cards.forEach(function(card) {
        var idx = card.id.replace('brm-dc-', '');
        var recurDates = _getCardRecurDates(parseInt(idx));
        recurDates.forEach(function(d) {
          if (allDates.indexOf(d) === -1) allDates.push(d);
        });
      });
      return allDates.sort();
    }
    window._brmGetRecurDates = getRecurDates;

    // Check if any card has recurring enabled
    function _anyCardIsRecurring() {
      var cards = document.querySelectorAll('#brm-dates-list > div[data-date]');
      var found = false;
      cards.forEach(function(card) {
        var idx = card.id.replace('brm-dc-', '');
        var cb = document.getElementById('brm-dc-recur-' + idx);
        if (cb && cb.checked) found = true;
      });
      return found;
    }
    window._brmAnyCardRecurring = _anyCardIsRecurring;

    // Backward-compat: updateRecurPreview is a no-op now (per-card handles it)
    function updateRecurPreview() { /* handled per-card */ }

    // ── Greeting for logged-in clients ──
    function showGreeting() {
      var greetingEl = document.getElementById('brm-greeting');
      var nameSpan = document.getElementById('brm-greeting-name');
      if (!greetingEl || !nameSpan) return;
      if (window.HHP_Auth && window.HHP_Auth.currentUser) {
        var p = window.HHP_Auth.currentUser.profile || {};
        var firstName = (p.full_name || '').split(' ')[0];
        if (firstName) {
          nameSpan.textContent = firstName;
          greetingEl.style.display = '';
        }
      }
    }

    setTimeout(showGreeting, 400);
  }

  // Inject modal CSS
  function injectBookingCSS() {
    var css = document.createElement('style');
    css.id = 'hhp-booking-css';
    css.textContent = [
      '#bookingRequestModal {',
      '  display: none;',
      '  position: fixed;',
      '  top: 0; left: 0; right: 0; bottom: 0;',
      '  z-index: 99999;',
      '  align-items: center;',
      '  justify-content: center;',
      '}',
      '#bookingRequestModal.open { display: flex; }',
      '.brm-backdrop {',
      '  position: absolute;',
      '  top: 0; left: 0; right: 0; bottom: 0;',
      '  background: rgba(0,0,0,0.5);',
      '}',
      '.brm-content {',
      '  position: relative;',
      '  background: #FFFDF8;',
      '  border-radius: 16px;',
      '  padding: 32px;',
      '  max-width: 560px;',
      '  width: 90%;',
      '  max-height: 85vh;',
      '  overflow-y: auto;',
      '  -webkit-overflow-scrolling: auto;',
      '  overscroll-behavior: contain;',
      '  box-shadow: 0 20px 60px rgba(0,0,0,0.2);',
      '}',
      '.brm-close {',
      '  position: absolute;',
      '  top: 16px; right: 16px;',
      '  width: 38px; height: 38px;',
      '  border-radius: 50%;',
      '  background: #f0ece4; border: none;',
      '  font-size: 1.1rem; cursor: pointer;',
      '  color: #5c4a32; line-height: 1;',
      '  display: flex; align-items: center; justify-content: center;',
      '  transition: background 0.2s;',
      '  z-index: 2;',
      '}',
      '.brm-close:hover { background: #f5d5d5; color: #333; }',
      '.brm-title {',
      '  font-family: "Playfair Display", Georgia, serif;',
      '  font-size: 26px;',
      '  color: var(--ink, #2C2C2C);',
      '  margin: 0 0 4px;',
      '}',
      '.brm-subtitle {',
      '  color: #888;',
      '  font-size: 14px;',
      '  margin: 0 0 24px;',
      '}',
      '.brm-label {',
      '  display: block;',
      '  font-size: 13px;',
      '  font-weight: 600;',
      '  color: var(--ink, #2C2C2C);',
      '  margin: 14px 0 5px;',
      '}',
      '.brm-input {',
      '  width: 100%;',
      '  padding: 10px 14px;',
      '  border: 1px solid #ddd;',
      '  border-radius: 8px;',
      '  font-size: 15px;',
      '  font-family: inherit;',
      '  background: #fff;',
      '  box-sizing: border-box;',
      '  transition: border-color 0.2s;',
      '}',
      '.brm-input:focus { border-color: var(--gold, #C8963E); outline: none; }',
      '.brm-textarea { resize: vertical; min-height: 80px; }',
      '.brm-row { display: flex; gap: 12px; }',
      '.brm-col { flex: 1; }',
      '.brm-day-chip { display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border:1px solid #ddd;border-radius:20px;font-size:0.82rem;cursor:pointer;user-select:none;transition:all 0.2s; }',
      '.brm-day-chip:has(input:checked), .brm-day-chip.active { background:var(--gold,#C8963E);color:#fff;border-color:var(--gold,#C8963E); }',
      '.brm-day-chip input { display:none; }',
      '.brm-date-tag { display:inline-flex;align-items:center;gap:6px;background:#f0ebe3;border:1px solid #e0d5c5;border-radius:20px;padding:5px 10px;font-size:0.82rem;margin:3px 4px 3px 0; }',
      '.brm-date-tag button { background:none;border:none;color:#999;cursor:pointer;font-size:14px;line-height:1;padding:0 2px; }',
      '.brm-date-tag button:hover { color:#c4756a; }',
      '.brm-submit-btn {',
      '  display: block;',
      '  width: 100%;',
      '  padding: 14px;',
      '  margin-top: 20px;',
      '  background: var(--gold, #C8963E);',
      '  color: #fff;',
      '  border: none;',
      '  border-radius: 10px;',
      '  font-size: 16px;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  font-family: inherit;',
      '  transition: background 0.2s;',
      '}',
      '.brm-submit-btn:hover { background: var(--gold-deep, #A07428); }',
      '.brm-submit-btn:disabled { background: #ccc; cursor: not-allowed; }',
      '.brm-error { color: #C4756A; font-size: 14px; margin-top: 10px; }',
      '.brm-success { color: #3D5A47; font-size: 14px; margin-top: 10px; }',
      '',
      '@media (max-width: 600px) {',
      '  .brm-content { padding: 20px 16px; border-radius: 12px 12px 0 0; max-height: 90vh; }',
      '  .brm-row { flex-direction: column; gap: 0; }',
      '  .brm-title { font-size: 22px; }',
      '  .brm-close { width: 32px; height: 32px; font-size: 0.95rem; top: 12px; right: 12px; }',
      '}',
      '',
      // ── Admin dashboard styles ──
      '#hhpAdminDashboard {',
      '  padding: 24px;',
      '  max-width: 900px;',
      '  margin: 0 auto;',
      '}',
      '.admin-request-card {',
      '  background: #fff;',
      '  border: 1px solid #eee;',
      '  border-radius: 12px;',
      '  padding: 20px;',
      '  margin-bottom: 16px;',
      '  box-shadow: 0 2px 8px rgba(0,0,0,0.04);',
      '}',
      '.admin-request-card .arc-header {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: center;',
      '  margin-bottom: 12px;',
      '}',
      '.arc-service { font-weight: 700; font-size: 18px; color: var(--ink, #2C2C2C); }',
      '.arc-status {',
      '  padding: 4px 12px;',
      '  border-radius: 20px;',
      '  font-size: 12px;',
      '  font-weight: 600;',
      '  text-transform: uppercase;',
      '}',
      '.arc-status.pending { background: #FFF3CD; color: #856404; }',
      '.arc-status.accepted { background: #D4EDDA; color: #155724; }',
      '.arc-status.declined { background: #F8D7DA; color: #721C24; }',
      '.arc-status.modified { background: #CCE5FF; color: #004085; }',
      '.arc-detail { font-size: 14px; color: #666; margin: 4px 0; }',
      '.arc-detail strong { color: var(--ink, #2C2C2C); }',
      '.arc-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }',
      '.arc-btn {',
      '  padding: 8px 18px;',
      '  border-radius: 8px;',
      '  border: 1px solid #ddd;',
      '  font-size: 13px;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  font-family: inherit;',
      '  transition: all 0.2s;',
      '}',
      '.arc-btn.accept { background: #3D5A47; color: #fff; border-color: #3D5A47; }',
      '.arc-btn.accept:hover { background: #2a4032; }',
      '.arc-btn.decline { background: #fff; color: #C4756A; border-color: #C4756A; }',
      '.arc-btn.decline:hover { background: #F8D7DA; }',
      '.arc-btn.modify { background: #fff; color: var(--gold, #C8963E); border-color: var(--gold, #C8963E); }',
      '.arc-btn.modify:hover { background: var(--gold-pale, #FDF7EE); }',
      '',
      '/* ── Schedule Preview on Booking Cards ── */',
      '.sched-peek-btn {',
      '  background: #eef2ff; border: 1.5px solid #b8c8f0; border-radius: 8px;',
      '  width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;',
      '  font-size: 1.1rem; cursor: pointer; transition: all 0.2s; padding: 0; flex-shrink: 0;',
      '}',
      '.sched-peek-btn:hover { background: #d8e2ff; border-color: #8ca0e0; }',
      '.sched-peek-btn.active { background: #d0daff; border-color: #6b8cdb; box-shadow: 0 0 0 2px rgba(107,140,219,0.25); }',
      '.sched-preview-bar {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  padding: 8px 12px; margin-top: 10px;',
      '  background: #f0f4ff; border: 1px solid #c8d6f0; border-radius: 8px;',
      '  cursor: pointer; font-size: 0.82rem; color: #3b5998; font-weight: 600;',
      '  transition: background 0.2s;',
      '}',
      '.sched-preview-bar:hover { background: #e3ebff; }',
      '.sched-preview-arrow { font-size: 0.9rem; transition: transform 0.2s; }',
      '.sched-preview-content {',
      '  background: #f8faff; border: 1px solid #d8e2f4; border-top: none;',
      '  border-radius: 0 0 8px 8px; padding: 10px 12px; margin-top: -1px;',
      '}',
      '.sched-preview-day-label {',
      '  font-weight: 600; font-size: 0.78rem; color: #6b5c4d;',
      '  margin: 6px 0 2px; padding-bottom: 2px; border-bottom: 1px solid #e8e0d8;',
      '}',
      '.sched-preview-item {',
      '  display: flex; align-items: center; gap: 8px;',
      '  padding: 5px 8px; margin: 3px 0; background: #fff;',
      '  border: 1px solid #e8e0d8; border-radius: 6px; font-size: 0.8rem;',
      '}',
      '.sched-preview-time {',
      '  font-weight: 700; color: var(--ink, #1e1409); white-space: nowrap; min-width: 70px;',
      '}',
      '.sched-preview-service { color: #3D5A47; font-weight: 600; }',
      '.sched-preview-client { color: #888; margin-left: auto; font-size: 0.75rem; }',
      '.sched-preview-clear {',
      '  padding: 8px 10px; font-size: 0.82rem; color: #4caf50;',
      '  background: #f0faf0; border-radius: 6px; text-align: center;',
      '}',
      '',
      '.admin-filter-bar {',
      '  display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;',
      '}',
      '.admin-filter-btn {',
      '  padding: 6px 16px;',
      '  border-radius: 20px;',
      '  border: 1px solid #ddd;',
      '  background: #fff;',
      '  font-size: 13px;',
      '  cursor: pointer;',
      '  font-family: inherit;',
      '}',
      '.admin-filter-btn.active { background: var(--gold, #C8963E); color: #fff; border-color: var(--gold, #C8963E); }',
      '.admin-empty { text-align: center; color: #999; padding: 40px 20px; font-size: 16px; }',
    ].join('\n');
    document.head.appendChild(css);
  }

  // Open / Close booking modal
  window.openBookingModal = function(preselectedService) {
    // Require account — no guest bookings
    if (!window.HHP_Auth || !window.HHP_Auth.currentUser) {
      if (typeof toast === 'function') toast('Please create an account or sign in to book a service.');
      var authOverlay = document.getElementById('authOverlay');
      if (authOverlay) { authOverlay.classList.add('open'); if (typeof toggleAuthMode === 'function') toggleAuthMode('signup'); }
      return;
    }
    // Refresh deals + used-deal list right when modal opens (catches stale cache)
    _fetchActiveDeals();
    createBookingModal();
    var modal = document.getElementById('bookingRequestModal');
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';

      // Filter service dropdown to only show relevant group options
      var sel = document.getElementById('brm-service');
      if (sel) {
        if (preselectedService) {
          // Build group-based options matching the preselected service
          var matchGroup = preselectedService;
          // Check if it's a House Sitting variant
          var isHS = matchGroup.toLowerCase().indexOf('house sitting') !== -1;
          var isMG = matchGroup === 'Meet & Greet';

          if (isHS) {
            // Show only House Sitting options
            sel.innerHTML = '<option value="">Choose a service...</option>' +
              '<option value="House Sitting (Dog)">House Sitting (Dog) - $125/night</option>' +
              '<option value="House Sitting (Cat)">House Sitting (Cat) - $80/night</option>';
          } else if (isMG) {
            sel.innerHTML = '<option value="">Choose a service...</option>' +
              '<option value="Meet & Greet">Meet &amp; Greet - Free</option>';
            sel.selectedIndex = 1;
          } else {
            // Check if the preselected group exists
            var groupExists = SERVICES.some(function(s) { return s.group === matchGroup; });
            if (groupExists) {
              sel.innerHTML = '<option value="">Choose a service...</option>' +
                '<option value="' + matchGroup + '">' + matchGroup + '</option>';
              sel.selectedIndex = 1;
            } else {
              // Partial match fallback — try to find matching group
              var found = '';
              SERVICES.forEach(function(s) {
                if (!found && (s.group.toLowerCase().indexOf(matchGroup.toLowerCase()) >= 0 ||
                    matchGroup.toLowerCase().indexOf(s.group.toLowerCase()) >= 0)) {
                  found = s.group;
                }
              });
              if (found) {
                sel.innerHTML = '<option value="">Choose a service...</option>' +
                  '<option value="' + found + '">' + found + '</option>';
                sel.selectedIndex = 1;
              }
              // If still nothing, leave default dropdown as-is (all groups)
            }
          }
          // Trigger change to show duration / house sitting fields
          sel.dispatchEvent(new Event('change'));
        }
        // If no preselectedService, the default group-based dropdown from createBookingModal is fine
      }

      // Reset multi-date state on open
      window._brmDateCards = [];
      var datesListEl = document.getElementById('brm-dates-list');
      if (datesListEl) datesListEl.innerHTML = '';
      var addDateInput = document.getElementById('brm-add-date-input');
      if (addDateInput) { addDateInput.value = ''; addDateInput.defaultValue = ''; }
      // Also reset House Sitting date range inputs
      var hsDateEl = document.getElementById('brm-date');
      var hsEndEl = document.getElementById('brm-enddate');
      if (hsDateEl) { hsDateEl.value = ''; hsDateEl.defaultValue = ''; }
      if (hsEndEl) { hsEndEl.value = ''; hsEndEl.defaultValue = ''; }
      // Show the helper message and rebuild calendar picker
      var noMsg = document.getElementById('brm-no-dates-msg');
      if (noMsg) noMsg.style.display = '';
      // Reset calendar picker to current month and rebuild
      window._brmCalPickerYear = new Date().getFullYear();
      window._brmCalPickerMonth = new Date().getMonth();
      if (typeof window._buildBrmCalPicker === 'function') window._buildBrmCalPicker();

      // Pre-fill and show greeting if logged in
      if (window.HHP_Auth && window.HHP_Auth.currentUser) {
        var u = window.HHP_Auth.currentUser;
        var p = u.profile || {};
        var nameEl = document.getElementById('brm-name');
        var emailEl = document.getElementById('brm-email');
        var phoneEl = document.getElementById('brm-phone');
        var addrEl = document.getElementById('brm-address');
        if (nameEl && !nameEl.value && p.full_name) nameEl.value = p.full_name;
        if (emailEl && !emailEl.value && u.email) emailEl.value = u.email;
        if (phoneEl && !phoneEl.value && p.phone) phoneEl.value = p.phone;
        if (addrEl && !addrEl.value && p.address) addrEl.value = p.address;

        // Load pet checkboxes from saved pets
        window._loadBookingPets(u.id);

        // Show greeting
        var greetingEl = document.getElementById('brm-greeting');
        var nameSpan = document.getElementById('brm-greeting-name');
        if (greetingEl && nameSpan) {
          var firstName = (p.full_name || '').split(' ')[0];
          if (firstName) {
            nameSpan.textContent = firstName;
            greetingEl.style.display = '';
          }
        }
      } else {
        // Guest fallback removed — account required
        // Users must be logged in to reach this point
        // No guest fallback needed
        //
        //
      }
    }
  };

  // ── LOAD PET CHECKBOXES INTO BOOKING MODAL ──
  window._loadBookingPets = async function(userId) {
    var container = document.getElementById('brm-pet-checkboxes');
    if (!container) return;

    container.innerHTML = '<div style="color:#8c6b4a;font-size:0.84rem">Loading your pets...</div>';

    try {
      var sb = getSB();
      if (!sb) throw new Error('No connection');

      var { data: pets, error } = await sb
        .from('pets')
        .select('id, name, species, breed, photo_url, weight, birthday')
        .eq('owner_id', userId)
        .order('name');

      if (error) throw error;

      if (!pets || pets.length === 0) {
        container.innerHTML = [
          '<div style="background:#fff8ec;border:1px solid #e0d5c5;border-radius:10px;padding:16px;text-align:center">',
          '  <div style="font-size:1.5rem;margin-bottom:8px">🐾</div>',
          '  <div style="font-weight:600;font-size:0.9rem;color:#6b5c4d;margin-bottom:6px">Pet profile required to book</div>',
          '  <div style="font-size:0.82rem;color:#8c6b4a;margin-bottom:12px">Please create a pet profile first so Rachel has all the details she needs.</div>',
          '  <a href="#" onclick="event.preventDefault();closeBookingModal();if(typeof switchView===\'function\')switchView(\'client\');sTab(\'c\',\'c-pets\')" ',
          '     class="brm-submit" style="display:inline-block;text-decoration:none;font-size:0.85rem;padding:8px 20px">',
          '     + Create Pet Profile</a>',
          '</div>',
        ].join('\n');
        return;
      }

      // Store pets data for later use
      window._bookingPetsData = pets;

      // Render checkboxes
      var html = '';
      pets.forEach(function(pet) {
        var icon = pet.species === 'cat' ? '🐱' : '🐶';
        var breedText = pet.breed ? ' · ' + pet.breed : '';
        var weightText = pet.weight ? ' · ' + pet.weight + ' lbs' : '';
        var photoStyle = pet.photo_url
          ? 'background-image:url(' + pet.photo_url + ');background-size:cover;background-position:center;'
          : 'display:flex;align-items:center;justify-content:center;font-size:1.2rem;background:#f5f0e8;';

        html += [
          '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;',
          'background:#fff;border:2px solid #e0d5c5;border-radius:10px;cursor:pointer;',
          'transition:all 0.2s" class="brm-pet-checkbox-label"',
          ' onmouseenter="this.style.borderColor=\'#c8963e\'"',
          ' onmouseleave="if(!this.querySelector(\'input\').checked)this.style.borderColor=\'#e0d5c5\'"',
          '>',
          '  <input type="checkbox" class="brm-pet-cb" value="' + pet.id + '"',
          '    data-name="' + (pet.name || '').replace(/"/g, '&quot;') + '"',
          '    data-species="' + (pet.species || 'dog') + '"',
          '    data-birthday="' + (pet.birthday || '') + '"',
          '    onchange="window._brmUpdatePetSelection()"',
          '    style="width:18px;height:18px;accent-color:#c8963e;flex-shrink:0">',
          '  <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0;' + photoStyle + '">',
          pet.photo_url ? '' : icon,
          '  </div>',
          '  <div style="flex:1;min-width:0">',
          '    <div style="font-weight:600;font-size:0.88rem;color:#1e1409">' + (pet.name || 'Unnamed') + '</div>',
          '    <div style="font-size:0.78rem;color:#8c6b4a">' + icon + breedText + weightText + '</div>',
          '  </div>',
          '</label>',
        ].join('');
      });

      // Add "Add another pet" link
      html += [
        '<a href="#" onclick="event.preventDefault();closeBookingModal();if(typeof switchView===\'function\')switchView(\'client\');sTab(\'c\',\'c-pets\')"',
        '   style="display:inline-flex;align-items:center;gap:4px;color:#c8963e;font-size:0.82rem;',
        '   font-weight:600;text-decoration:none;margin-top:2px;padding-left:4px">',
        '  + Add another pet',
        '</a>',
      ].join('');

      container.innerHTML = html;

    } catch (err) {
      console.error('Failed to load pets for booking:', err);
      // Show error message (account required, no guest fallback)
      container.innerHTML = '<div style="color:#a66;font-size:0.82rem">Could not load pet profiles. Please try again.</div>';
    }
  };

  // ── UPDATE HIDDEN FIELDS WHEN PET CHECKBOXES CHANGE ──
  window._brmUpdatePetSelection = function() {
    var checkboxes = document.querySelectorAll('.brm-pet-cb:checked');
    var petTypeEl = document.getElementById('brm-pettype');
    var numPetsEl = document.getElementById('brm-numpets');
    var idsEl = document.getElementById('brm-pets-selected-ids');

    var selectedIds = [];
    var selectedNames = [];
    var dogCount = 0;
    var catCount = 0;

    checkboxes.forEach(function(cb) {
      selectedIds.push(cb.value);
      selectedNames.push(cb.getAttribute('data-name'));
      if (cb.getAttribute('data-species') === 'cat') {
        catCount++;
      } else {
        dogCount++;
      }
    });

    // Update hidden fields
    if (idsEl) idsEl.value = selectedIds.join(',');
    if (numPetsEl) numPetsEl.value = dogCount + catCount;

    // Determine pet type for pricing
    if (petTypeEl) {
      if (dogCount > 0 && catCount > 0) {
        petTypeEl.value = 'both';
      } else if (catCount > 0) {
        petTypeEl.value = 'cat';
      } else {
        petTypeEl.value = 'dog';
      }
    }

    // Also populate the hidden brm-pets text field for backward compat
    var petsTextEl = document.getElementById('brm-pets');
    if (petsTextEl) petsTextEl.value = selectedNames.join(', ');

    // Sync the petcombo hidden value for validation bypass
    var comboEl = document.getElementById('brm-petcombo');
    if (comboEl && selectedIds.length > 0) {
      // Set a synthetic value so validation doesn't fail
      if (dogCount === 1 && catCount === 0) comboEl.value = '1dog';
      else if (dogCount === 0 && catCount === 1) comboEl.value = '1cat';
      else if (dogCount === 2 && catCount === 0) comboEl.value = '2dogs';
      else if (dogCount === 0 && catCount === 2) comboEl.value = '2cats';
      else if (dogCount === 1 && catCount === 1) comboEl.value = '1dog1cat';
      else comboEl.value = '3plus';
    }

    // Auto-set puppy checkbox if any selected dog is under 1 year old
    var puppyEl = document.getElementById('brm-puppy');
    if (puppyEl) {
      var hasPuppy = false;
      checkboxes.forEach(function(cb) {
        if (cb.getAttribute('data-species') !== 'cat') {
          var bday = cb.getAttribute('data-birthday');
          if (bday) {
            var ageMs = Date.now() - new Date(bday + 'T00:00:00').getTime();
            var ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
            if (ageYears < 1) hasPuppy = true;
          }
        }
      });
      puppyEl.value = hasPuppy ? 'true' : '';
    }

    // Highlight selected labels
    document.querySelectorAll('.brm-pet-checkbox-label').forEach(function(label) {
      var cb = label.querySelector('.brm-pet-cb');
      if (cb && cb.checked) {
        label.style.borderColor = '#c8963e';
        label.style.background = '#fffbf4';
      } else {
        label.style.borderColor = '#e0d5c5';
        label.style.background = '#fff';
      }
    });

    // Trigger price recalculation
    if (window._brmUpdatePrice) {
      window._brmUpdatePrice();
    }
  };

  window.closeBookingModal = function() {
    var modal = document.getElementById('bookingRequestModal');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  };

  // Submit booking request to Supabase
  window.submitBookingRequest = async function(e) {
    if (e) e.preventDefault();

    var errEl = document.getElementById('brm-error');
    var successEl = document.getElementById('brm-success');
    var submitBtn = document.getElementById('brm-submit');

    if (errEl) errEl.textContent = '';
    if (successEl) successEl.textContent = '';

    // Resolve full service name from group + duration dropdowns
    var service = window._resolveBookingServiceName ? window._resolveBookingServiceName() : document.getElementById('brm-service').value;
    var isHouseSittingSvc = service.toLowerCase().indexOf('house sitting') !== -1;

    // Get date/time from date cards (unified system) or House Sitting fields
    var dateCardDetails = window._brmGetDateCardsData ? window._brmGetDateCardsData() : [];
    var date, time;
    if (isHouseSittingSvc) {
      // House Sitting uses the traditional date range fields
      date = document.getElementById('brm-date').value;
      time = '';
    } else if (dateCardDetails.length > 0) {
      // Regular services: first card is the primary date/time
      date = dateCardDetails[0].date;
      time = dateCardDetails[0].time || '';
    } else {
      // Fallback to hidden fields (e.g. recurring)
      date = document.getElementById('brm-date').value;
      time = document.getElementById('brm-time').value;
    }

    var name = document.getElementById('brm-name').value.trim();
    var email = document.getElementById('brm-email').value.trim();
    var phone = document.getElementById('brm-phone').value.trim();
    var pets = document.getElementById('brm-pets').value.trim();
    var petType = document.getElementById('brm-pettype').value;
    var numPets = parseInt(document.getElementById('brm-numpets').value) || 1;
    var isPuppy = document.getElementById('brm-puppy') ? document.getElementById('brm-puppy').value === 'true' : false;
    var address = document.getElementById('brm-address').value.trim();
    var notes = document.getElementById('brm-notes').value.trim();
    var endDateEl = document.getElementById('brm-enddate');
    var endDate = endDateEl ? endDateEl.value : '';

    // Collect multi-date and recurrence data (per-card recurring)
    var isRecurring = window._brmAnyCardRecurring ? window._brmAnyCardRecurring() : false;
    var allBookingDates = [];

    // Collect dates from all cards, including recurring expansions
    if (dateCardDetails.length > 0) {
      dateCardDetails.forEach(function(dc) { if (dc.date) allBookingDates.push(dc.date); });
    }
    // Add recurring dates from cards that have recurring enabled
    if (isRecurring && window._brmGetRecurDates) {
      var recurDates = window._brmGetRecurDates();
      recurDates.forEach(function(rd) {
        if (allBookingDates.indexOf(rd) === -1) allBookingDates.push(rd);
      });
    }
    if (allBookingDates.length === 0 && date) allBookingDates = [date];
    // Deduplicate and sort
    allBookingDates = allBookingDates.filter(function(v, i, a) { return v && a.indexOf(v) === i; }).sort();

    // Build recurrence pattern from per-card recurring data
    var recurrencePattern = null;
    if (isRecurring) {
      var recurringCards = [];
      var cards = document.querySelectorAll('#brm-dates-list > div[data-date]');
      cards.forEach(function(card) {
        var cIdx = card.id.replace('brm-dc-', '');
        var cb = document.getElementById('brm-dc-recur-' + cIdx);
        if (cb && cb.checked) {
          var ongoingEl = document.getElementById('brm-dc-ongoing-' + cIdx);
          var isOngoing = ongoingEl && ongoingEl.checked;
          recurringCards.push({
            start_date: card.getAttribute('data-date'),
            frequency: (document.getElementById('brm-dc-freq-' + cIdx) || {}).value || 'weekly',
            end_date: isOngoing ? null : ((document.getElementById('brm-dc-recur-end-' + cIdx) || {}).value || ''),
            ongoing: isOngoing,
            time: (document.getElementById('brm-dc-time-' + cIdx) || {}).value || ''
          });
        }
      });
      if (recurringCards.length > 0) {
        recurrencePattern = {
          type: 'per_card',
          schedules: recurringCards,
          time: time
        };
      }
    }

    // Calculate price (with nights for House Sitting)
    var holidayFlag = isHoliday(date);
    var petCombo = document.getElementById('brm-petcombo') ? document.getElementById('brm-petcombo').value : '';
    var isHouseSitting = service.toLowerCase().indexOf('house sitting') !== -1;
    var nights = 1;
    if (isHouseSitting) {
      nights = calcNights(date, endDate);
    }
    var priceResult = calculatePrice(service, numPets, isPuppy, holidayFlag, petType, nights);

    // For multi-date / recurring pricing — count total visits (time slots), not just unique dates
    var totalDates = dateCardDetails.length > 0 ? dateCardDetails.length : allBookingDates.length;
    var multiDateTotal, multiDateBreakdown;
    if (isRecurring && !isHouseSitting) {
      // Recurring: store per-session price, billed weekly
      multiDateTotal = priceResult.total; // per session
      multiDateBreakdown = priceResult.breakdown + ' | Recurring: $' + priceResult.total.toFixed(2) + '/appointment, charged the day before each visit';
    } else {
      multiDateTotal = priceResult.total * totalDates;
      multiDateBreakdown = priceResult.breakdown;
      if (totalDates > 1 && !isHouseSitting) {
        multiDateBreakdown += ' | x' + totalDates + ' appointments = $' + multiDateTotal.toFixed(2);
      }
    }

    // Check if using pet checkboxes (logged-in) or guest text input
    var selectedPetIds = (document.getElementById('brm-pets-selected-ids') || {}).value || '';
    var isLoggedInWithPets = selectedPetIds.length > 0;

    // For logged-in users: require at least one pet checkbox selected
    // For guests: require pets text + petCombo dropdown
    if (!service || !name || !email || !address) {
      if (errEl) errEl.textContent = !address ? 'Please enter your home address — it\'s needed so Rachel knows where to go!' : 'Please fill in all required fields.';
      return;
    }
    // Date validation: need at least one date (from cards or HS fields)
    if (!date && dateCardDetails.length === 0) {
      if (errEl) errEl.textContent = 'Please add at least one date.';
      return;
    }
    // Time validation for non-HS: check first card has a time
    if (!isHouseSitting && dateCardDetails.length > 0 && !dateCardDetails[0].time) {
      if (errEl) errEl.textContent = 'Please select a time for your first date.';
      return;
    }
    if (!selectedPetIds) {
      if (errEl) errEl.textContent = 'Please select at least one pet from your pet profiles to continue booking.';
      return;
    }
    // House Sitting requires end date
    if (isHouseSitting && !endDate) {
      if (errEl) errEl.textContent = 'Please select an end date for House Sitting.';
      return;
    }
    // Recurring cards need end dates unless set to "until stopped"
    if (isRecurring) {
      var missingEnd = false;
      document.querySelectorAll('#brm-dates-list > div[data-date]').forEach(function(card) {
        var cIdx = card.id.replace('brm-dc-', '');
        var cb = document.getElementById('brm-dc-recur-' + cIdx);
        if (cb && cb.checked) {
          var ongoingEl = document.getElementById('brm-dc-ongoing-' + cIdx);
          var isOngoing = ongoingEl && ongoingEl.checked;
          if (!isOngoing) {
            var endEl = document.getElementById('brm-dc-recur-end-' + cIdx);
            if (!endEl || !endEl.value) missingEnd = true;
          }
        }
      });
      if (missingEnd) {
        if (errEl) errEl.textContent = 'Please set an end date for recurring dates (or choose "Until stopped").';
        return;
      }
    }

    // ── Payment method required for all paid services (cached for speed) ──
    var isFreeService = service.toLowerCase().indexOf('meet') !== -1 && service.toLowerCase().indexOf('greet') !== -1;
    if (!isFreeService && window.HHP_Auth && window.HHP_Auth.currentUser) {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }
      try {
        var pmData = window._cachedPaymentMethods;
        if (!pmData || Date.now() - (window._cachedPaymentMethodsAt || 0) > 60000) {
          var pmResp = await fetch('/api/get-payment-methods?profileId=' + encodeURIComponent(window.HHP_Auth.currentUser.id) + '&email=' + encodeURIComponent(window.HHP_Auth.currentUser.email));
          pmData = await pmResp.json();
          window._cachedPaymentMethods = pmData;
          window._cachedPaymentMethodsAt = Date.now();
        }
        if (!pmData.hasCard || !pmData.methods || pmData.methods.length === 0) {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Booking Request'; }
          if (errEl) errEl.innerHTML = '💳 <strong>Payment method required.</strong> Please add a card on file before booking a paid service. ' +
            '<a href="#" onclick="event.preventDefault();window._saveBookingAndAddCard();" style="color:var(--gold-deep);font-weight:600;text-decoration:underline;">Add Payment Method</a>';
          return;
        }
      } catch (pmErr) {
        console.warn('Payment method check failed:', pmErr);
        // If check fails, allow booking to proceed (don't block on network error)
      }
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending request...'; }

    try {
      var sb = getSB();
      if (!sb) throw new Error('Unable to connect to booking system. Please try again.');

      var clientId = null;
      if (window.HHP_Auth && window.HHP_Auth.currentUser) {
        clientId = window.HHP_Auth.currentUser.id;
      }

      // Re-validate deal usage right before submission (prevents multi-tab bypass)
      if (window._brmDealDiscount && clientId) {
        var dealToCheck = window._brmDealDiscount.deal;
        if (dealToCheck && dealToCheck.usage_limit === 'once_per_client') {
          var { data: priorUse } = await sb.from('booking_requests')
            .select('id').eq('client_id', clientId).eq('deal_id', dealToCheck.id)
            .neq('status', 'canceled').limit(1);
          if (priorUse && priorUse.length > 0) {
            window._brmDealDiscount = null;
            if (typeof toast === 'function') toast('Discount already used — booking will be submitted at full price.');
          }
        }
      }

      // ── Split multi-date bookings into individual records ──
      // Each date card becomes its own booking_request so owner/staff can manage them independently
      var shouldSplit = dateCardDetails.length > 1 && !isRecurring && !isHouseSittingSvc;
      var data, error;

      if (shouldSplit) {
        var perVisitPrice = priceResult.total; // per-session price
        var perVisitDealSavings = window._brmDealDiscount ? (window._brmDealDiscount.savings / dateCardDetails.length) : null;
        var perVisitTotal = window._brmDealDiscount ? (window._brmDealDiscount.discountedTotal / dateCardDetails.length) : perVisitPrice;

        var insertRows = dateCardDetails.map(function(dc) {
          return {
            service: service,
            preferred_date: dc.date,
            preferred_end_date: null,
            preferred_time: dc.time || '',
            contact_name: name,
            contact_email: email,
            contact_phone: phone || null,
            pet_names: pets,
            pet_types: petType,
            number_of_pets: numPets,
            is_puppy: isPuppy,
            is_holiday: isHoliday(dc.date),
            estimated_total: perVisitTotal,
            price_breakdown: priceResult.breakdown + (window._brmDealDiscount ? ' | 🏷️ ' + window._brmDealDiscount.deal.name + ': -$' + perVisitDealSavings.toFixed(2) : ''),
            deal_id: window._brmDealDiscount ? window._brmDealDiscount.deal.id : null,
            deal_discount: perVisitDealSavings,
            special_notes: notes || null,
            address: address,
            house_area: address,
            client_id: clientId,
            status: 'pending',
            booking_dates: null,
            recurrence_pattern: null,
            date_details: null,
            selected_pet_ids: selectedPetIds ? selectedPetIds.split(',') : null,
          };
        });

        var result = await sb.from('booking_requests').insert(insertRows).select();
        data = result.data;
        error = result.error;
      } else {
        // Single record — original behavior (1 date card, recurring, or house sitting)
        var result = await sb
          .from('booking_requests')
          .insert({
            service: service,
            preferred_date: date,
            preferred_end_date: isHouseSittingSvc ? endDate : null,
            preferred_time: time,
            contact_name: name,
            contact_email: email,
            contact_phone: phone || null,
            pet_names: pets,
            pet_types: petType,
            number_of_pets: numPets,
            is_puppy: isPuppy,
            is_holiday: holidayFlag,
            estimated_total: window._brmDealDiscount ? window._brmDealDiscount.discountedTotal : (isHouseSittingSvc ? priceResult.total : multiDateTotal),
            price_breakdown: multiDateBreakdown + (window._brmDealDiscount ? ' | 🏷️ ' + window._brmDealDiscount.deal.name + ': -$' + window._brmDealDiscount.savings.toFixed(2) : ''),
            deal_id: window._brmDealDiscount ? window._brmDealDiscount.deal.id : null,
            deal_discount: window._brmDealDiscount ? window._brmDealDiscount.savings : null,
            special_notes: notes || null,
            address: address,
            house_area: address,
            client_id: clientId,
            status: 'pending',
            booking_dates: totalDates > 1 ? allBookingDates : null,
            recurrence_pattern: recurrencePattern,
            date_details: dateCardDetails.length > 0 ? dateCardDetails : null,
            selected_pet_ids: selectedPetIds ? selectedPetIds.split(',') : null,
          })
          .select();
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      // Send email notification to Rachel
      try {
        if (shouldSplit && dateCardDetails.length > 1) {
          // Split bookings — send one email per booking so each has a valid date
          for (var ei = 0; ei < dateCardDetails.length; ei++) {
            var dc = dateCardDetails[ei];
            await sendBookingNotification({
              service: service,
              date: dc.date,
              time: dc.time || time,
              name: name,
              email: email,
              phone: phone,
              pets: pets,
              address: address,
              notes: (notes || '') + (dateCardDetails.length > 1 ? ' (Booking ' + (ei + 1) + ' of ' + dateCardDetails.length + ')' : ''),
              estimatedTotal: data && data[ei] ? data[ei].estimated_total : null,
            });
          }
        } else {
          // Single booking or recurring — send one email
          var dateDisplay = isHouseSitting ? date + ' to ' + endDate : date;
          if (isRecurring && recurrencePattern && recurrencePattern.schedules) {
            var recurParts = recurrencePattern.schedules.map(function(s) {
              return s.start_date + ' ' + s.frequency + ' until ' + (s.ongoing ? 'ongoing' : s.end_date);
            });
            dateDisplay = date; // Keep parseable date for email
          }
          await sendBookingNotification({
            service: service,
            date: dateDisplay,
            time: time,
            name: name,
            email: email,
            phone: phone,
            pets: pets,
            address: address,
            notes: isHouseSitting ? (notes ? notes + ' | ' + nights + ' night(s)' : nights + ' night(s)') : notes,
            estimatedTotal: data && data[0] ? data[0].estimated_total : null,
            isRecurring: isRecurring,
          });
        }
      } catch (emailErr) {
        console.warn('Email notification failed:', emailErr);
        // Don't block the success - the request was saved
      }

      if (successEl) {
        successEl.textContent = 'Your request has been sent to Rachel! She will review it and get back to you to confirm. Check your email for updates.';
      }
      if (submitBtn) { submitBtn.textContent = 'Request Sent!'; }

      // Reset form after delay
      setTimeout(function() {
        var form = document.getElementById('bookingRequestForm');
        if (form) form.reset();
        // Clear date cards
        window._brmDateCards = [];
        var datesListEl = document.getElementById('brm-dates-list');
        if (datesListEl) datesListEl.innerHTML = '';
        var addDateInput = document.getElementById('brm-add-date-input');
        if (addDateInput) addDateInput.value = '';
        var noMsg = document.getElementById('brm-no-dates-msg');
        if (noMsg) noMsg.style.display = '';
        closeBookingModal();
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Request to Rachel'; }
        if (successEl) successEl.textContent = '';
      }, 4000);

    } catch (err) {
      console.error('Booking request error:', err);
      if (errEl) errEl.textContent = 'Error: ' + (err.message || 'Something went wrong. Please try again.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Request to Rachel'; }
    }
  };

  // Send email notification via Vercel API
  async function sendBookingNotification(details) {
    try {
      await fetch('/api/booking-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      });
    } catch (err) {
      console.warn('Notification API not available:', err);
    }
  }

  // ════════════════════════════════════════════════════════════
  // 4. REWIRE BOOK BUTTONS → BOOKING REQUEST MODAL
  // ════════════════════════════════════════════════════════════
  function rewireBookButtons() {
    // Find all "Book" buttons and change them to open the request form
    var bookButtons = document.querySelectorAll('.sc-cta, .btn-book, .nbtn-gold, [class*="book-btn"], a[href*="checkout"]');
    bookButtons.forEach(function(btn) {
      var text = btn.textContent || '';
      var service = '';

      // Determine which service based on button text or parent card
      if (text.indexOf('Walk') >= 0) service = 'Dog Walking';
      else if (text.indexOf('Visit') >= 0) {
        // Check if it's a cat or drop-in
        var card = btn.closest('.service-card');
        if (card) {
          var cardName = card.querySelector('.sc-name');
          if (cardName && cardName.textContent.indexOf('Cat') >= 0) service = 'Cat Care';
          else service = 'Drop-In Visit';
        }
      }
      else if (text.indexOf('Stay') >= 0 || text.indexOf('125') >= 0) service = 'House Sitting (Dog)';
      else if (text.indexOf('Meet') >= 0 || text.indexOf('Greet') >= 0) service = 'Meet & Greet';

      btn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        openBookingModal(service);
      };

      // Update button text to say "Request" instead of "Book"
      if (text.indexOf('Book') >= 0) {
        btn.textContent = text.replace('Book', 'Request');
      }
    });

    // Rewire Meet & Greet buttons to use the proper mgModal
    var allBtns = document.querySelectorAll('.hero-section a, .hero-section button, button, a');
    allBtns.forEach(function(btn) {
      var text = btn.textContent || '';
      if ((text.indexOf('Meet & Greet') >= 0 || text.indexOf('Meet &amp; Greet') >= 0) &&
          (text.indexOf('Book') >= 0 || text.indexOf('Schedule') >= 0 || text.indexOf('Request') >= 0)) {
        btn.onclick = function(e) {
          e.preventDefault();
          if (typeof openModal === 'function') openModal('mgModal');
        };
      }
    });
  }

  // ════════════════════════════════════════════════════════════
  // 5. ADMIN DASHBOARD (for owner portal)
  // ════════════════════════════════════════════════════════════

  // Format 24h time string (HH:MM) to friendly 12h display
  function fmt12(t) {
    if (!t) return '';
    if (t.indexOf(':') === -1 || t.length > 5) return t;
    var parts = t.split(':');
    var h = parseInt(parts[0]);
    var m = parts[1];
    var hr12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    var ampm = h >= 12 ? 'PM' : 'AM';
    return hr12 + ':' + m + ' ' + ampm;
  }

  window.HHP_BookingAdmin = {
    currentFilter: 'pending',
    requests: [],

    async init() {
      // Find the pre-existing dashboard container in the overview panel
      var dashboard = document.getElementById('hhpAdminDashboard');
      if (!dashboard) return;

      // If inside a customizer widget card, skip — the widget renders its own compact layout
      if (dashboard.closest('.cust-widget')) return;

      dashboard.innerHTML = [
        '<div class="card-title" style="margin-bottom:14px">📋 Booking Requests</div>',
        '<div class="admin-filter-bar" id="adminFilterBar" style="margin-bottom:12px">',
        '  <button class="admin-filter-btn active" data-filter="pending" onclick="HHP_BookingAdmin.filter(\'pending\',this)">Pending</button>',
        '  <button class="admin-filter-btn" data-filter="accepted" onclick="HHP_BookingAdmin.filter(\'accepted\',this)">Accepted</button>',
        '  <button class="admin-filter-btn" data-filter="in_progress" onclick="HHP_BookingAdmin.filter(\'in_progress\',this)">In Progress</button>',
        '  <button class="admin-filter-btn" data-filter="completed" onclick="HHP_BookingAdmin.filter(\'completed\',this)">Completed</button>',
        '  <button class="admin-filter-btn" data-filter="modified" onclick="HHP_BookingAdmin.filter(\'modified\',this)">Modified</button>',
        '  <button class="admin-filter-btn" data-filter="declined" onclick="HHP_BookingAdmin.filter(\'declined\',this)">Declined</button>',
        '  <button class="admin-filter-btn" data-filter="payment_hold" onclick="HHP_BookingAdmin.filter(\'payment_hold\',this)">⚠️ Payment Hold</button>',
        '  <button class="admin-filter-btn" data-filter="all" onclick="HHP_BookingAdmin.filter(\'all\',this)">All</button>',
        '</div>',
        '<div id="adminRequestsList"></div>',
      ].join('');

      await this.loadRequests();

      // Auto-refresh every 30 seconds so new bookings appear without reload
      if (this._refreshInterval) clearInterval(this._refreshInterval);
      this._refreshInterval = setInterval(function() {
        if (document.getElementById('adminRequestsList')) {
          HHP_BookingAdmin.loadRequests();
        } else {
          clearInterval(HHP_BookingAdmin._refreshInterval);
        }
      }, 30000);
    },

    async loadRequests() {
      var sb = getSB();
      if (!sb) {
        // Supabase not ready yet — retry in 2s
        var self = this;
        setTimeout(function() { self.loadRequests(); }, 2000);
        return;
      }

      try {
        var query = sb.from('booking_requests').select('*').order('created_at', { ascending: false });

        if (this.currentFilter !== 'all') {
          query = query.eq('status', this.currentFilter);
        }

        var { data, error } = await query;
        if (error) throw error;

        this.requests = data || [];

        // Batch-fetch avatar URLs for all client_ids
        var clientIds = this.requests.map(function(r) { return r.client_id; }).filter(Boolean);
        if (clientIds.length > 0) {
          try {
            var uniqueIds = clientIds.filter(function(v, i, a) { return a.indexOf(v) === i; });
            var { data: profiles } = await sb.from('profiles').select('user_id, avatar_url').in('user_id', uniqueIds);
            if (profiles) {
              var avatarMap = {};
              profiles.forEach(function(p) { if (p.avatar_url) avatarMap[p.user_id] = p.avatar_url; });
              this.requests.forEach(function(r) {
                if (r.client_id && avatarMap[r.client_id]) r.avatar_url = avatarMap[r.client_id];
              });
            }
          } catch(e) { /* avatar fetch failed, no big deal */ }
        }

        this.render();
      } catch (err) {
        console.error('Failed to load booking requests:', err);
        var container = document.getElementById('adminRequestsList');
        if (container) container.innerHTML = '<div style="padding:12px;color:#c00;font-size:0.85rem">Failed to load requests. Pull down to refresh.</div>';
      }
    },

    render() {
      var container = document.getElementById('adminRequestsList');
      if (!container) return;

      if (this.requests.length === 0) {
        container.innerHTML = '<div class="admin-empty">No ' + this.currentFilter + ' requests</div>';
        return;
      }

      container.innerHTML = this.requests.map(function(r) {
        var dateStr = r.preferred_date ? new Date(r.preferred_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
        var isHS = (r.service || '').toLowerCase().indexOf('house sitting') !== -1;
        var endDateStr = '';
        if (isHS && r.preferred_end_date) {
          endDateStr = new Date(r.preferred_end_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          var hsNights = Math.round((new Date(r.preferred_end_date + 'T12:00:00') - new Date(r.preferred_date + 'T12:00:00')) / (1000*60*60*24));
          dateStr = dateStr + ' → ' + endDateStr + ' (' + hsNights + ' night' + (hsNights !== 1 ? 's' : '') + ')';
        }
        // Multi-date / recurring display
        var multiDateHTML = '';
        if (r.date_details && Array.isArray(r.date_details) && r.date_details.length > 0) {
          // New format: date cards with per-date time + pets + per-appointment actions
          var cardEntries = r.date_details.map(function(dc, idx) {
            var dStr = new Date(dc.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            var tStr = dc.time ? ' @ ' + fmt12(dc.time) : '';
            var pStr = (dc.pets && dc.pets.length > 0) ? ' — ' + dc.pets.map(function(p) { return p.name; }).join(', ') : '';
            var apptStatus = dc.status || r.status || 'pending';
            var statusColor = apptStatus === 'accepted' ? '#4caf50' : apptStatus === 'declined' ? '#c00' : apptStatus === 'modified' ? '#c8963e' : '#888';
            var statusBadge = (r.date_details.length > 1 && dc.status) ? '<span style="font-size:0.7rem;font-weight:700;color:' + statusColor + ';text-transform:uppercase;margin-left:8px">' + apptStatus + '</span>' : '';
            var perApptActions = '';
            if (r.status === 'pending' && r.date_details.length > 1) {
              perApptActions = '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">' +
                '<button class="arc-btn accept" style="font-size:0.72rem;padding:4px 10px" onclick="event.stopPropagation();acceptSingleAppt(\'' + r.id + '\',' + idx + ')">✓ Accept</button>' +
                '<button class="arc-btn modify" style="font-size:0.72rem;padding:4px 10px" onclick="event.stopPropagation();suggestTimeSingleAppt(\'' + r.id + '\',' + idx + ')">↻ Time</button>' +
                '<button class="arc-btn decline" style="font-size:0.72rem;padding:4px 10px" onclick="event.stopPropagation();declineSingleAppt(\'' + r.id + '\',' + idx + ')">✕ Decline</button>' +
                '</div>';
            }
            return '<div style="background:#f0ebe3;border:1px solid #e0d5c5;border-radius:8px;padding:8px 10px;font-size:0.82rem" data-appt-idx="' + idx + '">' +
              '<strong>' + dStr + '</strong>' + tStr + pStr + statusBadge + perApptActions + '</div>';
          });
          multiDateHTML = '<div class="arc-detail"><strong>' + r.date_details.length + ' Appointments:</strong>' +
            '<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">' + cardEntries.join('') + '</div></div>';
        } else if (r.booking_dates && Array.isArray(r.booking_dates) && r.booking_dates.length > 1) {
          // Legacy format: just date strings
          var formattedDates = r.booking_dates.map(function(d) {
            return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          });
          multiDateHTML = '<div class="arc-detail"><strong>' + r.booking_dates.length + ' Appointments:</strong><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">' +
            formattedDates.map(function(f) { return '<span style="background:#f0ebe3;border:1px solid #e0d5c5;border-radius:12px;padding:2px 8px;font-size:0.78rem">' + f + '</span>'; }).join('') + '</div></div>';
        }
        var recurHTML = '';
        if (r.recurrence_pattern) {
          var rp = typeof r.recurrence_pattern === 'string' ? JSON.parse(r.recurrence_pattern) : r.recurrence_pattern;
          if (rp.type === 'per_card' && rp.schedules) {
            // New per-card recurring format
            var schedParts = rp.schedules.map(function(s) {
              var freqLabel = s.frequency === 'weekly' ? 'Weekly' : 'Every other week';
              var startFmt = new Date(s.start_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              var endPart = s.ongoing ? ' · <em>Until stopped</em>' : (s.end_date ? ' until ' + new Date(s.end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ' (ongoing)');
              return startFmt + ' · ' + freqLabel + endPart + (s.time ? ' @ ' + s.time : '');
            });
            recurHTML = '<div class="arc-detail" style="background:#eef6ff;border:1px solid #b8d4f0;border-radius:6px;padding:8px 10px;margin:4px 0"><strong>🔄 Recurring:</strong><br>' + schedParts.join('<br>') + '</div>';
          } else {
            // Legacy format
            var dayNames = (rp.days || []).map(function(d) { return d.charAt(0).toUpperCase() + d.slice(1); });
            var freqLabel = rp.frequency === 'weekly' ? 'Every week' : 'Every other week';
            recurHTML = '<div class="arc-detail" style="background:#eef6ff;border:1px solid #b8d4f0;border-radius:6px;padding:8px 10px;margin:4px 0"><strong>🔄 Recurring:</strong> ' + dayNames.join(', ') + ' · ' + freqLabel + (rp.end_date ? ' · Until ' + new Date(rp.end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '') + '</div>';
          }
        }

        var createdStr = r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

        var actionsHTML = '';
        if (r.status === 'pending') {
          actionsHTML = [
            '<div class="arc-actions">',
            '  <button class="arc-btn accept" onclick="HHP_BookingAdmin.updateStatus(\'' + r.id + '\',\'accepted\')">Accept</button>',
            '  <button class="arc-btn modify" onclick="HHP_BookingAdmin.showModify(\'' + r.id + '\')">Suggest Different Time</button>',
            '  <button class="arc-btn decline" onclick="HHP_BookingAdmin.updateStatus(\'' + r.id + '\',\'declined\')">Decline</button>',
            '</div>',
          ].join('');
        } else if (r.status === 'modified') {
          actionsHTML = '<div class="arc-actions"><span style="color:#888;font-size:13px;">Waiting for client response</span></div>';
        } else if (r.status === 'in_progress') {
          actionsHTML = '<div class="arc-actions"><button class="arc-btn accept" onclick="if(typeof reopenLiveServicePanel===\'function\')reopenLiveServicePanel();" style="background:#2196F3">▶ View Live Report</button></div>';
        } else if (r.status === 'completed') {
          actionsHTML = '<div class="arc-actions"><button class="arc-btn accept" onclick="if(typeof viewCompletedReport===\'function\')viewCompletedReport(\'' + r.id + '\');" style="background:#4caf50">📋 View Report</button></div>';
        } else if (r.status === 'accepted' || r.status === 'confirmed') {
          var cancelDate = r.scheduled_date || r.preferred_date || '';
          var cancelName = r.contact_name || 'Client';
          actionsHTML = [
            '<div class="arc-actions">',
            '  <button class="arc-btn decline" onclick="if(typeof openCancelModal===\'function\')openCancelModal(\'' + r.id + '\',\'' + (r.service || '').replace(/'/g, "\\'") + '\',\'' + cancelDate + '\',\'' + cancelName.replace(/'/g, "\\'") + '\',' + (!!r.recurrence_pattern) + ',\'owner\')">Cancel Booking</button>',
            '</div>',
          ].join('');
        } else if (r.status === 'payment_hold') {
          actionsHTML = [
            '<div class="arc-actions">',
            '  <div style="background:#fff3cd;color:#856404;padding:8px 12px;border-radius:8px;font-size:0.82rem;margin-bottom:8px;border:1px solid #ffc107">⚠️ Payment failed — client has been notified to update their card</div>',
            '  <button class="arc-btn accept" onclick="HHP_BookingAdmin.retryPayment(\'' + r.id + '\')" style="background:#c8963e">🔄 Retry Payment</button>',
            '  <button class="arc-btn decline" onclick="HHP_BookingAdmin.updateStatus(\'' + r.id + '\',\'declined\')">Cancel Booking</button>',
            '</div>',
          ].join('');
        }

        // Build avatar for the client on this request
        var clientAvaHTML = '';
        if (r.avatar_url) {
          clientAvaHTML = '<img src="' + r.avatar_url + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #e0d5c5;flex-shrink:0">';
        } else {
          var initials = (r.contact_name || '?').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
          clientAvaHTML = '<div style="width:36px;height:36px;border-radius:50%;background:var(--gold-light,#f5e6c8);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:var(--ink,#1e1409);flex-shrink:0;border:2px solid #e0d5c5">' + initials + '</div>';
        }

        // ── Schedule Preview: collect dates for this booking ──
        var schedPreviewDates = [];
        if (r.date_details && Array.isArray(r.date_details) && r.date_details.length > 0) {
          schedPreviewDates = r.date_details.map(function(dc) { return dc.date; });
        } else if (r.booking_dates && Array.isArray(r.booking_dates) && r.booking_dates.length > 1) {
          schedPreviewDates = r.booking_dates.slice();
        } else if (r.preferred_date) {
          if (isHS && r.preferred_end_date) {
            // House sitting: generate all dates in the range
            var _cur = new Date(r.preferred_date + 'T12:00:00');
            var _end = new Date(r.preferred_end_date + 'T12:00:00');
            while (_cur <= _end) {
              schedPreviewDates.push(typeof _localDateStr === 'function' ? _localDateStr(_cur) : _cur.toISOString().split('T')[0]);
              _cur.setDate(_cur.getDate() + 1);
            }
          } else {
            schedPreviewDates = [r.preferred_date];
          }
        }
        var schedPreviewHTML = '';
        if (schedPreviewDates.length > 0 && (r.status === 'pending' || r.status === 'modified')) {
          var _datesAttr = schedPreviewDates.join(',');
          var _dateLabel = schedPreviewDates.length === 1
            ? new Date(schedPreviewDates[0] + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            : schedPreviewDates.length + ' dates';
          schedPreviewHTML = '<div class="sched-preview-bar" onclick="HHP_BookingAdmin.toggleSchedulePreview(\'' + r.id + '\',\'' + _datesAttr + '\',this)">' +
            '<span>\uD83D\uDCC5 View your schedule for ' + _dateLabel + '</span>' +
            '<span class="sched-preview-arrow">\u25B8</span>' +
            '</div>' +
            '<div class="sched-preview-content" id="sched-preview-' + r.id + '" style="display:none"></div>';
        }

        return [
          '<div class="admin-request-card" id="arc-' + r.id + '">',
          '  <div class="arc-header">',
          '    <span class="arc-service">' + (r.service || 'Unknown Service') + '</span>',
          '    <span class="arc-status ' + r.status + '">' + r.status + '</span>',
          '  </div>',
          '  <div class="arc-detail" style="display:flex;align-items:center;gap:10px">' + clientAvaHTML + '<div><strong>' + (r.contact_name || '') + '</strong><br><span style="font-size:0.78rem;color:#8c6b4a">' + (r.contact_email || '') + (r.contact_phone ? ' · ' + r.contact_phone : '') + '</span></div></div>',
          '  <div class="arc-detail"><strong>' + (isHS ? 'Dates:' : 'Preferred:') + '</strong> ' + dateStr + (isHS ? ' · Check-in ' : ' at ') + fmt12(r.preferred_time || '') + '</div>',
          multiDateHTML,
          recurHTML,
          '  <div class="arc-detail"><strong>Pets:</strong> ' + (r.pet_names || '') + ' (' + (r.pet_types || '') + ', ' + (r.number_of_pets || 1) + ')' + (r.is_puppy ? ' <span style="color:#c8963e;font-weight:600">🐶 Puppy</span>' : '') + '</div>',
          '  <div class="arc-detail"><strong>Address:</strong> ' + (r.address || '') + '</div>',
          r.estimated_total ? '  <div class="arc-detail" style="background:#f9f6f0;padding:8px 10px;border-radius:6px;margin:6px 0;border:1px solid #e0d5c5"><strong>Total: $' + Number(r.estimated_total).toFixed(2) + '</strong>' + (r.price_breakdown ? '<div style="font-size:0.78rem;color:#6b5c4d;margin-top:2px">' + r.price_breakdown.replace(/\|/g, '<br>') + '</div>' : '') + (r.is_holiday ? '<div style="color:#c8963e;font-size:0.78rem;margin-top:2px">Holiday rate applied</div>' : '') + '</div>' : '',
          r.special_notes ? '  <div class="arc-detail"><strong>Notes:</strong> ' + r.special_notes + '</div>' : '',
          r.admin_notes ? '  <div class="arc-detail" style="color:var(--gold)"><strong>Your Note:</strong> ' + r.admin_notes + '</div>' : '',
          r.scheduled_date ? '  <div class="arc-detail" style="color:var(--forest)"><strong>Scheduled:</strong> ' + r.scheduled_date + ' at ' + fmt12(r.scheduled_time || r.preferred_time) + '</div>' : '',
          '  <div class="arc-detail" style="font-size:12px;color:#aaa;">Requested: ' + createdStr + '</div>',
          '  <div id="arc-modify-' + r.id + '"></div>',
          actionsHTML,
          schedPreviewHTML,
          '</div>',
        ].join('');
      }).join('');
    },

    filter(status, btn) {
      this.currentFilter = status;
      // Update active button
      document.querySelectorAll('.admin-filter-btn').forEach(function(b) { b.classList.remove('active'); });
      if (btn) btn.classList.add('active');
      this.loadRequests();
    },

    // ── Schedule Preview: toggle + async load ──
    // Called as toggleSchedulePreview(bookingId, datesStr, triggerBtn)
    toggleSchedulePreview: async function(bookingId, datesStr, btn) {
      var content = document.getElementById('sched-preview-' + bookingId);
      if (!content) { console.warn('Schedule preview container not found for', bookingId); return; }

      // Toggle collapse/expand
      if (content.style.display !== 'none') {
        content.style.display = 'none';
        if (btn) btn.classList.remove('active');
        return;
      }
      content.style.display = 'block';
      if (btn) btn.classList.add('active');

      // Only fetch once per card
      if (content.dataset.loaded) return;
      content.innerHTML = '<div style="padding:8px;font-size:0.82rem;color:#888">Loading schedule\u2026</div>';

      try {
        var sb = getSB();
        if (!sb) throw new Error('Database not ready');
        var dates = datesStr.split(',');
        var user = window.HHP_Auth && window.HHP_Auth.currentUser ? window.HHP_Auth.currentUser : null;
        var role = user && user.profile ? (user.profile.role || 'owner') : 'owner';
        var userId = user ? user.id : null;

        // Fetch accepted/confirmed/in_progress bookings for these dates
        // Owner sees all bookings (full business schedule), staff would see all too
        var query = sb.from('booking_requests')
          .select('id,service,preferred_date,preferred_time,preferred_end_date,contact_name,pet_names,status')
          .in('preferred_date', dates)
          .in('status', ['accepted', 'confirmed', 'in_progress'])
          .order('preferred_time', { ascending: true });

        var result = await query;
        var data = result.data;
        var error = result.error;
        if (error) throw error;

        if (!data || data.length === 0) {
          content.innerHTML = '<div class="sched-preview-clear">\u2705 No existing bookings \u2014 schedule is clear!</div>';
        } else {
          // Group by date
          var byDate = {};
          dates.forEach(function(d) { byDate[d] = []; });
          data.forEach(function(b) {
            if (byDate[b.preferred_date]) byDate[b.preferred_date].push(b);
            else byDate[b.preferred_date] = [b];
          });

          var html = '';
          dates.forEach(function(d) {
            var dayBookings = byDate[d] || [];
            if (dates.length > 1) {
              var dayLabel = new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              html += '<div class="sched-preview-day-label">' + dayLabel + '</div>';
            }
            if (dayBookings.length === 0) {
              html += '<div style="font-size:0.8rem;color:#4caf50;padding:2px 0">\u2705 Clear</div>';
            } else {
              dayBookings.forEach(function(b) {
                var timeStr = typeof fmt12 === 'function' ? fmt12(b.preferred_time || '') : (b.preferred_time || 'TBD');
                html += '<div class="sched-preview-item">' +
                  '<span class="sched-preview-time">' + timeStr + '</span>' +
                  '<span class="sched-preview-service">' + (b.service || 'Service') + '</span>' +
                  '<span class="sched-preview-client">' + (b.contact_name || '') + '</span>' +
                  '</div>';
              });
            }
          });

          // Summary line
          var totalCount = data.length;
          html = '<div style="font-size:0.75rem;color:#888;margin-bottom:4px">' + totalCount + ' existing booking' + (totalCount !== 1 ? 's' : '') + '</div>' + html;
          content.innerHTML = html;
        }
        content.dataset.loaded = '1';
      } catch(err) {
        console.error('Schedule preview error:', err);
        content.innerHTML = '<div style="padding:8px;font-size:0.82rem;color:#c00">Failed to load schedule: ' + (err.message || err) + '</div>';
      }
    },

    showModify(requestId) {
      var container = document.getElementById('arc-modify-' + requestId);
      if (!container) return;
      container.innerHTML = [
        '<div style="background:#FDF7EE;padding:12px;border-radius:8px;margin-top:10px;">',
        '  <label style="font-size:13px;font-weight:600;">Suggest New Date:</label>',
        '  <input type="date" id="mod-date-' + requestId + '" style="padding:6px;border:1px solid #ddd;border-radius:6px;margin:4px 8px;">',
        '  <label style="font-size:13px;font-weight:600;">New Time:</label>',
        '  <select id="mod-time-' + requestId + '" style="padding:6px;border:1px solid #ddd;border-radius:6px;margin:4px 8px;">',
        (function() {
          var o = '';
          for (var h = 5; h <= 22; h++) {
            for (var m = 0; m < 60; m += 30) {
              var hr12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
              var ampm = h >= 12 ? 'PM' : 'AM';
              var mm = m === 0 ? '00' : '30';
              o += '    <option value="' + ((h<10?'0':'')+h) + ':' + mm + '">' + hr12 + ':' + mm + ' ' + ampm + '</option>';
            }
          }
          return o;
        })(),
        '  </select>',
        '  <br><label style="font-size:13px;font-weight:600;margin-top:8px;display:block;">Note to Client:</label>',
        '  <textarea id="mod-note-' + requestId + '" rows="2" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px;margin:4px 0;font-family:inherit;" placeholder="e.g., That time works but I can only do mornings that day..."></textarea>',
        '  <button class="arc-btn modify" onclick="HHP_BookingAdmin.submitModify(\'' + requestId + '\')" style="margin-top:8px;">Send Suggestion</button>',
        '</div>',
      ].join('');
    },

    async submitModify(requestId) {
      var newDate = document.getElementById('mod-date-' + requestId);
      var newTime = document.getElementById('mod-time-' + requestId);
      var note = document.getElementById('mod-note-' + requestId);

      if (!newDate || !newDate.value) { alert('Please select a new date.'); return; }

      await this.updateStatus(requestId, 'modified', {
        scheduled_date: newDate.value,
        scheduled_time: newTime ? newTime.value : '',
        admin_notes: note ? note.value : '',
      });
    },

    async retryPayment(requestId) {
      var req = this.requests.find(function(r) { return r.id === requestId; });
      if (!req) { alert('Booking not found.'); return; }

      if (typeof toast === 'function') toast('🔄 Retrying payment...');

      // First set back to pending so updateStatus can accept it
      var sb = getSB();
      if (!sb) return;
      await sb.from('booking_requests').update({ status: 'pending', admin_notes: '' }).eq('id', requestId);
      req.status = 'pending';

      // Now try to accept (which triggers the charge flow)
      await this.updateStatus(requestId, 'accepted');
    },

    async updateStatus(requestId, newStatus, extraFields) {
      var sb = getSB();
      if (!sb) return;

      try {
        var update = { status: newStatus };
        if (extraFields) Object.assign(update, extraFields);

        if (newStatus === 'accepted' && !update.scheduled_date) {
          // Use the preferred date/time as the scheduled date/time
          var req = this.requests.find(function(r) { return r.id === requestId; });
          if (req) {
            update.scheduled_date = req.preferred_date;
            update.scheduled_time = req.preferred_time;
          }
        }

        var { error } = await sb
          .from('booking_requests')
          .update(update)
          .eq('id', requestId);

        if (error) throw error;

        // Send notification to client about the status change
        var req = this.requests.find(function(r) { return r.id === requestId; });
        if (req) {
          // If accepting, try to charge the client's card FIRST
          var paymentLink = '';
          var autoCharged = false;
          var cardDeclined = false;
          var declineMessage = '';

          if (newStatus === 'accepted' && req.service && req.estimated_total > 0 && req.client_id) {
            try {
              var chargeResp = await fetch('/api/charge-saved-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bookingRequestId: requestId,
                  amount: req.estimated_total,
                  service: req.service,
                  clientProfileId: req.client_id,
                }),
              });
              var chargeData = await chargeResp.json();

              if (chargeData.success && chargeData.status === 'deferred') {
                // Payment deferred — booking accepted, card will be charged Sunday the week of service
                autoCharged = false;
                if (typeof toast === 'function') toast('✓ Booking accepted! Payment will charge Sunday the week of service.');

              } else if (chargeData.success) {
                autoCharged = true;
                if (typeof toast === 'function') toast('💳 Card charged $' + Number(req.estimated_total).toFixed(2) + ' automatically!');

              } else if (chargeData.error === 'no_card') {
                // No saved card — put on hold, notify client to add a card
                cardDeclined = true;
                declineMessage = 'No payment method on file. Please add a card to confirm your booking.';

              } else if (chargeData.error === 'card_declined') {
                // Card declined — put on hold, notify client
                cardDeclined = true;
                declineMessage = chargeData.message || 'Your card was declined. Please update your payment method.';

              } else {
                // Other error — put on hold
                cardDeclined = true;
                declineMessage = 'Payment could not be processed. Please update your payment method.';
              }
            } catch (chargeErr) {
              console.warn('Auto-charge failed:', chargeErr);
              cardDeclined = true;
              declineMessage = 'Payment could not be processed. Please update your payment method.';
            }

            // If card was declined, put booking on hold instead of accepting
            if (cardDeclined) {
              await sb.from('booking_requests').update({
                status: 'payment_hold',
                admin_notes: (update.admin_notes || '') + (update.admin_notes ? '\n' : '') + '⚠️ Payment failed: ' + declineMessage,
              }).eq('id', requestId);

              // Notify the client their payment failed
              try {
                await fetch('/api/booking-status-notification', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: req.contact_email,
                    name: req.contact_name,
                    service: req.service,
                    status: 'payment_hold',
                    scheduledDate: update.scheduled_date || req.preferred_date,
                    scheduledTime: update.scheduled_time || req.preferred_time,
                    adminNotes: '',
                    paymentLink: '',
                    estimatedTotal: req.estimated_total || null,
                    priceBreakdown: req.price_breakdown || '',
                    autoCharged: false,
                    declineMessage: declineMessage,
                  }),
                });
              } catch (e) { console.warn('Decline notification failed:', e); }

              if (typeof toast === 'function') toast('⚠️ Payment failed — booking on hold. Client has been notified to update their payment method.');
              await this.loadRequests();
              return;
            }

          } else if (newStatus === 'accepted' && req.service && (!req.estimated_total || req.estimated_total <= 0)) {
            // Free service — no charge needed, just accept
          }

          // Payment succeeded (or no charge needed) — send confirmation email
          try {
            await fetch('/api/booking-status-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: req.contact_email,
                name: req.contact_name,
                service: req.service,
                status: newStatus,
                scheduledDate: update.scheduled_date || req.preferred_date,
                scheduledTime: update.scheduled_time || req.preferred_time,
                adminNotes: update.admin_notes || '',
                paymentLink: '',
                estimatedTotal: req.estimated_total || null,
                priceBreakdown: req.price_breakdown || '',
                autoCharged: autoCharged,
                recurrencePattern: req.recurrence_pattern || null,
                dateDetails: req.date_details || null,
              }),
            });
          } catch (e) { console.warn('Status notification failed:', e); }
        }

        // Refresh the list
        await this.loadRequests();

        if (typeof toast === 'function') {
          var msg = 'Request ' + newStatus + '!';
          if (newStatus === 'accepted' && !autoCharged && req && req.estimated_total > 0) {
            msg += ' Payment link sent to client.';
          }
          toast(msg);
        }
      } catch (err) {
        console.error('Failed to update request:', err);
        alert('Error updating request: ' + err.message);
      }
    },
  };

  // ════════════════════════════════════════════════════════════
  // 6. CALENDAR INTEGRATION - Show accepted bookings on calendar
  // ════════════════════════════════════════════════════════════
  async function loadAcceptedBookingsToCalendar() {
    var sb = getSB();
    if (!sb) return;

    try {
      // Get current month's accepted bookings
      var now = new Date();
      var firstDay = _localDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
      var lastDay = _localDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));

      var { data, error } = await sb
        .from('booking_requests')
        .select('*')
        .eq('status', 'accepted')
        .gte('scheduled_date', firstDay)
        .lte('scheduled_date', lastDay);

      if (error || !data) return;

      // Mark calendar days with bookings
      data.forEach(function(booking) {
        var day = parseInt(booking.scheduled_date.split('-')[2]);
        var calDays = document.querySelectorAll('.cal-day');
        calDays.forEach(function(cell) {
          var dayNum = parseInt(cell.querySelector('.cal-day-num, .day-num')?.textContent);
          if (dayNum === day) {
            cell.style.background = 'var(--gold-light, #F5E6CC)';
            cell.setAttribute('title', booking.service + ' - ' + booking.contact_name);

            // Add a small dot indicator
            if (!cell.querySelector('.booking-dot')) {
              var dot = document.createElement('div');
              dot.className = 'booking-dot';
              dot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:var(--gold,#C8963E);margin:2px auto 0;';
              cell.appendChild(dot);
            }
          }
        });
      });
    } catch (err) {
      console.warn('Calendar booking load failed:', err);
    }
  }

  // ════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ════════════════════════════════════════════════════════════
  function initBookingSystem() {
    injectBookingCSS();
    createBookingModal();

    // Wait for page to fully render then rewire buttons
    setTimeout(rewireBookButtons, 2000);
    setTimeout(rewireBookButtons, 5000);
    setTimeout(rewireBookButtons, 8000);

    // Load calendar bookings
    setTimeout(loadAcceptedBookingsToCalendar, 3000);

    // Init admin dashboard — multiple fallbacks to ensure it always loads
    function _tryInitAdmin() {
      if (window.HHP_Auth && window.HHP_Auth.currentRole === 'owner') {
        HHP_BookingAdmin.init();
        return true;
      }
      return false;
    }

    function _initAdminWhenReady() {
      _tryInitAdmin();
      // Also watch for auth state changes (fresh login while page is open)
      if (window.HHP_Auth && window.HHP_Auth.supabase) {
        window.HHP_Auth.supabase.auth.onAuthStateChange(function(event) {
          if (event === 'SIGNED_IN') {
            setTimeout(function() { _tryInitAdmin(); }, 200);
          }
        });
      }
    }

    // Primary: fire on auth-ready callback
    if (window.onHHPAuthReady) {
      window.onHHPAuthReady(_initAdminWhenReady);
    } else {
      setTimeout(_initAdminWhenReady, 2000);
    }

    // Fallback: retry at 2s, 4s, 8s in case auth-ready fired before booking-system loaded
    setTimeout(function() { _tryInitAdmin(); }, 2000);
    setTimeout(function() { _tryInitAdmin(); }, 4000);
    setTimeout(function() { _tryInitAdmin(); }, 8000);
  }

  // ── Save booking form state before Stripe redirect ──
  window._saveBookingAndAddCard = function() {
    try {
      var formData = {
        service: (document.getElementById('brm-service') || {}).value || '',
        name: (document.getElementById('brm-name') || {}).value || '',
        email: (document.getElementById('brm-email') || {}).value || '',
        phone: (document.getElementById('brm-phone') || {}).value || '',
        address: (document.getElementById('brm-address') || {}).value || '',
        notes: (document.getElementById('brm-notes') || {}).value || '',
        date: (document.getElementById('brm-date') || {}).value || '',
        enddate: (document.getElementById('brm-enddate') || {}).value || '',
        pettype: (document.getElementById('brm-pettype') || {}).value || '',
        selectedPetIds: (document.getElementById('brm-pets-selected-ids') || {}).value || '',
        timestamp: Date.now()
      };

      // Save date card details if any
      var dateCards = [];
      document.querySelectorAll('#brm-dates-list > div[data-date]').forEach(function(card) {
        var idx = card.id.replace('brm-dc-', '');
        var timeEl = document.getElementById('brm-dc-time-' + idx);
        var recurCb = document.getElementById('brm-dc-recur-' + idx);
        var freqEl = document.getElementById('brm-dc-freq-' + idx);
        var endEl = document.getElementById('brm-dc-recur-end-' + idx);
        var ongoingEl = document.getElementById('brm-dc-ongoing-' + idx);
        dateCards.push({
          date: card.getAttribute('data-date'),
          time: timeEl ? timeEl.value : '',
          recurring: recurCb ? recurCb.checked : false,
          frequency: freqEl ? freqEl.value : 'weekly',
          endDate: endEl ? endEl.value : '',
          ongoing: ongoingEl ? ongoingEl.checked : false
        });
      });
      formData.dateCards = dateCards;

      sessionStorage.setItem('hhp_pending_booking', JSON.stringify(formData));
    } catch (e) {
      console.warn('Could not save booking state:', e);
    }

    // Now redirect to Stripe for card setup
    if (typeof addPaymentMethod === 'function') {
      addPaymentMethod();
    } else {
      toast('Please add a card in your Payment tab first.');
    }
  };

  // ── Restore booking form after returning from Stripe ──
  window._restorePendingBooking = function() {
    try {
      var saved = sessionStorage.getItem('hhp_pending_booking');
      if (!saved) return false;

      var formData = JSON.parse(saved);
      // Only restore if saved within the last 30 minutes
      if (Date.now() - formData.timestamp > 30 * 60 * 1000) {
        sessionStorage.removeItem('hhp_pending_booking');
        return false;
      }

      // Open the booking modal with the saved service
      if (typeof openBookingModal === 'function') {
        openBookingModal(formData.service || undefined);
      }

      // Wait for modal to render, then populate fields
      setTimeout(function() {
        var fields = {
          'brm-service': formData.service,
          'brm-name': formData.name,
          'brm-email': formData.email,
          'brm-phone': formData.phone,
          'brm-address': formData.address,
          'brm-notes': formData.notes,
          'brm-date': formData.date,
          'brm-enddate': formData.enddate,
          'brm-pettype': formData.pettype,
          'brm-pets-selected-ids': formData.selectedPetIds
        };

        Object.keys(fields).forEach(function(id) {
          var el = document.getElementById(id);
          if (el && fields[id]) {
            el.value = fields[id];
            // Trigger change for service dropdown to show correct UI
            if (id === 'brm-service') el.dispatchEvent(new Event('change'));
          }
        });

        // Restore date cards
        if (formData.dateCards && formData.dateCards.length > 0) {
          formData.dateCards.forEach(function(dc) {
            // Add each date card back
            var addDateInput = document.getElementById('brm-add-date-input');
            if (addDateInput) {
              addDateInput.value = dc.date;
              var addBtn = document.querySelector('[onclick*="addBrmDateCard"], .brm-add-date-btn');
              if (addBtn) addBtn.click();
              else if (typeof window._addBrmDateCard === 'function') window._addBrmDateCard();
            }
          });

          // After cards are added, restore their settings
          setTimeout(function() {
            formData.dateCards.forEach(function(dc, idx) {
              var timeEl = document.getElementById('brm-dc-time-' + idx);
              if (timeEl && dc.time) timeEl.value = dc.time;
              var recurCb = document.getElementById('brm-dc-recur-' + idx);
              if (recurCb && dc.recurring) {
                recurCb.checked = true;
                recurCb.dispatchEvent(new Event('change'));
                setTimeout(function() {
                  var freqEl = document.getElementById('brm-dc-freq-' + idx);
                  if (freqEl && dc.frequency) freqEl.value = dc.frequency;
                  var endEl = document.getElementById('brm-dc-recur-end-' + idx);
                  if (endEl && dc.endDate) endEl.value = dc.endDate;
                  var ongoingEl = document.getElementById('brm-dc-ongoing-' + idx);
                  if (ongoingEl && dc.ongoing) {
                    ongoingEl.checked = true;
                    ongoingEl.dispatchEvent(new Event('change'));
                  }
                }, 200);
              }
            });
          }, 500);
        }

        // Re-check pet checkboxes
        if (formData.selectedPetIds) {
          var petIds = formData.selectedPetIds.split(',');
          petIds.forEach(function(pid) {
            var cb = document.querySelector('input[type="checkbox"][value="' + pid + '"]');
            if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
          });
        }

        // Show success toast
        toast('✅ Card saved! Your booking has been restored — just hit Submit.');

        // Clean up
        sessionStorage.removeItem('hhp_pending_booking');
      }, 800);

      return true;
    } catch (e) {
      console.warn('Could not restore booking state:', e);
      sessionStorage.removeItem('hhp_pending_booking');
      return false;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initBookingSystem, 200);
    });
  } else {
    setTimeout(initBookingSystem, 100);
  }

  // ════════════════════════════════════════════════════════════
  // BOOKING REQUESTS PANEL — Owner + Staff Views
  // ════════════════════════════════════════════════════════════
  var _bookingPanelState = { portal: null, currentFilter: 'pending', requests: [] };

  window.loadBookingRequestsPanel = async function(portal) {
    var sb = getSB();
    if (!sb) {
      setTimeout(function() { window.loadBookingRequestsPanel(portal); }, 2000);
      return;
    }

    var containerId = portal === 'owner' ? 'ownerRequestsList' : 'staffRequestsList';
    var container = document.getElementById(containerId);
    if (!container) return;

    _bookingPanelState.portal = portal;

    try {
      var query = sb.from('booking_requests').select('*').order('created_at', { ascending: false });

      // For staff: only fetch requests assigned to them
      if (portal === 'staff') {
        var user = window.HHP_Auth && window.HHP_Auth.currentUser;
        if (user) {
          var { data: staffAssignments } = await sb.from('staff_assignments').select('client_id').eq('staff_id', user.id);
          var clientIds = (staffAssignments || []).map(function(a) { return a.client_id; });
          if (clientIds.length > 0) {
            query = query.in('client_id', clientIds);
          } else {
            // No clients assigned
            _bookingPanelState.requests = [];
            _renderBookingRequestsList(container, portal);
            return;
          }
        }
      }

      // Apply filter
      if (_bookingPanelState.currentFilter !== 'all') {
        query = query.eq('status', _bookingPanelState.currentFilter);
      }

      var { data, error } = await query;
      if (error) throw error;

      _bookingPanelState.requests = data || [];

      // Batch-fetch avatars
      var clientIds = _bookingPanelState.requests.map(function(r) { return r.client_id; }).filter(Boolean);
      if (clientIds.length > 0) {
        try {
          var uniqueIds = clientIds.filter(function(v, i, a) { return a.indexOf(v) === i; });
          var { data: profiles } = await sb.from('profiles').select('user_id, avatar_url').in('user_id', uniqueIds);
          if (profiles) {
            var avatarMap = {};
            profiles.forEach(function(p) { if (p.avatar_url) avatarMap[p.user_id] = p.avatar_url; });
            _bookingPanelState.requests.forEach(function(r) {
              if (r.client_id && avatarMap[r.client_id]) r.avatar_url = avatarMap[r.client_id];
            });
          }
        } catch(e) { /* no avatars */ }
      }

      _renderBookingRequestsList(container, portal);
    } catch (err) {
      console.error('Failed to load booking requests:', err);
      container.innerHTML = '<div style="padding:12px;color:#c00;font-size:0.85rem">Failed to load requests. Please refresh.</div>';
    }
  };

  function _renderBookingRequestsList(container, portal) {
    if (!container) return;

    if (_bookingPanelState.requests.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--mid);font-size:0.88rem">No ' + _bookingPanelState.currentFilter + ' requests</div>';
      return;
    }

    container.innerHTML = _bookingPanelState.requests.map(function(r) {
      var dateStr = r.preferred_date ? new Date(r.preferred_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
      var isHS = (r.service || '').toLowerCase().indexOf('house sitting') !== -1;
      var endDateStr = '';
      if (isHS && r.preferred_end_date) {
        endDateStr = new Date(r.preferred_end_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        var hsNights = Math.round((new Date(r.preferred_end_date + 'T12:00:00') - new Date(r.preferred_date + 'T12:00:00')) / (1000*60*60*24));
        dateStr = dateStr + ' → ' + endDateStr + ' (' + hsNights + ' night' + (hsNights !== 1 ? 's' : '') + ')';
      }

      var clientAvaHTML = '';
      if (r.avatar_url) {
        clientAvaHTML = '<img src="' + r.avatar_url + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #e0d5c5;flex-shrink:0">';
      } else {
        var initials = (r.contact_name || '?').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
        clientAvaHTML = '<div style="width:40px;height:40px;border-radius:50%;background:var(--gold-light,#f5e6c8);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:var(--ink,#1e1409);flex-shrink:0;border:2px solid #e0d5c5">' + initials + '</div>';
      }

      // Multi-date panel rendering with per-appointment actions
      var panelMultiDateHTML = '';
      if (r.date_details && Array.isArray(r.date_details) && r.date_details.length > 1) {
        var panelApptCards = r.date_details.map(function(dc, idx) {
          var dStr = new Date(dc.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          var tStr = dc.time ? ' @ ' + fmt12(dc.time) : '';
          var pStr = (dc.pets && dc.pets.length > 0) ? ' — ' + dc.pets.map(function(p) { return p.name; }).join(', ') : '';
          var apptStatus = dc.status || 'pending';
          var statusColor = apptStatus === 'accepted' ? '#4caf50' : apptStatus === 'declined' ? '#c00' : apptStatus === 'modified' ? '#c8963e' : 'var(--mid)';
          var statusBadge = dc.status ? '<span style="font-size:0.7rem;font-weight:700;color:' + statusColor + ';text-transform:uppercase;margin-left:8px">' + apptStatus + '</span>' : '';
          var perActions = '';
          if (r.status === 'pending') {
            perActions = '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">' +
              '<button class="btn btn-forest btn-sm" style="font-size:0.72rem;padding:4px 10px" onclick="event.stopPropagation();acceptSingleAppt(\'' + r.id + '\',' + idx + ')">✓ Accept</button>' +
              '<button class="btn btn-gold btn-sm" style="font-size:0.72rem;padding:4px 10px" onclick="event.stopPropagation();suggestTimeSingleAppt(\'' + r.id + '\',' + idx + ')">↻ Time</button>' +
              '<button class="btn btn-outline btn-sm" style="font-size:0.72rem;padding:4px 10px;color:#c00;border-color:#c00" onclick="event.stopPropagation();declineSingleAppt(\'' + r.id + '\',' + idx + ')">✕ Decline</button>' +
              '</div>';
          }
          return '<div style="background:#f0ebe3;border:1px solid #e0d5c5;border-radius:8px;padding:8px 12px;font-size:0.82rem" data-appt-idx="' + idx + '" id="arc-' + r.id + '">' +
            '<strong>' + dStr + '</strong>' + tStr + pStr + statusBadge + perActions + '</div>';
        });
        panelMultiDateHTML = '<div style="margin-top:8px"><strong style="font-size:0.85rem">' + r.date_details.length + ' Appointments:</strong>' +
          '<div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">' + panelApptCards.join('') + '</div></div>';
      }

      var actionsHTML = '';
      if (r.status === 'pending') {
        // Only show whole-booking buttons if single appointment
        var hasMultiDates = r.date_details && Array.isArray(r.date_details) && r.date_details.length > 1;
        if (hasMultiDates) {
          actionsHTML = '<div style="margin-top:12px;padding:8px 12px;background:var(--gold-pale);border-radius:6px;font-size:0.82rem;color:var(--gold-deep)">Use the buttons on each appointment above to accept or decline individually, or:</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
            '<button class="btn btn-forest btn-sm" onclick="acceptBookingRequest(\'' + r.id + '\')">✓ Accept All</button>' +
            '<button class="btn btn-outline btn-sm" style="color:#c00;border-color:#c00" onclick="declineBookingRequest(\'' + r.id + '\')">✕ Decline All</button>' +
            '</div>';
        } else {
          actionsHTML = [
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">',
            '  <button class="btn btn-forest btn-sm" onclick="acceptBookingRequest(\'' + r.id + '\')">✓ Accept</button>',
            '  <button class="btn btn-gold btn-sm" onclick="suggestTimeChange(\'' + r.id + '\')">↻ Suggest Time</button>',
            '  <button class="btn btn-outline btn-sm" style="color:#c00;border-color:#c00" onclick="declineBookingRequest(\'' + r.id + '\')">✕ Decline</button>',
            '</div>',
          ].join('');
        }
      } else if (r.status === 'modified') {
        actionsHTML = '<div style="margin-top:12px;padding:8px 12px;background:var(--gold-pale);border-radius:6px;font-size:0.83rem;color:var(--gold-deep)"><strong>⏱ Awaiting client response</strong> to your time suggestion</div>';
      } else if (r.status === 'accepted') {
        actionsHTML = '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-outline btn-sm" style="color:#c00;border-color:#c00" onclick="cancelBooking(\'' + r.id + '\',\'' + (r.service || '').replace(/'/g, "\\'") + '\')">✕ Cancel</button></div>';
      } else if (r.status === 'in_progress') {
        actionsHTML = '<div style="margin-top:12px;padding:8px 12px;background:var(--forest-pale);border-radius:6px;font-size:0.83rem;color:var(--forest)"><strong>⚙ In Progress</strong></div>';
      } else if (r.status === 'completed') {
        actionsHTML = '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-forest btn-sm" onclick="viewBookingReport(\'' + r.id + '\')">📋 View Report</button></div>';
      }

      // ── Schedule Preview: collect dates for this booking ──
      var spDates = [];
      if (r.date_details && Array.isArray(r.date_details) && r.date_details.length > 0) {
        spDates = r.date_details.map(function(dc) { return dc.date; });
      } else if (r.booking_dates && Array.isArray(r.booking_dates) && r.booking_dates.length > 1) {
        spDates = r.booking_dates.slice();
      } else if (r.preferred_date) {
        if (isHS && r.preferred_end_date) {
          var _c = new Date(r.preferred_date + 'T12:00:00');
          var _e = new Date(r.preferred_end_date + 'T12:00:00');
          while (_c <= _e) {
            var yy = _c.getFullYear(), mm = String(_c.getMonth()+1).padStart(2,'0'), dd = String(_c.getDate()).padStart(2,'0');
            spDates.push(yy+'-'+mm+'-'+dd);
            _c.setDate(_c.getDate() + 1);
          }
        } else {
          spDates = [r.preferred_date];
        }
      }
      var schedBtnHTML = '';
      if (spDates.length > 0 && (r.status === 'pending' || r.status === 'modified')) {
        var _spDatesAttr = spDates.join(',');
        schedBtnHTML = '<button class="sched-peek-btn" onclick="event.stopPropagation();HHP_BookingAdmin.toggleSchedulePreview(\'' + r.id + '\',\'' + _spDatesAttr + '\',this)" title="Check your schedule for this date">\uD83D\uDCC5</button>';
      }

      return [
        '<div class="card" data-request-id="' + r.id + '" style="border-left:4px solid ' + (r.status === 'pending' ? 'var(--gold)' : r.status === 'accepted' ? 'var(--forest)' : r.status === 'completed' ? '#4caf50' : '#999') + ';position:relative">',
        (schedBtnHTML ? '<div style="position:absolute;top:12px;right:12px;z-index:2">' + schedBtnHTML + '</div>' : ''),
        '  <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;padding-right:' + (schedBtnHTML ? '44px' : '0') + '">',
        '    <div><strong style="font-size:1rem">' + (r.service || 'Service') + '</strong><div style="font-size:0.78rem;color:var(--mid);margin-top:2px">' + (r.contact_email || '') + (r.contact_phone ? ' · ' + r.contact_phone : '') + '</div></div>',
        '    <span class="badge" style="background:' + (r.status === 'pending' ? 'var(--gold-light)' : r.status === 'accepted' ? 'var(--forest-light)' : r.status === 'completed' ? '#d4edda' : 'var(--rose-light)') + ';color:var(--ink);padding:4px 10px;border-radius:12px;font-size:0.75rem;font-weight:600">' + r.status + '</span>',
        '  </div>',
        '  <div class="sched-preview-content" id="sched-preview-' + r.id + '" style="display:none;margin-bottom:12px"></div>',
        '  <div style="display:flex;gap:12px;align-items:start;margin-bottom:12px">',
        '    ' + clientAvaHTML,
        '    <div style="flex:1;min-width:0">',
        '      <div style="font-weight:600;margin-bottom:4px">' + (r.contact_name || 'Client') + '</div>',
        '      <div style="font-size:0.82rem;color:var(--mid);margin-bottom:6px">\uD83D\uDCC5 ' + dateStr + ' at ' + fmt12(r.preferred_time || '') + '</div>',
        '      <div style="font-size:0.82rem;color:var(--mid);margin-bottom:4px">\uD83D\uDC3E ' + (r.pet_names || 'Pets') + '</div>',
        '      <div style="font-size:0.82rem;color:var(--mid);margin-bottom:4px">\uD83D\uDCCD ' + (r.address || 'Address') + '</div>',
        (r.estimated_total ? '      <div style="font-weight:600;color:var(--gold-deep);margin-top:6px">\uD83D\uDCB0 $' + Number(r.estimated_total).toFixed(2) + '</div>' : ''),
        '    </div>',
        '  </div>',
        (r.special_notes ? '  <div style="background:var(--gold-pale);padding:8px 10px;border-radius:6px;font-size:0.82rem;margin-bottom:12px"><strong>Notes:</strong> ' + r.special_notes + '</div>' : ''),
        panelMultiDateHTML,
        actionsHTML,
        '</div>',
      ].join('');
    }).join('');
  }

  window.filterOwnerRequests = function(status, btn) {
    _bookingPanelState.currentFilter = status;
    var panel = document.getElementById('o-requests');
    if (panel) panel.querySelectorAll('.admin-filter-btn').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    window.loadBookingRequestsPanel('owner');
  };

  window.filterStaffRequests = function(status, btn) {
    _bookingPanelState.currentFilter = status;
    var panel = document.getElementById('s-requests');
    if (panel) panel.querySelectorAll('.admin-filter-btn').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    window.loadBookingRequestsPanel('staff');
  };

  // Shared: send email + in-app notification for booking status changes
  async function _sendBookingNotification(req, newStatus, extraOpts) {
    if (!req || !req.contact_email) return;
    var sb = getSB();
    extraOpts = extraOpts || {};
    // 1. Send email notification
    try {
      await fetch('/api/booking-status-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: req.contact_email,
          name: req.contact_name || 'Client',
          service: req.service || 'Service',
          status: newStatus,
          scheduledDate: extraOpts.scheduledDate || req.preferred_date,
          scheduledTime: extraOpts.scheduledTime || req.preferred_time,
          adminNotes: extraOpts.adminNotes || '',
          paymentLink: '',
          estimatedTotal: req.estimated_total || null,
          priceBreakdown: req.price_breakdown || '',
          autoCharged: false,
          recurrencePattern: req.recurrence_pattern || null,
          dateDetails: req.date_details || null,
        }),
      });
    } catch (e) { console.warn('Email notification failed:', e); }
    // 2. Insert in-app message/alert for the client
    if (sb && req.client_id) {
      try {
        var owner = window.HHP_Auth && window.HHP_Auth.currentUser;
        var ownerName = 'Rachel Housley';
        try { if (owner && owner.profile && owner.profile.full_name) ownerName = owner.profile.full_name; } catch(e){}
        var statusLabel = newStatus === 'accepted' ? 'confirmed' : newStatus === 'declined' ? 'declined' : newStatus === 'modified' ? 'updated with a new suggested time' : newStatus;
        var msgBody = '📋 Your ' + (req.service || 'booking') + ' request has been ' + statusLabel + '.';
        if (extraOpts.adminNotes) msgBody += '\n' + extraOpts.adminNotes;
        if (newStatus === 'modified' && extraOpts.scheduledDate) {
          msgBody += '\n📅 New suggested date: ' + extraOpts.scheduledDate;
          if (extraOpts.scheduledTime) msgBody += ' at ' + extraOpts.scheduledTime;
        }
        await sb.from('messages').insert({
          sender_id: owner ? owner.id : null,
          sender_name: ownerName,
          recipient_id: req.client_id,
          body: msgBody,
          is_alert: true,
        });
      } catch (e) { console.warn('In-app message failed:', e); }
    }
  }

  // Optimistic UI helper: fade card and show status instantly
  function _optimisticCard(requestId, newStatus) {
    var card = document.querySelector('[data-request-id="' + requestId + '"]');
    if (!card) return;
    card.classList.add('opt-pending');
    var badge = card.querySelector('.status-badge');
    if (badge) {
      badge.textContent = newStatus;
      badge.style.color = newStatus === 'accepted' ? 'var(--forest)' : newStatus === 'declined' ? '#c00' : '#c8963e';
    }
  }
  function _optimisticDone(requestId, success) {
    var card = document.querySelector('[data-request-id="' + requestId + '"]');
    if (!card) return;
    card.classList.remove('opt-pending');
    if (success) { card.classList.add('opt-success'); setTimeout(function(){ card.classList.remove('opt-success'); }, 500); }
  }
  // Invalidate cache and refresh widgets after booking action
  function _afterBookingAction() {
    if (window.HHP_Cache) HHP_Cache.invalidate('booking_requests');
    if (window.HHP_Customizer && HHP_Customizer.refreshAll) HHP_Customizer.refreshAll();
  }

  window.acceptBookingRequest = async function(requestId) {
    var sb = getSB();
    if (!sb) return;
    try {
      var req = _bookingPanelState.requests.find(function(r) { return r.id === requestId; });
      if (!req) return;

      // Optimistic: update card instantly
      _optimisticCard(requestId, 'accepted');

      // Update DB (fast — just Supabase)
      await sb.from('booking_requests').update({
        status: 'accepted',
        scheduled_date: req.preferred_date,
        scheduled_time: req.preferred_time
      }).eq('id', requestId);

      // Show success immediately — don't wait for Stripe
      _optimisticDone(requestId, true);
      _sendBookingNotification(req, 'accepted');
      _afterBookingAction();
      if (typeof toast === 'function') toast('✓ Booking accepted! Processing payment...');

      // ── Charge saved card in background (non-blocking) ──
      if (req.estimated_total > 0 && req.client_id) {
        (async function() {
          try {
            var chargeResp = await fetch('/api/charge-saved-card', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookingRequestId: requestId, amount: req.estimated_total, service: req.service, clientProfileId: req.client_id }),
            });
            var chargeData = await chargeResp.json();
            if (chargeData.success && chargeData.status === 'deferred') {
              if (typeof toast === 'function') toast('💳 Payment deferred — will charge Sunday the week of service.');
            } else if (chargeData.success) {
              if (typeof toast === 'function') toast('💳 Card charged $' + Number(req.estimated_total).toFixed(2) + '!');
            } else {
              await sb.from('booking_requests').update({
                status: 'payment_hold',
                admin_notes: (req.admin_notes || '') + '\n⚠️ Accepted but payment failed: ' + (chargeData.message || chargeData.error || 'Card declined')
              }).eq('id', requestId);
              if (typeof toast === 'function') toast('⚠️ Card declined — booking on payment hold.');
            }
            // Refresh panel to show final payment status
            _afterBookingAction();
            window.loadBookingRequestsPanel(_bookingPanelState.portal);
          } catch (chargeErr) {
            console.warn('Auto-charge failed:', chargeErr);
            await sb.from('booking_requests').update({
              status: 'payment_hold',
              admin_notes: (req.admin_notes || '') + '\n⚠️ Accepted but charge request failed: ' + (chargeErr.message || 'Network error')
            }).eq('id', requestId);
            if (typeof toast === 'function') toast('⚠️ Charge failed — booking on payment hold.');
            _afterBookingAction();
          }
        })();
      } else {
        if (typeof toast === 'function') toast('✓ Booking accepted! Client notified.');
      }
    } catch (e) {
      _optimisticDone(requestId, false);
      console.error('Failed to accept booking:', e);
      if (typeof toast === 'function') toast('Error accepting booking');
      window.loadBookingRequestsPanel(_bookingPanelState.portal);
    }
  };

  window.declineBookingRequest = async function(requestId) {
    var sb = getSB();
    if (!sb) return;
    if (!confirm('Are you sure you want to decline this booking request?')) return;

    try {
      var req = _bookingPanelState.requests.find(function(r) { return r.id === requestId; });
      _optimisticCard(requestId, 'declined');
      if (typeof toast === 'function') toast('Booking declined. Client notified.');

      await sb.from('booking_requests').update({ status: 'declined' }).eq('id', requestId);
      _optimisticDone(requestId, true);
      _sendBookingNotification(req, 'declined');
      _afterBookingAction();
      window.loadBookingRequestsPanel(_bookingPanelState.portal);
    } catch (e) {
      _optimisticDone(requestId, false);
      console.error('Failed to decline booking:', e);
      if (typeof toast === 'function') toast('Error declining booking');
      window.loadBookingRequestsPanel(_bookingPanelState.portal);
    }
  };

  window.suggestTimeChange = function(requestId) {
    var container = document.createElement('div');
    // Build entire HTML as string first to avoid browser auto-closing <select>
    var timeOpts = '';
    for (var h = 5; h <= 22; h++) {
      for (var m = 0; m < 60; m += 30) {
        var hr12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        var ampm = h >= 12 ? 'PM' : 'AM';
        var mm = m === 0 ? '00' : '30';
        timeOpts += '<option value="' + ((h<10?'0':'')+h) + ':' + mm + '">' + hr12 + ':' + mm + ' ' + ampm + '</option>';
      }
    }
    container.innerHTML = [
      '<div style="background:var(--gold-pale);border-radius:8px;padding:14px;margin-top:12px;border:1px solid var(--gold)" class="time-change-form">',
      '  <div style="font-weight:600;margin-bottom:10px">Suggest Different Time</div>',
      '  <div style="margin-bottom:10px">',
      '    <label style="display:block;font-size:0.82rem;font-weight:600;margin-bottom:4px">New Date</label>',
      '    <input type="date" id="tc-date-' + requestId + '" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;font-size:0.85rem">',
      '  </div>',
      '  <div style="margin-bottom:10px">',
      '    <label style="display:block;font-size:0.82rem;font-weight:600;margin-bottom:4px">New Time</label>',
      '    <select id="tc-time-' + requestId + '" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px;font-size:0.85rem">',
      timeOpts,
      '    </select>',
      '  </div>',
      '  <div style="margin-bottom:10px">',
      '    <label style="display:block;font-size:0.82rem;font-weight:600;margin-bottom:4px">Message to Client</label>',
      '    <textarea id="tc-msg-' + requestId + '" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:6px;font-family:inherit;font-size:0.85rem;min-height:60px" placeholder="e.g., That day works but I can only do mornings..."></textarea>',
      '  </div>',
      '  <div style="display:flex;gap:8px">',
      '    <button class="btn btn-gold btn-sm" onclick="submitTimeChange(\'' + requestId + '\')" style="flex:1;justify-content:center">Send Suggestion</button>',
      '    <button class="btn btn-outline btn-sm" onclick="this.closest(\'.time-change-form\').style.display=\'none\'" style="flex:1;justify-content:center">Cancel</button>',
      '  </div>',
      '</div>',
    ].join('');

    var cardEl = document.querySelector('[data-request-id="' + requestId + '"]');
    if (!cardEl) {
      // Find the card by checking content
      var allCards = document.querySelectorAll('.card');
      for (var i = 0; i < allCards.length; i++) {
        if (allCards[i].textContent.indexOf(requestId) !== -1) {
          cardEl = allCards[i];
          break;
        }
      }
    }

    if (cardEl) {
      var existingForm = cardEl.querySelector('.time-change-form');
      if (existingForm) existingForm.remove();
      cardEl.appendChild(container.firstElementChild);
    }
  };

  window.submitTimeChange = async function(requestId) {
    var dateEl = document.getElementById('tc-date-' + requestId);
    var timeEl = document.getElementById('tc-time-' + requestId);
    var msgEl = document.getElementById('tc-msg-' + requestId);

    if (!dateEl || !dateEl.value) { alert('Please select a new date.'); return; }

    var sb = getSB();
    if (!sb) return;

    try {
      var req = _bookingPanelState.requests.find(function(r) { return r.id === requestId; });
      await sb.from('booking_requests').update({
        status: 'modified',
        scheduled_date: dateEl.value,
        scheduled_time: timeEl ? timeEl.value : '',
        admin_notes: msgEl ? msgEl.value : ''
      }).eq('id', requestId);

      _sendBookingNotification(req, 'modified', {
        scheduledDate: dateEl.value,
        scheduledTime: timeEl ? timeEl.value : '',
        adminNotes: msgEl ? msgEl.value : ''
      });
      if (typeof toast === 'function') toast('✓ Time suggestion sent! Client notified.');
      _afterBookingAction();
      window.loadBookingRequestsPanel(_bookingPanelState.portal);
    } catch (e) {
      console.error('Failed to submit time change:', e);
      if (typeof toast === 'function') toast('Error sending suggestion');
    }
  };

  window.cancelBooking = async function(requestId, service) {
    // Route through the cancel modal so refund prompt appears for paid bookings
    var req = _bookingPanelState.requests.find(function(r) { return r.id === requestId; });
    var portal = _bookingPanelState.portal || 'owner';
    var canceledBy = portal === 'staff' ? 'staff' : 'owner';
    var cancelDate = req ? (req.scheduled_date || req.preferred_date || '') : '';
    var cancelName = req ? (req.contact_name || 'Client') : 'Client';
    var isRecurring = req ? !!req.recurrence_pattern : false;

    if (typeof openCancelModal === 'function') {
      openCancelModal(requestId, service || (req ? req.service : ''), cancelDate, cancelName, isRecurring, canceledBy);
    } else {
      // Fallback: simple cancel if modal not available
      if (!confirm('Are you sure you want to cancel this booking?')) return;
      var sb = getSB();
      if (!sb) return;
      try {
        await sb.from('booking_requests').update({ status: 'canceled', canceled_at: new Date().toISOString(), canceled_by: canceledBy }).eq('id', requestId);
        _sendBookingNotification(req, 'declined');
        _afterBookingAction();
        if (typeof toast === 'function') toast('Booking cancelled.');
        window.loadBookingRequestsPanel(portal);
      } catch (e) {
        console.error('Failed to cancel booking:', e);
        if (typeof toast === 'function') toast('Error cancelling booking');
      }
    }
  };

  window.viewBookingReport = function(requestId) {
    if (typeof toast === 'function') toast('📋 Report viewing coming soon');
  };

  // ── Per-appointment actions (for multi-date bookings) ──
  async function _getBookingAndUpdate(requestId, apptIdx, updateFn, notifyStatus) {
    var sb = getSB();
    if (!sb) return;
    try {
      var { data: booking, error } = await sb.from('booking_requests').select('*').eq('id', requestId).single();
      if (error || !booking) { if (typeof toast === 'function') toast('Could not find booking'); return; }
      var dd = booking.date_details;
      if (!dd || !Array.isArray(dd) || !dd[apptIdx]) { if (typeof toast === 'function') toast('Appointment not found'); return; }
      var result = updateFn(booking, dd, apptIdx);
      if (result) {
        await sb.from('booking_requests').update(result).eq('id', requestId);
        // Send notification for per-appointment action
        if (notifyStatus && booking.contact_email) {
          var apptDate = dd[apptIdx].date ? new Date(dd[apptIdx].date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
          var noteMsg = apptDate ? 'Regarding your ' + apptDate + ' appointment.' : '';
          await _sendBookingNotification(booking, notifyStatus, { adminNotes: noteMsg });
        }

        // If overall booking just became 'accepted', trigger charge flow
        if (result.status === 'accepted' && booking.estimated_total > 0 && booking.client_id) {
          (async function() {
            try {
              var chargeResp = await fetch('/api/charge-saved-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingRequestId: requestId, amount: booking.estimated_total, service: booking.service, clientProfileId: booking.client_id }),
              });
              var chargeData = await chargeResp.json();
              if (chargeData.success && chargeData.status === 'deferred') {
                if (typeof toast === 'function') toast('\uD83D\uDCB3 Payment deferred \u2014 will charge Sunday the week of service.');
              } else if (chargeData.success) {
                if (typeof toast === 'function') toast('\uD83D\uDCB3 Card charged $' + Number(booking.estimated_total).toFixed(2) + '!');
              } else {
                await sb.from('booking_requests').update({ status: 'payment_hold', admin_notes: '\u26A0\uFE0F Payment failed: ' + (chargeData.message || chargeData.error || 'Card declined') }).eq('id', requestId);
                if (typeof toast === 'function') toast('\u26A0\uFE0F Card declined \u2014 booking on payment hold.');
              }
            } catch (chargeErr) {
              console.warn('Auto-charge on multi-date accept failed:', chargeErr);
            }
            if (typeof window.loadBookingRequestsPanel === 'function') window.loadBookingRequestsPanel(_bookingPanelState.portal);
          })();
        }

        if (typeof HHP_BookingAdmin !== 'undefined' && HHP_BookingAdmin.loadRequests) HHP_BookingAdmin.loadRequests();
        _afterBookingAction();
        if (typeof window.loadBookingRequestsPanel === 'function') window.loadBookingRequestsPanel(_bookingPanelState.portal);
      }
    } catch (e) {
      console.error('Per-appt action error:', e);
      if (typeof toast === 'function') toast('Error updating appointment');
    }
  }

  window.acceptSingleAppt = function(requestId, apptIdx) {
    _getBookingAndUpdate(requestId, apptIdx, function(booking, dd, idx) {
      dd[idx].status = 'accepted';
      var allDecided = dd.every(function(d) { return d.status === 'accepted' || d.status === 'declined'; });
      var allDeclined = dd.every(function(d) { return d.status === 'declined'; });
      var newStatus = allDecided ? (allDeclined ? 'declined' : 'accepted') : 'pending';
      var acceptedDates = dd.filter(function(d) { return d.status === 'accepted'; }).map(function(d) { return d.date; });
      if (typeof toast === 'function') toast('✓ Appointment accepted! Client notified.');
      return { date_details: dd, status: newStatus, scheduled_date: dd[idx].date, scheduled_time: dd[idx].time || '', booking_dates: acceptedDates.length > 0 ? acceptedDates : booking.booking_dates };
    }, 'accepted');
  };

  window.declineSingleAppt = function(requestId, apptIdx) {
    _getBookingAndUpdate(requestId, apptIdx, function(booking, dd, idx) {
      dd[idx].status = 'declined';
      var allDecided = dd.every(function(d) { return d.status === 'accepted' || d.status === 'declined'; });
      var allDeclined = dd.every(function(d) { return d.status === 'declined'; });
      var newStatus = allDecided ? (allDeclined ? 'declined' : 'accepted') : 'pending';
      var acceptedDates = dd.filter(function(d) { return d.status !== 'declined'; }).map(function(d) { return d.date; });
      if (typeof toast === 'function') toast('Appointment declined. Client notified.');
      return { date_details: dd, status: newStatus, booking_dates: acceptedDates.length > 0 ? acceptedDates : [booking.preferred_date] };
    }, 'declined');
  };

  window.suggestTimeSingleAppt = function(requestId, apptIdx) {
    // Find the appointment card and inject a time change form
    var cards = document.querySelectorAll('[data-appt-idx="' + apptIdx + '"]');
    var card = null;
    cards.forEach(function(c) {
      if (c.closest('#arc-' + requestId) || c.closest('[data-request-id="' + requestId + '"]')) card = c;
      // Fallback: just use the card if only one found
      if (!card) card = c;
    });
    if (!card) { if (typeof toast === 'function') toast('Could not find appointment'); return; }

    // Remove existing form if any
    var existing = card.querySelector('.appt-time-form');
    if (existing) { existing.remove(); return; }

    var formId = 'atf-' + requestId + '-' + apptIdx;
    var formHTML = '<div class="appt-time-form" style="background:var(--gold-pale,#fdf6e3);border-radius:6px;padding:10px;margin-top:8px;border:1px solid var(--gold,#c8963e)">' +
      '<div style="font-weight:600;font-size:0.78rem;margin-bottom:6px">Suggest Different Time</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">' +
      '<input type="date" id="' + formId + '-date" style="padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:0.78rem;flex:1;min-width:120px">' +
      '<select id="' + formId + '-time" style="padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:0.78rem;flex:1;min-width:100px"></select>' +
      '</div>' +
      '<textarea id="' + formId + '-msg" placeholder="Message to client..." style="width:100%;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:0.78rem;font-family:inherit;min-height:40px;box-sizing:border-box;margin-bottom:6px"></textarea>' +
      '<div style="display:flex;gap:6px">' +
      '<button class="arc-btn accept" style="font-size:0.72rem;padding:4px 10px" onclick="submitSingleApptTime(\'' + requestId + '\',' + apptIdx + ',\'' + formId + '\')">Send</button>' +
      '<button class="arc-btn decline" style="font-size:0.72rem;padding:4px 10px;background:#999" onclick="this.closest(\'.appt-time-form\').remove()">Cancel</button>' +
      '</div></div>';
    card.insertAdjacentHTML('beforeend', formHTML);

    // Populate time options
    var sel = document.getElementById(formId + '-time');
    if (sel) {
      for (var h = 5; h <= 22; h++) {
        for (var m = 0; m < 60; m += 30) {
          var hr12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
          var ampm = h >= 12 ? 'PM' : 'AM';
          var mm = m === 0 ? '00' : '30';
          var opt = document.createElement('option');
          opt.value = (h < 10 ? '0' : '') + h + ':' + mm;
          opt.textContent = hr12 + ':' + mm + ' ' + ampm;
          sel.appendChild(opt);
        }
      }
    }
  };

  window.submitSingleApptTime = function(requestId, apptIdx, formId) {
    var dateEl = document.getElementById(formId + '-date');
    var timeEl = document.getElementById(formId + '-time');
    var msgEl = document.getElementById(formId + '-msg');
    if (!dateEl || !dateEl.value) { alert('Please select a new date.'); return; }

    _getBookingAndUpdate(requestId, apptIdx, function(booking, dd, idx) {
      dd[idx].suggested_date = dateEl.value;
      dd[idx].suggested_time = timeEl ? timeEl.value : '';
      dd[idx].status = 'modified';
      dd[idx].admin_message = msgEl ? msgEl.value : '';
      if (typeof toast === 'function') toast('✓ Time suggestion sent! Client notified.');
      return { date_details: dd, status: 'modified', scheduled_date: dateEl.value, scheduled_time: timeEl ? timeEl.value : '', admin_notes: (booking.admin_notes || '') + '\nTime change suggested for ' + dd[idx].date + ': ' + dateEl.value + ' ' + (timeEl ? timeEl.value : '') };
    }, 'modified');
  };

})();

