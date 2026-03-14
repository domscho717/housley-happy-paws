/*
  Housley Happy Paws — Supabase Auth Client
  * Handles login, signup, session management, and portal gating.
  *
  * SETUP: Replace SUPABASE_ANON_KEY below with your anon key from
  *   Supabase Dashboard > Settings > API Keys > Legacy > anon public
  */

const HHP_Auth = {
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

        // Check for existing session
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) {
            await this.handleSession(session);
        }

        // Listen for auth state changes
        this.supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                await this.handleSession(session);
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                this.currentRole = null;
                this.showLoginScreen();
            }
        });

        return true;
    },

    // ── Handle session after login ──
    async handleSession(session) {
        this.currentUser = session.user;

        try {
            // Get user role from profiles table
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('role, full_name, phone, pet_names')
                .eq('user_id', session.user.id)
                .single();

            if (error) {
                console.warn('Profile query error:', error.message);
                this.currentRole = 'client';
            } else if (profile) {
                this.currentRole = profile.role || 'client';
                this.currentUser.profile = profile;
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

        this.hideLoginScreen();
        this.routeToPortal();
        this.updateUIForUser();
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
    },

    // ── Update nav/UI to reflect logged-in user ──
    updateUIForUser() {
        const dropdown = document.getElementById('viewDropdown');
        if (!dropdown) return;

        let opts = '<option value="public">🐾 Home</option>';

        if (this.currentRole === 'client') {
            opts += '<option value="client" selected>👤 My Portal</option>';
        } else if (this.currentRole === 'staff') {
            opts += '<option value="staff" selected>🧑 Staff</option>';
        } else if (this.currentRole === 'owner') {
            opts += '<option value="client">👤 Client View</option>';
            opts += '<option value="staff">🧑 Staff View</option>';
            opts += '<option value="owner" selected>👑 Owner</option>';
        }
        dropdown.innerHTML = opts;

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
        await this.supabase.auth.signOut();
        this.currentUser = null;
        this.currentRole = null;
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

    const name     = document.getElementById('authName')?.value;
    const email    = document.getElementById('authEmail')?.value;
    const password = document.getElementById('authPassword')?.value;
    const errEl    = document.getElementById('authError');
    const btn      = document.getElementById('authSubmitBtn');

    if (!email || !password) {
        if (errEl) errEl.textContent = 'Email and password required.';
        return;
    }
    if (password.length < 6) {
        if (errEl) errEl.textContent = 'Password must be at least 6 characters.';
        return;
    }

    try {
        if (btn) btn.textContent = 'Creating account...';
        if (errEl) errEl.textContent = '';

        await HHP_Auth.signup(email, password, name);

        if (errEl) {
            errEl.style.color = 'var(--forest)';
            errEl.textContent = 'Account created! Check your email to confirm, then sign in.';
        }
    } catch (err) {
        if (errEl) {
            errEl.style.color = 'var(--rose)';
            if (err.message?.includes('already registered')) {
                errEl.textContent = 'An account with this email already exists. Try signing in.';
            } else {
                errEl.textContent = 'Signup failed. Please check your details and try again.';
            }
        }
    } finally {
        if (btn) btn.textContent = 'Create Account';
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
    const nameField = document.getElementById('authNameGroup');
    const btn       = document.getElementById('authSubmitBtn');
    const toggle    = document.getElementById('authToggle');
    const passGroup = document.getElementById('authPasswordGroup');

    if (mode === 'signup') {
        if (nameField) nameField.style.display = 'block';
        if (btn) { btn.textContent = 'Create Account'; btn.onclick = handleSignup; }
        if (toggle)  toggle.innerHTML = 'Already have an account? <a href="#" onclick="toggleAuthMode(\'login\');return false;" style="color:var(--gold)">Sign in</a>';
    } else if (mode === 'magic') {
        if (nameField) nameField.style.display = 'none';
        if (passGroup) passGroup.style.display = 'none';
        if (btn) { btn.textContent = 'Send Magic Link'; btn.onclick = handleLogin; }
        if (toggle)  toggle.innerHTML = 'Prefer password? <a href="#" onclick="toggleAuthMode(\'login\');return false;" style="color:var(--gold)">Sign in with password</a>';
    } else {
        if (nameField) nameField.style.display = 'none';
        if (passGroup) passGroup.style.display = 'block';
        if (btn) { btn.textContent = 'Sign In'; btn.onclick = handleLogin; }
        if (toggle)  toggle.innerHTML = 'New client? <a href="#" onclick="toggleAuthMode(\'signup\');return false;" style="color:var(--gold)">Create account</a> · <a href="#" onclick="toggleAuthMode(\'magic\');return false;" style="color:var(--gold)">Email me a link</a>';
    }
}
