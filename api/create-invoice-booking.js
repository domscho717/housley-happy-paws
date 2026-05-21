/**
 * Create Invoice + Booking — owner-side admin endpoint.
 *
 * The classic /api/create-invoice-link flow created a Stripe invoice but
 * never created a corresponding booking_requests row. Rachel asked for a
 * combined flow: when she sends an invoice, the booking should appear on
 * her calendar / dashboard / per-client history immediately.
 *
 * Flow:
 *   1. Auth check (owner/staff bearer token)
 *   2. Resolve / create the client profile (so we have a client_id)
 *   3. Insert booking_requests row with status='accepted'
 *   4. Create Stripe customer (or reuse), invoice, finalize, send
 *   5. Link invoice id to booking_requests.payment_intent_id
 *   6. Return { bookingId, invoiceUrl, amountDue }
 *
 * Notes:
 *   - We mark the booking as 'accepted' (not 'pending') because Rachel is
 *     unilaterally sending the invoice — there's no pending review step.
 *   - The Stripe invoice 'id' is stored in payment_intent_id (yes, the
 *     column is mis-named, but the rest of the codebase already treats it
 *     as a "this booking has been billed" sentinel — both PIs and invoices
 *     count as billed).
 *   - The 15% platform-fee transfer happens via webhook on
 *     invoice.payment_succeeded — same pattern as create-invoice-link.js.
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.housleyhappypaws.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.replace('Bearer ', '');

  const supabaseUrl = process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co';
  const supabaseAuth = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY);
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing' });
  }
  const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Role gate: owner/staff only.
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!callerProfile || (callerProfile.role !== 'owner' && callerProfile.role !== 'staff')) {
    return res.status(403).json({ error: 'Forbidden: owner or staff access required' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe is not configured' });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const {
    clientName, clientEmail, service, amount,
    petNames, dueDate, serviceDate, endDate, notes,
  } = req.body || {};

  if (!clientEmail || !amount || !service) {
    return res.status(400).json({ error: 'Missing required fields: clientEmail, amount, service' });
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  let bookingId = null;

  try {
    // ── Resolve client_id (best-effort; nullable if profile not found) ──
    let clientId = null;
    try {
      const lowerEmail = String(clientEmail).toLowerCase();
      const { data: existingProf } = await supabase
        .from('profiles')
        .select('user_id')
        .ilike('email', lowerEmail)
        .maybeSingle();
      if (existingProf && existingProf.user_id) clientId = existingProf.user_id;
    } catch (e) { /* leave clientId null — the booking row still works */ }

    // ── Insert booking_requests FIRST so the booking exists even if Stripe is slow ──
    // Status starts as 'invoice_sent' (Round 3 brief): the owner has proposed
    // the booking but the client hasn't formally accepted yet. They'll see it
    // in their portal with an "Accept invoice" button. Once they pay the
    // Stripe invoice OR tap Accept, the status moves to 'accepted'.
    const isHouseSitting = service && service.toLowerCase().indexOf('house sitting') !== -1;
    const bookingPayload = {
      contact_name: clientName || null,
      contact_email: clientEmail,
      service: service,
      pet_names: petNames || null,
      preferred_date: serviceDate || null,
      preferred_end_date: isHouseSitting ? (endDate || null) : null,
      estimated_total: amount,
      status: 'invoice_sent',
      admin_notes: 'Created via owner-side invoice flow' + (notes ? ': ' + notes : ''),
      client_id: clientId,
      scheduled_date: serviceDate || null,
    };
    const { data: bookingRow, error: bookingErr } = await supabase
      .from('booking_requests')
      .insert(bookingPayload)
      .select('id')
      .single();
    if (bookingErr) {
      console.error('[create-invoice-booking] booking insert failed:', bookingErr);
      return res.status(500).json({ error: 'Failed to create booking row: ' + bookingErr.message });
    }
    bookingId = bookingRow.id;

    // ── Stripe customer (reuse by email) ──
    let customer;
    const existingStripe = await stripe.customers.list({ email: clientEmail, limit: 1 });
    if (existingStripe.data.length > 0) {
      customer = existingStripe.data[0];
    } else {
      customer = await stripe.customers.create({
        email: clientEmail,
        name: clientName || undefined,
        metadata: { petNames: petNames || '', bookingRequestId: bookingId },
      });
    }

    // ── Create invoice, line item, finalize, send ──
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: dueDate ? Math.max(1, Math.ceil((new Date(dueDate) - Date.now()) / 86400000)) : 7,
      metadata: {
        service,
        petNames: petNames || '',
        notes: notes || '',
        clientName: clientName || '',
        serviceDate: serviceDate || '',
        endDate: endDate || '',
        bookingRequestId: bookingId,
        source: 'owner_invoice_booking',
      },
    });

    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: Math.round(amount * 100),
      currency: 'usd',
      description: `Housley Happy Paws — ${service}${petNames ? ' (Pets: ' + petNames + ')' : ''}`,
    });

    const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
    if (connectedAccountId) {
      await stripe.invoices.update(invoice.id, {
        metadata: {
          ...invoice.metadata,
          platform_fee_pct: '15',
          connected_account: connectedAccountId,
        },
      });
    }

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(invoice.id);

    // ── Link invoice back onto the booking (payment_intent_id column is the
    // canonical "this booking has been billed" sentinel — invoice id works
    // there too, same as the existing create-invoice-link flow upstream).
    try {
      await supabase
        .from('booking_requests')
        .update({ payment_intent_id: invoice.id })
        .eq('id', bookingId);
    } catch (linkErr) {
      // Booking row already exists; payment_intent_id link failure is
      // non-fatal but worth logging loudly.
      console.error('[create-invoice-booking] could not link invoice to booking:', linkErr);
    }

    return res.status(200).json({
      success: true,
      bookingId,
      invoiceId: finalizedInvoice.id,
      invoiceUrl: finalizedInvoice.hosted_invoice_url,
      invoicePdf: finalizedInvoice.invoice_pdf,
      amountDue: finalizedInvoice.amount_due / 100,
    });
  } catch (err) {
    console.error('[create-invoice-booking] failed:', err.message, err.code || '');
    // If we managed to create the booking but Stripe blew up, the booking
    // is still useful — Rachel can resend manually. We surface this in the
    // error response so the UI can mention it.
    return res.status(500).json({
      error: err.message || 'Invoice creation failed',
      bookingId,
      bookingCreated: !!bookingId,
    });
  }
};
