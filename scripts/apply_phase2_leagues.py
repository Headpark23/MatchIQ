import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent

# 1. Update index.html
index_path = root / 'index.html'
index_src = index_path.read_text(encoding='utf-8')

# A. Add Leagues to Nav
old_nav_item = '<a href="#/diary" data-nav="diary"><svg viewBox="0 0 24 24"><path d="M5 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2z"/><path d="M9 8h6M9 12h6"/></svg>Diary<span class="count" id="diary-count"></span></a>'
new_nav_item = old_nav_item + '\n      <a href="#/leagues" data-nav="leagues"><svg viewBox="0 0 24 24"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2M4 22h16M10 14.66V17c0 .55-.45 1-1 1H7M14 14.66V17c0 .55.45 1 1 1h2M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>Leagues</a>'

if old_nav_item in index_src and 'data-nav="leagues"' not in index_src:
    index_src = index_src.replace(old_nav_item, new_nav_item)

# B. Add League Modals at the bottom before </body>
league_modals = """
<!-- Create/Join League Modal -->
<div class="modal-backdrop" id="league-modal" hidden>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="league-modal-title">
    <div class="modal-head">
      <h2 id="league-modal-title">Buddy Leagues</h2>
      <button type="button" class="icon-btn" data-close-league aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="league-modal-tabs">
        <button type="button" class="opt active" id="tab-create-league">Create a League</button>
        <button type="button" class="opt" id="tab-join-league">Join with Code</button>
      </div>
      <form id="create-league-form" style="margin-top:14px">
        <div class="field">
          <label for="new-league-name">League Name</label>
          <input id="new-league-name" class="ctl" placeholder="e.g. The 10p Legends, Sunday Pub Crew" maxlength="32" required>
        </div>
        <p class="section-note" style="margin:8px 0 14px">Ranked strictly on Win % and ROI %. Anyone can join and compete with 10p bets on equal terms.</p>
        <button type="submit" class="btn primary full-width">Create League & Get Invite Code</button>
      </form>
      <form id="join-league-form" style="margin-top:14px" hidden>
        <div class="field">
          <label for="join-league-code">6-Character Invite Code</label>
          <input id="join-league-code" class="ctl mono uppercase" placeholder="e.g. BUDDY-7482" maxlength="16" required>
        </div>
        <p class="section-note" style="margin:8px 0 14px">Paste the code or invite link shared by your friend.</p>
        <button type="submit" class="btn primary full-width">Join League</button>
      </form>
    </div>
  </div>
</div>

<!-- Edit Username Modal -->
<div class="modal-backdrop" id="handle-modal" hidden>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="handle-modal-title">
    <form id="handle-form">
      <div class="modal-head">
        <h2 id="handle-modal-title">Player Username</h2>
        <button type="button" class="icon-btn" data-close-handle aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label for="player-handle-input">Your Custom Username / Gamertag</label>
          <input id="player-handle-input" class="ctl" placeholder="e.g. PandaPunter, TheAccaKing" maxlength="24" required>
        </div>
        <p class="section-note" style="margin:8px 0 14px">This name appears on the leaderboard in all your Buddy Leagues. Stored privately in this browser.</p>
        <button type="submit" class="btn primary full-width">Save Username</button>
      </div>
    </form>
  </div>
</div>
"""

if 'id="league-modal"' not in index_src:
    index_src = index_src.replace('</body>', league_modals + '\n</body>')

index_path.write_text(index_src, encoding='utf-8')
print("index.html leagues nav & modals updated.")

# 2. Update styles.css
styles_path = root / 'styles.css'
styles = styles_path.read_text(encoding='utf-8')

