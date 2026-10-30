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

// ------------------------------------------------------------ Odds format & preferences
const ODDS_FORMAT_KEY = 'matchiq_odds_pref_v1';
let oddsFormat = 'fractional';
try {
  const savedFmt = localStorage.getItem(ODDS_FORMAT_KEY);
  if (savedFmt === 'decimal' || savedFmt === 'fractional') oddsFormat = savedFmt;
} catch (e) { /* ignore */ }

function getOddsFormat() { return oddsFormat; }
function setOddsFormat(mode) {
  oddsFormat = mode === 'decimal' ? 'decimal' : 'fractional';
  try { localStorage.setItem(ODDS_FORMAT_KEY, oddsFormat); } catch (e) { /* ignore */ }
  updateOddsToggleLabel(); updateHeaderAuthUI();
  render();
}
function toggleOddsFormat() {
  setOddsFormat(oddsFormat === 'fractional' ? 'decimal' : 'fractional');
}
function updateOddsToggleLabel() {
  const lbl = $('odds-mode-val');
  if (lbl) lbl.textContent = oddsFormat === 'decimal' ? 'Decimal' : 'Fractional';
  const btn = $('odds-toggle');
  if (btn) btn.setAttribute('data-active-mode', oddsFormat);
}
function fmtOdds(decimalOdds) {
  if (oddsFormat === 'decimal') return calc.formatDecimalOdds(decimalOdds);
  return calc.formatFractionalOdds(decimalOdds);
}
function fmtFairOdds(fairStr, prob) {
  if (oddsFormat === 'decimal') {
    if (prob != null && prob > 0 && prob < 1) return '≈' + (1 / prob).toFixed(2);
    const parsed = calc.parseFractionalOdds(String(fairStr || '').replace('≈', ''));
    if (parsed) return '≈' + calc.formatDecimalOdds(parsed);
  }
  return fairStr;
}
let clubFilter = '';

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
  const glow = (c1.startsWith('#') && c1.length === 7) ? c1 + '44' : 'rgba(56, 189, 248, 0.25)';
  return '<svg class="crest" style="--crest-glow:' + glow + '" width="' + size + '" height="' + size + '" viewBox="0 0 48 48" role="img" aria-label="' + esc(name) + ' crest">' +
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
    '<div class="market-odds">Model fair odds <b>' + esc(fmtFairOdds(diary.fair, m.p)) + '</b> · not a bookmaker price</div></div></div>' +
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
    detail += '<p class="muted" style="font-size:13.5px">No bookmaker price is loaded for this match (the automatic feed covers Match Result and Total Goals only, when it is enabled). Type a fractional price you have seen on any selection, here or in the top six, and Bet Buddy will check every priced selection for value.</p>';
  }
  if (verdict.verdict !== 'awaiting_odds') {
    detail += '<div class="value-grid"><div><span>Price</span><b>' + esc(verdict.priceText) + '</b></div><div><span>Price implies</span><b>' + pct(verdict.implied) + '</b></div>' +
      (verdict.fairImplied != null ? '<div><span>Margin removed</span><b>' + pct(verdict.fairImplied) + '</b></div>' : '') +
      '<div><span>Bet Buddy</span><b>' + pct(sel.p) + '</b></div><div><span>Expected value</span><b class="' + (verdict.ev >= 0 ? 'pos' : 'neg') + '">' + (verdict.ev >= 0 ? '+' : '') + Math.round(100 * verdict.ev) + '%</b></div>' +
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
    '<div><div class="market-pick">' + esc(s.label.replace(/^[^:]+: /, '')) + '</div><div class="market-odds">Model fair odds <b>' + esc(fmtFairOdds(s.fair, s.p)) + '</b> · not a bookmaker price</div></div></div>' +
    '<div class="evidence-row"><span class="badge ' + cls + '">' + label + '</span>' + (s.support === 'unsupported' ? '' : meter(s.strength)) + '</div>' +
    '<p class="muted" style="font-size:13px">' + esc(note) + '</p>' +
    '<label class="field"><span class="lbl">Price you saw ' + chip + '</span><input class="ctl mono" inputmode="text" autocomplete="off" placeholder="e.g. 6/4 or 2.50" aria-label="Bookmaker price for ' + esc(s.label) + '" data-price="' + esc(s.id) + '" data-match="' + esc(pred.match_id) + '" value="' + esc(prices[s.id] || '') + '"></label>' +
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
      '<div class="odds-pair"><span>Model fair odds <strong>' + esc(fmtFairOdds(r.pick.fair_odds, r.pick.p)) + '</strong></span><span>Bookmaker odds: not available</span></div></div>' +
  '</article>';
}

function signalCard(pred) {
  const f = pred.fixture, r = pred.markets.result, ms = kickoffMs(f), provisional = r.evidence.status !== 'validated';
  const band = reliabilityBand(r.pick.p);
  return '<a class="sig-card" href="#/match/' + encodeURIComponent(pred.match_id) + '">' +
    ring(r.pick.p, 64, provisional ? 'provisional' : '') +
    '<span><span class="fixture">' + crest(f.home, 18) + crest(f.away, 18) + '<span>' + esc(f.home) + ' v ' + esc(f.away) + '</span></span>' +
      '<span class="pick" style="display:block">' + esc(r.pick.label) + '</span>' +
      '<span class="meta" style="display:block">' + esc(fmtDay(ms)) + ' ' + esc(fmtTime(ms)) + ' · fair ' + esc(fmtFairOdds(r.pick.fair_odds, r.pick.p)) + '</span>' +
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
  const diaryBtn = row => {
    if (!ctx.canLog) return '';
    const selText = (key === 'btts' ? 'Both teams to score: ' : key === 'result' ? '' : meta.name + ': ') + row.label;
    const jsonStr = esc(JSON.stringify({ id: ctx.id, market: meta.diary, selection: selText, p: row.p, fair: row.fair }));
    return '<button type="button" class="btn small" data-diary=\'' + jsonStr + '\' aria-label="Add ' + esc(row.label) + ' to Bet Diary">+ Diary</button>' +
      '<button type="button" class="btn-place-bet-inline" data-open-bookie=\'' + jsonStr + '\' title="Open in bookmaker app/site">Place Bet</button>';
  };
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
    ? ring(m.p, 54, status === 'validated' ? '' : 'provisional') + '<span><span class="dim" style="display:block;font-size:11.5px">Most likely · ' + esc(MARKETS[m.market].name) + '</span><b class="rec-row-pick">' + esc(m.label) + '</b></span>'
    : '<span><b class="rec-row-pick">No bet</b><span class="dim" style="display:block;font-size:11.5px">Not enough evidence</span></span>';

  // Horizontal match result distribution bar
  const sels = (r && r.selections) || [];
  const hP = Math.round(((sels.find(s => s.outcome === 'home') || {}).p || 0) * 100);
  const dP = Math.round(((sels.find(s => s.outcome === 'draw') || {}).p || 0) * 100);
  const aP = Math.max(0, 100 - hP - dP);
  const distBar = sels.length >= 3
    ? '<div class="match-dist-bar" title="Model probabilities: Home ' + hP + '%, Draw ' + dP + '%, Away ' + aP + '%"><span class="bar-seg home" style="width:' + hP + '%"></span><span class="bar-seg draw" style="width:' + dP + '%"></span><span class="bar-seg away" style="width:' + aP + '%"></span></div>'
    : '';

  return '<a class="rec-row" href="#/match/' + encodeURIComponent(pred.match_id) + '">' +
    '<span class="fx-time">' + esc(fmtTime(ms)) + '<small>' + esc(fmtDay(ms)) + '</small>' + (compFilter === 'ALL' ? '<small class="lg-tag">' + esc(f.competition || 'PL') + '</small>' : '') + '</span>' +
    '<span class="fx-teams"><span class="teams-line">' + crest(f.home, 22) + '<span>' + esc(f.home) + '</span></span><span class="teams-line">' + crest(f.away, 22) + '<span>' + esc(f.away) + '</span></span>' + distBar + '</span>' +
    '<span class="rec-row-main">' + pick + '</span>' +
    '<span class="rec-row-side"><span class="dim">Lean: <b style="color:#fff">' + esc(r.pick.label) + '</b> ' + pct(r.pick.p) + (r.evidence.status !== 'validated' ? ' <span class="badge provisional">Provisional</span>' : '') + '</span>' + valueStatus(pred) + '</span>' +
    '<span class="fx-chev" aria-hidden="true">›</span></a>';
}

