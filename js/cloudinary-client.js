// ============================================================
// Housley Happy Paws — Cloudinary Photo Manager
// Client-side upload & display via Cloudinary Upload Widget
// ============================================================

const HHP_Photos = {
  CLOUD_NAME: 'dg1p1zjgv',
  UPLOAD_PRESET: 'hhp_unsigned',  // We'll create this unsigned preset
  FOLDER: 'housley-happy-paws',
  widget: null,
  currentSlot: null,
  photos: {},  // { slotId: { publicId, url, thumbnail } }

  // ── Initialize ──────────────────────────────────────────────────────────
  init() {
    // Load saved photos from Supabase (if available)
    this.loadPhotos();
    // Attach Cloudinary widget listeners to all upload slots
    this.wireUploadSlots();
    console.log('📸 HHP_Photos initialized');
  },

  // ── Create/get the Cloudinary Upload Widget ─────────────────────
  getWidget() {
    if (this.widget) return this.widget;

    if (typeof cloudinary === 'undefined') {
      console.error('Cloudinary widget script not loaded');
      toast('Photo upload not available — please refresh the page.');
      return null;
    }

    this.widget = cloudinary.createUploadWidget({
      cloudName: this.CLOUD_NAME,
      uploadPreset: this.UPLOAD_PRESET,
      folder: this.FOLDER,
      sources: ['local', 'camera'],
      multiple: false,
      maxFileSize: 10000000,  // 10MB
      maxImageWidth: 2400,
      maxImageHeight: 2400,
      cropping: true,
      croppingAspectRatio: null,  // Free crop, user decides
      croppingShowDimensions: true,
      showSkipCropButton: true,
      resourceType: 'image',
      clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      theme: 'minimal',
      styles: {
        palette: {
          window: '#FDFAF5',
          windowBorder: '#C8963E',
          tabIcon: '#3D5A47',
          menuIcons: '#5C3D1E',
          textDark: '#1E1409',
          textLight: '#FDFAF5',
          link: '#C8963E',
          action: '#3D5A47',
          inactiveTabIcon: '#8C6B4A',
          error: '#C4756A',
          inProgress: '#C8963E',
          complete: '#3D5A47',
          sourceBg: '#FAF6EE'
        },
        fonts: {
          default: null,
          "'Jost', sans-serif": { url: 'https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600&display=swap', active: true }
        }
      }
    }, (error, result) => {
      if (error) {
        console.error('Upload error:', error);
        toast('Upload failed — please try again.');
        return;
      }
      if (result.event === 'success') {
        this.handleUploadSuccess(result.info);
      }
    });

    return this.widget;
  },

  // ── Handle successful upload ────────────────────────────────────────
  handleUploadSuccess(info) {
    const slot = this.currentSlot;
    if (!slot) return;

    const photoData = {
      publicId: info.public_id,
      url: info.secure_url,
      thumbnail: info.thumbnail_url || this.getThumbnail(info.public_id, 300, 225),
      width: info.width,
      height: info.height,
      format: info.format
    };

    // Store in local state
    this.photos[slot] = photoData;

    // Update the UI slot
    this.updateSlotPreview(slot, photoData);

    // Save to Supabase
    this.savePhoto(slot, photoData);

    toast('📸 Photo uploaded successfully!');
    console.log(`Photo uploaded for slot "${slot}":`, photoData.url);
  },

  // ── Cloudinary URL helpers ──────────────────────────────────────────
  getThumbnail(publicId, w, h) {
    return `https://res.cloudinary.com/${this.CLOUD_NAME}/image/upload/c_fill,w_${w},h_${h},q_auto,f_auto/${publicId}`;
  },

  getOptimized(publicId, w) {
    return `https://res.cloudinary.com/${this.CLOUD_NAME}/image/upload/c_fill,w_${w},q_auto,f_auto/${publicId}`;
  },

  getResponsive(publicId) {
    // Returns srcset-ready URLs for responsive images
    const sizes = [400, 800, 1200, 1600];
    return sizes.map(w =>
      `https://res.cloudinary.com/${this.CLOUD_NAME}/image/upload/c_fill,w_${w},q_auto,f_auto/${publicId} ${w}w`
    ).join(', ');
  },

  // ── Open upload widget for a specific slot ──────────────────────
  openUpload(slotId) {
    this.currentSlot = slotId;
    const widget = this.getWidget();
    if (widget) widget.open();
  },

  // ── Wire up all photo upload slots ──────────────────────────────
  wireUploadSlots() {
    // Map of slot IDs to their container elements
    const slotMap = {
      'hero': 'heroPhotoPreview',
      'about1': null,  // These use the photo-upload-slot divs
      'about2': null,
      'about3': null,
      'svc-dog-walk': null,
      'svc-drop-in': null,
      'svc-boarding': null,
      'svc-cat-care': null,
      'svc-paw-bus': null,
      'svc-house-sitting': null,
      'svc-doggy-daycare': null,
      'svc-extra': null,
      'logo': null
    };

    // Override the hero photo click
    const heroPreview = document.getElementById('heroPhotoPreview');
    if (heroPreview) {
      heroPreview.onclick = (e) => {
        e.preventDefault();
        this.openUpload('hero');
      };
    }

    // Override the Browse Files button for hero
    const heroBrowse = heroPreview?.parentElement?.querySelector('.btn-outline');
    if (heroBrowse) {
      heroBrowse.onclick = (e) => {
        e.preventDefault();
        this.openUpload('hero');
      };
    }

    // Override about photo slots
    this.wireSlot('aboutPhoto1', 'about1');
    this.wireSlot('aboutPhoto2', 'about2');
    this.wireSlot('aboutPhoto3', 'about3');

    // Override service photo slots
    this.wireSlot('svcPhoto1', 'svc-dog-walk');
    this.wireSlot('svcPhoto2', 'svc-drop-in');
    this.wireSlot('svcPhoto3', 'svc-boarding');
    this.wireSlot('svcPhoto4', 'svc-cat-care');
    this.wireSlot('svcPhoto5', 'svc-paw-bus');
    this.wireSlot('svcPhoto6', 'svc-house-sitting');
    this.wireSlot('svcPhoto7', 'svc-doggy-daycare');
    this.wireSlot('svcPhoto8', 'svc-extra');

    // Override logo slot
    this.wireSlot('logoUpload', 'logo');
  },

  // Direct mapping of slotId → the onclick selector used to find the element
  SLOT_INPUT_MAP: {
    'about1': 'aboutPhoto1', 'about2': 'aboutPhoto2', 'about3': 'aboutPhoto3',
    'svc-dog-walk': 'svcPhoto1', 'svc-drop-in': 'svcPhoto2', 'svc-boarding': 'svcPhoto3',
    'svc-cat-care': 'svcPhoto4', 'svc-paw-bus': 'svcPhoto5', 'svc-house-sitting': 'svcPhoto6',
    'svc-doggy-daycare': 'svcPhoto7', 'svc-extra': 'svcPhoto8', 'logo': 'logoUpload'
  },

  wireSlot(inputId, slotId) {
    // Find the parent upload slot div that triggers the hidden input
    const input = document.getElementById(inputId);
    if (!input) {
      console.warn(`📸 wireSlot: input #${inputId} not found for slot "${slotId}"`);
      return;
    }

    const parentSlot = input.previousElementSibling ||
      document.querySelector(`[onclick*="${inputId}"]`) ||
      input.closest('.card')?.querySelector('.photo-upload-slot');

    // Find the clickable slot div
    const clickables = document.querySelectorAll(`[onclick*="triggerUpload('${inputId}')"]`);
    if (clickables.length === 0) {
      console.warn(`📸 wireSlot: no clickable elements found for input "${inputId}" / slot "${slotId}"`);
    }
    clickables.forEach(el => {
      el.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openUpload(slotId);
      };
      // Store slot reference for later preview updates
      el.dataset.photoSlot = slotId;
    });
  },

  // ── Update slot UI with uploaded photo ────────────────────────────
  updateSlotPreview(slotId, photoData) {
    if (slotId === 'hero') {
      this.updateHeroPreview(photoData);
      return;
    }

    // Find the slot element by data attribute
    const slotEl = document.querySelector(`[data-photo-slot="${slotId}"]`);
    if (slotEl) {
      slotEl.style.cssText += `;background-image:url(${photoData.thumbnail});background-size:cover;background-position:center;position:relative`;
      slotEl.innerHTML = `
        <div style="position:absolute;inset:0;background:rgba(0,0,0,0.15);border-radius:inherit;display:flex;align-items:flex-end;justify-content:center;padding:6px">
          <div style="background:rgba(30,20,9,0.75);color:white;padding:2px 8px;border-radius:4px;font-size:0.6rem;font-weight:600">✅ Uploaded</div>
        </div>
      `;
      // Add delete button on hover
      slotEl.title = 'Click to replace photo';
    }
  },

  updateHeroPreview(photoData) {
    const preview = document.getElementById('heroPhotoPreview');
    if (preview) {
      preview.style.backgroundImage = `url(${photoData.thumbnail})`;
      preview.style.backgroundSize = 'cover';
      preview.style.backgroundPosition = 'center';
      preview.style.border = 'none';
      // Remove hover handlers that reset the background
      preview.onmouseover = null;
      preview.onmouseout = null;
      preview.innerHTML = `
        <div style="position:absolute;bottom:8px;right:8px;background:rgba(30,20,9,0.7);color:white;padding:3px 10px;border-radius:4px;font-size:0.7rem;font-weight:600">✅ Uploaded</div>
      `;
    }
    // Also update the public site hero if visible
    this.updatePublicHero(photoData);
  },

  // ── Update public-facing site with Cloudinary images ──────────
  updatePublicHero(photoData) {
    const heroInner = document.querySelector('.hero-photo-inner');
    if (heroInner) {
      heroInner.style.cssText = `width:100%;height:100%;background-size:cover;background-position:center;border-radius:8px;background-image:url(${this.getOptimized(photoData.publicId, 800)})`;
      heroInner.textContent = '';
    }
  },

  updatePublicSite() {
    // Update all public-facing images from stored photos
    if (this.photos.hero) {
      this.updatePublicHero(this.photos.hero);
    }

    // Update about section photo with first available about photo
    const aboutPhoto = this.photos.about1 || this.photos.about2 || this.photos.about3;
    if (aboutPhoto) {
      const aboutContainer = document.querySelector('.about-photo-single');
      if (aboutContainer) {
        aboutContainer.style.backgroundImage = `url(${this.getOptimized(aboutPhoto.publicId, 800)})`;
        aboutContainer.style.backgroundSize = 'cover';
        aboutContainer.style.backgroundPosition = 'center';
        aboutContainer.innerHTML = '';
      }
    }

    // Update service cards with real photos
    const serviceMapping = {
      'svc-dog-walk': 'Dog Walking',
      'svc-drop-in': 'Drop-In',
      'svc-boarding': 'Boarding',
      'svc-cat-care': 'Cat Care',
      'svc-paw-bus': 'Paw Bus',
      'svc-house-sitting': 'House Sitting',
      'svc-doggy-daycare': 'Day Care'
    };

    Object.entries(serviceMapping).forEach(([slotId, serviceName]) => {
      if (this.photos[slotId]) {
        const photo = this.photos[slotId];
        // Find service card by matching the sc-name text
        const cards = document.querySelectorAll('.service-card');
        cards.forEach(card => {
          const nameEl = card.querySelector('.sc-name');
          if (nameEl && nameEl.textContent.includes(serviceName)) {
            // Replace the emoji icon with the uploaded photo
            const iconEl = card.querySelector('.sc-icon');
            if (iconEl) {
              iconEl.style.cssText = 'width:100%;height:140px;border-radius:10px;background-size:cover;background-position:center;margin-bottom:10px;font-size:0';
              iconEl.style.backgroundImage = `url(${this.getOptimized(photo.publicId, 600)})`;
              iconEl.textContent = '';
            }
          }
        });
      }
    });

    // Update logo
    if (this.photos.logo) {
      const logos = document.querySelectorAll('.nav-logo-icon, .footer-logo');
      logos.forEach(logo => {
        if (logo.tagName === 'IMG') {
          logo.src = this.getOptimized(this.photos.logo.publicId, 80);
        }
      });
    }
  },

  // ── Save photo reference to Supabase ──────────────────────────────
  async savePhoto(slotId, photoData) {
    if (typeof HHP_Auth === 'undefined' || !HHP_Auth.supabase) {
      // Store locally as fallback
      try {
        localStorage.setItem('hhp_photos', JSON.stringify(this.photos));
      } catch (e) {}
      return;
    }

    try {
      const { error } = await HHP_Auth.supabase
        .from('site_photos')
        .upsert({
          slot_id: slotId,
          public_id: photoData.publicId,
          url: photoData.url,
          thumbnail: photoData.thumbnail,
          width: photoData.width,
          height: photoData.height,
          format: photoData.format,
          updated_at: new Date().toISOString()
        }, { onConflict: 'slot_id' });

      if (error) {
        console.error('Error saving photo to Supabase:', error);
        // Fallback to localStorage
        try {
          localStorage.setItem('hhp_photos', JSON.stringify(this.photos));
        } catch (e) {}
      }
    } catch (err) {
      console.error('Supabase save error:', err);
    }
  },

  // ── Get a Supabase client (works even without auth) ──────────
  _getSupabase() {
    // Always prefer the auth client to avoid duplicate GoTrueClient instances
    if (typeof HHP_Auth !== 'undefined' && HHP_Auth.supabase) return HHP_Auth.supabase;
    // Reuse existing singleton if available
    if (this._anonClient) return this._anonClient;
    return null;
  },

  // ── Load photos from Supabase (with retry if auth not ready) ──
  _loadRetries: 0,
  async loadPhotos() {
    // Try Supabase — works for all visitors via anon key + public RLS
    const sb = this._getSupabase();
    if (sb) {
      try {
        const { data, error } = await sb
          .from('site_photos')
          .select('*');

        if (!error && data && data.length > 0) {
          data.forEach(row => {
            this.photos[row.slot_id] = {
              publicId: row.public_id,
              url: row.url,
              thumbnail: row.thumbnail,
              width: row.width,
              height: row.height,
              format: row.format
            };
          });
          // Update all previews and public site
          this.restoreAllPreviews();
          this.updatePublicSite();
          // Rebuild gallery slideshows now that real photos are available
          if (window.HHP_Gallery && HHP_Gallery.rebuildSlideshows) HHP_Gallery.rebuildSlideshows();
          console.log(`📸 Loaded ${data.length} photos from database`);
          return;
        }
      } catch (err) {
        console.error('Error loading photos from Supabase:', err);
      }
    } else {
      // Supabase client not ready — retry up to 5 times with increasing delay
      if (this._loadRetries < 5) {
        this._loadRetries++;
        const delay = 800 * this._loadRetries;
        console.log(`📸 Supabase not ready, retrying in ${delay}ms (attempt ${this._loadRetries}/5)...`);
        setTimeout(() => this.loadPhotos(), delay);
        return;
      } else {
        console.warn('📸 Supabase client never became available after 5 retries');
      }
    }

    // Fallback: try localStorage
    try {
      const saved = localStorage.getItem('hhp_photos');
      if (saved) {
        this.photos = JSON.parse(saved);
        this.restoreAllPreviews();
        this.updatePublicSite();
        if (window.HHP_Gallery && HHP_Gallery.rebuildSlideshows) HHP_Gallery.rebuildSlideshows();
        console.log('📸 Loaded photos from localStorage');
      }
    } catch (e) {}
  },

  // ── Restore all preview slots from stored data ──────────────────
  restoreAllPreviews() {
    // First, re-wire upload slots to ensure data-photo-slot attrs are set
    this.wireUploadSlots();

    Object.entries(this.photos).forEach(([slotId, photoData]) => {
      if (photoData && photoData.thumbnail) {
        this.updateSlotPreview(slotId, photoData);

        // Fallback: if data-photo-slot element wasn't found, try the direct input mapping
        if (slotId !== 'hero') {
          const existing = document.querySelector(`[data-photo-slot="${slotId}"]`);
          if (!existing) {
            const inputId = this.SLOT_INPUT_MAP[slotId];
            if (inputId) {
              const fallbackEl = document.querySelector(`[onclick*="triggerUpload('${inputId}')"]`);
              if (fallbackEl) {
                fallbackEl.dataset.photoSlot = slotId;
                this.updateSlotPreview(slotId, photoData);
                console.log(`📸 Restored slot "${slotId}" via fallback lookup`);
              }
            }
          }
        }
      }
    });
  },

  // ── Delete a photo ────────────────────────────────────────────
  async deletePhoto(slotId) {
    const photo = this.photos[slotId];
    if (!photo) return;

    // Try to delete from Cloudinary via API
    try {
      const response = await fetch('/api/cloudinary-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId: photo.publicId })
      });
      if (!response.ok) {
        console.warn('Could not delete from Cloudinary — will remove reference only');
      }
    } catch (err) {
      console.warn('Cloudinary delete API not available:', err);
    }

    // Remove from Supabase
    if (typeof HHP_Auth !== 'undefined' && HHP_Auth.supabase) {
      await HHP_Auth.supabase
        .from('site_photos')
        .delete()
        .eq('slot_id', slotId);
    }

    // Remove from local state
    delete this.photos[slotId];
    try {
      localStorage.setItem('hhp_photos', JSON.stringify(this.photos));
    } catch (e) {}

    toast('🗑️ Photo removed');
  }
};

// ── Auto-initialize when DOM is ready ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Delay to let Supabase JS library and auth initialize first
  setTimeout(() => {
    HHP_Photos.init();
  }, 1200);
});
