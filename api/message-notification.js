/**
 * Message Notification API
 *
 * When a client sends a new chat message to the owner, this endpoint decides
 * whether to email her. If she's been active in the portal in the last 5
 * minutes (per profiles.last_seen_at), the email is skipped so she isn't
 * spammed while chatting live. Otherwise we send a short preview + portal link.
 *
 * Body: { recipientId, senderId, messagePreview }
 *   recipientId   — UUID of the owner being messaged
 *   senderId      — UUID of the client who sent it
 *   messagePreview — first ~140 chars of the message body
 */

const { createClient } = require('@supabase/supabase-js');
const { sendEmail, escHtml, SITE_URL } = require('./_email');

const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.housleyhappypaws.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { recipientId, senderId, messagePreview } = req.body || {};
  if (!recipientId) return res.status(400).json({ error: 'recipientId is required' });
  if (!messagePreview) return res.status(400).json({ error: 'messagePreview is required' });

  const supabaseUrl = process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error('[message-notification] SUPABASE_SERVICE_ROLE_KEY missing');
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Look up recipient profile — only owners get these emails (per brief).
    const { data: recipient, error: recipErr } = await supabase
      .from('profiles')
      .select('role, email, full_name, last_seen_at')
      .eq('user_id', recipientId)
      .maybeSingle();

    if (recipErr) {
      console.error('[message-notification] recipient lookup error:', recipErr);
      return res.status(500).json({ error: 'Recipient lookup failed' });
    }
    if (!recipient) return res.status(404).json({ error: 'Recipient profile not found' });
    if (recipient.role !== 'owner') {
      return res.status(200).json({ skipped: true, reason: 'recipient is not owner' });
    }

    // 2. Is the owner currently active in the portal?
    if (recipient.last_seen_at) {
      const lastSeenMs = new Date(recipient.last_seen_at).getTime();
      if (!Number.isNaN(lastSeenMs) && Date.now() - lastSeenMs < ACTIVE_WINDOW_MS) {
        return res.status(200).json({ skipped: true, reason: 'owner is active in portal' });
      }
    }

    if (!recipient.email) {
      return res.status(200).json({ skipped: true, reason: 'recipient has no email on file' });
    }

    // 3. Look up sender's name (best-effort).
    let senderName = 'A client';
    if (senderId) {
      try {
        const { data: senderProf } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', senderId)
          .maybeSingle();
        if (senderProf && senderProf.full_name) senderName = senderProf.full_name;
      } catch (e) { /* fall back to default */ }
    }

    // 4. Build + send the email.
    const safePreview = escHtml(messagePreview).slice(0, 140);
    const safeSender = escHtml(senderName);
    const portalLink = SITE_URL + '/?tab=messages';

    const bodyHTML = `
      <p>You have a new message from <strong>${safeSender}</strong>.</p>
      <div style="background:#fdf7ee;border-left:4px solid #c8963e;border-radius:8px;padding:14px 18px;margin:16px 0;font-style:italic;color:#5c3d1e">
        "${safePreview}${messagePreview.length > 140 ? '…' : ''}"
      </div>
      <p style="margin-top:18px">
        <a href="${portalLink}" style="display:inline-block;padding:12px 26px;background:#3d5a47;color:white;border-radius:8px;text-decoration:none;font-weight:700">Open Messages →</a>
      </p>
      <p style="font-size:0.82rem;color:#8c6b4a;margin-top:18px">
        You only get this email when you haven't been active in the portal recently. While you're chatting live, message emails are suppressed.
      </p>
    `;

    const result = await sendEmail({
      to: recipient.email,
      subject: `New message from ${senderName}`,
      title: 'New Message',
      bodyHTML,
    });

    return res.status(200).json({
      sent: result.success,
      emailId: result.id || null,
      error: result.error || null,
    });
  } catch (err) {
    console.error('[message-notification] error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