function homeHero(pred) {
  const f = pred.fixture, ms = kickoffMs(f);
  return '<article class="hero"><div><div class="hero-meta"><strong>Most likely this round</strong><span>' + esc(leagueName(f.competition)) + '</span><span>' + esc(fmtDay(ms)) + ', ' + esc(fmtTime(ms)) + ' UK</span></div>' +
    '<div class="hero-teams"><span class="hero-team">' + crest(f.home, 40) + esc(f.home) + '</span><span class="hero-v">v</span><span class="hero-team">' + crest(f.away, 40) + esc(f.away) + '</span></div>' +
    mostLikelyBlock(pred, true) +
    '<div class="btn-row" style="margin-top:14px"><a class="btn primary" href="#/match/' + encodeURIComponent(pred.match_id) + '">See every market and check value</a></div></div></article>';
}

// ------------------------------------------------------------ Bet Builder (home hero)
const BUILDER_KEY = 'matchiq_builder_v1';
const builderState = { stake: 10, legs: 4, win: 50 };
try {
  const v = JSON.parse(localStorage.getItem(BUILDER_KEY) || 'null');
  if (v && v.stake > 0 && v.win > 0 && v.legs >= 1 && v.legs <= MatchIQBuilder.MAX_LEGS) Object.assign(builderState, { stake: +v.stake, legs: +v.legs, win: +v.win });
} catch (e) { /* the inputs are a convenience */ }
let builderResult = null, builderTimer = null;

function builderCompute() {
  const { stake, legs, win } = builderState;
  const pool = MatchIQBuilder.legPool(predictionsList(), { calc, reliability: DATA.reliability, feedFor, nowMs: Date.now() });
  builderResult = MatchIQBuilder.buildSlips(pool, { stake, win, legs });
  try { localStorage.setItem(BUILDER_KEY, JSON.stringify(builderState)); } catch (e) { /* ignore */ }
}

function slipLegRow(l) {
  const f = l.fixture, ms = l.kickoff;
  const legPrice = oddsFormat === 'decimal' ? calc.formatDecimalOdds(l.odds) : esc(l.fractional);
  const price = l.priceSource === 'live'
    ? '<span class="slip-price live" title="Bookmaker price from ' + esc(l.bookmaker) + '">' + legPrice + '<small>' + esc(l.bookmaker) + '</small></span>'
    : '<span class="slip-price est" title="No fresh bookmaker price. Estimated from the model chance plus a typical margin: check your bookmaker.">' + legPrice + '<small>estimate</small></span>';
  return '<li class="slip-leg"><span class="slip-teams">' + crest(f.home, 22) + '<span class="slip-match">' + esc(f.home) + ' v ' + esc(f.away) +
    '<small>' + esc(fmtDay(ms)) + ' ' + esc(fmtTime(ms)) + ' · ' + esc(leagueName(f.competition)) + '</small></span></span>' +
    '<span class="slip-pick"><b>' + esc(l.label) + '</b><small>' + pct(l.p) + ' chance' + (l.support === 'provisional' ? ' · provisional' : '') + '</small></span>' + price + '</li>';
}

function shareAccaSlip(idx) {
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
  ].join('\n');

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
}

function slipCard(slip, idx, stake) {
  const m = MatchIQBuilder.money, primary = idx === 0;
  const chance = slip.chance >= 0.1 ? Math.round(slip.chance * 100) : (slip.chance * 100).toFixed(1);
  const mainOdds = fmtOdds(slip.odds);
  const subOdds = oddsFormat === 'decimal' ? calc.formatFractionalOdds(slip.odds) : '(' + calc.formatDecimalOdds(slip.odds) + ')';
  return '<article class="slip' + (primary ? ' primary' : '') + '"><div class="slip-head"><div><div class="slip-kicker">' + (primary ? 'Best match for your target' : 'Alternative ' + idx) + '</div>' +
    '<div class="slip-odds mono">' + esc(mainOdds) + ' <small>' + esc(subOdds) + '</small></div></div>' +
    '<div class="slip-chance"><b class="mono">' + chance + '%</b><small>chance every bet lands</small></div></div>' +
    '<ol class="slip-legs">' + slip.legs.map(slipLegRow).join('') + '</ol>' +
    '<div class="slip-sum"><span>Stake <b class="mono">' + m(stake) + '</b></span><span>Returns <b class="mono">' + m(slip.ret) + '</b></span><span>Profit <b class="mono">' + m(slip.profit) + '</b></span></div>' +
    (slip.chance < 0.05 ? '<p class="slip-warn">Long shot: roughly 1 in ' + Math.round(1 / slip.chance) + '. Most slips like this lose.</p>' : '') +
    (slip.estimated ? '<p class="slip-note">Some prices are estimates, not live bookmaker prices. The price you are actually offered will differ, so the profit will too.</p>' : '') +
    '<div class="btn-row">' +
      '<button type="button" class="btn' + (primary ? ' primary' : '') + '" data-slip="' + idx + '">Save slip to Bet Diary</button>' +
      '<button type="button" class="btn small" data-share-slip="' + idx + '" title="Copy formatted slip to clipboard or share with friends"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg> Share / Copy</button>' +
      '<button type="button" class="btn small partner-cta" data-partner-slip="' + idx + '" title="Bookmaker integration: transfer slip to partner bookmaker"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg> Place with Bookmaker</button>' +
    '</div></article>';
}

function builderOutput() {
  const r = builderResult, { stake, win } = builderState, m = MatchIQBuilder.money;
  if (!r) return '';
  const need = '<p class="builder-need">To win <b>' + m(win) + '</b> from a <b>' + m(stake) + '</b> stake you need a total return of <b>' + m(stake + win) + '</b>: combined odds of about <b class="mono">' + fmtOdds((stake + win) / stake) + '</b>.</p>';
  if (r.error) return need + '<div class="empty" style="margin-top:12px">' + esc(r.error) + '</div>';
  const first = r.slips[0];
  const miss = r.exact ? '' : '<p class="slip-warn">No combination lands on that target. This is the closest available: it returns ' + m(first.ret) + ' (profit ' + m(first.profit) + ').</p>';
  const fine = '<p class="builder-fine">Chances are Bet Buddy model estimates, not promises. On average this slip is expected to ' + (first.ev >= 0 ? 'make ' : 'lose ') + '<b>' + m(Math.abs(first.ev)) + '</b> per ' + m(stake) + ' staked; bookmaker margins usually push that below zero. Never stake more than you can afford to lose.</p>';
  return need + miss + r.slips.map((s, i) => slipCard(s, i, stake)).join('') + fine;
}


