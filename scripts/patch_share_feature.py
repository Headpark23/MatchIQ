import re

# 1. Patch index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

header_btn = """      <button type="button" class="header-share-btn" id="header-share-btn" data-share-app title="Share Bet Buddy with friends" aria-label="Share App">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        <span class="share-label">Share App</span>
      </button>"""

if '<button type="button" class="sync-refresh-btn"' in html and 'header-share-btn' not in html:
    html = html.replace('<button type="button" class="sync-refresh-btn"', header_btn + '\n      <button type="button" class="sync-refresh-btn"', 1)
    print('Added header-share-btn to index.html')

footer_btn = """    <button type="button" class="btn small subtle-share-btn" id="footer-share-btn" data-share-app title="Share Bet Buddy with a friend">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      <span>Share App</span>
    </button>"""

if '<button type="button" class="btn small report-bug-btn"' in html and 'footer-share-btn' not in html:
    html = html.replace('<button type="button" class="btn small report-bug-btn"', footer_btn + '\n    <button type="button" class="btn small report-bug-btn"', 1)
    print('Added footer-share-btn to index.html')

fb_x_channels = """        <a id="btn-share-facebook" href="#" target="_blank" rel="noopener noreferrer" class="share-channel-btn facebook">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          <div><strong>Facebook</strong><span>Share on Facebook or Messenger</span></div>
          <span class="share-arrow">›</span>
        </a>
        <a id="btn-share-x" href="#" target="_blank" rel="noopener noreferrer" class="share-channel-btn x-twitter">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          <div><strong>X (formerly Twitter)</strong><span>Post update to your followers</span></div>
          <span class="share-arrow">›</span>
        </a>"""

target_after_sms = """        <a id="btn-share-sms" href="#" class="share-channel-btn sms">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <div><strong>Text / SMS</strong><span>Open phone Messaging app</span></div>
          <span class="share-arrow">›</span>
        </a>"""

if target_after_sms in html and 'btn-share-facebook' not in html:
    html = html.replace(target_after_sms, target_after_sms + '\n' + fb_x_channels, 1)
    print('Added Facebook and X channels to share-channels-grid in index.html')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)


# 2. Patch styles.css
with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

new_styles = """
/* Header & Subtle Share App Buttons */
.header-share-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #e2e8f0; font-weight: 600; font-size: 13px;
  padding: 5px 11px; min-height: 32px; border-radius: 9999px;
  transition: all .15s ease; cursor: pointer;
}
.header-share-btn:hover {
  background: rgba(6, 182, 212, 0.15);
  border-color: var(--cyan);
  color: var(--cyan);
  box-shadow: 0 0 10px rgba(6, 182, 212, 0.3);
}
@media (max-width: 600px) {
  .header-share-btn { padding: 5px 8px; min-height: 28px; min-width: 28px; }
  .header-share-btn .share-label { display: none !important; }
}
.subtle-share-btn {
  display: inline-flex; align-items: center; gap: 5px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--soft);
  padding: 4px 10px; border-radius: 6px; font-size: 12px;
  cursor: pointer; transition: all .15s ease;
}
.subtle-share-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--cyan);
  color: #fff;
}
.share-channel-btn.facebook svg { color: #1877f2; }
.share-channel-btn.facebook:hover { border-color: #1877f2; }
.share-channel-btn.x-twitter svg { color: #f3f4f6; }
.share-channel-btn.x-twitter:hover { border-color: #f3f4f6; }
"""

