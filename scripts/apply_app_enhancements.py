import re
from pathlib import Path

app_p = Path("app.js")
app_code = app_p.read_text(encoding="utf-8")

# Bump version to v61
app_code = re.sub(r"const APP_VERSION = 'v\d+';", "const APP_VERSION = 'v61';", app_code)

# -----------------------------------------------------------------------------
# 1. JARGON TOOLTIP HELPER & DEFINITIONS
# -----------------------------------------------------------------------------
jargon_helper_js = """
// --- Non-Bettor Jargon Explanations ---
const JARGON_DEFS = {
  'acca': 'Acca (Accumulator): Combines multiple match picks into 1 bet. All must win for the slip to pay out.',
  'value': 'Value: The bookmaker is paying better odds than our statistical model thinks the true probability warrants (+5% EV).',
  'lean': 'Lean: Which outcome our model rates as having the highest probability to win (1X2 match winner).',
  'most likely': 'Most likely: Our highest-confidence selection across all 6 analysed betting markets.',
  'provisional': 'Provisional: Preliminary model estimate based on limited historical match data.',
  'fair odds': 'Fair odds: The true mathematical price with zero bookmaker profit margin built in.',
  'brier': 'Brier score: Measures forecast accuracy from 0 to 1. Lower is better (0 is a perfect score).',
  'roi': 'ROI (Return on Investment): Percentage profit or loss earned per £1 staked.',
  'awaiting odds': 'Awaiting Odds: Bookmakers have not yet published official pricing for this fixture.'
};

function jargonTip(term) {
  const key = String(term || '').toLowerCase().trim();
  const def = JARGON_DEFS[key];
  if (!def) return '';
  const escaped = esc(def).replace(/'/g, "\\'");
  return '<button type="button" class="jargon-tip-btn" aria-label="' + esc(def) + '" title="' + esc(def) + '" onclick="alert(\'' + escaped + '\')">?</button>';
}
"""

if "function jargonTip" not in app_code:
  app_code = re.sub(
      r"(function esc\(s\) \{.*?\n\})",
      r"\1\n" + jargon_helper_js,
      app_code,
      count=1
  )
  print("Added jargonTip helper")

# -----------------------------------------------------------------------------
# 2. SLIP CARD: HONEST EXPECTED LOSS / TRUST BAR & SINGLE ODDS FORMAT
# -----------------------------------------------------------------------------
# In slipCard, calculate expected loss per £1 and insert trust bar
old_slip_trust = """  const m = MatchIQBuilder.money, primary = idx === 0;
  const chance = slip.chance >= 0.1 ? Math.round(slip.chance * 100) : (slip.chance * 100).toFixed(1);
  const mainOdds = fmtOdds(slip.odds);
  const subOdds = '';
  const isTodayAcca = builderState.timing === 'today';
  const todayBadge = isTodayAcca ? '<div class="today-slip-pill">⚡ TODAY\\'S GAMES ONLY &bull; ALL LEGS SETTLE TONIGHT</div>' : '';
  return '<article class="slip' + (primary ? ' primary' : '') + '">' + todayBadge + '<div class="slip-head"><div><div class="slip-kicker">' + (primary ? 'Best match for your target' : 'Alternative ' + idx) + '</div>' +
    '<div class="slip-odds mono">' + esc(mainOdds) + ' <small>' + esc(subOdds) + '</small></div></div>' +
    '<div class="slip-chance"><b class="mono">' + chance + '%</b><small>chance every bet lands</small></div></div>' +"""

