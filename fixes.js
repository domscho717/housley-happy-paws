// Add Home, Client View, Staff View to Owner Portal sidebar drawer
(function() {
  function patchDrawer() {
    var drawer = document.querySelector('.hhp-drawer');
    if (!drawer) return;
    var header = drawer.querySelector('.hhp-drawer-header');
    if (!header) return;
    // Check if already patched
    if (drawer.querySelector('[data-fixes-added]')) return;
    // Helper to create a drawer item button
    function makeItem(emoji, label, clickFn) {
      var btn = document.createElement('button');
      btn.className = 'hhp-drawer-item';
      btn.setAttribute('data-fixes-added', 'true');
      btn.innerHTML = emoji + label;
      btn.addEventListener('click', clickFn);
      return btn;
    }
    // Home button ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ at the very top after header
    var homeBtn = makeItem(String.fromCodePoint(0x1F3E0) + ' ', 'Home', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'public'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    header.after(homeBtn);
    // Divider after Home
    var divider = document.createElement('div');
    divider.style.cssText = 'border-bottom:1px solid #e5d5c0;margin:4px 0;';
    divider.setAttribute('data-fixes-added', 'true');
    homeBtn.after(divider);
    // Client View button ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ after Edit Link Page (last item)
    var allItems = drawer.querySelectorAll('.hhp-drawer-item:not([data-fixes-added])');
    var lastItem = allItems[allItems.length - 1];
    // Add divider before view switches
    var divider2 = document.createElement('div');
    divider2.style.cssText = 'border-bottom:1px solid #e5d5c0;margin:4px 0;';
    divider2.setAttribute('data-fixes-added', 'true');
    lastItem.after(divider2);
    var clientBtn = makeItem(String.fromCodePoint(0x1F464) + ' ', 'Client View', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'client'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    divider2.after(clientBtn);
    var staffBtn = makeItem(String.fromCodePoint(0x1F477) + ' ', 'Staff View', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'staff'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    clientBtn.after(staffBtn);
    // Owner View button - to switch back to owner dashboard
    var ownerBtn = makeItem(String.fromCodePoint(0x1F451) + ' ', 'Owner View', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'owner'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    staffBtn.after(ownerBtn);
  }
  setTimeout(patchDrawer, 1000);
  setTimeout(patchDrawer, 3000);
  setTimeout(patchDrawer, 5000);
  new MutationObserver(function() { patchDrawer(); }).observe(document.body, {childList: true, subtree: true});
})();
// ============================================================
// Housley Happy Paws - Function Overrides (fixes.js)
// Fixes AI Studio + Editor bugs by overriding broken functions
// ============================================================

// Override sendAI to use server-side proxy instead of direct Anthropic API
async function sendAI() {
  const input = document.getElementById('aiInput');
  const msg = (input?.value || '').trim();
  if (!msg) return;
  input.value = '';
  appendAIMsg('user', msg);
  aiHistory.push({ role: 'user', content: msg });
  showAITyping();
  try {
    const res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: AI_SYSTEM,
        messages: aiHistory,
        max_tokens: 1000
      })
    });
    const data = await res.json();
    hideAITyping();
    if (!res.ok) {
      appendAIMsg('assistant', data.error || "Something went wrong. Try again!");
      return;
    }
    const reply = data.content?.map(b => b.text || '').join('') || "Sorry, couldn't connect. Try again!";
    aiHistory.push({ role: 'assistant', content: reply });
    appendAIMsg('assistant', reply);
  } catch (err) {
    hideAITyping();
    appendAIMsg('assistant', "Hmm, couldn't connect right now. Check your internet and try again!");
  }
}

// Override aiRewrite to call AI directly and apply results to editor fields
// WITHOUT navigating away from the Edit Website tab
async function aiRewrite(section) {
  const prompts = {
    hero: 'Rewrite the hero headline and intro paragraph for Housley Happy Paws. Make it warm, professional, compelling. Return ONLY a JSON object with keys: heroH1, heroPara. No markdown, no explanation, just the JSON.',
    about: 'Rewrite the About Rachel section. Make it personal, warm, professional. Return ONLY a JSON object with keys: aboutP1 (paragraph 1), aboutP2 (paragraph 2), aboutQuote (a memorable Rachel quote). No markdown, no explanation, just the JSON.',
    services: 'Rewrite the service descriptions for Dog Walking, Drop-In Visits, Dog Boarding, and Cat Care. Each 2-3 sentences. Return ONLY a JSON object with keys: svcWalk, svcDropIn, svcBoard, svcCat. No markdown, no explanation, just the JSON.'
  };
  const prompt = prompts[section] || 'Help me improve the ' + section + ' section. Return ONLY a JSON object with the improved text for each field. No markdown, no explanation.';

  // Show a loading indicator on the rewrite button
  const panel = document.getElementById('ce-' + section);
  const btns = panel?.querySelectorAll('button');
  const rewriteBtn = Array.from(btns || []).find(b => b.textContent.includes('Rewrite'));
  const origText = rewriteBtn?.textContent;
  if (rewriteBtn) {
    rewriteBtn.textContent = 'Rewriting...';
    rewriteBtn.disabled = true;
  }

  try {
    const res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: 'You are a copywriter for Housley Happy Paws, a pet care business in Lancaster PA owned by Rachel Housley. Write warm, professional, compelling copy. Always return valid JSON only.',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000
      })
    });
    const data = await res.json();
    if (!res.ok) {
      toast('AI rewrite failed: ' + (data.error || 'Unknown error'));
      return;
    }
    const text = data.content?.map(b => b.text || '').join('') || '';

    // Parse the JSON response
    let parsed;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (e) {
      toast('AI returned unexpected format. Check AI Studio for the full response.');
      // Fall back to showing in AI Studio
      aiHistory.push({ role: 'user', content: prompt });
      aiHistory.push({ role: 'assistant', content: text });
      return;
    }

    // Apply parsed values to the editor fields
    if (panel) {
      Object.keys(parsed).forEach(key => {
        const field = panel.querySelector('[data-field="' + key + '"]');
        if (field) {
          if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
            field.value = parsed[key];
          } else {
            field.textContent = parsed[key];
          }
        }
      });
      toast('AI rewrote the ' + section + ' section! Review and click Save when ready.');
    }
  } catch (err) {
    toast('Could not connect to AI. Please try again.');
  } finally {
    if (rewriteBtn) {
      rewriteBtn.textContent = origText;
      rewriteBtn.disabled = false;
    }
  }
}

// Override aiQuick to NOT navigate away from the current tab
function aiQuick(msg) {
  const inp = document.getElementById('aiInput');
  if (inp) inp.value = msg;
  // Only switch to AI Studio if we're not on the content editor
  const contentPanel = document.getElementById('o-content');
  if (contentPanel && contentPanel.style.display !== 'none') {
    // We're on the content editor - just send the message without switching
    sendAI();
  } else {
    sTab('o', 'o-studio');
    setTimeout(sendAI, 100);
  }
}

console.log('[fixes.js] Function overrides loaded successfully');

// Load UI enhancements (role-based dropdown, remember me, floating booking, synced services)
var _enhScript = document.createElement('script'); _enhScript.src = '/js/enhancements.js'; _enhScript.defer = true; document.head.appendChild(_enhScript);

// Load gallery & slideshow features (About slideshow, Hero carousel, photo gallery, staff gallery)
var _galScript = document.createElement('script'); _galScript.src = '/js/gallery.js'; _galScript.defer = true; document.head.appendChild(_galScript);
var _uxScript = document.createElement('script'); _uxScript.src = '/js/ux-upgrades.js'; _uxScript.defer = true; document.head.appendChild(_uxScript);

var _patchScript = document.createElement('script'); _patchScript.src = '/ux-patch.js'; _patchScript.defer = true; document.head.appendChild(_patchScript);

// Hide Owner Portal dropdown button on desktop (CSS fix for timing issue)
var _fixStyle = document.createElement('style');
_fixStyle.textContent = '@media (min-width: 768px) { #hhp-portal-nav { display: none !important; } }';

// Ensure mobile nav overlay is always visible when open
(function fixHamburgerMenu() {
  document.addEventListener("click", function(e) {
    var target = e.target.closest(".hhp-hamburger-v10");
    if (!target) return;
    setTimeout(function() {
      var nav = document.querySelector(".hhp-mobile-nav-v10");
      if (nav) {
        nav.style.setProperty("display", "flex", "important");
        nav.style.setProperty("position", "fixed", "important");
        nav.style.setProperty("z-index", "99999", "important");
        nav.style.setProperty("top", "0", "important");
        nav.style.setProperty("left", "0", "important");
        nav.style.setProperty("width", "100vw", "important");
        nav.style.setProperty("height", "100vh", "important");
        nav.style.setProperty("visibility", "visible", "important");
        nav.style.setProperty("opacity", "1", "important");
        nav.style.setProperty("flex-direction", "column", "important");
        nav.style.setProperty("align-items", "center", "important");
        nav.style.setProperty("justify-content", "center", "important");
        nav.style.setProperty("background", "rgba(0,0,0,0.95)", "important");
        nav.classList.add("hhp-mnav-open");
      }
    }, 50);
  }, true);
})();

// Remove duplicate empty drawers created by ux-patch.js running twice
(function() {
  function cleanDuplicateDrawers() {
    var drawers = document.querySelectorAll('.hhp-drawer');
    if (drawers.length > 1) {
      for (var i = 1; i < drawers.length; i++) {
        if (!drawers[i].querySelector('.hhp-drawer-item')) {
          drawers[i].remove();
        }
      }
    }
  }
  setTimeout(cleanDuplicateDrawers, 2000);
  setTimeout(cleanDuplicateDrawers, 4000);
  setTimeout(cleanDuplicateDrawers, 6000);
})();
document.head.appendChild(_fixStyle);

// NUKE left drawer-tab hamburger completely (CSS + DOM removal + observer)
(function() {
    var s = document.createElement('style');
    s.textContent = '.hhp-drawer-tab, .hhp-drawer-tab.hhp-drawer-tab-visible { display:none!important;visibility:hidden!important;width:0!important;height:0!important;pointer-events:none!important; }';
    document.head.appendChild(s);
    function killTab() { var t = document.querySelector('.hhp-drawer-tab'); if (t) t.remove(); }
    killTab();
    setTimeout(killTab, 500);
    setTimeout(killTab, 1500);
    setTimeout(killTab, 3000);
    new MutationObserver(killTab).observe(document.body, {childList:true, subtree:true});
})();

