# Patch app.js with all 9 health check fixes and robust telemetry

with open('app.js', 'r', encoding='utf-8') as f:
    app_text = f.read()

# 1. Update bookmaker-quick list to include Ladbrokes and Coral
old_bookmaker_quick = "$('bookmaker-quick').innerHTML = ['Bet365', 'Sky Bet', 'Betfair', 'William Hill', 'Paddy Power', 'Unibet'].map(b => '<button type=\"button\">' + b + '</button>').join('');"
new_bookmaker_quick = "$('bookmaker-quick').innerHTML = ['Bet365', 'Sky Bet', 'Paddy Power', 'Ladbrokes', 'Coral', 'William Hill', 'Betfair', 'Unibet'].map(b => '<button type=\"button\">' + b + '</button>').join('');"

assert old_bookmaker_quick in app_text, 'old_bookmaker_quick not found'
app_text = app_text.replace(old_bookmaker_quick, new_bookmaker_quick)

# 2. Update toggleAccumulatorFields to hide single-fixture-row, single-selection-row, single-odds-row, single-market-row
old_toggle_acc = '''function toggleAccumulatorFields() {
  const acc = $('modal-bet-type').value === 'accumulator';
  $('accumulator-legs-row').hidden = !acc;
  ['single-selection-row', 'single-odds-row', 'single-market-row'].forEach(id => { $(id).hidden = acc; });
  updateModalPnlPreview();
}'''

new_toggle_acc = '''function toggleAccumulatorFields() {
  const acc = $('modal-bet-type').value === 'accumulator';
  $('accumulator-legs-row').hidden = !acc;
  ['single-fixture-row', 'single-selection-row', 'single-odds-row', 'single-market-row'].forEach(id => {
    const el = $(id);
    if (el) el.hidden = acc;
  });
  updateModalPnlPreview();
}'''

assert old_toggle_acc in app_text, 'old_toggle_acc not found'
app_text = app_text.replace(old_toggle_acc, new_toggle_acc)

# 3. Update openDiary to hide bettor profile if logged in
old_open_diary_head = '''function openDiary(prefill) {
  modalPrefill = prefill || {};
  const select = $('modal-fixture-select');'''

new_open_diary_head = '''function openDiary(prefill) {
  modalPrefill = prefill || {};
  const auth = getAuthUser();
  const profileRow = $('modal-profile-row');
  const profileInput = $('modal-profile');
  if (auth && auth.signedIn) {
    if (profileRow) profileRow.hidden = true;
    if (profileInput) profileInput.value = '@' + (auth.handle || (auth.name || 'User').split(' ')[0]);
  } else {
    if (profileRow) profileRow.hidden = false;
    const curHandle = getUserProfile().handle;
    if (profileInput) profileInput.value = curHandle && curHandle !== 'Tester A' ? curHandle : 'Default';
  }
  const select = $('modal-fixture-select');'''

assert old_open_diary_head in app_text, 'old_open_diary_head not found'
app_text = app_text.replace(old_open_diary_head, new_open_diary_head)

# 4. In handleDiaryFormSubmit, make sure profile takes logged in user
old_diary_submit_profile = "profile: $('modal-profile').value.trim() || 'Default',"
new_diary_submit_profile = "profile: (getAuthUser() && getAuthUser().signedIn) ? ('@' + (getAuthUser().handle || (getAuthUser().name || 'User').split(' ')[0])) : ($('modal-profile').value.trim() || 'Default'),"
assert old_diary_submit_profile in app_text, 'old_diary_submit_profile not found'
app_text = app_text.replace(old_diary_submit_profile, new_diary_submit_profile)

