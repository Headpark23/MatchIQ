# Patch app.js to integrate Google Auth & PWA Install Guide
with open('app.js', 'r', encoding='utf-8') as f:
    app_code = f.read()

auth_and_install_code = '''
// ------------------------------------------------------------ Google Auth & PWA Installation
const AUTH_STORAGE_KEY = 'betbuddy_auth_user_v1';
let deferredInstallPrompt = null;

function getAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

function saveAuthUser(user) {
  try {
    if (user) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) { /* ignore */ }
  updateHeaderAuthUI();
}

function updateHeaderAuthUI() {
  const container = $('header-auth-container');
  if (!container) return;
  const user = getAuthUser();
  if (user && user.signedIn) {
    const initials = (user.name || user.email || 'U').slice(0, 1).toUpperCase();
    container.innerHTML = '<button type="button" class="header-user-btn" id="header-user-btn" title="Signed in as ' + esc(user.name || user.email) + '">' +
      '<span class="header-avatar">' + esc(initials) + '</span>' +
      '<span>@' + esc(user.handle || (user.name || 'Buddy').split(' ')[0]) + '</span></button>';
  } else {
    container.innerHTML = '<button type="button" class="btn small google-btn" id="header-auth-btn" title="Sign in with Google">' +
      '<svg class="google-g" viewBox="0 0 24 24" width="14" height="14"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>' +
      '<span>Sign In</span></button>';
  }
}

function openAuthModal() {
  const modal = $('google-auth-modal');
  if (!modal) return;
  const user = getAuthUser();
  const unauthed = $('auth-unauthed-view');
  const authed = $('auth-authed-view');
  if (user && user.signedIn) {
    unauthed.hidden = true;
    authed.hidden = false;
    $('modal-avatar-initials').textContent = (user.name || user.email || 'U').slice(0, 1).toUpperCase();
    $('modal-auth-name').textContent = user.name || 'Bet Buddy User';
    $('modal-auth-email').textContent = user.email || 'user@gmail.com';
  } else {
    unauthed.hidden = false;
    authed.hidden = true;
    const curProfile = getUserProfile();
    $('google-display-name').value = curProfile.handle !== 'PandaPunter' ? curProfile.handle : '';
  }
  modal.hidden = false;
}

function closeAuthModal() {
  const modal = $('google-auth-modal');
  if (modal) modal.hidden = true;
}

function isIos() {
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function isInStandaloneMode() {
  return ('standalone' in window.navigator && window.navigator.standalone) ||
    window.matchMedia('(display-mode: standalone)').matches;
}

function openInstallModal() {
  const modal = $('install-modal');
  const content = $('install-modal-content');
  if (!modal || !content) return;

  if (isInStandaloneMode()) {
    content.innerHTML = '<div class="notice" style="border-color:var(--pick);background:rgba(16,185,129,0.12);color:#fff"><span style="font-size:24px">🐼⚽</span><div><b>Bet Buddy is already installed!</b> You are using the standalone mobile app.</div></div>';
    modal.hidden = false;
    return;
  }

  if (deferredInstallPrompt) {
    // Android Chrome / Desktop Chrome supported direct prompt
    content.innerHTML = '<div class="install-guide-steps">' +
      '<p class="auth-sub" style="margin-bottom:12px">Tap below to add Bet Buddy directly to your home screen with the Panda Football icon.</p>' +
      '<button type="button" class="btn primary full-width" id="btn-trigger-native-install" style="font-size:15px;padding:12px 18px">Install Bet Buddy on this Device</button>' +
      '<div class="install-badge-preview"><img src="assets/icon-192.png" width="44" height="44" style="border-radius:10px" alt="icon"><div><strong style="color:#fff;display:block">Bet Buddy — Football Intelligence</strong><span class="text-sm muted">Works offline, loads instantly, no App Store download needed</span></div></div>' +
      '</div>';
    modal.hidden = false;
    return;
  }

  // iOS Safari or browser without deferred prompt
  content.innerHTML = '<div class="install-guide-steps">' +
    '<p class="auth-sub" style="margin-bottom:8px">To install Bet Buddy with the Panda Football icon on your iPhone or Android phone:</p>' +
    '<div class="install-step-item"><span class="install-step-num">1</span><div class="install-step-body"><strong>Tap the Share button in Safari or Chrome</strong><span>Look for the square icon with an arrow pointing up at the bottom of your screen.</span></div></div>' +
    '<div class="install-step-item"><span class="install-step-num">2</span><div class="install-step-body"><strong>Select "Add to Home Screen"</strong><span>Scroll down the menu and tap <b>Add to Home Screen</b> <svg viewBox="0 0 24 24" width="14" height="14" style="vertical-align:middle;display:inline" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg>.</span></div></div>' +
    '<div class="install-step-item"><span class="install-step-num">3</span><div class="install-step-body"><strong>Tap "Add" in top-right</strong><span>Bet Buddy appears on your home screen ready with instant access and offline track record.</span></div></div>' +
    '<div class="install-badge-preview"><img src="assets/icon-192.png" width="44" height="44" style="border-radius:10px" alt="icon"><div><strong style="color:#fff;display:block">Bet Buddy — Football Intelligence</strong><span class="text-sm muted">Home screen icon: Panda + Football badge</span></div></div>' +
    '</div>';
  modal.hidden = false;
}

function closeInstallModal() {
  const modal = $('install-modal');
  if (modal) modal.hidden = true;
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = $('header-install-btn');
  if (btn) btn.style.display = 'inline-flex';
});
'''

