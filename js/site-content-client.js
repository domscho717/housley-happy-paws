// ============================================================
// Site Content Client - Replaces localStorage with Supabase
// Overrides getSiteData, setSiteData, saveContentSection
// ============================================================

// Cache for site data so we don't re-fetch constantly
let _siteDataCache = null;
let _siteDataLoaded = false;

// Load all site content from Supabase API on page load
async function loadSiteContent() {
  try {
    const res = await fetch('/api/site-content');
    if (!res.ok) throw new Error('Failed to load site content');
    const rows = await res.json();
    if (Array.isArray(rows)) {
      _siteDataCache = {};
      rows.forEach(row => {
        if (row.content && typeof row.content === 'object') {
          Object.assign(_siteDataCache, row.content);
        }
      });
    }
    _siteDataLoaded = true;
    // Also sync to localStorage as fallback
    try { localStorage.setItem('hhp_site_data', JSON.stringify(_siteDataCache)); } catch(e) {}
    return _siteDataCache;
  } catch (err) {
    console.warn('[site-content] Failed to load from API, falling back to localStorage:', err);
    try { _siteDataCache = JSON.parse(localStorage.getItem('hhp_site_data')) || {}; } catch(e) { _siteDataCache = {}; }
    _siteDataLoaded = true;
    return _siteDataCache;
  }
}

// Override getSiteData to use cache
function getSiteData() {
  if (_siteDataCache) return { ..._siteDataCache };
  // Fallback to localStorage if cache not loaded yet
  try { return JSON.parse(localStorage.getItem('hhp_site_data')) || {}; } catch(e) { return {}; }
}

// Override setSiteData to update cache + localStorage (sync) + Supabase (async)
function setSiteData(updates) {
  _siteDataCache = { ...getSiteData(), ...updates };
  // Sync to localStorage immediately for instant UI feedback
  try { localStorage.setItem('hhp_site_data', JSON.stringify(_siteDataCache)); } catch(e) {}
}

// Override saveContentSection to persist to Supabase
async function saveContentSection(section) {
  const updates = {};
  document.querySelectorAll('#ce-' + section + ' .ce-field').forEach(f => {
    updates[f.dataset.field] = f.value || f.textContent;
  });

  // Update local cache + localStorage immediately
  setSiteData(updates);
  applySavedData();

  // Save to Supabase via API
  try {
    const token = (typeof HHP_Auth !== 'undefined' && HHP_Auth.session)
      ? HHP_Auth.session.access_token : null;
    if (!token) {
      toast('Saved locally! Sign in as owner to save permanently.');
      return;
    }

    const res = await fetch('/api/site-content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ section_key: section, content: updates })
    });

    if (!res.ok) {
      const err = await res.json();
      toast('Saved locally but cloud save failed: ' + (err.error || 'Unknown error'));
      return;
    }

    toast('\u2705 ' + section.charAt(0).toUpperCase() + section.slice(1) + ' section saved!');
  } catch (err) {
    toast('Saved locally but cloud sync failed. Will retry next time.');
  }
}

// Override saveFooter similarly
async function saveFooter() {
  const updates = {};
  document.querySelectorAll('#ce-footer .ce-field').forEach(f => {
    updates[f.dataset.field] = f.value;
  });

  setSiteData(updates);

  try {
    const token = (typeof HHP_Auth !== 'undefined' && HHP_Auth.session)
      ? HHP_Auth.session.access_token : null;
    if (token) {
      await fetch('/api/site-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ section_key: 'footer', content: updates })
      });
    }
    toast('\u2705 Contact info saved!');
  } catch (err) {
    toast('\u2705 Contact info saved locally!');
  }
}

// Auto-load site content on page ready
document.addEventListener('DOMContentLoaded', async () => {
  await loadSiteContent();
  // Apply loaded data to the page
  if (typeof applySavedData === 'function') {
    applySavedData();
  }
});

console.log('[site-content-client.js] Content persistence overrides loaded');