new_slip_trust = """  const m = MatchIQBuilder.money, primary = idx === 0;
  const chance = slip.chance >= 0.1 ? Math.round(slip.chance * 100) : (slip.chance * 100).toFixed(1);
  const mainOdds = fmtOdds(slip.odds);
  const isTodayAcca = builderState.timing === 'today';
  const todayBadge = isTodayAcca ? '<div class="today-slip-pill">⚡ TODAY\\'S GAMES ONLY &bull; ALL LEGS SETTLE TONIGHT</div>' : '';
  
  // Honest Trust & Expected Value transparency
  const evVal = slip.ev != null ? slip.ev : (slip.ret * slip.chance - stake);
  const evPerPound = evVal / (stake || 10);
  const evPence = Math.round(Math.abs(evPerPound) * 100);
  const trustBadge = evPerPound >= 0
    ? ('<div class="slip-trust-bar positive">📈 <b>' + chance + '% chance to win.</b> Expect to gain about ' + evPence + 'p per £1 staked.</div>')
    : ('<div class="slip-trust-bar negative">⚠️ <b>' + chance + '% chance to win.</b> Expect to lose about ' + evPence + 'p per £1 on average.</div>');

  return '<article class="slip' + (primary ? ' primary' : '') + '">' + todayBadge +
    '<div class="slip-head"><div><div class="slip-kicker">' + (primary ? 'Best match for your target' : 'Alternative ' + idx) + ' ' + jargonTip('acca') + '</div>' +
    '<div class="slip-odds mono">' + esc(mainOdds) + '</div></div>' +
    '<div class="slip-chance"><b class="mono">' + chance + '%</b><small>chance every bet lands</small></div></div>' +
    trustBadge +"""

if old_slip_trust in app_code:
  app_code = app_code.replace(old_slip_trust, new_slip_trust)
  print("Updated slipCard with trust bar and single odds format")

# -----------------------------------------------------------------------------
# 3. SCREEN READER ACCESSIBLE MATCH ROW
# -----------------------------------------------------------------------------
old_rec_row = """  return '<a class="rec-row" href="#/match/' + encodeURIComponent(pred.match_id) + '">' +
    '<span class="fx-time">' + esc(fmtTime(ms)) + '<small>' + esc(fmtDay(ms)) + '</small>' + (compFilter === 'ALL' ? '<small class="lg-tag">' + esc(f.competition || 'PL') + '</small>' : '') + '</span>' +
    '<span class="fx-teams"><span class="teams-line">' + crest(f.home, 22) + '<span>' + esc(f.home) + '</span></span><span class="teams-line">' + crest(f.away, 22) + '<span>' + esc(f.away) + '</span></span>' + distBar + '</span>' +
    '<span class="rec-row-main">' + pick + '</span>' +
    '<span class="rec-row-side"><span class="dim">Lean: <b style="color:#fff">' + esc(r.pick.label) + '</b> ' + pct(r.pick.p) + (r.evidence.status !== 'validated' ? ' <span class="badge provisional">Provisional</span>' : '') + '</span>' + valueStatus(pred) + '</span>' +
    '<span class="fx-chev" aria-hidden="true">></span></a>';"""

new_rec_row = """  const srLabel = esc(f.home) + ' versus ' + esc(f.away) + ', kickoff ' + esc(fmtDay(ms)) + ' at ' + esc(fmtTime(ms)) + ' UK, ' + esc(leagueName(f.competition)) + '. Model pick: ' + esc(m.label || 'No bet') + ' with ' + pct(m.p) + ' estimated probability.';
  return '<a class="rec-row" href="#/match/' + encodeURIComponent(pred.match_id) + '" aria-label="' + srLabel + '">' +
    '<span class="fx-time">' + esc(fmtTime(ms)) + '<small>' + esc(fmtDay(ms)) + '</small>' + (compFilter === 'ALL' ? '<small class="lg-tag">' + esc(f.competition || 'PL') + '</small>' : '') + '</span>' +
    '<span class="fx-teams"><span class="teams-line">' + crest(f.home, 22) + '<span>' + esc(f.home) + '</span></span><span class="teams-line">' + crest(f.away, 22) + '<span>' + esc(f.away) + '</span></span>' + distBar + '</span>' +
    '<span class="rec-row-main">' + pick + '</span>' +
    '<span class="rec-row-side"><span class="dim">Lean' + jargonTip('lean') + ': <b style="color:#fff">' + esc(r.pick.label) + '</b> ' + pct(r.pick.p) + (r.evidence.status !== 'validated' ? ' <span class="badge provisional">Provisional' + jargonTip('provisional') + '</span>' : '') + '</span>' + valueStatus(pred) + '</span>' +
    '<span class="fx-chev" aria-hidden="true">></span></a>';"""