leagues_css = """
/* Phase 2: Buddy Leagues */
.fair-play-banner { display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-radius: 14px; border: 1px solid rgba(56, 189, 248, 0.3); background: linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(16, 185, 129, 0.08)); color: #fff; margin-bottom: 22px; }
.fair-play-banner b { color: var(--cyan); }
.user-profile-bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 14px; padding: 16px 20px; border-radius: 18px; border: 1px solid var(--line); background: var(--surface); backdrop-filter: blur(14px); margin-bottom: 24px; }
.profile-pill { display: inline-flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; color: #fff; }
.profile-avatar { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; font-size: 18px; background: linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(16, 185, 129, 0.25)); border: 1px solid rgba(56, 189, 248, 0.4); }
.league-selector-bar { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0 14px; margin-bottom: 12px; scrollbar-width: none; }
.league-selector-bar::-webkit-scrollbar { display: none; }
.league-tab-btn { flex: 0 0 auto; min-height: 42px; padding: 8px 16px; border-radius: 12px; border: 1px solid var(--line-strong); background: rgba(255, 255, 255, 0.04); font-size: 13.5px; font-weight: 600; color: var(--muted); cursor: pointer; transition: all .15s ease; }
.league-tab-btn:hover { border-color: var(--cyan); color: #fff; }
.league-tab-btn.active { background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(16, 185, 129, 0.2)); border-color: var(--cyan); color: #fff; box-shadow: 0 0 14px rgba(56, 189, 248, 0.2); }

.leaderboard-card { padding: 0; overflow: hidden; border-radius: 18px; border: 1px solid var(--line); background: var(--surface); backdrop-filter: blur(14px); }
.lb-table { width: 100%; border-collapse: collapse; text-align: left; }
.lb-table th { padding: 14px 16px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); border-bottom: 1px solid var(--line-strong); background: rgba(6, 11, 20, 0.6); }
.lb-table td { padding: 14px 16px; border-bottom: 1px solid var(--line); font-size: 14px; color: var(--soft); }
.lb-row:hover { background: rgba(255, 255, 255, 0.02); }
.lb-row.user-row { background: rgba(56, 189, 248, 0.06); font-weight: 600; }
.lb-row.user-row td { color: #fff; border-top: 1px solid rgba(56, 189, 248, 0.2); border-bottom: 1px solid rgba(56, 189, 248, 0.2); }
.rank-badge { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; font-weight: 700; font-family: var(--mono); font-size: 13px; }
.rank-badge.gold { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
.rank-badge.silver { background: rgba(148, 163, 184, 0.2); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.4); }
.rank-badge.bronze { background: rgba(180, 83, 9, 0.2); color: #f97316; border: 1px solid rgba(180, 83, 9, 0.4); }
.rank-badge.standard { color: var(--muted); }
.form-chips { display: flex; gap: 4px; }
.form-chip { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 4px; font-size: 10px; font-weight: 800; font-family: var(--mono); }
.form-chip.w { background: #10b981; color: #04140d; }
.form-chip.l { background: #fb7185; color: #350810; }
.form-chip.v { background: #64748b; color: #fff; }
.win-pct-pill { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 9999px; font-family: var(--mono); font-weight: 700; font-size: 13px; background: rgba(56, 189, 248, 0.12); color: var(--cyan); border: 1px solid rgba(56, 189, 248, 0.3); }
.roi-pct-pill { font-family: var(--mono); font-weight: 600; font-size: 13px; }
.roi-pct-pill.pos { color: #34d399; }
.roi-pct-pill.neg { color: #fb7185; }

.league-modal-tabs { display: flex; gap: 8px; border-bottom: 1px solid var(--line); padding-bottom: 10px; }
.league-modal-tabs .opt { padding: 8px 14px; border-radius: 10px; font-weight: 600; font-size: 13px; color: var(--muted); }
.league-modal-tabs .opt.active { background: rgba(56, 189, 248, 0.15); color: #fff; border: 1px solid rgba(56, 189, 248, 0.3); }
.full-width { width: 100%; justify-content: center; }
.uppercase { text-transform: uppercase; }
"""

if "/* Phase 2: Buddy Leagues */" not in styles:
    styles += leagues_css
    styles_path.write_text(styles, encoding='utf-8')
    print("styles.css Phase 2 leagues styling applied.")

# 3. Update app.js
app_path = root / 'app.js'
app_src = app_path.read_text(encoding='utf-8')

