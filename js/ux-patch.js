// ============================================================
// Housley Happy Paws â UX Patch v3 (ux-patch.js)
// 1. Fix greeting emojis (garbled from encoding) + add decorative icons
// 2. Hero: shrink slideshow, enlarge text & Meet button
// 3. About Rachel: enlarge slideshow
// 4. Footer: set email to housleyhappypaws@gmail.com
// 5. Hero: restyle Meet Rachel as light RECTANGLE under slideshow
// 6. Fix mobile: force-hide portal sidebar, show hamburger
// 7. Add viewport preview tool to Edit Website page
// ============================================================
(function() {
  'use strict';

  function onReady(fn) {
    if (document.readyState !== 'loading') setTimeout(fn, 800);
    else document.addEventListener('DOMContentLoaded', function() { setTimeout(fn, 800); });
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // 1. FIX GREETINGS â replace garbled emoji with proper icons
  // âââââââââââââââââââââââââââââââââââââââââââââââ
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

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // 2 & 5. HERO + Meet Rachel rectangle + 6. Mobile sidebar fix
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  function fixHero() {
    var css = document.createElement('style');
    css.id = 'hhp-ux-patch-css';
    css.textContent =
      /* Hero grid: give text more space, shrink photo */
      '.hero { grid-template-columns: 1.2fr 0.8fr !important; }' +

      /* Hero photo column: constrain */
      '.hero .hero-photo-col { max-width: 500px !important; justify-self: center !important; }' +

      /* Hero heading: bigger on desktop */
      '.hero h1 { font-size: 4.5rem !important; line-height: 1.05 !important; }' +

      /* Hero subtitle / description: slightly larger */
      '.hero .hero-sub, .hero p:not(.trust-row):not(.section-eyebrow) { font-size: 1.15rem !important; line-height: 1.6 !important; }' +

      /* Meet & Greet button: bigger to match page style */
      '.hero .btn-ink { padding: 18px 42px !important; font-size: 1.1rem !important; border-radius: 14px !important; }' +
      '.hero .btn-outline { padding: 16px 36px !important; font-size: 1.05rem !important; border-radius: 14px !important; }' +

      /* ===== Meet Rachel CTA â WIDE RECTANGLE (not square) ===== */
      '.hero .hero-photo-sm-cta {' +
        'width: auto !important;' +
        'min-width: 180px !important;' +
        'height: auto !important;' +
        'max-height: 48px !important;' +
        'background: #faf6f1 !important;' +
        'border: 1.5px solid rgba(30, 20, 9, 0.12) !important;' +
        'border-radius: 14px !important;' +
        'padding: 12px 32px !important;' +
        'flex-direction: row !important;' +
        'align-items: center !important;' +
        'justify-content: center !important;' +
        'gap: 8px !important;' +
        'box-shadow: 0 1px 4px rgba(30,20,9,0.06) !important;' +
        'cursor: pointer !important;' +
        'aspect-ratio: auto !important;' +
      '}' +
      '.hero .hero-photo-sm-cta .paw-icon,' +
      '.hero .hero-photo-sm-cta svg,' +
      '.hero .hero-photo-sm-cta img {' +
        'width: 18px !important;' +
        'height: 18px !important;' +
        'flex-shrink: 0 !important;' +
      '}' +
      '.hero .hero-photo-sm-cta div,' +
      '.hero .hero-photo-sm-cta span {' +
        'font-size: 0.85rem !important;' +
        'font-weight: 600 !important;' +
        'color: #1e1409 !important;' +
        'white-space: nowrap !important;' +
        'line-height: 1 !important;' +
      '}' +
      /* Reposition the row: center under slideshow */
      '.hero .hero-photo-row {' +
        'justify-content: center !important;' +
        'margin-top: 10px !important;' +
      '}' +

      /* About Rachel slideshow: bigger */
      '.about-grid { grid-template-columns: 1fr 1fr !important; }' +
      '.about-photos { min-height: 440px !important; border-radius: 18px !important; }' +
      '.about-photos img { object-fit: cover !important; width: 100% !important; height: 100% !important; }' +

      /* ===================================================== */
      /* 6. MOBILE FIX â force-hide portal sidebar on phones   */
      /* Uses ultra-specific selectors to override base CSS    */
      /* ===================================================== */
      '@media (max-width: 767px) {' +
        /* Hide ALL portal sidebars on mobile */
        '#pg-owner .sidebar,' +
        '#pg-client .sidebar,' +
        '#pg-staff .sidebar,' +
        '.portal-wrap > .sidebar,' +
        'div.sidebar {' +
          'display: none !important;' +
          'visibility: hidden !important;' +
          'width: 0 !important;' +
          'height: 0 !important;' +
          'overflow: hidden !important;' +
          'position: absolute !important;' +
          'left: -9999px !important;' +
        '}' +

        /* When sidebar IS opened via hamburger, show as overlay */
        '#pg-owner .sidebar.hhp-sidebar-open,' +
        '#pg-client .sidebar.hhp-sidebar-open,' +
        '#pg-staff .sidebar.hhp-sidebar-open,' +
        '.portal-wrap > .sidebar.hhp-sidebar-open,' +
        'div.sidebar.hhp-sidebar-open {' +
          'display: flex !important;' +
          'visibility: visible !important;' +
          'position: fixed !important;' +
          'top: 0 !important;' +
          'left: 0 !important;' +
          'width: 100vw !important;' +
          'height: 100vh !important;' +
          'max-width: 100vw !important;' +
          'z-index: 9999 !important;' +
          'background: #fefcf8 !important;' +
          'flex-direction: column !important;' +
          'overflow-y: auto !important;' +
          'padding: 20px !important;' +
          'padding-top: 60px !important;' +
        '}' +

        /* Show portal hamburger button on mobile */
        '.hhp-portal-hamburger {' +
          'display: flex !important;' +
          'position: fixed !important;' +
          'bottom: 24px !important;' +
          'right: 24px !important;' +
          'z-index: 9990 !important;' +
          'width: 56px !important;' +
          'height: 56px !important;' +
          'border-radius: 50% !important;' +
          'align-items: center !important;' +
          'justify-content: center !important;' +
          'font-size: 24px !important;' +
          'box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;' +
        '}' +

        /* Portal main takes full width */
        '.portal-wrap { display: block !important; }' +
        '.portal-wrap > .portal-main,' +
        '.portal-main {' +
          'width: 100% !important;' +
          'max-width: 100% !important;' +
          'padding: 12px !important;' +
        '}' +

        /* Hero responsive */
        '.hero { grid-template-columns: 1fr !important; }' +
        '.hero h1 { font-size: 2.2rem !important; }' +
        '.hero .hero-photo-col { max-width: 100% !important; }' +
        '.hero .btn-ink { padding: 16px 32px !important; font-size: 1rem !important; }' +

        /* Meet Rachel on mobile: still rectangle */
        '.hero .hero-photo-sm-cta {' +
          'min-width: 140px !important;' +
          'padding: 10px 28px !important;' +
        '}' +

        /* About section */
        '.about-grid { grid-template-columns: 1fr !important; }' +
        '.about-photos { min-height: 280px !important; }' +
      '}' +

      /* Tablet overrides */
      '@media (min-width: 768px) and (max-width: 1024px) {' +
        '.hero { grid-template-columns: 1fr 1fr !important; }' +
        '.hero h1 { font-size: 3rem !important; }' +
        '.about-photos { min-height: 360px !important; }' +

        /* Sidebar compact horizontal on tablet */
        '#pg-owner .sidebar,' +
        '#pg-client .sidebar,' +
        '#pg-staff .sidebar {' +
          'flex-direction: row !important;' +
          'flex-wrap: wrap !important;' +
          'gap: 4px !important;' +
          'padding: 10px 12px !important;' +
        '}' +
      '}' +

      /* ===================================================== */
      /* 7. VIEWPORT PREVIEW TOOL â Edit Website page          */
      /* ===================================================== */
      '.hhp-preview-bar {' +
        'display: flex; gap: 8px; margin-bottom: 16px; padding: 12px 16px;' +
        'background: #f5f0ea; border-radius: 12px; align-items: center; flex-wrap: wrap;' +
      '}' +
      '.hhp-preview-bar .preview-label {' +
        'font-weight: 700; font-size: 0.9rem; color: #1e1409; margin-right: 8px;' +
      '}' +
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
      '.hhp-preview-frame-wrap iframe {' +
        'width: 100%; border: none; display: block;' +
      '}';

    document.head.appendChild(css);
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // 4. FOOTER â set email to housleyhappypaws@gmail.com
  // âââââââââââââââââââââââââââââââââââââââââââââââ
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

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // 7. VIEWPORT PREVIEW â inject into Edit Website page
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  function injectPreviewTool() {
    // Only inject on the Edit Website panel inside the owner portal
    var editPanel = document.getElementById('o-edit-site');
    if (!editPanel) return;
    if (editPanel.querySelector('.hhp-preview-bar')) return; // already added

    // Create the preview bar
    var bar = document.createElement('div');
    bar.className = 'hhp-preview-bar';
    bar.innerHTML =
      '<span class="preview-label">Preview Site:</span>' +
      '<button class="hhp-preview-btn active" data-width="100%" data-height="600">Desktop</button>' +
      '<button class="hhp-preview-btn" data-width="768px" data-height="600">Tablet</button>' +
      '<button class="hhp-preview-btn" data-width="375px" data-height="667">Phone</button>';

    // Create iframe container
    var wrap = document.createElement('div');
    wrap.className = 'hhp-preview-frame-wrap';
    wrap.style.width = '100%';
    wrap.style.height = '600px';

    var iframe = document.createElement('iframe');
    iframe.src = window.location.origin + '/?preview=1';
    iframe.style.height = '100%';
    iframe.title = 'Site Preview';
    wrap.appendChild(iframe);

    // Insert at top of edit panel
    var firstChild = editPanel.firstChild;
    editPanel.insertBefore(wrap, firstChild);
    editPanel.insertBefore(bar, wrap);

    // Button handlers
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

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // INIT
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  onReady(function() {
    fixHero();
    fixGreetings();
    fixFooterEmail();
    injectPreviewTool();

    // Re-check for Edit Website panel when tabs change
    document.addEventListener('click', function(e) {
      if (e.target && (e.target.classList.contains('sb-item') || e.target.closest('.sb-item'))) {
        setTimeout(injectPreviewTool, 300);
      }
    });

    console.log('\u{1F41E} HHP UX Patch v3 applied (greetings + hero + about + footer + meet rachel rect + mobile sidebar fix + preview tool)');
  });

})();