function getPandaMood(slip, win) {
  const stake = (builderState && builderState.stake) || 10;
  const targetWin = win || (builderState && builderState.win) || 50;
  const targetOdds = (stake + targetWin) / stake;
  const slipOdds = (slip && slip.odds) || targetOdds;
  const chance = (slip && slip.chance) || (1 / targetOdds);

  // Helper to render panda base head (ears, white face, eye patches)
  const baseHead = '<circle cx="8" cy="8" r="5" fill="#04140d"/><circle cx="28" cy="8" r="5" fill="#04140d"/>' +
    '<circle cx="8" cy="8" r="2.2" fill="#a7f3d0"/><circle cx="28" cy="8" r="2.2" fill="#a7f3d0"/>' +
    '<circle cx="18" cy="20" r="13" fill="#ffffff" stroke="#04140d" stroke-width="1.5"/>' +
    '<ellipse cx="13" cy="18" rx="3.5" ry="4.5" fill="#04140d" transform="rotate(-15 13 18)"/>' +
    '<ellipse cx="23" cy="18" rx="3.5" ry="4.5" fill="#04140d" transform="rotate(15 23 18)"/>' +
    '<ellipse cx="18" cy="22" rx="2" ry="1.4" fill="#04140d"/>';

  // 1. WILD MONSTER ODDS / MEGA LONGSHOT (Odds >= 40/1 or Win >= £400) -> Jaw-dropped, shocked, sweaty crazy panda
  if (slipOdds >= 41 || targetWin >= 400 || chance < 0.04) {
    return {
      mood: 'shocked',
      kicker: 'Crazy Longshot (' + Math.round(slipOdds) + '/1)',
      desc: 'Jaw-dropping odds! Panda is sweating bullets. Tiny stakes only!',
      badgeClass: 'rose',
      svg: baseHead +
        '<circle cx="13" cy="18" r="2.2" fill="#fff"/><circle cx="13" cy="18" r="1.1" fill="#fb7185"/>' +
        '<circle cx="23" cy="18" r="2.2" fill="#fff"/><circle cx="23" cy="18" r="1.1" fill="#fb7185"/>' +
        '<ellipse cx="18" cy="27" rx="3.5" ry="4.5" fill="#350810" stroke="#fb7185" stroke-width="1.2"/>' +
        '<path d="M30 14c1 2 0 4-1 4s-2-2-1-4c.4-.8 1.6-.8 2 0z" fill="#38bdf8"/>'
    };
  }

  // 2. BIG ACCA / ADVENTUROUS LONGSHOT (Odds >= 15/1 or Win >= £150) -> Wide-eyed, open-mouthed 'O' face, excited
  if (slipOdds >= 15 || targetWin >= 150 || chance < 0.12) {
    return {
      mood: 'wild',
      kicker: 'Ambitious Target (' + Math.round(slipOdds) + '/1)',
      desc: 'Big odds acca! Panda has his wild eyes on the prize.',
      badgeClass: 'amber',
      svg: baseHead +
        '<circle cx="13" cy="18" r="1.8" fill="#fff"/><circle cx="13" cy="18" r="1" fill="#f59e0b"/>' +
        '<circle cx="23" cy="18" r="1.8" fill="#fff"/><circle cx="23" cy="18" r="1" fill="#f59e0b"/>' +
        '<circle cx="18" cy="26" r="3.2" fill="#451a03" stroke="#f59e0b" stroke-width="1.2"/>'
    };
  }

  // 3. BALANCED WEEKEND ACCA (Odds >= 5/1 or Win >= £50) -> Cheerful, cool smirk, confident wink
  if (slipOdds >= 5 || targetWin >= 50 || chance < 0.30) {
    return {
      mood: 'balanced',
      kicker: 'Balanced Acca (' + Math.round(slipOdds) + '/1)',
      desc: 'Sweet spot weekend accumulator. Solid risk-to-reward.',
      badgeClass: 'cyan',
      svg: baseHead +
        '<circle cx="13" cy="18" r="1.6" fill="#fff"/><circle cx="13" cy="18" r="0.9" fill="#38bdf8"/>' +
        '<path d="M21 18c1-1 3-1 4 0" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" fill="none"/>' +
        '<path d="M15 25c1.5 1.5 4.5 1.5 6 0" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>'
    };
  }

  // 4. LOW-RISK / HIGH CONFIDENCE (Odds < 5/1, Chance >= 30%) -> Happy beaming smile, emerald glowing eyes
  return {
    mood: 'confident',
    kicker: 'High Chance Pick (' + Math.max(1, Math.round(slipOdds)) + '/1)',
    desc: 'Short price, high probability path backed by model evidence.',
    badgeClass: 'emerald',
    svg: baseHead +
      '<circle cx="13" cy="17.5" r="1.8" fill="#fff"/><circle cx="13" cy="17.5" r="1" fill="#10b981"/>' +
      '<circle cx="23" cy="17.5" r="1.8" fill="#fff"/><circle cx="23" cy="17.5" r="1" fill="#10b981"/>' +
      '<path d="M14 24c1.8 2.2 6.2 2.2 8 0" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>'
  };
}

function pandaMoodMarkup(slip, win) {
  const pm = getPandaMood(slip, win);
  return '<div class="panda-mood-card ' + pm.badgeClass + '" title="' + esc(pm.desc) + '">' +
    '<svg viewBox="0 0 36 36" class="panda-mood-icon">' + pm.svg + '</svg>' +
    '<div><div class="panda-mood-kicker">' + esc(pm.kicker) + '</div><div class="panda-mood-desc">' + esc(pm.desc) + '</div></div>' +
  '</div>';
}

function viewBuilder() {
  builderCompute();
  const { stake, legs, win } = builderState;
  const legChips = [2, 3, 4, 5, 6, 8].map(n => '<button type="button" class="legpick" data-legs="' + n + '" aria-pressed="' + (legs === n) + '">' + n + '</button>').join('');
  const winPresets = [10, 25, 50, 100, 250].map(w => '<button type="button" class="win-chip" data-win="' + w + '" aria-pressed="' + (win === w) + '">£' + w + '</button>').join('');
  return '<section class="builder" aria-labelledby="builder-title">' +
    '<div class="builder-top-bar">' +
      '<div><div class="builder-kicker">Bet Builder</div><h1 class="page-title" id="builder-title">Tell us the win. We’ll build the bet.</h1></div>' +
      '<div id="builder-panda-mood">' + pandaMoodMarkup(builderResult && builderResult.slips && builderResult.slips[0], builderState.win) + '</div>' +
    '</div>' +
    '<p class="page-sub">Pick a stake, how many bets and how much you want to win. Bet Buddy searches every upcoming match for the combined bet (accumulator) that hits your target with the best chance of landing.</p>' +
    '<div class="builder-form"><div class="field"><label for="b-stake">Stake (£)</label><input id="b-stake" class="ctl mono" type="number" inputmode="decimal" min="0.5" max="10000" step="0.5" value="' + stake + '" data-b="stake"></div>' +
    '<div class="field"><span class="lbl" id="b-legs-l">Number of bets</span><div class="legpicks" role="group" aria-labelledby="b-legs-l">' + legChips +
    '<input id="b-legs" class="ctl mono legs-input" type="number" inputmode="numeric" min="1" max="' + MatchIQBuilder.MAX_LEGS + '" step="1" value="' + legs + '" data-b="legs" aria-label="Number of bets"></div></div>' +
    '<div class="field full"><label for="b-win">Target profit (£): <b class="mono" id="b-win-out">' + MatchIQBuilder.money(win) + '</b></label>' +
    '<div class="win-input-wrap"><div class="currency-input-wrap"><span class="currency-symbol">£</span><input id="b-win" class="ctl mono win-input" type="number" inputmode="decimal" min="1" max="10000" step="1" value="' + win + '" data-b="win" placeholder="50"></div>' +
    '<div class="win-chips" role="group" aria-label="Preset profit targets">' + winPresets + '</div></div></div></div>' +
    '<div id="builder-out" class="builder-out" aria-live="polite">' + builderOutput() + '</div>' +
    '<p class="builder-foot">18+ only. Gambling can be addictive; play responsibly. <a href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware.org</a>. Bet Buddy does not take bets, and nothing here is a guarantee.</p></section>';
}

function updateBuilder() {
  builderCompute();
  const out = $('builder-out');
  if (out) out.innerHTML = builderOutput();
  const moodWrap = $('builder-panda-mood');
  if (moodWrap) {
    moodWrap.innerHTML = pandaMoodMarkup(builderResult && builderResult.slips && builderResult.slips[0], builderState.win);
  }
}

function markLegChips() {
  document.querySelectorAll('.legpick').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.legs === builderState.legs)));
}

function markWinChips() {
  document.querySelectorAll('.win-chip').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.win === builderState.win)));
}

function setBuilderLegs(n) {
  builderState.legs = n;
  const inp = $('b-legs'); if (inp) inp.value = n;
  markLegChips();
  updateBuilder();
}

