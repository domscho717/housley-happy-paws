/* NAV-FIX.JS - Housley Happy Paws Navigation & Service Fix */
(function() {
  'use strict';

  function applyFixes() {
    /* 1. REMOVE DUPLICATE STYLE TAGS */
    var styles = document.querySelectorAll('style');
    var seen = {};
    styles.forEach(function(s) {
      var key = s.textContent.trim().substring(0, 200);
      if (seen[key]) { s.remove(); } else { seen[key] = true; }
    });

    /* 2. INJECT CORRECT NAV CSS */
    var old = document.getElementById('hhp-nav-fix-css');
    if (old) old.remove();
    var fixCSS = document.createElement('style');
    fixCSS.id = 'hhp-nav-fix-css';
    fixCSS.textContent = '@media (min-width: 901px) { #mainNav .nav-center { display: flex !important; } #mainNav .nav-right { display: flex !important; align-items: center; gap: 10px; } #mainNav .hhp-hamburger-v10 { display: none !important; } #mainNav .hhp-mobile-signin-btn { display: none !important; } } @media (max-width: 900px) { #mainNav .nav-center { display: none !important; } #mainNav .nav-right { display: none !important; } #mainNav .hhp-hamburger-v10 { display: block !important; font-size: 28px; background: none; border: none; color: #bfa260; cursor: pointer; padding: 8px; position: absolute; right: 16px; top: 50pct; transform: translateY(-50pct); z-index: 1001; } #mainNav .hhp-mobile-signin-btn { display: none !important; } #mainNav { position: relative; } #mainNav.mobile-open .nav-center { display: flex !important; flex-direction: column; position: fixed; top: 0; left: 0; width: 100pct; height: 100vh; background: rgba(26,26,26,0.98); z-index: 2000; justify-content: center; align-items: center; padding: 0; margin: 0; list-style: none; gap: 0; } #mainNav.mobile-open .nav-center li { width: 100pct; text-align: center; } #mainNav.mobile-open .nav-center li a { display: block; padding: 18px 20px; color: #fff; font-size: 20px; text-decoration: none; border-bottom: 1px solid rgba(191,162,96,0.2); } #mainNav.mobile-open .nav-center li a:hover { background: rgba(191,162,96,0.15); color: #bfa260; } #mainNav.mobile-open .nav-right { display: flex !important; flex-direction: column; position: fixed; bottom: 0; left: 0; width: 100pct; background: rgba(26,26,26,0.98); z-index: 2001; align-items: center; padding: 16px; gap: 10px; border-top: 1px solid rgba(191,162,96,0.3); } #mainNav.mobile-open .hhp-hamburger-v10 { position: fixed; top: 16px; right: 16px; z-index: 2002; font-size: 32px; } }'.replace(/pct/g, '%');
    document.head.appendChild(fixCSS);

    /* 3. HAMBURGER TOGGLE */
    var hamburger = document.querySelector('.hhp-hamburger-v10');
    var mainNav = document.querySelector('#mainNav');
    if (hamburger && mainNav) {
      var nh = hamburger.cloneNode(true);
      hamburger.parentNode.replaceChild(nh, hamburger);
      nh.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        if (mainNav.classList.contains('mobile-open')) {
          mainNav.classList.remove('mobile-open'); nh.innerHTML = '\u2630';
        } else {
          mainNav.classList.add('mobile-open'); nh.innerHTML = '\u2715';
        }
      });
      nh.innerHTML = '\u2630';
      nh.setAttribute('aria-label', 'Menu');
    }
    document.querySelectorAll('.nav-center a').forEach(function(link) {
      link.addEventListener('click', function() {
        if (mainNav) { mainNav.classList.remove('mobile-open'); var hb = document.querySelector('.hhp-hamburger-v10'); if (hb) hb.innerHTML = '\u2630'; }
      });
    });

    /* 4. MOVE MEET AND GREET TO TOP */
    var grid = document.querySelector('.services-grid');
    if (grid) {
      var cards = grid.children;
      for (var i = 0; i < cards.length; i++) {
        if ((cards[i].textContent || '').indexOf('Meet') !== -1 && (cards[i].textContent || '').indexOf('Greet') !== -1) {
          if (i !== 0) grid.insertBefore(cards[i], cards[0]);
          break;
        }
      }
    }

    /* 5. CHANGE Book TO Request */
    document.querySelectorAll('.services-grid .service-card button, .services-grid .service-card a').forEach(function(btn) {
      if ((btn.textContent || '').indexOf('Book') !== -1) {
        btn.textContent = btn.textContent.replace(/Book/g, 'Request');
      }
    });

    /* 6. WIRE BUTTONS TO BOOKING MODAL */
    if (typeof window.openBookingModal === 'function') {
      document.querySelectorAll('.services-grid .service-card button, .services-grid .service-card a').forEach(function(btn) {
        var card = btn.closest('.service-card');
        if (!card) return;
        var t = card.textContent || '';
        var svc = '';
        if (t.indexOf('Meet') !== -1 && t.indexOf('Greet') !== -1) svc = 'Meet & Greet';
        else if (t.indexOf('Dog Walking') !== -1) svc = 'Dog Walking';
        else if (t.indexOf('Drop-In') !== -1) svc = 'Drop-In Visit';
        else if (t.indexOf('Cat Care') !== -1) svc = 'Cat Care Visit';
        else if (t.indexOf('House Sitting') !== -1) svc = 'House Sitting';
        else if (t.indexOf('Dog Boarding') !== -1) svc = 'Dog Boarding';
        else if (t.indexOf('Doggy Day Care') !== -1) svc = 'Doggy Day Care';
        else if (t.indexOf('Paw Bus') !== -1) svc = 'The Paw Bus';
        if (svc) {
          var nb = btn.cloneNode(true);
          btn.parentNode.replaceChild(nb, btn);
          nb.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); window.openBookingModal(svc); });
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(applyFixes, 500); });
  } else {
    setTimeout(applyFixes, 500);
  }
  window.addEventListener('load', function() { setTimeout(applyFixes, 1000); });
})();
