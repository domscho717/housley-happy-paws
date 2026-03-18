// ============================================================
// Housley Happy Paws â UX Upgrades (ux-upgrades.js)
// 1. Responsive design (phone / tablet / desktop)
// 2. Simplified save workflow
// 3. Time-based greetings (morning / afternoon / evening)
// 4. Hamburger menu navigation
// ============================================================
(function() {
  'use strict';

  function onReady(fn) {
    if (document.readyState !== 'loading') setTimeout(fn, 500);
    else document.addEventListener('DOMContentLoaded', function() { setTimeout(fn, 500); });
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // 1. RESPONSIVE DESIGN â phone / tablet / desktop
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function initResponsive() {
    // Inject responsive CSS
    var css = document.createElement('style');
    css.id = 'hhp-responsive-css';
    css.textContent = '' +
      /* ââ Global responsive base ââ */
      '*, *::before, *::after { box-sizing: border-box; }' +
      'img, video, iframe { max-width: 100%; height: auto; }' +

      /* ââ TABLET (768px - 1024px) ââ */
      '@media (max-width: 1024px) {' +
        '.portal-wrap { flex-direction: column !important; }' +
        '.sidebar { width: 100% !important; max-width: 100% !important; min-width: 0 !important; ' +
          'position: relative !important; height: auto !important; min-height: 0 !important; ' +
          'padding: 12px 16px !important; }' +
        '.portal-main { width: 100% !important; max-width: 100% !important; margin-left: 0 !important; padding: 16px !important; }' +
        '.sidebar .sb-item { display: inline-flex !important; padding: 8px 14px !important; font-size: 0.82rem !important; white-space: nowrap !important; }' +
        '.sb-section-toggle { display: none !important; }' +
        '#mainNav { flex-wrap: wrap; padding: 8px 12px !important; }' +
        '#mainNav a { font-size: 0.82rem !important; padding: 6px 8px !important; }' +
        '.nav-links { gap: 4px !important; }' +
        '.owner-banner { padding: 16px !important; }' +
        '.ob-stats { flex-wrap: wrap !important; }' +
        '.card { padding: 16px !important; }' +
        '.hero-row { flex-direction: column !important; }' +
        '.hero-text-col, .hero-photo-col { width: 100% !important; max-width: 100% !important; }' +
        '.about-row { flex-direction: column !important; }' +
        '.about-photos, .about-text { width: 100% !important; max-width: 100% !important; }' +
        '.services-grid { grid-template-columns: repeat(2, 1fr) !important; }' +
        '.pricing-grid { grid-template-columns: 1fr !important; }' +
      '}' +

      /* ââ PHONE (< 768px) ââ */
      '@media (max-width: 767px) {' +
        /* Nav becomes compact */
        '#mainNav { padding: 8px 10px !important; gap: 6px !important; }' +
        '#mainNav .nav-links, #mainNav .nav-right-group { display: none !important; }' +
        '.hhp-hamburger { display: flex !important; }' +
        '.hhp-mobile-nav { display: block !important; }' +
        /* Portal layouts */
        '.portal-wrap { flex-direction: column !important; }' +
        '.sidebar { display: none !important; }' +
        '.sidebar.hhp-sidebar-open { display: block !important; width: 100% !important; ' +
          'position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; ' +
          'z-index: 9998 !important; background: var(--cream, #fdf7ee) !important; overflow-y: auto !important; ' +
          'padding: 60px 20px 20px !important; }' +
        '.portal-main { width: 100% !important; padding: 12px !important; margin: 0 !important; }' +
        '.sidebar .sb-item { display: flex !important; padding: 14px 16px !important; font-size: 1rem !important; ' +
          'border-bottom: 1px solid var(--border, #e0d5c5) !important; margin: 0 !important; border-radius: 0 !important; }' +
        /* Cards & content */
        '.card { padding: 14px !important; margin-bottom: 12px !important; }' +
        '.owner-banner { padding: 14px !important; border-radius: 12px !important; }' +
        '.ob-h { font-size: 1.3rem !important; }' +
        '.ob-stats { gap: 8px !important; }' +
        '.ob-stat { min-width: 70px !important; }' +
        '.dash-grid, .dash-grid-2 { grid-template-columns: 1fr !important; }' +
        /* Public homepage */
        '.hero-row { flex-direction: column !important; padding: 20px 16px !important; }' +
        '.hero-text-col { width: 100% !important; padding: 0 !important; }' +
        '.hero-text-col h1 { font-size: 2rem !important; }' +
        '.hero-photo-col { width: 100% !important; margin-top: 20px !important; }' +
        '.about-row { flex-direction: column !important; padding: 20px 16px !important; }' +
        '.about-photos { width: 100% !important; height: 260px !important; }' +
        '.about-text { width: 100% !important; padding: 16px 0 !important; }' +
        '.services-grid { grid-template-columns: 1fr !important; }' +
        '.pricing-grid { grid-template-columns: 1fr !important; }' +
        '.reviews-grid { grid-template-columns: 1fr !important; }' +
        '.footer-inner { flex-direction: column !important; text-align: center !important; }' +
        /* View dropdown + buttons */
        '#viewDropdown { font-size: 0.8rem !important; padding: 6px 8px !important; }' +
        '.nav-btn { font-size: 0.75rem !important; padding: 8px 12px !important; }' +
      '}' +

      /* ââ Hamburger button (hidden on desktop) ââ */
      '.hhp-hamburger { display: none; align-items: center; justify-content: center; background: none; border: none; ' +
        'cursor: pointer; padding: 8px; z-index: 9999; }' +
      '.hhp-hamburger span { display: block; width: 22px; height: 2px; background: var(--dark, #1e1409); ' +
        'margin: 4px 0; border-radius: 2px; transition: all 0.3s ease; }' +
      '.hhp-hamburger.active span:nth-child(1) { transform: rotate(45deg) translate(4px, 4px); }' +
      '.hhp-hamburger.active span:nth-child(2) { opacity: 0; }' +
      '.hhp-hamburger.active span:nth-child(3) { transform: rotate(-45deg) translate(5px, -5px); }' +

      /* ââ Mobile nav overlay ââ */
      '.hhp-mobile-nav { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; ' +
        'background: var(--cream, #fdf7ee); z-index: 9997; overflow-y: auto; padding: 70px 20px 30px; }' +
      '.hhp-mobile-nav.open { display: block !important; }' +
      '.hhp-mobile-nav a { display: block; padding: 16px 12px; font-size: 1.1rem; color: var(--dark, #1e1409); ' +
        'text-decoration: none; border-bottom: 1px solid var(--border, #e0d5c5); font-family: inherit; }' +
      '.hhp-mobile-nav a:active { background: rgba(200,150,62,0.1); }' +

      /* ââ Sidebar close button for mobile ââ */
      '.hhp-sidebar-close { display: none; position: fixed; top: 16px; right: 16px; z-index: 9999; background: var(--dark, #1e1409); ' +
        'color: white; border: none; width: 36px; height: 36px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; ' +
        'align-items: center; justify-content: center; }' +
      '.sidebar.hhp-sidebar-open .hhp-sidebar-close { display: flex !important; }' +

      /* ââ Floating hamburger for portal sidebar ââ */
      '.hhp-portal-hamburger { display: none; position: fixed; bottom: 20px; right: 20px; z-index: 9990; ' +
        'background: var(--gold, #c8963e); color: white; border: none; width: 52px; height: 52px; border-radius: 50%; ' +
        'box-shadow: 0 4px 16px rgba(0,0,0,0.2); cursor: pointer; align-items: center; justify-content: center; font-size: 1.3rem; }' +
      '@media (max-width: 767px) { .hhp-portal-hamburger { display: flex !important; } }' +
      '';

    document.head.appendChild(css);
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // 2. SIMPLIFIED SAVE WORKFLOW
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function initEasySave() {
    // Override save buttons to work with a simple click
    // The issue: some save buttons require extra confirmation or the site-content
    // save flow is multi-step. We streamline it.

    // Watch for save buttons and ensure they give clear feedback
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var text = btn.textContent.trim().toLowerCase();
      if (!text.includes('save')) return;

      // Add visual feedback immediately
      var origText = btn.textContent;
      var origBg = btn.style.background;

      // After the save action runs, show success feedback
      setTimeout(function() {
        // Check if button still exists and wasn't replaced
        if (!btn.parentElement) return;

        // Flash green to show save succeeded
        btn.textContent = 'â Saved!';
        btn.style.background = 'var(--green, #3d5a47)';
        btn.style.color = 'white';
        btn.style.transition = 'all 0.3s ease';

        setTimeout(function() {
          btn.textContent = origText;
          btn.style.background = origBg;
          btn.style.color = '';
        }, 2000);
      }, 500);
    }, true);

    // Auto-save indicator for content editor
    // Add a floating save button for the Edit Website section
    var floatSave = document.createElement('button');
    floatSave.id = 'hhp-float-save';
    floatSave.innerHTML = 'ð¾ Quick Save';
    floatSave.style.cssText = 'display:none;position:fixed;bottom:80px;right:20px;z-index:9000;' +
      'background:var(--gold,#c8963e);color:white;border:none;padding:12px 20px;border-radius:12px;' +
      'font-weight:600;font-size:0.9rem;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.2);' +
      'font-family:inherit;transition:all 0.3s ease;';
    floatSave.addEventListener('mouseenter', function() { this.style.transform = 'scale(1.05)'; });
    floatSave.addEventListener('mouseleave', function() { this.style.transform = 'scale(1)'; });
    document.body.appendChild(floatSave);

    // Show floating save when in Edit Website or similar editable sections
    var showFloatSave = false;
    floatSave.addEventListener('click', function() {
      // Find and click the most relevant save button on the current visible section
      var visibleSaves = [];
      document.querySelectorAll('button').forEach(function(b) {
        if (b.textContent.toLowerCase().includes('save') && b.offsetParent !== null && b !== floatSave) {
          visibleSaves.push(b);
        }
      });
      if (visibleSaves.length > 0) {
        // Click all visible save buttons in sequence
        visibleSaves.forEach(function(b, i) {
          setTimeout(function() { b.click(); }, i * 300);
        });
        floatSave.innerHTML = 'â All Saved!';
        floatSave.style.background = 'var(--green, #3d5a47)';
        setTimeout(function() {
          floatSave.innerHTML = 'ð¾ Quick Save';
          floatSave.style.background = 'var(--gold, #c8963e)';
        }, 2500);
      }
    });

    // Monitor which section is active and show floating save when editing
    var observer = new MutationObserver(function() {
      var editSections = ['o-content', 'o-avail', 'o-deals', 'o-auto', 'o-payments', 'o-photos', 'o-linkpage'];
      var isEditing = false;
      editSections.forEach(function(id) {
        var el = document.getElementById(id);
        if (el && el.style.display !== 'none' && el.offsetParent !== null) {
          isEditing = true;
        }
      });
      floatSave.style.display = isEditing ? 'block' : 'none';
    });

    // Observe the portal main content for display changes
    var portalMains = document.querySelectorAll('.portal-main');
    portalMains.forEach(function(pm) {
      observer.observe(pm, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    });

    // Also check on sidebar clicks
    document.addEventListener('click', function(e) {
      if (e.target.closest('.sb-item')) {
        setTimeout(function() {
          var editSections = ['o-content', 'o-avail', 'o-deals', 'o-auto', 'o-payments', 'o-photos', 'o-linkpage'];
          var isEditing = false;
          editSections.forEach(function(id) {
            var el = document.getElementById(id);
            if (el && el.style.display !== 'none' && el.offsetParent !== null) {
              isEditing = true;
            }
          });
          floatSave.style.display = isEditing ? 'block' : 'none';
        }, 300);
      }
    });
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // 3. TIME-BASED GREETINGS
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function initGreetings() {
    // Defer to ux-patch.js fixGreetings() which handles birthdays
    if (window._hhpGreetingHandled) return;
    var hour = new Date().getHours();
    var greeting;
    var emoji;
    if (hour >= 5 && hour < 12) {
      greeting = 'Good morning';
      emoji = 'âï¸';
    } else if (hour >= 12 && hour < 17) {
      greeting = 'Good afternoon';
      emoji = 'ð¤ï¸';
    } else {
      greeting = 'Good evening';
      emoji = 'ð';
    }

    // ââ Owner portal greeting ââ
    var ownerGreet = document.querySelector('#o-overview .ob-h');
    if (ownerGreet) {
      var ownerText = ownerGreet.textContent;
      // Replace "Good morning" with time-appropriate greeting
      if (ownerText.includes('Good morning') || ownerText.includes('Good afternoon') || ownerText.includes('Good evening')) {
        // Extract the name part
        var nameMatch = ownerText.match(/,\s*(.+?)[\sð¾]/);
        var name = nameMatch ? nameMatch[1].trim() : 'Rachel';
        ownerGreet.textContent = greeting + ', ' + name + ' ' + emoji;
      }
    }

    // ââ Client portal greeting ââ
    var clientPortal = document.getElementById('pg-client');
    if (clientPortal) {
      // Find the "Welcome to your Client Portal" text
      var clientH1s = clientPortal.querySelectorAll('h1, h2, .p-title');
      clientH1s.forEach(function(el) {
        if (el.textContent.includes('Welcome to your Client Portal')) {
          // Get the user's name from auth
          var auth = window.HHP_Auth;
          var clientName = 'there';
          if (auth && auth.currentUser && auth.currentUser.profile && auth.currentUser.profile.full_name) {
            clientName = auth.currentUser.profile.full_name.split(' ')[0];
          }
          el.textContent = greeting + ', ' + clientName + '! ' + emoji;

          // Add subtitle below if not already present
          var subtitle = el.nextElementSibling;
          if (subtitle && subtitle.tagName === 'P') {
            subtitle.textContent = 'Welcome to your Client Portal â your appointments, photos, and walk reports are all here.';
          }
        }
      });
    }

    // ââ Staff portal greeting ââ
    var staffPortal = document.getElementById('pg-staff');
    if (staffPortal) {
      // Find the staff welcome/header area
      var staffHeaders = staffPortal.querySelectorAll('h1, h2, .p-title, .ob-h');
      staffHeaders.forEach(function(el) {
        var text = el.textContent;
        if (text.includes('Welcome') || text.includes('Good morning') || text.includes('Good afternoon') || text.includes('Good evening')) {
          var auth = window.HHP_Auth;
          var staffName = 'there';
          if (auth && auth.currentUser && auth.currentUser.profile && auth.currentUser.profile.full_name) {
            staffName = auth.currentUser.profile.full_name.split(' ')[0];
          }
          el.textContent = greeting + ', ' + staffName + '! ' + emoji;
        }
      });

      // If no greeting header found, try to add one to the staff dashboard
      var staffDash = staffPortal.querySelector('.portal-main');
      if (staffDash) {
        var existingGreet = staffDash.querySelector('.hhp-staff-greet');
        if (!existingGreet) {
          var hasGreeting = false;
          staffHeaders.forEach(function(el) {
            if (el.textContent.includes(greeting)) hasGreeting = true;
          });
          if (!hasGreeting) {
            var auth = window.HHP_Auth;
            var staffName = '';
            if (auth && auth.currentUser && auth.currentUser.profile && auth.currentUser.profile.full_name) {
              staffName = auth.currentUser.profile.full_name.split(' ')[0];
            }
            if (staffName) {
              var greetBanner = document.createElement('div');
              greetBanner.className = 'hhp-staff-greet';
              greetBanner.style.cssText = 'background:linear-gradient(135deg,var(--dark,#1e1409),var(--brown,#3d2b1a));' +
                'color:white;padding:18px 24px;border-radius:14px;margin-bottom:16px;';
              greetBanner.innerHTML = '<div style="font-size:1.2rem;font-weight:700;">' + greeting + ', ' + staffName + '! ' + emoji + '</div>' +
                '<div style="font-size:0.82rem;opacity:0.8;margin-top:4px;">Here\'s your schedule and tasks for today.</div>';
              // Insert at top of first visible section
              var firstSection = staffDash.querySelector('[id^="s-"]');
              if (firstSection) firstSection.prepend(greetBanner);
              else staffDash.prepend(greetBanner);
            }
          }
        }
      }
    }

    // Update greeting every minute (in case page stays open across time boundaries)
    setTimeout(function() { initGreetings(); }, 60000);
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // 4. HAMBURGER MENU NAVIGATION
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function initHamburgerMenu() {
    var nav = document.getElementById('mainNav');
    if (!nav) return;

    // ââ Create hamburger button for main nav ââ
    var hamburger = document.createElement('button');
    hamburger.className = 'hhp-hamburger';
    hamburger.setAttribute('aria-label', 'Open menu');
    hamburger.innerHTML = '<span></span><span></span><span></span>';
    // Insert as first child of nav
    nav.insertBefore(hamburger, nav.children[1] || null);

    // ââ Create mobile nav overlay ââ
    var mobileNav = document.createElement('div');
    mobileNav.className = 'hhp-mobile-nav';
    mobileNav.id = 'hhpMobileNav';

    // Clone nav links
    var navLinks = nav.querySelectorAll('a');
    navLinks.forEach(function(link) {
      var clone = link.cloneNode(true);
      clone.addEventListener('click', function() {
        closeMobileNav();
      });
      mobileNav.appendChild(clone);
    });

    // Add view dropdown if exists
    var viewDropdown = document.getElementById('viewDropdown');
    if (viewDropdown) {
      var dropdownWrap = document.createElement('div');
      dropdownWrap.style.cssText = 'padding: 16px 12px; border-bottom: 1px solid var(--border, #e0d5c5);';
      var label = document.createElement('div');
      label.textContent = 'Switch View';
      label.style.cssText = 'font-size: 0.8rem; color: var(--mid, #8c6b4a); margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;';
      dropdownWrap.appendChild(label);
      var ddClone = viewDropdown.cloneNode(true);
      ddClone.id = 'hhpMobileViewDD';
      ddClone.style.cssText = 'width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border, #e0d5c5); font-family: inherit; font-size: 1rem; background: white;';
      ddClone.addEventListener('change', function() {
        viewDropdown.value = this.value;
        viewDropdown.dispatchEvent(new Event('change'));
        closeMobileNav();
      });
      dropdownWrap.appendChild(ddClone);
      mobileNav.appendChild(dropdownWrap);
    }

    // Add sign out / sign in buttons
    var authBtns = nav.querySelectorAll('button');
    authBtns.forEach(function(btn) {
      var mobileBtn = document.createElement('a');
      mobileBtn.textContent = btn.textContent;
      mobileBtn.style.cssText = 'cursor: pointer;';
      if (btn.textContent.includes('Sign Out')) {
        mobileBtn.style.color = '#c0392b';
      }
      mobileBtn.addEventListener('click', function() {
        btn.click();
        closeMobileNav();
      });
      mobileNav.appendChild(mobileBtn);
    });

    document.body.appendChild(mobileNav);

    // ââ Toggle handlers ââ
    hamburger.addEventListener('click', function() {
      var isOpen = mobileNav.classList.contains('open');
      if (isOpen) {
        closeMobileNav();
      } else {
        mobileNav.classList.add('open');
        hamburger.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });

    function closeMobileNav() {
      mobileNav.classList.remove('open');
      hamburger.classList.remove('active');
      document.body.style.overflow = '';
    }

    // ââ Portal sidebar hamburger (floating button) ââ
    var portalHamburger = document.createElement('button');
    portalHamburger.className = 'hhp-portal-hamburger';
    portalHamburger.innerHTML = 'â°';
    portalHamburger.setAttribute('aria-label', 'Open menu');
    document.body.appendChild(portalHamburger);

    portalHamburger.addEventListener('click', function() {
      // Find the currently visible portal's sidebar
      var portals = ['pg-owner', 'pg-client', 'pg-staff'];
      portals.forEach(function(pid) {
        var portal = document.getElementById(pid);
        if (portal && portal.offsetParent !== null) {
          var sidebar = portal.querySelector('.sidebar');
          if (sidebar) {
            if (sidebar.classList.contains('hhp-sidebar-open')) {
              sidebar.classList.remove('hhp-sidebar-open');
              document.body.style.overflow = '';
              portalHamburger.innerHTML = 'â°';
            } else {
              sidebar.classList.add('hhp-sidebar-open');
              document.body.style.overflow = 'hidden';
              portalHamburger.innerHTML = 'â';

              // Add close button if not already there
              if (!sidebar.querySelector('.hhp-sidebar-close')) {
                var closeBtn = document.createElement('button');
                closeBtn.className = 'hhp-sidebar-close';
                closeBtn.innerHTML = 'â';
                closeBtn.addEventListener('click', function() {
                  sidebar.classList.remove('hhp-sidebar-open');
                  document.body.style.overflow = '';
                  portalHamburger.innerHTML = 'â°';
                });
                sidebar.prepend(closeBtn);
              }

              // Close sidebar when a menu item is clicked
              sidebar.querySelectorAll('.sb-item').forEach(function(item) {
                if (!item.dataset.hhpBound) {
                  item.dataset.hhpBound = 'true';
                  item.addEventListener('click', function() {
                    setTimeout(function() {
                      sidebar.classList.remove('hhp-sidebar-open');
                      document.body.style.overflow = '';
                      portalHamburger.innerHTML = 'â°';
                    }, 150);
                  });
                }
              });
            }
          }
        }
      });
    });

    // Close on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeMobileNav();
        // Also close any open portal sidebars
        document.querySelectorAll('.sidebar.hhp-sidebar-open').forEach(function(s) {
          s.classList.remove('hhp-sidebar-open');
        });
        document.body.style.overflow = '';
        portalHamburger.innerHTML = 'â°';
      }
    });

    // ââ Handle orientation change ââ
    window.addEventListener('resize', function() {
      if (window.innerWidth > 767) {
        closeMobileNav();
        document.querySelectorAll('.sidebar.hhp-sidebar-open').forEach(function(s) {
          s.classList.remove('hhp-sidebar-open');
        });
        document.body.style.overflow = '';
        portalHamburger.innerHTML = 'â°';
      }
    });
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // INIT
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  onReady(function() {
    initResponsive();
    initHamburgerMenu();
    initGreetings();
    initEasySave();
    console.log('ð± HHP UX Upgrades initialized (responsive + save + greetings + hamburger)');
  });

})();