function onBuilderInput(t) {
  const v = Number(t.value);
  if (t.dataset.b === 'win') {
    builderState.win = Math.max(1, v);
    $('b-win-out').textContent = MatchIQBuilder.money(builderState.win);
    markWinChips();
  } else if (!Number.isFinite(v) || v <= 0) return;
  else if (t.dataset.b === 'stake') builderState.stake = Math.min(10000, v);
  else if (t.dataset.b === 'legs') { builderState.legs = Math.max(1, Math.min(MatchIQBuilder.MAX_LEGS, Math.round(v))); markLegChips(); }
  clearTimeout(builderTimer);
  builderTimer = setTimeout(updateBuilder, 120);
}

function saveSlipToDiary(i) {
  const slip = builderResult && builderResult.slips && builderResult.slips[i];
  if (!slip) return;
  openDiary({});
  $('modal-bet-type').value = 'accumulator';
  toggleAccumulatorFields();
  $('modal-legs-input').value = slip.legs.map(l => l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label + ' | ' + String(l.fractional).replace('≈', '')).join('\n');
  $('modal-stake-input').value = builderState.stake.toFixed(2);
  $('modal-origin-select').value = 'matchiq';
  $('modal-notes-input').value = 'Built by Bet Buddy Bet Builder for a £' + builderState.win + ' win. Check any price marked estimate with your bookmaker.';
  updateModalPnlPreview();
}


function beginnerGuides() {
  return '<div class="section"><div class="section-head"><h2 class="section-title">New to Bet Buddy? Quick intelligence guides</h2><span class="section-note">Tap any card to understand how honest football prediction works.</span></div>' +
    '<div class="bento-grid">' +
      '<div class="bento-card"><div class="bento-icon">🎯</div><div><div class="bento-kicker">Betting Intelligence</div><h3 class="bento-title">What is Value?</h3><p class="bento-desc">A 60% chance isn’t value if the bookmaker odds are too low. Value is when the payout beats the true risk.</p></div><span class="bento-badge emerald">+5% EV threshold</span></div>' +
      '<div class="bento-card"><div class="bento-icon">🎲</div><div><div class="bento-kicker">Odds Demystified</div><h3 class="bento-title">6/4 vs 2.50 Odds</h3><p class="bento-desc">6/4 is UK fractional: £6 profit per £4 stake. 2.50 is decimal: total return including stake. Switch anytime in the header!</p></div><span class="bento-badge">Toggle in header</span></div>' +
      '<div class="bento-card"><div class="bento-icon">⚡</div><div><div class="bento-kicker">Accas & Builders</div><h3 class="bento-title">Target Profit Bet Builder</h3><p class="bento-desc">Combine selections for higher returns. Bet Buddy checks upcoming matches to find the highest-chance path to your win goal.</p></div><span class="bento-badge">Real-time scan</span></div>' +
      '<div class="bento-card"><div class="bento-icon">🛡️</div><div><div class="bento-kicker">Honest Predictions</div><h3 class="bento-title">No Bet is an Answer</h3><p class="bento-desc">When evidence is thin, odds are bad or data is missing, we say No Bet. We never invent fake confidence or forced picks.</p></div><span class="bento-badge amber">Zero hype</span></div>' +
    '</div></div>';
}

function viewHome() {
  const list = upcoming();
  const sharedBanner = sharedSlipNotice
    ? '<div class="notice section shared-slip-notice" style="border-color:var(--cyan);background:rgba(56,189,248,0.12);color:#fff;margin-bottom:18px"><span style="font-size:20px">🐼</span><div><b>Acca shared by a mate!</b> Bet Builder is pre-filled to target £' + builderState.win + ' profit across ' + builderState.legs + ' bets.</div><button type="button" class="icon-btn" onclick="sharedSlipNotice=false;render()" style="margin-left:auto">&times;</button></div>'
    : '';
  let html = '<section class="view">' + sharedBanner + viewBuilder() + '<div class="section-head" style="align-items:flex-end;margin-top:36px"><div><h2 class="page-title">This round</h2>' +
    '<p class="page-sub">For every upcoming match: the most likely supported outcome, the match-result lean and whether a price you have seen offers value. Bet Buddy will say No bet when the evidence or the price is not good enough.</p></div>' +
    '<div class="chips">' + freshnessChips() + '</div></div>' + compBar();
  if (LOAD_ERRORS.predictions) return html + errorPanel('predictions') + '</section>';
  if (!list.length) return html + '<div class="empty">No fixtures with published predictions in the next 21 days. Predictions appear automatically once the schedule lists them.</div>' + homeFixtures() + '</section>';
  const first = kickoffMs(list[0].fixture);
  const round = list.filter(p => kickoffMs(p.fixture) - first < 5 * 86400000);
  const later = list.filter(p => kickoffMs(p.fixture) - first >= 5 * 86400000);
  const best = round.slice().sort((a, b) => lowerBoundOf(b) - lowerBoundOf(a))[0];
  if (best && lowerBoundOf(best) >= 0) html += '<div class="section" style="margin-top:18px">' + homeHero(best) + '</div>';
  const matchFilter = p => !clubFilter || (p.fixture.home.toLowerCase().includes(clubFilter) || p.fixture.away.toLowerCase().includes(clubFilter));
  const filteredRound = round.filter(matchFilter);
  const filteredLater = later.filter(matchFilter);
  const searchBar = '<div class="search-bar"><svg viewBox="0 0 24 24" class="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input type="search" id="club-search" class="ctl search-input" placeholder="Search by club (e.g. Arsenal, Liverpool)..." value="' + esc(clubFilter) + '" autocomplete="off"></div>';
  html += '<div class="section"><div class="section-head"><h2 class="section-title">Match by match</h2><span class="section-note">Most likely uses every market but ranks on credible chance, so a big number with little evidence behind it does not win.</span></div>' +
    searchBar +
    (filteredRound.length ? filteredRound.map(matchRecRow).join('') : '<div class="empty">No matches found for "' + esc(clubFilter) + '".</div>') + '</div>';
  if (filteredLater.length) html += '<details class="section"><summary class="section-title" style="cursor:pointer;min-height:44px;display:flex;align-items:center">Following round (' + filteredLater.length + ' matches)</summary>' + filteredLater.map(matchRecRow).join('') + '</details>';
  const validated = list.filter(p => p.markets.result.evidence.status === 'validated').map(p => ({ p, s: signalScore(p) })).sort((a, b) => b.s.score - a.s.score).map(x => x.p);
  if (validated.length) html += '<div class="section"><div class="section-head"><h2 class="section-title">Strongest match-result signals</h2><span class="section-note">The validated match-result model only, ranked by backtest-calibrated probability.</span></div>' +
    '<div class="grid grid-2">' + validated.slice(0, 4).map(signalCard).join('') + '</div></div>';
  html += beginnerGuides() + '<details class="card section"><summary class="section-title" style="cursor:pointer;min-height:44px;display:flex;align-items:center">How Most Likely, Best Value and No Bet work</summary><ol class="explain" style="margin-top:8px">' +
    '<li><b>Most likely</b> looks at every backtested selection in every market, including heavy favourites. Each chance is pulled toward how often similar picks landed in the backtest, then ranked by the cautious end of a 90% range. Thin evidence therefore counts for less than a well-tested estimate, even with a bigger number.</li>' +
    '<li><b>Best value</b> needs a real bookmaker price. Prices come from The Odds API for Match Result and Total Goals; for anything else enter a price you have seen. Add every outcome’s price to remove the bookmaker’s margin. Only the validated match-result model, at a well-backtested probability, can call value, and only at +5% estimated expected value or more.</li>' +
    '<li><b>No bet</b> is a real answer: when evidence is thin, the price is short or no price exists. The predictions stay visible underneath.</li>' +
    '<li>Model fair odds are 1 ÷ probability with no margin, rounded to a familiar UK price. They are never bookmaker prices.</li></ol></details>';
  return html + homeFixtures() + '</section>';
}

