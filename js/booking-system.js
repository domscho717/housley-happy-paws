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

  // ââ SUPABASE CLIENT ââ
  var sbUrl = 'https://niysrippazlkpvdkzepp.supabase.co';
  var sbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5peXNyaXBwYXpsa3B2ZGt6ZXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTcxNDYsImV4cCI6MjA3OTA3MzE0Nn0.miAoNZQtOTTbnruWcj1WVn8ZGYtQZB5rh8FbBAS7VZU';

  function getSB() {
    if (window.HHP_Auth && window.HHP_Auth.supabase) return window.HHP_Auth.supabase;
    if (window._hhpSB) return window._hhpSB;
    if (window.supabase && window.supabase.createClient) {
      window._hhpSB = window.supabase.createClient(sbUrl, sbKey);
      return window._hhpSB;
    }
    return null;
  }

  // ── Stripe payment links by service ──
  var STRIPE_SERVICE_LINKS = {
    'Dog Walking - 30 min':    'https://buy.stripe.com/test_7sY5kDcu661Mgzx4Lx1kA00',
    'Dog Walking - 1 hour':    'https://buy.stripe.com/test_cNieVdbq2gGqbfdguf1kA01',
    'Drop-In Visit - 30 min':  'https://buy.stripe.com/test_5kQ8wP0Loai21ED3Ht1kA0a',
    'Drop-In Visit - 1 hour':  'https://buy.stripe.com/test_cNi7sLeCeai26YX5PB1kA0b',
    'Cat Care Visit - 30 min': 'https://buy.stripe.com/test_14AeVd0Loai2gzx5PB1kA0c',
    'Cat Care Visit - 1 hour': 'https://buy.stripe.com/test_eVqbJ1alY3TEbfdb9V1kA0d',
    'House Sitting':           'https://buy.stripe.com/test_aFa9AT65I9dYbfd5PB1kA06',
  };

  function getStripePaymentLink(serviceName) {
    if (!serviceName) return '';
    var svc = serviceName.toLowerCase();
    // Try exact match first
    for (var key in STRIPE_SERVICE_LINKS) {
      if (svc === key.toLowerCase()) return STRIPE_SERVICE_LINKS[key];
    }
    // Fuzzy match
    if (svc.indexOf('walk') !== -1 && (svc.indexOf('hour') !== -1 || svc.indexOf('60') !== -1)) return STRIPE_SERVICE_LINKS['Dog Walking - 1 hour'];
    if (svc.indexOf('walk') !== -1) return STRIPE_SERVICE_LINKS['Dog Walking - 30 min'];
    if (svc.indexOf('drop') !== -1 && (svc.indexOf('hour') !== -1 || svc.indexOf('60') !== -1 || svc.indexOf('40') !== -1)) return STRIPE_SERVICE_LINKS['Drop-In Visit - 1 hour'];
    if (svc.indexOf('drop') !== -1) return STRIPE_SERVICE_LINKS['Drop-In Visit - 30 min'];
    if (svc.indexOf('cat') !== -1 && (svc.indexOf('hour') !== -1 || svc.indexOf('60') !== -1 || svc.indexOf('40') !== -1)) return STRIPE_SERVICE_LINKS['Cat Care Visit - 1 hour'];
    if (svc.indexOf('cat') !== -1) return STRIPE_SERVICE_LINKS['Cat Care Visit - 30 min'];
    if (svc.indexOf('house') !== -1 || svc.indexOf('sit') !== -1) return STRIPE_SERVICE_LINKS['House Sitting'];
    return '';
  }

  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // 1. DESKTOP SCROLL FIX
  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  (function fixDesktopScroll() {
    var css = document.createElement('style');
    css.id = 'hhp-scroll-fix';
    css.textContent = [
      'html, body { overscroll-behavior: none !important; scroll-behavior: auto !important; }',
      'html { overflow-y: scroll !important; overflow-x: hidden !important; }',
      'body { overflow-y: auto !important; overflow-x: hidden !important; }',
      '#pg-public, #pg-client, #pg-staff, #pg-owner { overflow: visible !important; }',
      '* { scroll-snap-type: none !important; scroll-snap-align: unset !important; }',
      '.reviews-track { scroll-snap-type: x mandatory !important; scroll-behavior: smooth !important; }',
    ].join('\n');
    document.head.appendChild(css);

    // Prevent duplicate script loading by tracking loaded scripts
    var loadedScripts = {};
    var origCreateElement = document.createElement.bind(document);
    // We won't override createElement to avoid breaking things,
    // but we'll remove duplicate event listeners after load

    // After page loads, remove duplicate scroll listeners
    function cleanupScrollListeners() {
      // Clone and replace html/body to remove all event listeners from ux-patch duplicates
      // Instead, just ensure scroll works by removing any blocking styles
      document.documentElement.style.overscrollBehavior = 'none';
      document.documentElement.style.scrollBehavior = 'auto';
      document.body.style.overscrollBehavior = 'none';

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

  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // 2. MOBILE NAV REDESIGN
  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  (function fixMobileNav() {
    return; // Mobile nav fully handled by ux-patch.js v18
    var css = document.createElement('style');
    css.id = 'hhp-mobile-nav-fix';
    css.textContent = [
      // ââ Mobile portrait (up to 768px) ââ
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
      // ââ Mobile landscape (up to 900px AND short height) ââ
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
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

      setInterval(updateSignBtn, 2000);
      setTimeout(updateSignBtn, 1000);
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

  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // 3. BOOKING REQUEST MODAL & FORM
  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
      '  <button class="brm-close" onclick="closeBookingModal()" aria-label="Close">&times;</button>',
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
      '    <div class="brm-row">',
      '      <div class="brm-col">',
      '        <label class="brm-label" id="brm-date-label">Preferred Date *</label>',
      '        <input type="date" id="brm-date" class="brm-input" required>',
      '      </div>',
      '      <div class="brm-col" id="brm-enddate-col" style="display:none">',
      '        <label class="brm-label">End Date *</label>',
      '        <input type="date" id="brm-enddate" class="brm-input">',
      '      </div>',
      '      <div class="brm-col" id="brm-time-col">',
      '        <label class="brm-label">Preferred Time *</label>',
      '        <select id="brm-time" class="brm-input" required>',
      '          <option value="">Select time...</option>',
             (function() {
               var opts = '';
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
             })(),
      '        </select>',
      '        <div id="brm-endtime-display" style="display:none;font-size:0.82rem;color:var(--gold,#C8963E);margin-top:4px;font-weight:600"></div>',
      '      </div>',
      '    </div>',
      '',
      '    <!-- Multi-date: add more dates -->',
      '    <div id="brm-multidate-section" style="margin:6px 0 10px">',
      '      <div id="brm-extra-dates"></div>',
      '      <button type="button" id="brm-add-date-btn" onclick="window._brmAddDate()" style="background:none;border:1px dashed var(--gold,#C8963E);color:var(--gold,#C8963E);border-radius:8px;padding:7px 14px;font-size:0.82rem;cursor:pointer;font-family:inherit;margin-top:4px">+ Add Another Date</button>',
      '    </div>',
      '',
      '    <!-- Recurring schedule toggle -->',
      '    <div id="brm-recur-section" style="margin:4px 0 12px">',
      '      <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;cursor:pointer;font-weight:600;color:var(--ink,#2C2C2C)">',
      '        <input type="checkbox" id="brm-recur-toggle"> Set up a recurring schedule',
      '      </label>',
      '      <div id="brm-recur-options" style="display:none;margin-top:10px;background:#f9f6f0;border:1px solid #e0d5c5;border-radius:10px;padding:14px">',
      '        <label class="brm-label" style="margin-top:0">Repeat on</label>',
      '        <div id="brm-recur-days" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">',
      '          <label class="brm-day-chip"><input type="checkbox" value="mon" class="brm-recur-day"> Mon</label>',
      '          <label class="brm-day-chip"><input type="checkbox" value="tue" class="brm-recur-day"> Tue</label>',
      '          <label class="brm-day-chip"><input type="checkbox" value="wed" class="brm-recur-day"> Wed</label>',
      '          <label class="brm-day-chip"><input type="checkbox" value="thu" class="brm-recur-day"> Thu</label>',
      '          <label class="brm-day-chip"><input type="checkbox" value="fri" class="brm-recur-day"> Fri</label>',
      '          <label class="brm-day-chip"><input type="checkbox" value="sat" class="brm-recur-day"> Sat</label>',
      '          <label class="brm-day-chip"><input type="checkbox" value="sun" class="brm-recur-day"> Sun</label>',
      '        </div>',
      '        <div class="brm-row">',
      '          <div class="brm-col">',
      '            <label class="brm-label">Frequency</label>',
      '            <select id="brm-recur-freq" class="brm-input">',
      '              <option value="weekly">Every week</option>',
      '              <option value="biweekly">Every 2 weeks</option>',
      '              <option value="monthly">Every 4 weeks</option>',
      '            </select>',
      '          </div>',
      '          <div class="brm-col">',
      '            <label class="brm-label">Until</label>',
      '            <input type="date" id="brm-recur-end" class="brm-input">',
      '          </div>',
      '        </div>',
      '        <div id="brm-recur-preview" style="margin-top:10px;font-size:0.8rem;color:#6b5c4d;max-height:120px;overflow-y:auto"></div>',
      '      </div>',
      '    </div>',
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
      '    <label class="brm-label">Name(s) *</label>',
      '    <input type="text" id="brm-pets" class="brm-input" placeholder="e.g., Moose, Cookie" required>',
      '',
      '    <label class="brm-label">Pet(s) *</label>',
      '    <select id="brm-petcombo" class="brm-input" required>',
      '      <option value="">Choose...</option>',
      '      <option value="1dog">1 Dog</option>',
      '      <option value="1cat">1 Cat</option>',
      '      <option value="2dogs">2 Dogs</option>',
      '      <option value="2cats">2 Cats</option>',
      '      <option value="1dog1cat">1 Dog &amp; 1 Cat</option>',
      '      <option value="3plus">3 or More+</option>',
      '    </select>',
      '    <input type="hidden" id="brm-pettype" value="dog">',
      '    <input type="hidden" id="brm-numpets" value="1">',
      '',
      '    <div style="display:flex;align-items:center;gap:10px;margin:8px 0 12px">',
      '      <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer"><input type="checkbox" id="brm-puppy"> Puppy (under 1 year)</label>',
      '    </div>',
      '',
      '    <div id="brm-price-estimate" style="display:none;background:linear-gradient(135deg,#f9f6f0,#fff);border:1px solid #e0d5c5;border-radius:10px;padding:14px 16px;margin:10px 0 14px">',
      '      <div style="font-weight:700;font-size:0.88rem;margin-bottom:6px">Estimated Total</div>',
      '      <div id="brm-price-breakdown" style="font-size:0.82rem;color:#6b5c4d;line-height:1.6"></div>',
      '      <div style="font-weight:700;font-size:1.15rem;color:#1e1409;margin-top:6px">$<span id="brm-price-total">0</span></div>',
      '    </div>',
      '',
      '    <label class="brm-label">Home Address / Area *</label>',
      '    <input type="text" id="brm-address" class="brm-input" placeholder="Street address or neighborhood in Lancaster" required>',
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

    // Set min date to today
    var dateInput = document.getElementById('brm-date');
    if (dateInput) {
      var today = new Date().toISOString().split('T')[0];
      dateInput.setAttribute('min', today);
    }

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
    function updatePriceEstimate() {
      var svcName = resolveServiceName();
      var numPets = parseInt(document.getElementById('brm-numpets').value) || 1;
      var petType = document.getElementById('brm-pettype').value;
      var isPuppy = document.getElementById('brm-puppy').checked;
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

      // Count total dates (multi-date or recurring)
      var isHS = svcName.toLowerCase().indexOf('house sitting') !== -1;
      var totalDates = 1;
      var isRecurring = document.getElementById('brm-recur-toggle') && document.getElementById('brm-recur-toggle').checked;
      if (!isHS) {
        if (isRecurring && window._brmGetRecurDates) {
          var rd = window._brmGetRecurDates();
          if (rd.length > 0) totalDates = rd.length;
        } else if (window._brmExtraDates) {
          var extras = window._brmExtraDates.filter(function(d) { return !!d; });
          totalDates = 1 + extras.length;
        }
      }

      if (totalDates > 1 && !isHS) {
        var multiTotal = result.total * totalDates;
        if (breakdownEl) breakdownEl.innerHTML += '<br><span style="font-weight:600">' + totalDates + ' appointments x $' + result.total.toFixed(2) + '</span>';
        if (totalEl) totalEl.textContent = multiTotal.toFixed(2);
      } else {
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
          endInput.value = next.toISOString().split('T')[0];
        }
        // Set min of end date to day after start
        if (startDate) {
          var minEnd = new Date(startDate + 'T12:00:00');
          minEnd.setDate(minEnd.getDate() + 1);
          endInput.setAttribute('min', minEnd.toISOString().split('T')[0]);
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

      // Recurring schedule toggle
      var recurToggle = document.getElementById('brm-recur-toggle');
      var recurOpts = document.getElementById('brm-recur-options');
      if (recurToggle && recurOpts) {
        recurToggle.addEventListener('change', function() {
          recurOpts.style.display = recurToggle.checked ? '' : 'none';
          // Hide multi-date section when recurring is on (they're mutually exclusive for simplicity)
          var multiSec = document.getElementById('brm-multidate-section');
          var addBtn = document.getElementById('brm-add-date-btn');
          if (recurToggle.checked) {
            if (multiSec) multiSec.style.display = 'none';
            // Set default recurrence end to 4 weeks from today
            var recurEnd = document.getElementById('brm-recur-end');
            if (recurEnd && !recurEnd.value) {
              var future = new Date();
              future.setDate(future.getDate() + 28);
              recurEnd.value = future.toISOString().split('T')[0];
            }
          } else {
            if (multiSec) multiSec.style.display = '';
          }
          updateRecurPreview();
          updatePriceEstimate();
        });
      }

      // Recurrence day checkboxes + frequency + end date → preview
      var recurDays = document.querySelectorAll('.brm-recur-day');
      recurDays.forEach(function(cb) {
        cb.addEventListener('change', function() {
          // Toggle active class on chip label (fallback for :has() CSS)
          var chip = cb.closest('.brm-day-chip');
          if (chip) chip.classList.toggle('active', cb.checked);
          updateRecurPreview();
          updatePriceEstimate();
        });
      });
      var recurFreq = document.getElementById('brm-recur-freq');
      if (recurFreq) recurFreq.addEventListener('change', function() { updateRecurPreview(); updatePriceEstimate(); });
      var recurEndEl = document.getElementById('brm-recur-end');
      if (recurEndEl) recurEndEl.addEventListener('change', function() { updateRecurPreview(); updatePriceEstimate(); });

      // Hide multi-date + recurring for House Sitting (already has date range)
      var svcEl = document.getElementById('brm-service');
      if (svcEl) {
        svcEl.addEventListener('change', function() {
          var isHS = (svcEl.value || '').toLowerCase().indexOf('house sitting') !== -1;
          var multiSec = document.getElementById('brm-multidate-section');
          var recurSec = document.getElementById('brm-recur-section');
          if (multiSec) multiSec.style.display = isHS ? 'none' : '';
          if (recurSec) recurSec.style.display = isHS ? 'none' : '';
        });
      }
    }, 100);

    // ── Multi-date add/remove ──
    window._brmExtraDates = [];

    window._brmAddDate = function() {
      var container = document.getElementById('brm-extra-dates');
      if (!container) return;
      var idx = window._brmExtraDates.length;
      var id = 'brm-extra-date-' + idx;
      window._brmExtraDates.push('');

      // Create a row with date input
      var row = document.createElement('div');
      row.id = 'brm-extra-date-row-' + idx;
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px';
      row.innerHTML = '<input type="date" class="brm-input brm-extra-date-input" id="' + id + '" style="flex:1" min="' + (new Date().toISOString().split('T')[0]) + '"> <button type="button" onclick="window._brmRemoveDate(' + idx + ')" style="background:none;border:none;color:#c4756a;cursor:pointer;font-size:18px;padding:4px">&times;</button>';
      container.appendChild(row);

      // Listen for changes
      var inp = document.getElementById(id);
      if (inp) inp.addEventListener('change', function() {
        window._brmExtraDates[idx] = inp.value;
        updatePriceEstimate();
      });
    };

    window._brmRemoveDate = function(idx) {
      var row = document.getElementById('brm-extra-date-row-' + idx);
      if (row) row.remove();
      window._brmExtraDates[idx] = null; // mark removed (keep indices stable)
      updatePriceEstimate();
    };

    // ── Recurring preview generator ──
    function getRecurDates() {
      var toggle = document.getElementById('brm-recur-toggle');
      if (!toggle || !toggle.checked) return [];

      var selectedDays = [];
      document.querySelectorAll('.brm-recur-day:checked').forEach(function(cb) { selectedDays.push(cb.value); });
      if (selectedDays.length === 0) return [];

      var freq = (document.getElementById('brm-recur-freq') || {}).value || 'weekly';
      var endStr = (document.getElementById('brm-recur-end') || {}).value;
      var startStr = (document.getElementById('brm-date') || {}).value;
      if (!endStr || !startStr) return [];

      var dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
      var intervalDays = freq === 'weekly' ? 7 : freq === 'biweekly' ? 14 : 28;
      var start = new Date(startStr + 'T12:00:00');
      var end = new Date(endStr + 'T12:00:00');
      var dates = [];

      // Find all matching days starting from the start date's week
      var weekStart = new Date(start);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // go to Sunday of that week

      for (var w = new Date(weekStart); w <= end; w.setDate(w.getDate() + intervalDays)) {
        selectedDays.forEach(function(day) {
          var d = new Date(w);
          d.setDate(d.getDate() + dayMap[day]);
          if (d >= start && d <= end) {
            dates.push(d.toISOString().split('T')[0]);
          }
        });
      }

      // Deduplicate and sort
      dates = dates.filter(function(v, i, a) { return a.indexOf(v) === i; }).sort();
      return dates;
    }
    window._brmGetRecurDates = getRecurDates;

    function updateRecurPreview() {
      var preview = document.getElementById('brm-recur-preview');
      if (!preview) return;
      var dates = getRecurDates();
      if (dates.length === 0) {
        preview.innerHTML = '<em>Select days, a start date, and end date to preview.</em>';
        return;
      }
      var formatted = dates.map(function(d) {
        return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      });
      preview.innerHTML = '<strong>' + dates.length + ' appointment' + (dates.length > 1 ? 's' : '') + ':</strong><br>' +
        formatted.map(function(f) { return '<span class="brm-date-tag">' + f + '</span>'; }).join(' ');
    }

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
      '  box-shadow: 0 20px 60px rgba(0,0,0,0.2);',
      '}',
      '.brm-close {',
      '  position: absolute;',
      '  top: 12px; right: 16px;',
      '  background: none; border: none;',
      '  font-size: 28px; cursor: pointer;',
      '  color: #999; line-height: 1;',
      '}',
      '.brm-close:hover { color: #333; }',
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
      '}',
      '',
      // ââ Admin dashboard styles ââ
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
      window._brmExtraDates = [];
      var extraContainer = document.getElementById('brm-extra-dates');
      if (extraContainer) extraContainer.innerHTML = '';
      var recurToggle = document.getElementById('brm-recur-toggle');
      if (recurToggle) { recurToggle.checked = false; }
      var recurOpts = document.getElementById('brm-recur-options');
      if (recurOpts) recurOpts.style.display = 'none';

      // Pre-fill and show greeting if logged in
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
      }
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
    var date = document.getElementById('brm-date').value;
    var time = document.getElementById('brm-time').value;
    var name = document.getElementById('brm-name').value.trim();
    var email = document.getElementById('brm-email').value.trim();
    var phone = document.getElementById('brm-phone').value.trim();
    var pets = document.getElementById('brm-pets').value.trim();
    var petType = document.getElementById('brm-pettype').value;
    var numPets = parseInt(document.getElementById('brm-numpets').value) || 1;
    var isPuppy = document.getElementById('brm-puppy') ? document.getElementById('brm-puppy').checked : false;
    var address = document.getElementById('brm-address').value.trim();
    var notes = document.getElementById('brm-notes').value.trim();
    var endDateEl = document.getElementById('brm-enddate');
    var endDate = endDateEl ? endDateEl.value : '';

    // Collect multi-date and recurrence data
    var isRecurring = document.getElementById('brm-recur-toggle') && document.getElementById('brm-recur-toggle').checked;
    var allBookingDates = [date]; // always include the primary date

    if (isRecurring && window._brmGetRecurDates) {
      var recurDates = window._brmGetRecurDates();
      if (recurDates.length > 0) allBookingDates = recurDates;
    } else if (window._brmExtraDates) {
      // Add any manually-added extra dates
      window._brmExtraDates.forEach(function(d) { if (d) allBookingDates.push(d); });
    }
    // Deduplicate and sort
    allBookingDates = allBookingDates.filter(function(v, i, a) { return v && a.indexOf(v) === i; }).sort();

    // Build recurrence pattern if recurring
    var recurrencePattern = null;
    if (isRecurring) {
      var selectedDays = [];
      document.querySelectorAll('.brm-recur-day:checked').forEach(function(cb) { selectedDays.push(cb.value); });
      recurrencePattern = {
        days: selectedDays,
        frequency: (document.getElementById('brm-recur-freq') || {}).value || 'weekly',
        end_date: (document.getElementById('brm-recur-end') || {}).value || '',
        time: time
      };
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

    // For multi-date, multiply the per-session price by number of dates
    var totalDates = allBookingDates.length;
    var multiDateTotal = priceResult.total * totalDates;
    var multiDateBreakdown = priceResult.breakdown;
    if (totalDates > 1 && !isHouseSitting) {
      multiDateBreakdown += ' | x' + totalDates + ' appointments = $' + multiDateTotal.toFixed(2);
    }

    if (!service || !date || !time || !name || !email || !pets || !address || !petCombo) {
      if (errEl) errEl.textContent = 'Please fill in all required fields.';
      return;
    }
    // House Sitting requires end date
    if (isHouseSitting && !endDate) {
      if (errEl) errEl.textContent = 'Please select an end date for House Sitting.';
      return;
    }
    // Recurring requires at least one day selected
    if (isRecurring) {
      var selDays = document.querySelectorAll('.brm-recur-day:checked');
      if (selDays.length === 0) {
        if (errEl) errEl.textContent = 'Please select at least one day for your recurring schedule.';
        return;
      }
      if (!document.getElementById('brm-recur-end').value) {
        if (errEl) errEl.textContent = 'Please select an end date for your recurring schedule.';
        return;
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

      var { data, error } = await sb
        .from('booking_requests')
        .insert({
          service: service,
          preferred_date: date,
          preferred_end_date: isHouseSitting ? endDate : null,
          preferred_time: time,
          contact_name: name,
          contact_email: email,
          contact_phone: phone || null,
          pet_names: pets,
          pet_types: petType,
          number_of_pets: numPets,
          is_puppy: isPuppy,
          is_holiday: holidayFlag,
          estimated_total: isHouseSitting ? priceResult.total : multiDateTotal,
          price_breakdown: multiDateBreakdown,
          special_notes: notes || null,
          address: address,
          house_area: address,
          client_id: clientId,
          status: 'pending',
          booking_dates: totalDates > 1 ? allBookingDates : null,
          recurrence_pattern: recurrencePattern,
        })
        .select();

      if (error) throw error;

      // Send email notification to Rachel
      try {
        var dateDisplay = isHouseSitting ? date + ' to ' + endDate : date;
        if (totalDates > 1 && !isHouseSitting) {
          dateDisplay = allBookingDates.join(', ') + ' (' + totalDates + ' dates)';
        }
        if (isRecurring && recurrencePattern) {
          dateDisplay += ' [Recurring: ' + recurrencePattern.days.join(', ') + ' ' + recurrencePattern.frequency + ' until ' + recurrencePattern.end_date + ']';
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
        });
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
        // Clear extra dates
        window._brmExtraDates = [];
        var extraContainer = document.getElementById('brm-extra-dates');
        if (extraContainer) extraContainer.innerHTML = '';
        // Hide recurring options
        var recurOpts = document.getElementById('brm-recur-options');
        if (recurOpts) recurOpts.style.display = 'none';
        var recurPreview = document.getElementById('brm-recur-preview');
        if (recurPreview) recurPreview.innerHTML = '';
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

  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // 4. REWIRE BOOK BUTTONS â BOOKING REQUEST MODAL
  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // 5. ADMIN DASHBOARD (for owner portal)
  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
      // Check if owner portal exists, inject dashboard there
      var ownerPage = document.getElementById('pg-owner');
      if (!ownerPage) return;

      // Find or create dashboard container
      var dashboard = document.getElementById('hhpAdminDashboard');
      if (!dashboard) {
        dashboard = document.createElement('div');
        dashboard.id = 'hhpAdminDashboard';

        // Insert at top of owner portal
        var firstChild = ownerPage.querySelector('.owner-content, .portal-content, section');
        if (firstChild) {
          firstChild.parentNode.insertBefore(dashboard, firstChild);
        } else {
          ownerPage.appendChild(dashboard);
        }
      }

      dashboard.innerHTML = [
        '<h2 style="font-family:Playfair Display,Georgia,serif; margin-bottom:16px;">Booking Requests</h2>',
        '<div class="admin-filter-bar" id="adminFilterBar">',
        '  <button class="admin-filter-btn active" data-filter="pending" onclick="HHP_BookingAdmin.filter(\'pending\',this)">Pending</button>',
        '  <button class="admin-filter-btn" data-filter="accepted" onclick="HHP_BookingAdmin.filter(\'accepted\',this)">Accepted</button>',
        '  <button class="admin-filter-btn" data-filter="modified" onclick="HHP_BookingAdmin.filter(\'modified\',this)">Modified</button>',
        '  <button class="admin-filter-btn" data-filter="declined" onclick="HHP_BookingAdmin.filter(\'declined\',this)">Declined</button>',
        '  <button class="admin-filter-btn" data-filter="all" onclick="HHP_BookingAdmin.filter(\'all\',this)">All</button>',
        '</div>',
        '<div id="adminRequestsList"></div>',
      ].join('');

      await this.loadRequests();
    },

    async loadRequests() {
      var sb = getSB();
      if (!sb) return;

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
        if (r.booking_dates && Array.isArray(r.booking_dates) && r.booking_dates.length > 1) {
          var formattedDates = r.booking_dates.map(function(d) {
            return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          });
          multiDateHTML = '<div class="arc-detail"><strong>' + r.booking_dates.length + ' Appointments:</strong><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">' +
            formattedDates.map(function(f) { return '<span style="background:#f0ebe3;border:1px solid #e0d5c5;border-radius:12px;padding:2px 8px;font-size:0.78rem">' + f + '</span>'; }).join('') + '</div></div>';
        }
        var recurHTML = '';
        if (r.recurrence_pattern) {
          var rp = typeof r.recurrence_pattern === 'string' ? JSON.parse(r.recurrence_pattern) : r.recurrence_pattern;
          var dayNames = (rp.days || []).map(function(d) { return d.charAt(0).toUpperCase() + d.slice(1); });
          var freqLabel = rp.frequency === 'weekly' ? 'Every week' : rp.frequency === 'biweekly' ? 'Every 2 weeks' : 'Every 4 weeks';
          recurHTML = '<div class="arc-detail" style="background:#eef6ff;border:1px solid #b8d4f0;border-radius:6px;padding:8px 10px;margin:4px 0"><strong>🔄 Recurring:</strong> ' + dayNames.join(', ') + ' · ' + freqLabel + (rp.end_date ? ' · Until ' + new Date(rp.end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '') + '</div>';
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
        }

        // Build avatar for the client on this request
        var clientAvaHTML = '';
        if (r.avatar_url) {
          clientAvaHTML = '<img src="' + r.avatar_url + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #e0d5c5;flex-shrink:0">';
        } else {
          var initials = (r.contact_name || '?').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
          clientAvaHTML = '<div style="width:36px;height:36px;border-radius:50%;background:var(--gold-light,#f5e6c8);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:var(--ink,#1e1409);flex-shrink:0;border:2px solid #e0d5c5">' + initials + '</div>';
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
          // If accepting, try to auto-charge saved card first
          var paymentLink = '';
          var autoCharged = false;
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
              if (chargeData.success) {
                autoCharged = true;
                if (typeof toast === 'function') toast('💳 Card charged $' + Number(req.estimated_total).toFixed(2) + ' automatically!');
              } else if (chargeData.error === 'no_card') {
                // No saved card — fall back to payment link
                paymentLink = getStripePaymentLink(req.service);
              } else if (chargeData.error === 'authentication_required') {
                paymentLink = getStripePaymentLink(req.service);
                if (typeof toast === 'function') toast('Card requires authentication — payment link sent instead.');
              }
            } catch (chargeErr) {
              console.warn('Auto-charge failed, falling back to payment link:', chargeErr);
              paymentLink = getStripePaymentLink(req.service);
            }
          } else if (newStatus === 'accepted' && req.service) {
            paymentLink = getStripePaymentLink(req.service);
          }

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
                paymentLink: autoCharged ? '' : paymentLink,
                estimatedTotal: req.estimated_total || null,
                priceBreakdown: req.price_breakdown || '',
                autoCharged: autoCharged,
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

  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // 6. CALENDAR INTEGRATION - Show accepted bookings on calendar
  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  async function loadAcceptedBookingsToCalendar() {
    var sb = getSB();
    if (!sb) return;

    try {
      // Get current month's accepted bookings
      var now = new Date();
      var firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

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

  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // INITIALIZATION
  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function initBookingSystem() {
    injectBookingCSS();
    createBookingModal();

    // Wait for page to fully render then rewire buttons
    setTimeout(rewireBookButtons, 2000);
    setTimeout(rewireBookButtons, 5000);
    setTimeout(rewireBookButtons, 8000);

    // Load calendar bookings
    setTimeout(loadAcceptedBookingsToCalendar, 3000);

    // Init admin dashboard if owner is logged in
    setTimeout(function() {
      if (window.HHP_Auth && window.HHP_Auth.currentRole === 'owner') {
        HHP_BookingAdmin.init();
      }
      // Also watch for auth state changes
      if (window.HHP_Auth && window.HHP_Auth.supabase) {
        window.HHP_Auth.supabase.auth.onAuthStateChange(function(event) {
          if (event === 'SIGNED_IN') {
            setTimeout(function() {
              if (window.HHP_Auth.currentRole === 'owner') {
                HHP_BookingAdmin.init();
              }
            }, 1000);
          }
        });
      }
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initBookingSystem, 1000);
    });
  } else {
    setTimeout(initBookingSystem, 500);
  }

})();

