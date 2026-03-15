// ============================================================
// Housley Happy Paws â UX Patch (ux-patch.js)
// 1. Fix greeting emojis (garbled from encoding) + add decorative icons
// 2. Hero: shrink slideshow, enlarge text & Meet button
// 3. About Rachel: enlarge slideshow
// ============================================================
(function() {
  'use strict';

  function onReady(fn) {
    if (document.readyState !== 'loading') setTimeout(fn, 800);
    else document.addEventListener('DOMContentLoaded', function() { setTimeout(fn, 800); });
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // 1. FIX GREETINGS â replace garbled emoji with proper icons
  // âââââââââââââââââââââââââââââââââââââââââââââââ
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

    // Re-check every 60 seconds
    setTimeout(fixGreetings, 60000);
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // 2. HERO â shrink slideshow, enlarge text & button
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  function fixHero() {
    var css = document.createElement('style');
    css.id = 'hhp-ux-patch-css';
    css.textContent =
      /* Hero grid: give text more space, shrink photo */
      '.hero { grid-template-columns: 1.2fr 0.8fr !important; }' +

      /* Hero photo column: constrain and add rounded corners */
      '.hero .hero-photo-col { max-width: 500px !important; justify-self: center !important; }' +

      /* Hero heading: bigger on desktop */
      '.hero h1 { font-size: 4.5rem !important; line-height: 1.05 !important; }' +

      /* Hero subtitle / description: slightly larger */
      '.hero .hero-sub, .hero p:not(.trust-row):not(.section-eyebrow) { font-size: 1.15rem !important; line-height: 1.6 !important; }' +

      /* Meet & Greet button: bigger to match page style */
      '.hero .btn-ink { padding: 18px 42px !important; font-size: 1.1rem !important; border-radius: 14px !important; }' +
      '.hero .btn-outline { padding: 16px 36px !important; font-size: 1.05rem !important; border-radius: 14px !important; }' +

      /* About Rachel slideshow: bigger */
      '.about-grid { grid-template-columns: 1fr 1fr !important; }' +
      '.about-photos { min-height: 440px !important; border-radius: 18px !important; }' +
      '.about-photos img { object-fit: cover !important; width: 100% !important; height: 100% !important; }' +

      /* Mobile overrides */
      '@media (max-width: 767px) {' +
        '.hero { grid-template-columns: 1fr !important; }' +
        '.hero h1 { font-size: 2.2rem !important; }' +
        '.hero .hero-photo-col { max-width: 100% !important; }' +
        '.hero .btn-ink { padding: 16px 32px !important; font-size: 1rem !important; }' +
        '.about-grid { grid-template-columns: 1fr !important; }' +
        '.about-photos { min-height: 280px !important; }' +
      '}' +

      /* Tablet overrides */
      '@media (min-width: 768px) and (max-width: 1024px) {' +
        '.hero { grid-template-columns: 1fr 1fr !important; }' +
        '.hero h1 { font-size: 3rem !important; }' +
        '.about-photos { min-height: 360px !important; }' +
      '}';

    document.head.appendChild(css);
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // INIT
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  onReady(function() {
    fixHero();
    fixGreetings();
    console.log('\u{1F41E} HHP UX Patch applied (greetings + hero + about)');
  });

})();