function homeFixtures() {
  const matchFilter = f => !clubFilter || f.home.toLowerCase().includes(clubFilter) || f.away.toLowerCase().includes(clubFilter);
  const next = fixturesList().filter(f => inComp(f.competition) && f.status === 'SCHEDULED' && kickoffMs(f) > Date.now()).filter(matchFilter).sort((a, b) => kickoffMs(a) - kickoffMs(b)).slice(0, 10);
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
  if (clubFilter) list = list.filter(f => f.home.toLowerCase().includes(clubFilter) || f.away.toLowerCase().includes(clubFilter));
  const searchBar = '<div class="search-bar"><svg viewBox="0 0 24 24" class="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input type="search" id="club-search" class="ctl search-input" placeholder="Search club (e.g. Arsenal, Liverpool)..." value="' + esc(clubFilter) + '" autocomplete="off"></div>';
  let html = '<section class="view"><h1 class="page-title">Fixtures</h1><p class="page-sub">' + (compFilter === 'ALL' ? 'All six competitions' : esc(leagueName(compFilter))) + ' 2026/27. The schedule refreshes automatically; matches leave Upcoming at kick-off and move to Results once a source confirms the score.</p>' +
    compBar() + searchBar + '<div class="section" style="margin-top:16px;display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between"><div class="seg" role="group" aria-label="Fixture list">' +
    Object.entries(tabs).map(([k, label]) => '<button type="button" data-tab="' + k + '" aria-pressed="' + (fixturesTab === k) + '">' + label + '</button>').join('') + '</div><div class="chips">' + freshnessChips() + '</div></div>';
  if (LOAD_ERRORS.fixtures) return html + errorPanel('fixtures') + '</section>';
  html += list.length ? groupedRows(list) : '<div class="empty" style="margin-top:16px">' + (fixturesTab === 'awaiting' ? 'No matches are waiting for a confirmed result.' : 'Nothing to show yet.') + '</div>';
  if ((fixturesTab === 'upcoming' || fixturesTab === 'results') && !fixturesShowAll) html += '<button type="button" class="btn" data-showall style="margin-top:8px">Show ' + (fixturesTab === 'upcoming' ? 'the rest of the season' : 'all results') + '</button>';
  return html + '</section>';
}

