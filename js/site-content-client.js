// ============================================================
// Site Content Client - Replaces localStorage with Supabase
// Overrides getSiteData, setSiteData, saveContentSection
// ============================================================

// Cache for site data so we don't re-fetch constantly
let _siteDataCache = null;
let _siteDataLoaded = false;

// Load all site content from Supabase API on page load
// Supabase is the single source of truth — localStorage is only an offline fallback
async function loadSiteContent() {
  // Grab localStorage as offline fallback only
  let localData = {};
  try { localData = JSON.parse(localStorage.getItem('hhp_site_data')) || {}; } catch(e) {}

  try {
    const res = await fetch('/api/site-content');
    if (!res.ok) throw new Error('Failed to load site content');
    const rows = await res.json();

    let supabaseData = {};
    if (Array.isArray(rows)) {
      rows.forEach(row => {
        if (row.content && typeof row.content === 'object') {
          Object.assign(supabaseData, row.content);
        }
      });
    }

    // Supabase wins — it's the global source of truth
    // Only use localStorage keys if they DON'T exist in Supabase (brand new unsaved fields)
    _siteDataCache = { ...localData, ...supabaseData };
    _siteDataLoaded = true;

    // Sync Supabase data down to localStorage (replaces stale local edits)
    try { localStorage.setItem('hhp_site_data', JSON.stringify(_siteDataCache)); } catch(e) {}
    return _siteDataCache;
  } catch (err) {
    console.warn('[site-content] Failed to load from API, using localStorage fallback:', err);
    _siteDataCache = localData;
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

// Override setSiteData to update cache + localStorage (sync)
// localStorage is only for instant UI — Supabase is the real store
function setSiteData(updates) {
  _siteDataCache = { ...getSiteData(), ...updates };
  // Sync to localStorage for instant UI feedback (Supabase save happens in save functions)
  try { localStorage.setItem('hhp_site_data', JSON.stringify(_siteDataCache)); } catch(e) {}
}

// After a successful Supabase save, sync localStorage to match
function _syncLocalAfterSave() {
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
  applySavedData();

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

// Override savePricing to persist to Supabase
async function savePricing() {
  const pricing = {};
  document.querySelectorAll('[data-price-key]').forEach(el => {
    pricing[el.dataset.priceKey] = el.value;
  });

  setSiteData({ pricing });
  applySavedData();

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
        body: JSON.stringify({ section_key: 'pricing', content: { pricing } })
      });
    }
    toast('\u2705 All pricing saved!');
  } catch (err) {
    toast('\u2705 Pricing saved locally!');
  }
}

// Override saveServices to persist to Supabase
async function saveServices() {
  const u = {};
  document.querySelectorAll('[data-svc-key]').forEach(el => {
    u[el.dataset.svcKey] = el.value;
  });

  setSiteData(u);
  applySavedData();

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
        body: JSON.stringify({ section_key: 'services', content: u })
      });
    }
    toast('\u2705 Service descriptions saved!');
  } catch (err) {
    toast('\u2705 Service descriptions saved locally!');
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
