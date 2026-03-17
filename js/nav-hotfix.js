/* nav-hotfix.js — fixes for mobile hamburger visibility and viewSwitcher height */
(function() {
  'use strict';

  // 1. Add CSS fixes
  var style = document.createElement('style');
  style.id = 'nav-hotfix-css';
  style.textContent = [
    '/* Fix viewSwitcher and navRight height collapse on desktop */',
    '#mainNav .nav-right { height: auto !important; min-height: 30px !important; }',
    '#mainNav #viewSwitcher { height: auto !important; min-height: 28px !important; }',
    '',
    '/* Mobile: show hamburger, hide nav links and view-switcher */',
    '@media (max-width: 768px) {',
    '  .hhp-hamburger-v10 {',
    '    display: block !important;',
    '    position: absolute !important;',
    '    right: 16px !important;',
    '    top: 50% !important;',
    '    transform: translateY(-50%) !important;',
    '    z-index: 1001 !important;',
    '    background: none !important;',
    '    border: none !important;',
    '    cursor: pointer !important;',
    '    padding: 8px !important;',
    '    width: 40px !important;',
    '    height: 40px !important;',
    '  }',
    '  #mainNav .nav-right { display: none !important; }',
    '  #mainNav .nav-center { display: none !important; }',
    '}'
  ].join('\n');
  document.head.appendChild(style);

  // 2. Persistent fix: ensure viewSwitcher height on desktop
  function fixDesktopNav() {
    if (window.innerWidth > 768) {
      var vs = document.getElementById('viewSwitcher');
      if (vs && vs.getBoundingClientRect().height < 5) {
        vs.style.setProperty('height', 'auto', 'important');
        vs.style.setProperty('min-height', '28px', 'important');
      }
      var nr = document.querySelector('#mainNav .nav-right');
      if (nr && nr.getBoundingClientRect().height < 5) {
        nr.style.setProperty('height', 'auto', 'important');
        nr.style.setProperty('min-height', '30px', 'important');
      }
    }
  }

  // Run fix after DOM ready and periodically
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(fixDesktopNav, 500);
    });
  } else {
    setTimeout(fixDesktopNav, 500);
  }
  setInterval(fixDesktopNav, 2000);
})();
