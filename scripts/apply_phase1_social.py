import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent

# 1. Update app.js
app_path = root / 'app.js'
app_src = app_path.read_text(encoding='utf-8')

# A. Add Reactive Panda Mood function
panda_mood_fn = """
function getPandaMood(slip, win) {
  if (!slip) {
    return {
      mood: 'thinking',
      kicker: 'Ready to build',
      desc: 'Pick your win goal and number of bets.',
      badgeClass: 'cyan',
      svg: '<circle cx="12" cy="12" r="9" fill="#0f172a" stroke="var(--cyan)" stroke-width="1.5"/><circle cx="9" cy="11" r="1.5" fill="#fff"/><circle cx="15" cy="11" r="1.5" fill="#fff"/><ellipse cx="12" cy="14" rx="2" ry="1.2" fill="var(--cyan)"/>'
    };
  }
  const chance = slip.chance || 0;
  const odds = slip.odds || 1;
  if (chance >= 0.40 || slip.ev >= 0) {
    return {
      mood: 'confident',
      kicker: 'Smart Value Bet',
      desc: 'High probability path with solid model backing.',
      badgeClass: 'emerald',
      svg: '<circle cx="12" cy="12" r="9" fill="#064e3b" stroke="#10b981" stroke-width="1.5"/><circle cx="9" cy="10.5" r="1.5" fill="#fff"/><circle cx="15" cy="10.5" r="1.5" fill="#fff"/><path d="M9.5 13.5c1.2 1.4 3.8 1.4 5 0" fill="none" stroke="#34d399" stroke-width="1.5" stroke-linecap="round"/>'
    };
  }
  if (chance >= 0.18 && odds <= 15) {
    return {
      mood: 'balanced',
      kicker: 'Balanced Acca',
      desc: 'Classic weekend accumulator. Good reward-to-risk.',
      badgeClass: 'cyan',
      svg: '<circle cx="12" cy="12" r="9" fill="#082f49" stroke="#38bdf8" stroke-width="1.5"/><circle cx="9" cy="11" r="1.5" fill="#fff"/><circle cx="15" cy="11" r="1.5" fill="#fff"/><line x1="10" y1="14" x2="14" y2="14" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round"/>'
    };
  }
  return {
    mood: 'wild',
    kicker: 'Wild Longshot',
    desc: 'High odds target! Keep stakes sensible and have fun.',
    badgeClass: 'amber',
    svg: '<circle cx="12" cy="12" r="9" fill="#451a03" stroke="#f59e0b" stroke-width="1.5"/><circle cx="9" cy="11" r="2" fill="#fff"/><circle cx="15" cy="11" r="2" fill="#fff"/><ellipse cx="12" cy="15" rx="2.5" ry="1.8" fill="#f59e0b"/><path d="M18 7c-.5.8-1 1.5-.8 2" stroke="#38bdf8" stroke-width="1.2" fill="none"/>'
  };
}
"""

if "function getPandaMood" not in app_src:
    app_src = app_src.replace("function viewBuilder() {", panda_mood_fn + "\nfunction viewBuilder() {")

# B. Update viewBuilder to display Panda Mood Badge
old_builder_head = """'<section class="builder" aria-labelledby="builder-title"><div class="builder-kicker">Bet Builder</div><h1 class="page-title" id="builder-title">Tell us the win. We’ll build the bet.</h1>' +"""
new_builder_head = """'<section class="builder" aria-labelledby="builder-title">' +
    '<div class="builder-top-bar">' +
      '<div><div class="builder-kicker">Bet Builder</div><h1 class="page-title" id="builder-title">Tell us the win. We’ll build the bet.</h1></div>' +
      (function() {
        const pm = getPandaMood(builderResult && builderResult.slips && builderResult.slips[0], builderState.win);
        return '<div class="panda-mood-card ' + pm.badgeClass + '" title="' + esc(pm.desc) + '">' +
          '<svg viewBox="0 0 24 24" class="panda-mood-icon">' + pm.svg + '</svg>' +
          '<div><div class="panda-mood-kicker">' + esc(pm.kicker) + '</div><div class="panda-mood-desc">' + esc(pm.desc) + '</div></div>' +
        '</div>';
      })() +
    '</div>' +"""

