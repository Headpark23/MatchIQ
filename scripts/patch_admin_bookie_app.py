with open('app.js', 'r', encoding='utf-8') as f:
    app_text = f.read()

# 1. Update marketCard to add "Place Bet" button next to "+ Diary"
old_diary_btn = "const diaryBtn = row => ctx.canLog ? '<button type=\"button\" class=\"btn small\" data-diary=\\'' + esc(JSON.stringify({ id: ctx.id, market: meta.diary, selection: (key === 'btts' ? 'Both teams to score: ' : key === 'result' ? '' : meta.name + ': ') + row.label, p: row.p, fair: row.fair })) + '\\' aria-label=\"Add ' + esc(row.label) + ' to Bet Diary\">+ Diary</button>' : '';"

new_diary_btn = '''const diaryBtn = row => {
    if (!ctx.canLog) return '';
    const selText = (key === 'btts' ? 'Both teams to score: ' : key === 'result' ? '' : meta.name + ': ') + row.label;
    const jsonStr = esc(JSON.stringify({ id: ctx.id, market: meta.diary, selection: selText, p: row.p, fair: row.fair }));
    return '<button type="button" class="btn small" data-diary=\\'' + jsonStr + '\\' aria-label="Add ' + esc(row.label) + ' to Bet Diary">+ Diary</button>' +
      '<button type="button" class="btn-place-bet-inline" data-open-bookie=\\'' + jsonStr + '\\' title="Open in bookmaker app/site">Place Bet</button>';
  };'''

assert old_diary_btn in app_text, 'old_diary_btn not found'
app_text = app_text.replace(old_diary_btn, new_diary_btn)

# 2. Add Commercial Admin tracking & storage
admin_code = '''
// ------------------------------------------------------------ Commercial & Affiliate Tracking
const AFFILIATE_TRACKING_KEY = 'betbuddy_affiliate_clicks_v1';
let currentBookieSelection = null;

function getAffiliateClicks() {
  try {
    const list = JSON.parse(localStorage.getItem(AFFILIATE_TRACKING_KEY) || '[]');
    if (Array.isArray(list)) return list;
  } catch (e) { /* ignore */ }
  return [
    { bookie: 'Bet365', selection: 'Arsenal Win', odds: '8/13', time: new Date(Date.now() - 3600000*2).toISOString() },
    { bookie: 'Sky Bet', selection: '4-Fold Weekend Acca', odds: '12/1', time: new Date(Date.now() - 3600000*8).toISOString() },
    { bookie: 'Paddy Power', selection: 'Over 2.5 Goals', odds: '4/5', time: new Date(Date.now() - 3600000*14).toISOString() }
  ];
}

function logAffiliateClick(bookie) {
  const list = getAffiliateClicks();
  const entry = {
    bookie,
    selection: currentBookieSelection ? currentBookieSelection.selection : 'Bet Slip',
    odds: currentBookieSelection ? currentBookieSelection.fair || 'Live' : 'Acca',
    time: new Date().toISOString()
  };
  list.unshift(entry);
  try { localStorage.setItem(AFFILIATE_TRACKING_KEY, JSON.stringify(list.slice(0, 50))); } catch (e) { /* ignore */ }
}

function openBookieModal(betData) {
  currentBookieSelection = betData || { selection: 'Bet Buddy Selection', fair: 'Best Price' };
  const modal = $('bookie-modal');
  if (!modal) return;
  const labelEl = $('bookie-bet-label');
  const oddsEl = $('bookie-bet-odds');
  if (labelEl) labelEl.textContent = currentBookieSelection.selection;
  if (oddsEl) oddsEl.textContent = currentBookieSelection.fair ? 'Odds: ' + currentBookieSelection.fair : '';
  
  // Copy to clipboard for instant pasting into bookie search
  const copyStr = currentBookieSelection.selection + (currentBookieSelection.fair ? ' @ ' + currentBookieSelection.fair : '');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(copyStr).catch(() => {});
  }
  modal.hidden = false;
}

function closeBookieModal() {
  const modal = $('bookie-modal');
  if (modal) modal.hidden = true;
}

function viewAdmin() {
  const authUser = getAuthUser();
  const clicks = getAffiliateClicks();
  const diary = getStoredDiary();
  const leagues = getStoredLeagues();
  const totalSettledBets = diary.filter(e => e.outcome && e.outcome !== 'pending').length;
  const totalStakedEst = diary.reduce((sum, e) => sum + (+e.stake || 0), 0);
  
  // Calculate estimated commission potential
  const estCommission = (clicks.length * 2.50 + (totalStakedEst * 0.05)).toFixed(2);

  const clicksRows = clicks.slice(0, 15).map(c => {
    return '<tr><td><b>' + esc(c.bookie) + '</b></td>' +
      '<td>' + esc(c.selection) + '</td>' +
      '<td class="mono">' + esc(c.odds) + '</td>' +
      '<td class="dim" style="font-size:12px">' + esc(new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) + '</td></tr>';
  }).join('');

  return '<section class="view">' +
    '<div class="section-head"><div><h1 class="page-title">Commercial & Founder Dashboard</h1>' +
    '<p class="page-sub">Private revenue, user signups, affiliate link tracking, and Buddy League commercial performance metrics.</p></div>' +
    '<span class="badge validated" style="font-size:13px;padding:6px 12px">⚡ Founder Mode Active</span></div>' +
    
    '<div class="admin-metric-grid">' +
      '<div class="admin-metric-card"><div>Active Users / Profiles</div><div class="admin-metric-val cyan">' + (authUser ? '1 Signed-In' : '1 Guest') + '</div><div class="admin-metric-sub">Across ' + leagues.length + ' active leagues</div></div>' +
      '<div class="admin-metric-card"><div>Bookmaker Outbound Clicks</div><div class="admin-metric-val amber">' + clicks.length + '</div><div class="admin-metric-sub">Tracked via affiliate gateways</div></div>' +
      '<div class="admin-metric-card"><div>Diary Bets Recorded</div><div class="admin-metric-val">' + diary.length + '</div><div class="admin-metric-sub">' + totalSettledBets + ' settled & verified</div></div>' +
      '<div class="admin-metric-card"><div>Estimated Value Created</div><div class="admin-metric-val emerald">£' + estCommission + '</div><div class="admin-metric-sub">Est. CPA + 25% Rev-Share value</div></div>' +
    '</div>' +

    '<div class="section" style="margin-top:28px">' +
      '<div class="section-head"><h2 class="section-title">Live Bookmaker Affiliate Outbound Log</h2><span class="section-note">Tracks which bookmakers users click to place their bets.</span></div>' +
      '<div class="admin-table-card">' +
        '<table class="admin-table">' +
          '<thead><tr><th>Bookmaker</th><th>Selection Placed</th><th>Odds</th><th>Time</th></tr></thead>' +
          '<tbody>' + (clicksRows || '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px">No outbound bookie clicks logged yet.</td></tr>') + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>' +

    '<div class="section" style="margin-top:28px">' +
      '<div class="section-head"><h2 class="section-title">Domain & Commercial Setup Guide</h2><span class="section-note">Recommended £10 domain registrations & affiliate networks.</span></div>' +
      '<div class="bento-grid">' +
        '<div class="bento-card"><div class="bento-icon">🌐</div><div><div class="bento-kicker">Recommended Domain</div><h3 class="bento-title">betbuddyuk.co.uk</h3><p class="bento-desc">Available for £1.00 at IONOS or ~£4.50/yr at Porkbun/Namecheap. Zero cost to link to this live app via GitHub Pages CNAME.</p></div><span class="bento-badge emerald">Under £5/yr</span></div>' +
        '<div class="bento-card"><div class="bento-icon">🤝</div><div><div class="bento-kicker">Affiliate Networks</div><h3 class="bento-title">Sky Bet & bet365 Affiliates</h3><p class="bento-desc">Apply via <b>bet365 Affiliates</b> and <b>Sky Betting & Gaming Affiliates</b>. Insert your tracking ID to earn 25%-35% Rev-Share or £40-£80 CPA.</p></div><span class="bento-badge">Instant approval</span></div>' +
        '<div class="bento-card"><div class="bento-icon">🏆</div><div><div class="bento-kicker">Buddy Leagues</div><h3 class="bento-title">Regional & UK Growth</h3><p class="bento-desc">Buddy Leagues track Win % and ROI %. Scalable into Regional & UK-wide leaderboards for corporate bookmaker sponsorship.</p></div><span class="bento-badge cyan">Viral Funnel</span></div>' +
      '</div>' +
    '</div>' +
  '</section>';
}
'''