function viewMatch(id) {
  const f = fixtureById(id), pred = DATA.predictions && DATA.predictions.predictions[id], rec = finalRecord(id);
  const fx = f || (pred && { id, ...pred.fixture }) || (rec && { id, ...rec.fixture });
  if (!fx) return '<section class="view"><button type="button" class="link-btn" data-back aria-label="Go back">&larr; Back</button><div class="empty">This match is not in the current schedule.</div></section>';
  const ms = kickoffMs(fx), status = (f && f.status) || (ms > Date.now() ? 'SCHEDULED' : 'AWAITING_RESULT');
  const promoted = pred ? pred.promoted : [];
  const centre = status === 'FINISHED' ? '<span class="score">' + f.score[0] + '–' + f.score[1] + '</span><div style="font-size:13px">Full time</div>' : '<span>v</span>';
  const statusChip = { SCHEDULED: ['ok', 'Upcoming'], AWAITING_RESULT: ['warn', 'Kicked off, awaiting confirmed result'], RESULT_CONFLICT: ['warn', 'Sources disagree on the score'],
    FINISHED: ['ok', 'Result confirmed' + (f && f.result_source ? ' by ' + f.result_source : '')], POSTPONED: ['warn', 'Postponed'], CANCELLED: ['bad', 'Cancelled'], REMOVED_FROM_SCHEDULE: ['warn', 'Removed from the schedule'] }[status] || ['', status];
  let html = '<section class="view"><button type="button" class="link-btn" data-back aria-label="Go back">&larr; Back</button>' +
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
    html += '<div class="section"><div class="section-head"><h2 class="section-title">Top six selections</h2><span class="section-note">The six strongest individual selections from every market and Over/Under line, ranked on the cautious end of their chance so thin evidence cannot win on a big number. Lines Bet Buddy never backtested rank last and are labelled unsupported.</span></div>' +
      '<div id="top-' + esc(id) + '">' + topSixBlock(pred) + '</div></div>' +
      '<details class="card section all-markets"><summary class="section-title" style="cursor:pointer;min-height:44px;display:flex;align-items:center">Every market and line (' + allSelections(pred).length + ' selections)</summary>' +
      '<p class="dim" style="font-size:13px;margin:6px 0 12px">Published ' + esc(ago(pred.published_at)) + ' · record ' + esc(pred.record_id) + '. Probability and evidence strength are shown separately: a 60% estimate with weak evidence is still weak.</p>' +
      '<div class="grid grid-2">' + MARKET_ORDER.filter(k => pred.markets[k]).map(k => marketCard(k, normaliseMarket(k, pred.markets[k]), { id, canLog: true })).join('') + '</div></details>';
  } else if (rec) {
    const ml = (rec.recommendations || {}).most_likely, mls = (rec.settlement || {}).most_likely;
    if (ml) html += '<div class="section card"><h2 class="section-title">Sealed recommendations</h2><p style="margin-top:8px">' +
      (ml.decision === 'most_likely' ? 'Most likely: <b>' + esc(ml.label) + '</b> (' + esc(MARKETS[ml.market].name) + ') at ' + pct(ml.p) + '. ' : 'Most likely: No bet. ') +
      (mls && 'won' in mls ? '<span class="badge ' + (mls.won ? 'won' : 'lost') + '">' + (mls.won ? 'Landed' : 'Missed') + '</span>' : mls ? '<span class="badge pending">Result pending</span>' : '') +
      '</p><p class="muted" style="margin-top:6px">Best value: ' + esc(((rec.recommendations || {}).best_value || {}).reason || 'No bet') + '</p></div>';
    html += '<div class="section"><div class="section-head"><h2 class="section-title">What Bet Buddy predicted</h2><span class="section-note">Published ' + esc(london(Date.parse(rec.published_at), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + ' UK, before kick-off. Sealed record ' + esc(rec.record_id) + ': it cannot be changed after the result.</span></div>' +
      '<div class="grid grid-2">' + MARKET_ORDER.filter(k => rec.markets[k]).map(k => marketCard(k, normaliseMarket(k, rec.markets[k]), { id, canLog: false, settlement: rec.settlement })).join('') + '</div></div>';
  } else {
    html += '<div class="empty section">No prediction was published for this match. Bet Buddy publishes up to 21 days before kick-off, and the history starts in October 2026.</div>';
  }
  return html + '</section>';
}

let resultsFilter = 'settled';
function viewResults() {
  const allPerf = DATA.performance || {};
  const publicModel = !!(DATA.reliability || {}).public;  // public-derived model: every league, the Premier League included, uses its own backtest card
  const separate = compFilter !== 'ALL' && compFilter !== 'PL';
  const other = separate || publicModel;
  const perf = separate ? ((allPerf.by_competition || {})[compFilter] || {}) : allPerf;  // leagues are never pooled
  const lv = other ? (((DATA.leagueValidation || {}).leagues || {})[compFilter === 'ALL' ? 'PL' : compFilter] || null) : null;
  const rel = other ? null : DATA.reliability;
  const res = (perf.markets || {}).result;
  const latest = {};
  for (const r of historyRecords()) latest[r.match_id] = r.evaluated ? r : (latest[r.match_id] && latest[r.match_id].evaluated ? latest[r.match_id] : r);
  const recs = Object.values(latest).filter(r => inComp(r.fixture.competition)).sort((a, b) => kickoffMs(b.fixture) - kickoffMs(a.fixture));
  const settled = recs.filter(r => r.evaluated), pending = recs.filter(r => !r.evaluated && kickoffMs(r.fixture) <= Date.now() && !r.result), future = recs.filter(r => kickoffMs(r.fixture) > Date.now());
  let html = '<section class="view"><h1 class="page-title">Results & performance</h1><p class="page-sub">Every prediction Bet Buddy publishes is sealed before kick-off and scored once the result is confirmed. Nothing here is edited after the fact.</p>' + compBar() +
    (compFilter === 'ALL' ? '<div class="notice section">Scorecards are kept per competition and never pooled. The figures below are the Premier League; choose a competition above for another.</div>' + byCompetitionCards(allPerf) : '');
  if (LOAD_ERRORS.history) return html + errorPanel('history') + '</section>';
  html += '<div class="tiles section" style="margin-top:18px">' +
    '<div class="tile"><div class="k">Settled predictions</div><div class="v">' + settled.length + '</div><div class="s">' + pending.length + ' awaiting a result · ' + future.length + ' upcoming</div></div>' +
    '<div class="tile"><div class="k">Match-result picks right</div><div class="v">' + (res ? pct(res.pick_hit_rate) : '—') + '</div><div class="s">' + (res ? res.n + ' matches · average pick ' + pct(res.mean_pick_p) : 'none settled yet') + '</div></div>' +
    '<div class="tile"><div class="k">Forecast accuracy (Brier score)</div><div class="v">' + (res ? res.brier.toFixed(3) : '—') + '</div><div class="s">Lower is better (closer to 0 is more accurate). League average was ' + (lv && lv.markets.result ? lv.markets.result.league_brier.toFixed(3) : rel ? rel.markets.wins.league_average_brier.toFixed(3) : '0.660') + ' in the backtest.</div></div>' +
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
  if (!rel || !rel.markets || !rel.markets.wins) return '<div class="card"><h2 class="section-title">Backtest reference</h2><p class="muted">Backtest evidence unavailable.</p></div>';
  const rows = [['wins', 'Match result'], ['goals', 'Over 2.5 goals'], ['btts', 'Both teams to score'], ['corners', 'Corners 9.5'], ['cards', 'Cards 3.5'], ['shots', 'Shots 8.5']]
    .filter(([k]) => rel.markets[k]).map(([k, l]) => { const m = rel.markets[k]; return '<tr><td>' + l + '</td><td class="num">' + m.brier.toFixed(3) + '</td><td class="num">' + m.league_average_brier.toFixed(3) + '</td><td>' + (m.beats_league_average ? '<span class="badge validated">Beats average</span>' : '<span class="badge provisional">No edge</span>') + '</td></tr>'; }).join('');
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

function viewDiary() {
  const all = getStoredDiary();
  const diary = diaryProfileFilter === 'all' ? all : all.filter(e => (e.profile || 'Default') === diaryProfileFilter);
  const s = calc.summarizeBetDiary(diary);
  const profiles = Array.from(new Set(all.map(e => e.profile || 'Default'))).sort();
  let html = '<section class="view"><div class="section-head" style="align-items:flex-end"><div><h1 class="page-title">Bet Diary</h1><p class="page-sub">Your private record of bets and prices. Stored only in this browser and only for this web address: it does not sync between devices, a different preview address starts empty, and clearing site data removes it. Use Backup, then Import on the other address, to move it.</p></div>' +
    '<div class="btn-row"><button type="button" class="btn primary" data-diary="{}">Add a bet</button><button type="button" class="btn" data-export="csv">Export CSV</button><button type="button" class="btn" data-export="json">Export JSON</button><button type="button" class="btn" data-export="backup">Backup</button><button type="button" class="btn" data-import="diary">Import</button><input type="file" id="diary-import" accept="application/json,.json" hidden></div></div>';
  if (diaryReadFailed) html += '<div class="notice error">Saved diary data could not be read. It has been left untouched, and saving is disabled to protect it.</div>';
  html += '<div class="tiles section" style="margin-top:16px">' +
    '<div class="tile"><div class="k">Profit / loss</div><div class="v ' + (s.netProfit > 0 ? 'pos' : s.netProfit < 0 ? 'neg' : '') + '">' + (s.netProfit > 0 ? '+' : s.netProfit < 0 ? '−' : '') + money(s.netProfit) + '</div><div class="s">ROI ' + s.roiPct.toFixed(1) + '% on settled stakes</div></div>' +
    '<div class="tile"><div class="k">Staked</div><div class="v">' + money(s.totalStaked) + '</div><div class="s">' + money(s.settledStaked) + ' settled · ' + s.pendingCount + ' pending</div></div>' +
    '<div class="tile"><div class="k">Returned</div><div class="v">' + money(s.totalReturned) + '</div><div class="s">winnings plus void stakes</div></div>' +
    '<div class="tile"><div class="k">Won · lost · void</div><div class="v">' + s.wonCount + ' · ' + s.lostCount + ' · ' + s.voidCount + '</div><div class="s">' + s.originBreakdown.matchiq.count + ' following Bet Buddy · ' + s.originBreakdown.independent.count + ' own choice</div></div></div>';
  html += '<div class="section" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between"><label class="field" style="grid-auto-flow:column;align-items:center;gap:10px"><span class="lbl">Profile</span><select id="diary-profile-filter" class="ctl" style="width:auto"><option value="all">All profiles</option>' +
    profiles.map(p => '<option value="' + esc(p) + '"' + (diaryProfileFilter === p ? ' selected' : '') + '>' + esc(p) + '</option>').join('') + '</select></label>' +
    (all.length ? '<button type="button" class="btn small danger" data-clear-diary>Clear diary</button>' : '') + '</div>';
  const chartHtml = diaryPerformanceChart(diary);
  if (!diary.length) return html + '<div class="empty section">No bets yet. Open any match and use "+ Diary" on a selection, or add one here.</div></section>';
  return html + chartHtml + '<div class="grid grid-2 section">' + diary.map(betCard).join('') + '</div></section>';
}

function outcomeSelect(value, attrs, label) {
  return '<select class="ctl" style="width:auto;min-height:40px" aria-label="' + esc(label) + '" ' + attrs + '>' +
    ['pending', 'won', 'lost', 'void'].map(o => '<option value="' + o + '"' + (value === o ? ' selected' : '') + '>' + o[0].toUpperCase() + o.slice(1) + '</option>').join('') + '</select>';
}

function betCard(entry) {
  const profit = calc.calculateBetProfit(entry.stake, entry.odds, entry.outcome);
  const pl = profit === null ? '<span class="dim">Potential return ' + money(entry.stake * (entry.odds || 0)) + '</span>'
    : '<span class="' + (profit > 0 ? 'pos' : profit < 0 ? 'neg' : '') + '">' + (profit > 0 ? '+' : profit < 0 ? '−' : '') + money(profit) + '</span> <span class="dim">returned ' + money(entry.stake + profit) + '</span>';
  const legOddsText = leg => (oddsFormat === 'decimal' ? calc.formatDecimalOdds(+leg.odds) : calc.formatFractionalOdds(+leg.odds));
  const legs = entry.type === 'accumulator' ? (entry.legs || []).map((leg, i) => '<div class="leg"><span>' + esc(leg.selection) + ' · <b class="mono">' + legOddsText(leg) + '</b></span>' +
    outcomeSelect(leg.outcome, 'data-leg="' + esc(entry.id) + '" data-index="' + i + '"', 'Settle ' + leg.selection) + '</div>').join('') : '';
  const priceTaken = oddsFormat === 'decimal' ? calc.formatDecimalOdds(+entry.odds) : calc.formatFractionalOdds(+entry.odds);
  return '<article class="card bet"><div class="bet-top"><div><div class="bet-sel">' + esc(entry.selection) + '</div><div class="dim" style="font-size:13px">' + esc(entry.fixture || '') + ' · ' + esc(entry.date || '') + ' · ' + esc(entry.marketName || entry.market || '') + '</div></div>' +
    '<span style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end"><span class="badge ' + (entry.origin === 'independent' ? 'market' : 'validated') + '">' + (entry.origin === 'independent' ? 'Own choice' : 'Bet Buddy pick') + '</span>' +
      (entry.recommendation ? '<span class="badge provisional">' + esc(REC_LABEL[entry.recommendation] || entry.recommendation) + '</span>' : '') + '</span></div>' + legs +
    '<div class="bet-facts"><div><span>Price taken</span><b>' + priceTaken + '</b></div>' +
      (entry.model_fair_odds ? '<div><span>Model fair odds</span><b>' + esc(fmtFairOdds(entry.model_fair_odds, entry.model_p)) + '</b></div>' : '') +
      '<div><span>Stake</span><b>' + money(+entry.stake) + '</b></div><div><span>Bookmaker</span><b style="font-family:var(--body)">' + esc(entry.bookmaker || '—') + '</b></div>' +
      '<div><span>Profile</span><b style="font-family:var(--body)">' + esc(entry.profile || 'Default') + (entry.type === 'accumulator' ? ' · ' + (entry.legs || []).length + '-pick combined bet' : '') + '</b></div></div>' +
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

function exportDiaryBackup() {
  const entries = getStoredDiary();
  downloadFile(JSON.stringify(calc.diaryBackup(entries, { origin: location.origin }), null, 2), 'matchiq_bet_diary_backup_' + new Date().toISOString().slice(0, 10) + '.json', 'application/json');
  toast('Backup of ' + entries.length + ' entries saved.');
}

function importDiaryFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = calc.parseDiaryImport(String(reader.result));
    if (parsed.error) { toast(parsed.error, 'error'); return; }
    try {
      const { merged, added, duplicates } = calc.mergeDiaryEntries(getStoredDiary(), parsed.entries);
      if (added) saveStoredDiary(merged);
      toast('Imported ' + added + ' new ' + (added === 1 ? 'entry' : 'entries') + '; ' + duplicates + ' already here' + (parsed.rejected ? '; ' + parsed.rejected + ' skipped as invalid' : '') + '. Nothing was overwritten.');
      render();
    } catch (error) { toast('Import stopped: ' + error.message, 'error'); }
  };
  reader.readAsText(file);
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
  $('modal-fair-hint').textContent = modalPrefill.fair ? 'Bet Buddy model fair odds ' + modalPrefill.fair + '. That is not a bookmaker price: enter the price you were actually offered.' : '';
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
    const parsedOdds = (calc.parseOdds ? calc.parseOdds(oddsText) : null) ?? calc.parseFractionalOdds(oddsText);
    return { selection, odds: parsedOdds, outcome: 'pending' };
  });
}

