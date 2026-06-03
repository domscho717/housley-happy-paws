/*  Housley Happy Paws — Stripe Client Integration
 *  This file handles all client-side Stripe operations.
 *  The Stripe publishable key is loaded from the owner's saved settings
 *  or from the data attribute on the script tag.
 */

const HHP_Stripe = window.HHP_Stripe = {
  // Service pricing map (dollars) — kept in sync with booking-system.js SERVICE_PRICES
  // Actual price is calculated by booking form and passed to checkout; this is a fallback reference.
  pricing: {
    'Dog Walking - 30 min': 25,
    'Dog Walking - 60 min': 45,
    'Drop-In Visit - 30 min': 25,
    'Drop-In Visit - 40 min': 25,
    'Drop-In Visit (Cat) - 30 min': 20,
    'Drop-In Visit (Cat) - 40 min': 30,
    'Drop-In Visit (Cat) - 1 hour': 35,
    'House Sitting': 125,
  },

  /**
   * Create a Stripe Checkout session and redirect to payment
   */
  async checkout({ service, price, clientName, clientEmail, petNames, notes }) {
    try {
      const resp = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: service || 'Pet Care',
          price: price || 0,
          clientName: clientName || '',
          clientEmail: clientEmail || '',
          petNames: petNames || '',
          notes: notes || '',
        }),
      });

      const data = await resp.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      console.error('Stripe checkout error:', err);
      if (typeof toast === 'function') {
        toast('Payment error: ' + err.message);
      } else {
        alert('Payment error: ' + err.message);
      }
    }
  },

  /**
   * Send a real Stripe invoice to a client AND create a booking_requests row.
   * Uses /api/create-invoice-booking (the new combined endpoint).
   *
   * R4 #2: aggressive diagnostics — every step pushes a timestamped entry
   * into window.__hhp_invoice_debug so Rachel can read out exactly where
   * the flow stops. AbortController timeout dropped to 20s with a
   * specific "Stripe may have succeeded" message on abort. Throws errors
   * carry a `.debugLog` array attached for the caller to surface in the UI.
   */
  async sendInvoice({ clientName, clientEmail, service, amount, petNames, dueDate, serviceDate, endDate, notes }) {
    window.__hhp_invoice_debug = window.__hhp_invoice_debug || [];
    const dbg = [];
    function _log(step, extra) {
      const entry = { t: new Date().toISOString(), step: step };
      if (extra !== undefined) entry.detail = extra;
      dbg.push(entry);
      window.__hhp_invoice_debug.push(entry);
      // Trim global log so we don't leak memory.
      if (window.__hhp_invoice_debug.length > 200) window.__hhp_invoice_debug.shift();
      try { console.log('[sendInvoice]', step, extra !== undefined ? extra : ''); } catch (_) {}
    }
    function _decorate(err) {
      if (err && !err.debugLog) err.debugLog = dbg.slice();
      return err;
    }
    _log('entered', { clientName: clientName, clientEmail: clientEmail, amount: amount });

    const sb = window.HHP_Auth && window.HHP_Auth.supabase;
    if (!sb) { _log('no_sb'); throw _decorate(new Error('Not signed in — refresh and try again.')); }

    // Grab the current token; if it's missing or about to expire, refresh once.
    let token = '';
    try {
      _log('getSession_start');
      const { data: { session } } = await sb.auth.getSession();
      token = session && session.access_token ? session.access_token : '';
      _log('getSession_done', { hasToken: !!token });
      if (!token) {
        _log('refreshSession_start');
        const refreshed = await sb.auth.refreshSession();
        token = refreshed && refreshed.data && refreshed.data.session ? refreshed.data.session.access_token : '';
        _log('refreshSession_done', { hasToken: !!token });
      }
    } catch (sessErr) {
      _log('session_error', { message: sessErr && sessErr.message });
      throw _decorate(new Error('Could not read your login session. Please refresh and sign in again.'));
    }
    if (!token) { _log('no_token'); throw _decorate(new Error('Your session expired. Refresh the page and sign in again.')); }

    // AbortController — 20s (R4 #2). If the server is going to die, it
    // usually does so within the first 10s anyway (Vercel Hobby plan limit).
    const ctrl = new AbortController();
    const timeoutMs = 20000;
    const timeoutId = setTimeout(function() { ctrl.abort(); }, timeoutMs);

    let resp;
    try {
      _log('fetch_start', { url: '/api/create-invoice-booking', timeoutMs: timeoutMs });
      resp = await fetch('/api/create-invoice-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          clientName,
          clientEmail,
          service,
          amount,
          petNames: petNames || '',
          dueDate: dueDate || '',
          serviceDate: serviceDate || '',
          endDate: endDate || '',
          notes: notes || '',
        }),
        signal: ctrl.signal,
      });
      _log('fetch_returned', { status: resp.status, ok: resp.ok });
    } catch (netErr) {
      clearTimeout(timeoutId);
      if (netErr.name === 'AbortError') {
        _log('fetch_aborted_timeout', { timeoutMs: timeoutMs });
        const e = new Error('Invoice request timed out after ' + Math.round(timeoutMs / 1000) + 's. The Stripe call may have actually succeeded — check the Stripe dashboard before retrying. Reload the page to confirm.');
        e.timeout = true;
        throw _decorate(e);
      }
      _log('fetch_threw', { message: netErr && netErr.message, name: netErr && netErr.name });
      throw _decorate(new Error('Network error — could not reach the invoice service: ' + (netErr && netErr.message || 'unknown')));
    }
    clearTimeout(timeoutId);

    let data = {};
    try {
      _log('parse_start');
      data = await resp.json();
      _log('parse_done', { hasSuccess: !!(data && data.success), hasError: !!(data && data.error) });
    } catch (parseErr) {
      _log('parse_error', { message: parseErr && parseErr.message });
    }

    if (!resp.ok) {
      const msg = (data && (data.error || data.message)) || ('Invoice service returned ' + resp.status);
      _log('http_error', { status: resp.status, message: msg, bookingCreated: !!(data && data.bookingCreated) });
      const e = new Error(msg);
      e.bookingId = data && data.bookingId || null;
      e.bookingCreated = data && data.bookingCreated || false;
      throw _decorate(e);
    }
    if (!data.success) {
      _log('non_success_body', { data: data });
      throw _decorate(new Error(data.error || 'Invoice creation failed — see console + window.__hhp_invoice_debug.'));
    }
    _log('done', { bookingId: data.bookingId, amountDue: data.amountDue });
    return data;
  },

  /**
   * Fetch payment history (for owner portal or client portal)
   */
  async getPayments({ email, limit } = {}) {
    try {
      const params = new URLSearchParams();
      if (email) params.set('email', email);
      if (limit) params.set('limit', limit);

      const resp = await fetch(`/api/payments?${params}`);
      const data = await resp.json();
      return data.payments || [];
    } catch (err) {
      console.error('Failed to load payments:', err);
      return [];
    }
  },

  /**
   * Check URL params for payment success/cancel redirect
   */
  checkPaymentResult() {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');

    if (payment === 'success') {
      setTimeout(() => {
        if (typeof toast === 'function') {
          toast('Payment received! Thank you so much! Rachel will confirm your booking shortly.');
        }
      }, 500);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      return 'success';
    } else if (payment === 'cancelled') {
      setTimeout(() => {
        if (typeof toast === 'function') {
          toast('Payment was cancelled. No worries — you can pay anytime!');
        }
      }, 500);
      window.history.replaceState({}, '', window.location.pathname);
      return 'cancelled';
    }
    return null;
  },
};

// Auto-check payment result on page load
document.addEventListener('DOMContentLoaded', () => {
  HHP_Stripe.checkPaymentResult();
});
