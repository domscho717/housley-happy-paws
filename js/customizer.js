// ── HHP_Customizer — Drag-and-drop sidebar reordering + Overview widgets ──
// Saves per-account layout preferences to Supabase user_layout_prefs table
(function() {
  'use strict';

  // ── PANEL REGISTRY — defines every panel per portal with widget info ──
  var PANELS = {
    client: [
      { id: 'c-pets',    icon: '🐾', label: 'My Pets',       tab: "sTab('c','c-pets')",    widgetFn: '_wClientPets',      group: 'top' },
      { id: 'c-dash',    icon: '🏠', label: 'Dashboard',     tab: "sTab('c','c-dash')",    widgetFn: null,                group: 'Overview' },
      { id: 'c-appts',   icon: '📅', label: 'Appointments',  tab: "sTab('c','c-appts')",   widgetFn: '_wClientAppts',     group: 'Overview' },
      { id: 'c-track',   icon: '🗺️', label: 'Live Tracking', tab: "sTab('c','c-track')",   widgetFn: '_wClientTracking',  group: 'Pet Services' },
      { id: 'c-photos',  icon: '📸', label: 'Photo Gallery', tab: "sTab('c','c-photos')",  widgetFn: '_wClientPhotos',    group: 'Pet Services' },
      { id: 'c-reports', icon: '📋', label: 'Walk Reports',  tab: "sTab('c','c-reports')", widgetFn: '_wClientReports',   group: 'Pet Services' },
      { id: 'c-reviews', icon: '⭐', label: 'My Reviews',    tab: "sTab('c','c-reviews')", widgetFn: '_wClientReviews',   group: 'Pet Services' },
      { id: 'c-msgs',    icon: '💬', label: 'Messages',      tab: "sTab('c','c-msgs')",    widgetFn: '_wClientMsgs',      group: 'Account' },
      { id: 'c-cal',     icon: '📆', label: 'Calendar',      tab: "sTab('c','c-cal')",     widgetFn: '_wClientCal',       group: 'Account' },
      { id: 'c-bill',    icon: '💳', label: 'Billing',       tab: "sTab('c','c-bill')",    widgetFn: '_wClientBilling',   group: 'Account' }
    ],
    staff: [
      { id: 's-sched',   icon: '📅', label: 'My Schedule',    tab: "sTab('s','s-sched')",   widgetFn: null,                group: 'My Work' },
      { id: 's-clients', icon: '👥', label: 'My Clients',     tab: "sTab('s','s-clients')", widgetFn: '_wStaffClients',    group: 'My Work' },
      { id: 's-jobs',    icon: '🦮', label: 'Job Queue',      tab: "sTab('s','s-jobs')",    widgetFn: '_wStaffJobs',       group: 'My Work' },
      { id: 's-reports', icon: '📋', label: 'Create Report',  tab: "sTab('s','s-reports')", widgetFn: null,                group: 'My Work' },
      { id: 's-cal',     icon: '📆', label: 'Calendar',       tab: "sTab('s','s-cal')",     widgetFn: '_wStaffCal',        group: 'My Work' },
      { id: 's-avail',   icon: '🗓️', label: 'My Availability',tab: "sTab('s','s-avail')",  widgetFn: null,                group: 'My Work' },
      { id: 's-msgs',    icon: '💬', label: 'Messages',       tab: "sTab('s','s-msgs')",    widgetFn: '_wStaffMsgs',       group: 'Communication' },
      { id: 's-earn',    icon: '💰', label: 'Earnings',       tab: "sTab('s','s-earn')",    widgetFn: '_wStaffEarnings',   group: 'Communication' }
    ],
    owner: [
      { id: 'o-overview',    icon: '📊', label: 'Overview',          tab: "sTab('o','o-overview')",    widgetFn: null,               group: 'Menu' },
      { id: 'o-clients',     icon: '👥', label: 'All Clients',       tab: "sTab('o','o-clients')",     widgetFn: '_wOwnerClients',   group: 'Menu' },
      { id: 'o-sched',       icon: '📅', label: 'Master Schedule',   tab: "sTab('o','o-sched')",       widgetFn: '_wOwnerSchedule',  group: 'Menu' },
      { id: 'o-reports',     icon: '📋', label: 'Create Report',     tab: "sTab('o','o-reports')",     widgetFn: null,               group: 'Menu' },
      { id: 'o-reviews',     icon: '⭐', label: 'Reviews & Ratings', tab: "sTab('o','o-reviews')",     widgetFn: '_wOwnerReviews',   group: 'Menu' },
      { id: 'o-staff',       icon: '🧑‍🤝‍🧑', label: 'Staff',            tab: "sTab('o','o-staff')",       widgetFn: '_wOwnerStaff',     group: 'Menu' },
      { id: 'o-msgs',        icon: '💬', label: 'All Messages',      tab: "sTab('o','o-msgs')",        widgetFn: '_wOwnerMsgs',      group: 'Menu' },
      { id: 'o-cal',         icon: '📆', label: 'Calendar',          tab: "sTab('o','o-cal')",         widgetFn: '_wOwnerCal',       group: 'Menu' },
      { id: 'o-avail',       icon: '🗓️', label: 'Availability',      tab: "sTab('o','o-avail')",       widgetFn: null,               group: 'Menu' },
      { id: 'o-auto',        icon: '🤖', label: 'Auto-Replies',      tab: "sTab('o','o-auto')",        widgetFn: null,               group: 'Menu' },
      { id: 'o-studio',      icon: '✨', label: 'AI Owner Studio',   tab: "sTab('o','o-studio')",      widgetFn: null,               group: 'Menu' },
      { id: 'o-content',     icon: '✏️', label: 'Edit Website',      tab: "sTab('o','o-content')",     widgetFn: null,               group: 'Menu' },
      { id: 'o-photos',      icon: '🖼️', label: 'Photos & Media',    tab: "sTab('o','o-photos')",      widgetFn: '_wOwnerPhotos',    group: 'Menu' },
      { id: 'o-payments',    icon: '💳', label: 'Payments & Bank',   tab: "sTab('o','o-payments')",    widgetFn: '_wOwnerPayments',  group: 'Menu' },
      { id: 'o-deals',       icon: '🏷️', label: 'Specials & Deals',  tab: "sTab('o','o-deals')",       widgetFn: '_wOwnerDeals',     group: 'Menu' },
      { id: 'o-sendInvoice', icon: '🧾', label: 'Send Invoice',      tab: "sTab('o','o-sendInvoice')", widgetFn: null,               group: 'Menu' },
      { id: 'o-linkpage',    icon: '🔗', label: 'Edit Link Page',    tab: "sTab('o','o-linkpage')",    widgetFn: null,               group: 'Menu' },
      { id: 'o-activity',    icon: '📜', label: 'Activity Log',      tab: "sTab('o','o-activity')",    widgetFn: '_wOwnerActivity',  group: 'Menu' }
    ]
  };

  // ── DEFAULT OVERVIEW WIDGETS per portal ──
  var DEFAULT_WIDGETS = {
    client: ['c-appts', 'c-reports', 'c-photos', 'c-reviews'],
    staff:  ['s-jobs', 's-clients', 's-earn', 's-msgs'],
    owner:  ['o-clients', 'o-sched', 'o-payments', 'o-deals', 'o-reviews', 'o-activity']
  };

  // ── STATE ──
  var _prefs = {};      // { client: { sidebar_order, overview_widgets }, ... }
  var _loaded = false;
  var _saving = false;
  var _editMode = false;

  // ── HELPERS ──
  function _getSB() { return window.HHP_Auth && window.HHP_Auth.supabase; }
  function _getUser() { return window.HHP_Auth && window.HHP_Auth.currentUser; }
  function _getPortal() {
    var u = _getUser();
    if (!u) return null;
    if (u.role === 'owner') return 'owner';
    if (u.role === 'staff') return 'staff';
    return 'client';
  }

  // ── LOAD PREFERENCES FROM SUPABASE ──
  async function loadPrefs() {
    var sb = _getSB();
    var user = _getUser();
    if (!sb || !user) return;

    try {
      var { data } = await sb.from('user_layout_prefs').select('*').eq('user_id', user.id);
      if (data && data.length > 0) {
        data.forEach(function(row) {
          _prefs[row.portal] = {
            sidebar_order: row.sidebar_order || [],
            overview_widgets: row.overview_widgets || []
          };
        });
      }
      _loaded = true;
    } catch (e) {
      console.warn('Customizer: load prefs error', e);
    }
  }

  // ── SAVE PREFERENCES TO SUPABASE ──
  async function savePrefs(portal) {
    if (_saving) return;
    _saving = true;
    var sb = _getSB();
    var user = _getUser();
    if (!sb || !user) { _saving = false; return; }

    var p = _prefs[portal] || { sidebar_order: [], overview_widgets: [] };

    try {
      await sb.from('user_layout_prefs').upsert({
        user_id: user.id,
        portal: portal,
        sidebar_order: p.sidebar_order,
        overview_widgets: p.overview_widgets,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,portal' });
    } catch (e) {
      console.warn('Customizer: save error', e);
    }
    _saving = false;
  }

  // ══════════════════════════════════════
  //  SIDEBAR DRAG-AND-DROP REORDERING
  // ══════════════════════════════════════

  var _dragState = {
    active: false,
    el: null,
    placeholder: null,
    startY: 0,
    offsetY: 0,
    holdTimer: null,
    container: null,
    items: [],
    portal: null
  };

  function _initSidebarDrag(portal) {
    var portalPage = document.getElementById(portal === 'client' ? 'pg-client' : portal === 'staff' ? 'pg-staff' : 'pg-owner');
    if (!portalPage) return;
    var sidebar = portalPage.querySelector('.sidebar');
    if (!sidebar) return;

    // Get all .sb-item buttons inside nav groups
    var items = sidebar.querySelectorAll('.sb-nav-group .sb-item');
    items.forEach(function(item) {
      // Add drag handle indicator
      if (!item.querySelector('.sb-drag-handle')) {
        var handle = document.createElement('span');
        handle.className = 'sb-drag-handle';
        handle.textContent = '⠿';
        handle.style.cssText = 'opacity:0;font-size:0.7rem;color:rgba(255,255,255,0.35);position:absolute;left:4px;top:50%;transform:translateY(-50%);transition:opacity 0.2s;pointer-events:none';
        item.style.position = 'relative';
        item.style.paddingLeft = '22px';
        item.insertBefore(handle, item.firstChild);
      }

      // Long-press to activate drag (prevents scroll conflicts)
      item.addEventListener('pointerdown', function(e) {
        if (e.button !== 0) return; // left click only
        var thisItem = this;
        _dragState.holdTimer = setTimeout(function() {
          _startDrag(thisItem, e, portal, sidebar);
        }, 400); // 400ms hold to start drag
      });

      item.addEventListener('pointerup', _cancelHold);
      item.addEventListener('pointercancel', _cancelHold);
      item.addEventListener('pointermove', function(e) {
        // If finger moves more than 10px before hold completes, cancel (they're scrolling)
        if (_dragState.holdTimer && !_dragState.active) {
          _cancelHold();
        }
      });
    });

    // Show drag handles on hover (desktop)
    sidebar.addEventListener('mouseenter', function() {
      sidebar.querySelectorAll('.sb-drag-handle').forEach(function(h) { h.style.opacity = '1'; });
    });
    sidebar.addEventListener('mouseleave', function() {
      if (!_dragState.active) {
        sidebar.querySelectorAll('.sb-drag-handle').forEach(function(h) { h.style.opacity = '0'; });
      }
    });
  }

  function _cancelHold() {
    if (_dragState.holdTimer) {
      clearTimeout(_dragState.holdTimer);
      _dragState.holdTimer = null;
    }
  }

  function _startDrag(el, e, portal, sidebar) {
    _dragState.active = true;
    _dragState.el = el;
    _dragState.portal = portal;
    _dragState.container = el.parentElement; // the sb-nav-group

    // Get rect
    var rect = el.getBoundingClientRect();
    _dragState.offsetY = e.clientY - rect.top;
    _dragState.startY = e.clientY;

    // Create placeholder
    var ph = document.createElement('div');
    ph.className = 'sb-drag-placeholder';
    ph.style.cssText = 'height:' + rect.height + 'px;background:rgba(200,150,62,0.15);border:1.5px dashed rgba(200,150,62,0.4);border-radius:6px;margin:2px 0;transition:height 0.15s';
    _dragState.placeholder = ph;

    // Style the dragged element
    el.style.position = 'fixed';
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    el.style.width = rect.width + 'px';
    el.style.zIndex = '10000';
    el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.35)';
    el.style.opacity = '0.92';
    el.style.transition = 'none';
    el.style.pointerEvents = 'none';
    el.style.transform = 'scale(1.04)';

    // Insert placeholder where the element was
    el.parentElement.insertBefore(ph, el);

    // Capture pointer
    document.addEventListener('pointermove', _onDragMove);
    document.addEventListener('pointerup', _onDragEnd);

    // Prevent text selection
    document.body.style.userSelect = 'none';

    // Vibrate on mobile if supported
    if (navigator.vibrate) navigator.vibrate(30);
  }

  function _onDragMove(e) {
    if (!_dragState.active || !_dragState.el) return;
    e.preventDefault();

    var el = _dragState.el;
    var newTop = e.clientY - _dragState.offsetY;
    el.style.top = newTop + 'px';

    // Find which sibling we're over
    var container = _dragState.container;
    if (!container) return;

    var siblings = Array.from(container.querySelectorAll('.sb-item:not([style*="position: fixed"]), .sb-drag-placeholder'));
    var ph = _dragState.placeholder;

    for (var i = 0; i < siblings.length; i++) {
      var sib = siblings[i];
      if (sib === ph) continue;
      var sibRect = sib.getBoundingClientRect();
      var midY = sibRect.top + sibRect.height / 2;

      if (e.clientY < midY) {
        container.insertBefore(ph, sib);
        return;
      }
    }
    // Past all siblings — append at end
    container.appendChild(ph);
  }

  function _onDragEnd(e) {
    document.removeEventListener('pointermove', _onDragMove);
    document.removeEventListener('pointerup', _onDragEnd);
    document.body.style.userSelect = '';

    if (!_dragState.active || !_dragState.el) return;

    var el = _dragState.el;
    var ph = _dragState.placeholder;
    var container = _dragState.container;

    // Place element where placeholder is
    if (ph && ph.parentElement) {
      container.insertBefore(el, ph);
      ph.remove();
    }

    // Reset styles
    el.style.position = '';
    el.style.left = '';
    el.style.top = '';
    el.style.width = '';
    el.style.zIndex = '';
    el.style.boxShadow = '';
    el.style.opacity = '';
    el.style.transition = '';
    el.style.pointerEvents = '';
    el.style.transform = '';

    // Save new order
    _saveSidebarOrder(_dragState.portal);

    // Reset state
    _dragState.active = false;
    _dragState.el = null;
    _dragState.placeholder = null;
    _dragState.container = null;
  }

  function _saveSidebarOrder(portal) {
    var portalPage = document.getElementById(portal === 'client' ? 'pg-client' : portal === 'staff' ? 'pg-staff' : 'pg-owner');
    if (!portalPage) return;

    // Collect all sb-items in their current DOM order across all nav groups
    var allItems = portalPage.querySelectorAll('.sidebar .sb-nav-group .sb-item');
    var order = [];
    allItems.forEach(function(item) {
      // Extract panel ID from onclick
      var oc = item.getAttribute('onclick') || '';
      var match = oc.match(/sTab\([^,]+,'([^']+)'\)/);
      if (match) order.push(match[1]);
    });

    // Also get any top-level items (like "My Pets" in client)
    var topItems = portalPage.querySelectorAll('.sidebar > .sb-item');
    var topOrder = [];
    topItems.forEach(function(item) {
      var oc = item.getAttribute('onclick') || '';
      var match = oc.match(/sTab\([^,]+,'([^']+)'\)/);
      if (match) topOrder.push(match[1]);
    });

    if (!_prefs[portal]) _prefs[portal] = { sidebar_order: [], overview_widgets: [] };
    _prefs[portal].sidebar_order = topOrder.concat(order);
    savePrefs(portal);

    // Subtle feedback
    if (typeof toast === 'function') toast('✓ Sidebar order saved');
  }

  function _applySidebarOrder(portal) {
    if (!_prefs[portal] || !_prefs[portal].sidebar_order || _prefs[portal].sidebar_order.length === 0) return;

    var portalPage = document.getElementById(portal === 'client' ? 'pg-client' : portal === 'staff' ? 'pg-staff' : 'pg-owner');
    if (!portalPage) return;

    var order = _prefs[portal].sidebar_order;

    // Re-order items within each nav-group based on saved order
    var groups = portalPage.querySelectorAll('.sidebar .sb-nav-group');
    groups.forEach(function(group) {
      var items = Array.from(group.querySelectorAll('.sb-item'));
      if (items.length < 2) return;

      // Sort items based on their panel ID's position in saved order
      items.sort(function(a, b) {
        var aOc = (a.getAttribute('onclick') || '').match(/sTab\([^,]+,'([^']+)'\)/);
        var bOc = (b.getAttribute('onclick') || '').match(/sTab\([^,]+,'([^']+)'\)/);
        var aId = aOc ? aOc[1] : '';
        var bId = bOc ? bOc[1] : '';
        var aIdx = order.indexOf(aId);
        var bIdx = order.indexOf(bId);
        if (aIdx === -1) aIdx = 999;
        if (bIdx === -1) bIdx = 999;
        return aIdx - bIdx;
      });

      // Re-append in new order
      items.forEach(function(item) { group.appendChild(item); });
    });
  }

  // ══════════════════════════════════════
  //  OVERVIEW WIDGETS SYSTEM
  // ══════════════════════════════════════

  function _getOverviewPanel(portal) {
    if (portal === 'client') return document.getElementById('c-dash');
    if (portal === 'staff') return document.getElementById('s-sched');
    if (portal === 'owner') return document.getElementById('o-overview');
    return null;
  }

  function _getActiveWidgets(portal) {
    if (_prefs[portal] && _prefs[portal].overview_widgets && _prefs[portal].overview_widgets.length > 0) {
      return _prefs[portal].overview_widgets;
    }
    return DEFAULT_WIDGETS[portal] || [];
  }

  // ── Inject the widget container + edit button into overview panels ──
  function _injectWidgetArea(portal) {
    var panel = _getOverviewPanel(portal);
    if (!panel) return;
    if (panel.querySelector('#hhp-widgets-area')) return; // already injected

    // Create edit button
    var editBar = document.createElement('div');
    editBar.id = 'hhp-widget-editbar';
    editBar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin:20px 0 14px;padding:0';
    editBar.innerHTML =
      '<div style="font-size:0.82rem;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:0.05em">📌 My Quick View</div>' +
      '<button id="hhp-widget-editbtn" onclick="HHP_Customizer.toggleEditMode()" style="background:none;border:1px solid var(--border);border-radius:8px;padding:5px 14px;font-size:0.78rem;font-weight:600;color:var(--mid);cursor:pointer;font-family:inherit;transition:all 0.2s">✏️ Customize</button>';

    // Create widget grid container
    var grid = document.createElement('div');
    grid.id = 'hhp-widgets-area';
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px';

    // Append after existing content
    panel.appendChild(editBar);
    panel.appendChild(grid);

    // Create the edit modal (hidden)
    if (!document.getElementById('hhp-widget-picker')) {
      var picker = document.createElement('div');
      picker.id = 'hhp-widget-picker';
      picker.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;opacity:0;transition:opacity 0.25s';
      picker.onclick = function(e) { if (e.target === picker) HHP_Customizer.toggleEditMode(); };

      var sheet = document.createElement('div');
      sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:75vh;background:white;border-radius:20px 20px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,0.18);z-index:9999;overflow-y:auto;padding:0;transform:translateY(100%);transition:transform 0.3s ease';
      sheet.id = 'hhp-widget-picker-sheet';

      sheet.innerHTML =
        '<div style="padding:10px 0 4px;text-align:center;cursor:pointer" onclick="HHP_Customizer.toggleEditMode()">' +
          '<div style="width:40px;height:4px;background:#d0c8b8;border-radius:4px;margin:0 auto"></div>' +
        '</div>' +
        '<div style="padding:4px 20px 28px">' +
          '<h3 style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;margin-bottom:4px">Customize Your Overview</h3>' +
          '<p style="font-size:0.82rem;color:var(--mid);margin-bottom:16px">Pick which panels to show as mini widgets on your overview page. Tap to toggle.</p>' +
          '<div id="hhp-widget-picker-list" style="display:flex;flex-direction:column;gap:8px"></div>' +
          '<div style="display:flex;gap:10px;margin-top:18px">' +
            '<button onclick="HHP_Customizer.resetWidgets()" style="flex:1;padding:12px;background:var(--warm);border:1px solid var(--border);border-radius:10px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;color:var(--mid)">↩ Reset to Default</button>' +
            '<button onclick="HHP_Customizer.toggleEditMode()" style="flex:1;padding:12px;background:var(--forest);color:white;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit">✓ Done</button>' +
          '</div>' +
        '</div>';

      picker.appendChild(sheet);
      document.body.appendChild(picker);
    }
  }

  // ── Build widget picker checklist ──
  function _buildPickerList(portal) {
    var list = document.getElementById('hhp-widget-picker-list');
    if (!list) return;

    var panels = PANELS[portal] || [];
    var active = _getActiveWidgets(portal);
    list.innerHTML = '';

    panels.forEach(function(p) {
      if (!p.widgetFn) return; // Skip panels that don't have widget renderers

      var isOn = active.indexOf(p.id) !== -1;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;cursor:pointer;transition:background 0.15s;' +
        (isOn ? 'background:rgba(61,90,71,0.1);border:1.5px solid var(--forest)' : 'background:var(--warm);border:1.5px solid transparent');
      row.setAttribute('data-panel-id', p.id);

      row.innerHTML =
        '<div style="font-size:1.3rem;width:32px;text-align:center">' + p.icon + '</div>' +
        '<div style="flex:1"><div style="font-weight:700;font-size:0.9rem;color:var(--ink)">' + p.label + '</div>' +
          '<div style="font-size:0.75rem;color:var(--mid)">' + p.group + '</div></div>' +
        '<div style="width:40px;height:24px;border-radius:12px;background:' + (isOn ? 'var(--forest)' : '#ccc') + ';position:relative;transition:background 0.2s;flex-shrink:0">' +
          '<div style="width:20px;height:20px;border-radius:50%;background:white;position:absolute;top:2px;' + (isOn ? 'left:18px' : 'left:2px') + ';transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></div>' +
        '</div>';

      row.onclick = function() {
        var id = this.getAttribute('data-panel-id');
        var current = _getActiveWidgets(portal);
        var idx = current.indexOf(id);
        if (idx !== -1) {
          current.splice(idx, 1);
        } else {
          if (current.length >= 8) { toast('Maximum 8 widgets'); return; }
          current.push(id);
        }
        if (!_prefs[portal]) _prefs[portal] = { sidebar_order: [], overview_widgets: [] };
        _prefs[portal].overview_widgets = current;
        savePrefs(portal);
        _buildPickerList(portal); // refresh toggle states
        _renderWidgets(portal);   // live update
      };

      list.appendChild(row);
    });
  }

  // ── Toggle edit mode ──
  function toggleEditMode() {
    var portal = _getPortal();
    if (!portal) return;

    var picker = document.getElementById('hhp-widget-picker');
    var sheet = document.getElementById('hhp-widget-picker-sheet');
    var btn = document.getElementById('hhp-widget-editbtn');

    if (!picker) return;

    _editMode = !_editMode;

    if (_editMode) {
      _buildPickerList(portal);
      picker.style.display = 'block';
      requestAnimationFrame(function() {
        picker.style.opacity = '1';
        if (sheet) sheet.style.transform = 'translateY(0)';
      });
      if (btn) { btn.textContent = '✓ Done'; btn.style.background = 'var(--forest)'; btn.style.color = 'white'; btn.style.borderColor = 'var(--forest)'; }
    } else {
      picker.style.opacity = '0';
      if (sheet) sheet.style.transform = 'translateY(100%)';
      setTimeout(function() { picker.style.display = 'none'; }, 300);
      if (btn) { btn.textContent = '✏️ Customize'; btn.style.background = 'none'; btn.style.color = 'var(--mid)'; btn.style.borderColor = 'var(--border)'; }
    }
  }

  // ── Reset widgets to defaults ──
  function resetWidgets() {
    var portal = _getPortal();
    if (!portal) return;
    if (!_prefs[portal]) _prefs[portal] = { sidebar_order: [], overview_widgets: [] };
    _prefs[portal].overview_widgets = (DEFAULT_WIDGETS[portal] || []).slice();
    savePrefs(portal);
    _buildPickerList(portal);
    _renderWidgets(portal);
    if (typeof toast === 'function') toast('↩ Reset to defaults');
  }

  // ══════════════════════════════════════
  //  WIDGET RENDERERS — mini summary cards
  // ══════════════════════════════════════

  // Each renderer returns an HTML string for a compact summary card.
  // They fetch minimal data from Supabase for a quick snapshot.

  var _widgetRenderers = {};

  // ── Client Widgets ──
  _widgetRenderers._wClientAppts = async function() {
    var sb = _getSB(); var user = _getUser();
    if (!sb || !user) return _emptyWidget('Appointments', '📅');
    try {
      var today = new Date().toISOString().split('T')[0];
      var { data } = await sb.from('booking_requests').select('id, service, preferred_date, status')
        .eq('client_id', user.id).in('status', ['accepted','confirmed']).gte('preferred_date', today).order('preferred_date').limit(3);
      var count = (data || []).length;
      var items = (data || []).map(function(b) {
        return '<div style="font-size:0.78rem;color:var(--ink);padding:3px 0;border-bottom:1px solid var(--border)">' +
          b.service + ' · ' + new Date(b.preferred_date + 'T12:00:00').toLocaleDateString('en-US', {month:'short',day:'numeric'}) +
          '</div>';
      }).join('');
      return _widgetCard('Upcoming Appointments', '📅', count > 0 ? items : '<div style="font-size:0.8rem;color:var(--mid)">No upcoming appointments</div>', "sTab('c','c-appts')");
    } catch(e) { return _emptyWidget('Appointments', '📅'); }
  };

  _widgetRenderers._wClientPets = async function() {
    var sb = _getSB(); var user = _getUser();
    if (!sb || !user) return _emptyWidget('My Pets', '🐾');
    try {
      var { count } = await sb.from('pets').select('id', { count: 'exact', head: true }).eq('owner_id', user.id);
      return _widgetCard('My Pets', '🐾', '<div style="font-size:1.6rem;font-weight:700;font-family:\'Cormorant Garamond\',serif">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">registered pets</div>', "sTab('c','c-pets')");
    } catch(e) { return _emptyWidget('My Pets', '🐾'); }
  };

  _widgetRenderers._wClientTracking = async function() {
    return _widgetCard('Live Tracking', '🗺️', '<div style="font-size:0.8rem;color:var(--mid)">Track your pet\'s walk in real time when a service is active.</div>', "sTab('c','c-track')");
  };

  _widgetRenderers._wClientPhotos = async function() {
    var sb = _getSB(); var user = _getUser();
    if (!sb || !user) return _emptyWidget('Photos', '📸');
    try {
      var { count } = await sb.from('walk_photos').select('id', { count: 'exact', head: true }).eq('client_id', user.id);
      return _widgetCard('Photo Gallery', '📸', '<div style="font-size:1.6rem;font-weight:700;font-family:\'Cormorant Garamond\',serif">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">photos from walks</div>', "sTab('c','c-photos')");
    } catch(e) { return _emptyWidget('Photos', '📸'); }
  };

  _widgetRenderers._wClientReports = async function() {
    var sb = _getSB(); var user = _getUser();
    if (!sb || !user) return _emptyWidget('Walk Reports', '📋');
    try {
      var { count } = await sb.from('walk_reports').select('id', { count: 'exact', head: true }).eq('client_id', user.id);
      return _widgetCard('Walk Reports', '📋', '<div style="font-size:1.6rem;font-weight:700;font-family:\'Cormorant Garamond\',serif">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">reports received</div>', "sTab('c','c-reports')");
    } catch(e) { return _emptyWidget('Walk Reports', '📋'); }
  };

  _widgetRenderers._wClientReviews = async function() {
    var sb = _getSB(); var user = _getUser();
    if (!sb || !user) return _emptyWidget('My Reviews', '⭐');
    try {
      var { count } = await sb.from('reviews').select('id', { count: 'exact', head: true }).eq('reviewer_id', user.id);
      return _widgetCard('My Reviews', '⭐', '<div style="font-size:1.6rem;font-weight:700;font-family:\'Cormorant Garamond\',serif">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">reviews left</div>', "sTab('c','c-reviews')");
    } catch(e) { return _emptyWidget('My Reviews', '⭐'); }
  };

  _widgetRenderers._wClientMsgs = async function() {
    return _widgetCard('Messages', '💬', '<div style="font-size:0.8rem;color:var(--mid)">View conversations with your pet care provider.</div>', "sTab('c','c-msgs')");
  };

  _widgetRenderers._wClientCal = async function() {
    return _widgetCard('Calendar', '📆', '<div style="font-size:0.8rem;color:var(--mid)">See all your bookings on a calendar view.</div>', "sTab('c','c-cal')");
  };

  _widgetRenderers._wClientBilling = async function() {
    return _widgetCard('Billing', '💳', '<div style="font-size:0.8rem;color:var(--mid)">Manage payment methods and view receipts.</div>', "sTab('c','c-bill')");
  };

  // ── Staff Widgets ──
  _widgetRenderers._wStaffClients = async function() {
    var sb = _getSB(); var user = _getUser();
    if (!sb || !user) return _emptyWidget('My Clients', '👥');
    try {
      var today = new Date().toISOString().split('T')[0];
      var { data } = await sb.from('booking_requests').select('contact_name').in('status',['accepted','confirmed']).gte('preferred_date',today).limit(50);
      var names = []; (data||[]).forEach(function(b) { if (b.contact_name && names.indexOf(b.contact_name)===-1) names.push(b.contact_name); });
      return _widgetCard('My Clients', '👥', '<div style="font-size:1.6rem;font-weight:700;font-family:\'Cormorant Garamond\',serif">' + names.length + '</div><div style="font-size:0.75rem;color:var(--mid)">active clients</div>', "sTab('s','s-clients')");
    } catch(e) { return _emptyWidget('My Clients', '👥'); }
  };

  _widgetRenderers._wStaffJobs = async function() {
    var sb = _getSB();
    if (!sb) return _emptyWidget('Job Queue', '🦮');
    try {
      var { count } = await sb.from('booking_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      return _widgetCard('Job Queue', '🦮', '<div style="font-size:1.6rem;font-weight:700;font-family:\'Cormorant Garamond\',serif">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">pending requests</div>', "sTab('s','s-jobs')");
    } catch(e) { return _emptyWidget('Job Queue', '🦮'); }
  };

  _widgetRenderers._wStaffCal = async function() {
    return _widgetCard('Calendar', '📆', '<div style="font-size:0.8rem;color:var(--mid)">View your schedule on a calendar.</div>', "sTab('s','s-cal')");
  };

  _widgetRenderers._wStaffMsgs = async function() {
    return _widgetCard('Messages', '💬', '<div style="font-size:0.8rem;color:var(--mid)">Messages from clients and the owner.</div>', "sTab('s','s-msgs')");
  };

  _widgetRenderers._wStaffEarnings = async function() {
    var sb = _getSB(); var user = _getUser();
    if (!sb || !user) return _emptyWidget('Earnings', '💰');
    try {
      var { count } = await sb.from('booking_requests').select('id', { count: 'exact', head: true }).eq('status','completed');
      return _widgetCard('Earnings', '💰', '<div style="font-size:1.6rem;font-weight:700;font-family:\'Cormorant Garamond\',serif">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">jobs completed</div>', "sTab('s','s-earn')");
    } catch(e) { return _emptyWidget('Earnings', '💰'); }
  };

  // ── Owner Widgets ──
  _widgetRenderers._wOwnerClients = async function() {
    var sb = _getSB();
    if (!sb) return _emptyWidget('All Clients', '👥');
    try {
      var { count } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client');
      return _widgetCard('All Clients', '👥', '<div style="font-size:1.6rem;font-weight:700;font-family:\'Cormorant Garamond\',serif">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">registered clients</div>', "sTab('o','o-clients')");
    } catch(e) { return _emptyWidget('All Clients', '👥'); }
  };

  _widgetRenderers._wOwnerSchedule = async function() {
    var sb = _getSB();
    if (!sb) return _emptyWidget('Schedule', '📅');
    try {
      var today = new Date().toISOString().split('T')[0];
      var { count } = await sb.from('booking_requests').select('id', { count: 'exact', head: true }).in('status',['accepted','confirmed']).eq('preferred_date', today);
      return _widgetCard("Today's Schedule", '📅', '<div style="font-size:1.6rem;font-weight:700;font-family:\'Cormorant Garamond\',serif">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">services today</div>', "sTab('o','o-sched')");
    } catch(e) { return _emptyWidget('Schedule', '📅'); }
  };

  _widgetRenderers._wOwnerReviews = async function() {
    var sb = _getSB();
    if (!sb) return _emptyWidget('Reviews', '⭐');
    try {
      var { data } = await sb.from('reviews').select('rating').limit(100);
      var avg = 0;
      if (data && data.length > 0) {
        var sum = data.reduce(function(a,r){ return a + (r.rating||0); }, 0);
        avg = (sum / data.length).toFixed(1);
      }
      return _widgetCard('Reviews', '⭐', '<div style="font-size:1.6rem;font-weight:700;font-family:\'Cormorant Garamond\',serif">' + (data ? data.length : 0) + '</div><div style="font-size:0.75rem;color:var(--mid)">' + (avg > 0 ? avg + ' avg rating' : 'no reviews yet') + '</div>', "sTab('o','o-reviews')");
    } catch(e) { return _emptyWidget('Reviews', '⭐'); }
  };

  _widgetRenderers._wOwnerStaff = async function() {
    var sb = _getSB();
    if (!sb) return _emptyWidget('Staff', '🧑‍🤝‍🧑');
    try {
      var { count } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'staff').eq('is_active', true);
      return _widgetCard('Staff Team', '🧑‍🤝‍🧑', '<div style="font-size:1.6rem;font-weight:700;font-family:\'Cormorant Garamond\',serif">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">active staff members</div>', "sTab('o','o-staff')");
    } catch(e) { return _emptyWidget('Staff', '🧑‍🤝‍🧑'); }
  };

  _widgetRenderers._wOwnerMsgs = async function() {
    return _widgetCard('Messages', '💬', '<div style="font-size:0.8rem;color:var(--mid)">View all client and staff conversations.</div>', "sTab('o','o-msgs')");
  };

  _widgetRenderers._wOwnerCal = async function() {
    return _widgetCard('Calendar', '📆', '<div style="font-size:0.8rem;color:var(--mid)">Full calendar view of all bookings.</div>', "sTab('o','o-cal')");
  };

  _widgetRenderers._wOwnerPhotos = async function() {
    var sb = _getSB();
    if (!sb) return _emptyWidget('Photos', '🖼️');
    try {
      var { count } = await sb.from('walk_photos').select('id', { count: 'exact', head: true });
      return _widgetCard('Photos & Media', '🖼️', '<div style="font-size:1.6rem;font-weight:700;font-family:\'Cormorant Garamond\',serif">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">total photos</div>', "sTab('o','o-photos')");
    } catch(e) { return _emptyWidget('Photos', '🖼️'); }
  };

  _widgetRenderers._wOwnerPayments = async function() {
    var sb = _getSB();
    if (!sb) return _emptyWidget('Payments', '💳');
    try {
      var { count } = await sb.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'succeeded');
      return _widgetCard('Payments', '💳', '<div style="font-size:1.6rem;font-weight:700;font-family:\'Cormorant Garamond\',serif">' + (count||0) + '</div><div style="font-size:0.75rem;color:var(--mid)">payments received</div>', "sTab('o','o-payments')");
    } catch(e) { return _emptyWidget('Payments', '💳'); }
  };

  _widgetRenderers._wOwnerDeals = async function() {
    var sb = _getSB();
    if (!sb) return _emptyWidget('Deals', '🏷️');
    try {
      var { data } = await sb.from('deals').select('name, is_active').eq('is_active', true);
      var count = (data||[]).length;
      var names = (data||[]).slice(0,2).map(function(d){ return d.name; }).join(', ');
      return _widgetCard('Specials & Deals', '🏷️', '<div style="font-size:1.6rem;font-weight:700;font-family:\'Cormorant Garamond\',serif">' + count + '</div><div style="font-size:0.75rem;color:var(--mid)">' + (names || 'no active deals') + '</div>', "sTab('o','o-deals')");
    } catch(e) { return _emptyWidget('Deals', '🏷️'); }
  };

  _widgetRenderers._wOwnerActivity = async function() {
    return _widgetCard('Activity Log', '📜', '<div style="font-size:0.8rem;color:var(--mid)">Recent activity across your business.</div>', "sTab('o','o-activity')");
  };

  // ── Card template helpers ──
  function _widgetCard(title, icon, bodyHTML, onclick) {
    return '<div class="hhp-widget-card" onclick="' + onclick + '" style="background:white;border:1px solid var(--border);border-radius:12px;padding:16px;cursor:pointer;transition:all 0.2s;box-shadow:0 1px 4px rgba(0,0,0,0.04)">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
        '<span style="font-size:1.2rem">' + icon + '</span>' +
        '<span style="font-size:0.78rem;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:0.04em">' + title + '</span>' +
        '<span style="margin-left:auto;font-size:0.7rem;color:var(--gold);font-weight:600">View →</span>' +
      '</div>' +
      '<div>' + bodyHTML + '</div>' +
    '</div>';
  }

  function _emptyWidget(title, icon) {
    return _widgetCard(title, icon, '<div style="font-size:0.8rem;color:var(--mid)">Loading...</div>', '');
  }

  // ── Render active widgets into the grid ──
  async function _renderWidgets(portal) {
    var grid = document.getElementById('hhp-widgets-area');
    if (!grid) return;

    var activeIds = _getActiveWidgets(portal);
    var panels = PANELS[portal] || [];

    // Show loading state
    grid.innerHTML = activeIds.map(function() {
      return '<div style="background:var(--warm);border-radius:12px;padding:20px;text-align:center;animation:pulse 1.5s ease infinite"><div style="color:var(--mid);font-size:0.82rem">Loading...</div></div>';
    }).join('');

    // Render each widget
    var cards = [];
    for (var i = 0; i < activeIds.length; i++) {
      var panelDef = panels.find(function(p) { return p.id === activeIds[i]; });
      if (!panelDef || !panelDef.widgetFn) continue;

      var renderer = _widgetRenderers[panelDef.widgetFn];
      if (renderer) {
        try {
          var html = await renderer();
          cards.push(html);
        } catch(e) {
          cards.push(_emptyWidget(panelDef.label, panelDef.icon));
        }
      }
    }

    grid.innerHTML = cards.join('');

    // If no widgets, show helpful message
    if (cards.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:30px;text-align:center;color:var(--mid);font-size:0.85rem;background:var(--warm);border-radius:12px;border:1.5px dashed var(--border)">No widgets pinned yet. Click <strong>✏️ Customize</strong> above to add quick-view cards.</div>';
    }
  }

  // ══════════════════════════════════════
  //  INITIALIZATION
  // ══════════════════════════════════════

  async function init() {
    await loadPrefs();

    var portal = _getPortal();
    if (!portal) return;

    // Apply saved sidebar order
    _applySidebarOrder(portal);

    // Init drag-and-drop on sidebar
    _initSidebarDrag(portal);

    // Inject widget area and render widgets
    _injectWidgetArea(portal);
    _renderWidgets(portal);
  }

  // Auto-init after auth is ready (delayed to ensure DOM + auth are both loaded)
  var _initAttempts = 0;
  function _tryInit() {
    if (_getUser()) {
      init();
    } else if (_initAttempts < 20) {
      _initAttempts++;
      setTimeout(_tryInit, 500);
    }
  }
  setTimeout(_tryInit, 800);

  // ── PUBLIC API ──
  window.HHP_Customizer = {
    init: init,
    toggleEditMode: toggleEditMode,
    resetWidgets: resetWidgets,
    refreshWidgets: function() {
      var portal = _getPortal();
      if (portal) _renderWidgets(portal);
    }
  };

})();
