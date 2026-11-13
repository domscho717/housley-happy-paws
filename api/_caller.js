/**
 * R78 - who is calling this endpoint?
 *
 * Shared by the endpoints that touch payment data. Reads the caller's
 * Supabase session token from the Authorization header, confirms it with
 * Supabase, and looks up their role. Returns null when there is no valid
 * signed-in caller, so every endpoint using it fails closed.
 *
 * Files in /api that start with an underscore are helpers, not routes.
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

async function getCaller(req) {
  const header = (req.headers && req.headers.authorization) || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  const url = process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co';
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publicKey || !serviceKey) {
    console.error('[caller] Supabase keys are not configured - refusing the request.');
    return null;
  }

  let user = null;
  try {
    const { data, error } = await createClient(url, publicKey).auth.getUser(token);
    if (error || !data || !data.user) return null;
    user = data.user;
  } catch (e) {
    console.error('[caller] token check failed:', e && e.message);
    return null;
  }

  let profile = null;
  try {
    const { data } = await createClient(url, serviceKey)
      .from('profiles')
      .select('role, stripe_customer_id, is_active')
      .eq('user_id', user.id)
      .maybeSingle();
    profile = data || null;
  } catch (e) {
    console.error('[caller] profile lookup failed:', e && e.message);
  }

  // No profile row, or an unknown role, is treated as the least privileged.
  const role = profile && (profile.role === 'owner' || profile.role === 'staff') ? profile.role : 'client';
  return { user, role, isOwner: role === 'owner', profile };
}

// ── R79: server-to-server calls ──
// Some endpoints are called by OTHER endpoints on this site (a charge run
// asking the notification endpoint to email a client). Those calls have no
// signed-in person behind them, so they prove themselves with a token derived
// from CRON_SECRET. The raw secret itself is never sent anywhere.
function internalToken() {
  const secret = process.env.CRON_SECRET;
  if (!secret) return '';
  return crypto.createHash('sha256').update(secret + ':hhp-internal-notify').digest('hex');
}
// Headers for a server-to-server JSON call to one of our own endpoints.
function internalHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const t = internalToken();
  if (t) h['x-hhp-internal'] = t;
  return h;
}
function isInternalCall(req) {
  const want = internalToken();
  const got = req && req.headers && req.headers['x-hhp-internal'];
  if (!want || typeof got !== 'string' || got.length !== want.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want)); } catch (e) { return false; }
}

// Rachel's own addresses. A client-triggered notification (a client accepting
// or declining a time change) is only ever addressed to one of these.
function ownerAddresses() {
  return ['housleyhappypaws@gmail.com', 'rlhousley05@gmail.com', process.env.OWNER_EMAIL]
    .filter(Boolean).map(function (a) { return String(a).trim().toLowerCase(); });
}

// Who is asking a notification endpoint to send an email?
//   internal  another endpoint on this site
//   owner / staff / client  a signed-in person
//   none      nobody we can identify
async function notifCaller(req) {
  if (isInternalCall(req)) return { kind: 'internal', email: '' };
  const caller = await getCaller(req);
  if (!caller) return { kind: 'none', email: '' };
  return { kind: caller.role, email: String(caller.user.email || '').trim().toLowerCase() };
}
// May this caller have an email sent to this address?
// The site itself, Rachel and staff may write to anyone. A client may only
// trigger mail to Rachel or to themselves. Nobody else may trigger any.
function mayNotify(who, recipient) {
  if (!who) return false;
  if (who.kind === 'internal' || who.kind === 'owner' || who.kind === 'staff') return true;
  if (who.kind === 'client') {
    const r = String(recipient || '').trim().toLowerCase();
    return !!r && (r === who.email || ownerAddresses().indexOf(r) !== -1);
  }
  return false;
}

// R79 ships with this OFF: every caller now says who it is, and anything that
// would be refused is written to the log - but nothing is refused yet. A tab
// left open from before R79 still sends without a token, and refusing it
// would silently drop a client's confirmation email. Flip this to true (R80)
// once the log shows no legitimate caller arriving unidentified.
const NOTIF_ENFORCE = false;

// One call for a notification endpoint. Returns null to carry on, or an
// { status, body } to send back when the caller is refused.
async function checkNotify(req, endpoint, recipient, detail) {
  let who = { kind: 'none', email: '' };
  try { who = await notifCaller(req); } catch (e) { console.error('[notif-auth] caller check failed:', e && e.message); }
  if (mayNotify(who, recipient)) return null;
  console.warn('[notif-auth] ' + endpoint + ': caller=' + who.kind + (detail ? ' ' + detail : '') +
    (NOTIF_ENFORCE ? ' - REFUSED' : ' - allowed for now, will be refused once enforcement is on'));
  if (!NOTIF_ENFORCE) return null;
  return who.kind === 'none'
    ? { status: 401, body: { error: 'Not signed in' } }
    : { status: 403, body: { error: 'Not allowed to send this notification' } };
}

module.exports = { getCaller, internalHeaders, isInternalCall, notifCaller, mayNotify, checkNotify, NOTIF_ENFORCE };
