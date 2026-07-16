/**
 * Meet & Greet Day-Of Reminder — Vercel Cron Job
 *
 * Fires once per day at 12:00 UTC (8 AM EDT / 7 AM EST). Finds every M&G
 * booking scheduled for today and sends two emails:
 *   1. Client reminder — what to expect, time, address, portal link.
 *   2. Owner reminder — client info, address, booking ID, notes.
 *
 * Idempotent via booking_requests.meet_greet_reminder_sent_at — once set
 * within the last 24h, the row is skipped (so manual reruns + duplicate
 * cron fires don't double-email).
 *
 * Supported query params:
 *   ?dryRun=1        — list what WOULD be sent, send nothing.
 *   ?date=YYYY-MM-DD — override "today" for testing.
 *   ?force=1         — ignore meet_greet_reminder_sent_at when computing.
 *   ?bookingId=<id>  — restrict to a single booking row.
 *
 * Auth: Vercel cron sends an Authorization: Bearer <CRON_SECRET> header
 * when CRON_SECRET is set. Manual hits from PowerShell can use
 * X-Cron-Secret. If no CRON_SECRET env var exists the endpoint is open
 * (same convention as pre-booking-reminder / unpaid-reminders).
 */

const { createClient } = require('@supabase/supabase-js');
const { sendEmail, mapsLink, fmt12, escHtml, SITE_URL, RACHEL_EMAIL } = require('./_email');

