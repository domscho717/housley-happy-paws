const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { sendEmail, escHtml } = require('./_email');

// Owner-only: create a staff account from the server using the service role
// key. Doing this client-side via supabase.auth.signUp would log the calling
// owner out (Supabase swaps the active session to the new user).
//
// R74 - two ways to add someone:
//   1. Rachel types a password (the original behaviour, unchanged).
//   2. Rachel leaves the password blank. The account is created with a long
//      random password nobody ever sees, and the new person is emailed a
//      one-time link to choose their own. The same link is returned to
//      Rachel so she can text it herself if the email does not arrive.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.housleyhappypaws.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — missing token' });
  }
  const token = authHeader.replace('Bearer ', '');

  const supabaseUrl = process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co';
  const supabaseAuth = createClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  );

  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser(token);
  if (authErr || !user) {
    return res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured — missing service role key' });
  }
  const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!callerProfile || callerProfile.role !== 'owner') {
    return res.status(403).json({ error: 'Forbidden — owner access required' });
  }

  const { name, email, password, phone, payPct, jobTitle } = req.body || {};
  // R74: no password means "invite them to choose their own".
  const invite = (password === undefined || password === null || password === '');
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }
  if (!invite && (typeof password !== 'string' || password.length < 8)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const effectivePassword = invite
    ? crypto.randomBytes(30).toString('base64url') + 'aA1!'
    : password;

  try {
    // R5 P1 #1: pre-check if the email already exists in auth.users. Without
    // this we just get GoTrue's opaque "Database error creating new user"
    // when admin.createUser collides on the unique email index.
    let preCheckMsg = null;
    try {
      const { data: existing } = await supabase.auth.admin.listUsers({
        page: 1, perPage: 200,
      });
      const lower = String(email).toLowerCase();
      const dup = (existing && existing.users || []).find(u => (u.email || '').toLowerCase() === lower);
      if (dup) {
        preCheckMsg = 'An account with this email already exists. Use a different email, or have them sign in and set their role to staff from the profile page.';
      }
    } catch (preErr) {
      // Non-fatal — admin.listUsers may rate-limit on busy projects.
      console.warn('[create-staff] pre-check listUsers failed (continuing):', preErr && preErr.message);
    }
    if (preCheckMsg) {
      return res.status(409).json({ error: preCheckMsg, code: 'email_exists' });
    }

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: effectivePassword,
      email_confirm: true,
      user_metadata: { full_name: name, role: 'staff' },
    });
    if (createErr || !created?.user) {
      // R5 #1: log the FULL error so we can diagnose next time. Then map
      // common GoTrue errors to friendlier messages.
      console.error('[create-staff] admin.createUser failed:', {
        message: createErr?.message,
        status: createErr?.status,
        code: createErr?.code,
        name: createErr?.name,
      });
      const rawMsg = createErr?.message || 'Failed to create user';
      const lower = rawMsg.toLowerCase();
      let friendly = rawMsg;
      let code = createErr?.code || 'unknown';
      if (lower.includes('already') || lower.includes('exists') || lower.includes('duplicate')) {
        friendly = 'That email is already registered. Use a different email or have them sign in with a magic link.';
        code = 'email_exists';
      } else if (lower.includes('database error')) {
        // Catch the GoTrue umbrella message that hides the real DB error.
        friendly = 'Database error creating user. Likely a role/constraint mismatch — check Supabase logs. Raw: ' + rawMsg;
        code = 'db_error';
      } else if (lower.includes('password')) {
        friendly = 'Password rejected: ' + rawMsg;
        code = 'password_invalid';
      } else if (lower.includes('email')) {
        friendly = 'Email rejected: ' + rawMsg;
        code = 'email_invalid';
      }
      return res.status(400).json({
        error: friendly,
        code: code,
        rawError: rawMsg,
      });
    }

    const newUserId = created.user.id;
    const todayStr = new Date().toISOString().slice(0, 10);

    // Profile row may already exist if a DB trigger creates one; upsert by user_id.
    // Persist job_title from the form (R5 P1 #1 follow-up). NULL if not provided.
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        user_id: newUserId,
        email,
        full_name: name,
        phone: phone || null,
        role: 'staff',
        // R29: share of each visit. null means 'use the business default'.
        // Anything out of range is stored as null for the same reason - a bad
        // value must not become a 0% wage.
        staff_pay_pct: (payPct != null && !Number.isNaN(Number(payPct))
          && Number(payPct) >= 0 && Number(payPct) <= 85) ? Number(payPct) : null,
        hire_date: todayStr,
        is_active: true,
        job_title: (jobTitle && String(jobTitle).trim()) || null,
      }, { onConflict: 'user_id' });

    if (profileErr) {
      console.warn('[create-staff] Profile upsert warning:', profileErr.message);
    }

    // R74: invite flow. The account exists either way; a failure below never
    // undoes it - Rachel is told, and the person can still use "Forgot
    // password" on the sign-in screen to get a fresh link.
    let inviteLink = null, emailSent = false, inviteError = null;
    if (invite) {
      try {
        const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: 'https://www.housleyhappypaws.com/?welcome=true' },
        });
        if (linkErr) throw linkErr;
        inviteLink = (linkData && linkData.properties && linkData.properties.action_link) || null;
        if (!inviteLink) throw new Error('No link returned');
        const firstName = String(name).trim().split(/\s+/)[0];
        const inviter = (callerProfile.full_name || 'Rachel').trim().split(/\s+/)[0];
        const bodyHTML = `
          <p>Hi ${escHtml(firstName)},</p>
          <p>${escHtml(inviter)} added you to the Housley Happy Paws team. Choose your own password to finish setting up your account:</p>
          <p style="text-align:center;margin:24px 0">
            <a href="${inviteLink}" style="display:inline-block;padding:12px 28px;background:#3d5a47;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:700">Set my password</a>
          </p>
          <p>After that, you sign in at housleyhappypaws.com with this email address (${escHtml(email)}).</p>
          <p style="font-size:0.9em;color:#666">This link works once and expires after a short time. If it has expired, go to housleyhappypaws.com, tap Sign In, then "Forgot password", and enter this email address. You will get a fresh link.</p>
        `;
        const sent = await sendEmail({
          to: email,
          subject: 'Welcome to the Housley Happy Paws team - set your password',
          title: 'Welcome to the Team',
          bodyHTML,
        });
        emailSent = !!(sent && sent.success);
        if (!emailSent) inviteError = (sent && sent.error) || 'Email did not send';
      } catch (invErr) {
        console.error('[create-staff] invite step failed:', invErr && invErr.message);
        inviteError = (invErr && invErr.message) || 'Could not create the invite link';
      }
    }

    return res.status(200).json({
      success: true,
      userId: newUserId,
      jobTitleSaved: !!jobTitle,
      invited: invite,
      emailSent,
      inviteLink,
      inviteError,
    });
  } catch (err) {
    console.error('[create-staff] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
