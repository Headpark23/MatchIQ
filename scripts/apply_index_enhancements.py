import re
from pathlib import Path

index_p = Path("index.html")
html = index_p.read_text(encoding="utf-8")

# 1. Add Service Worker update banner right after <body>
if 'id="sw-update-banner"' not in html:
    banner_html = """  <!-- PWA Service Worker Update Available Banner -->
  <div id="sw-update-banner" class="sw-update-banner" hidden>
    <div class="sw-update-content">
      <span class="sw-update-icon">⚡</span>
      <span>New Bet Buddy update available!</span>
    </div>
    <button type="button" id="btn-sw-reload" class="btn small primary">Tap to Reload</button>
  </div>
"""
    html = re.sub(r"(<body[^>]*>)", r"\1\n" + banner_html, html)

# 2. Put Google button first in Account & Sync modal
old_auth_body = """    <div class="modal-body auth-modal-body">
      <div class="auth-benefits-grid">
        <div class="auth-benefit-item"><span class="benefit-icon">🏆</span><div><strong>Buddy Leagues &amp; Custom Gamertag</strong><span>Create private leagues &amp; compete with friends on pure Win Rate %.</span></div></div>
        <div class="auth-benefit-item"><span class="benefit-icon">📈</span><div><strong>Personal Analytics &amp; Diary</strong><span>Verified stats tracking and local bet diary analysis.</span></div></div>
        <div class="auth-benefit-item"><span class="benefit-icon">🔄</span><div><strong>Cross-Device League Sync</strong><span>Real-time cloud synchronization for your mini-leagues.</span></div></div>
        <div class="auth-benefit-item"><span class="benefit-icon">🛡️</span><div><strong>18+ Adult Gaming Intelligence</strong><span>Strictly adult 18+ betting intelligence &amp; responsible play.</span></div></div>
      </div>

      <!-- State 1: Sign In -->
      <div id="auth-signin-view">
        <button type="button" class="btn google-primary-btn full-width" id="btn-auth-google" style="margin-top:0;">
          <svg class="google-g" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          <span>Continue with Google</span>
        </button>

        <div class="auth-divider"><span>or with email</span></div>"""

new_auth_body = """    <div class="modal-body auth-modal-body">
      <!-- State 1: Sign In (Google Button Above the Fold) -->
      <div id="auth-signin-view">
        <button type="button" class="btn google-primary-btn full-width" id="btn-auth-google" style="margin-top:0;min-height:48px;">
          <svg class="google-g" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          <span>Continue with Google</span>
        </button>

        <div class="auth-divider"><span>or with email</span></div>"""

if old_auth_body in html:
    # Also move benefits grid to below sign in form
    html = html.replace(old_auth_body, new_auth_body)
    # Append benefits grid below form
    benefits_code = """        <div class="auth-benefits-grid" style="margin-top:16px;">
          <div class="auth-benefit-item"><span class="benefit-icon">🏆</span><div><strong>Buddy Leagues &amp; Custom Gamertag</strong><span>Create private leagues &amp; compete with friends on pure Win Rate %.</span></div></div>
          <div class="auth-benefit-item"><span class="benefit-icon">📈</span><div><strong>Personal Analytics &amp; Diary</strong><span>Verified stats tracking and local bet diary analysis.</span></div></div>
          <div class="auth-benefit-item"><span class="benefit-icon">🔄</span><div><strong>Cross-Device League Sync</strong><span>Real-time cloud synchronization for your mini-leagues.</span></div></div>
          <div class="auth-benefit-item"><span class="benefit-icon">🛡️</span><div><strong>18+ Adult Gaming Intelligence</strong><span>Strictly adult 18+ betting intelligence &amp; responsible play.</span></div></div>
        </div>"""
    html = html.replace('<p class="section-note" style="margin-top:12px;text-align:center">Optional &amp; Free. Anonymous use continues supported for match intelligence.</p>', benefits_code + '\n        <p class="section-note" style="margin-top:12px;text-align:center">Optional &amp; Free. Anonymous use continues supported for match intelligence.</p>')
    print("Reordered auth modal: Google button first")

# 3. Visible Version Number in footer
html = re.sub(
    r"<span>&copy; Copyright Martin White and Chris Faulds 2026\. All rights reserved\.</span>",
    '<span>&copy; 2026 Bet Buddy <b id="footer-app-version" style="color:var(--cyan)">v61</b> &middot; Martin White &amp; Chris Faulds</span>',
    html
)

index_p.write_text(html, encoding="utf-8")
print("index.html updated successfully")