# A. Add Profile & Leagues storage helpers
leagues_helpers_js = """
// ------------------------------------------------------------ Phase 2: Buddy Leagues & User Profile
const USER_PROFILE_KEY = 'betbuddy_user_profile_v1';
const LEAGUES_STORAGE_KEY = 'betbuddy_leagues_v1';

function getUserProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(USER_PROFILE_KEY) || 'null');
    if (p && p.handle) return p;
  } catch (e) { /* ignore */ }
  const randomSuffix = Math.floor(Math.random() * 899 + 100);
  const defaultProfile = { handle: 'Punter_' + randomSuffix, avatar: '⚽' };
  try { localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(defaultProfile)); } catch (e) { /* ignore */ }
  return defaultProfile;
}

function saveUserProfile(handle) {
  const clean = (handle || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'Punter';
  const prof = { ...getUserProfile(), handle: clean };
  try { localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(prof)); } catch (e) { /* ignore */ }
  return prof;
}

function getUserLeagueStats() {
  const diary = getStoredDiary();
  const settled = diary.filter(e => e.outcome && e.outcome !== 'pending');
  const won = settled.filter(e => e.outcome === 'won');
  const totalStaked = settled.reduce((sum, e) => sum + (+e.stake || 0), 0);
  const totalProfit = settled.reduce((sum, e) => sum + (calc.calculateBetProfit(e.stake, e.odds, e.outcome) || 0), 0);
  const winRate = settled.length ? Math.round((won.length / settled.length) * 100) : 0;
  const roi = totalStaked > 0 ? +( (totalProfit / totalStaked) * 100 ).toFixed(1) : 0.0;
  const last5 = settled.slice(0, 5).map(e => e.outcome === 'won' ? 'W' : e.outcome === 'lost' ? 'L' : 'V');
  return { settled: settled.length, won: won.length, winRate, roi, form: last5.length ? last5 : ['—'] };
}

function getStoredLeagues() {
  try {
    const list = JSON.parse(localStorage.getItem(LEAGUES_STORAGE_KEY) || 'null');
    if (Array.isArray(list) && list.length) return list;
  } catch (e) { /* ignore */ }
  const defaults = [
    {
      id: 'league-weekend-contenders',
      name: 'Weekend Contenders',
      code: 'BUDDY-7482',
      created_at: new Date().toISOString().slice(0, 10),
      members: [
        { handle: 'ModelBenchmark', winRate: 64, roi: 18.5, settled: 28, form: ['W', 'W', 'L', 'W', 'W'], isBot: true },
        { handle: 'The10pLegend', winRate: 60, roi: 22.0, settled: 15, form: ['W', 'L', 'W', 'W', 'W'], isBot: true },
        { handle: 'AccaArchitect', winRate: 52, roi: 14.2, settled: 19, form: ['W', 'L', 'W', 'W', 'L'], isBot: true }
      ]
    }
  ];
  try { localStorage.setItem(LEAGUES_STORAGE_KEY, JSON.stringify(defaults)); } catch (e) { /* ignore */ }
  return defaults;
}

function saveStoredLeagues(leagues) {
  try { localStorage.setItem(LEAGUES_STORAGE_KEY, JSON.stringify(leagues)); } catch (e) { /* ignore */ }
}

let activeLeagueId = 'league-weekend-contenders';

function viewLeagues() {
  const prof = getUserProfile();
  const uStats = getUserLeagueStats();
  const leagues = getStoredLeagues();
  let currentLeague = leagues.find(l => l.id === activeLeagueId) || leagues[0];
  if (!currentLeague) { currentLeague = leagues[0]; activeLeagueId = currentLeague.id; }

  // Build combined leaderboard with the current user included
  const allMembers = (currentLeague.members || []).slice();
  const userEntry = { handle: prof.handle, winRate: uStats.winRate, roi: uStats.roi, settled: uStats.settled, form: uStats.form, isYou: true };
  allMembers.push(userEntry);

  // STRICT RULE: Friends leagues judged on Percentage Win, NEVER £ win.
  allMembers.sort((a, b) => (b.winRate - a.winRate) || (b.roi - a.roi) || (b.settled - a.settled));

  const rowsHtml = allMembers.map((m, idx) => {
    const rank = idx + 1;
    const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'standard';
    const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const formHtml = (m.form || ['—']).map(f => f === '—' ? '<span class="dim">—</span>' : '<span class="form-chip ' + f.toLowerCase() + '">' + f + '</span>').join('');
    const roiSign = m.roi > 0 ? '+' : '';
    const roiClass = m.roi > 0 ? 'pos' : m.roi < 0 ? 'neg' : '';
    return '<tr class="lb-row' + (m.isYou ? ' user-row' : '') + '">' +
      '<td><span class="rank-badge ' + rankClass + '">' + rankIcon + '</span></td>' +
      '<td><b>' + esc(m.handle) + '</b>' + (m.isYou ? ' <span class="bento-badge emerald" style="font-size:10px;padding:1px 6px">YOU</span>' : '') + '</td>' +
      '<td><div class="form-chips">' + formHtml + '</div></td>' +
      '<td class="num mono">' + m.settled + '</td>' +
      '<td><span class="win-pct-pill">' + m.winRate + '%</span></td>' +
      '<td><span class="roi-pct-pill ' + roiClass + '">' + roiSign + m.roi + '%</span></td>' +
    '</tr>';
  }).join('');

  const leagueTabs = leagues.map(l => '<button type="button" class="league-tab-btn' + (l.id === currentLeague.id ? ' active' : '') + '" data-select-league="' + esc(l.id) + '">' + esc(l.name) + '</button>').join('');

  return '<section class="view"><div class="section-head" style="align-items:flex-end"><div><h1 class="page-title">Buddy Leagues</h1><p class="page-sub">Compete with friends in private mini-leagues. Pure skill: judged on percentage win rate, never cash volume.</p></div>' +
    '<div class="btn-row"><button type="button" class="btn primary" data-open-league-modal>Create or Join League</button><button type="button" class="btn" data-share-league="' + esc(currentLeague.code) + '">Invite Friends</button></div></div>' +
    '<div class="fair-play-banner"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M3 9l9-6 9 6M6 15l-3-6h6l-3 6a3 3 0 0 1-6 0zm12 0l-3-6h6l-3 6a3 3 0 0 1-6 0z"/></svg>' +
      '<div><b>Fair Play Rule:</b> Ranked strictly by <b>Win Rate %</b> and <b>ROI %</b>, never £ staked. A 10p bet counts the exact same as £10.</div></div>' +
    '<div class="user-profile-bar"><div class="profile-pill"><span class="profile-avatar">' + esc(prof.avatar) + '</span><span>@' + esc(prof.handle) + '</span></div>' +
      '<div style="display:flex;gap:12px;align-items:center"><span class="dim" style="font-size:13px">Your Live Win Rate: <b class="win-pct-pill">' + uStats.winRate + '%</b> · ROI: <b class="roi-pct-pill ' + (uStats.roi >= 0 ? 'pos' : 'neg') + '">' + (uStats.roi > 0 ? '+' : '') + uStats.roi + '%</b></span>' +
      '<button type="button" class="btn small" data-open-handle-modal>Edit Username</button></div></div>' +
    '<div class="league-selector-bar">' + leagueTabs + '</div>' +
    '<div class="leaderboard-card"><div style="padding:16px 20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center">' +
      '<div><h2 class="section-title">' + esc(currentLeague.name) + '</h2><span class="section-note">Invite Code: <b class="mono" style="color:var(--cyan)">' + esc(currentLeague.code) + '</b></span></div>' +
      '<button type="button" class="btn small" data-share-league="' + esc(currentLeague.code) + '">Share Table</button></div>' +
      '<div style="overflow-x:auto"><table class="lb-table"><thead><tr><th>Rank</th><th>Player</th><th>Form</th><th class="num">Settled</th><th>Win Rate</th><th>ROI %</th></tr></thead><tbody>' +
      rowsHtml +
      '</tbody></table></div></div></section>';
}
"""

