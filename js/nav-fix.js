/* =====================================================
   NAV-FIX.JS — Housley Happy Paws Navigation & Service Fix
   Loads AFTER booking-system.js to override broken CSS
   ===================================================== */
(function() {
  'use strict';

  function applyFixes() {
    /* ── 1. REMOVE DUPLICATE STYLE TAGS ── */
    var styles = document.querySelectorAll('style');
    var seen = {};
    var removed = 0;
    styles.forEach(function(s) {
      var key = s.textContent.trim().substring(0, 200);
      if (seen[key]) {
        s.remove();
        removed++;
      } else {
        seen[key] = true;
      }
    });

    /* ── 1b. STRIP INLINE HIDING STYLES FROM NAV ELEMENTS ── */
    var navRight = document.querySelector('.nav-right');
    var navCenter = document.querySelector('.nav-center');
    var viewSwitcher = document.getElementById('viewSwitcher');
    var viewDropdown = document.getElementById('viewDropdown');
    if (navRight) { navRight.removeAttribute('style'); }
    if (navCenter) { navCenter.removeAttribute('style'); }
    if (viewSwitcher) { viewSwitcher.removeAttribute('style'); }
    if (viewDropdown) { viewDropdown.removeAttribute('style'); }
    // Also strip inline styles from all children of nav-right
    if (navRight) {
      var kids = navRight.querySelectorAll('*');
      kids.forEach(function(el) { el.removeAttribute('style'); });
    }

    /* ── 2. INJECT CORRECT NAV CSS ── */
    var old = document.getElementById('hhp-nav-fix-css');
    if (old) old.remove();

    var fixCSS = document.createElement('style');
    fixCSS.id = 'hhp-nav-fix-css';
    fixCSS.textContent = [
      '/* === DESKTOP (>900px) === */',
      '@media (min-width: 901px) {',
      '  #mainNav .nav-center { display: flex !important; visibility: visible !important; }',
      '  #mainNav .nav-right { display: flex !important; visibility: visible !important; align-items: center; gap: 10px; }',
      '  #mainNav #viewSwitcher { display: inline-block !important; visibility: visible !important; }',
      '  #mainNav #viewDropdown { display: inline-block !important; visibility: visible !important; }',
      '  #mainNav .hhp-hamburger-v10 { display: none !important; }',
      '  #mainNav .hhp-mobile-signin-btn { display: none !important; }',
      '}',
      '',
      '/* === MOBILE (<=900px) === */',
      '@media (max-width: 900px) {',
      '  #mainNav .nav-center { display: none !important; }',
      '  #mainNav .nav-right { display: none !important; }',
      '  #mainNav .hhp-hamburger-v10 { display: block !important; font-size: 28px; background: none; border: none; color: #bfa260; cursor: pointer; padding: 8px; position: absolute; right: 16px; top: 50%; transform: translateY(-50%); z-index: 1001; }',
      '  #mainNav .hhp-mobile-signin-btn { display: none !important; }',
      '  #mainNav { position: relative; }',
      '',
      '  /* Mobile menu overlay when open */',
      '  #mainNav.mobile-open .nav-center { display: flex !important; flex-direction: column; position: fixed; top: 0; left: 0; width: 100%; height: 100vh; background: rgba(26,26,26,0.98); z-index: 2000; justify-content: center; align-items: center; padding: 0; margin: 0; list-style: none; gap: 0; }',
      '  #mainNav.mobile-open .nav-center li { width: 100%; text-align: center; }',
      '  #mainNav.mobile-open .nav-center li a { display: block; padding: 18px 20px; color: #fff; font-size: 20px; text-decoration: none; border-bottom: 1px solid rgba(191,162,96,0.2); }',
      '  #mainNav.mobile-open .nav-center li a:hover { background: rgba(191,162,96,0.15); color: #bfa260; }',
      '',
      '  /* Also show nav-right items in mobile menu */',
      '  #mainNav.mobile-open .nav-right { display: flex !important; flex-direction: column; position: fixed; bottom: 0; left: 0; width: 100%; background: rgba(26,26,26,0.98); z-index: 2001; align-items: center; padding: 16px; gap: 10px; border-top: 1px solid rgba(191,162,96,0.3); }',
      '',
      '  /* Close button in mobile menu */',
      '  #mainNav.mobile-open .hhp-hamburger-v10 { position: fixed; top: 16px; right: 16px; z-index: 2002; font-size: 32px; }',
      '}',
    ].join('\n');
    document.head.appendChild(fixCSS);

    /* ── 3. HAMBURGER TOGGLE ── */
    var hamburger = document.querySelector('.hhp-hamburger-v10');
    var mainNav = document.querySelector('#mainNav');
    if (hamburger && mainNav) {
      var newHamburger = hamburger.cloneNode(true);
      hamburger.parentNode.replaceChild(newHamburger, hamburger);

      newHamburger.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var isOpen = mainNav.classList.contains('mobile-open');
        if (isOpen) {
          mainNav.classList.remove('mobile-open');
          newHamburger.innerHTML = '&#9776;';
        } else {
          mainNav.classList.add('mobile-open');
          newHamburger.innerHTML = '&#10005;';
        }
      });
      newHamburger.innerHTML = '&#9776;';
      newHamburger.setAttribute('aria-label', 'Menu');
    }

    // Close mobile menu when clicking a link
    var navLinks = document.querySelectorAll('.nav-center a');
    navLinks.forEach(function(link) {
      link.addEventListener('click', function() {
        if (mainNav) {
          mainNav.classList.remove('mobile-open');
          var hb = document.querySelector('.hhp-hamburger-v10');
          if (hb) hb.innerHTML = '&#9776;';
        }
      });
    });

    /* ── 4. MOVE MEET & GREET TO TOP OF SERVICES ── */
    var grid = document.querySelector('.services-grid');
    if (grid) {
      var cards = grid.children;
      var meetGreetCard = null;
      for (var i = 0; i < cards.length; i++) {
        var text = cards[i].textContent || '';
        if (text.indexOf('Meet') !== -1 && text.indexOf('Greet') !== -1) {
          meetGreetCard = cards[i];
          break;
        }
      }
      if (meetGreetCard && meetGreetCard !== cards[0]) {
        grid.insertBefore(meetGreetCard, cards[0]);
      }
    }

    /* ── 5. CHANGE "Book" TO "Request" ON SERVICE BUTTONS ── */
    var serviceButtons = document.querySelectorAll('.services-grid .service-card button, .services-grid .service-card a');
    serviceButtons.forEach(function(btn) {
      var txt = btn.textContent || '';
      if (txt.indexOf('Book') !== -1) {
        btn.textContent = txt.replace(/Book/g, 'Request');
      }
    });

    /* ── 6. WIRE UP SERVICE BUTTONS TO BOOKING MODAL ── */
    if (typeof window.openBookingModal === 'function') {
      serviceButtons.forEach(function(btn) {
        var card = btn.closest('.service-card');
        if (!card) return;
        var cardText = card.textContent || '';
        var serviceName = '';
        if (cardText.indexOf('Meet') !== -1 && cardText.indexOf('Greet') !== -1) serviceName = 'Meet & Greet';
        else if (cardText.indexOf('Dog Walking') !== -1) serviceName = 'Dog Walking';
        else if (cardText.indexOf('Drop-In') !== -1) serviceName = 'Drop-In Visit';
        else if (cardText.indexOf('Cat Care') !== -1) serviceName = 'Cat Care Visit';
        else if (cardText.indexOf('House Sitting') !== -1) serviceName = 'House Sitting';
        else if (cardText.indexOf('Dog Boarding') !== -1) serviceName = 'Dog Boarding';
        else if (cardText.indexOf('Doggy Day Care') !== -1) serviceName = 'Doggy Day Care';
        else if (cardText.indexOf('Paw Bus') !== -1) serviceName = 'The Paw Bus';

        if (serviceName) {
          var newBtn = btn.cloneNode(true);
          btn.parentNode.replaceChild(newBtn, btn);
          newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            window.openBookingModal(serviceName);
          });
        }
      });
    }

    /* ── 7. BLOCK FUTURE INLINE STYLE HIDING VIA MUTATIONOBSERVER ── */
    var navEl = document.querySelector('#mainNav');
    if (navEl && window.MutationObserver) {
      var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
          if (m.type === 'attributes' && m.attributeName === 'style') {
            var el = m.target;
            if (el.classList.contains('nav-right') || el.classList.contains('nav-center') || el.id === 'viewSwitcher' || el.id === 'viewDropdown') {
              var s = el.getAttribute('style') || '';
              if (s.indexOf('none') !== -1 || s.indexOf('hidden') !== -1) {
                el.removeAttribute('style');
              }
            }
          }
        });
      });
      observer.observe(navEl, { attributes: true, subtree: true, attributeFilter: ['style'] });
    }
  }

  /* Run after DOM is ready and a small delay to ensure booking-system.js has finished */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(applyFixes, 500);
    });
  } else {
    setTimeout(applyFixes, 500);
  }

  /* Also re-run after full page load in case scripts load late */
  window.addEventListener('load', function() {
    setTimeout(applyFixes, 1000);
  });

  /* Extra delayed run to catch late-running scripts */
  window.addEventListener('load', function() {
    setTimeout(applyFixes, 3000);
  });
})();
