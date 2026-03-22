// ── HHP_Customizer v2 — Full overview customization + sidebar reorder ──
// Every section on every portal overview is now a widget.
// Widgets can be toggled, reordered, expanded to full-width, or opened in a detail popup.
(function() {
  'use strict';

  // ══════════════════════════════════════
  //  WIDGET REGISTRY — every overview section, all portals
  // ══════════════════════════════════════
  // 'domId' = existing element ID to reparent (null = dynamic content)
  // 'renderFn' = function name for dynamic widgets
  // 'size' = 'half' (1 col) or 'full' (2 col span)

  var WIDGETS = {
    client: [
      { wid: 'cw-stats',     icon: '📊', label: 'My Stats',             domId: null,                       renderFn: '_rwClientStats',    size: 'full',  preset: true },
      { wid: 'cw-upcoming',  icon: '📅', label: 'Upcoming Appointments', domId: 'clientDashUpcoming',       renderFn: '_rwClientUpcoming', size: 'half',  preset: true },
      { wid: 'cw-notif',     icon: '🔔', label: 'Recent Notifications',  domId: 'clientDashNotifications', renderFn: '_rwClientNotif',    size: 'half',  preset: true },
      { wid: 'cw-pets',      icon: '🐾', label: 'My Pets',              domId: null,                       renderFn: '_rwClientPets',     size: 'half',  preset: false },
      { wid: 'cw-tracking',  icon: '🗺️', label: 'Live Tracking',        domId: null,                       renderFn: '_rwClientTracking', size: 'half',  preset: false },
      { wid: 'cw-photos',    icon: '📸', label: 'Photo Gallery',         domId: null,                       renderFn: '_rwClientPhotos',   size: 'half',  preset: false },
      { wid: 'cw-reports',   icon: '📋', label: 'Walk Reports',          domId: null,                       renderFn: '_rwClientReports',  size: 'half',  preset: false },
      { wid: 'cw-reviews',   icon: '⭐', label: 'My Reviews',            domId: null,                       renderFn: '_rwClientReviews',  size: 'half',  preset: false },
      { wid: 'cw-msgs',      icon: '💬', label: 'Messages',              domId: null,                       renderFn: '_rwClientMsgs',     size: 'half',  preset: false },
      { wid: 'cw-billing',   icon: '💳', label: 'Billing',               domId: null,                       renderFn: '_rwClientBilling',  size: 'half',  preset: false }
    ],
    staff: [
      { wid: 'sw-stats',     icon: '📊', label: 'My Stats',             domId: null,                       renderFn: '_rwStaffStats',     size: 'full',  preset: true },
      { wid: 'sw-jobs',      icon: '🦮', label: "This Week's Jobs",     domId: 'staffDashJobs',            renderFn: '_rwStaffJobs',      size: 'full',  preset: true },
      { wid: 'sw-clients',   icon: '👥', label: 'My Clients',           domId: null,                       renderFn: '_rwStaffClients',   size: 'half',  preset: false },
      { wid: 'sw-earnings',  icon: '💰', label: 'Earnings',             domId: null,                       renderFn: '_rwStaffEarnings',  size: 'half',  preset: false },
      { wid: 'sw-msgs',      icon: '💬', label: 'Messages',             domId: null,                       renderFn: '_rwStaffMsgs',      size: 'half',  preset: false },
      { wid: 'sw-cal',       icon: '📆', label: 'Calendar',             domId: null,                       renderFn: '_rwStaffCal',       size: 'half',  preset: false }
    ],
    owner: [
      { wid: 'ow-banner',    icon: '👑', label: 'Welcome Banner',       domId: null,                       renderFn: '_rwOwnerBanner',    size: 'full',  preset: true },
      { wid: 'ow-alerts',    icon: '🔔', label: 'Alerts & Messages',    domId: 'hhpAlertsCard',            renderFn: '_rwOwnerAlerts',    size: 'half',  preset: true },
      { wid: 'ow-weekstats', icon: '📊', label: 'This Week at a Glance',domId: null,                       renderFn: '_rwOwnerWeekStats', size: 'half',  preset: true },
      { wid: 'ow-requests',  icon: '📋', label: 'Booking Requests',     domId: 'hhpAdminDashboard',        renderFn: '_rwOwnerRequests',  size: 'full',  preset: true },
      { wid: 'ow-today',     icon: '📅', label: "Today's Schedule",     domId: null,                       renderFn: '_rwOwnerToday',     size: 'full',  preset: true },
      { wid: 'ow-clients',   icon: '👥', label: 'All Clients',          domId: null,                       renderFn: '_rwOwnerClients',   size: 'half',  preset: false },
      { wid: 'ow-staff',     icon: '🧑‍🤝‍🧑', label: 'Staff Team',           domId: null,                       renderFn: '_rwOwnerStaff',     size: 'half',  preset: false },
      { wid: 'ow-reviews',   icon: '⭐', label: 'Reviews',              domId: null,                       renderFn: '_rwOwnerReviews',   size: 'half',  preset: false },
      { wid: 'ow-payments',  icon: '💳', label: 'Payments',             domId: null,                       renderFn: '_rwOwnerPayments',  size: 'half',  preset: false },
      { wid: 'ow-deals',     icon: '🏷️', label: 'Specials & Deals',     domId: null,                       renderFn: '_rwOwnerDeals',     size: 'half',  preset: false },
      { wid: 'ow-photos',    icon: '🖼️', label: 'Photos & Media',       domId: null,                       renderFn: '_rwOwnerPhotos',    size: 'half',  preset: false },
      { wid: 'ow-activity',  icon: '📜', label: 'Activity Log',         domId: null,                       renderFn: '_rwOwnerActivity',  size: 'half',  preset: false }
    ]
  };

  // Default visible widgets per portal (by wid)
  function _defaults(portal) {
    return (WIDGETS[portal] || []).filter(function(w) { return w.preset; }).map(function(w) { return w.wid; });
  }

  // ── STATE ──
  var _prefs = {};
  var _editMode = false;
  var _saving = false;

  // ── HELPERS ──
  function _getSB() { return window.HHP_Auth && window.HHP_Auth.supabase; }
  function _getUser() { return window.HHP_Auth && window.HHP_Auth.currentUser; }
  function _getPortal() {
    if (!window.HHP_Auth || !window.HHP_Auth.currentUser) return null;
    var role = window.HHP_Auth.currentRole;
    if (role === 'owner') return 'owner';
    if (role === 'staff') return 'staff';
    if (role === 'client') return 'client';
    return null;
  }

  // ══════════════════════════════════════
  //  PREFERENCES — load / save to Supabase
  // ══════════════════════════════════════

  async function _loadPrefs() {
    var sb = _getSB(); var user = _getUser();
    if (!sb || !user) return;
    try {
      var { data } = await sb.from('user_layout_prefs').select('*').eq('user_id', user.id);
      (data || []).forEach(function(row) {
        _prefs[row.portal] = {
          sidebar_order: row.sidebar_order || [],
          widgets: row.overview_widgets || [],
          sizes: row.sidebar_order ? (row.sidebar_order.__sizes || {}) : {} // piggyback sizes on sidebar_order JSON
        };
      });
    } catch (e) { console.warn('Customizer: load error', e); }
  }

  async function _savePrefs(portal) {
    if (_saving) return;
    _saving = true;
    var sb = _getSB(); var user = _getUser();
    if (!sb || !user) { _saving = false; return; }
    var p = _prefs[portal] || {};
    try {
      var sidebarData = p.sidebar_order || [];
      // Store sizes inside sidebar_order JSON as a special key
      if (p.sizes && Object.keys(p.sizes).length > 0) {
        sidebarData = (p.sidebar_order || []).slice();
        sidebarData.__sizes = p.sizes;
      }
      await sb.from('user_layout_prefs').upsert({
        user_id: user.id,
        portal: portal,
        sidebar_order: sidebarData,
        overview_widgets: p.widgets || [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,portal' });
    } catch (e) { console.warn('Customizer: save error', e); }
    _saving = false;
  }

  function _getActiveWidgets(portal) {
    if (_prefs[portal] && _prefs[portal].widgets && _prefs[portal].widgets.length > 0) {
      return _prefs[portal].widgets;
    }
    return _defaults(portal);
  }

  function _getWidgetSize(portal, wid) {
    if (_prefs[portal] && _prefs[portal].sizes && _prefs[portal].sizes[wid]) {
      return _prefs[portal].sizes[wid];
    }
    var def = (WIDGETS[portal] || []).find(function(w) { return w.wid === wid; });
    return def ? def.size : 'half';
  }

  function _setWidgetSize(portal, wid, size) {
    if (!_prefs[portal]) _prefs[portal] = { sidebar_order: [], widgets: [], sizes: {} };
    if (!_prefs[portal].sizes) _prefs[portal].sizes = {};
    _prefs[portal].sizes[wid] = size;
    _savePrefs(portal);
  }

  // ══════════════════════════════════════
  //  SIDEBAR DRAG-AND-DROP
  // ══════════════════════════════════════

  var _drag = { active: false, el: null, ph: null, offsetY: 0, holdTimer: null, container: null, portal: null };

  function _initSidebarDrag(portal) {
    var pgId = portal === 'client' ? 'pg-client' : portal === 'staff' ? 'pg-staff' : 'pg-owner';
    var sidebar = document.querySelector('#' + pgId + ' .sidebar');
    if (!sidebar) return;

    // Prevent ALL text selection in sidebar
    sidebar.style.userSelect = 'none';
    sidebar.style.webkitUserSelect = 'none';

    var items = sidebar.querySelectorAll('.sb-nav-group .sb-item');
    items.forEach(function(item) {
      item.style.userSelect = 'none';
      item.style.webkitUserSelect = 'none';

      // Add drag handle if not present
      if (!item.querySelector('.sb-drag-handle')) {
        var h = document.createElement('span');
        h.className = 'sb-drag-handle';
        h.innerHTML = '⋮⋮';
        h.style.cssText = 'opacity:0;font-size:0.65rem;color:rgba(255,255,255,0.3);position:absolute;left:3px;top:50%;transform:translateY(-50%);transition:opacity 0.2s;pointer-events:none;letter-spacing:-1px';
        item.style.position = 'relative';
        item.style.paddingLeft = '20px';
        item.insertBefore(h, item.firstChild);
      }

      // Long-press to start drag (400ms to avoid interfering with scroll)
      item.addEventListener('pointerdown', function(e) {
        if (e.button !== 0) return;
        var self = this;
        var startX = e.clientX, startY = e.clientY;
        _drag.holdTimer = setTimeout(function() { _startSidebarDrag(self, e, portal, sidebar); }, 400);
        // If pointer moves > 8px before hold fires, cancel (user is scrolling)
        var moveCancel = function(me) {
          if (Math.abs(me.clientX - startX) > 8 || Math.abs(me.clientY - startY) > 8) {
            _cancelHold();
            item.removeEventListener('pointermove', moveCancel);
          }
        };
        item.addEventListener('pointermove', moveCancel);
        item.addEventListener('pointerup', function() { _cancelHold(); item.removeEventListener('pointermove', moveCancel); }, { once: true });
        item.addEventListener('pointercancel', function() { _cancelHold(); item.removeEventListener('pointermove', moveCancel); }, { once: true });
      });
    });

    // Show handles on hover
    sidebar.addEventListener('mouseenter', function() { sidebar.querySelectorAll('.sb-drag-handle').forEach(function(h) { h.style.opacity = '1'; }); });
    sidebar.addEventListener('mouseleave', function() { if (!_drag.active) sidebar.querySelectorAll('.sb-drag-handle').forEach(function(h) { h.style.opacity = '0'; }); });
  }

  function _cancelHold() {
    if (_drag.holdTimer) { clearTimeout(_drag.holdTimer); _drag.holdTimer = null; }
  }

  function _startSidebarDrag(el, e, portal, sidebar) {
    _drag.active = true; _drag.el = el; _drag.portal = portal; _drag.container = el.parentElement;
    var rect = el.getBoundingClientRect();
    _drag.offsetY = e.clientY - rect.top;

    var ph = document.createElement('div');
    ph.className = 'sb-drag-placeholder';
    ph.style.cssText = 'height:' + rect.height + 'px;background:rgba(200,150,62,0.15);border:1.5px dashed rgba(200,150,62,0.4);border-radius:6px;margin:2px 0';
    _drag.ph = ph;
    el.parentElement.insertBefore(ph, el);

    el.style.cssText += ';position:fixed;left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width + 'px;z-index:10000;box-shadow:0 8px 32px rgba(0,0,0,0.35);opacity:0.92;pointer-events:none;transform:scale(1.04);transition:none';

    document.addEventListener('pointermove', _onSidebarDragMove);
    document.addEventListener('pointerup', _onSidebarDragEnd);
    document.body.style.userSelect = 'none';
    if (navigator.vibrate) navigator.vibrate(30);
  }

  function _onSidebarDragMove(e) {
    if (!_drag.active) return;
    e.preventDefault();
    _drag.el.style.top = (e.clientY - _drag.offsetY) + 'px';
    var siblings = Array.from(_drag.container.querySelectorAll('.sb-item:not([style*="position:fixed"]):not([style*="position: fixed"]), .sb-drag-placeholder'));
    for (var i = 0; i < siblings.length; i++) {
      if (siblings[i] === _drag.ph) continue;
      var mid = siblings[i].getBoundingClientRect().top + siblings[i].getBoundingClientRect().height / 2;
      if (e.clientY < mid) { _drag.container.insertBefore(_drag.ph, siblings[i]); return; }
    }
    _drag.container.appendChild(_drag.ph);
  }

  function _onSidebarDragEnd() {
    document.removeEventListener('pointermove', _onSidebarDragMove);
    document.removeEventListener('pointerup', _onSidebarDragEnd);
    document.body.style.userSelect = '';
    if (!_drag.active) return;
    if (_drag.ph && _drag.ph.parentElement) { _drag.container.insertBefore(_drag.el, _drag.ph); _drag.ph.remove(); }
    _drag.el.style.cssText = _drag.el.style.cssText.replace(/position:fixed[^;]*;|left:[^;]*;|top:[^;]*;|width:[^;]*;|z-index:[^;]*;|box-shadow:[^;]*;|opacity:[^;]*;|pointer-events:[^;]*;|transform:[^;]*;|transition:none;?/g, '');
    _drag.el.style.position = 'relative';
    // Save new order
    var order = [];
    _drag.container.querySelectorAll('.sb-item').forEach(function(it) {
      var m = (it.getAttribute('onclick') || '').match(/sTab\([^,]+,'([^']+)'\)/);
      if (m) order.push(m[1]);
    });
    if (!_prefs[_drag.portal]) _prefs[_drag.portal] = { sidebar_order: [], widgets: [], sizes: {} };
    _prefs[_drag.portal].sidebar_order = order;
    _savePrefs(_drag.portal);
    if (typeof toast === 'function') toast('✓ Order saved');
    _drag.active = false; _drag.el = null; _drag.ph = null;
  }

  function _applySidebarOrder(portal) {
    if (!_prefs[portal] || !_prefs[portal].sidebar_order || _prefs[portal].sidebar_order.length === 0) return;
    var pgId = portal === 'client' ? 'pg-client' : portal === 'staff' ? 'pg-staff' : 'pg-owner';
    var groups = document.querySelectorAll('#' + pgId + ' .sidebar .sb-nav-group');
    var order = _prefs[portal].sidebar_order;
    groups.forEach(function(group) {
      var items = Array.from(group.querySelectorAll('.sb-item'));
      if (items.length < 2) return;
      items.sort(function(a, b) {
        var aM = (a.getAttribute('onclick') || '').match(/sTab\([^,]+,'([^']+)'\)/);
        var bM = (b.getAttribute('onclick') || '').match(/sTab\([^,]+,'([^']+)'\)/);
        var aI = aM ? order.indexOf(aM[1]) : -1; var bI = bM ? order.indexOf(bM[1]) : -1;
        if (aI === -1) aI = 999; if (bI === -1) bI = 999;
        return aI - bI;
      });
      items.forEach(function(it) { group.appendChild(it); });
    });
  }

  // ══════════════════════════════════════
  //  OVERVIEW WIDGET RENDERING
  // ══════════════════════════════════════

  function _getOverviewEl(portal) {
    if (portal === 'client') return document.getElementById('c-dash');
    if (portal === 'staff') return document.getElementById('s-sched');
    if (portal === 'owner') return document.getElementById('o-overview');
    return null;
  }

  // Hide existing hardcoded overview content and replace with widget grid
  function _setupOverview(portal) {
    var el = _getOverviewEl(portal);
    if (!el || el.getAttribute('data-cust-setup')) return;
    el.setAttribute('data-cust-setup', '1');

    // Preserve the p-header
    var header = el.querySelector('.p-header');

    // Hide all existing children except header
    Array.from(el.children).forEach(function(child) {
      if (child === header) return;
      child.style.display = 'none';
      child.setAttribute('data-orig-overview', '1');
    });

    // Add customize toolbar
    var toolbar = document.createElement('div');
    toolbar.id = 'cust-toolbar-' + portal;
    toolbar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:14px';
    toolbar.innerHTML =
      '<div style="font-size:0.78rem;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:0.05em">📌 Your Overview</div>' +
      '<button id="cust-editbtn-' + portal + '" onclick="HHP_Customizer.toggleEdit()" ' +
      'style="background:none;border:1px solid var(--border);border-radius:8px;padding:5px 14px;font-size:0.78rem;font-weight:600;color:var(--mid);cursor:pointer;font-family:inherit;transition:all 0.2s">✏️ Customize</button>';

    // Widget grid
    var grid = document.createElement('div');
    grid.id = 'cust-grid-' + portal;
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:14px';

    el.appendChild(toolbar);
    el.appendChild(grid);
  }

  // ── Render all active widgets ──
  async function _renderWidgets(portal) {
    var grid = document.getElementById('cust-grid-' + portal);
    if (!grid) return;

    var activeWids = _getActiveWidgets(portal);
    var allW = WIDGETS[portal] || [];

    // Loading state
    grid.innerHTML = '<div style="grid-column:1/-1;padding:24px;text-align:center;color:var(--mid);font-size:0.85rem">Loading your overview...</div>';

    var html = '';
    for (var i = 0; i < activeWids.length; i++) {
      var wDef = allW.find(function(w) { return w.wid === activeWids[i]; });
      if (!wDef) continue;

      var size = _getWidgetSize(portal, wDef.wid);
      var renderer = _renderers[wDef.renderFn];
      var body = '';
      if (renderer) {
        try { body = await renderer(); } catch(e) { body = '<div style="color:var(--mid);font-size:0.82rem">Failed to load</div>'; }
      } else {
        body = '<div style="color:var(--mid);font-size:0.82rem">Loading...</div>';
      }
      html += _buildWidgetHTML(portal, wDef, body, size);
    }

    if (html === '') {
      html = '<div style="grid-column:1/-1;padding:30px;text-align:center;color:var(--mid);font-size:0.85rem;background:var(--warm);border-radius:12px;border:1.5px dashed var(--border)">No widgets visible. Click <strong>✏️ Customize</strong> to add sections to your overview.</div>';
    }

    grid.innerHTML = html;
  }

  function _buildWidgetHTML(portal, wDef, bodyHTML, size) {
    var isFullWidth = size === 'full';
    var spanStyle = isFullWidth ? 'grid-column:1/-1;' : '';
    var otherSize = isFullWidth ? 'half' : 'full';
    var sizeIcon = isFullWidth ? '⊟' : '⊞';
    var sizeTip = isFullWidth ? 'Shrink to half' : 'Expand to full width';

    // Navigate to the relevant panel on click (find matching panel from PANELS if there's a sTab)
    var goToPanel = '';
    var panelMap = {
      'cw-upcoming': "sTab('c','c-appts')", 'cw-pets': "sTab('c','c-pets')", 'cw-tracking': "sTab('c','c-track')",
      'cw-photos': "sTab('c','c-photos')", 'cw-reports': "sTab('c','c-reports')", 'cw-reviews': "sTab('c','c-reviews')",
      'cw-msgs': "sTab('c','c-msgs')", 'cw-billing': "sTab('c','c-bill')",
      'sw-jobs': "sTab('s','s-jobs')", 'sw-clients': "sTab('s','s-clients')", 'sw-earnings': "sTab('s','s-earn')",
      'sw-msgs': "sTab('s','s-msgs')", 'sw-cal': "sTab('s','s-cal')",
      'ow-requests': "sTab('o','o-sched')", 'ow-clients': "sTab('o','o-clients')", 'ow-staff': "sTab('o','o-staff')",
      'ow-reviews': "sTab('o','o-reviews')", 'ow-payments': "sTab('o','o-payments')", 'ow-deals': "sTab('o','o-deals')",
      'ow-photos': "sTab('o','o-photos')", 'ow-activity': "sTab('o','o-activity')"
    };
    goToPanel = panelMap[wDef.wid] || '';

    return '<div class="cust-widget" data-wid="' + wDef.wid + '" style="' + spanStyle + 'background:white;border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.04);transition:all 0.2s">' +
      // Widget header
      '<div style="display:flex;align-items:center;gap:8px;padding:12px 14px 0;user-select:none">' +
        '<span style="font-size:1.1rem">' + wDef.icon + '</span>' +
        '<span style="font-size:0.78rem;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:0.04em;flex:1">' + wDef.label + '</span>' +
        // Size toggle
        '<button onclick="event.stopPropagation();HHP_Customizer.toggleSize(\'' + portal + '\',\'' + wDef.wid + '\',\'' + otherSize + '\')" title="' + sizeTip + '" ' +
          'style="background:none;border:none;cursor:pointer;font-size:1rem;color:var(--mid);padding:2px 4px;opacity:0.5;transition:opacity 0.15s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.5">' + sizeIcon + '</button>' +
        // Detail popup
        (goToPanel ? '<button onclick="event.stopPropagation();HHP_Customizer.openDetail(\'' + portal + '\',\'' + wDef.wid + '\')" title="Open detail view" ' +
          'style="background:none;border:none;cursor:pointer;font-size:0.85rem;color:var(--mid);padding:2px 4px;opacity:0.5;transition:opacity 0.15s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.5">🔍</button>' : '') +
        // Go to panel
        (goToPanel ? '<button onclick="event.stopPropagation();' + goToPanel + '" title="Go to full panel" ' +
          'style="background:none;border:none;cursor:pointer;font-size:0.7rem;color:var(--gold);font-weight:700;padding:2px 6px;opacity:0.6;transition:opacity 0.15s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.6">View →</button>' : '') +
      '</div>' +
      // Widget body
      '<div class="cust-widget-body" style="padding:10px 14px 14px">' + bodyHTML + '</div>' +
    '</div>';
  }

  // ══════════════════════════════════════
  //  DETAIL POPUP (bottom sheet)
  // ══════════════════════════════════════

  function _ensureDetailSheet() {
    if (document.getElementById('cust-detail-overlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'cust-detail-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;opacity:0;transition:opacity 0.25s';
    overlay.onclick = function(e) { if (e.target === overlay) _closeDetail(); };

    var sheet = document.createElement('div');
    sheet.id = 'cust-detail-sheet';
    sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:80vh;background:white;border-radius:20px 20px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,0.18);z-index:9999;overflow-y:auto;padding:0;transform:translateY(100%);transition:transform 0.3s ease';

    sheet.innerHTML =
      '<div style="padding:10px 0 4px;text-align:center;cursor:pointer" onclick="HHP_Customizer.closeDetail()">' +
        '<div style="width:40px;height:4px;background:#d0c8b8;border-radius:4px;margin:0 auto"></div>' +
      '</div>' +
      '<div id="cust-detail-content" style="padding:4px 20px 28px"></div>';

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
  }

  function _openDetail(portal, wid) {
    _ensureDetailSheet();
    var overlay = document.getElementById('cust-detail-overlay');
    var sheet = document.getElementById('cust-detail-sheet');
    var content = document.getElementById('cust-detail-content');
    if (!overlay || !content) return;

    var wDef = (WIDGETS[portal] || []).find(function(w) { return w.wid === wid; });
    if (!wDef) return;

    content.innerHTML = '<div style="text-align:center;padding:20px;color:var(--mid)">Loading...</div>';
    overlay.style.display = 'block';
    requestAnimationFrame(function() { overlay.style.opacity = '1'; if (sheet) sheet.style.transform = 'translateY(0)'; });

    // Render detailed version
    var detailFn = _detailRenderers[wDef.renderFn];
    if (detailFn) {
      detailFn().then(function(html) {
        content.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">' +
          '<span style="font-size:1.5rem">' + wDef.icon + '</span>' +
          '<h3 style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;margin:0">' + wDef.label + '</h3></div>' + html;
      });
    } else {
      // Fallback: show the widget content at larger size
      var renderer = _renderers[wDef.renderFn];
      if (renderer) {
        renderer().then(function(html) {
          content.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">' +
            '<span style="font-size:1.5rem">' + wDef.icon + '</span>' +
            '<h3 style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;margin:0">' + wDef.label + '</h3></div>' + html;
        });
      }
    }
  }

  function _closeDetail() {
    var overlay = document.getElementById('cust-detail-overlay');
    var sheet = document.getElementById('cust-detail-sheet');
    if (!overlay) return;
    overlay.style.opacity = '0';
    if (sheet) sheet.style.transform = 'translateY(100%)';
    setTimeout(function() { overlay.style.display = 'none'; }, 300);
  }

  // ══════════════════════════════════════
  //  EDIT MODE — toggle widgets on/off, reorder
  // ══════════════════════════════════════

  function _toggleEdit() {
    var portal = _getPortal();
    if (!portal) return;
    _editMode = !_editMode;

    var btn = document.getElementById('cust-editbtn-' + portal);
    var existing = document.getElementById('cust-picker-overlay');

    if (_editMode) {
      _buildPicker(portal);
      var overlay = document.getElementById('cust-picker-overlay');
      if (overlay) {
        overlay.style.display = 'block';
        requestAnimationFrame(function() {
          overlay.style.opacity = '1';
          var s = document.getElementById('cust-picker-sheet');
          if (s) s.style.transform = 'translateY(0)';
        });
      }
      if (btn) { btn.textContent = '✓ Done'; btn.style.background = 'var(--forest)'; btn.style.color = 'white'; btn.style.borderColor = 'var(--forest)'; }
    } else {
      if (existing) {
        existing.style.opacity = '0';
        var s = document.getElementById('cust-picker-sheet');
        if (s) s.style.transform = 'translateY(100%)';
        setTimeout(function() { if (existing.parentElement) existing.remove(); }, 300);
      }
      if (btn) { btn.textContent = '✏️ Customize'; btn.style.background = 'none'; btn.style.color = 'var(--mid)'; btn.style.borderColor = 'var(--border)'; }
    }
  }

  function _buildPicker(portal) {
    // Remove old picker if exists
    var old = document.getElementById('cust-picker-overlay');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'cust-picker-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;opacity:0;transition:opacity 0.25s';
    overlay.onclick = function(e) { if (e.target === overlay) _toggleEdit(); };

    var sheet = document.createElement('div');
    sheet.id = 'cust-picker-sheet';
    sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:80vh;background:white;border-radius:20px 20px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,0.18);z-index:9999;overflow-y:auto;padding:0;transform:translateY(100%);transition:transform 0.3s ease';

    var active = _getActiveWidgets(portal);
    var allW = WIDGETS[portal] || [];

    var listHTML = '';
    allW.forEach(function(w) {
      var isOn = active.indexOf(w.wid) !== -1;
      listHTML += '<div class="cust-pick-row" data-wid="' + w.wid + '" onclick="HHP_Customizer.toggleWidget(\'' + portal + '\',\'' + w.wid + '\')" ' +
        'style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;cursor:pointer;transition:background 0.15s;' +
        (isOn ? 'background:rgba(61,90,71,0.1);border:1.5px solid var(--forest)' : 'background:var(--warm);border:1.5px solid transparent') + '">' +
        '<div style="font-size:1.3rem;width:32px;text-align:center">' + w.icon + '</div>' +
        '<div style="flex:1"><div style="font-weight:700;font-size:0.9rem;color:var(--ink)">' + w.label + '</div></div>' +
        '<div style="width:40px;height:24px;border-radius:12px;background:' + (isOn ? 'var(--forest)' : '#ccc') + ';position:relative;transition:background 0.2s;flex-shrink:0">' +
          '<div style="width:20px;height:20px;border-radius:50%;background:white;position:absolute;top:2px;' + (isOn ? 'left:18px' : 'left:2px') + ';transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></div>' +
        '</div>' +
      '</div>';
    });

    sheet.innerHTML =
      '<div style="padding:10px 0 4px;text-align:center;cursor:pointer" onclick="HHP_Customizer.toggleEdit()">' +
        '<div style="width:40px;height:4px;background:#d0c8b8;border-radius:4px;margin:0 auto"></div>' +
      '</div>' +
      '<div style="padding:4px 20px 28px">' +
        '<h3 style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;margin-bottom:4px">Customize Your Overview</h3>' +
        '<p style="font-size:0.82rem;color:var(--mid);margin-bottom:16px">Toggle sections on or off. Use ⊞/⊟ on each widget to change its size.</p>' +
        '<div id="cust-picker-list" style="display:flex;flex-direction:column;gap:8px">' + listHTML + '</div>' +
        '<div style="display:flex;gap:10px;margin-top:18px">' +
          '<button onclick="HHP_Customizer.resetLayout()" style="flex:1;padding:12px;background:var(--warm);border:1px solid var(--border);border-radius:10px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;color:var(--mid)">↩ Reset Defaults</button>' +
          '<button onclick="HHP_Customizer.toggleEdit()" style="flex:1;padding:12px;background:var(--forest);color:white;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit">✓ Done</button>' +
        '</div>' +
      '</div>';

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
  }

  function _toggleWidget(portal, wid) {
    var active = _getActiveWidgets(portal).slice();
    var idx = active.indexOf(wid);
    if (idx !== -1) { active.splice(idx, 1); } else { active.push(wid); }
    if (!_prefs[portal]) _prefs[portal] = { sidebar_order: [], widgets: [], sizes: {} };
    _prefs[portal].widgets = active;
    _savePrefs(portal);
    // Refresh picker UI
    _buildPicker(portal);
    var overlay = document.getElementById('cust-picker-overlay');
    if (overlay) { overlay.style.display = 'block'; overlay.style.opacity = '1'; }
    var s = document.getElementById('cust-picker-sheet');
    if (s) s.style.transform = 'translateY(0)';
    // Re-render widgets
    _renderWidgets(portal);
  }

  function _toggleSize(portal, wid, newSize) {
    _setWidgetSize(portal, wid, newSize);
    _renderWidgets(portal);
  }

  function _resetLayout() {
    var portal = _getPortal();
    if (!portal) return;
    if (!_prefs[portal]) _prefs[portal] = {};
    _prefs[portal].widgets = _defaults(portal);
    _prefs[portal].sizes = {};
    _savePrefs(portal);
    _renderWidgets(portal);
    // Refresh picker if open
    if (_editMode) {
      _buildPicker(portal);
      var overlay = document.getElementById('cust-picker-overlay');
      if (overlay) { overlay.style.display = 'block'; overlay.style.opacity = '1'; }
      var s = document.getElementById('cust-picker-sheet');
      if (s) s.style.transform = 'translateY(0)';
    }
    if (typeof toast === 'function') toast('↩ Reset to defaults');
  }

  // ══════════════════════════════════════
  //  WIDGET RENDERERS — mini summaries
  // ══════════════════════════════════════

  var _renderers = {};
  var _detailRenderers = {};

  // Helper: stat row
  function _statRow(items) {
    var h = '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    items.forEach(function(s) {
      h += '<div style="flex:1;min-width:70px;background:var(--warm);border-radius:8px;padding:10px;text-align:center">' +
        '<div style="font-size:0.9rem">' + s.icon + '</div>' +
        '<div style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700" id="' + (s.statId || '') + '">' + (s.value || '—') + '</div>' +
        '<div style="font-size:0.68rem;font-weight:600;color:var(--mid);text-transform:uppercase;letter-spacing:0.03em">' + s.label + '</div></div>';
    });
    return h + '</div>';
  }

  // ── CLIENT RENDERERS ──
  _renderers._rwClientStats = async function() {
    return _statRow([
      { icon: '📅', label: 'Total Visits', statId: 'stat-totalVisits' },
      { icon: '🦮', label: 'Walks Done', statId: 'stat-walksDone' },
      { icon: '📋', label: 'Reports Received', statId: 'stat-avgRatingGiven' },
      { icon: '🐾', label: 'Pets in Care', statId: 'stat-petsInCare' }
    ]);
  };

  _renderers._rwClientUpcoming = async function() {
    var sb = _getSB(); var user = _getUser();
    if (!sb || !user) return '<div style="color:var(--mid);font-size:0.82rem">Sign in to see appointments</div>';
    try {
      var today = new Date().toISOString().split('T')[0];
      var { data } = await sb.from('booking_requests').select('id,service,preferred_date,status').eq('client_id',user.id).in('status',['accepted','confirmed']).gte('preferred_date',today).order('preferred_date').limit(4);
      if (!data || data.length === 0) return '<div style="color:var(--mid);font-size:0.82rem;padding:8px 0">No upcoming appointments</div>';
      return data.map(function(b) {
        var d = new Date(b.preferred_date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
        return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="font-weight:600">' + b.service + '</span><span style="color:var(--mid)">' + d + '</span></div>';
      }).join('');
    } catch(e) { return '<div style="color:var(--mid);font-size:0.82rem">Could not load</div>'; }
  };

  _renderers._rwClientNotif = async function() {
    return '<div id="clientDashNotifications" style="font-size:0.82rem;color:var(--mid)">Loading notifications...</div>';
  };

  _renderers._rwClientPets = async function() {
    var sb = _getSB(); var user = _getUser();
    if (!sb || !user) return '';
    try {
      var { count } = await sb.from('pets').select('id',{count:'exact',head:true}).eq('owner_id',user.id);
      return '<div style="text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:700">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">registered pets</div></div>';
    } catch(e) { return ''; }
  };

  _renderers._rwClientTracking = async function() { return '<div style="font-size:0.82rem;color:var(--mid)">Track your pet\'s walk in real time when a service is active.</div>'; };
  _renderers._rwClientPhotos = async function() {
    var sb = _getSB(); var user = _getUser();
    if (!sb || !user) return '';
    try {
      var { count } = await sb.from('walk_photos').select('id',{count:'exact',head:true}).eq('client_id',user.id);
      return '<div style="text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:700">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">photos from walks</div></div>';
    } catch(e) { return ''; }
  };
  _renderers._rwClientReports = async function() {
    var sb = _getSB(); var user = _getUser();
    if (!sb || !user) return '';
    try {
      var { count } = await sb.from('walk_reports').select('id',{count:'exact',head:true}).eq('client_id',user.id);
      return '<div style="text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:700">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">reports received</div></div>';
    } catch(e) { return ''; }
  };
  _renderers._rwClientReviews = async function() {
    var sb = _getSB(); var user = _getUser();
    if (!sb || !user) return '';
    try {
      var { count } = await sb.from('reviews').select('id',{count:'exact',head:true}).eq('reviewer_id',user.id);
      return '<div style="text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:700">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">reviews left</div></div>';
    } catch(e) { return ''; }
  };
  _renderers._rwClientMsgs = async function() { return '<div style="font-size:0.82rem;color:var(--mid)">View conversations with your pet care provider.</div>'; };
  _renderers._rwClientBilling = async function() { return '<div style="font-size:0.82rem;color:var(--mid)">Manage payment methods and view receipts.</div>'; };

  // ── STAFF RENDERERS ──
  _renderers._rwStaffStats = async function() {
    return _statRow([
      { icon: '📅', label: 'This Week', statId: 'stat-staffThisWeek' },
      { icon: '✅', label: 'All Time', statId: 'stat-staffAllTime' },
      { icon: '📋', label: 'Reports Sent', statId: 'stat-staffYourRating' },
      { icon: '💰', label: 'This Month', statId: 'stat-staffThisMonth' }
    ]);
  };

  _renderers._rwStaffJobs = async function() {
    return '<div id="staffDashJobs" style="font-size:0.82rem;color:var(--mid)">Loading this week\'s jobs...</div>';
  };

  _renderers._rwStaffClients = async function() {
    var sb = _getSB();
    if (!sb) return '';
    try {
      var today = new Date().toISOString().split('T')[0];
      var { data } = await sb.from('booking_requests').select('contact_name').in('status',['accepted','confirmed']).gte('preferred_date',today).limit(50);
      var names = []; (data||[]).forEach(function(b){ if(b.contact_name && names.indexOf(b.contact_name)===-1) names.push(b.contact_name); });
      return '<div style="text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:700">' + names.length + '</div><div style="font-size:0.75rem;color:var(--mid)">active clients</div></div>';
    } catch(e) { return ''; }
  };
  _renderers._rwStaffEarnings = async function() {
    var sb = _getSB();
    if (!sb) return '';
    try {
      var { count } = await sb.from('booking_requests').select('id',{count:'exact',head:true}).eq('status','completed');
      return '<div style="text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:700">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">jobs completed</div></div>';
    } catch(e) { return ''; }
  };
  _renderers._rwStaffMsgs = async function() { return '<div style="font-size:0.82rem;color:var(--mid)">Messages from clients and the owner.</div>'; };
  _renderers._rwStaffCal = async function() { return '<div style="font-size:0.82rem;color:var(--mid)">View your schedule on a calendar.</div>'; };

  // ── OWNER RENDERERS ──
  _renderers._rwOwnerBanner = async function() {
    return '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
      '<div><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;font-weight:700;color:var(--ink)">Good morning, Rachel 🐾</div>' +
      '<div style="font-size:0.82rem;color:var(--mid)">Your business is growing beautifully.</div></div>' +
      '<button class="btn btn-gold btn-sm" onclick="openModal(\'announceModal\')">📢 Post Announcement</button></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
        '<div style="flex:1;min-width:60px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700" id="stat-activeClients">—</div><div style="font-size:0.65rem;color:var(--mid);text-transform:uppercase">Active Clients</div></div>' +
        '<div style="flex:1;min-width:60px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700" id="stat-newSignups">—</div><div style="font-size:0.65rem;color:var(--mid);text-transform:uppercase">New Sign-ups</div></div>' +
        '<div style="flex:1;min-width:60px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700" id="stat-bookingsThisMonth">—</div><div style="font-size:0.65rem;color:var(--mid);text-transform:uppercase">This Month</div></div>' +
        '<div style="flex:1;min-width:60px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700" id="stat-avgRating">—</div><div style="font-size:0.65rem;color:var(--mid);text-transform:uppercase">Reports Sent</div></div>' +
        '<div style="flex:1;min-width:60px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700" id="stat-todayJobs">—</div><div style="font-size:0.65rem;color:var(--mid);text-transform:uppercase">Today\'s Jobs</div></div>' +
      '</div>';
  };

  _renderers._rwOwnerAlerts = async function() {
    return '<div id="hhpAlertsCard"><div class="card-title" style="margin-bottom:14px">🔔 Alerts & Messages</div><div style="padding:12px;text-align:center;color:var(--mid);font-size:0.82rem">Loading...</div></div>';
  };

  _renderers._rwOwnerWeekStats = async function() {
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">' +
      '<div style="background:var(--gold-pale);border-radius:8px;padding:12px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.6rem;font-weight:700" id="stat-jobsThisWeek">—</div><div style="font-size:0.68rem;font-weight:600;color:var(--mid);text-transform:uppercase">Jobs This Week</div></div>' +
      '<div style="background:var(--forest-pale);border-radius:8px;padding:12px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.6rem;font-weight:700" id="stat-weekRevenue">—</div><div style="font-size:0.68rem;font-weight:600;color:var(--mid);text-transform:uppercase">Week Revenue</div></div>' +
      '<div style="background:var(--rose-pale);border-radius:8px;padding:12px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.6rem;font-weight:700" id="stat-newInquiries">—</div><div style="font-size:0.68rem;font-weight:600;color:var(--mid);text-transform:uppercase">New Inquiries</div></div>' +
      '<div style="background:#e0f2fe;border-radius:8px;padding:12px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.6rem;font-weight:700" id="stat-weekRating">—</div><div style="font-size:0.68rem;font-weight:600;color:var(--mid);text-transform:uppercase">Week Rating</div></div>' +
    '</div>';
  };

  _renderers._rwOwnerRequests = async function() {
    return '<div id="hhpAdminDashboard"><div class="card-title" style="margin-bottom:14px">📋 Booking Requests</div><div style="padding:12px;text-align:center;color:var(--mid);font-size:0.82rem">Loading requests...</div></div>';
  };

  _renderers._rwOwnerToday = async function() {
    return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">' +
        '<div><div style="font-size:0.78rem;color:var(--mid)" id="todayDateLabel">Loading...</div></div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-outline btn-sm" onclick="sTab(\'o\',\'o-sched\')" style="font-size:0.75rem">Full Schedule</button>' +
        '</div>' +
      '</div>' +
      '<div id="ownerTodayScheduleList" style="display:flex;flex-direction:column;gap:8px">' +
        '<div style="padding:16px;text-align:center;color:var(--mid);font-size:0.82rem">Loading today\'s schedule...</div>' +
      '</div>';
  };

  _renderers._rwOwnerClients = async function() {
    var sb = _getSB();
    if (!sb) return '';
    try {
      var { count } = await sb.from('profiles').select('id',{count:'exact',head:true}).eq('role','client');
      return '<div style="text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:700">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">registered clients</div></div>';
    } catch(e) { return ''; }
  };

  _renderers._rwOwnerStaff = async function() {
    var sb = _getSB();
    if (!sb) return '';
    try {
      var { count } = await sb.from('profiles').select('id',{count:'exact',head:true}).eq('role','staff').eq('is_active',true);
      return '<div style="text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:700">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">active staff members</div></div>';
    } catch(e) { return ''; }
  };

  _renderers._rwOwnerReviews = async function() {
    var sb = _getSB();
    if (!sb) return '';
    try {
      var { data } = await sb.from('reviews').select('rating').limit(100);
      var avg = 0; if (data && data.length > 0) { avg = (data.reduce(function(a,r){return a+(r.rating||0);},0) / data.length).toFixed(1); }
      return '<div style="text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:700">' + (data?data.length:0) + '</div><div style="font-size:0.75rem;color:var(--mid)">' + (avg>0?avg+' avg rating':'no reviews yet') + '</div></div>';
    } catch(e) { return ''; }
  };

  _renderers._rwOwnerPayments = async function() {
    var sb = _getSB();
    if (!sb) return '';
    try {
      var { count } = await sb.from('payments').select('id',{count:'exact',head:true}).eq('status','succeeded');
      return '<div style="text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:700">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">payments received</div></div>';
    } catch(e) { return ''; }
  };

  _renderers._rwOwnerDeals = async function() {
    var sb = _getSB();
    if (!sb) return '';
    try {
      var { data } = await sb.from('deals').select('name').eq('is_active',true);
      var c = (data||[]).length;
      return '<div style="text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:700">' + c + '</div><div style="font-size:0.75rem;color:var(--mid)">' + (c > 0 ? 'active deals' : 'no active deals') + '</div></div>';
    } catch(e) { return ''; }
  };

  _renderers._rwOwnerPhotos = async function() {
    var sb = _getSB();
    if (!sb) return '';
    try {
      var { count } = await sb.from('walk_photos').select('id',{count:'exact',head:true});
      return '<div style="text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:700">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">total photos</div></div>';
    } catch(e) { return ''; }
  };

  _renderers._rwOwnerActivity = async function() { return '<div style="font-size:0.82rem;color:var(--mid)">Recent activity across your business.</div>'; };

  // ── DETAIL RENDERERS (richer view for popup) ──
  _detailRenderers._rwClientUpcoming = async function() {
    var sb = _getSB(); var user = _getUser();
    if (!sb || !user) return '<div style="color:var(--mid)">Sign in to see appointments</div>';
    try {
      var today = new Date().toISOString().split('T')[0];
      var { data } = await sb.from('booking_requests').select('*').eq('client_id',user.id).in('status',['accepted','confirmed']).gte('preferred_date',today).order('preferred_date').limit(10);
      if (!data || data.length === 0) return '<div style="color:var(--mid);padding:16px 0">No upcoming appointments.</div>';
      return data.map(function(b) {
        var d = new Date(b.preferred_date + 'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
        var t = (typeof fmt12h === 'function') ? fmt12h(b.preferred_time || b.time_slot || '') : (b.preferred_time || '');
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">' +
          '<div><div style="font-weight:700;font-size:0.9rem">' + b.service + '</div>' +
          '<div style="font-size:0.78rem;color:var(--mid)">' + d + (t ? ' · ' + t : '') + '</div></div>' +
          '<div style="font-size:0.82rem;font-weight:600;color:var(--forest)">$' + (b.estimated_total || 0).toFixed(2) + '</div></div>';
      }).join('');
    } catch(e) { return '<div style="color:var(--mid)">Could not load</div>'; }
  };

  _detailRenderers._rwOwnerToday = async function() {
    var sb = _getSB();
    if (!sb) return '';
    try {
      var today = new Date().toISOString().split('T')[0];
      var { data } = await sb.from('booking_requests').select('*').in('status',['accepted','confirmed']).eq('preferred_date',today).order('preferred_time');
      if (!data || data.length === 0) return '<div style="padding:16px 0;color:var(--mid)">No services scheduled for today.</div>';
      return data.map(function(b) {
        var t = (typeof fmt12h === 'function') ? fmt12h(b.preferred_time || b.time_slot || '') : (b.preferred_time || '');
        return '<div style="display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">' +
          '<div style="min-width:60px;font-weight:700;font-size:0.85rem;color:var(--gold)">' + t + '</div>' +
          '<div style="flex:1"><div style="font-weight:600;font-size:0.9rem">' + b.service + '</div>' +
          '<div style="font-size:0.78rem;color:var(--mid)">' + (b.contact_name || 'Client') + (b.pet_names ? ' · ' + b.pet_names : '') + '</div></div></div>';
      }).join('');
    } catch(e) { return ''; }
  };

  // ══════════════════════════════════════
  //  INITIALIZATION
  // ══════════════════════════════════════

  async function init() {
    var portal = _getPortal();
    if (!portal) { console.warn('Customizer: no portal'); return; }
    console.log('Customizer: init for', portal);

    await _loadPrefs();
    _applySidebarOrder(portal);
    _initSidebarDrag(portal);
    _setupOverview(portal);
    await _renderWidgets(portal);

    // Re-trigger any data loaders that populate dynamic IDs
    // (stat boxes, alerts, schedule list, etc. — these use IDs that now live inside widgets)
    setTimeout(function() {
      _retriggerDataLoaders(portal);
    }, 400);

    console.log('Customizer: ready');
  }

  // Re-fire the existing data loading functions so they populate the new DOM elements
  function _retriggerDataLoaders(portal) {
    if (portal === 'owner') {
      if (typeof loadOwnerDashStats === 'function') try { loadOwnerDashStats(); } catch(e) {}
      if (typeof loadOwnerTodaySchedule === 'function') try { loadOwnerTodaySchedule(); } catch(e) {}
      if (window.HHP_BookingAdmin && typeof window.HHP_BookingAdmin.loadDashboard === 'function') try { window.HHP_BookingAdmin.loadDashboard(); } catch(e) {}
      if (window.HHP_Messaging && typeof window.HHP_Messaging.loadAlertMessages === 'function') try { window.HHP_Messaging.loadAlertMessages(); } catch(e) {}
    } else if (portal === 'client') {
      if (typeof loadClientDashboard === 'function') try { loadClientDashboard(); } catch(e) {}
    } else if (portal === 'staff') {
      if (typeof loadStaffDashboard === 'function') try { loadStaffDashboard(); } catch(e) {}
      if (typeof loadStaffSchedule === 'function') try { loadStaffSchedule(); } catch(e) {}
    }
  }

  // Auto-init
  var _initAttempts = 0;
  var _initialized = false;
  function _tryInit() {
    if (window.HHP_Auth && window.HHP_Auth.currentUser && window.HHP_Auth.currentRole) {
      if (!_initialized) { _initialized = true; init(); }
    } else if (_initAttempts < 30) {
      _initAttempts++;
      setTimeout(_tryInit, 600);
    }
  }
  setTimeout(_tryInit, 1000);

  // ── PUBLIC API ──
  window.HHP_Customizer = {
    init: function() { _initialized = false; init(); },
    toggleEdit: _toggleEdit,
    toggleWidget: _toggleWidget,
    toggleSize: _toggleSize,
    resetLayout: _resetLayout,
    openDetail: _openDetail,
    closeDetail: _closeDetail,
    refreshWidgets: function() { var p = _getPortal(); if (p) _renderWidgets(p); }
  };

})();
