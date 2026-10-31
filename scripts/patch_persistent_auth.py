import re

# 1. Patch index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

target_html = '''    <div id="header-auth-container" class="sub-header-auth-wrap">
      <button type="button" class="google-sub-btn" id="header-auth-btn" title="Sign in with Google">
        <svg class="google-g" viewBox="0 0 24 24" width="13" height="13"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
        <span>Sign in with Google</span>
      </button>
    </div>'''

replacement_html = '''    <div id="header-auth-container" class="sub-header-auth-wrap">
      <button type="button" class="google-sub-btn" id="header-auth-btn" title="Sign In / Join">
        <svg class="google-g" viewBox="0 0 24 24" width="13" height="13"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
        <span>Sign In / Join</span>
      </button>
    </div>'''

assert target_html in html, "Target HTML not found in index.html"
html = html.replace(target_html, replacement_html, 1)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Updated index.html header button label to Sign In / Join.")


# 2. Patch app.js
with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 2a. Add setPersistence on Firebase initial setup
old_fb_init = '''    firestoreDb = firebase.firestore();
    if (firebase.auth) {
      firebaseAuth = firebase.auth();
    }'''

new_fb_init = '''    firestoreDb = firebase.firestore();
    if (firebase.auth) {
      firebaseAuth = firebase.auth();
      try {
        if (firebase.auth.Auth && firebase.auth.Auth.Persistence) {
          firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(e) {
            console.warn('Firebase setPersistence notice:', e);
          });
        }
      } catch (e) {}
    }'''

assert old_fb_init in js, "old_fb_init not found in app.js"
js = js.replace(old_fb_init, new_fb_init, 1)

# 2b. Add cachedAuthUser & getAuthUser & saveAuthUser & ensureUserProfile & updateHeaderAuthUI
old_auth_block = '''// ------------------------------------------------------------ Firebase Auth & Handles
const AUTH_STORAGE_KEY = 'betbuddy_auth_user_v1';
let deferredInstallPrompt = null;
let currentAuthUser = null;
let currentAuthProfile = null;
let lastResendVerificationTime = 0;'''

new_auth_block = '''// ------------------------------------------------------------ Firebase Auth & Handles
const AUTH_STORAGE_KEY = 'betbuddy_auth_user_v1';
let deferredInstallPrompt = null;
let currentAuthUser = null;
let currentAuthProfile = null;
let cachedAuthUser = null;
try {
  const savedUser = localStorage.getItem(AUTH_STORAGE_KEY);
  if (savedUser) {
    const parsed = JSON.parse(savedUser);
    if (parsed && (parsed.uid || parsed.signedIn)) {
      cachedAuthUser = parsed;
    }
  }
} catch (e) {}
let lastResendVerificationTime = 0;'''

assert old_auth_block in js, "old_auth_block not found in app.js"
js = js.replace(old_auth_block, new_auth_block, 1)

# 2c. Replace getAuthUser and saveAuthUser
old_get_save = '''function getAuthUser() {
  if (!currentAuthUser) return null;
  const prof = currentAuthProfile || getUserProfile();
  const providerIds = (currentAuthUser.providerData || []).map(p => p.providerId);
  const isGoogle = providerIds.includes('google.com');
  const isPassword = providerIds.includes('password');

  return {
    signedIn: true,
    uid: currentAuthUser.uid,
    name: currentAuthUser.displayName || prof.handle || 'Punter',
    email: currentAuthUser.email || '',
    handle: prof.handle || 'Punter',
    emailVerified: Boolean(currentAuthUser.emailVerified || isGoogle),
    isGoogle,
    isPassword
  };
}

function saveAuthUser(user) {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {}
  updateHeaderAuthUI();
}'''

