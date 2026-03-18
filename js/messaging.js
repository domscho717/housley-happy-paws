// ============================================================
//  HHP Messaging System — Real-time Supabase-backed messaging
//  Handles: client↔owner, staff↔owner, owner↔anyone
//  Features: persistence, read tracking, unread badges, alerts
// ============================================================

(function () {
  'use strict';

  // --- Helpers ---
  function getSB() {
    return window.HHP_Auth && window.HHP_Auth.supabase;
  }

  function getCurrentUser() {
    var sb = getSB();
    if (!sb) return null;
    // supabase v2
    if (sb.auth && sb.auth.getUser) {
      var sess = null;
      try { sess = sb.auth.getSession && sb.auth.getSession(); } catch (e) {}
    }
    // Fallback — look at cached session
    var key = Object.keys(localStorage).find(function (k) { return k.indexOf('supabase.auth.token') > -1 || k.indexOf('sb-') > -1; });
    if (key) {
      try {
        var d = JSON.parse(localStorage.getItem(key));
        if (d && d.user) return d.user;
        if (d && d.currentSession && d.currentSession.user) return d.currentSession.user;
      } catch (e) {}
    }
    return null;
  }

  function getUserRole() {
    var el = document.getElementById('pg-owner');
    if (el && el.style.display !== 'none' && el.offsetParent !== null) return 'owner';
    el = document.getElementById('pg-staff');
    if (el && el.style.display !== 'none' && el.offsetParent !== null) return 'staff';
    return 'client';
  }

  // Better role detection — check which portal page is currently visible
  function getActivePortal() {
    var pages = ['pg-owner', 'pg-staff', 'pg-client'];
    for (var i = 0; i < pages.length; i++) {
      var el = document.getElementById(pages[i]);
      if (el && (el.classList.contains('active') || (el.style.display && el.style.display !== 'none'))) {
        return pages[i].replace('pg-', '');
      }
    }
    // Fallback: check profile role
    return 'client';
  }

  // Avatar HTML helper
  function avatarHTML(name, size) {
    size = size || 32;
    var initial = (name || '?').charAt(0).toUpperCase();
    var colors = {
      'A': '#e74c3c', 'B': '#3498db', 'C': '#2ecc71', 'D': '#9b59b6', 'E': '#f39c12',
      'F': '#1abc9c', 'G': '#e67e22', 'H': '#e84393', 'I': '#00cec9', 'J': '#6c5ce7',
      'K': '#fd79a8', 'L': '#00b894', 'M': '#d35400', 'N': '#2980b9', 'O': '#8e44ad',
      'P': '#27ae60', 'Q': '#c0392b', 'R': '#f1c40f', 'S': '#16a085', 'T': '#e74c3c'
    };
    var bg = colors[initial] || '#c8963e';
    return '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + bg +
      ';display:flex;align-items:center;justify-content:center;font-size:' + (size * 0.4) + 'px;' +
      'color:white;font-weight:700;flex-shrink:0">' + initial + '</div>';
  }

  // Time formatting
  function timeAgo(dateStr) {
    var now = new Date();
    var d = new Date(dateStr);
    var diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
  }

  function formatTime(dateStr) {
    var d = new Date(dateStr);
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  // --- Profile cache ---
  var _profileCache = {};

  async function getProfile(userId) {
    if (_profileCache[userId]) return _profileCache[userId];
    var sb = getSB();
    if (!sb) return { full_name: 'Unknown', role: 'client' };
    var { data } = await sb.from('profiles').select('full_name, role, avatar_url').eq('id', userId).single();
    if (data) _profileCache[userId] = data;
    return data || { full_name: 'Unknown', role: 'client' };
  }

  // Get owner profile ID (cached)
  var _ownerIdCache = null;
  async function getOwnerId() {
    if (_ownerIdCache) return _ownerIdCache;
    var sb = getSB();
    if (!sb) return null;
    var { data } = await sb.from('profiles').select('id').eq('role', 'owner').limit(1).single();
    if (data) _ownerIdCache = data.id;
    return _ownerIdCache;
  }

  // ============================================================
  //  CORE: Send a message
  // ============================================================
  async function sendMessage(recipientId, body) {
    var sb = getSB();
    if (!sb || !body || !body.trim()) return null;

    var user = getCurrentUser();
    if (!user) { toast('Please sign in to send messages.'); return null; }

    var { data, error } = await sb.from('messages').insert({
      sender_id: user.id,
      recipient_id: recipientId,
      body: body.trim()
    }).select().single();

    if (error) {
      console.error('Send message error:', error);
      toast('Failed to send message. Please try again.');
      return null;
    }

    return data;
  }

  // ============================================================
  //  CORE: Load conversation between two users
  // ============================================================
  async function loadConversation(otherUserId, limit) {
    var sb = getSB();
    if (!sb) return [];
    var user = getCurrentUser();
    if (!user) return [];

    limit = limit || 50;

    var { data, error } = await sb.from('messages')
      .select('*')
      .or('and(sender_id.eq.' + user.id + ',recipient_id.eq.' + otherUserId + '),and(sender_id.eq.' + otherUserId + ',recipient_id.eq.' + user.id + ')')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) { console.error('Load conversation error:', error); return []; }
    return data || [];
  }

  // ============================================================
  //  CORE: Mark messages as read
  // ============================================================
  async function markAsRead(otherUserId) {
    var sb = getSB();
    if (!sb) return;
    var user = getCurrentUser();
    if (!user) return;

    await sb.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', otherUserId)
      .eq('recipient_id', user.id)
      .is('read_at', null);
  }

  // ============================================================
  //  CORE: Get unread count
  // ============================================================
  async function getUnreadCount() {
    var sb = getSB();
    if (!sb) return 0;
    var user = getCurrentUser();
    if (!user) return 0;

    var { count, error } = await sb.from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null);

    if (error) return 0;
    return count || 0;
  }

  // ============================================================
  //  CORE: Get conversation list (for owner inbox)
  // ============================================================
  async function getConversationList() {
    var sb = getSB();
    if (!sb) return [];
    var user = getCurrentUser();
    if (!user) return [];

    // Get all messages involving this user, newest first
    var { data, error } = await sb.from('messages')
      .select('*')
      .or('sender_id.eq.' + user.id + ',recipient_id.eq.' + user.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error || !data) return [];

    // Group by conversation partner
    var convos = {};
    for (var i = 0; i < data.length; i++) {
      var msg = data[i];
      var partnerId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
      if (!convos[partnerId]) {
        convos[partnerId] = {
          partnerId: partnerId,
          lastMessage: msg,
          unread: 0
        };
      }
      if (msg.recipient_id === user.id && !msg.read_at) {
        convos[partnerId].unread++;
      }
    }

    // Convert to array and sort by last message time
    var list = Object.values(convos);
    list.sort(function (a, b) {
      return new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at);
    });

    return list;
  }

  // ============================================================
  //  UI: Render a message thread into a container
  // ============================================================
  async function renderThread(containerId, messages, myId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    if (!messages || messages.length === 0) {
      container.innerHTML = '<div style="align-self:center;color:var(--mid);font-size:0.84rem;padding:20px">No messages yet — say hello!</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < messages.length; i++) {
      var msg = messages[i];
      var isMine = msg.sender_id === myId;
      var profile = await getProfile(msg.sender_id);
      var name = profile.full_name || 'Unknown';
      var ava = avatarHTML(name, 32);

      if (isMine) {
        html += '<div style="display:flex;gap:8px;align-items:flex-end;justify-content:flex-end">' +
          '<div style="flex:1;text-align:right"><div class="msg-out">' + escHTML(msg.body) + '</div>' +
          '<div class="msg-meta" style="text-align:right">You · ' + formatTime(msg.created_at) + '</div></div>' +
          ava + '</div>';
      } else {
        html += '<div style="display:flex;gap:8px;align-items:flex-end">' +
          ava + '<div><div class="msg-in">' + escHTML(msg.body) + '</div>' +
          '<div class="msg-meta">' + escHTML(name) + ' · ' + formatTime(msg.created_at) + '</div></div></div>';
      }
    }

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }

  function escHTML(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // ============================================================
  //  UI: Client Messages Panel (c-msgs)
  // ============================================================
  async function loadClientMessages() {
    var sb = getSB();
    if (!sb) return;
    var user = getCurrentUser();
    if (!user) return;

    var ownerId = await getOwnerId();
    if (!ownerId) return;

    // Load conversation with owner
    var messages = await loadConversation(ownerId);

    // Render into the thread
    var threadEl = document.getElementById('cMsgs');
    if (!threadEl) return;
    await renderThread('cMsgs', messages, user.id);

    // Mark as read
    await markAsRead(ownerId);

    // Update badge
    updateUnreadBadges();
  }

  // ============================================================
  //  UI: Staff Messages Panel (s-msgs)
  // ============================================================
  async function loadStaffMessages() {
    var sb = getSB();
    if (!sb) return;
    var user = getCurrentUser();
    if (!user) return;

    var ownerId = await getOwnerId();
    if (!ownerId) return;

    var messages = await loadConversation(ownerId);

    // The staff panel doesn't have an ID on msg-thread, let's find it
    var panel = document.getElementById('s-msgs');
    if (!panel) return;
    var threadEl = panel.querySelector('.msg-thread');
    if (!threadEl) return;
    if (!threadEl.id) threadEl.id = 'sMsgs';

    await renderThread(threadEl.id, messages, user.id);
    await markAsRead(ownerId);
    updateUnreadBadges();
  }

  // ============================================================
  //  UI: Owner Messages Panel (o-msgs) — Full inbox
  // ============================================================
  async function loadOwnerInbox() {
    var sb = getSB();
    if (!sb) return;
    var user = getCurrentUser();
    if (!user) return;

    var panel = document.getElementById('o-msgs');
    if (!panel) return;

    var convos = await getConversationList();

    if (convos.length === 0) {
      panel.innerHTML =
        '<div class="p-header"><h2>All Messages 💬</h2><p>Every client & staff conversation in one inbox.</p></div>' +
        '<div class="card"><div style="padding:28px;text-align:center;color:var(--mid)">' +
        '<div style="font-size:2rem;margin-bottom:10px">💬</div>' +
        '<div style="font-weight:600;margin-bottom:6px">No messages yet</div>' +
        '<div style="font-size:0.84rem">Messages from clients and staff will appear here.</div>' +
        '</div></div>';
      return;
    }

    var html = '<div class="p-header"><h2>All Messages 💬</h2><p>Every client & staff conversation in one inbox.</p></div>';
    html += '<div class="card" style="padding:0;overflow:hidden">';
    html += '<div id="ownerConvoList" style="border-right:1px solid var(--border)">';

    for (var i = 0; i < convos.length; i++) {
      var c = convos[i];
      var profile = await getProfile(c.partnerId);
      var name = profile.full_name || 'Unknown';
      var role = profile.role || 'client';
      var roleBadge = role === 'staff' ? '<span style="background:var(--forest-pale);color:var(--forest);font-size:0.65rem;padding:1px 6px;border-radius:4px;font-weight:600;margin-left:6px">Staff</span>' : '';
      var preview = c.lastMessage.body.length > 50 ? c.lastMessage.body.substring(0, 50) + '...' : c.lastMessage.body;
      var unreadDot = c.unread > 0 ? '<span style="background:var(--rose);color:white;border-radius:10px;padding:1px 7px;font-size:0.65rem;font-weight:800;margin-left:auto">' + c.unread + '</span>' : '';

      html += '<div class="owner-convo-item" onclick="HHP_Messaging.openConvo(\'' + c.partnerId + '\',\'' + escHTML(name) + '\')" ' +
        'style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.15s' +
        (c.unread > 0 ? ';background:rgba(200,150,62,0.08)' : '') + '"' +
        ' onmouseover="this.style.background=\'rgba(200,150,62,0.12)\'" onmouseout="this.style.background=\'' + (c.unread > 0 ? 'rgba(200,150,62,0.08)' : '') + '\'">' +
        avatarHTML(name, 40) +
        '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;align-items:center;gap:4px"><span style="font-weight:600;font-size:0.88rem">' + escHTML(name) + '</span>' + roleBadge + unreadDot + '</div>' +
        '<div style="font-size:0.78rem;color:var(--mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHTML(preview) + '</div>' +
        '</div>' +
        '<div style="font-size:0.7rem;color:var(--mid);flex-shrink:0">' + timeAgo(c.lastMessage.created_at) + '</div>' +
        '</div>';
    }

    html += '</div>';
    // Conversation view area
    html += '<div id="ownerConvoView" style="display:none;padding:16px">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">' +
      '<button onclick="HHP_Messaging.closeConvo()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;padding:4px">←</button>' +
      '<div id="ownerConvoName" style="font-weight:700;font-size:0.95rem"></div>' +
      '</div>' +
      '<div class="msg-thread" id="ownerMsgs" style="max-height:400px"></div>' +
      '<div class="msg-input-row" style="margin-top:8px"><input class="msg-input" id="ownerMsgIn" placeholder="Type a message..." onkeydown="if(event.key===\'Enter\')HHP_Messaging.sendFromOwner()"><button class="msg-send" onclick="HHP_Messaging.sendFromOwner()">➤</button></div>' +
      '</div>';
    html += '</div>';

    panel.innerHTML = html;
  }

  // Owner: open a specific conversation
  var _currentConvoPartnerId = null;

  async function openOwnerConvo(partnerId, partnerName) {
    _currentConvoPartnerId = partnerId;

    var list = document.getElementById('ownerConvoList');
    var view = document.getElementById('ownerConvoView');
    var nameEl = document.getElementById('ownerConvoName');
    if (!list || !view) return;

    list.style.display = 'none';
    view.style.display = 'block';
    if (nameEl) nameEl.textContent = partnerName;

    var user = getCurrentUser();
    if (!user) return;
    var messages = await loadConversation(partnerId);
    await renderThread('ownerMsgs', messages, user.id);
    await markAsRead(partnerId);
    updateUnreadBadges();
  }

  function closeOwnerConvo() {
    _currentConvoPartnerId = null;
    var list = document.getElementById('ownerConvoList');
    var view = document.getElementById('ownerConvoView');
    if (list) list.style.display = '';
    if (view) view.style.display = 'none';
    // Refresh inbox
    loadOwnerInbox();
  }

  // Owner: send from inbox view
  async function sendFromOwner() {
    if (!_currentConvoPartnerId) return;
    var inp = document.getElementById('ownerMsgIn');
    if (!inp || !inp.value.trim()) return;
    var body = inp.value.trim();
    inp.value = '';
    await sendMessage(_currentConvoPartnerId, body);
    // Reload the conversation
    var user = getCurrentUser();
    if (user) {
      var messages = await loadConversation(_currentConvoPartnerId);
      await renderThread('ownerMsgs', messages, user.id);
    }
  }

  // ============================================================
  //  UI: Alerts section in owner overview
  // ============================================================
  async function loadAlertMessages() {
    var sb = getSB();
    if (!sb) return;
    var user = getCurrentUser();
    if (!user) return;

    var dashboard = document.getElementById('hhpAdminDashboard');
    if (!dashboard) return;

    // Get unread messages for owner
    var { data: unreadMsgs, error } = await sb.from('messages')
      .select('*')
      .eq('recipient_id', user.id)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error || !unreadMsgs) unreadMsgs = [];

    // Build the alert messages section
    var alertHTML = '';
    if (unreadMsgs.length > 0) {
      alertHTML += '<div style="margin-bottom:14px">';
      alertHTML += '<div style="font-size:0.82rem;font-weight:700;color:var(--ink);margin-bottom:8px">💬 New Messages (' + unreadMsgs.length + ')</div>';
      for (var i = 0; i < unreadMsgs.length; i++) {
        var msg = unreadMsgs[i];
        var profile = await getProfile(msg.sender_id);
        var name = profile.full_name || 'Unknown';
        var preview = msg.body.length > 60 ? msg.body.substring(0, 60) + '...' : msg.body;

        alertHTML += '<div onclick="sTab(\'o\',\'o-msgs\');HHP_Messaging.openConvo(\'' + msg.sender_id + '\',\'' + escHTML(name) + '\')" ' +
          'style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(200,150,62,0.08);border-radius:8px;margin-bottom:6px;cursor:pointer;transition:background 0.15s" ' +
          'onmouseover="this.style.background=\'rgba(200,150,62,0.15)\'" onmouseout="this.style.background=\'rgba(200,150,62,0.08)\'">' +
          avatarHTML(name, 28) +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:600;font-size:0.82rem">' + escHTML(name) + '</div>' +
          '<div style="font-size:0.76rem;color:var(--mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHTML(preview) + '</div>' +
          '</div>' +
          '<div style="font-size:0.68rem;color:var(--mid);flex-shrink:0">' + timeAgo(msg.created_at) + '</div>' +
          '</div>';
      }
      alertHTML += '<button class="btn btn-outline btn-sm" onclick="sTab(\'o\',\'o-msgs\')" style="width:100%;justify-content:center;margin-top:6px;font-size:0.78rem">View All Messages</button>';
      alertHTML += '</div>';
    } else {
      alertHTML += '<div style="margin-bottom:14px">';
      alertHTML += '<div style="font-size:0.82rem;font-weight:700;color:var(--ink);margin-bottom:8px">💬 Messages</div>';
      alertHTML += '<div style="padding:10px;text-align:center;color:var(--mid);font-size:0.82rem">No new messages</div>';
      alertHTML += '</div>';
    }

    // Insert BEFORE the booking admin filter bar (if it exists), or at the top of the dashboard
    var filterBar = document.getElementById('adminFilterBar');
    var alertContainer = document.getElementById('hhpAlertMessages');
    if (!alertContainer) {
      alertContainer = document.createElement('div');
      alertContainer.id = 'hhpAlertMessages';
      if (filterBar) {
        filterBar.parentNode.insertBefore(alertContainer, filterBar);
      } else {
        // Insert after the card-title
        var title = dashboard.querySelector('.card-title');
        if (title) {
          title.insertAdjacentElement('afterend', alertContainer);
        } else {
          dashboard.prepend(alertContainer);
        }
      }
    }
    alertContainer.innerHTML = alertHTML;
  }

  // ============================================================
  //  UI: Unread badge on sidebar
  // ============================================================
  async function updateUnreadBadges() {
    var count = await getUnreadCount();

    // Find all message sidebar buttons and update badges
    var msgButtons = document.querySelectorAll('.sb-item');
    for (var i = 0; i < msgButtons.length; i++) {
      var btn = msgButtons[i];
      var text = btn.textContent || '';
      if (text.indexOf('Messages') > -1 || text.indexOf('All Messages') > -1) {
        // Remove existing badge
        var oldBadge = btn.querySelector('.sb-badge');
        if (oldBadge) oldBadge.remove();

        // Add new badge if unread
        if (count > 0) {
          var badge = document.createElement('span');
          badge.className = 'sb-badge';
          badge.textContent = count > 99 ? '99+' : count;
          btn.appendChild(badge);
        }
      }
    }
  }

  // ============================================================
  //  Realtime subscription for new messages
  // ============================================================
  var _realtimeChannel = null;

  function subscribeToMessages() {
    var sb = getSB();
    if (!sb || _realtimeChannel) return;
    var user = getCurrentUser();
    if (!user) return;

    _realtimeChannel = sb.channel('messages-' + user.id)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: 'recipient_id=eq.' + user.id },
        async function (payload) {
          var msg = payload.new;
          if (!msg) return;

          var profile = await getProfile(msg.sender_id);
          var name = profile.full_name || 'Someone';

          // Show toast notification
          toast('💬 New message from ' + name);

          // Update badges
          updateUnreadBadges();

          // If viewing the conversation with this person, auto-append + mark read
          var portal = getActivePortal();

          if (portal === 'owner') {
            // If owner is in the convo with this sender
            if (_currentConvoPartnerId === msg.sender_id) {
              var messages = await loadConversation(msg.sender_id);
              await renderThread('ownerMsgs', messages, user.id);
              await markAsRead(msg.sender_id);
              updateUnreadBadges();
            }
            // Refresh alerts in overview
            loadAlertMessages();
          } else if (portal === 'client') {
            // Refresh client messages if viewing
            var cPanel = document.getElementById('c-msgs');
            if (cPanel && cPanel.classList.contains('active')) {
              loadClientMessages();
            }
          } else if (portal === 'staff') {
            var sPanel = document.getElementById('s-msgs');
            if (sPanel && sPanel.classList.contains('active')) {
              loadStaffMessages();
            }
          }

          // Show notification indicator on current portal
          showNotificationDot(portal);
        }
      )
      .subscribe();
  }

  // Notification dot on the sidebar
  function showNotificationDot(portal) {
    // The Messages sidebar button gets a pulse effect briefly
    var msgButtons = document.querySelectorAll('.sb-item');
    for (var i = 0; i < msgButtons.length; i++) {
      var btn = msgButtons[i];
      if ((btn.textContent || '').indexOf('Messages') > -1) {
        btn.style.transition = 'background 0.3s';
        btn.style.background = 'rgba(200,150,62,0.25)';
        setTimeout(function (b) {
          if (!b.classList.contains('active')) b.style.background = '';
        }, 2000, btn);
      }
    }
  }

  // ============================================================
  //  REPLACEMENT: sendMsg() — drop-in replacement for the old fake one
  // ============================================================
  async function sendMsgReal(prefix) {
    var inp = document.getElementById(prefix + 'MsgIn');
    if (!inp || !inp.value.trim()) return;

    var body = inp.value.trim();
    inp.value = '';

    var user = getCurrentUser();
    if (!user) { toast('Please sign in to send messages.'); return; }

    // Determine recipient
    var recipientId;
    if (prefix === 'c' || prefix === 's') {
      // Client and staff message the owner
      recipientId = await getOwnerId();
    }
    if (!recipientId) {
      toast('Could not find recipient.');
      return;
    }

    // Optimistically show the message
    var threadEl = document.getElementById(prefix + 'Msgs');
    if (threadEl) {
      var ava = avatarHTML(user.email ? user.email.charAt(0) : 'Y', 32);
      var d = document.createElement('div');
      d.style.cssText = 'display:flex;gap:8px;align-items:flex-end;justify-content:flex-end';
      d.innerHTML = '<div style="flex:1;text-align:right"><div class="msg-out">' + escHTML(body) + '</div><div class="msg-meta" style="text-align:right">You · Just now</div></div>' + ava;
      threadEl.appendChild(d);
      threadEl.scrollTop = threadEl.scrollHeight;
    }

    // Send to DB
    var result = await sendMessage(recipientId, body);
    if (!result && threadEl) {
      // Failed — add error indicator
      var last = threadEl.lastElementChild;
      if (last) {
        var meta = last.querySelector('.msg-meta');
        if (meta) meta.innerHTML = 'You · <span style="color:var(--rose)">Failed to send</span>';
      }
    }
  }

  // ============================================================
  //  INIT: Hook everything up
  // ============================================================
  function init() {
    // Override the old sendMsg
    window.sendMsg = sendMsgReal;

    // Subscribe to realtime
    subscribeToMessages();

    // Update badges on load
    setTimeout(updateUnreadBadges, 1000);

    // Load alert messages in overview if owner
    setTimeout(function () {
      if (document.getElementById('hhpAdminDashboard')) {
        loadAlertMessages();
      }
    }, 1500);
  }

  // ============================================================
  //  PUBLIC API
  // ============================================================
  window.HHP_Messaging = {
    init: init,
    sendMessage: sendMessage,
    loadClientMessages: loadClientMessages,
    loadStaffMessages: loadStaffMessages,
    loadOwnerInbox: loadOwnerInbox,
    loadAlertMessages: loadAlertMessages,
    openConvo: openOwnerConvo,
    closeConvo: closeOwnerConvo,
    sendFromOwner: sendFromOwner,
    updateBadges: updateUnreadBadges,
    getUnreadCount: getUnreadCount
  };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }

})();