if "function viewLeagues" not in app_src:
    app_src = app_src.replace("function viewDiary() {", leagues_helpers_js + "\nfunction viewDiary() {")

# B. Update currentRoute router to handle viewLeagues and #join-league
old_route_router = "const html = view === 'fixtures' ? viewFixtures() : view === 'match' ? viewMatch(arg) : view === 'results' ? viewResults() : view === 'diary' ? viewDiary() : view === 'more' ? viewMore() : viewHome();"
new_route_router = "const html = view === 'fixtures' ? viewFixtures() : view === 'match' ? viewMatch(arg) : view === 'results' ? viewResults() : view === 'diary' ? viewDiary() : view === 'leagues' ? viewLeagues() : view === 'more' ? viewMore() : viewHome();"
if old_route_router in app_src:
    app_src = app_src.replace(old_route_router, new_route_router)

old_titles = "const titles = { home: 'Best Picks', fixtures: 'Fixtures', match: 'Match analysis', results: 'Results & performance', diary: 'Bet Diary', more: 'Data & methods' };"
new_titles = "const titles = { home: 'Best Picks', fixtures: 'Fixtures', match: 'Match analysis', results: 'Results & performance', diary: 'Bet Diary', leagues: 'Buddy Leagues', more: 'Data & methods' };"
if old_titles in app_src:
    app_src = app_src.replace(old_titles, new_titles)

# Handle incoming #join-league
old_join_hash = "if (hash.startsWith('slip=')) {"
new_join_hash = """if (hash.startsWith('join-league=')) {
    try {
      const code = decodeURIComponent(hash.slice(12)).trim().toUpperCase();
      const leagues = getStoredLeagues();
      if (!leagues.some(l => l.code === code)) {
        leagues.push({ id: 'league-' + Date.now(), name: 'Buddy League (' + code + ')', code, created_at: new Date().toISOString().slice(0, 10), members: [] });
        saveStoredLeagues(leagues);
        activeLeagueId = leagues[leagues.length - 1].id;
        toast('Joined league ' + code + '!');
      }
    } catch (e) { /* ignore */ }
    return ['leagues'];
  }
  if (hash.startsWith('slip=')) {"""
