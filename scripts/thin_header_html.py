with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Update header in index.html:
# Remove header-auth-container from header-tools.
# Slim down pwa-install-btn: icon only or short label "App" on mobile.
old_header = '''<header class="app-header">
  <div class="app-header-inner">
    <a class="brand" href="#/" aria-label="Bet Buddy home">
      <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="5.5" cy="6" r="3.2" fill="#04140d"/><circle cx="18.5" cy="6" r="3.2" fill="#04140d"/><circle cx="5.5" cy="6" r="1.3" fill="#a7f3d0"/><circle cx="18.5" cy="6" r="1.3" fill="#a7f3d0"/><circle cx="12" cy="13.2" r="7.8" fill="#ffffff"/><ellipse cx="8.8" cy="12.6" rx="2.2" ry="2.9" fill="#04140d" transform="rotate(-15 8.8 12.6)"/><ellipse cx="15.2" cy="12.6" rx="2.2" ry="2.9" fill="#04140d" transform="rotate(15 15.2 12.6)"/><circle cx="8.6" cy="12" r="0.8" fill="#a7f3d0"/><circle cx="15.4" cy="12" r="0.8" fill="#a7f3d0"/><ellipse cx="12" cy="15.2" rx="1.3" ry="0.9" fill="#04140d"/><path d="M10.7 16.5c.7.5 1.9.5 2.6 0" fill="none" stroke="#04140d" stroke-width="0.8" stroke-linecap="round"/></svg></span>
      <span class="brand-word">Bet<b>Buddy</b></span>
    </a>
    <div class="header-tools">
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
    </div>
    <nav class="nav" aria-label="Main">'''

new_header = '''<header class="app-header">
  <div class="app-header-inner">
    <a class="brand" href="#/" aria-label="Bet Buddy home">
      <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="5.5" cy="6" r="3.2" fill="#04140d"/><circle cx="18.5" cy="6" r="3.2" fill="#04140d"/><circle cx="5.5" cy="6" r="1.3" fill="#a7f3d0"/><circle cx="18.5" cy="6" r="1.3" fill="#a7f3d0"/><circle cx="12" cy="13.2" r="7.8" fill="#ffffff"/><ellipse cx="8.8" cy="12.6" rx="2.2" ry="2.9" fill="#04140d" transform="rotate(-15 8.8 12.6)"/><ellipse cx="15.2" cy="12.6" rx="2.2" ry="2.9" fill="#04140d" transform="rotate(15 15.2 12.6)"/><circle cx="8.6" cy="12" r="0.8" fill="#a7f3d0"/><circle cx="15.4" cy="12" r="0.8" fill="#a7f3d0"/><ellipse cx="12" cy="15.2" rx="1.3" ry="0.9" fill="#04140d"/><path d="M10.7 16.5c.7.5 1.9.5 2.6 0" fill="none" stroke="#04140d" stroke-width="0.8" stroke-linecap="round"/></svg></span>
      <span class="brand-word">Bet<b>Buddy</b></span>
    </a>
    <div class="header-tools">
      <button type="button" class="odds-toggle" id="odds-toggle" aria-label="Toggle odds format" title="Switch between Fractional (6/4) and Decimal (2.50) odds" data-active-mode="fractional"><span class="odds-segment" data-seg="fractional">6/4</span><span class="odds-segment" data-seg="decimal">2.50</span><span class="sr-only" id="odds-mode-val">Fractional</span></button>
      <button type="button" class="pwa-install-btn" id="header-install-btn" title="Download Bet Buddy to home screen" aria-label="Install App">
        <svg class="install-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span class="install-label">Install</span>
      </button>
    </div>
    <nav class="nav" aria-label="Main">'''

assert old_header in html, 'old_header not found in index.html'
html = html.replace(old_header, new_header)

# 2. Add slim sub-header banner right below header, before <main>
sub_header_strip = '''</header>

<div class="sub-header-bar" id="sub-header-bar">
  <div class="sub-header-inner">
    <div class="sub-header-left">
      <span class="badge-dot-live"></span>
      <span class="sub-header-tagline">Premier League Intelligence · Private Bet Diary</span>
    </div>
    <div id="header-auth-container" class="sub-header-auth-wrap">
      <button type="button" class="google-sub-btn" id="header-auth-btn" title="Sign in with Google">
        <svg class="google-g" viewBox="0 0 24 24" width="13" height="13"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
        <span>Sign in with Google</span>
      </button>
    </div>
  </div>
</div>'''

html = html.replace('</header>', sub_header_strip)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Updated index.html: Slim header and sub-header auth bar')

