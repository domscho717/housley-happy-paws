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
const { sendEmail, escHtml, fmt12, SITE_URL } = require('./_email');

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
    const t0 = Date.now();
    const isHouseSitting = service && service.toLowerCase().indexOf('house sitting') !== -1;
    const lowerEmail = String(clientEmail).toLowerCase();
    const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
    const invoiceMetadataBase = {
      service,
      petNames: petNames || '',
      notes: notes || '',
      clientName: clientName || '',
      serviceDate: serviceDate || '',
      endDate: endDate || '',
      source: 'owner_invoice_booking',
    };
    if (connectedAccountId) {
      invoiceMetadataBase.platform_fee_pct = '15';
      invoiceMetadataBase.connected_account = connectedAccountId;
    }

    // ── PARALLEL phase 1 (R4 #2): client_id lookup + Stripe customer lookup
    //   are independent — fire them together. Saves ~300-500ms vs sequential.
    const profileLookup = supabase
      .from('profiles')
      .select('user_id')
      .ilike('email', lowerEmail)
      .maybeSingle()
      .then(r => r.data && r.data.user_id || null)
      .catch(() => null);

    const customerLookup = stripe.customers.list({ email: clientEmail, limit: 1 })
      .then(r => r.data && r.data[0] || null)
      .catch(err => { console.warn('[create-invoice-booking] customer list failed:', err.message); return null; });

    const [clientId, existingCustomer] = await Promise.all([profileLookup, customerLookup]);
    console.log(`[create-invoice-booking] phase1 (${Date.now() - t0}ms)`);

    // ── Insert booking_requests with status='invoice_sent' so the row
    //   exists even if Stripe blows up. The client portal shows an
    //   Accept Invoice button on this state.
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
    console.log(`[create-invoice-booking] booking inserted (${Date.now() - t0}ms)`);

    // ── Stripe customer: reuse or create (now that we have bookingId for metadata).
    let customer = existingCustomer;
    if (!customer) {
      customer = await stripe.customers.create({
        email: clientEmail,
        name: clientName || undefined,
        metadata: { petNames: petNames || '', bookingRequestId: bookingId },
      });
    }

    // ── Invoice create — connected-account metadata is included up front
    //   (R4 #2), removing the previous extra stripe.invoices.update round-trip.
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: dueDate ? Math.max(1, Math.ceil((new Date(dueDate) - Date.now()) / 86400000)) : 7,
      metadata: Object.assign({}, invoiceMetadataBase, { bookingRequestId: bookingId }),
    });
    console.log(`[create-invoice-booking] invoice created (${Date.now() - t0}ms)`);

    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: Math.round(amount * 100),
      currency: 'usd',
      description: `Housley Happy Paws — ${service}${petNames ? ' (Pets: ' + petNames + ')' : ''}`,
    });

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(invoice.id);
    console.log(`[create-invoice-booking] invoice sent (${Date.now() - t0}ms)`);

    // ── PARALLEL phase 2: link payment_intent_id on the booking AND fire
    //   the companion booking email (R4 #7). Both are independent of the
    //   response we're about to send and of each other.
    const linkPromise = supabase
      .from('booking_requests')
      .update({ payment_intent_id: invoice.id })
      .eq('id', bookingId)
      .then(() => null)
      .catch(linkErr => { console.error('[create-invoice-booking] link failed:', linkErr); return linkErr; });

    const companionEmailPromise = (async () => {
      try {
        const safeName = escHtml(clientName || 'there');
        const safeService = escHtml(service || 'Pet Care');
        const safePets = escHtml(petNames || '');
        const safeNotes = escHtml(notes || '');
        const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
        const startFmt = fmtDate(serviceDate);
        const endFmt = endDate && endDate !== serviceDate ? fmtDate(endDate) : '';
        const dateLine = startFmt ? (endFmt ? startFmt + ' → ' + endFmt : startFmt) : 'TBD';
        const invoiceUrl = finalizedInvoice.hosted_invoice_url || '';
        const amountStr = '$' + Number(amount).toFixed(2);
        const bodyHTML = `
          <p>Hi ${safeName.split(' ')[0] || 'there'},</p>
          <p>Rachel has sent you an invoice for the following booking. Tap <strong>Pay Invoice</strong> below to settle up — once paid, the booking is fully confirmed.</p>
          <div style="background:#eef4ef;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #3d5a47">
            <div style="font-weight:700;font-size:1.05rem;margin-bottom:8px">${safeService}</div>
            <div style="margin-bottom:4px">📅 ${escHtml(dateLine)}</div>
            ${(serviceDate && !endFmt) ? '<div style="margin-bottom:4px">⏰ Service time will be set with Rachel</div>' : ''}
            ${safePets ? `<div style="margin-bottom:4px">🐾 Pets: ${safePets}</div>` : ''}
            <div style="margin-bottom:4px">💰 <strong>${amountStr}</strong> due</div>
          </div>
          ${safeNotes ? `<div style="background:#fdf7ee;border-radius:10px;padding:14px;margin:16px 0;font-style:italic;color:#5c3d1e">${safeNotes}</div>` : ''}
          ${invoiceUrl ? `<p style="margin:18px 0"><a href="${invoiceUrl}" style="display:inline-block;padding:14px 28px;background:#c8963e;color:#fff;border-radius:10px;text-decoration:none;font-weight:700">💳 Pay Invoice — ${amountStr}</a></p>` : ''}
          <p>You can also view this booking in your <a href="${SITE_URL}/?tab=appointments" style="color:#3d5a47;font-weight:600">client portal</a>.</p>
          <p style="font-size:0.82rem;color:#8c6b4a;margin-top:18px">Questions? Reply to this email or text Rachel at 717-715-7595.</p>
        `;
        return await sendEmail({
          to: clientEmail,
          subject: 'Your booking + invoice from Housley Happy Paws',
          title: 'Booking confirmed — please pay',
          bodyHTML,
        });
      } catch (mailErr) {
        console.error('[create-invoice-booking] companion email failed:', mailErr.message);
        return { success: false, error: mailErr.message };
      }
    })();

    const [linkErr, mailResult] = await Promise.all([linkPromise, companionEmailPromise]);
    console.log(`[create-invoice-booking] phase2 done (${Date.now() - t0}ms total) mail=${mailResult && mailResult.success ? 'sent' : 'failed'} link=${linkErr ? 'failed' : 'ok'}`);

    return res.status(200).json({
      success: true,
      bookingId,
      invoiceId: finalizedInvoice.id,
      invoiceUrl: finalizedInvoice.hosted_invoice_url,
      invoicePdf: finalizedInvoice.invoice_pdf,
      amountDue: finalizedInvoice.amount_due / 100,
      companionEmailSent: !!(mailResult && mailResult.success),
      companionEmailError: mailResult && !mailResult.success ? (mailResult.error || 'unknown') : null,
      elapsedMs: Date.now() - t0,
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