if '.header-share-btn' not in css:
    css += '\n' + new_styles
    with open('styles.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print('Appended share styles to styles.css')


# 3. Patch app.js
with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Update openUniversalShare & openShareSheetModal
old_share_func = """function openUniversalShare({ title, text, url }) {
  const finalUrl = canonicalUrl(url);
  currentSharePayload = {
    title: title || 'Bet Buddy',
    text: text || '',
    url: finalUrl
  };

  const fullText = currentSharePayload.text.includes(finalUrl)
    ? currentSharePayload.text
    : currentSharePayload.text + (finalUrl ? '\\n\\n' + finalUrl : '');

  // 1. If mobile device supports Web Share API, launch native share sheet
  if (navigator.share && /android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
    navigator.share({
      title: currentSharePayload.title,
      text: currentSharePayload.text,
      url: currentSharePayload.url
    }).catch(err => {
      if (err.name !== 'AbortError') openShareSheetModal(fullText);
    });
    return;
  }

  // 2. Otherwise open direct multi-channel share modal (WhatsApp, SMS, Email, Copy)
  openShareSheetModal(fullText);
}

function openShareSheetModal(fullText) {
  const modal = $('share-modal');
  if (!modal) return;
  const pre = $('share-preview-text');
  if (pre) pre.textContent = fullText;

  const encText = encodeURIComponent(fullText);
  const encTitle = encodeURIComponent(currentSharePayload.title || 'Bet Buddy');

  const waBtn = $('btn-share-whatsapp');
  if (waBtn) waBtn.href = 'https://api.whatsapp.com/send?text=' + encText;

  const smsBtn = $('btn-share-sms');
  if (smsBtn) smsBtn.href = 'sms:?&body=' + encText;

  const mailBtn = $('btn-share-email');
  if (mailBtn) mailBtn.href = 'mailto:?subject=' + encTitle + '&body=' + encText;

  modal.hidden = false;
}"""

new_share_func = """function openUniversalShare({ title, text, url }, forceModal = false) {
  const finalUrl = canonicalUrl(url);
  currentSharePayload = {
    title: title || 'Bet Buddy',
    text: text || '',
    url: finalUrl
  };

  const fullText = currentSharePayload.text.includes(finalUrl)
    ? currentSharePayload.text
    : currentSharePayload.text + (finalUrl ? '\\n\\n' + finalUrl : '');

  // If forceModal is true (e.g. user clicked 'Share app with friend'), directly show WhatsApp, SMS, Facebook, X options!
  if (forceModal || !navigator.share) {
    openShareSheetModal(fullText);
    return;
  }

  // Otherwise, if mobile device supports Web Share API and not forced, launch native share sheet
  if (navigator.share && /android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
    navigator.share({
      title: currentSharePayload.title,
      text: currentSharePayload.text,
      url: currentSharePayload.url
    }).catch(err => {
      if (err.name !== 'AbortError') openShareSheetModal(fullText);
    });
    return;
  }

  openShareSheetModal(fullText);
}

function shareAppWithFriend() {
  openUniversalShare({
    title: 'Bet Buddy UK - The AI Smart Acca & Mini-Leagues App',
    text: 'Check out Bet Buddy! Smart AI football accas, real bookie odds comparison, and private betting leagues with mates:\\nhttps://betbuddyuk.uk/',
    url: 'https://betbuddyuk.uk/'
  }, true);
}

function openShareSheetModal(fullText) {
  const modal = $('share-modal');
  if (!modal) return;
  const pre = $('share-preview-text');
  if (pre) pre.textContent = fullText;

  const encText = encodeURIComponent(fullText);
  const encTitle = encodeURIComponent(currentSharePayload.title || 'Bet Buddy');
  const encUrl = encodeURIComponent(currentSharePayload.url || 'https://betbuddyuk.uk/');

  const waBtn = $('btn-share-whatsapp');
  if (waBtn) waBtn.href = 'https://api.whatsapp.com/send?text=' + encText;

  const smsBtn = $('btn-share-sms');
  if (smsBtn) smsBtn.href = 'sms:?&body=' + encText;

  const fbBtn = $('btn-share-facebook');
  if (fbBtn) fbBtn.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encUrl + '&quote=' + encText;

  const xBtn = $('btn-share-x');
  if (xBtn) xBtn.href = 'https://twitter.com/intent/tweet?text=' + encText + '&url=' + encUrl;

  const mailBtn = $('btn-share-email');
  if (mailBtn) mailBtn.href = 'mailto:?subject=' + encTitle + '&body=' + encText;

  modal.hidden = false;
}"""

if old_share_func in js:
    js = js.replace(old_share_func, new_share_func, 1)
    print('Updated openUniversalShare, openShareSheetModal, and added shareAppWithFriend')
else:
    print('old_share_func not matched exactly')

# Add share button to Account / More view
old_account_btns = """      '<div class="btn-row" style="margin-top:16px">' +
        '<button type="button" class="btn primary" data-open-handle-modal>Change Username / Location</button>' +
        '<button type="button" class="btn" data-open-auth>Switch / Connect Google Account</button>' +
      '</div>' +"""

new_account_btns = """      '<div class="btn-row" style="margin-top:16px">' +
        '<button type="button" class="btn primary" data-open-handle-modal>Change Username / Location</button>' +
        '<button type="button" class="btn" data-share-app>👥 Share App with Friend</button>' +
        '<button type="button" class="btn" data-open-auth>Switch / Connect Google Account</button>' +
      '</div>' +"""

if old_account_btns in js:
    js = js.replace(old_account_btns, new_account_btns, 1)
    print('Added share button to Player Profile & Account tab in app.js')
else:
    print('old_account_btns not matched exactly')

# Add click handler for data-share-app, header-share-btn, and footer-share-btn
click_target = "  if (t.dataset.closeShare !== undefined) { $('share-modal').hidden = true; return; }"
click_replacement = """  if (t.dataset.shareApp !== undefined || t.id === 'header-share-btn' || t.id === 'footer-share-btn' || t.closest('#header-share-btn') || t.closest('#footer-share-btn')) {
    shareAppWithFriend();
    return;
  }
  if (t.dataset.closeShare !== undefined) { $('share-modal').hidden = true; return; }"""

if click_target in js and 'shareAppWithFriend()' not in js.split('document.addEventListener')[1]:
    js = js.replace(click_target, click_replacement, 1)
    print('Added click handler for shareAppWithFriend in app.js')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)
