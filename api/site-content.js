// Housley Happy Paws - Site Content API
// GET /api/site-content?section=hero  (public - returns content for a section)
// GET /api/site-content               (public - returns all sections)
// POST /api/site-content              (auth required - owner only, saves content)

const { createClient } = require('@supabase/supabase-js');

function getSupabase(authHeader) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const opts = {
    auth: { persistSession: false, autoRefreshToken: false }
  };
  if (authHeader) {
    opts.global = { headers: { Authorization: authHeader } };
  }
  return createClient(url, anonKey, opts);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.housleyhappypaws.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase(req.headers.authorization);
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  // GET - Read site content (public)
  if (req.method === 'GET') {
    try {
      const section = req.query.section;
      let query = supabase.from('site_content').select('section_key, content, updated_at');

      if (section) {
        query = query.eq('section_key', section).maybeSingle();
      }

      const { data, error } = await query;
      if (error && error.code !== 'PGRST116') {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json(data || {});
    } catch (err) {
      console.error('site-content GET error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // POST - Save site content (owner only)
  if (req.method === 'POST') {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { section_key, content } = req.body || {};
    if (!section_key || !content) {
      return res.status(400).json({ error: 'Missing section_key or content' });
    }

    // Get user ID from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }

    // Upsert the content
    const { data, error } = await supabase
      .from('site_content')
      .upsert({
        section_key,
        content,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'section_key' })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
