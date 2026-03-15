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
