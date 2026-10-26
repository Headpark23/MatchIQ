'use strict';
/* MatchIQ app: one design system, hash routes, data produced by pipeline/run.py.
   The browser never computes predictions: it renders the published ones, so the
   screen always matches the permanent prediction history. */

const calc = window.MatchIQCalculations;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = p => Math.round(100 * p) + '%';
const DIARY_STORAGE_KEY = 'matchiq_bet_diary_v1';
const FEEDBACK_STORAGE_KEY = 'matchiq_ux_feedback_v1';
const FILES = {
  predictions: 'data/predictions.json', fixtures: 'data/fixtures.json', history: 'data/prediction_history.json',
  performance: 'data/performance.json', leagueValidation: 'data/league_validation.json', status: 'data/pipeline_status.json', reliability: 'data/model_reliability.json', odds: 'data/odds.json'
};
const DATA = {};
const LEAGUES = { PL: 'Premier League', ELC: 'Championship', BL1: 'Bundesliga', PD: 'La Liga', SA: 'Serie A', FL1: 'Ligue 1' };
const leagueName = c => LEAGUES[c] || c || 'Premier League';
const COMP_KEY = 'matchiq_competition_v1';
let compFilter = 'ALL';
try { const v = localStorage.getItem(COMP_KEY); if (v && LEAGUES[v]) compFilter = v; } catch (e) { /* the filter is a convenience */ }
const inComp = code => compFilter === 'ALL' || (code || 'PL') === compFilter;
function compBar() {
  const items = [['ALL', 'All competitions']].concat(Object.entries(LEAGUES));
  return '<div class="comp-bar" role="group" aria-label="Competition">' + items.map(([k, l]) => '<button type="button" data-comp="' + k + '" aria-pressed="' + (compFilter === k) + '">' + esc(l) + '</button>').join('') + '</div>';
}
const LOAD_ERRORS = {};
const SIGNAL_RULES = Object.freeze({ trivialAbove: 0.85, shrinkWeight: 20, fullSample: 10 });

// ------------------------------------------------------------ clubs
const CLUBS = {
  'Arsenal': ['#EF0107', '#FFFFFF', 'ARS', 'Emirates Stadium'], 'Aston Villa': ['#670E36', '#95BFE5', 'AVL', 'Villa Park'],
  'Bournemouth': ['#DA291C', '#111111', 'BOU', 'Vitality Stadium'], 'Brentford': ['#E30613', '#FFFFFF', 'BRE', 'Gtech Community Stadium'],
  'Brighton': ['#0057B8', '#FFFFFF', 'BHA', 'American Express Stadium'], 'Burnley': ['#6C1D45', '#99D6EA', 'BUR', 'Turf Moor'],
  'Chelsea': ['#034694', '#FFFFFF', 'CHE', 'Stamford Bridge'], 'Coventry': ['#59CBE8', '#0B2341', 'COV', 'Coventry Building Society Arena'],
  'Crystal Palace': ['#1B458F', '#C4122E', 'CRY', 'Selhurst Park'], 'Everton': ['#003399', '#FFFFFF', 'EVE', 'Hill Dickinson Stadium'],
  'Fulham': ['#111111', '#FFFFFF', 'FUL', 'Craven Cottage'], 'Hull': ['#F5A12D', '#111111', 'HUL', 'MKM Stadium'],
  'Ipswich': ['#004494', '#FFFFFF', 'IPS', 'Portman Road'], 'Leeds': ['#F4F4F4', '#1D428A', 'LEE', 'Elland Road'],
  'Leicester': ['#003090', '#FDBE11', 'LEI', 'King Power Stadium'], 'Liverpool': ['#C8102E', '#F6EB61', 'LIV', 'Anfield'],
  'Man City': ['#6CABDD', '#1C2C5B', 'MCI', 'Etihad Stadium'], 'Man United': ['#DA291C', '#FBE122', 'MUN', 'Old Trafford'],
  'Newcastle': ['#181818', '#FFFFFF', 'NEW', "St James' Park"], "Nott'm Forest": ['#DD0000', '#FFFFFF', 'NFO', 'City Ground'],
  'Southampton': ['#D71920', '#FFFFFF', 'SOU', "St Mary's Stadium"], 'Sunderland': ['#EB172B', '#FFFFFF', 'SUN', 'Stadium of Light'],
  'Tottenham': ['#132257', '#FFFFFF', 'TOT', 'Tottenham Hotspur Stadium'], 'West Ham': ['#7A263A', '#1BB1E7', 'WHU', 'London Stadium'],
  'Wolves': ['#FDB913', '#231F20', 'WOL', 'Molineux']
};

function crest(name, size = 32) {
  const [c1, c2, abbr] = CLUBS[name] || ['#1E293B', '#94A3B8', String(name || 'FC').slice(0, 3).toUpperCase()];
  const ink = ['#F4F4F4', '#FFFFFF', '#FDB913', '#F5A12D', '#59CBE8', '#6CABDD'].includes(c1) ? '#0b1220' : '#FFFFFF';
  return '<svg class="crest" width="' + size + '" height="' + size + '" viewBox="0 0 48 48" role="img" aria-label="' + esc(name) + ' crest">' +
    '<path d="M24 4 40 10v14c0 9-8 17-16 20C16 41 8 33 8 24V10Z" fill="' + c1 + '" stroke="' + c2 + '" stroke-width="2.4"/>' +
    '<text x="24" y="28.5" text-anchor="middle" font-family="Oswald, sans-serif" font-weight="600" font-size="12" fill="' + ink + '">' + esc(abbr) + '</text></svg>';
}