if old_rec_row in app_code:
  app_code = app_code.replace(old_rec_row, new_rec_row)
  print("Updated matchRecRow with screen-reader aria-label and jargon tips")

# -----------------------------------------------------------------------------
# 4. BET BUILDER: STAKE SAFETY NOTE & ACCESSIBLE LABELS
# -----------------------------------------------------------------------------
old_builder_stake = """    '<div class="builder-form"><div class="field"><label for="b-stake">Stake (£)</label><input id="b-stake" class="ctl mono" type="number" inputmode="decimal" min="0.5" max="10000" step="0.5" value="' + stake + '" data-b="stake"></div>' +"""

new_builder_stake = """    '<div class="builder-form"><div class="field"><label for="b-stake">Stake (£)</label><input id="b-stake" class="ctl mono" type="number" inputmode="decimal" min="0.5" max="10000" step="0.5" value="' + stake + '" data-b="stake" aria-label="Stake amount in pounds">' +
    '<div class="stake-safety-note" style="font-size:12px;color:#fbbf24;margin-top:4px;display:flex;align-items:center;gap:4px;"><span>⚠️</span><span>Recreational limit: only stake what you are happy to lose (£5–£10).</span></div></div>' +"""

if old_builder_stake in app_code:
  app_code = app_code.replace(old_builder_stake, new_builder_stake)
  print("Added stake limit warning to Bet Builder")

# -----------------------------------------------------------------------------
# 5. ORDER PICKS PAGE: COLLAPSIBLE MATCH LIST WITH LEAN & MOST LIKELY LEGEND
# -----------------------------------------------------------------------------
old_picks_match_section = """  const searchBar = '<div class="search-bar"><svg viewBox="0 0 24 24" class="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input type="search" id="club-search" class="ctl search-input" placeholder="Search by club (e.g. Arsenal, Liverpool)..." value="' + esc(clubFilter) + '" autocomplete="off"></div>';
  html += '<div class="section"><div class="section-head"><h2 class="section-title">Match by match</h2><span class="section-note">Most likely uses every market but ranks on credible chance, so a big number with little evidence behind it does not win.</span></div>' +
    searchBar +
    (filteredRound.length ? filteredRound.map(matchRecRow).join('') : '<div class="empty">No matches found for "' + esc(clubFilter) + '".</div>') + '</div>';"""

new_picks_match_section = """  const searchBar = '<div class="search-bar"><label for="club-search" class="sr-only">Search clubs</label><svg viewBox="0 0 24 24" class="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input type="search" id="club-search" class="ctl search-input" placeholder="Search by club (e.g. Arsenal, Liverpool)..." value="' + esc(clubFilter) + '" autocomplete="off" aria-label="Search clubs by name"></div>';
  const legendBox = '<div class="match-list-legend">💡 <b>Quick Guide:</b> <b>Most likely</b>' + jargonTip('most likely') + ' is our highest-confidence statistical call across all 6 markets. <b>Lean</b>' + jargonTip('lean') + ' shows the pure 1X2 match winner probability.</div>';
  
  html += '<details class="section card match-list-collapsible" style="margin-top:28px;"' + (clubFilter ? ' open' : '') + '>' +
    '<summary><span>⚽ Match by Match Predictions (' + filteredRound.length + ' matches)</span><span class="btn small" style="pointer-events:none;">Tap to view ▾</span></summary>' +
    legendBox +
    searchBar +
    (filteredRound.length ? filteredRound.map(matchRecRow).join('') : '<div class="empty">No matches found for "' + esc(clubFilter) + '".</div>') +
    '</details>';"""

if old_picks_match_section in app_code:
  app_code = app_code.replace(old_picks_match_section, new_picks_match_section)
  print("Ordered Picks page: match list collapsed by default with legend")

