// ============================================================
// Housley Happy Paws — UX Patch v5 (ux-patch.js)
// 1. Fix greeting emojis (garbled from encoding) + add decorative icons
// 2. Hero: shrink slideshow, enlarge text & Meet button
// 3. About Rachel: enlarge slideshow
// 4. Footer: set email to housleyhappypaws@gmail.com
// 5. Hero: restyle Meet Rachel as light RECTANGLE under slideshow
// 6. Fix mobile: comprehensive CSS + JS sidebar/hamburger
// 7. Add viewport preview tool to Edit Website page
// 8. v5: Fix nav-right hiding, add missing mobile breakpoints
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

      /* ===== PHONE (max 767px) — COMPREHENSIVE ===== */
      '@media (max-width: 767px) {' +

        /* -- Nav: hide desktop elements, show hamburger -- */
        '.nav { padding: 0 12px !important; height: 56px !important; }' +
        '.nav-logo { font-size: 1.2rem !important; }' +
        '.nav-center { display: none !important; }' +
        '.nav-right { display: none !important; }' +
        '#viewSwitcher { display: none !important; }' +
        '.hhp-hamburger { display: flex !important; order: 99; margin-left: auto; }' +

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
        '.about-photos { min-height: 240px !important; max-width: 100% !important; }' +
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

        /* -- Reviews -- */
        '.reviews-section { padding: 48px 16px !important; }' +
        '.reviews-track { grid-template-columns: repeat(5, calc(88vw - 10px)) !important; gap: 12px !important; }' +
        '.review-card { padding: 20px !important; }' +

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
          'width: 100vw !important; min-width: 100vw !important; height: 100vh !important;' +
          'max-width: 100vw !important; z-index: 9999 !important;' +
          'background: #fefcf8 !important; flex-direction: column !important;' +
          'overflow-y: auto !important; padding: 20px !important; padding-top: 70px !important;' +
          'pointer-events: auto !important;' +
        '}' +
        '.sidebar.hhp-sidebar-open .sb-item {' +
          'display: flex !important; padding: 16px 20px !important; font-size: 1.05rem !important;' +
          'border-bottom: 1px solid #e0d5c5 !important; margin: 0 !important;' +
          'border-radius: 0 !important; width: 100% !important; cursor: pointer !important;' +
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
        '.hhp-portal-hamburger { display: none !important; }' +
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

    // Also force-hide nav-right on mobile (fixes ux-upgrades.js wrong class bug)
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

  function openSidebarEl(sidebar) {
    sidebar.classList.add('hhp-sidebar-open');
    sidebar.style.setProperty('display', 'flex', 'important');
    sidebar.style.setProperty('visibility', 'visible', 'important');
    sidebar.style.setProperty('position', 'fixed', 'important');
    sidebar.style.setProperty('top', '0', 'important');
    sidebar.style.setProperty('left', '0', 'important');
    sidebar.style.setProperty('width', '100vw', 'important');
    sidebar.style.setProperty('min-width', '100vw', 'important');
    sidebar.style.setProperty('height', '100vh', 'important');
    sidebar.style.setProperty('z-index', '9999', 'important');
    sidebar.style.setProperty('background', '#fefcf8', 'important');
    sidebar.style.setProperty('flex-direction', 'column', 'important');
    sidebar.style.setProperty('overflow-y', 'auto', 'important');
    sidebar.style.setProperty('overflow-x', 'hidden', 'important');
    sidebar.style.setProperty('padding', '20px', 'important');
    sidebar.style.setProperty('padding-top', '70px', 'important');
    sidebar.style.setProperty('pointer-events', 'auto', 'important');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebarEl(sidebar) {
    sidebar.classList.remove('hhp-sidebar-open');
    sidebar.style.setProperty('display', 'none', 'important');
    sidebar.style.setProperty('visibility', 'hidden', 'important');
    sidebar.style.setProperty('width', '0', 'important');
    sidebar.style.setProperty('height', '0', 'important');
    sidebar.style.setProperty('overflow', 'hidden', 'important');
    sidebar.style.setProperty('position', 'absolute', 'important');
    sidebar.style.setProperty('pointer-events', 'none', 'important');
    document.body.style.overflow = '';
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
  // INIT
  // ─────────────────────────────────────────────
  onReady(function() {
    injectAllCSS();
    fixGreetings();
    fixFooterEmail();
    fixMobileSidebar();
    injectPreviewTool();

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
      } else {
        // On desktop, make sure nav-right is visible again
        var navRight = document.querySelector('.nav-right');
        if (navRight) navRight.style.removeProperty('display');
      }
    });

    console.log('\uD83D\uDC1E HHP UX Patch v5 applied (comprehensive mobile + greetings + hero + footer + preview)');
  });
})();
