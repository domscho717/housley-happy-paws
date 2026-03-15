// ============================================================
// Housley Happy Paws â UX Patch v5 (ux-patch.js)
// 1. Fix greeting emojis (garbled from encoding) + add decorative icons
// 2. Hero: shrink slideshow, enlarge text & Meet button
// 3. About Rachel: enlarge slideshow
// 4. Footer: set email to housleyhappypaws@gmail.com
// 5. Hero: restyle Meet Rachel as light RECTANGLE under slideshow
// 6. Fix mobile: comprehensive CSS + JS sidebar/hamburger
// 7. Add viewport preview tool to Edit Website page
// 8. v5: Fix nav-right hiding, add missing mobile breakpoints
// ============================================================
(function() {
  'use strict';

  function onReady(fn) {
    if (document.readyState !== 'loading') setTimeout(fn, 800);
    else document.addEventListener('DOMContentLoaded', function() { setTimeout(fn, 800); });
  }

  // âââââââââââââââââââââââââââââââââââââââââââââ
  // 1. FIX GREETINGS â replace garbled emoji with proper icons
  // âââââââââââââââââââââââââââââââââââââââââââââ
  function fixGreetings() {
    var hour = new Date().getHours();
    var greeting, iconHTML;

    if (hour >= 5 && hour < 12) {
      greeting = 'Good morning';
      iconHTML = '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f305.png" alt="sunrise" style="width:32px;height:32px;vertical-align:middle;margin-left:8px;display:inline-block;">';
    } else if (hour >= 12 && hour < 17) {
      greeting = 'Good afternoon';
      iconHTML = '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2600.png" alt="sun" style="width:32px;height:32px;vertical-align:middle;margin-left:8px;display:inline-block;">';
    } else {
      greeting = 'Good evening';
      iconHTML = '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f319.png" alt="moon" style="width:32px;height:32px;vertical-align:middle;margin-left:8px;display:inline-block;">';
    }

    // Fix owner portal greeting
    var ownerGreet = document.querySelector('#o-overview .ob-h');
    if (ownerGreet) {
      var text = ownerGreet.textContent;
      if (text.includes('Good morning') || text.includes('Good afternoon') || text.includes('Good evening')) {
        var nameMatch = text.match(/,\s*([A-Za-z]+)/);
        var name = nameMatch ? nameMatch[1] : 'Rachel';
        ownerGreet.innerHTML = greeting + ', ' + name + ' ' + iconHTML;
      }
    }

    // Fix client portal greeting
    var clientPortal = document.getElementById('pg-client');
    if (clientPortal) {
      clientPortal.querySelectorAll('h1, h2, .p-title').forEach(function(el) {
        var t = el.textContent;
        if (t.includes('Good morning') || t.includes('Good afternoon') || t.includes('Good evening')) {
          var nm = t.match(/,\s*([A-Za-z]+)/);
          var n = nm ? nm[1] : 'there';
          el.innerHTML = greeting + ', ' + n + '! ' + iconHTML;
        }
      });
    }

    // Fix staff portal greeting
    var staffPortal = document.getElementById('pg-staff');
    if (staffPortal) {
      staffPortal.querySelectorAll('h1, h2, .p-title, .ob-h, .hhp-staff-greet div').forEach(function(el) {
        var t = el.textContent;
        if (t.includes('Good morning') || t.includes('Good afternoon') || t.includes('Good evening')) {
          var nm = t.match(/,\s*([A-Za-z]+)/);
          var n = nm ? nm[1] : 'there';
          el.innerHTML = greeting + ', ' + n + '! ' + iconHTML;
        }
      });
    }

    setTimeout(fixGreetings, 60000);
  }

  // âââââââââââââââââââââââââââââââââââââââââââââ
  // 2, 5, 6, 8. ALL CSS â Hero + Mobile + Comprehensive Responsive
  // âââââââââââââââââââââââââââââââââââââââââââââ
  function injectAllCSS() {
    var css = document.createElement('style');
    css.id = 'hhp-ux-patch-css';
    css.textContent =

      /* ===== DESKTOP: Hero + About tweaks ===== */
      '.hero { grid-template-columns: 1.2fr 0.8fr !important; }' +
      '.hero .hero-photo-col { max-width: 500px !important; justify-self: center !important; }' +
      '.hero h1 { font-size: 4.5rem !important; line-height: 1.05 !important; }' +
      '.hero .hero-sub, .hero p:not(.trust-row):not(.section-eyebrow) { font-size: 1.15rem !important; line-height: 1.6 !important; }' +
      '.hero .btn-ink { padding: 18px 42px !important; font-size: 1.1rem !important; border-radius: 14px !important; }' +
      '.hero .btn-outline { padding: 16px 36px !important; font-size: 1.05rem !important; border-radius: 14px !important; }' +

      /* Meet Rachel CTA â wide rectangle */
      '.hero .hero-photo-sm-cta {' +
        'width: auto !important; min-width: 180px !important; height: auto !important;' +
        'max-height: 48px !important; background: #faf6f1 !important;' +
        'border: 1.5px solid rgba(30,20,9,0.12) !important; border-radius: 14px !important;' +
        'padding: 12px 32px !important; flex-direction: row !important;' +
        'align-items: center !important; justify-content: center !important;' +
        'gap: 8px !important; box-shadow: 0 1px 4px rgba(30,20,9,0.06) !important;' +
        'cursor: pointer !important; aspect-ratio: auto !important;' +
      '}' +
      '.hero .hero-photo-sm-cta .paw-icon, .hero .hero-photo-sm-cta svg, .hero .hero-photo-sm-cta img {' +
        'width: 18px !important; height: 18px !important; flex-shrink: 0 !important;' +
      '}' +
      '.hero .hero-photo-sm-cta div, .hero .hero-photo-sm-cta span {' +
        'font-size: 0.85rem !important; font-weight: 600 !important; color: #1e1409 !important;' +
        'white-space: nowrap !important; line-height: 1 !important;' +
      '}' +
      '.hero .hero-photo-row { justify-content: center !important; margin-top: 10px !important; }' +
      '.about-grid { grid-template-columns: 1fr 1fr !important; }' +
      '.about-photos { min-height: 440px !important; border-radius: 18px !important; }' +
      '.about-photos img { object-fit: cover !important; width: 100% !important; height: 100% !important; }' +

      /* ===== TABLET (768â1024px) ===== */
      '@media (min-width: 768px) and (max-width: 1024px) {' +
        '.hero { grid-template-columns: 1fr 1fr !important; }' +
        '.hero h1 { font-size: 3rem !important; }' +
        '.about-photos { min-height: 360px !important; }' +
        '#pg-owner .sidebar, #pg-client .sidebar, #pg-staff .sidebar {' +
          'flex-direction: row !important; flex-wrap: wrap !important;' +
          'gap: 4px !important; padding: 10px 12px !important;' +
        '}' +
        '.hhp-portal-hamburger { display: none !important; }' +
        '.services-grid { grid-template-columns: repeat(2, 1fr) !important; }' +
        '.future-grid { grid-template-columns: repeat(2, 1fr) !important; }' +
      '}' +

      /* ===== PHONE (max 767px) â COMPREHENSIVE ===== */
      '@media (max-width: 767px) {' +

        /* -- Nav: hide desktop elements, show hamburger -- */
        '.nav { padding: 0 12px !important; height: 56px !important; }' +
        '.nav-logo { font-size: 1.2rem !important; }' +
        '.nav-center { display: none !important; }' +
        '.nav-right { display: none !important; }' +
        '#viewSwitcher { display: none !important; }' +
        '.hhp-hamburger { display: flex !important; order: 99; margin-left: auto; }' +

        /* -- Hero -- */
        '.hero { grid-template-columns: 1fr !important; padding: 76px 16px 36px !important; min-height: auto !important; gap: 20px !important; }' +
        '.hero h1 { font-size: 2rem !important; line-height: 1.1 !important; margin-bottom: 12px !important; }' +
        '.hero .hero-p, .hero p:not(.trust-row):not(.section-eyebrow) { font-size: 0.9rem !important; line-height: 1.55 !important; margin-bottom: 20px !important; }' +
        '.hero-tag { font-size: 0.68rem !important; padding: 5px 12px !important; }' +
        '.hero-photo-col { max-width: 100% !important; }' +
        '.hero-actions { flex-direction: column !important; gap: 10px !important; }' +
        '.hero-actions .btn { width: 100% !important; justify-content: center !important; padding: 14px 20px !important; }' +
        '.hero .btn-ink { padding: 14px 24px !important; font-size: 0.95rem !important; width: 100% !important; justify-content: center !important; }' +
        '.hero .btn-outline { padding: 12px 20px !important; font-size: 0.92rem !important; width: 100% !important; justify-content: center !important; }' +
        '.hero-trust { flex-direction: column !important; gap: 8px !important; }' +
        '.trust-chip { font-size: 0.78rem !important; }' +
        '.hero .hero-photo-sm-cta { min-width: 140px !important; padding: 10px 24px !important; }' +

        /* -- About -- */
        '.about-section { padding: 48px 16px !important; }' +
        '.about-grid { grid-template-columns: 1fr !important; gap: 24px !important; }' +
        '.about-photos { min-height: 240px !important; max-width: 100% !important; }' +
        '.section-h { font-size: 1.75rem !important; }' +
        '.section-p { font-size: 0.88rem !important; }' +

        /* -- Services -- */
        '.services-section { padding: 48px 16px !important; }' +
        '.services-grid { grid-template-columns: 1fr !important; gap: 14px !important; }' +
        '.service-card { padding: 20px !important; }' +
        '.sc-name { font-size: 1.1rem !important; }' +
        '.sc-price { font-size: 1.15rem !important; }' +

        /* -- Calendar -- */
        '.cal-section { padding: 48px 16px !important; }' +
        '.cal-wrap { margin-top: 20px !important; }' +
        '.cal-grid .cal-day { min-height: 48px !important; padding: 4px !important; }' +
        '.cal-day-num { font-size: 0.7rem !important; }' +
        '.cal-event-dot { font-size: 0.55rem !important; }' +
        '.cal-dow { font-size: 0.62rem !important; padding: 4px 0 !important; }' +

        /* -- Reviews -- */
        '.reviews-section { padding: 48px 16px !important; }' +
        '.reviews-track { grid-template-columns: repeat(5, calc(88vw - 10px)) !important; gap: 12px !important; }' +
        '.review-card { padding: 20px !important; }' +

        /* -- Coming Soon / Future -- */
        '.future-section { padding: 40px 16px !important; }' +
        '.future-grid { grid-template-columns: 1fr !important; gap: 14px !important; }' +

        /* -- Footer -- */
        'footer { padding: 36px 16px 20px !important; }' +
        '.footer-grid { grid-template-columns: 1fr !important; gap: 20px !important; }' +
        '.footer-bottom { flex-direction: column !important; gap: 8px !important; text-align: center !important; }' +

        /* -- Portal sidebar: hidden, overlay when open -- */
        '#pg-owner .portal-wrap > .sidebar,' +
        '#pg-client .portal-wrap > .sidebar,' +
        '#pg-staff .portal-wrap > .sidebar,' +
        '#pg-owner .sidebar, #pg-client .sidebar, #pg-staff .sidebar,' +
        '.portal-wrap > .sidebar, div.sidebar {' +
          'display: none !important; visibility: hidden !important;' +
          'width: 0 !important; min-width: 0 !important; height: 0 !important;' +
          'overflow: hidden !important; position: absolute !important;' +
          'left: -9999px !important; pointer-events: none !important;' +
        '}' +
        '#pg-owner .sidebar.hhp-sidebar-open,' +
        '#pg-client .sidebar.hhp-sidebar-open,' +
        '#pg-staff .sidebar.hhp-sidebar-open,' +
        '.portal-wrap > .sidebar.hhp-sidebar-open,' +
        'div.sidebar.hhp-sidebar-open {' +
          'display: flex !important; visibility: visible !important;' +
          'position: fixed !important; top: 0 !important; left: 0 !important;'	ÝÚYLÈZ[\Ü[ÈZ[]ÚYLÈZ[\Ü[ÈZYÚLZ[\Ü[ÉÈ
Â	ÛX^]ÚYLÈZ[\Ü[ÈZ[^NNNHZ[\Ü[ÉÈ
Â	ØXÚÙÜÝ[ÙYÙZ[\Ü[È^Y\XÝ[ÛÛÛ[[Z[\Ü[ÉÈ
Â	ÛÝ\ÝË^N]]ÈZ[\Ü[ÈY[ÎZ[\Ü[ÈY[Ë]Ü
ÌZ[\Ü[ÉÈ
Â	ÜÚ[\Y][Î]]ÈZ[\Ü[ÉÈ
Â	ßIÈ
Â	ËÚYX\\ÚYX\[Ü[ØZ][HÉÈ
Â	Ù\Ü^N^Z[\Ü[ÈY[ÎMZ[\Ü[ÈÛ\Ú^NK
\[HZ[\Ü[ÉÈ
Â	ØÜ\XÝÛN\ÛÛYÙL
XÍHZ[\Ü[ÈX\Ú[Z[\Ü[ÉÈ
Â	ØÜ\\Y]\ÎZ[\Ü[ÈÚYL	HZ[\Ü[ÈÝ\ÛÜÚ[\Z[\Ü[ÉÈ
Â	ßIÈ
ÂÊKHÜ[[X\Ù\Ü\YÚKH
Â	Ë\Ü[Z[X\Ù\ÉÈ
Â	Ù\Ü^N^Z[\Ü[ÈÜÚ][Û^YZ[\Ü[ÉÈ
Â	ÝÜLZ[\Ü[ÈYÚLZ[\Ü[ÈÝÛN]]ÈZ[\Ü[ÈY]]ÈZ[\Ü[ÉÈ
Â	ÞZ[^LZ[\Ü[ÈÚY

Z[\Ü[ÈZYÚ

Z[\Ü[ÉÈ
Â	ØÜ\\Y]\ÎLZ[\Ü[ÈXÚÙÜÝ[\KYÛÛØÎMÙJHZ[\Ü[ÉÈ
Â	ØÛÛÜÚ]HZ[\Ü[È[YÛZ][\ÎÙ[\Z[\Ü[È\ÝYKXÛÛ[Ù[\Z[\Ü[ÉÈ
Â	ÙÛ\Ú^NZ[\Ü[ÈÞ\ÚYÝÎØJMJHZ[\Ü[ÉÈ
Â	ØÜ\ÛHZ[\Ü[ÈÝ\ÛÜÚ[\Z[\Ü[ÉÈ
Â	ßIÈ
ÂÊKHÜ[XZ[[ÚYKH
Â	ËÜ[]Ü\È\Ü^NØÚÈZ[\Ü[ÈIÈ
Â	ËÜ[]Ü\Ü[[XZ[Ü[[XZ[ÉÈ
Â	ÝÚYL	HZ[\Ü[ÈX^]ÚYL	HZ[\Ü[ÉÈ
Â	ÜY[ÎLZ[\Ü[ÈX\Ú[[YZ[\Ü[ÉÈ
Â	ßIÈ
ÂÊKHÜ[Ø\È	Ý]ÈKH
Â	ËÝ]Ë\ÝÈÈÜY][\]KXÛÛ[[ÎYYZ[\Ü[ÈØ\Z[\Ü[ÈIÈ
Â	ËÝ]XÞÈY[ÎLZ[\Ü[ÈIÈ
Â	ËÝ][[HÈÛ\Ú^NK[HZ[\Ü[ÈIÈ
Â	ËÝ][ÈÛ\Ú^N[HZ[\Ü[ÈIÈ
Â	ËØ\ÈY[ÎMZ[\Ü[ÈX\Ú[XÝÛNLZ[\Ü[ÈIÈ
Â	ËÜK\ÝÈÈÜY][\]KXÛÛ[[ÎYZ[\Ü[ÈIÈ
Â	Ë\Ü\Ý]ÈÈÜY][\]KXÛÛ[[Î\X]
YHZ[\Ü[ÈIÈ
Â	Ë\Ü\ÝÜÈÈÜY][\]KXÛÛ[[Î\X]
YHZ[\Ü[ÈIÈ
ÂÊKHÝÛ\[\KH
Â	ËÝÛ\X[\ÈY[ÎNZ[\Ü[ÈÜ\\Y]\ÎLZ[\Ü[ÈIÈ
Â	ËØ]ÜÈ^Y\XÝ[ÛÛÛ[[Z[\Ü[ÈØ\LZ[\Ü[ÈIÈ
Â	ËØZÈÛ\Ú^NKÜ[HZ[\Ü[ÈIÈ
Â	ËØ\Ý]ÈÈ^]Ü\Ü\Z[\Ü[ÈØ\LZ[\Ü[ÈIÈ
ÂÊKHXÈKH
Â	ËXÈÈ^]Ü\Ü\Z[\Ü[ÈØ\Z[\Ü[ÈIÈ
Â	ËXÈY[Î
LZ[\Ü[ÈÛ\Ú^NÍ[HZ[\Ü[ÈIÈ
ÂÊKH\Ú[Y[ÈKH
Â	Ë\\ÝÈÈ^Y\XÝ[ÛÛÛ[[Z[\Ü[È[YÛZ][\Î^\Ý\Z[\Ü[ÈØ\
Z[\Ü[ÈIÈ
Â	Ë\[Y]HÈ^X[YÛYZ[\Ü[ÈIÈ
Â	ËØXØ\È^Y\XÝ[ÛÛÛ[[Z[\Ü[È[YÛZ][\Î^\Ý\Z[\Ü[ÈØ\Z[\Ü[ÈIÈ
ÂÊKH]Z[X[]HKH
Â	Ë]Z[YÜYÈÜY][\]KXÛÛ[[Î\X]

ËYHZ[\Ü[ÈØ\ÜZ[\Ü[ÈIÈ
Â	Ë]Z[Y^HÈY[Î
Z[\Ü[ÈÛ\Ú^N\[HZ[\Ü[ÈIÈ
ÂÊKHY\ÜØYÙ\ÈKH
Â	Ë\ÙËZ[\ÙË[Ý]ÈX^]ÚY	HZ[\Ü[ÈIÈ
Â	Ë\ÙËZ[]\ÝÈÈØ\
Z[\Ü[ÈIÈ
ÂÊKH[Ù[ÈKH
Â	ËÝ\^HÈY[ÎLZ[\Ü[ÈIÈ
Â	Ë[Ù[ÈY[ÎZ[\Ü[ÈX\Ú[Z[\Ü[ÈX^ZZYÚLZ[\Ü[ÈIÈ
Â	Ë[Ù[]]HÈÛ\Ú^NK[HZ[\Ü[ÈIÈ
ÂÊKH]]Ý\^HKH
Â	Ë]]XØ\ÈY[ÎZ[\Ü[ÈX\Ú[LZ[\Ü[ÈIÈ
Â	Ë]][ÙÛÈÈÛ\Ú^NK\[HZ[\Ü[ÈIÈ
ÂÊKHØ\ÝKH
Â	ËØ\ÝÈÝÛNMZ[\Ü[ÈYÚMZ[\Ü[ÈYMZ[\Ü[ÈX^]ÚYÛHZ[\Ü[ÈIÈ
ÂÊKHØ][ÈÛÚÈ]ÛÜÚ][ÛKH
Â	ÈÙØ][ÐÛÚÐÈÝÛNMZ[\Ü[ÈYÚMZ[\Ü[ÈIÈ
ÂÊKH^[Y[Ý\ÈKH
Â	Ë^K\Ý\ÈY[ÎLZ[\Ü[ÈIÈ
Â	Ë^K\Ý\[[HÈÛ\Ú^NK[HZ[\Ü[ÈIÈ
ÂÊKHÛY[\ÝKH
Â	ËÛY[\ÝÈÈY[ÎLZ[\Ü[ÈIÈ
Â	ËÛX]HÈÚYÍZ[\Ü[ÈZYÚÍZ[\Ü[ÈÛ\Ú^NÎ[HZ[\Ü[ÈIÈ
Â	ßIÈ
ÂÊOOOOHÓPSÓH
X^

HOOOOH
Â	ÐYYXH
X^]ÚY

HÉÈ
Â	Ë\ÈÈY[Î
LZ[\Ü[ÈIÈ
Â	Ë\ÈHÈÛ\Ú^NKÜ[HZ[\Ü[ÈIÈ
Â	ËÙXÝ[ÛZÈÛ\Ú^NK
\[HZ[\Ü[ÈIÈ
Â	ËÙ\XÙKXØ\ÈY[ÎMZ[\Ü[ÈIÈ
Â	ËØË[[YHÈÛ\Ú^N\[HZ[\Ü[ÈIÈ
Â	Ë]Y]ËXØ\ÈY[ÎMNZ[\Ü[ÈIÈ
Â	ËØ[YÜYØ[Y^HÈZ[ZZYÚ
Z[\Ü[ÈIÈ
Â	ËÝ]XÞÈY[ÎZ[\Ü[ÈIÈ
Â	ËÝ][[HÈÛ\Ú^NK[HZ[\Ü[ÈIÈ
Â	ËÝ]Ë\ÝÈÈÜY][\]KXÛÛ[[ÎYYZ[\Ü[ÈIÈ
Â	ËØZÈÛ\Ú^NK\[HZ[\Ü[ÈIÈ
Â	ßIÈ
ÂÊOOOOHYH[X\Ù\Û\ÚÝÜOOOOH
Â	ÐYYXH
Z[]ÚY
Í
HÉÈ
Â	Ë\Ü[Z[X\Ù\È\Ü^NÛHZ[\Ü[ÈIÈ
Â	ßIÈ
ÂÊOOOOH]Y]ÈÛÛÝ[\ÈOOOOH
Â	Ë\]Y]ËX\ÉÈ
Â	Ù\Ü^N^ÈØ\ÈX\Ú[XÝÛNMÈY[ÎLMÉÈ
Â	ØXÚÙÜÝ[ÙYXNÈÜ\\Y]\ÎLÈ[YÛZ][\ÎÙ[\È^]Ü\Ü\ÉÈ
Â	ßIÈ
Â	Ë\]Y]ËX\]Y]Ë[X[ÈÛ]ÙZYÚ
ÌÈÛ\Ú^N\[NÈÛÛÜÌYLMNÈX\Ú[\YÚÈIÈ
Â	Ë\]Y]ËXÉÈ
Â	ÜY[ÎMÈÜ\\Y]\ÎÈÜ\K\ÛÛYØJÌKLNÉÈ
Â	ØXÚÙÜÝ[Ú]NÈÝ\ÛÜÚ[\ÈÛ\Ú^N[NÈÛ]ÙZYÚ
ÉÈ
Â	ØÛÛÜÌYLMNÈ[Ú][Û[ÎÉÈ
Â	ßIÈ
Â	Ë\]Y]ËXÝ\\]Y]ËXXÝ]HÉÈ
Â	ØXÚÙÜÝ[\KYÛÛØÎMÙJNÈÛÛÜÚ]NÈÜ\XÛÛÜ\KYÛÛØÎMÙJNÉÈ
Â	ßIÈ
Â	Ë\]Y]ËY[YK]Ü\ÉÈ
Â	ØÜ\ÛÛYØJÌKJNÈÜ\\Y]\ÎLÈÝ\ÝÎY[ÉÈ
Â	ÛX\Ú[XÝÛNÈXÚÙÜÝ[Ú]NÈ[Ú][ÛÚYÜÈX\ÙNÉÈ
Â	ÛX\Ú[[Y]]ÎÈX\Ú[\YÚ]]ÎÉÈ
Â	ßIÈ
Â	Ë\]Y]ËY[YK]Ü\Y[YHÈÚYL	NÈÜ\ÛNÈ\Ü^NØÚÎÈIÎÂØÝ[Y[XY\[Ú[
ÜÜÊNÂBËÈ8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ ËÈ
SÐSHÒQPT8 %ËX\ÙYÜÙHYH
È^]YØ][ÛËÈ8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ [Ý[Û^[Ø[TÚYX\
HÂ\\Ó[Ø[HHÚ[ÝË[\ÚYH
ÍÎÂY
Z\Ó[Ø[JH]\ÂËÈÜÙKZYH[ÚYX\ÈXH[[HÝ[BØÝ[Y[]Y\TÙ[XÝÜ[
	ËÚYX\ÊKÜXXÚ
[Ý[ÛÚYX\HÂY
\ÚYX\Û\ÜÓ\ÝÛÛZ[Ê	Ú\ÚYX\[Ü[ÊJHÂÚYX\Ý[KÙ]Ü\J	Ù\Ü^IË	ÛÛIË	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	Ý\ÚX[]IË	ÚY[Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÝÚY	Ë	Ì	Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÚZYÚ	Ë	Ì	Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÛÝ\ÝÉË	ÚY[Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÜÜÚ][ÛË	ØXÛÛ]IË	Ú[\Ü[	ÊNÂBJNÂËÈ^Ü[[X\Ù\ÜÚ][Û
Ü\YÚ
B\Ü[[X\Ù\HØÝ[Y[]Y\TÙ[XÝÜ	Ë\Ü[Z[X\Ù\ÊNÂY
Ü[[X\Ù\HÂÜ[[X\Ù\Ý[KÙ]Ü\J	ÝÜ	Ë	ÌL	Ë	Ú[\Ü[	ÊNÂÜ[[X\Ù\Ý[KÙ]Ü\J	ÜYÚ	Ë	ÌL	Ë	Ú[\Ü[	ÊNÂÜ[[X\Ù\Ý[KÙ]Ü\J	ØÝÛIË	Ø]]ÉË	Ú[\Ü[	ÊNÂÜ[[X\Ù\Ý[KÙ]Ü\J	ÛY	Ë	Ø]]ÉË	Ú[\Ü[	ÊNÂÜ[[X\Ù\Ý[KÙ]Ü\J	ÝÚY	Ë	Í
	Ë	Ú[\Ü[	ÊNÂÜ[[X\Ù\Ý[KÙ]Ü\J	ÚZYÚ	Ë	Í
	Ë	Ú[\Ü[	ÊNÂÜ[[X\Ù\Ý[KÙ]Ü\J	ØÜ\\Y]\ÉË	ÌL	Ë	Ú[\Ü[	ÊNÂÜ[[X\Ù\Ý[KÙ]Ü\J	ÞZ[^	Ë	ÌL	Ë	Ú[\Ü[	ÊNÂBËÈ[ÛÈÜÙKZYH]\YÚÛ[Ø[H
^\È^]\ÜY\ËÈÜÛÈÛ\ÜÈYÊB\]YÚHØÝ[Y[]Y\TÙ[XÝÜ	Ë]\YÚ	ÊNÂY
]YÚ
HÂ]YÚÝ[KÙ]Ü\J	Ù\Ü^IË	ÛÛIË	Ú[\Ü[	ÊNÂBËÈ[ÚYX\][\ÈÈÛÜÙHÛÛXÚÂØÝ[Y[]Y\TÙ[XÝÜ[
	ËÚYX\ØZ][IÊKÜXXÚ
[Ý[Û][JHÂY
][K]\Ù]]ÚÝ[
H]\Â][K]\Ù]]ÚÝ[H	ÝYIÎÂ][KY][\Ý[\	ØÛXÚÉË[Ý[Û
HÂÙ][Y[Ý]
[Ý[Û
HÂÛÜÙTÚYX\
NÂK
NÂJNÂJNÂËÈÝ\YHÜ[[X\Ù\ÛXÚÂY
Ü[[X\Ù\	\Ü[[X\Ù\]\Ù]]ÚÝ[
HÂÜ[[X\Ù\]\Ù]]ÚÝ[H	ÝYIÎÂ\]Ò[X\Ù\HÜ[[X\Ù\ÛÛSÙJYJNÂÜ[[X\Ù\\[ÙK\XÙPÚ[
]Ò[X\Ù\Ü[[X\Ù\NÂËÈKX\HÜÚ][ÛÝ[\ÈY\ÛÛB]Ò[X\Ù\Ý[KÙ]Ü\J	ÝÜ	Ë	ÌL	Ë	Ú[\Ü[	ÊNÂ]Ò[X\Ù\Ý[KÙ]Ü\J	ÜYÚ	Ë	ÌL	Ë	Ú[\Ü[	ÊNÂ]Ò[X\Ù\Ý[KÙ]Ü\J	ØÝÛIË	Ø]]ÉË	Ú[\Ü[	ÊNÂ]Ò[X\Ù\Ý[KÙ]Ü\J	ÛY	Ë	Ø]]ÉË	Ú[\Ü[	ÊNÂ]Ò[X\Ù\Ý[KÙ]Ü\J	ÝÚY	Ë	Í
	Ë	Ú[\Ü[	ÊNÂ]Ò[X\Ù\Ý[KÙ]Ü\J	ÚZYÚ	Ë	Í
	Ë	Ú[\Ü[	ÊNÂ]Ò[X\Ù\Ý[KÙ]Ü\J	ØÜ\\Y]\ÉË	ÌL	Ë	Ú[\Ü[	ÊNÂ]Ò[X\Ù\Ý[KÙ]Ü\J	ÞZ[^	Ë	ÌL	Ë	Ú[\Ü[	ÊNÂ]Ò[X\Ù\Ý[KÙ]Ü\J	Ù\Ü^IË	Ù^	Ë	Ú[\Ü[	ÊNÂ]Ò[X\Ù\[\SH	×LÌ	ÎÂ]Ò[X\Ù\Y][\Ý[\	ØÛXÚÉË[Ý[ÛJHÂKÝÜÜYØ][Û
NÂ\Ü[ÈHÉÜË[ÝÛ\Ë	ÜËXÛY[	Ë	ÜË\ÝY×NÂ\\Ù]ÚYX\H[ÂÜ[ËÜXXÚ
[Ý[ÛY
HÂ\Ü[HØÝ[Y[Ù][[Y[RY
Y
NÂY
Ü[	Ü[ÙÙ]\[OOH[
HÂ\ØHÜ[]Y\TÙ[XÝÜ	ËÚYX\ÊNÂY
ØH\Ù]ÚYX\HØÂBJNÂY
]\Ù]ÚYX\H]\Â\\ÓÜ[H\Ù]ÚYX\Û\ÜÓ\ÝÛÛZ[Ê	Ú\ÚYX\[Ü[ÊNÂY
\ÓÜ[HÂÛÜÙTÚYX\[
\Ù]ÚYX\NÂ]Ò[X\Ù\[\SH	×LÌ	ÎÂH[ÙHÂÜ[ÚYX\[
\Ù]ÚYX\NÂ]Ò[X\Ù\[\SH	×LÌMIÎÂËÈYÛÜÙH]ÛYÝ\Ù[Y
]\Ù]ÚYX\]Y\TÙ[XÝÜ	Ë\ÚYX\XÛÜÙK]	ÊJHÂ\ÛÜÙPHØÝ[Y[ÜX]Q[[Y[
	Ø]ÛÊNÂÛÜÙPÛ\ÜÓ[YHH	Ú\ÚYX\XÛÜÙK]	ÎÂÛÜÙP[\SH	×LÌMIÎÂÛÜÙPÝ[KÜÜÕ^H	ÜÜÚ][Û^YÝÜMÜYÚMÞZ[^LNÉÈ
Â	ØXÚÙÜÝ[ÌYLMNØÛÛÜÚ]NØÜ\ÛNÝÚYÍÚZYÚÍÉÈ
Â	ØÜ\\Y]\ÎL	NÙÛ\Ú^NK[NØÝ\ÛÜÚ[\Ù\Ü^N^ÉÈ
Â	Ø[YÛZ][\ÎÙ[\Ú\ÝYKXÛÛ[Ù[\ÉÎÂÛÜÙPY][\Ý[\	ØÛXÚÉË[Ý[Û
HÂÛÜÙTÚYX\[
\Ù]ÚYX\NÂ]Ò[X\Ù\[\SH	×LÌ	ÎÂJNÂ\Ù]ÚYX\\[
ÛÜÙPNÂBËÈ[ÚYX\][\Â\Ù]ÚYX\]Y\TÙ[XÝÜ[
	ËØZ][IÊKÜXXÚ
[Ý[Û][JHÂY
][K]\Ù]]ÚÝ[
H]\Â][K]\Ù]]ÚÝ[H	ÝYIÎÂ][KY][\Ý[\	ØÛXÚÉË[Ý[Û
HÂÙ][Y[Ý]
[Ý[Û
HÂÛÜÙTÚYX\[
\Ù]ÚYX\NÂ]Ò[X\Ù\[\SH	×LÌ	ÎÂK
NÂJNÂJNÂBJNÂBB[Ý[ÛÜ[ÚYX\[
ÚYX\HÂÚYX\Û\ÜÓ\ÝY
	Ú\ÚYX\[Ü[ÊNÂÚYX\Ý[KÙ]Ü\J	Ù\Ü^IË	Ù^	Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	Ý\ÚX[]IË	Ý\ÚXIË	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÜÜÚ][ÛË	Ù^Y	Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÝÜ	Ë	Ì	Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÛY	Ë	Ì	Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÝÚY	Ë	ÌLÉË	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÛZ[]ÚY	Ë	ÌLÉË	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÚZYÚ	Ë	ÌL	Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÞZ[^	Ë	ÎNNNIË	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ØXÚÙÜÝ[	Ë	ÈÙYÙ	Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	Ù^Y\XÝ[ÛË	ØÛÛ[[Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÛÝ\ÝË^IË	Ø]]ÉË	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÛÝ\ÝË^	Ë	ÚY[Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÜY[ÉË	Ì	Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÜY[Ë]Ü	Ë	ÍÌ	Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÜÚ[\Y][ÉË	Ø]]ÉË	Ú[\Ü[	ÊNÂØÝ[Y[ÙKÝ[KÝ\ÝÈH	ÚY[ÎÂB[Ý[ÛÛÜÙTÚYX\[
ÚYX\HÂÚYX\Û\ÜÓ\Ý[[ÝJ	Ú\ÚYX\[Ü[ÊNÂÚYX\Ý[KÙ]Ü\J	Ù\Ü^IË	ÛÛIË	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	Ý\ÚX[]IË	ÚY[Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÝÚY	Ë	Ì	Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÚZYÚ	Ë	Ì	Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÛÝ\ÝÉË	ÚY[Ë	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÜÜÚ][ÛË	ØXÛÛ]IË	Ú[\Ü[	ÊNÂÚYX\Ý[KÙ]Ü\J	ÜÚ[\Y][ÉË	ÛÛIË	Ú[\Ü[	ÊNÂØÝ[Y[ÙKÝ[KÝ\ÝÈH	ÉÎÂB[Ý[ÛÛÜÙTÚYX\
HÂØÝ[Y[]Y\TÙ[XÝÜ[
	ËÚYX\\ÚYX\[Ü[ÊKÜXXÚ
[Ý[ÛÊHÂÛÜÙTÚYX\[
ÊNÂJNÂ\HØÝ[Y[]Y\TÙ[XÝÜ	Ë\Ü[Z[X\Ù\ÊNÂY

H[\SH	×LÌ	ÎÂBËÈ8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ ËÈ
ÓÕT8 %Ù][XZ[ÈÝ\Û^Z\\]ÜÐÛXZ[ÛÛBËÈ8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ [Ý[Û^ÛÝ\[XZ[

HÂ\ÛÝ\HØÝ[Y[]Y\TÙ[XÝÜ	ÙÛÝ\ÊNÂY
YÛÝ\H]\ÂÛÝ\]Y\TÙ[XÝÜ[
	ØIÊKÜXXÚ
[Ý[ÛJHÂ\^HK^ÛÛ[[J
NÂY
^[ÛY\Ê	ÖÙ[XZ[	ÊH^[ÛY\Ê	Ù[XZ[ÝXÝY	ÊH^[ÛY\Ê	Ù[XZ[LLÝXÝY	ÊJHÂKYH	ÛXZ[ÎÝ\Û^Z\\]ÜÐÛXZ[ÛÛIÎÂK^ÛÛ[H	ÉÎÂK[\SH	×QÑQÑMÈÝ\Û^Z\\]ÜÐÛXZ[ÛÛIÎÂK[[ÝP]X]J	Ù]KXÙ[XZ[	ÊNÂKÛ\ÜÓ\Ý[[ÝJ	××ØÙÙ[XZ[×ÉÊNÂBJNÂÛÝ\]Y\TÙ[XÝÜ[
	Ë×ØÙÙ[XZ[×ËÙ]KXÙ[XZ[IÊKÜXXÚ
[Ý[Û[
HÂ[^ÛÛ[H	ÚÝ\Û^Z\\]ÜÐÛXZ[ÛÛIÎÂ[[[ÝP]X]J	Ù]KXÙ[XZ[	ÊNÂJNÂBËÈ8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ ËÈ
ËQUÔÔUQUÈ8 %[XÝ[ÈY]ÙXÚ]HYÙBËÈ8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ [Ý[Û[XÝ]Y]ÕÛÛ

HÂ\Y][[HØÝ[Y[Ù][[Y[RY
	ÛËYY]\Ú]IÊNÂY
YY][[
H]\ÂY
Y][[]Y\TÙ[XÝÜ	Ë\]Y]ËX\ÊJH]\Â\\HØÝ[Y[ÜX]Q[[Y[
	Ù]ÊNÂ\Û\ÜÓ[YHH	Ú\]Y]ËX\ÎÂ\[\SH	ÏÜ[Û\ÜÏH]Y]Ë[X[]Y]ÈÚ]NÜÜ[È
Â	Ï]ÛÛ\ÜÏH\]Y]ËXXÝ]H]K]ÚYHL	H]KZZYÚH\ÚÝÜØ]ÛÈ
Â	Ï]ÛÛ\ÜÏH\]Y]ËX]K]ÚYHÍ]KZZYÚHX]Ø]ÛÈ
Â	Ï]ÛÛ\ÜÏH\]Y]ËX]K]ÚYHÍÍ\]KZZYÚHÈÛOØ]ÛÎÂ\Ü\HØÝ[Y[ÜX]Q[[Y[
	Ù]ÊNÂÜ\Û\ÜÓ[YHH	Ú\]Y]ËY[YK]Ü\	ÎÂÜ\Ý[KÚYH	ÌL	IÎÂÜ\Ý[KZYÚH	Í	ÎÂ\Y[YHHØÝ[Y[ÜX]Q[[Y[
	ÚY[YIÊNÂY[YKÜÈHÚ[ÝËØØ][ÛÜYÚ[
È	ËÏÜ]Y]ÏLIÎÂY[YKÝ[KZYÚH	ÌL	IÎÂY[YK]HH	ÔÚ]H]Y]ÉÎÂÜ\\[Ú[
Y[YJNÂ\\ÝÚ[HY][[\ÝÚ[ÂY][[[Ù\YÜJÜ\\ÝÚ[
NÂY][[[Ù\YÜJ\Ü\
NÂ\]Y\TÙ[XÝÜ[
	Ë\]Y]ËXÊKÜXXÚ
[Ý[ÛHÂY][\Ý[\	ØÛXÚÉË[Ý[Û
HÂ\]Y\TÙ[XÝÜ[
	Ë\]Y]ËXÊKÜXXÚ
[Ý[ÛHÈÛ\ÜÓ\Ý[[ÝJ	ØXÝ]IÊNÈJNÂÛ\ÜÓ\ÝY
	ØXÝ]IÊNÂÜ\Ý[KÚYHÙ]]X]J	Ù]K]ÚY	ÊNÂÜ\Ý[KZYÚHÙ]]X]J	Ù]KZZYÚ	ÊH
È	Ü	ÎÂY[YKÝ[KZYÚH	ÌL	IÎÂJNÂJNÂBËÈ8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ ËÈSUËÈ8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ ÛXYJ[Ý[Û
HÂ[XÝ[ÔÔÊ
NÂ^ÜY][ÜÊ
NÂ^ÛÝ\[XZ[

NÂ^[Ø[TÚYX\
NÂ[XÝ]Y]ÕÛÛ

NÂËÈKXÚXÚÈÜY]ÙXÚ]H[[Ú[XÈÚ[ÙBØÝ[Y[Y][\Ý[\	ØÛXÚÉË[Ý[ÛJHÂY
K\Ù]	
K\Ù]Û\ÜÓ\ÝÛÛZ[Ê	ÜØZ][IÊHK\Ù]ÛÜÙ\Ý
	ËØZ][IÊJJHÂÙ][Y[Ý]
[XÝ]Y]ÕÛÛÌ
NÂBJNÂËÈKX\H[Ø[HÚYX\^Û\Ú^BÚ[ÝËY][\Ý[\	Ü\Ú^IË[Ý[Û
HÂY
Ú[ÝË[\ÚYH
ÍÊHÂ^[Ø[TÚYX\
NÂH[ÙHÂËÈÛ\ÚÝÜXZÙHÝ\H]\YÚ\È\ÚXHYØZ[\]YÚHØÝ[Y[]Y\TÙ[XÝÜ	Ë]\YÚ	ÊNÂY
]YÚ
H]YÚÝ[K[[ÝTÜ\J	Ù\Ü^IÊNÂBJNÂÛÛÛÛKÙÊ	×QÑQÌQHV]ÚH\YY
ÛÛ\Z[Ú]H[Ø[H
ÈÜY][ÜÈ
È\È
ÈÛÝ\
È]Y]ÊIÊNÂJNÂJJ
NÂ
