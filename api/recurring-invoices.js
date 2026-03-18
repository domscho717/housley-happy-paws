/**
 * Recurring Invoices Cron Job
 * Runs daily via Vercel Cron — checks for recurring appointments happening TOMORROW
 * and sends a Stripe invoice for each one the day before.
 *
 * Flow:
 * 1. Query all accepted booking_requests that have a recurrence_pattern
 * 2. For each, calculate if tomorrow is one of the recurring dates
 * 3. Check recurring_invoices table to avoid double-billing
 * 4. Send Stripe invoice and log it
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // Allow manual trigger via POST or cron via GET
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret (Vercel sets this automatically for cron jobs)
  // Also allow manual trigger with a secret header
  const cronSecret = req.headers['authorization'];
  const manualSecret = req.headers['x-cron-secret'];
  const envSecret = process.env.CRON_SECRET;

  // In production, verify the secret. Skip for development.
  if (envSecret && cronSecret !== `Bearer ${envSecret}` && manualSecret !== envSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  // Tomorrow's date in YYYY-MM-DD
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const results = { processed: 0, invoiced: 0, skipped: 0, errors: [] };

  try {
    // Get all accepted booking requests that have recurring patterns
    const { data: bookings, error: fetchErr } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('status', 'accepted')
      .not('recurrence_pattern', 'is', null);

    if (fetchErr) throw fetchErr;
    if (!bookings || bookings.length === 0) {
      return res.status(200).json({ message: 'No recurring bookings found', ...results });
    }

    for (const booking of bookings) {
      results.processed++;

      try {
        const pattern = typeof booking.recurrence_pattern === 'string'
          ? JSON.parse(booking.recurrence_pattern)
          : booking.recurrence_pattern;

        if (!pattern) continue;

        // Calculate if tomorrow is a recurring date for this booking
        const isTomorrowAVisit = checkIfDateIsRecurring(tomorrowStr, pattern, booking);

        if (!isTomorrowAVisit) {
          results.skipped++;
          continue;
        }

        // Check if we already invoiced this booking for tomorrow
        const { data: existing } = await supabase
          .from('recurring_invoices')
          .select('id')
          .eq('booking_request_id', booking.id)
          .eq('service_date', tomorrowStr)
          .limit(1);

        if (existing && existing.length > 0) {
          results.skipped++;
          continue; // Already invoiced
        }

        // Send the Stripe invoice
        const invoiceResult = await sendStripeInvoice(stripe, supabase, booking, tomorrowStr);

        // Log to recurring_invoices table
        await supabase.from('recurring_invoices').insert({
          booking_request_id: booking.id,
          invoice_date: new Date().toISOString().split('T')[0],
          service_date: tomorrowStr,
          amount: booking.estimated_total || 0,
          service: booking.service,
          client_email: booking.contact_email,
          client_name: booking.contact_name,
          stripe_invoice_id: invoiceResult.invoiceId || null,
          stripe_invoice_url: invoiceResult.invoiceUrl || null,
          status: invoiceResult.success ? 'sent' : 'failed',
          error_message: invoiceResult.error || null,
        });

        if (invoiceResult.success) {
          results.invoiced++;
        } else {
          results.errors.push({
            bookingId: booking.id,
            error: invoiceResult.error,
          });
        }
      } catch (bookingErr) {
        results.errors.push({
          bookingId: booking.id,
          error: bookingErr.message,
        });
      }
    }

    return res.status(200).json({
      message: `Recurring invoices processed for ${tomorrowStr}`,
      ...results,
    });
  } catch (err) {
    console.error('Recurring invoices cron error:', err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Check if a given date falls on a recurring schedule
 */
function checkIfDateIsRecurring(dateStr, pattern, booking) {
  const targetDate = new Date(dateStr + 'T12:00:00');

  // New per-card format: { type: 'per_card', schedules: [...] }
  if (pattern.type === 'per_card' && Array.isArray(pattern.schedules)) {
    for (const schedule of pattern.schedules) {
      if (isDateInSchedule(dateStr, targetDate, schedule)) return true;
    }
    return false;
  }

  // Legacy format: { days: [...], frequency, end_date, time }
  if (pattern.days && Array.isArray(pattern.days)) {
    const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const targetDay = targetDate.getDay();
    const matchesDay = pattern.days.some(d => dayMap[d] === targetDay);
    if (!matchesDay) return false;

    // Check end date
    if (pattern.end_date) {
      const endDate = new Date(pattern.end_date + 'T23:59:59');
      if (targetDate > endDate) return false;
    }

    // Check frequency (biweekly: every other week from start)
    if (pattern.frequency === 'biweekly') {
      const startDate = new Date((booking.preferred_date || booking.scheduled_date) + 'T12:00:00');
      const weeksDiff = Math.round((targetDate - startDate) / (7 * 24 * 60 * 60 * 1000));
      if (weeksDiff % 2 !== 0) return false;
    }

    return true;
  }

  return false;
}

