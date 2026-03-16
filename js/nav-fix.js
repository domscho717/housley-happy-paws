/* =====================================================
   NAV-FIX.JS v3 -- Housley Happy Paws Navigation Fix
   Single clean version. Loads AFTER booking-system.js.
   ===================================================== */
(function() {
  'use strict';

  function applyFixes() {
    /* -- 1. REMOVE DUPLICATE STYLE TAGS -- */
    var styles = document.querySelectorAll('style');
    var seen = {};
    styles.forEach(function(s) {
      var key = s.textContent.trim().substring(0, 200);
      if (seen[key]) { s.remove(); } else { seen[key] = true; }
    });

    /* -- 2. STRIP ALL INLINE HIDING -- */
    ['.nav-right', '.nav-center'].forEach(function(sel) {
      var el = document.querySelector(sel);
      if (el) el.removeAttribute('style');
    });
    ['viewSwitcher', 'viewDropdown'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.removeAttribute('style');
    });
    var navRight = document.querySelector('.nav-right');
    if (navRight) {
      navRight.querySelectorAll('*').forEach(function(el) {
        var s = el.getAttribute('style') || '';
        if (s.indexOf('none') !== -1 || s.indexOf('hidden') !== -1) {
          el.removeAttribute('style');
        }
      });
    }

    /* -- 3. FORCE-HIDE .nbtn BUTTONS (JS, not CSS) -- */
    document.querySelectorAll('#mainNav .nav-right .nbtn').forEach(function(btn) {
      btn.style.cssText = 'display:none!important;';
    });
    var mobileSB = document.querySelector('#mainNav .hhp-mobile-signin-btn');
    if (mobileSB) mobileSB.style.cssText = 'display:none!important;';

    /* -- 4. FORCE VIEW SWITCHER VISIBLE (desktop) -- */
    if (window.innerWidth > 900) {
      var vs = document.getElementById('viewSwitcher');
      var dd = document.getElementById('viewDropdown');
      if (vs) vs.style.cssText = 'display:inline-flex!important;visibility:visible!important;overflow:visible!important;min-width:140px!important;position:static!important;';
      if (dd) dd.style.cssText = 'display:inline-block!important;visibility:visible!important;width:auto!important;height:auto!important;min-width:140px!important;min-height:28px!important;padding:5px 10px!important;font-size:13px!important;background:#1a1a1a!important;color:#bfa260!important;border:1px solid #bfa260!important;border-radius:6px!important;cursor:pointer!important;-webkit-appearance:menulist!important;appearance:auto!important;';
      if (navRight) navRight.style.cssText = 'display:flex!important;visibility:visible!important;align-items:center;gap:10px;position:relative!important;margin-left:auto!important;min-width:160px!important;';
    }

    /* -- 5. INJECT NAV CSS -- */
    var old = document.getElementById('hhp-nav-fix-css');
    if (old) old.remove();
    var fixCSS = document.createElement('style');
    fixCSS.id = 'hhp-nav-fix-css';
    fixCSS.textContent = [
      '@media (min-width: 901px) {',
      '  #mainNav { position: fixed !important; display: flex !important; align-items: center !important; overflow: visible !important; }',
      '  #mainNav .nav-center { display: flex !important; visibility: visible !important; }',
      '  #mainNav .nav-right { display: flex !important; visibility: visible !important; align-items: center; gap: 10px; position: absolute !important; right: 16px !important; top: 50% !important; transform: translateY(-50%) !important; }',
      '  #mainNav #viewSwitcher { display: inline-block !important; visibility: visible !important; }',
      '  #mainNav #viewDropdown { display: inline-block !important; visibility: visible !important; width: auto !important; height: auto !important; min-width: 140px !important; }',
      '  #mainNav .nav-right { position: relative !important; display: flex !important; align-items: center !important; gap: 10px; }',
      '  #mainNav #viewSwitcher { position: static !important; display: inline-block !important; }',
      '  #mainNav #viewDropdown { position: static !important; width: 140px !important; }',
      '  #mainNav .nav-right .nbtn { display: none !important; }',
      '  #mainNav .hhp-hamburger-v10 { display: none !important; }',
      '  #mainNav .hhp-mobile-signin-btn { display: none !important; }',
      '}',
      '@media (max-width: 900px) {',
      '  #mainNav .nav-center { display: none !important; }',
      '  #mainNav .nav-right { display: none !important; }',
      '  #mainNav .hhp-mobile-signin-btn { display: none !important; }',
      '  #mainNav .hhp-hamburger-v10 { display: flex !important; align-items: center; justify-content: center; font-size: 28px; background: none; border: none; color: #bfa260; cursor: pointer; padding: 8px; position: absolute; right: 16px; top: 50%; transform: translateY(-50%); z-index: 1001; width: 44px; height: 44px; }',
      '  #mainNav { position: relative; display: flex !important; align-items: center !important; min-height: 56px !important; }',
      '  #mainNav .nav-logo { display: block !important; }',
      '  #mainNav.mobile-open .nav-center { display: flex !important; flex-direction: column; position: fixed; top: 0; left: 0; width: 100%; height: 100vh; background: rgba(26,26,26,0.98); z-index: 2000; justify-content: center; align-items: center; padding: 0; margin: 0; list-style: none; gap: 0; }',
      '  #mainNav.mobile-open .nav-center li { width: 100%; text-align: center; }',
      '  #mainNav.mobile-open .nav-center li a { display: block; padding: 18px 20px; color: #fff; font-size: 20px; text-decoration: none; border-bottom: 1px solid rgba(191,162,96,0.2); }',
      '  #mainNav.mobile-open .nav-center li a:hover { background: rgba(191,162,96,0.15); color: #bfa260; }',
      '  #mainNav.mobile-open .nav-right { display: none !important; }',
      '  #mainNav.mobile-open .hhp-hamburger-v10 { position: fixed; top: 16px; right: 16px; z-index: 2002; font-size: 32px; color: #fff; }',
      '}',
    ].join('\n');
    document.head.appendChild(fixCSS);

    /* -- 6. ADD HOME LINK -- */
    var navCenter = document.querySelector('#mainNav .nav-center');
    if (navCenter && !document.getElementById('hhp-home-link')) {
      var homeLi = document.createElement('li');
      var homeA = document.createElement('a');
      homeA.href = '#';
      homeA.id = 'hhp-home-link';
      homeA.textContent = 'Home';
      homeA.addEventListener('click', function(e) {
        e.preventDefault();
        var dd = document.getElementById('viewDropdown');
        if (dd) {
          for (var i = 0; i < dd.options.length; i++) {
            if (dd.options[i].value === 'home' || dd.options[i].text.toLowerCase().indexOf('home') !== -1) {
              dd.selectedIndex = i;
              dd.dispatchEvent(new Event('change'));
              break;
            }
          }
        }
        window.scrollTo(0, 0);
        var mn = document.getElementById('mainNav');
        if (mn) mn.classList.remove('mobile-open');
        var hb = document.querySelector('.hhp-hamburger-v10');
        if (hb) hb.innerHTML = '\u2630';
      });
      homeLi.appendChild(homeA);
      navCenter.insertBefore(homeLi, navCenter.firstChild);
    }

    /* -- 7. ADD SIGN IN/OUT TO MOBILE MENU -- */
    if (navCenter && !document.getElementById('hhp-mobile-auth-li')) {
      var authLi = document.createElement('li');
      authLi.id = 'hhp-mobile-auth-li';
      authLi.style.cssText = 'margin-top: 20px;';
      var loginBtn = document.getElementById('navLoginBtn');
      var logoutBtn = document.getElementById('navLogoutBtn');
      if (loginBtn) {
        var mL = document.createElement('a');
        mL.href = '#';
        mL.textContent = 'Sign In';
        mL.style.cssText = 'color: #bfa260 !important;';
        mL.addEventListener('click', function(e) {
          e.preventDefault();
          loginBtn.click();
          var mn = document.getElementById('mainNav');
          if (mn) mn.classList.remove('mobile-open');
          var hb = document.querySelector('.hhp-hamburger-v10');
          if (hb) hb.innerHTML = '\u2630';
        });
        authLi.appendChild(mL);
      }
      if (logoutBtn) {
        var mO = document.createElement('a');
        mO.href = '#';
        mO.textContent = 'Sign Out';
        mO.style.cssText = 'color: #bfa260 !important; margin-left: 20px;';
        mO.addEventListener('click', function(e) {
          e.preventDefault();
          logoutBtn.click();
          var mn = document.getElementById('mainNav');
          if (mn) mn.classList.remove('mobile-open');
          var hb = document.querySelector('.hhp-hamburger-v10');
          if (hb) hb.innerHTML = '\u2630';
        });
        authLi.appendChild(mO);
      }
      navCenter.appendChild(authLi);
    }

    /* -- 8. HAMBURGER TOGGLE -- */
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
      if (link.id === 'hhp-home-link' || link.id === 'hhp-mobile-auth-li') return;
      link.addEventListener('click', function() {
        var mn = document.getElementById('mainNav');
        if (mn) mn.classList.remove('mobile-open');
        var hb = document.querySelector('.hhp-hamburger-v10');
        if (hb) hb.innerHTML = '\u2630';
      });
    });

    /* -- 9. MEET & GREET TO TOP OF SERVICES -- */
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

    /* -- 10. BOOK -> REQUEST -- */
    document.querySelectorAll('.services-grid .service-card button, .services-grid .service-card a').forEach(function(btn) {
      if ((btn.textContent || '').indexOf('Book') !== -1) {
        btn.textContent = btn.textContent.replace(/Book/g, 'Request');
      }
    });

    /* -- 11. WIRE BUTTONS TO BOOKING MODAL -- */
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

    /* -- 12. MUTATIONOBSERVER (FIXED - no infinite loop) -- */
    if (!window._hhpNavObserver) {
      var navEl = document.querySelector('#mainNav');
      if (navEl && window.MutationObserver) {
        window._hhpNavObserver = new MutationObserver(function(muts) {
          muts.forEach(function(m) {
            if (m.type === 'attributes' && m.attributeName === 'style') {
              var el = m.target;
              var isDesktop = window.innerWidth > 900;
              /* SKIP .nbtn entirely to prevent infinite loop */
              if (el.classList.contains('nbtn')) return;
              if (el.classList.contains('hhp-mobile-signin-btn')) return;
              if (el.classList.contains('nav-right') || el.classList.contains('nav-center') || el.id === 'viewSwitcher' || el.id === 'viewDropdown') {
                var s = el.getAttribute('style') || '';
                if (s.indexOf('display: none') !== -1 || s.indexOf('display:none') !== -1 || s.indexOf('hidden') !== -1) {
                  el.removeAttribute('style');
                  if (isDesktop) {
                    if (el.id === 'viewSwitcher') el.style.cssText = 'display:inline-block!important;visibility:visible!important;';
                    if (el.id === 'viewDropdown') el.style.cssText = 'display:inline-block!important;visibility:visible!important;width:auto!important;height:auto!important;min-width:140px!important;min-height:28px!important;padding:5px 10px!important;font-size:13px!important;background:#1a1a1a!important;color:#bfa260!important;border:1px solid #bfa260!important;border-radius:6px!important;cursor:pointer!important;';
                    if (el.classList.contains('nav-right')) el.style.cssText = 'display:flex!important;visibility:visible!important;align-items:center;gap:10px;position:relative!important;margin-left:auto!important;';
                  }
                }
              }
            }
          });
        });
        window._hhpNavObserver.observe(navEl, { attributes: true, subtree: true, attributeFilter: ['style'] });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(applyFixes, 500); });
  } else { setTimeout(applyFixes, 500); }
  window.addEventListener('load', function() { setTimeout(applyFixes, 1000); });
  window.addEventListener('load', function() { setTimeout(applyFixes, 3000); });

  // Persistent fix: override fixes.js setInterval that re-applies old nav-right styles
  setInterval(function() {
    var navRight = document.querySelector('#mainNav .nav-right');
    if (navRight && navRight.style.cssText.indexOf('position: absolute') !== -1) {
      navRight.style.cssText = 'display:flex!important;visibility:visible!important;align-items:center;gap:10px;position:relative!important;margin-left:auto!important;min-width:160px!important;';
    }
    var vs = document.getElementById('viewSwitcher');
    if (vs && getComputedStyle(vs).overflow === 'hidden') {
      vs.style.cssText = 'display:inline-flex!important;visibility:visible!important;overflow:visible!important;min-width:140px!important;position:static!important;';
    }
  }, 500);

})();

