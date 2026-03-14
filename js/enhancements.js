// ============================================================
// Housley Happy Paws - UI Enhancements (enhancements.js)
// 1. Portal dropdown visibility by role
// 2. Remember Me (30-day) + pet name field on signup
// 3. Client portal welcome personalization
// 4. Floating Request Booking button
// 5. Sync booking services with home page pricing
// 6. Replace Dog Boarding with House Sitting in services editor
// ============================================================

(function() {
  'use strict';

  function onReady(fn) {
    if (document.readyState !== 'loading') setTimeout(fn, 300);
    else document.addEventListener('DOMContentLoaded', function() { setTimeout(fn, 300); });
  }

  // 1. PORTAL DROPDOWN BY ROLE
  function updateDropdownForRole() {
    var auth = window.HHP_Auth;
    var dropdown = document.getElementById('viewDropdown');
    var switcher = document.getElementById('viewSwitcher');
    if (!dropdown || !switcher) return;
    if (!auth || !auth.currentUser) { switcher.style.display = 'none'; return; }
    switcher.style.display = 'inline-flex';
    var role = auth.currentRole || 'client';
    var name = (auth.currentUser.profile && auth.currentUser.profile.full_name) || (auth.currentUser.email && auth.currentUser.email.split('@')[0]) || 'My';
    var opts = '<option value="public">\ud83d\udc3e Home</option>';
    if (role === 'client') {
      opts += '<option value="client" selected>\ud83d\udc64 ' + name + '\u2019s Dashboard</option>';
    } else if (role === 'staff') {
      opts += '<option value="staff" selected>\ud83e\uddd1 ' + name + '\u2019s Dashboard</option>';
    } else if (role === 'owner') {
      opts += '<option value="client">\ud83d\udc64 Client View</option>';
      opts += '<option value="staff">\ud83e\uddd1 Staff View</option>';
      opts += '<option value="owner" selected>\ud83d\udc51 Owner</option>';
    }
    dropdown.innerHTML = opts;
  }

  function patchAuthUI() {
    var auth = window.HHP_Auth;
    if (!auth) return;
    var origUpdateUI = auth.updateUIForUser.bind(auth);
    auth.updateUIForUser = function() {
      origUpdateUI();
      updateDropdownForRole();
      personalizeClientWelcome();
    };
    var origShowLogin = auth.showLoginScreen.bind(auth);
    auth.showLoginScreen = function() {
      origShowLogin();
      var s = document.getElementById('viewSwitcher');
      if (s) s.style.display = 'none';
    };
    if (auth.currentUser) updateDropdownForRole();
    else { var s = document.getElementById('viewSwitcher'); if (s) s.style.display = 'none'; }
  }

  // 2. REMEMBER ME + PET NAME
  function addRememberMe() {
    var passGroup = document.getElementById('authPasswordGroup');
    if (!passGroup || document.getElementById('rememberMeGroup')) return;
    var div = document.createElement('div');
    div.id = 'rememberMeGroup';
    div.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px;margin-bottom:4px';
    div.innerHTML = '<input type="checkbox" id="rememberMe" style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer"><label for="rememberMe" style="font-size:0.82rem;color:var(--mid);cursor:pointer;user-select:none">Remember me for 30 days</label>';
    passGroup.after(div);
  }

  function addPetNameField() {
    var nameGroup = document.getElementById('authNameGroup');
    if (!nameGroup || document.getElementById('authPetNameGroup')) return;
    var div = document.createElement('div');
    div.id = 'authPetNameGroup';
    div.style.display = 'none';
    div.innerHTML = '<label class="form-lbl">Pet / Animal Name(s) <span style="color:var(--rose);font-weight:700">*</span></label><input class="form-in" id="authPetName" type="text" placeholder="e.g. Max, Bella" autocomplete="off">';
    nameGroup.after(div);
  }

  function patchAuthMode() {
    var origToggle = window.toggleAuthMode;
    if (!origToggle) return;
    window.toggleAuthMode = function(mode) {
      origToggle(mode);
      var petGroup = document.getElementById('authPetNameGroup');
      var rememberGroup = document.getElementById('rememberMeGroup');
      if (mode === 'signup') {
        if (petGroup) petGroup.style.display = 'block';
        if (rememberGroup) rememberGroup.style.display = 'none';
      } else if (mode === 'magic') {
        if (petGroup) petGroup.style.display = 'none';
        if (rememberGroup) rememberGroup.style.display = 'none';
      } else {
        if (petGroup) petGroup.style.display = 'none';
        if (rememberGroup) rememberGroup.style.display = 'flex';
      }
    };
  }

  function patchSignup() {
    var origSignup = window.handleSignup;
    if (!origSignup) return;
    window.handleSignup = function(e) {
      if (e) e.preventDefault();
      var petInput = document.getElementById('authPetName');
      var nameInput = document.getElementById('authName');
      var errEl = document.getElementById('authError');
      if (nameInput && !nameInput.value.trim()) {
        if (errEl) { errEl.style.color = 'var(--rose)'; errEl.textContent = 'Full name is required.'; }
        return;
      }
      if (petInput && !petInput.value.trim()) {
        if (errEl) { errEl.style.color = 'var(--rose)'; errEl.textContent = 'Pet / animal name is required.'; }
        return;
      }
      if (petInput) window._hhpPetNames = petInput.value.trim();
      return origSignup(e);
    };
    var auth = window.HHP_Auth;
    if (auth) {
      var origHS = auth.handleSession.bind(auth);
      auth.handleSession = function(session) {
        return origHS(session).then(function() {
          if (window._hhpPetNames && session && session.user && session.user.id) {
            return auth.supabase.from('profiles').update({ pet_names: window._hhpPetNames }).eq('user_id', session.user.id)
              .then(function() { window._hhpPetNames = null; })
              .catch(function(err) { console.warn('Could not save pet names:', err); });
          }
        });
      };
    }
  }

  function patchLogin() {
    var auth = window.HHP_Auth;
    if (!auth) return;
    var origLogin = auth.login.bind(auth);
    auth.login = function(email, password) {
      var cb = document.getElementById('rememberMe');
      var remember = cb && cb.checked;
      if (remember) {
        localStorage.setItem('hhp_remember_me', 'true');
        localStorage.setItem('hhp_remember_until', String(Date.now() + 30 * 24 * 60 * 60 * 1000));
      } else {
        localStorage.removeItem('hhp_remember_me');
        localStorage.removeItem('hhp_remember_until');
      }
      return origLogin(email, password);
    };
  }

  // 3. CLIENT WELCOME PERSONALIZATION
  function personalizeClientWelcome() {
    var auth = window.HHP_Auth;
    if (!auth || !auth.currentUser) return;
    var dashH2 = document.querySelector('#c-dash .p-header h2');
    if (!dashH2) return;
    var name = (auth.currentUser.profile && auth.currentUser.profile.full_name) || (auth.currentUser.email && auth.currentUser.email.split('@')[0]) || '';
    if (name) dashH2.textContent = 'Welcome to your Client Portal, ' + name + ' \ud83d\udc3e';
  }

  // 4. FLOATING BOOKING BUTTON
  function createFloatingBookButton() {
    var existingBtn = document.querySelector('#c-appts .btn-gold[onclick*="bookModal"]');
    if (existingBtn) existingBtn.remove();
    if (document.getElementById('floatingBookBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'floatingBookBtn';
    btn.onclick = function() { openModal('bookModal'); };
    btn.innerHTML = '\ud83d\udcc5';
    btn.title = 'Request Booking';
    btn.style.cssText = 'position:fixed;bottom:28px;right:28px;width:60px;height:60px;border-radius:50%;background:var(--gold,#c8963e);color:white;border:none;font-size:1.5rem;cursor:pointer;box-shadow:0 4px 16px rgba(200,150,62,0.45);z-index:9999;display:none;align-items:center;justify-content:center;transition:transform 0.2s,box-shadow 0.2s';
    btn.onmouseenter = function() { btn.style.transform = 'scale(1.1)'; btn.style.boxShadow = '0 6px 24px rgba(200,150,62,0.6)'; };
    btn.onmouseleave = function() { btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 4px 16px rgba(200,150,62,0.45)'; };
    var tooltip = document.createElement('span');
    tooltip.textContent = 'Request Booking';
    tooltip.style.cssText = 'position:absolute;bottom:70px;right:0;background:var(--ink,#1e1409);color:white;padding:6px 12px;border-radius:6px;font-size:0.78rem;font-weight:600;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity 0.2s';
    btn.appendChild(tooltip);
    btn.addEventListener('mouseenter', function() { tooltip.style.opacity = '1'; });
    btn.addEventListener('mouseleave', function() { tooltip.style.opacity = '0'; });
    document.body.appendChild(btn);
    function updateVis() {
      var cp = document.getElementById('pg-client');
      btn.style.display = (cp && cp.classList.contains('active')) ? 'flex' : 'none';
    }
    var origSV = window.switchView;
    window.switchView = function(view) { origSV(view); updateVis(); };
    updateVis();
  }

  // 5. SYNC BOOKING SERVICES
  function syncBookingServices() {
    var bookModal = document.getElementById('bookModal');
    if (!bookModal) return;
    var sel = bookModal.querySelector('.form-sel');
    if (!sel) return;
    sel.innerHTML = '<option value="dog-walk-30">\ud83e\uddae Dog Walk (30 min) \u2014 $25</option>' +
      '<option value="dog-walk-60">\ud83e\uddae Dog Walk (60 min) \u2014 $45</option>' +
      '<option value="dropin-20">\ud83c\udfe0 Drop-In Visit (20 min) \u2014 $18</option>' +
      '<option value="dropin-40">\ud83c\udfe0 Drop-In Visit (40 min) \u2014 $25</option>' +
      '<option value="cat-care-20">\ud83d\udc31 Cat Care (20 min) \u2014 $18</option>' +
      '<option value="cat-care-40">\ud83d\udc31 Cat Care (40 min) \u2014 $30</option>' +
      '<option value="house-sitting">\ud83c\udfe1 House Sitting \u2014 $125/night</option>';
    updateBookingSummary(sel);
    sel.addEventListener('change', function() { updateBookingSummary(sel); });
  }

  function updateBookingSummary(sel) {
    var bookModal = document.getElementById('bookModal');
    if (!bookModal) return;
    var text = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : '';
    var priceMatch = text.match(/\$(\d+)/);
    var price = priceMatch ? priceMatch[1] : '\u2014';
    var isNight = text.indexOf('/night') !== -1;
    var dashIdx = text.indexOf(' \u2014 ');
    var svcName = dashIdx > -1 ? text.substring(0, dashIdx).replace(/^[^\s]+\s/, '') : text;
    var summaryDiv = bookModal.querySelector('[style*="background:var(--warm)"]');
    if (summaryDiv) {
      summaryDiv.innerHTML = '<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--mid)">' + svcName + '</span><span style="font-weight:700">$' + price + '.00' + (isNight ? '/night' : '') + '</span></div><div style="display:flex;justify-content:space-between;padding:3px 0;border-top:1px solid var(--border);margin-top:8px;padding-top:8px"><span style="font-weight:700">Total</span><span style="font-weight:700">$' + price + '.00' + (isNight ? '/night' : '') + '</span></div>';
    }
  }

  // 6. FIX SERVICES EDITOR
  function fixServicesEditor() {
    var observer = new MutationObserver(function() {
      var rows = document.getElementById('serviceDescRows');
      if (rows && rows.children.length > 0) {
        rows.querySelectorAll('[data-field]').forEach(function(field) {
          if (field.dataset.field === 'svcBoard') {
            field.dataset.field = 'svcHouseSit';
            var label = field.previousElementSibling;
            if (label && label.textContent.indexOf('Boarding') !== -1) label.textContent = '\ud83c\udfe1 House Sitting';
            if (!field.value || field.value.indexOf('Boarding') !== -1)
              field.value = 'Going away? I stay at your home and care for your pets in their own environment \u2014 keeping their routine, giving medication if needed, and sending regular updates so you have peace of mind. Starting at $125/night.';
          }
        });
      }
    });
    var contentArea = document.getElementById('contentEditArea');
    if (contentArea) observer.observe(contentArea, { childList: true, subtree: true });
  }

  // INIT
  onReady(function() {
    console.log('[enhancements.js] Initializing...');
    addRememberMe(); addPetNameField(); patchAuthMode(); patchSignup(); patchLogin(); patchAuthUI();
    createFloatingBookButton(); syncBookingServices(); fixServicesEditor(); personalizeClientWelcome();
    console.log('[enhancements.js] All enhancements loaded');
  });
})();
