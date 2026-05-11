/*
  Housley Happy Paws — Supabase Auth Client
  * Handles login, signup, session management, and portal gating.
  *
  * SETUP: Replace SUPABASE_ANON_KEY below with your anon key from
  *   Supabase Dashboard > Settings > API Keys > Legacy > anon public
  */

const HHP_Auth = window.HHP_Auth = {
    // ── Config ──
    SUPABASE_URL: 'https://niysrippazlkpvdkzepp.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5peXNyaXBwYXpsa3B2ZGt6ZXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTcxNDYsImV4cCI6MjA3OTA3MzE0Nn0.miAoNZQtOTTbnruWcj1WVn8ZGYtQZB5rh8FbBAS7VZU',

    supabase: null,
    currentUser: null,
    currentRole: null,

    // ── Initialize ──
    async init() {
        if (!window.supabase) {
            console.warn('Supabase JS not loaded. Auth disabled.');
            return false;
        }

        this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);

        // Signal that auth client is ready (other modules listen for this)
        window.dispatchEvent(new Event('hhp-auth-ready'));

        // Check for existing session
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) {
            await this.handleSession(session);
        }

        // Initial session check is done — any future logins are FRESH, not restores
        this._initialLoad = false;

        // Listen for auth state changes
        this.supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                // Reset link clicked. Don't drop into the portal — prompt for a new password first.
                this._inPasswordRecovery = true;
                showPasswordResetModal();
                return;
            }
            if (event === 'SIGNED_IN' && session) {
                // If a recovery flow is in progress, ignore the implicit sign-in
                // until the user has actually set a new password.
                if (this._inPasswordRecovery) return;
                // Skip if this is the same session we already handled from getSession()
                // But allow through if it's a NEW user (actual fresh login)
                if (this._handledSessionId === session.user.id) return;
                await this.handleSession(session);
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                this.currentRole = null;
                this.session = null;
                this._handledSessionId = null;
                try { sessionStorage.removeItem('hhp_cached_role'); sessionStorage.removeItem('hhp_cached_profile'); sessionStorage.removeItem('hhp_cached_stats'); sessionStorage.removeItem('hhp_avatar_url'); sessionStorage.removeItem('hhp_last_view'); sessionStorage.removeItem('hhp_last_panel'); sessionStorage.removeItem('hhp_last_portal'); } catch(e) {}
                this.showLoginScreen();
            }
        });

        return true;
    },

    // Track whether this is the initial page load (vs a fresh login)
    _initialLoad: true,
    _handledSessionId: null, // user ID of the session we already handled
    session: null,

    // ── Handle session after login ──
    async handleSession(session) {
        this.currentUser = session.user;
        this.session = session;

        // On initial page load (session restore), respect where the user was
        // Only force-navigate to portal on a FRESH login (not reload)
        let isSessionRestore = this._initialLoad;

        // Use cached role instantly to avoid flash, then verify from DB
        let usedCache = false;
        try {
            const cachedRole = sessionStorage.getItem('hhp_cached_role');
            if (cachedRole && isSessionRestore) {
                this.currentRole = cachedRole;
                usedCache = true;
                this.hideLoginScreen();
                // On reload: restore the LAST VIEW (could be public/home)
                // On fresh login: go to portal
                var lastView = sessionStorage.getItem('hhp_last_view');
                var lastPanel = sessionStorage.getItem('hhp_last_panel');
                var lastPortal = sessionStorage.getItem('hhp_last_portal');
                if (lastView) {
                    if (typeof switchView === 'function') switchView(lastView);
                    // Restore the specific panel the user was on (switchView resets to overview)
                    if (lastPanel && lastPortal && typeof sTab === 'function') {
                        setTimeout(function() { sTab(lastPortal, lastPanel); }, 50);
                    }
                } else {
                    this.routeToPortal();
                }
                this.updateUIForUser();
                // Check pet setup on session restore too
                if (cachedRole === 'client' && typeof checkNeedsPetSetup === 'function') {
                    setTimeout(checkNeedsPetSetup, 1200);
                }
            }
        } catch(e) {}

        try {
            // Get user role from profiles table
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('role, full_name, phone, pet_names, avatar_url, preferences, address, emergency_contact_name, emergency_contact_phone')
                .eq('user_id', session.user.id)
                .single();

            if (error) {
                console.warn('Profile query error:', error.message);
                this.currentRole = 'client';
            } else if (profile) {
                this.currentRole = profile.role || 'client';
                this.currentUser.profile = profile;
                // Cache full profile for instant hydration on next load
                try {
                    sessionStorage.setItem('hhp_cached_profile', JSON.stringify(profile));
                    if (profile.avatar_url) sessionStorage.setItem('hhp_avatar_url', profile.avatar_url);
                } catch(e) {}
                // Load user preferences from DB into settings
                if (profile.preferences && typeof profile.preferences === 'object') {
                    try {
                        var local = JSON.parse(localStorage.getItem('hhp_settings') || '{}');
                        var merged = Object.assign({}, local, profile.preferences);
                        localStorage.setItem('hhp_settings', JSON.stringify(merged));
                        if (window.HHP_Settings && typeof HHP_Settings.init === 'function') HHP_Settings.init();
                    } catch(e) {}
                }
            } else {
                this.currentRole = 'client';
                await this.supabase.from('profiles').insert({
                    user_id: session.user.id,
                    role: 'client',
                    full_name: session.user.user_metadata?.full_name || '',
                });
            }
        } catch (err) {
            console.warn('Error loading profile:', err);
            this.currentRole = 'client';
        }

        // Cache the verified role for next page load
        try { sessionStorage.setItem('hhp_cached_role', this.currentRole); } catch(e) {}

        this.hideLoginScreen();

        // Only route to portal on FRESH LOGIN (not session restore / page reload)
        if (!isSessionRestore) {
            // Fresh login — always go to their portal
            this.routeToPortal();
        } else if (!usedCache) {
            // Session restore but no cache was used — restore last view or go to portal
            var lastView = sessionStorage.getItem('hhp_last_view');
            var lastPanel = sessionStorage.getItem('hhp_last_panel');
            var lastPortal = sessionStorage.getItem('hhp_last_portal');
            if (lastView) {
                if (typeof switchView === 'function') switchView(lastView);
                if (lastPanel && lastPortal && typeof sTab === 'function') {
                    setTimeout(function() { sTab(lastPortal, lastPanel); }, 50);
                }
            } else {
                this.routeToPortal();
            }
        }
        // If usedCache + isSessionRestore, we already handled it above

        this.updateUIForUser();
        this._initialLoad = false;
        this._handledSessionId = session.user.id;

        // Check if client needs to set up their first pet profile
        if (this.currentRole === 'client' && typeof checkNeedsPetSetup === 'function') {
            setTimeout(checkNeedsPetSetup, 800);
        }
    },

    // ── Route user to their portal based on role ──
    routeToPortal() {
        switch (this.currentRole) {
            case 'owner':
                if (typeof switchView === 'function') switchView('owner');
                break;
            case 'staff':
                if (typeof switchView === 'function') switchView('staff');
                break;
            case 'client':
            default:
                if (typeof switchView === 'function') switchView('client');
                break;
        }
        // Apply default view preference from settings (if not 'auto')
        var self = this;
        setTimeout(function() {
            if (window.HHP_Settings && typeof HHP_Settings.getDefaultView === 'function') {
                var dv = HHP_Settings.getDefaultView();
                if (dv && dv !== 'auto' && typeof sTab === 'function') {
                    var portalKey = self.currentRole === 'owner' ? 'o' : self.currentRole === 'staff' ? 's' : 'c';
                    sTab(portalKey, dv);
                }
            }
            // Surface any unsent service reports left over from a previous session
            // (offline submit, crashed browser, timed-out save). Owner/staff only —
            // clients never submit reports.
            if ((self.currentRole === 'owner' || self.currentRole === 'staff') &&
                window.HHP_Report && typeof window.HHP_Report.renderRecoveryBanner === 'function') {
                try { window.HHP_Report.renderRecoveryBanner(); } catch (e) { console.warn('Recovery banner error:', e); }
            }
        }, 100);
    },

    // ── Update nav/UI to reflect logged-in user ──
    updateUIForUser() {
        const dropdown = document.getElementById('viewDropdown');
        if (!dropdown) return;

        let opts = '';

        if (this.currentRole === 'client') {
            // Clients only see their portal — logo at top still links to home page
            opts = '<option value="client" selected>🐾 My Portal</option>';
        } else if (this.currentRole === 'staff') {
            opts = '<option value="public">🐾 Home</option>';
            opts += '<option value="staff" selected>🧑 Staff</option>';
        } else if (this.currentRole === 'owner') {
            opts = '<option value="public">🐾 Home</option>';
            opts += '<option value="client">👤 Client View</option>';
            opts += '<option value="staff">🧑 Staff View</option>';
            opts += '<option value="owner" selected>👑 Owner</option>';
        }
        dropdown.innerHTML = opts;

        // Show the view switcher now that it has the correct options
        const switcher = document.getElementById('viewSwitcher');
        if (switcher) switcher.style.display = 'inline-flex';

        const nameEls = document.querySelectorAll('.sb-name');
        const displayName = this.currentUser?.profile?.full_name
            || this.currentUser?.email?.split('@')[0]
            || 'Welcome!';
        nameEls.forEach(el => el.textContent = displayName);

        const bookBtn = document.querySelector('.nav-right .nbtn-gold');
        if (bookBtn && this.currentRole !== 'owner') {
            // Keep the book button visible for non-owners
        }
    },

    // ── Login with email & password ──
    async login(email, password) {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        });

        if (error) throw error;
        return data;
    },

    // ── Sign up ──
    async signup(email, password, fullName) {
        const { data, error } = await this.supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
                data: { full_name: fullName || '' },
            },
        });

        if (error) throw error;
        return data;
    },

    // ── Magic link (passwordless) ──
    async sendMagicLink(email) {
        const { error } = await this.supabase.auth.signInWithOtp({
            email: email.trim(),
            options: {
                emailRedirectTo: window.location.origin,
            },
        });

        if (error) throw error;
    },

    // ── Logout ──
    async logout() {
        // Clean up realtime subscriptions and cache before signing out
        try { if (window.HHP_Realtime) window.HHP_Realtime.destroy(); } catch(e) { console.warn('Realtime cleanup:', e); }
        try { if (window.HHP_Cache) window.HHP_Cache.clear(); } catch(e) { console.warn('Cache cleanup:', e); }
        try { if (window.HHP_Messaging && window.HHP_Messaging.cleanup) window.HHP_Messaging.cleanup(); } catch(e) { console.warn('Messaging cleanup:', e); }
        try { if (window.HHP_Notif && window.HHP_Notif.cleanup) window.HHP_Notif.cleanup(); } catch(e) { console.warn('Notif cleanup:', e); }
        try { if (window.HHP_ServiceTimer) window.HHP_ServiceTimer.stopTimer(); } catch(e) {}
        // Clean up deals realtime subscription
        try { if (window._dealsRealtimeChannel) { window._dealsRealtimeChannel.unsubscribe(); window._dealsRealtimeChannel = null; window._dealsRealtimeSubscribed = false; } } catch(e) {}
        // Remove any orphaned modals
        try { document.querySelectorAll('[id$="-modal"]').forEach(function(m) { m.remove(); }); } catch(e) {}
        // Reset customizer so next login does a full init (not stale refreshAll)
        try { if (window.HHP_Customizer) window.HHP_Customizer._forceReinit = true; } catch(e) {}
        await this.supabase.auth.signOut();
        this.currentUser = null;
        this.currentRole = null;
        this.session = null;
        this._handledSessionId = null;
        this._initialLoad = false; // Keep false — _forceReinit handles customizer reset
        try { sessionStorage.removeItem('hhp_cached_role'); sessionStorage.removeItem('hhp_cached_profile'); sessionStorage.removeItem('hhp_cached_stats'); sessionStorage.removeItem('hhp_avatar_url'); sessionStorage.removeItem('hhp_last_view'); sessionStorage.removeItem('hhp_last_panel'); sessionStorage.removeItem('hhp_last_portal'); } catch(e) {}
        if (typeof switchView === 'function') switchView('public');
        this.showLoginScreen();
    },

    // ── Password reset ──
    async resetPassword(email) {
        const { error } = await this.supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: window.location.origin + '?reset=true',
        });

        if (error) throw error;
    },

    // ── Gate check — call before showing protected portal ──
    isAuthenticated() { return !!this.currentUser; },
    hasRole(role) { return this.currentRole === role; },
    canAccessPortal(portal) {
        if (!this.isAuthenticated()) return false;
        if (this.currentRole === 'owner') return true;
        if (portal === 'public') return true;
        // Staff can access client portal when viewing as a client
        if (this.currentRole === 'staff' && portal === 'client' && window._viewingAsClient) return true;
        return this.currentRole === portal;
    },

    // ── Show/hide login overlay ──
    showLoginScreen() {
        const overlay = document.getElementById('authOverlay');
        if (overlay) overlay.style.display = 'flex';
    },
    hideLoginScreen() {
        const overlay = document.getElementById('authOverlay');
        if (overlay) overlay.style.display = 'none';
    },
};