if old_builder_head in app_src:
    app_src = app_src.replace(old_builder_head, new_builder_head)

# C. Update shareAccaSlip to generate a direct deep-link URL in the hash
old_share_lines = """    ...slip.legs.map((l, i) => (i + 1) + '. ' + l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label + ' (' + l.fractional + ')'),
    '',
    'Built with Bet Buddy'"""

new_share_lines = """    ...slip.legs.map((l, i) => (i + 1) + '. ' + l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label + ' (' + l.fractional + ')'),
    '',
    'Load this exact slip: ' + location.origin + location.pathname + '#slip=' + encodeURIComponent(builderState.stake + '_' + builderState.win + '_' + builderState.legs)"""

if old_share_lines in app_src:
    app_src = app_src.replace(old_share_lines, new_share_lines)

# D. Handle incoming #slip=hash in currentRoute
old_current_route = """function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash.startsWith('match=')) return ['home'];  // Mission 063 deep links
  const [view, ...rest] = hash.split('/');
  return [view || 'home', decodeURIComponent(rest.join('/'))];
}"""

new_current_route = """let sharedSlipNotice = false;
function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash.startsWith('slip=')) {
    try {
      const parts = decodeURIComponent(hash.slice(5)).split('_');
      if (parts.length >= 3) {
        const [stk, wn, lgs] = parts.map(Number);
        if (stk > 0 && wn > 0 && lgs >= 1) {
          Object.assign(builderState, { stake: stk, win: wn, legs: lgs });
          sharedSlipNotice = true;
        }
      }
    } catch (e) { /* ignore */ }
    return ['home'];
  }
  if (hash.startsWith('match=')) return ['home'];
  const [view, ...rest] = hash.split('/');
  return [view || 'home', decodeURIComponent(rest.join('/'))];
}"""

if old_current_route in app_src:
    app_src = app_src.replace(old_current_route, new_current_route)

# E. Display shared slip banner in viewHome if opened via shared link
old_view_home_start = """function viewHome() {
  const list = upcoming();
  let html = '<section class="view">' + viewBuilder() + '<div class="section-head" style="align-items:flex-end;margin-top:36px"><div><h2 class="page-title">This round</h2>' +"""

new_view_home_start = """function viewHome() {
  const list = upcoming();
  const sharedBanner = sharedSlipNotice
    ? '<div class="notice section shared-slip-notice" style="border-color:var(--cyan);background:rgba(56,189,248,0.12);color:#fff;margin-bottom:18px"><span style="font-size:20px">🐼</span><div><b>Acca shared by a mate!</b> Bet Builder is pre-filled to target £' + builderState.win + ' profit across ' + builderState.legs + ' bets.</div><button type="button" class="icon-btn" onclick="sharedSlipNotice=false;render()" style="margin-left:auto">&times;</button></div>'
    : '';
  let html = '<section class="view">' + sharedBanner + viewBuilder() + '<div class="section-head" style="align-items:flex-end;margin-top:36px"><div><h2 class="page-title">This round</h2>' +"""

if old_view_home_start in app_src:
    app_src = app_src.replace(old_view_home_start, new_view_home_start)