// Fix Home link in mobile menu to go back to public home page
(function() {
    function fixHome() {
          var homeLink = document.querySelector('.hhp-mobile-nav-v10 [data-scroll="home"]');
          if (!homeLink) return;
          homeLink.setAttribute('href', '/');
          homeLink.removeAttribute('data-scroll');
          homeLink.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); window.location.href = '/'; });
    }
    // Retry since mobile nav is created by ux-patch.js which loads after fixes.js
    setTimeout(fixHome, 1000);
    setTimeout(fixHome, 3000);
    setTimeout(fixHome, 5000);
})();

// Clean up mobile menu: remove Switch View, add Client/Staff view links
(function() {
  var done = false;
  function cleanMobileMenu() {
    if (done) return;
    var nav = document.querySelector('.hhp-mobile-nav-v10');
    if (!nav) return;
    done = true;
    // Remove Switch View dropdown
    var allDivs = nav.querySelectorAll('div');
    for (var i = 0; i < allDivs.length; i++) {
      if (allDivs[i].querySelector('select')) { allDivs[i].remove(); break; }
    }
    // Find the divider to insert after
    var divider = nav.querySelector('.hhp-mnav-divider');
    if (!divider) return;
    // Create Client View link
    var clientLink = document.createElement('a');
    clientLink.href = '#';
    clientLink.className = 'hhp-mnav-link';
    clientLink.textContent = 'Client View';
    clientLink.addEventListener('click', function(e) {
      e.preventDefault();
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'client'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = nav.querySelector('.hhp-mnav-close');
      if (closeBtn) closeBtn.click();
    });
    // Create Staff View link
    var staffLink = document.createElement('a');
    staffLink.href = '#';
    staffLink.className = 'hhp-mnav-link';
    staffLink.textContent = 'Staff View';
    staffLink.addEventListener('click', function(e) {
      e.preventDefault();
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'staff'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = nav.querySelector('.hhp-mnav-close');
      if (closeBtn) closeBtn.click();
    });
    // Insert after divider
    divider.parentNode.insertBefore(clientLink, divider.nextSibling);
    clientLink.parentNode.insertBefore(staffLink, clientLink.nextSibling);
    // Also fix Home link with MutationObserver approach
    var homeLink = nav.querySelector('[data-scroll="home"]') || nav.querySelector('a.hhp-mnav-link');
    if (homeLink && (homeLink.textContent.trim() === 'Home' || homeLink.getAttribute('data-scroll') === 'home')) {
      homeLink.setAttribute('href', '/');
      homeLink.removeAttribute('data-scroll');
      homeLink.onclick = function(e) { e.preventDefault(); e.stopPropagation(); window.location.href = '/'; };
    }
  }
  setTimeout(cleanMobileMenu, 1000);
  setTimeout(cleanMobileMenu, 3000);
  setTimeout(cleanMobileMenu, 5000);
  new MutationObserver(function() { cleanMobileMenu(); }).observe(document.body, {childList: true, subtree: true});
})();


/* === Service Grid Dedup + Meet & Greet Fix === */
(function fixServiceGrid() {
  function cleanup() {
    /* Remove duplicate services-grid created by ux-patch.js */
    var grids = document.querySelectorAll(".services-grid");
    if (grids.length > 1) {
      for (var i = 1; i < grids.length; i++) grids[i].remove();
    }
    /* Ensure Meet & Greet card is inside the grid */
    var grid = document.querySelector(".services-grid");
    if (!grid) return;
    var hasMG = false;
    var cards = grid.querySelectorAll(".service-card");
    for (var c = 0; c < cards.length; c++) {
      var n = cards[c].querySelector(".sc-name");
      if (n && n.textContent.indexOf("Meet") >= 0 && n.textContent.indexOf("Greet") >= 0) hasMG = true;
    }
    if (!hasMG) {
      var card = document.createElement("div");
      card.className = "service-card fadeup";
      card.innerHTML = '<div class="sc-icon">' + String.fromCodePoint(0x1F91D) + '</div>' +
        '<div class="sc-name">Meet &amp; Greet</div>' +
        '<div class="sc-price">Free</div>' +
        '<div class="sc-desc">An introductory visit so your pet can get comfortable with their new sitter. We\u2019ll go over your pet\u2019s routine, preferences, and any special needs.</div>' +
        '<ul class="sc-features"><li>In-home introduction with your pet</li>' +
        '<li>Review feeding, walking &amp; medication routines</li>' +
        '<li>Exchange keys &amp; emergency contacts</li>' +
        '<li>No obligation \u2014 just a chance to meet!</li></ul>';
      grid.appendChild(card);
    }
    /* Remove any loose Meet & Greet cards outside the grid */
    var allCards = document.querySelectorAll(".service-card");
    for (var j = 0; j < allCards.length; j++) {
      if (!allCards[j].closest(".services-grid")) allCards[j].remove();
    }
  }
  /* Run cleanup after ux-patch.js finishes (multiple delays for safety) */
  [2000, 5000, 8000].forEach(function(d) { setTimeout(cleanup, d); });
  /* Also observe for dynamic grid additions */
  var obs = new MutationObserver(function() {
    var grids = document.querySelectorAll(".services-grid");
    if (grids.length > 1) cleanup();
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();


// Add Home, Client View, Staff View to Owner Portal sidebar drawer
(function() {
  function patchDrawer() {
    var drawer = document.querySelector('.hhp-drawer');
    if (!drawer) return;
    var header = drawer.querySelector('.hhp-drawer-header');
    if (!header) return;
    // Check if already patched
    if (drawer.querySelector('[data-fixes-added]')) return;
    // Helper to create a drawer item button
    function makeItem(emoji, label, clickFn) {
      var btn = document.createElement('button');
      btn.className = 'hhp-drawer-item';
      btn.setAttribute('data-fixes-added', 'true');
      btn.innerHTML = emoji + label;
      btn.addEventListener('click', clickFn);
      return btn;
    }
    // Home button ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ at the very top after header
    var homeBtn = makeItem(String.fromCodePoint(0x1F3E0) + ' ', 'Home', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'public'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    header.after(homeBtn);
    // Divider after Home
    var divider = document.createElement('div');
    divider.style.cssText = 'border-bottom:1px solid #e5d5c0;margin:4px 0;';
    divider.setAttribute('data-fixes-added', 'true');
    homeBtn.after(divider);
    // Client View button ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ after Edit Link Page (last item)
    var allItems = drawer.querySelectorAll('.hhp-drawer-item:not([data-fixes-added])');
    var lastItem = allItems[allItems.length - 1];
    // Add divider before view switches
    var divider2 = document.createElement('div');
    divider2.style.cssText = 'border-bottom:1px solid #e5d5c0;margin:4px 0;';
    divider2.setAttribute('data-fixes-added', 'true');
    lastItem.after(divider2);
    var clientBtn = makeItem(String.fromCodePoint(0x1F464) + ' ', 'Client View', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'client'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    divider2.after(clientBtn);
    var staffBtn = makeItem(String.fromCodePoint(0x1F477) + ' ', 'Staff View', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'staff'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    clientBtn.after(staffBtn);
    // Owner View button - to switch back to owner dashboard
    var ownerBtn = makeItem(String.fromCodePoint(0x1F451) + ' ', 'Owner View', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'owner'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    staffBtn.after(ownerBtn);
  }
  setTimeout(patchDrawer, 1000);
  setTimeout(patchDrawer, 3000);
  setTimeout(patchDrawer, 5000);
  new MutationObserver(function() { patchDrawer(); }).observe(document.body, {childList: true, subtree: true});
})();
// ============================================================
// Housley Happy Paws - Function Overrides (fixes.js)
// Fixes AI Studio + Editor bugs by overriding broken functions
// ============================================================

// Override sendAI to use server-side proxy instead of direct Anthropic API
async function sendAI() {
  const input = document.getElementById('aiInput');
  const msg = (input?.value || '').trim();
  if (!msg) return;
  input.value = '';
  appendAIMsg('user', msg);
  aiHistory.push({ role: 'user', content: msg });
  showAITyping();
  try {
    const res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: AI_SYSTEM,
        messages: aiHistory,
        max_tokens: 1000
      })
    });
    const data = await res.json();
    hideAITyping();
    if (!res.ok) {
      appendAIMsg('assistant', data.error || "Something went wrong. Try again!");
      return;
    }
    const reply = data.content?.map(b => b.text || '').join('') || "Sorry, couldn't connect. Try again!";
    aiHistory.push({ role: 'assistant', content: reply });
    appendAIMsg('assistant', reply);
  } catch (err) {
    hideAITyping();
    appendAIMsg('assistant', "Hmm, couldn't connect right now. Check your internet and try again!");
  }
}

// Override aiRewrite to call AI directly and apply results to editor fields
// WITHOUT navigating away from the Edit Website tab
async function aiRewrite(section) {
  const prompts = {
    hero: 'Rewrite the hero headline and intro paragraph for Housley Happy Paws. Make it warm, professional, compelling. Return ONLY a JSON object with keys: heroH1, heroPara. No markdown, no explanation, just the JSON.',
    about: 'Rewrite the About Rachel section. Make it personal, warm, professional. Return ONLY a JSON object with keys: aboutP1 (paragraph 1), aboutP2 (paragraph 2), aboutQuote (a memorable Rachel quote). No markdown, no explanation, just the JSON.',
    services: 'Rewrite the service descriptions for Dog Walking, Drop-In Visits, Dog Boarding, and Cat Care. Each 2-3 sentences. Return ONLY a JSON object with keys: svcWalk, svcDropIn, svcBoard, svcCat. No markdown, no explanation, just the JSON.'
  };
  const prompt = prompts[section] || 'Help me improve the ' + section + ' section. Return ONLY a JSON object with the improved text for each field. No markdown, no explanation.';

  // Show a loading indicator on the rewrite button
  const panel = document.getElementById('ce-' + section);
  const btns = panel?.querySelectorAll('button');
  const rewriteBtn = Array.from(btns || []).find(b => b.textContent.includes('Rewrite'));
  const origText = rewriteBtn?.textContent;
  if (rewriteBtn) {
    rewriteBtn.textContent = 'Rewriting...';
    rewriteBtn.disabled = true;
  }

  try {
    const res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: 'You are a copywriter for Housley Happy Paws, a pet care business in Lancaster PA owned by Rachel Housley. Write warm, professional, compelling copy. Always return valid JSON only.',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000
      })
    });
    const data = await res.json();
    if (!res.ok) {
      toast('AI rewrite failed: ' + (data.error || 'Unknown error'));
      return;
    }
    const text = data.content?.map(b => b.text || '').join('') || '';

    // Parse the JSON response
    let parsed;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (e) {
      toast('AI returned unexpected format. Check AI Studio for the full response.');
      // Fall back to showing in AI Studio
      aiHistory.push({ role: 'user', content: prompt });
      aiHistory.push({ role: 'assistant', content: text });
      return;
    }

    // Apply parsed values to the editor fields
    if (panel) {
      Object.keys(parsed).forEach(key => {
        const field = panel.querySelector('[data-field="' + key + '"]');
        if (field) {
          if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
            field.value = parsed[key];
          } else {
            field.textContent = parsed[key];
          }
        }
      });
      toast('AI rewrote the ' + section + ' section! Review and click Save when ready.');
    }
  } catch (err) {
    toast('Could not connect to AI. Please try again.');
  } finally {
    if (rewriteBtn) {
      rewriteBtn.textContent = origText;
      rewriteBtn.disabled = false;
    }
  }
}