// ------------------------------------------------------------ time
const kickoffMs = f => Date.parse((f && (f.kickoff_utc || (f.fixture && f.fixture.kickoff_utc))) || '');
const london = (ms, opts) => new Date(ms).toLocaleString('en-GB', { timeZone: 'Europe/London', ...opts });
const fmtDay = ms => london(ms, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = ms => london(ms, { hour: '2-digit', minute: '2-digit' });
const fmtFull = ms => london(ms, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ', ' + fmtTime(ms) + ' UK';
const dayKey = ms => london(ms, { year: 'numeric', month: '2-digit', day: '2-digit' });
function ago(iso) {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return 'unknown';
  const h = Math.round(ms / 3600000);
  return h < 1 ? 'under an hour ago' : h < 48 ? h + ' hours ago' : Math.round(h / 24) + ' days ago';
}

// ------------------------------------------------------------ markets
const ICONS = {
  result: '<path d="M6 9V2h12v7a6 6 0 0 1-12 0Z"/><path d="M12 15v4M8 22h8M9 19h6"/>',
  goals: '<circle cx="12" cy="12" r="9"/><path d="m12 7 3.5 2.5-1.3 4.5h-4.4L8.5 9.5z"/>',
  btts: '<path d="M4 12h6M14 12h6"/><circle cx="7" cy="12" r="4"/><circle cx="17" cy="12" r="4"/>',
  corners: '<path d="M5 22V3l13 5-13 5"/>',
  cards: '<rect x="4" y="3" width="10" height="15" rx="2"/><rect x="10" y="6" width="10" height="15" rx="2"/>',
  shots: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>'
};
const MARKETS = {
  result: { name: 'Match result', diary: 'wins' }, goals: { name: 'Total goals', diary: 'goals' },
  btts: { name: 'Both teams to score', diary: 'btts' }, corners: { name: 'Total corners', diary: 'corners' },
  cards: { name: 'Total cards', diary: 'cards' }, shots: { name: 'Shots on target', diary: 'shots' }
};
const MARKET_ORDER = ['result', 'goals', 'btts', 'corners', 'cards', 'shots'];
const STATUS = {
  validated: ['validated', 'Validated model'], provisional: ['provisional', 'Provisional estimate'], market: ['market', 'Bookmaker-derived'],
  unavailable: ['unavailable', 'Not available'], frozen: ['frozen', 'Frozen model'], shadow: ['shadow', 'Shadow challenger'],
  league: ['unavailable', 'League-average fallback']
};
const STRENGTH = { strong: [3, 'Strong evidence'], moderate: [2, 'Moderate evidence'], weak: [1, 'Weak evidence'], none: [0, 'No proven edge'] };

const statusBadge = s => { const [cls, label] = STATUS[s] || STATUS.unavailable; return '<span class="badge ' + cls + '">' + label + '</span>'; };
function meter(strength) {
  const [n, label] = STRENGTH[strength] || STRENGTH.none;
  const cls = n >= 2 ? '' : n === 1 ? ' weak' : ' none';
  return '<span class="meter' + cls + '" aria-label="' + label + '"><i class="' + (n >= 1 ? 'on' : '') + '"></i><i class="' + (n >= 2 ? 'on' : '') + '"></i><i class="' + (n >= 3 ? 'on' : '') + '"></i>' + label + '</span>';
}

function ring(p, size, cls = '', caption = '') {
  const r = 42, c = 2 * Math.PI * r, hero = cls.includes('big');
  return '<svg class="ring ' + cls + '" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" role="img" aria-label="Estimated chance ' + pct(p) + '">' +
    '<circle class="track" cx="50" cy="50" r="' + r + '" stroke-width="' + (hero ? 7 : 9) + '"/>' +
    (hero ? '<circle class="glow" transform="rotate(-90 50 50)" cx="50" cy="50" r="' + r + '" stroke-width="15" style="--circ:' + c.toFixed(2) + ';stroke-dasharray:' + c.toFixed(2) + ';stroke-dashoffset:' + (c * (1 - p)).toFixed(2) + '"/>' : '') +
    '<circle class="arc" transform="rotate(-90 50 50)" cx="50" cy="50" r="' + r + '" stroke-width="' + (hero ? 7 : 9) + '" style="--circ:' + c.toFixed(2) + ';stroke-dasharray:' + c.toFixed(2) + ';stroke-dashoffset:' + (c * (1 - p)).toFixed(2) + '"/>' +
    '<text class="val" x="50" y="' + (caption ? 53 : 58) + '" text-anchor="middle" font-size="' + (hero ? 26 : 22) + '">' + pct(p) + '</text>' +
    (caption ? '<text class="lbl" x="50" y="68" text-anchor="middle">' + esc(caption) + '</text>' : '') + '</svg>';
}

function wayBar(sels, pickKey, names, compact, cls = '') {
  const p = Object.fromEntries(sels.map(s => [s.key, s.p]));
  const seg = (k, extra) => '<div class="way-seg ' + extra + (pickKey === k ? ' picked' : '') + '" style="width:' + (100 * p[k]).toFixed(1) + '%"></div>';
  return '<div class="way' + (compact ? ' compact' : '') + ' ' + cls + '"><div class="way-track" aria-hidden="true">' + seg('H', '') + seg('D', 'draw') + seg('A', '') + '</div>' +
    (compact ? '' : '<div class="way-labels"><span>' + esc(names[0]) + ' <b>' + pct(p.H) + '</b></span><span>Draw <b>' + pct(p.D) + '</b></span><span>' + esc(names[1]) + ' <b>' + pct(p.A) + '</b></span></div>') + '</div>';
}

// ------------------------------------------------------------ Most Likely / Best Value / No Bet
const PRICE_STORAGE_KEY = 'matchiq_seen_prices_v1';
const REC_LABEL = { most_likely: 'Most Likely pick', best_value: 'Best Value pick' };

function readPrices() { try { const v = JSON.parse(localStorage.getItem(PRICE_STORAGE_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
/* Automatic prices (data/odds.json) are defaults only while fresh; anything the user typed wins. */
function feedFor(id) { return calc.feedPrices(((DATA.odds && DATA.odds.matches) || {})[id], Date.now(), (DATA.odds && DATA.odds.max_age_hours) || 12); }
function pricesFor(id) { return Object.assign({}, feedFor(id).prices, readPrices()[id] || {}); }
/* Where an automatic price came from, or why it is not being used. */
function feedNote(id) {
  const feed = feedFor(id), mine = readPrices()[id] || {};
  if (feed.state === 'none') return '';
  const ago = feed.ageHours < 1 ? 'under an hour ago' : Math.round(feed.ageHours) + ' h ago';
  if (feed.state === 'stale') return '<p class="muted" style="font-size:12.5px">Automatic prices for this match were last retrieved ' + esc(ago) + ' and are too old to use as current prices. Type the price you see now.</p>';
  const books = {};
  for (const [sid, d] of Object.entries(feed.details)) if (!mine[sid]) (books[d.bookmaker] = books[d.bookmaker] || []).push(d.last_update || '');
  const names = Object.keys(books);
  return names.length ? '<p class="muted" style="font-size:12.5px">Automatic prices: ' + names.map(esc).join(', ') + ', retrieved ' + esc(ago) + ' (Match Result and Total Goals only). Prices move: check the bookmaker before betting.</p>' : '';
}
function writePrices(v) { try { localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(v)); } catch (e) { /* prices are a convenience only */ } }

const allSelections = calc.allSelections;
const matchIQBands = () => ((((DATA.reliability || {}).markets || {}).wins) || {}).bands || [];
const valueVerdict = (sel, priceText, siblings, prices) => calc.valueVerdict(sel, priceText, siblings, prices, matchIQBands());

function selectionFor(pred, m) {
  const id = m.market === 'result' ? 'result:' + m.key : m.market === 'btts' ? 'btts:' + m.key : m.market + ':' + m.key + ':' + m.line;
  return allSelections(pred).find(s => s.id === id);
}

function mostLikelyBlock(pred, big) {
  const m = (pred.recommendations || {}).most_likely;
  if (!m || m.decision !== 'most_likely') return '<div class="rec-card nobet"><div class="rec-kicker">Most likely to win</div><div class="rec-pick">No bet</div><p class="muted">' + esc((m && m.reason) || 'No selection has enough evidence.') + '</p></div>';
  const sel = selectionFor(pred, m);
  const status = m.status === 'provisional' && m.strength === 'none' ? 'league' : m.status;
  const diary = { id: pred.match_id, market: MARKETS[m.market].diary, selection: sel ? sel.label : m.label, p: m.p, fair: sel ? sel.fair : '', rec: 'most_likely' };
  return '<div class="rec-card' + (big ? ' big' : '') + '"><div class="rec-kicker">Most likely to win</div>' +
    '<div class="rec-main">' + ring(m.p, big ? 112 : 72, status === 'validated' ? '' : 'provisional') +
    '<div><div class="rec-market">' + esc(MARKETS[m.market].name) + '</div><div class="rec-pick">' + esc(m.label) + '</div>' +
    '<div class="market-odds">Model fair odds <b>' + esc(diary.fair) + '</b> · not a bookmaker price</div></div></div>' +
    '<div class="evidence-row">' + statusBadge(status) + meter(m.strength) + '</div>' +
    '<p class="muted" style="font-size:13.5px">About ' + Math.round(m.p * 10) + ' times in 10. Chosen on credible chance (' + pct(m.lower_bound) + ' at the cautious end) from ' + esc(m.basis) + '. Likely does not mean good value.</p>' +
    '<button type="button" class="btn small" data-diary=\'' + esc(JSON.stringify(diary)) + '\'>+ Diary</button></div>';
}

const VALUE_HEAD = { value: ['value', 'Potential Value'], no_value: ['nobet', 'No Bet'], no_bet: ['nobet', 'No Bet'], awaiting_odds: ['awaiting', 'Awaiting Odds'] };

function bestValueBlock(pred) {
  const sels = allSelections(pred), prices = pricesFor(pred.match_id);
  const best = calc.bestValue(pred, prices, matchIQBands());
  const sel = sels.find(s => s.id === prices._selected) || (best && best.sel) || sels.find(s => s.id === 'result:' + pred.markets.result.pick.key) || sels[0];
  const siblings = sels.filter(s => s.group === sel.group && s.id !== sel.id);
  const verdict = valueVerdict(sel, prices[sel.id], siblings, prices);
  const v = best ? best.v.verdict : 'awaiting_odds';
  const head = VALUE_HEAD[v];
  const pricedCount = sels.filter(s => prices[s.id]).length;
  let detail = '';
  if (best) {
    detail += '<p class="muted" style="font-size:13.5px"><b>' + (v === 'value' ? 'Best value found: ' : 'Closest to value: ') + esc(best.sel.label) + '</b> at ' + esc(best.v.priceText) + ' (' + (best.v.ev >= 0 ? '+' : '') + Math.round(100 * best.v.ev) + '% estimated expected value). Checked ' + pricedCount + ' priced selection' + (pricedCount === 1 ? '' : 's') + ' across every market, not only the top six.</p>';
  } else {
    detail += '<p class="muted" style="font-size:13.5px">No bookmaker price is loaded for this match (the automatic feed covers Match Result and Total Goals only, when it is enabled). Type a fractional price you have seen on any selection, here or in the top six, and MatchIQ will check every priced selection for value.</p>';
  }
  if (verdict.verdict !== 'awaiting_odds') {
    detail += '<div class="value-grid"><div><span>Price</span><b>' + esc(verdict.priceText) + '</b></div><div><span>Price implies</span><b>' + pct(verdict.implied) + '</b></div>' +
      (verdict.fairImplied != null ? '<div><span>Margin removed</span><b>' + pct(verdict.fairImplied) + '</b></div>' : '') +
      '<div><span>MatchIQ</span><b>' + pct(sel.p) + '</b></div><div><span>Expected value</span><b class="' + (verdict.ev >= 0 ? 'pos' : 'neg') + '">' + (verdict.ev >= 0 ? '+' : '') + Math.round(100 * verdict.ev) + '%</b></div>' +
      (verdict.margin != null ? '<div><span>Bookmaker margin</span><b>' + (100 * verdict.margin).toFixed(1) + '%</b></div>' : '') + '</div>' +
      '<p class="muted" style="font-size:13.5px"><b>' + esc(sel.label) + ':</b> ' + esc(verdict.why) + (verdict.margin == null && siblings.length && verdict.verdict !== 'no_bet' ? ' Add the other outcomes’ prices below to remove the bookmaker’s margin.' : '') + '</p>';
  } else if (prices[sel.id]) {
    detail += '<p class="muted" style="font-size:13.5px">' + esc(verdict.why) + '</p>';
  }
  detail += feedNote(pred.match_id);
  const opts = sels.map(s => '<option value="' + esc(s.id) + '"' + (s.id === sel.id ? ' selected' : '') + '>' + esc(s.label) + ' · ' + pct(s.p) + '</option>').join('');
  const priceInput = (s, main) => '<label class="field"><span class="lbl">' + esc(main ? 'Bookmaker price you were offered' : s.label) + '</span><input class="ctl mono" inputmode="text" autocomplete="off" placeholder="e.g. 6/4 or Evens" data-price="' + esc(s.id) + '" data-match="' + esc(pred.match_id) + '" value="' + esc(prices[s.id] || '') + '"></label>';
  const diary = verdict.verdict !== 'awaiting_odds' ? { id: pred.match_id, market: MARKETS[sel.market].diary, selection: sel.label, p: sel.p, fair: sel.fair, odds: verdict.priceText, rec: 'best_value' } : null;
  return '<div class="rec-card ' + head[0] + '"><div class="rec-kicker">Best value</div><div class="rec-pick">' + esc(head[1]) + '</div>' + detail +
    '<label class="field"><span class="lbl">Selection to test (any market or line)</span><select class="ctl" data-value-select="' + esc(pred.match_id) + '">' + opts + '</select></label>' +
    priceInput(sel, true) +
    (siblings.length ? '<details class="compare"' + (siblings.some(s => prices[s.id]) ? ' open' : '') + '><summary>Other outcomes’ prices (removes the margin)</summary><div class="grid" style="margin-top:8px">' + siblings.map(s => priceInput(s, false)).join('') + '</div></details>' : '') +
    (diary ? '<button type="button" class="btn small" data-diary=\'' + esc(JSON.stringify(diary)) + '\'>+ Diary at ' + esc(verdict.priceText) + '</button>' : '') + '</div>';
}

/* The six strongest selections across every market and line, with a price box on each. */
const SUPPORT = { validated: ['validated', 'Validated model'], provisional: ['provisional', 'Provisional estimate'], unsupported: ['unsupported', 'Unsupported estimate'] };
function topSixCard(s, pred, rank, isMostLikely, prices) {
  const [cls, label] = SUPPORT[s.support];
  const sels = allSelections(pred);
  const v = valueVerdict(s, prices[s.id], sels.filter(x => x.group === s.group && x.id !== s.id), prices);
  const chip = { value: '<span class="badge validated">Potential Value</span>', no_value: '<span class="badge unavailable">No Bet</span>', no_bet: '<span class="badge unavailable">No Bet</span>', awaiting_odds: '<span class="badge awaiting">Awaiting Odds</span>' }[v.verdict];
  const note = s.support === 'unsupported' ? 'This line was never backtested. It is the league rate lightly nudged by the model, not a read on this match, and no price can be called value.'
    : s.support === 'provisional' ? (s.market === 'result' ? 'Promoted-club model, thin evidence. No price can be called value.' : 'No proven edge over the league average. Treat it as a base rate.') : 'About ' + Math.round(s.credible * 10) + ' times in 10 once calibrated against the backtest.';
  const diary = { id: pred.match_id, market: MARKETS[s.market].diary, selection: s.label, p: s.p, fair: s.fair, rec: isMostLikely ? 'most_likely' : '' };
  return '<article class="card top-card ' + cls + '"><div class="top-head"><span class="top-rank">' + rank + '</span><span class="market-name"><svg viewBox="0 0 24 24">' + ICONS[s.market] + '</svg>' + esc(MARKETS[s.market].name) + '</span>' +
    (isMostLikely ? '<span class="badge validated">Most Likely</span>' : '') + '</div>' +
    '<div class="market-main">' + ring(s.p, 64, s.support === 'validated' ? '' : s.support === 'unsupported' ? 'limited' : 'provisional') +
    '<div><div class="market-pick">' + esc(s.label.replace(/^[^:]+: /, '')) + '</div><div class="market-odds">Model fair odds <b>' + esc(s.fair) + '</b> · not a bookmaker price</div></div></div>' +
    '<div class="evidence-row"><span class="badge ' + cls + '">' + label + '</span>' + (s.support === 'unsupported' ? '' : meter(s.strength)) + '</div>' +
    '<p class="muted" style="font-size:13px">' + esc(note) + '</p>' +
    '<label class="field"><span class="lbl">Price you saw ' + chip + '</span><input class="ctl mono" inputmode="text" autocomplete="off" placeholder="e.g. 6/4 or Evens" aria-label="Bookmaker price for ' + esc(s.label) + '" data-price="' + esc(s.id) + '" data-match="' + esc(pred.match_id) + '" value="' + esc(prices[s.id] || '') + '"></label>' +
    (prices[s.id] && v.verdict !== 'awaiting_odds' ? '<p class="muted" style="font-size:12.5px">' + esc(v.why) + '</p>' : '') +
    '<button type="button" class="btn small" data-diary=\'' + esc(JSON.stringify(diary)) + '\'>+ Diary</button></article>';
}

function topSixBlock(pred) {
  const six = calc.topSix(pred, DATA.reliability), prices = pricesFor(pred.match_id);
  const ml = (pred.recommendations || {}).most_likely || {};
  const isML = s => ml.decision === 'most_likely' && s.market === ml.market && s.key === ml.key && (ml.line == null || s.line === ml.line);
  if (!six.length) return '<div class="empty">No selection has enough evidence to rank for this match. Every prediction is still listed below.</div>';
  return '<div class="grid grid-2 top-six">' + six.map((s, i) => topSixCard(s, pred, i + 1, isML(s), prices)).join('') + '</div>' +
    (six.length < 6 ? '<p class="dim" style="font-size:12.5px;margin-top:8px">Fewer than six selections have enough evidence. Every other prediction stays available below.</p>' : '');
}

function refreshValue(matchId) {
  const pred = DATA.predictions && DATA.predictions.predictions[matchId];
  if (!pred) return;
  const active = document.activeElement, focused = active && active.dataset ? active.dataset.price : null;
  const boxes = { ['value-' + matchId]: bestValueBlock, ['top-' + matchId]: topSixBlock };
  for (const [boxId, build] of Object.entries(boxes)) {
    const box = $(boxId);
    if (!box) continue;
    const holdsFocus = focused && box.contains(active);
    box.innerHTML = build(pred);
    if (holdsFocus) { const input = box.querySelector('[data-price="' + CSS.escape(focused) + '"]'); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } }
  }
}

function recommendationPair(pred) {
  return '<div class="rec-pair">' + mostLikelyBlock(pred, true) + '<div id="value-' + esc(pred.match_id) + '">' + bestValueBlock(pred) + '</div></div>';
}


/* Turn a full (predictions.json) or compact (history) market into one display shape. */
function normaliseMarket(key, m) {
  if (!m) return null;
  if (m.unavailable) return { key, unavailable: true, status: 'unavailable', strength: 'none', summary: (m.evidence && m.evidence.summary) || 'No data for this market.' };
  const league = m.evidence.status === 'provisional' && m.evidence.strength === 'none';
  const out = { key, status: league ? 'league' : m.evidence.status, strength: m.evidence.strength, summary: m.evidence.summary || '', version: m.model_version,
    tier: m.tier, pick: { label: m.pick.label, p: m.pick.p, fair: m.pick.fair_odds, key: m.pick.key, line: m.pick.line },
    explanation: m.explanation || [], method: m.method || '', rows: [], frozen: m.frozen_reference || null };
  if (m.selections) out.rows = m.selections.map(s => ({ label: s.label, p: s.p, fair: s.fair_odds, picked: s.key === m.pick.key }));
  if (m.lines) {
    for (const l of m.lines) {
      const over = typeof l.over === 'object' ? l.over.p : l.over;
      const overFair = typeof l.over === 'object' ? l.over.fair_odds : l.over_fair_odds;
      const underFair = typeof l.under === 'object' ? l.under.fair_odds : l.under_fair_odds;
      const picked = l.line === m.pick.line;
      out.rows.push({ label: 'Over ' + l.line, p: over, fair: overFair, picked: picked && m.pick.key === 'over', league: l.league_p });
      out.rows.push({ label: 'Under ' + l.line, p: 1 - over, fair: underFair, picked: picked && m.pick.key === 'under', league: l.league_p == null ? null : 1 - l.league_p });
    }
  }
  return out;
}

// ------------------------------------------------------------ data access
async function loadData() {
  await Promise.all(Object.entries(FILES).map(async ([key, url]) => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      DATA[key] = await res.json();
      delete LOAD_ERRORS[key];
    } catch (error) {
      LOAD_ERRORS[key] = String(error.message || error);
    }
  }));
}
const predictionsList = () => Object.values((DATA.predictions && DATA.predictions.predictions) || {});
const fixturesList = () => (DATA.fixtures && DATA.fixtures.fixtures) || [];
const historyRecords = () => (DATA.history && DATA.history.records) || [];
const fixtureById = id => fixturesList().find(f => f.id === id);
const upcoming = () => predictionsList().filter(p => kickoffMs(p.fixture) > Date.now() && inComp(p.fixture.competition)).sort((a, b) => kickoffMs(a.fixture) - kickoffMs(b.fixture));

function finalRecord(id) {
  const recs = historyRecords().filter(r => r.match_id === id);
  if (!recs.length) return null;
  return recs.find(r => r.evaluated) || recs[recs.length - 1];
}

function reliabilityBand(p) {
  const m = DATA.reliability && DATA.reliability.markets && DATA.reliability.markets.wins;
  return m ? (m.bands || []).find(b => p >= b.lo && p < b.hi) || null : null;
}

function signalScore(pred) {
  const r = pred.markets.result, p = r.pick.p, band = reliabilityBand(p);
  const calibrated = band ? (band.n * band.observed_rate + SIGNAL_RULES.shrinkWeight * p) / (band.n + SIGNAL_RULES.shrinkWeight) : p;
  const v = r.venue_games || { home: 0, away: 0 };
  const completeness = Math.min(1, Math.min(v.home, v.away) / SIGNAL_RULES.fullSample);
  return { score: calibrated * (0.85 + 0.15 * completeness), band, completeness };
}

function plainResult(p) {
  const inTen = Math.round(p * 10);
  if (p >= 0.7) return 'Strong favourite: in matches rated like this, the model expects this result about ' + inTen + ' times in 10.';
  if (p >= 0.55) return 'Clear favourite: the model expects this result about ' + inTen + ' times in 10.';
  if (p >= 0.45) return 'Narrow favourite: close to a coin flip between this and the other two results.';
  return 'The most likely of three results, but still less likely to happen than not.';
}

function bandText(band) {
  if (band && band.established) return 'Backtest: picks rated ' + band.band + ' landed ' + pct(band.observed_rate) + ' of the time (' + band.n + ' matches).';
  return 'Limited evidence: ' + (band ? 'only ' + band.n + ' backtested picks' : 'no backtested picks') + ' at this probability.';
}

function formStrip(games) {
  return '<span class="form-strip" aria-label="Last ' + games.length + ' results, oldest first">' + games.map(g => '<i class="' + g.res + '">' + g.res + '</i>').join('') + '</span>';
}

function resultExplanation(pred) {
  const r = pred.markets.result, f = pred.fixture, lines = [];
  const line = (team, where, games) => {
    if (!games || !games.length) return '<li>' + esc(team) + ' has no ' + leagueName(f.competition) + ' ' + where + ' games in the data yet.</li>';
    const w = games.filter(g => g.res === 'W').length, d = games.filter(g => g.res === 'D').length, l = games.length - w - d;
    const gf = games.reduce((s, g) => s + g.gf, 0) / games.length, ga = games.reduce((s, g) => s + g.ga, 0) / games.length;
    return '<li>' + esc(team) + ' ' + where + ', last ' + games.length + ': ' + w + ' won, ' + d + ' drawn, ' + l + ' lost ' + formStrip(games) + ', scoring ' + gf.toFixed(1) + ' and conceding ' + ga.toFixed(1) + ' a game.</li>';
  };
  lines.push('<li>' + esc(r.method || '') + (r.training_matches ? ', trained on ' + r.training_matches + ' completed matches before kick-off.' : '.') + '</li>');
  if (r.form) { lines.push(line(f.home, 'at home', r.form.home)); lines.push(line(f.away, 'away', r.form.away)); }
  if (r.tier === 'T2' && r.pooled_raw) lines.push('<li>Before shrinking toward league averages, the Premier League + Championship model said ' + pct(r.pooled_raw[0]) + ' / ' + pct(r.pooled_raw[1]) + ' / ' + pct(r.pooled_raw[2]) + '.</li>');
  if (r.tier === 'T1') lines.push('<li>' + esc(bandText(reliabilityBand(r.pick.p))) + '</li>');
  return lines.join('');
}

// ------------------------------------------------------------ components
function freshnessChips() {
  const s = DATA.status;
  if (!s) return '<span class="chip bad"><span class="dot"></span>Update status unavailable</span>';
  const age = (Date.now() - Date.parse(s.last_success || 0)) / 3600000;
  const cls = !s.ok ? 'bad' : age > 13 ? 'warn' : 'ok';
  const resultsTo = s.results_latest ? london(Date.parse(s.results_latest + 'T12:00:00Z'), { day: 'numeric', month: 'short' }) : '?';
  return '<span class="chip ' + cls + '"><span class="dot"></span>' + (s.ok ? 'Updated ' + ago(s.last_success) : 'Last refresh failed') + '</span>' +
    '<span class="chip"><span class="dot"></span>Results to ' + esc(resultsTo) + '</span>' +
    (s.warnings || []).map(w => '<span class="chip warn"><span class="dot"></span>' + esc(w) + '</span>').join('');
}

function heroCard(pred, rankNote) {
  const f = pred.fixture, r = pred.markets.result, ms = kickoffMs(f), provisional = r.evidence.status !== 'validated';
  return '<article class="hero' + (provisional ? ' provisional' : '') + '">' +
    '<div>' +
      '<div class="hero-meta"><strong>' + esc(rankNote) + '</strong><span>' + esc(leagueName(f.competition)) + '</span><span>' + esc(fmtDay(ms)) + ', ' + esc(fmtTime(ms)) + ' UK</span></div>' +
      '<div class="hero-teams"><span class="hero-team">' + crest(f.home, 40) + esc(f.home) + '</span><span class="hero-v">v</span><span class="hero-team">' + crest(f.away, 40) + esc(f.away) + '</span></div>' +
      '<h3 class="hero-pick">' + esc(r.pick.label) + '</h3>' +
      '<p class="hero-plain">' + esc(plainResult(r.pick.p)) + '</p>' +
      wayBar(r.selections, r.pick.key, [f.home, f.away], false, provisional ? 'provisional' : '') +
      '<div class="evidence-row">' + statusBadge(r.evidence.status) + meter(r.evidence.strength) + '</div>' +
      '<div class="btn-row" style="margin-top:16px"><a class="btn primary" href="#/match/' + encodeURIComponent(pred.match_id) + '">See every market</a>' +
        '<button type="button" class="btn" data-diary=\'' + esc(JSON.stringify({ id: pred.match_id, market: 'wins', selection: r.pick.label, p: r.pick.p, fair: r.pick.fair_odds })) + '\'>Add to Bet Diary</button></div>' +
    '</div>' +
    '<div class="hero-side">' + ring(r.pick.p, 180, 'big' + (provisional ? ' provisional' : ''), 'model estimate') +
      '<div class="odds-pair"><span>Model fair odds <strong>' + esc(r.pick.fair_odds) + '</strong></span><span>Bookmaker odds: not available</span></div></div>' +
  '</article>';
}

function signalCard(pred) {
  const f = pred.fixture, r = pred.markets.result, ms = kickoffMs(f), provisional = r.evidence.status !== 'validated';
  const band = reliabilityBand(r.pick.p);
  return '<a class="sig-card" href="#/match/' + encodeURIComponent(pred.match_id) + '">' +
    ring(r.pick.p, 64, provisional ? 'provisional' : '') +
    '<span><span class="fixture">' + crest(f.home, 18) + crest(f.away, 18) + '<span>' + esc(f.home) + ' v ' + esc(f.away) + '</span></span>' +
      '<span class="pick" style="display:block">' + esc(r.pick.label) + '</span>' +
      '<span class="meta" style="display:block">' + esc(fmtDay(ms)) + ' ' + esc(fmtTime(ms)) + ' · fair ' + esc(r.pick.fair_odds) + '</span>' +
      '<span class="meta" style="display:block;color:' + (provisional || !(band && band.established) ? 'var(--amber)' : 'var(--dim)') + '">' +
        (provisional ? 'Provisional: ' + (pred.promoted.length ? 'promoted club, little top-flight data' : 'limited data') : band && band.established ? 'Backtest: picks at ' + band.band + ' landed ' + pct(band.observed_rate) : 'Limited evidence') + '</span></span></a>';
}

function fixtureRow(f) {
  const ms = kickoffMs(f), pred = DATA.predictions && DATA.predictions.predictions[f.id], rec = finalRecord(f.id);
  let lean;
  if (f.status === 'FINISHED') {
    const won = rec && rec.settlement && rec.settlement.result ? rec.settlement.result.pick_won : null;
    lean = '<span><span class="score">' + f.score[0] + '–' + f.score[1] + '</span> ' + (won === null ? '<span class="dim">no prediction recorded</span>' : '<span class="badge ' + (won ? 'won' : 'lost') + '">Pick ' + (won ? 'right' : 'wrong') + '</span>') + '</span>';
  } else if (f.status === 'AWAITING_RESULT' || f.status === 'RESULT_CONFLICT') {
    lean = '<span><b>Kicked off</b>, awaiting confirmed result' + (rec ? ' · predicted ' + esc(rec.markets.result.pick.label) : '') + '</span>';
  } else if (f.status === 'POSTPONED' || f.status === 'CANCELLED' || f.status === 'REMOVED_FROM_SCHEDULE') {
    lean = '<span class="badge provisional">' + esc({ POSTPONED: 'Postponed', CANCELLED: 'Cancelled', REMOVED_FROM_SCHEDULE: 'Removed from schedule' }[f.status]) + '</span>';
  } else if (pred) {
    const r = pred.markets.result, provisional = r.evidence.status !== 'validated';
    lean = '<span>Leans <b>' + esc(r.pick.label) + '</b> ' + pct(r.pick.p) + (provisional ? ' <span class="badge provisional">Provisional</span>' : '') + '</span>' +
      wayBar(r.selections, r.pick.key, [f.home, f.away], true, provisional ? 'provisional' : '');
  } else {
    lean = '<span class="dim">Prediction published within 21 days of kick-off</span>';
  }
  return '<a class="fx" href="#/match/' + encodeURIComponent(f.id) + '">' +
    '<span class="fx-time">' + esc(fmtTime(ms)) + '<small>' + esc(fmtDay(ms)) + '</small>' + (compFilter === 'ALL' ? '<small class="lg-tag">' + esc(f.competition || 'PL') + '</small>' : '') + '</span>' +
    '<span class="fx-teams"><span class="teams-line">' + crest(f.home, 22) + '<span>' + esc(f.home) + '</span></span><span class="teams-line">' + crest(f.away, 22) + '<span>' + esc(f.away) + '</span></span></span>' +
    '<span class="fx-lean">' + lean + '</span><span class="fx-chev" aria-hidden="true">›</span></a>';
}

function groupedRows(fixtures) {
  let html = '', last = '';
  for (const f of fixtures) {
    const key = dayKey(kickoffMs(f));
    if (key !== last) { html += '<h3 class="day-label">' + esc(london(kickoffMs(f), { weekday: 'long', day: 'numeric', month: 'long' })) + '</h3>'; last = key; }
    html += fixtureRow(f);
  }
  return html;
}

function marketCard(key, m, ctx) {
  const meta = MARKETS[key];
  const head = '<div class="market-top"><span class="market-name"><svg viewBox="0 0 24 24">' + ICONS[key] + '</svg>' + esc(meta.name) + '</span>' + statusBadge(m.status) + '</div>';
  if (m.unavailable) return '<article class="card market">' + head + '<p class="muted">' + esc(m.summary) + '</p></article>';
  const provisional = m.status !== 'validated';
  const settle = ctx.settlement && ctx.settlement[key];
  const settleHtml = settle ? (settle.pending ? '<span class="badge pending">Result pending: ' + esc(settle.pending) + '</span>'
    : '<span class="badge ' + (settle.pick_won ? 'won' : 'lost') + '">' + (settle.pick_won ? 'Pick landed' : 'Pick missed') + (settle.total != null ? ' · actual ' + settle.total : settle.outcome ? ' · ' + esc(settle.outcome) : '') + '</span>') : '';
  const diaryBtn = row => ctx.canLog ? '<button type="button" class="btn small" data-diary=\'' + esc(JSON.stringify({ id: ctx.id, market: meta.diary, selection: (key === 'btts' ? 'Both teams to score: ' : key === 'result' ? '' : meta.name + ': ') + row.label, p: row.p, fair: row.fair })) + '\' aria-label="Add ' + esc(row.label) + ' to Bet Diary">+ Diary</button>' : '';
  const rows = m.rows.map(row => '<tr' + (row.picked ? ' style="color:#fff;font-weight:600"' : '') + '><td>' + esc(row.label) + (row.picked ? ' <span class="badge validated" style="font-size:10px">Pick</span>' : '') + '</td>' +
    '<td class="num">' + pct(row.p) + '</td><td class="num">' + esc(row.fair) + '</td>' + (m.rows.some(r => r.league != null) ? '<td class="num dim">' + (row.league == null ? '' : pct(row.league)) + '</td>' : '') +
    '<td class="act">' + diaryBtn(row) + '</td></tr>').join('');
  return '<article class="card market">' + head +
    '<div class="market-main">' + ring(m.pick.p, 76, provisional ? (m.strength === 'none' ? 'limited' : 'provisional') : '') +
      '<div><div class="market-pick">' + esc(m.pick.label) + '</div><div class="market-odds">Model fair odds <b>' + esc(m.pick.fair) + '</b> · Bookmaker odds: not available</div></div></div>' +
    '<div>' + meter(m.strength) + '</div>' +
    (m.summary ? '<p class="muted" style="font-size:13.5px">' + esc(m.summary) + '</p>' : '') +
    (m.explanation.length ? '<ul class="explain">' + m.explanation.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') +
    (m.frozen ? '<p class="ref-note">Frozen ' + esc(m.frozen.model_version) + ' says Over 9.5 at ' + pct(m.frozen.over_9_5) + '. ' + esc(m.frozen.note) + '</p>' : '') +
    settleHtml +
    '<details class="compare"><summary>Compare every option</summary><table class="alt"><thead><tr><th>Selection</th><th style="text-align:right">Chance</th><th style="text-align:right">Fair odds</th>' +
      (m.rows.some(r => r.league != null) ? '<th style="text-align:right">League</th>' : '') + '<th></th></tr></thead><tbody>' + rows + '</tbody></table>' +
      (m.method ? '<p class="dim" style="font-size:12.5px;margin-top:8px">' + esc(m.method) + (m.version ? ' · ' + esc(m.version) : '') + '</p>' : '') + '</details>' +
  '</article>';
}

// ------------------------------------------------------------ views
function lowerBoundOf(pred) {
  const m = (pred.recommendations || {}).most_likely;
  return m && m.decision === 'most_likely' ? m.lower_bound : -1;
}

function valueStatus(pred) {
  const prices = pricesFor(pred.match_id);
  const sels = allSelections(pred);
  const best = calc.bestValue(pred, prices, matchIQBands());
  if (best && best.v.verdict === 'value') return '<span class="badge validated">Potential Value at your price</span>';
  if (best) return '<span class="badge unavailable">No Bet at your prices</span>';
  return '<span class="badge awaiting">Awaiting Odds</span>';
}

function matchRecRow(pred) {
  const f = pred.fixture, ms = kickoffMs(f), m = (pred.recommendations || {}).most_likely || {}, r = pred.markets.result;
  const status = m.status === 'provisional' && m.strength === 'none' ? 'league' : m.status;
  const pick = m.decision === 'most_likely'
    ? ring(m.p, 56, status === 'validated' ? '' : 'provisional') + '<span><span class="dim" style="display:block;font-size:12px">Most likely · ' + esc(MARKETS[m.market].name) + '</span><b class="rec-row-pick">' + esc(m.label) + '</b></span>'
    : '<span><b class="rec-row-pick">No bet</b><span class="dim" style="display:block;font-size:12px">Not enough evidence</span></span>';
  return '<a class="rec-row" href="#/match/' + encodeURIComponent(pred.match_id) + '">' +
    '<span class="fx-time">' + esc(fmtTime(ms)) + '<small>' + esc(fmtDay(ms)) + '</small>' + (compFilter === 'ALL' ? '<small class="lg-tag">' + esc(f.competition || 'PL') + '</small>' : '') + '</span>' +
    '<span class="fx-teams"><span class="teams-line">' + crest(f.home, 22) + '<span>' + esc(f.home) + '</span></span><span class="teams-line">' + crest(f.away, 22) + '<span>' + esc(f.away) + '</span></span></span>' +
    '<span class="rec-row-main">' + pick + '</span>' +
    '<span class="rec-row-side"><span class="dim">Result lean: <b style="color:#fff">' + esc(r.pick.label) + '</b> ' + pct(r.pick.p) + (r.evidence.status !== 'validated' ? ' <span class="badge provisional">Provisional</span>' : '') + '</span>' + valueStatus(pred) + '</span>' +
    '<span class="fx-chev" aria-hidden="true">›</span></a>';
}

function homeHero(pred) {
  const f = pred.fixture, ms = kickoffMs(f);
  return '<article class="hero"><div><div class="hero-meta"><strong>Most likely this round</strong><span>' + esc(leagueName(f.competition)) + '</span><span>' + esc(fmtDay(ms)) + ', ' + esc(fmtTime(ms)) + ' UK</span></div>' +
    '<div class="hero-teams"><span class="hero-team">' + crest(f.home, 40) + esc(f.home) + '</span><span class="hero-v">v</span><span class="hero-team">' + crest(f.away, 40) + esc(f.away) + '</span></div>' +
    mostLikelyBlock(pred, true) +
    '<div class="btn-row" style="margin-top:14px"><a class="btn primary" href="#/match/' + encodeURIComponent(pred.match_id) + '">See every market and check value</a></div></div></article>';
}

function viewHome() {
  const list = upcoming();
  let html = '<section class="view"><div class="section-head" style="align-items:flex-end"><div><h1 class="page-title">This round</h1>' +
    '<p class="page-sub">For every upcoming match: the most likely supported outcome, the match-result lean and whether a price you have seen offers value. MatchIQ will say No bet when the evidence or the price is not good enough.</p></div>' +
    '<div class="chips">' + freshnessChips() + '</div></div>' + compBar();
  if (LOAD_ERRORS.predictions) return html + errorPanel('predictions') + '</section>';
  if (!list.length) return html + '<div class="empty">No fixtures with published predictions in the next 21 days. Predictions appear automatically once the schedule lists them.</div>' + homeFixtures() + '</section>';
  const first = kickoffMs(list[0].fixture);
  const round = list.filter(p => kickoffMs(p.fixture) - first < 5 * 86400000);
  const later = list.filter(p => kickoffMs(p.fixture) - first >= 5 * 86400000);
  const best = round.slice().sort((a, b) => lowerBoundOf(b) - lowerBoundOf(a))[0];
  if (best && lowerBoundOf(best) >= 0) html += '<div class="section" style="margin-top:18px">' + homeHero(best) + '</div>';
  html += '<div class="section"><div class="section-head"><h2 class="section-title">Match by match</h2><span class="section-note">Most likely uses every market but ranks on credible chance, so a big number with little evidence behind it does not win.</span></div>' +
    round.map(matchRecRow).join('') + '</div>';
  if (later.length) html += '<details class="section"><summary class="section-title" style="cursor:pointer;min-height:44px;display:flex;align-items:center">Following round (' + later.length + ' matches)</summary>' + later.map(matchRecRow).join('') + '</details>';
  const validated = list.filter(p => p.markets.result.evidence.status === 'validated').map(p => ({ p, s: signalScore(p) })).sort((a, b) => b.s.score - a.s.score).map(x => x.p);
  if (validated.length) html += '<div class="section"><div class="section-head"><h2 class="section-title">Strongest match-result signals</h2><span class="section-note">The validated match-result model only, ranked by backtest-calibrated probability.</span></div>' +
    '<div class="grid grid-2">' + validated.slice(0, 4).map(signalCard).join('') + '</div></div>';
  html += '<details class="card section"><summary class="section-title" style="cursor:pointer;min-height:44px;display:flex;align-items:center">How Most Likely, Best Value and No Bet work</summary><ol class="explain" style="margin-top:8px">' +
    '<li><b>Most likely</b> looks at every backtested selection in every market, including heavy favourites. Each chance is pulled toward how often similar picks landed in the backtest, then ranked by the cautious end of a 90% range. Thin evidence therefore counts for less than a well-tested estimate, even with a bigger number.</li>' +
    '<li><b>Best value</b> needs a real bookmaker price. MatchIQ has no lawful free odds feed, so enter a price you have seen. Add every outcome’s price to remove the bookmaker’s margin. Only the validated match-result model, at a well-backtested probability, can call value, and only at +5% estimated expected value or more.</li>' +
    '<li><b>No bet</b> is a real answer: when evidence is thin, the price is short or no price exists. The predictions stay visible underneath.</li>' +
    '<li>Model fair odds are 1 ÷ probability with no margin, rounded to a familiar UK price. They are never bookmaker prices.</li></ol></details>';
  return html + homeFixtures() + '</section>';
}

function homeFixtures() {
  const next = fixturesList().filter(f => inComp(f.competition) && f.status === 'SCHEDULED' && kickoffMs(f) > Date.now()).sort((a, b) => kickoffMs(a) - kickoffMs(b)).slice(0, 10);
  if (!next.length) return '';
  return '<div class="section"><div class="section-head"><h2 class="section-title">Next fixtures</h2><a class="link-btn" href="#/fixtures">All fixtures ›</a></div>' + groupedRows(next) + '</div>';
}

let fixturesTab = 'upcoming';
let fixturesShowAll = false;
function viewFixtures() {
  const all = fixturesList().filter(f => inComp(f.competition)), now = Date.now();
  const tabs = { upcoming: 'Upcoming', awaiting: 'Awaiting result', results: 'Results' };
  let list;
  if (fixturesTab === 'upcoming') {
    list = all.filter(f => ['SCHEDULED', 'POSTPONED', 'CANCELLED', 'REMOVED_FROM_SCHEDULE'].includes(f.status) && (kickoffMs(f) > now || f.status !== 'SCHEDULED')).sort((a, b) => kickoffMs(a) - kickoffMs(b));
    if (!fixturesShowAll) list = list.filter(f => kickoffMs(f) - now < 35 * 86400000 || f.status !== 'SCHEDULED');
  } else if (fixturesTab === 'awaiting') {
    list = all.filter(f => f.status === 'AWAITING_RESULT' || f.status === 'RESULT_CONFLICT').sort((a, b) => kickoffMs(b) - kickoffMs(a));
  } else {
    list = all.filter(f => f.status === 'FINISHED').sort((a, b) => kickoffMs(b) - kickoffMs(a)).slice(0, fixturesShowAll ? 400 : 30);
  }
  let html = '<section class="view"><h1 class="page-title">Fixtures</h1><p class="page-sub">' + (compFilter === 'ALL' ? 'All six competitions' : esc(leagueName(compFilter))) + ' 2026/27. The schedule refreshes automatically; matches leave Upcoming at kick-off and move to Results once a source confirms the score.</p>' +
    '<div class="section" style="margin-top:16px;display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between"><div class="seg" role="group" aria-label="Fixture list">' +
    compBar() + Object.entries(tabs).map(([k, label]) => '<button type="button" data-tab="' + k + '" aria-pressed="' + (fixturesTab === k) + '">' + label + '</button>').join('') + '</div><div class="chips">' + freshnessChips() + '</div></div>';
  if (LOAD_ERRORS.fixtures) return html + errorPanel('fixtures') + '</section>';
  html += list.length ? groupedRows(list) : '<div class="empty" style="margin-top:16px">' + (fixturesTab === 'awaiting' ? 'No matches are waiting for a confirmed result.' : 'Nothing to show yet.') + '</div>';
  if ((fixturesTab === 'upcoming' || fixturesTab === 'results') && !fixturesShowAll) html += '<button type="button" class="btn" data-showall style="margin-top:8px">Show ' + (fixturesTab === 'upcoming' ? 'the rest of the season' : 'all results') + '</button>';
  return html + '</section>';
}

function viewMatch(id) {
  const f = fixtureById(id), pred = DATA.predictions && DATA.predictions.predictions[id], rec = finalRecord(id);
  const fx = f || (pred && { id, ...pred.fixture }) || (rec && { id, ...rec.fixture });
  if (!fx) return '<section class="view"><a class="link-btn" href="#/fixtures">‹ Fixtures</a><div class="empty">This match is not in the current schedule.</div></section>';
  const ms = kickoffMs(fx), status = (f && f.status) || (ms > Date.now() ? 'SCHEDULED' : 'AWAITING_RESULT');
  const promoted = pred ? pred.promoted : [];
  const centre = status === 'FINISHED' ? '<span class="score">' + f.score[0] + '–' + f.score[1] + '</span><div style="font-size:13px">Full time</div>' : '<span>v</span>';
  const statusChip = { SCHEDULED: ['ok', 'Upcoming'], AWAITING_RESULT: ['warn', 'Kicked off, awaiting confirmed result'], RESULT_CONFLICT: ['warn', 'Sources disagree on the score'],
    FINISHED: ['ok', 'Result confirmed' + (f && f.result_source ? ' by ' + f.result_source : '')], POSTPONED: ['warn', 'Postponed'], CANCELLED: ['bad', 'Cancelled'], REMOVED_FROM_SCHEDULE: ['warn', 'Removed from the schedule'] }[status] || ['', status];
  let html = '<section class="view"><a class="link-btn" href="#/fixtures">‹ Fixtures</a>' +
    '<header class="match-head"><div class="match-teams">' +
      '<div class="match-team">' + crest(fx.home, 64) + esc(fx.home) + (promoted.includes(fx.home) ? '<small>Promoted club</small>' : '') + '</div>' +
      '<div class="match-centre">' + centre + '</div>' +
      '<div class="match-team">' + crest(fx.away, 64) + esc(fx.away) + (promoted.includes(fx.away) ? '<small>Promoted club</small>' : '') + '</div></div>' +
      '<div class="facts"><span><b>' + esc(leagueName(fx.competition)) + '</b> 2026/27</span><span>' + esc(fmtFull(ms)) + '</span><span>Home ground: <b>' + esc((CLUBS[fx.home] || [])[3] || 'not listed') + '</b></span></div>' +
      '<div class="chips" style="justify-content:center"><span class="chip ' + statusChip[0] + '"><span class="dot"></span>' + esc(statusChip[1]) + '</span>' + freshnessChips() + '</div>' +
      (f && f.kickoff_history && f.kickoff_history.length ? '<p class="dim" style="text-align:center;font-size:13px">Rescheduled from ' + esc(fmtFull(Date.parse(f.kickoff_history[f.kickoff_history.length - 1].from))) + '</p>' : '') +
    '</header>';

  if (pred && ms > Date.now()) {
    const r = pred.markets.result;
    html += '<div class="section">' + recommendationPair(pred) + '</div>' +
      '<div class="section">' + heroCard(pred, 'Match result') + '</div>' +
      '<details class="card section"><summary class="section-title" style="cursor:pointer;min-height:44px;display:flex;align-items:center">Why this match-result prediction</summary><ul class="explain" style="margin-top:6px">' + resultExplanation(pred) + '</ul>' +
      '<p class="dim" style="font-size:13px;margin-top:10px">' + esc(r.evidence.summary) + ' The models use results and match statistics only. They know nothing about injuries, team news, line-ups or motivation.</p></details>';
    html += '<div class="section"><div class="section-head"><h2 class="section-title">Top six selections</h2><span class="section-note">The six strongest individual selections from every market and Over/Under line, ranked on the cautious end of their chance so thin evidence cannot win on a big number. Lines MatchIQ never backtested rank last and are labelled unsupported.</span></div>' +
      '<div id="top-' + esc(id) + '">' + topSixBlock(pred) + '</div></div>' +
      '<details class="card section all-markets"><summary class="section-title" style="cursor:pointer;min-height:44px;display:flex;align-items:center">Every market and line (' + allSelections(pred).length + ' selections)</summary>' +
      '<p class="dim" style="font-size:13px;margin:6px 0 12px">Published ' + esc(ago(pred.published_at)) + ' · record ' + esc(pred.record_id) + '. Probability and evidence strength are shown separately: a 60% estimate with weak evidence is still weak.</p>' +
      '<div class="grid grid-2">' + MARKET_ORDER.map(k => marketCard(k, normaliseMarket(k, pred.markets[k]), { id, canLog: true })).join('') + '</div></details>';
  } else if (rec) {
    const ml = (rec.recommendations || {}).most_likely, mls = (rec.settlement || {}).most_likely;
    if (ml) html += '<div class="section card"><h2 class="section-title">Sealed recommendations</h2><p style="margin-top:8px">' +
      (ml.decision === 'most_likely' ? 'Most likely: <b>' + esc(ml.label) + '</b> (' + esc(MARKETS[ml.market].name) + ') at ' + pct(ml.p) + '. ' : 'Most likely: No bet. ') +
      (mls && 'won' in mls ? '<span class="badge ' + (mls.won ? 'won' : 'lost') + '">' + (mls.won ? 'Landed' : 'Missed') + '</span>' : mls ? '<span class="badge pending">Result pending</span>' : '') +
      '</p><p class="muted" style="margin-top:6px">Best value: ' + esc(((rec.recommendations || {}).best_value || {}).reason || 'No bet') + '</p></div>';
    html += '<div class="section"><div class="section-head"><h2 class="section-title">What MatchIQ predicted</h2><span class="section-note">Published ' + esc(london(Date.parse(rec.published_at), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + ' UK, before kick-off. Sealed record ' + esc(rec.record_id) + ': it cannot be changed after the result.</span></div>' +
      '<div class="grid grid-2">' + MARKET_ORDER.filter(k => rec.markets[k]).map(k => marketCard(k, normaliseMarket(k, rec.markets[k]), { id, canLog: false, settlement: rec.settlement })).join('') + '</div></div>';
  } else {
    html += '<div class="empty section">No prediction was published for this match. MatchIQ publishes up to 21 days before kick-off, and the history starts in October 2026.</div>';
  }
  return html + '</section>';
}

let resultsFilter = 'settled';
function viewResults() {
  const allPerf = DATA.performance || {};
  const other = compFilter !== 'ALL' && compFilter !== 'PL';
  const perf = other ? ((allPerf.by_competition || {})[compFilter] || {}) : allPerf;  // leagues are never pooled
  const lv = other ? (((DATA.leagueValidation || {}).leagues || {})[compFilter] || null) : null;
  const rel = other ? null : DATA.reliability;
  const res = (perf.markets || {}).result;
  const latest = {};
  for (const r of historyRecords()) latest[r.match_id] = r.evaluated ? r : (latest[r.match_id] && latest[r.match_id].evaluated ? latest[r.match_id] : r);
  const recs = Object.values(latest).filter(r => inComp(r.fixture.competition)).sort((a, b) => kickoffMs(b.fixture) - kickoffMs(a.fixture));
  const settled = recs.filter(r => r.evaluated), pending = recs.filter(r => !r.evaluated && kickoffMs(r.fixture) <= Date.now() && !r.result), future = recs.filter(r => kickoffMs(r.fixture) > Date.now());
  let html = '<section class="view"><h1 class="page-title">Results & performance</h1><p class="page-sub">Every prediction MatchIQ publishes is sealed before kick-off and scored once the result is confirmed. Nothing here is edited after the fact.</p>' + compBar() +
    (compFilter === 'ALL' ? '<div class="notice section">Scorecards are kept per competition and never pooled. The figures below are the Premier League; choose a competition above for another.</div>' + byCompetitionCards(allPerf) : '');
  if (LOAD_ERRORS.history) return html + errorPanel('history') + '</section>';
  html += '<div class="tiles section" style="margin-top:18px">' +
    '<div class="tile"><div class="k">Settled predictions</div><div class="v">' + settled.length + '</div><div class="s">' + pending.length + ' awaiting a result · ' + future.length + ' upcoming</div></div>' +
    '<div class="tile"><div class="k">Match-result picks right</div><div class="v">' + (res ? pct(res.pick_hit_rate) : '—') + '</div><div class="s">' + (res ? res.n + ' matches · average pick ' + pct(res.mean_pick_p) : 'none settled yet') + '</div></div>' +
    '<div class="tile"><div class="k">Match-result Brier (live)</div><div class="v">' + (res ? res.brier.toFixed(3) : '—') + '</div><div class="s">Lower is better. League average scored ' + (lv && lv.markets.result ? lv.markets.result.league_brier.toFixed(3) : rel ? rel.markets.wins.league_average_brier.toFixed(3) : '0.660') + ' in the backtest.</div></div>' +
    '<div class="tile"><div class="k">Published records</div><div class="v">' + (perf.published_records || 0) + '</div><div class="s">including earlier revisions</div></div></div>';
  if (!res || !res.sufficient_sample) html += '<div class="notice section">Early days: ' + (res ? res.n : 0) + ' settled match-result predictions. Live figures need at least ' + (perf.min_report_n || 20) + ' before they mean much, so lean on the backtest below until then.</div>';

  const marketCards = MARKET_ORDER.filter(k => (perf.markets || {})[k]).map(k => { const m = perf.markets[k];
    return statCard(esc(MARKETS[k].name), m.sufficient_sample ? '' : '<span class="badge pending">small sample</span>',
      [['Settled', m.n], ['Picks right', pct(m.pick_hit_rate)], ['Brier', m.brier.toFixed(3)]], { claimed: m.mean_pick_p, actual: m.pick_hit_rate }); }).join('');
  html += '<div class="section card"><div class="section-head"><h2 class="section-title">Live record by market</h2><span class="section-note">The two bars should sit close together if the estimates are honest.</span></div>' +
    (marketCards ? '<div class="stat-cards">' + marketCards + '</div>' : '<p class="muted">No settled predictions yet.</p>') + '</div>';

  const bands = (perf.bands || {}).result || {};
  const bandRows = Object.entries(bands).sort().map(([band, b]) => '<div class="calib-row"><span class="mono">' + esc(band) + '</span><div class="calib-bars" aria-label="Predicted ' + pct(b.mean_pick_p) + ', happened ' + pct(b.pick_hit_rate) + '"><span class="pred" style="width:' + (100 * b.mean_pick_p).toFixed(0) + '%"></span><span class="obs" style="width:' + (100 * b.pick_hit_rate).toFixed(0) + '%"></span></div><span class="mono dim">' + pct(b.pick_hit_rate) + ' · n=' + b.n + '</span></div>').join('');
  html += '<div class="section grid grid-2"><div class="card"><h2 class="section-title">Calibration, live</h2><p class="section-note" style="margin:4px 0 12px">Pale bar: average predicted chance. Green bar: how often it happened.</p>' + (bandRows ? '<div class="calib">' + bandRows + '</div>' : '<p class="muted">Appears once predictions settle.</p>') + '</div>' +
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
    '<p class="section-note" style="margin-top:10px">Promotion needs ' + (ch ? ch.min_n_for_promotion : 150) + '+ settled matches, a 95% interval clear of zero and owner approval. The current model stays pinned for rollback.</p></div></div>';

  const shown = resultsFilter === 'settled' ? settled : resultsFilter === 'pending' ? pending : future;
  html += '<div class="section card" style="padding:0"><div class="section-head" style="padding:16px 16px 0"><h2 class="section-title">Prediction log</h2><div class="seg" role="group" aria-label="Prediction log">' +
    [['settled', 'Settled'], ['pending', 'Awaiting result'], ['future', 'Upcoming']].map(([k, l]) => '<button type="button" data-rfilter="' + k + '" aria-pressed="' + (resultsFilter === k) + '">' + l + '</button>').join('') + '</div></div>' +
    (shown.length ? shown.map(logRow).join('') : '<p class="muted" style="padding:16px">Nothing here yet.</p>') + '</div>';
  return html + '</section>';
}

/* One readable card per row of a scorecard: a title, optional badge, an estimate-versus-landed bar
   and a grid of labelled figures. Replaces wide tables that scrolled sideways on phones. */
function statCard(title, badge, stats, bar) {
  return '<article class="stat-card"><div class="stat-head"><h3>' + title + '</h3>' + (badge || '') + '</div>' +
    (bar ? '<div class="stat-bar" role="img" aria-label="Estimated ' + pct(bar.claimed) + ', landed ' + pct(bar.actual) + '"><span class="pred" style="width:' + (100 * bar.claimed).toFixed(0) + '%"></span><span class="obs" style="width:' + (100 * bar.actual).toFixed(0) + '%"></span></div>' +
      '<div class="stat-legend"><span>Estimated ' + pct(bar.claimed) + '</span><span>Landed ' + pct(bar.actual) + '</span></div>' : '') +
    '<dl class="stat-grid">' + stats.map(([k, v, cls]) => '<div><dt>' + k + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</dd></div>').join('') + '</dl></article>';
}

function diaryByRecommendation() {
  const groups = { most_likely: [], best_value: [], other: [] };
  for (const e of getStoredDiary()) (groups[e.recommendation] || groups.other).push(e);
  return Object.entries(groups).map(([k, list]) => {
    const settled = list.filter(e => e.outcome && e.outcome !== 'pending');
    const s = calc.summarizeBetDiary(settled);
    return { key: k, n: list.length, settled: settled.length, won: s.wonCount, lost: s.lostCount, void: s.voidCount, staked: s.settledStaked, profit: s.netProfit, roi: s.roiPct };
  });
}

function scorecard(perf) {
  const ml = perf.most_likely || { n: 0 };
  const byMarket = Object.entries(perf.most_likely_by_market || {});
  const dec = perf.decisions || {};
  const labels = { most_likely: 'Most Likely picks', best_value: 'Best Value picks', other: 'Other bets' };
  const signed = v => (v >= 0 ? '+' : '−') + '£' + Math.abs(v).toFixed(2);
  const bets = diaryByRecommendation().map(g => statCard(labels[g.key], g.n ? '' : '<span class="badge pending">none yet</span>',
    [['Bets', g.n], ['Won–lost–void', g.won + '–' + g.lost + '–' + g.void], ['Settled stake', '£' + g.staked.toFixed(2)], ['Profit', signed(g.profit), g.profit > 0 ? 'pos' : g.profit < 0 ? 'neg' : ''], ['ROI', g.settled ? g.roi.toFixed(0) + '%' : '—']])).join('');
  const mlMarkets = byMarket.map(([k, v]) => statCard(esc(MARKETS[k].name), '', [['Settled', v.n], ['Landed', pct(v.pick_hit_rate)]], { claimed: v.mean_pick_p == null ? v.pick_hit_rate : v.mean_pick_p, actual: v.pick_hit_rate })).join('');
  return '<div class="section card"><h2 class="section-title">Most Likely scorecard (sealed)</h2>' +
    '<p class="section-note" style="margin:4px 0 12px">Every Most Likely pick is sealed before kick-off and scored when the result is confirmed.</p>' +
    (ml.n ? '<div class="stat-cards">' + statCard('All Most Likely picks', ml.sufficient_sample ? '' : '<span class="badge pending">small sample</span>', [['Settled', ml.n], ['Landed', pct(ml.pick_hit_rate)], ['Average estimate', pct(ml.mean_pick_p)], ['Brier', ml.brier.toFixed(3)]], { claimed: ml.mean_pick_p, actual: ml.pick_hit_rate }) + mlMarkets + '</div>'
      : '<p class="muted">No Most Likely pick has settled yet. The first ones settle once the 31 October fixtures have confirmed results.</p>') +
    '<p class="section-note" style="margin-top:12px">Value decisions so far: ' + (dec['best_value:no_bet'] || 0) + ' No Bet (no bookmaker price available), ' + (dec['best_value:value'] || 0) + ' value calls.' + (ml.n && !ml.sufficient_sample ? ' Small sample: treat these figures as anecdotes.' : '') + '</p></div>' +
    '<div class="section card"><h2 class="section-title">Your recorded bets</h2><p class="section-note" style="margin:4px 0 12px">From your Bet Diary in this browser, at the prices you actually took. A high hit rate is not the same as profit.</p>' +
    '<div class="stat-cards">' + bets + '</div></div>';
}

function byCompetitionCards(allPerf) {
  const rows = [['PL', allPerf]].concat(Object.entries(allPerf.by_competition || {}));
  return '<div class="section"><div class="stat-cards">' + rows.map(([code, p]) => { const r = (p.markets || {}).result;
    return statCard(esc(leagueName(code)), r && r.sufficient_sample ? '' : '<span class="badge pending">' + (r ? 'small sample' : 'none settled yet') + '</span>',
      [['Settled', r ? r.n : 0], ['Picks right', r ? pct(r.pick_hit_rate) : '—'], ['Brier', r ? r.brier.toFixed(3) : '—']], r ? { claimed: r.mean_pick_p, actual: r.pick_hit_rate } : null); }).join('') + '</div></div>';
}

function leagueBacktestCard(lv) {
  if (!lv) return '<div class="card"><h2 class="section-title">Backtest reference</h2><p class="muted">This league has not been backtested yet, so every estimate is provisional.</p></div>';
  const names = { result: 'Match result', goals: 'Over 2.5 goals', btts: 'Both teams to score', corners: 'Corners 9.5', cards: 'Cards 3.5', shots: 'Shots 8.5' };
  const rows = Object.entries(names).filter(([k]) => lv.markets[k]).map(([k, l]) => { const m = lv.markets[k], b = m.model_brier != null ? m.model_brier : m.blend_brier;
    return '<tr><td>' + l + '</td><td class="num">' + b.toFixed(3) + '</td><td class="num">' + m.league_brier.toFixed(3) + '</td><td class="num">' + m.n + '</td></tr>'; }).join('');
  return '<div class="card"><h2 class="section-title">Backtest reference</h2><p class="section-note" style="margin:4px 0 8px">' + esc(lv.name) + ', ' + esc(lv.test_season_label) + ': each match predicted from earlier results only, model refitted weekly. One season is a small test, so every ' + esc(lv.name) + ' estimate stays provisional until a forward record builds up.</p>' +
    '<table class="table"><thead><tr><th>Market</th><th style="text-align:right">Brier</th><th style="text-align:right">League avg</th><th style="text-align:right">Matches</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function backtestCard(rel) {
  if (!rel) return '<div class="card"><h2 class="section-title">Backtest reference</h2><p class="muted">Backtest evidence unavailable.</p></div>';
  const rows = [['wins', 'Match result'], ['goals', 'Over 2.5 goals'], ['btts', 'Both teams to score'], ['corners', 'Corners 9.5'], ['cards', 'Cards 3.5'], ['shots', 'Shots 8.5']]
    .map(([k, l]) => { const m = rel.markets[k]; return '<tr><td>' + l + '</td><td class="num">' + m.brier.toFixed(3) + '</td><td class="num">' + m.league_average_brier.toFixed(3) + '</td><td>' + (m.beats_league_average ? '<span class="badge validated">Beats average</span>' : '<span class="badge provisional">No edge</span>') + '</td></tr>'; }).join('');
  return '<div class="card"><h2 class="section-title">Backtest reference</h2><p class="section-note" style="margin:4px 0 8px">' + rel.markets.wins.n + ' matches, ' + esc(rel.window[0]) + ' to ' + esc(rel.window[1]) + ', each predicted from earlier data only. This is research evidence, not the live record.</p>' +
    '<table class="table"><thead><tr><th>Market (old method)</th><th style="text-align:right">Brier</th><th style="text-align:right">League avg</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function logRow(r) {
  const f = r.fixture, ms = kickoffMs(f), m = r.markets.result, s = r.settlement && r.settlement.result;
  const right = s ? '<span class="badge ' + (s.pick_won ? 'won' : 'lost') + '">' + (s.pick_won ? 'Right' : 'Wrong') + '</span>' : r.result ? '' : '<span class="badge pending">' + (ms > Date.now() ? 'Upcoming' : 'Awaiting') + '</span>';
  return '<a class="log-row" href="#/match/' + encodeURIComponent(r.match_id) + '"><span class="fx-time">' + esc(fmtDay(ms)) + '<small>' + esc(fmtTime(ms)) + '</small></span>' +
    '<span><span class="teams-line">' + crest(f.home, 18) + '<span>' + esc(f.home) + ' v ' + esc(f.away) + '</span></span><span class="dim" style="display:block;font-size:13px">Predicted <b style="color:#fff">' + esc(m.pick.label) + '</b> ' + pct(m.pick.p) + ' · fair ' + esc(m.pick.fair_odds) + (r.result ? ' · final ' + r.result.score.join('–') : '') + '</span></span>' + right + '</a>';
}

// ------------------------------------------------------------ Bet Diary
let diaryReadFailed = false;
let diaryProfileFilter = 'all';
function getStoredDiary() {
  try { const entries = calc.loadBetDiary(localStorage, DIARY_STORAGE_KEY); diaryReadFailed = false; return entries; }
  catch (error) { diaryReadFailed = true; console.error('Bet Diary could not be read:', error); return []; }
}
function saveStoredDiary(entries) {
  if (diaryReadFailed) throw new Error('Bet Diary read failed; refusing to overwrite existing data.');
  calc.saveBetDiary(localStorage, DIARY_STORAGE_KEY, entries);
  updateDiaryCount();
}
function updateDiaryCount() { const n = getStoredDiary().length; $('diary-count').textContent = n ? String(n) : ''; }
const money = v => '£' + Math.abs(v).toFixed(2);

function viewDiary() {
  const all = getStoredDiary();
  const diary = diaryProfileFilter === 'all' ? all : all.filter(e => (e.profile || 'Default') === diaryProfileFilter);
  const s = calc.summarizeBetDiary(diary);
  const profiles = Array.from(new Set(all.map(e => e.profile || 'Default'))).sort();
  let html = '<section class="view"><div class="section-head" style="align-items:flex-end"><div><h1 class="page-title">Bet Diary</h1><p class="page-sub">Your private record of bets and prices. Stored only in this browser: it does not sync between devices, and clearing site data removes it, so export a copy now and then.</p></div>' +
    '<div class="btn-row"><button type="button" class="btn primary" data-diary="{}">Add a bet</button><button type="button" class="btn" data-export="csv">Export CSV</button><button type="button" class="btn" data-export="json">Export JSON</button></div></div>';
  if (diaryReadFailed) html += '<div class="notice error">Saved diary data could not be read. It has been left untouched, and saving is disabled to protect it.</div>';
  html += '<div class="tiles section" style="margin-top:16px">' +
    '<div class="tile"><div class="k">Profit / loss</div><div class="v ' + (s.netProfit > 0 ? 'pos' : s.netProfit < 0 ? 'neg' : '') + '">' + (s.netProfit > 0 ? '+' : s.netProfit < 0 ? '−' : '') + money(s.netProfit) + '</div><div class="s">ROI ' + s.roiPct.toFixed(1) + '% on settled stakes</div></div>' +
    '<div class="tile"><div class="k">Staked</div><div class="v">' + money(s.totalStaked) + '</div><div class="s">' + money(s.settledStaked) + ' settled · ' + s.pendingCount + ' pending</div></div>' +
    '<div class="tile"><div class="k">Returned</div><div class="v">' + money(s.totalReturned) + '</div><div class="s">winnings plus void stakes</div></div>' +
    '<div class="tile"><div class="k">Won · lost · void</div><div class="v">' + s.wonCount + ' · ' + s.lostCount + ' · ' + s.voidCount + '</div><div class="s">' + s.originBreakdown.matchiq.count + ' following MatchIQ · ' + s.originBreakdown.independent.count + ' own choice</div></div></div>';
  html += '<div class="section" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between"><label class="field" style="grid-auto-flow:column;align-items:center;gap:10px"><span class="lbl">Profile</span><select id="diary-profile-filter" class="ctl" style="width:auto"><option value="all">All profiles</option>' +
    profiles.map(p => '<option value="' + esc(p) + '"' + (diaryProfileFilter === p ? ' selected' : '') + '>' + esc(p) + '</option>').join('') + '</select></label>' +
    (all.length ? '<button type="button" class="btn small danger" data-clear-diary>Clear diary</button>' : '') + '</div>';
  if (!diary.length) return html + '<div class="empty section">No bets yet. Open any match and use "+ Diary" on a selection, or add one here.</div></section>';
  return html + '<div class="grid grid-2 section">' + diary.map(betCard).join('') + '</div></section>';
}

function outcomeSelect(value, attrs, label) {
  return '<select class="ctl" style="width:auto;min-height:40px" aria-label="' + esc(label) + '" ' + attrs + '>' +
    ['pending', 'won', 'lost', 'void'].map(o => '<option value="' + o + '"' + (value === o ? ' selected' : '') + '>' + o[0].toUpperCase() + o.slice(1) + '</option>').join('') + '</select>';
}

function betCard(entry) {
  const profit = calc.calculateBetProfit(entry.stake, entry.odds, entry.outcome);
  const pl = profit === null ? '<span class="dim">Potential return ' + money(entry.stake * (entry.odds || 0)) + '</span>'
    : '<span class="' + (profit > 0 ? 'pos' : profit < 0 ? 'neg' : '') + '">' + (profit > 0 ? '+' : profit < 0 ? '−' : '') + money(profit) + '</span> <span class="dim">returned ' + money(entry.stake + profit) + '</span>';
  const legs = entry.type === 'accumulator' ? (entry.legs || []).map((leg, i) => '<div class="leg"><span>' + esc(leg.selection) + ' · <b class="mono">' + calc.formatFractionalOdds(+leg.odds) + '</b></span>' +
    outcomeSelect(leg.outcome, 'data-leg="' + esc(entry.id) + '" data-index="' + i + '"', 'Settle ' + leg.selection) + '</div>').join('') : '';
  return '<article class="card bet"><div class="bet-top"><div><div class="bet-sel">' + esc(entry.selection) + '</div><div class="dim" style="font-size:13px">' + esc(entry.fixture || '') + ' · ' + esc(entry.date || '') + ' · ' + esc(entry.marketName || entry.market || '') + '</div></div>' +
    '<span style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end"><span class="badge ' + (entry.origin === 'independent' ? 'market' : 'validated') + '">' + (entry.origin === 'independent' ? 'Own choice' : 'MatchIQ pick') + '</span>' +
      (entry.recommendation ? '<span class="badge provisional">' + esc(REC_LABEL[entry.recommendation] || entry.recommendation) + '</span>' : '') + '</span></div>' + legs +
    '<div class="bet-facts"><div><span>Price taken</span><b>' + calc.formatFractionalOdds(+entry.odds) + '</b></div>' +
      (entry.model_fair_odds ? '<div><span>Model fair odds</span><b>' + esc(entry.model_fair_odds) + '</b></div>' : '') +
      '<div><span>Stake</span><b>' + money(+entry.stake) + '</b></div><div><span>Bookmaker</span><b style="font-family:var(--body)">' + esc(entry.bookmaker || '—') + '</b></div>' +
      '<div><span>Profile</span><b style="font-family:var(--body)">' + esc(entry.profile || 'Default') + (entry.type === 'accumulator' ? ' · ' + (entry.legs || []).length + '-leg acca' : '') + '</b></div></div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between"><span>' + pl + '</span><span style="display:flex;gap:8px;align-items:center">' +
      outcomeSelect(entry.outcome, 'data-outcome="' + esc(entry.id) + '"', 'Settle bet') +
      '<button type="button" class="btn small danger" data-delete="' + esc(entry.id) + '" aria-label="Delete bet">Delete</button></span></div>' +
    (entry.notes ? '<p class="dim" style="font-size:13px">' + esc(entry.notes) + '</p>' : '') + '</article>';
}

function updateAccumulatorLegOutcome(id, index, outcome) {
  const diary = getStoredDiary();
  const entry = diary.find(item => item.id === id && item.type === 'accumulator');
  if (!entry || !entry.legs || !entry.legs[index]) return;
  entry.legs[index].outcome = outcome;
  const settled = calc.settleAccumulator(entry, entry.legs.map(leg => leg.outcome));
  entry.outcome = settled.outcome;
  entry.odds = settled.decimalOdds;
  entry.potentialReturn = settled.potentialReturn;
  try { saveStoredDiary(diary); } catch (error) { toast('Could not save the settlement. Check browser storage.', 'error'); return; }
  render();
}

function updateDiaryEntryOutcome(id, outcome) {
  const diary = getStoredDiary();
  const entry = diary.find(e => e.id === id);
  if (!entry) return;
  entry.outcome = outcome;
  try { saveStoredDiary(diary); } catch (error) { toast('Could not save the settlement. Check browser storage.', 'error'); return; }
  toast('Marked ' + outcome + '.');
  render();
}

function deleteDiaryEntry(id) {
  if (!confirm('Remove this bet from your diary?')) return;
  try { saveStoredDiary(getStoredDiary().filter(e => e.id !== id)); } catch (error) { toast('Could not update the diary.', 'error'); return; }
  toast('Bet removed.');
  render();
}

function clearDiary() {
  if (!confirm('Clear your entire Bet Diary? This cannot be undone. Export a copy first if you want to keep it.')) return;
  try { saveStoredDiary([]); } catch (error) { toast('Could not update the diary.', 'error'); return; }
  render();
}

function exportDiaryCSV() {
  const diary = getStoredDiary();
  if (!diary.length) { toast('The diary is empty.', 'error'); return; }
  const headers = ['id', 'date', 'fixture', 'market', 'selection', 'origin', 'bookmaker', 'odds_fractional', 'model_fair_odds', 'accumulator_legs_fractional', 'stake_gbp', 'outcome', 'net_profit_gbp', 'profile', 'timestamp', 'notes'];
  const csvRows = [headers.join(',')];
  // RFC 4180 quoting: wrap every text cell and double embedded quotes.
  const cell = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  for (const e of diary) {
    const profit = calc.calculateBetProfit(e.stake, e.odds, e.outcome);
    csvRows.push([cell(e.id), cell(e.date), cell(e.fixture), cell(e.market), cell(e.selection), cell(e.origin || 'matchiq'), cell(e.bookmaker),
      cell(calc.formatFractionalOdds(e.odds)), cell(e.model_fair_odds || ''),
      cell((e.legs || []).map(leg => leg.selection + ' @ ' + calc.formatFractionalOdds(leg.odds) + ' (' + (leg.outcome || 'pending') + ')').join('; ')),
      e.stake, cell(e.outcome || 'pending'), profit !== null ? profit : '', cell(e.profile || 'Default'), cell(e.timestamp), cell(e.notes)].join(','));
  }
  downloadFile(csvRows.join('\n'), 'matchiq_bet_diary_' + new Date().toISOString().slice(0, 10) + '.csv', 'text/csv');
}

function exportDiaryJSON() {
  const exportEntries = getStoredDiary().map(entry => {
    const { odds, legs, ...rest } = entry;
    return { ...rest, odds_fractional: calc.formatFractionalOdds(odds),
      ...(Array.isArray(legs) ? { legs: legs.map(leg => { const { odds: legOdds, ...legRest } = leg; return { ...legRest, odds_fractional: calc.formatFractionalOdds(legOdds) }; }) } : {}) };
  });
  downloadFile(JSON.stringify(exportEntries, null, 2), 'matchiq_bet_diary_' + new Date().toISOString().slice(0, 10) + '.json', 'application/json');
}

function downloadFile(content, fileName, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ------------------------------------------------------------ diary modal
let modalPrefill = {};
function diaryFixtureOptions() {
  const now = Date.now();
  return fixturesList().filter(f => Math.abs(kickoffMs(f) - now) < 21 * 86400000 && f.status !== 'REMOVED_FROM_SCHEDULE')
    .sort((a, b) => kickoffMs(a) - kickoffMs(b));
}

function openDiary(prefill) {
  modalPrefill = prefill || {};
  const select = $('modal-fixture-select');
  const options = diaryFixtureOptions();
  select.innerHTML = '<option value="">Not linked to a listed match</option>' + options.map(f => '<option value="' + esc(f.id) + '"' + (f.id === modalPrefill.id ? ' selected' : '') + '>' + esc(f.home + ' v ' + f.away + ' · ' + fmtDay(kickoffMs(f)) + ' ' + fmtTime(kickoffMs(f))) + '</option>').join('');
  $('modal-market-select').value = modalPrefill.market || 'wins';
  $('modal-selection-input').value = modalPrefill.selection || '';
  $('modal-origin-select').value = modalPrefill.selection ? 'matchiq' : 'independent';
  $('modal-odds-input').value = modalPrefill.odds || '';
  $('modal-bet-type').value = 'single';
  $('modal-fair-hint').textContent = modalPrefill.fair ? 'MatchIQ model fair odds ' + modalPrefill.fair + '. That is not a bookmaker price: enter the price you were actually offered.' : '';
  toggleAccumulatorFields();
  updateModalPnlPreview();
  $('diary-modal').hidden = false;
  setTimeout(() => (modalPrefill.selection ? $('modal-odds-input') : $('modal-selection-input')).focus(), 30);
}
function closeDiary() { $('diary-modal').hidden = true; }

function toggleAccumulatorFields() {
  const acc = $('modal-bet-type').value === 'accumulator';
  $('accumulator-legs-row').hidden = !acc;
  ['single-selection-row', 'single-odds-row', 'single-market-row'].forEach(id => { $(id).hidden = acc; });
  updateModalPnlPreview();
}

function parseAccumulatorLegs() {
  return ($('modal-legs-input').value || '').split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [selection, oddsText] = line.split('|').map(part => (part || '').trim());
    return { selection, odds: calc.parseFractionalOdds(oddsText), outcome: 'pending' };
  });
}

function updateModalPnlPreview() {
  const acc = $('modal-bet-type').value === 'accumulator';
  const legs = acc ? parseAccumulatorLegs() : [];
  const odds = acc ? (legs.length >= 2 && legs.every(l => Number.isFinite(l.odds) && l.odds > 1) ? legs.reduce((t, l) => t * l.odds, 1) : 0) : (calc.parseFractionalOdds($('modal-odds-input').value) || 0);
  const stake = Number($('modal-stake-input').value) || 0;
  const preview = $('modal-pnl-preview');
  if (odds > 1 && stake > 0) {
    const profit = calc.calculateBetProfit(stake, odds, 'won');
    preview.textContent = 'Potential return £' + (stake * odds).toFixed(2) + ' (profit £' + profit.toFixed(2) + ') at ' + calc.formatFractionalOdds(odds) + (acc ? ' combined' : '') + '.';
  } else preview.textContent = acc ? 'Add at least two legs as "selection | fractional odds", such as "Arsenal win | 4/6".' : 'Enter valid UK fractional odds, such as 6/4, 1/2 or Evens, and a stake.';
}

function handleDiaryFormSubmit(event) {
  event.preventDefault();
  const acc = $('modal-bet-type').value === 'accumulator';
  const legs = acc ? parseAccumulatorLegs() : [];
  const stake = Number($('modal-stake-input').value);
  const singleOdds = calc.parseFractionalOdds($('modal-odds-input').value);
  if (!Number.isFinite(stake) || stake <= 0) { toast('Enter a stake greater than £0.', 'error'); return; }
  if (acc && (legs.length < 2 || legs.some(l => !l.selection || !Number.isFinite(l.odds) || l.odds <= 1))) { toast('Add at least two legs as "selection | fractional odds", such as 6/4 or Evens.', 'error'); return; }
  if (!acc && (!Number.isFinite(singleOdds) || singleOdds <= 1)) { toast('Enter valid UK fractional odds, such as 6/4, 1/2 or Evens.', 'error'); return; }
  if (!acc && !$('modal-selection-input').value.trim()) { toast('Enter what you backed.', 'error'); return; }
  const odds = acc ? legs.reduce((t, l) => t * l.odds, 1) : singleOdds;
  const f = fixtureById($('modal-fixture-select').value);
  const market = $('modal-market-select').value;
  const linked = f && modalPrefill.id === f.id && !acc;
  const entry = {
    id: 'bet-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), type: acc ? 'accumulator' : 'single',
    profile: $('modal-profile').value.trim() || 'Default',
    date: f ? f.kickoff_utc.slice(0, 10) : new Date().toISOString().slice(0, 10), match_id: f ? f.id : undefined,
    fixture: f ? f.home + ' v ' + f.away : acc ? 'Accumulator' : 'Not linked to a listed match',
    market: acc ? 'accumulator' : market, marketName: acc ? 'Accumulator' : (Object.values(MARKETS).find(m => m.diary === market) || {}).name || market,
    selection: acc ? legs.map(l => l.selection).join(' + ') : $('modal-selection-input').value.trim(), legs: acc ? legs : undefined,
    origin: $('modal-origin-select').value, bookmaker: $('modal-bookmaker-input').value.trim() || 'Bookmaker',
    odds, stake, potentialReturn: stake * odds, outcome: 'pending', timestamp: new Date().toISOString(),
    model_p: linked && modalPrefill.p != null ? modalPrefill.p : undefined, model_fair_odds: linked ? modalPrefill.fair : undefined,
    recommendation: linked && modalPrefill.rec && $('modal-selection-input').value.trim() === modalPrefill.selection ? modalPrefill.rec : undefined,
    notes: $('modal-notes-input').value.trim()
  };
  try { const diary = getStoredDiary(); diary.unshift(entry); saveStoredDiary(diary); }
  catch (error) { console.error(error); toast('Could not save to this browser. Check storage space or privacy settings.', 'error'); return; }
  closeDiary();
  toast('Saved to your Bet Diary.');
  if (currentRoute()[0] === 'diary') render();
}

// ------------------------------------------------------------ More: sources, method, feedback
const feedbackState = { understand: 0, convincing: 0, useful: '', chips: new Set() };
function getStoredFeedback() { try { const v = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }

function viewMore() {
  const s = DATA.status || {};
  const sourceRows = Object.entries(s.sources || {}).map(([name, src]) => '<tr><td>' + esc(src.label || name) + '</td><td>' + (src.ok ? '<span class="badge validated">Responding</span>' : '<span class="badge provisional">' + esc(/TOKEN not configured/.test(src.note || '') ? 'Optional: needs a free API token' : src.note || 'Not used') + '</span>') + '</td><td class="num">' + (src.matches != null ? src.matches : '') + '</td><td class="num">' + (src.results != null ? src.results : '') + '</td></tr>').join('');
  const fb = getStoredFeedback();
  const stars = (q, label) => '<div class="field"><span class="lbl">' + label + '</span><div class="stars">' + [1, 2, 3, 4, 5].map(n => '<button type="button" data-star="' + q + '" data-value="' + n + '" aria-pressed="' + (feedbackState[q] === n) + '">' + n + '</button>').join('') + '</div></div>';
  return '<section class="view"><h1 class="page-title">Data, methods & feedback</h1>' +
    '<div class="section grid grid-2"><div class="card"><h2 class="section-title">Update status</h2><div class="chips" style="margin:10px 0">' + freshnessChips() + '</div>' +
      '<p class="muted" style="font-size:13.5px">Last attempt ' + esc(s.attempted_at ? ago(s.attempted_at) : 'unknown') + '. Last success ' + esc(s.last_success ? ago(s.last_success) : 'never') + '. ' + (s.errors && s.errors.length ? 'Errors: ' + esc(s.errors.join(' ')) : 'No errors.') + '</p>' +
      '<div style="overflow-x:auto"><table class="table" style="margin-top:8px"><thead><tr><th>Source</th><th>Status</th><th style="text-align:right">Fixtures</th><th style="text-align:right">Results</th></tr></thead><tbody>' + sourceRows + '</tbody></table></div>' +
      '<p class="section-note" style="margin-top:10px">' + esc(s.attribution || '') + ' No bookmaker feed is connected: no free source with clear reuse rights was found, so bookmaker odds are never shown as available.</p></div>' +
    '<div class="card"><h2 class="section-title">Where each number comes from</h2><table class="table" style="margin-top:8px"><tbody>' +
      '<tr><td><b>Match result</b></td><td>Validated frozen Dixon-Coles model. For promoted clubs without enough Premier League games: Premier League + Championship model, pulled halfway to league averages (provisional). With no usable history: league averages (limited evidence).</td></tr>' +
      '<tr><td><b>Goals, both teams to score</b></td><td>Provisional: 30% score model, 70% league rate. Backtests show no proven edge.</td></tr>' +
      '<tr><td><b>Corners, cards, shots</b></td><td>Provisional: 30% recent venue averages, 70% league rate. The frozen corners model is shown for reference only, because it backtested worse than the league average.</td></tr>' +
      '<tr><td><b>Other competitions</b></td><td>Championship, Bundesliga, La Liga, Serie A and Ligue 1 each use their own time-weighted Dixon-Coles model fitted on that league only, backtested on 2025-26 against that league’s average. They stay provisional (no value calls) until a forward record exists. A club with too little recent history, such as a newly promoted side, gets the league average instead.</td></tr>' +
      '<tr><td><b>Fair odds</b></td><td>1 ÷ probability, rounded to a familiar UK price. Not a bookmaker price.</td></tr></tbody></table></div></div>' +
    '<div class="section card"><h2 class="section-title">Tell us what you think</h2><form id="fb-form" class="grid" style="margin-top:12px">' +
      stars('understand', 'How clear were the predictions? (1 confusing, 5 crystal clear)') + stars('convincing', 'How convincing was the evidence?') +
      '<div class="field"><span class="lbl">Was it useful?</span><div class="stars">' + [['useful', 'Very useful'], ['neutral', 'Somewhat'], ['not_useful', 'Not useful']].map(([v, l]) => '<button type="button" class="opt" data-useful="' + v + '" aria-pressed="' + (feedbackState.useful === v) + '">' + l + '</button>').join('') + '</div></div>' +
      '<div class="field"><span class="lbl">Anything confusing?</span><div class="stars">' + ['Evidence labels', 'Odds vs probabilities', 'Provisional estimates', 'Navigation', 'Diary returns', 'All clear'].map(c => '<button type="button" class="opt" data-chip="' + esc(c) + '" aria-pressed="' + feedbackState.chips.has(c) + '">' + esc(c) + '</button>').join('') + '</div></div>' +
      '<div class="field"><label for="fb-improvements">What would make MatchIQ better?</label><textarea id="fb-improvements" class="ctl"></textarea></div>' +
      '<div class="btn-row"><button type="submit" class="btn primary">Send feedback</button>' + (fb.length ? '<button type="button" class="btn" data-export="feedback">Export ' + fb.length + ' responses</button>' : '') + '</div>' +
      '<p class="section-note">Feedback is stored in this browser only.</p></form></div></section>';
}

function handleFeedbackSubmit(event) {
  event.preventDefault();
  const list = getStoredFeedback();
  list.unshift({ id: 'fb-' + Date.now(), timestamp: new Date().toISOString(), ratingUnderstand: feedbackState.understand, ratingConvincing: feedbackState.convincing,
    usefulness: feedbackState.useful, chips: Array.from(feedbackState.chips), improvements: ($('fb-improvements').value || '').trim() });
  try { localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(list)); toast('Feedback saved. Thank you.'); }
  catch (e) { toast('Could not save feedback in this browser.', 'error'); }
  Object.assign(feedbackState, { understand: 0, convincing: 0, useful: '', chips: new Set() });
  render();
}

// ------------------------------------------------------------ shell
function errorPanel(key) {
  return '<div class="notice error section">Could not load ' + esc(FILES[key]) + ' (' + esc(LOAD_ERRORS[key]) + '). Check your connection, then <button type="button" class="btn small" data-retry>try again</button>.</div>';
}

function toast(msg, type) {
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'error' ? ' error' : '');
  t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 3400);
}

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash.startsWith('match=')) return ['home'];  // Mission 063 deep links
  const [view, ...rest] = hash.split('/');
  return [view || 'home', decodeURIComponent(rest.join('/'))];
}

let lastRoute = '';
function render() {
  const [view, arg] = currentRoute();
  const navKey = view === 'match' ? 'fixtures' : view;
  document.querySelectorAll('.nav a').forEach(a => { if (a.dataset.nav === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const html = view === 'fixtures' ? viewFixtures() : view === 'match' ? viewMatch(arg) : view === 'results' ? viewResults() : view === 'diary' ? viewDiary() : view === 'more' ? viewMore() : viewHome();
  $('app').innerHTML = html;
  const titles = { home: 'Strongest signals', fixtures: 'Fixtures', match: 'Match analysis', results: 'Results & performance', diary: 'Bet Diary', more: 'Data & methods' };
  document.title = (titles[view] || 'MatchIQ') + ' · MatchIQ';
  const key = view + '/' + arg;
  if (key !== lastRoute) {
    // Animate and scroll only on navigation, not on in-page updates.
    const first = $('app').querySelector('.view');
    if (first) first.classList.add('enter');
    window.scrollTo({ top: 0 });
    lastRoute = key;
  }
}

document.addEventListener('click', event => {
  const t = event.target.closest('[data-diary],[data-close],[data-comp],[data-tab],[data-showall],[data-rfilter],[data-export],[data-delete],[data-clear-diary],[data-retry],[data-star],[data-useful],[data-chip],#bookmaker-quick button');
  if (!t) { if (event.target.id === 'diary-modal') closeDiary(); return; }
  if (t.dataset.diary !== undefined) openDiary(JSON.parse(t.dataset.diary || '{}'));
  else if (t.dataset.close !== undefined) closeDiary();
  else if (t.dataset.comp) { compFilter = t.dataset.comp; try { localStorage.setItem(COMP_KEY, compFilter); } catch (e) { /* ignore */ } render(); }
  else if (t.dataset.tab) { fixturesTab = t.dataset.tab; fixturesShowAll = false; render(); }
  else if (t.dataset.showall !== undefined) { fixturesShowAll = true; render(); }
  else if (t.dataset.rfilter) { resultsFilter = t.dataset.rfilter; render(); }
  else if (t.dataset.export === 'csv') exportDiaryCSV();
  else if (t.dataset.export === 'json') exportDiaryJSON();
  else if (t.dataset.export === 'feedback') downloadFile(JSON.stringify(getStoredFeedback(), null, 2), 'matchiq_feedback.json', 'application/json');
  else if (t.dataset.delete) deleteDiaryEntry(t.dataset.delete);
  else if (t.dataset.clearDiary !== undefined) clearDiary();
  else if (t.dataset.retry !== undefined) loadData().then(render);
  else if (t.dataset.star) { feedbackState[t.dataset.star] = +t.dataset.value; render(); }
  else if (t.dataset.useful) { feedbackState.useful = t.dataset.useful; render(); }
  else if (t.dataset.chip) { feedbackState.chips.has(t.dataset.chip) ? feedbackState.chips.delete(t.dataset.chip) : feedbackState.chips.add(t.dataset.chip); render(); }
  else if (t.closest('#bookmaker-quick')) $('modal-bookmaker-input').value = t.textContent;
});
document.addEventListener('input', event => {
  const t = event.target;
  if (t.dataset && t.dataset.price) {
    const all = readPrices(), mine = all[t.dataset.match] || {};
    if (t.value.trim()) mine[t.dataset.price] = t.value.trim(); else delete mine[t.dataset.price];
    all[t.dataset.match] = mine;
    writePrices(all);
    clearTimeout(t._timer);
    t._timer = setTimeout(() => refreshValue(t.dataset.match), 250);
  }
});
document.addEventListener('change', event => {
  const t = event.target;
  if (t.dataset && t.dataset.valueSelect) {
    const all = readPrices(), mine = all[t.dataset.valueSelect] || {};
    mine._selected = t.value;
    all[t.dataset.valueSelect] = mine;
    writePrices(all);
    refreshValue(t.dataset.valueSelect);
    return;
  }
  if (t.dataset.outcome) updateDiaryEntryOutcome(t.dataset.outcome, t.value);
  else if (t.dataset.leg) updateAccumulatorLegOutcome(t.dataset.leg, +t.dataset.index, t.value);
  else if (t.id === 'diary-profile-filter') { diaryProfileFilter = t.value; render(); }
  else if (t.id === 'modal-bet-type') toggleAccumulatorFields();
});
document.addEventListener('submit', event => {
  if (event.target.id === 'diary-form') handleDiaryFormSubmit(event);
  else if (event.target.id === 'fb-form') handleFeedbackSubmit(event);
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('diary-modal').hidden) closeDiary(); });
window.addEventListener('hashchange', render);

$('bookmaker-quick').innerHTML = ['Bet365', 'Sky Bet', 'Betfair', 'William Hill', 'Paddy Power', 'Unibet'].map(b => '<button type="button">' + b + '</button>').join('');
updateDiaryCount();
loadData().then(render);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then(reg => reg.update()).catch(() => {}));
}