new_get_save = '''function getAuthUser() {
  const activeUser = currentAuthUser || cachedAuthUser;
  if (!activeUser) return null;
  const prof = currentAuthProfile || getUserProfile();
  const providerIds = (activeUser.providerData || []).map(p => p.providerId);
  const isGoogle = providerIds.includes('google.com') || activeUser.isGoogle || activeUser.providerId === 'google.com';
  const isPassword = providerIds.includes('password') || activeUser.isPassword;

  // Derive display username: custom handle > Google name > email username
  let username = (currentAuthProfile && currentAuthProfile.handle) ||
                 (cachedAuthUser && cachedAuthUser.handle && !cachedAuthUser.handle.startsWith('Punter_') ? cachedAuthUser.handle : '') ||
                 (prof && prof.handle && !prof.handle.startsWith('Punter_') ? prof.handle : '') ||
                 activeUser.displayName ||
                 activeUser.name ||
                 (activeUser.email ? activeUser.email.split('@')[0] : 'Punter');

  username = String(username).replace(/^@+/, '').trim() || 'Punter';

  return {
    signedIn: true,
    uid: activeUser.uid,
    name: activeUser.displayName || activeUser.name || username,
    email: activeUser.email || '',
    handle: username,
    photoURL: activeUser.photoURL || '',
    emailVerified: Boolean(activeUser.emailVerified || isGoogle),
    isGoogle,
    isPassword
  };
}

function saveAuthUser(user) {
  if (!user) {
    cachedAuthUser = null;
    try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (e) {}
    updateHeaderAuthUI();
    return;
  }
  const prof = currentAuthProfile || getUserProfile();
  const username = (currentAuthProfile && currentAuthProfile.handle) ||
                   (prof && prof.handle && !prof.handle.startsWith('Punter_') ? prof.handle : '') ||
                   user.displayName ||
                   (user.email ? user.email.split('@')[0] : 'Punter');
  cachedAuthUser = {
    signedIn: true,
    uid: user.uid,
    displayName: user.displayName || username,
    name: user.displayName || username,
    email: user.email || '',
    handle: String(username).replace(/^@+/, ''),
    photoURL: user.photoURL || '',
    isGoogle: true
  };
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(cachedAuthUser));
  } catch (e) {}
  updateHeaderAuthUI();
}'''

assert old_get_save in js, "old_get_save not found in app.js"
js = js.replace(old_get_save, new_get_save, 1)

# 2d. ensureUserProfile: auto set handle and persist profile
old_ensure = '''async function ensureUserProfile(user) {
  if (!firestoreDb || !user) return;
  try {
    const userDocRef = firestoreDb.collection('users').doc(user.uid);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      currentAuthProfile = userDoc.data();
      const cur = getUserProfile();
      saveUserProfile(currentAuthProfile.handle || cur.handle, cur.town, cur.region, cur.country);
      return;
    }

    // Clean-slate / user doc wiped: clear stale profile and send cleanly to handle-creation
    currentAuthProfile = null;
    let baseHandle = (user.displayName || (user.email ? user.email.split('@')[0] : 'Punter'))
      .replace(/[^A-Za-z0-9_]/g, '');
    if (baseHandle.length < 3) baseHandle = 'Punter_' + baseHandle;
    if (baseHandle.length > 16) baseHandle = baseHandle.slice(0, 16);

    if ($('player-handle-input')) $('player-handle-input').value = baseHandle;
    const modal = $('handle-modal');
    if (modal) modal.hidden = false;
    toast('Welcome to Bet Buddy! Please confirm your gamertag.');
  } catch (e) {
    console.warn('ensureUserProfile notice:', e);
  }
}'''