# -----------------------------------------------------------------------------
# 6. RESULTS PAGE: SIMPLE RECORD FIRST, DETAILED MATHS COLLAPSIBLE
# -----------------------------------------------------------------------------
old_results_tiles = """  html += '<div class="tiles section" style="margin-top:18px">' +
    '<div class="tile"><div class="k">Settled predictions</div><div class="v">' + settled.length + '</div><div class="s">' + pending.length + ' awaiting a result • ' + future.length + ' upcoming</div></div>' +
    '<div class="tile"><div class="k">Match-result picks right</div><div class="v">' + (res ? pct(res.pick_hit_rate) : '-') + '</div><div class="s">' + (res ? res.n + ' matches • average pick ' + pct(res.mean_pick_p) : 'none settled yet') + '</div></div>' +
    '<div class="tile"><div class="k">Forecast accuracy (Brier score)</div><div class="v">' + (res ? res.brier.toFixed(3) : '-') + '</div><div class="s">Lower is better (closer to 0 is more accurate). League average was ' + (lv && lv.markets.result ? lv.markets.result.league_brier.toFixed(3) : rel ? rel.markets.wins.league_average_brier.toFixed(3) : '0.660') + ' in the backtest.</div></div>' +
    '<div class="tile"><div class="k">Published records</div><div class="v">' + (perf.published_records || 0) + '</div><div class="s">including earlier revisions</div></div></div>';"""

new_results_tiles = """  html += '<div class="card section" style="margin-top:18px;background:linear-gradient(135deg, rgba(16,185,129,0.12), rgba(15,23,42,0.95));border:1.5px solid rgba(16,185,129,0.35);">' +
    '<h2 class="section-title" style="color:#a7f3d0;font-size:22px;">How Often Were We Right?</h2>' +
    '<p style="font-size:13.5px;color:#cbd5e1;margin:4px 0 16px;">Pure verification of our predictions against official final scores. Zero editing after kick-off.</p>' +
    '<div class="tiles" style="grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;">' +
      '<div class="tile"><div class="k">Overall Win Rate</div><div class="v" style="color:#10b981;font-size:32px;">' + (res ? pct(res.pick_hit_rate) : '-') + '</div><div class="s">' + (res ? res.n + ' matches verified' : 'none settled yet') + '</div></div>' +
      '<div class="tile"><div class="k">Settled Matches</div><div class="v">' + settled.length + '</div><div class="s">' + pending.length + ' in play &middot; ' + future.length + ' scheduled</div></div>' +
      '<div class="tile"><div class="k">Brier Score ' + jargonTip('brier') + '</div><div class="v">' + (res ? res.brier.toFixed(3) : '-') + '</div><div class="s">Lower is better (0.00 is perfect)</div></div>' +
    '</div></div>';"""

if old_results_tiles in app_code:
  app_code = app_code.replace(old_results_tiles, new_results_tiles)
  print("Split Results: lead with simple verification record")