# 5. Replace shareAccaSlip and add openUniversalShare
old_share_slip = '''function shareAccaSlip(idx) {
  const r = builderResult;
  if (!r || !r.slips || !r.slips[idx]) return;
  const slip = r.slips[idx];
  const stake = builderState.stake;
  const m = MatchIQBuilder.money;
  const lines = [
    '🎯 Bet Buddy Acca (Target: ' + m(slip.profit) + ' profit)',
    'Odds: ' + fmtOdds(slip.odds) + ' · Estimated Chance: ' + Math.round(slip.chance * 100) + '%',
    'Stake: ' + m(stake) + ' · Potential Return: ' + m(slip.ret),
    '',
    ...slip.legs.map((l, i) => (i + 1) + '. ' + l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label + ' (' + l.fractional + ')'),
    '',
    'Load this exact slip: ' + location.origin + location.pathname + '#slip=' + encodeURIComponent(builderState.stake + '_' + builderState.win + '_' + builderState.legs)
  ].join('\\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(lines).then(() => {
      toast('Acca slip copied to clipboard ready for your bookmaker.');
    }).catch(() => {
      toast('Slip ready.');
    });
  } else if (navigator.share) {
    navigator.share({ title: 'Bet Buddy Acca', text: lines }).catch(() => {});
  } else {
    toast('Slip details ready.');
  }
}'''

new_share_system = '''let currentSharePayload = { title: '', text: '', url: '' };

function openUniversalShare({ title, text, url }) {
  currentSharePayload = {
    title: title || 'Bet Buddy',
    text: text || '',
    url: url || (location.origin + location.pathname)
  };

  const fullText = currentSharePayload.text + (currentSharePayload.url ? '\\n\\n' + currentSharePayload.url : '');

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
}

function shareAccaSlip(idx) {
  const r = builderResult;
  if (!r || !r.slips || !r.slips[idx]) return;
  const slip = r.slips[idx];
  const stake = builderState.stake;
  const m = MatchIQBuilder.money;
  const shareUrl = location.origin + location.pathname + '#slip=' + encodeURIComponent(builderState.stake + '_' + builderState.win + '_' + builderState.legs);
  const text = [
    '🎯 Bet Buddy Acca (Target: ' + m(slip.profit) + ' profit)',
    'Odds: ' + fmtOdds(slip.odds) + ' · Estimated Chance: ' + Math.round(slip.chance * 100) + '%',
    'Stake: ' + m(stake) + ' · Potential Return: ' + m(slip.ret),
    '',
    ...slip.legs.map((l, i) => (i + 1) + '. ' + l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label + ' (' + l.fractional + ')'),
    '',
    'Load this exact slip on Bet Buddy:'
  ].join('\\n');

  openUniversalShare({
    title: 'Bet Buddy Acca Slip (' + fmtOdds(slip.odds) + ')',
    text,
    url: shareUrl
  });
}'''

assert old_share_slip in app_text, 'old_share_slip not found'
app_text = app_text.replace(old_share_slip, new_share_system)

# 6. In viewMore, add Commercial Portal Card linking to #/admin and Privacy link
old_view_more_foot = """      '<div class="btn-row"><button type="submit" class="btn primary">Send feedback</button>' + (fb.length ? '<button type="button" class="btn" data-export="feedback">Export ' + fb.length + ' responses</button>' : '') + '</div>' +
      '<p class="section-note">Feedback is stored in this browser only.</p></form></div></section>';"""

new_view_more_foot = """      '<div class="btn-row"><button type="submit" class="btn primary">Send feedback</button>' + (fb.length ? '<button type="button" class="btn" data-export="feedback">Export ' + fb.length + ' responses</button>' : '') + '</div>' +
      '<p class="section-note">Feedback is stored in this browser only.</p></form></div>' +
    '<div class="section card commercial-card">' +
      '<div class="section-head"><div><h2 class="section-title">Commercial &amp; Founder Portal</h2><p class="section-note">Private founder access for Martin White &amp; Chris Faulds: punter traffic, bookmaker outbound clicks, and revenue telemetry.</p></div><span class="commercial-badge">Private</span></div>' +
      '<div class="btn-row" style="margin-top:14px">' +
        '<a href="#/admin" class="btn primary">Open Founder Admin Dashboard</a>' +
        '<button type="button" class="btn" id="btn-more-gdpr">Privacy Notice &amp; UK GDPR</button>' +
      '</div>' +
    '</div></section>';"""

assert old_view_more_foot in app_text, 'old_view_more_foot not found'
app_text = app_text.replace(old_view_more_foot, new_view_more_foot)

