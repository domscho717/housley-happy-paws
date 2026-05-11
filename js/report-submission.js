/*
 * Housley Happy Paws — Report Submission Pipeline
 *
 * The end-of-service report submission is the most important daily flow on the
 * site. It used to be a long serial chain (Cloudinary upload → DB insert →
 * booking status → message → email → log), which meant any one slow step
 * (a phone with bad signal trying to upload 6 photos) hung the whole thing.
 *
 * This module flips the order:
 *   1. Save the typed form to localStorage IMMEDIATELY (before any network).
 *   2. Caller can close the modal optimistically — data is safe.
 *   3. Insert service_reports as soon as possible (5s timeout) — source of truth.
 *   4. Everything else (media uploads, booking status, client message, email,
 *      activity log) runs in parallel via allSettled with individual catches.
 *
 * If anything fails, the localStorage entry survives and the recovery banner
 * on the next portal load offers Send Now / Discard.
 */
(function() {
  'use strict';

  var LS_PREFIX = 'hhp_pending_report_';
  var REPORT_INSERT_TIMEOUT_MS = 5000;
  var MEDIA_UPLOAD_TIMEOUT_MS = 15000;
  var CLOUDINARY_CLOUD = 'dg1p1zjgv';
  var CLOUDINARY_PRESET = 'hhp_unsigned';

  // ────────────────────────────────────────────────────────────────────────
  //  localStorage helpers — survive a crash/close/refresh
  // ────────────────────────────────────────────────────────────────────────
  function lsKey(id) { return LS_PREFIX + id; }

  function savePending(id, payload) {
    if (!id) return;
    try {
      payload._savedAt = payload._savedAt || new Date().toISOString();
      localStorage.setItem(lsKey(id), JSON.stringify(payload));
    } catch (e) {
      // Quota usually — strip stagedMedia and try again so at least text survives.
      try {
        var lite = Object.assign({}, payload, { stagedMedia: [] });
        lite._mediaDropped = true;
        localStorage.setItem(lsKey(id), JSON.stringify(lite));
      } catch (_) { console.warn('savePending failed:', e); }
    }
  }

  function clearPending(id) {
    if (!id) return;
    try { localStorage.removeItem(lsKey(id)); } catch (e) {}
  }

  function getAllPending() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(LS_PREFIX) === 0) {
          try { out.push({ key: k, id: k.slice(LS_PREFIX.length), data: JSON.parse(localStorage.getItem(k)) }); } catch (e) {}
        }
      }
    } catch (e) {}
    return out;
  }

  // ────────────────────────────────────────────────────────────────────────
  //  Promise-with-timeout helper
  // ────────────────────────────────────────────────────────────────────────
  function withTimeout(promise, ms, label) {
    return new Promise(function(resolve, reject) {
      var done = false;
      var t = setTimeout(function() {
        if (done) return;
        done = true;
        reject(new Error((label || 'operation') + ' timed out after ' + ms + 'ms'));
      }, ms);
      Promise.resolve(promise).then(function(v) {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(v);
      }, function(e) {
        if (done) return;
        done = true;
        clearTimeout(t);
        reject(e);
      });
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  //  Cloudinary uploads — parallel, with per-upload timeout
  // ────────────────────────────────────────────────────────────────────────
  function dataUrlToBlob(dataUrl) {
    var byteString = atob(dataUrl.split(',')[1]);
    var mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var bi = 0; bi < byteString.length; bi++) ia[bi] = byteString.charCodeAt(bi);
    return new Blob([ab], { type: mimeString });
  }

  function uploadOneMedia(item, idx) {
    return new Promise(function(resolve) {
      try {
        var fd = new FormData();
        var blob = dataUrlToBlob(item.dataUrl);
        fd.append('file', blob, item.name || ('media_' + idx));
        fd.append('upload_preset', CLOUDINARY_PRESET);
        fd.append('folder', 'housley-happy-paws/reports');
        var uploadType = item.type === 'video' ? 'video' : 'image';
        var url = 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/' + uploadType + '/upload';
        withTimeout(
          fetch(url, { method: 'POST', body: fd }).then(function(r) { return r.json(); }),
          MEDIA_UPLOAD_TIMEOUT_MS,
          'media upload'
        ).then(function(data) {
          if (data && data.secure_url) {
            resolve({
              public_id: data.public_id,
              url: data.secure_url,
              thumbnail: data.thumbnail_url || data.secure_url,
              type: data.resource_type || uploadType,
              format: data.format
            });
          } else { resolve(null); }
        }).catch(function(err) {
          console.warn('[report] media upload failed:', err && err.message);
          resolve(null);
        });
      } catch (e) { console.warn('[report] media prep failed:', e); resolve(null); }
    });
  }

  function uploadMediaParallel(stagedMedia) {
    if (!stagedMedia || stagedMedia.length === 0) return Promise.resolve([]);
    return Promise.all(stagedMedia.map(uploadOneMedia)).then(function(results) {
      return results.filter(function(r) { return r; });
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  //  Full submission pipeline
  // ────────────────────────────────────────────────────────────────────────
  //
  //  payload = {
  //    pendingKey: <id used in localStorage>,
  //    sb, user,
  //    reportData: {...service_reports columns sans media...},
  //    stagedMedia: [{dataUrl, name, type}, ...],
  //    walkId, bookingId, clientId,
  //    walkUpdate: { status, end_time, route_summary? },
  //    clientMessage: { sender_id, sender_name, recipient_id, body },
  //    activityLog: { sender_id, sender_name, recipient_id, body },
  //    emailNotification: { url, body },
  //    onProgress: function(stage, detail)
  //  }
  //
  function runSubmissionPipeline(payload) {
    var sb = payload.sb;
    var onProgress = payload.onProgress || function() {};

    // Stage 1: insert service_reports (the source of truth) with 5s timeout.
    var insertPromise = sb.from('service_reports').insert(payload.reportData).select('id').single();
    return withTimeout(insertPromise, REPORT_INSERT_TIMEOUT_MS, 'service_reports insert').then(function(insertResult) {
      if (insertResult.error) throw insertResult.error;
      var reportId = insertResult.data && insertResult.data.id;
      onProgress('reportSaved', { reportId: reportId });

      // We can safely clear the localStorage entry — text/metadata is durable in DB now.
      // (Media URLs will be added via UPDATE once Cloudinary returns; if that fails the
      //  report is still useful, just without photos.)
      clearPending(payload.pendingKey);

      // Stage 2: kick off everything else in parallel. Each step has its own catch
      // so one failure doesn't poison the others.
      var tasks = [];

      // 2a — Walks row (status + route_summary)
      if (payload.walkId && payload.walkUpdate) {
        tasks.push(
          Promise.resolve(sb.from('walks').update(payload.walkUpdate).eq('id', payload.walkId))
            .then(function() { onProgress('walkClosed'); })
            .catch(function(e) { console.warn('[report] walk update failed:', e); })
        );
      }

      // 2b — Booking status (live-tracking.js endWalk already does a safety-net update
      //      before we get here, but we re-do it with the smarter recurring/one-time
      //      decision so the booking lands on the right final status).
      if (payload.bookingId && payload.bookingUpdate) {
        tasks.push(
          Promise.resolve(sb.from('booking_requests').update(payload.bookingUpdate).eq('id', payload.bookingId))
            .then(function() { onProgress('bookingUpdated'); })
            .catch(function(e) { console.warn('[report] booking update failed:', e); })
        );
      }

      // 2c — Client message (in-portal "service complete" note)
      if (payload.clientMessage) {
        tasks.push(
          Promise.resolve(sb.from('messages').insert(payload.clientMessage))
            .then(function() { onProgress('clientMessaged'); })
            .catch(function(e) { console.warn('[report] client message failed:', e); })
        );
      }

      // 2d — Email notification to client. Fire-and-forget with timeout.
      if (payload.emailNotification && payload.emailNotification.url) {
        tasks.push(
          withTimeout(
            fetch(payload.emailNotification.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload.emailNotification.body)
            }),
            8000,
            'email notification'
          ).then(function() { onProgress('emailSent'); })
            .catch(function(e) { console.warn('[report] email notify failed:', e && e.message); })
        );
      }

      // 2e — Activity log entry (owner self-message)
      if (payload.activityLog) {
        tasks.push(
          Promise.resolve(sb.from('messages').insert(payload.activityLog))
            .catch(function(e) { console.warn('[report] activity log failed:', e); })
        );
      }

      // 2f — Cloudinary photo uploads, then UPDATE service_reports.media
      if (payload.stagedMedia && payload.stagedMedia.length > 0 && reportId) {
        tasks.push(
          uploadMediaParallel(payload.stagedMedia).then(function(uploaded) {
            onProgress('mediaUploaded', { count: uploaded.length, total: payload.stagedMedia.length });
            if (uploaded.length > 0) {
              return sb.from('service_reports').update({ media: uploaded }).eq('id', reportId);
            }
          }).catch(function(e) { console.warn('[report] media pipeline failed:', e); })
        );
      }

      return Promise.allSettled(tasks).then(function() {
        onProgress('done');
        return { reportId: reportId, success: true };
      });
    }).catch(function(insertErr) {
      // service_reports insert failed (or timed out). Keep localStorage entry so the
      // recovery banner can offer Send Now next time the user opens the portal.
      console.error('[report] service_reports insert failed/timed out:', insertErr);
      onProgress('reportFailed', { error: insertErr && insertErr.message });
      return { success: false, error: insertErr && insertErr.message };
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  //  Recovery banner — surfaces pending reports on portal load
  // ────────────────────────────────────────────────────────────────────────
  function _fmtAge(iso) {
    if (!iso) return '';
    var ms = Date.now() - new Date(iso).getTime();
    var mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' hr ago';
    return Math.floor(hrs / 24) + ' day(s) ago';
  }

  function renderRecoveryBanner() {
    var pending = getAllPending();
    var existing = document.getElementById('hhp-report-recovery-banner');
    if (pending.length === 0) {
      if (existing) existing.remove();
      return;
    }
    if (existing) existing.remove();

    var bar = document.createElement('div');
    bar.id = 'hhp-report-recovery-banner';
    bar.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#fff8e1;border:1px solid #f0c050;border-left:4px solid #c8963e;border-radius:10px;padding:12px 18px;box-shadow:0 4px 16px rgba(0,0,0,0.12);z-index:9500;max-width:560px;width:calc(100% - 32px);font-size:0.88rem;display:flex;align-items:center;gap:12px;flex-wrap:wrap';
    var first = pending[0];
    var label = first.data && first.data.summary ? first.data.summary : ('unsent report');
    var ageStr = _fmtAge(first.data && first.data._savedAt);
    var extra = pending.length > 1 ? ' (+' + (pending.length - 1) + ' more)' : '';
    bar.innerHTML =
      '<div style="flex:1;min-width:180px"><strong style="color:#856404">📝 Unsent report:</strong> ' +
      label + ' · saved ' + ageStr + extra + '</div>' +
      '<button id="hhp-recovery-send" style="padding:8px 16px;background:var(--forest,#3d5a47);color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.84rem">Send Now</button>' +
      '<button id="hhp-recovery-dismiss" style="padding:8px 14px;background:transparent;color:#856404;border:1px solid #c8963e;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.84rem">Discard</button>';
    document.body.appendChild(bar);

    document.getElementById('hhp-recovery-send').onclick = function() {
      bar.style.opacity = '0.6';
      retryAllPending().then(function(results) {
        var ok = results.filter(function(r) { return r.success; }).length;
        var fail = results.length - ok;
        if (fail === 0) {
          if (typeof toast === 'function') toast('✅ Resent ' + ok + ' report' + (ok === 1 ? '' : 's'));
          renderRecoveryBanner();
        } else {
          if (typeof toast === 'function') toast('⚠️ ' + ok + ' sent, ' + fail + ' still pending');
          bar.style.opacity = '1';
        }
      });
    };
    document.getElementById('hhp-recovery-dismiss').onclick = function() {
      if (!confirm('Discard ' + pending.length + ' unsent report(s)? This can\'t be undone.')) return;
      pending.forEach(function(p) { clearPending(p.id); });
      renderRecoveryBanner();
    };
  }

  function retryAllPending() {
    var pending = getAllPending();
    var sb = window.HHP_Auth && window.HHP_Auth.supabase;
    var user = window.HHP_Auth && window.HHP_Auth.currentUser;
    if (!sb || !user) return Promise.resolve([]);
    return Promise.all(pending.map(function(p) {
      // The stored payload was already assembled — pop in fresh sb/user and run.
      var payload = Object.assign({}, p.data, { sb: sb, user: user, pendingKey: p.id });
      return runSubmissionPipeline(payload);
    }));
  }

  // ────────────────────────────────────────────────────────────────────────
  //  Public API
  // ────────────────────────────────────────────────────────────────────────
  window.HHP_Report = {
    savePending: savePending,
    clearPending: clearPending,
    getAllPending: getAllPending,
    runSubmissionPipeline: runSubmissionPipeline,
    renderRecoveryBanner: renderRecoveryBanner,
    retryAllPending: retryAllPending,
    uploadMediaParallel: uploadMediaParallel,
    _withTimeout: withTimeout
  };
})();
