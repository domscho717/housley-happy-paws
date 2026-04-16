/**
 * Recurring Invoices — Weekly Sunday Billing
 * Runs every Sunday at 8am EST via Vercel Cron.
 *
 * Flow:
 * 1. Look at the full week ahead (Sunday → Saturday)
 * 2. Find all accepted recurring bookings with service dates this week
 * 3. Group by client + service type (same client, same service = one charge)
 * 4. Charge saved card or send Stripe invoice with itemized description
 * 5. Log each service date to recurring_invoices to prevent double-billing
 *
 * Also supports first-week auto-charge:
 *   POST /api/recurring-invoices?firstWeek=true&bookingId=xxx
 *   Called when a recurring booking is approved after the Sunday cron already ran.
 *   Bills from today through Saturday of this week.
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { sendEmail, sendToRachel, escHtml, SITE_URL } = require('./_email');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: verify cron secret OR Bearer token (for first-week trigger from frontend)
  const authHeader = req.headers['authorization'] || '';
  const manualSecret = req.headers['x-cron-secret'];
  const envSecret = process.env.CRON_SECRET;
  const isFirstWeekTrigger = (req.query.firstWeek === 'true' || (req.body && req.body.firstWeek));
  const isCronAuth = envSecret && (authHeader === `Bearer ${envSecret}` || manualSecret === envSecret);

  if (!isCronAuth) {
    if (isFirstWeekTrigger) {
      // First-week trigger requires a valid user Bearer token (owner/staff only)
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized — missing token' });
      }
      const token = authHeader.replace('Bearer ', '');
      const supabaseAuth = createClient(
        process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
      );
      const { data: { user: authUser }, error: authErr } = await supabaseAuth.auth.getUser(token);
      if (authErr || !authUser) {
        return res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
      }
      // Verify caller is owner or staff
      const svcSupabase = createClient(
        process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
      );
      const { data: callerProfile } = await svcSupabase.from('profiles').select('role').eq('id', authUser.id).single();
      if (!callerProfile || (callerProfile.role !== 'owner' && callerProfile.role !== 'staff')) {
        return res.status(403).json({ error: 'Forbidden — only owner/staff can trigger first-week billing' });
      }
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  // ── Date helpers (Eastern time, auto-adjusts for DST) ──
  // IMPORTANT: All date window math uses date STRINGS (YYYY-MM-DD) to avoid
  // timezone double-conversion bugs. The server runs in UTC but we need EST dates.
  function estDateStr(d) {
    return (d || new Date()).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  }
  function fmtDateShort(dateStr) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric'
    });
  }
  // Add N days to a YYYY-MM-DD string, returns YYYY-MM-DD (timezone-safe)
  function addDaysStr(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00Z'); // noon UTC avoids DST edge
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  // Get day-of-week (0=Sun) from a YYYY-MM-DD string (timezone-safe)
  function dayOfWeekStr(dateStr) {
    return new Date(dateStr + 'T12:00:00Z').getUTCDay();
  }

  const todayEST = estDateStr(); // e.g. "2026-04-07"

  // ── Determine billing window ──
  const firstWeekBookingId = req.query.bookingId || (req.body && req.body.bookingId);
  const isFirstWeek = req.query.firstWeek === 'true' || (req.body && req.body.firstWeek);

  let weekStartStr, weekEndStr;

  if (isFirstWeek && firstWeekBookingId) {
    // First-week trigger: bill from today through this Saturday
    weekStartStr = todayEST;
    const dow = dayOfWeekStr(todayEST); // 0=Sun, 6=Sat
    const daysUntilSat = dow === 6 ? 0 : (6 - dow + 7) % 7;
    weekEndStr = addDaysStr(todayEST, daysUntilSat);
  } else {
    // Regular Sunday cron: this Sunday (today) through Saturday
    weekStartStr = todayEST;
    weekEndStr = addDaysStr(todayEST, 6);
  }

  // Build array of date strings for the billing window
  const weekDates = [];
  let cursorStr = weekStartStr;
  while (cursorStr <= weekEndStr) {
    weekDates.push(cursorStr);
    cursorStr = addDaysStr(cursorStr, 1);
  }

  const results = { processed: 0, charged: 0, skipped: 0, errors: [], weekDates };

  try {
    // ── Fetch recurring bookings ──
    let query = supabase
      .from('booking_requests')
      .select('*')
      .eq('status', 'accepted')
      .not('recurrence_pattern', 'is', null);

    // If first-week, only check the specific booking
    if (isFirstWeek && firstWeekBookingId) {
      query = query.eq('id', firstWeekBookingId);
    }

    const { data: bookings, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;
    if (!bookings || bookings.length === 0) {
      return res.status(200).json({ message: 'No recurring bookings found', ...results });
    }

    // ── First-week: seed recurring_invoices for initial booking date(s) ──
    // The acceptance charge already covers the first occurrence (preferred_date).
    // We must record it here so the Sunday cron doesn't double-bill.
    // NOTE: Always seed regardless of payment_intent_id — the acceptance flow
    // always charges the first occurrence, and the PI may not be committed yet.
    if (isFirstWeek && firstWeekBookingId) {
      for (const booking of bookings) {
        const initialDate = booking.preferred_date;
        if (initialDate) {
          await supabase.from('recurring_invoices').upsert({
            booking_request_id: booking.id,
            invoice_date: estDateStr(),
            service_date: initialDate,
            amount: booking.estimated_total || 0,
            service: booking.service,
            client_email: booking.contact_email,
            client_name: booking.contact_name,
            stripe_invoice_id: booking.payment_intent_id || 'acceptance_charge',
            status: 'paid',
          }, { onConflict: 'booking_request_id,service_date', ignoreDuplicates: true });
        }
      }
    }

    // ── Find all service dates this week per booking, group by client + service ──
    // Key: "clientEmail||serviceType" → { booking, entries: [{ booking, date, amount }] }
    const clientGroups = {};

// Batch-fetch ALL already-billed dates to avoid N*M per-date queries
    const bookingIds = bookings.map(b => b.id);
    const { data: allBilledRaw } = await supabase
      .from('recurring_invoices')
      .select('booking_request_id, service_date')
      .in('booking_request_id', bookingIds)
      .in('service_date', weekDates);
    const billedSet = new Set((allBilledRaw || []).map(r => r.booking_request_id + ':' + r.service_date));

        for (const booking of bookings) {
      results.processed++;
      const pattern = typeof booking.recurrence_pattern === 'string'
        ? JSON.parse(booking.recurrence_pattern)
        : booking.recurrence_pattern;
      if (!pattern) { results.skipped++; continue; }

      for (const dateStr of weekDates) {
        if (!checkIfDateIsRecurring(dateStr, pattern, booking)) continue;

        // Check if already billed for this booking + date
        // Check in-memory batch set instead of per-date DB query
        if (billedSet.has(booking.id + ':' + dateStr)) continue; // Already invoiced

        // Skip bookings with missing critical data
        if (!booking.contact_email || !booking.estimated_total || booking.estimated_total <= 0) continue;

        // Group by client email + service type
        const groupKey = (booking.contact_email || '').toLowerCase() + '||' + (booking.service || '');
        if (!clientGroups[groupKey]) {
          clientGroups[groupKey] = {
            clientEmail: booking.contact_email,
            clientName: booking.contact_name,
            clientId: booking.client_id,
            service: booking.service,
            entries: []
          };
        }
        clientGroups[groupKey].entries.push({
          booking,
          date: dateStr,
          amount: booking.estimated_total || 0,
          petNames: booking.pet_names || ''
        });
      }
    }

    // ── Charge each client group ──
    for (const [groupKey, group] of Object.entries(clientGroups)) {
      if (group.entries.length === 0) continue;

      try {
        const totalAmount = group.entries.reduce((sum, e) => sum + e.amount, 0);
        if (totalAmount <= 0) {
          results.skipped++;
          continue;
        }

        // Build itemized description
        // e.g. "Housley Happy Paws — Dog Walk (Sun Apr 12, Wed Apr 15, Sat Apr 18)"
        const dateList = group.entries.map(e => fmtDateShort(e.date)).join(', ');
        const allPets = [...new Set(group.entries.map(e => e.petNames).filter(Boolean))].join(', ');
        let description = `Housley Happy Paws — ${group.service} (${dateList})`;
        if (allPets) description += ` — Pets: ${allPets}`;

        // Charge or invoice
        const chargeResult = await chargeClient(stripe, supabase, {
          clientEmail: group.clientEmail,
          clientName: group.clientName,
          clientId: group.clientId,
          service: group.service,
          totalAmount,
          description,
          entries: group.entries,
          weekDates: weekDates
        });

        // Log each service date individually to recurring_invoices
        // Uses onConflict to prevent double-billing if cron runs twice
        for (const entry of group.entries) {
          await supabase.from('recurring_invoices').upsert({
            booking_request_id: entry.booking.id,
            invoice_date: estDateStr(),
            service_date: entry.date,
            amount: entry.amount,
            service: group.service,
            client_email: group.clientEmail,
            client_name: group.clientName,
            stripe_invoice_id: chargeResult.invoiceId || null,
            stripe_invoice_url: chargeResult.invoiceUrl || null,
            status: chargeResult.success ? 'sent' : 'failed',
            error_message: chargeResult.error || null,
          }, { onConflict: 'booking_request_id,service_date', ignoreDuplicates: true });
        }

        if (chargeResult.success) {
          // Log combined payment
          await supabase.from('payments').insert({
            stripe_session_id: chargeResult.invoiceId || null,
            client_email: group.clientEmail,
            client_name: group.clientName,
            client_id: group.clientId,
            amount: totalAmount,
            service: group.service,
            status: chargeResult.method === 'auto_charge' ? 'paid' : 'pending',
            notes: `Weekly recurring: ${group.service} × ${group.entries.length} (${dateList})`,
            paid_at: chargeResult.method === 'auto_charge' ? new Date().toISOString() : null,
          });
          results.charged++;

          // ── If card declined → invoice sent, notify client + owner ──
          if (chargeResult.method === 'invoice') {
            const safeName = escHtml(group.clientName || 'Client');
            const safeService = escHtml(group.service);
            const payLink = chargeResult.invoiceUrl || SITE_URL;
            const amountFmt = '$' + totalAmount.toFixed(2);

            // Build service date list HTML
            const dateListHTML = group.entries.map(e => {
              const d = new Date(e.date + 'T12:00:00');
              return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            }).join('<br>');

            // Email to client: card declined, here's how to pay
            try {
              await sendEmail({
                to: group.clientEmail,
                subject: `⚠️ Payment Declined — Action Needed — ${safeService} — Housley Happy Paws`,
                title: 'Payment Declined — Action Needed',
                bodyHTML: `
                  <p>Hi ${safeName}!</p>
                  <p>We tried to charge your card on file for your upcoming recurring <strong>${safeService}</strong> service, but the payment was <strong>declined</strong>.</p>
                  <div style="background:#fff3cd;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #ffc107">
                    <div style="font-weight:700;font-size:1.05rem;margin-bottom:8px">${safeService} — ${amountFmt}</div>
                    <div style="margin-bottom:8px">${dateListHTML}</div>
                    ${allPets ? `<div style="margin-bottom:4px">🐾 Pets: ${escHtml(allPets)}</div>` : ''}
                  </div>
                  <p><strong>We'll try your card again in about 12 hours.</strong> If that also fails, this week's services will be canceled automatically.</p>
                  <p>You can also pay now using the link below:</p>
                  <div style="margin:20px 0;text-align:center">
                    <a href="${payLink}" style="display:inline-block;padding:14px 32px;background:#c8963e;color:white;border-radius:8px;text-decoration:none;font-weight:700;font-size:1.05rem">Pay ${amountFmt} Now →</a>
                  </div>
                  <p>If you have questions or need to update your payment method, please don't hesitate to reach out.</p>
                  <p style="font-size:0.85rem;color:#8c6b4a;margin-top:16px">Questions? Reply to this email or call 717-715-7595</p>
                `,
              });
            } catch (emailErr) { console.error('[recurring] Decline email to client failed:', emailErr.message); }

            // Notify Rachel too
            try {
              await sendToRachel({
                subject: `⚠️ Recurring Payment Declined: ${safeName} — ${safeService}`,
                title: 'Recurring Payment Declined',
                bodyHTML: `
                  <p><strong>${safeName}</strong>'s card was declined for their recurring <strong>${safeService}</strong> (${amountFmt}).</p>
                  <div style="background:#fff3cd;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #ffc107">
                    <div style="font-weight:700;margin-bottom:8px">${safeService} — ${amountFmt}</div>
                    <div>${dateListHTML}</div>
                  </div>
                  <p>An invoice has been sent to the client. The system will retry in ~12 hours. If still unpaid by end of day, this week's services will be auto-canceled.</p>
                  <div style="margin-top:20px">
                    <a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#3d5a47;color:white;border-radius:8px;text-decoration:none;font-weight:700">View Dashboard →</a>
                  </div>
                `,
              });
            } catch (emailErr) { console.error('[recurring] Decline email to owner failed:', emailErr.message); }
          }
        } else {
          results.errors.push({ group: groupKey, error: chargeResult.error });
        }
      } catch (groupErr) {
        results.errors.push({ group: groupKey, error: groupErr.message });
      }
    }

    const weekLabel = `${weekStartStr} to ${weekEndStr}`;
    return res.status(200).json({
      message: `Weekly billing processed for ${weekLabel}`,
      ...results,
    });
  } catch (err) {
    console.error('Recurring invoices cron error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// Date matching
// ═══════════════════════════════════════════════════════════

function checkIfDateIsRecurring(dateStr, pattern, booking) {
  if (Array.isArray(booking.canceled_dates) && booking.canceled_dates.includes(dateStr)) {
    return false;
  }

  const targetDate = new Date(dateStr + 'T12:00:00');

  // Per-card format
  if (pattern.type === 'per_card' && Array.isArray(pattern.schedules)) {
    for (const schedule of pattern.schedules) {
      if (isDateInSchedule(dateStr, targetDate, schedule)) return true;
    }
    return false;
  }

  // Legacy format
  if (pattern.days && Array.isArray(pattern.days)) {
    const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const targetDay = targetDate.getDay();
    const matchesDay = pattern.days.some(d => dayMap[d] === targetDay);
    if (!matchesDay) return false;

    if (pattern.end_date) {
      const endDate = new Date(pattern.end_date + 'T23:59:59');
      if (targetDate > endDate) return false;
    }

    if (pattern.frequency === 'biweekly') {
      const startDate = new Date((booking.preferred_date || booking.scheduled_date) + 'T12:00:00');
      const daysDiff = Math.floor((targetDate - startDate) / (24 * 60 * 60 * 1000));
      if (daysDiff % 14 !== 0) return false;
    }

    return true;
  }

  return false;
}

function isDateInSchedule(dateStr, targetDate, schedule) {
  if (!schedule.start_date) return false;
  const startDate = new Date(schedule.start_date + 'T12:00:00');
  if (targetDate < startDate) return false;
  if (!schedule.ongoing && schedule.end_date) {
    const endDate = new Date(schedule.end_date + 'T23:59:59');
    if (targetDate > endDate) return false;
  }
  if (targetDate.getDay() !== startDate.getDay()) return false;
  const daysDiff = Math.floor((targetDate - startDate) / (24 * 60 * 60 * 1000));
  const interval = schedule.frequency === 'biweekly' ? 14 : 7;
  if (daysDiff % interval !== 0) return false;
  return true;
}

// ═══════════════════════════════════════════════════════════
// Stripe charging — tries saved card, falls back to invoice
// ═══════════════════════════════════════════════════════════

async function chargeClient(stripe, supabase, opts) {
  const { clientEmail, clientName, clientId, service, totalAmount, description, entries } = opts;

  try {
    if (totalAmount <= 0) {
      return { success: false, error: 'No amount to charge' };
    }

    // Find or create Stripe customer
    let customer;
    const existing = await stripe.customers.list({ email: clientEmail, limit: 1 });
    if (existing.data.length > 0) {
      customer = existing.data[0];
    } else {
      customer = await stripe.customers.create({
        email: clientEmail,
        name: clientName || undefined,
      });
    }

    // ── Try auto-charge saved card ──
    if (clientId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('user_id', clientId)
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
              amount: Math.round(totalAmount * 100),
              currency: 'usd',
              customer: profile.stripe_customer_id,
              payment_method: methods.data[0].id,
              off_session: true,
              confirm: true,
              description,
              metadata: {
                service,
                service_count: String(entries.length),
                service_dates: entries.map(e => e.date).join(','),
                recurring: 'true',
              },
            };

            const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
            if (connectedAccountId) {
              piParams.application_fee_amount = Math.round(totalAmount * 100 * 0.15);
              piParams.transfer_data = { destination: connectedAccountId };
            }

            const paymentIntent = await stripe.paymentIntents.create(piParams);

            if (paymentIntent.status === 'succeeded') {
              return {
                success: true,
                invoiceId: paymentIntent.id,
                invoiceUrl: null,
                method: 'auto_charge',
              };
            }
          } catch (chargeErr) {
            console.warn('Auto-charge failed, falling back to invoice:', chargeErr.message);
          }
        }
      }
    }

    // ── Fallback: send Stripe invoice with line items ──
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 3,
      metadata: {
        service,
        service_count: String(entries.length),
        recurring: 'true',
      },
    });

    // Add each service date as a line item so the invoice is itemized
    for (const entry of entries) {
      const dateFmt = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      });
      const pets = entry.petNames ? ` (${entry.petNames})` : '';
      await stripe.invoiceItems.create({
        customer: customer.id,
        invoice: invoice.id,
        amount: Math.round(entry.amount * 100),
        currency: 'usd',
        description: `${service} — ${dateFmt}${pets}`,
      });
    }

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(invoice.id);

    return {
      success: true,
      invoiceId: finalizedInvoice.id,
      invoiceUrl: finalizedInvoice.hosted_invoice_url,
      method: 'invoice',
    };
  } catch (err) {
    console.error('Charge error for', clientEmail, ':', err.message);
    return { success: false, error: err.message };
  }
}
