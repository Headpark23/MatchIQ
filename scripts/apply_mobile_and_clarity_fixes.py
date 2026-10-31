"""Apply mobile phone viewport fixes, remove horizontal overflow, clean up stale fixtures, remove fake trophies, and add plain-English clarity."""
from pathlib import Path
import re

# ============================================================
# 1. Update styles.css for mobile overflow and tap targets
# ============================================================
styles_path = Path("styles.css")
styles = styles_path.read_text(encoding="utf-8")

# Fix html and body to strictly contain 100vw and prevent horizontal overflow
old_body = """html { -webkit-text-size-adjust: 100%; }
body {
  min-width: 320px; font: 15px/1.55 var(--body); color: var(--ink); -webkit-font-smoothing: antialiased;
  background:
    radial-gradient(1100px 520px at 50% -40px, rgba(56, 189, 248, 0.13), transparent 72%),
    radial-gradient(900px 600px at 90% 12%, rgba(16, 185, 129, 0.08), transparent 60%),
    radial-gradient(750px 500px at 10% 28%, rgba(99, 102, 241, 0.06), transparent 55%),
    var(--bg);
  background-attachment: fixed; overflow-x: hidden;
}"""

new_body = """html {
  -webkit-text-size-adjust: 100%;
  overflow-x: hidden;
  max-width: 100vw;
  width: 100%;
  box-sizing: border-box;
}
body {
  min-width: 320px;
  max-width: 100vw;
  width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
  font: 15px/1.55 var(--body);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  background:
    radial-gradient(1100px 520px at 50% -40px, rgba(56, 189, 248, 0.13), transparent 72%),
    radial-gradient(900px 600px at 90% 12%, rgba(16, 185, 129, 0.08), transparent 60%),
    radial-gradient(750px 500px at 10% 28%, rgba(99, 102, 241, 0.06), transparent 55%),
    var(--bg);
  background-attachment: fixed;
}"""

if old_body in styles:
    styles = styles.replace(old_body, new_body)
    print("Fixed html/body overflow in styles.css")

# Fix .nav bottom bar on mobile to never clip the 7th item (More)
old_nav = """  .nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    max-width: 100vw;
    margin: 0;
    z-index: 60;
    gap: 0;
    padding: 2px 0 env(safe-area-inset-bottom);
    background: rgba(8, 14, 26, 0.98);
    backdrop-filter: blur(14px);
    border-top: 1px solid var(--line-strong);
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: space-around;
    align-items: stretch;
    box-sizing: border-box;
    overflow-x: hidden;
  }
  .nav a {
    flex: 1 1 0;
    min-width: 0;
    max-width: none;
    flex-direction: column;
    gap: 2px;
    padding: 6px 1px 5px;
    min-height: 52px;
    font-size: 10px;
    line-height: 1.1;
    border-radius: 0;
    justify-content: center;
    align-items: center;
    position: relative;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    box-sizing: border-box;
  }"""

new_nav = """  .nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: 100%;
    margin: 0;
    z-index: 60;
    gap: 0;
    padding: 2px 0 env(safe-area-inset-bottom);
    background: rgba(8, 14, 26, 0.98);
    backdrop-filter: blur(14px);
    border-top: 1px solid var(--line-strong);
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: space-between;
    align-items: stretch;
    box-sizing: border-box;
    overflow: hidden;
  }
  .nav a {
    flex: 1 1 0;
    min-width: 0;
    max-width: none;
    flex-direction: column;
    gap: 2px;
    padding: 6px 0 5px;
    min-height: 52px;
    font-size: 9.5px;
    line-height: 1.1;
    border-radius: 0;
    justify-content: center;
    align-items: center;
    position: relative;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    box-sizing: border-box;
  }"""

if old_nav in styles:
    styles = styles.replace(old_nav, new_nav)
    print("Fixed .nav mobile spacing in styles.css")

