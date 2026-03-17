/* ============================================================
   Housley Happy Paws â Booking Request System + UI Fixes
   v1.0 â March 2026

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
    'Drop-In Visit - 30 min':  'https://buy.stripe.com/test_cNi28rdya75Q3MLdi31kA02',
    'Drop-In Visit - 1 hour':  'https://buy.stripe.com/test_fZu6oHdya9dYdnlem71kA03',
    'Cat Care Visit - 30 min': 'https://buy.stripe.com/test_3cI6oH51Ebm6831guf1kA04',
    'Cat Care Visit - 1 hour': 'https://buy.stripe.com/test_aFaaEX8dQ75Q8315PB1kA05',
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
      'html, body { overscroll-behavior: auto !important; scroll-behavior: auto !important; }',
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
      document.documentElement.style.overscrollBehavior = 'auto';
      document.documentElement.style.scrollBehavior = 'auto';
      document.body.style.overscrollBehavior = 'auto';

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
    { name: 'Dog Walking - 30 min', price: '$25', base: 25, type: 'dog', extraPet: 15, puppy: 5, holiday: 10 },
    { name: 'Dog Walking - 1 hour', price: '$45', base: 45, type: 'dog', extraPet: 15, puppy: 5, holiday: 10 },
    { name: 'Drop-In Visit - 30 min', price: '$25', base: 25, type: 'dog', extraPet: 15, puppy: 5, holiday: 10 },
    { name: 'Drop-In Visit - 1 hour', price: '$45', base: 45, type: 'dog', extraPet: 15, puppy: 5, holiday: 10 },
    { name: 'Cat Care Visit - 30 min', price: '$20', base: 20, type: 'cat', extraPet: 10, puppy: 0, holiday: 10 },
    { name: 'Cat Care Visit - 1 hour', price: '$35', base: 35, type: 'cat', extraPet: 10, puppy: 0, holiday: 10 },
    { name: 'House Sitting', price: '$125/night', base: 125, type: 'both', extraPet: 15, extraCat: 10, puppy: 5, holiday: 10 },
    { name: 'Meet & Greet', price: 'Free', base: 0, type: 'any', extraPet: 0, puppy: 0, holiday: 0 },
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

  function calculatePrice(serviceName, numPets, isPuppy, isHolidayDate) {
    var svc = null;
    for (var i = 0; i < SERVICES.length; i++) {
      if (SERVICES[i].name === serviceName) { svc = SERVICES[i]; break; }
    }
    if (!svc || svc.base === 0) return { total: 0, breakdown: 'Free', base: 0 };

    var total = svc.base;
    var parts = [svc.name + ': $' + svc.base];

    // Additional pets
    if (numPets > 1) {
      var extraCount = numPets - 1;
      var extraRate = svc.extraPet || 0;
      var extraCost = extraCount * extraRate;
      total += extraCost;
      if (extraCost > 0) parts.push(extraCount + ' extra pet(s): +$' + extraCost);
    }

    // Puppy surcharge (per puppy/dog pet)
    if (isPuppy && svc.puppy > 0) {
      total += svc.puppy;
      parts.push('Puppy surcharge: +$' + svc.puppy);
    }

    // Holiday surcharge
    if (isHolidayDate && svc.holiday > 0) {
      total += svc.holiday;
      parts.push('Holiday rate: +$' + svc.holiday);
    }

    return { total: total, breakdown: parts.join(' | '), base: svc.base };
  }

  function createBookingModal() {
    if (document.getElementById('bookingRequestModal')) return;

    var modal = document.createElement('div');
    modal.id = 'bookingRequestModal';
    modal.innerHTML = [
      '<div class="brm-backdrop" onclick="closeBookingModal()"></div>',
      '<div class="brm-content">',
      '  <button class="brm-close" onclick="closeBookingModal()" aria-label="Close">&times;</button>',
      '  <h2 class="brm-title">Request a Booking</h2>',
      '  <p class="brm-subtitle">Fill out the details below and Rachel will get back to you to confirm your booking!</p>',
      '  <form id="bookingRequestForm" onsubmit="submitBookingRequest(event)">',
      '',
      '    <label class="brm-label">Service *</label>',
      '    <select id="brm-service" class="brm-input" required>',
      '      <option value="">Choose a service...</option>',
             SERVICES.map(function(s) { return '<option value="' + s.name + '">' + s.name + ' â ' + s.price + '</option>'; }).join(''),
      '    </select>',
      '',
      '    <div class="brm-row">',
      '      <div class="brm-col">',
      '        <label class="brm-label">Preferred Date *</label>',
      '        <input type="date" id="brm-date" class="brm-input" required>',
      '      </div>',
      '      <div class="brm-col">',
      '        <label class="brm-label">Preferred Time *</label>',
      '        <select id="brm-time" class="brm-input" required>',
      '          <option value="">Select time...</option>',
      '          <option value="Early Morning (6-8am)">Early Morning (6-8am)</option>',
      '          <option value="Morning (8-10am)">Morning (8-10am)</option>',
      '          <option value="Late Morning (10am-12pm)">Late Morning (10am-12pm)</option>',
      '          <option value="Afternoon (12-3pm)">Afternoon (12-3pm)</option>',
      '          <option value="Late Afternoon (3-5pm)">Late Afternoon (3-5pm)</option>',
      '          <option value="Evening (5-7pm)">Evening (5-7pm)</option>',
      '        </select>',
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
      '    <label class="brm-label">Pet Name(s) *</label>',
      '    <input type="text" id="brm-pets" class="brm-input" placeholder="e.g., Moose, Cookie" required>',
      '',
      '    <div class="brm-row">',
      '      <div class="brm-col">',
      '        <label class="brm-label">Pet Type(s)</label>',
      '        <select id="brm-pettype" class="brm-input">',
      '          <option value="dog">Dog(s)</option>',
      '          <option value="cat">Cat(s)</option>',
      '          <option value="both">Dogs & Cats</option>',
      '          <option value="other">Other</option>',
      '        </select>',
      '      </div>',
      '      <div class="brm-col">',
      '        <label class="brm-label">Number of Pets</label>',
      '        <input type="number" id="brm-numpets" class="brm-input" value="1" min="1" max="10">',
      '      </div>',
      '    </div>',
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

    // Live price estimator
    function updatePriceEstimate() {
      var svcName = document.getElementById('brm-service').value;
      var numPets = parseInt(document.getElementById('brm-numpets').value) || 1;
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

      var result = calculatePrice(svcName, numPets, isPuppy, holidayFlag);
      if (estimateEl) estimateEl.style.display = 'block';
      if (breakdownEl) breakdownEl.innerHTML = result.breakdown.split(' | ').join('<br>');
      if (totalEl) totalEl.textContent = result.total.toFixed(2);

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

    // Attach listeners for live update
    setTimeout(function() {
      ['brm-service', 'brm-numpets', 'brm-date'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', updatePriceEstimate);
      });
      var puppyEl = document.getElementById('brm-puppy');
      if (puppyEl) puppyEl.addEventListener('change', updatePriceEstimate);
      var numEl = document.getElementById('brm-numpets');
      if (numEl) numEl.addEventListener('input', updatePriceEstimate);
    }, 100);
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

      if (preselectedService) {
        var sel = document.getElementById('brm-service');
        if (sel) {
          for (var i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value.indexOf(preselectedService) >= 0) {
              sel.selectedIndex = i;
              break;
            }
          }
        }
      }

      // Pre-fill if logged in
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

    var service = document.getElementById('brm-service').value;
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

    // Calculate price
    var holidayFlag = isHoliday(date);
    var priceResult = calculatePrice(service, numPets, isPuppy, holidayFlag);

    if (!service || !date || !time || !name || !email || !pets || !address) {
      if (errEl) errEl.textContent = 'Please fill in all required fields.';
      return;
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
          preferred_time: time,
          contact_name: name,
          contact_email: email,
          contact_phone: phone || null,
          pet_names: pets,
          pet_types: petType,
          number_of_pets: numPets,
          is_puppy: isPuppy,
          is_holiday: holidayFlag,
          estimated_total: priceResult.total,
          price_breakdown: priceResult.breakdown,
          special_notes: notes || null,
          address: address,
          house_area: address,
          client_id: clientId,
          status: 'pending',
        })
        .select();

      if (error) throw error;

      // Send email notification to Rachel
      try {
        await sendBookingNotification({
          service: service,
          date: date,
          time: time,
          name: name,
          email: email,
          phone: phone,
          pets: pets,
          address: address,
          notes: notes,
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

    // Also rewire the hero CTA buttons
    var heroCTAs = document.querySelectorAll('.hero-section a, .hero-section button');
    heroCTAs.forEach(function(btn) {
      var text = btn.textContent || '';
      if (text.indexOf('Meet & Greet') >= 0 || text.indexOf('Schedule') >= 0) {
        btn.onclick = function(e) {
          e.preventDefault();
          openBookingModal('Meet & Greet');
        };
      }
    });

    // Rewire any Meet & Greet specific buttons
    document.querySelectorAll('button, a').forEach(function(btn) {
      var text = btn.textContent || '';
      if (text.indexOf('Meet & Greet') >= 0 && (text.indexOf('Book') >= 0 || text.indexOf('Schedule') >= 0)) {
        btn.onclick = function(e) {
          e.preventDefault();
          openBookingModal('Meet & Greet');
        };
      }
    });
  }

  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // 5. ADMIN DASHBOARD (for owner portal)
  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

        return [
          '<div class="admin-request-card" id="arc-' + r.id + '">',
          '  <div class="arc-header">',
          '    <span class="arc-service">' + (r.service || 'Unknown Service') + '</span>',
          '    <span class="arc-status ' + r.status + '">' + r.status + '</span>',
          '  </div>',
          '  <div class="arc-detail"><strong>Client:</strong> ' + (r.contact_name || '') + ' &mdash; ' + (r.contact_email || '') + (r.contact_phone ? ' &mdash; ' + r.contact_phone : '') + '</div>',
          '  <div class="arc-detail"><strong>Preferred:</strong> ' + dateStr + ' at ' + (r.preferred_time || '') + '</div>',
          '  <div class="arc-detail"><strong>Pets:</strong> ' + (r.pet_names || '') + ' (' + (r.pet_types || '') + ', ' + (r.number_of_pets || 1) + ')' + (r.is_puppy ? ' <span style="color:#c8963e;font-weight:600">🐶 Puppy</span>' : '') + '</div>',
          '  <div class="arc-detail"><strong>Address:</strong> ' + (r.address || '') + '</div>',
          r.estimated_total ? '  <div class="arc-detail" style="background:#f9f6f0;padding:8px 10px;border-radius:6px;margin:6px 0;border:1px solid #e0d5c5"><strong>Total: $' + Number(r.estimated_total).toFixed(2) + '</strong>' + (r.price_breakdown ? '<div style="font-size:0.78rem;color:#6b5c4d;margin-top:2px">' + r.price_breakdown.replace(/\|/g, '<br>') + '</div>' : '') + (r.is_holiday ? '<div style="color:#c8963e;font-size:0.78rem;margin-top:2px">Holiday rate applied</div>' : '') + '</div>' : '',
          r.special_notes ? '  <div class="arc-detail"><strong>Notes:</strong> ' + r.special_notes + '</div>' : '',
          r.admin_notes ? '  <div class="arc-detail" style="color:var(--gold)"><strong>Your Note:</strong> ' + r.admin_notes + '</div>' : '',
          r.scheduled_date ? '  <div class="arc-detail" style="color:var(--forest)"><strong>Scheduled:</strong> ' + r.scheduled_date + ' at ' + (r.scheduled_time || r.preferred_time) + '</div>' : '',
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
        '    <option>Early Morning (6-8am)</option>',
        '    <option>Morning (8-10am)</option>',
        '    <option>Late Morning (10am-12pm)</option>',
        '    <option>Afternoon (12-3pm)</option>',
        '    <option>Late Afternoon (3-5pm)</option>',
        '    <option>Evening (5-7pm)</option>',
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
          // If accepting, find the matching Stripe payment link for this service
          var paymentLink = '';
          if (newStatus === 'accepted' && req.service) {
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
                paymentLink: paymentLink,
                estimatedTotal: req.estimated_total || null,
                priceBreakdown: req.price_breakdown || '',
              }),
            });
          } catch (e) { console.warn('Status notification failed:', e); }
        }

        // Refresh the list
        await this.loadRequests();

        if (typeof toast === 'function') {
          toast('Request ' + newStatus + '!');
        }
      } catch (err) {
        console.error('Failed to update request:', err);
        alert('Error updating request: ' + err.message);
      }
    },
  };

  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // 6. CALENDAR INTEGRATION â Show accepted bookings on calendar
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

