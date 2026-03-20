// ============================================================
// Availability & Holidays Module
// Manages blocked dates, holidays, and availability display
// ============================================================

(function() {
  'use strict';

  // ---- US HOLIDAYS (Federal + Popular) ----
  // Returns holidays for a given year as { 'YYYY-MM-DD': 'Holiday Name' }
  function getHolidays(year) {
    var holidays = {};

    // Fixed-date holidays
    holidays[year + '-01-01'] = "New Year's Day";
    holidays[year + '-02-14'] = "Valentine's Day";
    holidays[year + '-03-17'] = "St. Patrick's Day";
    holidays[year + '-06-19'] = 'Juneteenth';
    holidays[year + '-07-04'] = 'Independence Day';
    holidays[year + '-10-31'] = 'Halloween';
    holidays[year + '-11-11'] = "Veterans Day";
    holidays[year + '-12-24'] = 'Christmas Eve';
    holidays[year + '-12-25'] = 'Christmas Day';
    holidays[year + '-12-31'] = "New Year's Eve";

    // Floating holidays (nth weekday of month)
    function nthWeekday(y, m, weekday, n) {
      // weekday: 0=Sun, 1=Mon, ... m is 0-indexed
      var d = new Date(y, m, 1);
      var count = 0;
      while (count < n) {
        if (d.getDay() === weekday) count++;
        if (count < n) d.setDate(d.getDate() + 1);
      }
      return d;
    }
    function lastWeekday(y, m, weekday) {
      var d = new Date(y, m + 1, 0); // last day of month
      while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
      return d;
    }
    function fmtDate(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    // MLK Day — 3rd Monday of January
    holidays[fmtDate(nthWeekday(year, 0, 1, 3))] = 'MLK Jr. Day';
    // Presidents Day — 3rd Monday of February
    holidays[fmtDate(nthWeekday(year, 1, 1, 3))] = "Presidents' Day";
    // Mother's Day — 2nd Sunday of May
    holidays[fmtDate(nthWeekday(year, 4, 0, 2))] = "Mother's Day";
    // Memorial Day — last Monday of May
    holidays[fmtDate(lastWeekday(year, 4, 1))] = 'Memorial Day';
    // Father's Day — 3rd Sunday of June
    holidays[fmtDate(nthWeekday(year, 5, 0, 3))] = "Father's Day";
    // Labor Day — 1st Monday of September
    holidays[fmtDate(nthWeekday(year, 8, 1, 1))] = 'Labor Day';
    // Columbus Day — 2nd Monday of October
    holidays[fmtDate(nthWeekday(year, 9, 1, 2))] = 'Columbus Day';
    // Thanksgiving — 4th Thursday of November
    var tgiving = nthWeekday(year, 10, 4, 4);
    holidays[fmtDate(tgiving)] = 'Thanksgiving';
    // Day after Thanksgiving
    var dayAfter = new Date(tgiving);
    dayAfter.setDate(dayAfter.getDate() + 1);
    holidays[fmtDate(dayAfter)] = 'Day After Thanksgiving';

    // Easter (anonymous Gregorian algorithm)
    var a = year % 19;
    var b = Math.floor(year / 100);
    var c = year % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var eMonth = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    var eDay = ((h + l - 7 * m + 114) % 31) + 1;
    holidays[year + '-' + String(eMonth + 1).padStart(2, '0') + '-' + String(eDay).padStart(2, '0')] = 'Easter Sunday';

    return holidays;
  }

  // Cache holidays for multiple years
  var _holidayCache = {};
  function getHolidaysForYear(y) {
    if (!_holidayCache[y]) _holidayCache[y] = getHolidays(y);
    return _holidayCache[y];
  }

  // Check if a date string is a holiday
  window.isHoliday = function(dateStr) {
    var y = parseInt(dateStr.substring(0, 4));
    var h = getHolidaysForYear(y);
    return h[dateStr] || null;
  };

  // Get all holidays for a month
  window.getMonthHolidays = function(year, month) {
    var h = getHolidaysForYear(year);
    var result = {};
    var prefix = year + '-' + String(month + 1).padStart(2, '0') + '-';
    Object.keys(h).forEach(function(k) {
      if (k.indexOf(prefix) === 0) result[k] = h[k];
    });
    return result;
  };

  // ---- AVAILABILITY BLOCKS (Database) ----
  var _blockedDatesCache = {}; // { 'YYYY-MM': { 'YYYY-MM-DD': { user_id, reason } } }

  // Load blocked dates for a month (all users — filtered by RLS)
  window.loadAvailabilityBlocks = async function(year, month) {
    var sb = window.HHP_Auth && window.HHP_Auth.supabase;
    if (!sb) return {};

    var key = year + '-' + String(month + 1).padStart(2, '0');
    var firstDay = key + '-01';
    var lastDay = key + '-' + String(new Date(year, month + 1, 0).getDate()).padStart(2, '0');

    try {
      var { data, error } = await sb.from('availability_blocks')
        .select('user_id, block_date, reason')
        .gte('block_date', firstDay)
        .lte('block_date', lastDay);

      if (error) { console.warn('[Availability] Load error:', error); return {}; }

      var blocks = {};
      if (data) {
        data.forEach(function(b) {
          if (!blocks[b.block_date]) blocks[b.block_date] = [];
          blocks[b.block_date].push({ user_id: b.user_id, reason: b.reason || '' });
        });
      }
      _blockedDatesCache[key] = blocks;
      return blocks;
    } catch (err) {
      console.warn('[Availability] Error:', err);
      return {};
    }
  };

  // Toggle a blocked date for a user
  window.toggleAvailabilityBlock = async function(dateStr, reason) {
    var sb = window.HHP_Auth && window.HHP_Auth.supabase;
    if (!sb || !window.HHP_Auth.currentUser) return false;

    var userId = window.HHP_Auth.currentUser.id;

    try {
      // Check if block exists
      var { data: existing } = await sb.from('availability_blocks')
        .select('id')
        .eq('user_id', userId)
        .eq('block_date', dateStr)
        .maybeSingle();

      if (existing) {
        // Remove block (make available again)
        await sb.from('availability_blocks').delete().eq('id', existing.id);
        return false; // now available
      } else {
        // Add block (mark unavailable)
        await sb.from('availability_blocks').insert({
          user_id: userId,
          block_date: dateStr,
          reason: reason || ''
        });
        return true; // now blocked
      }
    } catch (err) {
      console.error('[Availability] Toggle error:', err);
      if (typeof toast === 'function') toast('Error updating availability.');
      return null;
    }
  };

  // Block a range of dates
  window.blockDateRange = async function(startDate, endDate, reason) {
    var sb = window.HHP_Auth && window.HHP_Auth.supabase;
    if (!sb || !window.HHP_Auth.currentUser) return;

    var userId = window.HHP_Auth.currentUser.id;
    var cur = new Date(startDate + 'T12:00:00');
    var end = new Date(endDate + 'T12:00:00');
    var rows = [];

    while (cur <= end) {
      var ds = cur.toISOString().split('T')[0];
      rows.push({ user_id: userId, block_date: ds, reason: reason || '' });
      cur.setDate(cur.getDate() + 1);
    }

    if (rows.length === 0) return;

    try {
      // Upsert to avoid duplicates
      var { error } = await sb.from('availability_blocks')
        .upsert(rows, { onConflict: 'user_id,block_date' });
      if (error) throw error;
      if (typeof toast === 'function') toast('Blocked ' + rows.length + ' day(s).');
    } catch (err) {
      console.error('[Availability] Block range error:', err);
      if (typeof toast === 'function') toast('Error blocking dates.');
    }
  };

  // Unblock a range of dates
  window.unblockDateRange = async function(startDate, endDate) {
    var sb = window.HHP_Auth && window.HHP_Auth.supabase;
    if (!sb || !window.HHP_Auth.currentUser) return;

    var userId = window.HHP_Auth.currentUser.id;

    try {
      var { error } = await sb.from('availability_blocks')
        .delete()
        .eq('user_id', userId)
        .gte('block_date', startDate)
        .lte('block_date', endDate);
      if (error) throw error;
      if (typeof toast === 'function') toast('Dates unblocked.');
    } catch (err) {
      console.error('[Availability] Unblock range error:', err);
    }
  };

  // ---- OWNER AVAILABILITY CALENDAR UI ----
  window._availCalYear = new Date().getFullYear();
  window._availCalMonth = new Date().getMonth();
  window._availBlocks = {}; // blocks for current displayed month

  window.buildAvailCalendar = async function() {
    var container = document.getElementById('availCalWrap');
    if (!container) return;

    var year = window._availCalYear;
    var month = window._availCalMonth;
    var names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var firstDayOfWeek = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    // Load blocks for this month
    var blocks = await window.loadAvailabilityBlocks(year, month);
    window._availBlocks = blocks;

    // Get holidays
    var monthHolidays = window.getMonthHolidays(year, month);

    // Get current user ID
    var myId = (window.HHP_Auth && window.HHP_Auth.currentUser) ? window.HHP_Auth.currentUser.id : '';

    // Build calendar HTML
    var html = '<div class="cal-header">';
    html += '<button class="cal-nav-btn" onclick="window._availCalMonth--;if(window._availCalMonth<0){window._availCalMonth=11;window._availCalYear--;}buildAvailCalendar()">←</button>';
    html += '<span class="cal-month">' + names[month] + ' ' + year + '</span>';
    html += '<button class="cal-nav-btn" onclick="window._availCalMonth++;if(window._availCalMonth>11){window._availCalMonth=0;window._availCalYear++;}buildAvailCalendar()">→</button>';
    html += '</div>';

    html += '<div class="cal-grid">';
    days.forEach(function(d) { html += '<div class="cal-dow">' + d + '</div>'; });

    for (var i = 0; i < firstDayOfWeek; i++) html += '<div class="cal-day empty"></div>';

    for (var d = 1; d <= daysInMonth; d++) {
      var key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var isToday = key === todayStr;
      var holiday = monthHolidays[key] || null;
      var isBlocked = blocks[key] && blocks[key].some(function(b) { return b.user_id === myId; });
      var isPast = key < todayStr;

      var cls = 'cal-day';
      if (isToday) cls += ' today';
      if (isBlocked) cls += ' off';
      if (isPast) cls += ' past-day';

      var onclick = isPast ? '' : ' onclick="toggleAvailDay(\'' + key + '\')"';
      var tooltip = '';
      if (isBlocked) tooltip = 'Blocked — click to unblock';
      else if (!isPast) tooltip = 'Available — click to block';

      html += '<div class="' + cls + '"' + onclick + ' title="' + tooltip + '" style="' + (isPast ? 'opacity:0.4;cursor:default' : '') + '">';
      html += '<div class="cal-day-num">' + d + '</div>';

      if (holiday) {
        html += '<div style="font-size:0.62rem;line-height:1.2;color:var(--gold-deep);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + holiday + '</div>';
      }

      if (isBlocked) {
        var reason = '';
        blocks[key].forEach(function(b) { if (b.user_id === myId && b.reason) reason = b.reason; });
        html += '<div style="font-size:0.62rem;color:var(--rose);font-weight:700">BLOCKED</div>';
        if (reason) html += '<div style="font-size:0.58rem;color:var(--mid);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + reason + '</div>';
      } else if (!isPast) {
        html += '<div style="font-size:0.62rem;color:var(--forest);font-weight:600">Available</div>';
      }

      html += '</div>';
    }
    html += '</div>';

    // Legend
    html += '<div class="cal-legend" style="margin-top:14px">';
    html += '<div class="legend-item"><div class="legend-dot" style="background:white;border:1px solid var(--forest)"></div>Available</div>';
    html += '<div class="legend-item"><div class="legend-dot" style="background:var(--rose-pale);border:1px solid var(--rose-light)"></div>Blocked Off</div>';
    html += '<div class="legend-item"><div class="legend-dot" style="background:var(--gold-pale);border:1px solid rgba(200,150,62,0.3)"></div>Today</div>';
    html += '<div class="legend-item"><span style="font-size:0.72rem;color:var(--gold-deep);font-weight:600">Holiday</span></div>';
    html += '</div>';

    container.innerHTML = html;
  };

  // Toggle a single day on the availability calendar
  window.toggleAvailDay = async function(dateStr) {
    var result = await window.toggleAvailabilityBlock(dateStr);
    if (result === null) return; // error
    // Rebuild calendar to show change
    await window.buildAvailCalendar();
    if (result) {
      if (typeof toast === 'function') toast('Blocked: ' + dateStr);
    } else {
      if (typeof toast === 'function') toast('Unblocked: ' + dateStr);
    }
  };

  // ---- STAFF AVAILABILITY CALENDAR ----
  window._staffAvailCalYear = new Date().getFullYear();
  window._staffAvailCalMonth = new Date().getMonth();

  window.buildStaffAvailCalendar = async function() {
    var container = document.getElementById('staffAvailCalWrap');
    if (!container) return;

    var year = window._staffAvailCalYear;
    var month = window._staffAvailCalMonth;
    var names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var firstDayOfWeek = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    var blocks = await window.loadAvailabilityBlocks(year, month);
    var monthHolidays = window.getMonthHolidays(year, month);
    var myId = (window.HHP_Auth && window.HHP_Auth.currentUser) ? window.HHP_Auth.currentUser.id : '';

    var html = '<div class="cal-header">';
    html += '<button class="cal-nav-btn" onclick="window._staffAvailCalYear+=(window._staffAvailCalMonth===0?-1:0);window._staffAvailCalMonth=(window._staffAvailCalMonth+11)%12;buildStaffAvailCalendar()">←</button>';
    html += '<span class="cal-month">' + names[month] + ' ' + year + '</span>';
    html += '<button class="cal-nav-btn" onclick="window._staffAvailCalYear+=(window._staffAvailCalMonth===11?1:0);window._staffAvailCalMonth=(window._staffAvailCalMonth+1)%12;buildStaffAvailCalendar()">→</button>';
    html += '</div>';

    html += '<div class="cal-grid">';
    days.forEach(function(d) { html += '<div class="cal-dow">' + d + '</div>'; });

    for (var i = 0; i < firstDayOfWeek; i++) html += '<div class="cal-day empty"></div>';

    for (var d = 1; d <= daysInMonth; d++) {
      var key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var isToday = key === todayStr;
      var holiday = monthHolidays[key] || null;
      var isBlocked = blocks[key] && blocks[key].some(function(b) { return b.user_id === myId; });
      var isPast = key < todayStr;

      var cls = 'cal-day';
      if (isToday) cls += ' today';
      if (isBlocked) cls += ' off';

      var onclick = isPast ? '' : ' onclick="toggleStaffAvailDay(\'' + key + '\')"';

      html += '<div class="' + cls + '"' + onclick + ' style="' + (isPast ? 'opacity:0.4;cursor:default' : '') + '">';
      html += '<div class="cal-day-num">' + d + '</div>';
      if (holiday) html += '<div style="font-size:0.62rem;line-height:1.2;color:var(--gold-deep);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + holiday + '</div>';
      if (isBlocked) {
        html += '<div style="font-size:0.62rem;color:var(--rose);font-weight:700">BLOCKED</div>';
      } else if (!isPast) {
        html += '<div style="font-size:0.62rem;color:var(--forest);font-weight:600">Available</div>';
      }
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="cal-legend" style="margin-top:14px">';
    html += '<div class="legend-item"><div class="legend-dot" style="background:white;border:1px solid var(--forest)"></div>Available</div>';
    html += '<div class="legend-item"><div class="legend-dot" style="background:var(--rose-pale);border:1px solid var(--rose-light)"></div>Blocked Off</div>';
    html += '<div class="legend-item"><div class="legend-dot" style="background:var(--gold-pale);border:1px solid rgba(200,150,62,0.3)"></div>Today</div>';
    html += '</div>';

    container.innerHTML = html;
  };

  window.toggleStaffAvailDay = async function(dateStr) {
    var result = await window.toggleAvailabilityBlock(dateStr);
    if (result === null) return;
    await window.buildStaffAvailCalendar();

    // Notify owner when staff blocks a date
    if (result && window.HHP_Auth && window.HHP_Auth.supabase) {
      var sb = window.HHP_Auth.supabase;
      var staffName = '';
      if (window.HHP_Auth.currentUser) {
        var { data: prof } = await sb.from('profiles').select('full_name').eq('user_id', window.HHP_Auth.currentUser.id).single();
        if (prof) staffName = prof.full_name;
      }
      // Send a message to the owner about the availability change
      try {
        var { data: ownerProf } = await sb.from('profiles').select('user_id').eq('role', 'owner').limit(1).single();
        if (ownerProf) {
          await sb.from('messages').insert({
            sender_id: window.HHP_Auth.currentUser.id,
            recipient_id: ownerProf.user_id,
            content: '📅 Availability Update: ' + (staffName || 'Staff member') + ' has blocked off ' + dateStr + '. Please check if appointments on this date need to be adjusted.'
          });
        }
      } catch (e) {
        console.warn('[Availability] Could not notify owner:', e);
      }
    }

    if (result) {
      if (typeof toast === 'function') toast('Blocked: ' + dateStr + ' — Rachel has been notified.');
    } else {
      if (typeof toast === 'function') toast('Unblocked: ' + dateStr);
    }
  };

  // ---- OWNER: Block/Unblock Date Range (UI helpers) ----
  window.blockAvailRange = async function() {
    var from = document.getElementById('avail-range-from');
    var to = document.getElementById('avail-range-to');
    var reason = document.getElementById('avail-range-reason');
    if (!from || !to || !from.value || !to.value) {
      if (typeof toast === 'function') toast('Please select both From and To dates.');
      return;
    }
    if (from.value > to.value) {
      if (typeof toast === 'function') toast('From date must be before To date.');
      return;
    }
    await window.blockDateRange(from.value, to.value, reason ? reason.value : '');
    from.value = ''; to.value = ''; if (reason) reason.value = '';
    await window.buildAvailCalendar();
  };

  window.unblockAvailRange = async function() {
    var from = document.getElementById('avail-range-from');
    var to = document.getElementById('avail-range-to');
    if (!from || !to || !from.value || !to.value) {
      if (typeof toast === 'function') toast('Please select both From and To dates.');
      return;
    }
    await window.unblockDateRange(from.value, to.value);
    from.value = ''; to.value = '';
    await window.buildAvailCalendar();
  };

  // ---- STAFF: Block Date Range with owner notification ----
  window.staffBlockAvailRange = async function() {
    var from = document.getElementById('staff-avail-range-from');
    var to = document.getElementById('staff-avail-range-to');
    var reason = document.getElementById('staff-avail-range-reason');
    if (!from || !to || !from.value || !to.value) {
      if (typeof toast === 'function') toast('Please select both From and To dates.');
      return;
    }
    if (from.value > to.value) {
      if (typeof toast === 'function') toast('From date must be before To date.');
      return;
    }
    await window.blockDateRange(from.value, to.value, reason ? reason.value : '');

    // Notify owner
    if (window.HHP_Auth && window.HHP_Auth.supabase && window.HHP_Auth.currentUser) {
      var sb = window.HHP_Auth.supabase;
      try {
        var { data: prof } = await sb.from('profiles').select('full_name').eq('user_id', window.HHP_Auth.currentUser.id).single();
        var staffName = prof ? prof.full_name : 'Staff member';
        var { data: ownerProf } = await sb.from('profiles').select('user_id').eq('role', 'owner').limit(1).single();
        if (ownerProf) {
          await sb.from('messages').insert({
            sender_id: window.HHP_Auth.currentUser.id,
            recipient_id: ownerProf.user_id,
            content: '📅 Availability Update: ' + staffName + ' has blocked off ' + from.value + ' through ' + to.value + (reason && reason.value ? ' (Reason: ' + reason.value + ')' : '') + '. Please check if appointments need to be adjusted.'
          });
        }
      } catch (e) { console.warn('[Availability] Could not notify owner:', e); }
    }

    from.value = ''; to.value = ''; if (reason) reason.value = '';
    await window.buildStaffAvailCalendar();
    if (typeof toast === 'function') toast('Dates blocked — Rachel has been notified.');
  };

})();
