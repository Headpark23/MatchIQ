#!/usr/bin/env python3
import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add firebase-auth-compat.js
sdk_target = '<script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>'
sdk_replacement = '<script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>\n<script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js"></script>'

if 'firebase-auth-compat.js' not in html:
    assert sdk_target in html, "Could not find firebase-app-compat.js in index.html"
    html = html.replace(sdk_target, sdk_replacement, 1)
    print("Added firebase-auth-compat.js script tag")

# 2. Replace #google-auth-modal markup
auth_modal_pattern = re.compile(r'<!-- Google Sign-In Modal -->\s*<div class="modal-backdrop" id="google-auth-modal" hidden>.*?<!-- Mobile & Desktop Install Guide Modal -->', re.DOTALL)

new_auth_modal = '''<!-- Google & Email Firebase Auth Modal -->
<div class="modal-backdrop" id="google-auth-modal" hidden>
  <div class="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="google-auth-title">
    <div class="modal-head">
      <div class="auth-modal-brand">
        <svg class="google-g" viewBox="0 0 24 24" width="22" height="22"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
        <h2 id="google-auth-title">Account &amp; Sync</h2>
      </div>
      <button type="button" class="icon-btn" data-close-auth aria-label="Close">&times;</button>
    </div>
    <div class="modal-body auth-modal-body">
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

        <div class="auth-divider"><span>or with email</span></div>

        <form id="auth-signin-form" class="auth-flow-card">
          <div class="field">
            <label for="signin-email">Account Email</label>
            <input id="signin-email" type="email" class="ctl" autocomplete="email" placeholder="name@example.com" required>
          </div>
          <div class="field" style="margin-top:10px;">
            <label for="signin-password">Password</label>
            <input id="signin-password" type="password" class="ctl" autocomplete="current-password" placeholder="••••••••" required>
          </div>
          <div id="signin-error" class="auth-error-box" role="alert" aria-live="polite" hidden></div>
          <button type="submit" class="btn primary full-width" id="btn-submit-signin" style="margin-top:12px;">Sign In</button>
          <div class="auth-nav-row">
            <button type="button" class="text-link" id="link-to-forgot">Forgot password?</button>
            <button type="button" class="text-link" id="link-to-register">Need an account? Sign up</button>
          </div>
        </form>
        <p class="section-note" style="margin-top:12px;text-align:center">Optional &amp; Free. Anonymous use continues supported for match intelligence.</p>
      </div>

      <!-- State 2: Create Account -->
      <div id="auth-register-view" hidden>
        <form id="auth-register-form" class="auth-flow-card">
          <h3 style="margin:0 0 12px;font-size:15px;color:#fff;">Create Your Account</h3>
          <div class="field">
            <label for="register-handle">Choose your unique Gamertag / Handle</label>
            <input id="register-handle" class="ctl" maxlength="20" placeholder="e.g. Liam_Punter" required>
            <span class="field-hint" style="font-size:11px;color:#94a3b8;display:block;margin-top:3px;">3–20 letters, numbers, or underscores. Shown on leaderboards.</span>
          </div>
          <div class="field" style="margin-top:10px;">
            <label for="register-email">Email Address</label>
            <input id="register-email" type="email" class="ctl" autocomplete="email" placeholder="name@example.com" required>
          </div>
          <div class="field" style="margin-top:10px;">
            <label for="register-password">Password (min 8 characters)</label>
            <input id="register-password" type="password" class="ctl" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" required>
          </div>
          <div class="auth-checkbox-row">
            <input type="checkbox" id="register-age-check" required>
            <label for="register-age-check">I confirm I am 18+ years of age. I agree to the <button type="button" class="inline-link-btn" id="btn-auth-open-gdpr">Privacy Notice</button> and to gamble responsibly (<a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" style="color:#38bdf8;">BeGambleAware.org</a>).</label>
          </div>
          <div id="register-error" class="auth-error-box" role="alert" aria-live="polite" hidden></div>
          <button type="submit" class="btn primary full-width" id="btn-submit-register" style="margin-top:12px;">Create Account &amp; Verify Email</button>
          <div style="margin-top:12px;text-align:center;">
            <button type="button" class="text-link" id="link-to-signin">Already have an account? Sign in</button>
          </div>
        </form>
      </div>

      <!-- State 3: Email Verification Pending -->
      <div id="auth-verify-view" hidden>
        <div class="auth-flow-card" style="text-align:center;padding:20px 16px;">
          <div style="font-size:36px;margin-bottom:8px;">📧</div>
          <h3 style="margin:0 0 8px;font-size:16px;color:#fff;">Verify Your Email</h3>
          <p style="font-size:13.5px;color:#cbd5e1;line-height:1.45;margin-bottom:16px;">
            We've sent a verification link to <strong id="verify-email-display" style="color:#38bdf8;">your email</strong>. Please open your email and tap the verification link.
          </p>
          <button type="button" class="btn primary full-width" id="btn-check-verified" style="margin-bottom:10px;">✓ I've Verified My Email</button>
          <button type="button" class="btn secondary full-width" id="btn-resend-verification">Resend Verification Email</button>
          <div id="verify-resend-status" class="text-sm muted" style="margin-top:10px;" aria-live="polite"></div>
          <div style="margin-top:14px;">
            <button type="button" class="text-link" id="link-verify-to-signin">Back to Sign In</button>
          </div>
        </div>
      </div>

      <!-- State 4: Forgot Password -->
      <div id="auth-forgot-view" hidden>
        <form id="auth-forgot-form" class="auth-flow-card">
          <h3 style="margin:0 0 8px;font-size:15px;color:#fff;">Reset Your Password</h3>
          <p class="muted text-sm" style="margin-bottom:12px;">Enter your registered account email. If an account exists, we will send a password reset link.</p>
          <div class="field">
            <label for="forgot-email">Account Email</label>
            <input id="forgot-email" type="email" class="ctl" autocomplete="email" placeholder="name@example.com" required>
          </div>
          <div id="forgot-msg" class="auth-info-box" role="alert" aria-live="polite" hidden></div>
          <button type="submit" class="btn primary full-width" style="margin-top:12px;">Send Password Reset Link</button>
          <div style="margin-top:14px;text-align:center;">
            <button type="button" class="text-link" id="link-forgot-to-signin">Back to Sign In</button>
          </div>
        </form>
      </div>

      <!-- State 5: Authenticated Profile View -->
      <div id="auth-authed-view" hidden>
        <div class="signed-in-profile">
          <div class="profile-avatar-large" id="modal-avatar-initials">B</div>
          <div class="profile-details">
            <strong id="modal-auth-name">User</strong>
            <span id="modal-auth-email" class="muted mono">user@gmail.com</span>
            <span class="badge-status-green" id="modal-auth-badge">Verified Account</span>
          </div>
        </div>

        <div id="modal-unverified-warning" class="auth-warning-box" hidden>
          <div>⚠️ <strong>Email not yet verified.</strong> Please verify your email to create or join private Buddy Leagues.</div>
          <button type="button" class="btn small primary" id="btn-profile-resend-verify" style="margin-top:8px;">Resend Verification Link</button>
        </div>

        <div id="profile-password-section" class="auth-flow-card" style="margin-top:14px;" hidden>
          <h4 style="margin:0 0 10px;font-size:13.5px;color:#fff;">Change Password</h4>
          <form id="profile-change-password-form">
            <input type="password" id="change-current-pass" class="ctl" placeholder="Current password" required style="margin-bottom:8px;">
            <input type="password" id="change-new-pass" class="ctl" placeholder="New password (min 8 chars)" minlength="8" required style="margin-bottom:8px;">
            <div id="change-pass-error" class="auth-error-box" role="alert" aria-live="polite" hidden></div>
            <button type="submit" class="btn small secondary">Update Password</button>
          </form>
        </div>

        <div id="profile-google-note" class="muted text-sm" style="margin-top:12px;padding:8px 12px;background:rgba(255,255,255,0.02);border-radius:8px;" hidden>
          🔒 Password and security are managed directly by your Google account.
        </div>

        <div class="profile-actions" style="margin-top:18px;display:flex;flex-direction:column;gap:10px">
          <button type="button" class="btn secondary full-width" id="btn-switch-handle">Change Gamertag / Location</button>
          <button type="button" class="btn danger full-width" id="btn-signout">Sign Out</button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Mobile & Desktop Install Guide Modal -->'''

match = auth_modal_pattern.search(html)
assert match is not None, "Could not match #google-auth-modal in index.html"
html = auth_modal_pattern.sub(new_auth_modal, html)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated index.html with new auth modal and SDK tags successfully.")