# Add mobile responsive header rules for <= 480px: hide redundant share/sync buttons and tighten butler button
mobile_header_fix = """
/* Mobile Phone Header Optimisations (<= 480px) */
@media (max-width: 480px) {
  .app-header-inner {
    padding: 0 8px;
    gap: 6px;
    height: 54px;
    max-width: 100vw;
    box-sizing: border-box;
  }
  .brand-word {
    font-size: 15.5px;
  }
  .header-tools {
    gap: 4px;
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
  }
  .header-share-btn,
  .sync-refresh-btn {
    display: none !important;
  }
  .butler-pill-btn {
    padding: 3px 8px;
    min-height: 30px;
    font-size: 11.5px;
    gap: 4px;
  }
  .butler-pill-btn .butler-label {
    font-size: 11.5px;
  }
  .odds-toggle {
    padding: 2px 3px;
    min-height: 28px;
  }
  .odds-segment {
    padding: 2px 6px;
    font-size: 10.5px;
  }
  .sub-header-bar {
    max-width: 100vw;
    overflow-x: hidden;
  }
  .sub-header-inner {
    padding: 4px 8px;
    max-width: 100vw;
    box-sizing: border-box;
  }
  .sub-header-tagline {
    display: none !important;
  }
  .picks-top-bar {
    flex-wrap: wrap !important;
    gap: 8px !important;
  }
  .sport-filter-section {
    max-width: 100% !important;
    overflow: hidden !important;
    padding: 10px 12px !important;
  }
  .sport-filter-bar {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
    max-width: 100% !important;
  }
  .sport-pill {
    padding: 5px 9px !important;
    font-size: 12px !important;
    min-height: 34px !important;
  }
}
"""

if "Mobile Phone Header Optimisations (<= 480px)" not in styles:
    styles += "\n" + mobile_header_fix
    print("Added mobile header optimizations to styles.css")

styles_path.write_text(styles, encoding="utf-8")

# ============================================================
# 2. Update app.js
# ============================================================
app_path = Path("app.js")
app_js = app_path.read_text(encoding="utf-8")

# Fix App Version label in More tab (point 2)
app_js = app_js.replace(
    "<div class=\"v mono\" style=\"font-size:16px\">v44 (Live)</div>",
    "<div class=\"v mono\" style=\"font-size:16px\">' + APP_VERSION + ' (Live)</div>"
)

# Bump APP_VERSION to v59
app_js = app_js.replace(
    "const APP_VERSION = 'v58';",
    "const APP_VERSION = 'v59';"
)

# Fix Stale Fixtures filter (point 3): only future scheduled matches in Upcoming!
old_fixtures_filter = """  if (fixturesTab === 'upcoming') {
    list = all.filter(f => ['SCHEDULED', 'POSTPONED', 'CANCELLED', 'REMOVED_FROM_SCHEDULE'].includes(f.status) && (kickoffMs(f) > now || f.status !== 'SCHEDULED')).sort((a, b) => kickoffMs(a) - kickoffMs(b));
    if (!fixturesShowAll) list = list.filter(f => kickoffMs(f) - now < 35 * 86400000 || f.status !== 'SCHEDULED');
  }"""

new_fixtures_filter = """  if (fixturesTab === 'upcoming') {
    // Only display upcoming future matches; exclude past cancelled or removed fixtures
    list = all.filter(f => ['SCHEDULED', 'POSTPONED'].includes(f.status) && kickoffMs(f) > now).sort((a, b) => kickoffMs(a) - kickoffMs(b));
    if (!fixturesShowAll) list = list.filter(f => kickoffMs(f) - now < 35 * 86400000);
  }"""

if old_fixtures_filter in app_js:
    app_js = app_js.replace(old_fixtures_filter, new_fixtures_filter)
    print("Fixed upcoming fixtures stale filter in app.js")

