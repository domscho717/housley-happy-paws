// ============================================================
// Housley Happy Paws — UX Patch v9 (ux-patch.js)
// Complete replacement with:
// 1. Mobile hamburger menu (public links only)
// 2. Pull-out sidebar drawer (portal pages only)
// 3. Mobile sign-in button
// 4. Desktop portal nav dropdowns
// 5. Review arrow fix
// 6. Viewport fix
// 7. All existing functions preserved
// ============================================================
(function() {
  'use strict';

  var scrollPos = 0;

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
  // FIX GREETINGS — replace garbled emoji with proper icons
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
  // INJECT ALL CSS
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

        /* -- Nav: hide desktop elements -- */
        '.nav { padding: 0 12px !important; height: 56px !important; }' +
        '.nav-logo { font-size: 1.2rem !important; }' +
        '.nav-center { display: none !important; }' +
        '.nav-right { display: none !important; }' +
        '#viewSwitcher { display: none !important; }' +

        /* -- Hamburger button -- */
        '.hhp-hamburger-v9 {' +
          'display: flex !important; order: 99; margin-left: auto;' +
          'background: var(--gold, #c8963e) !important; border: none !important;' +
          'width: 44px !important; height: 44px !important; border-radius: 10px !important;' +
          'align-items: center !important; justify-content: center !important;' +
          'cursor: pointer !important; padding: 0 !important; z-index: 9999 !important;' +
          'font-size: 20px !important; color: white !important; line-height: 1 !important;' +
          '-webkit-tap-highlight-color: transparent !important;' +
          'touch-action: manipulation !important; user-select: none !important;' +
        '}' +

        /* -- Mobile nav overlay -- */
        '.hhp-mobile-nav-v9 {' +
          'display: none !important;' +
        '}' +
        '.hhp-mobile-nav-v9.hhp-mnav-open {' +
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

        /* -- Mobile sign-in button in nav -- */
        '.hhp-mobile-signin-btn {' +
          'display: block !important; order: 98; margin-left: 8px;' +
          'padding: 8px 14px !important; border: 1.5px solid #c8963e !important;' +
          'background: transparent !important; color: #c8963e !important;' +
          'font-weight: 700 !important; font-size: 0.85rem !important;' +
          'border-radius: 8px !important; cursor: pointer !important;' +
          'white-space: nowrap !important; line-height: 1 !important;' +
          'z-index: 9998 !important; -webkit-tap-highlight-color: transparent !important;' +
        '}' +

        /* -- Hero adjustments -- */
        '.hero { grid-template-columns: 1fr !important; }' +
        '.hero h1 { font-size: 2.2rem !important; line-height: 1.2 !important; }' +
        '.hero .hero-sub, .hero p { font-size: 1rem !important; }' +
        '.hero .hero-photo-col { max-width: 100% !important; }' +
        '.hero-photo { max-width: 100% !important; }' +

        /* -- About section -- */
        '.about-grid { grid-template-columns: 1fr !important; }' +
        '.about-photos { min-height: 280px !important; }' +

        /* -- Services grid -- */
        '.services-grid { grid-template-columns: 1fr !important; }' +

        /* -- Calendar -- */
        '.cal-section { padding: 40px 16px !important; }' +

        /* -- Reviews carousel -- */
        '.reviews-track { scroll-snap-type: x mandatory !important; }' +
        '.review-card { scroll-snap-align: start !important; flex-shrink: 0 !important; }' +
        '.rev-nav-btn { padding: 8px 12px !important; }' +

        /* -- Future grid -- */
        '.future-grid { grid-template-columns: 1fr !important; }' +

        /* -- Footer -- */
        'footer { padding: 30px 16px !important; }' +
        'footer a { font-size: 0.9rem !important; }' +

        /* -- Portal cards -- */
        '.portal-card { padding: 16px !important; }' +
        '.sidebar { flex-direction: column !important; gap: 8px !important; }' +
        '.sb-item { padding: 12px 16px !important; font-size: 0.95rem !important; }' +

        /* -- Stats -- */
        '.stat-box { padding: 20px 12px !important; }' +

        /* -- Auth forms -- */
        '.auth-form { padding: 20px !important; }' +
        '.form-group input, .form-group textarea { font-size: 16px !important; }' +

        /* -- Modals -- */
        '.modal-content { max-height: 90vh !important; overflow-y: auto !important; }' +

        /* -- Toast -- */
        '.hhp-toast { bottom: 16px !important; margin: 0 8px !important; }' +

        /* -- Floating book button -- */
        '.floating-book-btn { bottom: 20px !important; right: 16px !important; }' +

        /* -- Portal-specific -- */
        '#pg-owner .owner-banner { padding: 20px 16px !important; }' +
        '#pg-owner .tabs { flex-wrap: wrap !important; }' +
        '#pg-owner .tab { padding: 10px 16px !important; font-size: 0.9rem !important; }' +
        '#pg-owner .appt-card { margin: 12px 0 !important; }' +
        '#pg-owner .availability-grid { grid-template-columns: repeat(2, 1fr) !important; }' +
        '#pg-staff .msg-list { max-height: 400px !important; overflow-y: auto !important; }' +
        '#pg-client .pet-card { margin: 12px 0 !important; }' +
        '#pg-client .invoice-card { margin: 12px 0 !important; }' +

        /* -- Pull-out drawer tab -- */
        '.hhp-drawer-tab {' +
          'display: block !important; position: fixed !important; left: 0 !important;' +
          'top: 50% !important; transform: translateY(-50%) !important;' +
          'width: 24px !important; height: 40px !important; z-index: 9996 !important;' +
          'background: #c8963e !important; border: none !important;' +
          'border-radius: 0 12px 12px 0 !important; cursor: pointer !important;' +
          'font-size: 18px !important; color: white !important; font-weight: 700 !important;' +
          'align-items: center !important; justify-content: center !important;' +
          'padding: 0 !important; line-height: 1 !important;' +
          '-webkit-tap-highlight-color: transparent !important; touch-action: manipulation !important;' +
        '}' +

        /* -- Pull-out drawer panel -- */
        '.hhp-drawer {' +
          'display: none !important; position: fixed !important; left: 0 !important;' +
          'top: 0 !important; width: 75vw !important; height: 100vh !important;' +
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

        /* -- Drawer items -- */
        '.hhp-drawer-item {' +
          'display: block !important; width: 100% !important; padding: 16px 20px !important;' +
          'border-bottom: 1px solid #e0d5c5 !important; color: #1a1008 !important;' +
          'font-weight: 600 !important; font-size: 1.05rem !important;' +
          'text-decoration: none !important; cursor: pointer !important;' +
          'background: transparent !important; border: none !important;' +
          'text-align: left !important;' +
        '}' +
        '.hhp-drawer-item:hover {' +
          'background: rgba(200,150,62,0.08) !important;' +
        '}' +

      '}' +

      /* ===== HIDE OLD ELEMENTS ===== */
      '.hhp-hamburger:not(.hhp-hamburger-v9) { display: none !important; }' +
      '.hhp-mobile-nav:not(.hhp-mobile-nav-v9) { display: none !important; }' +

      /* ===== DESKTOP: hide drawer elements ===== */
      '@media (min-width: 768px) {' +
        '.hhp-drawer-tab { display: none !important; }' +
        '.hhp-drawer { display: none !important; }' +
        '.hhp-drawer-overlay { display: none !important; }' +
      '}' +

      '';

    document.head.appendChild(css);
  }

  // ─────────────────────────────────────────────
  // FIX FOOTER EMAIL
  // ─────────────────────────────────────────────
  function fixFooterEmail() {
    var footer = document.querySelector('footer');
    if (footer) {
      var email = footer.querySelector('a[href^="mailto:"], span:contains("@")');
      if (!email) {
        email = Array.from(footer.querySelectorAll('a, span')).find(function(el) {
          return el.textContent.includes('@') || el.href.includes('mailto:');
        });
      }
      if (email) {
        if (email.tagName === 'A') {
          email.href = 'mailto:housleyhappypaws@gmail.com';
          email.textContent = 'housleyhappypaws@gmail.com';
        } else {
          email.textContent = 'housleyhappypaws@gmail.com';
        }
      }
    }
  }

  // ─────────────────────────────────────────────
  // FIX MOBILE SIDEBAR (if legacy)
  // ─────────────────────────────────────────────
  function fixMobileSidebar() {
    // Placeholder for legacy fixes
  }

  // ─────────────────────────────────────────────
  // CREATE MOBILE NAV (Hamburger + Public Links Overlay)
  // ─────────────────────────────────────────────
  function createMobileNav() {
    var nav = document.getElementById('mainNav');
    if (!nav) return;

    // Remove old hamburgers
    var oldHamburger = nav.querySelector('.hhp-hamburger:not(.hhp-hamburger-v9)');
    if (oldHamburger) oldHamburger.remove();

    // Create hamburger button if not exists
    if (!nav.querySelector('.hhp-hamburger-v9')) {
      var hamburger = document.createElement('button');
      hamburger.className = 'hhp-hamburger-v9';
      hamburger.innerHTML = '≡';
      hamburger.setAttribute('aria-label', 'Menu');
      hamburger.setAttribute('type', 'button');
      nav.appendChild(hamburger);

      // Create mobile nav overlay if not exists
      if (!document.querySelector('.hhp-mobile-nav-v9')) {
        var overlay = document.createElement('div');
        overlay.className = 'hhp-mobile-nav-v9';
        overlay.innerHTML =
          '<a class="hhp-mnav-link" data-scroll="home">Home</a>' +
          '<a class="hhp-mnav-link" data-scroll=".about-section">About Rachel</a>' +
          '<a class="hhp-mnav-link" data-scroll=".services-section">Services & Pricing</a>' +
          '<a class="hhp-mnav-link" data-scroll=".cal-section">Calendar</a>' +
          '<a class="hhp-mnav-link" data-scroll=".reviews-section">Reviews</a>' +
          '<a class="hhp-mnav-link" data-scroll=".future-section">Coming Soon</a>' +
          '<div class="hhp-mnav-divider"></div>' +
          '<div id="hhp-mnav-portal-section" style="display:none;">' +
            '<div class="hhp-mnav-label">Portal</div>' +
            '<select id="hhp-mnav-view-switcher" class="hhp-mnav-link" style="padding:12px 0;font-size:1rem;border:none;background:transparent;color:#1e1409;cursor:pointer;">' +
              '<option value="">-- Switch View --</option>' +
            '</select>' +
            '<div class="hhp-mnav-divider"></div>' +
          '</div>' +
          '<button id="hhp-mnav-book-btn" class="hhp-mnav-link" style="display:none;background:transparent;border:none;padding:14px 0;text-align:left;">Book Meet & Greet</button>' +
          '<button id="hhp-mnav-signin-link" class="hhp-mnav-signin">Sign In</button>';
        document.body.appendChild(overlay);
      }

      // Hamburger click handler
      hamburger.addEventListener('click', function() {
        var mobileNav = document.querySelector('.hhp-mobile-nav-v9');
        mobileNav.classList.toggle('hhp-mnav-open');
      });

      // Mobile nav scroll handlers
      var scrollLinks = document.querySelectorAll('.hhp-mnav-link[data-scroll]');
      scrollLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          var selector = this.getAttribute('data-scroll');
          var target;
          if (selector === 'home') {
            window.scrollTo(0, 0);
          } else {
            target = document.querySelector(selector);
            if (target) target.scrollIntoView({ behavior: 'smooth' });
          }
          var mobileNav = document.querySelector('.hhp-mobile-nav-v9');
          mobileNav.classList.remove('hhp-mnav-open');
        });
      });

      // Mobile nav sign-in handler
      var mobileSignInLink = document.getElementById('hhp-mnav-signin-link');
      if (mobileSignInLink) {
        mobileSignInLink.addEventListener('click', function() {
          if (HHP_Auth && HHP_Auth.isAuthenticated && HHP_Auth.isAuthenticated()) {
            if (HHP_Auth.logout) HHP_Auth.logout();
          } else {
            if (window.showAuthModal) window.showAuthModal();
          }
        });
      }
    }
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
      nav.appendChild(signInBtn);

      signInBtn.addEventListener('click', function() {
        if (HHP_Auth && HHP_Auth.isAuthenticated && HHP_Auth.isAuthenticated()) {
          if (HHP_Auth.logout) HHP_Auth.logout();
        } else {
          if (window.showAuthModal) window.showAuthModal();
        }
      });
    }

    updateMobileSignInBtn();
  }

  function updateMobileSignInBtn() {
    var btn = document.querySelector('.hhp-mobile-signin-btn');
    if (btn && HHP_Auth) {
      if (HHP_Auth.isAuthenticated && HHP_Auth.isAuthenticated()) {
        btn.textContent = 'Sign Out';
      } else {
        btn.textContent = 'Sign In';
      }
    }
  }

  // ─────────────────────────────────────────────
  // CREATE PORTAL DRAWER (Pull-out Sidebar)
  // ─────────────────────────────────────────────
  function createPortalDrawer() {
    // Create drawer elements if not exist
    if (!document.querySelector('.hhp-drawer-tab')) {
      var tab = document.createElement('div');
      tab.className = 'hhp-drawer-tab';
      tab.textContent = '>';
      tab.setAttribute('role', 'button');
      tab.setAttribute('tabindex', '0');
      document.body.appendChild(tab);

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
    var tab = document.querySelector('.hhp-drawer-tab');

    if (drawer.classList.contains('hhp-drawer-open')) {
      closeDrawer();
    } else {
      drawer.classList.add('hhp-drawer-open');
      overlay.classList.add('hhp-drawer-open');
      tab.textContent = '<';
      scrollPos = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = -scrollPos + 'px';
    }
  }

  function closeDrawer() {
    var drawer = document.querySelector('.hhp-drawer');
    var overlay = document.querySelector('.hhp-drawer-overlay');
    var tab = document.querySelector('.hhp-drawer-tab');

    drawer.classList.remove('hhp-drawer-open');
    overlay.classList.remove('hhp-drawer-open');
    tab.textContent = '>';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
    window.scrollTo(0, scrollPos);
  }

  function updateDrawerContent() {
    var drawer = document.querySelector('.hhp-drawer');
    if (!drawer) return;

    // Clear drawer
    drawer.innerHTML = '';

    var isClient = document.getElementById('pg-client') && document.getElementById('pg-client').style.display !== 'none';
    var isStaff = document.getElementById('pg-staff') && document.getElementById('pg-staff').style.display !== 'none';
    var isOwner = document.getElementById('pg-owner') && document.getElementById('pg-owner').style.display !== 'none';

    if (!isClient && !isStaff && !isOwner) {
      // On public page, hide drawer
      var tab = document.querySelector('.hhp-drawer-tab');
      if (tab) tab.style.display = 'none';
      return;
    }

    var tab = document.querySelector('.hhp-drawer-tab');
    if (tab) tab.style.display = 'block';

    var items = [];

    if (isClient) {
      items = [
        { text: 'Overview', selector: 'c-overview' },
        { text: 'My Pet', selector: 'c-pets' },
        { text: 'Account', selector: 'c-account' }
      ];
    } else if (isStaff) {
      items = [
        { text: 'My Work', selector: 's-work' },
        { text: 'Communication', selector: 's-comm' }
      ];
    } else if (isOwner) {
      // Show all .sb-item from sidebar
      var sidebarItems = document.querySelectorAll('#pg-owner .sidebar .sb-item');
      sidebarItems.forEach(function(item) {
        items.push({
          text: item.textContent.trim(),
          element: item
        });
      });
    }

    items.forEach(function(item) {
      var link = document.createElement('button');
      link.className = 'hhp-drawer-item';
      link.textContent = item.text;
      link.type = 'button';

      if (item.element) {
        link.addEventListener('click', function() {
          item.element.click();
          closeDrawer();
        });
      } else {
        link.addEventListener('click', function() {
          var targetItem = document.querySelector('.sb-item[onclick*="' + item.selector + '"]');
          if (targetItem) {
            targetItem.click();
            closeDrawer();
          }
        });
      }

      drawer.appendChild(link);
    });
  }

  // ─────────────────────────────────────────────
  // FIX ABOUT PHOTO
  // ─────────────────────────────────────────────
  function fixAboutPhoto() {
    var aboutPhotos = document.querySelector('.about-photos');
    if (aboutPhotos && window.innerWidth < 768) {
      aboutPhotos.style.width = '100vw';
      aboutPhotos.style.marginLeft = 'calc(-50vw + 50%)';
    }
  }

  // ─────────────────────────────────────────────
  // FIX VIEW SWITCHER
  // ─────────────────────────────────────────────
  function fixViewSwitcher() {
    var switcher = document.getElementById('viewSwitcher');
    if (!switcher) return;

    var isAuth = HHP_Auth && HHP_Auth.isAuthenticated && HHP_Auth.isAuthenticated();
    var role = HHP_Auth && HHP_Auth.currentRole ? HHP_Auth.currentRole : '';

    // Show/hide switcher
    switcher.style.display = isAuth ? 'block' : 'none';

    if (isAuth) {
      var options = ['public', 'client', 'staff', 'owner'];
      var allowedOptions = ['public'];

      if (role === 'client') allowedOptions.push('client');
      if (role === 'staff') allowedOptions.push('staff');
      if (role === 'owner') allowedOptions = ['public', 'client', 'staff', 'owner'];

      switcher.innerHTML = '';
      allowedOptions.forEach(function(opt) {
        var option = document.createElement('option');
        option.value = opt;
        option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
        switcher.appendChild(option);
      });

      switcher.addEventListener('change', function() {
        if (this.value) {
          switchView(this.value);
          this.value = '';
          setTimeout(updateDrawerContent, 300);
        }
      });
    }

    // Update mobile nav portal section
    var mobilePortalSection = document.getElementById('hhp-mnav-portal-section');
    if (mobilePortalSection) {
      mobilePortalSection.style.display = isAuth ? 'block' : 'none';
      if (isAuth) {
        var mobileSelect = document.getElementById('hhp-mnav-view-switcher');
        if (mobileSelect) {
          var role = HHP_Auth && HHP_Auth.currentRole ? HHP_Auth.currentRole : '';
          var options = ['public'];
          if (role === 'client') options.push('client');
          if (role === 'staff') options.push('staff');
          if (role === 'owner') options = ['public', 'client', 'staff', 'owner'];

          mobileSelect.innerHTML = '<option value="">-- Switch View --</option>';
          options.forEach(function(opt) {
            var opt_el = document.createElement('option');
            opt_el.value = opt;
            opt_el.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
            mobileSelect.appendChild(opt_el);
          });

          mobileSelect.addEventListener('change', function() {
            if (this.value) {
              switchView(this.value);
              this.value = '';
              var mobileNav = document.querySelector('.hhp-mobile-nav-v9');
              if (mobileNav) mobileNav.classList.remove('hhp-mnav-open');
              setTimeout(updateDrawerContent, 300);
            }
          });
        }
      }
    }
  }

  // ─────────────────────────────────────────────
  // FIX MEET & GREET BUTTON
  // ─────────────────────────────────────────────
  function fixMeetGreetButton() {
    // This would require Supabase integration
    // For now, placeholder that can be expanded
    var bookBtn = document.querySelector('.btn-ink:contains("Book")') ||
                  Array.from(document.querySelectorAll('.btn-ink')).find(function(b) {
                    return b.textContent.includes('Book') || b.textContent.includes('Meet');
                  });

    if (bookBtn && HHP_Auth && HHP_Auth.currentRole === 'client') {
      // Check for existing bookings (placeholder)
      // If they exist, hide the button
      var hasBooking = false;
      if (hasBooking) {
        hideMeetGreetButtons();
      }
    }
  }

  function hideMeetGreetButtons() {
    document.querySelectorAll('.btn-ink, .btn-outline, .floating-book-btn').forEach(function(btn) {
      if (btn.textContent.includes('Meet') || btn.textContent.includes('Book')) {
        btn.style.display = 'none';
      }
    });
  }

  // ─────────────────────────────────────────────
  // FIX REVIEW ARROWS
  // ─────────────────────────────────────────────
  function fixReviewArrows() {
    var track = document.querySelector('.reviews-track');
    if (!track) return;

    window.scrollReviews = function(direction) {
      var cardWidth = track.querySelector('.review-card').offsetWidth;
      var scrollAmount = cardWidth; // ONE card width, not * 2

      if (direction === 'left') {
        track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
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
  // INJECT PREVIEW TOOL
  // ─────────────────────────────────────────────
  function injectPreviewTool() {
    var editSite = document.getElementById('o-edit-site');
    if (!editSite) return;

    if (document.getElementById('hhp-preview-tool')) return;

    var toolContainer = document.createElement('div');
    toolContainer.id = 'hhp-preview-tool';
    toolContainer.style.cssText = 'position: fixed; top: 60px; right: 10px; z-index: 5000; background: white; border: 1px solid #ccc; border-radius: 8px; padding: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';
    toolContainer.innerHTML =
      '<div style="font-size: 12px; font-weight: bold; margin-bottom: 8px;">Viewport Preview</div>' +
      '<button id="hhp-preview-desktop" style="display: block; width: 100%; padding: 6px; margin: 4px 0; background: #f0f0f0; border: 1px solid #999; border-radius: 4px; cursor: pointer; font-size: 11px;">Desktop (1200px)</button>' +
      '<button id="hhp-preview-tablet" style="display: block; width: 100%; padding: 6px; margin: 4px 0; background: #f0f0f0; border: 1px solid #999; border-radius: 4px; cursor: pointer; font-size: 11px;">Tablet (768px)</button>' +
      '<button id="hhp-preview-phone" style="display: block; width: 100%; padding: 6px; margin: 4px 0; background: #f0f0f0; border: 1px solid #999; border-radius: 4px; cursor: pointer; font-size: 11px;">Phone (375px)</button>';

    editSite.appendChild(toolContainer);

    document.getElementById('hhp-preview-desktop').addEventListener('click', function() {
      if (window.innerWidth !== 1200) window.resizeTo(1200, window.innerHeight);
    });
    document.getElementById('hhp-preview-tablet').addEventListener('click', function() {
      if (window.innerWidth !== 768) window.resizeTo(768, window.innerHeight);
    });
    document.getElementById('hhp-preview-phone').addEventListener('click', function() {
      if (window.innerWidth !== 375) window.resizeTo(375, window.innerHeight);
    });
  }

  // ─────────────────────────────────────────────
  // INJECT PORTAL NAV (Desktop Dropdowns)
  // ─────────────────────────────────────────────
  function injectPortalNav() {
    if (window.innerWidth < 768) return; // Mobile only has drawer

    var navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    var isAuth = HHP_Auth && HHP_Auth.isAuthenticated && HHP_Auth.isAuthenticated();
    var role = HHP_Auth && HHP_Auth.currentRole ? HHP_Auth.currentRole : '';

    if (!isAuth) return;

    if (document.getElementById('hhp-portal-nav')) return;

    var dropdowns = [];

    if (role === 'client') {
      dropdowns = [
        {
          label: 'Client Portal',
          items: [
            { text: 'Overview', selector: 'c-overview' },
            { text: 'My Pet', selector: 'c-pets' },
            { text: 'Account', selector: 'c-account' }
          ]
        }
      ];
    } else if (role === 'staff') {
      dropdowns = [
        {
          label: 'Staff Portal',
          items: [
            { text: 'My Work', selector: 's-work' },
            { text: 'Communication', selector: 's-comm' }
          ]
        }
      ];
    } else if (role === 'owner') {
      dropdowns = [
        {
          label: 'Owner Portal',
          items: [
            { text: 'Overview', selector: 'o-overview' }
          ]
        }
      ];
    }

    dropdowns.forEach(function(dropdown) {
      var btn = document.createElement('button');
      btn.textContent = dropdown.label + ' ▼';
      btn.style.cssText = 'background: transparent; border: none; color: #c8963e; font-weight: 600; cursor: pointer; position: relative; padding: 8px 12px;';
      btn.className = 'hhp-portal-dropdown-btn';

      var menu = document.createElement('div');
      menu.style.cssText = 'display: none; position: absolute; top: 100%; left: 0; background: white; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000; min-width: 150px;';

      dropdown.items.forEach(function(item) {
        var link = document.createElement('a');
        link.textContent = item.text;
        link.href = '#';
        link.style.cssText = 'display: block; padding: 10px 16px; color: #1e1409; text-decoration: none; border-bottom: 1px solid #eee; cursor: pointer;';
        link.addEventListener('mouseenter', function() {
          this.style.background = '#f5f5f5';
        });
        link.addEventListener('mouseleave', function() {
          this.style.background = 'transparent';
        });
        link.addEventListener('click', function(e) {
          e.preventDefault();
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

      navRight.appendChild(btn);
    });
  }

  // ─────────────────────────────────────────────
  // HANDLE RESIZE
  // ─────────────────────────────────────────────
  function handleResize() {
    updateDrawerContent();
    if (window.innerWidth >= 768) {
      // Close mobile nav on desktop
      var mobileNav = document.querySelector('.hhp-mobile-nav-v9');
      if (mobileNav) mobileNav.classList.remove('hhp-mnav-open');
    }
  }

  // ─────────────────────────────────────────────
  // HANDLE AUTH STATE CHANGE
  // ─────────────────────────────────────────────
  function handleAuthChange() {
    fixViewSwitcher();
    fixMeetGreetButton();
    updateMobileSignInBtn();
    updateDrawerContent();
    if (window.innerWidth >= 768) {
      injectPortalNav();
    }
  }

  // ─────────────────────────────────────────────
  // MAIN INIT
  // ─────────────────────────────────────────────
  onReady(function() {
    fixViewport();
    injectAllCSS();
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

    // Event listeners
    window.addEventListener('resize', handleResize);
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('sb-item')) {
        updateDrawerContent();
        if (window.innerWidth >= 768) {
          injectPreviewTool();
        }
      }
    });

    // Auth listener
    if (typeof HHP_Auth !== 'undefined' && HHP_Auth.supabase && HHP_Auth.supabase.auth) {
      HHP_Auth.supabase.auth.onAuthStateChange(function() {
        handleAuthChange();
      });
    }
  });
})();
