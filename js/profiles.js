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

  // Fetch profile + pets + bookings + payments
  const [profileRes, petsRes, bookingsRes, paymentsRes] = await Promise.all([
    sb.from('profiles').select('*').eq('id', profileId).single(),
    sb.from('pets').select('*').eq('owner_id', profileId),
    sb.from('bookings').select('*').eq('client_id', profileId).order('date', { ascending: false }).limit(20),
    sb.from('payments').select('*').eq('client_id', profileId).order('created_at', { ascending: false }).limit(20)
  ]);

  const p = profileRes.data;
  if (!p) { toast('Profile not found'); return; }
  const pets = petsRes.data || [];
  const bookings = bookingsRes.data || [];
  const payments = paymentsRes.data || [];

  const modal = document.createElement('div');
  modal.id = 'profile-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;padding:32px;position:relative;">
      <button onclick="document.getElementById('profile-modal').remove()" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:1.5rem;cursor:pointer;">&times;</button>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
        ${p.avatar_url
          ? '<img src="' + p.avatar_url + '" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:3px solid var(--gold-light);flex-shrink:0">'
          : '<div style="width:60px;height:60px;border-radius:50%;background:var(--gold-light);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">\u{1F43E}</div>'}
        <div>
          <h2 style="margin:0;font-family:'Cormorant Garamond',serif;color:var(--forest);">${p.full_name || 'Client'}</h2>
          <span style="color:var(--gold);font-weight:600;">Customer #${p.customer_number || 'N/A'}</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
        <div style="padding:12px;background:var(--cream);border-radius:8px;"><strong>Phone:</strong> ${p.phone || '—'}</div>
        <div style="padding:12px;background:var(--cream);border-radius:8px;"><strong>Email:</strong> ${p.email || '—'}</div>
        <div style="padding:12px;background:var(--cream);border-radius:8px;"><strong>Address:</strong> ${p.address || '—'}</div>
        <div style="padding:12px;background:var(--cream);border-radius:8px;"><strong>Emergency:</strong> ${p.emergency_contact || '—'} ${p.emergency_phone || ''}</div>
      </div>

      <h3 style="color:var(--forest);border-bottom:2px solid var(--gold-light);padding-bottom:8px;">\u{1F436} Pets</h3>
      <div style="margin-bottom:24px;">
        ${pets.length ? pets.map(pet => `
          <div style="padding:10px;background:var(--gold-pale);border-radius:8px;margin-bottom:8px;">
            <strong>${pet.name}</strong> — ${pet.species || ''} ${pet.breed || ''} | ${pet.notes || ''}
          </div>
        `).join('') : '<p style="color:#888;">No pets registered yet.</p>'}
      </div>

      <h3 style="color:var(--forest);border-bottom:2px solid var(--gold-light);padding-bottom:8px;">\u{1F4C5} Booking History</h3>
      <div style="margin-bottom:24px;max-height:200px;overflow-y:auto;">
        ${bookings.length ? bookings.map(b => `
          <div style="padding:8px 12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">
            <span>${b.date || ''} — ${b.service_type || b.type || 'Walk'}</span>
            <span style="color:var(--forest);font-weight:600;">${b.status || 'completed'}</span>
          </div>
        `).join('') : '<p style="color:#888;">No bookings yet.</p>'}
      </div>

      <h3 style="color:var(--forest);border-bottom:2px solid var(--gold-light);padding-bottom:8px;">\u{1F4B3} Payment History</h3>
      <div style="margin-bottom:24px;max-height:200px;overflow-y:auto;">
        ${payments.length ? payments.map(pay => `
          <div style="padding:8px 12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">
            <span>${new Date(pay.created_at).toLocaleDateString()} — ${pay.description || 'Payment'}</span>
            <span style="color:var(--forest);font-weight:600;">$${(pay.amount/100).toFixed(2)}</span>
          </div>
        `).join('') : '<p style="color:#888;">No payments recorded.</p>'}
      </div>

      <h3 style="color:var(--forest);border-bottom:2px solid var(--gold-light);padding-bottom:8px;">\u{1F4DD} Notes</h3>
      <div style="padding:12px;background:var(--cream);border-radius:8px;min-height:60px;">
        <textarea id="client-notes-${p.id}" style="width:100%;border:none;background:transparent;resize:vertical;min-height:60px;font-family:inherit;">${p.notes || ''}</textarea>
        <button onclick="saveClientNotes('${p.id}')" style="margin-top:8px;padding:6px 16px;background:var(--gold);color:white;border:none;border-radius:6px;cursor:pointer;">Save Notes</button>
      </div>
    </div>
  `;
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
            <span>${s.start_time?.slice(0,5)} - ${s.end_time?.slice(0,5)} ${s.is_available ? '' : '(Off)'}</span>
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
