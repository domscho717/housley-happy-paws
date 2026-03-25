/**
 * Send Announcement Email — Housley Happy Paws
 * Sends a branded email to all clients (or filtered recipients) when owner posts an announcement.
 *
 * POST body:
 *   message   — the announcement text
 *   sendTo    — 'everyone' | 'all_clients' | 'active_clients' | 'staff'
 *   dealName  — optional deal/promo name
 *   dealDetails — optional deal details
 */

const { createClient } = require('@supabase/supabase-js');
const { sendEmail, escHtml, SITE_URL } = require('./_email');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  const { message, sendTo, dealName, dealDetails } = req.body || {};

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    let validRecipients = [];

    if (sendTo === 'active_clients') {
      // Active clients = clients with a booking in the last 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: activeBookings } = await supabase.from('booking_requests')
        .select('client_id')
        .not('client_id', 'is', null)
        .gte('created_at', ninetyDaysAgo);

      if (activeBookings && activeBookings.length > 0) {
        const uniqueClientIds = [...new Set(activeBookings.map(b => b.client_id))];
        const { data: profiles } = await supabase.from('profiles')
          .select('email, full_name, role')
          .in('user_id', uniqueClientIds);
        validRecipients = (profiles || []).filter(r => r.email && r.email.includes('@'));
      }
    } else {
      let query = supabase.from('profiles').select('email, full_name, role');

      if (sendTo === 'all_clients') {
        query = query.eq('role', 'client');
      } else if (sendTo === 'staff') {
        query = query.eq('role', 'staff');
      } else {
        // 'everyone' = clients + staff
        query = query.in('role', ['client', 'staff']);
      }

      const { data: recipients, error: fetchErr } = await query;

      if (fetchErr) {
        console.error('[announcement-email] Fetch recipients error:', fetchErr.message);
        return res.status(500).json({ error: 'Failed to fetch recipients' });
      }

      validRecipients = (recipients || []).filter(r => r.email && r.email.includes('@'));
    }

    if (validRecipients.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No recipients found' });
    }

    // Build the email body
    let bodyHTML = `<p style="margin:0 0 16px">${escHtml(message.trim()).replace(/\n/g, '<br>')}</p>`;

    if (dealName) {
      bodyHTML += `
        <div style="background:linear-gradient(135deg,#fdf8f0,#fef9f1);border:1.5px solid #e8d5b8;border-radius:10px;padding:16px;margin:16px 0">
          <div style="font-weight:700;color:#1e1409;font-size:1rem">🏷️ ${escHtml(dealName)}</div>
          ${dealDetails ? `<div style="color:#6b5a48;font-size:0.88rem;margin-top:6px">${escHtml(dealDetails)}</div>` : ''}
        </div>`;
    }

    bodyHTML += `
      <div style="text-align:center;margin-top:24px">
        <a href="${SITE_URL}" style="display:inline-block;background:#1e1409;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.9rem">
          Visit Housley Happy Paws
        </a>
      </div>`;

    // Send emails (non-blocking, collect results)
    const results = { sent: 0, failed: 0, errors: [] };

    // Send in small batches to avoid rate limits
    for (const recipient of validRecipients) {
      try {
        const result = await sendEmail({
          to: recipient.email,
          subject: `📢 ${dealName ? dealName + ' — ' : ''}Housley Happy Paws Announcement`,
          title: '📢 Announcement from Rachel',
          bodyHTML: bodyHTML,
        });
        if (result.success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push({ email: recipient.email, error: result.error });
        }
      } catch (emailErr) {
        results.failed++;
        results.errors.push({ email: recipient.email, error: emailErr.message });
      }
    }

    console.log(`[announcement-email] Sent ${results.sent}/${validRecipients.length} emails`);
    if (results.errors.length > 0) {
      console.warn('[announcement-email] Failures:', JSON.stringify(results.errors));
    }

    res.status(200).json(results);
  } catch (err) {
    console.error('[announcement-email] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