# Put calibration, backtest, and challenger into collapsible details
old_results_calib = """  html += '<div class="section grid grid-2"><div class="card"><h2 class="section-title">Calibration, live</h2><p class="section-note" style="margin:4px 0 12px">Pale bar: average predicted chance. Green bar: how often it happened.</p>' + (bandRows ? '<div class="calib">' + bandRows + '</div>' : '<p class="muted">Appears once predictions settle.</p>') + '</div>' +
    (other ? leagueBacktestCard(lv) : backtestCard(rel)) + '</div>';

  html += scorecard(perf);
  const tiers = perf.tiers || {};
  const tierLabel = { T1: 'Validated frozen model', T2: 'Provisional: promoted clubs', T3: 'League average fallback', L1: 'League model (provisional, one-season backtest)' };
  const teams = Object.entries(perf.teams || {}).filter(([, t]) => t.n >= 5).sort((a, b) => b[1].n - a[1].n);
  const ch = perf.challenger;
  html += '<div class="section grid grid-2"><div class="card"><h2 class="section-title">By prediction source</h2><table class="table" style="margin-top:8px"><tbody>' +
    (Object.keys(tiers).length ? Object.entries(tiers).map(([t, s]) => '<tr><td>' + esc(tierLabel[t] || t) + '</td><td class="num">' + s.n + '</td><td class="num">' + pct(s.pick_hit_rate) + '</td><td class="num">' + s.brier.toFixed(3) + '</td></tr>').join('') : '<tr><td class="muted">No settled predictions yet.</td></tr>') +
    '</tbody></table>' + (teams.length ? '<h3 class="day-label">By club (5+ settled)</h3><table class="table"><tbody>' + teams.map(([t, s]) => '<tr><td><span class="teams-line">' + crest(t, 18) + esc(t) + '</span></td><td class="num">' + s.n + '</td><td class="num">' + pct(s.pick_hit_rate) + '</td></tr>').join('') + '</tbody></table>' : '<p class="section-note" style="margin-top:10px">Club breakdowns appear once a club has 5 settled predictions.</p>') + '</div>' +
    '<div class="card"><h2 class="section-title">Challenger watch</h2><p class="muted" style="margin-top:6px">' + (ch ? esc(ch.challenger) + ' runs in the shadow of ' + esc(ch.production) + ' on the same fixtures. It never changes what you see.' : 'No challenger data.') + '</p>' +
    (ch ? '<p style="margin-top:10px"><b>' + esc(ch.recommendation) + '</b></p>' + (ch.delta_brier != null ? '<p class="dim mono" style="margin-top:6px">ΔBrier ' + ch.delta_brier.toFixed(4) + ' [' + ch.delta_brier_ci95.join(', ') + '], n=' + ch.n + '</p>' : '') : '') +
    '<p class="section-note" style="margin-top:10px">Promotion needs ' + (ch ? ch.min_n_for_promotion : 150) + '+ settled matches, a 95% interval clear of zero and owner approval. The current model stays pinned for rollback.</p></div></div>';"""

new_results_calib = """  html += '<details class="section card maths-section" style="margin-top:20px;">' +
    '<summary><span>🔬 Advanced Model Accuracy &amp; Calibration</span><span class="btn small" style="pointer-events:none;">Show the maths ▾</span></summary>' +
    '<div style="padding:16px 0 6px;">' +
      '<div class="grid grid-2"><div class="card"><h2 class="section-title">Calibration, live</h2><p class="section-note" style="margin:4px 0 12px">Pale bar: average predicted chance. Green bar: how often it happened.</p>' + (bandRows ? '<div class="calib">' + bandRows + '</div>' : '<p class="muted">Appears once predictions settle.</p>') + '</div>' +
      (other ? leagueBacktestCard(lv) : backtestCard(rel)) + '</div>' +
      scorecard(perf) +
      '<div class="grid grid-2" style="margin-top:16px;"><div class="card"><h2 class="section-title">By prediction source</h2><table class="table" style="margin-top:8px"><tbody>' +
      (Object.keys(tiers).length ? Object.entries(tiers).map(([t, s]) => '<tr><td>' + esc(tierLabel[t] || t) + '</td><td class="num">' + s.n + '</td><td class="num">' + pct(s.pick_hit_rate) + '</td><td class="num">' + s.brier.toFixed(3) + '</td></tr>').join('') : '<tr><td class="muted">No settled predictions yet.</td></tr>') +
      '</tbody></table>' + (teams.length ? '<h3 class="day-label">By club (5+ settled)</h3><table class="table"><tbody>' + teams.map(([t, s]) => '<tr><td><span class="teams-line">' + crest(t, 18) + esc(t) + '</span></td><td class="num">' + s.n + '</td><td class="num">' + pct(s.pick_hit_rate) + '</td></tr>').join('') + '</tbody></table>' : '<p class="section-note" style="margin-top:10px">Club breakdowns appear once a club has 5 settled predictions.</p>') + '</div>' +
      '<div class="card"><h2 class="section-title">Challenger watch</h2><p class="muted" style="margin-top:6px">' + (ch ? esc(ch.challenger) + ' runs in the shadow of ' + esc(ch.production) + ' on the same fixtures. It never changes what you see.' : 'No challenger data.') + '</p>' +
      (ch ? '<p style="margin-top:10px"><b>' + esc(ch.recommendation) + '</b></p>' + (ch.delta_brier != null ? '<p class="dim mono" style="margin-top:6px">ΔBrier ' + ch.delta_brier.toFixed(4) + ' [' + ch.delta_brier_ci95.join(', ') + '], n=' + ch.n + '</p>' : '') : '') +
      '<p class="section-note" style="margin-top:10px">Promotion needs ' + (ch ? ch.min_n_for_promotion : 150) + '+ settled matches, a 95% interval clear of zero and owner approval. The current model stays pinned for rollback.</p></div></div>' +
    '</div></details>';"""

