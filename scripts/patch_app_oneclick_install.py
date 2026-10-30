with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_install_block = '''function openInstallModal() {
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
});'''

new_install_block = '''async function triggerDirectDownload() {
  if (isInStandaloneMode()) {
    toast('Bet Buddy is already installed on your home screen! 🐼');
    return;
  }

  // 1-Click Native Install on Android Chrome / Desktop
  if (deferredInstallPrompt) {
    try {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        toast('Bet Buddy installed to your phone! 🐼');
        deferredInstallPrompt = null;
        const btn = $('header-install-btn');
        if (btn) btn.style.display = 'none';
        return;
      }
    } catch (e) { /* fallback to modal */ }
  }

  openInstallModal();
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
    // Android Chrome / Edge 1-Click action
    content.innerHTML = '<div class="install-guide-steps">' +
      '<div class="install-badge-preview" style="margin-bottom:16px"><img src="assets/icon-192.png" width="56" height="56" style="border-radius:12px;box-shadow:0 0 16px rgba(16,185,129,0.4)" alt="Panda Mascot Icon"><div><strong style="color:#fff;display:block;font-size:16px">Bet Buddy</strong><span class="text-sm muted">Official Panda Mascot Mobile App</span></div></div>' +
      '<button type="button" class="btn primary full-width" id="btn-trigger-native-install" style="font-size:15px;padding:14px 18px">📲 Download &amp; Add to Home Screen (1-Click)</button>' +
      '<p class="section-note" style="margin-top:10px;text-align:center">Instant install directly from your browser. 100% free.</p>' +
      '</div>';
    modal.hidden = false;
    return;
  }

  // iOS Safari or browser where prompt is manual
  content.innerHTML = '<div class="install-guide-steps">' +
    '<div class="install-badge-preview" style="margin-bottom:14px"><img src="assets/icon-192.png" width="52" height="52" style="border-radius:12px" alt="Panda Mascot Icon"><div><strong style="color:#fff;display:block;font-size:15px">Bet Buddy — Panda Mobile App</strong><span class="text-sm muted">Instant launch from your home screen</span></div></div>' +
    '<p class="auth-sub" style="margin-bottom:8px">To add to your phone / tablet home screen:</p>' +
    '<div class="install-step-item"><span class="install-step-num">1</span><div class="install-step-body"><strong>Tap Share</strong><span>Look for the square icon with an arrow pointing up at the bottom of your screen (or Chrome menu).</span></div></div>' +
    '<div class="install-step-item"><span class="install-step-num">2</span><div class="install-step-body"><strong>Select "Add to Home Screen"</strong><span>Scroll down and tap <b>Add to Home Screen</b>.</span></div></div>' +
    '<div class="install-step-item"><span class="install-step-num">3</span><div class="install-step-body"><strong>Tap "Add"</strong><span>Bet Buddy with the Panda Football mascot icon appears instantly on your home screen.</span></div></div>' +
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
  if (btn) {
    btn.style.display = 'inline-flex';
    btn.innerHTML = '<span class="install-panda-emoji" style="font-size:15px">🐼</span> <span class="install-label">Download App</span>';
  }
});'''

assert old_install_block in text, 'old_install_block not found'
text = text.replace(old_install_block, new_install_block, 1)

# Update click handler for header-install-btn and btn-trigger-native-install
old_click_install = "if (t.id === 'header-install-btn') { openInstallModal(); return; }"
new_click_install = "if (t.id === 'header-install-btn' || t.id === 'btn-trigger-native-install') { triggerDirectDownload(); return; }"
assert old_click_install in text, 'old_click_install not found'
text = text.replace(old_click_install, new_click_install, 1)

with open('app.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(text)

print('Updated app.js for 1-click install and panda logo support')