// Override aiQuick to NOT navigate away from the current tab
function aiQuick(msg) {
  const inp = document.getElementById('aiInput');
  if (inp) inp.value = msg;
  // Only switch to AI Studio if we're not on the content editor
  const contentPanel = document.getElementById('o-content');
  if (contentPanel && contentPanel.style.display !== 'none') {
    // We're on the content editor - just send the message without switching
    sendAI();
  } else {
    sTab('o', 'o-studio');
    setTimeout(sendAI, 100);
  }
}

console.log('[fixes.js] Function overrides loaded successfully');

// Load UI enhancements (role-based dropdown, remember me, floating booking, synced services)
var _enhScript = document.createElement('script'); _enhScript.src = '/js/enhancements.js'; _enhScript.defer = true; document.head.appendChild(_enhScript);

// Load gallery & slideshow features (About slideshow, Hero carousel, photo gallery, staff gallery)
var _galScript = document.createElement('script'); _galScript.src = '/js/gallery.js'; _galScript.defer = true; document.head.appendChild(_galScript);
var _uxScript = document.createElement('script'); _uxScript.src = '/js/ux-upgrades.js'; _uxScript.defer = true; document.head.appendChild(_uxScript);

var _patchScript = document.createElement('script'); _patchScript.src = '/ux-patch.js'; _patchScript.defer = true; document.head.appendChild(_patchScript);

// Hide Owner Portal dropdown button on desktop (CSS fix for timing issue)
var _fixStyle = document.createElement('style');
_fixStyle.textContent = '@media (min-width: 768px) { #hhp-portal-nav { display: none !important; } }';

// Ensure mobile nav overlay is always visible when open
(function fixHamburgerMenu() {
  document.addEventListener("click", function(e) {
    var target = e.target.closest(".hhp-hamburger-v10");
    if (!target) return;
    setTimeout(function() {
      var nav = document.querySelector(".hhp-mobile-nav-v10");
      if (nav) {
        nav.style.setProperty("display", "flex", "important");
        nav.style.setProperty("position", "fixed", "important");
        nav.style.setProperty("z-index", "99999", "important");
        nav.style.setProperty("top", "0", "important");
        nav.style.setProperty("left", "0", "important");
        nav.style.setProperty("width", "100vw", "important");
        nav.style.setProperty("height", "100vh", "important");
        nav.style.setProperty("visibility", "visible", "important");
        nav.style.setProperty("opacity", "1", "important");
        nav.style.setProperty("flex-direction", "column", "important");
        nav.style.setProperty("align-items", "center", "important");
        nav.style.setProperty("justify-content", "center", "important");
        nav.style.setProperty("background", "rgba(0,0,0,0.95)", "important");
        nav.classList.add("hhp-mnav-open");
      }
    }, 50);
  }, true);
})();

// Remove duplicate empty drawers created by ux-patch.js running twice
(function() {
  function cleanDuplicateDrawers() {
    var drawers = document.querySelectorAll('.hhp-drawer');
    if (drawers.length > 1) {
      for (var i = 1; i < drawers.length; i++) {
        if (!drawers[i].querySelector('.hhp-drawer-item')) {
          drawers[i].remove();
        }
      }
    }
  }
  setTimeout(cleanDuplicateDrawers, 2000);
  setTimeout(cleanDuplicateDrawers, 4000);
  setTimeout(cleanDuplicateDrawers, 6000);
})();
document.head.appendChild(_fixStyle);

// NUKE left drawer-tab hamburger completely (CSS + DOM removal + observer)
(function() {
    var s = document.createElement('style');
    s.textContent = '.hhp-drawer-tab, .hhp-drawer-tab.hhp-drawer-tab-visible { display:none!important;visibility:hidden!important;width:0!important;height:0!important;pointer-events:none!important; }';
    document.head.appendChild(s);
    function killTab() { var t = document.querySelector('.hhp-drawer-tab'); if (t) t.remove(); }
    killTab();
    setTimeout(killTab, 500);
    setTimeout(killTab, 1500);
    setTimeout(killTab, 3000);
    new MutationObserver(killTab).observe(document.body, {childList:true, subtree:true});
})();

// Fix Home link in mobile menu to go back to public home page
(function() {
    function fixHome() {
          var homeLink = document.querySelector('.hhp-mobile-nav-v10 [data-scroll="home"]');
          if (!homeLink) return;
          homeLink.setAttribute('href', '/');
          homeLink.removeAttribute('data-scroll');
          homeLink.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); window.location.href = '/'; });
    }
    // Retry since mobile nav is created by ux-patch.js which loads after fixes.js
    setTimeout(fixHome, 1000);
    setTimeout(fixHome, 3000);
    setTimeout(fixHome, 5000);
})();

// Clean up mobile menu: remove Switch View, add Client/Staff view links
(function() {
  var done = false;
  function cleanMobileMenu() {
    if (done) return;
    var nav = document.querySelector('.hhp-mobile-nav-v10');
    if (!nav) return;
    done = true;
    // Remove Switch View dropdown
    var allDivs = nav.querySelectorAll('div');
    for (var i = 0; i < allDivs.length; i++) {
      if (allDivs[i].querySelector('select')) { allDivs[i].remove(); break; }
    }
    // Find the divider to insert after
    var divider = nav.querySelector('.hhp-mnav-divider');
    if (!divider) return;
    // Create Client View link
    var clientLink = document.createElement('a');
    clientLink.href = '#';
    clientLink.className = 'hhp-mnav-link';
    clientLink.textContent = 'Client View';
    clientLink.addEventListener('click', function(e) {
      e.preventDefault();
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'client'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = nav.querySelector('.hhp-mnav-close');
      if (closeBtn) closeBtn.click();
    });
    // Create Staff View link
    var staffLink = document.createElement('a');
    staffLink.href = '#';
    staffLink.className = 'hhp-mnav-link';
    staffLink.textContent = 'Staff View';
    staffLink.addEventListener('click', function(e) {
      e.preventDefault();
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'staff'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = nav.querySelector('.hhp-mnav-close');
      if (closeBtn) closeBtn.click();
    });
    // Insert after divider
    divider.parentNode.insertBefore(clientLink, divider.nextSibling);
    clientLink.parentNode.insertBefore(staffLink, clientLink.nextSibling);
    // Also fix Home link with MutationObserver approach
    var homeLink = nav.querySelector('[data-scroll="home"]') || nav.querySelector('a.hhp-mnav-link');
    if (homeLink && (homeLink.textContent.trim() === 'Home' || homeLink.getAttribute('data-scroll') === 'home')) {
      homeLink.setAttribute('href', '/');
      homeLink.removeAttribute('data-scroll');
      homeLink.onclick = function(e) { e.preventDefault(); e.stopPropagation(); window.location.href = '/'; };
    }
  }
  setTimeout(cleanMobileMenu, 1000);
  setTimeout(cleanMobileMenu, 3000);
  setTimeout(cleanMobileMenu, 5000);
  new MutationObserver(function() { cleanMobileMenu(); }).observe(document.body, {childList: true, subtree: true});
})();


/* ============================================================
   COMPREHENSIVE FIX BLOCK v2
   Fixes: page duplication, mojibake emojis, dropdown visibility,
          Meet & Greet full service card, hamburger menu
   ============================================================ */