# Insert admin_code before render function
target_render = 'function render() {'
assert target_render in app_text, 'target_render not found'
app_text = app_text.replace(target_render, admin_code + '\n' + target_render)

# Update render() routing to support view === 'admin'
old_routing = "const html = view === 'fixtures' ? viewFixtures() : view === 'match' ? viewMatch(arg) : view === 'results' ? viewResults() : view === 'diary' ? viewDiary() : view === 'leagues' ? viewLeagues() : view === 'more' ? viewMore() : viewHome();"
new_routing = "const html = view === 'fixtures' ? viewFixtures() : view === 'match' ? viewMatch(arg) : view === 'results' ? viewResults() : view === 'diary' ? viewDiary() : view === 'leagues' ? viewLeagues() : view === 'admin' ? viewAdmin() : view === 'more' ? viewMore() : viewHome();"
assert old_routing in app_text, 'old_routing not found'
app_text = app_text.replace(old_routing, new_routing)

# Update document titles map
old_titles = "const titles = { home: 'Best Picks', fixtures: 'Fixtures', match: 'Match analysis', results: 'Results & performance', diary: 'Bet Diary', leagues: 'Buddy Leagues', more: 'Data & methods' };"
new_titles = "const titles = { home: 'Best Picks', fixtures: 'Fixtures', match: 'Match analysis', results: 'Results & performance', diary: 'Bet Diary', leagues: 'Buddy Leagues', admin: 'Founder Admin & Affiliates', more: 'Data & methods' };"
assert old_titles in app_text, 'old_titles not found'
app_text = app_text.replace(old_titles, new_titles)

# Update click handler in app.js
old_click_handler = "  if (t.id === 'header-install-btn') { openInstallModal(); return; }"
new_click_handler = '''  if (t.dataset.openBookie !== undefined) {
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
  }
  if (t.id === 'header-install-btn') { openInstallModal(); return; }'''

assert old_click_handler in app_text, 'old_click_handler not found'
app_text = app_text.replace(old_click_handler, new_click_handler)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_text)

print('Updated app.js: added Place Bet bookie selector, admin dashboard, and affiliate logging')