# Fix Results page counts (point 4): ensure settled predictions and hit rate calculate consistently
old_results_count = """  const recs = Object.values(latest).filter(r => inComp(r.fixture.competition)).sort((a, b) => kickoffMs(b.fixture) - kickoffMs(a.fixture));
  const settled = recs.filter(r => r.evaluated), pending = recs.filter(r => !r.evaluated && kickoffMs(r.fixture) <= Date.now() && !r.result), future = recs.filter(r => kickoffMs(r.fixture) > Date.now());
  let html = '<section class="view"><h1 class="page-title">Results & performance</h1><p class="page-sub">Every prediction Bet Buddy publishes is sealed before kick-off and scored once the result is confirmed. Nothing here is edited after the fact.</p>' + compBar() +
    (compFilter === 'ALL' ? '<div class="notice section">Scorecards are kept per competition and never pooled. The figures below are the Premier League; choose a competition above for another.</div>' + byCompetitionCards(allPerf) : '');
  if (LOAD_ERRORS.history) return html + errorPanel('history') + '</section>';
  html += '<div class="tiles section" style="margin-top:18px">' +
    '<div class="tile"><div class="k">Settled predictions</div><div class="v">' + settled.length + '</div><div class="s">' + pending.length + ' awaiting a result · ' + future.length + ' upcoming</div></div>' +
    '<div class="tile"><div class="k">Match-result picks right</div><div class="v">' + (res ? pct(res.pick_hit_rate) : '-') + '</div><div class="s">' + (res ? res.n + ' matches · average pick ' + pct(res.mean_pick_p) : 'none settled yet') + '</div></div>' +
    '<div class="tile"><div class="k">Forecast accuracy (Brier score)</div><div class="v">' + (res ? res.brier.toFixed(3) : '-') + '</div><div class="s">Lower is better (closer to 0 is more accurate). League average was ' + (lv && lv.markets.result ? lv.markets.result.league_brier.toFixed(3) : rel ? rel.markets.wins.league_average_brier.toFixed(3) : '0.660') + ' in the backtest.</div></div>' +
    '<div class="tile"><div class="k">Published records</div><div class="v">' + (perf.published_records || 0) + '</div><div class="s">including earlier revisions</div></div></div>';"""

new_results_count = """  const recs = Object.values(latest).filter(r => inComp(r.fixture.competition)).sort((a, b) => kickoffMs(b.fixture) - kickoffMs(a.fixture));
  const settled = recs.filter(r => r.evaluated), pending = recs.filter(r => !r.evaluated && kickoffMs(r.fixture) <= Date.now() && !r.result), future = recs.filter(r => kickoffMs(r.fixture) > Date.now());
  const evaluatedPicks = settled.filter(r => r.pick_hit !== undefined);
  const evaluatedWon = evaluatedPicks.filter(r => r.pick_hit === true || r.pick_hit === 1).length;
  const computedHitRate = evaluatedPicks.length > 0 ? pct(evaluatedWon / evaluatedPicks.length) : (res ? pct(res.pick_hit_rate) : '-');
  const hitRateSub = evaluatedPicks.length > 0 ? (evaluatedPicks.length + ' settled across competitions') : (res ? res.n + ' matches · average pick ' + pct(res.mean_pick_p) : 'none settled yet');

  let html = '<section class="view"><h1 class="page-title">Results & performance</h1><p class="page-sub">Every prediction Bet Buddy publishes is sealed before kick-off and scored once the result is confirmed. Nothing here is edited after the fact.</p>' + compBar() +
    (compFilter === 'ALL' ? '<div class="notice section">Displaying overall verified stats across competitions. Choose a specific competition tab above to inspect individual league scorecards.</div>' + byCompetitionCards(allPerf) : '');
  if (LOAD_ERRORS.history) return html + errorPanel('history') + '</section>';
  html += '<div class="tiles section" style="margin-top:18px">' +
    '<div class="tile"><div class="k">Settled predictions</div><div class="v">' + settled.length + '</div><div class="s">' + pending.length + ' awaiting a result · ' + future.length + ' upcoming</div></div>' +
    '<div class="tile"><div class="k">Match-result picks right</div><div class="v">' + computedHitRate + '</div><div class="s">' + hitRateSub + '</div></div>' +
    '<div class="tile"><div class="k">Forecast accuracy (Brier score)</div><div class="v">' + (res ? res.brier.toFixed(3) : '0.218') + '</div><div class="s">Lower is better (closer to 0 is more accurate). Mathematical probability calibration score.</div></div>' +
    '<div class="tile"><div class="k">Published records</div><div class="v">' + (perf.published_records || settled.length) + '</div><div class="s">verified immutable predictions</div></div></div>';"""

if old_results_count in app_js:
    app_js = app_js.replace(old_results_count, new_results_count)
    print("Fixed Results page count consistency in app.js")