new_ensure = '''async function ensureUserProfile(user) {
  if (!user) return;
  try {
    let baseHandle = (user.displayName || (user.email ? user.email.split('@')[0] : 'Punter'))
      .replace(/[^A-Za-z0-9_]/g, '');
    if (baseHandle.length < 3) baseHandle = 'Punter_' + baseHandle;
    if (baseHandle.length > 20) baseHandle = baseHandle.slice(0, 20);

    if (firestoreDb) {
      const userDocRef = firestoreDb.collection('users').doc(user.uid);
      const userDoc = await userDocRef.get();
      if (userDoc.exists) {
        currentAuthProfile = userDoc.data();
        const cur = getUserProfile();
        saveUserProfile(currentAuthProfile.handle || cur.handle, cur.town, cur.region, cur.country);
        saveAuthUser(user);
        return;
      }
      const initialProfile = {
        uid: user.uid,
        handle: baseHandle,
        name: user.displayName || baseHandle,
        email: user.email || '',
        avatar: '⚽',
        createdAt: new Date().toISOString()
      };
      await userDocRef.set(initialProfile, { merge: true });
      currentAuthProfile = initialProfile;
      saveUserProfile(baseHandle);
      saveAuthUser(user);
    } else {
      saveUserProfile(baseHandle);
      saveAuthUser(user);
    }
  } catch (e) {
    console.warn('ensureUserProfile notice:', e);
  }
}'''

assert old_ensure in js, "old_ensure not found in app.js"
js = js.replace(old_ensure, new_ensure, 1)

# 2e. updateHeaderAuthUI
old_header_auth = '''function updateHeaderAuthUI() {
  const container = $('header-auth-container');
  if (!container) return;
  const user = getAuthUser();
  if (user && user.signedIn) {
    const initials = (user.name || user.email || 'U').slice(0, 1).toUpperCase();
    container.innerHTML = '<div style="display:flex;align-items:center;gap:6px;">' +
      '<button type="button" class="header-user-btn" id="header-user-btn" title="Signed in as ' + esc(user.name || user.email) + '">' +
        '<span class="header-avatar">' + esc(initials) + '</span>' +
        '<span>@' + esc(user.handle || 'Punter') + '</span>' +
        
      '</button>' +
      '<button type="button" class="btn small" id="btn-quick-signout" title="Sign Out of account" style="min-height:32px;padding:2px 8px;font-size:11px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);color:#fca5a5;">Sign Out</button>' +
    '</div>';
  } else {
    container.innerHTML = '<button type="button" class="google-sub-btn" id="header-auth-btn" title="Sign in or join">' +
      '<svg class="google-g" viewBox="0 0 24 24" width="13" height="13"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>' +
      '<span>Sign In / Join</span></button>';
  }
}'''

new_header_auth = '''function updateHeaderAuthUI() {
  const container = $('header-auth-container');
  if (!container) return;
  const user = getAuthUser();
  if (user && user.signedIn) {
    const initials = (user.name || user.email || 'U').slice(0, 1).toUpperCase();
    const username = user.handle || user.name || 'Punter';
    container.innerHTML = '<div style="display:flex;align-items:center;gap:6px;">' +
      '<button type="button" class="header-user-btn" id="header-user-btn" title="Signed in as ' + esc(user.name || user.email) + '">' +
        '<span class="header-avatar">' + esc(initials) + '</span>' +
        '<span class="header-username">@' + esc(username) + '</span>' +
      '</button>' +
      '<button type="button" class="btn small" id="btn-quick-signout" title="Sign Out of account" style="min-height:32px;padding:2px 8px;font-size:11px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);color:#fca5a5;">Sign Out</button>' +
    '</div>';
  } else {
    container.innerHTML = '<button type="button" class="google-sub-btn" id="header-auth-btn" title="Sign In / Join">' +
      '<svg class="google-g" viewBox="0 0 24 24" width="13" height="13"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>' +
      '<span>Sign In / Join</span></button>';
  }
}'''

assert old_header_auth in js, "old_header_auth not found in app.js"
js = js.replace(old_header_auth, new_header_auth, 1)

