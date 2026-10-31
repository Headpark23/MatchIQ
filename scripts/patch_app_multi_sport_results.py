"""
Update app.js:
1. Add `let resultsSportFilter = 'football';`
2. In viewResults(), add top-level sport tabs:
   ⚽ Football, 🎾 Tennis, ⛳ Golf, 🎯 Darts, 🏉 Rugby
3. If resultsSportFilter === 'football', render football results view.
4. If other sport, render multi-sport settled scorecards, hit rate, and historical prediction log rows from DATA.multiSport.sports[resultsSportFilter].history.
5. In document event listeners, add `else if (t.dataset.sportRfilter) { resultsSportFilter = t.dataset.sportRfilter; render(); }`
"""

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. State variable & helper for multi-sport results
old_def = "let resultsFilter = 'settled';"
new_def = """let resultsSportFilter = 'football';
let resultsFilter = 'settled';

function renderMultiSportResults(sportKey) {
  const sportMeta = {
    tennis: { name: 'Tennis', icon: '🎾', desc: 'ATP, WTA & Grand Slam match predictions evaluated against official tour results.' },
    golf: { name: 'Golf', icon: '⛳', desc: 'PGA Tour, DP World Tour & Major top-finish and match-up picks.' },
    darts: { name: 'Darts', icon: '🎯', desc: 'PDC Premier League & World Championship match-winner predictions.' },
    rugby: { name: 'Rugby', icon: '🏉', desc: 'Six Nations, Premiership & International Test match outcomes.' }
  };
  const meta = sportMeta[sportKey] || { name: sportKey, icon: '🏆', desc: 'Verified prediction results.' };
  const multiData = (DATA.multiSport && DATA.multiSport.sports && DATA.multiSport.sports[sportKey]) || {};
  const history = multiData.history || [];
  const settled = history.filter(h => h.result === 'won' || h.result === 'lost');
  const won = settled.filter(h => h.result === 'won');
  const hitRate = settled.length ? Math.round((won.length / settled.length) * 100) : 0;

  let sportTabs = '<div class="comp-bar" role="group" aria-label="Sport Selection" style="margin-bottom:14px;">' +
    [['football', '⚽ Football'], ['tennis', '🎾 Tennis'], ['golf', '⛳ Golf'], ['darts', '🎯 Darts'], ['rugby', '🏉 Rugby']].map(([k, l]) =>
      '<button type="button" data-sport-rfilter="' + k + '" aria-pressed="' + (resultsSportFilter === k) + '">' + esc(l) + '</button>'
    ).join('') +
  '</div>';

  let html = '<section class="view"><h1 class="page-title">Results & performance</h1>' +
    '<p class="page-sub">Every prediction Bet Buddy publishes is sealed before start time and scored once the result is confirmed. Genuine real-world results only.</p>' +
    sportTabs;

  // Headline card
  const statusNote = settled.length < 10 ? 'early live tracking' : 'statistically tracking';
  html += '<div class="results-lead-card card section" style="background:linear-gradient(135deg, rgba(30,41,59,0.8), rgba(15,23,42,0.95));border:1px solid rgba(255,255,255,0.1);padding:18px 20px;border-radius:12px;margin:16px 0;">' +
    '<h2 style="font-size:20px;font-weight:700;margin:0 0 6px;color:#fff;">' + meta.icon + ' ' + meta.name + ': ' + settled.length + ' predictions settled so far (' + statusNote + ')</h2>' +
    '<p style="margin:0;font-size:14.5px;color:var(--soft);">' + won.length + ' of ' + settled.length + ' picks won (' + hitRate + '% hit rate). ' + esc(meta.desc) + '</p>' +
  '</div>';

  // Stats tiles
  html += '<div class="tiles section" style="margin-top:16px">' +
    '<div class="tile"><div class="k">Settled predictions</div><div class="v">' + settled.length + '</div><div class="s">' + won.length + ' won • ' + (settled.length - won.length) + ' lost</div></div>' +
    '<div class="tile"><div class="k">Win Rate</div><div class="v">' + (settled.length ? hitRate + '%' : '–') + '</div><div class="s">' + won.length + ' of ' + settled.length + ' landed</div></div>' +
  '</div>';

  // Prediction log rows
  const logRows = history.map(h => {
    const isWon = h.result === 'won';
    const badge = '<span class="badge ' + (isWon ? 'won' : 'lost') + '">' + (isWon ? 'Won' : 'Lost') + '</span>';
    const dateStr = h.date ? h.date.slice(0, 10) : 'Recent';
    const priceStr = h.fractional || fmtOdds(h.odds);
    return '<div class="log-row" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">' +
      '<div>' +
        '<div style="font-size:12px;color:var(--soft);font-family:var(--mono);margin-bottom:2px;">' + esc(h.tournament || meta.name) + ' &middot; ' + esc(dateStr) + '</div>' +
        '<div style="font-weight:700;color:#fff;font-size:14.5px;">' + esc(h.title) + '</div>' +
        '<div style="font-size:13px;color:var(--cyan);margin-top:2px;">Pick: <b>' + esc(h.selection) + '</b> @ ' + esc(priceStr) + ' (' + esc(h.bookmaker || 'Best Price') + ')' + (h.score ? ' &middot; <span style="color:var(--soft)">Score: ' + esc(h.score) + '</span>' : '') + '</div>' +
      '</div>' +
      '<div>' + badge + '</div>' +
    '</div>';
  }).join('');

  html += '<div class="section card" style="padding:0;margin-top:20px;">' +
    '<div class="section-head" style="padding:16px 16px 12px;border-bottom:1px solid rgba(255,255,255,0.06);">' +
      '<h2 class="section-title">' + meta.icon + ' ' + meta.name + ' Verified Prediction History</h2>' +
    '</div>' +
    (logRows || '<p class="muted" style="padding:16px">No settled records yet.</p>') +
  '</div>';

  return html + '</section>';
}"""

