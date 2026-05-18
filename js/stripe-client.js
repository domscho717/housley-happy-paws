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
   * Send a real Stripe invoice to a client.
   * The /api/create-invoice-link endpoint requires an owner/staff bearer token —
   * a missing/stale token silently 401'd and looked like "the button does nothing".
   */
  async sendInvoice({ clientName, clientEmail, service, amount, petNames, dueDate, serviceDate, endDate, notes }) {
    const sb = window.HHP_Auth && window.HHP_Auth.supabase;
    if (!sb) throw new Error('Not signed in — refresh and try again.');

    // Grab the current token; if it's missing or about to expire, refresh once.
    let token = '';
    try {
      const { data: { session } } = await sb.auth.getSession();
      token = session && session.access_token ? session.access_token : '';
      if (!token) {
        const refreshed = await sb.auth.refreshSession();
        token = refreshed && refreshed.data && refreshed.data.session ? refreshed.data.session.access_token : '';
      }
    } catch (sessErr) {
      console.error('Invoice auth session error:', sessErr);
      throw new Error('Could not read your login session. Please refresh and sign in again.');
    }
    if (!token) throw new Error('Your session expired. Refresh the page and sign in again.');

    let resp;
    try {
      resp = await fetch('/api/create-invoice-link', {
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
      });
    } catch (netErr) {
      console.error('Invoice network error:', netErr);
      throw new Error('Network error — could not reach the invoice service.');
    }

    let data = {};
    try { data = await resp.json(); } catch (parseErr) { console.error('Invoice response parse error:', parseErr); }

    if (!resp.ok) {
      const msg = (data && data.error) ? data.error : ('Invoice service returned ' + resp.status);
      console.error('Invoice API error:', resp.status, data);
      throw new Error(msg);
    }
    if (!data.success) {
      console.error('Invoice API non-success:', data);
      throw new Error(data.error || 'Invoice creation failed — see console.');
    }
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