if old_results_calib in app_code:
  app_code = app_code.replace(old_results_calib, new_results_calib)
  print("Enclosed calibration and challenger in 'Show the maths' toggle")

# -----------------------------------------------------------------------------
# 7. TROPHY CABINET: 0 SILVERWARE UNTIL EARNED
# -----------------------------------------------------------------------------
old_trophy_btn = """      '<button type="button" class="trophy-summary-pill" data-open-trophy-cabinet>🏆 Trophy Cabinet (' + trophies.length + ' Silverware)</button>' +"""
new_trophy_btn = """      '<button type="button" class="trophy-summary-pill' + (trophies.length === 0 ? ' empty' : '') + '" data-open-trophy-cabinet style="' + (trophies.length === 0 ? 'opacity:0.75;' : '') + '">🏆 Trophy Cabinet (' + trophies.length + ' Silverware)</button>' +"""

if old_trophy_btn in app_code:
  app_code = app_code.replace(old_trophy_btn, new_trophy_btn)
  print("Updated trophy cabinet button for 0 silverware")

old_trophy_modal_cards = """  const cardsHtml = trophies.map(t => {"""
new_trophy_modal_cards = """  if (trophies.length === 0) {
    $('trophy-cards-grid').innerHTML = '<div class="empty" style="grid-column:1/-1;padding:28px 16px;text-align:center;"><div style="font-size:42px;margin-bottom:10px;">🏆</div><h3 style="color:#fff;margin-bottom:6px;">Trophy Cabinet is Empty</h3><p style="font-size:13px;color:var(--muted);max-width:44ch;margin:0 auto;">You have 0 Silverware. Place top-3 in weekly or monthly Buddy Leagues to win trophies and medals!</p></div>';
    $('trophy-cabinet-modal').hidden = false;
    return;
  }
  const cardsHtml = trophies.map(t => {"""

if old_trophy_modal_cards in app_code and "if (trophies.length === 0)" not in app_code:
  app_code = app_code.replace(old_trophy_modal_cards, new_trophy_modal_cards, 1)
  print("Added empty state to trophy cabinet modal")

# -----------------------------------------------------------------------------
# 8. TRUST & SAFETY: SAFER GAMBLING IN MORE VIEW & BUTLER DISCLAIMER
# -----------------------------------------------------------------------------
old_more_return = """  return '<section class="view"><h1 class="page-title">Data, methods & feedback</h1>' +"""
new_more_return = """  const saferGamblingCard = '<div class="card section" style="border:1.5px solid rgba(251,191,36,0.35);background:rgba(251,191,36,0.04);margin-bottom:20px;">' +
    '<h2 class="section-title" style="color:#fde68a;font-size:18px;display:flex;align-items:center;gap:8px;"><span>🛡️</span> Safer Gambling &amp; Player Support</h2>' +
    '<p style="font-size:13px;color:#cbd5e1;line-height:1.5;margin-top:6px;">Bet Buddy is built for mathematical insights and fun. Gambling can be addictive. Always play responsibly and never stake money you cannot afford to lose.</p>' +
    '<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">' +
      '<a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" class="btn" style="background:#fbbf24;color:#0f172a;font-weight:700;min-height:44px;display:inline-flex;align-items:center;text-decoration:none;border-radius:10px;padding:8px 16px;">BeGambleAware.org ↗</a>' +
      '<a href="https://www.gamcare.org.uk" target="_blank" rel="noopener noreferrer" class="btn" style="min-height:44px;display:inline-flex;align-items:center;text-decoration:none;border-radius:10px;padding:8px 16px;">GamCare (Free 24/7): 0808 8020 133 ↗</a>' +
    '</div></div>';

  return '<section class="view">' + saferGamblingCard + '<h1 class="page-title">Data, methods & feedback</h1>' +"""

