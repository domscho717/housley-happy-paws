// ============================================================
// Housley Happy Paws — UX Patch v8 (ux-patch.js)
// 1. Fix greeting emojis (garbled from encoding) + add decorative icons
// 2. Hero: shrink slideshow, enlarge text & Meet button
// 3. About Rachel: enlarge slideshow
// 4. Footer: set email to housleyhappypaws@gmail.com
// 5. Hero: restyle Meet Rachel as light RECTANGLE under slideshow
// 6. Fix mobile: comprehensive CSS + JS sidebar/hamburger
// 7. Add viewport preview tool to Edit Website page
// 8. v5: Fix nav-right hiding, add missing mobile breakpoints
// 9. v8: CREATE hamburger + mobile nav from scratch (no ux-upgrades dependency)
// 9b. v7: About photo full-width fix with inline styles
// 10. v6: Role-based view switcher (hide portals from unauthorized users)
// 11. v6: Hide Meet & Greet for clients with existing bookings
// 12. v8: Add Sign In button on mobile (top of screen)
// 13. v8: Fix review arrow navigation (one card at a time)
// 14. v8: Portal hamburger dropdowns (Client/Staff/Owner) in top nav
// ============================================================
(function() {
  'use strict';

  function onReady(fn) {
    if (document.readyState !== 'loading') setTimeout(fn, 800);
    else document.addEventListener('DOMContentLoaded', function() { setTimeout(fn, 800); });
  }

  // ─────────────────────────────────────────────
  // 1. FIX GREETINGS — replace garbled emoji with proper icons
  // ─────────────────────────────────────────────
  function fixGreetings() {
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

    // Fix owner portal greeting
    var ownerGreet = document.querySelector('#o-overview .ob-h');
    if (ownerGreet) {
      var text = ownerGreet.textContent;
      if (text.includes('Good morning') || text.includes('Good afternoon') || text.includes('Good evening')) {
        var nameMatch = text.match(/,\s*([A-Za-z]+)/);
        var name = nameMatch ? nameMatch[1] : 'Rachel';
        ownerGreet.innerHTML = greeting + ', ' + name + ' ' + iconHTML;
      }
    }

    // Fix client portal greeting
    var clientPortal = document.getElementById('pg-client');
    if (clientPortal) {
      clientPortal.querySelectorAll('h1, h2, .p-title').forEach(function(el) {
        var t = el.textContent;
        if (t.includes('Good morning') || t.includes('Good afternoon') || t.includes('Good evening')) {
          var nm = t.match(/,\s*([A-Za-z]+)/);
          var n = nm ? nm[1] : 'there';
          el.innerHTML = greeting + ', ' + n + '! ' + iconHTML;
        }
      });
    }

    // Fix staff portal greeting
    var staffPortal = document.getElementById('pg-staff');
    if (staffPortal) {
      staffPortal.querySelectorAll('h1, h2, .p-title, .ob-h, .hhp-staff-greet div').forEach(function(el) {
        var t = el.textContent;
        if (t.includes('Good morning') || t.includes('Good afternoon') || t.includes('Good evening')) {
          var nm = t.match(/,\s*([A-Za-z]+)/);
          var n = nm ? nm[1] : 'there';
          el.innerHTML = greeting + ', ' + n + '! ' + iconHTML;
        }
      });
    }

    setTimeout(fixGreetings, 60000);
  }

  // ─────────────────────────────────────────────
  // 2, 5, 6, 8. ALL CSS — Hero + Mobile + Comprehensive Responsive
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
      'html { scroll-behavior: smooth; }' +
      '*, *::before, *::after { max-width: 100vw; }' +
      '.nav, .hero, section, footer, .portal-wrap, .portal-main,' +
      '#pg-public, #pg-client, #pg-staff, #pg-owner {' +
        'overflow-x: hidden !important;' +
        'max-width: 100% !important;' +
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
        '.services-grid { grid-template-columns: repeat(2, 1fr) !important; }' +
        '.future-grid { grid-template-columns: repeat(2, 1fr) !important; }' +
      '}' +

      /* ===== PHONE (max 767px) — COMPREHENSIVE ===== */
      '@media (max-width: 767px) {' +

        /* -- Nav: hide desktop elements, show hamburger -- */
        '.nav { padding: 0 12px !important; height: 56px !important; }' +
        '.nav-logo { font-size: 1.2rem !important; }' +
        '.nav-center { display: none !important; }' +
        '.nav-right { display: none !important; }' +
        '#viewSwitcher { display: none !important; }' +

        /* -- v8 hamburger: gold button in nav -- */
        '.hhp-hamburger-v8 {' +
          'display: flex !important; order: 99; margin-left: auto;' +
          'background: var(--gold, #c8963e) !important; border: none !important;' +
          'width: 44px !important; height: 44px !important; border-radius: 10px !important;' +
          'align-items: center !important; justify-content: center !important;' +
          'cursor: pointer !important; padding: 0 !important; z-index: 9999 !important;' +
          'font-size: 20px !important; color: white !important; line-height: 1 !important;' +
          '-webkit-tap-highlight-color: transparent !important;' +
          'touch-action: manipulation !important; user-select: none !important;' +
        '}' +

        /* -- v8 mobile nav overlay -- */
        '.hhp-mobile-nav-v8 {' +
          'display: none !important;' +
        '}' +
        '.hhp-mobile-nav-v8.hhp-mnav-open {' +
          'display: flex !important; flex-direction: column !important;' +
          'position: fixed !important; top: 0 !important; left: 0 !important;' +
          'width: 100vw !important; height: 100vh !important;' +
          'z-index: 9997 !important; background: #fdfaf5 !important;' +
          'padding: 70px 20px 20px !important; overflow-y: auto !important;' +
        '}' +
        '.hhp-mnav-link {' +
          'display: block; padding: 14px 0; font-size: 1.1rem; font-weight: 600;' +
          'color: #1e1409; text-decoration: none; border-bottom: 1px solid #e8ddd0;' +
          'cursor: pointer;' +
        '}' +
        '.hhp-mnav-link:last-child { border-bottom: none; }' +
        '.hhp-mnav-divider {' +
          'height: 1px; background: #d4c4ad; margin: 12px 0;' +
        '}' +
        '.hhp-mnav-label {' +
          'font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px;' +
          'color: #9a8a74; font-weight: 700; margin-top: 8px; margin-bottom: 4px;' +
        '}' +
        '.hhp-mnav-signin {' +
          'display: inline-block; margin-top: 16px; padding: 12px 28px;' +
          'background: transparent; border: 1.5px solid #c8963e; border-radius: 10px;' +
          'color: #c8963e; font-weight: 700; font-size: 0.95rem; cursor: pointer;' +
          'text-align: center; text-decoration: none;' +
        '}' +
        '.hhp-mnav-signout {' +
          'display: inline-block; margin-top: 8px; padding: 12px 28px;' +
          'background: transparent; border: 1.5px solid #c8963e; border-radius: 10px;' +
          'color: #c8963e; font-weight: 700; font-size: 0.95rem; cursor: pointer;' +
          'text-align: center; text-decoration: none;' +
        '}' +

        /* -- Mobile Sign In button (top bar) -- */
        '.hhp-mobile-signin-btn {' +
          'display: flex !important; align-items: center; justify-content: center;' +
          'margin-left: 8px; padding: 8px 14px; border-radius: 8px;' +
          'border: 1.5px solid #c8963e; background: transparent; color: #c8963e;' +
          'font-weight: 700; font-size: 0.78rem; cursor: pointer; white-space: nowrap;' +
          '-webkit-tap-highlight-color: transparent; touch-action: manipulation;' +
        '}' +
        '.hhp-mobile-signout-btn {' +
          'display: flex !important; align-items: center; justify-content: center;' +
          'margin-left: 8px; padding: 8px 14px; border-radius: 8px;' +
          'border: 1.5px solid #c8963e; background: transparent; color: #c8963e;' +
          'font-weight: 700; font-size: 0.78rem; cursor: pointer; white-space: nowrap;' +
          '-webkit-tap-highlight-color: transparent; touch-action: manipulation;' +
        '}' +

        /* -- Hero -- */
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

        /* -- About -- */
        '.about-section { padding: 48px 16px !important; }' +
        '.about-grid { grid-template-columns: 1fr !important; gap: 24px !important; }' +
        '.about-photos { min-height: 280px !important; max-width: 100% !important; width: 100% !important; border-radius: 16px !important; }' +
        '.section-h { font-size: 1.75rem !important; }' +
        '.section-p { font-size: 0.88rem !important; }' +

        /* -- Services -- */
        '.services-section { padding: 48px 16px !important; }' +
        '.services-grid { grid-template-columns: 1fr !important; gap: 14px !important; }' +
        '.service-card { padding: 20px !important; }' +
        '.sc-name { font-size: 1.1rem !important; }' +
        '.sc-price { font-size: 1.15rem !important; }' +

        /* -- Calendar -- */
        '.cal-section { padding: 48px 16px !important; }' +
        '.cal-wrap { margin-top: 20px !important; }' +
        '.cal-grid .cal-day { min-height: 48px !important; padding: 4px !important; }' +
        '.cal-day-num { font-size: 0.7rem !important; }' +
        '.cal-event-dot { font-size: 0.55rem !important; }' +
        '.cal-dow { font-size: 0.62rem !important; padding: 4px 0 !important; }' +

        /* -- Reviews: one card at a time, no partial/cut-off -- */
        '.reviews-section { padding: 48px 16px !important; overflow: hidden !important; }' +
        '.reviews-track {' +
          'display: flex !important; grid-template-columns: none !important;' +
          'overflow-x: auto !important; scroll-snap-type: x mandatory !important;' +
          'gap: 0px !important; -webkit-overflow-scrolling: touch !important;' +
          'scroll-behavior: smooth !important; padding: 0 !important;' +
        '}' +
        '.reviews-track .review-card {' +
          'flex: 0 0 100% !important; width: 100% !important; min-width: 100% !important;' +
          'scroll-snap-align: start !important; padding: 24px !important;' +
          'box-sizing: border-box !important; margin: 0 !important;' +
        '}' +

        /* -- Coming Soon / Future -- */
        '.future-section { padding: 40px 16px !important; }' +
        '.future-grid { grid-template-columns: 1fr !important; gap: 14px !important; }' +

        /* -- Footer -- */
        'footer { padding: 36px 16px 20px !important; }' +
        '.footer-grid { grid-template-columns: 1fr !important; gap: 20px !important; }' +
        '.footer-bottom { flex-direction: column !important; gap: 8px !important; text-align: center !important; }' +

        /* -- Portal sidebar: hidden, overlay when open -- */
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
        '#pg-owner .sidebar.hhp-sidebar-open,' +
        '#pg-client .sidebar.hhp-sidebar-open,' +
        '#pg-staff .sidebar.hhp-sidebar-open,' +
        '.portal-wrap > .sidebar.hhp-sidebar-open,' +
        'div.sidebar.hhp-sidebar-open {' +
          'display: flex !important; visibility: visible !important;' +
          'position: fixed !important; top: 0 !important; left: 0 !important;' +
          'width: 100vw !important; min-width: 100vw !important;' +
          'height: 100% !important; max-height: 100vh !important;' +
          'max-width: 100vw !important; z-index: 9999 !important;' +
          'background: #fefcf8 !important; flex-direction: column !important;' +
          'overflow-y: scroll !important; -webkit-overflow-scrolling: touch !important;' +
          'padding: 70px 20px 140px 20px !important;' +
          'pointer-events: auto !important; overscroll-behavior-y: contain !important;' +
        '}' +

        /* Force ALL text dark inside open sidebar — nuclear approach */
        '.sidebar.hhp-sidebar-open .sb-item {' +
          'display: flex !important; padding: 16px 20px !important; font-size: 1.05rem !important;' +
          'border-bottom: 1px solid #e0d5c5 !important; margin: 0 !important;' +
          'border-radius: 0 !important; width: 100% !important; cursor: pointer !important;' +
          'color: #1a1008 !important; font-weight: 700 !important;' +
          'background: transparent !important; opacity: 1 !important;' +
          'text-shadow: none !important; -webkit-text-fill-color: #1a1008 !important;' +
          'letter-spacing: 0.01em !important;' +
        '}' +
        '.sidebar.hhp-sidebar-open .sb-item *,' +
        '.sidebar.hhp-sidebar-open .sb-item span,' +
        '.sidebar.hhp-sidebar-open .sb-item div,' +
        '.sidebar.hhp-sidebar-open .sb-item a,' +
        '.sidebar.hhp-sidebar-open .sb-item p,' +
        '.sidebar.hhp-sidebar-open .sb-item label,' +
        '.sidebar.hhp-sidebar-open > *,' +
        '.sidebar.hhp-sidebar-open > div,' +
        '.sidebar.hhp-sidebar-open > a,' +
        '.sidebar.hhp-sidebar-open > span {' +
          'color: #1a1008 !important; opacity: 1 !important;' +
          '-webkit-text-fill-color: #1a1008 !important;' +
          'visibility: visible !important;' +
        '}' +
        /* Also target the sidebar itself for any direct text */
        '.sidebar.hhp-sidebar-open {' +
          'color: #1a1008 !important; -webkit-text-fill-color: #1a1008 !important;' +
        '}' +
        /* Active/highlighted items keep their gold background but also get dark text */
        '.sidebar.hhp-sidebar-open .sb-item.active,' +
        '.sidebar.hhp-sidebar-open .sb-item[class*="active"],' +
        '.sidebar.hhp-sidebar-open .sb-item.selected {' +
          'color: #1a1008 !important; -webkit-text-fill-color: #1a1008 !important;' +
        '}' +
        '.sidebar.hhp-sidebar-open .sb-item.active *,' +
        '.sidebar.hhp-sidebar-open .sb-item[class*="active"] *,' +
        '.sidebar.hhp-sidebar-open .sb-item.selected * {' +
          'color: #1a1008 !important; -webkit-text-fill-color: #1a1008 !important;' +
        '}' +

        /* -- Portal hamburger: top-right -- */
        '.hhp-portal-hamburger {' +
          'display: flex !important; position: fixed !important;' +
          'top: 10px !important; right: 10px !important; bottom: auto !important; left: auto !important;' +
          'z-index: 10000 !important; width: 44px !important; height: 44px !important;' +
          'border-radius: 10px !important; background: var(--gold, #c8963e) !important;' +
          'color: white !important; align-items: center !important; justify-content: center !important;' +
          'font-size: 20px !important; box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;' +
          'border: none !important; cursor: pointer !important;' +
        '}' +

        /* -- Portal main: full width -- */
        '.portal-wrap { display: block !important; }' +
        '.portal-wrap > .portal-main, .portal-main {' +
          'width: 100% !important; max-width: 100% !important;' +
          'padding: 12px !important; margin-left: 0 !important;' +
        '}' +

        /* -- Portal cards & stats -- */
        '.stats-row { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }' +
        '.stat-box { padding: 12px !important; }' +
        '.stat-num { font-size: 1.4rem !important; }' +
        '.stat-lbl { font-size: 0.68rem !important; }' +
        '.card { padding: 14px !important; margin-bottom: 12px !important; }' +
        '.form-row { grid-template-columns: 1fr !important; }' +
        '.report-stats { grid-template-columns: repeat(2, 1fr) !important; }' +
        '.report-photos { grid-template-columns: repeat(2, 1fr) !important; }' +

        /* -- Owner banner -- */
        '.owner-banner { padding: 18px !important; border-radius: 12px !important; }' +
        '.ob-top { flex-direction: column !important; gap: 10px !important; }' +
        '.ob-h { font-size: 1.3rem !important; }' +
        '.ob-stats { flex-wrap: wrap !important; gap: 12px !important; }' +

        /* -- Tabs -- */
        '.tabs { flex-wrap: wrap !important; gap: 2px !important; }' +
        '.tab { padding: 6px 10px !important; font-size: 0.74rem !important; }' +

        /* -- Appointments -- */
        '.appt-row { flex-direction: column !important; align-items: flex-start !important; gap: 6px !important; }' +
        '.appt-meta { text-align: left !important; }' +
        '.job-card { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }' +

        /* -- Availability -- */
        '.avail-grid { grid-template-columns: repeat(7, 1fr) !important; gap: 3px !important; }' +
        '.avail-day { padding: 6px 2px !important; font-size: 0.65rem !important; }' +

        /* -- Messages -- */
        '.msg-in, .msg-out { max-width: 88% !important; }' +
        '.msg-input-row { gap: 6px !important; }' +

        /* -- Modals -- */
        '.overlay { padding: 12px !important; }' +
        '.modal { padding: 20px !important; margin: 8px !important; max-height: 92vh !important; }' +
        '.modal-title { font-size: 1.4rem !important; }' +

        /* -- Auth overlay -- */
        '.auth-card { padding: 28px 20px !important; margin: 12px !important; }' +
        '.auth-logo { font-size: 1.5rem !important; }' +

        /* -- Toast -- */
        '.toast { bottom: 16px !important; right: 16px !important; left: 16px !important; max-width: none !important; }' +

        /* -- Floating book button position -- */
        '#floatingBookBtn { bottom: 16px !important; right: 16px !important; }' +

        /* -- Payment steps -- */
        '.pay-step { padding: 10px !important; }' +
        '.pay-step-num { font-size: 1.2rem !important; }' +

        /* -- Client list -- */
        '.client-row { padding: 10px 0 !important; }' +
        '.cl-ava { width: 36px !important; height: 36px !important; font-size: 0.78rem !important; }' +

        /* -- Hide old hamburger from ux-upgrades if it exists -- */
        '.hhp-hamburger:not(.hhp-hamburger-v8) { display: none !important; }' +
        '.hhp-mobile-nav:not(.hhp-mobile-nav-v8) { display: none !important; }' +
      '}' +

      /* ===== SMALL PHONE (max 400px) ===== */
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

      /* ===== Hide hamburger on desktop ===== */
      '@media (min-width: 768px) {' +
        '.hhp-hamburger-v8 { display: none !important; }' +
        '.hhp-mobile-signin-btn { display: none !important; }' +
        '.hhp-mobile-signout-btn { display: none !important; }' +
        '.hhp-portal-hamburger { display: none !important; }' +
      '}' +

      /* ===== Portal nav dropdown (v8) — all screen sizes ===== */
      '.hhp-portal-nav {' +
        'display: flex; align-items: center; gap: 4px; margin-left: 16px;' +
      '}' +
      '.hhp-portal-nav-btn {' +
        'position: relative; background: none; border: 1.5px solid rgba(30,20,9,0.12);' +
        'border-radius: 8px; padding: 7px 12px; font-size: 0.82rem; font-weight: 600;' +
        'color: #1e1409; cursor: pointer; display: flex; align-items: center; gap: 6px;' +
        'transition: all 0.15s;' +
      '}' +
      '.hhp-portal-nav-btn:hover, .hhp-portal-nav-btn.active {' +
        'background: var(--gold, #c8963e); color: white; border-color: var(--gold, #c8963e);' +
      '}' +
      '.hhp-portal-nav-btn .hhp-pn-arrow { font-size: 0.6rem; transition: transform 0.2s; }' +
      '.hhp-portal-nav-btn.active .hhp-pn-arrow { transform: rotate(180deg); }' +
      '.hhp-portal-dropdown {' +
        'display: none; position: absolute; top: 100%; left: 0; min-width: 180px;' +
        'background: #fefcf8; border: 1.5px solid rgba(30,20,9,0.1); border-radius: 10px;' +
        'box-shadow: 0 4px 16px rgba(30,20,9,0.12); z-index: 10001; padding: 6px 0;' +
        'margin-top: 4px;' +
      '}' +
      '.hhp-portal-dropdown.hhp-pd-open { display: block; }' +
      '.hhp-portal-dropdown a, .hhp-portal-dropdown .hhp-pd-item {' +
        'display: block; padding: 10px 16px; font-size: 0.88rem; font-weight: 500;' +
        'color: #1e1409; text-decoration: none; cursor: pointer; transition: background 0.15s;' +
      '}' +
      '.hhp-portal-dropdown a:hover, .hhp-portal-dropdown .hhp-pd-item:hover {' +
        'background: #f5f0ea;' +
      '}' +

      /* Portal nav on tablet */
      '@media (min-width: 768px) and (max-width: 1024px) {' +
        '.hhp-portal-nav { margin-left: 8px; }' +
        '.hhp-portal-nav-btn { padding: 6px 10px; font-size: 0.78rem; }' +
      '}' +
      /* Portal nav on phone — hide desktop version, show in mobile nav instead */
      '@media (max-width: 767px) {' +
        '.hhp-portal-nav { display: none !important; }' +
      '}' +

      /* ===== Preview tool styles ===== */
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
  // 6. MOBILE SIDEBAR — JS-based force hide + fix navigation
  // ─────────────────────────────────────────────
  function fixMobileSidebar() {
    var isMobile = window.innerWidth <= 767;
    if (!isMobile) return;

    // Force-hide all sidebars via inline style
    document.querySelectorAll('.sidebar').forEach(function(sidebar) {
      if (!sidebar.classList.contains('hhp-sidebar-open')) {
        sidebar.style.setProperty('display', 'none', 'important');
        sidebar.style.setProperty('visibility', 'hidden', 'important');
        sidebar.style.setProperty('width', '0', 'important');
        sidebar.style.setProperty('height', '0', 'important');
        sidebar.style.setProperty('overflow', 'hidden', 'important');
        sidebar.style.setProperty('position', 'absolute', 'important');
      }
    });

    // Fix portal hamburger position (top-right)
    var portalHamburger = document.querySelector('.hhp-portal-hamburger');
    if (portalHamburger) {
      portalHamburger.style.setProperty('top', '10px', 'important');
      portalHamburger.style.setProperty('right', '10px', 'important');
      portalHamburger.style.setProperty('bottom', 'auto', 'important');
      portalHamburger.style.setProperty('left', 'auto', 'important');
      portalHamburger.style.setProperty('width', '44px', 'important');
      portalHamburger.style.setProperty('height', '44px', 'important');
      portalHamburger.style.setProperty('border-radius', '10px', 'important');
      portalHamburger.style.setProperty('z-index', '10000', 'important');
    }

    // Also force-hide nav-right on mobile
    var navRight = document.querySelector('.nav-right');
    if (navRight) {
      navRight.style.setProperty('display', 'none', 'important');
    }

    // Bind sidebar items to close on click
    document.querySelectorAll('.sidebar .sb-item').forEach(function(item) {
      if (item.dataset.hhpPatchBound) return;
      item.dataset.hhpPatchBound = 'true';
      item.addEventListener('click', function() {
        setTimeout(function() {
          closeSidebar();
        }, 200);
      });
    });

    // Override portal hamburger click
    if (portalHamburger && !portalHamburger.dataset.hhpPatchBound) {
      portalHamburger.dataset.hhpPatchBound = 'true';
      var newHamburger = portalHamburger.cloneNode(true);
      portalHamburger.parentNode.replaceChild(newHamburger, portalHamburger);

      // Re-apply position styles after clone
      newHamburger.style.setProperty('top', '10px', 'important');
      newHamburger.style.setProperty('right', '10px', 'important');
      newHamburger.style.setProperty('bottom', 'auto', 'important');
      newHamburger.style.setProperty('left', 'auto', 'important');
      newHamburger.style.setProperty('width', '44px', 'important');
      newHamburger.style.setProperty('height', '44px', 'important');
      newHamburger.style.setProperty('border-radius', '10px', 'important');
      newHamburger.style.setProperty('z-index', '10000', 'important');
      newHamburger.style.setProperty('display', 'flex', 'important');
      newHamburger.innerHTML = '\u2630';

      newHamburger.addEventListener('click', function(e) {
        e.stopPropagation();
        var portals = ['pg-owner', 'pg-client', 'pg-staff'];
        var targetSidebar = null;
        portals.forEach(function(pid) {
          var portal = document.getElementById(pid);
          if (portal && portal.offsetParent !== null) {
            var sb = portal.querySelector('.sidebar');
            if (sb) targetSidebar = sb;
          }
        });
        if (!targetSidebar) return;

        var isOpen = targetSidebar.classList.contains('hhp-sidebar-open');
        if (isOpen) {
          closeSidebarEl(targetSidebar);
          newHamburger.innerHTML = '\u2630';
        } else {
          openSidebarEl(targetSidebar);
          newHamburger.innerHTML = '\u2715';

          // Add close button if not present
          if (!targetSidebar.querySelector('.hhp-sidebar-close-v4')) {
            var closeBtn = document.createElement('button');
            closeBtn.className = 'hhp-sidebar-close-v4';
            closeBtn.innerHTML = '\u2715';
            closeBtn.style.cssText = 'position:fixed;top:14px;right:14px;z-index:10001;' +
              'background:#1e1409;color:white;border:none;width:36px;height:36px;' +
              'border-radius:50%;font-size:1.2rem;cursor:pointer;display:flex;' +
              'align-items:center;justify-content:center;';
            closeBtn.addEventListener('click', function() {
              closeSidebarEl(targetSidebar);
              newHamburger.innerHTML = '\u2630';
            });
            targetSidebar.prepend(closeBtn);
          }

          // Bind sidebar items
          targetSidebar.querySelectorAll('.sb-item').forEach(function(item) {
            if (item.dataset.hhpPatchBound) return;
            item.dataset.hhpPatchBound = 'true';
            item.addEventListener('click', function() {
              setTimeout(function() {
                closeSidebarEl(targetSidebar);
                newHamburger.innerHTML = '\u2630';
              }, 200);
            });
          });
        }
      });
    }
  }

  // Track body scroll position for iOS fix
  var _savedBodyScroll = 0;

  function openSidebarEl(sidebar) {
    sidebar.classList.add('hhp-sidebar-open');

    // iOS scroll fix: instead of body overflow hidden,
    // freeze body position so sidebar can scroll freely
    _savedBodyScroll = window.pageYOffset || document.documentElement.scrollTop;
    document.body.style.setProperty('position', 'fixed', 'important');
    document.body.style.setProperty('top', (-_savedBodyScroll) + 'px', 'important');
    document.body.style.setProperty('left', '0', 'important');
    document.body.style.setProperty('right', '0', 'important');
    document.body.style.setProperty('width', '100%', 'important');

    // Sidebar container: fixed overlay
    sidebar.style.cssText =
      'display:flex!important;visibility:visible!important;' +
      'position:fixed!important;top:0!important;left:0!important;' +
      'width:100vw!important;min-width:100vw!important;height:100%!important;' +
      'max-height:100vh!important;max-height:-webkit-fill-available!important;' +
      'z-index:9999!important;background:#fefcf8!important;' +
      'flex-direction:column!important;' +
      'overflow-y:scroll!important;overflow-x:hidden!important;' +
      '-webkit-overflow-scrolling:touch!important;' +
      'overscroll-behavior-y:contain!important;' +
      'padding:70px 20px 140px 20px!important;' +
      'pointer-events:auto!important;' +
      'color:#1a1008!important;-webkit-text-fill-color:#1a1008!important;';

    // Force text visibility on ALL elements inside sidebar
    sidebar.querySelectorAll('*').forEach(function(el) {
      el.style.setProperty('color', '#1a1008', 'important');
      el.style.setProperty('-webkit-text-fill-color', '#1a1008', 'important');
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
    });
    // Extra emphasis on sb-items
    sidebar.querySelectorAll('.sb-item').forEach(function(item) {
      item.style.setProperty('font-weight', '700', 'important');
      item.style.setProperty('font-size', '1.05rem', 'important');
      item.style.setProperty('display', 'flex', 'important');
      item.style.setProperty('padding', '16px 20px', 'important');
      item.style.setProperty('border-bottom', '1px solid #e0d5c5', 'important');
    });

    // Prevent body touch scrolling but ALLOW sidebar touch scrolling
    sidebar._hhpTouchHandler = function(e) {
      e.stopPropagation();
      // Allow scrolling within the sidebar
    };
    sidebar.addEventListener('touchmove', sidebar._hhpTouchHandler, { passive: true });
  }

  function closeSidebarEl(sidebar) {
    sidebar.classList.remove('hhp-sidebar-open');
    sidebar.style.cssText =
      'display:none!important;visibility:hidden!important;' +
      'width:0!important;height:0!important;min-width:0!important;' +
      'overflow:hidden!important;position:absolute!important;' +
      'left:-9999px!important;pointer-events:none!important;';

    // Remove touch handler
    if (sidebar._hhpTouchHandler) {
      sidebar.removeEventListener('touchmove', sidebar._hhpTouchHandler);
      sidebar._hhpTouchHandler = null;
    }

    // iOS scroll fix: restore body position and scroll
    document.body.style.removeProperty('position');
    document.body.style.removeProperty('top');
    document.body.style.removeProperty('left');
    document.body.style.removeProperty('right');
    document.body.style.removeProperty('width');
    document.body.style.overflow = '';
    window.scrollTo(0, _savedBodyScroll || 0);
  }

  function closeSidebar() {
    document.querySelectorAll('.sidebar.hhp-sidebar-open').forEach(function(s) {
      closeSidebarEl(s);
    });
    var h = document.querySelector('.hhp-portal-hamburger');
    if (h) h.innerHTML = '\u2630';
  }

  // ─────────────────────────────────────────────
  // 4. FOOTER — set email to housleyhappypaws@gmail.com
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
  // 7. VIEWPORT PREVIEW — inject into Edit Website page
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
  // 9. v8: CREATE HAMBURGER + MOBILE NAV FROM SCRATCH
  //    No dependency on ux-upgrades.js — we build everything ourselves
  // ─────────────────────────────────────────────
  var _mobileNavV8Created = false;

  function createMobileNav() {
    if (_mobileNavV8Created) return;
    if (window.innerWidth > 767) return;

    var nav = document.getElementById('mainNav');
    if (!nav) return;

    _mobileNavV8Created = true;

    // Hide any old hamburger/mobile nav from ux-upgrades.js
    var oldHamburger = document.querySelector('.hhp-hamburger:not(.hhp-hamburger-v8)');
    if (oldHamburger) oldHamburger.style.setProperty('display', 'none', 'important');
    var oldMobileNav = document.querySelector('.hhp-mobile-nav:not(.hhp-mobile-nav-v8)');
    if (oldMobileNav) oldMobileNav.style.setProperty('display', 'none', 'important');

    // === CREATE THE HAMBURGER BUTTON ===
    var btn = document.createElement('button');
    btn.className = 'hhp-hamburger-v8';
    btn.setAttribute('aria-label', 'Open menu');
    btn.textContent = '\u2630';
    btn.style.cssText =
      'display:flex!important;order:99!important;margin-left:auto!important;' +
      'background:#c8963e!important;border:none!important;' +
      'width:44px!important;height:44px!important;border-radius:10px!important;' +
      'align-items:center!important;justify-content:center!important;' +
      'cursor:pointer!important;padding:0!important;z-index:9999!important;' +
      'font-size:20px!important;color:white!important;line-height:1!important;' +
      'pointer-events:auto!important;-webkit-tap-highlight-color:transparent!important;' +
      'touch-action:manipulation!important;user-select:none!important;' +
      'position:relative!important;';
    nav.appendChild(btn);

    // === CREATE THE MOBILE NAV OVERLAY ===
    var mobileNav = document.createElement('div');
    mobileNav.className = 'hhp-mobile-nav-v8';
    document.body.appendChild(mobileNav);

    // Build nav content
    function buildMobileNavContent() {
      var isLoggedIn = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentUser) ? true : false;
      var role = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentRole) ? HHP_Auth.currentRole : null;

      var html = '';

      // Home link
      html += '<a class="hhp-mnav-link" data-action="home">Home</a>';

      // Public pages
      html += '<a class="hhp-mnav-link" data-action="scroll" data-target=".services-section">Services</a>';
      html += '<a class="hhp-mnav-link" data-action="scroll" data-target=".about-section">About</a>';
      html += '<a class="hhp-mnav-link" data-action="scroll" data-target=".reviews-section">Reviews</a>';

      // Portal links based on role
      if (isLoggedIn) {
        html += '<div class="hhp-mnav-divider"></div>';

        if (role === 'client' || role === 'owner') {
          html += '<div class="hhp-mnav-label">Client Portal</div>';
          html += '<a class="hhp-mnav-link" data-action="portal" data-portal="client" data-section="c-overview">Overview</a>';
          html += '<a class="hhp-mnav-link" data-action="portal" data-portal="client" data-section="c-pets">My Pet</a>';
          html += '<a class="hhp-mnav-link" data-action="portal" data-portal="client" data-section="c-account">Account</a>';
        }

        if (role === 'staff' || role === 'owner') {
          html += '<div class="hhp-mnav-divider"></div>';
          html += '<div class="hhp-mnav-label">Staff Portal</div>';
          html += '<a class="hhp-mnav-link" data-action="portal" data-portal="staff" data-section="s-work">My Work</a>';
          html += '<a class="hhp-mnav-link" data-action="portal" data-portal="staff" data-section="s-comm">Communication</a>';
        }

        if (role === 'owner') {
          html += '<div class="hhp-mnav-divider"></div>';
          html += '<div class="hhp-mnav-label">Owner Portal</div>';
          html += '<a class="hhp-mnav-link" data-action="portal" data-portal="owner" data-section="o-overview">Overview</a>';
        }

        // View switcher
        html += '<div class="hhp-mnav-divider"></div>';
        html += '<div class="hhp-mnav-label">Switch View</div>';
        html += '<select id="hhpMobileViewDDv8" style="width:100%;padding:10px;border-radius:8px;border:1.5px solid #d4c4ad;font-size:0.95rem;background:#fff;color:#1e1409;">';
        html += '<option value="public">Home</option>';
        if (role === 'client' || role === 'owner') html += '<option value="client">My Portal</option>';
        if (role === 'staff' || role === 'owner') html += '<option value="staff">Staff</option>';
        if (role === 'owner') html += '<option value="owner">Owner</option>';
        html += '</select>';
      }

      html += '<div class="hhp-mnav-divider"></div>';

      // Sign In / Sign Out
      if (isLoggedIn) {
        html += '<a class="hhp-mnav-signout" data-action="signout">Sign Out</a>';
      } else {
        html += '<a class="hhp-mnav-signin" data-action="signin">Sign In</a>';
      }

      mobileNav.innerHTML = html;

      // Bind actions
      mobileNav.querySelectorAll('[data-action]').forEach(function(el) {
        el.addEventListener('click', function(e) {
          e.preventDefault();
          var action = el.getAttribute('data-action');

          if (action === 'home') {
            closeMobileNavV8();
            if (typeof showPublic === 'function') showPublic();
            else if (typeof switchView === 'function') switchView('public');
          } else if (action === 'scroll') {
            closeMobileNavV8();
            var target = el.getAttribute('data-target');
            var section = document.querySelector(target);
            if (section) {
              // Make sure we're on public view first
              if (typeof showPublic === 'function') showPublic();
              setTimeout(function() { section.scrollIntoView({ behavior: 'smooth' }); }, 200);
            }
          } else if (action === 'portal') {
            closeMobileNavV8();
            var portal = el.getAttribute('data-portal');
            var section2 = el.getAttribute('data-section');
            if (typeof switchView === 'function') switchView(portal);
            // Try to activate the specific section
            setTimeout(function() {
              var sectionEl = document.getElementById(section2);
              if (sectionEl) {
                // Click the corresponding sidebar item if possible
                var sidebarItems = document.querySelectorAll('.sb-item');
                sidebarItems.forEach(function(si) {
                  if (si.getAttribute('data-tab') === section2 || si.getAttribute('onclick') && si.getAttribute('onclick').indexOf(section2) !== -1) {
                    si.click();
                  }
                });
              }
            }, 300);
          } else if (action === 'signin') {
            closeMobileNavV8();
            if (typeof HHP_Auth !== 'undefined' && HHP_Auth.showLoginScreen) {
              HHP_Auth.showLoginScreen();
            } else if (typeof switchView === 'function') {
              switchView('client');
            }
          } else if (action === 'signout') {
            closeMobileNavV8();
            if (typeof HHP_Auth !== 'undefined' && HHP_Auth.logout) {
              HHP_Auth.logout();
            }
          }
        });
      });

      // Bind view switcher dropdown
      var dd = document.getElementById('hhpMobileViewDDv8');
      if (dd) {
        dd.addEventListener('change', function() {
          var val = dd.value;
          closeMobileNavV8();
          if (typeof switchViewFromDrop === 'function') switchViewFromDrop(val);
          else if (typeof switchView === 'function') switchView(val);
        });
      }
    }

    function closeMobileNavV8() {
      mobileNav.classList.remove('hhp-mnav-open');
      mobileNav.style.setProperty('display', 'none', 'important');
      btn.textContent = '\u2630';
      document.body.style.overflow = '';
    }

    function openMobileNavV8() {
      // Rebuild content each time (to reflect current auth state)
      buildMobileNavContent();
      mobileNav.classList.add('hhp-mnav-open');
      mobileNav.style.setProperty('display', 'flex', 'important');
      mobileNav.style.setProperty('flex-direction', 'column', 'important');
      mobileNav.style.setProperty('position', 'fixed', 'important');
      mobileNav.style.setProperty('top', '0', 'important');
      mobileNav.style.setProperty('left', '0', 'important');
      mobileNav.style.setProperty('width', '100vw', 'important');
      mobileNav.style.setProperty('height', '100vh', 'important');
      mobileNav.style.setProperty('z-index', '9997', 'important');
      mobileNav.style.setProperty('background', '#fdfaf5', 'important');
      mobileNav.style.setProperty('padding', '70px 20px 20px', 'important');
      mobileNav.style.setProperty('overflow-y', 'auto', 'important');
      btn.textContent = '\u2715';
      document.body.style.overflow = 'hidden';
    }

    // HAMBURGER CLICK — use capture phase for max priority
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      var isOpen = mobileNav.classList.contains('hhp-mnav-open');
      if (isOpen) closeMobileNavV8();
      else openMobileNavV8();
    }, true);

    // HAMBURGER TOUCH — for mobile devices
    btn.addEventListener('touchend', function(e) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      var isOpen = mobileNav.classList.contains('hhp-mnav-open');
      if (isOpen) closeMobileNavV8();
      else openMobileNavV8();
    }, true);

    console.log('\u2705 HHP: Mobile nav + hamburger created from scratch (v8)');
  }

  // ─────────────────────────────────────────────
  // 12. v8: MOBILE SIGN IN BUTTON — in the nav bar next to hamburger
  // ─────────────────────────────────────────────
  function addMobileSignIn() {
    if (window.innerWidth > 767) return;
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    if (nav.querySelector('.hhp-mobile-signin-btn') || nav.querySelector('.hhp-mobile-signout-btn')) return;

    var isLoggedIn = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentUser) ? true : false;

    if (isLoggedIn) {
      var outBtn = document.createElement('button');
      outBtn.className = 'hhp-mobile-signout-btn';
      outBtn.textContent = 'Sign Out';
      outBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (typeof HHP_Auth !== 'undefined' && HHP_Auth.logout) HHP_Auth.logout();
      });
      // Insert before the hamburger
      var hamburger = nav.querySelector('.hhp-hamburger-v8');
      if (hamburger) nav.insertBefore(outBtn, hamburger);
      else nav.appendChild(outBtn);
    } else {
      var inBtn = document.createElement('button');
      inBtn.className = 'hhp-mobile-signin-btn';
      inBtn.textContent = 'Sign In';
      inBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (typeof HHP_Auth !== 'undefined' && HHP_Auth.showLoginScreen) {
          HHP_Auth.showLoginScreen();
        } else if (typeof switchView === 'function') {
          switchView('client');
        }
      });
      var hamburger2 = nav.querySelector('.hhp-hamburger-v8');
      if (hamburger2) nav.insertBefore(inBtn, hamburger2);
      else nav.appendChild(inBtn);
    }
  }

  // Update sign in/out button when auth state changes
  function refreshMobileSignIn() {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    // Remove existing buttons
    var existing = nav.querySelectorAll('.hhp-mobile-signin-btn, .hhp-mobile-signout-btn');
    existing.forEach(function(el) { el.remove(); });
    // Re-add based on current state
    addMobileSignIn();
  }

  // ─────────────────────────────────────────────
  // 13. v8: FIX REVIEW ARROWS — scroll exactly one card at a time
  // ─────────────────────────────────────────────
  function fixReviewArrows() {
    // Override the global scrollReviews function
    window.scrollReviews = function(dir) {
      var track = document.getElementById('reviewsTrack');
      if (!track) return;

      var cards = track.querySelectorAll('.review-card');
      if (!cards.length) return;

      var cardW = cards[0].offsetWidth;
      // Get computed gap (default 22px on desktop, 0 on mobile)
      var gap = 0;
      var style = window.getComputedStyle(track);
      if (style.gap && style.gap !== 'normal') {
        gap = parseInt(style.gap, 10) || 0;
      } else if (style.columnGap && style.columnGap !== 'normal') {
        gap = parseInt(style.columnGap, 10) || 0;
      }

      // On mobile, cards are 100% width with 0 gap
      var scrollAmount = cardW + gap;

      track.scrollBy({ left: dir * scrollAmount, behavior: 'smooth' });
    };

    // Also rebind the arrow buttons to ensure they use the new function
    document.querySelectorAll('.rev-nav-btn').forEach(function(btn) {
      var newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        // Determine direction from the button's onclick or position
        var dir = 1;
        var onclick = newBtn.getAttribute('onclick') || '';
        if (onclick.indexOf('-1') !== -1) dir = -1;
        else if (onclick.indexOf('1') !== -1) dir = 1;
        // If no onclick, check if it's the first or second button
        if (!onclick) {
          var allBtns = newBtn.parentNode.querySelectorAll('.rev-nav-btn');
          if (allBtns[0] === newBtn) dir = -1;
          else dir = 1;
        }
        newBtn.removeAttribute('onclick');
        window.scrollReviews(dir);
      });
    });

    console.log('\u2705 HHP: Review arrow navigation fixed (v8 — one card at a time)');
  }

  // ─────────────────────────────────────────────
  // 14. v8: PORTAL HAMBURGER DROPDOWNS — in top nav bar
  //     Client: Overview, My Pet, Account
  //     Staff: My Work, Communication
  //     Owner: Overview
  // ─────────────────────────────────────────────
  var _portalNavInjected = false;

  function injectPortalNav() {
    if (_portalNavInjected) return;

    var navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    // Check auth
    var isLoggedIn = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentUser) ? true : false;
    var role = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentRole) ? HHP_Auth.currentRole : null;
    if (!isLoggedIn) return;

    _portalNavInjected = true;

    var container = document.createElement('div');
    container.className = 'hhp-portal-nav';
    container.id = 'hhpPortalNav';

    // Define portal menus based on role
    var portals = [];
    if (role === 'client' || role === 'owner') {
      portals.push({
        label: 'Client',
        portal: 'client',
        items: [
          { label: 'Overview', section: 'c-overview' },
          { label: 'My Pet', section: 'c-pets' },
          { label: 'Account', section: 'c-account' }
        ]
      });
    }
    if (role === 'staff' || role === 'owner') {
      portals.push({
        label: 'Staff',
        portal: 'staff',
        items: [
          { label: 'My Work', section: 's-work' },
          { label: 'Communication', section: 's-comm' }
        ]
      });
    }
    if (role === 'owner') {
      portals.push({
        label: 'Owner',
        portal: 'owner',
        items: [
          { label: 'Overview', section: 'o-overview' }
        ]
      });
    }

    portals.forEach(function(p) {
      var wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';

      var btn = document.createElement('button');
      btn.className = 'hhp-portal-nav-btn';
      btn.innerHTML = p.label + ' <span class="hhp-pn-arrow">\u25BC</span>';

      var dropdown = document.createElement('div');
      dropdown.className = 'hhp-portal-dropdown';

      p.items.forEach(function(item) {
        var a = document.createElement('a');
        a.className = 'hhp-pd-item';
        a.textContent = item.label;
        a.href = '#';
        a.addEventListener('click', function(e) {
          e.preventDefault();
          // Switch to the portal
          if (typeof switchView === 'function') switchView(p.portal);
          // Navigate to section
          setTimeout(function() {
            var sidebarItems = document.querySelectorAll('#pg-' + p.portal + ' .sb-item');
            sidebarItems.forEach(function(si) {
              var onclick = si.getAttribute('onclick') || '';
              var dataTab = si.getAttribute('data-tab') || '';
              if (onclick.indexOf(item.section) !== -1 || dataTab === item.section) {
                si.click();
              }
            });
          }, 200);
          // Close dropdown
          dropdown.classList.remove('hhp-pd-open');
          btn.classList.remove('active');
        });
        dropdown.appendChild(a);
      });

      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = dropdown.classList.contains('hhp-pd-open');
        // Close all other dropdowns first
        document.querySelectorAll('.hhp-portal-dropdown.hhp-pd-open').forEach(function(d) {
          d.classList.remove('hhp-pd-open');
        });
        document.querySelectorAll('.hhp-portal-nav-btn.active').forEach(function(b) {
          b.classList.remove('active');
        });
        if (!isOpen) {
          dropdown.classList.add('hhp-pd-open');
          btn.classList.add('active');
        }
      });

      wrapper.appendChild(btn);
      wrapper.appendChild(dropdown);
      container.appendChild(wrapper);
    });

    // Insert before the view switcher
    var viewSwitcher = navRight.querySelector('#viewSwitcher');
    if (viewSwitcher) {
      navRight.insertBefore(container, viewSwitcher);
    } else {
      navRight.insertBefore(container, navRight.firstChild);
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', function() {
      document.querySelectorAll('.hhp-portal-dropdown.hhp-pd-open').forEach(function(d) {
        d.classList.remove('hhp-pd-open');
      });
      document.querySelectorAll('.hhp-portal-nav-btn.active').forEach(function(b) {
        b.classList.remove('active');
      });
    });

    console.log('\u2705 HHP: Portal nav dropdowns injected (v8)');
  }

  // Refresh portal nav when auth changes
  function refreshPortalNav() {
    var existing = document.getElementById('hhpPortalNav');
    if (existing) existing.remove();
    _portalNavInjected = false;
    injectPortalNav();
  }

  // ─────────────────────────────────────────────
  // 9b. FIX ABOUT PHOTO — force full width with inline styles
  // ─────────────────────────────────────────────
  function fixAboutPhoto() {
    if (window.innerWidth > 767) return;
    var aboutPhotos = document.querySelector('.about-photos');
    if (!aboutPhotos) return;
    aboutPhotos.style.setProperty('width', '100%', 'important');
    aboutPhotos.style.setProperty('max-width', '100%', 'important');
    aboutPhotos.style.setProperty('min-height', '280px', 'important');
    aboutPhotos.style.setProperty('border-radius', '16px', 'important');
    aboutPhotos.style.setProperty('overflow', 'hidden', 'important');
    // Also fix images inside
    aboutPhotos.querySelectorAll('img').forEach(function(img) {
      img.style.setProperty('width', '100%', 'important');
      img.style.setProperty('height', '100%', 'important');
      img.style.setProperty('object-fit', 'cover', 'important');
    });
    // Fix the grid parent too
    var aboutGrid = document.querySelector('.about-grid');
    if (aboutGrid) {
      aboutGrid.style.setProperty('grid-template-columns', '1fr', 'important');
      aboutGrid.style.setProperty('gap', '24px', 'important');
    }
  }

  // ─────────────────────────────────────────────
  // 10. ROLE-BASED VIEW SWITCHER — hide portals based on auth role
  // ─────────────────────────────────────────────
  function fixViewSwitcher() {
    // Both desktop and mobile dropdowns
    var dropdowns = [
      document.getElementById('viewDropdown'),
      document.getElementById('hhpMobileViewDD'),
      document.getElementById('hhpMobileViewDDv8')
    ];

    var role = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentRole) ? HHP_Auth.currentRole : null;
    var isLoggedIn = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentUser) ? true : false;

    dropdowns.forEach(function(dd) {
      if (!dd) return;
      Array.from(dd.options).forEach(function(opt) {
        var val = opt.value;
        if (val === 'public') {
          // Always show Home
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

    // Also hide the entire SWITCH VIEW section in mobile nav if not logged in
    var mobileNav = document.querySelector('.hhp-mobile-nav');
    if (mobileNav) {
      var switchDiv = mobileNav.children[5]; // The DIV with SWITCH VIEW label + dropdown
      if (switchDiv && switchDiv.tagName === 'DIV') {
        switchDiv.style.display = isLoggedIn ? '' : 'none';
      }
    }

    // Hide Sign Out link if not logged in; hide Sign In if logged in
    if (mobileNav) {
      mobileNav.querySelectorAll('a').forEach(function(a) {
        var text = a.textContent.trim();
        if (text === 'Sign Out') {
          a.style.display = isLoggedIn ? '' : 'none';
        }
        if (text === 'Sign In') {
          a.style.display = isLoggedIn ? 'none' : '';
        }
      });
    }
  }

  // ─────────────────────────────────────────────
  // 11. HIDE MEET & GREET — for clients with existing bookings
  // ─────────────────────────────────────────────
  function fixMeetGreetButton() {
    var isLoggedIn = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentUser) ? true : false;
    var role = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentRole) ? HHP_Auth.currentRole : null;

    // Only check for clients
    if (!isLoggedIn || role !== 'client') return;

    var userId = HHP_Auth.currentUser.id;
    if (!userId) return;

    // Check Supabase for existing bookings or meet & greet
    var supabase = HHP_Auth.supabase;
    if (!supabase) return;

    // bookings.client_id references profiles.id, so look up profile first
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
          // Client has at least one booking — hide Meet & Greet buttons
          hideMeetGreetButtons();
        }
      })
      .catch(function() {
        // If query fails, don't hide anything
      });
  }

  function hideMeetGreetButtons() {
    // Hide all "Book Meet & Greet" / "Schedule a Meet & Greet" buttons
    document.querySelectorAll('a, button').forEach(function(el) {
      var text = el.textContent.trim().toLowerCase();
      if (text.includes('meet') && text.includes('greet')) {
        el.style.display = 'none';
      }
    });
    // Also hide the floating book button if it's for meet & greet
    var floatingBtn = document.getElementById('floatingBookBtn');
    if (floatingBtn) {
      var txt = floatingBtn.textContent.trim().toLowerCase();
      if (txt.includes('meet') && txt.includes('greet')) {
        floatingBtn.style.display = 'none';
      }
    }
  }

  // ─────────────────────────────────────────────
  // 16. v8: SIDEBAR WATCHER — observe for sidebar visibility changes
  //     Catches sidebars opened by the ORIGINAL site code (not just our hamburger)
  //     Forces dark text + scrollability every time a sidebar appears
  // ─────────────────────────────────────────────
  function startSidebarWatcher() {
    if (window.innerWidth > 767) return;

    // Force-fix any currently visible sidebar
    function fixVisibleSidebars() {
      document.querySelectorAll('.sidebar').forEach(function(sb) {
        // Check if sidebar is actually visible (has meaningful dimensions)
        var rect = sb.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 100) {
          // This sidebar is visible — force dark text and iOS scroll
          sb.style.setProperty('overflow-y', 'scroll', 'important');
          sb.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
          sb.style.setProperty('overscroll-behavior-y', 'contain', 'important');
          sb.style.setProperty('padding-bottom', '140px', 'important');
          sb.style.setProperty('color', '#1a1008', 'important');
          sb.style.setProperty('-webkit-text-fill-color', '#1a1008', 'important');

          // iOS body freeze if not already done
          if (document.body.style.position !== 'fixed') {
            _savedBodyScroll = window.pageYOffset || document.documentElement.scrollTop;
            document.body.style.setProperty('position', 'fixed', 'important');
            document.body.style.setProperty('top', (-_savedBodyScroll) + 'px', 'important');
            document.body.style.setProperty('left', '0', 'important');
            document.body.style.setProperty('right', '0', 'important');
            document.body.style.setProperty('width', '100%', 'important');
          }

          sb.querySelectorAll('*').forEach(function(el) {
            el.style.setProperty('color', '#1a1008', 'important');
            el.style.setProperty('-webkit-text-fill-color', '#1a1008', 'important');
            el.style.setProperty('opacity', '1', 'important');
            el.style.setProperty('visibility', 'visible', 'important');
          });
        }
      });
    }

    // Run immediately
    fixVisibleSidebars();

    // Use MutationObserver to watch for sidebar changes
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.type === 'attributes' && (m.attributeName === 'class' || m.attributeName === 'style')) {
          var el = m.target;
          if (el.classList && el.classList.contains('sidebar')) {
            setTimeout(fixVisibleSidebars, 50);
          }
        }
        // Also check for added nodes that are sidebars
        if (m.addedNodes) {
          m.addedNodes.forEach(function(node) {
            if (node.classList && node.classList.contains('sidebar')) {
              setTimeout(fixVisibleSidebars, 50);
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style'],
      childList: true,
      subtree: true
    });

    // Also poll every 500ms as a safety net
    setInterval(fixVisibleSidebars, 500);
  }

  // ─────────────────────────────────────────────
  // 15. v8: FIX VIEWPORT — ensure proper meta tag + prevent zoom/bounce
  // ─────────────────────────────────────────────
  function fixViewport() {
    // Ensure viewport meta tag is correct
    var viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

    // Prevent overscroll/bounce on iOS
    document.body.style.setProperty('overscroll-behavior', 'none', 'important');
    document.documentElement.style.setProperty('overscroll-behavior', 'none', 'important');

    // Reset any accidental zoom on page transitions
    if (window.innerWidth <= 767) {
      document.body.style.setProperty('width', '100%', 'important');
      document.body.style.setProperty('min-width', '0', 'important');
      document.documentElement.style.setProperty('width', '100%', 'important');
    }
  }

  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────
  onReady(function() {
    fixViewport();            // v8: fix viewport zoom/bounce FIRST
    injectAllCSS();
    fixGreetings();
    fixFooterEmail();
    fixMobileSidebar();
    startSidebarWatcher();   // v8: watch for sidebar opens + force dark text + scroll
    createMobileNav();       // v8: create hamburger + mobile nav from scratch
    addMobileSignIn();       // v8: add Sign In button on mobile
    fixAboutPhoto();
    fixViewSwitcher();
    fixMeetGreetButton();
    fixReviewArrows();       // v8: fix review arrow navigation
    injectPreviewTool();
    injectPortalNav();       // v8: portal nav dropdowns in desktop nav

    // Re-check for Edit Website panel when tabs change
    document.addEventListener('click', function(e) {
      if (e.target && (e.target.classList.contains('sb-item') || e.target.closest('.sb-item'))) {
        setTimeout(injectPreviewTool, 300);
      }
    });

    // Re-apply mobile sidebar fix on resize
    window.addEventListener('resize', function() {
      if (window.innerWidth <= 767) {
        fixMobileSidebar();
        createMobileNav();
        addMobileSignIn();
        fixAboutPhoto();
      } else {
        // On desktop, make sure nav-right is visible again
        var navRight = document.querySelector('.nav-right');
        if (navRight) navRight.style.removeProperty('display');
        // On desktop, ensure v8 mobile nav is hidden
        var mobileNavV8 = document.querySelector('.hhp-mobile-nav-v8');
        if (mobileNavV8) {
          mobileNavV8.classList.remove('hhp-mnav-open');
          mobileNavV8.style.setProperty('display', 'none', 'important');
        }
        // Hide v8 hamburger on desktop
        var hamV8 = document.querySelector('.hhp-hamburger-v8');
        if (hamV8) hamV8.style.setProperty('display', 'none', 'important');
      }
    });

    // Re-apply view switcher when auth state changes
    if (typeof HHP_Auth !== 'undefined' && HHP_Auth.supabase) {
      HHP_Auth.supabase.auth.onAuthStateChange(function() {
        setTimeout(function() {
          fixViewSwitcher();
          fixMeetGreetButton();
          refreshMobileSignIn();
          refreshPortalNav();
        }, 500);
      });
    }

    console.log('\uD83D\uDC3E HHP UX Patch v8 applied (scratch mobile nav + sign in + review fix + portal dropdowns + preview)');
  });
})();
