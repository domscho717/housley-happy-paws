/**
 * Retry Recurring Charges — Sunday Evening Cleanup
 * Runs Sunday at 8pm EST via Vercel Cron.
 *
 * Flow:
 * 1. Find all recurring_invoices from today with status 'sent' (invoice fallback = card declined earlier)
 * 2. For each, check if the Stripe invoice has been paid manually by the client
 * 3. If not paid, retry auto-charge on saved card one more time
 * 4. If retry succeeds → mark as paid, void the invoice
 * 5. If retry fails AND still unpaid by this run → cancel this week's services
 *    (add dates to canceled_dates on booking, void invoice, notify client + owner)
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { sendEmail, sendToRachel, escHtml, SITE_URL } = require('./_email');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: verify cron secret
  const cronSecret = req.headers['authorization'];
  const manualSecret = req.headers['x-cron-secret'];
  const envSecret = process.env.CRON_SECRET;
  if (envSecret && cronSecret !== `Bearer ${envSecret}` && manualSecret !== envSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  function estDateStr() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  }

  const todayEST = estDateStr();
  const results = { retried: 0, paid: 0, canceled: 0, errors: [] };

  try {
    // ── Find all unpaid recurring invoices from today ──
    const { data: unpaidInvoices, error: fetchErr } = await supabase
      .from('recurring_invoices')
      .select('*, booking_requests!inner(id, client_id, contact_email, contact_name, service, pet_names, canceled_dates, recurrence_pattern, status)')
      .eq('invoice_date', todayEST)
      .in('status', ['sent', 'failed']);

    if (fetchErr) throw fetchErr;
    if (!unpaidInvoices || unpaidInvoices.length === 0) {
      return res.status(200).json({ message: 'No unpaid recurring invoices to retry', ...results });
    }

    // Group by client so we send one email per client, not per service date
    const clientGroups = {};

    for (const inv of unpaidInvoices) {
      const booking = inv.booking_requests;
      if (!booking || booking.status !== 'accepted') continue;

      results.retried++;

      // ── Step 1: Check if Stripe invoice was already paid manually ──
      let alreadyPaid = false;
      if (inv.stripe_invoice_id && inv.stripe_invoice_id.startsWith('in_')) {
        try {
          const stripeInv = await stripe.invoices.retrieve(inv.stripe_invoice_id);
          if (stripeInv.status === 'paid') {
            alreadyPaid = true;
            await supabase.from('recurring_invoices')
              .update({ status: 'paid' })
              .eq('id', inv.id);
            results.paid++;
            continue;
          }
        } catch (e) { console.warn('[retry] Invoice check error:', e.message); }
      }

      // ── Step 2: Try auto-charge one more time ──
      let retrySuccess = false;
      if (booking.client_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('stripe_customer_id')
          .eq('user_id', booking.client_id)
          .maybeSingle();

        if (profile?.stripe_customer_id) {
          const methods = await stripe.paymentMethods.list({
            customer: profile.stripe_customer_id,
            type: 'card',
            limit: 1,
          });

          if (methods.data.length > 0) {
            try {
              const piParams = {
                amount: Math.round(inv.amount * 100),
                currency: 'usd',
                customer: profile.stripe_customer_id,
                payment_method: methods.data[0].id,
                off_session: true,
                confirm: true,
                description: `Housley Happy Paws — ${booking.service} (${inv.service_date}) — Retry`,
                metadata: { service: booking.service, service_date: inv.service_date, recurring: 'true', retry: 'true' },
              };

              const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
              if (connectedAccountId) {
                piParams.application_fee_amount = Math.round(inv.amount * 100 * 0.15);
                piParams.transfer_data = { destination: connectedAccountId };
              }

              const paymentIntent = await stripe.paymentIntents.create(piParams);

              if (paymentIntent.status === 'succeeded') {
                retrySuccess = true;
                // Void the old invoice
                if (inv.stripe_invoice_id && inv.stripe_invoice_id.startsWith('in_')) {
                  try { await stripe.invoices.voidInvoice(inv.stripe_invoice_id); } catch (e) { /* already paid/voided */ }
                }
                // Update recurring_invoices
                await supabase.from('recurring_invoices')
                  .update({ status: 'paid', stripe_invoice_id: paymentIntent.id, error_message: null })
                  .eq('id', inv.id);
                // Update payment record
                await supabase.from('payments')
                  .update({ status: 'paid', paid_at: new Date().toISOString(), notes: 'Retry auto-charge succeeded' })
                  .eq('stripe_session_id', inv.stripe_invoice_id);
                results.paid++;
                continue;
              }
            } catch (chargeErr) {
              console.warn('[retry] Retry auto-charge failed:', chargeErr.message);
            }
          }
        }
      }

      // ── Step 3: Still unpaid — cancel this service date ──
      if (!retrySuccess && !alreadyPaid) {
        // Void the Stripe invoice
        if (inv.stripe_invoice_id && inv.stripe_invoice_id.startsWith('in_')) {
          try { await stripe.invoices.voidInvoice(inv.stripe_invoice_id); } catch (e) { /* already voided */ }
        }

        // Mark recurring_invoice as canceled
        await supabase.from('recurring_invoices')
          .update({ status: 'voided', error_message: 'Auto-canceled: payment failed after retry' })
          .eq('id', inv.id);

        // Add this date to canceled_dates on the booking
        const currentCanceled = Array.isArray(booking.canceled_dates) ? booking.canceled_dates : [];
        if (!currentCanceled.includes(inv.service_date)) {
          currentCanceled.push(inv.service_date);
          await supabase.from('booking_requests')
            .update({ canceled_dates: currentCanceled })
            .eq('id', booking.id);
        }

        // Update payment record
        await supabase.from('payments')
          .update({ status: 'canceled', notes: 'Canceled: payment declined after retry' })
          .eq('stripe_session_id', inv.stripe_invoice_id);

        results.canceled++;

        // Group for notification
        const key = (booking.contact_email || '').toLowerCase();
        if (!clientGroups[key]) {
          clientGroups[key] = {
            email: booking.contact_email,
            name: booking.contact_name,
            clientId: booking.client_id,
            canceledServices: [],
          };
        }
        clientGroups[key].canceledServices.push({
          service: booking.service,
          date: inv.service_date,
          amount: inv.amount,
          petNames: booking.pet_names,
        });
      }
    }

    // ── Send cancellation notifications ──
    for (const [, group] of Object.entries(clientGroups)) {
      if (group.canceledServices.length === 0) continue;

      const safeName = escHtml(group.name || 'Client');
      const totalLost = group.canceledServices.reduce((s, c) => s + Number(c.amount), 0);

      const serviceListHTML = group.canceledServices.map(c => {
        const d = new Date(c.date + 'T12:00:00');
        const dateFmt = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        return `<div style="padding:8px 0;border-bottom:1px solid #eee"><strong>${escHtml(c.service)}</strong> — ${dateFmt} — $${Number(c.amount).toFixed(2)}${c.petNames ? ' (🐾 ' + escHtml(c.petNames) + ')' : ''}</div>`;
      }).join('');

      // Email to client: services canceled
      try {
        await sendEmail({
          to: group.email,
          subject: `❌ Recurring Services Canceled — Payment Issue — Housley Happy Paws`,
          title: 'Recurring Services Canceled This Week',
          bodyHTML: `
            <p>Hi ${safeName},</p>
            <p>Unfortunately, we were unable to process your payment after two attempts. The following recurring services for this week have been <strong>canceled</strong>:</p>
            <div style="background:#fef2f2;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #c62828">
              ${serviceListHTML}
            </div>
            <p><strong>Your recurring schedule is still active</strong> — next week's services will be charged as normal on Sunday. If your card issue is resolved by then, no action is needed.</p>
            <p>To update your payment method or if you have any questions, please reach out to us.</p>
            <div style="margin-top:20px;text-align:center">
              <a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#3d5a47;color:white;border-radius:8px;text-decoration:none;font-weight:700">Visit Your Portal →</a>
            </div>
            <p style="font-size:0.85rem;color:#8c6b4a;margin-top:16px">Questions? Reply to this email or call 717-715-7595</p>
          `,
        });
      } catch (e) { console.error('[retry] Client cancel email failed:', e.message); }

      // In-app notification
      if (group.clientId) {
        try {
          const svcList = group.canceledServices.map(c => c.service).join(', ');
          await supabase.from('messages').insert({
            sender_id: null,
            sender_name: 'Housley Happy Paws',
            recipient_id: group.clientId,
            body: `❌ Your recurring services (${svcList}) for this week were canceled due to a payment issue. Your schedule is still active for next week.`,
            is_alert: true,
          });
        } catch (e) { console.error('[retry] In-app notification failed:', e.message); }
      }

      // Notify Rachel
      try {
        await sendToRachel({
          subject: `❌ Recurring Services Canceled: ${safeName} — Payment Failed`,
          title: 'Recurring Services Auto-Canceled',
          bodyHTML: `
            <p><strong>${safeName}</strong>'s payment failed after the retry attempt. The following services have been auto-canceled for this week:</p>
            <div style="background:#fef2f2;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #c62828">
              ${serviceListHTML}
            </div>
            <p>The recurring schedule is still active. Next week's charge will be attempted as normal.</p>
            <div style="margin-top:20px">
              <a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#3d5a47;color:white;border-radius:8px;text-decoration:none;font-weight:700">View Dashboard →</a>
            </div>
          `,
        });
      } catch (e) { console.error('[retry] Owner cancel email failed:', e.message); }
    }

    return res.status(200).json({
      message: `Retry completed for ${todayEST}`,
      ...results,
    });
  } catch (err) {
    console.error('[retry-recurring] Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
