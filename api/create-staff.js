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

  const { name, email, password, phone, hourlyRate } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role: 'staff' },
    });
    if (createErr || !created?.user) {
      return res.status(400).json({ error: createErr?.message || 'Failed to create user' });
    }

    const newUserId = created.user.id;
    const todayStr = new Date().toISOString().slice(0, 10);

    // Profile row may already exist if a DB trigger creates one; upsert by user_id.
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
      }, { onConflict: 'user_id' });

    if (profileErr) {
      console.warn('[create-staff] Profile upsert warning:', profileErr.message);
    }

    return res.status(200).json({ success: true, userId: newUserId });
  } catch (err) {
    console.error('[create-staff] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
