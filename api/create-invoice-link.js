const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const { clientName, clientEmail, service, amount, petNames, dueDate, notes } = req.body;

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