/**
 * Check if a date falls within a per-card schedule
 */
function isDateInSchedule(dateStr, targetDate, schedule) {
  if (!schedule.start_date) return false;

  const startDate = new Date(schedule.start_date + 'T12:00:00');

  // Must be on or after start date
  if (targetDate < startDate) return false;

  // Check end date (unless ongoing)
  if (!schedule.ongoing && schedule.end_date) {
    const endDate = new Date(schedule.end_date + 'T23:59:59');
    if (targetDate > endDate) return false;
  }

  // Must fall on the same day of week as the start date
  if (targetDate.getDay() !== startDate.getDay()) return false;

  // Check frequency interval
  const daysDiff = Math.round((targetDate - startDate) / (24 * 60 * 60 * 1000));
  const interval = schedule.frequency === 'biweekly' ? 14 : 7;
  if (daysDiff % interval !== 0) return false;

  return true;
}

/**
 * Send a Stripe invoice for a recurring appointment
 */
async function sendStripeInvoice(stripe, supabase, booking, serviceDate) {
  try {
    const amount = booking.estimated_total || 0;
    if (amount <= 0) {
      return { success: false, error: 'No amount to invoice' };
    }

    // Format the service date for display
    const dateFmt = new Date(serviceDate + 'T12:00:00')
      .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    // Find or create Stripe customer
    let customer;
    const existing = await stripe.customers.list({ email: booking.contact_email, limit: 1 });

    if (existing.data.length > 0) {
      customer = existing.data[0];
    } else {
      customer = await stripe.customers.create({
        email: booking.contact_email,
        name: booking.contact_name || undefined,
        metadata: { pet_names: booking.pet_names || '' },
      });
    }

    // Try to auto-charge saved card first
    if (booking.client_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('user_id', booking.client_id)
        .single();

      if (profile?.stripe_customer_id) {
        const methods = await stripe.paymentMethods.list({
          customer: profile.stripe_customer_id,
          type: 'card',
          limit: 1,
        });

        if (methods.data.length > 0) {
          // Auto-charge the card
          try {
            const paymentIntent = await stripe.paymentIntents.create({
              amount: Math.round(amount * 100),
              currency: 'usd',
              customer: profile.stripe_customer_id,
              payment_method: methods.data[0].id,
              off_session: true,
              confirm: true,
              description: `Housley Happy Paws — ${booking.service} (${dateFmt})`,
              metadata: {
                booking_request_id: booking.id,
                service_date: serviceDate,
                recurring: 'true',
              },
            });

            if (paymentIntent.status === 'succeeded') {
              // Log to payments table
              await supabase.from('payments').insert({
                stripe_session_id: paymentIntent.id,
                client_email: booking.contact_email,
                client_name: booking.contact_name,
                amount: amount,
                service: booking.service,
                status: 'paid',
                notes: `Recurring auto-charge for ${dateFmt}`,
                paid_at: new Date().toISOString(),
              });

              return {
                success: true,
                invoiceId: paymentIntent.id,
                invoiceUrl: null,
                method: 'auto_charge',
              };
            }
          } catch (chargeErr) {
            // Card failed (expired, declined, needs auth) — fall through to invoice
            console.warn('Auto-charge failed, falling back to invoice:', chargeErr.message);
          }
        }
      }
    }

    // Fallback: send a Stripe invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 1, // Due tomorrow (the day of service)
      metadata: {
        booking_request_id: booking.id,
        service: booking.service,
        service_date: serviceDate,
        recurring: 'true',
        pet_names: booking.pet_names || '',
      },
    });

    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: Math.round(amount * 100),
      currency: 'usd',
      description: `Housley Happy Paws — ${booking.service} on ${dateFmt}${booking.pet_names ? ' (Pets: ' + booking.pet_names + ')' : ''}`,
    });

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(invoice.id);

    return {
      success: true,
      invoiceId: finalizedInvoice.id,
      invoiceUrl: finalizedInvoice.hosted_invoice_url,
      method: 'invoice',
    };
  } catch (err) {
    console.error('Stripe invoice error for booking', booking.id, ':', err.message);
    return { success: false, error: err.message };
  }
}