(function comprehensiveFix() {

  function dedupPages() {
    var ids = ["pg-public","pg-client","pg-staff","pg-owner"];
    ids.forEach(function(id) {
      var els = document.querySelectorAll("#" + id);
      for (var i = 1; i < els.length; i++) els[i].remove();
    });
  }

  function fixMojibake() {
    var re = /[\u00C0-\u00DF][\u0080-\u00BF]|[\u00E0-\u00EF][\u0080-\u00BF]{2}|[\u00F0-\u00F7][\u0080-\u00BF]{3}/;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(node) {
      var t = node.textContent;
      if (re.test(t)) {
        try {
          var bytes = new Uint8Array(t.length);
          for (var i = 0; i < t.length; i++) bytes[i] = t.charCodeAt(i) & 0xFF;
          var decoded = new TextDecoder("utf-8").decode(bytes);
          if (decoded !== t) node.textContent = decoded;
        } catch(e) {}
      }
    });
    var attrEls = document.querySelectorAll("[title],[alt],[placeholder],[aria-label]");
    attrEls.forEach(function(el) {
      ["title","alt","placeholder","aria-label"].forEach(function(attr) {
        var val = el.getAttribute(attr);
        if (val && re.test(val)) {
          try {
            var bytes = new Uint8Array(val.length);
            for (var i = 0; i < val.length; i++) bytes[i] = val.charCodeAt(i) & 0xFF;
            var decoded = new TextDecoder("utf-8").decode(bytes);
            if (decoded !== val) el.setAttribute(attr, decoded);
          } catch(e) {}
        }
      });
    });
  }
  function hideDropdownOnPublic() {
    var dd = document.querySelector("#viewDropdown");
    if (!dd) return;
    var wrap = dd.closest(".hhp-view-switcher") || dd.parentElement;
    var current = dd.value;
    if (current === "public" || !current) {
      if (wrap) wrap.style.display = "none";
    }
    dd.addEventListener("change", function() {
      if (dd.value === "public") { if (wrap) wrap.style.display = "none"; }
      else { if (wrap) wrap.style.display = ""; }
    });
  }

  function ensureMeetGreetCard() {
    var grid = document.querySelector(".services-grid");
    if (!grid) return;
    var cards = grid.querySelectorAll(".service-card");
    var mgCard = null;
    for (var i = 0; i < cards.length; i++) {
      var nameEl = cards[i].querySelector(".sc-name");
      if (nameEl && nameEl.textContent.indexOf("Meet") >= 0 && nameEl.textContent.indexOf("Greet") >= 0) {
        mgCard = cards[i]; break;
      }
    }
    var handshake = String.fromCodePoint(0x1F91D);
    var fullHTML = '<div class="sc-icon">' + handshake + '</div>' +
      '<div class="sc-name">Meet &amp; Greet</div>' +
      '<div class="sc-price">Free</div>' +
      '<div class="sc-desc">An introductory visit so your pet can get comfortable with their new sitter. We\u2019ll go over your pet\u2019s routine, preferences, and any special needs.</div>' +
      '<ul class="sc-features">' +
        '<li>\u2714 In-home introduction with your pet</li>' +
        '<li>\u2714 Review feeding, walking &amp; medication routines</li>' +
        '<li>\u2714 Exchange keys &amp; emergency contacts</li>' +
        '<li>\u2714 No obligation \u2014 just a chance to meet!</li>' +
      '</ul>' +
      '<a href="#book" class="btn-book" onclick="if(window.openBooking){window.openBooking(\'meet-greet\');return false;}">Book Meet &amp; Greet \u00B7 Free</a>';
    if (mgCard) {
      if (!mgCard.querySelector(".btn-book, a[href*=book]")) mgCard.innerHTML = fullHTML;
    } else {
      var card = document.createElement("div");
      card.className = "service-card fadeup";
      card.innerHTML = fullHTML;
      if (grid.firstChild) grid.insertBefore(card, grid.firstChild);
      else grid.appendChild(card);
    }
    if (!document.querySelector("#mg-btn-style")) {
      var s = document.createElement("style"); s.id = "mg-btn-style";
      s.textContent = ".service-card .btn-book{display:block;width:100%;padding:14px 0;text-align:center;background:#7c6420;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:1rem;margin-top:auto;transition:background 0.2s;cursor:pointer;border:none;}.service-card .btn-book:hover{background:#5a4a18;}";
      document.head.appendChild(s);
    }
  }
  function fixHamburger() {
    var ham = document.querySelector(".hhp-hamburger-v10");
    if (!ham) return;
    if (!document.querySelector("#ham-fix-style")) {
      var s = document.createElement("style"); s.id = "ham-fix-style";
      s.textContent = "@media(max-width:768px){.hhp-hamburger-v10{display:flex!important;position:fixed;top:12px;right:12px;z-index:10001;width:44px;height:44px;align-items:center;justify-content:center;background:#7c6420;border-radius:8px;cursor:pointer;border:none;padding:0;}.hhp-hamburger-v10 .bar{display:block;width:22px;height:2px;background:#fff;margin:3px auto;border-radius:2px;}.site-nav .nav-links,.site-nav .nav-right{display:none!important;}}";
      document.head.appendChild(s);
    }
    if (!ham.innerHTML.trim() || ham.children.length === 0) {
      ham.innerHTML = '<span class="bar"></span><span class="bar"></span><span class="bar"></span>';
    }
    if (!window._hamFixBound) {
      window._hamFixBound = true;
      document.addEventListener("click", function(e) {
        var target = e.target.closest(".hhp-hamburger-v10");
        if (!target) return;
        e.stopPropagation(); e.preventDefault();
        var drawer = document.querySelector(".hhp-drawer");
        if (drawer) {
          var isOpen = drawer.classList.contains("open") || drawer.style.transform === "translateX(0px)";
          if (isOpen) { drawer.classList.remove("open"); drawer.style.transform = "translateX(100%)"; }
          else { drawer.classList.add("open"); drawer.style.transform = "translateX(0px)"; }
        }
      }, true);
    }
    if (!document.querySelector("#drawer-fix-style")) {
      var ds = document.createElement("style"); ds.id = "drawer-fix-style";
      ds.textContent = ".hhp-drawer{position:fixed;top:0;right:0;width:280px;height:100vh;background:#fff;z-index:10002;transform:translateX(100%);transition:transform 0.3s ease;box-shadow:-2px 0 10px rgba(0,0,0,0.15);padding:60px 20px 20px;overflow-y:auto;}.hhp-drawer.open{transform:translateX(0px)!important;}.hhp-drawer a{display:block;padding:12px 0;color:#333;text-decoration:none;font-size:1.1rem;border-bottom:1px solid #eee;}.hhp-drawer a:hover{color:#7c6420;}";
      document.head.appendChild(ds);
    }
    var drawer = document.querySelector(".hhp-drawer");
    if (drawer && !drawer.querySelector(".drawer-close")) {
      var cb = document.createElement("button"); cb.className = "drawer-close";
      cb.innerHTML = "\u00D7";
      cb.style.cssText = "position:absolute;top:12px;right:12px;font-size:28px;background:none;border:none;cursor:pointer;color:#333;z-index:10003;";
      cb.addEventListener("click", function() { drawer.classList.remove("open"); drawer.style.transform = "translateX(100%)"; });
      drawer.insertBefore(cb, drawer.firstChild);
    }
  }

  function cleanOrphans() {
    var allCards = document.querySelectorAll(".service-card");
    allCards.forEach(function(c) { if (!c.closest(".services-grid")) c.remove(); });
  }

  function runAllFixes() {
    dedupPages(); fixMojibake(); hideDropdownOnPublic();
    ensureMeetGreetCard(); fixHamburger(); cleanOrphans();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      setTimeout(runAllFixes, 1500); setTimeout(runAllFixes, 4000); setTimeout(runAllFixes, 8000);
    });
  } else {
    setTimeout(runAllFixes, 1500); setTimeout(runAllFixes, 4000); setTimeout(runAllFixes, 8000);
  }

  var obsRan = 0;
  var obs = new MutationObserver(function() {
    var pages = document.querySelectorAll("#pg-public");
    if (pages.length > 1 && obsRan < 10) { obsRan++; runAllFixes(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();


/* ============================================================
   FIX: Hide Home/View-Switcher on ALL views
   Targets both #viewDropdown and #viewSwitcher (ux-patch.js)
   ============================================================ */
(function hideAllViewSwitchers() {
  var css = document.createElement("style");
  css.textContent = '#viewSwitcher, #viewDropdown, .hhp-view-switcher, ' +
    '[id*="viewSwitch"], [id*="viewDrop"] { ' +
    'display:none!important;visibility:hidden!important;' +
    'width:0!important;height:0!important;overflow:hidden!important;' +
    'position:absolute!important;pointer-events:none!important;}' +
    '.nav-right select { display:none!important; }';
  document.head.appendChild(css);
  function nukeViewSwitchers() {
    ["#viewSwitcher","#viewDropdown",".hhp-view-switcher"].forEach(function(s) {
      document.querySelectorAll(s).forEach(function(el) {
        el.style.cssText = "display:none!important;visibility:hidden!important;";
        var p = el.parentElement;
        if (p && p !== document.body && !p.classList.contains("site-nav")) {
          p.style.cssText = "display:none!important;visibility:hidden!important;";
        }
      });
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      setTimeout(nukeViewSwitchers, 500);
      setTimeout(nukeViewSwitchers, 2000);
      setTimeout(nukeViewSwitchers, 5000);
    });
  } else {
    setTimeout(nukeViewSwitchers, 500);
    setTimeout(nukeViewSwitchers, 2000);
    setTimeout(nukeViewSwitchers, 5000);
  }
  var obsCount = 0;
  var obs = new MutationObserver(function() {
    if (obsCount < 20) {
      var vs = document.querySelector("#viewSwitcher");
      var vd = document.querySelector("#viewDropdown");
      if ((vs && vs.offsetParent !== null) || (vd && vd.offsetParent !== null)) {
        obsCount++;
        nukeViewSwitchers();
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();

/* Fix Meet & Greet card fadeup opacity */
(function fixMeetGreetVisibility() {
  function makeMGVisible() {
    document.querySelectorAll(".service-card").forEach(function(c) {
      var n = c.querySelector(".sc-name");
      if (n && n.textContent.indexOf("Meet") >= 0 && n.textContent.indexOf("Greet") >= 0) {
        c.style.opacity = "1";
        c.style.transform = "translateY(0)";
        c.classList.add("visible");
        c.classList.remove("fadeup");
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      setTimeout(makeMGVisible, 2000);
      setTimeout(makeMGVisible, 5000);
      setTimeout(makeMGVisible, 9000);
    });
  } else {
    setTimeout(makeMGVisible, 2000);
    setTimeout(makeMGVisible, 5000);
    setTimeout(makeMGVisible, 9000);
  }
})();

// Load nav-fix.js dynamically
(function(){var s=document.createElement("script");s.src="/js/nav-fix.js";s.defer=true;document.body.appendChild(s);})();

// Add Home, Client View, Staff View to Owner Portal sidebar drawer
(function() {
  function patchDrawer() {
    var drawer = document.querySelector('.hhp-drawer');
    if (!drawer) return;
    var header = drawer.querySelector('.hhp-drawer-header');
    if (!header) return;
    // Check if already patched
    if (drawer.querySelector('[data-fixes-added]')) return;
    // Helper to create a drawer item button
    function makeItem(emoji, label, clickFn) {
      var btn = document.createElement('button');
      btn.className = 'hhp-drawer-item';
      btn.setAttribute('data-fixes-added', 'true');
      btn.innerHTML = emoji + label;
      btn.addEventListener('click', clickFn);
      return btn;
    }
    // Home button ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ at the very top after header
    var homeBtn = makeItem(String.fromCodePoint(0x1F3E0) + ' ', 'Home', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'public'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    header.after(homeBtn);
    // Divider after Home
    var divider = document.createElement('div');
    divider.style.cssText = 'border-bottom:1px solid #e5d5c0;margin:4px 0;';
    divider.setAttribute('data-fixes-added', 'true');
    homeBtn.after(divider);
    // Client View button ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ after Edit Link Page (last item)
    var allItems = drawer.querySelectorAll('.hhp-drawer-item:not([data-fixes-added])');
    var lastItem = allItems[allItems.length - 1];
    // Add divider before view switches
    var divider2 = document.createElement('div');
    divider2.style.cssText = 'border-bottom:1px solid #e5d5c0;margin:4px 0;';
    divider2.setAttribute('data-fixes-added', 'true');
    lastItem.after(divider2);
    var clientBtn = makeItem(String.fromCodePoint(0x1F464) + ' ', 'Client View', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'client'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    divider2.after(clientBtn);
    var staffBtn = makeItem(String.fromCodePoint(0x1F477) + ' ', 'Staff View', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'staff'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    clientBtn.after(staffBtn);
    // Owner View button - to switch back to owner dashboard
    var ownerBtn = makeItem(String.fromCodePoint(0x1F451) + ' ', 'Owner View', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'owner'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    staffBtn.after(ownerBtn);
  }
  setTimeout(patchDrawer, 1000);
  setTimeout(patchDrawer, 3000);
  setTimeout(patchDrawer, 5000);
  new MutationObserver(function() { patchDrawer(); }).observe(document.body, {childList: true, subtree: true});
})();
// ============================================================
// Housley Happy Paws - Function Overrides (fixes.js)
// Fixes AI Studio + Editor bugs by overriding broken functions
// ============================================================

// Override sendAI to use server-side proxy instead of direct Anthropic API
async function sendAI() {
  const input = document.getElementById('aiInput');
  const msg = (input?.value || '').trim();
  if (!msg) return;
  input.value = '';
  appendAIMsg('user', msg);
  aiHistory.push({ role: 'user', content: msg });
  showAITyping();
  try {
    const res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: AI_SYSTEM,
        messages: aiHistory,
        max_tokens: 1000
      })
    });
    const data = await res.json();
    hideAITyping();
    if (!res.ok) {
      appendAIMsg('assistant', data.error || "Something went wrong. Try again!");
      return;
    }
    const reply = data.content?.map(b => b.text || '').join('') || "Sorry, couldn't connect. Try again!";
    aiHistory.push({ role: 'assistant', content: reply });
    appendAIMsg('assistant', reply);
  } catch (err) {
    hideAITyping();
    appendAIMsg('assistant', "Hmm, couldn't connect right now. Check your internet and try again!");
  }
}

// Override aiRewrite to call AI directly and apply results to editor fields
// WITHOUT navigating away from the Edit Website tab
async function aiRewrite(section) {
  const prompts = {
    hero: 'Rewrite the hero headline and intro paragraph for Housley Happy Paws. Make it warm, professional, compelling. Return ONLY a JSON object with keys: heroH1, heroPara. No markdown, no explanation, just the JSON.',
    about: 'Rewrite the About Rachel section. Make it personal, warm, professional. Return ONLY a JSON object with keys: aboutP1 (paragraph 1), aboutP2 (paragraph 2), aboutQuote (a memorable Rachel quote). No markdown, no explanation, just the JSON.',
    services: 'Rewrite the service descriptions for Dog Walking, Drop-In Visits, Dog Boarding, and Cat Care. Each 2-3 sentences. Return ONLY a JSON object with keys: svcWalk, svcDropIn, svcBoard, svcCat. No markdown, no explanation, just the JSON.'
  };
  const prompt = prompts[section] || 'Help me improve the ' + section + ' section. Return ONLY a JSON object with the improved text for each field. No markdown, no explanation.';

  // Show a loading indicator on the rewrite button
  const panel = document.getElementById('ce-' + section);
  const btns = panel?.querySelectorAll('button');
  const rewriteBtn = Array.from(btns || []).find(b => b.textContent.includes('Rewrite'));
  const origText = rewriteBtn?.textContent;
  if (rewriteBtn) {
    rewriteBtn.textContent = 'Rewriting...';
    rewriteBtn.disabled = true;
  }

  try {
    const res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: 'You are a copywriter for Housley Happy Paws, a pet care business in Lancaster PA owned by Rachel Housley. Write warm, professional, compelling copy. Always return valid JSON only.',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000
      })
    });
    const data = await res.json();
    if (!res.ok) {
      toast('AI rewrite failed: ' + (data.error || 'Unknown error'));
      return;
    }
    const text = data.content?.map(b => b.text || '').join('') || '';

    // Parse the JSON response
    let parsed;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (e) {
      toast('AI returned unexpected format. Check AI Studio for the full response.');
      // Fall back to showing in AI Studio
      aiHistory.push({ role: 'user', content: prompt });
      aiHistory.push({ role: 'assistant', content: text });
      return;
    }

    // Apply parsed values to the editor fields
    if (panel) {
      Object.keys(parsed).forEach(key => {
        const field = panel.querySelector('[data-field="' + key + '"]');
        if (field) {
          if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
            field.value = parsed[key];
          } else {
            field.textContent = parsed[key];
          }
        }
      });
      toast('AI rewrote the ' + section + ' section! Review and click Save when ready.');
    }
  } catch (err) {
    toast('Could not connect to AI. Please try again.');
  } finally {
    if (rewriteBtn) {
      rewriteBtn.textContent = origText;
      rewriteBtn.disabled = false;
    }
  }
}

// Override aiQuick to NOT navigate away from the current tab
function aiQuick(msg) {
  const inp = document.getElementById('aiInput');
  if (inp) inp.value = msg;
  // Only switch to AI Studio if we're not on the content editor
  const contentPanel = document.getElementById('o-content');
  if (contentPanel && contentPanel.style.display !== 'none') {
    // We're on the content editor - just send the message without switching
    sendAI();
  } else {
    sTab('o', 'o-studio');
    setTimeout(sendAI, 100);
  }
}

console.log('[fixes.js] Function overrides loaded successfully');

// Load UI enhancements (role-based dropdown, remember me, floating booking, synced services)
var _enhScript = document.createElement('script'); _enhScript.src = '/js/enhancements.js'; _enhScript.defer = true; document.head.appendChild(_enhScript);

// Load gallery & slideshow features (About slideshow, Hero carousel, photo gallery, staff gallery)
var _galScript = document.createElement('script'); _galScript.src = '/js/gallery.js'; _galScript.defer = true; document.head.appendChild(_galScript);
var _uxScript = document.createElement('script'); _uxScript.src = '/js/ux-upgrades.js'; _uxScript.defer = true; document.head.appendChild(_uxScript);

var _patchScript = document.createElement('script'); _patchScript.src = '/ux-patch.js'; _patchScript.defer = true; document.head.appendChild(_patchScript);

// Hide Owner Portal dropdown button on desktop (CSS fix for timing issue)
var _fixStyle = document.createElement('style');
_fixStyle.textContent = '@media (min-width: 768px) { #hhp-portal-nav { display: none !important; } }';

// Ensure mobile nav overlay is always visible when open
(function fixHamburgerMenu() {
  document.addEventListener("click", function(e) {
    var target = e.target.closest(".hhp-hamburger-v10");
    if (!target) return;
    setTimeout(function() {
      var nav = document.querySelector(".hhp-mobile-nav-v10");
      if (nav) {
        nav.style.setProperty("display", "flex", "important");
        nav.style.setProperty("position", "fixed", "important");
        nav.style.setProperty("z-index", "99999", "important");
        nav.style.setProperty("top", "0", "important");
        nav.style.setProperty("left", "0", "important");
        nav.style.setProperty("width", "100vw", "important");
        nav.style.setProperty("height", "100vh", "important");
        nav.style.setProperty("visibility", "visible", "important");
        nav.style.setProperty("opacity", "1", "important");
        nav.style.setProperty("flex-direction", "column", "important");
        nav.style.setProperty("align-items", "center", "important");
        nav.style.setProperty("justify-content", "center", "important");
        nav.style.setProperty("background", "rgba(0,0,0,0.95)", "important");
        nav.classList.add("hhp-mnav-open");
      }
    }, 50);
  }, true);
})();

// Remove duplicate empty drawers created by ux-patch.js running twice
(function() {
  function cleanDuplicateDrawers() {
    var drawers = document.querySelectorAll('.hhp-drawer');
    if (drawers.length > 1) {
      for (var i = 1; i < drawers.length; i++) {
        if (!drawers[i].querySelector('.hhp-drawer-item')) {
          drawers[i].remove();
        }
      }
    }
  }
  setTimeout(cleanDuplicateDrawers, 2000);
  setTimeout(cleanDuplicateDrawers, 4000);
  setTimeout(cleanDuplicateDrawers, 6000);
})();
document.head.appendChild(_fixStyle);

// NUKE left drawer-tab hamburger completely (CSS + DOM removal + observer)
(function() {
    var s = document.createElement('style');
    s.textContent = '.hhp-drawer-tab, .hhp-drawer-tab.hhp-drawer-tab-visible { display:none!important;visibility:hidden!important;width:0!important;height:0!important;pointer-events:none!important; }';
    document.head.appendChild(s);
    function killTab() { var t = document.querySelector('.hhp-drawer-tab'); if (t) t.remove(); }
    killTab();
    setTimeout(killTab, 500);
    setTimeout(killTab, 1500);
    setTimeout(killTab, 3000);
    new MutationObserver(killTab).observe(document.body, {childList:true, subtree:true});
})();

// Fix Home link in mobile menu to go back to public home page
(function() {
    function fixHome() {
          var homeLink = document.querySelector('.hhp-mobile-nav-v10 [data-scroll="home"]');
          if (!homeLink) return;
          homeLink.setAttribute('href', '/');
          homeLink.removeAttribute('data-scroll');
          homeLink.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); window.location.href = '/'; });
    }
    // Retry since mobile nav is created by ux-patch.js which loads after fixes.js
    setTimeout(fixHome, 1000);
    setTimeout(fixHome, 3000);
    setTimeout(fixHome, 5000);
})();

// Clean up mobile menu: remove Switch View, add Client/Staff view links
(function() {
  var done = false;
  function cleanMobileMenu() {
    if (done) return;
    var nav = document.querySelector('.hhp-mobile-nav-v10');
    if (!nav) return;
    done = true;
    // Remove Switch View dropdown
    var allDivs = nav.querySelectorAll('div');
    for (var i = 0; i < allDivs.length; i++) {
      if (allDivs[i].querySelector('select')) { allDivs[i].remove(); break; }
    }
    // Find the divider to insert after
    var divider = nav.querySelector('.hhp-mnav-divider');
    if (!divider) return;
    // Create Client View link
    var clientLink = document.createElement('a');
    clientLink.href = '#';
    clientLink.className = 'hhp-mnav-link';
    clientLink.textContent = 'Client View';
    clientLink.addEventListener('click', function(e) {
      e.preventDefault();
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'client'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = nav.querySelector('.hhp-mnav-close');
      if (closeBtn) closeBtn.click();
    });
    // Create Staff View link
    var staffLink = document.createElement('a');
    staffLink.href = '#';
    staffLink.className = 'hhp-mnav-link';
    staffLink.textContent = 'Staff View';
    staffLink.addEventListener('click', function(e) {
      e.preventDefault();
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'staff'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = nav.querySelector('.hhp-mnav-close');
      if (closeBtn) closeBtn.click();
    });
    // Insert after divider
    divider.parentNode.insertBefore(clientLink, divider.nextSibling);
    clientLink.parentNode.insertBefore(staffLink, clientLink.nextSibling);
    // Also fix Home link with MutationObserver approach
    var homeLink = nav.querySelector('[data-scroll="home"]') || nav.querySelector('a.hhp-mnav-link');
    if (homeLink && (homeLink.textContent.trim() === 'Home' || homeLink.getAttribute('data-scroll') === 'home')) {
      homeLink.setAttribute('href', '/');
      homeLink.removeAttribute('data-scroll');
      homeLink.onclick = function(e) { e.preventDefault(); e.stopPropagation(); window.location.href = '/'; };
    }
  }
  setTimeout(cleanMobileMenu, 1000);
  setTimeout(cleanMobileMenu, 3000);
  setTimeout(cleanMobileMenu, 5000);
  new MutationObserver(function() { cleanMobileMenu(); }).observe(document.body, {childList: true, subtree: true});
})();


/* === Service Grid Dedup + Meet & Greet Fix === */
(function fixServiceGrid() {
  function cleanup() {
    /* Remove duplicate services-grid created by ux-patch.js */
    var grids = document.querySelectorAll(".services-grid");
    if (grids.length > 1) {
      for (var i = 1; i < grids.length; i++) grids[i].remove();
    }
    /* Ensure Meet & Greet card is inside the grid */
    var grid = document.querySelector(".services-grid");
    if (!grid) return;
    var hasMG = false;
    var cards = grid.querySelectorAll(".service-card");
    for (var c = 0; c < cards.length; c++) {
      var n = cards[c].querySelector(".sc-name");
      if (n && n.textContent.indexOf("Meet") >= 0 && n.textContent.indexOf("Greet") >= 0) hasMG = true;
    }
    if (!hasMG) {
      var card = document.createElement("div");
      card.className = "service-card fadeup";
      card.innerHTML = '<div class="sc-icon">' + String.fromCodePoint(0x1F91D) + '</div>' +
        '<div class="sc-name">Meet &amp; Greet</div>' +
        '<div class="sc-price">Free</div>' +
        '<div class="sc-desc">An introductory visit so your pet can get comfortable with their new sitter. We\u2019ll go over your pet\u2019s routine, preferences, and any special needs.</div>' +
        '<ul class="sc-features"><li>In-home introduction with your pet</li>' +
        '<li>Review feeding, walking &amp; medication routines</li>' +
        '<li>Exchange keys &amp; emergency contacts</li>' +
        '<li>No obligation \u2014 just a chance to meet!</li></ul>';
      grid.appendChild(card);
    }
    /* Remove any loose Meet & Greet cards outside the grid */
    var allCards = document.querySelectorAll(".service-card");
    for (var j = 0; j < allCards.length; j++) {
      if (!allCards[j].closest(".services-grid")) allCards[j].remove();
    }
  }
  /* Run cleanup after ux-patch.js finishes (multiple delays for safety) */
  [2000, 5000, 8000].forEach(function(d) { setTimeout(cleanup, d); });
  /* Also observe for dynamic grid additions */
  var obs = new MutationObserver(function() {
    var grids = document.querySelectorAll(".services-grid");
    if (grids.length > 1) cleanup();
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();


// Add Home, Client View, Staff View to Owner Portal sidebar drawer
(function() {
  function patchDrawer() {
    var drawer = document.querySelector('.hhp-drawer');
    if (!drawer) return;
    var header = drawer.querySelector('.hhp-drawer-header');
    if (!header) return;
    // Check if already patched
    if (drawer.querySelector('[data-fixes-added]')) return;
    // Helper to create a drawer item button
    function makeItem(emoji, label, clickFn) {
      var btn = document.createElement('button');
      btn.className = 'hhp-drawer-item';
      btn.setAttribute('data-fixes-added', 'true');
      btn.innerHTML = emoji + label;
      btn.addEventListener('click', clickFn);
      return btn;
    }
    // Home button ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ at the very top after header
    var homeBtn = makeItem(String.fromCodePoint(0x1F3E0) + ' ', 'Home', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'public'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    header.after(homeBtn);
    // Divider after Home
    var divider = document.createElement('div');
    divider.style.cssText = 'border-bottom:1px solid #e5d5c0;margin:4px 0;';
    divider.setAttribute('data-fixes-added', 'true');
    homeBtn.after(divider);
    // Client View button ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ after Edit Link Page (last item)
    var allItems = drawer.querySelectorAll('.hhp-drawer-item:not([data-fixes-added])');
    var lastItem = allItems[allItems.length - 1];
    // Add divider before view switches
    var divider2 = document.createElement('div');
    divider2.style.cssText = 'border-bottom:1px solid #e5d5c0;margin:4px 0;';
    divider2.setAttribute('data-fixes-added', 'true');
    lastItem.after(divider2);
    var clientBtn = makeItem(String.fromCodePoint(0x1F464) + ' ', 'Client View', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'client'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    divider2.after(clientBtn);
    var staffBtn = makeItem(String.fromCodePoint(0x1F477) + ' ', 'Staff View', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'staff'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    clientBtn.after(staffBtn);
    // Owner View button - to switch back to owner dashboard
    var ownerBtn = makeItem(String.fromCodePoint(0x1F451) + ' ', 'Owner View', function() {
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'owner'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = drawer.querySelector('.hhp-drawer-close') || drawer.querySelector('.hhp-drawer-header button');
      if (closeBtn) closeBtn.click();
    });
    staffBtn.after(ownerBtn);
  }
  setTimeout(patchDrawer, 1000);
  setTimeout(patchDrawer, 3000);
  setTimeout(patchDrawer, 5000);
  new MutationObserver(function() { patchDrawer(); }).observe(document.body, {childList: true, subtree: true});
})();
// ============================================================
// Housley Happy Paws - Function Overrides (fixes.js)
// Fixes AI Studio + Editor bugs by overriding broken functions
// ============================================================

// Override sendAI to use server-side proxy instead of direct Anthropic API
async function sendAI() {
  const input = document.getElementById('aiInput');
  const msg = (input?.value || '').trim();
  if (!msg) return;
  input.value = '';
  appendAIMsg('user', msg);
  aiHistory.push({ role: 'user', content: msg });
  showAITyping();
  try {
    const res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: AI_SYSTEM,
        messages: aiHistory,
        max_tokens: 1000
      })
    });
    const data = await res.json();
    hideAITyping();
    if (!res.ok) {
      appendAIMsg('assistant', data.error || "Something went wrong. Try again!");
      return;
    }
    const reply = data.content?.map(b => b.text || '').join('') || "Sorry, couldn't connect. Try again!";
    aiHistory.push({ role: 'assistant', content: reply });
    appendAIMsg('assistant', reply);
  } catch (err) {
    hideAITyping();
    appendAIMsg('assistant', "Hmm, couldn't connect right now. Check your internet and try again!");
  }
}

// Override aiRewrite to call AI directly and apply results to editor fields
// WITHOUT navigating away from the Edit Website tab
async function aiRewrite(section) {
  const prompts = {
    hero: 'Rewrite the hero headline and intro paragraph for Housley Happy Paws. Make it warm, professional, compelling. Return ONLY a JSON object with keys: heroH1, heroPara. No markdown, no explanation, just the JSON.',
    about: 'Rewrite the About Rachel section. Make it personal, warm, professional. Return ONLY a JSON object with keys: aboutP1 (paragraph 1), aboutP2 (paragraph 2), aboutQuote (a memorable Rachel quote). No markdown, no explanation, just the JSON.',
    services: 'Rewrite the service descriptions for Dog Walking, Drop-In Visits, Dog Boarding, and Cat Care. Each 2-3 sentences. Return ONLY a JSON object with keys: svcWalk, svcDropIn, svcBoard, svcCat. No markdown, no explanation, just the JSON.'
  };
  const prompt = prompts[section] || 'Help me improve the ' + section + ' section. Return ONLY a JSON object with the improved text for each field. No markdown, no explanation.';

  // Show a loading indicator on the rewrite button
  const panel = document.getElementById('ce-' + section);
  const btns = panel?.querySelectorAll('button');
  const rewriteBtn = Array.from(btns || []).find(b => b.textContent.includes('Rewrite'));
  const origText = rewriteBtn?.textContent;
  if (rewriteBtn) {
    rewriteBtn.textContent = 'Rewriting...';
    rewriteBtn.disabled = true;
  }

  try {
    const res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: 'You are a copywriter for Housley Happy Paws, a pet care business in Lancaster PA owned by Rachel Housley. Write warm, professional, compelling copy. Always return valid JSON only.',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000
      })
    });
    const data = await res.json();
    if (!res.ok) {
      toast('AI rewrite failed: ' + (data.error || 'Unknown error'));
      return;
    }
    const text = data.content?.map(b => b.text || '').join('') || '';

    // Parse the JSON response
    let parsed;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (e) {
      toast('AI returned unexpected format. Check AI Studio for the full response.');
      // Fall back to showing in AI Studio
      aiHistory.push({ role: 'user', content: prompt });
      aiHistory.push({ role: 'assistant', content: text });
      return;
    }

    // Apply parsed values to the editor fields
    if (panel) {
      Object.keys(parsed).forEach(key => {
        const field = panel.querySelector('[data-field="' + key + '"]');
        if (field) {
          if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
            field.value = parsed[key];
          } else {
            field.textContent = parsed[key];
          }
        }
      });
      toast('AI rewrote the ' + section + ' section! Review and click Save when ready.');
    }
  } catch (err) {
    toast('Could not connect to AI. Please try again.');
  } finally {
    if (rewriteBtn) {
      rewriteBtn.textContent = origText;
      rewriteBtn.disabled = false;
    }
  }
}

// Override aiQuick to NOT navigate away from the current tab
function aiQuick(msg) {
  const inp = document.getElementById('aiInput');
  if (inp) inp.value = msg;
  // Only switch to AI Studio if we're not on the content editor
  const contentPanel = document.getElementById('o-content');
  if (contentPanel && contentPanel.style.display !== 'none') {
    // We're on the content editor - just send the message without switching
    sendAI();
  } else {
    sTab('o', 'o-studio');
    setTimeout(sendAI, 100);
  }
}

console.log('[fixes.js] Function overrides loaded successfully');

// Load UI enhancements (role-based dropdown, remember me, floating booking, synced services)
var _enhScript = document.createElement('script'); _enhScript.src = '/js/enhancements.js'; _enhScript.defer = true; document.head.appendChild(_enhScript);

// Load gallery & slideshow features (About slideshow, Hero carousel, photo gallery, staff gallery)
var _galScript = document.createElement('script'); _galScript.src = '/js/gallery.js'; _galScript.defer = true; document.head.appendChild(_galScript);
var _uxScript = document.createElement('script'); _uxScript.src = '/js/ux-upgrades.js'; _uxScript.defer = true; document.head.appendChild(_uxScript);

var _patchScript = document.createElement('script'); _patchScript.src = '/ux-patch.js'; _patchScript.defer = true; document.head.appendChild(_patchScript);

// Hide Owner Portal dropdown button on desktop (CSS fix for timing issue)
var _fixStyle = document.createElement('style');
_fixStyle.textContent = '@media (min-width: 768px) { #hhp-portal-nav { display: none !important; } }';

// Ensure mobile nav overlay is always visible when open
(function fixHamburgerMenu() {
  document.addEventListener("click", function(e) {
    var target = e.target.closest(".hhp-hamburger-v10");
    if (!target) return;
    setTimeout(function() {
      var nav = document.querySelector(".hhp-mobile-nav-v10");
      if (nav) {
        nav.style.setProperty("display", "flex", "important");
        nav.style.setProperty("position", "fixed", "important");
        nav.style.setProperty("z-index", "99999", "important");
        nav.style.setProperty("top", "0", "important");
        nav.style.setProperty("left", "0", "important");
        nav.style.setProperty("width", "100vw", "important");
        nav.style.setProperty("height", "100vh", "important");
        nav.style.setProperty("visibility", "visible", "important");
        nav.style.setProperty("opacity", "1", "important");
        nav.style.setProperty("flex-direction", "column", "important");
        nav.style.setProperty("align-items", "center", "important");
        nav.style.setProperty("justify-content", "center", "important");
        nav.style.setProperty("background", "rgba(0,0,0,0.95)", "important");
        nav.classList.add("hhp-mnav-open");
      }
    }, 50);
  }, true);
})();

// Remove duplicate empty drawers created by ux-patch.js running twice
(function() {
  function cleanDuplicateDrawers() {
    var drawers = document.querySelectorAll('.hhp-drawer');
    if (drawers.length > 1) {
      for (var i = 1; i < drawers.length; i++) {
        if (!drawers[i].querySelector('.hhp-drawer-item')) {
          drawers[i].remove();
        }
      }
    }
  }
  setTimeout(cleanDuplicateDrawers, 2000);
  setTimeout(cleanDuplicateDrawers, 4000);
  setTimeout(cleanDuplicateDrawers, 6000);
})();
document.head.appendChild(_fixStyle);

// NUKE left drawer-tab hamburger completely (CSS + DOM removal + observer)
(function() {
    var s = document.createElement('style');
    s.textContent = '.hhp-drawer-tab, .hhp-drawer-tab.hhp-drawer-tab-visible { display:none!important;visibility:hidden!important;width:0!important;height:0!important;pointer-events:none!important; }';
    document.head.appendChild(s);
    function killTab() { var t = document.querySelector('.hhp-drawer-tab'); if (t) t.remove(); }
    killTab();
    setTimeout(killTab, 500);
    setTimeout(killTab, 1500);
    setTimeout(killTab, 3000);
    new MutationObserver(killTab).observe(document.body, {childList:true, subtree:true});
})();

// Fix Home link in mobile menu to go back to public home page
(function() {
    function fixHome() {
          var homeLink = document.querySelector('.hhp-mobile-nav-v10 [data-scroll="home"]');
          if (!homeLink) return;
          homeLink.setAttribute('href', '/');
          homeLink.removeAttribute('data-scroll');
          homeLink.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); window.location.href = '/'; });
    }
    // Retry since mobile nav is created by ux-patch.js which loads after fixes.js
    setTimeout(fixHome, 1000);
    setTimeout(fixHome, 3000);
    setTimeout(fixHome, 5000);
})();

