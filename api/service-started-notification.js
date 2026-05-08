/**
 * Service Started Notification API
 * Sends email to client when their service begins.
 * For dog walks, includes live tracking link.
 * Uses Resend for email delivery.
 */

const { sendEmail, fmt12, escHtml, SITE_URL } = require('./_email');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://www.housleyhappypaws.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: require valid Bearer token (owner/staff only)
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  const token = authHeader.replace('Bearer ', '');
  try {
    const supabaseAuth = createClient(
      process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

    const supabaseSvc = createClient(
      process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: profile } = await supabaseSvc.from('profiles').select('role').eq('user_id', user.id).single();
    if (!profile || !['owner', 'staff'].includes(profile.role)) {
      return res.status(403).json({ error: 'Forbidden — owner/staff only' });
    }
  } catch (e) {
    return res.status(401).json({ error: 'Auth failed' });
  }

  const {
    clientEmail, clientName, service, petNames,
    staffName, isDogWalk, address, walkId
  } = req.body || {};

  if (!clientEmail || !service) {
    return res.status(400).json({ error: 'Missing required fields: clientEmail, service' });
  }

  try {
    const safeName = escHtml(clientName);
    const safePets = escHtml(petNames);
    const safeService = escHtml(service);
    const safeStaff = escHtml(staffName);

    const subject = `🟢 ${safePets ? safePets + "'s" : 'Your'} ${safeService} has started! — Housley Happy Paws`;

    const trackingLink = walkId ? `${SITE_URL}/?track=${walkId}` : SITE_URL;
    const trackingHTML = isDogWalk ? `
      <div style="background:#e3f2fd;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #2196F3">
        <div style="font-weight:700;margin-bottom:8px;color:#1565C0">📍 Live GPS Tracking Active</div>
        <div style="font-size:0.88rem;color:#1a237e;margin-bottom:12px">${safeStaff || 'Rachel'} is tracking ${safePets || 'your pet'}'s walk route in real time. Tap below to follow along live!</div>
        <a href="${trackingLink}" style="display:inline-block;padding:10px 24px;background:#2196F3;color:white;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.9rem">🗺️ Track Live Walk →</a>
      </div>` : '';

    const bodyHTML = `
      <p>Hi ${safeName || 'there'}!</p>
      <p>${safeStaff || 'Rachel'} has arrived and started ${safePets ? `<strong>${safePets}</strong>'s` : 'your'} <strong>${safeService}</strong>! 🎉</p>

      <div style="background:#eef4ef;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #3d5a47">
        <div style="font-weight:700;font-size:1.05rem;margin-bottom:8px;color:#3d5a47">${safeService}</div>
        <div style="margin-bottom:4px">🕐 <strong>Started:</strong> ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}</div>
        ${safePets ? `<div style="margin-bottom:4px">🐾 <strong>Pet${safePets.includes(',') ? 's' : ''}:</strong> ${safePets}</div>` : ''}
      </div>

      ${trackingHTML}

      <p style="font-size:0.9rem;color:#5c3d1e">You'll receive a detailed report card with photos, route map, and notes once the service is complete.</p>

      <div style="margin-top:20px">
        <a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:#3d5a47;color:white;border-radius:8px;text-decoration:none;font-weight:700">View in Your Portal →</a>
      </div>
      <p style="font-size:0.85rem;color:#8c6b4a;margin-top:16px">Questions? Reply to this email or call 717-715-7595</p>
    `;

    const result = await sendEmail({
      to: clientEmail,
      subject,
      title: isDogWalk ? 'Walk Started! 🚶' : 'Service Started!',
      bodyHTML,
    });

    return res.status(200).json({
      success: true,
      emailSent: result.success,
      emailId: result.id || null,
      emailError: result.error || null,
    });
  } catch (err) {
    console.error('[service-started-notification] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
