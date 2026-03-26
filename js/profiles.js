// ============================================================
// Profiles Module - Client & Staff Profile Pages
// Adds profile viewing to owner portal
// ============================================================

// Helper to get Supabase client
function getSB() {
  if (typeof HHP_Auth !== 'undefined' && HHP_Auth.supabase) return HHP_Auth.supabase;
  return null;
}

// ---- CLIENT PROFILE ----
async function showClientProfile(profileId) {
  const sb = getSB();
  if (!sb) { toast('Database not connected'); return; }

  // Remove any existing modal
  var existing = document.getElementById('profile-modal');
  if (existing) existing.remove();

  // First fetch the profile to get user_id (needed for pets/bookings/payments lookups)
  const profileRes = await sb.from('profiles').select('*').eq('id', profileId).single();
  const p = profileRes.data;
  if (!p) { toast('Profile not found'); return; }

  // pets.owner_id and bookings.client_id store user_id (auth UUID), NOT profiles.id
  var uid = p.user_id || profileId;

  // Now fetch pets, bookings, payments using the correct user_id
  const [petsRes, bookingsRes, paymentsRes] = await Promise.all([
    sb.from('pets').select('*').eq('owner_id', uid),
    sb.from('bookings').select('*').eq('client_id', uid).order('date', { ascending: false }).limit(20),
    sb.from('payments').select('*').eq('client_id', uid).order('created_at', { ascending: false }).limit(20)
  ]);

  const pets = petsRes.data || [];
  const bookings = bookingsRes.data || [];
  const payments = paymentsRes.data || [];

  // Check role for notes access
  var currentRole = (window.HHP_Auth && window.HHP_Auth.currentRole) || 'client';
  var canEditNotes = (currentRole === 'owner' || currentRole === 'staff');

  // Build pet cards — each clickable to expand with ALL pet info
  var petsHtml = '';
  if (pets.length) {
    petsHtml = pets.map(function(pet, idx) {
      var icon = (pet.species || '').toLowerCase() === 'cat' ? '\uD83D\uDC31' : '\uD83D\uDC36';
      var photoHtml = pet.photo_url
        ? '<img src="' + pet.photo_url + '" style="width:50px;height:50px;border-radius:10px;object-fit:cover;flex-shrink:0">'
        : '<div style="width:50px;height:50px;border-radius:10px;background:var(--gold-pale);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">' + icon + '</div>';

      // Build boolean status badges
      var badges = '';
      if (pet.spayed_neutered) badges += '<span style="display:inline-block;padding:2px 8px;background:#dcfce7;color:#166534;border-radius:6px;font-size:0.72rem;font-weight:600;margin:2px">Spayed/Neutered</span>';
      if (pet.microchipped) badges += '<span style="display:inline-block;padding:2px 8px;background:#dbeafe;color:#1e40af;border-radius:6px;font-size:0.72rem;font-weight:600;margin:2px">Microchipped</span>';
      if (pet.house_trained) badges += '<span style="display:inline-block;padding:2px 8px;background:#dcfce7;color:#166534;border-radius:6px;font-size:0.72rem;font-weight:600;margin:2px">House Trained</span>';
      if (pet.vaccinations_current) badges += '<span style="display:inline-block;padding:2px 8px;background:#dcfce7;color:#166534;border-radius:6px;font-size:0.72rem;font-weight:600;margin:2px">Vaccinations Current</span>';
      if (pet.flea_tick_prevention) badges += '<span style="display:inline-block;padding:2px 8px;background:#dcfce7;color:#166534;border-radius:6px;font-size:0.72rem;font-weight:600;margin:2px">Flea/Tick Prevention</span>';

      // Sociability badges
      var social = '';
      if (pet.friendly_dogs) social += '<span style="display:inline-block;padding:2px 8px;background:#dcfce7;color:#166534;border-radius:6px;font-size:0.72rem;font-weight:600;margin:2px">\uD83D\uDC36 Dog Friendly</span>';
      else if (pet.friendly_dogs === false) social += '<span style="display:inline-block;padding:2px 8px;background:#fef2f2;color:#991b1b;border-radius:6px;font-size:0.72rem;font-weight:600;margin:2px">\uD83D\uDC36 Not Dog Friendly</span>';
      if (pet.friendly_cats) social += '<span style="display:inline-block;padding:2px 8px;background:#dcfce7;color:#166534;border-radius:6px;font-size:0.72rem;font-weight:600;margin:2px">\uD83D\uDC31 Cat Friendly</span>';
      else if (pet.friendly_cats === false) social += '<span style="display:inline-block;padding:2px 8px;background:#fef2f2;color:#991b1b;border-radius:6px;font-size:0.72rem;font-weight:600;margin:2px">\uD83D\uDC31 Not Cat Friendly</span>';
      if (pet.friendly_children) social += '<span style="display:inline-block;padding:2px 8px;background:#dcfce7;color:#166534;border-radius:6px;font-size:0.72rem;font-weight:600;margin:2px">\uD83D\uDC76 Child Friendly</span>';
      else if (pet.friendly_children === false) social += '<span style="display:inline-block;padding:2px 8px;background:#fef2f2;color:#991b1b;border-radius:6px;font-size:0.72rem;font-weight:600;margin:2px">\uD83D\uDC76 Not Child Friendly</span>';

      return '<div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:10px;background:white">' +
        '<div onclick="var d=this.nextElementSibling;d.style.display=d.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'.pet-arrow\').textContent=d.style.display===\'none\'?\'\u25B6\':\'\u25BC\'" style="display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;transition:background 0.2s" onmouseover="this.style.background=\'var(--warm)\'" onmouseout="this.style.background=\'transparent\'">' +
          photoHtml +
          '<div style="flex:1">' +
            '<div style="font-weight:700;font-size:0.95rem">' + (pet.name || 'Pet') + '</div>' +
            '<div style="font-size:0.8rem;color:var(--mid)">' + (pet.species || '') + (pet.breed ? ' \u00B7 ' + pet.breed : '') + (pet.sex ? ' \u00B7 ' + pet.sex : '') + '</div>' +
          '</div>' +
          '<span class="pet-arrow" style="font-size:0.8rem;color:var(--mid)">\u25B6</span>' +
        '</div>' +
        '<div style="display:none;padding:14px;border-top:1px solid var(--border);background:var(--cream)">' +

          // --- Pet Details section ---
          '<div style="font-weight:700;font-size:0.82rem;color:var(--forest);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em">\uD83D\uDC3E Pet Details</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">' +
            '<div style="padding:8px 10px;background:white;border-radius:6px;font-size:0.84rem"><strong>Name:</strong> ' + (pet.name || '\u2014') + '</div>' +
            '<div style="padding:8px 10px;background:white;border-radius:6px;font-size:0.84rem"><strong>Species:</strong> ' + (pet.species || '\u2014') + '</div>' +
            '<div style="padding:8px 10px;background:white;border-radius:6px;font-size:0.84rem"><strong>Breed:</strong> ' + (pet.breed || '\u2014') + '</div>' +
            '<div style="padding:8px 10px;background:white;border-radius:6px;font-size:0.84rem"><strong>Sex:</strong> ' + (pet.sex || '\u2014') + '</div>' +
            '<div style="padding:8px 10px;background:white;border-radius:6px;font-size:0.84rem"><strong>Birthday:</strong> ' + (pet.birthday || '\u2014') + '</div>' +
            '<div style="padding:8px 10px;background:white;border-radius:6px;font-size:0.84rem"><strong>Weight:</strong> ' + (pet.weight ? pet.weight + ' lbs' : '\u2014') + '</div>' +
            '<div style="padding:8px 10px;background:white;border-radius:6px;font-size:0.84rem"><strong>Size:</strong> ' + (pet.size || '\u2014') + '</div>' +
            '<div style="padding:8px 10px;background:white;border-radius:6px;font-size:0.84rem"><strong>Energy Level:</strong> ' + (pet.energy_level || '\u2014') + '</div>' +
          '</div>' +

          // --- Health & Safety section ---
          '<div style="font-weight:700;font-size:0.82rem;color:var(--forest);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em">\u2695\uFE0F Health & Safety</div>' +
          (badges ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">' + badges + '</div>' : '<div style="font-size:0.82rem;color:var(--mid);margin-bottom:10px">No health status recorded</div>') +

          // --- Sociability section ---
          '<div style="font-weight:700;font-size:0.82rem;color:var(--forest);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em">\uD83E\uDD1D Sociability</div>' +
          (social ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">' + social + '</div>' : '<div style="font-size:0.82rem;color:var(--mid);margin-bottom:10px">No sociability info recorded</div>') +

          // --- Veterinary & Care section ---
          '<div style="font-weight:700;font-size:0.82rem;color:var(--forest);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em">\uD83C\uDFE5 Veterinary & Care</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">' +
            '<div style="padding:8px 10px;background:white;border-radius:6px;font-size:0.84rem"><strong>Vet Name:</strong> ' + (pet.vet_name || '\u2014') + '</div>' +
            '<div style="padding:8px 10px;background:white;border-radius:6px;font-size:0.84rem"><strong>Vet Phone:</strong> ' + (pet.vet_phone || '\u2014') + '</div>' +
          '</div>' +

          // --- Alerts (medications, allergies, special needs) ---
          (pet.medications ? '<div style="padding:10px 12px;background:#fff3cd;border-radius:8px;font-size:0.84rem;margin-bottom:8px;border-left:3px solid #f59e0b">\u26A0\uFE0F <strong>Medications:</strong> ' + pet.medications + '</div>' : '') +
          (pet.allergies ? '<div style="padding:10px 12px;background:#fef2f2;border-radius:8px;font-size:0.84rem;margin-bottom:8px;border-left:3px solid #ef4444">\u26A0\uFE0F <strong>Allergies:</strong> ' + pet.allergies + '</div>' : '') +
          (pet.special_needs ? '<div style="padding:10px 12px;background:#fef3c7;border-radius:8px;font-size:0.84rem;margin-bottom:8px;border-left:3px solid #d97706">\u2B50 <strong>Special Needs:</strong> ' + pet.special_needs + '</div>' : '') +

          // --- Care Instructions ---
          (pet.feeding_instructions ? '<div style="padding:10px 12px;background:white;border-radius:8px;font-size:0.84rem;margin-bottom:8px;border-left:3px solid var(--forest)"><strong>\uD83C\uDF7D\uFE0F Feeding Instructions:</strong><br>' + pet.feeding_instructions + '</div>' : '') +
          (pet.behavioral_notes ? '<div style="padding:10px 12px;background:white;border-radius:8px;font-size:0.84rem;margin-bottom:8px;border-left:3px solid var(--gold)"><strong>\uD83D\uDCCB Behavioral Notes:</strong><br>' + pet.behavioral_notes + '</div>' : '') +
          (pet.notes ? '<div style="padding:10px 12px;background:white;border-radius:8px;font-size:0.84rem;margin-bottom:8px;border-left:3px solid var(--mid)"><strong>\uD83D\uDCDD Additional Notes:</strong><br>' + pet.notes + '</div>' : '') +

        '</div>' +
      '</div>';
    }).join('');
  } else {
    petsHtml = '<p style="color:#888;font-size:0.88rem">No pets registered yet.</p>';
  }

  // Notes section
  var notesHtml = canEditNotes
    ? '<div style="padding:12px;background:var(--cream);border-radius:8px;min-height:60px;">' +
        '<textarea id="client-notes-' + p.id + '" style="width:100%;border:none;background:transparent;resize:vertical;min-height:60px;font-family:inherit;">' + (p.notes || '') + '</textarea>' +
        '<button onclick="saveClientNotes(\'' + p.id + '\')" style="margin-top:8px;padding:6px 16px;background:var(--gold);color:white;border:none;border-radius:6px;cursor:pointer;">Save Notes</button>' +
      '</div>'
    : (p.notes ? '<div style="padding:12px;background:var(--cream);border-radius:8px;font-size:0.88rem">' + p.notes + '</div>' : '<p style="color:#888;font-size:0.88rem">No notes.</p>');

  // Member since
  var memberSince = p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '\u2014';

  const modal = document.createElement('div');
  modal.id = 'profile-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
  modal.innerHTML =
    '<div style="background:white;border-radius:16px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;padding:32px;position:relative;">' +
      '<button onclick="document.getElementById(\'profile-modal\').remove()" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:1.5rem;cursor:pointer;z-index:1">&times;</button>' +

      // --- Header ---
      '<div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">' +
        (p.avatar_url
          ? '<img src="' + p.avatar_url + '" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:3px solid var(--gold-light);flex-shrink:0">'
          : '<div style="width:60px;height:60px;border-radius:50%;background:var(--gold-light);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">\uD83D\uDC3E</div>') +
        '<div>' +
          '<h2 style="margin:0;font-family:\'Cormorant Garamond\',serif;color:var(--forest);">' + (p.full_name || 'Client') + '</h2>' +
          '<span style="color:var(--gold);font-weight:600;">Customer #' + (p.customer_number || 'N/A') + '</span>' +
          '<div style="font-size:0.78rem;color:var(--mid);margin-top:2px">Member since ' + memberSince + '</div>' +
        '</div>' +
      '</div>' +

      // --- Contact & Account Information ---
      '<h3 style="color:var(--forest);border-bottom:2px solid var(--gold-light);padding-bottom:8px;margin-bottom:12px">\uD83D\uDCCB Client Information</h3>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;">' +
        '<div style="padding:12px;background:var(--cream);border-radius:8px;font-size:0.88rem"><strong>Full Name:</strong> ' + (p.full_name || '\u2014') + '</div>' +
        '<div style="padding:12px;background:var(--cream);border-radius:8px;font-size:0.88rem"><strong>Email:</strong> ' + (p.email || '\u2014') + '</div>' +
        '<div style="padding:12px;background:var(--cream);border-radius:8px;font-size:0.88rem"><strong>Phone:</strong> ' + (p.phone || '\u2014') + '</div>' +
        '<div style="padding:12px;background:var(--cream);border-radius:8px;font-size:0.88rem"><strong>Customer #:</strong> ' + (p.customer_number || '\u2014') + '</div>' +
        '<div style="padding:12px;background:var(--cream);border-radius:8px;font-size:0.88rem;grid-column:1/-1"><strong>Address:</strong> ' + (p.address || '\u2014') + '</div>' +
        '<div style="padding:12px;background:var(--cream);border-radius:8px;font-size:0.88rem"><strong>Emergency Contact:</strong> ' + (p.emergency_contact || '\u2014') + '</div>' +
        '<div style="padding:12px;background:var(--cream);border-radius:8px;font-size:0.88rem"><strong>Emergency Phone:</strong> ' + (p.emergency_phone || '\u2014') + '</div>' +
        '<div style="padding:12px;background:var(--cream);border-radius:8px;font-size:0.88rem"><strong>Stripe Payment:</strong> ' + (p.stripe_customer_id ? '\u2705 Card on file' : '\u274C No card on file') + '</div>' +
        '<div style="padding:12px;background:var(--cream);border-radius:8px;font-size:0.88rem"><strong>Account Role:</strong> ' + (p.role || 'client') + '</div>' +
      '</div>' +

      // --- Pets ---
      '<h3 style="color:var(--forest);border-bottom:2px solid var(--gold-light);padding-bottom:8px;margin-bottom:12px">\uD83D\uDC36 Pets (' + pets.length + ')</h3>' +
      '<div style="margin-bottom:24px">' + petsHtml + '</div>' +

      // --- Booking History ---
      '<h3 style="color:var(--forest);border-bottom:2px solid var(--gold-light);padding-bottom:8px;margin-bottom:12px">\uD83D\uDCC5 Booking History (' + bookings.length + ')</h3>' +
      '<div style="margin-bottom:24px;max-height:250px;overflow-y:auto;">' +
        (bookings.length ? bookings.map(function(b) {
          var bkStatusColor = b.status === 'confirmed' ? '#166534' : b.status === 'cancelled' ? '#991b1b' : b.status === 'completed' ? '#166534' : '#92400e';
          var bkDate = b.date ? new Date(b.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
          return '<div style="padding:10px 12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center">' +
            '<div><div style="font-size:0.88rem;font-weight:600">' + (b.service || b.service_type || 'Appointment') + '</div>' +
            '<div style="font-size:0.76rem;color:var(--mid)">' + bkDate + (b.time_slot ? ' \u00B7 ' + b.time_slot : '') + (b.pet_names ? ' \u00B7 ' + b.pet_names : '') + '</div></div>' +
            '<span style="color:' + bkStatusColor + ';font-weight:600;font-size:0.78rem;text-transform:uppercase;background:' + bkStatusColor + '15;padding:2px 8px;border-radius:6px">' + (b.status || 'pending') + '</span>' +
          '</div>';
        }).join('') : '<p style="color:#888;font-size:0.88rem">No bookings yet.</p>') +
      '</div>' +

      // --- Payment History ---
      '<h3 style="color:var(--forest);border-bottom:2px solid var(--gold-light);padding-bottom:8px;margin-bottom:12px">\uD83D\uDCB3 Payment History (' + payments.length + ')</h3>' +
      '<div style="margin-bottom:24px;max-height:200px;overflow-y:auto;">' +
        (payments.length ? payments.map(function(pay) {
          return '<div style="padding:8px 12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">' +
            '<span style="font-size:0.88rem">' + new Date(pay.created_at).toLocaleDateString() + ' \u2014 ' + (pay.description || pay.service || 'Payment') + '</span>' +
            '<span style="color:var(--forest);font-weight:600;font-size:0.84rem">$' + ((pay.amount || 0)).toFixed(2) + '</span>' +
          '</div>';
        }).join('') : '<p style="color:#888;font-size:0.88rem">No payments recorded.</p>') +
      '</div>' +

      // --- Notes ---
      '<h3 style="color:var(--forest);border-bottom:2px solid var(--gold-light);padding-bottom:8px;margin-bottom:12px">\uD83D\uDCDD Internal Notes</h3>' +
      notesHtml +
    '</div>';
  document.body.appendChild(modal);
}

async function saveClientNotes(profileId) {
  const sb = getSB();
  if (!sb) return;
  const notes = document.getElementById('client-notes-' + profileId)?.value || '';
  const { error } = await sb.from('profiles').update({ notes }).eq('id', profileId);
  if (error) { toast('Failed to save notes'); return; }
  toast('\u2705 Notes saved!');
}

// ---- STAFF PROFILE ----
async function showStaffProfile(profileId) {
  const sb = getSB();
  if (!sb) { toast('Database not connected'); return; }

  const [profileRes, assignRes, schedRes] = await Promise.all([
    sb.from('profiles').select('*').eq('id', profileId).single(),
    sb.from('staff_assignments').select('client_id, profiles!staff_assignments_client_id_fkey(full_name, customer_number)').eq('staff_id', profileId),
    sb.from('staff_schedule').select('*').eq('staff_id', profileId).order('day_of_week')
  ]);

  const s = profileRes.data;
  if (!s) { toast('Staff profile not found'); return; }
  const assignments = assignRes.data || [];
  const schedule = schedRes.data || [];
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const modal = document.createElement('div');
  modal.id = 'profile-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;padding:32px;position:relative;">
      <button onclick="document.getElementById('profile-modal').remove()" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:1.5rem;cursor:pointer;">&times;</button>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
        ${s.avatar_url
          ? '<img src="' + s.avatar_url + '" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:3px solid var(--forest-light);flex-shrink:0">'
          : '<div style="width:60px;height:60px;border-radius:50%;background:var(--forest-light);display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:white;">\u{1F464}</div>'}
        <div>
          <h2 style="margin:0;font-family:'Cormorant Garamond',serif;color:var(--forest);">${s.full_name || 'Staff Member'}</h2>
          <span style="color:var(--forest);font-weight:600;">Staff · ${s.is_active ? 'Active' : 'Inactive'}</span>
          ${s.hire_date ? `<br><small>Hired: ${new Date(s.hire_date).toLocaleDateString()}</small>` : ''}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
        <div style="padding:12px;background:var(--cream);border-radius:8px;"><strong>Phone:</strong> ${s.phone || '—'}</div>
        <div style="padding:12px;background:var(--cream);border-radius:8px;"><strong>Email:</strong> ${s.email || '—'}</div>
        <div style="padding:12px;background:var(--cream);border-radius:8px;"><strong>Hourly Rate:</strong> ${s.hourly_rate ? '$' + s.hourly_rate : '—'}</div>
        <div style="padding:12px;background:var(--cream);border-radius:8px;"><strong>Address:</strong> ${s.address || '—'}</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
        <div style="text-align:center;padding:16px;background:var(--gold-pale);border-radius:12px;">
          <div style="font-size:1.8rem;font-weight:700;color:var(--forest);">${s.avg_rating || '0.0'}</div>
          <div style="font-size:0.8rem;color:#666;">Avg Rating</div>
        </div>
        <div style="text-align:center;padding:16px;background:var(--forest-pale);border-radius:12px;">
          <div style="font-size:1.8rem;font-weight:700;color:var(--forest);">${s.total_walks || 0}</div>
          <div style="font-size:0.8rem;color:#666;">Walks Done</div>
        </div>
        <div style="text-align:center;padding:16px;background:var(--gold-pale);border-radius:12px;">
          <div style="font-size:1.8rem;font-weight:700;color:var(--forest);">$${(s.total_earnings || 0).toFixed(0)}</div>
          <div style="font-size:0.8rem;color:#666;">Earnings</div>
        </div>
      </div>

      <h3 style="color:var(--forest);border-bottom:2px solid var(--gold-light);padding-bottom:8px;">\u{1F4C6} Schedule</h3>
      <div style="margin-bottom:24px;">
        ${schedule.length ? schedule.map(s => `
          <div style="padding:8px 12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">
            <strong>${days[s.day_of_week]}</strong>
            <span>${s.is_available ? 'Available (Anytime)' : 'Off'}</span>
          </div>
        `).join('') : '<p style="color:#888;">No schedule set.</p>'}
      </div>

      <h3 style="color:var(--forest);border-bottom:2px solid var(--gold-light);padding-bottom:8px;">\u{1F465} Assigned Clients</h3>
      <div style="margin-bottom:24px;">
        ${assignments.length ? assignments.map(a => `
          <div style="padding:8px 12px;border-bottom:1px solid #eee;cursor:pointer;" onclick="document.getElementById('profile-modal').remove();showClientProfile('${a.client_id}')">
            ${a.profiles?.full_name || 'Client'} <span style="color:var(--gold);">#${a.profiles?.customer_number || '—'}</span>
          </div>
        `).join('') : '<p style="color:#888;">No assigned clients.</p>'}
      </div>

      <h3 style="color:var(--forest);border-bottom:2px solid var(--gold-light);padding-bottom:8px;">\u{1F4DD} Notes</h3>
      <div style="padding:12px;background:var(--cream);border-radius:8px;">
        <textarea id="staff-notes-${s.id}" style="width:100%;border:none;background:transparent;resize:vertical;min-height:60px;font-family:inherit;">${s.notes || ''}</textarea>
        <button onclick="saveStaffNotes('${s.id}')" style="margin-top:8px;padding:6px 16px;background:var(--forest);color:white;border:none;border-radius:6px;cursor:pointer;">Save Notes</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function saveStaffNotes(profileId) {
  const sb = getSB();
  if (!sb) return;
  const notes = document.getElementById('staff-notes-' + profileId)?.value || '';
  const { error } = await sb.from('profiles').update({ notes }).eq('id', profileId);
  if (error) { toast('Failed to save notes'); return; }
  toast('\u2705 Notes saved!');
}

console.log('[profiles.js] Client & staff profile pages loaded');