assert old_def in content, "old_def not found in app.js"
content = content.replace(old_def, new_def, 1)

# 2. Modify viewResults to include sport tabs and branch to multi-sport view
old_view_results = """function viewResults() {
  const allPerf = DATA.performance || {};"""

new_view_results = """function viewResults() {
  if (resultsSportFilter && resultsSportFilter !== 'football') {
    return renderMultiSportResults(resultsSportFilter);
  }

  const allPerf = DATA.performance || {};"""

assert old_view_results in content, "old_view_results not found in app.js"
content = content.replace(old_view_results, new_view_results, 1)

# 3. Add sport bar to the top of football view in viewResults
old_comp_bar = "let html = '<section class=\"view\"><h1 class=\"page-title\">Results & performance</h1><p class=\"page-sub\">Every prediction Bet Buddy publishes is sealed before kick-off and scored once the result is confirmed. Nothing here is edited after the fact.</p>' + compBar() +"

new_comp_bar = """const sportResultsBar = '<div class="comp-bar" role="group" aria-label="Sport Selection" style="margin-bottom:14px;">' +
    [['football', '⚽ Football'], ['tennis', '🎾 Tennis'], ['golf', '⛳ Golf'], ['darts', '🎯 Darts'], ['rugby', '🏉 Rugby']].map(([k, l]) =>
      '<button type="button" data-sport-rfilter="' + k + '" aria-pressed="' + (resultsSportFilter === k) + '">' + esc(l) + '</button>'
    ).join('') +
  '</div>';

  let html = '<section class="view"><h1 class="page-title">Results & performance</h1><p class="page-sub">Every prediction Bet Buddy publishes is sealed before kick-off and scored once the result is confirmed. Nothing here is edited after the fact.</p>' +
    sportResultsBar + compBar() +"""

assert old_comp_bar in content, "old_comp_bar not found in app.js"
content = content.replace(old_comp_bar, new_comp_bar, 1)

# 4. Add click listener for data-sport-rfilter
old_listener = "else if (t.dataset.rfilter) { resultsFilter = t.dataset.rfilter; render(); }"
new_listener = "else if (t.dataset.sportRfilter) { resultsSportFilter = t.dataset.sportRfilter; render(); }\n  else if (t.dataset.rfilter) { resultsFilter = t.dataset.rfilter; render(); }"

assert old_listener in content, "old_listener not found in app.js"
content = content.replace(old_listener, new_listener, 1)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully patched app.js with multi-sport results & performance!")
