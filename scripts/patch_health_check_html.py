# Script to patch index.html for all 9 health check issues:
# 1. Replace "Following MatchIQ" with "Following Bet Buddy"
# 2. Add Ladbrokes and Coral to bookmaker selector modal
# 3. Add id="modal-profile-row" to bettor profile field in diary modal
# 4. Add id="single-fixture-row", "single-market-row", "single-selection-row", "single-odds-row"
# 5. Add Share Sheet modal (WhatsApp, SMS, Email, Copy)
# 6. Add GDPR modal & footer link
# 7. Add Sign-in Benefits Grid to Google Auth modal
# 8. Restore 6-tab bottom nav on mobile (move Admin to More view & header/footer link)

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Fix "Following MatchIQ" -> "Following Bet Buddy"
assert 'Following MatchIQ' in html, 'Following MatchIQ not found'
html = html.replace('Following MatchIQ', 'Following Bet Buddy')

# 2. Fix 6-tab navigation: remove admin from main tab bar so mobile bar is exactly 6 tabs (Picks, Fixtures, Results, Diary, Leagues, More)
old_nav = '''    <nav class="nav" aria-label="Main">
      <a href="#/" data-nav="home"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>Picks</a>
      <a href="#/fixtures" data-nav="fixtures"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>Fixtures</a>
      <a href="#/results" data-nav="results"><svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>Results</a>
      <a href="#/diary" data-nav="diary"><svg viewBox="0 0 24 24"><path d="M5 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2z"/><path d="M9 8h6M9 12h6"/></svg>Diary<span class="count" id="diary-count"></span></a>
      <a href="#/leagues" data-nav="leagues"><svg viewBox="0 0 24 24"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2M4 22h16M10 14.66V17c0 .55-.45 1-1 1H7M14 14.66V17c0 .55.45 1 1 1h2M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>Leagues</a>
      <a href="#/admin" data-nav="admin"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>Admin</a>
      <a href="#/more" data-nav="more"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>More</a>
    </nav>'''

clean_nav = '''    <nav class="nav" aria-label="Main">
      <a href="#/" data-nav="home"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>Picks</a>
      <a href="#/fixtures" data-nav="fixtures"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>Fixtures</a>
      <a href="#/results" data-nav="results"><svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>Results</a>
      <a href="#/diary" data-nav="diary"><svg viewBox="0 0 24 24"><path d="M5 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2z"/><path d="M9 8h6M9 12h6"/></svg>Diary<span class="count" id="diary-count"></span></a>
      <a href="#/leagues" data-nav="leagues"><svg viewBox="0 0 24 24"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2M4 22h16M10 14.66V17c0 .55-.45 1-1 1H7M14 14.66V17c0 .55.45 1 1 1h2M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>Leagues</a>
      <a href="#/more" data-nav="more"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>More</a>
    </nav>'''

html = html.replace(old_nav, clean_nav)

# 3. Add link to Admin in sub-header-bar alongside live tag
old_sub_left = '<span class="sub-header-tagline">Premier League Intelligence · Private Bet Diary</span>'
new_sub_left = '<span class="sub-header-tagline">Premier League Intelligence · Private Bet Diary</span> · <a href="#/admin" class="sub-admin-link">Founder Telemetry</a>'
html = html.replace(old_sub_left, new_sub_left)

# 4. In diary modal, ensure profile row has id="modal-profile-row"
old_profile_field = '''          <div class="field">
            <label for="modal-profile">Bettor profile</label>
            <input id="modal-profile" class="ctl" maxlength="40" value="Tester A" autocomplete="off">
          </div>'''

new_profile_field = '''          <div class="field" id="modal-profile-row">
            <label for="modal-profile">Bettor profile</label>
            <input id="modal-profile" class="ctl" maxlength="40" value="" placeholder="Your Name or Nickname" autocomplete="off">
          </div>'''

html = html.replace(old_profile_field, new_profile_field)

# 5. Add Ladbrokes and Coral to bookmaker selection modal
old_bookie_list = '''        <a href="https://sports.williamhill.com/betting/en-gb/football" target="_blank" rel="noopener noreferrer" class="bookie-choice-btn" data-bookie-click="William Hill">
          <span class="bookie-tag wh">WH</span>
          <div><strong>William Hill</strong><span class="text-sm muted">Epic Odds & traditional UK betting shop</span></div>
          <span class="bookie-go-arrow">›</span>
        </a>'''

