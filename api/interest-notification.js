/**
 * Interest Notification API
 * Sends email to Rachel when someone submits a coming-soon interest form.
 */

const { sendToRachel, escHtml } = require('./_email');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { service, name, contact, pet, notes, frequency, weddingDate, serviceType } = req.body || {};

  if (!service || !name || !contact) {
    return res.status(400).json({ error: 'Missing required fields: service, name, contact' });
  }

  try {
    const safeName = escHtml(name);
    const safeContact = escHtml(contact);
    const safePet = escHtml(pet);
    const safeNotes = escHtml(notes);
    const safeFreq = escHtml(frequency);
    const safeWedDate = escHtml(weddingDate);
    const safeSvcType = escHtml(serviceType);

    var labelMap = {
      pawbus: '\uD83D\uDE8C Paw Bus',
      boarding: '\uD83C\uDF19 Dog Boarding',
      daycare: '\u2600\uFE0F Doggy Day Care',
      wedding: '\uD83D\uDC8D Wedding Addition'
    };
    var label = labelMap[service] || service;

    var subject = '\uD83D\uDC3E New Interest: ' + label + ' from ' + safeName;

    var details = '';
    details += '<p><strong>Name:</strong> ' + safeName + '</p>';
    details += '<p><strong>Contact:</strong> ' + safeContact + '</p>';
    if (safePet) details += '<p><strong>Pet:</strong> ' + safePet + '</p>';
    if (safeFreq) details += '<p><strong>Frequency:</strong> ' + safeFreq + '</p>';
    if (safeWedDate) details += '<p><strong>Wedding Date:</strong> ' + safeWedDate + '</p>';
    if (safeSvcType) details += '<p><strong>Service Type:</strong> ' + safeSvcType + '</p>';
    if (safeNotes) details += '<p><strong>Notes:</strong> ' + safeNotes + '</p>';

    var bodyHTML = '<p>Hi Rachel!</p>' +
      '<p>Someone is interested in <strong>' + label + '</strong>:</p>' +
      '<div style="background:#f5f0e8;border-radius:10px;padding:16px;margin:16px 0;border-left:4px solid #c8963e">' +
      details +
      '</div>' +
      '<p style="font-size:0.85rem;color:#8c6b4a">They have been added to the interest list. Reach out when you are ready!</p>';

    var result = await sendToRachel({ subject: subject, title: 'New ' + label + ' Interest', bodyHTML: bodyHTML });

    if (result.success) {
      return res.status(200).json({ ok: true, emailId: result.id });
    } else {
      console.error('[interest-notification] Email failed:', result.error);
      return res.status(200).json({ ok: true, emailError: result.error });
    }
  } catch (err) {
    console.error('[interest-notification] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
