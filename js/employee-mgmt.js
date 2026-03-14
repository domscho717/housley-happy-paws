// ============================================================
// Employee Management Module - Owner Portal
// Staff listing, onboarding, toggle display, client roster
// ============================================================

// Inject the Employee Management tab into the owner portal
function injectEmployeeTab() {
  // Add tab button if not exists
  const tabBar = document.querySelector('#owner-portal .tab-bar, #o-tabs');
  if (!tabBar || document.getElementById('emp-tab-btn')) return;

  // Find the tab container - it may vary by version
  const tabContainer = document.querySelector('.owner-tabs') || tabBar;
  if (!tabContainer) return;

  const btn = document.createElement('button');
  btn.id = 'emp-tab-btn';
  btn.className = 'tab-btn';
  btn.textContent = 'Team';
  btn.onclick = () => sTab('o', 'o-team');
  tabContainer.appendChild(btn);

  // Create the panel
  const panel = document.createElement('div');
  panel.id = 'o-team';
  panel.className = 'tab-panel';
  panel.style.display = 'none';
  panel.innerHTML = `
    <div style="padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 style="font-family:'Cormorant Garamond',serif;color:var(--forest);margin:0;">\u{1F465} Team Management</h2>
        <button onclick="showAddStaffModal()" style="padding:10px 20px;background:var(--forest);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">+ Add Staff Member</button>
      </div>

      <div style="display:flex;gap:12px;margin-bottom:20px;">
        <button onclick="loadTeamView('all')" class="content-sec-btn active" id="team-filter-all">All</button>
        <button onclick="loadTeamView('staff')" class="content-sec-btn" id="team-filter-staff">Staff</button>
        <button onclick="loadTeamView('clients')" class="content-sec-btn" id="team-filter-clients">Clients</button>
      </div>

      <div id="team-list" style="display:grid;gap:12px;">
        <p style="color:#888;text-align:center;padding:40px;">Loading team...</p>
      </div>
    </div>
  `;

  // Insert panel alongside other owner tab panels
  const ownerContent = document.querySelector('#owner-portal .tab-content') ||
    document.querySelector('#o-studio')?.parentElement;
  if (ownerContent) {
    ownerContent.appendChild(panel);
  }
}

