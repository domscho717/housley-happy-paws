/**
 * Platform fee helpers — Housley Happy Paws
 *
 * WHAT THIS IS FOR
 * The 15% dev share is routed as a SEPARATE Stripe Transfer
 * (stripe.transfers.create with source_transaction), not as
 * application_fee_amount on the PaymentIntent. Verified working against the
 * live balance ledger on 27 Aug 2026 — every app-path charge back to March
 * has a matching transfer.
 *
 * The gap this file closes is narrower but real: when a transfer FAILS, the
 * old code caught the error, wrote one console line marked "(non-blocking)"
 * and moved on. The customer is charged, the fee never routes, and nothing
 * anywhere records it. A log line is not a record.
 *
 * DESIGN NOTE — deliberately does NOT block charges.
 * An earlier draft of this file threw when STRIPE_CONNECTED_ACCOUNT_ID was
 * missing, on the assumption it had been unset for months. That assumption was
 * wrong — the variable has been set since March. Refusing to charge over a
 * config problem would risk Rachel's revenue to protect a fee that is already
 * working, which is the wrong trade. So: log loudly, record durably, never
 * block the customer payment.
 */

const PLATFORM_FEE_PCT = 0.15;

/** Fee for an amount already in cents. */
function feeCents(amountCents) {
  return Math.round(amountCents * PLATFORM_FEE_PCT);
}

/**
 * The destination account for the dev share. Returns null (and shouts) if it
 * is missing, so the caller skips the transfer but still completes the charge.
 */
function getDestination(context) {
  const destination = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
  if (!destination) {
    console.error(
      '[platform-fee] STRIPE_CONNECTED_ACCOUNT_ID IS NOT SET — the ' +
      (PLATFORM_FEE_PCT * 100) + '% dev share will NOT route for this charge. ' +
      'The customer is still charged. context=' + context
    );
  }
  return destination || null;
}

/**
 * A transfer that fails after the customer has been charged cannot be undone
 * by refusing — the money is already taken. Record it where it can actually be
 * found and reconciled later, instead of only in a log line.
 *
 * Writes a [FEE-UNROUTED ...] marker onto the payments row. Find them with:
 *   SELECT * FROM payments WHERE notes ILIKE '%FEE-UNROUTED%';
 */
async function recordUnroutedFee(supabase, { paymentIntentId, amountCents, context, reason }) {
  const marker =
    '[FEE-UNROUTED $' + (amountCents / 100).toFixed(2) + ' pi=' + paymentIntentId +
    ' ctx=' + context + ' reason=' + (reason || 'unknown') + ']';

  console.error('[platform-fee] ' + marker);

  if (!supabase || !paymentIntentId) return;
  try {
    const { data } = await supabase
      .from('payments')
      .select('id, notes')
      .eq('stripe_session_id', paymentIntentId)
      .limit(1);

    if (data && data.length) {
      await supabase
        .from('payments')
        .update({ notes: ((data[0].notes || '') + ' ' + marker).trim() })
        .eq('id', data[0].id);
    }
  } catch (e) {
    console.error('[platform-fee] could not record unrouted fee on payments row:', e.message);
  }
}

module.exports = { PLATFORM_FEE_PCT, feeCents, getDestination, recordUnroutedFee };