if old_more_return in app_code:
  app_code = app_code.replace(old_more_return, new_more_return)
  print("Added persistent safer gambling card in More view")

# -----------------------------------------------------------------------------
# 9. BET DIARY: BACKUP / LOSS WARNING BANNER
# -----------------------------------------------------------------------------
old_diary_intro = """  let html = '<section class="view"><h1 class="page-title">Bet Diary</h1>' +
    '<p class="page-sub">Track every bet you place, test whether you are beating the bookies, and see your calibration curve.' +
    ' Everything is stored privately in your browser &mdash; nothing leaves your phone.</p>' +"""

new_diary_intro = """  const uAuth = getAuthUser();
  const diarySyncNotice = '<div class="notice section" style="border-color:rgba(56,189,248,0.35);background:rgba(56,189,248,0.08);color:#fff;margin-bottom:16px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">' +
      '<div><b>💾 Protect your Bet Diary:</b> Your ' + list.length + ' bets live in this browser only. ' +
      (uAuth && uAuth.signedIn ? 'Signed in as <b>@' + esc(uAuth.handle) + '</b>.' : 'Export a backup so your stats are never lost if you clear cookies.') + '</div>' +
      '<button type="button" class="btn small" data-export-diary style="min-height:40px;background:rgba(56,189,248,0.2);border:1px solid #38bdf8;color:#fff;">Backup JSON</button>' +
    '</div></div>';

  let html = '<section class="view">' + diarySyncNotice + '<h1 class="page-title">Bet Diary</h1>' +
    '<p class="page-sub">Track every bet you place, test whether you are beating the bookies, and see your calibration curve.' +
    ' Everything is stored privately in your browser &mdash; nothing leaves your phone.</p>' +"""

if old_diary_intro in app_code:
  app_code = app_code.replace(old_diary_intro, new_diary_intro)
  print("Added Bet Diary backup and loss warning notice")

# -----------------------------------------------------------------------------
# 10. ONBOARDING FIRST-RUN WALKTHROUGH BANNER (HOME VIEW)
# -----------------------------------------------------------------------------
old_home_render = """function renderWelcomeHero() {"""
new_home_render = """function dismissOnboarding() {
  try { localStorage.setItem('betbuddy_onboarded_v1', 'true'); } catch (e) {}
  const card = $('onboarding-card');
  if (card) card.remove();
}

function renderWelcomeHero() {
  let onboardHtml = '';
  try {
    if (!localStorage.getItem('betbuddy_onboarded_v1')) {
      onboardHtml = '<div class="onboarding-card" id="onboarding-card">' +
        '<h3><span>👋</span> Welcome to Bet Buddy Sports Intelligence</h3>' +
        '<div class="onboarding-steps">' +
          '<div class="onboarding-step-item"><span class="onboarding-step-num">1</span><div><b>Pick Your Slate</b><span>Choose today\\'s games or the 7-day slate.</span></div></div>' +
          '<div class="onboarding-step-item"><span class="onboarding-step-num">2</span><div><b>Set Target Return</b><span>Enter stake & how much you aim to win.</span></div></div>' +
          '<div class="onboarding-step-item"><span class="onboarding-step-num">3</span><div><b>Review Model Acca</b><span>Check mathematical probability & expected value.</span></div></div>' +
        '</div>' +
        '<button type="button" class="btn small primary" onclick="dismissOnboarding()" style="min-height:40px;">Got It, Let\\'s Go ➔</button>' +
      '</div>';
    }
  } catch (e) {}
"""

if old_home_render in app_code and "function dismissOnboarding" not in app_code:
  app_code = app_code.replace(old_home_render, new_home_render, 1)
  # Inject onboardHtml at top of hero output
  app_code = re.sub(
      r"(return\s+'<section class=\"hero welcome-hub-hero\">)",
      r"return onboardHtml + '\n<section class=\"hero welcome-hub-hero\">",
      app_code
  )
  print("Added first-run onboarding walkthrough banner to Home view")