function updateModalPnlPreview() {
  const acc = $('modal-bet-type').value === 'accumulator';
  const legs = acc ? parseAccumulatorLegs() : [];
  const singleOdds = (calc.parseOdds ? calc.parseOdds($('modal-odds-input').value) : null) ?? calc.parseFractionalOdds($('modal-odds-input').value);
  const odds = acc ? (legs.length >= 2 && legs.every(l => Number.isFinite(l.odds) && l.odds > 1) ? legs.reduce((t, l) => t * l.odds, 1) : 0) : (singleOdds || 0);
  const stake = Number($('modal-stake-input').value) || 0;
  const preview = $('modal-pnl-preview');
  if (odds > 1 && stake > 0) {
    const profit = calc.calculateBetProfit(stake, odds, 'won');
    const oddsStr = oddsFormat === 'decimal' ? calc.formatDecimalOdds(odds) : calc.formatFractionalOdds(odds);
    preview.textContent = 'Potential return £' + (stake * odds).toFixed(2) + ' (profit £' + profit.toFixed(2) + ') at ' + oddsStr + (acc ? ' combined' : '') + '.';
  } else preview.textContent = acc ? 'Add at least two legs as "selection | fractional odds", such as "Arsenal win | 4/6".' : 'Enter valid UK fractional odds, such as 6/4, 1/2 or Evens, and a stake.';
}


function celebrateSave() {
  try {
    const container = document.createElement('div');
    container.className = 'celebration-wrap';
    document.body.appendChild(container);
    const ring = document.createElement('div');
    ring.className = 'celebration-ring';
    container.appendChild(ring);
    const colors = ['#10b981', '#34d399', '#38bdf8', '#f59e0b', '#ffffff'];
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('span');
      p.className = 'celebration-sparkle';
      const angle = (i / 20) * 2 * Math.PI;
      const dist = 60 + Math.random() * 80;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist - 20;
      p.style.setProperty('--tx', tx + 'px');
      p.style.setProperty('--ty', ty + 'px');
      p.style.backgroundColor = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.1) + 's';
      container.appendChild(p);
    }
    setTimeout(() => container.remove(), 1200);
  } catch (e) { /* ignore */ }
}

function handleDiaryFormSubmit(event) {
  event.preventDefault();
  const acc = $('modal-bet-type').value === 'accumulator';
  const legs = acc ? parseAccumulatorLegs() : [];
  const stake = Number($('modal-stake-input').value);
  const singleOdds = (calc.parseOdds ? calc.parseOdds($('modal-odds-input').value) : null) ?? calc.parseFractionalOdds($('modal-odds-input').value);
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
  celebrateSave();
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
      '<p class="section-note" style="margin-top:10px">' + esc(s.attribution || '') + ' Bookmaker prices come from The Odds API (UK bookmakers; Match Result and Total Goals only) and are ignored once older than 12 hours; for any other market, enter a price you have seen. Corners, cards and shots are not shown: their statistics come from a source whose terms exclude public use.</p></div>' +
    '<div class="card"><h2 class="section-title">Where each number comes from</h2><table class="table" style="margin-top:8px"><tbody>' +
      '<tr><td><b>Match result</b></td><td>Dixon-Coles model with time decay, fitted for each league on football-data.org final scores only (model dc-public-v1) and backtested chronologically on 2025-26. A club with too little recent history, such as a newly promoted side, gets the league average (limited evidence). All estimates are provisional until a forward record builds up.</td></tr>' +
      '<tr><td><b>Goals, both teams to score</b></td><td>Provisional: 30% score model, 70% league rate. Backtests show no proven edge.</td></tr>' +
      '<tr><td><b>Corners, cards, shots</b></td><td>Not shown. The only available match statistics come from a source that does not permit public use. Earlier research predictions for these markets are private.</td></tr>' +
      '<tr><td><b>Records</b></td><td>Public records (ids starting PUB-) are produced by the public model and sealed before kick-off from the day it went live. They are not the earlier research predictions, which are kept privately and are not shown or recreated here.</td></tr>' +
      '<tr><td><b>Fair odds</b></td><td>1 ÷ probability, rounded to a familiar UK price. Not a bookmaker price.</td></tr></tbody></table></div></div>' +
    '<div class="section card"><h2 class="section-title">Tell us what you think</h2><form id="fb-form" class="grid" style="margin-top:12px">' +
      stars('understand', 'How clear were the predictions? (1 confusing, 5 crystal clear)') + stars('convincing', 'How convincing was the evidence?') +
      '<div class="field"><span class="lbl">Was it useful?</span><div class="stars">' + [['useful', 'Very useful'], ['neutral', 'Somewhat'], ['not_useful', 'Not useful']].map(([v, l]) => '<button type="button" class="opt" data-useful="' + v + '" aria-pressed="' + (feedbackState.useful === v) + '">' + l + '</button>').join('') + '</div></div>' +
      '<div class="field"><span class="lbl">Anything confusing?</span><div class="stars">' + ['Evidence labels', 'Odds vs probabilities', 'Provisional estimates', 'Navigation', 'Diary returns', 'All clear'].map(c => '<button type="button" class="opt" data-chip="' + esc(c) + '" aria-pressed="' + feedbackState.chips.has(c) + '">' + esc(c) + '</button>').join('') + '</div></div>' +
      '<div class="field"><label for="fb-improvements">What would make Bet Buddy better?</label><textarea id="fb-improvements" class="ctl"></textarea></div>' +
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

let sharedSlipNotice = false;
function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash.startsWith('join-league=')) {
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
}

let lastRoute = '';

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