// Clean up mobile menu: remove Switch View, add Client/Staff view links
(function() {
  var done = false;
  function cleanMobileMenu() {
    if (done) return;
    var nav = document.querySelector('.hhp-mobile-nav-v10');
    if (!nav) return;
    done = true;
    // Remove Switch View dropdown
    var allDivs = nav.querySelectorAll('div');
    for (var i = 0; i < allDivs.length; i++) {
      if (allDivs[i].querySelector('select')) { allDivs[i].remove(); break; }
    }
    // Find the divider to insert after
    var divider = nav.querySelector('.hhp-mnav-divider');
    if (!divider) return;
    // Create Client View link
    var clientLink = document.createElement('a');
    clientLink.href = '#';
    clientLink.className = 'hhp-mnav-link';
    clientLink.textContent = 'Client View';
    clientLink.addEventListener('click', function(e) {
      e.preventDefault();
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'client'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = nav.querySelector('.hhp-mnav-close');
      if (closeBtn) closeBtn.click();
    });
    // Create Staff View link
    var staffLink = document.createElement('a');
    staffLink.href = '#';
    staffLink.className = 'hhp-mnav-link';
    staffLink.textContent = 'Staff View';
    staffLink.addEventListener('click', function(e) {
      e.preventDefault();
      var dd = document.getElementById('viewDropdown');
      if (dd) { dd.value = 'staff'; dd.dispatchEvent(new Event('change')); }
      var closeBtn = nav.querySelector('.hhp-mnav-close');
      if (closeBtn) closeBtn.click();
    });
    // Insert after divider
    divider.parentNode.insertBefore(clientLink, divider.nextSibling);
    clientLink.parentNode.insertBefore(staffLink, clientLink.nextSibling);
    // Also fix Home link with MutationObserver approach
    var homeLink = nav.querySelector('[data-scroll="home"]') || nav.querySelector('a.hhp-mnav-link');
    if (homeLink && (homeLink.textContent.trim() === 'Home' || homeLink.getAttribute('data-scroll') === 'home')) {
      homeLink.setAttribute('href', '/');
      homeLink.removeAttribute('data-scroll');
      homeLink.onclick = function(e) { e.preventDefault(); e.stopPropagation(); window.location.href = '/'; };
    }
  }
  setTimeout(cleanMobileMenu, 1000);
  setTimeout(cleanMobileMenu, 3000);
  setTimeout(cleanMobileMenu, 5000);
  new MutationObserver(function() { cleanMobileMenu(); }).observe(document.body, {childList: true, subtree: true});
})();