// ── Login form handler (called from HTML) ──
async function handleLogin(e) {
    if (e) e.preventDefault();

    const email    = document.getElementById('authEmail')?.value;
    const password = document.getElementById('authPassword')?.value;
    const errEl    = document.getElementById('authError');
    const btn      = document.getElementById('authSubmitBtn');

    if (!email) {
        if (errEl) errEl.textContent = 'Please enter your email.';
        return;
    }

    try {
        if (btn) btn.textContent = 'Signing in...';
        if (errEl) errEl.textContent = '';

        if (password) {
            await HHP_Auth.login(email, password);
            // Trigger browser password save prompt
            if (window.PasswordCredential) {
                try {
                    var cred = new PasswordCredential({ id: email, password: password });
                    navigator.credentials.store(cred);
                } catch(e) { /* not supported */ }
            }
        } else {
            await HHP_Auth.sendMagicLink(email);
            if (errEl) {
                errEl.style.color = 'var(--forest)';
                errEl.textContent = 'Check your email for a login link!';
            }
            if (btn) btn.textContent = 'Link Sent!';
            return;
        }
    } catch (err) {
        if (errEl) {
            errEl.style.color = 'var(--rose)';
            // Show a friendly message instead of raw database/API errors
            errEl.textContent = 'Incorrect email or password. Please try again.';
        }
    } finally {
        if (btn && btn.textContent === 'Signing in...') btn.textContent = 'Sign In';
    }
}

