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
    'Drop-In Visit (Cat) - 20 min':  18.00,
    'Drop-In Visit (Cat) - 30 min':  20.00,
    'Drop-In Visit (Cat) - 40 min':  30.00,
    'Drop-In Visit (Cat) - 1 hour':  35.00,
    'House Sitting - Per Night':    125.00,
    'House Sitting - Cat Care':      50.00,
    'House Sitting - Puppy Rate':   140.00,
    'House Sitting - Holiday Rate': 150.00,
    'House Sitting':                125.00,
  };

  // ── Active Deals Cache — fetched from Supabase, auto-applied to pricing ──
  var _activeDealsCache = [];
  var _dealsLoaded = false;
  var _dealsFetching = false;  // Prevent concurrent fetches
  var _clientUsedDealIds = []; // deal IDs the current client has already redeemed

  async function _fetchActiveDeals() {
    // Prevent concurrent calls
    if (_dealsFetching) return;
    _dealsFetching = true;

    var sb = getSB();
    if (!sb) { _dealsFetching = false; return; }
    try {
      var clientId = (typeof getEffectiveClientId === 'function' ? getEffectiveClientId() : null) || (window.HHP_Auth && window.HHP_Auth.currentUser ? window.HHP_Auth.currentUser.id : null);

      // Parallel fetch: deals + client usage in one round trip
      var promises = [sb.from('deals').select('*').eq('is_active', true)];
      if (clientId) {
        promises.push(sb.from('booking_requests').select('deal_id').eq('client_id', clientId).not('deal_id', 'is', null));
      }
      var results = await Promise.all(promises);

      _activeDealsCache = (results[0].data || []).filter(function(d) { return d.discount_value > 0; });
      _dealsLoaded = true;
      _clientUsedDealIds = results[1] && results[1].data ? results[1].data.map(function(r) { return r.deal_id; }) : [];
    } catch (e) { console.warn('Failed to load active deals:', e); }
    finally { _dealsFetching = false; }
  }

  // Public refresh function called when owner adds/deactivates deals
  window._refreshActiveDeals = function() {
    _fetchActiveDeals().then(function() {
      if (typeof window._brmUpdatePrice === 'function') window._brmUpdatePrice();
    }).catch(function(err) {
      console.warn('Failed to refresh deals:', err);
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
    }).catch(function(err) {
      console.warn('Failed to initialize deals:', err);
      // Retry after delay
      setTimeout(_initDeals, 5000);
    });
    // Subscribe to realtime deal changes so pricing updates everywhere automatically
    var sb = getSB();
    if (sb && sb.channel && !window._dealsRealtimeSubscribed) {
      try {
        window._dealsRealtimeSubscribed = true;
        window._dealsRealtimeChannel = sb.channel('deals-realtime')
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
      else if (at === 'drop_in' && svc.indexOf('Drop-In') !== -1) matches = true;
      else if (at === 'cat_care' && svc.indexOf('Drop-In') !== -1 && svc.indexOf('Cat') !== -1) matches = true;
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
    if (svc.indexOf('drop') !== -1 && svc.indexOf('cat') !== -1 && (svc.indexOf('hour') !== -1 || svc.indexOf('60') !== -1)) return SERVICE_PRICES['Drop-In Visit (Cat) - 1 hour'];
    if (svc.indexOf('drop') !== -1 && svc.indexOf('cat') !== -1 && svc.indexOf('40') !== -1) return SERVICE_PRICES['Drop-In Visit (Cat) - 40 min'];
    if (svc.indexOf('drop') !== -1 && svc.indexOf('cat') !== -1) return SERVICE_PRICES['Drop-In Visit (Cat) - 30 min'];
    if (svc.indexOf('drop') !== -1 && (svc.indexOf('hour') !== -1 || svc.indexOf('60') !== -1 || svc.indexOf('40') !== -1)) return SERVICE_PRICES['Drop-In Visit - 1 hour'];
    if (svc.indexOf('drop') !== -1 && svc.indexOf('40') !== -1) return SERVICE_PRICES['Drop-In Visit - 40 min'];
    if (svc.indexOf('drop') !== -1) return SERVICE_PRICES['Drop-In Visit - 30 min'];
    if (svc.indexOf('cat') !== -1 && svc.indexOf('drop') === -1 && svc.indexOf('house') === -1 && (svc.indexOf('hour') !== -1 || svc.indexOf('60') !== -1)) return SERVICE_PRICES['Drop-In Visit (Cat) - 1 hour'];
    if (svc.indexOf('cat') !== -1 && svc.indexOf('drop') === -1 && svc.indexOf('house') === -1 && svc.indexOf('40') !== -1) return SERVICE_PRICES['Drop-In Visit (Cat) - 40 min'];
    if (svc.indexOf('cat') !== -1 && svc.indexOf('drop') === -1 && svc.indexOf('house') === -1) return SERVICE_PRICES['Drop-In Visit (Cat) - 30 min'];
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

  // getStripePaymentLink removed in audit — was deprecated, use createCheckoutForService() instead

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
  // 2. MOBILE NAV — handled by ux-patch.js v18 (dead code removed in audit)
  // ════════════════════════════════════════════════════════════
  // [260 lines of dead fixMobileNav code removed — all handled by ux-patch.js]

  // ════════════════════════════════════════════════════════════
  // 3. BOOKING REQUEST MODAL & FORM
  // ════════════════════════════════════════════════════════════

  // Fallback services list (used if Supabase fetch fails)
  var DEFAULT_SERVICES = [
    { name: 'Dog Walking - 30 min', price: '$25', base: 25, type: 'dog', group: 'Dog Walking', extraPet: 15, puppy: 5, holiday: 10 },
    { name: 'Dog Walking - 1 hour', price: '$45', base: 45, type: 'dog', group: 'Dog Walking', extraPet: 15, puppy: 5, holiday: 10 },
    { name: 'Drop-In Visit - 30 min', price: '$25', base: 25, type: 'dog', group: 'Drop-In Visit', extraPet: 15, puppy: 5, holiday: 10 },
    { name: 'Drop-In Visit - 1 hour', price: '$45', base: 45, type: 'dog', group: 'Drop-In Visit', extraPet: 15, puppy: 5, holiday: 10 },
    { name: 'Drop-In Visit (Cat) - 30 min', price: '$20', base: 20, type: 'cat', group: 'Drop-In Visit', extraPet: 10, puppy: 0, holiday: 10 },
    { name: 'Drop-In Visit (Cat) - 1 hour', price: '$35', base: 35, type: 'cat', group: 'Drop-In Visit', extraPet: 10, puppy: 0, holiday: 10 },
    { name: 'House Sitting (Dog)', price: '$125/night', base: 125, type: 'dog', group: 'House Sitting', extraPet: 35, extraCat: 15, extra3plus: 35, puppy: 5, holiday: 10 },
    { name: 'House Sitting (Cat)', price: '$80/night', base: 80, type: 'cat', group: 'House Sitting', extraPet: 35, extraCat: 15, extra3plus: 35, puppy: 0, holiday: 10 },
    { name: 'Meet & Greet', price: 'Free', base: 0, type: 'any', group: 'Meet & Greet', extraPet: 0, puppy: 0, holiday: 0 },
  ];

  // Current services array — will be populated from DB or fallback to DEFAULT_SERVICES
  var SERVICES = DEFAULT_SERVICES.slice();

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

  // Check if ANY date in a range contains a holiday (for house sitting)
  function hasHolidayInRange(startStr, endStr) {
    if (!startStr) return false;
    if (!endStr) return isHoliday(startStr);
    var s = new Date(startStr + 'T12:00:00');
    var e = new Date(endStr + 'T12:00:00');
    for (var d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (isHoliday(key)) return true;
    }
    return false;
  }

  // Load holidays from Supabase table
  async function loadHolidaysFromDB(sb) {
    try {
      var { data, error } = await sb.from('holidays')
        .select('date_mmdd')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        HOLIDAYS = data.map(function(r) { return r.date_mmdd; });
        window._holidayData = data;
        // Clear the availability.js holiday cache so calendars pick up DB holidays
        if (typeof window.clearHolidayCache === 'function') window.clearHolidayCache();
        console.log('✓ Holidays loaded from DB (' + HOLIDAYS.length + ' dates)');
      }
    } catch (e) {
      console.warn('Failed to load holidays from DB; using defaults:', e);
    }
  }

  // Load pricing from Supabase table service_pricing
  // Helper: wait for Supabase library to load (it's async)
  function waitForSupabase(maxWait) {
    return new Promise(function(resolve) {
      if (window.supabase && window.supabase.createClient) { resolve(true); return; }
      var elapsed = 0;
      var iv = setInterval(function() {
        elapsed += 100;
        if (window.supabase && window.supabase.createClient) { clearInterval(iv); resolve(true); }
        else if (elapsed >= (maxWait || 5000)) { clearInterval(iv); resolve(false); }
      }, 100);
    });
  }

  async function loadPricingFromDB() {
    var sb = getSB();
    // Pricing is public (RLS allows anyone to read), so create a lightweight client
    // if auth isn't ready yet — don't skip just because user isn't logged in
    if (!sb) {
      await waitForSupabase(5000);
      try {
        if (window.supabase && window.supabase.createClient) {
          if (!window._hhpPricingSB) {
            window._hhpPricingSB = window.supabase.createClient(sbUrl, sbKey);
          }
          sb = window._hhpPricingSB;
        }
      } catch(e) {}
    }
    if (!sb) {
      console.warn('Supabase client not available; using default services');
      return;
    }

    try {
      var { data, error } = await sb.from('service_pricing')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) {
        console.warn('No service pricing data found; using default services');
        return;
      }

      // Map DB rows to SERVICES format
      var fetchedServices = data.map(function(row) {
        // Infer type from service_key
        var type = 'dog';
        if (row.service_key.indexOf('cat') !== -1) {
          type = 'cat';
        } else if (row.service_key === 'meet_greet') {
          type = 'any';
        } else if (row.service_key === 'housesit_mixed') {
          type = 'both';
        }

        // Infer group from service_key
        var group = 'Dog Walking';
        if (row.service_key.indexOf('dropin') !== -1) {
          group = 'Drop-In Visit';
        } else if (row.service_key.indexOf('housesit') !== -1) {
          group = 'House Sitting';
        } else if (row.service_key === 'meet_greet') {
          group = 'Meet & Greet';
        }

        // Format price display
        var priceStr = 'Free';
        if (row.base_price > 0) {
          priceStr = '$' + row.base_price + (row.unit === 'night' ? '/night' : '');
        }

        // For housesit_mixed, set extra3plus to 35 (all additional at $35/night)
        var extra3plus = 0;
        if (row.service_key.indexOf('housesit') !== -1) {
          extra3plus = 35;
        }

        return {
          name: row.service_label,
          price: priceStr,
          base: row.base_price,
          type: type,
          group: group,
          extraPet: row.extra_pet_fee || 0,
          extraCat: row.extra_cat_fee || 0,
          extra3plus: extra3plus,
          puppy: row.puppy_surcharge || 0,
          holiday: row.holiday_surcharge || 0
        };
      });

      // Update global SERVICES and store raw data
      SERVICES = fetchedServices;
      window._servicePricing = data;

      // Also update SERVICE_PRICES map used for Stripe checkout
      SERVICES.forEach(function(svc) {
        if (svc.base > 0) {
          SERVICE_PRICES[svc.name] = parseFloat(svc.base);
        }
      });

      console.log('✓ Service pricing loaded from DB (' + SERVICES.length + ' services)');

      // Also load holidays from DB using the same client
      await loadHolidaysFromDB(sb);
    } catch (e) {
      console.warn('Failed to load service pricing from DB; using default services:', e);
      SERVICES = DEFAULT_SERVICES.slice();
    }
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

    // Holiday surcharge — applies to ALL nights if any date in range is a holiday
    var holidayCost = 0;
    if (isHolidayDate && svc.holiday > 0) {
      holidayCost = svc.holiday * (isMultiNight ? nights : 1);
      parts.push('Holiday rate: +$' + svc.holiday + (isMultiNight ? '/night x ' + nights + ' nights = $' + holidayCost : ''));
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
                 if (s.group === 'Meet & Greet') return '<option value="Meet & Greet">Meet & Greet - Free</option>';
                 return '<option value="' + s.group + '">' + s.group + '</option>';
               }).join('');
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
      '      <label class="brm-label">Select your stay dates *</label>',
      '      <div id="brm-hs-cal" style="background:#f9f6f0;border:1px solid #e0d5c5;border-radius:10px;padding:12px;margin-bottom:8px"></div>',
      '      <div id="brm-hs-range-display" style="text-align:center;font-size:0.88rem;font-weight:600;color:#6b5c4d;padding:4px 0;margin-bottom:8px"></div>',
      '      <input type="hidden" id="brm-date" value="">',
      '      <input type="hidden" id="brm-enddate" value="">',
      '      <div id="brm-enddate-col" style="display:none"></div>',
      '      <div class="brm-row" id="brm-hs-times-row">',
      '        <div class="brm-col">',
      '          <label class="brm-label">Arrival Time *</label>',
      '          <select id="brm-hs-arrival" class="brm-input">' + (function(){var o='<option value="">Select arrival time</option>';for(var h=5;h<=22;h++){for(var m=0;m<60;m+=30){var hr12=h>12?h-12:(h===0?12:h);var ampm=h>=12?'PM':'AM';var mm=m===0?'00':'30';o+='<option value="'+((h<10?'0':'')+h)+':'+mm+'">'+hr12+':'+mm+' '+ampm+'</option>';}}return o;})() + '</select>',
      '        </div>',
      '        <div class="brm-col">',
      '          <label class="brm-label">Departure Time *</label>',
      '          <select id="brm-hs-departure" class="brm-input">' + (function(){var o='<option value="">Select departure time</option>';for(var h=5;h<=22;h++){for(var m=0;m<60;m+=30){var hr12=h>12?h-12:(h===0?12:h);var ampm=h>=12?'PM':'AM';var mm=m===0?'00':'30';o+='<option value="'+((h<10?'0':'')+h)+':'+mm+'">'+hr12+':'+mm+' '+ampm+'</option>';}}return o;})() + '</select>',
      '        </div>',
      '      </div>',
      '      <div id="brm-hs-nights-row" style="text-align:center;padding:8px 0;font-size:0.9rem;font-weight:600;color:#6b5c4d"></div>',
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
      '        <strong style="color:#2e7d32">💳 Payment Info:</strong> Your card is charged when your booking is accepted. Cancellations made 48+ hours before your appointment receive a full refund. For recurring services, your card is charged the Sunday before each appointment week.',
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
      var svcEl = document.getElementById('brm-service');
      var svcGroup = svcEl ? svcEl.value : '';
      if (!svcGroup) return '';
      var isMG = svcGroup === 'Meet & Greet';
      if (isMG) return svcGroup;
      var petType = document.getElementById('brm-pettype') ? document.getElementById('brm-pettype').value : 'dog';
      // House Sitting: resolve to dog or cat variant based on pet profiles
      var isHS = svcGroup === 'House Sitting';
      if (isHS) {
        if (petType === 'cat') return 'House Sitting (Cat)';
        return 'House Sitting (Dog)';
      }
      var dur = document.getElementById('brm-duration') ? document.getElementById('brm-duration').value : '30 min';
      // Drop-In Visit: use cat pricing when pet type is cat
      if (svcGroup === 'Drop-In Visit') {
        if (petType === 'cat') return 'Drop-In Visit (Cat) - ' + dur;
      }
      return svcGroup + ' - ' + dur;
    }

    // Show/hide duration dropdown based on service
    function toggleDurationField() {
      var svcEl = document.getElementById('brm-service');
      var svcGroup = svcEl ? svcEl.value : '';
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
      var endDateVal = document.getElementById('brm-enddate').value;
      var isHSSvc = svcName && svcName.toLowerCase().indexOf('house sitting') !== -1;
      // House Sitting: check entire date range for holidays; others: just the single date
      var holidayFlag = isHSSvc ? hasHolidayInRange(dateVal, endDateVal) : isHoliday(dateVal);

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

      // Show $0 until at least one pet profile is selected
      var selectedPetIds = (document.getElementById('brm-pets-selected-ids') || {}).value || '';
      if (!selectedPetIds) {
        if (estimateEl) estimateEl.style.display = 'block';
        if (breakdownEl) breakdownEl.textContent = 'Select a pet to see pricing';
        if (totalEl) totalEl.textContent = '0';
        return;
      }

      var nights = 1;
      if (isHSSvc) {
        nights = calcNights(dateVal, endDateVal);
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
        // Check for "until stopped" (ongoing) recurring time slots
        if (hasAnyRecurring) {
          document.querySelectorAll('[id^="brm-ts-ongoing-"]').forEach(function(onEl) {
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
        var oneTimeSlots = 0;
        var recurringSchedules = [];
        // Count recurring vs one-time across all time slots
        document.querySelectorAll('.brm-time-slot').forEach(function(slot) {
          var recurCb = slot.querySelector('[id^="brm-ts-recur-"]');
          var card = slot.closest('[data-date]');
          var cardDate = card ? card.getAttribute('data-date') : '';
          var timeSel = slot.querySelector('.brm-dc-time-sel');
          if (recurCb && recurCb.checked) {
            recurringCount++;
            var tsId = recurCb.id.replace('brm-ts-recur-', '');
            var freqEl = document.getElementById('brm-ts-freq-' + tsId);
            var ongoingEl = document.getElementById('brm-ts-ongoing-' + tsId);
            var endEl = document.getElementById('brm-ts-recur-end-' + tsId);
            var freq = freqEl ? freqEl.value : 'weekly';
            var isOngoing = ongoingEl && ongoingEl.checked;
            recurringSchedules.push({ date: cardDate, time: timeSel ? timeSel.value : '', freq: freq, ongoing: isOngoing, end: endEl ? endEl.value : '' });
          } else { oneTimeSlots++; }
        });
        var oneTimeTotal = result.total * oneTimeSlots;
        if (breakdownEl) {
          breakdownEl.innerHTML += '<br><span style="font-weight:600;color:#c8963e">Recurring: $' + result.total.toFixed(2) + '/appointment</span>';
          if (recurringCount > 1) {
            breakdownEl.innerHTML += '<br><span style="font-size:0.82rem">' + recurringCount + ' recurring schedules</span>';
          }
          if (oneTimeSlots > 0) {
            breakdownEl.innerHTML += '<br><span style="font-size:0.82rem">+ $' + oneTimeTotal.toFixed(2) + ' one-time (' + oneTimeSlots + ' session' + (oneTimeSlots > 1 ? 's' : '') + ')</span>';
          }
          breakdownEl.innerHTML += '<br><span style="font-size:0.78rem;color:#8c6b4a">Recurring visits charged the Sunday before each appointment week</span>';
        }
        // Show recurring schedule details
        if (perServiceEl && recurringSchedules.length > 0) {
          var recurHTML = '<div style="border-top:1px solid #e0d5c5;margin-top:6px;padding-top:6px">';
          recurHTML += '<div style="font-weight:600;font-size:0.78rem;color:#6b5c4d;margin-bottom:4px">Recurring Schedule:</div>';
          recurringSchedules.forEach(function(rs) {
            var dFmt = new Date(rs.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            var tFmt = rs.time ? ((typeof fmt12h === 'function') ? fmt12h(rs.time) : rs.time) : '';
            var freqLabel = rs.freq === 'weekly' ? 'Every week' : rs.freq === 'biweekly' ? 'Every 2 weeks' : rs.freq === 'monthly' ? 'Monthly' : rs.freq;
            var endLabel = rs.ongoing ? 'Until stopped' : (rs.end ? 'Until ' + new Date(rs.end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
            recurHTML += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:0.76rem">';
            recurHTML += '<span>' + svcName + ' — ' + dFmt + (tFmt ? ' at ' + tFmt : '') + '</span>';
            recurHTML += '<span style="color:#8c6b4a">' + freqLabel + (endLabel ? ' · ' + endLabel : '') + '</span></div>';
            recurHTML += '<div style="font-size:0.72rem;color:#8c6b4a;padding-left:8px">$' + result.total.toFixed(2) + '/visit · Charged the Sunday before each week</div>';
          });
          recurHTML += '</div>';
          perServiceEl.innerHTML = recurHTML;
        }
        // Show total: recurring rate + one-time total
        if (totalEl) {
          if (oneTimeSlots > 0) {
            totalEl.textContent = oneTimeTotal.toFixed(2) + ' + ' + result.total.toFixed(2) + '/appt';
          } else {
            totalEl.textContent = result.total.toFixed(2) + '/appt';
          }
        }
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
            var dealNameEscaped = (activeDeal.name || 'Special').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            dealNote.innerHTML = '<div style="font-weight:700;font-size:0.82rem;color:var(--forest)">🏷️ ' + dealNameEscaped + ' — ' + discLabel + '</div>' +
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
      var timeCol = document.getElementById('brm-time-col');

      if (endInput) endInput.required = isHS;

      // Build the HS calendar range picker when house sitting is selected
      if (isHS && typeof window._buildHsCalendar === 'function') {
        window._buildHsCalendar();
      }

      // Populate arrival/departure time selects for house sitting
      var arrivalSel = document.getElementById('brm-hs-arrival');
      var departureSel = document.getElementById('brm-hs-departure');
      if (arrivalSel && arrivalSel.options.length <= 1) {
        var timeOpts = '';
        for (var h = 5; h <= 22; h++) {
          for (var m = 0; m < 60; m += 30) {
            var hr12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
            var ampm = h >= 12 ? 'PM' : 'AM';
            var mm = m === 0 ? '00' : '30';
            var label = hr12 + ':' + mm + ' ' + ampm;
            var val24 = (h < 10 ? '0' : '') + h + ':' + mm;
            timeOpts += '<option value="' + val24 + '">' + label + '</option>';
          }
        }
        arrivalSel.innerHTML = '<option value="">Select arrival time</option>' + timeOpts;
        if (departureSel) departureSel.innerHTML = '<option value="">Select departure time</option>' + timeOpts;
      }
      // Make arrival/departure required for house sitting
      if (arrivalSel) arrivalSel.required = isHS;
      if (departureSel) departureSel.required = isHS;
      // Sync brm-time hidden input with arrival time for backward compat
      if (isHS && arrivalSel) {
        var hiddenTime = document.getElementById('brm-time');
        if (hiddenTime) hiddenTime.value = arrivalSel.value || '';
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

    }
    // Expose globally so openBookingModal can call directly (avoids setTimeout race)
    window._toggleHSFields = toggleHouseSittingFields;

    // Attach listeners for live update
    setTimeout(function() {
      ['brm-service', 'brm-date', 'brm-enddate'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', function() {
          if (id === 'brm-service') { toggleHouseSittingFields(); updateEndTimeDisplay(); if (typeof window._brmFilterPetsByService === 'function') window._brmFilterPetsByService(); }
          if (id === 'brm-date' || id === 'brm-enddate') toggleHouseSittingFields(); // update end date min/default + nights count
          updatePriceEstimate();
        });
      });
      // House sitting arrival/departure time change listeners
      ['brm-hs-arrival', 'brm-hs-departure'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', function() {
          // Sync arrival time to hidden brm-time for backward compat
          if (id === 'brm-hs-arrival') {
            var hiddenTime = document.getElementById('brm-time');
            if (hiddenTime) hiddenTime.value = el.value || '';
          }
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
    var _brmTsIdx = 0; // global time slot counter for unique IDs

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

    // Build a time slot HTML with its own recurring options
    function _brmBuildTimeSlotHTML(cardIdx, tsId, isFirst, dateVal) {
      var html = '<div class="brm-time-slot" data-tsid="' + tsId + '" style="margin-bottom:8px;padding:6px 0;' + (!isFirst ? 'border-top:1px dashed #e8dece;padding-top:8px;' : '') + '">';
      // Time row
      html += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px">';
      html += '<select ' + (isFirst ? 'id="brm-dc-time-' + cardIdx + '"' : '') + ' class="brm-input brm-dc-time-sel" data-card="' + cardIdx + '" data-tsid="' + tsId + '" onchange="window._brmSyncPrimary();updatePriceEstimate()" style="flex:1;min-width:0;margin:0;padding:8px;font-size:1rem;min-height:44px">';
      html += _brmTimeOptionsHTML();
      html += '</select>';
      // No per-slot X button — remove the whole date card to redo times
      html += '</div>';
      // "Apply to all dates" button — appears after selecting a time when 2+ cards exist
      html += '<div class="brm-apply-all-wrap" data-tsid="' + tsId + '" style="display:none;margin-top:4px;margin-bottom:2px"></div>';
      // Per-slot recurring toggle
      html += '<div style="margin-top:4px">';
      html += '<label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;cursor:pointer;color:#8c6b4a;font-weight:600">';
      html += '<input type="checkbox" id="brm-ts-recur-' + tsId + '" onchange="window._brmToggleSlotRecur(' + tsId + ')" style="accent-color:#c8963e"> Make recurring';
      html += '</label>';
      html += '<div id="brm-ts-recur-opts-' + tsId + '" style="display:none;margin-top:6px;background:var(--cream,#fff);border:1px solid #e8dece;border-radius:8px;padding:10px">';
      html += '<div style="display:flex;flex-direction:column;gap:8px">';
      html += '<div>';
      html += '<label style="font-size:0.75rem;font-weight:600;color:#8c6b4a;display:block;margin-bottom:3px">Frequency</label>';
      html += '<select id="brm-ts-freq-' + tsId + '" class="brm-input" onchange="window._brmUpdateSlotRecurPreview(' + tsId + ')" style="margin:0;padding:8px 10px;font-size:1rem;width:100%;box-sizing:border-box;min-height:44px;border:1px solid #d4c5b0;border-radius:6px;background:var(--cream,#fff);color:#4a3728">';
      html += '<option value="weekly">Every week</option><option value="biweekly">Every other week</option>';
      html += '</select>';
      html += '</div>';
      html += '<div id="brm-ts-end-wrap-' + tsId + '">';
      html += '<label style="font-size:0.75rem;font-weight:600;color:#8c6b4a;display:block;margin-bottom:3px">Until</label>';
      html += '<input type="date" id="brm-ts-recur-end-' + tsId + '" class="brm-input" value="" min="' + (dateVal || '') + '" onchange="window._brmUpdateSlotRecurPreview(' + tsId + ')" style="margin:0;padding:8px 10px;font-size:1rem;width:100%;box-sizing:border-box;min-height:44px;-webkit-appearance:none;appearance:none;border:1px solid #d4c5b0;border-radius:6px;background:var(--cream,#fff);color:#4a3728">';
      html += '</div>';
      html += '<label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;color:#6b5c4d;cursor:pointer">';
      html += '<input type="checkbox" id="brm-ts-ongoing-' + tsId + '" onchange="window._brmToggleSlotOngoing(' + tsId + ')" style="accent-color:#c8963e;width:16px;height:16px"> Until stopped (no end date)';
      html += '</label>';
      html += '</div>';
      html += '<div id="brm-ts-recur-preview-' + tsId + '" style="margin-top:8px;font-size:0.78rem;color:#6b5c4d;max-height:80px;overflow-y:auto"></div>';
      html += '</div>';
      html += '</div>';
      html += '</div>';
      return html;
    }

    // Generate compact pet checkboxes for a date card
    function _brmPetChipsHTML(cardIdx) {
      var pets = window._bookingPetsData || [];
      if (pets.length === 0) return '';
      var html = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">';
      pets.forEach(function(pet) {
        var icon = pet.species === 'cat' ? '🐱' : '🐶';
        html += '<label style="display:flex;align-items:center;gap:4px;padding:4px 10px;' +
          'background:var(--cream,#fff);border:1.5px solid #e0d5c5;border-radius:8px;cursor:pointer;' +
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
      // Check if "Apply to all" button should show on first card
      if (typeof window._brmCheckApplyAll === 'function') window._brmCheckApplyAll();
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

      var firstTsId = _brmTsIdx++;
      var card = document.createElement('div');
      card.id = 'brm-dc-' + idx;
      card.setAttribute('data-date', dateVal);
      card.style.cssText = 'background:#f9f6f0;border:1px solid #e0d5c5;border-radius:10px;padding:12px 14px;position:relative;box-sizing:border-box';
      card.innerHTML =
        '<button type="button" onclick="window._brmRemoveDateCard(' + idx + ')" style="position:absolute;top:8px;right:10px;background:none;border:none;color:#c4756a;cursor:pointer;font-size:22px;line-height:1;padding:6px;min-width:36px;min-height:36px;display:flex;align-items:center;justify-content:center">&times;</button>' +
        '<div style="font-weight:700;font-size:0.92rem;color:#1e1409;margin-bottom:6px">' +
          '<span style="color:#c8963e">' + dayName + '</span> ' + monthDay +
        '</div>' +
        '<div id="brm-dc-times-' + idx + '">' +
          _brmBuildTimeSlotHTML(idx, firstTsId, true, dateVal) +
        '</div>' +
        '<button type="button" onclick="window._brmAddTimeSlot(' + idx + ')" style="background:none;border:1px dashed #c8963e;color:#c8963e;border-radius:6px;padding:6px 14px;font-size:0.78rem;font-weight:600;cursor:pointer;margin-top:2px">+ Add another time</button>';
      container.appendChild(card);

      // Sort date cards chronologically (closest date first)
      window._brmDateCards.sort(function(a, b) {
        if (!a || !b) return 0;
        return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0);
      });
      window._brmDateCards.forEach(function(c) {
        if (!c) return;
        var el = document.getElementById('brm-dc-' + c.idx);
        if (el) container.appendChild(el);
      });

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
      var card = document.getElementById('brm-dc-' + cardIdx);
      var dateVal = card ? card.getAttribute('data-date') : '';
      var tsId = _brmTsIdx++;
      var div = document.createElement('div');
      div.innerHTML = _brmBuildTimeSlotHTML(cardIdx, tsId, false, dateVal);
      var slot = div.firstChild;
      container.appendChild(slot);
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

    // ── "Apply to all dates" feature (first card only) ──
    // Called from _syncPrimaryFromCards on every time change, card add/remove
    window._brmCheckApplyAll = function() {
      // Hide all existing apply-all buttons first
      document.querySelectorAll('.brm-apply-all-wrap').forEach(function(w) {
        w.style.display = 'none';
        w.innerHTML = '';
      });
      var cards = (window._brmDateCards || []).filter(function(c) { return !!c; });
      if (cards.length < 2) return;
      var firstCard = cards[0];
      var sel = document.getElementById('brm-dc-time-' + firstCard.idx);
      if (!sel || !sel.value) return;
      var timeVal = sel.value;
      var slot = sel.closest('.brm-time-slot');
      if (!slot) return;
      var tsId = slot.getAttribute('data-tsid');
      var wrap = slot.querySelector('.brm-apply-all-wrap[data-tsid="' + tsId + '"]');
      if (!wrap) return;
      var parts = timeVal.split(':');
      var h = parseInt(parts[0], 10);
      var m = parts[1];
      var hr12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      var ampm = h >= 12 ? 'PM' : 'AM';
      var label = hr12 + ':' + m + ' ' + ampm;
      wrap.style.display = 'block';
      wrap.innerHTML = '<button type="button" onclick="window._brmApplyTimeToAll()' +
        '" style="background:none;border:1px solid #c8963e;color:#c8963e;border-radius:6px;' +
        'padding:5px 12px;font-size:0.78rem;font-weight:600;cursor:pointer;' +
        'transition:all 0.15s"' +
        ' onmouseenter="this.style.background=\'#c8963e\';this.style.color=\'#fff\'"' +
        ' onmouseleave="this.style.background=\'none\';this.style.color=\'#c8963e\'"' +
        ' ontouchstart="this.style.background=\'#c8963e\';this.style.color=\'#fff\'"' +
        '>Apply ' + label + ' to all dates</button>';
    };

    window._brmApplyTimeToAll = function() {
      var cards = (window._brmDateCards || []).filter(function(c) { return !!c; });
      if (cards.length < 2) return;
      var firstSel = document.getElementById('brm-dc-time-' + cards[0].idx);
      if (!firstSel || !firstSel.value) return;
      var timeVal = firstSel.value;
      cards.forEach(function(c, i) {
        if (i === 0) return;
        var sel = document.getElementById('brm-dc-time-' + c.idx);
        if (sel) sel.value = timeVal;
      });
      document.querySelectorAll('.brm-apply-all-wrap').forEach(function(w) {
        w.style.display = 'none';
        w.innerHTML = '';
      });
      _syncPrimaryFromCards();
      updatePriceEstimate();
      var parts = timeVal.split(':');
      var h = parseInt(parts[0], 10);
      var hr12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      var ampm = h >= 12 ? 'PM' : 'AM';
      if (typeof toast === 'function') toast('Time set to ' + hr12 + ':' + parts[1] + ' ' + ampm + ' for all dates');
    };

    // Event delegation fallback for mobile — catches time selects that inline onchange misses
    document.addEventListener('change', function(e) {
      if (e.target && e.target.classList.contains('brm-dc-time-sel')) {
        if (typeof window._brmCheckApplyAll === 'function') window._brmCheckApplyAll();
      }
    });

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

    // ── House Sitting Calendar Range Picker ──
    window._hsCalYear = new Date().getFullYear();
    window._hsCalMonth = new Date().getMonth();
    window._hsRangeStart = null; // 'YYYY-MM-DD'
    window._hsRangeEnd = null;

    window._buildHsCalendar = function() {
      var container = document.getElementById('brm-hs-cal');
      if (!container) return;
      var year = window._hsCalYear;
      var month = window._hsCalMonth;
      var names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      var dayLabels = ['Su','Mo','Tu','We','Th','Fr','Sa'];
      var firstDay = new Date(year, month, 1).getDay();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var today = new Date();
      var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      var ownerBlocked = window._calOwnerBlocks || {};
      var monthHolidays = (typeof getMonthHolidays === 'function') ? getMonthHolidays(year, month) : {};

      var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
      html += '<button type="button" onclick="window._hsCalMonth--;if(window._hsCalMonth<0){window._hsCalMonth=11;window._hsCalYear--;}window._buildHsCalendar()" style="background:none;border:1px solid #e0d5c5;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:1rem;color:#1e1409">&#8592;</button>';
      html += '<span style="font-weight:700;font-size:0.9rem;color:#1e1409">' + names[month] + ' ' + year + '</span>';
      html += '<button type="button" onclick="window._hsCalMonth++;if(window._hsCalMonth>11){window._hsCalMonth=0;window._hsCalYear++;}window._buildHsCalendar()" style="background:none;border:1px solid #e0d5c5;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:1rem;color:#1e1409">&#8594;</button>';
      html += '</div>';

      html += '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;text-align:center">';
      dayLabels.forEach(function(dl) {
        html += '<div style="font-size:0.7rem;font-weight:700;color:#8c6b4a;padding:4px 0">' + dl + '</div>';
      });

      for (var i = 0; i < firstDay; i++) html += '<div></div>';

      for (var d = 1; d <= daysInMonth; d++) {
        var key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var isPast = key < todayStr;
        var isBlocked = ownerBlocked[key] ? true : false;
        var holiday = monthHolidays[key] || null;
        var isStart = key === window._hsRangeStart;
        var isEnd = key === window._hsRangeEnd;
        var isInRange = false;
        if (window._hsRangeStart && window._hsRangeEnd) {
          isInRange = key > window._hsRangeStart && key < window._hsRangeEnd;
        }

        var bg = 'white'; var color = '#1e1409'; var border = '1px solid #e8dece'; var cursor = 'pointer'; var opacity = '1'; var radius = '8px';
        if (isPast) { bg = '#f5f2ed'; color = '#bbb'; cursor = 'default'; opacity = '0.5'; }
        else if (isBlocked) { bg = '#fce8e6'; color = '#c4756a'; cursor = 'not-allowed'; }
        else if (isStart) { bg = '#5c6bc0'; color = '#fff'; border = '1px solid #3f51b5'; radius = '8px 0 0 8px'; }
        else if (isEnd) { bg = '#5c6bc0'; color = '#fff'; border = '1px solid #3f51b5'; radius = '0 8px 8px 0'; }
        else if (isInRange) { bg = '#e8eaf6'; color = '#3f51b5'; border = '1px solid #c5cae9'; radius = '0'; }
        else if (key === todayStr) { bg = '#fff8ec'; border = '1px solid #c8963e'; }

        var onclick = '';
        if (!isPast && !isBlocked) onclick = ' onclick="window._hsCalTapDate(\'' + key + '\')"';

        var title = '';
        if (holiday) title = holiday;
        if (isBlocked) title = (title ? title + ' — ' : '') + 'Rachel is unavailable';
        if (isStart) title = 'Start date';
        if (isEnd) title = 'End date';

        html += '<div' + onclick + ' title="' + title + '" style="';
        html += 'background:' + bg + ';color:' + color + ';border:' + border + ';';
        html += 'border-radius:' + radius + ';padding:6px 2px;cursor:' + cursor + ';opacity:' + opacity + ';';
        html += 'font-size:0.82rem;font-weight:600;position:relative;min-height:32px;';
        html += 'display:flex;flex-direction:column;align-items:center;justify-content:center;';
        html += 'transition:all 0.15s;user-select:none">';
        html += d;
        if (holiday) html += '<div style="font-size:0.5rem;line-height:1;color:' + ((isStart || isEnd) ? 'rgba(255,255,255,0.8)' : '#c8963e') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">' + holiday + '</div>';
        if (isBlocked && !isPast) html += '<div style="font-size:0.5rem;line-height:1;color:#c4756a">closed</div>';
        html += '</div>';
      }
      html += '</div>';

      // Instruction text
      if (!window._hsRangeStart) {
        html += '<div style="text-align:center;font-size:0.78rem;color:#8c6b4a;margin-top:8px">Tap your <strong>start date</strong></div>';
      } else if (!window._hsRangeEnd) {
        html += '<div style="text-align:center;font-size:0.78rem;color:#5c6bc0;margin-top:8px">Now tap your <strong>end date</strong></div>';
      }

      container.innerHTML = html;

      // Update hidden inputs and display
      var startInput = document.getElementById('brm-date');
      var endInput = document.getElementById('brm-enddate');
      if (startInput) startInput.value = window._hsRangeStart || '';
      if (endInput) endInput.value = window._hsRangeEnd || '';

      var displayEl = document.getElementById('brm-hs-range-display');
      var nightsEl = document.getElementById('brm-hs-nights-row');
      if (window._hsRangeStart && window._hsRangeEnd) {
        var sDate = new Date(window._hsRangeStart + 'T12:00:00');
        var eDate = new Date(window._hsRangeEnd + 'T12:00:00');
        var sLabel = sDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        var eLabel = eDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        var nights = Math.round((eDate - sDate) / (1000*60*60*24));
        if (displayEl) displayEl.innerHTML = '📅 ' + sLabel + ' → ' + eLabel;
        if (nightsEl) nightsEl.textContent = '🌙 ' + nights + ' night' + (nights !== 1 ? 's' : '');
      } else if (window._hsRangeStart) {
        var sDate2 = new Date(window._hsRangeStart + 'T12:00:00');
        var sLabel2 = sDate2.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        if (displayEl) displayEl.innerHTML = '📅 ' + sLabel2 + ' → ...';
        if (nightsEl) nightsEl.textContent = '';
      } else {
        if (displayEl) displayEl.innerHTML = '';
        if (nightsEl) nightsEl.textContent = '';
      }

      // Trigger price estimate update
      if (typeof updatePriceEstimate === 'function') updatePriceEstimate();
      if (typeof toggleHouseSittingFields === 'function') toggleHouseSittingFields();
    };

    window._hsCalTapDate = function(dateStr) {
      if (!window._hsRangeStart || (window._hsRangeStart && window._hsRangeEnd)) {
        // First tap or reset: set start
        window._hsRangeStart = dateStr;
        window._hsRangeEnd = null;
      } else {
        // Second tap: set end (must be after start)
        if (dateStr <= window._hsRangeStart) {
          // Tapped same or earlier — reset to this as new start
          window._hsRangeStart = dateStr;
          window._hsRangeEnd = null;
        } else {
          window._hsRangeEnd = dateStr;
        }
      }
      window._buildHsCalendar();
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

    // ── Per-time-slot recurring: toggle, preview, and date generation ──
    window._brmToggleSlotRecur = function(tsId) {
      var cb = document.getElementById('brm-ts-recur-' + tsId);
      var opts = document.getElementById('brm-ts-recur-opts-' + tsId);
      if (!cb || !opts) return;
      opts.style.display = cb.checked ? '' : 'none';
      if (cb.checked) {
        window._brmUpdateSlotRecurPreview(tsId);
      }
      updatePriceEstimate();
    };

    window._brmToggleSlotOngoing = function(tsId) {
      var ongoing = document.getElementById('brm-ts-ongoing-' + tsId);
      var endWrap = document.getElementById('brm-ts-end-wrap-' + tsId);
      if (!ongoing) return;
      if (endWrap) endWrap.style.display = ongoing.checked ? 'none' : '';
      window._brmUpdateSlotRecurPreview(tsId);
    };

    window._brmUpdateSlotRecurPreview = function(tsId) {
      var preview = document.getElementById('brm-ts-recur-preview-' + tsId);
      if (!preview) return;
      var ongoing = document.getElementById('brm-ts-ongoing-' + tsId);
      var isOngoing = ongoing && ongoing.checked;
      var freq = (document.getElementById('brm-ts-freq-' + tsId) || {}).value || 'weekly';
      var freqLabel = freq === 'weekly' ? 'every week' : 'every other week';
      // Find the parent card's date
      var slot = document.getElementById('brm-ts-recur-' + tsId);
      var card = slot ? slot.closest('[data-date]') : null;
      var startDate = card ? card.getAttribute('data-date') : '';

      if (isOngoing) {
        var startFmt = startDate ? new Date(startDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : '';
        preview.innerHTML = '<span style="color:#c8963e;font-weight:600">Repeats ' + freqLabel + '</span> starting ' + startFmt + '<br><em>Charged the Sunday before each appointment week · continues until you cancel</em>';
      } else {
        var dates = _getSlotRecurDates(tsId);
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

    // Generate recurring dates for a specific time slot
    function _getSlotRecurDates(tsId) {
      var cb = document.getElementById('brm-ts-recur-' + tsId);
      if (!cb || !cb.checked) return [];
      var slot = cb.closest('[data-date]');
      if (!slot) return [];
      var startDate = slot.getAttribute('data-date');
      if (!startDate) return [];
      var ongoing = document.getElementById('brm-ts-ongoing-' + tsId);
      if (ongoing && ongoing.checked) return [];
      var freq = (document.getElementById('brm-ts-freq-' + tsId) || {}).value || 'weekly';
      var endStr = (document.getElementById('brm-ts-recur-end-' + tsId) || {}).value;
      if (!endStr) return [];

      var intervalDays = freq === 'biweekly' ? 14 : 7;
      var start = new Date(startDate + 'T12:00:00');
      var end = new Date(endStr + 'T12:00:00');
      var dates = [];
      for (var d = new Date(start); d <= end; d.setDate(d.getDate() + intervalDays)) {
        dates.push(_localDateStr(d));
      }
      return dates;
    }

    // Get ALL recurring dates across ALL time slots (for submission + price calc)
    function getRecurDates() {
      var allDates = [];
      document.querySelectorAll('[id^="brm-ts-recur-"]').forEach(function(cb) {
        if (!cb.checked) return;
        var tsId = cb.id.replace('brm-ts-recur-', '');
        var dates = _getSlotRecurDates(parseInt(tsId));
        dates.forEach(function(d) {
          if (allDates.indexOf(d) === -1) allDates.push(d);
        });
      });
      return allDates.sort();
    }
    window._brmGetRecurDates = getRecurDates;

    // Check if any time slot has recurring enabled
    function _anySlotIsRecurring() {
      var found = false;
      document.querySelectorAll('[id^="brm-ts-recur-"]').forEach(function(cb) {
        if (cb.checked) found = true;
      });
      return found;
    }
    window._brmAnyCardRecurring = _anySlotIsRecurring;

    // Backward-compat: updateRecurPreview is a no-op now (per-slot handles it)
    function updateRecurPreview() { /* handled per-slot */ }

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
      '  overflow-x: hidden;',
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
      '  background: var(--cream,#fff);',
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
      '  .brm-input, .brm-dc-time-sel { font-size: 16px !important; min-height: 44px !important; }',
      '  select.brm-input, input[type="date"].brm-input, input[type="time"].brm-input { font-size: 16px !important; min-height: 44px !important; max-width: 100% !important; }',
      '  .brm-dc-time-sel { min-width: 100% !important; max-width: 100% !important; }',
      '  .brm-label { font-size: 13px; }',
      '}',
      '@media (max-width: 480px) {',
      '  .brm-content { padding: 16px 12px; width: 96vw; max-width: 96vw; }',
      '  .brm-title { font-size: 20px; }',
      '  .brm-label { font-size: 12px; }',
      '  .brm-day-chip { padding: 4px 8px; font-size: 0.78rem; }',
      '  .brm-date-tag { padding: 4px 8px; font-size: 0.78rem; }',
      '}',
      '@media (max-width: 375px) {',
      '  .brm-content { padding: 14px 10px; }',
      '  .brm-title { font-size: 18px; }',
      '}',
      '@media (max-width: 600px) and (orientation: landscape) {',
      '  .brm-content { max-height: 85vh !important; padding: 12px !important; }',
      '}',
      '',
      // ── Admin dashboard styles ──
      '#hhpAdminDashboard {',
      '  padding: 24px;',
      '  max-width: 900px;',
      '  margin: 0 auto;',
      '}',
      '.admin-request-card {',
      '  background: var(--cream,#fff);',
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
      '.arc-btn.decline { background: var(--cream,#fff); color: #C4756A; border-color: #C4756A; }',
      '.arc-btn.decline:hover { background: #F8D7DA; }',
      '.arc-btn.modify { background: var(--cream,#fff); color: var(--gold, #C8963E); border-color: var(--gold, #C8963E); }',
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
      '  padding: 5px 8px; margin: 3px 0; background: var(--cream,#fff);',
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
      '  background: var(--cream,#fff);',
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
    // Require account — show guest service prompt for non-logged-in visitors
    if (!window.HHP_Auth || !window.HHP_Auth.currentUser) {
      if (typeof guestServicePrompt === 'function') {
        guestServicePrompt(preselectedService || 'Pet Care');
      } else {
        var authOverlay = document.getElementById('authOverlay');
        if (authOverlay) { authOverlay.classList.add('open'); if (typeof toggleAuthMode === 'function') toggleAuthMode('signup'); }
      }
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
          // Cat Care merged into Drop-In Visit — redirect old references
          if (matchGroup === 'Cat Care Visit' || matchGroup === 'Cat Care') matchGroup = 'Drop-In Visit';
          // Check if it's a House Sitting variant
          var isHS = matchGroup.toLowerCase().indexOf('house sitting') !== -1;
          var isMG = matchGroup === 'Meet & Greet';

          if (isHS) {
            // Show single House Sitting option — pet type determines pricing
            sel.innerHTML = '<option value="">Choose a service...</option>' +
              '<option value="House Sitting">House Sitting</option>';
            sel.selectedIndex = 1;
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
          // Direct HS setup — avoids race condition when listeners are in setTimeout
          try {
            var _isHS = (sel.value || '').toLowerCase().indexOf('house sitting') !== -1;
            var _multiSec = document.getElementById('brm-multidate-section');
            var _hsRow = document.getElementById('brm-hs-date-row');
            if (_multiSec) _multiSec.style.display = _isHS ? 'none' : '';
            if (_hsRow) _hsRow.style.display = _isHS ? '' : 'none';
            if (_isHS && typeof window._toggleHSFields === 'function') window._toggleHSFields();
          } catch(hsErr) { console.warn('HS setup error:', hsErr); }
        } else {
          // Restore full dropdown (modal is reused, may have been filtered by a previous open)
          var seen = {};
          var allOpts = '<option value="">Choose a service...</option>';
          SERVICES.forEach(function(s) {
            if (seen[s.group]) return;
            seen[s.group] = true;
            if (s.group === 'Meet & Greet') { allOpts += '<option value="Meet & Greet">Meet &amp; Greet - Free</option>'; return; }
            allOpts += '<option value="' + s.group + '">' + s.group + '</option>';
          });
          sel.innerHTML = allOpts;
        }
      }

      // Reset multi-date state on open
      window._brmDateCards = [];
      var datesListEl = document.getElementById('brm-dates-list');
      if (datesListEl) datesListEl.innerHTML = '';
      var addDateInput = document.getElementById('brm-add-date-input');
      if (addDateInput) { addDateInput.value = ''; addDateInput.defaultValue = ''; }
      // Also reset House Sitting date range inputs + calendar range state
      window._hsRangeStart = null;
      window._hsRangeEnd = null;
      window._hsCalYear = new Date().getFullYear();
      window._hsCalMonth = new Date().getMonth();
      var hsDateEl = document.getElementById('brm-date');
      var hsEndEl = document.getElementById('brm-enddate');
      if (hsDateEl) { hsDateEl.value = ''; hsDateEl.defaultValue = ''; }
      if (hsEndEl) { hsEndEl.value = ''; hsEndEl.defaultValue = ''; }
      // Reset arrival/departure time selects
      var hsArrReset = document.getElementById('brm-hs-arrival');
      var hsDepReset = document.getElementById('brm-hs-departure');
      if (hsArrReset) hsArrReset.selectedIndex = 0;
      if (hsDepReset) hsDepReset.selectedIndex = 0;
      // Rebuild HS calendar with fresh state
      try {
        if (typeof window._buildHsCalendar === 'function') window._buildHsCalendar();
      } catch(calErr) { console.warn('HS calendar build error:', calErr); }
      // Show the helper message and rebuild calendar picker
      var noMsg = document.getElementById('brm-no-dates-msg');
      if (noMsg) noMsg.style.display = '';
      // Reset calendar picker to current month and rebuild
      window._brmCalPickerYear = new Date().getFullYear();
      window._brmCalPickerMonth = new Date().getMonth();
      try {
        if (typeof window._buildBrmCalPicker === 'function') window._buildBrmCalPicker();
      } catch(calErr2) { console.warn('Cal picker build error:', calErr2); }

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
          'background:var(--cream,#fff);border:2px solid #e0d5c5;border-radius:10px;cursor:pointer;',
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

    // Filter pets based on selected service (outside try/catch so pet load isn't blocked)
    try { if (typeof window._brmFilterPetsByService === 'function') window._brmFilterPetsByService(); } catch(e) { console.warn('Pet filter error:', e); }
  };

  // ── FILTER PET CHECKBOXES BY SERVICE TYPE ──
  // Dog Walking = dogs only (cats can't go on walks), everything else = all pets
  window._brmFilterPetsByService = function() {
    var svcEl = document.getElementById('brm-service');
    var svcGroup = svcEl ? svcEl.value : '';
    var labels = document.querySelectorAll('.brm-pet-checkbox-label');
    if (!labels.length) return;

    var isDogOnly = svcGroup.toLowerCase().indexOf('dog walk') !== -1;

    labels.forEach(function(label) {
      var cb = label.querySelector('.brm-pet-cb');
      if (!cb) return;
      var species = cb.getAttribute('data-species') || 'dog';

      if (isDogOnly && species === 'cat') {
        label.style.display = 'none';
        cb.checked = false;
      } else {
        label.style.display = '';
      }
    });

    // Re-run pet selection update to recalculate totals after filtering
    window._brmUpdatePetSelection();
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
      // House Sitting uses the date range + arrival/departure time fields
      date = document.getElementById('brm-date').value;
      var arrivalEl = document.getElementById('brm-hs-arrival');
      time = arrivalEl ? arrivalEl.value : '';
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
      var recurringSlots = [];
      // Collect recurring schedules from per-time-slot checkboxes
      document.querySelectorAll('[id^="brm-ts-recur-"]').forEach(function(cb) {
        if (!cb.checked) return;
        var tsId = cb.id.replace('brm-ts-recur-', '');
        var card = cb.closest('[data-date]');
        if (!card) return;
        var ongoingEl = document.getElementById('brm-ts-ongoing-' + tsId);
        var isOngoing = ongoingEl && ongoingEl.checked;
        // Find the time select for this slot
        var slot = cb.closest('.brm-time-slot');
        var timeSel = slot ? slot.querySelector('.brm-dc-time-sel') : null;
        recurringSlots.push({
          start_date: card.getAttribute('data-date'),
          frequency: (document.getElementById('brm-ts-freq-' + tsId) || {}).value || 'weekly',
          end_date: isOngoing ? null : ((document.getElementById('brm-ts-recur-end-' + tsId) || {}).value || ''),
          ongoing: isOngoing,
          time: timeSel ? timeSel.value : ''
        });
      });
      if (recurringSlots.length > 0) {
        recurrencePattern = {
          type: 'per_card',
          schedules: recurringSlots,
          time: time
        };
      }
    }

    // Calculate price (with nights for House Sitting)
    var petCombo = document.getElementById('brm-petcombo') ? document.getElementById('brm-petcombo').value : '';
    var isHouseSitting = service.toLowerCase().indexOf('house sitting') !== -1;
    var nights = 1;
    if (isHouseSitting) {
      nights = calcNights(date, endDate);
    }
    // House Sitting: check entire date range for holidays; others: just the single date
    var holidayFlag = isHouseSitting ? hasHolidayInRange(date, endDate) : isHoliday(date);
    var priceResult = calculatePrice(service, numPets, isPuppy, holidayFlag, petType, nights);

    // For multi-date / recurring pricing — count total visits (time slots), not just unique dates
    var totalDates = dateCardDetails.length > 0 ? dateCardDetails.length : allBookingDates.length;
    var multiDateTotal, multiDateBreakdown;
    if (isRecurring && !isHouseSitting) {
      // Count recurring vs one-time time slots
      var recurSlotCount = 0;
      var oneTimeSlotCount = 0;
      document.querySelectorAll('.brm-time-slot').forEach(function(slot) {
        var recurCb = slot.querySelector('[id^="brm-ts-recur-"]');
        if (recurCb && recurCb.checked) { recurSlotCount++; } else { oneTimeSlotCount++; }
      });
      // Estimated total = one-time visits total + per-session recurring rate
      var oneTimeCost = priceResult.total * oneTimeSlotCount;
      multiDateTotal = oneTimeCost + priceResult.total; // one-time total + recurring per-appt rate
      multiDateBreakdown = priceResult.breakdown;
      if (oneTimeSlotCount > 0) {
        multiDateBreakdown += ' | One-time: $' + oneTimeCost.toFixed(2) + ' (' + oneTimeSlotCount + ' session' + (oneTimeSlotCount > 1 ? 's' : '') + ')';
      }
      multiDateBreakdown += ' | Recurring: $' + priceResult.total.toFixed(2) + '/appointment (' + recurSlotCount + ' schedule' + (recurSlotCount > 1 ? 's' : '') + '), charged the Sunday before each appointment week';
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
    // House Sitting requires end date + arrival/departure times
    if (isHouseSitting && !endDate) {
      if (errEl) errEl.textContent = 'Please select an end date for House Sitting.';
      return;
    }
    if (isHouseSitting) {
      var hsArrival = document.getElementById('brm-hs-arrival');
      var hsDeparture = document.getElementById('brm-hs-departure');
      if (hsArrival && !hsArrival.value) {
        if (errEl) errEl.textContent = 'Please select an arrival time for House Sitting.';
        return;
      }
      if (hsDeparture && !hsDeparture.value) {
        if (errEl) errEl.textContent = 'Please select a departure time for House Sitting.';
        return;
      }
    }
    // Recurring time slots need end dates unless set to "until stopped"
    if (isRecurring) {
      var missingEnd = false;
      document.querySelectorAll('[id^="brm-ts-recur-"]').forEach(function(cb) {
        if (!cb.checked) return;
        var tsId = cb.id.replace('brm-ts-recur-', '');
        var ongoingEl = document.getElementById('brm-ts-ongoing-' + tsId);
        var isOngoing = ongoingEl && ongoingEl.checked;
        if (!isOngoing) {
          var endEl = document.getElementById('brm-ts-recur-end-' + tsId);
          if (!endEl || !endEl.value) missingEnd = true;
        }
      });
      if (missingEnd) {
        if (errEl) errEl.textContent = 'Please set an end date for recurring times (or choose "Until stopped").';
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
          var _pmSb = window.HHP_Auth && window.HHP_Auth.supabase;
          var _pmSess = _pmSb ? await _pmSb.auth.getSession() : null;
          var _pmToken = _pmSess && _pmSess.data && _pmSess.data.session ? _pmSess.data.session.access_token : '';
          var pmResp = await fetch('/api/get-payment-methods?profileId=' + encodeURIComponent(window.HHP_Auth.currentUser.id) + '&email=' + encodeURIComponent(window.HHP_Auth.currentUser.email), {
            headers: { 'Authorization': 'Bearer ' + _pmToken }
          });
          pmData = await pmResp.json();
          window._cachedPaymentMethods = pmData;
          window._cachedPaymentMethodsAt = Date.now();
        }
        if (!pmData.hasCard || !pmData.methods || pmData.methods.length === 0) {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('btn-loading'); submitBtn.textContent = 'Submit Booking Request'; }
          if (errEl) errEl.innerHTML = '💳 <strong>Payment method required.</strong> Please add a card on file before booking a paid service. ' +
            '<a href="#" onclick="event.preventDefault();window._saveBookingAndAddCard();" style="color:var(--gold-deep);font-weight:600;text-decoration:underline;">Add Payment Method</a>';
          return;
        }
      } catch (pmErr) {
        console.warn('Payment method check failed:', pmErr);
        // If check fails, allow booking to proceed (don't block on network error)
      }
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add('btn-loading'); submitBtn.setAttribute('data-orig-text', submitBtn.textContent); submitBtn.textContent = 'Sending request...'; }

    try {
      var sb = getSB();
      if (!sb) throw new Error('Unable to connect to booking system. Please try again.');

      var clientId = (typeof getEffectiveClientId === 'function' ? getEffectiveClientId() : null) || (window.HHP_Auth && window.HHP_Auth.currentUser ? window.HHP_Auth.currentUser.id : null);

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

      // ── Split multi-slot bookings into individual records ──
      // Each time slot becomes its own booking_request so owner/staff can manage them independently
      var shouldSplit = dateCardDetails.length > 1 && !isHouseSittingSvc;
      var data, error;

      if (shouldSplit) {
        var perVisitPrice = priceResult.total;
        var perVisitDealSavings = window._brmDealDiscount ? (window._brmDealDiscount.savings / dateCardDetails.length) : null;
        var perVisitTotal = window._brmDealDiscount ? (window._brmDealDiscount.discountedTotal / dateCardDetails.length) : perVisitPrice;

        // Build a map of per-slot recurring settings
        var slotRecurMap = {};
        document.querySelectorAll('.brm-time-slot').forEach(function(slot, slotIdx) {
          var recurCb = slot.querySelector('[id^="brm-ts-recur-"]');
          var isSlotRecurring = recurCb && recurCb.checked;
          var slotRecurrence = null;
          if (isSlotRecurring) {
            var tsId = recurCb.id.replace('brm-ts-recur-', '');
            var card = slot.closest('[data-date]');
            var ongoingEl = document.getElementById('brm-ts-ongoing-' + tsId);
            var isOngoing = ongoingEl && ongoingEl.checked;
            var timeSel = slot.querySelector('.brm-dc-time-sel');
            slotRecurrence = {
              type: 'per_card',
              schedules: [{
                start_date: card ? card.getAttribute('data-date') : '',
                time: timeSel ? timeSel.value : '',
                frequency: (document.getElementById('brm-ts-freq-' + tsId) || {}).value || 'weekly',
                end_date: isOngoing ? null : ((document.getElementById('brm-ts-recur-end-' + tsId) || {}).value || ''),
                ongoing: isOngoing
              }]
            };
          }
          slotRecurMap[slotIdx] = slotRecurrence;
        });

        var insertRows = dateCardDetails.map(function(dc, idx) {
          var slotRecurrence = slotRecurMap[idx] || null;
          var slotBreakdown = priceResult.breakdown;
          if (slotRecurrence) {
            slotBreakdown += ' | Recurring: $' + perVisitPrice.toFixed(2) + '/appointment, charged the Sunday before each appointment week';
          }
          if (window._brmDealDiscount) {
            slotBreakdown += ' | 🏷️ ' + window._brmDealDiscount.deal.name + ': -$' + perVisitDealSavings.toFixed(2);
          }
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
            price_breakdown: slotBreakdown,
            deal_id: window._brmDealDiscount ? window._brmDealDiscount.deal.id : null,
            deal_discount: perVisitDealSavings,
            special_notes: notes || null,
            address: address,
            house_area: address,
            client_id: clientId,
            status: 'pending',
            booking_dates: slotRecurrence ? [dc.date] : null,
            recurrence_pattern: slotRecurrence,
            date_details: [dc],
            selected_pet_ids: selectedPetIds ? selectedPetIds.split(',') : null,
          };
        });

        var result = await sb.from('booking_requests').insert(insertRows).select();
        data = result.data;
        error = result.error;
      } else {
        // Single record — 1 time slot, or house sitting
        var result = await sb
          .from('booking_requests')
          .insert({
            service: service,
            preferred_date: date,
            preferred_end_date: isHouseSittingSvc ? endDate : null,
            preferred_time: time,
            preferred_end_time: isHouseSittingSvc ? (document.getElementById('brm-hs-departure') ? document.getElementById('brm-hs-departure').value : null) : null,
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

      // Send email notification to Rachel + client notification
      try {
        if (shouldSplit && dateCardDetails.length > 1) {
          // Split bookings — if multiple bookings created, send batch "received" notification
          // but individual booking emails to Rachel
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

          // Send ONE "received" notification to client for batch submission
          if (typeof toast === 'function') toast('✓ Sent ' + dateCardDetails.length + ' booking requests to Rachel!');
          var clientMsg = 'We received your ' + dateCardDetails.length + ' booking requests! Rachel will review them and get back to you shortly.';
          try {
            var sb = getSB();
            if (sb && clientId) {
              var owner = window.HHP_Auth && window.HHP_Auth.currentUser;
              await sb.from('messages').insert({
                sender_id: owner ? owner.id : null,
                sender_name: 'Rachel Housley',
                recipient_id: clientId,
                body: clientMsg,
                is_alert: false,
              });
            }
          } catch (msgErr) { console.warn('Client message failed:', msgErr); }
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
          if (typeof toast === 'function') toast('✓ Booking request sent!');
        }
      } catch (emailErr) {
        console.warn('Email notification failed:', emailErr);
        // Don't block the success - the request was saved
      }

      if (successEl) {
        successEl.textContent = 'Your request has been sent to Rachel! She will review it and get back to you to confirm. Check your email for updates.';
      }
      if (submitBtn) { submitBtn.textContent = 'Request Sent!'; }

      // Reset form after brief delay (just enough to read success message)
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
        // Reset HS calendar range
        window._hsRangeStart = null;
        window._hsRangeEnd = null;
        closeBookingModal();
        if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('btn-loading'); submitBtn.textContent = 'Send Request to Rachel'; }
        if (successEl) successEl.textContent = '';
      }, 1500);

    } catch (err) {
      console.error('Booking request error:', err);
      if (errEl) errEl.textContent = 'Something went wrong. Please try again or contact us if the issue persists.';
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
          service = 'Drop-In Visit';
        }
      }
      else if (text.indexOf('Stay') >= 0 || text.indexOf('125') >= 0) service = 'House Sitting';
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
          '  <div class="arc-detail"><strong>' + (isHS ? 'Dates:' : 'Preferred:') + '</strong> ' + dateStr + (isHS ? ' · Arrival ' + fmt12(r.preferred_time || '') + (r.preferred_end_time ? ' · Departure ' + fmt12(r.preferred_end_time) : '') : ' at ' + fmt12(r.preferred_time || '')) + '</div>',
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
          .select('id,service,preferred_date,preferred_time,preferred_end_date,preferred_end_time,contact_name,pet_names,status')
          .in('preferred_date', dates)
          .in('status', ['accepted', 'confirmed', 'in_progress'])
          .order('preferred_time', { ascending: true });

        var result = await query;
        var data = result.data || [];
        var error = result.error;
        if (error) throw error;

        // Also fetch house sitting bookings that OVERLAP with any of these dates
        // (their preferred_date may be before these dates but preferred_end_date extends into them)
        var minDate = dates[0];
        var maxDate = dates[dates.length - 1];
        var hsQuery = sb.from('booking_requests')
          .select('id,service,preferred_date,preferred_time,preferred_end_date,preferred_end_time,contact_name,pet_names,status')
          .not('preferred_end_date', 'is', null)
          .lte('preferred_date', maxDate)
          .gte('preferred_end_date', minDate)
          .in('status', ['accepted', 'confirmed', 'in_progress']);
        var hsResult = await hsQuery;
        var hsData = (hsResult.data || []).filter(function(b) {
          return (b.service || '').toLowerCase().indexOf('house sitting') !== -1;
        });
        // Merge house sitting bookings (avoid duplicates)
        var seenIds = {};
        data.forEach(function(b) { seenIds[b.id] = true; });
        hsData.forEach(function(b) {
          if (!seenIds[b.id]) { data.push(b); seenIds[b.id] = true; }
        });

        if (data.length === 0) {
          content.innerHTML = '<div class="sched-preview-clear">\u2705 No existing bookings \u2014 schedule is clear!</div>';
        } else {
          // Group by date — regular bookings go to their preferred_date,
          // house sitting bookings go to ALL dates they span
          var byDate = {};
          dates.forEach(function(d) { byDate[d] = { hs: [], regular: [] }; });
          data.forEach(function(b) {
            var bIsHS = (b.service || '').toLowerCase().indexOf('house sitting') !== -1;
            if (bIsHS && b.preferred_end_date) {
              // Add to every date in the range that overlaps with our preview dates
              var cur = new Date(b.preferred_date + 'T12:00:00');
              var end = new Date(b.preferred_end_date + 'T12:00:00');
              while (cur <= end) {
                var dStr = typeof _localDateStr === 'function' ? _localDateStr(cur) : cur.toISOString().split('T')[0];
                if (byDate[dStr]) {
                  // Check not already added (by id)
                  var already = byDate[dStr].hs.some(function(x) { return x.id === b.id; });
                  if (!already) byDate[dStr].hs.push(b);
                }
                cur.setDate(cur.getDate() + 1);
              }
            } else {
              if (byDate[b.preferred_date]) byDate[b.preferred_date].regular.push(b);
            }
          });

          var html = '';
          var totalCount = 0;
          dates.forEach(function(d) {
            var dayData = byDate[d] || { hs: [], regular: [] };
            if (dates.length > 1) {
              var dayLabel = new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              html += '<div class="sched-preview-day-label">' + dayLabel + '</div>';
            }
            // House sitting banner at TOP of each day
            dayData.hs.forEach(function(b) {
              totalCount++;
              var hsStartStr = new Date(b.preferred_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              var hsEndStr = b.preferred_end_date ? new Date(b.preferred_end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
              var isStartDay = d === b.preferred_date;
              var isEndDay = d === b.preferred_end_date;
              var dayTag = isStartDay ? ' (Arrival' + (b.preferred_time ? ' ' + (typeof fmt12 === 'function' ? fmt12(b.preferred_time) : b.preferred_time) : '') + ')' :
                           isEndDay ? ' (Departure' + (b.preferred_end_time ? ' ' + (typeof fmt12 === 'function' ? fmt12(b.preferred_end_time) : b.preferred_end_time) : '') + ')' : '';
              html += '<div style="background:linear-gradient(135deg,#e8f0fe,#f0e6ff);border:1.5px solid #b3c6e7;border-radius:8px;padding:6px 10px;margin-bottom:4px;font-size:0.82rem;display:flex;align-items:center;gap:6px">' +
                '<span style="font-size:1rem">\uD83C\uDFE0</span>' +
                '<span style="font-weight:600">' + (b.service || 'House Sitting') + '</span>' +
                '<span style="color:#666;font-size:0.78rem">' + (b.contact_name || '') + ' · ' + hsStartStr + ' → ' + hsEndStr + dayTag + '</span>' +
                '</div>';
            });
            // Regular bookings
            if (dayData.regular.length === 0 && dayData.hs.length === 0) {
              html += '<div style="font-size:0.8rem;color:#4caf50;padding:2px 0">\u2705 Clear</div>';
            } else {
              dayData.regular.forEach(function(b) {
                totalCount++;
                var timeStr = typeof fmt12 === 'function' ? fmt12(b.preferred_time || '') : (b.preferred_time || 'TBD');
                html += '<div class="sched-preview-item">' +
                  '<span class="sched-preview-time">' + timeStr + '</span>' +
                  '<span class="sched-preview-service">' + (b.service || 'Service') + '</span>' +
                  '<span class="sched-preview-client">' + (b.contact_name || '') + '</span>' +
                  '</div>';
              });
              if (dayData.regular.length === 0 && dayData.hs.length > 0) {
                html += '<div style="font-size:0.8rem;color:#4caf50;padding:2px 0">\u2705 No other bookings</div>';
              }
            }
          });

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

        // ── CHARGE CARD BEFORE updating status (prevents false "accepted" flash) ──
        var req = this.requests.find(function(r) { return r.id === requestId; });
        var paymentLink = '';
        var autoCharged = false;
        var cardDeclined = false;
        var declineMessage = '';

        if (newStatus === 'accepted' && req && req.service && req.estimated_total > 0 && req.client_id) {
          try {
            var _chgSess = sb ? await sb.auth.getSession() : null;
            var _chgToken = _chgSess && _chgSess.data && _chgSess.data.session ? _chgSess.data.session.access_token : '';
            var chargeResp = await fetch('/api/charge-saved-card', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _chgToken },
              body: JSON.stringify({
                bookingRequestId: requestId,
                amount: req.estimated_total,
                service: req.service,
                clientProfileId: req.client_id,
              }),
            });
            var chargeData = await chargeResp.json();

            if (chargeData.success) {
              autoCharged = true;
              if (typeof toast === 'function') toast('💳 Card charged $' + Number(req.estimated_total).toFixed(2) + ' automatically!');

            } else if (chargeData.error === 'no_card') {
              cardDeclined = true;
              declineMessage = 'No payment method on file. Please add a card to confirm your booking.';

            } else if (chargeData.error === 'card_declined') {
              cardDeclined = true;
              declineMessage = chargeData.message || 'Your card was declined. Please update your payment method.';

            } else {
              cardDeclined = true;
              declineMessage = 'Payment could not be processed. Please update your payment method.';
            }
          } catch (chargeErr) {
            console.warn('Auto-charge failed:', chargeErr);
            cardDeclined = true;
            declineMessage = 'Payment could not be processed. Please update your payment method.';
          }

          // If card was declined, set to payment_hold INSTEAD of accepted — never flash accepted
          if (cardDeclined) {
            await sb.from('booking_requests').update({
              status: 'payment_hold',
              charge_attempts: 1,
              last_charge_attempt: new Date().toISOString(),
              scheduled_date: update.scheduled_date || req.preferred_date,
              scheduled_time: update.scheduled_time || req.preferred_time,
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
        }

        // ── Payment succeeded (or no charge needed) — NOW update to accepted ──
        var { error } = await sb
          .from('booking_requests')
          .update(update)
          .eq('id', requestId);

        if (error) throw error;

        // Send notification to client about the status change
        if (req) {

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

    // Load pricing from Supabase early, before booking modal is used
    loadPricingFromDB().catch(function(err) {
      console.warn('Error loading pricing:', err);
    });

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

      // Save time slot details (per-slot recurring)
      var timeSlots = [];
      document.querySelectorAll('.brm-time-slot').forEach(function(slot) {
        var card = slot.closest('[data-date]');
        var timeSel = slot.querySelector('.brm-dc-time-sel');
        var recurCb = slot.querySelector('[id^="brm-ts-recur-"]');
        var tsId = recurCb ? recurCb.id.replace('brm-ts-recur-', '') : '';
        var freqEl = tsId ? document.getElementById('brm-ts-freq-' + tsId) : null;
        var endEl = tsId ? document.getElementById('brm-ts-recur-end-' + tsId) : null;
        var ongoingEl = tsId ? document.getElementById('brm-ts-ongoing-' + tsId) : null;
        timeSlots.push({
          date: card ? card.getAttribute('data-date') : '',
          time: timeSel ? timeSel.value : '',
          recurring: recurCb ? recurCb.checked : false,
          frequency: freqEl ? freqEl.value : 'weekly',
          endDate: endEl ? endEl.value : '',
          ongoing: ongoingEl ? ongoingEl.checked : false
        });
      });
      formData.dateCards = timeSlots;

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

          // After cards are added, restore time slot settings (per-slot recurring)
          setTimeout(function() {
            var allSlots = document.querySelectorAll('.brm-time-slot');
            formData.dateCards.forEach(function(dc, idx) {
              if (idx >= allSlots.length) return;
              var slot = allSlots[idx];
              var timeSel = slot.querySelector('.brm-dc-time-sel');
              if (timeSel && dc.time) timeSel.value = dc.time;
              var recurCb = slot.querySelector('[id^="brm-ts-recur-"]');
              if (recurCb && dc.recurring) {
                recurCb.checked = true;
                recurCb.dispatchEvent(new Event('change'));
                var tsId = recurCb.id.replace('brm-ts-recur-', '');
                setTimeout(function() {
                  var freqEl = document.getElementById('brm-ts-freq-' + tsId);
                  if (freqEl && dc.frequency) freqEl.value = dc.frequency;
                  var endEl = document.getElementById('brm-ts-recur-end-' + tsId);
                  if (endEl && dc.endDate) endEl.value = dc.endDate;
                  var ongoingEl = document.getElementById('brm-ts-ongoing-' + tsId);
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
      setTimeout(initBookingSystem, 50);
    });
  } else {
    setTimeout(initBookingSystem, 0);
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

    // Show skeleton instantly while data loads
    if (!_bookingPanelState.requests.length) {
      container.innerHTML = '<div class="hhp-skeleton hhp-skel-row" style="height:72px"></div><div class="hhp-skeleton hhp-skel-row" style="height:72px"></div><div class="hhp-skeleton hhp-skel-row" style="height:72px"></div>';
    }

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

  // ── Batch grouping helper: group pending bookings by client_id + created_at (2-second window) ──
  function _groupPendingBookingsByBatch(requests) {
    var pending = requests.filter(function(r) { return r.status === 'pending'; });
    var nonPending = requests.filter(function(r) { return r.status !== 'pending'; });

    if (pending.length === 0) return nonPending;

    var batchMap = {};
    var batchOrder = [];

    pending.forEach(function(r) {
      var createdAtTime = r.created_at ? new Date(r.created_at).getTime() : 0;
      var batchKey = r.client_id + '|' + Math.floor(createdAtTime / 2000); // 2-second window

      if (!batchMap[batchKey]) {
        batchMap[batchKey] = [];
        batchOrder.push(batchKey);
      }
      batchMap[batchKey].push(r);
    });

    // Sort batches by most recent created_at
    var sortedBatches = batchOrder.map(function(key) {
      var batch = batchMap[key];
      return {
        batchKey: key,
        bookings: batch,
        created_at: batch[0].created_at,
      };
    }).sort(function(a, b) {
      var timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      var timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });

    // Flatten back: each batch is represented, then non-pending
    var result = [];
    sortedBatches.forEach(function(b) {
      if (b.bookings.length === 1) {
        // Single booking — render as-is
        result.push(b.bookings[0]);
      } else {
        // Batched bookings — create a synthetic "batch" object
        var firstBooking = b.bookings[0];
        result.push({
          _isBatch: true,
          _batchKey: b.batchKey,
          _bookings: b.bookings,
          id: b.batchKey,
          client_id: firstBooking.client_id,
          contact_name: firstBooking.contact_name,
          contact_email: firstBooking.contact_email,
          contact_phone: firstBooking.contact_phone,
          avatar_url: firstBooking.avatar_url,
          created_at: firstBooking.created_at,
          status: 'pending',
          // Synthesized fields for batch display
          _batchSize: b.bookings.length,
          _totalEstimated: b.bookings.reduce(function(sum, bk) { return sum + (bk.estimated_total || 0); }, 0),
          _firstService: firstBooking.service,
        });
      }
    });

    return result.concat(nonPending);
  }

  function _renderBookingRequestsList(container, portal) {
    if (!container) return;

    if (_bookingPanelState.requests.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--mid);font-size:0.88rem">No ' + _bookingPanelState.currentFilter + ' requests</div>';
      return;
    }

    // Group pending bookings by batch
    var displayRequests = _groupPendingBookingsByBatch(_bookingPanelState.requests);

    container.innerHTML = displayRequests.map(function(r) {
      // ── Handle batch cards ──
      if (r._isBatch) {
        return _renderBatchCard(r);
      }
      // Individual booking rendering (non-batch)
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
        var hsReportBtn = '';
        if (isHS && r.preferred_end_date) {
          var today = _localDateStr();
          // Show report button if end date is today or in the past
          if (r.preferred_end_date <= today) {
            hsReportBtn = '<button class="btn btn-forest btn-sm" onclick="openHouseSittingReport(\'' + r.id + '\')">📋 Complete & Report</button>';
          } else if (r.preferred_date <= today) {
            hsReportBtn = '<button class="btn btn-gold btn-sm" onclick="openHouseSittingReport(\'' + r.id + '\')" title="Stay is still in progress — you can complete early if needed">📋 Early Report</button>';
          }
        }
        actionsHTML = '<div style="display:flex;gap:8px;margin-top:12px">' + hsReportBtn + '<button class="btn btn-outline btn-sm" style="color:#c00;border-color:#c00" onclick="cancelBooking(\'' + r.id + '\',\'' + (r.service || '').replace(/'/g, "\\'") + '\')">✕ Cancel</button></div>';
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
        '      <div style="font-size:0.82rem;color:var(--mid);margin-bottom:6px">\uD83D\uDCC5 ' + dateStr + (isHS ? ' · Arrival ' + fmt12(r.preferred_time || '') + (r.preferred_end_time ? ' · Departure ' + fmt12(r.preferred_end_time) : '') : ' at ' + fmt12(r.preferred_time || '')) + '</div>',
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

  // ── Batch card renderer ──
  function _renderBatchCard(batch) {
    var clientAvaHTML = '';
    if (batch.avatar_url) {
      clientAvaHTML = '<img src="' + batch.avatar_url + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);flex-shrink:0">';
    } else {
      var initials = (batch.contact_name || '?').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
      clientAvaHTML = '<div style="width:36px;height:36px;border-radius:50%;background:var(--gold-light,#f5e6c8);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:var(--ink,#1e1409);flex-shrink:0;border:2px solid var(--gold)">' + initials + '</div>';
    }

    var apptRowsHTML = batch._bookings.map(function(bk, idx) {
      var dateStr = bk.preferred_date ? new Date(bk.preferred_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
      var timeStr = bk.preferred_time ? fmt12(bk.preferred_time) : 'TBD';
      var petStr = bk.pet_names ? bk.pet_names : 'Pets';
      var isMarkedRemoved = document.querySelector('[data-batch-remove-id="' + bk.id + '"]');

      return '<div style="padding:8px 0;border-bottom:1px solid #e0d5c5;' + (isMarkedRemoved ? 'opacity:0.5;text-decoration:line-through' : '') + '" data-batch-appt-id="' + bk.id + '" data-batch-orig-time="' + (bk.preferred_time || '') + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<div style="font-size:0.82rem;font-weight:600;min-width:0" data-batch-time-display="' + bk.id + '">' + dateStr + ' @ ' + timeStr + '</div>' +
          '<span style="font-size:0.78rem;color:var(--gold-deep);font-weight:600;white-space:nowrap;margin-left:8px">$' + Number(bk.estimated_total || 0).toFixed(2) + '</span>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">' +
          '<div style="color:var(--mid);font-size:0.75rem">' + petStr + '</div>' +
          '<div style="display:flex;gap:6px">' +
            '<button class="btn btn-outline btn-sm" style="padding:3px 10px;font-size:0.72rem;color:var(--gold-deep);border-color:var(--gold-deep)" onclick="event.stopPropagation();toggleBatchTimeChange(\'' + bk.id + '\',\'' + batch._batchKey + '\')">↻ Time</button>' +
            '<button class="btn btn-outline btn-sm" style="padding:3px 10px;font-size:0.72rem;color:#c00;border-color:#c00" onclick="event.stopPropagation();toggleBatchRemoval(\'' + bk.id + '\',\'' + batch._batchKey + '\')">Remove</button>' +
          '</div>' +
        '</div>' +
        '<div id="batch-time-picker-' + bk.id + '" style="display:none;margin-top:6px"></div>' +
      '</div>';
    }).join('');

    var anyChanges = batch._bookings.some(function(bk) {
      return document.querySelector('[data-batch-remove-id="' + bk.id + '"]') ||
             document.querySelector('[data-batch-appt-id="' + bk.id + '"][data-batch-new-time]');
    });

    var actionButtonText = anyChanges ? 'Send to Client for Review' : '✓ Accept Batch';
    var actionButtonFn = anyChanges ? 'submitBatchModifications' : 'acceptBatchBookings';

    return '<div class="card" data-batch-id="' + batch._batchKey + '" style="border-left:6px solid var(--gold);position:relative;background:linear-gradient(135deg, rgba(245,230,200,0.15) 0%, rgba(255,255,255,0) 100%)">' +
      // Header: title + badge
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<strong style="font-size:0.95rem">📦 Batch — ' + batch._batchSize + ' Appt' + (batch._batchSize !== 1 ? 's' : '') + '</strong>' +
        '<span class="badge" style="background:var(--gold-light);color:var(--ink);padding:3px 8px;border-radius:12px;font-size:0.72rem;font-weight:600">pending</span>' +
      '</div>' +
      // Client info row
      '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">' +
        clientAvaHTML +
        '<div style="min-width:0">' +
          '<div style="font-weight:600;font-size:0.88rem">' + batch.contact_name + '</div>' +
          '<div style="font-size:0.75rem;color:var(--mid);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + batch._firstService + '</div>' +
        '</div>' +
      '</div>' +
      // Appointments list
      '<div style="background:#f0ebe3;border:1px solid #e0d5c5;border-radius:8px;padding:10px;font-size:0.82rem">' +
        apptRowsHTML +
        '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e0d5c5;display:flex;justify-content:space-between;align-items:center">' +
          '<strong style="font-size:0.82rem">Total</strong>' +
          '<strong style="color:var(--gold-deep);font-size:0.9rem">$' + Number(batch._totalEstimated).toFixed(2) + '</strong>' +
        '</div>' +
      '</div>' +
      // Action buttons — stacked on mobile
      '<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">' +
        '<button class="btn btn-forest btn-sm" onclick="' + actionButtonFn + '(\'' + batch._batchKey + '\')" style="width:100%;justify-content:center;padding:10px">' + actionButtonText + '</button>' +
        '<button class="btn btn-outline btn-sm" style="color:#c00;border-color:#c00;width:100%;justify-content:center;padding:8px" onclick="declineBatchBookings(\'' + batch._batchKey + '\')">✕ Decline All</button>' +
      '</div>' +
    '</div>';
  }

  // Check if a batch card has any modifications (removals or time changes)
  function _hasBatchModifications(batchCard) {
    if (!batchCard) return false;
    var apptRows = batchCard.querySelectorAll('[data-batch-appt-id]');
    return Array.from(apptRows).some(function(el) {
      return el.hasAttribute('data-batch-remove-id') || el.hasAttribute('data-batch-new-time');
    });
  }

  // Update the accept/modify button state on a batch card
  function _updateBatchActionButton(batchKey) {
    var batchCard = document.querySelector('[data-batch-id="' + batchKey + '"]');
    if (!batchCard) return;
    var hasChanges = _hasBatchModifications(batchCard);
    var actionBtn = batchCard.querySelector('.btn-forest');
    if (actionBtn) {
      actionBtn.textContent = hasChanges ? 'Send to Client for Review' : '✓ Accept Batch';
      actionBtn.onclick = new Function('event', 'event.stopPropagation();' + (hasChanges ? 'submitBatchModifications' : 'acceptBatchBookings') + '(\'' + batchKey + '\')');
    }
  }

  // Toggle removal marking on a single appointment in a batch
  window.toggleBatchRemoval = function(bookingId, batchKey) {
    var apptEl = document.querySelector('[data-batch-appt-id="' + bookingId + '"]');
    if (!apptEl) return;

    var isCurrentlyMarked = apptEl.hasAttribute('data-batch-remove-id');
    if (isCurrentlyMarked) {
      apptEl.removeAttribute('data-batch-remove-id');
      apptEl.style.opacity = '1';
      apptEl.style.textDecoration = 'none';
    } else {
      apptEl.setAttribute('data-batch-remove-id', bookingId);
      apptEl.style.opacity = '0.5';
      apptEl.style.textDecoration = 'line-through';
      // Also close any open time picker for this appointment
      var picker = document.getElementById('batch-time-picker-' + bookingId);
      if (picker) picker.style.display = 'none';
    }

    _updateBatchActionButton(batchKey);
  };

  // Toggle time change picker on a single appointment in a batch
  window.toggleBatchTimeChange = function(bookingId, batchKey) {
    var apptEl = document.querySelector('[data-batch-appt-id="' + bookingId + '"]');
    if (!apptEl) return;
    // Don't allow time change if marked for removal
    if (apptEl.hasAttribute('data-batch-remove-id')) return;

    var picker = document.getElementById('batch-time-picker-' + bookingId);
    if (!picker) return;

    if (picker.style.display !== 'none') {
      // Close picker
      picker.style.display = 'none';
      return;
    }

    // Build time options (5:00 AM to 10:00 PM, every 30 min)
    var origTime = apptEl.getAttribute('data-batch-orig-time') || '';
    var currentNew = apptEl.getAttribute('data-batch-new-time') || origTime;
    var opts = '';
    for (var h = 5; h <= 22; h++) {
      for (var m = 0; m < 60; m += 30) {
        var val = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        var sel = (val === currentNew) ? ' selected' : '';
        var hr12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        var ampm = h >= 12 ? 'PM' : 'AM';
        var label = hr12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
        opts += '<option value="' + val + '"' + sel + '>' + label + '</option>';
      }
    }

    picker.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:#fff;border:1px solid var(--gold);border-radius:8px;padding:8px">' +
      '<label style="font-size:0.72rem;color:var(--mid);width:100%">New time:</label>' +
      '<select id="batch-time-sel-' + bookingId + '" style="flex:1;min-width:0;padding:6px 8px;border:1px solid #e0d5c5;border-radius:6px;font-size:0.82rem;background:#fff">' + opts + '</select>' +
      '<button class="btn btn-forest btn-sm" style="padding:6px 14px;font-size:0.78rem" onclick="event.stopPropagation();applyBatchTimeChange(\'' + bookingId + '\',\'' + batchKey + '\')">Set</button>' +
      '<button class="btn btn-outline btn-sm" style="padding:6px 10px;font-size:0.78rem" onclick="event.stopPropagation();cancelBatchTimeChange(\'' + bookingId + '\',\'' + batchKey + '\')">✕</button>' +
    '</div>';
    picker.style.display = 'block';
  };

  // Apply the selected time change
  window.applyBatchTimeChange = function(bookingId, batchKey) {
    var sel = document.getElementById('batch-time-sel-' + bookingId);
    if (!sel) return;
    var newTime = sel.value;
    var apptEl = document.querySelector('[data-batch-appt-id="' + bookingId + '"]');
    if (!apptEl) return;
    var origTime = apptEl.getAttribute('data-batch-orig-time') || '';

    if (newTime === origTime) {
      // Same as original — remove the change
      apptEl.removeAttribute('data-batch-new-time');
      var display = document.querySelector('[data-batch-time-display="' + bookingId + '"]');
      if (display) {
        display.innerHTML = display.innerHTML.replace(/ → <strong style="color:var\(--forest\)">.*?<\/strong>/, '');
        display.style.color = '';
      }
    } else {
      apptEl.setAttribute('data-batch-new-time', newTime);
      var display = document.querySelector('[data-batch-time-display="' + bookingId + '"]');
      if (display) {
        // Show original with strikethrough + new time
        var origDisplay = display.textContent.split(' → ')[0]; // keep date + original time
        display.innerHTML = origDisplay + ' → <strong style="color:var(--forest)">' + fmt12(newTime) + '</strong>';
        display.style.color = 'var(--gold-deep)';
      }
    }

    // Close picker
    var picker = document.getElementById('batch-time-picker-' + bookingId);
    if (picker) picker.style.display = 'none';

    _updateBatchActionButton(batchKey);
  };

  // Cancel time change — revert to original
  window.cancelBatchTimeChange = function(bookingId, batchKey) {
    var apptEl = document.querySelector('[data-batch-appt-id="' + bookingId + '"]');
    if (!apptEl) return;

    // If there was a previous time change, remove it
    if (apptEl.hasAttribute('data-batch-new-time')) {
      apptEl.removeAttribute('data-batch-new-time');
      var origTime = apptEl.getAttribute('data-batch-orig-time') || '';
      var display = document.querySelector('[data-batch-time-display="' + bookingId + '"]');
      if (display) {
        display.innerHTML = display.textContent.split(' → ')[0];
        display.style.color = '';
      }
      _updateBatchActionButton(batchKey);
    }

    var picker = document.getElementById('batch-time-picker-' + bookingId);
    if (picker) picker.style.display = 'none';
  };

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

  // Batch notification: send ONE email + ONE in-app message for multiple bookings
  async function _sendBatchNotification(bookings, actions) {
    if (!bookings || bookings.length === 0) return;
    var firstBooking = bookings[0];
    if (!firstBooking.contact_email) return;

    var sb = getSB();
    var owner = window.HHP_Auth && window.HHP_Auth.currentUser;
    var ownerName = 'Rachel Housley';
    try { if (owner && owner.profile && owner.profile.full_name) ownerName = owner.profile.full_name; } catch(e){}

    // Build email body with appointment details
    var appointmentDetails = bookings.map(function(bk) {
      var action = actions.find(function(a) { return a.id === bk.id; });
      var dateStr = bk.preferred_date ? new Date(bk.preferred_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
      var timeStr = bk.preferred_time ? fmt12(bk.preferred_time) : 'TBD';

      if (action && action.action === 'removed') {
        return '• ' + dateStr + ' - REMOVED (not available)';
      } else if (action && action.action === 'modified') {
        var newDateStr = action.newDate ? new Date(action.newDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : dateStr;
        var newTimeStr = action.newTime ? fmt12(action.newTime) : timeStr;
        return '• ' + dateStr + ' @ ' + timeStr + ' → NEW TIME: ' + newDateStr + ' @ ' + newTimeStr;
      } else {
        return '• ' + dateStr + ' @ ' + timeStr + ' (confirmed)';
      }
    }).join('\n');

    var totalAmount = bookings.reduce(function(sum, bk) {
      var action = actions.find(function(a) { return a.id === bk.id; });
      return action && action.action === 'removed' ? sum : sum + (bk.estimated_total || 0);
    }, 0);

    var hasModifications = actions.some(function(a) { return a.action !== 'accepted'; });

    // 1. Send email
    try {
      await fetch('/api/booking-status-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: firstBooking.contact_email,
          name: firstBooking.contact_name || 'Client',
          service: 'Batch Booking (' + bookings.length + ' appointments)',
          status: hasModifications ? 'modified' : 'accepted',
          scheduledDate: firstBooking.preferred_date,
          scheduledTime: firstBooking.preferred_time,
          appointmentDetails: appointmentDetails,
          estimatedTotal: totalAmount,
          isBatch: true,
          hasModifications: hasModifications,
        }),
      });
    } catch (e) { console.warn('Batch email notification failed:', e); }

    // 2. Insert in-app message
    if (sb && firstBooking.client_id) {
      try {
        var msgTitle = hasModifications ? '📋 Your batch booking requires review' : '✓ Your batch booking is confirmed!';
        var msgBody = msgTitle + '\n\n' + appointmentDetails;
        if (totalAmount > 0) {
          msgBody += '\n\nTotal: $' + Number(totalAmount).toFixed(2);
        }

        await sb.from('messages').insert({
          sender_id: owner ? owner.id : null,
          sender_name: ownerName,
          recipient_id: firstBooking.client_id,
          body: msgBody,
          is_alert: true,
        });
      } catch (e) { console.warn('Batch in-app message failed:', e); }
    }
  }

  // Optimistic UI helper: fade card and show status instantly
  function _optimisticCard(requestId, newStatus) {
    var card = document.querySelector('[data-request-id="' + requestId + '"]');
    if (!card) return;
    card.classList.add('opt-pending');
    // Disable all action buttons in this card instantly
    card.querySelectorAll('button').forEach(function(b) { b.classList.add('btn-loading'); b.disabled = true; });
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

  // Batch accept: all bookings in batch are accepted as-is
  window.acceptBatchBookings = async function(batchKey) {
    var sb = getSB();
    if (!sb) return;

    try {
      // Find all bookings in this batch
      var batchBookings = _bookingPanelState.requests.filter(function(r) {
        return r.status === 'pending' &&
               r.client_id &&
               r.created_at &&
               (r.client_id + '|' + Math.floor(new Date(r.created_at).getTime() / 2000)) === batchKey;
      });

      if (batchBookings.length === 0) {
        if (typeof toast === 'function') toast('Batch not found');
        return;
      }

      // Mark card as processing
      var batchCard = document.querySelector('[data-batch-id="' + batchKey + '"]');
      if (batchCard) {
        batchCard.style.opacity = '0.7';
        batchCard.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
      }

      // Update all bookings to 'accepted'
      var updatePromises = batchBookings.map(function(bk) {
        return sb.from('booking_requests').update({
          status: 'accepted',
          scheduled_date: bk.preferred_date,
          scheduled_time: bk.preferred_time
        }).eq('id', bk.id);
      });

      await Promise.all(updatePromises);

      // Send ONE batch notification
      var actions = batchBookings.map(function(bk) {
        return { id: bk.id, action: 'accepted' };
      });

      await _sendBatchNotification(batchBookings, actions);

      // Charge ONE combined payment for the entire batch (await result, handle failure)
      var chargeableBatch = batchBookings.filter(function(bk) { return bk.estimated_total > 0 && bk.client_id; });
      var batchCharged = false;
      var batchChargeFailReason = '';
      if (chargeableBatch.length > 0) {
        try {
          var _chgSb = window.HHP_Auth && window.HHP_Auth.supabase;
          var _chgSess = _chgSb ? await _chgSb.auth.getSession() : null;
          var _chgToken = _chgSess && _chgSess.data && _chgSess.data.session ? _chgSess.data.session.access_token : '';
          var batchTotal = chargeableBatch.reduce(function(sum, bk) { return sum + (bk.estimated_total || 0); }, 0);
          var batchIds = chargeableBatch.map(function(bk) { return bk.id; });
          var serviceLabel = chargeableBatch.length > 1
            ? chargeableBatch[0].service + ' + ' + (chargeableBatch.length - 1) + ' more'
            : chargeableBatch[0].service;
          var chargeResp = await fetch('/api/charge-saved-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _chgToken },
            body: JSON.stringify({
              bookingRequestId: batchIds[0],
              amount: batchTotal,
              service: serviceLabel,
              clientProfileId: chargeableBatch[0].client_id,
              batchBookingIds: batchIds
            }),
          });
          var chargeData = await chargeResp.json();
          if (chargeData.success) {
            batchCharged = true;
            if (typeof toast === 'function') toast('💳 Batch charged $' + batchTotal.toFixed(2) + ' automatically!');
          } else {
            batchChargeFailReason = chargeData.message || chargeData.error || 'Payment failed';
          }
        } catch (e) {
          console.warn('Batch charge error:', e);
          batchChargeFailReason = e.message || 'Network error';
        }

        // If charge failed, set ALL batch bookings to payment_hold
        if (!batchCharged && chargeableBatch.length > 0) {
          var holdIds = chargeableBatch.map(function(bk) { return bk.id; });
          await sb.from('booking_requests').update({
            status: 'payment_hold',
            charge_attempts: 1,
            last_charge_attempt: new Date().toISOString(),
            admin_notes: '⚠️ Batch accepted but payment failed: ' + batchChargeFailReason
          }).in('id', holdIds);

          // Notify client about payment failure
          try {
            await fetch('/api/booking-status-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: chargeableBatch[0].contact_email,
                name: chargeableBatch[0].contact_name,
                service: chargeableBatch.length + ' appointments',
                status: 'payment_hold',
                scheduledDate: chargeableBatch[0].preferred_date,
                estimatedTotal: chargeableBatch.reduce(function(s, b) { return s + (b.estimated_total || 0); }, 0),
                autoCharged: false,
                declineMessage: batchChargeFailReason,
              }),
            });
          } catch (ne) { console.warn('Batch decline notification failed:', ne); }

          if (typeof toast === 'function') toast('⚠️ Payment failed for ' + holdIds.length + ' bookings — set to payment hold. Client notified.');
        }
      }

      if (batchCharged || chargeableBatch.length === 0) {
        if (typeof toast === 'function') toast('✓ Batch accepted! ' + batchBookings.length + ' booking' + (batchBookings.length !== 1 ? 's' : '') + ' confirmed' + (batchCharged ? ' & paid!' : '.'));
      }

      _afterBookingAction();
      setTimeout(function() { window.loadBookingRequestsPanel(_bookingPanelState.portal); }, 500);

    } catch (e) {
      console.error('Failed to accept batch:', e);
      if (typeof toast === 'function') toast('Error accepting batch');
      if (batchCard) {
        batchCard.style.opacity = '1';
        batchCard.querySelectorAll('button').forEach(function(b) { b.disabled = false; });
      }
    }
  };

  // Batch submit with modifications: mark as 'batch_review' for client to review
  window.submitBatchModifications = async function(batchKey) {
    var sb = getSB();
    if (!sb) return;

    try {
      // Find all bookings in this batch
      var batchBookings = _bookingPanelState.requests.filter(function(r) {
        return r.status === 'pending' &&
               r.client_id &&
               r.created_at &&
               (r.client_id + '|' + Math.floor(new Date(r.created_at).getTime() / 2000)) === batchKey;
      });

      if (batchBookings.length === 0) {
        if (typeof toast === 'function') toast('Batch not found');
        return;
      }

      // Get marked removals
      var removedIds = new Set();
      document.querySelectorAll('[data-batch-remove-id]').forEach(function(el) {
        removedIds.add(el.getAttribute('data-batch-remove-id'));
      });

      // Get time changes
      var timeChanges = {};
      document.querySelectorAll('[data-batch-new-time]').forEach(function(el) {
        var id = el.getAttribute('data-batch-appt-id');
        if (id) timeChanges[id] = el.getAttribute('data-batch-new-time');
      });

      // Mark card as processing
      var batchCard = document.querySelector('[data-batch-id="' + batchKey + '"]');
      if (batchCard) {
        batchCard.style.opacity = '0.7';
        batchCard.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
      }

      // Build actions array and update DB
      var actions = [];
      var updatePromises = batchBookings.map(function(bk) {
        if (removedIds.has(bk.id)) {
          actions.push({ id: bk.id, action: 'removed' });
          return sb.from('booking_requests').update({ status: 'batch_review' }).eq('id', bk.id);
        } else if (timeChanges[bk.id]) {
          actions.push({ id: bk.id, action: 'modified', newTime: timeChanges[bk.id], newDate: bk.preferred_date });
          return sb.from('booking_requests').update({
            status: 'batch_review',
            scheduled_date: bk.preferred_date,
            scheduled_time: timeChanges[bk.id]
          }).eq('id', bk.id);
        } else {
          actions.push({ id: bk.id, action: 'accepted' });
          return sb.from('booking_requests').update({
            status: 'batch_review',
            scheduled_date: bk.preferred_date,
            scheduled_time: bk.preferred_time
          }).eq('id', bk.id);
        }
      });

      await Promise.all(updatePromises);

      // Send ONE batch notification with the actions
      await _sendBatchNotification(batchBookings, actions);

      if (typeof toast === 'function') toast('✓ Batch submitted for client review');

      _afterBookingAction();
      setTimeout(function() { window.loadBookingRequestsPanel(_bookingPanelState.portal); }, 500);

    } catch (e) {
      console.error('Failed to submit batch modifications:', e);
      if (typeof toast === 'function') toast('Error submitting batch');
      if (batchCard) {
        batchCard.style.opacity = '1';
        batchCard.querySelectorAll('button').forEach(function(b) { b.disabled = false; });
      }
    }
  };

  // Batch decline: decline all bookings in batch
  window.declineBatchBookings = async function(batchKey) {
    var sb = getSB();
    if (!sb) return;
    if (!confirm('Are you sure you want to decline ALL bookings in this batch?')) return;

    try {
      var batchBookings = _bookingPanelState.requests.filter(function(r) {
        return r.status === 'pending' &&
               r.client_id &&
               r.created_at &&
               (r.client_id + '|' + Math.floor(new Date(r.created_at).getTime() / 2000)) === batchKey;
      });

      if (batchBookings.length === 0) {
        if (typeof toast === 'function') toast('Batch not found');
        return;
      }

      var batchCard = document.querySelector('[data-batch-id="' + batchKey + '"]');
      if (batchCard) {
        batchCard.style.opacity = '0.7';
        batchCard.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
      }

      var updatePromises = batchBookings.map(function(bk) {
        return sb.from('booking_requests').update({ status: 'declined' }).eq('id', bk.id);
      });

      await Promise.all(updatePromises);

      var actions = batchBookings.map(function(bk) {
        return { id: bk.id, action: 'removed' };
      });

      await _sendBatchNotification(batchBookings, actions);

      if (typeof toast === 'function') toast('Batch declined. Client notified.');
      _afterBookingAction();
      setTimeout(function() { window.loadBookingRequestsPanel(_bookingPanelState.portal); }, 500);

    } catch (e) {
      console.error('Failed to decline batch:', e);
      if (typeof toast === 'function') toast('Error declining batch');
      var batchCard = document.querySelector('[data-batch-id="' + batchKey + '"]');
      if (batchCard) {
        batchCard.style.opacity = '1';
        batchCard.querySelectorAll('button').forEach(function(b) { b.disabled = false; });
      }
    }
  };

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
            var _chgSb = window.HHP_Auth && window.HHP_Auth.supabase;
            var _chgSess2 = _chgSb ? await _chgSb.auth.getSession() : null;
            var _chgToken2 = _chgSess2 && _chgSess2.data && _chgSess2.data.session ? _chgSess2.data.session.access_token : '';
            var chargeResp = await fetch('/api/charge-saved-card', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _chgToken2 },
              body: JSON.stringify({ bookingRequestId: requestId, amount: req.estimated_total, service: req.service, clientProfileId: req.client_id }),
            });
            var chargeData = await chargeResp.json();
            if (chargeData.success) {
              if (typeof toast === 'function') toast('💳 Card charged $' + Number(req.estimated_total).toFixed(2) + '!');
            } else {
              await sb.from('booking_requests').update({
                status: 'payment_hold',
                charge_attempts: 1,
                last_charge_attempt: new Date().toISOString(),
                admin_notes: (req.admin_notes || '') + '\n⚠️ Accepted but payment failed: ' + (chargeData.message || chargeData.error || 'Card declined')
              }).eq('id', requestId);
              if (typeof toast === 'function') toast('⚠️ Card declined — booking on payment hold. Will retry automatically.');
            }
            // Refresh panel to show final payment status
            _afterBookingAction();
            window.loadBookingRequestsPanel(_bookingPanelState.portal);
          } catch (chargeErr) {
            console.warn('Auto-charge failed:', chargeErr);
            await sb.from('booking_requests').update({
              status: 'payment_hold',
              charge_attempts: 1,
              last_charge_attempt: new Date().toISOString(),
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
      '    <input type="date" id="tc-date-' + requestId + '" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;font-size:1rem;min-height:44px">',
      '  </div>',
      '  <div style="margin-bottom:10px">',
      '    <label style="display:block;font-size:0.82rem;font-weight:600;margin-bottom:4px">New Time</label>',
      '    <select id="tc-time-' + requestId + '" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:1rem;min-height:44px">',
      timeOpts,
      '    </select>',
      '  </div>',
      '  <div style="margin-bottom:10px">',
      '    <label style="display:block;font-size:0.82rem;font-weight:600;margin-bottom:4px">Message to Client</label>',
      '    <textarea id="tc-msg-' + requestId + '" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-family:inherit;font-size:1rem;min-height:60px;box-sizing:border-box" placeholder="e.g., That day works but I can only do mornings..."></textarea>',
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

  // ── House Sitting Report Modal ──
  window.openHouseSittingReport = async function(requestId) {
    var sb = getSB();
    if (!sb) return;

    try {
      var { data: booking, error } = await sb.from('booking_requests').select('*').eq('id', requestId).single();
      if (error || !booking) { if (typeof toast === 'function') toast('Could not load booking'); return; }

      var startDate = new Date(booking.preferred_date + 'T12:00:00');
      var endDate = new Date(booking.preferred_end_date + 'T12:00:00');
      var originalNights = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
      var perNight = originalNights > 0 ? (booking.estimated_total / originalNights) : booking.estimated_total;

      // Store state
      window._hsReport = {
        bookingId: requestId,
        booking: booking,
        originalNights: originalNights,
        currentNights: originalNights,
        perNight: perNight,
        originalTotal: parseFloat(booking.estimated_total),
      };

      var fmtDate = function(d) { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
      var fmt12 = function(t) { if (!t) return ''; var p = t.split(':'); var h = parseInt(p[0]); var m = p[1] || '00'; return (h > 12 ? h-12 : h||12) + ':' + m + (h >= 12 ? ' PM' : ' AM'); };

      var html = [
        '<div id="hs-report-backdrop" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px" onclick="if(event.target===this)closeHouseSittingReport()">',
        '<div style="background:#fdf8f0;border-radius:16px;max-width:440px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:inherit">',

        // Header
        '<div style="background:linear-gradient(135deg,#3d5a47,#4a7c59);padding:20px 24px;border-radius:16px 16px 0 0;color:white">',
        '<div style="display:flex;justify-content:space-between;align-items:center">',
        '<div style="font-size:1.15rem;font-weight:800">🏠 House Sitting Report</div>',
        '<button onclick="closeHouseSittingReport()" style="background:rgba(255,255,255,0.2);border:none;color:white;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>',
        '</div>',
        '<div style="font-size:0.82rem;opacity:0.9;margin-top:6px">' + (booking.contact_name || 'Client') + ' · ' + (booking.pet_names || 'Pets') + '</div>',
        '</div>',

        // Stay Summary
        '<div style="padding:20px 24px">',
        '<div style="background:linear-gradient(135deg,#e8f0fe,#f0e6ff);border-radius:12px;padding:14px;margin-bottom:16px">',
        '<div style="font-weight:700;font-size:0.88rem;color:#4a3d6b;margin-bottom:8px">Stay Summary</div>',
        '<div style="display:flex;justify-content:space-between;font-size:0.82rem;color:#5b4f7a;margin-bottom:4px"><span>📅 ' + fmtDate(booking.preferred_date) + ' → ' + fmtDate(booking.preferred_end_date) + '</span></div>',
        '<div style="display:flex;justify-content:space-between;font-size:0.82rem;color:#5b4f7a;margin-bottom:4px"><span>🕐 Arrival: ' + fmt12(booking.preferred_time) + '</span><span>🕐 Departure: ' + fmt12(booking.preferred_end_time) + '</span></div>',
        '<div style="display:flex;justify-content:space-between;font-size:0.82rem;color:#5b4f7a"><span>🌙 ' + originalNights + ' night' + (originalNights !== 1 ? 's' : '') + '</span><span>💰 $' + perNight.toFixed(2) + '/night</span></div>',
        '</div>',

        // Night Adjustment
        '<div style="background:var(--cream,#fff);border:1.5px solid #e0d5c5;border-radius:12px;padding:14px;margin-bottom:16px">',
        '<div style="font-weight:700;font-size:0.88rem;color:#6b5c4d;margin-bottom:10px">Adjust Nights</div>',
        '<div style="font-size:0.78rem;color:#999;margin-bottom:10px">Did the stay end early or extend? Adjust the nights below.</div>',
        '<div style="display:flex;align-items:center;justify-content:center;gap:16px">',
        '<button onclick="adjustHSNights(-1)" style="width:40px;height:40px;border-radius:50%;border:2px solid #c8963e;background:transparent;color:#c8963e;font-size:1.3rem;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center">−</button>',
        '<div style="text-align:center;min-width:80px"><div id="hs-report-nights" style="font-size:2rem;font-weight:800;color:#3d5a47">' + originalNights + '</div><div style="font-size:0.72rem;color:#999;text-transform:uppercase">nights</div></div>',
        '<button onclick="adjustHSNights(1)" style="width:40px;height:40px;border-radius:50%;border:2px solid #c8963e;background:transparent;color:#c8963e;font-size:1.3rem;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center">+</button>',
        '</div>',
        '<div id="hs-report-total" style="text-align:center;margin-top:10px;font-size:1.1rem;font-weight:700;color:#c8963e">$' + booking.estimated_total + '</div>',
        '<div id="hs-report-adjust-note" style="text-align:center;font-size:0.75rem;color:#999;margin-top:4px"></div>',
        '</div>',

        // Report Notes
        '<div style="margin-bottom:16px">',
        '<label style="font-weight:700;font-size:0.88rem;color:#6b5c4d;display:block;margin-bottom:6px">Notes for Client</label>',
        '<textarea id="hs-report-notes" placeholder="How did the stay go? How were the pets? Any notes for the client..." style="width:100%;min-height:100px;padding:12px;border:1.5px solid #e0d5c5;border-radius:10px;font-family:inherit;font-size:1rem;resize:vertical;box-sizing:border-box;background:var(--cream,#fff)"></textarea>',
        '</div>',

        // Pet Rating
        '<div style="margin-bottom:20px">',
        '<label style="font-weight:700;font-size:0.88rem;color:#6b5c4d;display:block;margin-bottom:6px">Pet Behavior Rating</label>',
        '<div id="hs-report-rating" style="display:flex;gap:6px">',
        '<button onclick="setHSRating(1)" class="hs-rate-btn" data-val="1" style="padding:8px 14px;border-radius:8px;border:1.5px solid #e0d5c5;background:var(--cream,white);cursor:pointer;font-size:0.85rem">😟 1</button>',
        '<button onclick="setHSRating(2)" class="hs-rate-btn" data-val="2" style="padding:8px 14px;border-radius:8px;border:1.5px solid #e0d5c5;background:var(--cream,white);cursor:pointer;font-size:0.85rem">😐 2</button>',
        '<button onclick="setHSRating(3)" class="hs-rate-btn" data-val="3" style="padding:8px 14px;border-radius:8px;border:1.5px solid #e0d5c5;background:var(--cream,white);cursor:pointer;font-size:0.85rem">🙂 3</button>',
        '<button onclick="setHSRating(4)" class="hs-rate-btn" data-val="4" style="padding:8px 14px;border-radius:8px;border:1.5px solid #e0d5c5;background:var(--cream,white);cursor:pointer;font-size:0.85rem">😊 4</button>',
        '<button onclick="setHSRating(5)" class="hs-rate-btn" data-val="5" style="padding:8px 14px;border-radius:8px;border:1.5px solid #e0d5c5;background:var(--cream,white);cursor:pointer;font-size:0.85rem">⭐ 5</button>',
        '</div>',
        '</div>',

        // Submit Button
        '<button id="hs-report-submit" onclick="submitHouseSittingReport()" style="width:100%;padding:16px;background:linear-gradient(135deg,#3d5a47,#4a7c59);color:white;border:none;border-radius:12px;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.3px">',
        '📋 Complete Stay & Charge $' + Number(booking.estimated_total).toFixed(2),
        '</button>',
        '<div style="text-align:center;font-size:0.72rem;color:#999;margin-top:8px;padding-bottom:4px">This will capture the payment hold and send the report to the client.</div>',

        '</div>', // end padding
        '</div>', // end modal
        '</div>', // end backdrop
      ].join('');

      // Remove existing if any
      var existing = document.getElementById('hs-report-backdrop');
      if (existing) existing.remove();

      document.body.insertAdjacentHTML('beforeend', html);
      document.body.style.overflow = 'hidden';
    } catch (e) {
      console.error('Error opening HS report:', e);
      if (typeof toast === 'function') toast('Error loading report');
    }
  };

  window.closeHouseSittingReport = function() {
    var el = document.getElementById('hs-report-backdrop');
    if (el) el.remove();
    document.body.style.overflow = '';
    window._hsReport = null;
    window._hsRating = null;
  };

  window.adjustHSNights = function(delta) {
    if (!window._hsReport) return;
    var newNights = window._hsReport.currentNights + delta;
    if (newNights < 1) return;
    window._hsReport.currentNights = newNights;

    var nightsEl = document.getElementById('hs-report-nights');
    var totalEl = document.getElementById('hs-report-total');
    var noteEl = document.getElementById('hs-report-adjust-note');
    var submitBtn = document.getElementById('hs-report-submit');

    var newTotal = (window._hsReport.perNight * newNights);
    if (nightsEl) nightsEl.textContent = newNights;
    if (totalEl) totalEl.textContent = '$' + newTotal.toFixed(2);

    var diff = newNights - window._hsReport.originalNights;
    if (noteEl) {
      if (diff > 0) noteEl.textContent = '+' + diff + ' night' + (diff !== 1 ? 's' : '') + ' added ($' + (diff * window._hsReport.perNight).toFixed(2) + ' extra)';
      else if (diff < 0) noteEl.textContent = Math.abs(diff) + ' night' + (Math.abs(diff) !== 1 ? 's' : '') + ' removed (−$' + (Math.abs(diff) * window._hsReport.perNight).toFixed(2) + ' refund)';
      else noteEl.textContent = '';
    }
    if (submitBtn) submitBtn.textContent = '📋 Complete Stay & Charge $' + newTotal.toFixed(2);
  };

  window._hsRating = null;
  window.setHSRating = function(val) {
    window._hsRating = val;
    var btns = document.querySelectorAll('.hs-rate-btn');
    btns.forEach(function(b) {
      var bv = parseInt(b.getAttribute('data-val'));
      b.style.background = bv === val ? '#c8963e' : 'white';
      b.style.color = bv === val ? 'white' : '#333';
      b.style.borderColor = bv === val ? '#c8963e' : '#e0d5c5';
    });
  };

  window.submitHouseSittingReport = async function() {
    if (!window._hsReport) return;
    var rpt = window._hsReport;
    var notes = document.getElementById('hs-report-notes');
    var submitBtn = document.getElementById('hs-report-submit');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Processing...';
      submitBtn.style.opacity = '0.7';
    }

    try {
      var _hsToken = window.HHP_Auth && window.HHP_Auth.supabase ? (await window.HHP_Auth.supabase.auth.getSession()).data.session?.access_token : '';
      var resp = await fetch('/api/complete-housesitting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (_hsToken || '') },
        body: JSON.stringify({
          bookingRequestId: rpt.bookingId,
          adjustedNights: rpt.currentNights !== rpt.originalNights ? rpt.currentNights : null,
          reportNotes: notes ? notes.value : '',
          reportRating: window._hsRating,
        }),
      });

      var data = await resp.json();

      if (data.success) {
        closeHouseSittingReport();
        if (typeof toast === 'function') toast('✅ House sitting completed! $' + data.finalAmount.toFixed(2) + ' charged. Report sent to client.');

        // Refresh all relevant views
        if (typeof window.loadBookingRequestsPanel === 'function') window.loadBookingRequestsPanel(_bookingPanelState.portal);
        if (typeof window.loadOwnerTodaySchedule === 'function') window.loadOwnerTodaySchedule();
        if (typeof window.loadMasterSchedule === 'function') window.loadMasterSchedule();
        if (typeof window.loadCalendarBookings === 'function') window.loadCalendarBookings();
      } else {
        if (typeof toast === 'function') toast('⚠️ Error: ' + (data.error || 'Could not complete'));
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '📋 Complete Stay & Charge $' + (rpt.perNight * rpt.currentNights).toFixed(2);
          submitBtn.style.opacity = '1';
        }
      }
    } catch (e) {
      console.error('HS report submit error:', e);
      if (typeof toast === 'function') toast('⚠️ Network error — please try again');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '📋 Complete Stay & Charge $' + (rpt.perNight * rpt.currentNights).toFixed(2);
        submitBtn.style.opacity = '1';
      }
    }
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
              // Recurring bookings: trigger first-week billing (Sunday cron handles ongoing)
              if (booking.recurrence_pattern) {
                var fwResp = await fetch('/api/recurring-invoices?firstWeek=true&bookingId=' + requestId, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ firstWeek: true, bookingId: requestId }),
                });
                var fwData = await fwResp.json();
                if (fwData.charged > 0) {
                  if (typeof toast === 'function') toast('\uD83D\uDCB3 Recurring: billed for this week!');
                } else if (fwData.errors && fwData.errors.length > 0) {
                  if (typeof toast === 'function') toast('\u26A0\uFE0F Recurring billing had errors — check logs');
                } else {
                  if (typeof toast === 'function') toast('\u2705 Recurring accepted — first billing starts next Sunday');
                }
              } else {
                // One-time bookings: charge immediately
                var _chgSb3 = window.HHP_Auth && window.HHP_Auth.supabase;
                var _chgSess3 = _chgSb3 ? await _chgSb3.auth.getSession() : null;
                var _chgToken3 = _chgSess3 && _chgSess3.data && _chgSess3.data.session ? _chgSess3.data.session.access_token : '';
                var chargeResp = await fetch('/api/charge-saved-card', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _chgToken3 },
                  body: JSON.stringify({ bookingRequestId: requestId, amount: booking.estimated_total, service: booking.service, clientProfileId: booking.client_id }),
                });
                var chargeData = await chargeResp.json();
                if (chargeData.success) {
                  if (typeof toast === 'function') toast('\uD83D\uDCB3 Card charged $' + Number(booking.estimated_total).toFixed(2) + '!');
                } else {
                  await sb.from('booking_requests').update({ status: 'payment_hold', admin_notes: '\u26A0\uFE0F Payment failed: ' + (chargeData.message || chargeData.error || 'Card declined') }).eq('id', requestId);
                  if (typeof toast === 'function') toast('\u26A0\uFE0F Card declined \u2014 booking on payment hold.');
                }
              }
            } catch (chargeErr) {
              console.warn('Auto-charge on accept failed:', chargeErr);
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
      '<input type="date" id="' + formId + '-date" style="padding:8px;border:1px solid #ddd;border-radius:6px;font-size:1rem;flex:1;min-width:0;min-height:44px">' +
      '<select id="' + formId + '-time" style="padding:8px;border:1px solid #ddd;border-radius:6px;font-size:1rem;flex:1;min-width:0;min-height:44px"></select>' +
      '</div>' +
      '<textarea id="' + formId + '-msg" placeholder="Message to client..." style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:1rem;font-family:inherit;min-height:48px;box-sizing:border-box;margin-bottom:6px"></textarea>' +
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

  // ════════════════════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════════════════════
  window.HHP_Booking = {
    refreshPricing: loadPricingFromDB,
    refreshHolidays: function() {
      var sb = getSB();
      if (sb) return loadHolidaysFromDB(sb);
      return Promise.resolve();
    }
  };

})();
