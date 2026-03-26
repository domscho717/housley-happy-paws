/* ───────────────────────────────────────────
   HHP Settings Panel — Housley Happy Paws
   Settings drawer for all signed-in portals
   ─────────────────────────────────────────── */
(function() {
  'use strict';

  var STORAGE_KEY = 'hhp_settings';
  var defaults = {
    theme: 'light',          // 'light' | 'dark'
    textSize: 'medium',      // 'small' | 'medium' | 'large'
    timeFormat: '12h',       // '12h' | '24h'
    defaultView: 'auto',     // 'auto' | panel id like 'c-dash', 'o-overview', etc.
    notifBooking: true,      // booking confirmations / updates
    notifReminder: true,     // upcoming appointment reminders
    notifMessages: true,     // new message alerts
    notifReports: true       // walk report / service completion
  };

  /* ── Load / Save ────────────────────────── */
  function loadSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        var merged = {};
        for (var k in defaults) merged[k] = parsed.hasOwnProperty(k) ? parsed[k] : defaults[k];
        return merged;
      }
    } catch(e) {}
    return JSON.parse(JSON.stringify(defaults));
  }

  function saveSettings(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch(e) {}
    // Sync to Supabase user_preferences if signed in
    syncToSupabase(s);
  }

  function syncToSupabase(s) {
    try {
      var sb = window.HHP_Auth && window.HHP_Auth.supabase;
      var user = window.HHP_Auth && window.HHP_Auth.currentUser;
      if (!sb || !user) return;
      sb.from('profiles').update({ preferences: s }).eq('user_id', user.id).then(function() {});
    } catch(e) {}
  }

  function loadFromSupabase(cb) {
    try {
      var sb = window.HHP_Auth && window.HHP_Auth.supabase;
      var user = window.HHP_Auth && window.HHP_Auth.currentUser;
      if (!sb || !user) return;
      sb.from('profiles').select('preferences').eq('user_id', user.id).maybeSingle().then(function(res) {
        if (res && res.data && res.data.preferences) {
          var remote = res.data.preferences;
          var local = loadSettings();
          var merged = {};
          for (var k in defaults) merged[k] = remote.hasOwnProperty(k) ? remote[k] : local[k];
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch(e) {}
          if (cb) cb(merged);
        }
      });
    } catch(e) {}
  }

  /* ── Apply Settings ────────────────────── */
  var settings = loadSettings();

  function applyTheme(theme) {
    var root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }

  function applyTextSize(size) {
    var root = document.documentElement;
    root.removeAttribute('data-text-size');
    if (size && size !== 'medium') {
      root.setAttribute('data-text-size', size);
    }
  }

  function applyTimeFormat(fmt) {
    // Override the global fmt12h function based on preference
    if (fmt === '24h') {
      window._hhpOrigFmt12h = window._hhpOrigFmt12h || window.fmt12h;
      window.fmt12h = function(t) {
        if (!t || t.indexOf(':') === -1) return t || '';
        // Return as-is (already 24h)
        var p = t.split(':');
        return p[0].padStart(2, '0') + ':' + p[1];
      };
    } else {
      // Restore original
      if (window._hhpOrigFmt12h) window.fmt12h = window._hhpOrigFmt12h;
    }
  }

  function applyAll(s) {
    applyTheme(s.theme);
    applyTextSize(s.textSize);
    applyTimeFormat(s.timeFormat);
  }

  /* ── Dark Mode CSS Variables ────────────── */
  function injectDarkModeCSS() {
    if (document.getElementById('hhp-dark-mode-css')) return;
    var style = document.createElement('style');
    style.id = 'hhp-dark-mode-css';
    style.textContent = [
      '[data-theme="dark"] {',
      '  --gold: #D4A54A;',
      '  --gold-light: #3D3220;',
      '  --gold-pale: #2A2418;',
      '  --gold-deep: #E8B85C;',
      '  --forest: #5A8A67;',
      '  --forest-light: #1E2E22;',
      '  --forest-pale: #1A231C;',
      '  --rose: #D4847A;',
      '  --rose-light: #2E1C1A;',
      '  --rose-pale: #231816;',
      '  --cream: #141210;',
      '  --warm: #1C1A16;',
      '  --ink: #E8E0D4;',
      '  --brown: #C4A882;',
      '  --mid: #A89070;',
      '  --border: rgba(255,255,255,0.08);',
      '  --shadow: 0 4px 24px rgba(0,0,0,0.3);',
      '  --shadow-lg: 0 12px 48px rgba(0,0,0,0.4);',
      '  color-scheme: dark;',
      '}',
      '[data-theme="dark"] body { background: #141210; color: #E8E0D4; }',
      '[data-theme="dark"] .navbar { background: rgba(20,18,16,0.95); border-bottom-color: rgba(255,255,255,0.06); }',
      '[data-theme="dark"] .stat-box, [data-theme="dark"] .card, [data-theme="dark"] .p-panel { background: #1C1A16; }',
      '[data-theme="dark"] .stat-box { border-color: rgba(255,255,255,0.06); }',
      '[data-theme="dark"] .portal-main { background: #141210; }',
      '[data-theme="dark"] input, [data-theme="dark"] textarea, [data-theme="dark"] select { background: #1C1A16; color: #E8E0D4; border-color: rgba(255,255,255,0.1); }',
      '[data-theme="dark"] .modal-content { background: #1E1C18; color: #E8E0D4; }',
      '[data-theme="dark"] .badge-green { background: #1A3322; color: #6EE79A; }',
      '[data-theme="dark"] .badge-gold { background: #2E2816; color: #E8B85C; }',
      '[data-theme="dark"] .badge-red { background: #2E1816; color: #E88A7A; }',
      '[data-theme="dark"] .badge-blue { background: #162230; color: #68B5F8; }',
      '[data-theme="dark"] .admin-request-card, [data-theme="dark"] .arc-header { background: #1C1A16; border-color: rgba(255,255,255,0.06); }',
      '[data-theme="dark"] .appt-row { border-bottom-color: rgba(255,255,255,0.06); }',
      '[data-theme="dark"] .tabs .tab { color: #A89070; }',
      '[data-theme="dark"] .tabs .tab.active { color: #E8E0D4; border-bottom-color: var(--gold); }',
      '[data-theme="dark"] .cust-widget { background: #1C1A16 !important; border-color: rgba(255,255,255,0.06) !important; }',
      '[data-theme="dark"] .cust-widget:hover { border-color: var(--gold) !important; }',
      '[data-theme="dark"] #scrollTopBtn { background: rgba(240,230,215,0.85); color: #1E1409; }',
      '[data-theme="dark"] .hero-section { background: linear-gradient(180deg, #1C1A16, #141210); }',
      '[data-theme="dark"] .section { background: #141210; }',
      '[data-theme="dark"] .section:nth-child(even) { background: #1C1A16; }',
      '[data-theme="dark"] .service-card { background: #1E1C18; border-color: rgba(255,255,255,0.06); }',
      '[data-theme="dark"] .review-card { background: #1E1C18; border-color: rgba(255,255,255,0.06); }',
      '[data-theme="dark"] .footer { background: #0E0D0B; }',
      '[data-theme="dark"] .btn-outline { border-color: rgba(255,255,255,0.15); color: #C4A882; }',
      '[data-theme="dark"] .btn-outline:hover { border-color: var(--gold); }',
      '[data-theme="dark"] ::placeholder { color: rgba(232,224,212,0.35); }',
      '[data-theme="dark"] .arc-detail { color: #C4A882; }',
      '[data-theme="dark"] img { opacity: 0.92; }',
      '[data-theme="dark"] .sidebar { background: #0E0D0B !important; }',
      '[data-theme="dark"] .section-eyebrow { color: #E8B85C; }',
      '[data-theme="dark"] .hero-tag { background: rgba(212,165,74,0.15); border-color: rgba(212,165,74,0.3); color: #E8B85C; }',
      '[data-theme="dark"] .pill { background: #1C1A16; border-color: rgba(255,255,255,0.08); color: #C4A882; }',
      '[data-theme="dark"] .ai-bubble { background: #1A231C; border-color: rgba(90,138,103,0.2); }',
      '[data-theme="dark"] .portal-back-btn { background: #1C1A16; border-color: rgba(255,255,255,0.1); color: #E8E0D4; }',
      '[data-theme="dark"] .portal-back-btn:hover { background: #2A2418; border-color: var(--gold); }',
      '[data-theme="dark"] .sidebar-user { background: rgba(212,165,74,0.08); }',
      '[data-theme="dark"] .pay-check-row { background: #1C1A16; }',
      '[data-theme="dark"] .pay-check-row:hover { background: #2A2418; }',
      '[data-theme="dark"] .pay-check-row.done { background: #1A2E1A; }',
      '[data-theme="dark"] .photo-upload-slot { background: #1C1A16; border-color: rgba(255,255,255,0.1); }',
      '[data-theme="dark"] .photo-upload-slot:hover { border-color: var(--gold); background: #2A2418; }',
      '[data-theme="dark"] .content-sec-btn { color: #A89070; }',
      '[data-theme="dark"] .content-sec-btn:hover { background: rgba(212,165,74,0.1); color: #E8E0D4; }',
      '[data-theme="dark"] .content-sec-btn.active { background: var(--gold); color: white; }',
      '[data-theme="dark"] .auth-card { background: #1E1C18; }',
      '[data-theme="dark"] #authOverlay { background: rgba(10,8,6,0.8); }',
      '[data-theme="dark"] .form-in { background: #141210; border-color: rgba(255,255,255,0.1); color: #E8E0D4; }',
      '[data-theme="dark"] .form-in:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(212,165,74,0.15); }',
      '[data-theme="dark"] .sidebar::-webkit-scrollbar-thumb { background: rgba(212,165,74,0.3); }',
      '[data-theme="dark"] .sidebar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }',
      '[data-theme="dark"] .toast { background: #2A2418; color: #E8E0D4; border-color: rgba(255,255,255,0.08); }',
      '[data-theme="dark"] .overlay { background: rgba(10,8,6,0.7); }',
      '[data-theme="dark"] .modal { background: #1E1C18; border-color: rgba(255,255,255,0.06); }',
      '[data-theme="dark"] .sb-section-toggle { color: rgba(232,224,212,0.4); }',
      '[data-theme="dark"] .sb-section-toggle:hover { color: rgba(232,224,212,0.7); }',
      '[data-theme="dark"] .avail-day { background: #1C1A16; border-color: rgba(255,255,255,0.06); }',
      '[data-theme="dark"] .cal-day { background: #1C1A16; border-color: rgba(255,255,255,0.04); }',
      '[data-theme="dark"] .cal-dow { color: #A89070; }',
      '[data-theme="dark"] hr { border-color: rgba(255,255,255,0.06); }',
      '[data-theme="dark"] a { color: var(--gold); }',
      '',
      '/* Text size overrides */',
      '[data-text-size="small"] { font-size: 14px; }',
      '[data-text-size="small"] .portal-main { font-size: 0.9rem; }',
      '[data-text-size="small"] .p-header h2 { font-size: 1.6rem; }',
      '[data-text-size="small"] .stat-num { font-size: 1.5rem; }',
      '[data-text-size="large"] { font-size: 18px; }',
      '[data-text-size="large"] .portal-main { font-size: 1.1rem; }',
      '[data-text-size="large"] .p-header h2 { font-size: 2.4rem; }',
      '[data-text-size="large"] .stat-num { font-size: 2.3rem; }',
      '[data-text-size="large"] .sb-item { font-size: 0.95rem; padding: 12px 14px; }',
      '[data-text-size="large"] .stat-lbl { font-size: 0.82rem; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ── Settings Drawer HTML ──────────────── */
  function injectSettingsDrawer() {
    if (document.getElementById('settingsDrawerOverlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'settingsDrawerOverlay';
    overlay.onclick = function(e) { if (e.target === overlay) closeSettings(); };

    var s = settings;
    var role = (window.HHP_Auth && window.HHP_Auth.currentRole) || 'client';

    // Build notification options based on role
    var notifHTML = '';
    notifHTML += buildToggle('notifBooking', 'Booking Updates', 'Confirmations, cancellations & changes', s.notifBooking);
    notifHTML += buildToggle('notifReminder', 'Appointment Reminders', 'Reminders before upcoming visits', s.notifReminder);
    notifHTML += buildToggle('notifMessages', 'New Messages', 'Alert when you receive a message', s.notifMessages);
    notifHTML += buildToggle('notifReports', 'Service Reports', 'Walk reports & service completions', s.notifReports);

    // Default view options based on role
    var viewOpts = '<option value="auto">Auto (last visited)</option>';
    if (role === 'client') {
      viewOpts += '<option value="c-dash"' + (s.defaultView === 'c-dash' ? ' selected' : '') + '>Home</option>';
      viewOpts += '<option value="c-pets"' + (s.defaultView === 'c-pets' ? ' selected' : '') + '>My Pets</option>';
      viewOpts += '<option value="c-appts"' + (s.defaultView === 'c-appts' ? ' selected' : '') + '>Appointments</option>';
      viewOpts += '<option value="c-msgs"' + (s.defaultView === 'c-msgs' ? ' selected' : '') + '>Messages</option>';
      viewOpts += '<option value="c-cal"' + (s.defaultView === 'c-cal' ? ' selected' : '') + '>Calendar</option>';
      viewOpts += '<option value="c-general"' + (s.defaultView === 'c-general' ? ' selected' : '') + '>General</option>';
    } else if (role === 'staff') {
      viewOpts += '<option value="s-sched"' + (s.defaultView === 's-sched' ? ' selected' : '') + '>My Schedule</option>';
      viewOpts += '<option value="s-clients"' + (s.defaultView === 's-clients' ? ' selected' : '') + '>My Clients</option>';
      viewOpts += '<option value="s-msgs"' + (s.defaultView === 's-msgs' ? ' selected' : '') + '>Messages</option>';
    } else {
      viewOpts += '<option value="o-overview"' + (s.defaultView === 'o-overview' ? ' selected' : '') + '>Overview</option>';
      viewOpts += '<option value="o-sched"' + (s.defaultView === 'o-sched' ? ' selected' : '') + '>Master Schedule</option>';
      viewOpts += '<option value="o-msgs"' + (s.defaultView === 'o-msgs' ? ' selected' : '') + '>Messages</option>';
      viewOpts += '<option value="o-activity"' + (s.defaultView === 'o-activity' ? ' selected' : '') + '>Activity Log</option>';
    }

    overlay.innerHTML = [
      '<div id="settingsDrawer">',
      '  <div class="settings-header">',
      '    <div style="display:flex;align-items:center;gap:10px">',
      '      <span style="font-size:1.4rem">⚙️</span>',
      '      <div>',
      '        <div style="font-weight:700;font-size:1.15rem">Settings</div>',
      '        <div style="font-size:0.78rem;opacity:0.6">Customize your experience</div>',
      '      </div>',
      '    </div>',
      '    <button onclick="HHP_Settings.close()" class="settings-close-btn">✕</button>',
      '  </div>',
      '  <div class="settings-body">',
      '',
      '    <!-- Appearance -->',
      '    <div class="settings-section">',
      '      <div class="settings-section-title">Appearance</div>',
      '',
      '      <div class="settings-row">',
      '        <div class="settings-row-info">',
      '          <div class="settings-row-label">Theme</div>',
      '          <div class="settings-row-desc">Switch between light and dark mode</div>',
      '        </div>',
      '        <div class="settings-toggle-group" id="settTheme">',
      '          <button class="stg-btn' + (s.theme === 'light' ? ' active' : '') + '" data-val="light" onclick="HHP_Settings.set(\'theme\',\'light\')">☀️ Light</button>',
      '          <button class="stg-btn' + (s.theme === 'dark' ? ' active' : '') + '" data-val="dark" onclick="HHP_Settings.set(\'theme\',\'dark\')">🌙 Dark</button>',
      '        </div>',
      '      </div>',
      '',
      '      <div class="settings-row">',
      '        <div class="settings-row-info">',
      '          <div class="settings-row-label">Text Size</div>',
      '          <div class="settings-row-desc">Adjust text size for readability</div>',
      '        </div>',
      '        <div class="settings-toggle-group" id="settTextSize">',
      '          <button class="stg-btn' + (s.textSize === 'small' ? ' active' : '') + '" data-val="small" onclick="HHP_Settings.set(\'textSize\',\'small\')" style="font-size:0.72rem">A</button>',
      '          <button class="stg-btn' + (s.textSize === 'medium' ? ' active' : '') + '" data-val="medium" onclick="HHP_Settings.set(\'textSize\',\'medium\')">A</button>',
      '          <button class="stg-btn' + (s.textSize === 'large' ? ' active' : '') + '" data-val="large" onclick="HHP_Settings.set(\'textSize\',\'large\')" style="font-size:1.1rem">A</button>',
      '        </div>',
      '      </div>',
      '',
      '      <div class="settings-row">',
      '        <div class="settings-row-info">',
      '          <div class="settings-row-label">Time Format</div>',
      '          <div class="settings-row-desc">How times are displayed</div>',
      '        </div>',
      '        <div class="settings-toggle-group" id="settTimeFormat">',
      '          <button class="stg-btn' + (s.timeFormat === '12h' ? ' active' : '') + '" data-val="12h" onclick="HHP_Settings.set(\'timeFormat\',\'12h\')">12h</button>',
      '          <button class="stg-btn' + (s.timeFormat === '24h' ? ' active' : '') + '" data-val="24h" onclick="HHP_Settings.set(\'timeFormat\',\'24h\')">24h</button>',
      '        </div>',
      '      </div>',
      '    </div>',
      '',
      '    <!-- Navigation -->',
      '    <div class="settings-section">',
      '      <div class="settings-section-title">Navigation</div>',
      '      <div class="settings-row">',
      '        <div class="settings-row-info">',
      '          <div class="settings-row-label">Default Panel</div>',
      '          <div class="settings-row-desc">Which panel to open when you sign in</div>',
      '        </div>',
      '        <select id="settDefaultView" onchange="HHP_Settings.set(\'defaultView\',this.value)" class="settings-select">',
      viewOpts,
      '        </select>',
      '      </div>',
      '    </div>',
      '',
      '    <!-- Notifications -->',
      '    <div class="settings-section">',
      '      <div class="settings-section-title">Notifications</div>',
      notifHTML,
      '    </div>',
      '',
      '    <!-- Account -->',
      '    <div class="settings-section">',
      '      <div class="settings-section-title">Account</div>',
      '      <button class="settings-account-btn" onclick="HHP_Settings.goToProfile()">',
      '        <span>👤</span>',
      '        <div style="flex:1;text-align:left">',
      '          <div style="font-weight:600;font-size:0.88rem" id="settingsUserName">My Profile</div>',
      '          <div style="font-size:0.75rem;opacity:0.6" id="settingsUserEmail">Edit your name, phone & photo</div>',
      '        </div>',
      '        <span style="opacity:0.4;font-size:0.85rem">→</span>',
      '      </button>',
      '      <button class="settings-account-btn" style="color:var(--rose);margin-top:6px" onclick="if(typeof HHP_Auth!==\'undefined\')HHP_Auth.logout()">',
      '        <span>🚪</span>',
      '        <div style="flex:1;text-align:left">',
      '          <div style="font-weight:600;font-size:0.88rem">Sign Out</div>',
      '        </div>',
      '      </button>',
      '    </div>',
      '',
      '    <div style="text-align:center;padding:16px 0 8px;font-size:0.7rem;opacity:0.35">Housley Happy Paws v2.0</div>',
      '  </div>',
      '</div>',
    ].join('\n');

    document.body.appendChild(overlay);

    // Populate user info
    setTimeout(function() {
      var user = window.HHP_Auth && window.HHP_Auth.currentUser;
      if (user) {
        var nameEl = document.getElementById('settingsUserName');
        var emailEl = document.getElementById('settingsUserEmail');
        if (nameEl && user.full_name) nameEl.textContent = user.full_name;
        if (emailEl && user.email) emailEl.textContent = user.email;
      }
    }, 100);

    // Animate in
    requestAnimationFrame(function() {
      overlay.style.opacity = '1';
      var drawer = document.getElementById('settingsDrawer');
      if (drawer) drawer.style.transform = 'translateX(0)';
    });
  }

  function buildToggle(key, label, desc, isOn) {
    return [
      '<div class="settings-row">',
      '  <div class="settings-row-info">',
      '    <div class="settings-row-label">' + label + '</div>',
      '    <div class="settings-row-desc">' + desc + '</div>',
      '  </div>',
      '  <label class="settings-switch">',
      '    <input type="checkbox" id="sett_' + key + '"' + (isOn ? ' checked' : '') + ' onchange="HHP_Settings.set(\'' + key + '\',this.checked)">',
      '    <span class="settings-slider"></span>',
      '  </label>',
      '</div>',
    ].join('\n');
  }

  /* ── Open / Close ──────────────────────── */
  function openSettings() {
    settings = loadSettings(); // refresh
    // Remove old drawer and re-inject with fresh state
    var old = document.getElementById('settingsDrawerOverlay');
    if (old) old.remove();
    injectSettingsDrawer();
  }

  function closeSettings() {
    var overlay = document.getElementById('settingsDrawerOverlay');
    var drawer = document.getElementById('settingsDrawer');
    if (!overlay) return;
    overlay.style.opacity = '0';
    if (drawer) drawer.style.transform = 'translateX(100%)';
    setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 300);
  }

  /* ── Set a setting value ───────────────── */
  function setSetting(key, value) {
    settings[key] = value;
    saveSettings(settings);

    // Apply immediately
    if (key === 'theme') {
      applyTheme(value);
      // Update toggle group UI
      updateToggleGroup('settTheme', value);
    } else if (key === 'textSize') {
      applyTextSize(value);
      updateToggleGroup('settTextSize', value);
    } else if (key === 'timeFormat') {
      applyTimeFormat(value);
      updateToggleGroup('settTimeFormat', value);
    } else if (key === 'defaultView') {
      // Saved — will take effect on next sign-in
      if (typeof toast === 'function') toast('✅ Default panel updated');
    } else if (key.startsWith('notif')) {
      // Notification preference saved
    }
  }

  function updateToggleGroup(groupId, activeVal) {
    var group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.stg-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-val') === activeVal);
    });
  }

  /* ── Navigate to profile ───────────────── */
  function goToProfile() {
    closeSettings();
    var role = (window.HHP_Auth && window.HHP_Auth.currentRole) || 'client';
    // Each portal has a profile / dashboard panel
    setTimeout(function() {
      if (role === 'client' && typeof sTab === 'function') sTab('c', 'c-dash');
      else if (role === 'staff' && typeof sTab === 'function') sTab('s', 's-sched');
      else if (role === 'owner' && typeof sTab === 'function') sTab('o', 'o-overview');
    }, 350);
  }

  /* ── Get default view for sign-in ──────── */
  function getDefaultView() {
    var s = loadSettings();
    return s.defaultView || 'auto';
  }

  /* ── Inject Settings Buttons into Sidebars ── */
  function injectSettingsButtons() {
    // Client sidebar — Settings is now inside the General tab, skip standalone button
    // Staff sidebar
    var sSidebar = document.querySelector('#pg-staff .sidebar');
    if (sSidebar && !sSidebar.querySelector('.sb-settings-btn')) {
      var sBtn = createSettingsButton();
      sSidebar.appendChild(sBtn);
    }
    // Owner sidebar
    var oSidebar = document.querySelector('#pg-owner .sidebar');
    if (oSidebar && !oSidebar.querySelector('.sb-settings-btn')) {
      var oBtn = createSettingsButton();
      oSidebar.appendChild(oBtn);
    }
  }

  function createSettingsButton() {
    var wrap = document.createElement('div');
    wrap.className = 'sb-settings-btn';
    wrap.innerHTML = '<button class="sb-item" onclick="HHP_Settings.open()" style="margin-top:auto;opacity:0.7;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;margin-top:12px"><span class="sb-item-icon">⚙️</span>Settings</button>';
    return wrap;
  }

  /* ── Inject CSS ────────────────────────── */
  function injectCSS() {
    if (document.getElementById('hhp-settings-css')) return;
    var style = document.createElement('style');
    style.id = 'hhp-settings-css';
    style.textContent = [
      '/* Settings Drawer Overlay */',
      '#settingsDrawerOverlay {',
      '  position:fixed; top:0; left:0; right:0; bottom:0;',
      '  background:rgba(0,0,0,0.45); z-index:9999;',
      '  opacity:0; transition:opacity 0.3s;',
      '  backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px);',
      '}',
      '#settingsDrawer {',
      '  position:absolute; top:0; right:0; bottom:0;',
      '  width:380px; max-width:92vw;',
      '  background:var(--cream,#FDFAF5);',
      '  transform:translateX(100%); transition:transform 0.35s cubic-bezier(0.22,1,0.36,1);',
      '  display:flex; flex-direction:column;',
      '  box-shadow:-8px 0 40px rgba(0,0,0,0.15);',
      '}',
      '[data-theme="dark"] #settingsDrawer { background:#1C1A16; }',
      '.settings-header {',
      '  display:flex; align-items:center; justify-content:space-between;',
      '  padding:20px 22px 16px; border-bottom:1px solid var(--border);',
      '  flex-shrink:0;',
      '}',
      '.settings-close-btn {',
      '  width:36px; height:36px; border-radius:50%;',
      '  border:none; background:var(--warm); color:var(--ink);',
      '  font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:center;',
      '  transition:all 0.15s;',
      '}',
      '.settings-close-btn:hover { background:var(--rose-light); color:var(--rose); }',
      '.settings-body {',
      '  flex:1; overflow-y:auto; padding:10px 22px 30px;',
      '  -webkit-overflow-scrolling:touch;',
      '}',
      '.settings-section {',
      '  margin-top:20px; padding-bottom:16px;',
      '  border-bottom:1px solid var(--border);',
      '}',
      '.settings-section:last-of-type { border-bottom:none; }',
      '.settings-section-title {',
      '  font-size:0.68rem; font-weight:700; text-transform:uppercase;',
      '  letter-spacing:0.1em; color:var(--mid); margin-bottom:12px;',
      '}',
      '.settings-row {',
      '  display:flex; align-items:center; justify-content:space-between;',
      '  gap:12px; padding:10px 0;',
      '}',
      '.settings-row-info { flex:1; min-width:0; }',
      '.settings-row-label { font-size:0.88rem; font-weight:600; color:var(--ink); }',
      '.settings-row-desc { font-size:0.74rem; color:var(--mid); margin-top:1px; }',
      '',
      '/* Toggle group buttons */',
      '.settings-toggle-group {',
      '  display:flex; gap:0; border-radius:8px; overflow:hidden;',
      '  border:1.5px solid var(--border); flex-shrink:0;',
      '}',
      '.stg-btn {',
      '  padding:7px 12px; font-size:0.78rem; font-weight:600;',
      '  border:none; background:transparent; color:var(--mid);',
      '  cursor:pointer; transition:all 0.15s; font-family:inherit;',
      '  white-space:nowrap;',
      '}',
      '.stg-btn:not(:last-child) { border-right:1.5px solid var(--border); }',
      '.stg-btn.active { background:var(--gold); color:white; }',
      '.stg-btn:hover:not(.active) { background:var(--warm); color:var(--ink); }',
      '',
      '/* Select dropdown */',
      '.settings-select {',
      '  padding:8px 12px; border-radius:8px;',
      '  border:1.5px solid var(--border); background:var(--warm);',
      '  font-family:inherit; font-size:0.82rem; font-weight:500;',
      '  color:var(--ink); cursor:pointer; max-width:160px;',
      '}',
      '',
      '/* Toggle switch */',
      '.settings-switch {',
      '  position:relative; display:inline-block;',
      '  width:44px; height:24px; flex-shrink:0;',
      '}',
      '.settings-switch input { opacity:0; width:0; height:0; }',
      '.settings-slider {',
      '  position:absolute; cursor:pointer;',
      '  top:0; left:0; right:0; bottom:0;',
      '  background:var(--border); border-radius:24px;',
      '  transition:0.3s; border:1.5px solid rgba(0,0,0,0.05);',
      '}',
      '.settings-slider:before {',
      '  content:""; position:absolute;',
      '  height:18px; width:18px; left:2px; bottom:2px;',
      '  background:white; border-radius:50%; transition:0.3s;',
      '  box-shadow:0 1px 3px rgba(0,0,0,0.15);',
      '}',
      '.settings-switch input:checked + .settings-slider { background:var(--gold); border-color:var(--gold); }',
      '.settings-switch input:checked + .settings-slider:before { transform:translateX(20px); }',
      '',
      '/* Account button */',
      '.settings-account-btn {',
      '  display:flex; align-items:center; gap:12px;',
      '  width:100%; padding:12px 14px; border-radius:10px;',
      '  border:1.5px solid var(--border); background:var(--warm);',
      '  cursor:pointer; font-family:inherit; transition:all 0.15s;',
      '  color:var(--ink);',
      '}',
      '.settings-account-btn:hover { border-color:var(--gold); background:var(--gold-pale); }',
      '',
      '/* Mobile responsive */',
      '@media(max-width:600px) {',
      '  #settingsDrawer { width:100%; max-width:100vw; }',
      '  .settings-row { flex-wrap:wrap; }',
      '  .settings-toggle-group { margin-top:6px; }',
      '}',
      '',
      '/* Settings button in sidebar — push to bottom */',
      '.sb-settings-btn { margin-top:auto; padding-top:8px; }',
      '.sidebar { display:flex; flex-direction:column; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ── Init ───────────────────────────────── */
  function init() {
    injectCSS();
    injectDarkModeCSS();
    applyAll(settings);
    // Wait for DOM then inject buttons
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        injectSettingsButtons();
      });
    } else {
      injectSettingsButtons();
    }
    // Try to sync from Supabase after auth is ready
    setTimeout(function() {
      loadFromSupabase(function(merged) {
        settings = merged;
        applyAll(settings);
      });
    }, 2000);
  }

  /* ── Early apply (before DOM) ──────────── */
  // Apply theme + text size immediately from localStorage to prevent flash
  applyTheme(settings.theme);
  applyTextSize(settings.textSize);

  /* ── Public API ────────────────────────── */
  window.HHP_Settings = {
    open: openSettings,
    close: closeSettings,
    set: setSetting,
    get: function(key) { return settings[key]; },
    getAll: loadSettings,
    goToProfile: goToProfile,
    getDefaultView: getDefaultView,
    reinjectButtons: injectSettingsButtons,
    init: init
  };

  // Auto-init
  init();

})();