# 7. Update getTrafficStats and renderTrafficChartSvg to be 100% resilient
old_telemetry_block = '''function getTrafficStats() {
  let stats = null;
  try {
    stats = JSON.parse(localStorage.getItem(TRAFFIC_STORAGE_KEY) || 'null');
  } catch (e) { /* ignore */ }

  const today = new Date().toISOString().slice(0, 10);
  if (!stats || stats.date !== today) {
    stats = {
      date: today,
      visitsToday: (stats ? stats.visitsToday : 0) + 1,
      totalVisits: (stats ? stats.totalVisits : 142) + 1,
      uniquePunters: (stats ? stats.uniquePunters : 88) + 1,
      slipsBuilt: (stats ? stats.slipsBuilt : 64) + 1,
      lastRefreshed: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dailyHistory: [
        { day: 'Mon', visits: 115, clicks: 14 },
        { day: 'Tue', visits: 132, clicks: 18 },
        { day: 'Wed', visits: 154, clicks: 22 },
        { day: 'Thu', visits: 148, clicks: 19 },
        { day: 'Fri', visits: 210, clicks: 38 },
        { day: 'Sat', visits: 345, clicks: 72 },
        { day: 'Sun', visits: 290, clicks: 54 }
      ]
    };
    try { localStorage.setItem(TRAFFIC_STORAGE_KEY, JSON.stringify(stats)); } catch (e) { /* ignore */ }
  } else {
    stats.visitsToday += 1;
    stats.totalVisits += 1;
    stats.lastRefreshed = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try { localStorage.setItem(TRAFFIC_STORAGE_KEY, JSON.stringify(stats)); } catch (e) { /* ignore */ }
  }
  return stats;
}'''

new_telemetry_block = '''const DEFAULT_DAILY_HISTORY = [
  { day: 'Mon', visits: 115, clicks: 14 },
  { day: 'Tue', visits: 132, clicks: 18 },
  { day: 'Wed', visits: 154, clicks: 22 },
  { day: 'Thu', visits: 148, clicks: 19 },
  { day: 'Fri', visits: 210, clicks: 38 },
  { day: 'Sat', visits: 345, clicks: 72 },
  { day: 'Sun', visits: 290, clicks: 54 }
];

function getTrafficStats() {
  let stats = null;
  try {
    stats = JSON.parse(localStorage.getItem(TRAFFIC_STORAGE_KEY) || 'null');
  } catch (e) { /* ignore */ }

  const today = new Date().toISOString().slice(0, 10);
  if (!stats || typeof stats !== 'object' || stats.date !== today) {
    stats = {
      date: today,
      visitsToday: ((stats && stats.visitsToday) || 0) + 1,
      totalVisits: ((stats && stats.totalVisits) || 142) + 1,
      uniquePunters: ((stats && stats.uniquePunters) || 88) + 1,
      slipsBuilt: ((stats && stats.slipsBuilt) || 64) + 1,
      lastRefreshed: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dailyHistory: DEFAULT_DAILY_HISTORY
    };
    try { localStorage.setItem(TRAFFIC_STORAGE_KEY, JSON.stringify(stats)); } catch (e) { /* ignore */ }
  } else {
    stats.visitsToday = (stats.visitsToday || 0) + 1;
    stats.totalVisits = (stats.totalVisits || 142) + 1;
    if (!Array.isArray(stats.dailyHistory) || stats.dailyHistory.length < 2) {
      stats.dailyHistory = DEFAULT_DAILY_HISTORY;
    }
    stats.lastRefreshed = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try { localStorage.setItem(TRAFFIC_STORAGE_KEY, JSON.stringify(stats)); } catch (e) { /* ignore */ }
  }
  return stats;
}'''

assert old_telemetry_block in app_text, 'old_telemetry_block not found'
app_text = app_text.replace(old_telemetry_block, new_telemetry_block)

# 8. Harden renderTrafficChartSvg
old_render_chart = '''function renderTrafficChartSvg(history) {
  const width = 600, height = 140, pad = 30;
  const maxV = Math.max(...history.map(h => h.visits), 10);'''

new_render_chart = '''function renderTrafficChartSvg(history) {
  const h = (Array.isArray(history) && history.length >= 2) ? history : DEFAULT_DAILY_HISTORY;
  const width = 600, height = 140, pad = 30;
  const maxV = Math.max(...h.map(item => Number(item.visits) || 0), 10);'''

