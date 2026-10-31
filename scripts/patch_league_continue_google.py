import re

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Update viewLeagues signed-in check
old_view_leagues_banner = '''function viewLeagues() {
  const prof = getUserProfile();
  const authUser = getAuthUser();
  const signedOutBanner = (!authUser || !authUser.signedIn)'''

new_view_leagues_banner = '''function viewLeagues() {
  const prof = getUserProfile();
  const authUser = getAuthUser();
  const isUserSignedIn = Boolean(authUser && authUser.signedIn);
  const signedOutBanner = !isUserSignedIn'''

assert old_view_leagues_banner in js, "old_view_leagues_banner not found in app.js"
js = js.replace(old_view_leagues_banner, new_view_leagues_banner, 1)

# 2. Update signInWithGoogle to immediately save user and render
old_sign_in = '''    await firebaseAuth.signInWithPopup(provider);
    closeAuthModal();
    toast('Signed in with Google! ⚽');'''

new_sign_in = '''    const cred = await firebaseAuth.signInWithPopup(provider);
    if (cred && cred.user) {
      saveAuthUser(cred.user);
    }
    closeAuthModal();
    toast('Signed in with Google! ⚽');
    updateHeaderAuthUI();
    render();'''

assert old_sign_in in js, "old_sign_in not found in app.js"
js = js.replace(old_sign_in, new_sign_in, 1)

# 3. Update onAuthStateChanged to immediately render upon receiving user
old_auth_changed = '''  firebaseAuth.onAuthStateChanged(async user => {
    currentAuthUser = user;
    if (user) {
      saveAuthUser(user);
      await ensureUserProfile(user);'''

new_auth_changed = '''  firebaseAuth.onAuthStateChanged(async user => {
    currentAuthUser = user;
    if (user) {
      saveAuthUser(user);
      updateHeaderAuthUI();
      render();
      await ensureUserProfile(user);'''

assert old_auth_changed in js, "old_auth_changed not found in app.js"
js = js.replace(old_auth_changed, new_auth_changed, 1)

# 4. Bump version to v73 in app.js
js = re.sub(r"const APP_VERSION = 'v\d+';", "const APP_VERSION = 'v73';", js)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)
print("Updated app.js for league tab continue with google removal & immediate reactivity.")

# 5. Bump index.html footer version
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()
html = re.sub(r"id=\"footer-app-version\" style=\"color:var\(--cyan\)\">v\d+<", 'id="footer-app-version" style="color:var(--cyan)">v73<', html)
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Updated index.html to v73.")

# 6. Bump sw.js cache version
with open('sw.js', 'r', encoding='utf-8') as f:
    sw = f.read()
sw = re.sub(r"const CACHE_NAME = 'betbuddy-pwa-v\d+';", "const CACHE_NAME = 'betbuddy-pwa-v73';", sw)
with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(sw)
print("Updated sw.js to v73.")

