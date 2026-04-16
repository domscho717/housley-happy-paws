// ============================================================
// Housley Happy Paws — Notification Bell & Announcement System
// 1. Floating bell icon (bottom-left, avoids book/portal FABs)
// 2. Slide-up drawer with announcements + active deals
// 3. Promo strip on services/booking section
// 4. Owner: announcement history + re-send
// ============================================================

(function() {
  'use strict';

  var _bellEl = null;
  var _drawerEl = null;
  var _badgeEl = null;
  var _promoStripEl = null;
  var _announcements = [];
  var _activeDeals = [];
  var _drawerOpen = false;
  var _dismissedKey = 'hhp_dismissed_announcements';
  var _tucked = false;       // mobile: is the bell tucked to the side?
  var _userPulledOut = false; // user manually pulled it out — keep it out

  // ── Helpers ──────────────────────────────────────────────────
  function getSB() {
    return window.HHP_Auth && window.HHP_Auth.supabase;
  }

  function getDismissed() {
    try { return JSON.parse(localStorage.getItem(_dismissedKey) || '[]'); } catch(e) { return []; }
  }

  function addDismissed(id) {
    var arr = getDismissed();
    if (arr.indexOf(id) === -1) arr.push(id);
    try { localStorage.setItem(_dismissedKey, JSON.stringify(arr)); } catch(e) {}
  }

  function timeAgo(dateStr) {
    var now = Date.now();
    var then = new Date(dateStr).getTime();
    var diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ── Mobile detection helper ─────────────────────────────────
  function isMobile() { return window.innerWidth <= 768; }

  // ── Tuck / untuck the bell (mobile only) ───────────────────
  function tuckBell() {
    if (!isMobile() || !_bellEl) return;
    _tucked = true;
    _userPulledOut = false;
    _bellEl.style.left = '-42px';       // mostly hidden, just edge peeking
    _bellEl.style.borderRadius = '0 50% 50% 0';
    if (_tabEl) {
      _tabEl.style.opacity = '1';
      _tabEl.style.pointerEvents = 'auto';
    }
  }

  function untuckBell() {
    if (!_bellEl) return;
    _tucked = false;
    _bellEl.style.left = '24px';
    _bellEl.style.borderRadius = '50%';
    if (_tabEl) {
      _tabEl.style.opacity = '0';
      _tabEl.style.pointerEvents = 'none';
    }
  }

  // ── Build the floating bell ─────────────────────────────────
  var _tabEl = null;

  function buildBell() {
    if (_bellEl) return;

    _bellEl = document.createElement('button');
    _bellEl.id = 'hhpNotifBell';
    _bellEl.setAttribute('aria-label', 'Notifications');
    _bellEl.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:24px', 'z-index:998',
      'width:52px', 'height:52px', 'border-radius:50%',
      'background:linear-gradient(135deg,var(--gold,#c8963e),#a67c2e)',
      'color:white', 'border:none', 'cursor:pointer',
      'box-shadow:0 4px 20px rgba(200,150,62,0.4)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-size:1.4rem', 'transition:left 0.35s ease,transform 0.2s,box-shadow 0.2s,border-radius 0.35s ease'
    ].join(';');
    _bellEl.innerHTML = '🔔';

    _bellEl.addEventListener('mouseenter', function() {
      if (!_tucked) {
        this.style.transform = 'scale(1.1)';
        this.style.boxShadow = '0 6px 28px rgba(200,150,62,0.55)';
      }
    });
    _bellEl.addEventListener('mouseleave', function() {
      if (!_drawerOpen && !_tucked) {
        this.style.transform = 'scale(1)';
        this.style.boxShadow = '0 4px 20px rgba(200,150,62,0.4)';
      }
    });
    // Touch/swipe handling for mobile — drag bell left to tuck, right to untuck
    var _touchStartX = 0;
    var _touchStartLeft = 0;
    var _isDragging = false;

    _bellEl.addEventListener('touchstart', function(e) {
      if (!isMobile() || _drawerOpen) return;
      _touchStartX = e.touches[0].clientX;
      _touchStartLeft = parseInt(_bellEl.style.left) || 24;
      _isDragging = false;
      // Disable transition during drag for smooth tracking
      _bellEl.style.transition = 'transform 0.2s,box-shadow 0.2s,border-radius 0.35s ease';
    }, { passive: true });

    _bellEl.addEventListener('touchmove', function(e) {
      if (!isMobile() || _drawerOpen) return;
      var dx = e.touches[0].clientX - _touchStartX;
      // Only allow dragging left (negative dx) from untucked, or right from tucked
      if (Math.abs(dx) > 8) _isDragging = true;
      var newLeft = Math.max(-42, Math.min(24, _touchStartLeft + dx));
      _bellEl.style.left = newLeft + 'px';
    }, { passive: true });

    _bellEl.addEventListener('touchend', function(e) {
      if (!isMobile() || _drawerOpen) {
        _isDragging = false;
        return;
      }
      // Restore transition
      _bellEl.style.transition = 'left 0.35s ease,transform 0.2s,box-shadow 0.2s,border-radius 0.35s ease';

      var currentLeft = parseInt(_bellEl.style.left) || 24;

      if (_isDragging) {
        // Snap: if dragged past midpoint (-10px), tuck; otherwise untuck
        if (currentLeft < -10) {
          tuckBell();
        } else {
          untuckBell();
          _userPulledOut = true;
        }
        _isDragging = false;
        return;
      }
      _isDragging = false;
      // Not a drag — it's a tap. Handle as click.
      // (click event will fire naturally)
    }, { passive: true });

    _bellEl.addEventListener('click', function(e) {
      // If we just finished a drag, don't treat as click
      if (_isDragging) { e.stopPropagation(); return; }
      // If tucked, untuck first instead of opening drawer
      if (_tucked) {
        e.stopPropagation();
        untuckBell();
        _userPulledOut = true;
        return;
      }
      toggleDrawer();
    });

    // Badge
    _badgeEl = document.createElement('span');
    _badgeEl.id = 'hhpNotifBadge';
    _badgeEl.style.cssText = [
      'position:absolute', 'top:-2px', 'right:-2px',
      'min-width:20px', 'height:20px', 'border-radius:10px',
      'background:#e53e3e', 'color:white', 'font-size:0.65rem',
      'font-weight:700', 'display:none', 'align-items:center',
      'justify-content:center', 'padding:0 5px', 'line-height:20px',
      'text-align:center', 'border:2px solid white'
    ].join(';');
    _bellEl.appendChild(_badgeEl);

    // Pull-out tab (mobile only) — small arrow visible when bell is tucked
    _tabEl = document.createElement('div');
    _tabEl.id = 'hhpNotifTab';
    _tabEl.style.cssText = [
      'position:fixed', 'bottom:28px', 'left:0', 'z-index:997',
      'width:28px', 'height:44px',
      'background:linear-gradient(135deg,var(--gold,#c8963e),#a67c2e)',
      'border-radius:0 10px 10px 0',
      'display:flex', 'align-items:center', 'justify-content:center',
      'color:white', 'font-size:0.75rem', 'cursor:pointer',
      'box-shadow:2px 2px 10px rgba(200,150,62,0.3)',
      'opacity:0', 'pointer-events:none',
      'transition:opacity 0.3s ease'
    ].join(';');
    _tabEl.innerHTML = '›';
    _tabEl.addEventListener('click', function(e) {
      e.stopPropagation();
      untuckBell();
      _userPulledOut = true;
    });

    document.body.appendChild(_bellEl);
    document.body.appendChild(_tabEl);

    // On mobile, start tucked if nothing is new
    // (we check after data loads in init, so just set up resize listener)
    window.addEventListener('resize', function() {
      if (!isMobile()) {
        // Going to desktop — always untuck
        untuckBell();
      } else if (_tucked) {
        // Staying mobile + tucked — keep tucked
        tuckBell();
      }
    });
  }

  // ── Build the drawer ────────────────────────────────────────
  function buildDrawer() {
    if (_drawerEl) return;

    _drawerEl = document.createElement('div');
    _drawerEl.id = 'hhpNotifDrawer';
    _drawerEl.style.cssText = [
      'position:fixed', 'bottom:86px', 'left:24px', 'z-index:999',
      'width:340px', 'max-height:480px', 'background:var(--cream,white)',
      'border-radius:16px', 'box-shadow:0 12px 48px rgba(0,0,0,0.18)',
      'display:none', 'flex-direction:column', 'overflow:hidden',
      'font-family:inherit', 'animation:hhpDrawerIn 0.25s ease'
    ].join(';');

    // Add animation keyframe
    if (!document.getElementById('hhpNotifStyles')) {
      var style = document.createElement('style');
      style.id = 'hhpNotifStyles';
      style.textContent = [
        '@keyframes hhpDrawerIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }',
        '@keyframes hhpPromoSlide { from { transform:translateX(100%); } to { transform:translateX(0); } }',
        '#hhpNotifDrawer::-webkit-scrollbar { width:4px; }',
        '#hhpNotifDrawer::-webkit-scrollbar-thumb { background:rgba(200,150,62,0.3); border-radius:2px; }',
        '@media (max-width:480px) { #hhpNotifDrawer { left:12px; right:12px; width:auto !important; bottom:80px; } }',
        '@media (min-width:769px) { #hhpNotifTab { display:none !important; } }'
      ].join('\n');
      document.head.appendChild(style);
    }

    document.body.appendChild(_drawerEl);
  }

  // ── Toggle drawer ───────────────────────────────────────────
  function toggleDrawer() {
    _drawerOpen = !_drawerOpen;
    if (_drawerOpen) {
      // Make sure bell is untucked before showing drawer
      if (_tucked) untuckBell();
      renderDrawer();
      _drawerEl.style.display = 'flex';
      _bellEl.style.transform = 'scale(1.1)';
      _bellEl.innerHTML = '✕';
      _bellEl.appendChild(_badgeEl);
      // Auto-mark all as read when drawer is opened
      _announcements.forEach(function(a) { addDismissed(a.id); });
      _activeDeals.forEach(function(d) { addDismissed(d.id); });
      updateBadge();
      // Close on outside click
      setTimeout(function() {
        document.addEventListener('click', outsideClickHandler);
      }, 10);
    } else {
      closeDrawer();
    }
  }

  function closeDrawer() {
    _drawerOpen = false;
    _drawerEl.style.display = 'none';
    _bellEl.style.transform = 'scale(1)';
    _bellEl.innerHTML = '🔔';
    _bellEl.appendChild(_badgeEl);
    document.removeEventListener('click', outsideClickHandler);
    // On mobile, tuck after closing (unless user manually pulled it out)
    if (isMobile() && !_userPulledOut) {
      setTimeout(tuckBell, 400); // slight delay so close animation finishes
    }
  }

  function outsideClickHandler(e) {
    if (!_drawerEl.contains(e.target) && e.target !== _bellEl && !_bellEl.contains(e.target)) {
      closeDrawer();
    }
  }

  // ── Render drawer content ──────────────────────────────────
  function renderDrawer() {
    var dismissed = getDismissed();
    var unread = _announcements.filter(function(a) { return dismissed.indexOf(a.id) === -1; });
    var read = _announcements.filter(function(a) { return dismissed.indexOf(a.id) !== -1; });

    var html = '';

    // Header
    html += '<div style="padding:16px 18px 12px;border-bottom:1px solid rgba(0,0,0,0.06);flex-shrink:0">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between">';
    html += '<div style="font-weight:700;font-size:1rem;color:var(--dark,#1e1409)">Notifications</div>';
    if (unread.length > 0) {
      html += '<button onclick="window.HHP_Notif.dismissAll()" style="background:none;border:none;color:var(--gold,#c8963e);font-size:0.78rem;font-weight:600;cursor:pointer">Mark all read</button>';
    }
    html += '</div></div>';

    // Scrollable content
    html += '<div style="overflow-y:auto;flex:1;padding:8px 0">';

    // Active deals section
    if (_activeDeals.length > 0) {
      html += '<div style="padding:6px 18px 4px"><div style="font-size:0.7rem;font-weight:700;color:var(--gold,#c8963e);text-transform:uppercase;letter-spacing:0.05em">Active Specials</div></div>';
      _activeDeals.forEach(function(deal) {
        html += '<div style="margin:4px 12px;padding:12px 14px;background:linear-gradient(135deg,rgba(200,150,62,0.08),rgba(200,150,62,0.03));border-radius:10px;border:1px solid rgba(200,150,62,0.15)">';
        html += '<div style="font-weight:700;font-size:0.85rem;color:var(--dark,#1e1409)">🏷️ ' + (deal.name || 'Special Offer') + '</div>';
        if (deal.details) html += '<div style="font-size:0.78rem;color:var(--mid,#8c6b4a);margin-top:3px">' + deal.details + '</div>';
        if (deal.promo_code) html += '<div style="margin-top:6px;display:inline-block;background:var(--gold,#c8963e);color:white;font-size:0.7rem;font-weight:700;padding:2px 10px;border-radius:20px;letter-spacing:0.03em">' + deal.promo_code + '</div>';
        html += '</div>';
      });
    }

    // Unread announcements
    if (unread.length > 0) {
      html += '<div style="padding:8px 18px 4px"><div style="font-size:0.7rem;font-weight:700;color:var(--forest,#3d5a47);text-transform:uppercase;letter-spacing:0.05em">New</div></div>';
      unread.forEach(function(a) {
        html += renderAnnouncementItem(a, false);
      });
    }

    // Read announcements (collapsed)
    if (read.length > 0) {
      html += '<div style="padding:8px 18px 4px"><div style="font-size:0.7rem;font-weight:700;color:var(--mid,#8c6b4a);text-transform:uppercase;letter-spacing:0.05em">Earlier</div></div>';
      read.slice(0, 5).forEach(function(a) {
        html += renderAnnouncementItem(a, true);
      });
    }

    // Empty state
    if (_announcements.length === 0 && _activeDeals.length === 0) {
      html += '<div style="text-align:center;padding:40px 20px;color:var(--mid,#8c6b4a)">';
      html += '<div style="font-size:2.5rem;margin-bottom:10px">🔔</div>';
      html += '<div style="font-weight:600;font-size:0.9rem">All caught up!</div>';
      html += '<div style="font-size:0.8rem;margin-top:4px;opacity:0.7">Announcements and deals will appear here.</div>';
      html += '</div>';
    }

    html += '</div>'; // end scrollable

    _drawerEl.innerHTML = html;
  }

  function renderAnnouncementItem(a, isRead) {
    var opacity = isRead ? '0.65' : '1';
    var bg = isRead ? 'transparent' : 'rgba(61,90,71,0.04)';
    var html = '';
    html += '<div style="padding:10px 18px;opacity:' + opacity + ';background:' + bg + ';border-bottom:1px solid rgba(0,0,0,0.04);position:relative">';

    // Dismiss button for unread
    if (!isRead) {
      html += '<button onclick="window.HHP_Notif.dismiss(\'' + a.id + '\')" style="position:absolute;top:8px;right:12px;background:none;border:none;color:var(--mid,#8c6b4a);font-size:0.75rem;cursor:pointer;opacity:0.6;padding:4px" title="Dismiss">✕</button>';
    }

    html += '<div style="font-size:0.85rem;color:var(--dark,#1e1409);line-height:1.45;padding-right:20px">' + escapeHtml(a.body) + '</div>';

    // Discount tag if attached
    if (a.has_discount && a.discount_name) {
      html += '<div style="margin-top:6px;display:inline-block;background:linear-gradient(135deg,var(--gold,#c8963e),#a67c2e);color:white;font-size:0.7rem;font-weight:700;padding:3px 10px;border-radius:20px">🏷️ ' + escapeHtml(a.discount_name) + '</div>';
    }

    html += '<div style="font-size:0.7rem;color:var(--mid,#8c6b4a);margin-top:5px;opacity:0.7">' + timeAgo(a.created_at) + '</div>';
    html += '</div>';
    return html;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ── Badge count ─────────────────────────────────────────────
  function updateBadge() {
    var dismissed = getDismissed();
    var count = _announcements.filter(function(a) { return dismissed.indexOf(a.id) === -1; }).length;
    // Also count active deals as "new" if user hasn't seen them
    count += _activeDeals.filter(function(d) { return dismissed.indexOf(d.id) === -1; }).length;

    if (count > 0) {
      _badgeEl.textContent = count > 9 ? '9+' : count;
      _badgeEl.style.display = 'flex';
      // Subtle pulse animation on bell
      _bellEl.style.animation = 'none';
      setTimeout(function() { _bellEl.style.animation = ''; }, 10);
      // Mobile: slide out if tucked — new content needs attention
      if (isMobile() && _tucked) {
        untuckBell();
      }
    } else {
      _badgeEl.style.display = 'none';
      // Mobile: tuck away if nothing new and user hasn't pulled it out
      if (isMobile() && !_tucked && !_drawerOpen && !_userPulledOut) {
        tuckBell();
      }
    }
  }

  // ── Promo strip (on services/booking section) — DISABLED per owner request ──
  function buildPromoStrip() {
    if (_promoStripEl) { _promoStripEl.remove(); _promoStripEl = null; }
    return;
    if (_activeDeals.length === 0) {
      if (_promoStripEl) { _promoStripEl.remove(); _promoStripEl = null; }
      return;
    }

    // Find the services section to prepend the strip
    var servicesSection = document.getElementById('services') || document.querySelector('.services-grid');
    if (!servicesSection) return;

    if (!_promoStripEl) {
      _promoStripEl = document.createElement('div');
      _promoStripEl.id = 'hhpPromoStrip';
      _promoStripEl.style.cssText = [
        'background:linear-gradient(135deg,rgba(200,150,62,0.1),rgba(200,150,62,0.04))',
        'border:1px solid rgba(200,150,62,0.2)',
        'border-radius:12px', 'padding:12px 20px',
        'margin-bottom:20px', 'display:flex', 'align-items:center',
        'gap:12px', 'flex-wrap:wrap', 'animation:hhpPromoSlide 0.4s ease'
      ].join(';');
      servicesSection.parentElement.insertBefore(_promoStripEl, servicesSection);
    }

    var html = '<div style="font-size:1.1rem">🏷️</div>';
    html += '<div style="flex:1;min-width:200px">';

    if (_activeDeals.length === 1) {
      var d = _activeDeals[0];
      html += '<div style="font-weight:700;font-size:0.88rem;color:var(--dark,#1e1409)">' + escapeHtml(d.name) + '</div>';
      if (d.details) html += '<div style="font-size:0.78rem;color:var(--mid,#8c6b4a)">' + escapeHtml(d.details) + '</div>';
    } else {
      html += '<div style="font-weight:700;font-size:0.88rem;color:var(--dark,#1e1409)">' + _activeDeals.length + ' Active Specials!</div>';
      html += '<div style="font-size:0.78rem;color:var(--mid,#8c6b4a)">' + _activeDeals.map(function(d) { return d.name; }).join(' · ') + '</div>';
    }
    html += '</div>';

    // CTA removed — bell bubble already shows the deal info

    _promoStripEl.innerHTML = html;
  }

  // ── Fetch data from Supabase ────────────────────────────────
  async function fetchAnnouncements() {
    var sb = getSB();
    if (!sb) return;

    try {
      // Fetch recent announcements (last 30 days)
      var thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      var res = await sb.from('announcements')
        .select('*')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(20);

      if (res.data) _announcements = res.data;
    } catch (e) {
      console.warn('Failed to load announcements:', e);
    }
  }

  async function fetchActiveDeals() {
    var sb = getSB();
    if (!sb) return;

    try {
      var res = await sb.from('deals')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (res.data) _activeDeals = res.data;
    } catch (e) {
      console.warn('Failed to load deals:', e);
    }
  }

  // ── Owner: Load announcement history for re-send ───────────
  async function loadAnnouncementHistory(container) {
    var sb = getSB();
    if (!sb) return;

    try {
      var res = await sb.from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!res.data || res.data.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--mid,#8c6b4a);font-size:0.85rem">No past announcements yet.</div>';
        return;
      }

      var html = '';
      res.data.forEach(function(a) {
        var date = new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        html += '<div id="announce-row-' + a.id + '" style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 14px;background:var(--bg-soft,#faf6ee);border-radius:10px;margin-bottom:8px;gap:10px">';
        html += '<div style="flex:1;min-width:0">';
        html += '<div style="font-size:0.84rem;color:var(--dark,#1e1409);line-height:1.4;word-break:break-word">' + escapeHtml(a.body) + '</div>';
        html += '<div style="font-size:0.7rem;color:var(--mid,#8c6b4a);margin-top:4px">' + date + ' · Sent to: ' + (a.send_to || 'everyone') + '</div>';
        html += '</div>';
        html += '<div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">';
        html += '<button onclick="window.HHP_Notif.resend(\'' + a.id + '\')" style="background:var(--gold,#c8963e);color:white;border:none;padding:6px 14px;border-radius:6px;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">Re-send</button>';
        html += '<button onclick="window.HHP_Notif.deleteAnnouncement(\'' + a.id + '\')" style="background:none;color:var(--rose,#c0392b);border:1px solid var(--rose,#c0392b);padding:5px 14px;border-radius:6px;font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">Remove</button>';
        html += '</div>';
        html += '</div>';
      });

      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<div style="color:var(--rose);padding:12px;font-size:0.82rem">Error loading history.</div>';
    }
  }

  // ── Re-send a past announcement ─────────────────────────────
  async function resendAnnouncement(announcementId) {
    var sb = getSB();
    if (!sb) return;

    try {
      // Get the announcement
      var res = await sb.from('announcements').select('*').eq('id', announcementId).single();
      if (!res.data) { if (typeof toast === 'function') toast('Announcement not found.'); return; }

      // Pre-fill the announce text
      var textArea = document.getElementById('announce-text');
      if (textArea) {
        textArea.value = res.data.body;
        // Open the modal
        if (typeof openModal === 'function') openModal('announceModal');
        if (typeof toast === 'function') toast('📝 Announcement loaded — edit or send as-is.');
      }
    } catch (e) {
      console.error('Resend error:', e);
      if (typeof toast === 'function') toast('Error loading announcement.');
    }
  }

  // ── Delete an announcement (owner only) ─────────────────────
  async function deleteAnnouncement(announcementId) {
    var sb = getSB();
    if (!sb) return;

    if (!confirm('Remove this announcement? It will be deleted from history and clients\' notification feeds.')) return;

    try {
      var { error } = await sb.from('announcements').delete().eq('id', announcementId);
      if (error) {
        if (typeof toast === 'function') toast('Failed to remove announcement.');
        console.error('Delete announcement error:', error);
        return;
      }

      // Remove from local list
      _announcements = _announcements.filter(function(a) { return a.id !== announcementId; });

      // Remove the row from the history UI
      var row = document.getElementById('announce-row-' + announcementId);
      if (row) {
        row.style.transition = 'opacity 0.3s, transform 0.3s';
        row.style.opacity = '0';
        row.style.transform = 'translateX(20px)';
        setTimeout(function() { row.remove(); }, 300);
      }

      // Update badge and drawer
      updateBadge();
      if (_drawerOpen) renderDrawer();

      if (typeof toast === 'function') toast('✅ Announcement removed.');
    } catch (e) {
      console.error('Delete announcement error:', e);
      if (typeof toast === 'function') toast('Error removing announcement.');
    }
  }

  // ── Dismiss / mark read ─────────────────────────────────────
  function dismissNotif(id) {
    addDismissed(id);
    updateBadge();
    if (_drawerOpen) renderDrawer();
  }

  function dismissAll() {
    _announcements.forEach(function(a) { addDismissed(a.id); });
    _activeDeals.forEach(function(d) { addDismissed(d.id); });
    updateBadge();
    if (_drawerOpen) renderDrawer();
  }

  // ── Subscribe to realtime announcements ─────────────────────
  var _announcementsChannel = null;

  function subscribeToAnnouncements() {
    var sb = getSB();
    if (!sb || _announcementsChannel) return;

    try {
      _announcementsChannel = sb.channel('announcements-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, function(payload) {
          _announcements.unshift(payload.new);
          updateBadge();
          if (_drawerOpen) renderDrawer();
          // Also show a brief toast
          if (typeof toast === 'function') {
            var preview = (payload.new.body || '').substring(0, 60);
            toast('📢 ' + preview + (payload.new.body.length > 60 ? '...' : ''));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, function() {
          // Refresh deals on any change
          fetchActiveDeals().then(function() {
            updateBadge();
            buildPromoStrip();
            if (_drawerOpen) renderDrawer();
          }).catch(function(err) {
            console.warn('Failed to fetch active deals in realtime:', err);
          });
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription error:', e);
    }
  }

  // ── Save announcement to table (called from submitAnnouncement) ──
  async function saveAnnouncement(body, sendTo, via, discountName, discountDetails) {
    var sb = getSB();
    if (!sb) return;

    try {
      await sb.from('announcements').insert([{
        body: body,
        send_to: sendTo || 'everyone',
        via: via || 'in_app_email',
        has_discount: !!discountName,
        discount_name: discountName || null,
        discount_details: discountDetails || null,
        created_by: window.HHP_Auth.currentUser.id
      }]);
    } catch (e) {
      console.warn('Failed to save announcement:', e);
    }
  }

  // ── Initialize ──────────────────────────────────────────────
  var _notifInitialized = false;
  async function init() {
    if (_notifInitialized) return;
    _notifInitialized = true;
    buildBell();
    buildDrawer();

    // Fetch data
    try {
      await Promise.all([fetchAnnouncements(), fetchActiveDeals()]);
    } catch (err) {
      console.warn('Failed to fetch notifications data:', err);
    }

    // Update UI
    updateBadge();
    buildPromoStrip();

    // Mobile: if nothing new after data loads, start tucked
    if (isMobile()) {
      var dismissed = getDismissed();
      var unreadCount = _announcements.filter(function(a) { return dismissed.indexOf(a.id) === -1; }).length;
      unreadCount += _activeDeals.filter(function(d) { return dismissed.indexOf(d.id) === -1; }).length;
      if (unreadCount === 0) {
        // Small delay so user sees it tuck away smoothly
        setTimeout(tuckBell, 1200);
      }
      // If there IS new content, bell stays out (untucked) with badge showing
    }

    // Realtime
    subscribeToAnnouncements();

    console.log('🔔 HHP Notifications initialized');
  }

  // Wait for DOM + auth
  function onReady(fn) {
    if (document.readyState !== 'loading') setTimeout(fn, 600);
    else document.addEventListener('DOMContentLoaded', function() { setTimeout(fn, 600); });
  }

  onReady(function() {
    // Use event-based auth signaling instead of polling
    if (window.HHP_Auth && window.HHP_Auth.supabase) {
      init();
    } else {
      // Listen for auth ready event, with a single fallback timeout
      var initiated = false;
      function tryInit() {
        if (initiated) return;
        initiated = true;
        init();
      }
      window.addEventListener('hhp-auth-ready', tryInit, { once: true });
      setTimeout(tryInit, 3000); // fallback if event never fires
    }
  });

  // ── Public API ──────────────────────────────────────────────
  window.HHP_Notif = {
    init: init,
    dismiss: dismissNotif,
    dismissAll: dismissAll,
    resend: resendAnnouncement,
    deleteAnnouncement: deleteAnnouncement,
    loadHistory: loadAnnouncementHistory,
    saveAnnouncement: saveAnnouncement,
    refresh: async function() {
      try {
        await Promise.all([fetchAnnouncements(), fetchActiveDeals()]);
      } catch (err) {
        console.warn('Failed to refresh notifications:', err);
      }
      updateBadge();
      buildPromoStrip();
      if (_drawerOpen) renderDrawer();
    },
    cleanup: function() {
      if (_announcementsChannel) {
        _announcementsChannel.unsubscribe();
        _announcementsChannel = null;
      }
    }
  };

})();