# F. Add Interactive P&L Chart and Market Performance Breakdown in viewDiary
diary_chart_fn = """
function diaryPerformanceChart(diary) {
  const settled = (diary || []).filter(e => e.outcome && e.outcome !== 'pending').slice().reverse();
  if (settled.length < 2) {
    return '<div class="card section diary-chart-card">' +
      '<div class="section-head"><h2 class="section-title">Performance Chart</h2><span class="section-note">Settle 2 or more bets to generate your cumulative profit curve.</span></div>' +
      '<div class="empty" style="padding:28px">Log and settle your bets in the diary to visualize your real P&L trajectory.</div></div>';
  }

  // Calculate cumulative profit points
  let cum = 0;
  const points = [{ x: 0, y: 0, label: 'Start' }];
  settled.forEach((b, i) => {
    const profit = calc.calculateBetProfit(b.stake, b.odds, b.outcome) || 0;
    cum += profit;
    points.push({ x: i + 1, y: cum, label: b.selection || 'Bet ' + (i + 1), profit });
  });

  const ys = points.map(p => p.y);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(0, ...ys);
  const rangeY = (maxY - minY) || 10;
  const W = 600, H = 160, PAD = 24;

  const getX = x => PAD + (x / (points.length - 1)) * (W - 2 * PAD);
  const getY = y => H - PAD - ((y - minY) / rangeY) * (H - 2 * PAD);
  const zeroY = getY(0);

  const polyPoints = points.map(p => getX(p.x) + ',' + getY(p.y)).join(' ');
  const areaPoints = polyPoints + ' ' + getX(points.length - 1) + ',' + zeroY + ' ' + getX(0) + ',' + zeroY;
  const isPos = cum >= 0;
  const lineColor = isPos ? '#10b981' : '#fb7185';
  const fillColor = isPos ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 113, 133, 0.15)';

  // Market Breakdown
  const marketStats = {};
  settled.forEach(b => {
    const mkt = b.marketName || b.market || 'Single';
    if (!marketStats[mkt]) marketStats[mkt] = { n: 0, won: 0, profit: 0, staked: 0 };
    marketStats[mkt].n++;
    if (b.outcome === 'won') marketStats[mkt].won++;
    const p = calc.calculateBetProfit(b.stake, b.odds, b.outcome) || 0;
    marketStats[mkt].profit += p;
    marketStats[mkt].staked += (+b.stake || 0);
  });

  const marketRows = Object.entries(marketStats).map(([name, stat]) => {
    const winRate = Math.round((stat.won / stat.n) * 100);
    const pSign = stat.profit > 0 ? '+' : stat.profit < 0 ? '−' : '';
    const pClass = stat.profit > 0 ? 'pos' : stat.profit < 0 ? 'neg' : '';
    return '<div class="mkt-stat-row">' +
      '<span class="mkt-name">' + esc(name) + '</span>' +
      '<div class="mkt-bar-wrap"><div class="mkt-bar-fill ' + pClass + '" style="width:' + winRate + '%"></div></div>' +
      '<span class="mkt-win-rate">' + winRate + '% win</span>' +
      '<span class="mkt-profit ' + pClass + '">' + pSign + '£' + Math.abs(stat.profit).toFixed(2) + '</span>' +
    '</div>';
  }).join('');

  return '<div class="section card diary-chart-card">' +
    '<div class="section-head">' +
      '<div><h2 class="section-title">Cumulative Performance & Strategy Graph</h2><span class="section-note">Visual trajectory of settled stakes across your diary.</span></div>' +
      '<div class="chart-legend"><span class="legend-dot ' + (isPos ? 'pos' : 'neg') + '"></span>Cumulative ' + (cum >= 0 ? '+' : '−') + '£' + Math.abs(cum).toFixed(2) + '</div>' +
    '</div>' +
    '<div class="svg-chart-wrap">' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" class="pnl-svg-chart" preserveAspectRatio="none">' +
        '<line x1="' + PAD + '" y1="' + zeroY + '" x2="' + (W - PAD) + '" y2="' + zeroY + '" stroke="rgba(255,255,255,0.15)" stroke-dasharray="4,4"/>' +
        '<polygon points="' + areaPoints + '" fill="' + fillColor + '"/>' +
        '<polyline points="' + polyPoints + '" fill="none" stroke="' + lineColor + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        points.map(p => '<circle cx="' + getX(p.x) + '" cy="' + getY(p.y) + '" r="3.5" fill="' + lineColor + '"><title>' + esc(p.label) + ': ' + (p.profit >= 0 ? '+' : '') + '£' + (p.profit || 0).toFixed(2) + '</title></circle>').join('') +
      '</svg>' +
    '</div>' +
    '<div class="market-breakdown-section" style="margin-top:18px">' +
      '<h3 class="section-subhead" style="font-size:14px;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Win Rate by Bet Type / Market</h3>' +
      marketRows +
    '</div>' +
  '</div>';
}
"""

