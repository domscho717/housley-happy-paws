/*  Housley Happy Paws — Stripe Client Integration
 *  This file handles all client-side Stripe operations.
 *  The Stripe publishable key is loaded from the owner's saved settings
 *  or from the data attribute on the script tag.
 */

const HHP_Stripe = {
  // Service pricing map (cents avoided — we send dollars to the API)
  pricing: {
    'House Sitting': 125,
    'Dog Walking (30min)': 22,
    'Dog Walking (60min)': 30,
    'Drop-In Visit (20min)': 18,
    'Drop-In Visit (40min)': 25,
    'Cat Care (20min)': 16,
    'Cat Care (40min)': 22,
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
   * Send a real Stripe invoice to a client
   */
  async sendInvoice({ clientName, clientEmail, service, amount, petNames, dueDate, notes }) {
    try {
      const resp = await fetch('/api/create-invoice-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          clientEmail,
          service,
          amount,
          petNames: petNames || '',
          dueDate: dueDate || '',
          notes: notes || '',
        }),
      });

      const data = await resp.json();

      if (data.success) {
        return data;
      } else {
        throw new Error(data.error || 'Failed to create invoice');
      }
    } catch (err) {
      console.error('Invoice error:', err);
      throw err;
    }
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
