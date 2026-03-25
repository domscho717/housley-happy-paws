/**
 * Realtime Manager + Cache Manager for Housley Happy Paws
 * Provides: instant data loading, real-time updates, in-memory caching
 */
(function() {
  'use strict';

  // ════════════════════════════════════════
  //  CACHE MANAGER — In-memory data cache
  // ════════════════════════════════════════
  var _cache = {};
  var _cacheTTL = {};

  window.HHP_Cache = {
    get: function(key) {
      if (_cache[key] && _cacheTTL[key] > Date.now()) return _cache[key];
      if (_cacheTTL[key] && _cacheTTL[key] <= Date.now()) { delete _cache[key]; delete _cacheTTL[key]; }
      return null;
    },
    set: function(key, data, ttlMs) {
      _cache[key] = data;
      _cacheTTL[key] = Date.now() + (ttlMs || 60000);
    },
    invalidate: function(keyPrefix) {
      Object.keys(_cache).forEach(function(k) {
        if (k.indexOf(keyPrefix) === 0) { delete _cache[k]; delete _cacheTTL[k]; }
      });
    },
    clear: function() { _cache = {}; _cacheTTL = {}; },

    // Cached Supabase query helper
    query: async function(table, opts) {
      opts = opts || {};
      var key = table + ':' + JSON.stringify(opts);
      var cached = this.get(key);
      if (cached) return cached;

      var sb = window.HHP_Auth && window.HHP_Auth.supabase;
      if (!sb) return null;

      var q = sb.from(table).select(opts.select || '*');
      if (opts.eq) Object.keys(opts.eq).forEach(function(k) { q = q.eq(k, opts.eq[k]); });
      if (opts.in) Object.keys(opts.in).forEach(function(k) { q = q.in(k, opts.in[k]); });
      if (opts.gte) Object.keys(opts.gte).forEach(function(k) { q = q.gte(k, opts.gte[k]); });
      if (opts.lte) Object.keys(opts.lte).forEach(function(k) { q = q.lte(k, opts.lte[k]); });
      if (opts.or) q = q.or(opts.or);
      if (opts.order) q = q.order(opts.order.col, { ascending: !!opts.order.asc });
      if (opts.limit) q = q.limit(opts.limit);
      if (opts.count) q = sb.from(table).select(opts.select || '*', { count: 'exact', head: true });

      try {
        var res = await q;
        var data = opts.count ? (res.count || 0) : (res.data || []);
        this.set(key, data, opts.ttl || 45000);
        return data;
      } catch (e) {
        console.warn('Cache query error:', table, e);
        return opts.count ? 0 : [];
      }
    }
  };

  // ════════════════════════════════════════
  //  BATCH PRELOADER — Load all widget data in parallel
  // ════════════════════════════════════════
  window.HHP_Preload = {
    _loaded: {},

    // Preload all data needed for a portal's overview
    forPortal: async function(portal) {
      var sb = window.HHP_Auth && window.HHP_Auth.supabase;
      if (!sb) return;
      var user = window.HHP_Auth.currentUser;
      if (!user) return;

      var today = new Date().toISOString().split('T')[0];
      var now = new Date();
      var sow = new Date(now); sow.setDate(now.getDate() - now.getDay());
      var eow = new Date(sow); eow.setDate(sow.getDate() + 6);
      var ws = sow.toISOString().split('T')[0];
      var we = eow.toISOString().split('T')[0];

      var queries = [];

      if (portal === 'owner') {
        queries = [
          sb.from('booking_requests').select('*').order('created_at', { ascending: false }).limit(50),
          sb.from('messages').select('*').eq('is_alert', true).order('created_at', { ascending: false }).limit(10),
          sb.from('profiles').select('id,user_id,full_name,phone,pet_names,avatar_url').eq('role', 'client').order('full_name'),
          sb.from('profiles').select('id,full_name,is_active').eq('role', 'staff'),
          sb.from('deals').select('*').eq('is_active', true),
          sb.from('payments').select('amount,created_at,status').eq('status', 'succeeded').order('created_at', { ascending: false }).limit(10),
          sb.from('reviews').select('rating,comment,reviewer_name,created_at').order('created_at', { ascending: false }).limit(5),
          sb.from('pets').select('id,name,species,breed,photo_url,owner_id'),
        ];
      } else if (portal === 'staff') {
        queries = [
          sb.from('booking_requests').select('*').order('created_at', { ascending: false }).limit(50),
          sb.from('messages').select('*').or('sender_id.eq.' + user.id + ',recipient_id.eq.' + user.id).order('created_at', { ascending: false }).limit(10),
          sb.from('staff_assignments').select('client_id').eq('staff_id', user.id),
        ];
      } else if (portal === 'client') {
        queries = [
          sb.from('booking_requests').select('*').eq('client_id', user.id).order('created_at', { ascending: false }).limit(20),
          sb.from('messages').select('*').or('sender_id.eq.' + user.id + ',recipient_id.eq.' + user.id).order('created_at', { ascending: false }).limit(10),
          sb.from('pets').select('*').eq('owner_id', user.id),
          sb.from('payments').select('amount,created_at,status').eq('client_id', user.id).order('created_at', { ascending: false }).limit(10),
        ];
      }

      try {
        var results = await Promise.all(queries.map(function(q) {
          return q.then(function(r) { return r; }).catch(function(e) { return { data: [], error: e }; });
        }));

        // Cache results by table
        if (portal === 'owner') {
          HHP_Cache.set('booking_requests:all', results[0].data || [], 30000);
          HHP_Cache.set('messages:alerts', results[1].data || [], 30000);
          HHP_Cache.set('profiles:clients', results[2].data || [], 60000);
          HHP_Cache.set('profiles:staff', results[3].data || [], 60000);
          HHP_Cache.set('deals:active', results[4].data || [], 60000);
          HHP_Cache.set('payments:succeeded', results[5].data || [], 45000);
          HHP_Cache.set('reviews:recent', results[6].data || [], 60000);
          HHP_Cache.set('pets:all', results[7].data || [], 60000);
        } else if (portal === 'staff') {
          HHP_Cache.set('booking_requests:all', results[0].data || [], 30000);
          HHP_Cache.set('messages:mine', results[1].data || [], 30000);
          HHP_Cache.set('staff_assignments:mine', results[2].data || [], 60000);
        } else if (portal === 'client') {
          HHP_Cache.set('booking_requests:mine', results[0].data || [], 30000);
          HHP_Cache.set('messages:mine', results[1].data || [], 30000);
          HHP_Cache.set('pets:mine', results[2].data || [], 60000);
          HHP_Cache.set('payments:mine', results[3].data || [], 45000);
        }

        this._loaded[portal] = true;
      } catch (e) {
        console.warn('Preload error:', e);
      }
    },

    isLoaded: function(portal) { return !!this._loaded[portal]; }
  };

  // ════════════════════════════════════════
  //  REALTIME MANAGER — Supabase Realtime subscriptions
  // ════════════════════════════════════════
  var _channels = {};
  var _callbacks = {};

  window.HHP_Realtime = {
    init: function() {
      var sb = window.HHP_Auth && window.HHP_Auth.supabase;
      if (!sb) { setTimeout(function() { HHP_Realtime.init(); }, 2000); return; }

      // Subscribe to critical tables
      this._subscribe(sb, 'booking_requests');
      this._subscribe(sb, 'messages');
      this._subscribe(sb, 'deals');
      this._subscribe(sb, 'announcements');
      this._subscribe(sb, 'payments');
    },

    _subscribe: function(sb, table) {
      if (_channels[table]) return; // already subscribed
      try {
        var channel = sb.channel('realtime-' + table)
          .on('postgres_changes', { event: '*', schema: 'public', table: table }, function(payload) {
            HHP_Realtime._handleChange(table, payload);
          })
          .subscribe(function(status) {
            if (status === 'SUBSCRIBED') {
              console.log('[RT] Subscribed to', table);
            }
          });
        _channels[table] = channel;
      } catch (e) {
        console.warn('[RT] Subscribe error for', table, e);
      }
    },

    _handleChange: function(table, payload) {
      // Invalidate cache for this table
      HHP_Cache.invalidate(table);

      // Debounce: batch multiple rapid changes
      var self = this;
      if (self._debounce) clearTimeout(self._debounce);
      self._lastTable = table;
      self._debounce = setTimeout(function() {
        // Fire registered callbacks
        var cbs = _callbacks[table] || [];
        cbs.forEach(function(cb) {
          try { cb(payload); } catch (e) { console.warn('[RT] Callback error:', e); }
        });

        // Also fire wildcard callbacks
        var wcbs = _callbacks['*'] || [];
        wcbs.forEach(function(cb) {
          try { cb(table, payload); } catch (e) {}
        });
      }, 150); // 150ms debounce
    },

    // Register a callback for table changes
    on: function(table, callback) {
      if (!_callbacks[table]) _callbacks[table] = [];
      _callbacks[table].push(callback);
      return function() {
        _callbacks[table] = (_callbacks[table] || []).filter(function(cb) { return cb !== callback; });
      };
    },

    // Unsubscribe all channels (call on logout)
    destroy: function() {
      var sb = window.HHP_Auth && window.HHP_Auth.supabase;
      Object.keys(_channels).forEach(function(table) {
        try {
          if (sb) sb.removeChannel(_channels[table]);
        } catch (e) {}
      });
      _channels = {};
      _callbacks = {};
    }
  };

  // ════════════════════════════════════════
  //  SKELETON HELPERS — Generate loading placeholders
  // ════════════════════════════════════════
  window.HHP_Skeleton = {
    // Generic stat row (4 boxes)
    stats: function(n) {
      n = n || 4;
      var h = '<div class="sk-grid">';
      for (var i = 0; i < n; i++) h += '<div class="sk sk-stat"></div>';
      return h + '</div>';
    },
    // List of card placeholders
    cards: function(n) {
      n = n || 3;
      var h = '';
      for (var i = 0; i < n; i++) {
        h += '<div class="sk-row"><div class="sk sk-avatar"></div><div style="flex:1"><div class="sk sk-text w90"></div><div class="sk sk-text w60"></div></div></div>';
      }
      return h;
    },
    // Simple text lines
    lines: function(n) {
      n = n || 3;
      var h = '';
      var widths = ['w90', 'w60', 'w40', 'w100'];
      for (var i = 0; i < n; i++) h += '<div class="sk sk-text ' + widths[i % widths.length] + '"></div>';
      return h;
    },
    // Full card block
    block: function() {
      return '<div class="sk sk-card"></div><div class="sk sk-card"></div>';
    }
  };

  // ════════════════════════════════════════
  //  AUTO-INIT — Start when auth is ready
  // ════════════════════════════════════════
  function _initWhenReady() {
    if (window.HHP_Auth && window.HHP_Auth.currentUser) {
      HHP_Realtime.init();
      var portal = window.HHP_Auth.currentRole === 'owner' ? 'owner' :
                   window.HHP_Auth.currentRole === 'staff' ? 'staff' : 'client';
      HHP_Preload.forPortal(portal);
    }
  }

  // Hook into auth system (wait for onHHPAuthReady to be defined)
  function _tryHookAuth() {
    if (window.onHHPAuthReady) {
      window.onHHPAuthReady(_initWhenReady);
    } else if (window._hhpAuthReady) {
      _initWhenReady();
    } else {
      setTimeout(_tryHookAuth, 100);
    }
  }
  _tryHookAuth();
  // Fallback
  setTimeout(_initWhenReady, 3000);

})();