if "function diaryPerformanceChart" not in app_src:
    app_src = app_src.replace("function viewDiary() {", diary_chart_fn + "\nfunction viewDiary() {")

# Insert diaryPerformanceChart into viewDiary right above the bet grid
old_diary_end = """if (!diary.length) return html + '<div class="empty section">No bets yet. Open any match and use "+ Diary" on a selection, or add one here.</div></section>';
  return html + '<div class="grid grid-2 section">' + diary.map(betCard).join('') + '</div></section>';"""

new_diary_end = """const chartHtml = diaryPerformanceChart(diary);
  if (!diary.length) return html + '<div class="empty section">No bets yet. Open any match and use "+ Diary" on a selection, or add one here.</div></section>';
  return html + chartHtml + '<div class="grid grid-2 section">' + diary.map(betCard).join('') + '</div></section>';"""

if old_diary_end in app_src:
    app_src = app_src.replace(old_diary_end, new_diary_end)

app_path.write_text(app_src, encoding='utf-8')
print("app.js Phase 1 social features applied.")

# 2. Update styles.css with styling for Panda Mood Badge, P&L Chart, and Market Breakdown
styles_path = root / 'styles.css'
styles = styles_path.read_text(encoding='utf-8')

phase1_css = """
/* Phase 1 Social: Panda Mood Badge */
.builder-top-bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 8px; }
.panda-mood-card { display: inline-flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 16px; border: 1px solid var(--line); background: rgba(14, 23, 40, 0.7); backdrop-filter: blur(10px); }
.panda-mood-card.emerald { border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.1); }
.panda-mood-card.cyan { border-color: rgba(56, 189, 248, 0.4); background: rgba(56, 189, 248, 0.1); }
.panda-mood-card.amber { border-color: rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.1); }
.panda-mood-icon { width: 34px; height: 34px; flex: none; }
.panda-mood-kicker { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.panda-mood-card.emerald .panda-mood-kicker { color: #34d399; }
.panda-mood-card.cyan .panda-mood-kicker { color: var(--cyan); }
.panda-mood-card.amber .panda-mood-kicker { color: #fbbf24; }
.panda-mood-desc { font-size: 12.5px; color: var(--soft); max-width: 28ch; }

/* Phase 1 Social: P&L Performance Chart & Market Breakdown */
.diary-chart-card { border-color: rgba(255, 255, 255, 0.1); background: linear-gradient(160deg, rgba(14, 23, 42, 0.9), rgba(6, 11, 19, 0.95)); }
.chart-legend { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; color: #fff; }
.legend-dot { width: 9px; height: 9px; border-radius: 50%; }
.legend-dot.pos { background: #10b981; box-shadow: 0 0 8px #10b981; }
.legend-dot.neg { background: #fb7185; box-shadow: 0 0 8px #fb7185; }
.svg-chart-wrap { width: 100%; height: 160px; margin-top: 10px; border-radius: 12px; overflow: hidden; background: rgba(255, 255, 255, 0.02); }
.pnl-svg-chart { width: 100%; height: 100%; display: block; }
.mkt-stat-row { display: grid; grid-template-columns: minmax(110px, 1.4fr) minmax(80px, 1fr) 75px 85px; gap: 12px; align-items: center; padding: 7px 0; border-top: 1px solid var(--line); font-size: 13px; }
.mkt-name { font-weight: 600; color: #fff; }
.mkt-bar-wrap { height: 6px; border-radius: 9999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.mkt-bar-fill { height: 100%; border-radius: 9999px; }
.mkt-bar-fill.pos { background: var(--pick); }
.mkt-bar-fill.neg { background: var(--rose); }
.mkt-win-rate { font-family: var(--mono); color: var(--soft); text-align: right; }
.mkt-profit { font-family: var(--mono); font-weight: 600; text-align: right; }
"""

if "/* Phase 1 Social: Panda Mood Badge */" not in styles:
    styles += phase1_css
    styles_path.write_text(styles, encoding='utf-8')
    print("styles.css Phase 1 social styles applied.")