// Load team members based on filter
async function loadTeamView(filter) {
  const sb = getSB();
  if (!sb) return;

  // Update filter buttons
  document.querySelectorAll('[id^="team-filter-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('team-filter-' + filter);
  if (btn) btn.classList.add('active');

  const listEl = document.getElementById('team-list');
  if (!listEl) return;
  listEl.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">Loading...</p>';

  let query = sb.from('profiles').select('*').order('created_at', { ascending: false });

  if (filter === 'staff') {
    query = query.eq('role', 'staff');
  } else if (filter === 'clients') {
    query = query.eq('role', 'client');
  }

  const { data, error } = await query;
  if (error) {
    listEl.innerHTML = '<p style="color:red;">Error loading team: ' + error.message + '</p>';
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = '<p style="text-align:center;color:#888;padding:40px;">No team members found.</p>';
    return;
  }

  listEl.innerHTML = data.map(m => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px;background:white;border:1px solid #e5e5e5;border-radius:12px;cursor:pointer;" onclick="${m.role === 'staff' ? 'showStaffProfile' : 'showClientProfile'}('${m.id}')">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:44px;height:44px;border-radius:50%;background:${m.role === 'staff' ? 'var(--forest-light)' : 'var(--gold-light)'};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;">
          ${(m.full_name || '?').charAt(0).toUpperCase()}
        </div>
        <div>
          <div style="font-weight:600;color:var(--ink);">${m.full_name || 'Unnamed'}</div>
          <div style="font-size:0.85rem;color:#888;">
            ${m.role === 'staff' ? '\u{1F464} Staff' : '\u{1F43E} Client'}
            ${m.customer_number ? ' · #' + m.customer_number : ''}
            ${m.phone ? ' · ' + m.phone : ''}
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        ${m.role === 'staff' ? `
          <span style="padding:4px 10px;border-radius:20px;font-size:0.8rem;font-weight:600;${m.is_active !== false ? 'background:var(--forest-pale);color:var(--forest);' : 'background:#fee;color:#c00;'}">${m.is_active !== false ? 'Active' : 'Inactive'}</span>
        ` : ''}
        <span style="color:#ccc;font-size:1.2rem;">\u{203A}</span>
      </div>
    </div>
  `).join('');
}

// Show modal to add a new staff member
function showAddStaffModal() {
  const existing = document.getElementById('add-staff-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'add-staff-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;max-width:500px;width:100%;padding:32px;position:relative;">
      <button onclick="document.getElementById('add-staff-modal').remove()" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:1.5rem;cursor:pointer;">&times;</button>
      <h2 style="font-family:'Cormorant Garamond',serif;color:var(--forest);margin:0 0 20px;">Add Staff Member</h2>
      <p style="color:#666;margin-bottom:20px;">Create a new staff account. They'll receive login credentials to access the Staff Portal.</p>

      <div style="display:grid;gap:12px;">
        <div>
          <label style="font-weight:600;display:block;margin-bottom:4px;">Full Name *</label>
          <input id="new-staff-name" type="text" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;" placeholder="Jane Smith">
        </div>
        <div>
          <label style="font-weight:600;display:block;margin-bottom:4px;">Email *</label>
          <input id="new-staff-email" type="email" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;" placeholder="jane@example.com">
        </div>
        <div>
          <label style="font-weight:600;display:block;margin-bottom:4px;">Phone</label>
          <input id="new-staff-phone" type="tel" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;" placeholder="717-555-0123">
        </div>
        <div>
          <label style="font-weight:600;display:block;margin-bottom:4px;">Temporary Password *</label>
          <input id="new-staff-pass" type="text" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;" placeholder="TempPass123!">
          <small style="color:#888;">Staff will use this to log in. They should change it after first login.</small>
        </div>
        <div>
          <label style="font-weight:600;display:block;margin-bottom:4px;">Hourly Rate ($)</label>
          <input id="new-staff-rate" type="number" step="0.01" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;" placeholder="15.00">
        </div>
      </div>

      <button onclick="createStaffMember()" style="width:100%;margin-top:20px;padding:12px;background:var(--forest);color:white;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;">Create Staff Account</button>
    </div>
  `;
  document.body.appendChild(modal);
}

// Create a new staff member via Supabase Auth
async function createStaffMember() {
  const sb = getSB();
  if (!sb) { toast('Database not connected'); return; }

  const name = document.getElementById('new-staff-name')?.value?.trim();
  const email = document.getElementById('new-staff-email')?.value?.trim();
  const phone = document.getElementById('new-staff-phone')?.value?.trim();
  const password = document.getElementById('new-staff-pass')?.value;
  const rate = parseFloat(document.getElementById('new-staff-rate')?.value) || null;

  if (!name || !email || !password) {
    toast('Please fill in name, email, and password');
    return;
  }

  try {
    // Sign up the staff member
    const { data: signUpData, error: signUpError } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { role: 'staff', full_name: name }
      }
    });

    if (signUpError) {
      toast('Error creating account: ' + signUpError.message);
      return;
    }

    // Update profile with extra info
    if (signUpData.user) {
      // Wait a moment for the trigger to create the profile
      await new Promise(r => setTimeout(r, 1000));

      const { error: updateError } = await sb.from('profiles')
        .update({ phone, hourly_rate: rate, email, hire_date: new Date().toISOString().split('T')[0] })
        .eq('user_id', signUpData.user.id);

      if (updateError) console.warn('Profile update warning:', updateError);
    }

    toast('\u2705 Staff account created for ' + name + '! They can log in with: ' + email);
    document.getElementById('add-staff-modal')?.remove();
    loadTeamView('staff');

  } catch (err) {
    toast('Error: ' + err.message);
  }
}

// Toggle staff active/inactive
async function toggleStaffActive(profileId, currentActive) {
  const sb = getSB();
  if (!sb) return;
  const { error } = await sb.from('profiles').update({ is_active: !currentActive }).eq('id', profileId);
  if (error) { toast('Failed to update status'); return; }
  toast('\u2705 Staff status updated');
  loadTeamView('staff');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Delay injection slightly to ensure owner portal is rendered
  setTimeout(injectEmployeeTab, 500);
});

console.log('[employee-mgmt.js] Employee management module loaded');
