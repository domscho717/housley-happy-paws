// ============================================================
//  Housley Happy Paws — Live Service Timer + Pre-Appt Alerts
//  Shows real-time elapsed/remaining timer during active services,
//  triggers alarm when service time is reached, and sends
//  30-min pre-appointment notifications with map directions.
// ============================================================
(function() {
  'use strict';

  // ── Helpers ──
  function getSB() { return window.HHP_Auth && window.HHP_Auth.supabase; }
  function getUser() { return window.HHP_Auth && window.HHP_Auth.currentUser; }

  // ── Timer State ──
  var _timerInterval = null;
  var _timerWalkId = null;
  var _timerStartTime = null;
  var _timerDurationMin = null; // expected service duration in minutes
  var _alarmFired = false;
  var _timerOverlayEl = null;
  var _reminderCheckInterval = null;
  var _sentReminders = {}; // bookingId → true (prevent dupes per session)

  // ============================================================
  //  PARSE SERVICE DURATION from service name
  //  "Dog Walk - 30 min" → 30, "Dog Walk - 1 hour" → 60
  //  "Drop-In Visit - 30 min" → 30, "Cat Care Visit - 1 hour" → 60
  //  House Sitting / Boarding → null (no timer)
  // ============================================================
  function parseServiceDuration(serviceName) {
    if (!serviceName) return null;
    var s = serviceName.toLowerCase();
    // Excluded from timer
    if (s.indexOf('house sitting') !== -1) return null;
    if (s.indexOf('boarding') !== -1) return null;
    if (s.indexOf('day care') !== -1 || s.indexOf('daycare') !== -1) return null;
    if (s.indexOf('paw bus') !== -1) return null;
    if (s.indexOf('meet') !== -1 && s.indexOf('greet') !== -1) return 30; // 30 min default

    // Extract from name: "- 30 min" or "- 1 hour"
    var hourMatch = s.match(/(\d+)\s*hour/);
    if (hourMatch) return parseInt(hourMatch[1]) * 60;
    var minMatch = s.match(/(\d+)\s*min/);
    if (minMatch) return parseInt(minMatch[1]);

    // Default for services without explicit duration
    return 30;
  }

  // ============================================================
  //  FORMAT TIME — mm:ss or hh:mm:ss
  // ============================================================
  function fmtTime(totalSeconds) {
    var neg = totalSeconds < 0;
    var abs = Math.abs(Math.floor(totalSeconds));
    var h = Math.floor(abs / 3600);
    var m = Math.floor((abs % 3600) / 60);
    var sec = abs % 60;
    var str = '';
    if (h > 0) str = h + ':' + (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
    else str = m + ':' + (sec < 10 ? '0' : '') + sec;
    return (neg ? '+' : '') + str;
  }

  // ============================================================
  //  ALARM SOUND — Web Audio API beep (no external files needed)
  // ============================================================
  function playAlarmSound() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Play 3 beeps
      [0, 0.3, 0.6].forEach(function(delay) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880; // A5
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.25);
      });
    } catch (e) { console.warn('Alarm sound error:', e); }
  }

  // ============================================================
  //  BROWSER PUSH NOTIFICATION
  // ============================================================
  function sendPushNotification(title, body, tag) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, { body: body, icon: '/images/logo-icon.png', tag: tag || 'hhp', requireInteraction: true });
      } catch (e) { console.warn('Push notification error:', e); }
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(function(perm) {
        if (perm === 'granted') {
          new Notification(title, { body: body, icon: '/images/logo-icon.png', tag: tag || 'hhp' });
        }
      });
    }
  }

  // ============================================================
  //  CREATE TIMER OVERLAY — persistent floating panel
  // ============================================================
  function createTimerOverlay() {
    if (_timerOverlayEl) return _timerOverlayEl;

    var el = document.createElement('div');
    el.id = 'hhp-service-timer';
    el.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:var(--forest,#3d5a47);color:white;border-radius:18px;padding:16px 20px;min-width:240px;box-shadow:0 8px 32px rgba(0,0,0,0.3);font-family:inherit;transition:all 0.3s;cursor:pointer;user-select:none;';
    el.innerHTML = '<div id="hhp-timer-inner"></div>';

    // Click timer to reopen the live service panel (if it exists but is hidden)
    el.addEventListener('click', function(e) {
      if (e.target.tagName === 'BUTTON') return;
      if (typeof reopenLiveServicePanel === 'function') {
        var panel = document.getElementById('hhp-live-service-panel');
        if (panel && panel.style.display === 'none') {
          reopenLiveServicePanel();
          return;
        }
      }
      el.classList.toggle('hhp-timer-expanded');
      updateTimerDisplay();
    });

    document.body.appendChild(el);
    _timerOverlayEl = el;
    return el;
  }

  // ============================================================
  //  UPDATE TIMER DISPLAY — called every second
  // ============================================================
  function updateTimerDisplay() {
    if (!_timerOverlayEl || !_timerStartTime) return;

    var inner = document.getElementById('hhp-timer-inner');
    if (!inner) return;

    var nowMs = Date.now();
    var elapsedSec = (nowMs - _timerStartTime) / 1000;
    var elapsedMin = elapsedSec / 60;
    var durationSec = _timerDurationMin ? _timerDurationMin * 60 : null;
    var remainingSec = durationSec ? durationSec - elapsedSec : null;
    var progress = durationSec ? Math.min(elapsedSec / durationSec, 1) : 0;
    var isOvertime = remainingSec !== null && remainingSec <= 0;
    var isExpanded = _timerOverlayEl.classList.contains('hhp-timer-expanded');

    // Fire alarm when time is up (once)
    if (isOvertime && !_alarmFired) {
      _alarmFired = true;
      playAlarmSound();
      sendPushNotification(
        '⏰ Service Time Complete!',
        'The scheduled service time has ended. The timer is still running — end the service when ready.',
        'timer-alarm'
      );
      // Flash the overlay
      _timerOverlayEl.style.background = 'var(--rose,#c25656)';
      setTimeout(function() {
        if (_timerOverlayEl) _timerOverlayEl.style.background = isOvertime ? '#b94a4a' : 'var(--forest,#3d5a47)';
      }, 2000);
    }

    // Overtime: change color
    if (isOvertime) {
      _timerOverlayEl.style.background = '#b94a4a';
    } else {
      _timerOverlayEl.style.background = 'var(--forest,#3d5a47)';
    }

    // ── Build progress ring SVG ──
    var ringSize = isExpanded ? 100 : 44;
    var strokeWidth = isExpanded ? 6 : 3;
    var radius = (ringSize / 2) - strokeWidth;
    var circumference = 2 * Math.PI * radius;
    var strokeDash = durationSec ? circumference * progress : 0;
    var strokeColor = isOvertime ? '#ff6b6b' : '#c8963e';

    var ringSvg = '<svg width="' + ringSize + '" height="' + ringSize + '" style="transform:rotate(-90deg)">' +
      '<circle cx="' + (ringSize/2) + '" cy="' + (ringSize/2) + '" r="' + radius + '" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="' + strokeWidth + '"/>' +
      '<circle cx="' + (ringSize/2) + '" cy="' + (ringSize/2) + '" r="' + radius + '" fill="none" stroke="' + strokeColor + '" stroke-width="' + strokeWidth + '" ' +
        'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + (circumference - strokeDash) + '" stroke-linecap="round"/>' +
      '</svg>';

    if (isExpanded) {
      // ── EXPANDED VIEW ──
      var h = '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">';
      h += '<div style="position:relative;flex-shrink:0">' + ringSvg;
      h += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(0deg);font-size:0.7rem;font-weight:700;text-align:center;line-height:1.2">';
      h += isOvertime ? '⏰' : (Math.round(progress * 100) + '%');
      h += '</div></div>';
      h += '<div style="flex:1">';
      h += '<div style="font-weight:700;font-size:1rem;margin-bottom:2px">' + (isOvertime ? '⏰ OVERTIME' : '▶ Service Active') + '</div>';
      h += '<div style="font-size:0.78rem;opacity:0.85">' + (_timerServiceName || 'Service') + '</div>';
      h += '</div></div>';

      // Time display
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
      h += '<div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:10px;text-align:center">';
      h += '<div style="font-size:0.65rem;text-transform:uppercase;opacity:0.7;margin-bottom:2px">Elapsed</div>';
      h += '<div style="font-size:1.3rem;font-weight:800;font-variant-numeric:tabular-nums">' + fmtTime(elapsedSec) + '</div>';
      h += '</div>';
      h += '<div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:10px;text-align:center">';
      h += '<div style="font-size:0.65rem;text-transform:uppercase;opacity:0.7;margin-bottom:2px">' + (isOvertime ? 'Over By' : 'Remaining') + '</div>';
      h += '<div style="font-size:1.3rem;font-weight:800;font-variant-numeric:tabular-nums;' + (isOvertime ? 'color:#ff6b6b' : '') + '">';
      h += remainingSec !== null ? fmtTime(remainingSec) : '--:--';
      h += '</div></div></div>';

      // Pet & client info if available
      if (_timerPetNames || _timerClientName) {
        h += '<div style="font-size:0.78rem;opacity:0.85;margin-bottom:10px;padding:8px;background:rgba(255,255,255,0.08);border-radius:8px">';
        if (_timerPetNames) h += '🐾 ' + _timerPetNames;
        if (_timerPetNames && _timerClientName) h += ' · ';
        if (_timerClientName) h += '👤 ' + _timerClientName;
        h += '</div>';
      }

      // End Service button
      h += '<button onclick="HHP_ServiceTimer.endFromTimer()" style="width:100%;padding:11px;background:rgba(255,255,255,0.2);color:white;border:1.5px solid rgba(255,255,255,0.4);border-radius:10px;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit">⏹ End Service & Generate Report</button>';

      inner.innerHTML = h;
    } else {
      // ── COMPACT VIEW (collapsed) ──
      var ch = '<div style="display:flex;align-items:center;gap:10px">';
      ch += '<div style="position:relative;flex-shrink:0">' + ringSvg;
      ch += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(0deg);font-size:0.55rem;font-weight:700">';
      ch += isOvertime ? '⏰' : (Math.round(progress * 100) + '%');
      ch += '</div></div>';
      ch += '<div style="flex:1;min-width:0">';
      ch += '<div style="font-size:0.78rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">';
      ch += isOvertime ? '⏰ OVERTIME' : '▶ ' + (_timerPetNames || 'Service');
      ch += '</div>';
      ch += '<div style="font-size:1.05rem;font-weight:800;font-variant-numeric:tabular-nums">' + fmtTime(elapsedSec) + '</div>';
      ch += '</div>';
      if (remainingSec !== null) {
        ch += '<div style="text-align:right;font-size:0.72rem;opacity:0.8;flex-shrink:0">';
        ch += '<div>' + (isOvertime ? 'over' : 'left') + '</div>';
        ch += '<div style="font-weight:700;font-variant-numeric:tabular-nums;' + (isOvertime ? 'color:#ff6b6b' : '') + '">' + fmtTime(remainingSec) + '</div>';
        ch += '</div>';
      }
      ch += '</div>';
      inner.innerHTML = ch;
    }
  }

  // ── Extra timer metadata ──
  var _timerServiceName = '';
  var _timerPetNames = '';
  var _timerClientName = '';
  var _timerBookingId = '';
  var _timerAddress = '';

  // ============================================================
  //  START TIMER — called after walk/service record created
  // ============================================================
  function startTimer(walkId, service, startTime, petNames, clientName, bookingId, address) {
    // Stop any existing timer
    stopTimer(true);

    _timerWalkId = walkId;
    _timerStartTime = new Date(startTime).getTime();
    _timerDurationMin = parseServiceDuration(service);
    _timerServiceName = service || 'Service';
    _timerPetNames = petNames || '';
    _timerClientName = clientName || '';
    _timerBookingId = bookingId || '';
    _timerAddress = address || '';
    _alarmFired = false;

    createTimerOverlay();
    updateTimerDisplay();

    // Update every second
    _timerInterval = setInterval(updateTimerDisplay, 1000);

    console.log('[service-timer] Timer started: ' + service + ', duration: ' + _timerDurationMin + ' min');
  }

  // ============================================================
  //  STOP TIMER — remove overlay, clear interval
  // ============================================================
  function stopTimer(silent) {
    if (_timerInterval) {
      clearInterval(_timerInterval);
      _timerInterval = null;
    }
    if (_timerOverlayEl) {
      _timerOverlayEl.remove();
      _timerOverlayEl = null;
    }
    _timerWalkId = null;
    _timerStartTime = null;
    _timerDurationMin = null;
    _alarmFired = false;
    if (!silent) console.log('[service-timer] Timer stopped');
  }

  // ============================================================
  //  END FROM TIMER — user clicks "End Service" inside timer
  // ============================================================
  function endFromTimer() {
    if (!_timerWalkId) return;
    var walkId = _timerWalkId;
    stopTimer();
    // Delegate to HHP_Tracking (handles DB update, report auto-fill, notifications)
    if (typeof HHP_Tracking !== 'undefined' && typeof HHP_Tracking.endWalk === 'function') {
      HHP_Tracking.endWalk(walkId);
    } else if (typeof stopServiceFromDrawer === 'function') {
      stopServiceFromDrawer(walkId);
    }
  }

  // ============================================================
  //  RESUME TIMER — check for active walk on page load
  // ============================================================
  async function resumeTimer() {
    var sb = getSB();
    var user = getUser();
    if (!sb || !user) return;

    try {
      var { data: activeWalk } = await sb.from('walks')
        .select('id, service, start_time, pet_name, client_id, booking_id')
        .eq('walker_id', user.id)
        .eq('status', 'in_progress')
        .limit(1)
        .single();

      if (!activeWalk) return;

      // Get client name and address from booking
      var clientName = '';
      var address = '';
      if (activeWalk.booking_id) {
        var { data: bk } = await sb.from('booking_requests')
          .select('contact_name, address')
          .eq('id', activeWalk.booking_id)
          .maybeSingle();
        if (bk) {
          clientName = bk.contact_name || '';
          address = bk.address || '';
        }
      }

      startTimer(
        activeWalk.id,
        activeWalk.service,
        activeWalk.start_time,
        activeWalk.pet_name,
        clientName,
        activeWalk.booking_id,
        address
      );
    } catch (e) {
      console.warn('[service-timer] Resume check error:', e);
    }
  }

  // ============================================================
  //  30-MIN PRE-APPOINTMENT REMINDERS
  //  Checks every 60 seconds for upcoming bookings within 30 min
  // ============================================================
  async function checkUpcomingAppointments() {
    var sb = getSB();
    var user = getUser();
    if (!sb || !user) return;

    var role = user.user_metadata && user.user_metadata.role;
    if (role !== 'owner' && role !== 'staff') return;

    var today = new Date().toISOString().split('T')[0];
    var nowMin = new Date().getHours() * 60 + new Date().getMinutes();

    try {
      // Fetch today's bookings
      var query = sb.from('booking_requests')
        .select('id, service, preferred_time, contact_name, pet_names, address, client_id, staff_id')
        .eq('preferred_date', today)
        .in('status', ['accepted', 'confirmed']);

      // Staff only see their assigned bookings
      if (role === 'staff') {
        // Get my assigned clients
        var { data: assignments } = await sb.from('staff_assignments')
          .select('client_id')
          .eq('staff_id', user.id);
        var clientIds = (assignments || []).map(function(a) { return a.client_id; });
        // Also include bookings directly assigned
        query = query.or('staff_id.eq.' + user.id + (clientIds.length ? ',client_id.in.(' + clientIds.join(',') + ')' : ''));
      }

      var { data: bookings } = await query;
      if (!bookings || bookings.length === 0) return;

      bookings.forEach(function(b) {
        if (_sentReminders[b.id]) return;

        // Parse booking time to minutes since midnight
        var bookingMin = parseTimeToMinutes(b.preferred_time);
        if (bookingMin === null) return;

        var diff = bookingMin - nowMin;
        // Send reminder between 25-35 min before (accounts for 60-sec check interval)
        if (diff >= 25 && diff <= 35) {
          _sentReminders[b.id] = true;
          sendPreAppointmentReminder(b, role);
        }
      });
    } catch (e) {
      console.warn('[service-timer] Upcoming appt check error:', e);
    }
  }

  // ── Parse time string to minutes since midnight ──
  function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    // Handle "9:00 AM", "2:30 PM", "14:30", etc.
    var s = timeStr.trim().toUpperCase();
    var pm = s.indexOf('PM') !== -1;
    var am = s.indexOf('AM') !== -1;
    s = s.replace(/[AP]M/g, '').trim();

    // Handle ranges like "9:00 AM - 10:00 AM" — use start time
    if (s.indexOf('-') !== -1) s = s.split('-')[0].trim();

    var parts = s.split(':');
    if (parts.length < 2) return null;
    var h = parseInt(parts[0]);
    var m = parseInt(parts[1]);
    if (isNaN(h) || isNaN(m)) return null;

    if (pm && h < 12) h += 12;
    if (am && h === 12) h = 0;

    return h * 60 + m;
  }

  // ============================================================
  //  SEND PRE-APPOINTMENT REMINDER
  //  In-app message + browser push + maps link
  // ============================================================
  async function sendPreAppointmentReminder(booking, role) {
    var sb = getSB();
    var user = getUser();
    if (!sb || !user) return;

    var svc = booking.service || 'Service';
    var time = booking.preferred_time || '';
    var client = booking.contact_name || 'Client';
    var pets = booking.pet_names || '';
    var address = booking.address || '';

    // ── Build maps link if address exists ──
    var mapsLink = '';
    var directionsText = '';
    if (address) {
      var encoded = encodeURIComponent(address);
      mapsLink = 'https://www.google.com/maps/dir/?api=1&destination=' + encoded;
      directionsText = '\n📍 Get directions: ' + mapsLink;
    }

    // ── In-app message ──
    var msgBody = '🔔 Reminder: ' + client + '\'s ' + svc + ' is in 30 minutes';
    if (time) msgBody += ' at ' + time;
    if (pets) msgBody += ' (' + pets + ')';
    msgBody += '.';
    if (address) msgBody += '\n📍 Address: ' + address;
    if (mapsLink) msgBody += '\n🗺️ Directions: ' + mapsLink;

    try {
      // Send as owner-to-self message so it shows up in their messages
      await sb.from('messages').insert({
        sender_id: user.id,
        recipient_id: user.id,
        body: msgBody
      });
    } catch (e) { console.warn('Reminder message error:', e); }

    // ── Browser push notification ──
    var pushBody = client + '\'s ' + svc;
    if (time) pushBody += ' at ' + time;
    if (pets) pushBody += ' (' + pets + ')';
    if (address) pushBody += '\n📍 ' + address;
    sendPushNotification('🔔 30 Min Heads Up!', pushBody, 'reminder-' + booking.id);

    // ── Try to get current location for ETA ──
    if (address && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          var lat = pos.coords.latitude;
          var lng = pos.coords.longitude;
          var directLink = 'https://www.google.com/maps/dir/' + lat + ',' + lng + '/' + encodeURIComponent(address);
          // Show toast with directions link
          showDirectionsToast(directLink, client, svc, time);
        },
        function() {
          // No GPS — just show basic toast
          if (mapsLink) showDirectionsToast(mapsLink, client, svc, time);
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    } else if (mapsLink) {
      showDirectionsToast(mapsLink, client, svc, time);
    }

    console.log('[service-timer] Sent 30-min reminder for booking ' + booking.id);
  }

  // ============================================================
  //  DIRECTIONS TOAST — persistent notification with map button
  // ============================================================
  function showDirectionsToast(mapsUrl, clientName, service, time) {
    // Remove any existing directions toast
    var existing = document.getElementById('hhp-directions-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'hhp-directions-toast';
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;background:white;border-radius:16px;padding:16px 20px;max-width:380px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);border:2px solid var(--forest,#3d5a47);font-family:inherit;animation:slideDown 0.3s ease;';

    toast.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
        '<div style="font-size:1.4rem">🔔</div>' +
        '<div style="flex:1">' +
          '<div style="font-weight:700;font-size:0.9rem;color:var(--ink)">Upcoming in 30 min</div>' +
          '<div style="font-size:0.82rem;color:var(--mid)">' + clientName + '\'s ' + service + (time ? ' at ' + time : '') + '</div>' +
        '</div>' +
        '<button onclick="this.closest(\'#hhp-directions-toast\').remove()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--mid);padding:4px">✕</button>' +
      '</div>' +
      '<a href="' + mapsUrl + '" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px;background:var(--forest,#3d5a47);color:white;border-radius:10px;font-size:0.88rem;font-weight:700;text-decoration:none;font-family:inherit">' +
        '🗺️ Open Maps & Get Directions' +
      '</a>';

    document.body.appendChild(toast);

    // Add animation
    var style = document.createElement('style');
    style.textContent = '@keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    if (!document.getElementById('hhp-toast-anim')) {
      style.id = 'hhp-toast-anim';
      document.head.appendChild(style);
    }

    // Auto-dismiss after 60 seconds
    setTimeout(function() {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
      }
    }, 60000);
  }

  // ============================================================
  //  REQUEST NOTIFICATION PERMISSION — called early
  // ============================================================
  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      // Don't request immediately — wait for user interaction
      var handler = function() {
        Notification.requestPermission();
        document.removeEventListener('click', handler);
      };
      document.addEventListener('click', handler, { once: true });
    }
  }

  // ============================================================
  //  INIT — start reminder checks on auth ready
  // ============================================================
  function init() {
    var user = getUser();
    if (!user) return;

    // Request push notification permission
    requestNotificationPermission();

    // Resume timer if service is active
    resumeTimer();

    // Start checking for upcoming appointments every 60 seconds
    if (_reminderCheckInterval) clearInterval(_reminderCheckInterval);
    checkUpcomingAppointments(); // immediate first check
    _reminderCheckInterval = setInterval(checkUpcomingAppointments, 60000);

    console.log('[service-timer] Initialized — reminder checks active');
  }

  // Wait for auth
  var _initAttempts = 0;
  function tryInit() {
    _initAttempts++;
    if (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentUser) {
      init();
    } else if (_initAttempts < 30) {
      setTimeout(tryInit, 500);
    }
  }
  setTimeout(tryInit, 1500);

  // Also listen for auth callbacks
  if (typeof window._hhpAuthCallbacks !== 'undefined') {
    window._hhpAuthCallbacks.push(function() { init(); });
  }

  // ============================================================
  //  PUBLIC API
  // ============================================================
  window.HHP_ServiceTimer = {
    startTimer: startTimer,
    stopTimer: stopTimer,
    endFromTimer: endFromTimer,
    resumeTimer: resumeTimer,
    parseServiceDuration: parseServiceDuration,
    checkUpcomingAppointments: checkUpcomingAppointments,
    sendPushNotification: sendPushNotification
  };

  console.log('[service-timer.js] Service timer + appointment reminders loaded');
})();
