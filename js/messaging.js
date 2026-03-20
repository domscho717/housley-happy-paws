// ============================================================
//  HHP Messaging System — Real-time Supabase-backed messaging
//  Privacy model:
//    - Client: sees ONLY their 1:1 thread with the owner
//    - Staff:  sees their own thread with owner + their assigned clients' threads
//    - Owner:  sees ALL conversations
//  Features: persistence, read tracking, unread badges, alerts card
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
    // Look at cached session in localStorage
    var keys = Object.keys(localStorage);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (key.indexOf('supabase.auth.token') > -1 || key.indexOf('sb-') > -1) {
        try {
          var d = JSON.parse(localStorage.getItem(key));
          if (d && d.user) return d.user;
          if (d && d.currentSession && d.currentSession.user) return d.currentSession.user;
        } catch (e) {}
      }
    }
    return null;
  }

  // Detect which portal is active
  function getActivePortal() {
    var pages = ['pg-owner', 'pg-staff', 'pg-client'];
    for (var i = 0; i < pages.length; i++) {
      var el = document.getElementById(pages[i]);
      if (el && (el.classList.contains('active') || (el.style.display && el.style.display !== 'none'))) {
        return pages[i].replace('pg-', '');
      }
    }
    return 'client';
  }

  // Avatar HTML
  function avatarHTML(name, size) {
    size = size || 32;
    var initial = (name || '?').charAt(0).toUpperCase();
    var colors = {
      'A':'#e74c3c','B':'#3498db','C':'#2ecc71','D':'#9b59b6','E':'#f39c12',
      'F':'#1abc9c','G':'#e67e22','H':'#e84393','I':'#00cec9','J':'#6c5ce7',
      'K':'#fd79a8','L':'#00b894','M':'#d35400','N':'#2980b9','O':'#8e44ad',
      'P':'#27ae60','Q':'#c0392b','R':'#f1c40f','S':'#16a085','T':'#e74c3c',
      'U':'#2ecc71','V':'#9b59b6','W':'#f39c12','X':'#1abc9c','Y':'#e67e22','Z':'#e84393'
    };
    var bg = colors[initial] || '#c8963e';
    return '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:'+bg+
      ';display:flex;align-items:center;justify-content:center;font-size:'+(size*0.4)+'px;'+
      'color:white;font-weight:700;flex-shrink:0">'+initial+'</div>';
  }

  function timeAgo(dateStr) {
    var now = new Date(), d = new Date(dateStr);
    var diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
    return d.toLocaleDateString();
  }

  function formatTime(dateStr) {
    var d = new Date(dateStr);
    var h = d.getHours(), m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  function escHTML(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // --- Profile cache (keyed by user_id i.e. auth.users.id) ---
  var _profileCache = {};

  async function getProfileByUserId(userId) {
    if (_profileCache[userId]) return _profileCache[userId];
    var sb = getSB();
    if (!sb) return { full_name: 'Unknown', role: 'client' };
    var { data } = await sb.from('profiles').select('id, user_id, full_name, role, avatar_url').eq('user_id', userId).single();
    if (data) _profileCache[userId] = data;
    return data || { full_name: 'Unknown', role: 'client' };
  }

  // Get owner's auth user_id (cached)
  var _ownerUserIdCache = null;
  async function getOwnerUserId() {
    if (_ownerUserIdCache) return _ownerUserIdCache;
    var sb = getSB();
    if (!sb) return null;
    var { data } = await sb.from('profiles').select('user_id').eq('role', 'owner').limit(1).single();
    if (data) _ownerUserIdCache = data.user_id;
    return _ownerUserIdCache;
  }

  // Get current user's profile (with role)
  var _myProfileCache = null;
  async function getMyProfile() {
    if (_myProfileCache) return _myProfileCache;
    var user = getCurrentUser();
    if (!user) return null;
    _myProfileCache = await getProfileByUserId(user.id);
    return _myProfileCache;
  }

  // ============================================================
  //  CORE: Send a message
  // ============================================================
  async function sendMessage(recipientUserId, body) {
    var sb = getSB();
    if (!sb || !body || !body.trim()) return null;
    var user = getCurrentUser();
    if (!user) { if (typeof toast === 'function') toast('Please sign in to send messages.'); return null; }

    var { data, error } = await sb.from('messages').insert({
      sender_id: user.id,
      recipient_id: recipientUserId,
      body: body.trim()
    }).select().single();

    if (error) {
      console.error('Send message error:', error);
      if (typeof toast === 'function') toast('Failed to send message. Please try again.');
      return null;
    }
    return data;
  }

  // ============================================================
  //  CORE: Load 1:1 conversation between current user and another
  //  By default loads only the current 2-week period.
  //  Pass since/until to load a specific date range.
  // ============================================================
  var ARCHIVE_DAYS = 14; // 2-week rolling window

  function getArchiveStart() {
    var d = new Date();
    d.setDate(d.getDate() - ARCHIVE_DAYS);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  async function loadConversation(otherUserId, opts) {
    var sb = getSB();
    if (!sb) return [];
    var user = getCurrentUser();
    if (!user) return [];
    opts = opts || {};
    var limit = opts.limit || 200;
    var since = opts.since || getArchiveStart();
    var until = opts.until || null;

    var query = sb.from('messages')
      .select('*')
      .or('and(sender_id.eq.'+user.id+',recipient_id.eq.'+otherUserId+'),and(sender_id.eq.'+otherUserId+',recipient_id.eq.'+user.id+')')
      .gte('created_at', since);

    if (until) {
      query = query.lt('created_at', until);
    }

    var { data, error } = await query
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) { console.error('Load conversation error:', error); return []; }
    return data || [];
  }

  // Check if there are older messages before the current window
  async function hasOlderMessages(otherUserId) {
    var sb = getSB();
    if (!sb) return false;
    var user = getCurrentUser();
    if (!user) return false;
    var cutoff = getArchiveStart();

    var { count, error } = await sb.from('messages')
      .select('*', { count: 'exact', head: true })
      .or('and(sender_id.eq.'+user.id+',recipient_id.eq.'+otherUserId+'),and(sender_id.eq.'+otherUserId+',recipient_id.eq.'+user.id+')')
      .lt('created_at', cutoff);

    if (error) return false;
    return (count || 0) > 0;
  }

  // ============================================================
  //  CORE: Mark messages as read
  // ============================================================
  async function markAsRead(senderUserId) {
    var sb = getSB();
    if (!sb) return;
    var user = getCurrentUser();
    if (!user) return;

    await sb.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', senderUserId)
      .eq('recipient_id', user.id)
      .is('read_at', null);

    // Refresh alerts card and badges so read messages disappear
    if (document.getElementById('hhpAlertsCard')) {
      loadAlertMessages();
    }
    updateUnreadBadges();
  }

  // ============================================================
  //  CORE: Get unread count for current user
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
  //  HELPERS: Get assigned contacts for staff/client
  // ============================================================

  // For a staff member: get their assigned client user_ids + names
  async function getStaffAssignedClients() {
    var sb = getSB(); if (!sb) return [];
    var profile = await getMyProfile(); if (!profile) return [];
    var { data } = await sb.from('staff_assignments')
      .select('client_id, profiles!staff_assignments_client_id_fkey(user_id, full_name)')
      .eq('staff_id', profile.id);
    if (!data) return [];
    var clients = [];
    for (var i = 0; i < data.length; i++) {
      var p = data[i].profiles;
      if (p && p.user_id) clients.push({ userId: p.user_id, name: p.full_name || 'Client' });
    }
    return clients;
  }

  // For a client: get their assigned staff user_ids + names
  async function getClientAssignedStaff() {
    var sb = getSB(); if (!sb) return [];
    var profile = await getMyProfile(); if (!profile) return [];
    var { data } = await sb.from('staff_assignments')
      .select('staff_id, profiles!staff_assignments_staff_id_fkey(user_id, full_name)')
      .eq('client_id', profile.id);
    if (!data) return [];
    var staff = [];
    for (var i = 0; i < data.length; i++) {
      var p = data[i].profiles;
      if (p && p.user_id) staff.push({ userId: p.user_id, name: p.full_name || 'Staff' });
    }
    return staff;
  }

  // ============================================================
  //  CORE: Get all conversations visible to this user
  //  - Client: thread with owner + assigned staff
  //  - Staff: thread with owner + assigned clients
  //  - Owner: all messages
  // ============================================================
  async function getConversationList() {
    var sb = getSB();
    if (!sb) return [];
    var user = getCurrentUser();
    if (!user) return [];
    var profile = await getMyProfile();
    if (!profile) return [];

    var data = [];

    if (profile.role === 'owner') {
      // Owner sees ALL messages
      var res = await sb.from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      data = (res.data || []);
    } else {
      // Staff and Client: see all their own messages (RLS enforces privacy)
      var res2 = await sb.from('messages')
        .select('*')
        .or('sender_id.eq.'+user.id+',recipient_id.eq.'+user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      data = res2.data || [];
    }

    // Group by conversation partner
    var convos = {};
    for (var i = 0; i < data.length; i++) {
      var msg = data[i];
      var partnerId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;

      if (!convos[partnerId]) {
        convos[partnerId] = { partnerId: partnerId, lastMessage: msg, unread: 0 };
      }
      if (msg.recipient_id === user.id && !msg.read_at) {
        convos[partnerId].unread++;
      }
    }

    var list = Object.values(convos);
    list.sort(function(a, b) {
      return new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at);
    });
    return list;
  }

  // ============================================================
  //  UI: Render a message thread
  //  opts.otherUserId — for "view older" button
  //  opts.prepend — if true, prepend older messages instead of replacing
  // ============================================================
  async function renderThread(containerId, messages, viewerUserId, opts) {
    var container = document.getElementById(containerId);
    if (!container) return;
    opts = opts || {};

    if (!messages || messages.length === 0) {
      if (!opts.prepend) {
        container.innerHTML = '<div style="align-self:center;color:var(--mid);font-size:0.84rem;padding:20px">No messages yet — say hello!</div>';
      }
      return;
    }

    // Build message bubbles with date separators
    var html = '';
    var lastDate = '';
    for (var i = 0; i < messages.length; i++) {
      var msg = messages[i];
      var msgDate = new Date(msg.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (msgDate !== lastDate) {
        html += '<div style="align-self:center;font-size:0.68rem;color:var(--mid);padding:8px 12px;margin:4px 0;background:var(--warm);border-radius:10px;font-weight:600">' + msgDate + '</div>';
        lastDate = msgDate;
      }
      var isMine = msg.sender_id === viewerUserId;
      var profile = await getProfileByUserId(msg.sender_id);
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

    if (opts.prepend) {
      // Prepending older messages — insert before existing content
      var oldScroll = container.scrollHeight;
      var olderDiv = container.querySelector('.msg-older-loaded');
      if (olderDiv) {
        // Append into existing older section
        olderDiv.insertAdjacentHTML('beforeend', html);
      } else {
        var wrapper = document.createElement('div');
        wrapper.className = 'msg-older-loaded';
        wrapper.style.cssText = 'border-bottom:1px dashed var(--border);padding-bottom:10px;margin-bottom:10px';
        wrapper.innerHTML = html;
        var firstChild = container.firstChild;
        // Insert after the "view older" button if it exists
        var olderBtn = container.querySelector('.msg-older-btn');
        if (olderBtn) {
          olderBtn.insertAdjacentElement('afterend', wrapper);
        } else if (firstChild) {
          container.insertBefore(wrapper, firstChild);
        } else {
          container.appendChild(wrapper);
        }
      }
      // Keep scroll position stable
      container.scrollTop = container.scrollHeight - oldScroll;
    } else {
      container.innerHTML = html;
      container.scrollTop = container.scrollHeight;
    }

    // Add "View older messages" button if applicable
    if (opts.otherUserId && !opts.prepend && !container.querySelector('.msg-older-btn')) {
      var older = await hasOlderMessages(opts.otherUserId);
      if (older) {
        var btn = document.createElement('button');
        btn.className = 'msg-older-btn';
        btn.style.cssText = 'display:block;width:100%;text-align:center;padding:8px;font-size:0.76rem;color:var(--gold-deep);background:var(--warm);border:1px dashed var(--border);border-radius:8px;cursor:pointer;font-weight:600;margin-bottom:10px;transition:background 0.15s';
        btn.textContent = '📜 View older messages';
        btn.setAttribute('data-partner', opts.otherUserId);
        btn.setAttribute('data-container', containerId);
        btn.setAttribute('data-page', '1');
        btn.onmouseover = function() { this.style.background = 'rgba(200,150,62,0.15)'; };
        btn.onmouseout = function() { this.style.background = 'var(--warm)'; };
        btn.onclick = function() { _loadOlderChunk(this); };
        container.insertBefore(btn, container.firstChild);
        container.scrollTop = container.scrollHeight;
      }
    }
  }

  // Load an older 2-week chunk when user clicks "View older messages"
  async function _loadOlderChunk(btnEl) {
    var partnerId = btnEl.getAttribute('data-partner');
    var containerId = btnEl.getAttribute('data-container');
    var page = parseInt(btnEl.getAttribute('data-page')) || 1;
    if (!partnerId || !containerId) return;

    btnEl.textContent = 'Loading...';
    btnEl.disabled = true;

    // Calculate the date window for this chunk
    var untilDate = new Date();
    untilDate.setDate(untilDate.getDate() - (ARCHIVE_DAYS * page));
    untilDate.setHours(0, 0, 0, 0);
    var sinceDate = new Date(untilDate);
    sinceDate.setDate(sinceDate.getDate() - ARCHIVE_DAYS);

    var user = getCurrentUser();
    if (!user) return;

    var olderMsgs = await loadConversation(partnerId, {
      since: sinceDate.toISOString(),
      until: untilDate.toISOString(),
      limit: 200
    });

    if (olderMsgs.length > 0) {
      await renderThread(containerId, olderMsgs, user.id, { prepend: true });
    }

    // Check if there are even older messages
    var { count } = await getSB().from('messages')
      .select('*', { count: 'exact', head: true })
      .or('and(sender_id.eq.'+user.id+',recipient_id.eq.'+partnerId+'),and(sender_id.eq.'+partnerId+',recipient_id.eq.'+user.id+')')
      .lt('created_at', sinceDate.toISOString());

    if (count && count > 0) {
      btnEl.textContent = '📜 View even older messages';
      btnEl.disabled = false;
      btnEl.setAttribute('data-page', String(page + 1));
    } else {
      btnEl.textContent = '📜 All messages loaded';
      btnEl.style.opacity = '0.5';
      btnEl.style.cursor = 'default';
      btnEl.onclick = null;
    }
  }

  // ============================================================
  //  UI: Client Messages (c-msgs)
  //  Client always has Rachel (owner). If assigned a staff member,
  //  they get tabs: staff name + "Rachel (Owner)"
  // ============================================================
  var _clientMsgContacts = [];
  var _activeClientTab = 0;

  async function loadClientMessages() {
    var sb = getSB(); if (!sb) return;
    var user = getCurrentUser(); if (!user) return;
    var ownerUserId = await getOwnerUserId(); if (!ownerUserId) return;

    var panel = document.getElementById('c-msgs');
    if (!panel) return;

    // Build contact list: always include owner, plus any assigned staff
    var contacts = [{ userId: ownerUserId, name: 'Rachel (Owner)', type: 'owner' }];
    var assignedStaff = await getClientAssignedStaff();
    for (var i = 0; i < assignedStaff.length; i++) {
      // Put staff first since they're the primary contact
      contacts.unshift({ userId: assignedStaff[i].userId, name: assignedStaff[i].name, type: 'staff' });
    }

    _clientMsgContacts = contacts;

    if (contacts.length === 1) {
      // Only owner — simple thread, no tabs needed
      var messages = await loadConversation(ownerUserId, {});
      await renderThread('cMsgs', messages, user.id, { otherUserId: ownerUserId });
      await markAsRead(ownerUserId);
      updateUnreadBadges();
      return;
    }

    // Multiple contacts — build tabbed UI
    var html = '<div class="p-header"><h2>Messages 💬</h2><p>Your private conversations.</p></div>';
    html += '<div class="card">';
    html += '<div id="clientMsgTabs" style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">';
    for (var t = 0; t < contacts.length; t++) {
      html += '<button class="admin-filter-btn' + (t === 0 ? ' active' : '') +
        '" onclick="HHP_Messaging.clientTab('+t+')" data-idx="'+t+'">' +
        escHTML(contacts[t].name) + '</button>';
    }
    html += '</div>';
    html += '<div class="msg-thread" id="cMsgs" style="max-height:350px"><div style="align-self:center;color:var(--mid);font-size:0.84rem;padding:20px">Loading...</div></div>';
    html += '<div class="msg-input-row" style="margin-top:8px"><input class="msg-input" id="cMsgIn" placeholder="Type a message..." onkeydown="if(event.key===\'Enter\')HHP_Messaging.clientSend()"><button class="msg-send" onclick="HHP_Messaging.clientSend()">➤</button></div>';
    html += '</div>';

    panel.innerHTML = html;
    _activeClientTab = 0;
    await loadClientTabConvo(0);
  }

  async function loadClientTabConvo(idx) {
    _activeClientTab = idx;
    var contact = _clientMsgContacts[idx];
    if (!contact) return;

    var user = getCurrentUser();
    var messages = await loadConversation(contact.userId, {});
    await renderThread('cMsgs', messages, user.id, { otherUserId: contact.userId });
    await markAsRead(contact.userId);

    var btns = document.querySelectorAll('#clientMsgTabs .admin-filter-btn');
    for (var b = 0; b < btns.length; b++) {
      btns[b].classList.toggle('active', b === idx);
    }
    updateUnreadBadges();
  }

  function switchClientTab(idx) {
    loadClientTabConvo(idx);
  }

  async function clientSend() {
    var contact = _clientMsgContacts[_activeClientTab];
    if (!contact) return;
    var inp = document.getElementById('cMsgIn');
    if (!inp || !inp.value.trim()) return;

    var body = inp.value.trim();
    inp.value = '';

    var user = getCurrentUser();
    if (!user) { if (typeof toast === 'function') toast('Please sign in to send messages.'); return; }

    // Optimistically show
    var threadEl = document.getElementById('cMsgs');
    if (threadEl) {
      var myProfile = await getMyProfile();
      var ava = avatarHTML((myProfile && myProfile.full_name) || 'C', 32);
      var d = document.createElement('div');
      d.style.cssText = 'display:flex;gap:8px;align-items:flex-end;justify-content:flex-end';
      d.innerHTML = '<div style="flex:1;text-align:right"><div class="msg-out">' + escHTML(body) + '</div><div class="msg-meta" style="text-align:right">You · Just now</div></div>' + ava;
      threadEl.appendChild(d);
      threadEl.scrollTop = threadEl.scrollHeight;
    }

    var result = await sendMessage(contact.userId, body);
    if (!result && threadEl) {
      var last = threadEl.lastElementChild;
      if (last) {
        var meta = last.querySelector('.msg-meta');
        if (meta) meta.innerHTML = 'You · <span style="color:var(--rose)">Failed to send</span>';
      }
    }
  }

  // ============================================================
  //  UI: Staff Messages (s-msgs)
  //  Staff has: thread with owner + thread with each assigned client
  //  Uses tabs if they have assigned clients
  // ============================================================
  var _staffMsgContacts = [];
  var _activeStaffTab = 0;

  async function loadStaffMessages() {
    var sb = getSB(); if (!sb) return;
    var user = getCurrentUser(); if (!user) return;
    var ownerUserId = await getOwnerUserId(); if (!ownerUserId) return;

    var panel = document.getElementById('s-msgs');
    if (!panel) return;

    // Build contact list: owner + assigned clients
    var contacts = [{ userId: ownerUserId, name: 'Rachel (Owner)', type: 'owner' }];
    var assignedClients = await getStaffAssignedClients();
    for (var i = 0; i < assignedClients.length; i++) {
      contacts.push({ userId: assignedClients[i].userId, name: assignedClients[i].name, type: 'client' });
    }

    _staffMsgContacts = contacts;

    if (contacts.length === 1) {
      // Only owner — simple thread, no tabs
      var threadEl = document.getElementById('sMsgs');
      if (!threadEl) return;
      var messages = await loadConversation(ownerUserId, {});
      await renderThread('sMsgs', messages, user.id, { otherUserId: ownerUserId });
      await markAsRead(ownerUserId);
      updateUnreadBadges();
      return;
    }

    // Multiple contacts — build tabbed UI
    var html = '<div class="p-header"><h2>Messages 💬</h2><p>Your private conversations.</p></div>';
    html += '<div class="card">';
    html += '<div id="staffMsgTabs" style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">';
    for (var t = 0; t < contacts.length; t++) {
      html += '<button class="admin-filter-btn' + (t === 0 ? ' active' : '') +
        '" onclick="HHP_Messaging.staffTab('+t+')" data-idx="'+t+'">' +
        escHTML(contacts[t].name) + '</button>';
    }
    html += '</div>';
    html += '<div class="msg-thread" id="sMsgs" style="max-height:350px"><div style="align-self:center;color:var(--mid);font-size:0.84rem;padding:20px">Loading...</div></div>';
    html += '<div class="msg-input-row" style="margin-top:8px"><input class="msg-input" id="sMsgIn" placeholder="Type a message..." onkeydown="if(event.key===\'Enter\')HHP_Messaging.staffSend()"><button class="msg-send" onclick="HHP_Messaging.staffSend()">➤</button></div>';
    html += '</div>';

    panel.innerHTML = html;
    _activeStaffTab = 0;
    await loadStaffTabConvo(0);
  }

  async function loadStaffTabConvo(idx) {
    _activeStaffTab = idx;
    var contact = _staffMsgContacts[idx];
    if (!contact) return;

    var user = getCurrentUser();
    var messages = await loadConversation(contact.userId, {});
    await renderThread('sMsgs', messages, user.id, { otherUserId: contact.userId });
    await markAsRead(contact.userId);

    // Update tab active states
    var btns = document.querySelectorAll('#staffMsgTabs .admin-filter-btn');
    for (var b = 0; b < btns.length; b++) {
      btns[b].classList.toggle('active', b === idx);
    }
    updateUnreadBadges();
  }

  function switchStaffTab(idx) {
    loadStaffTabConvo(idx);
  }

  async function staffSend() {
    var contact = _staffMsgContacts[_activeStaffTab];
    if (!contact) return;
    var inp = document.getElementById('sMsgIn');
    if (!inp || !inp.value.trim()) return;

    var body = inp.value.trim();
    inp.value = '';

    var user = getCurrentUser();
    if (!user) { if (typeof toast === 'function') toast('Please sign in to send messages.'); return; }

    // Optimistically show
    var threadEl = document.getElementById('sMsgs');
    if (threadEl) {
      var myProfile = await getMyProfile();
      var ava = avatarHTML((myProfile && myProfile.full_name) || 'S', 32);
      var d = document.createElement('div');
      d.style.cssText = 'display:flex;gap:8px;align-items:flex-end;justify-content:flex-end';
      d.innerHTML = '<div style="flex:1;text-align:right"><div class="msg-out">' + escHTML(body) + '</div><div class="msg-meta" style="text-align:right">You · Just now</div></div>' + ava;
      threadEl.appendChild(d);
      threadEl.scrollTop = threadEl.scrollHeight;
    }

    var result = await sendMessage(contact.userId, body);
    if (!result && threadEl) {
      var last = threadEl.lastElementChild;
      if (last) {
        var meta = last.querySelector('.msg-meta');
        if (meta) meta.innerHTML = 'You · <span style="color:var(--rose)">Failed to send</span>';
      }
    }
  }

  // ============================================================
  //  UI: Owner Messages (o-msgs) — full inbox, all conversations
  // ============================================================
  async function loadOwnerInbox() {
    var sb = getSB(); if (!sb) return;
    var user = getCurrentUser(); if (!user) return;

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

    var html = '<div class="p-header"><h2>All Messages 💬</h2><p>Every client & staff conversation — private per person.</p></div>';
    html += '<div class="card" style="padding:0;overflow:hidden">';
    html += '<div id="ownerConvoList">';

    for (var i = 0; i < convos.length; i++) {
      var c = convos[i];
      var profile = await getProfileByUserId(c.partnerId);
      var name = profile.full_name || 'Unknown';
      var role = profile.role || 'client';
      var roleBadge = role === 'staff'
        ? '<span style="background:var(--forest-pale);color:var(--forest);font-size:0.65rem;padding:1px 6px;border-radius:4px;font-weight:600;margin-left:6px">Staff</span>'
        : '<span style="background:var(--gold-pale);color:var(--gold-deep);font-size:0.65rem;padding:1px 6px;border-radius:4px;font-weight:600;margin-left:6px">Client</span>';
      var preview = c.lastMessage.body.length > 50 ? c.lastMessage.body.substring(0, 50) + '...' : c.lastMessage.body;
      var unreadDot = c.unread > 0 ? '<span style="background:var(--rose);color:white;border-radius:10px;padding:1px 7px;font-size:0.65rem;font-weight:800;margin-left:auto">' + c.unread + '</span>' : '';

      html += '<div onclick="HHP_Messaging.openConvo(\'' + c.partnerId + '\',\'' + escHTML(name).replace(/'/g,'\\\'') + '\')" ' +
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
    // Conversation detail view
    html += '<div id="ownerConvoView" style="display:none;padding:16px">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">' +
      '<button onclick="HHP_Messaging.closeConvo()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;padding:4px">←</button>' +
      '<div id="ownerConvoName" style="font-weight:700;font-size:0.95rem"></div>' +
      '</div>' +
      '<div class="msg-thread" id="ownerMsgs" style="max-height:400px"></div>' +
      '<div class="msg-input-row" style="margin-top:8px"><input class="msg-input" id="ownerMsgIn" placeholder="Type a reply..." onkeydown="if(event.key===\'Enter\')HHP_Messaging.sendFromOwner()"><button class="msg-send" onclick="HHP_Messaging.sendFromOwner()">➤</button></div>' +
      '</div>';
    html += '</div>';

    panel.innerHTML = html;
  }

  // Owner: open a specific conversation
  var _currentConvoPartnerId = null;

  async function openOwnerConvo(partnerId, partnerName) {
    // If not already on o-msgs, navigate there
    if (typeof sTab === 'function') {
      var oMsgs = document.getElementById('o-msgs');
      if (!oMsgs || !oMsgs.classList.contains('active')) {
        sTab('o', 'o-msgs');
        // Wait for panel to render
        await new Promise(function(r) { setTimeout(r, 300); });
      }
    }

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
    var messages = await loadConversation(partnerId, {});
    await renderThread('ownerMsgs', messages, user.id, { otherUserId: partnerId });
    await markAsRead(partnerId);
    updateUnreadBadges();
  }

  function closeOwnerConvo() {
    _currentConvoPartnerId = null;
    var list = document.getElementById('ownerConvoList');
    var view = document.getElementById('ownerConvoView');
    if (list) list.style.display = '';
    if (view) view.style.display = 'none';
    loadOwnerInbox();
  }

  async function sendFromOwner() {
    if (!_currentConvoPartnerId) return;
    var inp = document.getElementById('ownerMsgIn');
    if (!inp || !inp.value.trim()) return;
    var body = inp.value.trim();
    inp.value = '';
    await sendMessage(_currentConvoPartnerId, body);
    var user = getCurrentUser();
    if (user) {
      var messages = await loadConversation(_currentConvoPartnerId, {});
      await renderThread('ownerMsgs', messages, user.id, { otherUserId: _currentConvoPartnerId });
    }
  }

  // ============================================================
  //  UI: Alerts card in owner overview (hhpAlertsCard)
  // ============================================================
  function _timeAgo(dateStr) {
    if (!dateStr) return '';
    var now = new Date();
    var then = new Date(dateStr);
    var diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  async function loadAlertMessages() {
    var card = document.getElementById('hhpAlertsCard');
    if (!card) return;
    if (!supabase || !currentUserId) {
      card.innerHTML = '<div style="padding:18px;text-align:center;color:var(--mid);font-size:0.88rem">Sign in to see alerts</div>';
      return;
    }
    try {
      // ── 1. Unread Messages (up to 5) ──
      var { data: unread } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at, conversation_id, sender_name')
        .eq('receiver_id', currentUserId)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(5);

      // ── 2. Pending Booking Requests (up to 5) ──
      var { data: pendingBookings } = await supabase
        .from('booking_requests')
        .select('id, service, preferred_date, status, client_id, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      // ── 3. New Client Sign-ups (last 7 days, up to 3) ──
      var sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      var { data: newClients } = await supabase
        .from('profiles')
        .select('id, full_name, created_at')
        .eq('role', 'client')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(3);

      // ── 4. Recent Cancellations (last 7 days, up to 3) ──
      var { data: cancellations } = await supabase
        .from('booking_requests')
        .select('id, service, preferred_date, status, client_id, cancelled_at, created_at')
        .eq('status', 'cancelled')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(3);

      // ── Build combined alerts list ──
      var alerts = [];
      if (unread) unread.forEach(function(m) {
        alerts.push({ type: 'message', date: m.created_at, data: m });
      });
      if (pendingBookings) pendingBookings.forEach(function(b) {
        alerts.push({ type: 'booking', date: b.created_at, data: b });
      });
      if (newClients) newClients.forEach(function(c) {
        alerts.push({ type: 'signup', date: c.created_at, data: c });
      });
      if (cancellations) cancellations.forEach(function(c) {
        alerts.push({ type: 'cancellation', date: c.created_at || c.cancelled_at, data: c });
      });

      // Sort by date descending
      alerts.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

      // ── Render ──
      var msgCount = (unread || []).length;
      var bookingCount = (pendingBookings || []).length;
      var signupCount = (newClients || []).length;
      var cancelCount = (cancellations || []).length;
      var totalAlerts = msgCount + bookingCount + signupCount + cancelCount;

      var html = '<div style="padding:16px 18px 10px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
      html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:1.25rem;font-weight:700;color:var(--ink)">🔔 Alerts & Messages</div>';
      if (totalAlerts > 0) {
        html += '<div style="background:var(--rose);color:white;padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:700">' + totalAlerts + ' new</div>';
      }
      html += '</div>';

      // Summary badges
      if (totalAlerts > 0) {
        html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">';
        if (msgCount > 0) html += '<div style="background:var(--gold-pale);color:var(--gold-deep);padding:3px 10px;border-radius:8px;font-size:0.72rem;font-weight:600">💬 ' + msgCount + ' message' + (msgCount > 1 ? 's' : '') + '</div>';
        if (bookingCount > 0) html += '<div style="background:var(--forest-pale);color:var(--forest);padding:3px 10px;border-radius:8px;font-size:0.72rem;font-weight:600">📅 ' + bookingCount + ' pending</div>';
        if (signupCount > 0) html += '<div style="background:#e8f5e9;color:#2e7d32;padding:3px 10px;border-radius:8px;font-size:0.72rem;font-weight:600">👋 ' + signupCount + ' new client' + (signupCount > 1 ? 's' : '') + '</div>';
        if (cancelCount > 0) html += '<div style="background:var(--rose-pale);color:var(--rose);padding:3px 10px;border-radius:8px;font-size:0.72rem;font-weight:600">❌ ' + cancelCount + ' cancel' + (cancelCount > 1 ? 's' : '') + '</div>';
        html += '</div>';
      }
      html += '</div>';

      // Alert items (show up to 8)
      var shown = alerts.slice(0, 8);
      if (shown.length === 0) {
        html += '<div style="padding:18px;text-align:center;color:var(--mid);font-size:0.88rem">✨ All clear — no new alerts!</div>';
      } else {
        shown.forEach(function(alert) {
          var d = alert.data;
          var timeAgo = _timeAgo(alert.date);
          if (alert.type === 'message') {
            html += '<div style="padding:10px 18px;border-top:1px solid var(--border);cursor:pointer;transition:background 0.15s" onmouseover="this.style.background=\'var(--gold-pale)\'" onmouseout="this.style.background=\'transparent\'" onclick="if(typeof HHP_Messaging!==\'undefined\')HHP_Messaging.openConversation(\'' + d.conversation_id + '\')">';
            html += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
            html += '<div><div style="font-weight:600;font-size:0.84rem;color:var(--ink)">💬 ' + (d.sender_name || 'Someone') + '</div>';
            html += '<div style="font-size:0.8rem;color:var(--mid);margin-top:2px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (d.content || '').substring(0, 80) + '</div></div>';
            html += '<div style="font-size:0.68rem;color:var(--mid);white-space:nowrap;margin-left:8px">' + timeAgo + '</div>';
            html += '</div></div>';
          } else if (alert.type === 'booking') {
            html += '<div style="padding:10px 18px;border-top:1px solid var(--border);cursor:pointer;transition:background 0.15s" onmouseover="this.style.background=\'var(--forest-pale)\'" onmouseout="this.style.background=\'transparent\'" onclick="if(typeof sTab===\'function\')sTab(\'owner\',\'o-overview\')">';
            html += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
            html += '<div><div style="font-weight:600;font-size:0.84rem;color:var(--forest)">📅 New Booking Request</div>';
            html += '<div style="font-size:0.8rem;color:var(--mid);margin-top:2px">' + (d.service || 'Service') + ' — ' + (d.preferred_date || '') + '</div></div>';
            html += '<div style="font-size:0.68rem;color:var(--mid);white-space:nowrap;margin-left:8px">' + timeAgo + '</div>';
            html += '</div></div>';
          } else if (alert.type === 'signup') {
            html += '<div style="padding:10px 18px;border-top:1px solid var(--border);cursor:pointer;transition:background 0.15s" onmouseover="this.style.background=\'#e8f5e9\'" onmouseout="this.style.background=\'transparent\'" onclick="if(typeof sTab===\'function\')sTab(\'owner\',\'o-clients\')">';
            html += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
            html += '<div><div style="font-weight:600;font-size:0.84rem;color:#2e7d32">👋 New Client Sign-up</div>';
            html += '<div style="font-size:0.8rem;color:var(--mid);margin-top:2px">' + (d.full_name || 'New client') + ' joined</div></div>';
            html += '<div style="font-size:0.68rem;color:var(--mid);white-space:nowrap;margin-left:8px">' + timeAgo + '</div>';
            html += '</div></div>';
          } else if (alert.type === 'cancellation') {
            html += '<div style="padding:10px 18px;border-top:1px solid var(--border);cursor:pointer;transition:background 0.15s" onmouseover="this.style.background=\'var(--rose-pale)\'" onmouseout="this.style.background=\'transparent\'" onclick="if(typeof sTab===\'function\')sTab(\'owner\',\'o-activity\')">';
            html += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
            html += '<div><div style="font-weight:600;font-size:0.84rem;color:var(--rose)">❌ Booking Cancelled</div>';
            html += '<div style="font-size:0.8rem;color:var(--mid);margin-top:2px">' + (d.service || 'Service') + ' — ' + (d.preferred_date || '') + '</div></div>';
            html += '<div style="font-size:0.68rem;color:var(--mid);white-space:nowrap;margin-left:8px">' + timeAgo + '</div>';
            html += '</div></div>';
          }
        });
      }

      // Footer link
      html += '<div style="padding:12px 18px;border-top:1px solid var(--border);text-align:center">';
      html += '<button onclick="if(typeof sTab===\'function\')sTab(\'owner\',\'o-activity\')" style="background:none;border:none;color:var(--gold-deep);font-weight:600;font-size:0.82rem;cursor:pointer;padding:4px 12px">View Full Activity Log →</button>';
      html += '</div>';

      card.innerHTML = html;
    } catch (err) {
      console.error('loadAlertMessages error:', err);
      card.innerHTML = '<div style="padding:18px;text-align:center;color:var(--mid);font-size:0.88rem">Could not load alerts</div>';
    }
  }

  //  UI: Unread badges on sidebar
  // ============================================================
  async function updateUnreadBadges() {
    var count = await getUnreadCount();
    var msgButtons = document.querySelectorAll('.sb-item');
    for (var i = 0; i < msgButtons.length; i++) {
      var btn = msgButtons[i];
      var text = btn.textContent || '';
      if (text.indexOf('Messages') > -1) {
        var oldBadge = btn.querySelector('.sb-badge');
        if (oldBadge) oldBadge.remove();
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
  //  Realtime: append a single incoming bubble to the thread
  // ============================================================
  function appendIncomingBubble(threadId, msg, senderName) {
    var threadEl = document.getElementById(threadId);
    if (!threadEl) return false;
    // Don't append if the thread is empty placeholder
    if (threadEl.children.length === 1 && threadEl.querySelector('[style*="align-self:center"]')) {
      threadEl.innerHTML = '';
    }
    var ava = avatarHTML(senderName, 32);
    var d = document.createElement('div');
    d.style.cssText = 'display:flex;gap:8px;align-items:flex-end;opacity:0;transition:opacity 0.3s';
    d.innerHTML = ava + '<div><div class="msg-in">' + escHTML(msg.body) + '</div>' +
      '<div class="msg-meta">' + escHTML(senderName) + ' · Just now</div></div>';
    threadEl.appendChild(d);
    // Animate in
    requestAnimationFrame(function() { d.style.opacity = '1'; });
    threadEl.scrollTop = threadEl.scrollHeight;
    // Play a subtle sound effect via audio context if available
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = 'sine';
      gain.gain.value = 0.08;
      osc.start(); osc.stop(ctx.currentTime + 0.08);
    } catch(e) {}
    return true;
  }

  // ============================================================
  //  Realtime subscription
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

          var profile = await getProfileByUserId(msg.sender_id);
          var name = profile.full_name || 'Someone';

          // Toast notification (only if NOT already viewing this conversation)
          var toasted = false;

          // Update badges
          updateUnreadBadges();

          var portal = getActivePortal();

          if (portal === 'owner') {
            if (_currentConvoPartnerId === msg.sender_id) {
              // Owner has this convo open — append directly
              appendIncomingBubble('ownerMsgs', msg, name);
              await markAsRead(msg.sender_id);
              updateUnreadBadges();
            } else {
              if (typeof toast === 'function') toast('💬 New message from ' + name);
              toasted = true;
            }
            loadAlertMessages();
          } else if (portal === 'client') {
            var cPanel = document.getElementById('c-msgs');
            if (cPanel && cPanel.classList.contains('active')) {
              // Client is viewing Messages — find which contact matches and append
              var contact = _clientMsgContacts[_activeClientTab];
              if (contact && contact.userId === msg.sender_id) {
                appendIncomingBubble('cMsgs', msg, name);
                await markAsRead(msg.sender_id);
                updateUnreadBadges();
              } else {
                // Different contact sent the message — reload to update tabs
                loadClientMessages();
                if (typeof toast === 'function') toast('💬 New message from ' + name);
                toasted = true;
              }
            } else {
              if (typeof toast === 'function') toast('💬 New message from ' + name);
              toasted = true;
            }
          } else if (portal === 'staff') {
            var sPanel = document.getElementById('s-msgs');
            if (sPanel && sPanel.classList.contains('active')) {
              var sContact = _staffMsgContacts[_activeStaffTab];
              if (sContact && sContact.userId === msg.sender_id) {
                appendIncomingBubble('sMsgs', msg, name);
                await markAsRead(msg.sender_id);
                updateUnreadBadges();
              } else {
                loadStaffMessages();
                if (typeof toast === 'function') toast('💬 New message from ' + name);
                toasted = true;
              }
            } else {
              if (typeof toast === 'function') toast('💬 New message from ' + name);
              toasted = true;
            }
          }

          // Flash the sidebar Messages button
          highlightMsgButton();
        }
      )
      .subscribe();
  }

  function highlightMsgButton() {
    var msgButtons = document.querySelectorAll('.sb-item');
    for (var i = 0; i < msgButtons.length; i++) {
      var btn = msgButtons[i];
      if ((btn.textContent || '').indexOf('Messages') > -1) {
        btn.style.transition = 'background 0.3s';
        btn.style.background = 'rgba(200,150,62,0.25)';
        setTimeout(function(b) {
          if (!b.classList.contains('active')) b.style.background = '';
        }, 2000, btn);
      }
    }
  }

  // ============================================================
  //  Drop-in replacement for old sendMsg() — used by client input
  // ============================================================
  async function sendMsgReal(prefix) {
    // Both client and staff use their own tabbed send functions
    if (prefix === 's') { staffSend(); return; }
    if (prefix === 'c') { clientSend(); return; }
  }

  // ============================================================
  //  INIT
  // ============================================================
  function init() {
    window.sendMsg = sendMsgReal;
    subscribeToMessages();
    updateUnreadBadges();
    // Load alerts in owner overview immediately if present
    if (document.getElementById('hhpAlertsCard')) {
      loadAlertMessages();
    }
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
    clientTab: switchClientTab,
    clientSend: clientSend,
    staffTab: switchStaffTab,
    staffSend: staffSend,
    updateBadges: updateUnreadBadges,
    getUnreadCount: getUnreadCount,
    loadOlderChunk: _loadOlderChunk,
    cleanup: function() {
      if (_realtimeChannel) {
        _realtimeChannel.unsubscribe();
        _realtimeChannel = null;
      }
    }
  };

  // Auto-init — wait for auth to be ready (no arbitrary delays)
  function _startMessaging() {
    if (window.onHHPAuthReady) {
      window.onHHPAuthReady(init);
    } else {
      // Fallback if auth callback system isn't loaded yet
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 300); });
      } else {
        setTimeout(init, 300);
      }
    }
  }
  _startMessaging();

})();
