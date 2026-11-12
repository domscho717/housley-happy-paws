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

module.exports = { getCaller };