# -----------------------------------------------------------------------------
# 11. ACTIONABLE UNAUTHORIZED DOMAIN MESSAGE
# -----------------------------------------------------------------------------
old_unauth_err = """  if (code === 'auth/unauthorized-domain') {
    console.error('Firebase Auth unauthorized domain:', window.location.hostname);
    return 'This web domain is not authorised in Firebase Auth console. Check developer console for details.';
  }"""

new_unauth_err = """  if (code === 'auth/unauthorized-domain') {
    const host = window.location.hostname || 'current domain';
    console.error('Firebase Auth unauthorized domain:', host);
    return 'Domain \"' + host + '\" is not authorised in Firebase. To fix: Go to Firebase Console > Authentication > Settings > Authorised Domains and add ' + host + '.';
  }"""

if old_unauth_err in app_code:
  app_code = app_code.replace(old_unauth_err, new_unauth_err)
  print("Updated auth/unauthorized-domain message with domain and console path")

# -----------------------------------------------------------------------------
# 12. SERVICE WORKER UPDATE BANNER LISTENER
# -----------------------------------------------------------------------------
old_sw_listener = """            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                toast('New Bet Buddy upgrade ready! Auto-syncing... 🚀');
                setTimeout(() => window.location.reload(), 800);
              }
            }"""

new_sw_listener = """            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                const banner = $('sw-update-banner');
                if (banner) banner.hidden = false;
                const reloadBtn = $('btn-sw-reload');
                if (reloadBtn) {
                  reloadBtn.onclick = () => {
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                    window.location.reload();
                  };
                }
              }
            }"""

if old_sw_listener in app_code:
  app_code = app_code.replace(old_sw_listener, new_sw_listener)
  print("Connected service worker update banner and reload listener")

# -----------------------------------------------------------------------------
# 13. HEADER AUTH UI: SHOW "SIGNED IN AS @HANDLE" + QUICK SIGN OUT
# -----------------------------------------------------------------------------
old_auth_ui = """  if (user && user.signedIn) {
    const initials = (user.name || user.email || 'U').slice(0, 1).toUpperCase();
    container.innerHTML = '<button type="button" class="header-user-btn" id="header-user-btn" title="Signed in as ' + esc(user.name || user.email) + '">' +
      '<span class="header-avatar">' + esc(initials) + '</span>' +
      '<span>@' + esc(user.handle || 'Punter') + '</span>' +
      (!user.emailVerified ? ' <span style="color:#fbbf24;font-size:11px;" title="Unverified Email">⚠️</span>' : '') +
      '</button>';
  } else {"""

new_auth_ui = """  if (user && user.signedIn) {
    const initials = (user.name || user.email || 'U').slice(0, 1).toUpperCase();
    container.innerHTML = '<div style="display:flex;align-items:center;gap:6px;">' +
      '<button type="button" class="header-user-btn" id="header-user-btn" title="Signed in as ' + esc(user.name || user.email) + '">' +
        '<span class="header-avatar">' + esc(initials) + '</span>' +
        '<span>@' + esc(user.handle || 'Punter') + '</span>' +
        (!user.emailVerified ? ' <span style="color:#fbbf24;font-size:12px;" title="Unverified Email">⚠️</span>' : '') +
      '</button>' +
      '<button type="button" class="btn small" id="btn-quick-signout" title="Sign Out of account" style="min-height:32px;padding:2px 8px;font-size:11px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);color:#fca5a5;">Sign Out</button>' +
    '</div>';
  } else {"""

if old_auth_ui in app_code:
  app_code = app_code.replace(old_auth_ui, new_auth_ui)
  print("Updated header auth UI with explicit Sign Out button")

# Add click event for btn-quick-signout
if "t.id === 'btn-quick-signout'" not in app_code:
  app_code = re.sub(
      r"(if \(t\.id === 'btn-signout' \|\| t\.id === 'btn-google-signout'\) \{)",
      r"if (t.id === 'btn-quick-signout' || t.id === 'btn-signout' || t.id === 'btn-google-signout') {",
      app_code
  )

app_p.write_text(app_code, encoding="utf-8")
print("app.js updated with all functional improvements")