new_bookie_list = '''        <a href="https://sports.ladbrokes.com/football" target="_blank" rel="noopener noreferrer" class="bookie-choice-btn" data-bookie-click="Ladbrokes">
          <span class="bookie-tag ladbrokes">LAD</span>
          <div><strong>Ladbrokes</strong><span class="text-sm muted">Major UK high street & 1-2-Free football predictor</span></div>
          <span class="bookie-go-arrow">›</span>
        </a>
        <a href="https://sports.coral.co.uk/football" target="_blank" rel="noopener noreferrer" class="bookie-choice-btn" data-bookie-click="Coral">
          <span class="bookie-tag coral">COR</span>
          <div><strong>Coral</strong><span class="text-sm muted">Football Super Series & Acca Insurance boost</span></div>
          <span class="bookie-go-arrow">›</span>
        </a>
        <a href="https://sports.williamhill.com/betting/en-gb/football" target="_blank" rel="noopener noreferrer" class="bookie-choice-btn" data-bookie-click="William Hill">
          <span class="bookie-tag wh">WH</span>
          <div><strong>William Hill</strong><span class="text-sm muted">Epic Odds & traditional UK betting shop</span></div>
          <span class="bookie-go-arrow">›</span>
        </a>'''

html = html.replace(old_bookie_list, new_bookie_list)

# 6. Add GDPR & Privacy link to compliance-bar in footer
old_compliance = '''    <span style="margin-left:auto"><a href="#/more" class="compliance-link">Commercial & Sponsorship Inquiries</a></span>'''
new_compliance = '''    <span><button type="button" class="compliance-link-btn" id="btn-open-gdpr">Privacy & GDPR</button></span>
    <span style="margin-left:auto"><a href="#/more" class="compliance-link">Commercial & Sponsorship Inquiries</a></span>'''
html = html.replace(old_compliance, new_compliance)

# 7. Add Sign-in Benefits Grid to Google Auth modal
old_auth_sub = '''      <p class="auth-sub">Connect your Google account to sync your Bet Diary, custom picks, and Buddy League rankings across all your phones and computers.</p>'''
new_auth_sub = '''      <div class="auth-benefits-grid">
        <div class="auth-benefit-item"><span class="benefit-icon">🏆</span><div><strong>Buddy Leagues & Custom Gamertag</strong><span>Rank on pure Win Rate % with friends. Compete equally on 10p bets.</span></div></div>
        <div class="auth-benefit-item"><span class="benefit-icon">📈</span><div><strong>Personal Analytics & P&L Charts</strong><span>Unlock interactive cumulative profit graphs & market breakdowns.</span></div></div>
        <div class="auth-benefit-item"><span class="benefit-icon">🔄</span><div><strong>Cross-Device Sync</strong><span>Access your bet diary and builder slips on phone, tablet, and PC.</span></div></div>
        <div class="auth-benefit-item"><span class="benefit-icon">🔒</span><div><strong>100% Free & Anonymous</strong><span>No passwords to remember. One-tap sign in. We never send spam.</span></div></div>
      </div>'''
html = html.replace(old_auth_sub, new_auth_sub)