async function handleSignup(e) {
    if (e) e.preventDefault();

    const name            = document.getElementById('authName')?.value;
    const email           = document.getElementById('authEmail')?.value;
    const confirmEmail    = document.getElementById('authConfirmEmail')?.value;
    const password        = document.getElementById('authPassword')?.value;
    const confirmPassword = document.getElementById('authConfirmPassword')?.value;
    const errEl           = document.getElementById('authError');
    const btn             = document.getElementById('authSubmitBtn');

    if (!email || !password) {
        if (errEl) { errEl.style.color = 'var(--rose)'; errEl.textContent = 'Email and password required.'; }
        return;
    }
    if (email.trim().toLowerCase() !== (confirmEmail || '').trim().toLowerCase()) {
        if (errEl) { errEl.style.color = 'var(--rose)'; errEl.textContent = 'Emails do not match. Please re-type your email.'; }
        return;
    }
    if (password !== confirmPassword) {
        if (errEl) { errEl.style.color = 'var(--rose)'; errEl.textContent = 'Passwords do not match. Please re-type your password.'; }
        return;
    }
    if (password.length < 6) {
        if (errEl) { errEl.style.color = 'var(--rose)'; errEl.textContent = 'Password must be at least 6 characters.'; }
        return;
    }

    try {
        if (btn) btn.textContent = 'Creating account...';
        if (errEl) errEl.textContent = '';

        const result = await HHP_Auth.signup(email, password, name);

        // Supabase returns user but session is null when email confirmation is required
        if (errEl) {
            errEl.style.color = 'var(--forest)';
            if (result?.user && !result?.session) {
                errEl.innerHTML = '✅ Account created! Check <strong>' + email + '</strong> for a confirmation link, then come back and sign in.';
            } else {
                errEl.textContent = '✅ Account created! You can now sign in.';
            }
        }
        // Switch back to login view after a moment
        if (btn) btn.textContent = '✓ Check Your Email';
        btn.disabled = true;
        setTimeout(function() {
            if (typeof toggleAuthMode === 'function') toggleAuthMode('login');
            if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }
        }, 5000);
    } catch (err) {
        console.error('Signup error:', err);
        if (errEl) {
            errEl.style.color = 'var(--rose)';
            if (err.message?.includes('already registered') || err.message?.includes('already been registered')) {
                errEl.textContent = 'An account with this email already exists. Try signing in.';
            } else if (err.message?.includes('password')) {
                errEl.textContent = 'Password must be at least 6 characters.';
            } else if (err.message?.includes('valid email') || err.message?.includes('invalid')) {
                errEl.textContent = 'Please enter a valid email address.';
            } else {
                errEl.textContent = 'Signup failed: ' + (err.message || 'Please check your details and try again.');
            }
        }
    } finally {
        if (btn && !btn.disabled) btn.textContent = 'Create Account';
    }
}