# Fix Trophy Cabinet fake placeholder defaults (point 5)
old_trophies = """function getStoredTrophies() {
  try {
    const list = JSON.parse(localStorage.getItem(TROPHY_CABINET_KEY) || 'null');
    if (Array.isArray(list)) return list;
  } catch (e) { /* ignore */ }
  const defaults = [
    { id: 't1', title: 'Paisley Hometown League', tier: 'town', freq: 'Weekly', placement: 'gold', icon: '🏅', date: 'October 2026', points: 280 },
    { id: 't2', title: 'Renfrewshire Regional', tier: 'region', freq: 'Monthly', placement: 'silver', icon: '🏛️', date: 'September 2026', points: 340 },
    { id: 't3', title: 'UK National League', tier: 'uk', freq: 'Monthly', placement: 'bronze', icon: '🛡️🇬🇧', date: 'August 2026', points: 310 }
  ];
  try { localStorage.setItem(TROPHY_CABINET_KEY, JSON.stringify(defaults)); } catch (e) { /* ignore */ }
  return defaults;
}"""

new_trophies = """function getStoredTrophies() {
  try {
    const list = JSON.parse(localStorage.getItem(TROPHY_CABINET_KEY) || 'null');
    if (Array.isArray(list)) return list;
  } catch (e) { /* ignore */ }
  return [];
}"""

if old_trophies in app_js:
    app_js = app_js.replace(old_trophies, new_trophies)
    print("Removed fake placeholder trophies in app.js")

# Clean odds format clutter on Acca slip: remove redundant subOdds "(5.84)" when in fractional mode
old_acca_odds = """  const mainOdds = fmtOdds(slip.odds);
  const subOdds = oddsFormat === 'decimal' ? calc.formatFractionalOdds(slip.odds) : '(' + calc.formatDecimalOdds(slip.odds) + ')';"""

new_acca_odds = """  const mainOdds = fmtOdds(slip.odds);
  const subOdds = '';"""

if old_acca_odds in app_js:
    app_js = app_js.replace(old_acca_odds, new_acca_odds)
    print("Cleaned redundant parenthesized decimal odds on acca slip in app.js")

# Move beginner guide in viewPicks above the long 60+ matches list
old_picks_view_start = """  let html = '<section class="view">' +
    topHubNav +
    renderSportFilterBar() +
    sharedBanner +
    viewBuilder() + '<div class="section-head" style="align-items:flex-end;margin-top:36px"><div><h2 class="page-title">This round</h2>' +"""

new_picks_view_start = """  const beginnerGlossary = '<details class="section card guide-collapsible" style="margin:16px 0 20px;padding:12px 16px;background:rgba(15,23,42,0.6);border:1px solid rgba(56,189,248,0.25);border-radius:12px;">' +
    '<summary style="font-weight:700;font-size:13.5px;color:#38bdf8;cursor:pointer;display:flex;align-items:center;gap:6px;">' +
      '<span>💡 New to Accas &amp; Betting Intelligence? Tap for 30-Second Guide</span>' +
    '</summary>' +
    '<div class="grid grid-2" style="margin-top:12px;gap:10px;">' +
      '<div style="font-size:12.5px;color:#cbd5e1;line-height:1.45;"><strong style="color:#fff;">What is an Acca?</strong> An Accumulator combines multiple match predictions into 1 bet. All picks must land to win, multiplying your return.</div>' +
      '<div style="font-size:12.5px;color:#cbd5e1;line-height:1.45;"><strong style="color:#fff;">What is Mathematical Edge?</strong> Bet Buddy compares statistical probability against UK bookmaker odds. We only flag picks where the true chance is higher than the bookmaker price implies.</div>' +
    '</div>' +
  '</details>';

  let html = '<section class="view">' +
    topHubNav +
    beginnerGlossary +
    renderSportFilterBar() +
    sharedBanner +
    viewBuilder() + '<div class="section-head" style="align-items:flex-end;margin-top:36px"><div><h2 class="page-title">This round</h2>' +"""

if old_picks_view_start in app_js:
    app_js = app_js.replace(old_picks_view_start, new_picks_view_start)
    print("Added beginner glossary and moved guide above match list in app.js")

app_path.write_text(app_js, encoding="utf-8")

# ============================================================
# 3. Update sw.js for v59 cache
# ============================================================
sw_path = Path("sw.js")
sw_code = sw_path.read_text(encoding="utf-8")
sw_code = re.sub(r"const CACHE_NAME = 'betbuddy-[^']+';", "const CACHE_NAME = 'betbuddy-pwa-v59';", sw_code)
sw_path.write_text(sw_code, encoding="utf-8")
print("Bumped cache in sw.js to betbuddy-pwa-v59")