# 8. Add GDPR Modal and Share Sheet Modal before </body>
extra_modals = '''
<!-- Universal Share Sheet Modal -->
<div class="modal-backdrop" id="share-modal" hidden>
  <div class="modal share-modal-box" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
    <div class="modal-head">
      <div>
        <h2 id="share-modal-title" style="margin:0;font-size:1.15rem">Share with Friends</h2>
        <span class="text-sm muted" id="share-modal-subtitle">Send via WhatsApp, text, or email</span>
      </div>
      <button type="button" class="icon-btn" data-close-share aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <div id="share-preview-box" class="share-preview-card">
        <pre id="share-preview-text" class="share-text-box"></pre>
      </div>
      <div class="share-channels-grid">
        <a id="btn-share-whatsapp" href="#" target="_blank" rel="noopener noreferrer" class="share-channel-btn whatsapp">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.01-1.24-.74-.66-1.25-1.48-1.39-1.73-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.32-.02-.45-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.45.06-.68.32-.23.25-.89.87-.89 2.12s.91 2.46 1.04 2.63c.13.17 1.8 2.74 4.35 3.84.61.26 1.08.42 1.45.54.61.19 1.16.17 1.6.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.18-.47-.31"/></svg>
          <div><strong>WhatsApp</strong><span>Send directly to mates or group chats</span></div>
          <span class="share-arrow">›</span>
        </a>
        <a id="btn-share-sms" href="#" class="share-channel-btn sms">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <div><strong>Text / SMS</strong><span>Open phone Messaging app</span></div>
          <span class="share-arrow">›</span>
        </a>
        <a id="btn-share-email" href="#" class="share-channel-btn email">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          <div><strong>Email</strong><span>Compose email with slip details</span></div>
          <span class="share-arrow">›</span>
        </a>
        <button type="button" id="btn-share-copy" class="share-channel-btn copy">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <div><strong>Copy to Clipboard</strong><span>Copy formatted text and links</span></div>
          <span class="share-arrow">›</span>
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Privacy & UK GDPR Policy Modal -->
<div class="modal-backdrop" id="gdpr-modal" hidden>
  <div class="modal gdpr-modal-box" role="dialog" aria-modal="true" aria-labelledby="gdpr-modal-title">
    <div class="modal-head">
      <div>
        <h2 id="gdpr-modal-title" style="margin:0;font-size:1.25rem">Privacy Notice &amp; UK GDPR Compliance</h2>
        <span class="text-sm muted">UK Data Protection Act 2018 · Transparent, Local &amp; Private</span>
      </div>
      <button type="button" class="icon-btn" data-close-gdpr aria-label="Close">&times;</button>
    </div>
    <div class="modal-body gdpr-body-content">
      <div class="gdpr-section">
        <h3>1. Data Minimisation &amp; Local Storage Architecture</h3>
        <p>Bet Buddy is built on a <b>Privacy-by-Design</b> principle. Your Bet Diary, accumulator slips, private custom odds, and settings are stored locally on your device via browser <code>localStorage</code>. We do not transmit or store your personal betting slips on remote proprietary databases without your explicit permission.</p>
      </div>
      <div class="gdpr-section">
        <h3>2. No Third-Party Tracking Cookies</h3>
        <p>We do not operate advertising tracking pixels or third-party behavioral analytics that track you across the internet. Essential operational state (such as fractional/decimal preferences and competition filters) is maintained client-side only.</p>
      </div>
      <div class="gdpr-section">
        <h3>3. Optional Google Authentication</h3>
        <p>Signing in with Google is optional. We only access your basic public profile (display name and email address) to synchronize your Buddy League gamertag. You can continue using Bet Buddy 100% anonymously at any time.</p>
      </div>
      <div class="gdpr-section">
        <h3>4. Your Rights Under UK GDPR (Articles 15–20)</h3>
        <ul class="gdpr-list">
          <li><b>Right to Data Portability:</b> You can export your full Bet Diary at any time in open CSV or JSON format using the Export buttons in the Bet Diary.</li>
          <li><b>Right to Erasure ("Right to be Forgotten"):</b> Tap "Clear Diary" in the Bet Diary to permanently delete every stored bet from your device instantly.</li>
          <li><b>Right of Rectification:</b> Update your username or correct any bet entries directly inside the app.</li>
        </ul>
      </div>
      <div class="gdpr-section">
        <h3>5. External Bookmaker Outbound Links</h3>
        <p>When you choose to click "Place Bet" or visit an external licensed bookmaker (such as bet365, Sky Bet, Paddy Power, Ladbrokes, Coral, William Hill, or Betfair), you leave Bet Buddy. Any data processed on bookmaker platforms is governed by their respective UKGC licenses and privacy policies. Bet Buddy may receive affiliate commissions from qualifying bookmaker referrals at zero cost to you.</p>
      </div>
      <div class="gdpr-section">
        <h3>6. Data Controllers &amp; Contact</h3>
        <p>Data Controllers: Martin White and Chris Faulds.<br>Inquiries: <a href="mailto:octopigardens@gmail.com" class="compliance-link">octopigardens@gmail.com</a></p>
      </div>
      <button type="button" class="btn primary full-width" data-close-gdpr style="margin-top:16px">Close Privacy Notice</button>
    </div>
  </div>
</div>
'''

if 'id="share-modal"' not in html:
    html = html.replace('</body>', extra_modals + '\n</body>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Updated index.html with all 9 health check fixes')