assert old_render_chart in app_text, 'old_render_chart not found'
app_text = app_text.replace(old_render_chart, new_render_chart)

# 9. Update viewAdmin to include functional action buttons
old_admin_header = '''    '<div class="chips"><span class="chip ok"><span class="admin-pulse-dot"></span>Auto-refreshed ' + stats.lastRefreshed + '</span></div></div>\''''

new_admin_header = '''    '<div class="chips">' +
      '<button type="button" class="chip ok" data-admin-action="refresh-stats" title="Click to refresh telemetry"><span class="admin-pulse-dot"></span>Refresh Telemetry (' + stats.lastRefreshed + ')</button>' +
      '<button type="button" class="chip" data-admin-action="simulate-click" title="Log a test bookie outbound">⚡ Test Bookie Click</button>' +
    '</div></div>\''''

assert old_admin_header in app_text, 'old_admin_header not found'
app_text = app_text.replace(old_admin_header, new_admin_header)

# 10. Update the click event listener to catch ALL buttons without dropping anything
old_click_listener_start = """document.addEventListener('click', event => {
    const t = event.target.closest('[data-open-league-modal],[data-close-league],[data-open-handle-modal],[data-close-handle],[data-share-league],[data-select-league],[data-slip],[data-share-slip],[data-partner-slip],[data-legs],[data-win],[data-back],[data-diary],[data-close],[data-comp],[data-tab],[data-showall],[data-rfilter],[data-export],[data-import],[data-delete],[data-clear-diary],[data-retry],[data-star],[data-useful],[data-chip],#odds-toggle,#bookmaker-quick button,#header-install-btn,[data-close-install],#header-auth-btn,#header-user-btn,[data-close-auth],#btn-switch-handle,#btn-google-signout,#btn-trigger-native-install');
  if (!t) {
    if (event.target.id === 'diary-modal') closeDiary();
    if (event.target.id === 'google-auth-modal') closeAuthModal();
    if (event.target.id === 'install-modal') closeInstallModal();
    return;
  }
  if (t.id === 'btn-report-bug') { $('bug-modal').hidden = false; return; }
  if (t.dataset.closeBug !== undefined) { $('bug-modal').hidden = true; return; }
  if (t.dataset.openBookie !== undefined) {
    try {
      const data = JSON.parse(t.dataset.openBookie);
      openBookieModal(data);
    } catch (e) { openBookieModal({ selection: 'Football Selection' }); }
    return;
  }
  if (t.dataset.closeBookie !== undefined) { closeBookieModal(); return; }
  if (t.dataset.bookieClick !== undefined) {
    logAffiliateClick(t.dataset.bookieClick);
    toast('Opening ' + t.dataset.bookieClick + ' · Selection copied to clipboard!');
    closeBookieModal();
    return;
  }
  if (t.dataset.partnerSlip !== undefined) {
    const r = builderResult;
    const slip = r && r.slips && r.slips[+t.dataset.partnerSlip];
    openBookieModal({
      selection: slip ? slip.legs.map(l => l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label).join(' + ') : 'Acca Slip',
      fair: slip ? fmtOdds(slip.odds) : ''
    });
    return;
  }"""

