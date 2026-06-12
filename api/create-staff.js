const { createClient } = require('@supabase/supabase-js');

// Owner-only: create a staff account from the server using the service role
// key. Doing this client-side via supabase.auth.signUp would log the calling
// owner out (Supabase swaps the active session to the new user).

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
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!callerProfile || callerProfile.role !== 'owner') {
    return res.status(403).json({ error: 'Forbidden — owner access required' });
  }

  const { name, email, password, phone, hourlyRate, jobTitle } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

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
      password,
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
        hourly_rate: hourlyRate != null && !Number.isNaN(Number(hourlyRate)) ? Number(hourlyRate) : null,
        hire_date: todayStr,
        is_active: true,
        job_title: (jobTitle && String(jobTitle).trim()) || null,
      }, { onConflict: 'user_id' });

    if (profileErr) {
      console.warn('[create-staff] Profile upsert warning:', profileErr.message);
    }

    return res.status(200).json({ success: true, userId: newUserId, jobTitleSaved: !!jobTitle });
  } catch (err) {
    console.error('[create-staff] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
