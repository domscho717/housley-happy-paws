// ============================================================
//  Housley Happy Paws — Live GPS Tracking System
//  Start/End walk buttons, GPS coordinate recording,
//  real-time client view, and route history for reports.
// ============================================================

(function() {
  'use strict';

  // ── Helpers ──
  function getSB() { return window.HHP_Auth && window.HHP_Auth.supabase; }
  function getUser() { return window.HHP_Auth && window.HHP_Auth.currentUser; }

  // Active walk state
  var _activeWalkId = null;
  var _gpsWatchId = null;
  var _trackingInterval = null;
  var _gpsIdleTimeout = null;  // Timeout to auto-stop GPS tracking after 3 hours
  var _trackingPoints = [];

  // ============================================================
  //  START SERVICE — called by owner or staff for any visit-type service
  // ============================================================
  async function startWalk(bookingId, clientId, service, petName) {
    var sb = getSB();
    var user = getUser();
    if (!sb || !user) { toast('Please sign in first.'); return; }

    // Check if there's already an active service for this user
    var { data: existing } = await sb.from('walks')
      .select('id')
      .eq('walker_id', user.id)
      .eq('status', 'in_progress')
      .limit(1);

    if (existing && existing.length > 0) {
      toast('You already have a service in progress. End it first.');
      return;
    }

    var isDogWalk = (service || '').toLowerCase().indexOf('dog walk') !== -1 ||
                    (service || '').toLowerCase().indexOf('walking') !== -1;

    // Create the service record
    var { data: walk, error } = await sb.from('walks').insert({
      walker_id: user.id,
      client_id: clientId || null,
      booking_id: bookingId || null,
      service: service || 'Dog Walk',
      pet_name: petName || null,
      status: 'in_progress',
      start_time: new Date().toISOString(),
      route_summary: []
    }).select().single();

    if (error) {
      console.error('Start service error:', error, JSON.stringify(error));
      toast('❌ Failed to start service: ' + (error.message || error.details || 'Unknown error'));
      return null;
    }

    _activeWalkId = walk.id;
    _trackingPoints = [];

    // Only start GPS tracking for dog walks
    if (isDogWalk) {
      toast('🚶 Walk started! GPS tracking is active.');
      startGPSTracking(walk.id);
    } else {
      toast('✅ Service started! Client has been notified.');
    }

    // Send "Live tracking" notification to client — only for dog walks
    // Drop-ins and other services already get the green "track progress" message from index.html
    if (clientId && isDogWalk) {
      sendWalkNotification(clientId, 'started', petName, service);
    }

    // Refresh whatever schedule panel is visible
    refreshScheduleView();
    return walk;
  }

  // ============================================================
  //  END SERVICE — called by owner or staff
  // ============================================================
  async function endWalk(walkId) {
    var sb = getSB();
    if (!sb) return;

    walkId = walkId || _activeWalkId;
    if (!walkId) { toast('No active service to end.'); return; }

    // Stop GPS tracking
    stopGPSTracking();

    // Get the full walk record first (need booking_id, service, etc.)
    var { data: walkData } = await sb.from('walks')
      .select('*')
      .eq('id', walkId)
      .single();

    var isDogWalk = walkData && (walkData.service || '').toLowerCase().indexOf('dog walk') !== -1;

    // Get all tracking points for route summary (only relevant for walks)
    var routeSummary = [];
    if (isDogWalk) {
      var { data: points } = await sb.from('tracking_points')
        .select('lat, lng, recorded_at')
        .eq('walk_id', walkId)
        .order('recorded_at', { ascending: true });

      routeSummary = (points || []).map(function(p) {
        return { lat: p.lat, lng: p.lng, t: p.recorded_at };
      });
    }

    // Update walk/service record
    var endTime = new Date().toISOString();
    var { error } = await sb.from('walks').update({
      status: 'completed',
      end_time: endTime,
      route_summary: routeSummary
    }).eq('id', walkId);

    if (error) {
      console.error('End service error:', error);
      toast('Failed to end service.');
      return;
    }

    // Send "walk finished" notification — only for dog walks (drop-ins get their own completion message from endServiceFromPanel)
    var _isWalk = (walkData.service || '').toLowerCase().indexOf('dog walk') !== -1 || (walkData.service || '').toLowerCase().indexOf('walking') !== -1;
    if (walkData && walkData.client_id && _isWalk) {
      sendWalkNotification(walkData.client_id, 'completed', walkData.pet_name, walkData.service);
    }

    _activeWalkId = null;
    _trackingPoints = [];
    // Stop the service timer overlay
    if (typeof HHP_ServiceTimer !== 'undefined') HHP_ServiceTimer.stopTimer();
    toast('✅ Service completed! Opening report...');

    refreshScheduleView();

    // Auto-open and pre-fill the report form
    if (walkData) {
      var reportData = {
        bookingId: walkData.booking_id,
        clientId: walkData.client_id,
        service: walkData.service,
        petNames: walkData.pet_name,
        startTime: walkData.start_time,
        endTime: endTime,
        walkId: walkId,
        distance: isDogWalk ? _calcRouteDistance(routeSummary) : null
      };
      // Small delay to let the schedule refresh complete
      setTimeout(function() {
        if (typeof openReportFromService === 'function') {
          openReportFromService(reportData);
        }
      }, 600);
    }
  }

  // Calculate approximate route distance from GPS points (in miles)
  function _calcRouteDistance(route) {
    if (!route || route.length < 2) return '';
    var totalMeters = 0;
    for (var i = 1; i < route.length; i++) {
      var R = 6371000; // Earth radius in meters
      var dLat = (route[i].lat - route[i-1].lat) * Math.PI / 180;
      var dLng = (route[i].lng - route[i-1].lng) * Math.PI / 180;
      var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(route[i-1].lat * Math.PI / 180) * Math.cos(route[i].lat * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
      totalMeters += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    var miles = totalMeters / 1609.34;
    return miles >= 0.1 ? miles.toFixed(1) + ' mi' : '';
  }

  // ============================================================
  //  GPS TRACKING — record coordinates while walk is active
  // ============================================================
  function startGPSTracking(walkId) {
    if (!navigator.geolocation) {
      toast('GPS not available on this device.');
      return;
    }

    // Clear any existing idle timeout
    if (_gpsIdleTimeout) {
      clearTimeout(_gpsIdleTimeout);
    }

    // Record initial position
    navigator.geolocation.getCurrentPosition(
      function(pos) { recordPoint(walkId, pos); },
      function(err) { console.warn('GPS error:', err.message); },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    // Watch position continuously
    _gpsWatchId = navigator.geolocation.watchPosition(
      function(pos) { recordPoint(walkId, pos); },
      function(err) { console.warn('GPS watch error:', err.message); },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );

    // Also poll every 30 seconds as backup
    _trackingInterval = setInterval(function() {
      navigator.geolocation.getCurrentPosition(
        function(pos) { recordPoint(walkId, pos); },
        function() {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }, 30000);

    // Auto-stop GPS tracking after 3 hours to prevent battery drain
    _gpsIdleTimeout = setTimeout(function() {
      console.warn('GPS tracking auto-stopped after 3 hours of continuous tracking');
      stopGPSTracking();
    }, 10800000);  // 3 hours in milliseconds
  }

  function stopGPSTracking() {
    if (_gpsWatchId !== null) {
      navigator.geolocation.clearWatch(_gpsWatchId);
      _gpsWatchId = null;
    }
    if (_trackingInterval) {
      clearInterval(_trackingInterval);
      _trackingInterval = null;
    }
    if (_gpsIdleTimeout) {
      clearTimeout(_gpsIdleTimeout);
      _gpsIdleTimeout = null;
    }
  }

  var _lastRecordedAt = 0;
  function recordPoint(walkId, pos) {
    // Throttle: don't record more than once per 10 seconds
    var now = Date.now();
    if (now - _lastRecordedAt < 10000) return;
    _lastRecordedAt = now;

    var point = {
      walk_id: walkId,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy || null,
      recorded_at: new Date().toISOString()
    };

    _trackingPoints.push(point);

    // Save to Supabase (fire-and-forget)
    var sb = getSB();
    if (sb) {
      sb.from('tracking_points').insert(point).then(function(res) {
        if (res.error) console.warn('Track point save error:', res.error);
      }).catch(function(err) {
        console.warn('Track point insert error:', err);
      });
    }
  }

  // ============================================================
  //  WALK NOTIFICATIONS — notify client when walk starts/ends
  // ============================================================
  async function sendWalkNotification(clientId, action, petName, service) {
    var sb = getSB();
    var user = getUser();
    if (!sb || !user) return;

    var walkerProfile = user.profile || {};
    var walkerName = walkerProfile.full_name || 'Your walker';
    var pet = petName || 'your pet';

    var body = action === 'started'
      ? '🚶 ' + walkerName + ' has started ' + pet + '\'s ' + (service || 'walk') + '! Live tracking is now active.'
      : '✅ ' + walkerName + ' has finished ' + pet + '\'s ' + (service || 'walk') + '. Check your reports for the walk summary!';

    try {
      await sb.from('messages').insert({
        sender_id: user.id,
        recipient_id: clientId,
        body: body,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Walk notification error:', e);
    }
  }

  // ============================================================
  //  CHECK ACTIVE WALK — on page load, resume tracking if needed
  // ============================================================
  async function checkForActiveWalk() {
    var sb = getSB();
    var user = getUser();
    if (!sb || !user) return null;

    var { data } = await sb.from('walks')
      .select('*')
      .eq('walker_id', user.id)
      .eq('status', 'in_progress')
      .limit(1)
      .single();

    if (data) {
      _activeWalkId = data.id;
      // Resume GPS tracking
      startGPSTracking(data.id);
      return data;
    }
    return null;
  }

  // ============================================================
  //  BUILD START/END BUTTON HTML — for schedule cards
  //  Works for all visit-type services (walks, drop-ins, cat care)
  //  Excluded: House Sitting, Dog Boarding, Doggy Day Care, Paw Bus
  // ============================================================
  function buildWalkButton(booking, activeWalk) {
    if (!booking) return '';

    // Services that use manual reports (no Start/End button)
    var svcLower = (booking.service || '').toLowerCase();
    var isExcluded = svcLower.indexOf('house sitting') !== -1 ||
                     svcLower.indexOf('boarding') !== -1 ||
                     svcLower.indexOf('day care') !== -1 ||
                     svcLower.indexOf('daycare') !== -1 ||
                     svcLower.indexOf('paw bus') !== -1;
    if (isExcluded) return '';

    var isDogWalk = svcLower.indexOf('dog walk') !== -1 || svcLower.indexOf('walking') !== -1;
    var serviceLabel = isDogWalk ? 'Walk' : 'Service';

    var isThisWalkActive = activeWalk && activeWalk.booking_id === booking.id;
    var anyWalkActive = !!activeWalk;

    if (isThisWalkActive) {
      var elapsed = Math.floor((Date.now() - new Date(activeWalk.start_time).getTime()) / 60000);
      var durMin = (typeof HHP_ServiceTimer !== 'undefined') ? HHP_ServiceTimer.parseServiceDuration(booking.service) : null;
      var remaining = durMin ? (durMin - elapsed) : null;
      var isOver = remaining !== null && remaining <= 0;
      var timeInfo = elapsed + ' min';
      if (remaining !== null) timeInfo += ' · ' + (isOver ? '⏰ +' + Math.abs(remaining) + ' over' : Math.abs(remaining) + ' min left');
      if (isDogWalk) timeInfo += ' · GPS Active';
      return '<div style="margin-top:8px">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">' +
          '<div style="width:10px;height:10px;border-radius:50%;background:' + (isOver ? '#c25656' : '#22c55e') + ';animation:pulse 2s infinite"></div>' +
          '<span style="font-size:0.78rem;font-weight:600;color:' + (isOver ? 'var(--rose,#c25656)' : 'var(--forest)') + '">' + (isOver ? '⏰ Overtime' : 'In Progress') + ' · ' + timeInfo + '</span>' +
        '</div>' +
        '<button onclick="HHP_Tracking.endWalk(\'' + activeWalk.id + '\')" ' +
          'style="background:var(--rose,#c25656);color:white;border:none;border-radius:8px;padding:8px 16px;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;width:100%">' +
          '⏹ End ' + serviceLabel + '</button></div>';
    }

    var today = _localDateStr();
    var isToday = booking.date === today;
    var isConfirmed = booking.status === 'confirmed';

    if (!isToday || !isConfirmed) return '';

    if (anyWalkActive) {
      return '<div style="margin-top:8px;font-size:0.76rem;color:var(--mid);font-style:italic">Another service is in progress</div>';
    }

    return '<div style="margin-top:8px">' +
      '<button onclick="HHP_Tracking.startWalk(\'' + (booking.id || '') + '\',\'' + (booking.client_id || '') + '\',\'' +
        (booking.service || 'Dog Walk').replace(/'/g, "\\'") + '\',\'' + (booking.pet_names || '').replace(/'/g, "\\'") + '\')" ' +
        'style="background:var(--forest,#3d5a47);color:white;border:none;border-radius:8px;padding:8px 16px;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;width:100%">' +
        '▶ Start ' + serviceLabel + '</button></div>';
  }

  // ============================================================
  //  CLIENT LIVE TRACKING VIEW — real-time walk display
  // ============================================================
  async function loadClientLiveTracking() {
    var sb = getSB();
    var user = getUser();
    if (!sb || !user) return;

    var panel = document.getElementById('c-track');
    if (!panel) return;
    var card = panel.querySelector('.card');
    if (!card) return;

    try {
      // Find active walks for this client (supports View As mode)
      var _trackClientId = (typeof getEffectiveClientId === 'function' ? getEffectiveClientId() : null) || user.id;
      var { data: activeWalks } = await sb.from('walks')
        .select('*')
        .eq('client_id', _trackClientId)
        .eq('status', 'in_progress')
        .order('start_time', { ascending: false });

      var walks = activeWalks || [];

      // Also check today's bookings
      var today = _localDateStr();
      var { data: todayBookings } = await sb.from('bookings')
        .select('*')
        .eq('client_id', _trackClientId)
        .eq('date', today)
        .eq('status', 'confirmed');
      var todayJobs = todayBookings || [];

      if (walks.length === 0 && todayJobs.length === 0) {
        card.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mid)">' +
          '<div style="font-size:2.5rem;margin-bottom:12px">🗺️</div>' +
          '<div style="font-weight:600;margin-bottom:6px">No active walk right now</div>' +
          '<div style="font-size:0.84rem">Live GPS tracking will appear here during your pet\'s walk.</div></div>';
        return;
      }

      card.innerHTML = '';

      // Show active walks with live map
      for (var wi = 0; wi < walks.length; wi++) {
        var w = walks[wi];
        var petName = w.pet_name || 'Your pet';
        var startTime = new Date(w.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        var elapsed = Math.floor((Date.now() - new Date(w.start_time).getTime()) / 60000);

        // Fetch latest tracking points
        var { data: points } = await sb.from('tracking_points')
          .select('lat, lng, recorded_at')
          .eq('walk_id', w.id)
          .order('recorded_at', { ascending: true });

        var trackPts = points || [];
        var lastPt = trackPts.length > 0 ? trackPts[trackPts.length - 1] : null;

        var div = document.createElement('div');
        div.style.cssText = 'padding:20px;background:linear-gradient(135deg,rgba(61,90,71,0.06),transparent);border-radius:12px;margin-bottom:12px;border:1px solid rgba(61,90,71,0.15)';

        var mapHtml;
        if (lastPt) {
          // Show OpenStreetMap with route
          mapHtml = buildTrackingMap(trackPts, w.id, true);
        } else {
          mapHtml = '<div style="margin-top:16px;height:200px;border-radius:10px;background:var(--warm);display:flex;align-items:center;justify-content:center;border:1px solid var(--border)">' +
            '<div style="text-align:center;color:var(--mid)"><div style="font-size:2rem">📍</div><div style="font-size:0.8rem;margin-top:6px">Waiting for GPS signal...</div></div></div>';
        }

        div.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
          '<div style="width:12px;height:12px;border-radius:50%;background:#22c55e;animation:pulse 2s infinite"></div>' +
          '<div style="font-weight:700;font-size:1rem;color:var(--forest,#3d5a47)">Walk in Progress!</div></div>' +
          '<div style="font-size:0.9rem;margin-bottom:6px"><strong>' + petName + '</strong> is out on a ' + (w.service || 'walk').toLowerCase() + '</div>' +
          '<div style="font-size:0.82rem;color:var(--mid)">Started at ' + startTime + ' · ' + elapsed + ' min elapsed' +
          (trackPts.length > 0 ? ' · ' + trackPts.length + ' GPS points' : '') + '</div>' +
          mapHtml;
        card.appendChild(div);
      }

      // Show today's scheduled jobs that haven't started yet
      if (todayJobs.length > 0) {
        var hasUpcoming = todayJobs.some(function(b) {
          return !walks.some(function(w) { return w.booking_id === b.id; });
        });
        if (hasUpcoming) {
          var header = document.createElement('div');
          header.style.cssText = 'font-weight:700;font-size:0.9rem;color:var(--dark);margin:12px 0 8px;padding:0 4px';
          header.textContent = "📅 Today's Scheduled Visits";
          card.appendChild(header);

          var svcIcons = {'Dog Walking':'🐕','Drop-In Visit':'🚪','Drop-In Visit (Cat)':'🐱','Cat Care Visit':'🐱','House Sitting':'🏡','Dog Boarding':'🌙'};
          todayJobs.forEach(function(b) {
            // Skip if this booking already has an active walk
            if (walks.some(function(w) { return w.booking_id === b.id; })) return;
            var icon = svcIcons[b.service] || '🐾';
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px;background:var(--warm,#faf6ee);border-radius:8px;margin-bottom:6px';
            row.innerHTML = '<div style="font-size:1.2rem">' + icon + '</div>' +
              '<div><div style="font-weight:600;font-size:0.85rem">' + (b.service || 'Service') + '</div>' +
              '<div style="font-size:0.78rem;color:var(--mid)">' + (b.time_slot || 'Time TBD') + (b.pet_names ? ' · ' + b.pet_names : '') + '</div></div>';
            card.appendChild(row);
          });
        }
      }

      // Auto-refresh every 15 seconds if there's an active walk
      if (walks.length > 0) {
        clearTimeout(window._trackRefreshTimer);
        window._trackRefreshTimer = setTimeout(function() {
          var trackPanel = document.getElementById('c-track');
          if (trackPanel && trackPanel.style.display !== 'none' && trackPanel.closest('.page.active')) {
            loadClientLiveTracking();
          }
        }, 15000);
      }
    } catch (e) {
      console.warn('Load live tracking error:', e);
    }
  }

  // ============================================================
  //  BUILD MAP — OpenStreetMap iframe showing walk route
  // ============================================================
  function buildTrackingMap(points, walkId, isLive) {
    if (!points || points.length === 0) return '';

    var lastPt = points[points.length - 1];
    var firstPt = points[0];

    // Calculate bounds
    var minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    points.forEach(function(p) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    });
    var centerLat = (minLat + maxLat) / 2;
    var centerLng = (minLng + maxLng) / 2;

    // Calculate appropriate zoom level
    var latDiff = maxLat - minLat;
    var lngDiff = maxLng - minLng;
    var maxDiff = Math.max(latDiff, lngDiff);
    var zoom = 16;
    if (maxDiff > 0.1) zoom = 12;
    else if (maxDiff > 0.05) zoom = 13;
    else if (maxDiff > 0.02) zoom = 14;
    else if (maxDiff > 0.005) zoom = 15;

    // Build polyline coordinates for the route
    var coordStr = points.map(function(p) { return '[' + p.lat + ',' + p.lng + ']'; }).join(',');

    var mapId = 'tracking-map-' + walkId;
    var liveIndicator = isLive ? '<div style="position:absolute;top:8px;right:8px;z-index:1000;background:#22c55e;color:white;padding:3px 10px;border-radius:20px;font-size:0.7rem;font-weight:700;display:flex;align-items:center;gap:4px"><div style="width:6px;height:6px;background:white;border-radius:50%;animation:pulse 1.5s infinite"></div>LIVE</div>' : '';

    return '<div style="position:relative;margin-top:16px;border-radius:10px;overflow:hidden;border:1px solid var(--border)">' +
      liveIndicator +
      '<div id="' + mapId + '" style="height:250px;background:#e8e0d0"></div>' +
      '</div>' +
      '<script>' +
        '(function(){' +
          'var mapEl=document.getElementById("' + mapId + '");' +
          'if(!mapEl||mapEl._leafletInit)return;' +
          'mapEl._leafletInit=true;' +
          'function initMap(){' +
            'if(typeof L==="undefined"){setTimeout(initMap,200);return;}' +
            'var map=L.map("' + mapId + '",{zoomControl:true,attributionControl:false,minZoom:12}).setView([' + centerLat + ',' + centerLng + '],' + zoom + ');' +
            'L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);' +
            'var coords=[' + coordStr + '];' +
            'if(coords.length>1)L.polyline(coords,{color:"#3d5a47",weight:4,opacity:0.8}).addTo(map);' +
            'L.circleMarker([' + firstPt.lat + ',' + firstPt.lng + '],{radius:6,color:"#3d5a47",fillColor:"#c8963e",fillOpacity:1,weight:2}).addTo(map).bindPopup("Start");' +
            'L.circleMarker([' + lastPt.lat + ',' + lastPt.lng + '],{radius:8,color:"#22c55e",fillColor:"#22c55e",fillOpacity:1,weight:2}).addTo(map).bindPopup("' + (isLive ? 'Current Location' : 'End') + '");' +
            'if(coords.length>1)map.fitBounds(coords,{padding:[30,30]});' +
          '}' +
          'initMap();' +
        '})();' +
      '<\/script>';
  }

  // ============================================================
  //  BUILD REPORT ROUTE MAP — for completed walk reports
  // ============================================================
  function buildReportRouteMap(routeSummary, walkId) {
    if (!routeSummary || routeSummary.length === 0) return '';

    var points = routeSummary.map(function(p) { return { lat: p.lat, lng: p.lng }; });
    return '<div style="margin-top:16px">' +
      '<div style="font-weight:700;font-size:0.88rem;margin-bottom:8px">🗺️ Walk Route</div>' +
      buildTrackingMap(points, walkId || 'report', false) +
      '<div style="font-size:0.75rem;color:var(--mid);margin-top:6px">' + points.length + ' GPS points recorded during this walk</div>' +
      '</div>';
  }

  // ============================================================
  //  REFRESH SCHEDULE VIEW — after start/end walk
  // ============================================================
  function refreshScheduleView() {
    if (typeof loadStaffSchedule === 'function') loadStaffSchedule();
    if (typeof loadStaffJobs === 'function') loadStaffJobs();
    // Reload owner's Today's Schedule with updated walk buttons
    if (typeof loadOwnerTodaySchedule === 'function') loadOwnerTodaySchedule();
  }

  // ============================================================
  //  PUBLIC API
  // ============================================================
  window.HHP_Tracking = {
    startWalk: startWalk,
    endWalk: endWalk,
    checkForActiveWalk: checkForActiveWalk,
    buildWalkButton: buildWalkButton,
    buildReportRouteMap: buildReportRouteMap,
    loadClientLiveTracking: loadClientLiveTracking,
    getActiveWalkId: function() { return _activeWalkId; }
  };

  // Auto-check for active walk on auth ready
  var _initAttempts = 0;
  function tryInit() {
    _initAttempts++;
    if (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentUser) {
      checkForActiveWalk();
    } else if (_initAttempts < 20) {
      setTimeout(tryInit, 500);
    }
  }
  setTimeout(tryInit, 1000);

  console.log('[live-tracking.js] GPS tracking system loaded');
})();
