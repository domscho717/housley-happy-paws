// ============================================================
// Housley Happy Paws — Profile Picture / Avatar System
// Handles upload via Cloudinary, saves URL to Supabase profiles,
// and displays avatars across sidebar, messages, and booking cards.
// ============================================================

const HHP_Avatar = {
  CLOUD_NAME: 'dg1p1zjgv',
  UPLOAD_PRESET: 'hhp_unsigned',
  FOLDER: 'housley-happy-paws/avatars',
  widget: null,
  _onUploadCallback: null,

  // ── Get or create the Cloudinary Upload Widget (avatar-specific) ──
  getWidget() {
    if (this.widget) return this.widget;
    if (typeof cloudinary === 'undefined') {
      toast('Photo upload not available — please refresh.');
      return null;
    }

    this.widget = cloudinary.createUploadWidget({
      cloudName: this.CLOUD_NAME,
      uploadPreset: this.UPLOAD_PRESET,
      folder: this.FOLDER,
      sources: ['local', 'camera'],
      multiple: false,
      maxFileSize: 5000000, // 5MB
      maxImageWidth: 800,
      maxImageHeight: 800,
      cropping: true,
      croppingAspectRatio: 1, // Square crop for avatars
      croppingShowDimensions: true,
      showSkipCropButton: false,
      resourceType: 'image',
      clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      theme: 'minimal',
      styles: {
        palette: {
          window: '#FDFAF5', windowBorder: '#C8963E',
          tabIcon: '#3D5A47', menuIcons: '#5C3D1E',
          textDark: '#1E1409', textLight: '#FDFAF5',
          link: '#C8963E', action: '#3D5A47',
          inactiveTabIcon: '#8C6B4A', error: '#C4756A',
          inProgress: '#C8963E', complete: '#3D5A47',
          sourceBg: '#FAF6EE'
        }
      }
    }, (error, result) => {
      if (error) { toast('Upload failed — please try again.'); return; }
      if (result.event === 'success') {
        var url = result.info.secure_url;
        // Create a cropped/optimized URL for avatar use
        var publicId = result.info.public_id;
        var avatarUrl = 'https://res.cloudinary.com/' + this.CLOUD_NAME +
          '/image/upload/c_fill,w_200,h_200,g_face,q_auto,f_auto/' + publicId;
        if (this._onUploadCallback) {
          this._onUploadCallback(avatarUrl, publicId);
        }
      }
    });
    return this.widget;
  },

  // ── Open the upload widget ──
  openUpload(callback) {
    this._onUploadCallback = callback;
    var w = this.getWidget();
    if (w) w.open();
  },

  // ── Save avatar URL to current user's profile in Supabase ──
  async saveAvatarToProfile(avatarUrl) {
    var sb = (typeof HHP_Auth !== 'undefined' && HHP_Auth.supabase) ? HHP_Auth.supabase : null;
    if (!sb || !HHP_Auth.currentUser) {
      toast('Please sign in to save your profile picture.');
      return false;
    }

    try {
      var { error } = await sb.from('profiles')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('user_id', HHP_Auth.currentUser.id);

      if (error) {
        console.error('Avatar save error:', error);
        toast('Failed to save profile picture.');
        return false;
      }

      // Update local profile cache
      if (HHP_Auth.currentUser.profile) {
        HHP_Auth.currentUser.profile.avatar_url = avatarUrl;
      }
      // Cache in sessionStorage for instant display on reload
      try { sessionStorage.setItem('hhp_avatar_url', avatarUrl); } catch(e) {}

      return true;
    } catch (err) {
      console.error('Avatar save error:', err);
      toast('Failed to save profile picture.');
      return false;
    }
  },

  // ── Get avatar URL for current user ──
  getCurrentAvatarUrl() {
    // Try profile first, then session cache
    if (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentUser?.profile?.avatar_url) {
      return HHP_Auth.currentUser.profile.avatar_url;
    }
    try { return sessionStorage.getItem('hhp_avatar_url') || ''; } catch(e) { return ''; }
  },

  // ── Build avatar HTML (reusable) ──
  // size: pixel dimension, fallback: emoji fallback
  avatarHTML(url, size, fallback) {
    size = size || 40;
    fallback = fallback || '🐾';
    if (url) {
      return '<img src="' + url + '" alt="Profile" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;border:2px solid var(--gold-light, #e0d5c5);flex-shrink:0">';
    }
    return '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:var(--gold-light, #f5e6c8);display:flex;align-items:center;justify-content:center;font-size:' + Math.round(size * 0.45) + 'px;flex-shrink:0;border:2px solid var(--gold-light, #e0d5c5)">' + fallback + '</div>';
  },

  // ── Build the upload section HTML (reusable across all portals) ──
  buildUploadSection(currentUrl) {
    if (currentUrl) {
      // Photo exists — compact row: small avatar + Change / Remove buttons
      return [
        '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--warm, #faf6ee);border-radius:10px;border:1px solid var(--border, #e0d5c5)">',
        '  <div class="avatar-preview-slot" style="cursor:pointer" onclick="HHP_Avatar.uploadMyAvatar()">',
        '    <img src="' + currentUrl + '" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--gold, #c8963e)">',
        '  </div>',
        '  <div style="flex:1;display:flex;gap:8px;flex-wrap:wrap;align-items:center">',
        '    <button class="btn btn-gold btn-sm" onclick="HHP_Avatar.uploadMyAvatar()" style="font-size:0.75rem;padding:5px 12px">📷 Change Photo</button>',
        '    <button class="btn btn-outline btn-sm" onclick="HHP_Avatar.removeMyAvatar()" style="font-size:0.75rem;padding:5px 12px">Remove</button>',
        '  </div>',
        '</div>'
      ].join('\n');
    } else {
      // No photo — show description + Upload button
      return [
        '<div style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--warm, #faf6ee);border-radius:10px;border:1px solid var(--border, #e0d5c5)">',
        '  <div class="avatar-preview-slot" style="cursor:pointer" onclick="HHP_Avatar.uploadMyAvatar()">',
        '    <div style="width:56px;height:56px;border-radius:50%;background:var(--gold-pale, #fdf7ee);border:2px dashed var(--border, #e0d5c5);display:flex;align-items:center;justify-content:center;font-size:1.5rem">🐾</div>',
        '  </div>',
        '  <div style="flex:1">',
        '    <div style="font-weight:600;font-size:0.88rem;margin-bottom:3px">Profile Picture</div>',
        '    <div style="font-size:0.75rem;color:var(--mid, #8c6b4a);margin-bottom:6px">Upload a photo — it shows on messages, bookings, and your profile.</div>',
        '    <button class="btn btn-gold btn-sm" onclick="HHP_Avatar.uploadMyAvatar()" style="font-size:0.75rem;padding:5px 12px">📷 Upload Photo</button>',
        '  </div>',
        '</div>'
      ].join('\n');
    }
  },

  // ── Upload avatar for the currently signed-in user ──
  uploadMyAvatar() {
    this.openUpload(async (avatarUrl, publicId) => {
      var ok = await this.saveAvatarToProfile(avatarUrl);
      if (ok) {
        toast('📸 Profile picture updated!');
        this.refreshAllAvatars();
      }
    });
  },

  // ── Remove avatar ──
  async removeMyAvatar() {
    var sb = (typeof HHP_Auth !== 'undefined' && HHP_Auth.supabase) ? HHP_Auth.supabase : null;
    if (!sb || !HHP_Auth.currentUser) return;

    var { error } = await sb.from('profiles')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('user_id', HHP_Auth.currentUser.id);

    if (!error) {
      if (HHP_Auth.currentUser.profile) HHP_Auth.currentUser.profile.avatar_url = null;
      try { sessionStorage.removeItem('hhp_avatar_url'); } catch(e) {}
      toast('Profile picture removed.');
      this.refreshAllAvatars();
    }
  },

  // ── Refresh all avatar displays on the page ──
  refreshAllAvatars() {
    var url = this.getCurrentAvatarUrl();

    // Update all sidebar avatars for the current user's portal
    document.querySelectorAll('.sidebar-user .sb-ava').forEach(function(el) {
      // Only update the active portal's sidebar
      var page = el.closest('.page');
      if (!page || !page.classList.contains('active')) return;
      if (url) {
        el.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
      }
    });

    // Update any avatar-preview-slot on the page
    document.querySelectorAll('.avatar-preview-slot').forEach(function(el) {
      if (url) {
        el.innerHTML = '<img src="' + url + '" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--gold, #c8963e)">';
      } else {
        el.innerHTML = '<div style="width:56px;height:56px;border-radius:50%;background:var(--gold-pale, #fdf7ee);border:2px dashed var(--border, #e0d5c5);display:flex;align-items:center;justify-content:center;font-size:1.5rem">🐾</div>';
      }
    });

    // Re-inject upload section in the dashboard card if it exists
    var uploadCard = document.getElementById('avatar-upload-card');
    if (uploadCard) {
      uploadCard.innerHTML = this.buildUploadSection(url);
      // Show/hide the "Your Profile Picture" title based on whether photo exists
      var parentCard = uploadCard.parentElement;
      if (parentCard) {
        var titleEl = parentCard.querySelector('.avatar-upload-title');
        if (url && titleEl) {
          titleEl.remove();
        } else if (!url && !parentCard.querySelector('.avatar-upload-title')) {
          var t = document.createElement('div');
          t.className = 'card-title avatar-upload-title';
          t.style.marginBottom = '12px';
          t.textContent = 'Your Profile Picture';
          parentCard.insertBefore(t, uploadCard);
        }
      }
    }
  },

  // ── Fetch avatar for a specific user (by user_id) ──
  _avatarCache: {},
  async getAvatarForUser(userId) {
    if (this._avatarCache[userId] !== undefined) return this._avatarCache[userId];

    var sb = (typeof HHP_Auth !== 'undefined' && HHP_Auth.supabase) ? HHP_Auth.supabase : null;
    if (!sb) return '';

    try {
      var { data, error } = await sb.from('profiles')
        .select('avatar_url')
        .eq('user_id', userId)
        .single();
      var url = (!error && data) ? (data.avatar_url || '') : '';
      this._avatarCache[userId] = url;
      return url;
    } catch(e) { return ''; }
  },

  // ── Inject avatar upload sections into all portal dashboards ──
  injectUploadSections() {
    var url = this.getCurrentAvatarUrl();

    // Client Portal — inject into dashboard
    var cDash = document.getElementById('c-dash');
    if (cDash && !document.getElementById('avatar-upload-card-client')) {
      var card = document.createElement('div');
      card.id = 'avatar-upload-card-client';
      card.className = 'card';
      card.style.cssText = 'margin-bottom:12px;padding:' + (url ? '10px 14px' : '16px') + '';
      card.innerHTML = (url ? '' : '<div class="card-title avatar-upload-title" style="margin-bottom:10px">Your Profile Picture</div>') + '<div id="avatar-upload-card">' + this.buildUploadSection(url) + '</div>';
      // Try customizer grid first, then p-header, then append
      var custGrid = cDash.querySelector('[id^="cust-grid-"]');
      if (custGrid) {
        cDash.insertBefore(card, custGrid);
      } else {
        var header = cDash.querySelector('.p-header');
        if (header && header.nextSibling) {
          cDash.insertBefore(card, header.nextSibling);
        } else {
          cDash.appendChild(card);
        }
      }
    }

    // Owner Portal — inject into overview
    var oOverview = document.getElementById('o-overview');
    if (oOverview && !document.getElementById('avatar-upload-card-owner')) {
      var card = document.createElement('div');
      card.id = 'avatar-upload-card-owner';
      card.style.cssText = 'margin-bottom:12px';
      card.innerHTML = '<div id="avatar-upload-card">' + this.buildUploadSection(url) + '</div>';
      // Try customizer grid first (customizer removes .owner-banner and replaces with widgets)
      var custGrid = oOverview.querySelector('[id^="cust-grid-"]');
      if (custGrid) {
        oOverview.insertBefore(card, custGrid);
      } else {
        // Fallback: insert after owner banner or at top
        var banner = oOverview.querySelector('.owner-banner');
        if (banner && banner.nextSibling) {
          oOverview.insertBefore(card, banner.nextSibling);
        } else {
          // Insert as first child
          oOverview.insertBefore(card, oOverview.firstChild);
        }
      }
    }

    // Staff Portal — inject into schedule (staff main panel is s-sched, not s-dash)
    var sSched = document.getElementById('s-sched');
    if (sSched && !document.getElementById('avatar-upload-card-staff')) {
      var card = document.createElement('div');
      card.id = 'avatar-upload-card-staff';
      card.className = 'card';
      card.style.cssText = 'margin-bottom:12px;padding:' + (url ? '10px 14px' : '16px') + '';
      card.innerHTML = (url ? '' : '<div class="card-title avatar-upload-title" style="margin-bottom:10px">Your Profile Picture</div>') + '<div id="avatar-upload-card">' + this.buildUploadSection(url) + '</div>';
      // Try customizer grid first, then p-header, then prepend
      var custGrid = sSched.querySelector('[id^="cust-grid-"]');
      if (custGrid) {
        sSched.insertBefore(card, custGrid);
      } else {
        var header = sSched.querySelector('.p-header');
        if (header && header.nextSibling) {
          sSched.insertBefore(card, header.nextSibling);
        } else {
          sSched.appendChild(card);
        }
      }
    }

    // Update sidebar avatars
    this.applySidebarAvatars();
  },

  // ── Apply avatar to the current user's own sidebar only ──
  applySidebarAvatars() {
    var url = this.getCurrentAvatarUrl();
    if (!url) return;

    // Only apply to the user's own portal sidebar, not all portals
    var role = (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentRole) ? HHP_Auth.currentRole : null;
    var portalId = role === 'owner' ? 'pg-owner' : role === 'staff' ? 'pg-staff' : 'pg-client';
    var portal = document.getElementById(portalId);
    if (portal) {
      var ava = portal.querySelector('.sidebar-user .sb-ava');
      if (ava) ava.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
    }
  },

  // ── Initialize: inject sections and wire up ──
  init() {
    var self = this;

    // Immediately apply cached avatar to owner sidebar only (no auth needed) to prevent flash
    var cachedUrl = '';
    try { cachedUrl = sessionStorage.getItem('hhp_avatar_url') || ''; } catch(e) {}
    if (cachedUrl) {
      var ownerAva = document.querySelector('#pg-owner .sidebar-user .sb-ava');
      if (ownerAva) ownerAva.innerHTML = '<img src="' + cachedUrl + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
    }

    // Wait for auth to be ready, then inject upload sections
    var attempts = 0;
    function tryInit() {
      attempts++;
      if (typeof HHP_Auth !== 'undefined' && HHP_Auth.currentUser) {
        self.injectUploadSections();
      } else if (attempts < 20) {
        setTimeout(tryInit, 500);
      }
    }
    setTimeout(tryInit, 1000);
  }
};

// Auto-init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
  HHP_Avatar.init();
});

console.log('[avatar-system.js] Profile picture system loaded');
