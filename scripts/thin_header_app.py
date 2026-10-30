with open('app.js', 'r', encoding='utf-8') as f:
    app_text = f.read()

# Update updateHeaderAuthUI to render inside sub-header
old_update_fn = '''function updateHeaderAuthUI() {
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
}'''

new_update_fn = '''function updateHeaderAuthUI() {
  const container = $('header-auth-container');
  if (!container) return;
  const user = getAuthUser();
  if (user && user.signedIn) {
    const initials = (user.name || user.email || 'U').slice(0, 1).toUpperCase();
    container.innerHTML = '<button type="button" class="header-user-btn" id="header-user-btn" title="Signed in as ' + esc(user.name || user.email) + '">' +
      '<span class="header-avatar">' + esc(initials) + '</span>' +
      '<span>@' + esc(user.handle || (user.name || 'Buddy').split(' ')[0]) + '</span></button>';
  } else {
    container.innerHTML = '<button type="button" class="google-sub-btn" id="header-auth-btn" title="Sign in with Google">' +
      '<svg class="google-g" viewBox="0 0 24 24" width="13" height="13"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>' +
      '<span>Sign in with Google</span></button>';
  }
}'''

assert old_update_fn in app_text, 'old_update_fn not found in app.js'
app_text = app_text.replace(old_update_fn, new_update_fn)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_text)

print('Updated app.js updateHeaderAuthUI for sub-header bar')

