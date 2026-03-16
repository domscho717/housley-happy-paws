

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
    // Home button ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ at the very top after header
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
    // Client View button ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ after Edit Link Page (last item)
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
(function() {
  var s = document.createElement('style');
  s.textContent = '.hhp-mobile-nav-v10.hhp-mnav-open { display:flex!important; visibility:visible!important; opacity:1!important; }';
  document.head.appendChild(s);
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
    // Home button ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ at the very top after header
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
    // Client View button ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ after Edit Link Page (last item)
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