// ── Password reset: shown when Supabase fires PASSWORD_RECOVERY after the user clicks the email link ──
function showPasswordResetModal() {
    const existing = document.getElementById('hhp-pw-reset-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'hhp-pw-reset-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
      <div style="background:var(--cream,#fff8ec);border-radius:16px;max-width:420px;width:100%;padding:28px;box-shadow:0 12px 40px rgba(0,0,0,0.25);">
        <h2 style="font-family:'Cormorant Garamond',serif;color:var(--forest,#3d5a47);margin:0 0 8px;">Set a new password</h2>
        <p style="color:#666;margin:0 0 18px;font-size:0.92rem;">You arrived here from a password reset email. Choose a new password to finish.</p>
        <label style="font-weight:600;display:block;margin-bottom:6px;">New password</label>
        <input id="hhp-pw-reset-new" type="password" autocomplete="new-password" minlength="8" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:12px;" placeholder="At least 8 characters">
        <label style="font-weight:600;display:block;margin-bottom:6px;">Confirm password</label>
        <input id="hhp-pw-reset-confirm" type="password" autocomplete="new-password" minlength="8" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:12px;" placeholder="Re-type your new password">
        <div id="hhp-pw-reset-err" style="color:var(--rose,#c62828);font-size:0.88rem;min-height:1.2em;margin-bottom:8px;"></div>
        <button id="hhp-pw-reset-submit" style="width:100%;padding:12px;background:var(--forest,#3d5a47);color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;">Save new password</button>
      </div>
    `;
    document.body.appendChild(modal);
    const submit = document.getElementById('hhp-pw-reset-submit');
    submit.onclick = handlePasswordResetSubmit;
    document.getElementById('hhp-pw-reset-confirm').addEventListener('keydown', e => {
        if (e.key === 'Enter') handlePasswordResetSubmit();
    });
}

async function handlePasswordResetSubmit() {
    const pw = document.getElementById('hhp-pw-reset-new')?.value || '';
    const confirm = document.getElementById('hhp-pw-reset-confirm')?.value || '';
    const errEl = document.getElementById('hhp-pw-reset-err');
    const btn = document.getElementById('hhp-pw-reset-submit');
    if (errEl) errEl.textContent = '';
    if (pw.length < 8) { if (errEl) errEl.textContent = 'Password must be at least 8 characters.'; return; }
    if (pw !== confirm) { if (errEl) errEl.textContent = 'Passwords don’t match.'; return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    try {
        const { data, error } = await HHP_Auth.supabase.auth.updateUser({ password: pw });
        if (error) throw error;
        // Strip the recovery hash/query so a refresh doesn't re-trigger the modal.
        try { history.replaceState(null, '', window.location.pathname); } catch(e) {}
        HHP_Auth._inPasswordRecovery = false;
        document.getElementById('hhp-pw-reset-modal')?.remove();
        if (data?.user) {
            const { data: { session } } = await HHP_Auth.supabase.auth.getSession();
            if (session) await HHP_Auth.handleSession(session);
        }
        if (typeof toast === 'function') toast('✅ Password updated. You’re signed in.');
    } catch (err) {
        if (errEl) errEl.textContent = err.message || 'Could not update password. Try requesting a new reset email.';
        if (btn) { btn.disabled = false; btn.textContent = 'Save new password'; }
    }
}

async function handleForgotPassword() {
    const email = document.getElementById('authEmail')?.value;
    const errEl = document.getElementById('authError');

    if (!email) {
        if (errEl) errEl.textContent = 'Enter your email first.';
        return;
    }

    try {
        await HHP_Auth.resetPassword(email);
        if (errEl) {
            errEl.style.color = 'var(--forest)';
            errEl.textContent = 'Password reset email sent! Check your inbox.';
        }
    } catch (err) {
        if (errEl) {
            errEl.style.color = 'var(--rose)';
            errEl.textContent = 'Could not send reset email. Please check your email address.';
        }
    }
}

function toggleAuthMode(mode) {
    const nameField        = document.getElementById('authNameGroup');
    const btn              = document.getElementById('authSubmitBtn');
    const toggle           = document.getElementById('authToggle');
    const passGroup        = document.getElementById('authPasswordGroup');
    const confirmEmailGrp  = document.getElementById('authConfirmEmailGroup');
    const confirmPassGrp   = document.getElementById('authConfirmPasswordGroup');

    if (mode === 'signup') {
        if (nameField) nameField.style.display = 'block';
        if (confirmEmailGrp) confirmEmailGrp.style.display = 'block';
        if (confirmPassGrp) confirmPassGrp.style.display = 'block';
        if (btn) { btn.textContent = 'Create Account'; btn.onclick = handleSignup; }
        if (toggle)  toggle.innerHTML = 'Already have an account? <a href="#" onclick="toggleAuthMode(\'login\');return false;" style="color:var(--gold)">Sign in</a>';
    } else if (mode === 'magic') {
        if (nameField) nameField.style.display = 'none';
        if (passGroup) passGroup.style.display = 'none';
        if (confirmEmailGrp) confirmEmailGrp.style.display = 'none';
        if (confirmPassGrp) confirmPassGrp.style.display = 'none';
        if (btn) { btn.textContent = 'Send Magic Link'; btn.onclick = handleLogin; }
        if (toggle)  toggle.innerHTML = 'Prefer password? <a href="#" onclick="toggleAuthMode(\'login\');return false;" style="color:var(--gold)">Sign in with password</a>';
    } else {
        if (nameField) nameField.style.display = 'none';
        if (passGroup) passGroup.style.display = 'block';
        if (confirmEmailGrp) confirmEmailGrp.style.display = 'none';
        if (confirmPassGrp) confirmPassGrp.style.display = 'none';
        // Clear confirm fields when switching back to login
        var ce = document.getElementById('authConfirmEmail'); if (ce) ce.value = '';
        var cp = document.getElementById('authConfirmPassword'); if (cp) cp.value = '';
        if (btn) { btn.textContent = 'Sign In'; btn.onclick = handleLogin; }
        if (toggle)  toggle.innerHTML = 'New client? <a href="#" onclick="toggleAuthMode(\'signup\');return false;" style="color:var(--gold)">Create account</a> · <a href="#" onclick="toggleAuthMode(\'magic\');return false;" style="color:var(--gold)">Email me a link</a>';
    }
}