if old_join_hash in app_src and "join-league=" not in app_src:
    app_src = app_src.replace(old_join_hash, new_join_hash)

# C. Click delegation for leagues & profile
old_click_handler = "const t = event.target.closest('[data-slip],"
new_click_handler = "const t = event.target.closest('[data-open-league-modal],[data-close-league],[data-open-handle-modal],[data-close-handle],[data-share-league],[data-select-league],[data-slip],"
if old_click_handler in app_src:
    app_src = app_src.replace(old_click_handler, new_click_handler)

old_click_body = "else if (t.dataset.slip !== undefined) saveSlipToDiary(+t.dataset.slip);"
new_click_body = """else if (t.dataset.openLeagueModal !== undefined) { $('league-modal').hidden = false; }
  else if (t.dataset.closeLeague !== undefined) { $('league-modal').hidden = true; }
  else if (t.dataset.openHandleModal !== undefined) { $('player-handle-input').value = getUserProfile().handle; $('handle-modal').hidden = false; }
  else if (t.dataset.closeHandle !== undefined) { $('handle-modal').hidden = true; }
  else if (t.dataset.selectLeague !== undefined) { activeLeagueId = t.dataset.selectLeague; render(); }
  else if (t.dataset.shareLeague !== undefined) {
    const code = t.dataset.shareLeague;
    const shareText = '🏆 Join my Bet Buddy League! Code: ' + code + ' · Play with 10p bets, judged on pure Win Rate %! ' + location.origin + location.pathname + '#join-league=' + encodeURIComponent(code);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareText).then(() => toast('League invite link copied! Send it to your mates.'));
    } else if (navigator.share) {
      navigator.share({ title: 'Join Bet Buddy League', text: shareText }).catch(() => {});
    }
  }
  else if (t.id === 'tab-create-league') { $('create-league-form').hidden = false; $('join-league-form').hidden = true; t.classList.add('active'); $('tab-join-league').classList.remove('active'); }
  else if (t.id === 'tab-join-league') { $('create-league-form').hidden = true; $('join-league-form').hidden = false; t.classList.add('active'); $('tab-create-league').classList.remove('active'); }
  else if (t.dataset.slip !== undefined) saveSlipToDiary(+t.dataset.slip);"""

if old_click_body in app_src:
    app_src = app_src.replace(old_click_body, new_click_body)

# Form submits for league creation, joining, and username
league_form_submits = """
  if (event.target.id === 'create-league-form') {
    event.preventDefault();
    const name = ($('new-league-name').value || '').trim() || 'My Friends League';
    const code = 'BUDDY-' + Math.floor(Math.random() * 8999 + 1000);
    const newLeague = { id: 'league-' + Date.now(), name, code, created_at: new Date().toISOString().slice(0, 10), members: [] };
    const list = getStoredLeagues();
    list.unshift(newLeague);
    saveStoredLeagues(list);
    activeLeagueId = newLeague.id;
    $('league-modal').hidden = true;
    toast('League created! Share code ' + code + ' with friends.');
    render();
  }
  if (event.target.id === 'join-league-form') {
    event.preventDefault();
    const code = ($('join-league-code').value || '').trim().toUpperCase();
    if (!code) return;
    const list = getStoredLeagues();
    if (!list.some(l => l.code === code)) {
      list.push({ id: 'league-' + Date.now(), name: 'League ' + code, code, created_at: new Date().toISOString().slice(0, 10), members: [] });
      saveStoredLeagues(list);
    }
    activeLeagueId = (list.find(l => l.code === code) || list[0]).id;
    $('league-modal').hidden = true;
    toast('Joined league ' + code + '!');
    render();
  }
  if (event.target.id === 'handle-form') {
    event.preventDefault();
    const handle = $('player-handle-input').value;
    saveUserProfile(handle);
    $('handle-modal').hidden = true;
    toast('Username updated to @' + getUserProfile().handle + '!');
    render();
  }
"""

if "if (event.target.id === 'create-league-form')" not in app_src:
    app_src = app_src.replace("if (event.target.id === 'diary-form') handleDiaryFormSubmit(event);", "if (event.target.id === 'diary-form') handleDiaryFormSubmit(event);\n" + league_form_submits)

app_path.write_text(app_src, encoding='utf-8')
print("app.js Phase 2 leagues applied.")