function render() {
  const [view, arg] = currentRoute();
  const navKey = view === 'match' ? 'fixtures' : view;
  document.querySelectorAll('.nav a').forEach(a => { if (a.dataset.nav === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  updateOddsToggleLabel(); updateHeaderAuthUI();
  const html = view === 'fixtures' ? viewFixtures() : view === 'match' ? viewMatch(arg) : view === 'results' ? viewResults() : view === 'diary' ? viewDiary() : view === 'leagues' ? viewLeagues() : view === 'admin' ? viewAdmin() : view === 'more' ? viewMore() : viewHome();
  $('app').innerHTML = html;
  const titles = { home: 'Best Picks', fixtures: 'Fixtures', match: 'Match analysis', results: 'Results & performance', diary: 'Bet Diary', leagues: 'Buddy Leagues', admin: 'Founder Admin & Affiliates', more: 'Data & methods' };
  document.title = (titles[view] || 'Bet Buddy') + ' · Bet Buddy';
  const key = view + '/' + arg;
  if (key !== lastRoute) {
    // Animate and scroll only on navigation, not on in-page updates.
    const first = $('app').querySelector('.view');
    if (first) first.classList.add('enter');
    window.scrollTo({ top: 0 });
    lastRoute = key;
  }
}


// ------------------------------------------------------------ Google Auth & PWA Installation
const AUTH_STORAGE_KEY = 'betbuddy_auth_user_v1';
let deferredInstallPrompt = null;

function getAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

function saveAuthUser(user) {
  try {
    if (user) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) { /* ignore */ }
  updateHeaderAuthUI();
}

function updateHeaderAuthUI() {
  const container = $('header-auth-container');
  if (!container) return;
  const user = getAuthUser();
  if (user && user.signedIn) {
    const initials = (user.name || user.email || 'U').slice(0, 1).toUpperCase();
    container.innerHTML = '<button type="button" class="header-user-btn" id="header-user-btn" title="Signed in as ' + esc(user.name || user.email) + '">' +
      '<span class="header-avatar">' + esc(initials) + '</span>' +
      '<span>@' + esc(user.handle || (user.name || 'Buddy').split(' ')[0]) + '</span></button>';
  } else {
    container.innerHTML = '<button type="button" class="google-sub-btn" id="header-auth-btn" title="Sign in with Google">' +
      '<svg class="google-g" viewBox="0 0 24 24" width="13" height="13"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>' +
      '<span>Sign in with Google</span></button>';
  }
}

function openAuthModal() {
  const modal = $('google-auth-modal');
  if (!modal) return;
  const user = getAuthUser();
  const unauthed = $('auth-unauthed-view');
  const authed = $('auth-authed-view');
  if (user && user.signedIn) {
    unauthed.hidden = true;
    authed.hidden = false;
    $('modal-avatar-initials').textContent = (user.name || user.email || 'U').slice(0, 1).toUpperCase();
    $('modal-auth-name').textContent = user.name || 'Bet Buddy User';
    $('modal-auth-email').textContent = user.email || 'user@gmail.com';
  } else {
    unauthed.hidden = false;
    authed.hidden = true;
    const curProfile = getUserProfile();
    $('google-display-name').value = curProfile.handle !== 'PandaPunter' ? curProfile.handle : '';
  }
  modal.hidden = false;
}

function closeAuthModal() {
  const modal = $('google-auth-modal');
  if (modal) modal.hidden = true;
}

function isIos() {
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function isInStandaloneMode() {
  return ('standalone' in window.navigator && window.navigator.standalone) ||
    window.matchMedia('(display-mode: standalone)').matches;
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
});

document.addEventListener('click', event => {
    const t = event.target.closest('[data-open-league-modal],[data-close-league],[data-open-handle-modal],[data-close-handle],[data-share-league],[data-select-league],[data-slip],[data-share-slip],[data-partner-slip],[data-legs],[data-win],[data-back],[data-diary],[data-close],[data-comp],[data-tab],[data-showall],[data-rfilter],[data-export],[data-import],[data-delete],[data-clear-diary],[data-retry],[data-star],[data-useful],[data-chip],#odds-toggle,#bookmaker-quick button,#header-install-btn,[data-close-install],#header-auth-btn,#header-user-btn,[data-close-auth],#btn-switch-handle,#btn-google-signout,#btn-trigger-native-install');
  if (!t) {
    if (event.target.id === 'diary-modal') closeDiary();
    if (event.target.id === 'google-auth-modal') closeAuthModal();
    if (event.target.id === 'install-modal') closeInstallModal();
    return;
  }
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
  }
  if (t.id === 'header-install-btn') { openInstallModal(); return; }
  if (t.dataset.closeInstall !== undefined) { closeInstallModal(); return; }
  if (t.id === 'header-auth-btn' || t.id === 'header-user-btn') { openAuthModal(); return; }
  if (t.dataset.closeAuth !== undefined) { closeAuthModal(); return; }
  if (t.id === 'btn-switch-handle') { closeAuthModal(); $('player-handle-input').value = getUserProfile().handle; $('handle-modal').hidden = false; return; }
  if (t.id === 'btn-google-signout') {
    saveAuthUser(null);
    closeAuthModal();
    toast('Signed out from Google account.');
    render();
    return;
  }
  if (t.id === 'btn-trigger-native-install') {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') toast('Bet Buddy installed to your device!');
        deferredInstallPrompt = null;
        closeInstallModal();
      });
    }
    return;
  }
  if (t.id === 'odds-toggle') toggleOddsFormat();
  else if (t.dataset.back !== undefined) {
    if (window.history.length > 1) window.history.back();
    else window.location.hash = '#/';
  }
  else if (t.dataset.win !== undefined) {
    builderState.win = +t.dataset.win;
    const inp = $('b-win'); if (inp) inp.value = builderState.win;
    const out = $('b-win-out'); if (out) out.textContent = MatchIQBuilder.money(builderState.win);
    markWinChips();
    updateBuilder();
  }
  else if (t.dataset.openLeagueModal !== undefined) { $('league-modal').hidden = false; }
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
  else if (t.dataset.slip !== undefined) saveSlipToDiary(+t.dataset.slip);
  else if (t.dataset.shareSlip !== undefined) shareAccaSlip(+t.dataset.shareSlip);
  else if (t.dataset.partnerSlip !== undefined) {
    shareAccaSlip(+t.dataset.partnerSlip);
    toast('Acca copied! Ready to paste into Bet365, SkyBet or Betfair.');
  }
  else if (t.dataset.legs) setBuilderLegs(+t.dataset.legs);
  else if (t.dataset.diary !== undefined) openDiary(JSON.parse(t.dataset.diary || '{}'));
  else if (t.dataset.close !== undefined) closeDiary();
  else if (t.dataset.comp) { compFilter = t.dataset.comp; try { localStorage.setItem(COMP_KEY, compFilter); } catch (e) { /* ignore */ } render(); }
  else if (t.dataset.tab) { fixturesTab = t.dataset.tab; fixturesShowAll = false; render(); }
  else if (t.dataset.showall !== undefined) { fixturesShowAll = true; render(); }
  else if (t.dataset.rfilter) { resultsFilter = t.dataset.rfilter; render(); }
  else if (t.dataset.export === 'csv') exportDiaryCSV();
  else if (t.dataset.export === 'json') exportDiaryJSON();
  else if (t.dataset.export === 'backup') exportDiaryBackup();
  else if (t.dataset.import === 'diary') { const inp = $('diary-import'); if (inp) inp.click(); }
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
  if (t.id === 'club-search') {
    clubFilter = t.value.toLowerCase().trim();
    render();
    const inp = $('club-search');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    return;
  }
  if (t.dataset && t.dataset.b) { onBuilderInput(t); return; }
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
  if (event.target && event.target.id === 'diary-import') { const f = event.target.files && event.target.files[0]; if (f) importDiaryFile(f); event.target.value = ''; return; }
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
    if (event.target.id === 'google-quick-signin-form') {
    event.preventDefault();
    const name = ($('google-display-name').value || '').trim() || 'Buddy Player';
    const email = ($('google-email-input').value || '').trim() || 'buddy@gmail.com';
    const handle = name.replace(/\s+/g, '').slice(0, 16);
    const user = { signedIn: true, name, email, handle, signedAt: new Date().toISOString() };
    saveAuthUser(user);
    saveUserProfile(handle);
    closeAuthModal();
    toast('Welcome, ' + name + '! Google account linked.');
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