/* ============================================================
   COMPREHENSIVE FIX BLOCK v2
   Fixes: page duplication, mojibake emojis, dropdown visibility,
          Meet & Greet full service card, hamburger menu
   ============================================================ */
(function comprehensiveFix() {

  function dedupPages() {
    var ids = ["pg-public","pg-client","pg-staff","pg-owner"];
    ids.forEach(function(id) {
      var els = document.querySelectorAll("#" + id);
      for (var i = 1; i < els.length; i++) els[i].remove();
    });
  }

  function fixMojibake() {
    var re = /[\u00C0-\u00DF][\u0080-\u00BF]|[\u00E0-\u00EF][\u0080-\u00BF]{2}|[\u00F0-\u00F7][\u0080-\u00BF]{3}/;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(node) {
      var t = node.textContent;
      if (re.test(t)) {
        try {
          var bytes = new Uint8Array(t.length);
          for (var i = 0; i < t.length; i++) bytes[i] = t.charCodeAt(i) & 0xFF;
          var decoded = new TextDecoder("utf-8").decode(bytes);
          if (decoded !== t) node.textContent = decoded;
        } catch(e) {}
      }
    });
    var attrEls = document.querySelectorAll("[title],[alt],[placeholder],[aria-label]");
    attrEls.forEach(function(el) {
      ["title","alt","placeholder","aria-label"].forEach(function(attr) {
        var val = el.getAttribute(attr);
        if (val && re.test(val)) {
          try {
            var bytes = new Uint8Array(val.length);
            for (var i = 0; i < val.length; i++) bytes[i] = val.charCodeAt(i) & 0xFF;
            var decoded = new TextDecoder("utf-8").decode(bytes);
            if (decoded !== val) el.setAttribute(attr, decoded);
          } catch(e) {}
        }
      });
    });
  }
  function hideDropdownOnPublic() {
    var dd = document.querySelector("#viewDropdown");
    if (!dd) return;
    var wrap = dd.closest(".hhp-view-switcher") || dd.parentElement;
    var current = dd.value;
    if (current === "public" || !current) {
      if (wrap) wrap.style.display = "none";
    }
    dd.addEventListener("change", function() {
      if (dd.value === "public") { if (wrap) wrap.style.display = "none"; }
      else { if (wrap) wrap.style.display = ""; }
    });
  }

  function ensureMeetGreetCard() {
    var grid = document.querySelector(".services-grid");
    if (!grid) return;
    var cards = grid.querySelectorAll(".service-card");
    var mgCard = null;
    for (var i = 0; i < cards.length; i++) {
      var nameEl = cards[i].querySelector(".sc-name");
      if (nameEl && nameEl.textContent.indexOf("Meet") >= 0 && nameEl.textContent.indexOf("Greet") >= 0) {
        mgCard = cards[i]; break;
      }
    }
    var handshake = String.fromCodePoint(0x1F91D);
    var fullHTML = '<div class="sc-icon">' + handshake + '</div>' +
      '<div class="sc-name">Meet &amp; Greet</div>' +
      '<div class="sc-price">Free</div>' +
      '<div class="sc-desc">An introductory visit so your pet can get comfortable with their new sitter. We\u2019ll go over your pet\u2019s routine, preferences, and any special needs.</div>' +
      '<ul class="sc-features">' +
        '<li>\u2714 In-home introduction with your pet</li>' +
        '<li>\u2714 Review feeding, walking &amp; medication routines</li>' +
        '<li>\u2714 Exchange keys &amp; emergency contacts</li>' +
        '<li>\u2714 No obligation \u2014 just a chance to meet!</li>' +
      '</ul>' +
      '<a href="#book" class="btn-book" onclick="if(window.openBooking){window.openBooking(\'meet-greet\');return false;}">Book Meet &amp; Greet \u00B7 Free</a>';
    if (mgCard) {
      if (!mgCard.querySelector(".btn-book, a[href*=book]")) mgCard.innerHTML = fullHTML;
    } else {
      var card = document.createElement("div");
      card.className = "service-card fadeup";
      card.innerHTML = fullHTML;
      if (grid.firstChild) grid.insertBefore(card, grid.firstChild);
      else grid.appendChild(card);
    }
    if (!document.querySelector("#mg-btn-style")) {
      var s = document.createElement("style"); s.id = "mg-btn-style";
      s.textContent = ".service-card .btn-book{display:block;width:100%;padding:14px 0;text-align:center;background:#7c6420;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:1rem;margin-top:auto;transition:background 0.2s;cursor:pointer;border:none;}.service-card .btn-book:hover{background:#5a4a18;}";
      document.head.appendChild(s);
    }
  }
  function fixHamburger() {
    var ham = document.querySelector(".hhp-hamburger-v10");
    if (!ham) return;
    if (!document.querySelector("#ham-fix-style")) {
      var s = document.createElement("style"); s.id = "ham-fix-style";
      s.textContent = "@media(max-width:768px){.hhp-hamburger-v10{display:flex!important;position:fixed;top:12px;right:12px;z-index:10001;width:44px;height:44px;align-items:center;justify-content:center;background:#7c6420;border-radius:8px;cursor:pointer;border:none;padding:0;}.hhp-hamburger-v10 .bar{display:block;width:22px;height:2px;background:#fff;margin:3px auto;border-radius:2px;}.site-nav .nav-links,.site-nav .nav-right{display:none!important;}}";
      document.head.appendChild(s);
    }
    if (!ham.innerHTML.trim() || ham.children.length === 0) {
      ham.innerHTML = '<span class="bar"></span><span class="bar"></span><span class="bar"></span>';
    }
    if (!window._hamFixBound) {
      window._hamFixBound = true;
      document.addEventListener("click", function(e) {
        var target = e.target.closest(".hhp-hamburger-v10");
        if (!target) return;
        e.stopPropagation(); e.preventDefault();
        var drawer = document.querySelector(".hhp-drawer");
        if (drawer) {
          var isOpen = drawer.classList.contains("open") || drawer.style.transform === "translateX(0px)";
          if (isOpen) { drawer.classList.remove("open"); drawer.style.transform = "translateX(100%)"; }
          else { drawer.classList.add("open"); drawer.style.transform = "translateX(0px)"; }
        }
      }, true);
    }
    if (!document.querySelector("#drawer-fix-style")) {
      var ds = document.createElement("style"); ds.id = "drawer-fix-style";
      ds.textContent = ".hhp-drawer{position:fixed;top:0;right:0;width:280px;height:100vh;background:#fff;z-index:10002;transform:translateX(100%);transition:transform 0.3s ease;box-shadow:-2px 0 10px rgba(0,0,0,0.15);padding:60px 20px 20px;overflow-y:auto;}.hhp-drawer.open{transform:translateX(0px)!important;}.hhp-drawer a{display:block;padding:12px 0;color:#333;text-decoration:none;font-size:1.1rem;border-bottom:1px solid #eee;}.hhp-drawer a:hover{color:#7c6420;}";
      document.head.appendChild(ds);
    }
    var drawer = document.querySelector(".hhp-drawer");
    if (drawer && !drawer.querySelector(".drawer-close")) {
      var cb = document.createElement("button"); cb.className = "drawer-close";
      cb.innerHTML = "\u00D7";
      cb.style.cssText = "position:absolute;top:12px;right:12px;font-size:28px;background:none;border:none;cursor:pointer;color:#333;z-index:10003;";
      cb.addEventListener("click", function() { drawer.classList.remove("open"); drawer.style.transform = "translateX(100%)"; });
      drawer.insertBefore(cb, drawer.firstChild);
    }
  }

  function cleanOrphans() {
    var allCards = document.querySelectorAll(".service-card");
    allCards.forEach(function(c) { if (!c.closest(".services-grid")) c.remove(); });
  }

  function runAllFixes() {
    dedupPages(); fixMojibake(); hideDropdownOnPublic();
    ensureMeetGreetCard(); fixHamburger(); cleanOrphans();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      setTimeout(runAllFixes, 1500); setTimeout(runAllFixes, 4000); setTimeout(runAllFixes, 8000);
    });
  } else {
    setTimeout(runAllFixes, 1500); setTimeout(runAllFixes, 4000); setTimeout(runAllFixes, 8000);
  }

  var obsRan = 0;
  var obs = new MutationObserver(function() {
    var pages = document.querySelectorAll("#pg-public");
    if (pages.length > 1 && obsRan < 10) { obsRan++; runAllFixes(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();


/* ============================================================
   FIX: Hide Home/View-Switcher on ALL views
   Targets both #viewDropdown and #viewSwitcher (ux-patch.js)
   ============================================================ */
(function hideAllViewSwitchers() {
  var css = document.createElement("style");
  css.textContent = '#viewSwitcher, #viewDropdown, .hhp-view-switcher, ' +
    '[id*="viewSwitch"], [id*="viewDrop"] { ' +
    'display:none!important;visibility:hidden!important;' +
    'width:0!important;height:0!important;overflow:hidden!important;' +
    'position:absolute!important;pointer-events:none!important;}' +
    '.nav-right select { display:none!important; }';
  document.head.appendChild(css);
  function nukeViewSwitchers() {
    ["#viewSwitcher","#viewDropdown",".hhp-view-switcher"].forEach(function(s) {
      document.querySelectorAll(s).forEach(function(el) {
        el.style.cssText = "display:none!important;visibility:hidden!important;";
        var p = el.parentElement;
        if (p && p !== document.body && !p.classList.contains("site-nav")) {
          p.style.cssText = "display:none!important;visibility:hidden!important;";
        }
      });
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      setTimeout(nukeViewSwitchers, 500);
      setTimeout(nukeViewSwitchers, 2000);
      setTimeout(nukeViewSwitchers, 5000);
    });
  } else {
    setTimeout(nukeViewSwitchers, 500);
    setTimeout(nukeViewSwitchers, 2000);
    setTimeout(nukeViewSwitchers, 5000);
  }
  var obsCount = 0;
  var obs = new MutationObserver(function() {
    if (obsCount < 20) {
      var vs = document.querySelector("#viewSwitcher");
      var vd = document.querySelector("#viewDropdown");
      if ((vs && vs.offsetParent !== null) || (vd && vd.offsetParent !== null)) {
        obsCount++;
        nukeViewSwitchers();
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();

/* Fix Meet & Greet card fadeup opacity */
(function fixMeetGreetVisibility() {
  function makeMGVisible() {
    document.querySelectorAll(".service-card").forEach(function(c) {
      var n = c.querySelector(".sc-name");
      if (n && n.textContent.indexOf("Meet") >= 0 && n.textContent.indexOf("Greet") >= 0) {
        c.style.opacity = "1";
        c.style.transform = "translateY(0)";
        c.classList.add("visible");
        c.classList.remove("fadeup");
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      setTimeout(makeMGVisible, 2000);
      setTimeout(makeMGVisible, 5000);
      setTimeout(makeMGVisible, 9000);
    });
  } else {
    setTimeout(makeMGVisible, 2000);
    setTimeout(makeMGVisible, 5000);
    setTimeout(makeMGVisible, 9000);
  }
})();

// Load nav-fix.js dynamically
(function(){var s=document.createElement("script");s.src="/js/nav-fix.js";s.defer=true;document.body.appendChild(s);})();

// Persistent view-switcher fix - keeps dropdown visible against rogue scripts
(function(){
  var ddStyle = "display:inline-block!important;visibility:visible!important;width:auto!important;height:auto!important;min-width:140px!important;min-height:28px!important;padding:5px 10px!important;font-size:13px!important;background:#1a1a1a!important;color:#bfa260!important;border:1px solid #bfa260!important;border-radius:6px!important;cursor:pointer!important;-webkit-appearance:menulist!important;appearance:auto!important;";
  function forceViewSwitcher(){
    var vs=document.getElementById("viewSwitcher");
    var dd=document.getElementById("viewDropdown");
    var nr=document.querySelector(".nav-right");
    if(vs){vs.style.cssText="display:inline-block!important;visibility:visible!important;";}
    if(dd){dd.style.cssText=ddStyle;}
    if(nr){nr.style.cssText="display:flex!important;visibility:visible!important;align-items:center;gap:10px;";}
  }
  var count=0;
  var iv=setInterval(function(){forceViewSwitcher();count++;if(count>20)clearInterval(iv);},500);
})();


// ========== NAV-FIX LOADER ==========
// Load nav-fix.js dynamically to fix navigation issues
(function(){var s=document.createElement("script");s.src="/js/nav-fix.js";s.defer=true;document.body.appendChild(s);})();

// ========== PERSISTENT VIEW-SWITCHER FIX ==========
// Keeps dropdown visible against rogue scripts that hide it
(function(){
  var nrStyle = "display:flex!important;visibility:visible!important;align-items:center;gap:10px;position:absolute!important;right:16px!important;top:50%!important;transform:translateY(-50%)!important;";
  var ddStyle = "display:inline-block!important;visibility:visible!important;width:auto!important;height:auto!important;min-width:140px!important;min-height:28px!important;padding:5px 10px!important;font-size:13px!important;background:#1a1a1a!important;color:#bfa260!important;border:1px solid #bfa260!important;border-radius:6px!important;cursor:pointer!important;-webkit-appearance:menulist!important;appearance:auto!important;";
  function forceViewSwitcher(){
    var vs=document.getElementById("viewSwitcher");
    var dd=document.getElementById("viewDropdown");
    var nr=document.querySelector(".nav-right");
    if(vs){vs.style.cssText="display:inline-block!important;visibility:visible!important;";}
    if(dd){dd.style.cssText=ddStyle;}
    if(nr && window.innerWidth > 900){nr.style.cssText=nrStyle;}
  }
  var count=0;
  var iv=setInterval(function(){forceViewSwitcher();count++;if(count>20)clearInterval(iv);},500);
})();

// ========== NAV-FIX LOADER ==========
// Load nav-fix.js dynamically to fix navigation issues
(function(){var s=document.createElement("script");s.src="/js/nav-fix.js";s.defer=true;document.body.appendChild(s);})();

// ========== PERSISTENT VIEW-SWITCHER FIX ==========
(function(){
  var nrStyle = "display:flex!important;visibility:visible!important;align-items:center;gap:10px;position:absolute!important;right:16px!important;top:50%!important;transform:translateY(-50%)!important;";
  var ddStyle = "display:inline-block!important;visibility:visible!important;width:auto!important;height:auto!important;min-width:140px!important;min-height:28px!important;padding:5px 10px!important;font-size:13px!important;background:#1a1a1a!important;color:#bfa260!important;border:1px solid #bfa260!important;border-radius:6px!important;cursor:pointer!important;-webkit-appearance:menulist!important;appearance:auto!important;";
  function forceViewSwitcher(){
    var vs=document.getElementById("viewSwitcher");
    var dd=document.getElementById("viewDropdown");
    var nr=document.querySelector(".nav-right");
    if(vs){vs.style.cssText="display:inline-block!important;visibility:visible!important;";}
    if(dd){dd.style.cssText=ddStyle;}
    if(nr && window.innerWidth > 900){nr.style.cssText=nrStyle;}
  }
  var count=0;
  var iv=setInterval(function(){forceViewSwitcher();count++;if(count>20)clearInterval(iv);},500);
})();
