// ============================================================
// Housley Happy Paws — Cloudinary signed-upload endpoint (RETIRED)
//
// R65 — this endpoint returned a valid SHA-1 upload signature together with
// CLOUDINARY_API_KEY and the cloud name to ANY caller, with no authentication
// and no rate limit. That is unlimited arbitrary uploads into the business's
// Cloudinary account — which is on a free tier that has already run out of
// quota once and stopped report photos uploading.
//
// It was also dead code. Every upload path in the app uploads straight to
// Cloudinary with the UNSIGNED preset `hhp_unsigned`:
//   js/cloudinary-client.js, js/avatar-system.js, js/gallery.js,
//   js/report-submission.js, index.html
// All 17 js files and index.html were searched: nothing called this.
//
// Left in place as a 410 rather than deleted so the behaviour is explicit and
// anything that somehow still calls it fails loudly instead of silently.
// Safe to `git rm` this file entirely.
// ============================================================

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.housleyhappypaws.com');
  if (req.method === 'OPTIONS') return res.status(200).end();
  return res.status(410).json({
    error: 'This endpoint has been retired. Uploads use the unsigned preset.',
  });
};
