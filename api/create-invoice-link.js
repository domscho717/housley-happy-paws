const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authentication check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.replace('Bearer ', '');
  const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is owner or staff
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile || (profile.role !== 'owner' && profile.role !== 'staff')) {
    return res.status(403).json({ error: 'Forbidden: owner or staff access required' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY.' });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const { clientName, clientEmail, service, amount, petNames, dueDate, serviceDate, endDate, notes } = req.body || {};

    if (!clientEmail || !amount || !service) {
      return res.status(400).json({ error: 'Missing required fields: clientEmail, amount, service' });
    }

    // Find or create customer
    let customer;
    const existing = await stripe.customers.list({ email: clientEmail, limit: 1 });

    if (existing.data.length > 0) {
      customer = existing.data[0];
    } else {
      customer = await stripe.customers.create({
        email: clientEmail,
        name: clientName || undefined,
        metadata: { petNames: petNames || '' },
      });
    }

    // Create an invoice
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
        source: 'owner_invoice',
      },
    });

    // Add the line item
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: Math.round(amount * 100), // cents
      currency: 'usd',
      description: `Housley Happy Paws — ${service}${petNames ? ' (Pets: ' + petNames + ')' : ''}`,
    });

    // Apply 15% platform fee via transfer after payment if connected account configured
    const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
    if (connectedAccountId) {
      // Store fee info in metadata — webhook will handle the transfer on payment
      await stripe.invoices.update(invoice.id, {
        metadata: {
          ...invoice.metadata,
          platform_fee_pct: '15',
          connected_account: connectedAccountId,
        },
      });
    }

    // Finalize and send
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(invoice.id);

    res.status(200).json({
      success: true,
      invoiceId: finalizedInvoice.id,
      invoiceUrl: finalizedInvoice.hosted_invoice_url,
      invoicePdf: finalizedInvoice.invoice_pdf,
      amountDue: finalizedInvoice.amount_due / 100,
    });
  } catch (err) {
    console.error('Invoice creation error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