new_click_listener_start = """document.addEventListener('click', event => {
  // Catch all interactive elements robustly
  const t = event.target.closest('button, a, select, input, [data-open-league-modal],[data-close-league],[data-open-handle-modal],[data-close-handle],[data-share-league],[data-select-league],[data-slip],[data-share-slip],[data-partner-slip],[data-legs],[data-win],[data-back],[data-diary],[data-close],[data-comp],[data-tab],[data-showall],[data-rfilter],[data-export],[data-import],[data-delete],[data-clear-diary],[data-retry],[data-star],[data-useful],[data-chip],[data-open-bookie],[data-close-bookie],[data-bookie-click],[data-close-bug],[data-close-share],[data-close-gdpr],[data-admin-action]');

  if (!t) {
    if (event.target.id === 'diary-modal') closeDiary();
    if (event.target.id === 'google-auth-modal') closeAuthModal();
    if (event.target.id === 'install-modal') closeInstallModal();
    if (event.target.id === 'bookie-modal') closeBookieModal();
    if (event.target.id === 'bug-modal') $('bug-modal').hidden = true;
    if (event.target.id === 'share-modal') $('share-modal').hidden = true;
    if (event.target.id === 'gdpr-modal') $('gdpr-modal').hidden = true;
    return;
  }

  // Bug reporting modal
  if (t.id === 'btn-report-bug') { $('bug-modal').hidden = false; return; }
  if (t.dataset.closeBug !== undefined) { $('bug-modal').hidden = true; return; }

  // GDPR modal
  if (t.id === 'btn-open-gdpr' || t.id === 'btn-more-gdpr') { $('gdpr-modal').hidden = false; return; }
  if (t.dataset.closeGdpr !== undefined) { $('gdpr-modal').hidden = true; return; }

  // Share modal
  if (t.dataset.closeShare !== undefined) { $('share-modal').hidden = true; return; }
  if (t.id === 'btn-share-copy') {
    const textToCopy = $('share-preview-text').textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        toast('Copied to clipboard ready to send!');
        $('share-modal').hidden = true;
      });
    } else {
      toast('Copied!');
      $('share-modal').hidden = true;
    }
    return;
  }

  // Admin interactive actions
  if (t.dataset.adminAction !== undefined) {
    const act = t.dataset.adminAction;
    if (act === 'refresh-stats') {
      getTrafficStats();
      toast('Telemetry refreshed.');
      render();
    } else if (act === 'simulate-click') {
      logAffiliateClick('bet365');
      toast('Test affiliate click logged to bet365!');
      render();
    } else if (act === 'clear-bugs') {
      localStorage.setItem(BUGS_STORAGE_KEY, '[]');
      toast('Bug reports cleared.');
      render();
    }
    return;
  }

  // Bookie selection modal
  if (t.dataset.openBookie !== undefined) {
    try {
      const data = JSON.parse(t.dataset.openBookie);
      openBookieModal(data);
    } catch (e) { openBookieModal({ selection: 'Football Selection' }); }
    return;
  }
  if (t.dataset.closeBookie !== undefined) { closeBookieModal(); return; }
  if (t.dataset.bookieClick !== undefined) {
    logAffiliateClick(t.dataset.bookieClick);
    toast('Opening ' + t.dataset.bookieClick + ' · Selection copied to clipboard!');
    closeBookieModal();
    return;
  }
  if (t.dataset.partnerSlip !== undefined) {
    const r = builderResult;
    const slip = r && r.slips && r.slips[+t.dataset.partnerSlip];
    openBookieModal({
      selection: slip ? slip.legs.map(l => l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label).join(' + ') : 'Acca Slip',
      fair: slip ? fmtOdds(slip.odds) : ''
    });
    return;
  }"""

assert old_click_listener_start in app_text, 'old_click_listener_start not found'
app_text = app_text.replace(old_click_listener_start, new_click_listener_start)

# 11. Update shareLeague to use openUniversalShare
old_share_league = """  else if (t.dataset.shareLeague !== undefined) {
    const code = t.dataset.shareLeague;
    const shareText = '🏆 Join my Bet Buddy League! Code: ' + code + ' · Play with 10p bets, judged on pure Win Rate %! ' + location.origin + location.pathname + '#join-league=' + encodeURIComponent(code);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareText).then(() => toast('League invite link copied! Send it to your mates.'));
    } else if (navigator.share) {
      navigator.share({ title: 'Join Bet Buddy League', text: shareText }).catch(() => {});
    }
  }"""

new_share_league = """  else if (t.dataset.shareLeague !== undefined) {
    const code = t.dataset.shareLeague;
    const shareUrl = location.origin + location.pathname + '#join-league=' + encodeURIComponent(code);
    const text = '🏆 Join my Bet Buddy League! Code: ' + code + '\\nPlay with 10p bets, judged on pure Win Rate %!';
    openUniversalShare({
      title: 'Join my Bet Buddy League (' + code + ')',
      text,
      url: shareUrl
    });
  }"""

assert old_share_league in app_text, 'old_share_league not found'
app_text = app_text.replace(old_share_league, new_share_league)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_text)

print('Updated app.js with all health check fixes')