const RACHEL_PHONE_DISPLAY = '717-715-7595';
const RACHEL_PHONE_TEL = '+17177157595';
const REMINDER_COOLDOWN_HOURS = 20; // skip if sent within last 20h (cron fires ~24h apart)

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Params (read before auth so we can allow dry-run without secret) ──
  // R12 P2 — parse via WHATWG URL to avoid deprecated url.parse().
  const _sp = new URL(req.url || '', 'http://x').searchParams;
  const _qFromUrl = {};
  _sp.forEach((v, k) => { _qFromUrl[k] = v; });
  const qs = (Object.keys(_qFromUrl).length > 0) ? _qFromUrl : (req.body || {});
  const dryRun = qs.dryRun === '1' || qs.dryRun === 'true' || qs.dryRun === true;

  // Auth: enforced when CRON_SECRET is set EXCEPT for dryRun=1 hits, since
  // those send no emails and write no rows — safe for ops to spot-check
  // from a browser tab without holding the secret.
  const envSecret = process.env.CRON_SECRET;
  const cronSecret = req.headers['authorization'];
  const manualSecret = req.headers['x-cron-secret'];
  if (!dryRun && envSecret && cronSecret !== `Bearer ${envSecret}` && manualSecret !== envSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );
  const forceResend = qs.force === '1' || qs.force === 'true' || qs.force === true;
  const overrideDate = (qs.date && /^\d{4}-\d{2}-\d{2}$/.test(qs.date)) ? qs.date : null;
  const onlyBookingId = qs.bookingId || null;

  // ── Compute today's date in Eastern timezone ──
  const todayStr = overrideDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const result = {
    today: todayStr,
    dryRun: !!dryRun,
    forceResend: !!forceResend,
    onlyBookingId: onlyBookingId || null,
    checked: 0,
    skipped_already_sent: 0,
    sent: 0,
    errors: [],
    bookings: [],
  };

  try {
    // ── Owner profile(s) — Rachel ──
    const { data: ownerRows } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, phone, role')
      .eq('role', 'owner');
    const ownerEmails = (ownerRows || [])
      .map(o => (o.email || '').trim())
      .filter(Boolean);
    // Fallback to RACHEL_EMAIL if no owner profile has an email on file.
    if (ownerEmails.length === 0) ownerEmails.push(RACHEL_EMAIL);

    // ── Pull all M&G bookings scheduled for today ──
    // We accept any not-canceled / not-declined / not-completed status —
    // 'accepted', 'pending', 'confirmed', 'modified' all qualify as
    // "client is expecting this visit today".
    let query = supabase
      .from('booking_requests')
      .select('id, contact_name, contact_email, contact_phone, preferred_date, preferred_time, scheduled_date, scheduled_time, service, pet_names, address, status, special_notes, admin_notes, meet_greet_reminder_sent_at, client_id, estimated_total')
      .ilike('service', '%meet%greet%')
      .or(`preferred_date.eq.${todayStr},scheduled_date.eq.${todayStr}`)
      .in('status', ['accepted', 'pending', 'confirmed', 'modified']);
    if (onlyBookingId) query = query.eq('id', onlyBookingId);

    const { data: bookings, error: bkErr } = await query;
    if (bkErr) {
      console.error('[meet-greet-reminder] booking lookup failed:', bkErr);
      return res.status(500).json({ error: 'Booking lookup failed: ' + bkErr.message, result });
    }

    result.checked = (bookings || []).length;

    const cooldownCutoffMs = Date.now() - REMINDER_COOLDOWN_HOURS * 3600 * 1000;

    for (const bk of bookings || []) {
      const summary = {
        id: bk.id,
        contact_name: bk.contact_name,
        contact_email: bk.contact_email,
        time: bk.scheduled_time || bk.preferred_time,
        pets: bk.pet_names,
        already_sent_at: bk.meet_greet_reminder_sent_at,
        sent_client: false,
        sent_owner: false,
        skipped: false,
        error: null,
      };

      // Idempotency check.
      if (!forceResend && bk.meet_greet_reminder_sent_at) {
        const sentMs = new Date(bk.meet_greet_reminder_sent_at).getTime();
        if (!Number.isNaN(sentMs) && sentMs > cooldownCutoffMs) {
          summary.skipped = true;
          result.skipped_already_sent++;
          result.bookings.push(summary);
          continue;
        }
      }

      // Build the email bodies for both audiences.
      const timeRaw = bk.scheduled_time || bk.preferred_time || '';
      const timeFmt = fmt12(timeRaw) || timeRaw || 'TBD';
      const firstName = (bk.contact_name || 'there').split(/\s+/)[0];
      const petList = bk.pet_names || 'your pet(s)';
      const addressStr = bk.address || 'the address on file';
      const adminNoteCombined = [bk.admin_notes, bk.special_notes].filter(Boolean).join('\n');

      const safeFirst = escHtml(firstName);
      const safePets = escHtml(petList);
      const safeAddr = escHtml(addressStr);
      const safeName = escHtml(bk.contact_name || 'Client');
      const safePhone = escHtml(bk.contact_phone || '');
      const safeEmail = escHtml(bk.contact_email || '');
      const safeNotes = escHtml(adminNoteCombined);
      const map = mapsLink(addressStr);

      const clientSubject = `Today: your meet & greet with Rachel at ${timeFmt}`;
      const clientBodyHTML = `
        <p>Hi ${safeFirst},</p>
        <p>Just a quick reminder that your <strong>free meet &amp; greet</strong> with Rachel is today at <strong>${escHtml(timeFmt)}</strong>.</p>
        <div style="background:#fdf7ee;border-radius:10px;padding:14px 18px;margin:16px 0;border-left:4px solid #c8963e">
          <div style="font-weight:700;margin-bottom:6px">📅 Today · ${escHtml(timeFmt)}</div>
          <div style="margin-bottom:4px">🐾 ${safePets}</div>
          <div style="margin-bottom:4px">📍 ${safeAddr}</div>
        </div>
        <p><strong>What to expect:</strong> Rachel will meet you and your pets, get to know everyone, and discuss the services you're interested in. It's a free 15-30 minute visit — no commitment, no pressure.</p>
        <p>If you need to reach out before then, you can text or call Rachel:</p>
        <p style="margin:10px 0">
          <a href="sms:${RACHEL_PHONE_TEL}" style="display:inline-block;padding:10px 18px;background:#3d5a47;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin-right:6px">💬 Text ${RACHEL_PHONE_DISPLAY}</a>
          <a href="tel:${RACHEL_PHONE_TEL}" style="display:inline-block;padding:10px 18px;background:#c8963e;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">📞 Call ${RACHEL_PHONE_DISPLAY}</a>
        </p>
        <p style="margin-top:18px">
          <a href="${SITE_URL}/?tab=appointments" style="color:#3d5a47;font-weight:600">Open your portal →</a>
        </p>
        <p style="font-size:0.82rem;color:#8c6b4a;margin-top:18px">See you soon!<br>— Rachel @ Housley Happy Paws</p>
      `;

      const ownerSubject = `Meet & greet today at ${timeFmt} — ${bk.contact_name || 'Client'}`;
      const ownerBodyHTML = `
        <p>Heads up — you have a meet &amp; greet today.</p>
        <div style="background:#eef4ef;border-radius:10px;padding:14px 18px;margin:16px 0;border-left:4px solid #3d5a47">
          <div style="font-weight:700;margin-bottom:6px">⏰ ${escHtml(timeFmt)}</div>
          <div style="margin-bottom:4px"><strong>Client:</strong> ${safeName}</div>
          ${safePhone ? `<div style="margin-bottom:4px"><strong>Phone:</strong> <a href="tel:${safePhone.replace(/[^\\d+]/g, '')}">${safePhone}</a></div>` : ''}
          ${safeEmail ? `<div style="margin-bottom:4px"><strong>Email:</strong> ${safeEmail}</div>` : ''}
          <div style="margin-bottom:4px"><strong>Pets:</strong> ${safePets}</div>
          <div style="margin-bottom:4px"><strong>Address:</strong> ${safeAddr}${map ? ` · <a href="${map}">Open in Maps</a>` : ''}</div>
          <div style="margin-bottom:4px"><strong>Booking ID:</strong> <code>${escHtml(bk.id)}</code></div>
        </div>
        ${safeNotes ? `<div style="background:#fff8e1;border-radius:10px;padding:14px 18px;margin:16px 0;border:1px solid #e0d5c5"><strong>Notes:</strong><br>${safeNotes.replace(/\n/g, '<br>')}</div>` : ''}
        <p style="margin-top:18px">
          <a href="${SITE_URL}/?tab=appointments" style="color:#3d5a47;font-weight:600">Open owner portal →</a>
        </p>
      `;

      if (dryRun) {
        summary.would_send_client_to = bk.contact_email;
        summary.would_send_owner_to = ownerEmails;
        summary.client_subject = clientSubject;
        summary.owner_subject = ownerSubject;
        result.bookings.push(summary);
        continue;
      }

      // ── Live send: client first, then owner(s). Each in its own try so
      //  one failure doesn't block the other. ──
      try {
        if (bk.contact_email) {
          const cRes = await sendEmail({
            to: bk.contact_email,
            subject: clientSubject,
            title: 'Today’s Meet & Greet',
            bodyHTML: clientBodyHTML,
          });
          summary.sent_client = !!(cRes && cRes.success);
          if (cRes && !cRes.success) summary.error = (summary.error ? summary.error + ' | ' : '') + 'client: ' + (cRes.error || 'unknown');
        } else {
          summary.error = (summary.error ? summary.error + ' | ' : '') + 'client: no contact_email on file';
        }
      } catch (clientErr) {
        console.error('[meet-greet-reminder] client send failed:', clientErr);
        summary.error = (summary.error ? summary.error + ' | ' : '') + 'client: ' + (clientErr.message || 'threw');
      }

      // Owner email — send to every owner profile email (deduped).
      const uniqueOwnerEmails = Array.from(new Set(ownerEmails));
      let ownerOk = uniqueOwnerEmails.length > 0;
      for (const ownerEmail of uniqueOwnerEmails) {
        try {
          const oRes = await sendEmail({
            to: ownerEmail,
            subject: ownerSubject,
            title: 'Meet & Greet Today',
            bodyHTML: ownerBodyHTML,
          });
          if (!oRes || !oRes.success) {
            ownerOk = false;
            summary.error = (summary.error ? summary.error + ' | ' : '') + 'owner ' + ownerEmail + ': ' + (oRes && oRes.error || 'unknown');
          }
        } catch (ownerErr) {
          ownerOk = false;
          console.error('[meet-greet-reminder] owner send failed:', ownerErr);
          summary.error = (summary.error ? summary.error + ' | ' : '') + 'owner ' + ownerEmail + ': ' + (ownerErr.message || 'threw');
        }
      }
      summary.sent_owner = ownerOk;

      // Mark sent (even on partial failure — we don't want to spam on retries).
      // If both client and owner sends failed entirely, leave the column null
      // so the next cron tick / manual retry will try again.
      if (summary.sent_client || summary.sent_owner) {
        try {
          await supabase
            .from('booking_requests')
            .update({ meet_greet_reminder_sent_at: new Date().toISOString() })
            .eq('id', bk.id);
          result.sent++;
        } catch (markErr) {
          console.error('[meet-greet-reminder] failed to stamp sent_at:', markErr);
          summary.error = (summary.error ? summary.error + ' | ' : '') + 'mark: ' + (markErr.message || 'unknown');
        }
      } else {
        result.errors.push({ id: bk.id, error: summary.error || 'no recipients' });
      }

      result.bookings.push(summary);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[meet-greet-reminder] fatal:', err);
    return res.status(500).json({ error: err.message || 'fatal', result });
  }
};