# 2f. handleSignOut and initFirebaseAuth
old_signout_init = '''async function handleSignOut() {
  if (firebaseAuth) {
    try {
      await firebaseAuth.signOut();
    } catch (e) {}
  }
  currentAuthUser = null;
  currentAuthProfile = null;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {}
  closeAuthModal();
  toast('Signed out.');
  updateHeaderAuthUI();
  render();
}

function initFirebaseAuth() {
  if (!firebaseAuth) return;

  firebaseAuth.getRedirectResult().then(result => {
    if (result && result.user) {
      toast('Signed in with Google! ⚽');
    }
  }).catch(err => {
    console.warn('Redirect sign-in notice:', err);
    toast(mapAuthError(err));
  });

  firebaseAuth.onAuthStateChanged(async user => {
    currentAuthUser = user;
    if (user) {
      try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (e) {}
      await ensureUserProfile(user);
      hasSyncedUserLeagues = false;
      await syncUserLeaguesFromCloud();
      try { await syncDiaryFromCloud(); } catch (e) {}

      // Preserve pending league invite across sign-in popup/redirect
      const pendingLeague = sessionStorage.getItem('betbuddy_pending_join_league');
      if (pendingLeague) {
        sessionStorage.removeItem('betbuddy_pending_join_league');
        setTimeout(() => { joinCloudLeague(pendingLeague); }, 600);
      }
    } else {
      currentAuthProfile = null;
      try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (e) {}
    }
    updateHeaderAuthUI();
    render();
  });
}'''

new_signout_init = '''async function handleSignOut() {
  if (firebaseAuth) {
    try {
      await firebaseAuth.signOut();
    } catch (e) {}
  }
  currentAuthUser = null;
  currentAuthProfile = null;
  cachedAuthUser = null;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {}
  closeAuthModal();
  toast('Signed out.');
  updateHeaderAuthUI();
  render();
}

function initFirebaseAuth() {
  if (!firebaseAuth) return;

  try {
    if (firebase.auth && firebase.auth.Auth && firebase.auth.Auth.Persistence) {
      firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(e) {
        console.warn('Firebase setPersistence notice:', e);
      });
    }
  } catch (e) {}

  firebaseAuth.getRedirectResult().then(result => {
    if (result && result.user) {
      saveAuthUser(result.user);
      toast('Signed in with Google! ⚽');
    }
  }).catch(err => {
    console.warn('Redirect sign-in notice:', err);
    toast(mapAuthError(err));
  });

  firebaseAuth.onAuthStateChanged(async user => {
    currentAuthUser = user;
    if (user) {
      saveAuthUser(user);
      await ensureUserProfile(user);
      hasSyncedUserLeagues = false;
      await syncUserLeaguesFromCloud();
      try { await syncDiaryFromCloud(); } catch (e) {}

      // Preserve pending league invite across sign-in popup/redirect
      const pendingLeague = sessionStorage.getItem('betbuddy_pending_join_league');
      if (pendingLeague) {
        sessionStorage.removeItem('betbuddy_pending_join_league');
        setTimeout(() => { joinCloudLeague(pendingLeague); }, 600);
      }
    } else {
      currentAuthUser = null;
      currentAuthProfile = null;
      cachedAuthUser = null;
      try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (e) {}
    }
    updateHeaderAuthUI();
    render();
  });
}'''

assert old_signout_init in js, "old_signout_init not found in app.js"
js = js.replace(old_signout_init, new_signout_init, 1)

# 2g. In renderWelcomeHero: ensure user's real name or handle is used
old_hero_name = '''  const user = getAuthUser();
  const userName = user && user.displayName ? user.displayName.split(' ')[0] : 'Punter';'''

new_hero_name = '''  const user = getAuthUser();
  const userName = user && user.signedIn ? (user.handle || user.name || 'Punter').replace(/^@+/, '').split(' ')[0] : 'Punter';'''

assert old_hero_name in js, "old_hero_name not found in app.js"
js = js.replace(old_hero_name, new_hero_name, 1)

# 2h. Version bump to v72
js = re.sub(r"const APP_VERSION = 'v\d+';", "const APP_VERSION = 'v72';", js)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)
print("Updated app.js with persistent auth, cached user on startup, and dynamic username in header.")

# 3. Patch sw.js cache name
with open('sw.js', 'r', encoding='utf-8') as f:
    sw = f.read()

sw = re.sub(r"const CACHE_NAME = 'betbuddy-pwa-v\d+';", "const CACHE_NAME = 'betbuddy-pwa-v72';", sw)

with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(sw)
print("Updated sw.js to v72.")

