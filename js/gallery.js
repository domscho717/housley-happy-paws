// ============================================================
// Housley Happy Paws — Gallery & Slideshow System (gallery.js)
// 1. About Rachel fade slideshow
// 2. Hero horizontal slide carousel
// 3. Role-based photo gallery (Cloudinary + Supabase)
// 4. Immersive slow-changing gallery backgrounds
// 5. Staff gallery section
// ============================================================

(function() {
  'use strict';

  // ── Utility ───────────────────────────────────────────────────
  function onReady(fn) {
    if (document.readyState !== 'loading') setTimeout(fn, 400);
    else document.addEventListener('DOMContentLoaded', function() { setTimeout(fn, 400); });
  }

  // Placeholder images (warm-toned pet care themed gradients + emoji)
  var PLACEHOLDER_ABOUT = [
    { bg: 'linear-gradient(135deg,#fdf7ee,#f5e6cc)', emoji: '🐕‍🦺', label: 'Rachel with pups' },
    { bg: 'linear-gradient(135deg,#f0e8d8,#e8d5b5)', emoji: '🐱', label: 'Cat cuddles' },
    { bg: 'linear-gradient(135deg,#e8f0e4,#d1e0c9)', emoji: '🐾', label: 'Happy walks' },
    { bg: 'linear-gradient(135deg,#fce8e0,#f5d0c0)', emoji: '🦮', label: 'Dog walking' },
    { bg: 'linear-gradient(135deg,#f5f0e0,#e8dcc0)', emoji: '🏡', label: 'House visits' }
  ];

  var PLACEHOLDER_HERO = [
    { bg: 'linear-gradient(135deg,#fdf7ee,#f5e6cc)', emoji: '🐕‍🦺' },
    { bg: 'linear-gradient(135deg,#e8f0e4,#d1e0c9)', emoji: '🐱' },
    { bg: 'linear-gradient(135deg,#fce8e0,#f5d0c0)', emoji: '🐶' },
    { bg: 'linear-gradient(135deg,#f5f0e0,#e8dcc0)', emoji: '🐾' }
  ];

  // ═══════════════════════════════════════════════════════════════
  // 1. ABOUT RACHEL — FADE SLIDESHOW
  // ═══════════════════════════════════════════════════════════════
  function buildAboutSlideshow() {
    var aboutPhotos = document.querySelector('.about-photos');
    if (!aboutPhotos) return;

    // Check for real Cloudinary photos first
    var realPhotos = [];
    if (window.HHP_Photos && window.HHP_Photos.photos) {
      var photos = window.HHP_Photos.photos;
      // Collect all keys matching "about" + number, sorted numerically
      var aboutKeys = Object.keys(photos).filter(function(k) { return /^about\d+$/.test(k); });
      aboutKeys.sort(function(a, b) { return parseInt(a.replace('about','')) - parseInt(b.replace('about','')); });
      aboutKeys.forEach(function(key) {
        if (photos[key]) realPhotos.push(photos[key]);
      });
    }

    var slides = realPhotos.length > 0
      ? realPhotos.map(function(p) { return { url: p.url || p.thumbnail, label: '' }; })
      : PLACEHOLDER_ABOUT;

    // Clear existing content
    aboutPhotos.innerHTML = '';
    aboutPhotos.style.cssText += ';position:relative;overflow:hidden;';

    // Build fade slideshow
    var wrapper = document.createElement('div');
    wrapper.className = 'hhp-about-slideshow';
    wrapper.style.cssText = 'position:relative;width:100%;height:100%;min-height:340px;border-radius:18px;overflow:hidden;';

    slides.forEach(function(slide, i) {
      var div = document.createElement('div');
      div.className = 'hhp-about-slide';
      div.style.cssText = 'position:absolute;inset:0;opacity:' + (i === 0 ? '1' : '0') +
        ';transition:opacity 1.2s ease-in-out;display:flex;align-items:center;justify-content:center;border-radius:18px;';

      if (slide.url) {
        div.style.backgroundImage = 'url(' + slide.url + ')';
        div.style.backgroundSize = 'cover';
        div.style.backgroundPosition = 'center';
      } else {
        div.style.background = slide.bg;
        div.innerHTML = '<span style="font-size:4rem;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.1))">' + slide.emoji + '</span>';
      }
      wrapper.appendChild(div);
    });

    // Dot indicators
    var dots = document.createElement('div');
    dots.style.cssText = 'position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:2;';
    slides.forEach(function(_, i) {
      var dot = document.createElement('div');
      dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:' + (i === 0 ? 'var(--gold,#c8963e)' : 'rgba(200,150,62,0.35)') +
        ';cursor:pointer;transition:background 0.4s,transform 0.3s;';
      dot.dataset.idx = i;
      dot.addEventListener('click', function() { goToAboutSlide(parseInt(this.dataset.idx)); });
      dots.appendChild(dot);
    });
    wrapper.appendChild(dots);

    aboutPhotos.appendChild(wrapper);

    // Auto-rotate
    var currentSlide = 0;
    var totalSlides = slides.length;
    var allSlides = wrapper.querySelectorAll('.hhp-about-slide');
    var allDots = dots.children;

    function goToAboutSlide(idx) {
      allSlides[currentSlide].style.opacity = '0';
      allDots[currentSlide].style.background = 'rgba(200,150,62,0.35)';
      allDots[currentSlide].style.transform = 'scale(1)';
      currentSlide = idx % totalSlides;
      allSlides[currentSlide].style.opacity = '1';
      allDots[currentSlide].style.background = 'var(--gold,#c8963e)';
      allDots[currentSlide].style.transform = 'scale(1.25)';
    }

    // Clear any previous slideshow interval, then start a new one
    if (window._hhpAboutSlideshowInterval) clearInterval(window._hhpAboutSlideshowInterval);
    window._hhpAboutSlideshowInterval = setInterval(function() { goToAboutSlide(currentSlide + 1); }, 5000);
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. HERO — HORIZONTAL SLIDE CAROUSEL
  // ═══════════════════════════════════════════════════════════════
  function buildHeroCarousel() {
    var heroCol = document.querySelector('.hero-photo-col');
    if (!heroCol) return;

    // Check for real hero photo
    var realHero = null;
    if (window.HHP_Photos && window.HHP_Photos.photos && window.HHP_Photos.photos.hero) {
      realHero = window.HHP_Photos.photos.hero;
    }

    var slides = PLACEHOLDER_HERO;

    // Save the CTA small card
    var ctaCard = heroCol.querySelector('.hero-photo-sm-cta');
    var savedCta = ctaCard ? ctaCard.cloneNode(true) : null;

    // If we have a real hero photo, just show a single image (no carousel needed)
    if (realHero && realHero.publicId) {
      heroCol.innerHTML = '';
      var imgUrl = window.HHP_Photos.getOptimized(realHero.publicId, 1200);
      var photoDiv = document.createElement('div');
      photoDiv.className = 'hhp-hero-carousel';
      photoDiv.style.cssText = 'width:100%;aspect-ratio:4/3.2;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(30,20,9,0.18);border:1px solid var(--border,#e0d5c5);';
      photoDiv.innerHTML = '<img src="' + imgUrl + '" alt="Housley Happy Paws" style="width:100%;height:100%;object-fit:cover;border-radius:20px;">';
      heroCol.appendChild(photoDiv);
      if (savedCta) {
        var ctaRow = document.createElement('div');
        ctaRow.className = 'hero-photo-row';
        ctaRow.style.cssText = 'display:flex;gap:12px;margin-top:12px;justify-content:center;';
        savedCta.style.cssText += ';flex:0 0 auto;';
        ctaRow.appendChild(savedCta);
        heroCol.appendChild(ctaRow);
      }
      return;
    }

    // No real photo — build placeholder carousel
    heroCol.innerHTML = '';

    var container = document.createElement('div');
    container.className = 'hhp-hero-carousel';
    container.style.cssText = 'position:relative;width:100%;height:380px;min-height:380px;border-radius:18px;overflow:hidden;';

    // Slide track
    var track = document.createElement('div');
    track.className = 'hhp-hero-track';
    track.style.cssText = 'display:flex;width:' + (slides.length * 100) + '%;height:380px;transition:transform 0.8s cubic-bezier(0.25,0.1,0.25,1);';

    slides.forEach(function(slide) {
      var div = document.createElement('div');
      div.style.cssText = 'flex:0 0 ' + (100 / slides.length) + '%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:18px;';
      div.style.background = slide.bg;
      div.innerHTML = '<span style="font-size:5rem;filter:drop-shadow(0 2px 10px rgba(0,0,0,0.08))">' + slide.emoji + '</span>';
      track.appendChild(div);
    });
    container.appendChild(track);

    // Arrow navigation
    var leftArr = document.createElement('button');
    leftArr.innerHTML = '&#8249;';
    leftArr.setAttribute('aria-label', 'Previous slide');
    leftArr.style.cssText = 'position:absolute;left:10px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.85);border:none;width:36px;height:36px;border-radius:50%;font-size:1.4rem;color:var(--dark,#1e1409);cursor:pointer;z-index:4;box-shadow:0 2px 8px rgba(0,0,0,0.12);display:flex;align-items:center;justify-content:center;transition:background 0.2s;line-height:1;';
    container.appendChild(leftArr);

    var rightArr = document.createElement('button');
    rightArr.innerHTML = '&#8250;';
    rightArr.setAttribute('aria-label', 'Next slide');
    rightArr.style.cssText = leftArr.style.cssText.replace('left:10px', 'left:auto;right:10px');
    container.appendChild(rightArr);

    // Progress dots  
    var dotWrap = document.createElement('div');
    dotWrap.style.cssText = 'position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:4;';
    slides.forEach(function(_, i) {
      var d = document.createElement('div');
      d.style.cssText = 'width:24px;height:4px;border-radius:2px;background:' + (i === 0 ? 'white' : 'rgba(255,255,255,0.4)') + ';transition:background 0.4s;cursor:pointer;';
      d.dataset.idx = i;
      d.addEventListener('click', function() { goToHeroSlide(parseInt(this.dataset.idx)); });
      dotWrap.appendChild(d);
    });
    container.appendChild(dotWrap);

    // Re-add CTA card below carousel
    heroCol.appendChild(container);

    if (savedCta) {
      var ctaRow = document.createElement('div');
      ctaRow.className = 'hero-photo-row';
      ctaRow.style.cssText = 'display:flex;gap:12px;margin-top:12px;justify-content:center;';
      savedCta.style.cssText += ';flex:0 0 auto;';
      ctaRow.appendChild(savedCta);
      heroCol.appendChild(ctaRow);
    }

    // Carousel logic
    var currentHero = 0;
    var totalHero = slides.length;
    var allDots = dotWrap.children;

    function goToHeroSlide(idx) {
      allDots[currentHero].style.background = 'rgba(255,255,255,0.4)';
      currentHero = ((idx % totalHero) + totalHero) % totalHero;
      track.style.transform = 'translateX(-' + (currentHero * (100 / totalHero)) + '%)';
      allDots[currentHero].style.background = 'white';
    }

    leftArr.addEventListener('click', function() { goToHeroSlide(currentHero - 1); });
    rightArr.addEventListener('click', function() { goToHeroSlide(currentHero + 1); });

    // Auto-advance
    var heroTimer = setInterval(function() { goToHeroSlide(currentHero + 1); }, 6000);
    container.addEventListener('mouseenter', function() { clearInterval(heroTimer); });
    container.addEventListener('mouseleave', function() {
      heroTimer = setInterval(function() { goToHeroSlide(currentHero + 1); }, 6000);
    });

    // Touch / swipe support
    var touchStartX = 0;
    container.addEventListener('touchstart', function(e) { touchStartX = e.touches[0].clientX; }, { passive: true });
    container.addEventListener('touchend', function(e) {
      var diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) goToHeroSlide(currentHero + (diff > 0 ? 1 : -1));
    }, { passive: true });
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. ROLE-BASED PHOTO GALLERY (Cloudinary + Supabase)
  // ═══════════════════════════════════════════════════════════════

  var CLOUD_NAME = 'dg1p1zjgv';
  var UPLOAD_PRESET = 'hhp_unsigned';

  function getThumb(publicId, w, h) {
    return 'https://res.cloudinary.com/' + CLOUD_NAME + '/image/upload/c_fill,w_' + w + ',h_' + h + ',q_auto,f_auto/' + publicId;
  }

  function getOptImg(publicId, w) {
    return 'https://res.cloudinary.com/' + CLOUD_NAME + '/image/upload/c_fill,w_' + w + ',q_auto,f_auto/' + publicId;
  }

  // ── Load gallery photos based on role ───────────────────────────
  async function loadGalleryPhotos(role) {
    var auth = window.HHP_Auth;
    if (!auth || !auth.supabase || !auth.currentUser) return [];

    var query = auth.supabase
      .from('gallery_photos')
      .select('*')
      .order('created_at', { ascending: false });

    if (role === 'client') {
      query = query.eq('client_id', auth.currentUser.id);
    } else if (role === 'staff') {
      query = query.eq('uploaded_by', auth.currentUser.id);
    }
    // owner gets all — no filter

    try {
      var result = await query;
      if (result.error) {
        console.warn('Gallery query error:', result.error.message);
        return [];
      }
      return result.data || [];
    } catch (e) {
      console.warn('Gallery load error:', e);
      return [];
    }
  }

  // ── Upload a gallery photo ────────────────────────────────────
  function openGalleryUpload(clientId, clientName) {
    if (typeof cloudinary === 'undefined') {
      if (typeof toast === 'function') toast('Photo upload not available — please refresh.');
      return;
    }

    var widget = cloudinary.createUploadWidget({
      cloudName: CLOUD_NAME,
      uploadPreset: UPLOAD_PRESET,
      folder: 'housley-happy-paws/gallery',
      sources: ['local', 'camera'],
      multiple: true,
      maxFileSize: 10000000,
      maxImageWidth: 2400,
      cropping: false,
      resourceType: 'image',
      clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      theme: 'minimal',
      styles: {
        palette: {
          window: '#FDFAF5', windowBorder: '#C8963E', tabIcon: '#3D5A47',
          textDark: '#1E1409', textLight: '#FDFAF5', link: '#C8963E',
          action: '#3D5A47', inProgress: '#C8963E', complete: '#3D5A47', sourceBg: '#FAF6EE'
        }
      }
    }, function(error, result) {
      if (error) { console.error('Gallery upload error:', error); return; }
      if (result.event === 'success') {
        saveGalleryPhoto(result.info, clientId, clientName);
      }
    });
    widget.open();
  }

  async function saveGalleryPhoto(info, clientId, clientName) {
    var auth = window.HHP_Auth;
    if (!auth || !auth.supabase || !auth.currentUser) return;

    var photoRow = {
      public_id: info.public_id,
      url: info.secure_url,
      thumbnail: info.thumbnail_url || getThumb(info.public_id, 300, 225),
      width: info.width,
      height: info.height,
      client_id: clientId || null,
      client_name: clientName || 'Unknown',
      uploaded_by: auth.currentUser.id,
      uploaded_by_name: (auth.currentUser.profile && auth.currentUser.profile.full_name) || auth.currentUser.email.split('@')[0],
      caption: '',
      created_at: new Date().toISOString()
    };

    try {
      var res = await auth.supabase.from('gallery_photos').insert([photoRow]);
      if (res.error) {
        console.error('Save gallery photo error:', res.error);
        if (typeof toast === 'function') toast('Error saving photo.');
      } else {
        if (typeof toast === 'function') toast('📸 Photo added to gallery!');
        // Refresh the gallery display
        var role = auth.currentRole || 'client';
        renderGallery(role);
      }
    } catch (e) {
      console.error('Gallery save error:', e);
    }
  }

  // ── Render gallery for a specific role ─────────────────────────
  async function renderGallery(role) {
    var containerId = role === 'owner' ? 'o-photos' : role === 'staff' ? 'hhp-staff-gallery' : 'cg-photos';
    var container = document.getElementById(containerId);
    // Fallback to old panel ID if new one not found
    if (!container && role === 'client') container = document.getElementById('c-photos');
    if (!container) return;

    var photos = await loadGalleryPhotos(role);

    // Build the gallery header with upload button (for owner/staff)
    var header = container.querySelector('.hhp-gallery-header');
    if (!header) {
      header = document.createElement('div');
      header.className = 'hhp-gallery-header';
      header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:16px 0;gap:12px;flex-wrap:wrap;';
      
      // Insert after the p-header if it exists
      var pHeader = container.querySelector('.p-header');
      if (pHeader) pHeader.after(header);
      else container.prepend(header);
    }

    // Upload button for owner/staff
    if (role === 'owner' || role === 'staff') {
      header.innerHTML = '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="font-size:0.85rem;color:var(--mid,#8c6b4a);">' + photos.length + ' photos</span></div>' +
        '<button onclick="window._hhpGalleryUpload()" style="background:var(--gold,#c8963e);color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.85rem;font-family:inherit;">📸 Upload Photos</button>';
    } else {
      header.innerHTML = '<span style="font-size:0.85rem;color:var(--mid,#8c6b4a);">' + photos.length + ' photos in your gallery</span>';
    }

    // Gallery grid
    var grid = container.querySelector('.hhp-gallery-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'hhp-gallery-grid';
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;padding:8px 0 20px;';
      header.after(grid);
    }

    if (photos.length === 0) {
      // Owner already has upload cards for site photos — don't show empty gallery placeholder
      if (role === 'owner') {
        header.style.display = 'none';
        grid.style.display = 'none';
        return;
      }
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--mid,#8c6b4a);font-size:0.95rem;">' +
        '<div style="font-size:3rem;margin-bottom:12px;">📸</div>' +
        '<div>No photos yet</div>' +
        '<div style="font-size:0.82rem;margin-top:6px;opacity:0.7;">Photos from visits will appear here.</div></div>';
      return;
    }

    grid.innerHTML = '';

    // Immersive hero banner (slow-changing background) — Feature 4
    if (photos.length >= 2) {
      var banner = document.createElement('div');
      banner.className = 'hhp-gallery-immersive';
      banner.style.cssText = 'grid-column:1/-1;height:200px;border-radius:14px;overflow:hidden;position:relative;margin-bottom:8px;';

      var bannerInner = document.createElement('div');
      bannerInner.style.cssText = 'position:absolute;inset:0;background-size:cover;background-position:center;transition:opacity 2s ease-in-out;';
      bannerInner.style.backgroundImage = 'url(' + getOptImg(photos[0].public_id, 1200) + ')';
      banner.appendChild(bannerInner);

      var bannerOverlay = document.createElement('div');
      bannerOverlay.style.cssText = 'position:absolute;inset:0;background:linear-gradient(to top,rgba(30,20,9,0.5),transparent 60%);';
      banner.appendChild(bannerOverlay);

      var bannerLabel = document.createElement('div');
      bannerLabel.style.cssText = 'position:absolute;bottom:14px;left:18px;color:white;font-size:0.85rem;font-weight:600;z-index:2;text-shadow:0 1px 4px rgba(0,0,0,0.5);';
      bannerLabel.textContent = role === 'client' ? 'Your Pet Gallery' : role === 'staff' ? 'Your Client Photos' : 'All Gallery Photos';
      banner.appendChild(bannerLabel);

      grid.appendChild(banner);

      // Slow-change the banner image
      var immIdx = 0;
      setInterval(function() {
        immIdx = (immIdx + 1) % photos.length;
        bannerInner.style.opacity = '0';
        setTimeout(function() {
          bannerInner.style.backgroundImage = 'url(' + getOptImg(photos[immIdx].public_id, 1200) + ')';
          bannerInner.style.opacity = '1';
        }, 1000);
      }, 8000);
    }

    // Photo cards
    photos.forEach(function(photo) {
      var card = document.createElement('div');
      card.style.cssText = 'border-radius:12px;overflow:hidden;aspect-ratio:4/3;background:var(--cream,#fdf7ee);cursor:pointer;position:relative;box-shadow:0 2px 8px rgba(0,0,0,0.06);transition:transform 0.25s,box-shadow 0.25s;';
      card.addEventListener('mouseenter', function() { this.style.transform = 'scale(1.03)'; this.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)'; });
      card.addEventListener('mouseleave', function() { this.style.transform = 'scale(1)'; this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; });

      var img = document.createElement('img');
      img.src = getThumb(photo.public_id, 360, 270);
      img.alt = photo.caption || 'Pet photo';
      img.loading = 'lazy';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      card.appendChild(img);

      // Date label
      var dateLabel = document.createElement('div');
      dateLabel.style.cssText = 'position:absolute;bottom:0;left:0;right:0;padding:6px 10px;background:linear-gradient(transparent,rgba(30,20,9,0.6));color:white;font-size:0.7rem;font-weight:500;';
      var d = new Date(photo.created_at);
      dateLabel.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (photo.client_name && role !== 'client') dateLabel.textContent += ' · ' + photo.client_name;
      card.appendChild(dateLabel);

      // Click to view full size
      card.addEventListener('click', function() {
        openLightbox(photo, photos);
      });

      grid.appendChild(card);
    });

    // Hide the original "No photos" card if it exists
    var emptyCard = container.querySelector('.card');
    if (emptyCard && photos.length > 0) {
      var emptyText = emptyCard.textContent || '';
      if (emptyText.indexOf('No photos') !== -1) emptyCard.style.display = 'none';
    }
  }

  // ── Lightbox ──────────────────────────────────────────────────
  function openLightbox(photo, allPhotos) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });

    var img = document.createElement('img');
    img.src = getOptImg(photo.public_id, 1600);
    img.style.cssText = 'max-width:90vw;max-height:85vh;object-fit:contain;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.4);';
    overlay.appendChild(img);

    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'position:absolute;top:20px;right:24px;background:none;border:none;color:white;font-size:2.5rem;cursor:pointer;';
    closeBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
    overlay.appendChild(closeBtn);

    // Caption / date
    var caption = document.createElement('div');
    caption.style.cssText = 'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);color:white;font-size:0.85rem;text-align:center;opacity:0.8;';
    var d = new Date(photo.created_at);
    caption.textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (photo.client_name) caption.textContent += ' — ' + photo.client_name;
    overlay.appendChild(caption);

    // Keyboard close
    var keyHandler = function(e) { if (e.key === 'Escape') { document.body.removeChild(overlay); document.removeEventListener('keydown', keyHandler); } };
    document.addEventListener('keydown', keyHandler);

    document.body.appendChild(overlay);
  }

  // ── Upload handler (exposed globally for onclick) ──────────────
  window._hhpGalleryUpload = function() {
    var auth = window.HHP_Auth;
    if (!auth || !auth.currentUser) return;

    var role = auth.currentRole || 'client';

    if (role === 'owner') {
      // Owner can pick a client to associate photos with
      showClientPicker(function(clientId, clientName) {
        openGalleryUpload(clientId, clientName);
      });
    } else {
      // Staff uploads — associate with self for now, can tag client later
      openGalleryUpload(null, 'Untagged');
    }
  };

  function showClientPicker(callback) {
    var auth = window.HHP_Auth;
    if (!auth || !auth.supabase) { callback(null, 'General'); return; }

    // Quick modal to pick client
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';

    var modal = document.createElement('div');
    modal.style.cssText = 'background:var(--cream,#fdf7ee);border-radius:16px;padding:28px;max-width:380px;width:90%;box-shadow:0 12px 40px rgba(0,0,0,0.2);';
    modal.innerHTML = '<h3 style="margin:0 0 16px;font-size:1.1rem;color:var(--dark,#1e1409);">Upload Photos For...</h3>' +
      '<button class="hhp-cp-btn" data-id="" data-name="General / Business" style="width:100%;padding:12px;margin-bottom:8px;border:1px solid var(--border,#e0d5c5);border-radius:10px;background:white;cursor:pointer;text-align:left;font-size:0.9rem;font-family:inherit;">📁 General / Business Photos</button>' +
      '<div id="hhpClientList" style="max-height:200px;overflow-y:auto;"><div style="text-align:center;padding:16px;color:var(--mid);font-size:0.82rem;">Loading clients...</div></div>' +
      '<button style="margin-top:12px;width:100%;padding:10px;border:none;background:var(--mid,#8c6b4a);color:white;border-radius:8px;cursor:pointer;font-family:inherit;" onclick="this.closest(\'div[style]\').remove()">Cancel</button>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Wire general button
    modal.querySelector('.hhp-cp-btn').addEventListener('click', function() {
      document.body.removeChild(overlay);
      callback(null, 'General');
    });

    // Load clients from profiles
    auth.supabase.from('profiles').select('id, full_name, email').eq('role', 'client').then(function(res) {
      var list = document.getElementById('hhpClientList');
      if (!list) return;
      if (res.error || !res.data || res.data.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:12px;color:var(--mid);font-size:0.82rem;">No clients found</div>';
        return;
      }
      list.innerHTML = '';
      res.data.forEach(function(client) {
        var btn = document.createElement('button');
        btn.style.cssText = 'width:100%;padding:12px;margin-bottom:6px;border:1px solid var(--border,#e0d5c5);border-radius:10px;background:white;cursor:pointer;text-align:left;font-size:0.9rem;font-family:inherit;';
        btn.textContent = '🐾 ' + (client.full_name || client.email.split('@')[0]);
        btn.addEventListener('click', function() {
          document.body.removeChild(overlay);
          callback(client.id, client.full_name || client.email.split('@')[0]);
        });
        list.appendChild(btn);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. STAFF GALLERY SECTION
  // ═══════════════════════════════════════════════════════════════
  function addStaffGallery() {
    var staffPortal = document.getElementById('pg-staff');
    if (!staffPortal) return;

    // Check if gallery already exists
    if (document.getElementById('hhp-staff-gallery')) return;

    var portalWrap = staffPortal.querySelector('.portal-wrap');
    if (!portalWrap) return;

    // Find the sidebar to add a menu link
    var sidebar = portalWrap.querySelector('.p-sidebar');
    if (sidebar) {
      var menuSection = sidebar.querySelector('.menu-section');
      if (menuSection) {
        // Add "Photo Gallery" link to staff menu
        var existing = menuSection.querySelector('[data-page="hhp-staff-gallery"]');
        if (!existing) {
          var galleryLink = document.createElement('a');
          galleryLink.className = 'menu-item';
          galleryLink.dataset.page = 'hhp-staff-gallery';
          galleryLink.innerHTML = '📸 Photo Gallery';
          galleryLink.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;color:var(--dark,#1e1409);text-decoration:none;font-size:0.9rem;transition:background 0.2s;';
          galleryLink.addEventListener('click', function() {
            // Show gallery section, hide others
            var pages = portalWrap.querySelectorAll('[id^="s-"]');
            pages.forEach(function(p) { p.style.display = 'none'; });
            document.getElementById('hhp-staff-gallery').style.display = 'block';
            // Highlight menu
            menuSection.querySelectorAll('.menu-item').forEach(function(m) { m.classList.remove('active'); });
            galleryLink.classList.add('active');
            renderGallery('staff');
          });
          galleryLink.addEventListener('mouseenter', function() { this.style.background = 'rgba(200,150,62,0.1)'; });
          galleryLink.addEventListener('mouseleave', function() { this.style.background = 'none'; });
          menuSection.appendChild(galleryLink);
        }
      }
    }

    // Create the gallery page section
    var gallerySection = document.createElement('div');
    gallerySection.id = 'hhp-staff-gallery';
    gallerySection.style.display = 'none';
    gallerySection.innerHTML = '<div class="p-header"><h2>Photo Gallery 📸</h2><p>Photos you\'ve captured during visits.</p></div>';

    // Add it after the last s- section
    var mainContent = portalWrap.querySelector('.p-main');
    if (mainContent) {
      mainContent.appendChild(gallerySection);
    } else {
      portalWrap.appendChild(gallerySection);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════
  onReady(function() {
    // Slideshows (public pages)
    buildAboutSlideshow();
    buildHeroCarousel();

    // Gallery (portal pages) — render on auth state
    addStaffGallery();

    var auth = window.HHP_Auth;
    if (auth && auth.currentUser) {
      var role = auth.currentRole || 'client';
      renderGallery(role);
    }

    // Re-render gallery when view changes  
    var dropdown = document.getElementById('viewDropdown');
    if (dropdown) {
      dropdown.addEventListener('change', function() {
        var val = this.value;
        setTimeout(function() {
          if (val === 'client') renderGallery('client');
          else if (val === 'staff') renderGallery('staff');
          else if (val === 'owner') renderGallery('owner');
        }, 300);
      });
    }

    console.log('🖼️ HHP Gallery & Slideshows initialized');
  });

  // Public API
  window.HHP_Gallery = {
    render: renderGallery,
    upload: openGalleryUpload,
    rebuildSlideshows: function() { buildAboutSlideshow(); buildHeroCarousel(); }
  };

})();
