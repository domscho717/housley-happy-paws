// ============================================================
// Housley Happy Paws — Cloudinary Signed Upload Endpoint
// POST /api/cloudinary-sign
// Returns a signature for secure uploads
// ============================================================

const crypto = require('crypto');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { timestamp, folder, eager } = req.body || {};

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiSecret) {
    return res.status(500).json({ error: 'Cloudinary not configured' });
  }

  try {
    const ts = timestamp || Math.round(Date.now() / 1000);

    // Build the string to sign (params must be alphabetical)
    let paramsToSign = `folder=${folder || 'housley-happy-paws'}&timestamp=${ts}`;
    if (eager) {
      paramsToSign = `eager=${eager}&${paramsToSign}`;
    }

    // Generate SHA-1 signature
    const signature = crypto
      .createHash('sha1')
      .update(paramsToSign + apiSecret)
      .digest('hex');

    res.status(200).json({
      signature,
      timestamp: ts,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME
    });
  } catch (err) {
    console.error('Cloudinary sign error:', err);
    return res.status(500).json({ error: 'Failed to generate signature' });
  }
};