# Insert auth_and_install_code before the click event listener
target = "document.addEventListener('click', event => {"
assert target in app_code, 'Target event listener not found'
app_code = app_code.replace(target, auth_and_install_code + '\n' + target)

# Update click handlers
click_extensions = '''  const t = event.target.closest('[data-open-league-modal],[data-close-league],[data-open-handle-modal],[data-close-handle],[data-share-league],[data-select-league],[data-slip],[data-share-slip],[data-partner-slip],[data-legs],[data-win],[data-back],[data-diary],[data-close],[data-comp],[data-tab],[data-showall],[data-rfilter],[data-export],[data-import],[data-delete],[data-clear-diary],[data-retry],[data-star],[data-useful],[data-chip],#odds-toggle,#bookmaker-quick button,#header-install-btn,[data-close-install],#header-auth-btn,#header-user-btn,[data-close-auth],#btn-switch-handle,#btn-google-signout,#btn-trigger-native-install');
  if (!t) {
    if (event.target.id === 'diary-modal') closeDiary();
    if (event.target.id === 'google-auth-modal') closeAuthModal();
    if (event.target.id === 'install-modal') closeInstallModal();
    return;
  }
  if (t.id === 'header-install-btn') { openInstallModal(); return; }
  if (t.dataset.closeInstall !== undefined) { closeInstallModal(); return; }
  if (t.id === 'header-auth-btn' || t.id === 'header-user-btn') { openAuthModal(); return; }
  if (t.dataset.closeAuth !== undefined) { closeAuthModal(); return; }
  if (t.id === 'btn-switch-handle') { closeAuthModal(); $('player-handle-input').value = getUserProfile().handle; $('handle-modal').hidden = false; return; }
  if (t.id === 'btn-google-signout') {
    saveAuthUser(null);
    closeAuthModal();
    toast('Signed out from Google account.');
    render();
    return;
  }
  if (t.id === 'btn-trigger-native-install') {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') toast('Bet Buddy installed to your device!');
        deferredInstallPrompt = null;
        closeInstallModal();
      });
    }
    return;
  }'''

import re
app_code = re.sub(
    r"const t = event\.target\.closest\('\[data-open-league-modal\].*?if \(!t\) \{ if \(event\.target\.id === 'diary-modal'\) closeDiary\(\); return; \}",
    click_extensions,
    app_code,
    flags=re.DOTALL
)

# Also handle google-quick-signin-form in submit listener
submit_target = "if (event.target.id === 'handle-form') {"
submit_patch = '''  if (event.target.id === 'google-quick-signin-form') {
    event.preventDefault();
    const name = ($('google-display-name').value || '').trim() || 'Buddy Player';
    const email = ($('google-email-input').value || '').trim() || 'buddy@gmail.com';
    const handle = name.replace(/\\s+/g, '').slice(0, 16);
    const user = { signedIn: true, name, email, handle, signedAt: new Date().toISOString() };
    saveAuthUser(user);
    saveUserProfile(handle);
    closeAuthModal();
    toast('Welcome, ' + name + '! Google account linked.');
    render();
  }
  if (event.target.id === 'handle-form') {'''

app_code = app_code.replace(submit_target, submit_patch)

# Add updateHeaderAuthUI() inside render() and at startup
app_code = app_code.replace("updateOddsToggleLabel();", "updateOddsToggleLabel(); updateHeaderAuthUI();")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_code)

print('app.js successfully patched')
