# Patch index.html
with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

target_tools = '<div class="header-tools">'
assert target_tools in content, 'target_tools not found'

header_replacement = '''    <div class="header-tools">
      <button type="button" class="odds-toggle" id="odds-toggle" aria-label="Toggle odds format" title="Switch between Fractional (6/4) and Decimal (2.50) odds" data-active-mode="fractional"><span class="odds-segment" data-seg="fractional">6/4</span><span class="odds-segment" data-seg="decimal">2.50</span><span class="sr-only" id="odds-mode-val">Fractional</span></button>
      <button type="button" class="btn small pwa-install-btn" id="header-install-btn" title="Download Bet Buddy to home screen" aria-label="Install App">
        <svg class="install-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Install App</span>
      </button>
      <div id="header-auth-container" class="header-auth-wrap">
        <button type="button" class="btn small google-btn" id="header-auth-btn" title="Sign in with Google">
          <svg class="google-g" viewBox="0 0 24 24" width="14" height="14"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          <span>Sign In</span>
        </button>
      </div>
    </div>'''

import re
content = re.sub(r'    <div class="header-tools">.*?</div>', header_replacement, content, flags=re.DOTALL)

modals = '''
<!-- Google Sign-In Modal -->
<div class="modal-backdrop" id="google-auth-modal" hidden>
  <div class="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="google-auth-title">
    <div class="modal-head">
      <div class="auth-modal-brand">
        <svg class="google-g" viewBox="0 0 24 24" width="22" height="22"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
        <h2 id="google-auth-title">Sign in with Google</h2>
      </div>
      <button type="button" class="icon-btn" data-close-auth aria-label="Close">&times;</button>
    </div>
    <div class="modal-body auth-modal-body">
      <p class="auth-sub">Connect your Google account to sync your Bet Diary, custom picks, and Buddy League rankings across all your phones and computers.</p>
      <div id="auth-unauthed-view">
        <form id="google-quick-signin-form" class="auth-flow-card">
          <div class="field">
            <label for="google-display-name">Choose your Display Name / Nickname</label>
            <input id="google-display-name" class="ctl" placeholder="e.g. Liam Smith" maxlength="32" required>
          </div>
          <div class="field">
            <label for="google-email-input">Google Account Email</label>
            <input id="google-email-input" type="email" class="ctl" placeholder="name@gmail.com" required>
          </div>
          <button type="submit" class="btn google-primary-btn full-width">
            <svg class="google-g" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
            <span>Continue with Google</span>
          </button>
        </form>
        <p class="section-note" style="margin-top:12px;text-align:center">Optional &amp; Free. No password needed. You can also continue using Bet Buddy 100% anonymously.</p>
      </div>
      <div id="auth-authed-view" hidden>
        <div class="signed-in-profile">
          <div class="profile-avatar-large" id="modal-avatar-initials">G</div>
          <div class="profile-details">
            <strong id="modal-auth-name">User</strong>
            <span id="modal-auth-email" class="muted mono">user@gmail.com</span>
            <span class="badge-status-green">Google Connected</span>
          </div>
        </div>
        <div class="profile-actions" style="margin-top:20px;display:flex;gap:10px">
          <button type="button" class="btn secondary full-width" id="btn-switch-handle">Change Buddy Name</button>
          <button type="button" class="btn danger full-width" id="btn-google-signout">Sign Out</button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Mobile & Desktop Install Guide Modal -->
<div class="modal-backdrop" id="install-modal" hidden>
  <div class="modal install-modal-box" role="dialog" aria-modal="true" aria-labelledby="install-modal-title">
    <div class="modal-head">
      <div class="install-head-badge">
        <img src="assets/icon-192.png" alt="Bet Buddy Panda Football Icon" width="38" height="38" class="install-logo-thumb">
        <div>
          <h2 id="install-modal-title" style="margin:0;font-size:1.15rem">Download Bet Buddy</h2>
          <span class="text-sm muted">Fast, offline-ready &amp; zero app store hassle</span>
        </div>
      </div>
      <button type="button" class="icon-btn" data-close-install aria-label="Close">&times;</button>
    </div>
    <div class="modal-body" id="install-modal-content">
      <!-- Dynamically filled with iOS guide or Native prompt trigger -->
    </div>
  </div>
</div>
'''

if 'id="google-auth-modal"' not in content:
    content = content.replace('</body>', modals + '\n</body>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Patched index.html cleanly')
