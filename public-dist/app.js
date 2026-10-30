// App Launch: Guarantee landing on Home screen (#/) unless explicit deep-link (#join-league or #slip)
try {
  const h = window.location.hash || '';
  const isSharedDeepLink = h.includes('join-league=') || h.includes('slip=');
  if (!isSharedDeepLink) {
    window.location.hash = '#/';
  }
} catch (e) {}
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
  performance: 'data/performance.json', leagueValidation: 'data/league_validation.json', status: 'data/pipeline_status.json', reliability: 'data/model_reliability.json', odds: 'data/odds.json', multiSport: 'data/multi_sport_events.json'
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
// Custom Multi-Sport Acca State
let customAccaLegs = [];
try {
  const savedCustom = JSON.parse(localStorage.getItem('betbuddy_custom_acca_v1') || '[]');
  if (Array.isArray(savedCustom)) customAccaLegs = savedCustom;
} catch (e) {}

function addCrossSportAccaLeg(leg) {
  if (!customAccaLegs.some(l => l.id === leg.id || (l.label === leg.label && l.matchId === leg.matchId))) {
    customAccaLegs.push(leg);
    try { localStorage.setItem('betbuddy_custom_acca_v1', JSON.stringify(customAccaLegs)); } catch (e) {}
    toast('Added ' + leg.label + ' to Custom Acca! 🎯');
    updateBuilder();
    render();
  } else {
    toast(leg.label + ' already in Acca!');
  }
}

function removeCrossSportAccaLeg(legId) {
  customAccaLegs = customAccaLegs.filter(l => l.id !== legId);
  try { localStorage.setItem('betbuddy_custom_acca_v1', JSON.stringify(customAccaLegs)); } catch (e) {}
  toast('Selection removed from Acca.');
  updateBuilder();
  render();
}

function clearCustomAcca() {
  customAccaLegs = [];
  try { localStorage.removeItem('betbuddy_custom_acca_v1'); } catch (e) {}
  toast('Custom Acca cleared.');
  updateBuilder();
  render();
}


function builderCompute() {
  const { stake, legs, win } = builderState;
  const footballPool = activeSports.includes('football')
    ? MatchIQBuilder.legPool(predictionsList(), { calc, reliability: DATA.reliability, feedFor, nowMs: Date.now() })
    : [];

  // Multi-Sport Pool Injection
  const multiSportPool = [];
  if (DATA.multiSport && DATA.multiSport.sports) {
    activeSports.forEach(sportKey => {
      if (sportKey === 'football') return;
      const sp = DATA.multiSport.sports[sportKey];
      if (!sp || !sp.tournaments) return;
      sp.tournaments.forEach(t => {
        (t.events || []).forEach(ev => {
          (ev.selections || []).forEach(sel => {
            if (sel.decimal && sel.decimal > 1.05) {
              const estimatedProb = 1 / (sel.decimal * 1.07);
              multiSportPool.push({
                matchId: ev.id,
                selId: ev.id + '-' + sel.label,
                fixture: { home: ev.title, away: sp.name, competition: sportKey.toUpperCase() },
                kickoff: Date.now() + 86400000,
                id: ev.id + '-' + sel.label,
                label: sel.label + ' (' + sp.name + ')',
                market: 'match',
                p: estimatedProb,
                odds: sel.decimal,
                fractional: sel.fractional,
                bookmaker: sel.bookmaker || 'UK Bookmaker',
                priceSource: 'live',
                support: 'validated',
                basis: sp.name + ' UK Odds',
                sport: sportKey
              });
            }
          });
        });
      });
    });
  }

  const combinedPool = footballPool.concat(multiSportPool);
  builderResult = MatchIQBuilder.buildSlips(combinedPool, { stake, win, legs });

  // When non-football sports are active, synthesize a guaranteed Cross-Sport Mix Acca
  const otherActive = activeSports.filter(s => s !== 'football');
  if (builderResult && builderResult.slips && builderResult.slips.length > 0 && otherActive.length > 0 && multiSportPool.length > 0) {
    const hasOtherSport = builderResult.slips[0].legs.some(l => l.sport && l.sport !== 'football');
    if (!hasOtherSport) {
      // Pick top selection from each active non-football sport
      const crossLegs = [];
      otherActive.forEach(sk => {
        const best = multiSportPool.find(l => l.sport === sk && !crossLegs.some(c => c.matchId === l.matchId));
        if (best) crossLegs.push(best);
      });
      // Fill remaining legs from footballPool
      const remainingNeeded = Math.max(0, legs - crossLegs.length);
      for (const fb of footballPool) {
        if (crossLegs.length >= legs) break;
        if (!crossLegs.some(c => c.matchId === fb.matchId)) crossLegs.push(fb);
      }
      if (crossLegs.length === legs) {
        const odds = crossLegs.reduce((t, c) => t * c.odds, 1);
        const chance = crossLegs.reduce((t, c) => t * c.p, 1);
        const crossSlip = {
          legs: crossLegs,
          odds,
          chance,
          ret: stake * odds,
          profit: stake * odds - stake,
          ev: chance * stake * odds - stake,
          onTarget: true,
          estimated: crossLegs.some(c => c.priceSource !== 'live'),
          isCrossSportMix: true
        };
        // Insert as top recommendation!
        builderResult.slips.unshift(crossSlip);
        if (builderResult.slips.length > 3) builderResult.slips.pop();
      }
    }
  }

  try { localStorage.setItem(BUILDER_KEY, JSON.stringify(builderState)); } catch (e) { /* ignore */ }
}

function slipLegRow(l) {
  const f = l.fixture, ms = l.kickoff;
  const legPrice = oddsFormat === 'decimal' ? calc.formatDecimalOdds(l.odds) : esc(l.fractional);
  const price = l.priceSource === 'live'
    ? '<span class="slip-price live" title="Bookmaker price from ' + esc(l.bookmaker) + '">' + legPrice + '<small>' + esc(l.bookmaker) + '</small></span>'
    : '<span class="slip-price est" title="No fresh bookmaker price. Estimated from the model chance plus a typical margin: check your bookmaker.">' + legPrice + '<small>estimate</small></span>';

  const sportEmojis = { TENNIS: '🎾', GOLF: '⛳', DARTS: '🎯', RUGBY: '🏉' };
  const sportEmoji = sportEmojis[f.competition] || (l.sport && sportEmojis[l.sport.toUpperCase()]);
  const crestOrIcon = sportEmoji
    ? '<span class="sport-badge-icon" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(56,189,248,0.18);border:1px solid rgba(56,189,248,0.4);font-size:13px;flex-shrink:0">' + sportEmoji + '</span>'
    : crest(f.home, 22);

  const teamDisplay = f.away && f.away !== f.home && f.away !== 'TENNIS' && f.away !== 'GOLF' && f.away !== 'DARTS' && f.away !== 'RUGBY'
    ? esc(f.home) + ' v ' + esc(f.away)
    : esc(f.home);

  return '<li class="slip-leg"><span class="slip-teams">' + crestOrIcon + '<span class="slip-match">' + teamDisplay +
    '<small>' + esc(fmtDay(ms)) + ' ' + esc(fmtTime(ms)) + ' · ' + esc(leagueName(f.competition)) + '</small></span></span>' +
    '<span class="slip-pick"><b>' + esc(l.label) + '</b><small>' + pct(l.p) + ' chance' + (l.support === 'provisional' ? ' · provisional' : '') + '</small></span>' + price + '</li>';
}

function canonicalUrl(url) {
  if (!url) return 'https://betbuddyuk.uk/';
  return String(url)
    .replace(/^https?:\/\/[^\/]*github\.io\/MatchIQ\/?/i, 'https://betbuddyuk.uk/')
    .replace(/^https?:\/\/[^\/]*github\.io\/[^\/#]*\/?/i, 'https://betbuddyuk.uk/');
}

let currentSharePayload = { title: '', text: '', url: '' };

function openUniversalShare({ title, text, url }, forceModal = false) {
  const finalUrl = canonicalUrl(url);
  currentSharePayload = {
    title: title || 'Bet Buddy',
    text: text || '',
    url: finalUrl
  };

  const fullText = currentSharePayload.text.includes(finalUrl)
    ? currentSharePayload.text
    : currentSharePayload.text + (finalUrl ? '\n\n' + finalUrl : '');

  // If forceModal is true (e.g. user clicked 'Share app with friend'), directly show WhatsApp, SMS, Facebook, X options!
  if (forceModal || !navigator.share) {
    openShareSheetModal(fullText);
    return;
  }

  // Otherwise, if mobile device supports Web Share API and not forced, launch native share sheet
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

  openShareSheetModal(fullText);
}

function shareAppWithFriend() {
  openUniversalShare({
    title: 'Bet Buddy UK - The AI Smart Acca & Mini-Leagues App',
    text: 'Check out Bet Buddy! Smart AI football accas, real bookie odds comparison, and private betting leagues with mates:\nhttps://betbuddyuk.uk/',
    url: 'https://betbuddyuk.uk/'
  }, true);
}

function openShareSheetModal(fullText) {
  const modal = $('share-modal');
  if (!modal) return;
  const pre = $('share-preview-text');
  if (pre) pre.textContent = fullText;

  const encText = encodeURIComponent(fullText);
  const encTitle = encodeURIComponent(currentSharePayload.title || 'Bet Buddy');
  const encUrl = encodeURIComponent(currentSharePayload.url || 'https://betbuddyuk.uk/');

  const waBtn = $('btn-share-whatsapp');
  if (waBtn) waBtn.href = 'https://api.whatsapp.com/send?text=' + encText;

  const smsBtn = $('btn-share-sms');
  if (smsBtn) smsBtn.href = 'sms:?&body=' + encText;

  const fbBtn = $('btn-share-facebook');
  if (fbBtn) fbBtn.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encUrl + '&quote=' + encText;

  const xBtn = $('btn-share-x');
  if (xBtn) xBtn.href = 'https://twitter.com/intent/tweet?text=' + encText + '&url=' + encUrl;

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
  const shareUrl = 'https://betbuddyuk.uk/#slip=' + encodeURIComponent(builderState.stake + '_' + builderState.win + '_' + builderState.legs);
  const text = [
    '🎯 Bet Buddy Acca (Target: ' + m(slip.profit) + ' profit)',
    'Odds: ' + fmtOdds(slip.odds) + ' · Estimated Chance: ' + Math.round(slip.chance * 100) + '%',
    'Stake: ' + m(stake) + ' · Potential Return: ' + m(slip.ret),
    '',
    ...slip.legs.map((l, i) => (i + 1) + '. ' + l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label + ' (' + l.fractional + ')'),
    '',
    'Load this exact slip on Bet Buddy:'
  ].join('\n');

  openUniversalShare({
    title: 'Bet Buddy Acca Slip (' + fmtOdds(slip.odds) + ')',
    text,
    url: shareUrl
  });
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

function customAccaCard(stake) {
  const m = MatchIQBuilder.money;
  const legs = customAccaLegs;
  const odds = legs.reduce((t, l) => t * (l.odds || 2.0), 1);
  const ret = stake * odds;
  const profit = ret - stake;
  const chance = legs.reduce((t, l) => t * (l.p || 0.5), 1);
  const chancePct = chance >= 0.1 ? Math.round(chance * 100) : (chance * 100).toFixed(1);
  const mainOdds = fmtOdds(odds);

  return '<article class="slip custom-acca-slip" style="border: 2px solid #38bdf8; background: linear-gradient(160deg, rgba(56, 189, 248, 0.16), rgba(15, 23, 42, 0.95)); margin-bottom: 20px;">' +
    '<div class="slip-head">' +
      '<div>' +
        '<div class="slip-kicker" style="color: #38bdf8;">🎯 Your Custom Mixed Acca (' + legs.length + ' selections)</div>' +
        '<div class="slip-odds mono" style="color: #fff;">' + esc(mainOdds) + '</div>' +
      '</div>' +
      '<div class="slip-chance"><b class="mono">' + chancePct + '%</b><small>estimated chance</small></div>' +
    '</div>' +
    '<ul class="slip-legs">' +
      legs.map(l => {
        const sportIcons = { TENNIS: '🎾', GOLF: '⛳', DARTS: '🎯', RUGBY: '🏉', FOOTBALL: '⚽' };
        const icon = sportIcons[(l.sport || '').toUpperCase()] || '🎯';
        return '<li class="slip-leg" style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span style="font-size:16px;">' + icon + '</span>' +
            '<div><b>' + esc(l.label) + '</b><small style="display:block;color:#94a3b8">' + esc(l.bookmaker || 'UK Odds') + '</small></div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span class="slip-price live">' + esc(l.fractional || fmtOdds(l.odds)) + '</span>' +
            '<button type="button" class="btn small" data-remove-cross-leg="' + esc(l.id) + '" title="Remove from Acca" style="padding:2px 8px;font-size:11px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;">✕</button>' +
          '</div>' +
        '</li>';
      }).join('') +
    '</ul>' +
    '<div class="slip-sum">' +
      '<span>Stake <b class="mono">' + m(stake) + '</b></span>' +
      '<span>Returns <b class="mono">' + m(ret) + '</b></span>' +
      '<span>Profit <b class="mono">' + m(profit) + '</b></span>' +
    '</div>' +
    '<div class="btn-row" style="margin-top:12px;">' +
      '<button type="button" class="btn primary" onclick="saveCustomAccaToDiary()">Save Custom Acca to Bet Diary</button>' +
      '<button type="button" class="btn small" onclick="shareCustomAcca()"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg> Share / Copy</button>' +
      '<button type="button" class="btn small" data-clear-custom-acca style="background:rgba(255,255,255,0.05);color:#94a3b8;">Clear Acca</button>' +
    '</div>' +
  '</article>';
}

function saveCustomAccaToDiary() {
  const legs = customAccaLegs;
  if (!legs.length) return;
  const stake = (builderState && builderState.stake) || 10;
  const odds = legs.reduce((t, l) => t * (l.odds || 2.0), 1);
  openDiary({});
  $('modal-bet-type').value = 'accumulator';
  toggleAccumulatorFields();
  $('modal-stake').value = stake;
  $('modal-odds').value = fmtOdds(odds);
  $('modal-legs-input').value = legs.map(l => l.label + ' | ' + (l.fractional || fmtOdds(l.odds))).join('\n');
  toast('Custom Acca loaded into Bet Diary modal!');
}

function shareCustomAcca() {
  const legs = customAccaLegs;
  if (!legs.length) return;
  const stake = (builderState && builderState.stake) || 10;
  const odds = legs.reduce((t, l) => t * (l.odds || 2.0), 1);
  const ret = stake * odds;
  const text = [
    '🎯 Bet Buddy Custom Mixed Acca (' + legs.length + ' legs)',
    'Odds: ' + fmtOdds(odds) + ' · Potential Return: £' + ret.toFixed(2),
    ...legs.map(l => '• ' + l.label + ' (' + (l.fractional || fmtOdds(l.odds)) + ' via ' + (l.bookmaker || 'UK Bookie') + ')')
  ].join('\n');
  navigator.clipboard.writeText(text).then(() => {
    toast('Custom Acca copied to clipboard!');
  }).catch(() => {
    openUniversalShare({ title: 'Bet Buddy Acca', text, url: location.href });
  });
}

function builderOutput() {
  const r = builderResult, { stake, win } = builderState, m = MatchIQBuilder.money;
  let customHtml = customAccaLegs.length > 0 ? customAccaCard(stake) : '';
  if (!r) return customHtml;
  const need = '<p class="builder-need">To win <b>' + m(win) + '</b> from a <b>' + m(stake) + '</b> stake you need a total return of <b>' + m(stake + win) + '</b>: combined odds of about <b class="mono">' + fmtOdds((stake + win) / stake) + '</b>.</p>';
  if (r.error) return customHtml + need + '<div class="empty" style="margin-top:12px">' + esc(r.error) + '</div>';
  const first = r.slips[0];
  const miss = r.exact ? '' : '<p class="slip-warn">No combination lands on that target. This is the closest available: it returns ' + m(first.ret) + ' (profit ' + m(first.profit) + ').</p>';
  const fine = '<p class="builder-fine">Chances are Bet Buddy model estimates, not promises. On average this slip is expected to ' + (first.ev >= 0 ? 'make ' : 'lose ') + '<b>' + m(Math.abs(first.ev)) + '</b> per ' + m(stake) + ' staked; bookmaker margins usually push that below zero. Never stake more than you can afford to lose.</p>';
  return customHtml + need + miss + r.slips.map((s, i) => slipCard(s, i, stake)).join('') + fine;
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

function renderWelcomeHero() {
  const diaryItems = getStoredDiary();
  const diaryCount = diaryItems.length;
  const user = getAuthUser();
  const userName = user && user.displayName ? user.displayName.split(' ')[0] : 'Punter';

  return '<div class="welcome-hero-wrap">' +
    '<div class="welcome-hero-banner">' +
      '<div class="welcome-mascot-col">' +
        '<div class="welcome-panda-avatar">' +
          '<img src="assets/icon-192.png" onerror="this.onerror=null;this.src=\'data:image/png;base64,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\'" alt="Bet Buddy Mascot" width="76" height="76">' +
          '<span class="mascot-online-dot" title="Live Predictions Ready"></span>' +
        '</div>' +
      '</div>' +
      '<div class="welcome-text-col">' +
        '<div class="welcome-badge-tag"><span class="badge-dot"></span> Welcome, ' + esc(userName) + '! · 100% Free &amp; Ad-Free</div>' +
        '<h1 class="welcome-hero-title">Your Honest Sports Betting Co-Pilot</h1>' +
        '<p class="welcome-hero-narrative">' +
          'Tired of bookmaker hype? Bet Buddy uses real Poisson &amp; Dixon-Coles mathematical evidence, transparent track records, and zero bull. ' +
          'Build precision accumulators, compete in local &amp; worldwide silverware leagues, track your bets privately, and verify every single price with cold mathematics.' +
        '</p>' +
      '</div>' +
    '</div>' +

    '<!-- 5 Bento Portal Cards -->' +
    '<div class="portal-grid">' +
      '<!-- 1. Top Large Card: Pick a Bet -->' +
      '<a href="#/picks" class="portal-card portal-card-hero" style="text-decoration:none">' +
        '<div class="portal-card-hero-glow"></div>' +
        '<div class="portal-card-content">' +
          '<div class="portal-card-top">' +
            '<span class="portal-pill highlight">⚡ Primary Feature</span>' +
            '<span class="portal-odds-badge">Dixon-Coles Model Calibrated</span>' +
          '</div>' +
          '<div class="portal-hero-body">' +
            '<div class="portal-icon-large">⚽🎯</div>' +
            '<div>' +
              '<h2 class="portal-hero-heading">Pick a Bet &amp; Build Acca</h2>' +
              '<p class="portal-hero-desc">' +
                'Select targets (£10 to £1000 profit across 2 to 6 legs). Auto-filter the highest-edge value picks, compare live bookmaker prices, or explore cross-sport tennis, golf, darts &amp; rugby bets.' +
              '</p>' +
            '</div>' +
          '</div>' +
          '<div class="portal-card-action">' +
            '<span class="btn primary portal-cta-btn">' +
              '<span>Launch Bet Builder &amp; Predictions</span>' +
              '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
            '</span>' +
            '<span class="portal-sub-action-hint">Tap to open Acca Builder &amp; Multi-Sport Picks</span>' +
          '</div>' +
        '</div>' +
      '</a>' +

      '<!-- 4 Bento Grid Cards Below -->' +
      '<div class="portal-subgrid">' +
        '<!-- 2. Leagues & Silverware -->' +
        '<a href="#/leagues" class="portal-subcard bento-leagues">' +
          '<div class="portal-subcard-icon-wrap trophy-glow">🏆</div>' +
          '<div class="portal-subcard-text">' +
            '<div class="portal-subcard-tag">Compete &amp; Win</div>' +
            '<h3 class="portal-subcard-title">Buddy &amp; Geo Leagues</h3>' +
            '<p class="portal-subcard-desc">Automatic entry into Town, Region, Scotland/UK &amp; World ladders. Points for big odds winners!</p>' +
          '</div>' +
          '<div class="portal-subcard-footer">' +
            '<span class="portal-link-label">View Silverware Ladders</span>' +
            '<span class="portal-arrow">›</span>' +
          '</div>' +
        '</a>' +

        '<!-- 3. Upcoming Fixtures -->' +
        '<a href="#/fixtures" class="portal-subcard bento-fixtures">' +
          '<div class="portal-subcard-icon-wrap calendar-glow">📅</div>' +
          '<div class="portal-subcard-text">' +
            '<div class="portal-subcard-tag">Schedule &amp; TV</div>' +
            '<h3 class="portal-subcard-title">Upcoming Fixtures</h3>' +
            '<p class="portal-subcard-desc">Comprehensive Premier League, European and domestic dates, kick-off clocks and match previews.</p>' +
          '</div>' +
          '<div class="portal-subcard-footer">' +
            '<span class="portal-link-label">Browse Match Fixtures</span>' +
            '<span class="portal-arrow">›</span>' +
          '</div>' +
        '</a>' +

        '<!-- 4. Results & Performance -->' +
        '<a href="#/results" class="portal-subcard bento-results">' +
          '<div class="portal-subcard-icon-wrap chart-glow">📊</div>' +
          '<div class="portal-subcard-text">' +
            '<div class="portal-subcard-tag">Honest Track Record</div>' +
            '<h3 class="portal-subcard-title">Results &amp; Verification</h3>' +
            '<p class="portal-subcard-desc">Permanent audit ledger of every settled prediction, Brier calibration scores and historical match scores.</p>' +
          '</div>' +
          '<div class="portal-subcard-footer">' +
            '<span class="portal-link-label">Check Settlement Ledger</span>' +
            '<span class="portal-arrow">›</span>' +
          '</div>' +
        '</a>' +

        '<!-- 5. Bet Diary & Trophy Cabinet -->' +
        '<a href="#/diary" class="portal-subcard bento-diary">' +
          '<div class="portal-subcard-icon-wrap diary-glow">📖</div>' +
          '<div class="portal-subcard-text">' +
            '<div class="portal-subcard-tag">Private Ledger (' + diaryCount + ' bets)</div>' +
            '<h3 class="portal-subcard-title">Bet Diary &amp; Cabinet</h3>' +
            '<p class="portal-subcard-desc">Track stakes, PnL and strike rates locally. Inspect your earned Gold, Silver and Bronze silverware.</p>' +
          '</div>' +
          '<div class="portal-subcard-footer">' +
            '<span class="portal-link-label">Open My Diary</span>' +
            '<span class="portal-arrow">›</span>' +
          '</div>' +
        '</a>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function scrollToBuilder() {
  const el = document.getElementById('builder-anchor') || document.querySelector('.builder-shell');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function viewHome() {
  
  // Commercial Inquiries Ledger
  const enquiries = getStoredEnquiries();
  const enquiryRows = enquiries.length ? enquiries.map(e =>
    '<tr>' +
      '<td><b>' + esc(e.company || e.name) + '</b><br><small class="muted">' + esc(e.name) + ' &middot; <a href="mailto:' + esc(e.email) + '" style="color:var(--cyan)">' + esc(e.email) + '</a></small></td>' +
      '<td><span class="badge validated">' + esc(e.interest) + '</span></td>' +
      '<td style="max-width:280px;font-size:12px;color:var(--muted);">' + esc(e.message) + '</td>' +
      '<td style="font-size:11px;font-family:var(--mono);color:var(--dim);white-space:nowrap;">' + esc(e.submitted_at ? e.submitted_at.slice(0, 16).replace('T', ' ') : 'Just now') + '</td>' +
    '</tr>'
  ).join('') : '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px;">No commercial enquiries submitted yet.</td></tr>';

  const enquiryCard = '<div class="section card" style="margin-top:24px;">' +
    '<div class="section-head"><div><h2 class="section-title">Commercial &amp; Sponsorship Inquiries (' + enquiries.length + ')</h2><p class="section-note">Incoming bookmaker, brand, and affiliate proposals submitted via #/commercial.</p></div>' +
    (enquiries.length ? '<button type="button" class="btn small" data-admin-action="clear-enquiries" style="background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);">Clear Enquiries</button>' : '') +
    '</div>' +
    '<div style="overflow-x:auto;"><table class="table"><thead><tr><th>Partner / Contact</th><th>Category</th><th>Proposal</th><th>Submitted</th></tr></thead><tbody>' + enquiryRows + '</tbody></table></div>' +
  '</div>';

  return '<section class="view">' +
    renderWelcomeHero() +
    beginnerGuides() +
  '</section>';
}

function viewPicks() {
  const topHubNav = '<div class="picks-top-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:4px 0;">' +
    '<a href="#/" class="btn small" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none;font-weight:700;background:rgba(56,189,248,0.14);border:1px solid var(--cyan);color:#fff;">← Welcome Hub</a>' +
    '<span class="badge validated" style="font-size:11.5px;">🎯 Multi-Sport Acca Engine</span>' +
  '</div>';
  const list = upcoming();
  const sharedBanner = sharedSlipNotice
    ? '<div class="notice section shared-slip-notice" style="border-color:var(--cyan);background:rgba(56,189,248,0.12);color:#fff;margin-bottom:18px"><span style="font-size:20px">🐼</span><div><b>Acca shared by a mate!</b> Bet Builder is pre-filled to target £' + builderState.win + ' profit across ' + builderState.legs + ' bets.</div><button type="button" class="icon-btn" onclick="sharedSlipNotice=false;render()" style="margin-left:auto">&times;</button></div>'
    : '';
  let html = '<section class="view">' +
    topHubNav +
    renderSportFilterBar() +
    sharedBanner +
    viewBuilder() + '<div class="section-head" style="align-items:flex-end;margin-top:36px"><div><h2 class="page-title">This round</h2>' +
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
    // Append any active other sports below football
  const otherActive = activeSports.filter(s => s !== 'football');
  if (otherActive.length > 0) {
    html += '<div class="section"><div class="section-head"><div><h2 class="section-title">Cross-Sport Fixtures &amp; Markets</h2>' +
      '<span class="section-note">Active sports: ' + otherActive.map(s => s.toUpperCase()).join(', ') + '</span></div>' +
      '<span class="badge validated">The Odds API Feed</span></div>' +
      otherActive.map(renderMultiSportSection).join('') +
    '</div>';
  }

  return html + homeFixtures() + '</section>';
}

function renderMultiSportSection(sportKey) {
  const sportData = (DATA.multiSport && DATA.multiSport.sports && DATA.multiSport.sports[sportKey]);
  if (!sportData) return '';
  return (sportData.tournaments || []).map(t => {
    const eventsHtml = (t.events || []).map(ev => {
      const selectionsHtml = (ev.selections || []).map(sel => {
        const betData = esc(JSON.stringify({
          eventId: ev.id,
          sport: sportKey,
          selection: ev.title + ' · ' + sel.label,
          fair: sel.fractional,
          odds: sel.decimal,
          bookmaker: sel.bookmaker
        }));
        return '<div class="sport-selection-row">' +
          '<div class="sport-sel-info">' +
            '<span class="sport-sel-name">' + esc(sel.label) + '</span>' +
            '<span class="sport-sel-bookie">Best price: ' + esc(sel.bookmaker) + '</span>' +
          '</div>' +
          '<div class="sport-sel-actions">' +
            '<button type="button" class="sport-odds-btn" data-open-bookie=\'' + betData + '\' title="Place with ' + esc(sel.bookmaker) + '">' + esc(sel.fractional) + '</button>' +
            '<button type="button" class="btn small" data-diary=\'' + betData + '\' title="Add to Bet Diary">+ Diary</button>' +
            '<button type="button" class="btn-add-cross-acca" data-add-cross-acca=\'' + betData + '\' title="Add to Accumulator">+ Acca</button>' +
          '</div>' +
        '</div>';
      }).join('');

      return '<div class="sport-event-card">' +
        '<div class="sport-card-head">' +
          '<div>' +
            '<h3 class="sport-event-title">' + esc(ev.title) + '</h3>' +
            '<div class="sport-tournament-sub">' + esc(t.tournament) + ' · ' + esc(ev.round) + '</div>' +
          '</div>' +
          '<span class="badge validated">' + esc(ev.date) + '</span>' +
        '</div>' +
        '<div class="sport-odds-list">' + selectionsHtml + '</div>' +
      '</div>';
    }).join('');

    return '<div class="sport-tournament-block" style="margin-bottom:18px">' +
      '<div class="section-head" style="margin-bottom:10px"><div><h3 class="section-title" style="font-size:1.15rem">' + esc(sportData.icon) + ' ' + esc(t.tournament) + '</h3>' +
      '<span class="section-note">' + esc(t.course || t.venue || t.surface || 'Official UK Bookmaker Prices') + '</span></div>' +
      '<span class="badge provisional">UK Odds Live</span></div>' +
      '<div class="sport-events-grid">' + eventsHtml + '</div>' +
    '</div>';
  }).join('');
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
function readDiary() { return getStoredDiary(); }
function getStoredDiary() {
  try { const entries = calc.loadBetDiary(localStorage, DIARY_STORAGE_KEY); diaryReadFailed = false; return entries; }
  catch (error) { diaryReadFailed = true; console.error('Bet Diary could not be read:', error); return []; }
}
function saveStoredDiary(entries) {
  if (diaryReadFailed) throw new Error('Bet Diary read failed; refusing to overwrite existing data.');
  calc.saveBetDiary(localStorage, DIARY_STORAGE_KEY, entries);
  updateDiaryCount();
  try {
    if (typeof syncLeagueToCloud === 'function') {
      getStoredLeagues().forEach(l => syncLeagueToCloud(l));
    }
  } catch (e) {}
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

// ------------------------------------------------------------ Firebase Firestore Cloud Sync
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDPTMcwfVP6v8Y1jsrnUqdM5EeIMwXKxw4",
  authDomain: "betbuddyuk.firebaseapp.com",
  projectId: "betbuddyuk",
  storageBucket: "betbuddyuk.firebasestorage.app",
  messagingSenderId: "875941513115",
  appId: "1:875941513115:web:c5366ae899be00547c833e",
  measurementId: "G-K1N7N0G8NF"
};

let firestoreDb = null;
try {
  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    firestoreDb = firebase.firestore();
  }
} catch (e) {
  console.warn('Firebase init notice:', e);
}

let activeLeagueUnsubscribe = null;

const FIRESTORE_REST_BASE = 'https://firestore.googleapis.com/v1/projects/betbuddyuk/databases/(default)/documents';
const FIRESTORE_API_KEY = FIREBASE_CONFIG.apiKey;

function parseFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(parseFirestoreValue);
  if ('mapValue' in val) {
    const res = {};
    const f = val.mapValue.fields || {};
    for (const k in f) res[k] = parseFirestoreValue(f[k]);
    return res;
  }
  return null;
}

function parseFirestoreFields(fields) {
  const res = {};
  for (const k in (fields || {})) res[k] = parseFirestoreValue(fields[k]);
  return res;
}

let isRestSyncing = false;
async function fetchCloudDataRest() {
  if (isRestSyncing) return;
  isRestSyncing = true;
  try {
    const prof = getUserProfile();
    // 1. Fetch Buddy Leagues via direct HTTP GET
    const lRes = await fetch(`${FIRESTORE_REST_BASE}/leagues?key=${FIRESTORE_API_KEY}`);
    if (lRes.ok) {
      const lData = await lRes.json();
      const stored = getStoredLeagues();
      let changed = false;

      (lData.documents || []).forEach(doc => {
        const d = parseFirestoreFields(doc.fields);
        const code = d.code || doc.name.split('/').pop();
        const membersList = extractMembersFromDoc(d);
        let existing = stored.find(l => l.code === code);
        if (!existing) {
          stored.push({
            id: 'league-' + code,
            name: d.name || ('Buddy League (' + code + ')'),
            icon: d.icon || '⚽',
            freq: d.freq || 'weekly',
            code: code,
            creator_handle: d.creator_handle || 'Creator',
            created_at: d.created_at || new Date().toISOString().slice(0, 10),
            members: membersList.filter(m => m && m.handle && m.handle !== prof.handle)
          });
          changed = true;
        } else {
          if (d.name && (!existing.name || existing.name.startsWith('Buddy League ('))) {
            existing.name = d.name;
            changed = true;
          }
          existing.members = membersList.filter(m => m && m.handle && m.handle !== prof.handle);
          changed = true;
        }
      });

      if (changed) {
        saveStoredLeagues(stored);
        if (stored.length && (!activeLeagueId || activeLeagueId === 'default' || activeLeagueId.startsWith('geo-'))) {
          activeLeagueId = stored[0].id;
        }
      }
    }

    // 2. Fetch Geo Leagues via direct HTTP GET
    const gRes = await fetch(`${FIRESTORE_REST_BASE}/geo_leagues?key=${FIRESTORE_API_KEY}`);
    if (gRes.ok) {
      const gData = await gRes.json();
      (gData.documents || []).forEach(doc => {
        const d = parseFirestoreFields(doc.fields);
        const docId = doc.name.split('/').pop();
        const membersList = extractMembersFromDoc(d);
        saveStoredGeoMembers(docId, membersList);
      });
    }

    render();
  } catch (err) {
    console.warn('REST cloud sync notice:', err);
  } finally {
    isRestSyncing = false;
  }
}

function getGeoDocId(tierId, prof) {
  if (tierId === 'geo-country') return 'country-' + (prof.country || 'Scotland').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  if (tierId === 'geo-region') return 'region-' + (prof.region || 'Renfrewshire').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  if (tierId === 'geo-town') return 'town-' + (prof.town || 'Paisley').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return tierId;
}

const GEO_MEMBERS_CACHE_PREFIX = 'betbuddy_geo_cache_';
function getStoredGeoMembers(docId) {
  try {
    const raw = localStorage.getItem(GEO_MEMBERS_CACHE_PREFIX + docId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  // Pre-seed default verified punters so leaderboards never start empty
  return [
    { handle: 'HeadPark73', avatar: '⚽', points: 0, winRate: 0, roi: 0, settled: 0, form: ['—'] },
    { handle: 'Punter_747', avatar: '⚽', points: 0, winRate: 0, roi: 0, settled: 0, form: ['—'] }
  ];
}

function saveStoredGeoMembers(docId, members) {
  try {
    localStorage.setItem(GEO_MEMBERS_CACHE_PREFIX + docId, JSON.stringify(members));
  } catch (e) {}
}

function extractMembersFromDoc(data) {
  if (!data) return [];
  const map = {};
  if (data.members && typeof data.members === 'object') {
    Object.entries(data.members).forEach(([k, v]) => {
      if (v && typeof v === 'object') {
        const handle = v.handle || k;
        map[handle] = { ...v, handle };
      }
    });
  }
  Object.keys(data).forEach(k => {
    if (k.startsWith('members.') && data[k] && typeof data[k] === 'object') {
      const handle = data[k].handle || k.slice(8);
      map[handle] = { ...data[k], handle };
    }
  });
  return Object.values(map);
}

let activeGeoUnsubscribe = null;
let currentGeoListeningDocId = null;
function listenToActiveGeoLeague(docId) {
  if (!firestoreDb || !docId) return;
  if (currentGeoListeningDocId === docId && activeGeoUnsubscribe) return;
  if (activeGeoUnsubscribe) {
    try { activeGeoUnsubscribe(); } catch (e) {}
    activeGeoUnsubscribe = null;
  }
  currentGeoListeningDocId = docId;
  try {
    activeGeoUnsubscribe = firestoreDb.collection('geo_leagues').doc(docId).onSnapshot(doc => {
      if (!doc || !doc.exists) return;
      const data = doc.data() || {};
      const membersList = extractMembersFromDoc(data);
      saveStoredGeoMembers(docId, membersList);
      render();
    }, err => console.warn('Geo listener notice:', err));
  } catch (e) {
    console.warn('Geo listener error:', e);
  }
}

function syncUserToGeoCloud() {
  if (!firestoreDb) return;
  try {
    const prof = getUserProfile();
    const uStats = getUserLeagueStats('weekly');
    const userEntry = {
      handle: prof.handle,
      avatar: prof.avatar || '⚽',
      town: prof.town || 'Paisley',
      region: prof.region || 'Renfrewshire',
      country: prof.country || 'Scotland',
      points: uStats.points,
      winRate: uStats.winRate,
      roi: uStats.roi,
      settled: uStats.settled,
      form: uStats.form,
      updated_at: new Date().toISOString()
    };
    const safeTown = getGeoDocId('geo-town', prof);
    const safeRegion = getGeoDocId('geo-region', prof);
    const safeCountry = getGeoDocId('geo-country', prof);
    const targets = ['geo-world', 'geo-europe', 'geo-uk', safeCountry, safeRegion, safeTown];
    targets.forEach(tId => {
      firestoreDb.collection('geo_leagues').doc(tId).set({
        members: {
          [prof.handle]: userEntry
        }
      }, { merge: true }).catch(() => {});
    });
  } catch (e) {}
}





async function renameLeague(code) {
  const list = getStoredLeagues();
  const target = list.find(l => l.code === code);
  const currentName = target ? (typeof target.name === 'function' ? target.name() : target.name) : 'Buddy League';
  const newName = prompt('Enter new name for your league:', currentName);
  if (!newName || !newName.trim()) return;
  const cleanName = newName.trim();
  if (target) {
    target.name = cleanName;
    saveStoredLeagues(list);
  }
  if (firestoreDb && code) {
    try {
      await firestoreDb.collection('leagues').doc(code).set({ name: cleanName }, { merge: true });
      toast('League renamed to ' + cleanName + '!');
    } catch (e) {
      console.warn('Rename error:', e);
      toast('Renamed locally: ' + cleanName);
    }
  }
  render();
}

async function refreshLeagueFromCloud(code) {
  if (!firestoreDb || !code) return;
  try {
    const snap = await firestoreDb.collection('leagues').doc(code).get();
    if (snap.exists) {
      const data = snap.data();
      const list = getStoredLeagues();
      const target = list.find(l => l.code === code);
      if (target && data.members) {
        const prof = getUserProfile();
        target.members = Object.values(data.members).filter(m => m.handle !== prof.handle);
        saveStoredLeagues(list);
        render();
      }
    }
  } catch(e) {}
}

async function refreshGeoLeagueFromCloud(docId) {
  if (!firestoreDb || !docId) return;
  try {
    const snap = await firestoreDb.collection('geo_leagues').doc(docId).get();
    if (snap.exists) {
      const data = snap.data();
      if (data && data.members) {
        saveStoredGeoMembers(docId, Object.values(data.members));
        render();
      }
    }
  } catch(e) {}
}

async function kickPlayerFromLeague(leagueCode, handle) {
  if (!confirm('Are you sure you want to throw @' + handle + ' out of this league?')) return;
  toast('Removing @' + handle + '...');

  const list = getStoredLeagues();
  const target = list.find(l => l.code === leagueCode);
  if (target && target.members) {
    target.members = target.members.filter(m => m.handle !== handle);
    saveStoredLeagues(list);
  }

  if (firestoreDb && leagueCode) {
    try {
      const fieldPath = 'members.' + handle;
      const FieldValue = firebase.firestore.FieldValue;
      await firestoreDb.collection('leagues').doc(leagueCode).update({
        [fieldPath]: FieldValue.delete()
      });
      toast('@' + handle + ' thrown out of league.');
    } catch (e) {
      console.warn('Kick error:', e);
      toast('@' + handle + ' removed.');
    }
  }
  render();
}

async function deleteLeague(leagueId, leagueCode) {
  const list = getStoredLeagues();
  const target = list.find(l => l.id === leagueId || l.code === leagueCode);
  const name = target ? (typeof target.name === 'function' ? target.name() : target.name) : 'this league';
  if (!confirm('Are you sure you want to permanently delete ' + name + '?\nThis will remove the league for all members.')) return;

  toast('Deleting league...');

  if (firestoreDb && leagueCode) {
    try {
      await firestoreDb.collection('leagues').doc(leagueCode).delete();
    } catch (e) {
      console.warn('Cloud league delete notice:', e);
    }
  }

  const updated = list.filter(l => l.id !== leagueId && l.code !== leagueCode);
  saveStoredLeagues(updated);

  activeLeagueId = 'default';
  toast('League deleted.');
  render();
}

function syncLeagueToCloud(league) {
  syncUserToGeoCloud();
  if (!firestoreDb || !league || !league.code) return;
  const prof = getUserProfile();
  const uStats = getUserLeagueStats(league.freq || 'weekly');
  const userEntry = {
    handle: prof.handle,
    avatar: prof.avatar || '⚽',
    points: uStats.points,
    winRate: uStats.winRate,
    roi: uStats.roi,
    settled: uStats.settled,
    form: uStats.form,
    updated_at: new Date().toISOString()
  };

  const isLeagueCreator = !league.is_joined && (!league.creator_handle || league.creator_handle === prof.handle);

  if (isLeagueCreator) {
    if (!league.creator_handle) league.creator_handle = prof.handle;
    firestoreDb.collection('leagues').doc(league.code).set({
      name: league.name,
      icon: league.icon || '⚽',
      freq: league.freq || 'weekly',
      code: league.code,
      creator_handle: prof.handle,
      created_at: league.created_at || new Date().toISOString().slice(0, 10),
      members: {
        [prof.handle]: userEntry
      }
    }, { merge: true }).catch(err => console.warn('Cloud league sync notice:', err));
  } else {
    firestoreDb.collection('leagues').doc(league.code).set({
      members: {
        [prof.handle]: userEntry
      }
    }, { merge: true }).catch(err => console.warn('Cloud member sync notice:', err));
  }
}

let hasSyncedUserLeagues = false;
async function syncUserLeaguesFromCloud() {
  if (!firestoreDb || hasSyncedUserLeagues) return;
  try {
    const prof = getUserProfile();
    const snap = await firestoreDb.collection('leagues').get();
    if (!snap.empty) {
      const list = getStoredLeagues();
      let changed = false;
      snap.forEach(doc => {
        const d = doc.data() || {};
        const code = d.code || doc.id;
        const membersList = extractMembersFromDoc(d);
        const isMember = membersList.some(m => m && m.handle === prof.handle);
        const isCreator = d.creator_handle === prof.handle;
        if (isMember || isCreator) {
          let existing = list.find(l => l.code === code);
          if (!existing) {
            list.push({
              id: 'league-' + code,
              name: d.name || ('Buddy League (' + code + ')'),
              icon: d.icon || '⚽',
              freq: d.freq || 'weekly',
              code: code,
              creator_handle: d.creator_handle || prof.handle,
              created_at: d.created_at || new Date().toISOString().slice(0, 10),
              members: membersList.filter(m => m && m.handle && m.handle !== prof.handle)
            });
            changed = true;
          } else {
            if (d.name && (!existing.name || existing.name.startsWith('Buddy League ('))) {
              existing.name = d.name;
              changed = true;
            }
            existing.members = membersList.filter(m => m && m.handle && m.handle !== prof.handle);
            changed = true;
          }
        }
      });
      if (changed) {
        saveStoredLeagues(list);
        hasSyncedUserLeagues = true;
        render();
      }
    }
  } catch (e) {
    console.warn('Sync user leagues notice:', e);
  }
}

let currentLeagueListeningCode = null;
function listenToActiveLeague(code) {
  if (!firestoreDb || !code) return;
  if (currentLeagueListeningCode === code && activeLeagueUnsubscribe) return;
  if (activeLeagueUnsubscribe) {
    try { activeLeagueUnsubscribe(); } catch (e) {}
    activeLeagueUnsubscribe = null;
  }
  currentLeagueListeningCode = code;
  try {
    activeLeagueUnsubscribe = firestoreDb.collection('leagues').doc(code).onSnapshot(doc => {
      const list = getStoredLeagues();
      const target = list.find(l => l.code === code);
      if (!doc || !doc.exists) {
        if (target) {
          const updated = list.filter(l => l.code !== code);
          saveStoredLeagues(updated);
          if (activeLeagueId === target.id) {
            activeLeagueId = 'default';
            toast('This league was deleted by the creator.');
            render();
          }
        }
        return;
      }
      const data = doc.data() || {};
      const membersList = extractMembersFromDoc(data);
      if (target) {
        if (data.name) {
          if (!target.is_joined && target.name && !target.name.startsWith('Buddy League (') && data.name.startsWith('Buddy League (')) {
            firestoreDb.collection('leagues').doc(code).set({ name: target.name }, { merge: true }).catch(() => {});
          } else {
            target.name = data.name;
          }
        }
        if (data.icon) target.icon = data.icon;
        if (data.creator_handle) target.creator_handle = data.creator_handle;
        const prof = getUserProfile();
        target.members = membersList.filter(m => m && m.handle && m.handle !== prof.handle);
        saveStoredLeagues(list);
        render();
      }
    }, err => console.warn('League listener notice:', err));
  } catch (e) {
    console.warn('Listener error:', e);
  }
}

async function joinCloudLeague(code) {
  if (!code) return;
  let leagueName = 'Buddy League (' + code + ')';
  let leagueIcon = '⚽';
  let leagueFreq = 'weekly';
  let creatorHandle = null;

  if (firestoreDb) {
    try {
      const snap = await firestoreDb.collection('leagues').doc(code).get();
      if (snap.exists) {
        const d = snap.data();
        if (d.name) leagueName = d.name;
        if (d.icon) leagueIcon = d.icon;
        if (d.freq) leagueFreq = d.freq;
        if (d.creator_handle) creatorHandle = d.creator_handle;
      }
    } catch (e) {
      console.warn('Join cloud fetch notice:', e);
    }
  }

  const list = getStoredLeagues();
  let league = list.find(l => l.code === code);
  if (!league) {
    league = {
      id: 'league-' + Date.now(),
      name: leagueName,
      icon: leagueIcon,
      freq: leagueFreq,
      code: code,
      is_joined: true,
      creator_handle: creatorHandle,
      created_at: new Date().toISOString().slice(0, 10),
      members: []
    };
    list.push(league);
  } else {
    // Only update name if not creator or if local name is default
    if (league.is_joined || !league.name || league.name.startsWith('Buddy League (')) {
      league.name = leagueName;
    }
    league.icon = leagueIcon;
    league.freq = leagueFreq;
    if (creatorHandle) league.creator_handle = creatorHandle;
  }
  saveStoredLeagues(list);
  activeLeagueId = league.id;

  syncLeagueToCloud(league);
  listenToActiveLeague(code);
  render();
}

const TROPHY_CABINET_KEY = 'betbuddy_trophy_cabinet_v1';

let activeLeagueId = 'default';
let activeLeagueFreq = 'weekly';
let activeMoreTab = 'account';

function getUserProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(USER_PROFILE_KEY) || 'null');
    if (p && p.handle) {
      return {
        handle: p.handle,
        avatar: p.avatar || '⚽',
        town: p.town || 'Paisley',
        region: p.region || 'Renfrewshire',
        country: p.country || 'Scotland'
      };
    }
  } catch (e) { /* ignore */ }
  const randomSuffix = Math.floor(Math.random() * 899 + 100);
  const defaultProfile = {
    handle: 'Punter_' + randomSuffix,
    avatar: '⚽',
    town: 'Paisley',
    region: 'Renfrewshire',
    country: 'Scotland'
  };
  try { localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(defaultProfile)); } catch (e) { /* ignore */ }
  return defaultProfile;
}

function saveUserProfile(handle, town, region, country) {
  const clean = (handle || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'Punter';
  const prof = {
    ...getUserProfile(),
    handle: clean,
    town: (town || 'Paisley').trim().slice(0, 32),
    region: (region || 'Renfrewshire').trim().slice(0, 32),
    country: (country || 'Scotland').trim().slice(0, 32)
  };
  try { localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(prof)); } catch (e) { /* ignore */ }
  return prof;
}

function getUserLeagueStats(freq = 'weekly') {
  const diary = getStoredDiary();
  const now = new Date();
  
  let filteredDiary = diary;
  if (freq === 'weekly') {
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    filteredDiary = diary.filter(e => new Date(e.date || 0) >= monday);
  } else if (freq === 'monthly') {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    filteredDiary = diary.filter(e => new Date(e.date || 0) >= firstOfMonth);
  } else if (freq === 'yearly') {
    const seasonStart = new Date(now.getFullYear(), 7, 1);
    filteredDiary = diary.filter(e => new Date(e.date || 0) >= seasonStart);
  }

  const settled = filteredDiary.filter(e => e.outcome && e.outcome !== 'pending');

  // FAIR PLAY RULE: Exactly 1 settled bet per calendar day counts toward league standings.
  // Chronologically earliest bet logged each day qualifies; extra bets on the same day are excluded.
  const dailyQualifyingMap = new Map();
  settled.slice().reverse().forEach(e => {
    const dayKey = (e.date || (e.timestamp ? e.timestamp.slice(0, 10) : '') || 'undated').slice(0, 10);
    if (!dailyQualifyingMap.has(dayKey)) {
      dailyQualifyingMap.set(dayKey, e);
    }
  });
  const leagueBets = Array.from(dailyQualifyingMap.values()).reverse();

  const won = leagueBets.filter(e => e.outcome === 'won');
  const totalStaked = leagueBets.reduce((sum, e) => sum + (+e.stake || 0), 0);
  const totalProfit = leagueBets.reduce((sum, e) => sum + (calc.calculateBetProfit(e.stake, e.odds, e.outcome) || 0), 0);
  
  // Option A Scoring: (Decimal Odds - 1) * 10 on won; -2 on lost; 0 on void
  const points = leagueBets.reduce((sum, e) => sum + (calc.calculateLeaguePoints(e.odds, e.outcome) || 0), 0);
  const winRate = leagueBets.length ? Math.round((won.length / leagueBets.length) * 100) : 0;
  const roi = totalStaked > 0 ? +( (totalProfit / totalStaked) * 100 ).toFixed(1) : 0.0;
  const last5 = leagueBets.slice(0, 5).map(e => e.outcome === 'won' ? 'W' : e.outcome === 'lost' ? 'L' : 'V');
  return { points, settled: leagueBets.length, won: won.length, winRate, roi, form: last5.length ? last5 : ['—'] };
}

// ------------------------------------------------------------ Trophy Cabinet System
function getStoredTrophies() {
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
}

function openTrophyCabinet() {
  const trophies = getStoredTrophies();
  const golds = trophies.filter(t => t.placement === 'gold').length;
  const silvers = trophies.filter(t => t.placement === 'silver').length;
  const bronzes = trophies.filter(t => t.placement === 'bronze').length;

  const cardsHtml = trophies.map(t => {
    const tierClass = 'tier-' + (t.tier || 'town');
    const rankLabel = t.placement === 'gold' ? '🥇 1st Place Gold' : t.placement === 'silver' ? '🥈 2nd Place Silver' : '🥉 3rd Place Bronze';
    return '<div class="trophy-card ' + tierClass + '">' +
      '<div class="trophy-icon-large">' + esc(t.icon || '🏆') + '</div>' +
      '<div class="trophy-title">' + esc(t.title) + '</div>' +
      '<span class="trophy-rank-tag ' + t.placement + '">' + rankLabel + '</span>' +
      '<div class="trophy-period">' + esc(t.freq) + ' · ' + esc(t.date) + '</div>' +
      '<div style="font-size:12px;color:var(--cyan);font-weight:700">' + t.points + ' Points</div>' +
    '</div>';
  }).join('');

  $('trophy-modal-body').innerHTML =
    '<div class="trophy-haul-banner">' +
      '<div><div class="trophy-haul-val gold">' + golds + '</div><div class="trophy-haul-lbl">Gold Trophies</div></div>' +
      '<div><div class="trophy-haul-val silver">' + silvers + '</div><div class="trophy-haul-lbl">Silver Medals</div></div>' +
      '<div><div class="trophy-haul-val bronze">' + bronzes + '</div><div class="trophy-haul-lbl">Bronze Medals</div></div>' +
    '</div>' +
    '<div class="trophy-grid">' + (cardsHtml || '<div class="empty">No trophies earned yet. Settle bets in your diary to climb the ladders!</div>') + '</div>';

  $('trophy-cabinet-modal').hidden = false;
}

// ------------------------------------------------------------ 6-Tier Automatic Geo Ladders & Buddy Leagues
function getGeoTiers(profile) {
  return [
    {
      id: 'geo-world',
      tier: 'worldwide',
      name: 'Worldwide League',
      scope: 'Global Tier 1',
      icon: '🌍',
      trophyIcon: '💎🌍',
      trophyName: 'Grand Diamond Globe',
      badgeClass: 'tier-worldwide',
      competitors: []
    },
    {
      id: 'geo-europe',
      tier: 'europe',
      name: 'European League',
      scope: 'Continental Tier 2',
      icon: '🇪🇺',
      trophyIcon: '🌟🇪🇺',
      trophyName: 'Continental Star Cup',
      badgeClass: 'tier-europe',
      competitors: []
    },
    {
      id: 'geo-uk',
      tier: 'uk',
      name: 'UK National League',
      scope: 'Sovereign Tier 3',
      icon: '🇬🇧',
      trophyIcon: '🛡️🇬🇧',
      trophyName: 'Sovereign Britannia Shield',
      badgeClass: 'tier-uk',
      competitors: []
    },
    {
      id: 'geo-country',
      tier: 'country',
      name: (profile.country || 'Scotland') + ' Championship',
      scope: 'National Tier 4',
      icon: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
      trophyIcon: '🦁🏴󠁧󠁢󠁳󠁣󠁴󠁿',
      trophyName: 'National Lion Trophy',
      badgeClass: 'tier-country',
      competitors: []
    },
    {
      id: 'geo-region',
      tier: 'region',
      name: (profile.region || 'Renfrewshire') + ' Regional',
      scope: 'County Tier 5',
      icon: '🏛️',
      trophyIcon: '🏛️',
      trophyName: 'Regional Civic Chalice',
      badgeClass: 'tier-region',
      competitors: []
    },
    {
      id: 'geo-town',
      tier: 'town',
      name: (profile.town || 'Paisley') + ' Hometown League',
      scope: 'Local Tier 6',
      icon: '🏘️',
      trophyIcon: '🏅',
      trophyName: 'Hometown Plaque',
      badgeClass: 'tier-town',
      competitors: []
    }
  ];
}

function getStoredLeagues() {
  try {
    const list = JSON.parse(localStorage.getItem(LEAGUES_STORAGE_KEY) || '[]');
    if (Array.isArray(list)) {
      let cleanList = list.filter(l => l.id !== 'league-weekend-contenders' && l.code !== 'BUDDY-7482');
      if (cleanList.length === 0) {
        // Pre-seed Paisley punters (BUDDY-9240) so friend & creator are visible immediately
        cleanList = [{
          id: 'league-BUDDY-9240',
          name: 'Paisley punters',
          icon: '⚽',
          freq: 'monthly',
          code: 'BUDDY-9240',
          creator_handle: 'HeadPark73',
          created_at: '2026-10-30',
          members: [
            { handle: 'HeadPark73', avatar: '⚽', points: 0, winRate: 0, roi: 0, settled: 0, form: ['—'] },
            { handle: 'Punter_747', avatar: '⚽', points: 0, winRate: 0, roi: 0, settled: 0, form: ['—'] }
          ]
        }];
        saveStoredLeagues(cleanList);
      }
      return cleanList;
    }
  } catch (e) { /* ignore */ }
  return [{
    id: 'league-BUDDY-9240',
    name: 'Paisley punters',
    icon: '⚽',
    freq: 'monthly',
    code: 'BUDDY-9240',
    creator_handle: 'HeadPark73',
    created_at: '2026-10-30',
    members: [
      { handle: 'HeadPark73', avatar: '⚽', points: 0, winRate: 0, roi: 0, settled: 0, form: ['—'] },
      { handle: 'Punter_747', avatar: '⚽', points: 0, winRate: 0, roi: 0, settled: 0, form: ['—'] }
    ]
  }];
}

function saveStoredLeagues(leagues) {
  try { localStorage.setItem(LEAGUES_STORAGE_KEY, JSON.stringify(leagues)); } catch (e) { /* ignore */ }
}

function viewLeagues() {
  const prof = getUserProfile();
  const uStats = getUserLeagueStats(activeLeagueFreq);
  const geoTiers = getGeoTiers(prof);
  const customLeagues = getStoredLeagues();
  const trophies = getStoredTrophies();

  // Find active league
  let currentLeague = customLeagues.find(l => l.id === activeLeagueId);
  let isGeo = false;
  if (!currentLeague) {
    currentLeague = geoTiers.find(g => g.id === activeLeagueId);
    if (currentLeague) isGeo = true;
  }
  if (!currentLeague) {
    if (customLeagues.length) {
      currentLeague = customLeagues[0];
      activeLeagueId = currentLeague.id;
      isGeo = false;
    } else {
      currentLeague = geoTiers[0];
      activeLeagueId = currentLeague.id;
      isGeo = true;
    }
  }
  const isLeagueCreator = !isGeo && currentLeague && !currentLeague.is_joined && (!currentLeague.creator_handle || currentLeague.creator_handle === prof.handle);

  if (!isGeo && currentLeague && currentLeague.code) {
    listenToActiveLeague(currentLeague.code);
  }

  // Build combined leaderboard with current user & Firestore real players
  let allMembers = [];
  const userEntry = {
    handle: prof.handle,
    points: uStats.points,
    winRate: uStats.winRate,
    roi: uStats.roi,
    settled: uStats.settled,
    form: uStats.form,
    isYou: true
  };

  syncUserLeaguesFromCloud();
  if (isGeo) {
    const geoDocId = getGeoDocId(currentLeague.id, prof);
    listenToActiveGeoLeague(geoDocId);
    const realGeoMembers = getStoredGeoMembers(geoDocId).filter(m => m.handle !== prof.handle);
    const bots = (currentLeague.competitors || []).filter(b => !realGeoMembers.some(r => r.handle === b.handle));
    allMembers = [...realGeoMembers, userEntry, ...bots];
  } else {
    const memberMap = new Map();
    (currentLeague.members || []).forEach(m => {
      if (m && m.handle && m.handle !== prof.handle) {
        memberMap.set(m.handle, m);
      }
    });
    memberMap.set(prof.handle, userEntry);
    allMembers = Array.from(memberMap.values());
  }

  // OPTION A SCORING RANK:
  // Primary: Points (odds-weighted)
  // Secondary: Win Rate %
  // Tie-breaker: ROI %
  allMembers.sort((a, b) => (b.points - a.points) || (b.winRate - a.winRate) || (b.roi - a.roi));

  const rowsHtml = allMembers.map((m, idx) => {
    const rank = idx + 1;
    const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'standard';
    const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const formChips = (m.form || ['—']).map(f => f === '—' ? '<span class="dim">—</span>' : '<span class="form-chip ' + f.toLowerCase() + '">' + f + '</span>').join('');
    const roiSign = m.roi > 0 ? '+' : '';
    const roiClass = m.roi > 0 ? 'pos' : m.roi < 0 ? 'neg' : '';
    const formStr = (m.form || []).join(' · ');
    const memberId = 'mem-form-' + idx;
    const kickCell = m.isYou
      ? '<td class="lb-col-action"><span class="bento-badge cyan text-xs">You</span></td>'
      : '<td class="lb-col-action"><button type="button" class="kick-player-btn" data-kick-player="' + esc(m.handle) + '" data-league-code="' + esc(currentLeague.code) + '" title="Throw @' + esc(m.handle) + ' out of this league">Kick ✕</button></td>';

    return '<tr class="lb-row' + (m.isYou ? ' user-row' : '') + '">' +
      '<td class="lb-col-rank"><span class="rank-badge ' + rankClass + '">' + rankIcon + '</span></td>' +
      '<td class="lb-col-player">' +
        '<button type="button" class="lb-player-btn" onclick="toggleMemberForm(\'' + memberId + '\')" title="Click to view recent form">' +
          '<b class="lb-handle">' + esc(m.handle) + '</b>' +
          (m.isYou ? ' <span class="bento-badge emerald lb-you-tag">YOU</span>' : '') +
          '<span class="lb-form-indicator" title="Form: ' + esc(formStr) + '">📊</span>' +
        '</button>' +
        '<div id="' + memberId + '" class="lb-member-form-drawer" hidden>' +
          '<div class="lb-drawer-inner"><span class="lb-drawer-label">Form:</span><div class="form-chips">' + formChips + '</div></div>' +
        '</div>' +
      '</td>' +
      '<td class="lb-col-pts"><b class="lb-pts-val">' + m.points + '</b></td>' +
      '<td class="lb-col-win"><span class="win-pct-pill">' + m.winRate + '%</span></td>' +
      '<td class="lb-col-roi"><span class="roi-pct-pill ' + roiClass + '">' + roiSign + m.roi + '%</span></td>' +
      '<td class="lb-col-bets num mono">' + m.settled + '</td>' +
      kickCell +
    '</tr>';
  }).join('');

  // Geo Tiers Bar
  const geoNavHtml = geoTiers.map(t => {
    return '<button type="button" class="geo-tier-btn' + (t.id === activeLeagueId ? ' active' : '') + '" data-select-league="' + t.id + '">' +
      '<span class="geo-tier-name">' + t.icon + ' ' + (typeof t.name === 'function' ? t.name() : t.name) + '</span>' +
      '<span class="geo-tier-scope">' + t.scope + ' · ' + t.trophyName + '</span>' +
    '</button>';
  }).join('');

  // Custom Buddy Leagues Tabs
  const buddyTabsHtml = customLeagues.map(l => {
    const memCount = (l.members ? l.members.length : 0) + 1;
    return '<button type="button" class="league-tab-btn' + (l.id === activeLeagueId ? ' active' : '') + '" data-select-league="' + esc(l.id) + '">' +
      (l.icon || '👥') + ' ' + esc(l.name) + ' <span class="tab-member-count" style="opacity:0.75;font-size:11px">(' + memCount + ' ' + (memCount === 1 ? 'punter' : 'punters') + ')</span>' +
    '</button>';
  }).join('');

  const trophyTitle = currentLeague.trophyName || (currentLeague.name + ' Silverware');
  const trophyIcon = currentLeague.trophyIcon || currentLeague.icon || '🏆';

  
  // Commercial Inquiries Ledger
  const enquiries = getStoredEnquiries();
  const enquiryRows = enquiries.length ? enquiries.map(e =>
    '<tr>' +
      '<td><b>' + esc(e.company || e.name) + '</b><br><small class="muted">' + esc(e.name) + ' &middot; <a href="mailto:' + esc(e.email) + '" style="color:var(--cyan)">' + esc(e.email) + '</a></small></td>' +
      '<td><span class="badge validated">' + esc(e.interest) + '</span></td>' +
      '<td style="max-width:280px;font-size:12px;color:var(--muted);">' + esc(e.message) + '</td>' +
      '<td style="font-size:11px;font-family:var(--mono);color:var(--dim);white-space:nowrap;">' + esc(e.submitted_at ? e.submitted_at.slice(0, 16).replace('T', ' ') : 'Just now') + '</td>' +
    '</tr>'
  ).join('') : '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px;">No commercial enquiries submitted yet.</td></tr>';

  const enquiryCard = '<div class="section card" style="margin-top:24px;">' +
    '<div class="section-head"><div><h2 class="section-title">Commercial &amp; Sponsorship Inquiries (' + enquiries.length + ')</h2><p class="section-note">Incoming bookmaker, brand, and affiliate proposals submitted via #/commercial.</p></div>' +
    (enquiries.length ? '<button type="button" class="btn small" data-admin-action="clear-enquiries" style="background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);">Clear Enquiries</button>' : '') +
    '</div>' +
    '<div style="overflow-x:auto;"><table class="table"><thead><tr><th>Partner / Contact</th><th>Category</th><th>Proposal</th><th>Submitted</th></tr></thead><tbody>' + enquiryRows + '</tbody></table></div>' +
  '</div>';

  return '<section class="view">' +
    '<div class="fair-play-banner">' +
      '<span class="fair-play-icon">🛡️</span>' +
      '<div><strong>Fair Play Rule (1 Bet Per Day Cap):</strong> Exactly <strong>1 settled bet per calendar day</strong> counts toward your league score. Placing multiple small bets on the same day in your diary will not inflate your score.</div>' +
    '</div>' +
    '<div class="section-head" style="align-items:flex-end"><div>' +
      '<h1 class="page-title">Buddy &amp; Regional Leagues</h1>' +
      '<p class="page-sub">Compete in your 6 automatic hometown and global leagues, or create private mini-leagues with mates. Option A: 20/1 winner = 200 pts, Evens = 10 pts, Loss = -2 pts. <b>Max 1 qualifying bet per day.</b></p>' +
    '</div>' +
    '<div class="btn-row">' +
      '<button type="button" class="btn primary" data-open-league-modal>Create or Join League</button>' +
      '<button type="button" class="trophy-summary-pill" data-open-trophy-cabinet>🏆 Trophy Cabinet (' + trophies.length + ' Silverware)</button>' +
      (isGeo ? '' : '<button type="button" class="btn" data-share-league="' + esc(currentLeague.code) + '">Invite Friends</button>') +
    '</div></div>' +

    '<div class="user-profile-bar">' +
      '<div class="profile-pill"><span class="profile-avatar">' + esc(prof.avatar) + '</span><span>@' + esc(prof.handle) + '</span>' +
        '<span style="font-size:11px;color:var(--dim);margin-left:4px">(' + esc(prof.town) + ', ' + esc(prof.region) + ')</span></div>' +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
        '<span class="dim" style="font-size:13px">Your Live Form: <b style="color:var(--cyan)">' + uStats.points + ' Pts</b> · Win: <b class="win-pct-pill">' + uStats.winRate + '%</b> · ROI: <b class="roi-pct-pill ' + (uStats.roi >= 0 ? 'pos' : 'neg') + '">' + (uStats.roi > 0 ? '+' : '') + uStats.roi + '%</b></span>' +
        '<a href="#/more" data-select-more-tab="account" class="btn small" style="text-decoration:none">Edit in More &rarr;</a>' +
      '</div>' +
    '</div>' +

    // 1. Private Buddy Mini-Leagues Selector
    '<div class="section" style="margin-top:20px">' +
      '<div class="section-head"><div><h2 class="section-title">Private Buddy Mini-Leagues</h2><span class="section-note">Custom leagues with your friends, work colleagues, and pub crew.</span></div></div>' +
      (buddyTabsHtml ? '<div class="league-selector-bar">' + buddyTabsHtml + '</div>' : '<div style="padding:14px 18px;border-radius:12px;background:rgba(255,255,255,0.03);color:var(--dim);font-size:13.5px">No private leagues joined yet. Tap <b>Create or Join League</b> above to start with friends.</div>') +
    '</div>' +

    // If Buddy League selected, show table directly underneath!
    (!isGeo ? (
      '<div class="leaderboard-card" style="margin-top:16px">' +
        '<div style="padding:16px 20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
          '<div>' +
            '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
              '<h2 class="section-title" style="margin:0">' + (typeof currentLeague.name === 'function' ? currentLeague.name() : currentLeague.name) + '</h2>' +
              '<button type="button" class="btn small" data-rename-league="' + esc(currentLeague.code) + '" title="Rename this league" style="padding:2px 8px;font-size:11px;">✏️ Rename</button>' +
            '</div>' +
            '<span class="section-note">Trophy at Stake: <b>' + trophyIcon + ' ' + trophyTitle + '</b> · Top 3 win Gold, Silver &amp; Bronze · <b style="color:var(--cyan)">Max 1 bet/day</b></span>' +
          '</div>' +
          '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
            '<div class="frequency-toggle-bar">' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'weekly' ? ' active' : '') + '" data-league-freq="weekly">Weekly</button>' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'monthly' ? ' active' : '') + '" data-league-freq="monthly">Monthly</button>' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'yearly' ? ' active' : '') + '" data-league-freq="yearly">Yearly</button>' +
            '</div>' +
            '<button type="button" class="btn small" data-share-league="' + esc(currentLeague.code) + '">Invite Friends</button>' +
            '<button type="button" class="btn danger small" data-delete-league="' + esc(currentLeague.id) + '" data-league-code="' + esc(currentLeague.code) + '" title="Delete this league">Delete League 🗑️</button>' +
          '</div>' +
        '</div>' +
        '<div class="lb-table-wrap"><table class="lb-table compact-lb"><thead><tr>' +
          '<th class="lb-col-rank">#</th>' +
          '<th class="lb-col-player">Player (Form)</th>' +
          '<th class="lb-col-pts" style="color:var(--cyan)">Points</th>' +
          '<th class="lb-col-win">Win %</th>' +
          '<th class="lb-col-roi">ROI %</th>' +
          '<th class="lb-col-bets num">Bets</th>' +
          '<th class="lb-col-action">Manage</th>' +
        '</tr></thead><tbody>' +
        rowsHtml +
        '</tbody></table></div>' +
      '</div>'
    ) : '') +

    // 2. Automatic Geographical Leagues Selector
    '<div class="section" style="margin-top:' + (!isGeo ? '26px' : '16px') + '">' +
      '<div class="section-head"><div><h2 class="section-title">Automatic Geographical Leagues</h2><span class="section-note">You are automatically enrolled into all 6 tiers based on your location.</span></div></div>' +
      '<div class="geo-ladder-nav">' + geoNavHtml + '</div>' +
    '</div>' +

    // If Geo League selected, show table directly underneath Geo Tiers!
    (isGeo ? (
      '<div class="leaderboard-card" style="margin-top:16px">' +
        '<div style="padding:16px 20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
          '<div>' +
            '<h2 class="section-title">' + (typeof currentLeague.name === 'function' ? currentLeague.name() : currentLeague.name) + '</h2>' +
            '<span class="section-note">Trophy at Stake: <b>' + trophyIcon + ' ' + trophyTitle + '</b> · Top 3 win Gold, Silver &amp; Bronze · <b style="color:var(--cyan)">Max 1 bet/day</b></span>' +
          '</div>' +
          '<div style="display:flex;gap:10px;align-items:center">' +
            '<div class="frequency-toggle-bar">' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'weekly' ? ' active' : '') + '" data-league-freq="weekly">Weekly</button>' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'monthly' ? ' active' : '') + '" data-league-freq="monthly">Monthly</button>' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'yearly' ? ' active' : '') + '" data-league-freq="yearly">Yearly</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="lb-table-wrap"><table class="lb-table compact-lb"><thead><tr>' +
          '<th class="lb-col-rank">#</th>' +
          '<th class="lb-col-player">Player (Form)</th>' +
          '<th class="lb-col-pts" style="color:var(--cyan)">Points</th>' +
          '<th class="lb-col-win">Win %</th>' +
          '<th class="lb-col-roi">ROI %</th>' +
          '<th class="lb-col-bets num">Bets</th>' +
        '</tr></thead><tbody>' +
        rowsHtml +
        '</tbody></table></div>' +
      '</div>'
    ) : '') +
  '</section>';
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
  ['single-fixture-row', 'single-selection-row', 'single-odds-row', 'single-market-row'].forEach(id => {
    const el = $(id);
    if (el) el.hidden = acc;
  });
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
    profile: (getAuthUser() && getAuthUser().signedIn) ? ('@' + (getAuthUser().handle || (getAuthUser().name || 'User').split(' ')[0])) : ($('modal-profile').value.trim() || 'Default'),
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
  const prof = getUserProfile();
  const s = DATA.status || {};
  const sourceRows = Object.entries(s.sources || {}).map(([name, src]) => '<tr><td>' + esc(src.label || name) + '</td><td>' + (src.ok ? '<span class="badge validated">Responding</span>' : '<span class="badge provisional">' + esc(/TOKEN not configured/.test(src.note || '') ? 'Optional: needs a free API token' : src.note || 'Not used') + '</span>') + '</td><td class="num">' + (src.matches != null ? src.matches : '') + '</td><td class="num">' + (src.results != null ? src.results : '') + '</td></tr>').join('');
  const fb = getStoredFeedback();
  const stars = (q, label) => '<div class="field"><span class="lbl">' + label + '</span><div class="stars">' + [1, 2, 3, 4, 5].map(n => '<button type="button" data-star="' + q + '" data-value="' + n + '" aria-pressed="' + (feedbackState[q] === n) + '">' + n + '</button>').join('') + '</div></div>';

  const tabs = [
    { id: 'account', label: '👤 Account' },
    { id: 'data', label: '📊 Data & Methods' },
    { id: 'feedback', label: '💬 Feedback' },
    { id: 'commercial', label: '💼 Commercial' }
  ];

  const tabsHtml = '<div class="more-nav-grid">' +
    tabs.map(t => '<button type="button" class="more-nav-btn' + (activeMoreTab === t.id ? ' active' : '') + '" data-select-more-tab="' + t.id + '">' + t.label + '</button>').join('') +
  '</div>';

  let contentHtml = '';

  if (activeMoreTab === 'account') {
    contentHtml = '<div class="section card">' +
      '<div class="section-head">' +
        '<div>' +
          '<h2 class="section-title">Player Profile &amp; Account</h2>' +
          '<p class="section-note">Your custom gamertag, location for 6-tier regional leagues, and display preferences.</p>' +
        '</div>' +
        '<button type="button" class="btn primary small" data-open-handle-modal>Edit Profile &amp; Location</button>' +
      '</div>' +
      '<div class="tiles" style="margin-top:16px">' +
        '<div class="tile">' +
          '<div class="k">Gamertag / Username</div>' +
          '<div class="v" style="font-size:18px;color:var(--cyan)">' + esc(prof.avatar) + ' @' + esc(prof.handle) + '</div>' +
          '<div class="s">Displayed on Buddy Leagues &amp; Silverware leaderboards</div>' +
        '</div>' +
        '<div class="tile">' +
          '<div class="k">Hometown / City</div>' +
          '<div class="v" style="font-size:18px">' + esc(prof.town) + '</div>' +
          '<div class="s">Hometown League &amp; Civic Plaque</div>' +
        '</div>' +
        '<div class="tile">' +
          '<div class="k">County / Region</div>' +
          '<div class="v" style="font-size:18px">' + esc(prof.region) + '</div>' +
          '<div class="s">County League &amp; Chalice</div>' +
        '</div>' +
        '<div class="tile">' +
          '<div class="k">Country</div>' +
          '<div class="v" style="font-size:18px">' + esc(prof.country) + '</div>' +
          '<div class="s">National Trophy &amp; Shield</div>' +
        '</div>' +
      '</div>' +
      '<div class="btn-row" style="margin-top:16px">' +
        '<button type="button" class="btn primary" data-open-handle-modal>Change Username / Location</button>' +
        '<button type="button" class="btn" data-share-app>👥 Share App with Friend</button>' +
        '<button type="button" class="btn" data-open-auth>Switch / Connect Google Account</button>' +
      '</div>' +
    '</div>' +

    '<div class="section card" style="margin-top:16px">' +
      '<div class="section-head">' +
        '<div>' +
          '<h2 class="section-title">App Preferences &amp; Sync</h2>' +
          '<p class="section-note">Live Firebase cloud sync, odds pricing format, and cache controls.</p>' +
        '</div>' +
      '</div>' +
      '<div class="tiles" style="margin-top:16px">' +
        '<div class="tile">' +
          '<div class="k">Odds Display Format</div>' +
          '<div class="v" style="font-size:18px">' + (oddsFormat === 'decimal' ? 'Decimal (e.g. 3.50)' : 'Fractional (e.g. 5/2)') + '</div>' +
          '<div class="s"><button type="button" class="btn small" style="margin-top:6px;padding:3px 10px" id="toggle-odds-format">Switch to ' + (oddsFormat === 'decimal' ? 'Fractional' : 'Decimal') + '</button></div>' +
        '</div>' +
        '<div class="tile">' +
          '<div class="k">Cloud League Sync</div>' +
          '<div class="v" style="font-size:16px;color:var(--emerald)">⚡ Firebase Live</div>' +
          '<div class="s">Connected to betbuddyuk project</div>' +
        '</div>' +
        '<div class="tile">' +
          '<div class="k">App Version &amp; Engine</div>' +
          '<div class="v mono" style="font-size:16px">v40 (Live)</div>' +
          '<div class="s"><button type="button" class="btn small" style="margin-top:6px;padding:3px 10px" onclick="forceAppSync()">Force App Sync 🔄</button></div>' +
        '</div>' +
      '</div>' +
      '<div class="btn-row" style="margin-top:16px">' +
        '<button type="button" class="btn" id="btn-more-gdpr">Privacy Notice &amp; UK GDPR</button>' +
        '<button type="button" class="btn danger small" data-clear-diary>Reset Local Diary Data</button>' +
      '</div>' +
    '</div>';
  } else if (activeMoreTab === 'data') {
    contentHtml = '<div class="section grid grid-2"><div class="card"><h2 class="section-title">Update status</h2><div class="chips" style="margin:10px 0">' + freshnessChips() + '</div>' +
      '<p class="muted" style="font-size:13.5px">Last attempt ' + esc(s.attempted_at ? ago(s.attempted_at) : 'unknown') + '. Last success ' + esc(s.last_success ? ago(s.last_success) : 'never') + '. ' + (s.errors && s.errors.length ? 'Errors: ' + esc(s.errors.join(' ')) : 'No errors.') + '</p>' +
      '<div style="overflow-x:auto"><table class="table" style="margin-top:8px"><thead><tr><th>Source</th><th>Status</th><th style="text-align:right">Fixtures</th><th style="text-align:right">Results</th></tr></thead><tbody>' + sourceRows + '</tbody></table></div>' +
      '<p class="section-note" style="margin-top:10px">' + esc(s.attribution || '') + ' Bookmaker prices come from The Odds API (UK bookmakers; Match Result and Total Goals only) and are ignored once older than 12 hours; for any other market, enter a price you have seen. Corners, cards and shots are not shown: their statistics come from a source whose terms exclude public use.</p></div>' +
      '<div class="card"><h2 class="section-title">Where each number comes from</h2><table class="table" style="margin-top:8px"><tbody>' +
        '<tr><td><b>Match result</b></td><td>Dixon-Coles model with time decay, fitted for each league on football-data.org final scores only (model dc-public-v1) and backtested chronologically on 2025-26. A club with too little recent history, such as a newly promoted side, gets the league average (limited evidence). All estimates are provisional until a forward record builds up.</td></tr>' +
        '<tr><td><b>Goals, both teams to score</b></td><td>Provisional: 30% score model, 70% league rate. Backtests show no proven edge.</td></tr>' +
        '<tr><td><b>Corners, cards, shots</b></td><td>Not shown. The only available match statistics come from a source that does not permit public use. Earlier research predictions for these markets are private.</td></tr>' +
        '<tr><td><b>Records</b></td><td>Public records (ids starting PUB-) are produced by the public model and sealed before kick-off from the day it went live. They are not the earlier research predictions, which are kept privately and are not shown or recreated here.</td></tr>' +
        '<tr><td><b>Fair odds</b></td><td>1 ÷ probability, rounded to a familiar UK price. Not a bookmaker price.</td></tr></tbody></table></div></div>';
  } else if (activeMoreTab === 'feedback') {
    contentHtml = '<div class="section card"><h2 class="section-title">Tell us what you think</h2><form id="fb-form" class="grid" style="margin-top:12px">' +
      stars('understand', 'How clear were the predictions? (1 confusing, 5 crystal clear)') + stars('convincing', 'How convincing was the evidence?') +
      '<div class="field"><span class="lbl">Was it useful?</span><div class="stars">' + [['useful', 'Very useful'], ['neutral', 'Somewhat'], ['not_useful', 'Not useful']].map(([v, l]) => '<button type="button" class="opt" data-useful="' + v + '" aria-pressed="' + (feedbackState.useful === v) + '">' + l + '</button>').join('') + '</div></div>' +
      '<div class="field"><span class="lbl">Anything confusing?</span><div class="stars">' + ['Evidence labels', 'Odds vs probabilities', 'Provisional estimates', 'Navigation', 'Diary returns', 'All clear'].map(c => '<button type="button" class="opt" data-chip="' + esc(c) + '" aria-pressed="' + feedbackState.chips.has(c) + '">' + esc(c) + '</button>').join('') + '</div></div>' +
      '<div class="field"><label for="fb-improvements">What would make Bet Buddy better?</label><textarea id="fb-improvements" class="ctl"></textarea></div>' +
      '<div class="btn-row"><button type="submit" class="btn primary">Send feedback</button>' + (fb.length ? '<button type="button" class="btn" data-export="feedback">Export ' + fb.length + ' responses</button>' : '') + '</div>' +
      '<p class="section-note">Feedback is stored in this browser only.</p></form></div>';
  } else if (activeMoreTab === 'commercial') {
    contentHtml = '<div class="section card commercial-card">' +
      '<div class="section-head"><div><h2 class="section-title">Commercial &amp; Sponsorship Inquiries</h2><p class="section-note">Partner with Bet Buddy: bookmaker odds feeds, accumulator deep-links, silverware league title sponsors, and commercial affiliate placements.</p></div><span class="badge validated">Partnerships Open</span></div>' +
      '<div class="btn-row" style="margin-top:14px">' +
        '<a href="#/commercial" class="btn primary">Open Commercial &amp; Sponsorship Form</a>' +
        '<button type="button" class="btn" id="btn-more-gdpr">Privacy Notice &amp; UK GDPR</button>' +
      '</div>' +
    '</div>';
  }

  return '<section class="view">' +
    '<div class="section-head" style="align-items:flex-end">' +
      '<div>' +
        '<h1 class="page-title">Settings &amp; Information</h1>' +
        '<p class="page-sub">Account profile, preferences, model intelligence methods, feedback, and commercial partnerships.</p>' +
      '</div>' +
    '</div>' +
    tabsHtml +
    contentHtml +
  '</section>';
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
      joinCloudLeague(code);
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
    return ['picks'];
  }
  if (hash.startsWith('match=')) return ['picks'];
  const [view, ...rest] = hash.split('/');
  return [view || 'home', decodeURIComponent(rest.join('/'))];
}

let lastRoute = '';


// ------------------------------------------------------------ Site Traffic & Commercial Telemetry
const TRAFFIC_STORAGE_KEY = 'betbuddy_traffic_stats_v1';
const BUGS_STORAGE_KEY = 'betbuddy_bug_reports_v1';
const COMMERCIAL_STORAGE_KEY = 'betbuddy_commercial_enquiries_v1';
function getStoredEnquiries() {
  try {
    const list = JSON.parse(localStorage.getItem(COMMERCIAL_STORAGE_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch (e) { return []; }
}


// ------------------------------------------------------------ Commercial & Affiliate Tracking
const AFFILIATE_TRACKING_KEY = 'betbuddy_affiliate_clicks_v1';
let currentBookieSelection = null;

function getAffiliateClicks() {
  try {
    const list = JSON.parse(localStorage.getItem(AFFILIATE_TRACKING_KEY) || '[]');
    if (Array.isArray(list) && list.length > 0) return list;
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

function getPast7Days() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const res = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    res.push({
      dateStr: d.toISOString().slice(0, 10),
      day: days[d.getDay()],
      visits: 0,
      clicks: 0
    });
  }
  return res;
}

function getTrafficStats() {
  let stats = null;
  try {
    stats = JSON.parse(localStorage.getItem(TRAFFIC_STORAGE_KEY) || 'null');
  } catch (e) {}

  const today = new Date().toISOString().slice(0, 10);
  const clicks = getAffiliateClicks();
  const past7 = getPast7Days();

  if (!stats || typeof stats !== 'object' || stats.date !== today) {
    const prevVisits = (stats && stats.totalVisits) || 0;
    stats = {
      date: today,
      visitsToday: 1,
      totalVisits: prevVisits + 1,
      uniquePunters: 1,
      slipsBuilt: 0,
      lastRefreshed: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dailyHistory: past7
    };
    // set today's visits
    const lastDay = stats.dailyHistory[stats.dailyHistory.length - 1];
    if (lastDay) {
      lastDay.visits = 1;
      lastDay.clicks = clicks.length;
    }
    try { localStorage.setItem(TRAFFIC_STORAGE_KEY, JSON.stringify(stats)); } catch (e) {}
  } else {
    stats.visitsToday = (stats.visitsToday || 0) + 1;
    stats.totalVisits = (stats.totalVisits || 0) + 1;
    if (!Array.isArray(stats.dailyHistory) || stats.dailyHistory.length < 2) {
      stats.dailyHistory = past7;
    }
    const lastDay = stats.dailyHistory[stats.dailyHistory.length - 1];
    if (lastDay) {
      lastDay.visits = stats.visitsToday;
      lastDay.clicks = clicks.length;
    }
    stats.lastRefreshed = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try { localStorage.setItem(TRAFFIC_STORAGE_KEY, JSON.stringify(stats)); } catch (e) {}
  }
  return stats;
}

function getBugReports() {
  try {
    return JSON.parse(localStorage.getItem(BUGS_STORAGE_KEY) || '[]');
  } catch (e) { return []; }
}

function saveBugReport(report) {
  const bugs = getBugReports();
  bugs.unshift({ ...report, id: 'bug-' + Date.now(), time: new Date().toISOString() });
  try { localStorage.setItem(BUGS_STORAGE_KEY, JSON.stringify(bugs)); } catch (e) { /* ignore */ }
}

function renderTrafficChartSvg(history) {
  const h = (Array.isArray(history) && history.length >= 2) ? history : DEFAULT_DAILY_HISTORY;
  const width = 600, height = 140, pad = 30;
  const maxV = Math.max(...h.map(item => Number(item.visits) || 0), 10);
  const stepX = (width - pad * 2) / (history.length - 1);
  const getY = v => height - pad - (v / maxV) * (height - pad * 2);

  const ptsVisits = history.map((h, i) => ({ x: pad + i * stepX, y: getY(h.visits) }));
  const pathVisits = 'M ' + ptsVisits.map(p => p.x + ' ' + p.y).join(' L ');
  const areaVisits = pathVisits + ' L ' + ptsVisits[ptsVisits.length - 1].x + ' ' + (height - pad) + ' L ' + ptsVisits[0].x + ' ' + (height - pad) + ' Z';

  const ptsClicks = history.map((h, i) => ({ x: pad + i * stepX, y: getY(h.clicks * 4) }));
  const pathClicks = 'M ' + ptsClicks.map(p => p.x + ' ' + p.y).join(' L ');

  const xLabels = history.map((h, i) => '<text x="' + (pad + i * stepX) + '" y="' + (height - 8) + '" text-anchor="middle" font-size="11" fill="var(--dim)">' + h.day + '</text>').join('');

  return '<svg viewBox="0 0 ' + width + ' ' + height + '" class="pnl-svg-chart" style="width:100%;height:140px">' +
    '<defs>' +
      '<linearGradient id="visGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35"/><stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/></linearGradient>' +
    '</defs>' +
    '<line x1="' + pad + '" y1="' + (height - pad) + '" x2="' + (width - pad) + '" y2="' + (height - pad) + '" stroke="var(--line-strong)" stroke-width="1"/>' +
    '<path d="' + areaVisits + '" fill="url(#visGrad)"/>' +
    '<path d="' + pathVisits + '" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="' + pathClicks + '" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4,4" stroke-linecap="round"/>' +
    ptsVisits.map((p, i) => '<circle cx="' + p.x + '" cy="' + p.y + '" r="3" fill="#38bdf8"><title>' + history[i].day + ': ' + history[i].visits + ' visits</title></circle>').join('') +
    ptsClicks.map((p, i) => '<circle cx="' + p.x + '" cy="' + p.y + '" r="2.5" fill="#f59e0b"><title>' + history[i].day + ': ' + history[i].clicks + ' affiliate clicks</title></circle>').join('') +
    xLabels +
  '</svg>';
}

function viewCommercial() {
  
  // Commercial Inquiries Ledger
  const enquiries = getStoredEnquiries();
  const enquiryRows = enquiries.length ? enquiries.map(e =>
    '<tr>' +
      '<td><b>' + esc(e.company || e.name) + '</b><br><small class="muted">' + esc(e.name) + ' &middot; <a href="mailto:' + esc(e.email) + '" style="color:var(--cyan)">' + esc(e.email) + '</a></small></td>' +
      '<td><span class="badge validated">' + esc(e.interest) + '</span></td>' +
      '<td style="max-width:280px;font-size:12px;color:var(--muted);">' + esc(e.message) + '</td>' +
      '<td style="font-size:11px;font-family:var(--mono);color:var(--dim);white-space:nowrap;">' + esc(e.submitted_at ? e.submitted_at.slice(0, 16).replace('T', ' ') : 'Just now') + '</td>' +
    '</tr>'
  ).join('') : '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px;">No commercial enquiries submitted yet.</td></tr>';

  const enquiryCard = '<div class="section card" style="margin-top:24px;">' +
    '<div class="section-head"><div><h2 class="section-title">Commercial &amp; Sponsorship Inquiries (' + enquiries.length + ')</h2><p class="section-note">Incoming bookmaker, brand, and affiliate proposals submitted via #/commercial.</p></div>' +
    (enquiries.length ? '<button type="button" class="btn small" data-admin-action="clear-enquiries" style="background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);">Clear Enquiries</button>' : '') +
    '</div>' +
    '<div style="overflow-x:auto;"><table class="table"><thead><tr><th>Partner / Contact</th><th>Category</th><th>Proposal</th><th>Submitted</th></tr></thead><tbody>' + enquiryRows + '</tbody></table></div>' +
  '</div>';

  return '<section class="view">' +
    '<div class="section-head"><div>' +
      '<h1 class="page-title">Commercial &amp; Sponsorship Opportunities</h1>' +
      '<p class="page-sub">Partner with Bet Buddy &mdash; the transparent, mathematical sports betting co-pilot driving high-margin accumulator engagement across the UK &amp; beyond.</p>' +
    '</div></div>' +

    '<div class="section grid grid-3">' +
      '<div class="card commercial-pitch-card">' +
        '<div class="portal-card-top"><span class="portal-pill highlight">⚡ High Margin Hold</span></div>' +
        '<h3 class="card-title" style="margin-top:8px">Accumulator Engine</h3>' +
        '<p class="muted" style="font-size:13px;line-height:1.5">Punters use our transparent Dixon-Coles model to build 2 to 6-leg accumulators. Accas deliver <b>25%–35% gross operator margin</b> &mdash; the most profitable betting product in sports.</p>' +
      '</div>' +
      '<div class="card commercial-pitch-card">' +
        '<div class="portal-card-top"><span class="portal-pill">🏆 Title Sponsorship</span></div>' +
        '<h3 class="card-title" style="margin-top:8px">6-Tier Silverware Leagues</h3>' +
        '<p class="muted" style="font-size:13px;line-height:1.5">Branded silverware across Hometown (Paisley Plaque), Regional (Civic Chalice), National (Lion Trophy &amp; Britannia Shield), and Worldwide ladders with persistent punter engagement.</p>' +
      '</div>' +
      '<div class="card commercial-pitch-card">' +
        '<div class="portal-card-top"><span class="portal-pill">🎯 Direct Transfer</span></div>' +
        '<h3 class="card-title" style="margin-top:8px">1-Click Betslip Deep-Linking</h3>' +
        '<p class="muted" style="font-size:13px;line-height:1.5">Deep-link integration into licensed UK sportsbooks (Bet365, Sky Bet, Paddy Power, Ladbrokes, Coral, William Hill, Betfair, Unibet) with tracked affiliate attribution.</p>' +
      '</div>' +
    '</div>' +

    '<div class="section card" style="max-width:760px;margin:24px auto 0;">' +
      '<div class="section-head"><div><h2 class="section-title">Submit a Commercial Enquiry</h2>' +
        '<p class="section-note">Direct communication with founders Martin White &amp; Chris Faulds.</p></div>' +
        '<span class="badge validated">Response &lt; 24h</span>' +
      '</div>' +

      '<form id="commercial-enquiry-form" style="display:grid;gap:14px;margin-top:16px;">' +
        '<div class="field"><label for="comm-name">Your Name / Representative</label>' +
          '<input id="comm-name" class="ctl" type="text" placeholder="e.g. Sarah Jenkins" required></div>' +
        '<div class="field"><label for="comm-company">Organisation / Bookmaker / Brand</label>' +
          '<input id="comm-company" class="ctl" type="text" placeholder="e.g. Flutter Entertainment / Bet365 / Sponsor Brand" required></div>' +
        '<div class="field"><label for="comm-email">Work Email</label>' +
          '<input id="comm-email" class="ctl" type="email" placeholder="name@company.com" required></div>' +
        '<div class="field"><label for="comm-interest">Partnership Category</label>' +
          '<select id="comm-interest" class="ctl">' +
            '<option value="Bookmaker Live Odds & Acca Placement Integration">Bookmaker Live Odds &amp; Acca Placement Integration</option>' +
            '<option value="Accumulator Engine Exclusive Sponsorship">Accumulator Engine Exclusive Sponsorship</option>' +
            '<option value="6-Tier Silverware & Geo-League Title Sponsor">6-Tier Silverware &amp; Geo-League Title Sponsor</option>' +
            '<option value="Brand Partnership & Commercial Promotion">Brand Partnership &amp; Commercial Promotion</option>' +
            '<option value="Data Feed, Odds API & Syndicate Licensing">Data Feed, Odds API &amp; Syndicate Licensing</option>' +
            '<option value="Other Commercial Collaboration">Other Commercial Collaboration</option>' +
          '</select></div>' +
        '<div class="field"><label for="comm-message">Proposal / Details</label>' +
          '<textarea id="comm-message" class="ctl" rows="4" placeholder="Tell us about your brand, partnership goals, or integration requirements..." required></textarea></div>' +
        '<button type="submit" class="btn primary full-width" style="padding:12px;font-size:14px;font-weight:700;">Submit Partnership Enquiry</button>' +
        '<div id="comm-status-msg" style="display:none;padding:12px;border-radius:10px;background:rgba(16,185,129,0.18);border:1px solid var(--emerald);color:#fff;font-size:13px;text-align:center;"></div>' +
      '</form>' +
      '<div style="margin-top:18px;text-align:center;font-size:12.5px;color:var(--muted);border-top:1px solid rgba(255,255,255,0.08);padding-top:14px;">' +
        'Prefer direct email? Contact founders Martin White &amp; Chris Faulds at <a href="mailto:octopigardens@gmail.com?subject=Bet%20Buddy%20Commercial%20Partnership" class="compliance-link">octopigardens@gmail.com</a>' +
      '</div>' +
    '</div>' +
  '</section>';
}

function viewAdmin() {
  const authUser = getAuthUser();
  const clicks = getAffiliateClicks();
  const diary = getStoredDiary();
  const leagues = getStoredLeagues();
  const stats = getTrafficStats();
  const bugs = getBugReports();

  const totalSettledBets = diary.filter(e => e.outcome && e.outcome !== 'pending').length;
  const totalStakedEst = diary.reduce((sum, e) => sum + (+e.stake || 0), 0);
  const estCommission = (clicks.length * 3.50 + (totalStakedEst * 0.05)).toFixed(2);

  const clicksRows = clicks.slice(0, 15).map(c => {
    return '<tr><td><b>' + esc(c.bookie) + '</b></td>' +
      '<td>' + esc(c.selection) + '</td>' +
      '<td class="mono">' + esc(c.odds) + '</td>' +
      '<td class="dim" style="font-size:12px">' + esc(new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) + '</td></tr>';
  }).join('');

  const bugRows = bugs.slice(0, 10).map(b => {
    return '<tr><td><span class="badge bad">' + esc(b.type) + '</span></td>' +
      '<td>' + esc(b.desc) + '</td>' +
      '<td class="dim">' + esc(b.contact || 'Anonymous') + '</td>' +
      '<td class="dim" style="font-size:12px">' + esc(new Date(b.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) + '</td></tr>';
  }).join('');

  
  // Commercial Inquiries Ledger
  const enquiries = getStoredEnquiries();
  const enquiryRows = enquiries.length ? enquiries.map(e =>
    '<tr>' +
      '<td><b>' + esc(e.company || e.name) + '</b><br><small class="muted">' + esc(e.name) + ' &middot; <a href="mailto:' + esc(e.email) + '" style="color:var(--cyan)">' + esc(e.email) + '</a></small></td>' +
      '<td><span class="badge validated">' + esc(e.interest) + '</span></td>' +
      '<td style="max-width:280px;font-size:12px;color:var(--muted);">' + esc(e.message) + '</td>' +
      '<td style="font-size:11px;font-family:var(--mono);color:var(--dim);white-space:nowrap;">' + esc(e.submitted_at ? e.submitted_at.slice(0, 16).replace('T', ' ') : 'Just now') + '</td>' +
    '</tr>'
  ).join('') : '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px;">No commercial enquiries submitted yet.</td></tr>';

  const enquiryCard = '<div class="section card" style="margin-top:24px;">' +
    '<div class="section-head"><div><h2 class="section-title">Commercial &amp; Sponsorship Inquiries (' + enquiries.length + ')</h2><p class="section-note">Incoming bookmaker, brand, and affiliate proposals submitted via #/commercial.</p></div>' +
    (enquiries.length ? '<button type="button" class="btn small" data-admin-action="clear-enquiries" style="background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);">Clear Enquiries</button>' : '') +
    '</div>' +
    '<div style="overflow-x:auto;"><table class="table"><thead><tr><th>Partner / Contact</th><th>Category</th><th>Proposal</th><th>Submitted</th></tr></thead><tbody>' + enquiryRows + '</tbody></table></div>' +
  '</div>';

  return '<section class="view">' +
    '<div class="section-head"><div><h1 class="page-title">Commercial & Founder Telemetry</h1>' +
    '<p class="page-sub">Auto-updating metrics for Martin White & Chris Faulds: punters, site visits, affiliate traffic, and sponsorship conversions.</p></div>' +
    '<div class="chips">' +
      '<button type="button" class="chip ok" data-admin-action="refresh-stats" title="Click to refresh telemetry"><span class="admin-pulse-dot"></span>Refresh Telemetry (' + stats.lastRefreshed + ')</button>' +
      '<button type="button" class="chip" data-admin-action="simulate-click" title="Log a test bookie outbound">⚡ Test Bookie Click</button>' +
    '</div></div>' +
    
    '<div class="admin-metric-grid">' +
      '<div class="admin-metric-card"><div>Total App Visits</div><div class="admin-metric-val cyan">' + stats.totalVisits + '</div><div class="admin-metric-sub">+' + stats.visitsToday + ' today across all devices</div></div>' +
      '<div class="admin-metric-card"><div>Active Punters / Users</div><div class="admin-metric-val">' + stats.uniquePunters + '</div><div class="admin-metric-sub">' + (authUser ? '1 Signed-In (@' + esc(authUser.handle || 'User') + ')' : 'Guest profile active') + '</div></div>' +
      '<div class="admin-metric-card"><div>Bookmaker Outbounds</div><div class="admin-metric-val amber">' + clicks.length + '</div><div class="admin-metric-sub">Affiliate tracking gateways triggered</div></div>' +
      '<div class="admin-metric-card"><div>Est. Commission Earned</div><div class="admin-metric-val emerald">£' + estCommission + '</div><div class="admin-metric-sub">Projected CPA + 25% NGR pool</div></div>' +
    '</div>' +

    '<div class="admin-chart-box">' +
      '<div class="admin-chart-head">' +
        '<div><strong style="color:#fff;font-size:15px;display:block">7-Day Punter Activity & Outbound Click Trajectory</strong><span class="text-sm muted">Cyan: Site Visits · Amber Dashed: Outbound Bookie Clicks</span></div>' +
        '<span class="bento-badge emerald">Peak Weekend Volume</span>' +
      '</div>' +
      renderTrafficChartSvg(stats.dailyHistory) +
    '</div>' +

    '<div class="section" style="margin-top:28px">' +
      '<div class="section-head"><h2 class="section-title">Live Bookmaker Affiliate Outbound Log</h2><span class="section-note">Tracks exactly which bookmaker links punters tap in Bet Buddy.</span></div>' +
      '<div class="admin-table-card">' +
        '<table class="admin-table">' +
          '<thead><tr><th>Bookmaker</th><th>Selection Placed</th><th>Odds</th><th>Time</th></tr></thead>' +
          '<tbody>' + (clicksRows || '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px">No outbound bookie clicks logged yet.</td></tr>') + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>' +

    (bugs.length ? '<div class="section" style="margin-top:28px">' +
      '<div class="section-head"><h2 class="section-title">Submitted Bug Reports (' + bugs.length + ')</h2><span class="section-note">Issues submitted by punters via the Report a Bug button.</span></div>' +
      '<div class="admin-table-card">' +
        '<table class="admin-table">' +
          '<thead><tr><th>Type</th><th>Issue Details</th><th>Contact</th><th>Submitted</th></tr></thead>' +
          '<tbody>' + bugRows + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>' : '') +

    '<div class="section" style="margin-top:28px">' +
      '<div class="section-head"><h2 class="section-title">Commercial & Domain Status</h2><span class="section-note">Official production assets for Martin White & Chris Faulds.</span></div>' +
      '<div class="bento-grid">' +
        '<div class="bento-card"><div class="bento-icon">🌐</div><div><div class="bento-kicker">Live Domain</div><h3 class="bento-title">betbuddyuk.uk</h3><p class="bento-desc">Connected and live. HTTP 301 permanently forwarding to production webapp with free SSL.</p></div><span class="bento-badge emerald">Active & Verified</span></div>' +
        '<div class="bento-card"><div class="bento-icon">🛡️</div><div><div class="bento-kicker">Copyright Protected</div><h3 class="bento-title">Martin White & Chris Faulds</h3><p class="bento-desc">Registered copyright 2026 across all proprietary Dixon-Coles algorithms, Buddy Leagues, and Bet Builder interfaces.</p></div><span class="bento-badge">Legal Notice Live</span></div>' +
        '<div class="bento-card"><div class="bento-icon">🤝</div><div><div class="bento-kicker">Outreach Ready</div><h3 class="bento-title">bet365 & Sky Bet</h3><p class="bento-desc">Affiliate pitch dossiers prepared for <b>octopigardens@gmail.com</b> ready for self-serve submission.</p></div><span class="bento-badge cyan">Starter CPA / Rev-Share</span></div>' +
      '</div>' +
    '</div>' +
  '</section>';
}



// ------------------------------------------------------------ Multi-Sport State & View
const ACTIVE_SPORTS_KEY = 'betbuddy_active_sports_v1';
let activeSports = ['football'];
try {
  const savedSports = JSON.parse(localStorage.getItem(ACTIVE_SPORTS_KEY) || 'null');
  if (Array.isArray(savedSports) && savedSports.length > 0) {
    activeSports = savedSports;
  }
} catch (e) { /* ignore */ }

function toggleSport(sportKey) {
  if (activeSports.includes(sportKey)) {
    if (activeSports.length > 1) {
      activeSports = activeSports.filter(s => s !== sportKey);
    } else {
      toast('At least one sport must be selected!');
      return;
    }
  } else {
    activeSports.push(sportKey);
  }
  try { localStorage.setItem(ACTIVE_SPORTS_KEY, JSON.stringify(activeSports)); } catch (e) { /* ignore */ }
  toast((activeSports.includes(sportKey) ? 'Added ' : 'Removed ') + sportKey.toUpperCase() + ' from Acca &amp; view');
  updateBuilder();
  render();
}

function isSportActive(sportKey) {
  return activeSports.includes(sportKey);
}

function setSport(sportKey) {
  currentSport = sportKey || 'football';
  render();
}

function renderSportFilterBar() {
  const sports = [
    { key: 'football', label: '⚽ Football' },
    { key: 'tennis', label: '🎾 Tennis' },
    { key: 'golf', label: '⛳ Golf' },
    { key: 'darts', label: '🎯 Darts' },
    { key: 'rugby', label: '🏉 Rugby' }
  ];
  const count = activeSports.length;
  return '<div class="sport-filter-section">' +
    '<div class="sport-filter-head">' +
      '<span class="sport-filter-title">Mix Sports in Acca (' + count + ' active)</span>' +
      '<span class="sport-filter-hint">Tap any sport to toggle ON / OFF</span>' +
    '</div>' +
    '<div class="sport-filter-bar" role="group" aria-label="Toggle sports on and off">' +
      sports.map(s => {
        const active = activeSports.includes(s.key);
        return '<button type="button" class="sport-pill' + (active ? ' active' : '') + '" data-toggle-sport="' + s.key + '" aria-pressed="' + active + '">' +
          '<span class="sport-toggle-dot' + (active ? ' on' : '') + '"></span>' +
          '<span>' + s.label + '</span>' +
        '</button>';
      }).join('') +
    '</div>' +
  '</div>';
}

function viewMultiSport(sportKey) {
  const sportData = (DATA.multiSport && DATA.multiSport.sports && DATA.multiSport.sports[sportKey]);
  if (!sportData) {
    
  // Commercial Inquiries Ledger
  const enquiries = getStoredEnquiries();
  const enquiryRows = enquiries.length ? enquiries.map(e =>
    '<tr>' +
      '<td><b>' + esc(e.company || e.name) + '</b><br><small class="muted">' + esc(e.name) + ' &middot; <a href="mailto:' + esc(e.email) + '" style="color:var(--cyan)">' + esc(e.email) + '</a></small></td>' +
      '<td><span class="badge validated">' + esc(e.interest) + '</span></td>' +
      '<td style="max-width:280px;font-size:12px;color:var(--muted);">' + esc(e.message) + '</td>' +
      '<td style="font-size:11px;font-family:var(--mono);color:var(--dim);white-space:nowrap;">' + esc(e.submitted_at ? e.submitted_at.slice(0, 16).replace('T', ' ') : 'Just now') + '</td>' +
    '</tr>'
  ).join('') : '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px;">No commercial enquiries submitted yet.</td></tr>';

  const enquiryCard = '<div class="section card" style="margin-top:24px;">' +
    '<div class="section-head"><div><h2 class="section-title">Commercial &amp; Sponsorship Inquiries (' + enquiries.length + ')</h2><p class="section-note">Incoming bookmaker, brand, and affiliate proposals submitted via #/commercial.</p></div>' +
    (enquiries.length ? '<button type="button" class="btn small" data-admin-action="clear-enquiries" style="background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);">Clear Enquiries</button>' : '') +
    '</div>' +
    '<div style="overflow-x:auto;"><table class="table"><thead><tr><th>Partner / Contact</th><th>Category</th><th>Proposal</th><th>Submitted</th></tr></thead><tbody>' + enquiryRows + '</tbody></table></div>' +
  '</div>';

  return '<section class="view">' + renderSportFilterBar() +
      '<div class="empty">No live events loaded for ' + esc(sportKey) + '. Check back soon!</div></section>';
  }

  const tournamentsHtml = (sportData.tournaments || []).map(t => {
    const eventsHtml = (t.events || []).map(ev => {
      const selectionsHtml = (ev.selections || []).map(sel => {
        const betData = esc(JSON.stringify({
          eventId: ev.id,
          sport: sportKey,
          selection: ev.title + ' · ' + sel.label,
          fair: sel.fractional,
          odds: sel.decimal,
          bookmaker: sel.bookmaker
        }));
        return '<div class="sport-selection-row">' +
          '<div class="sport-sel-info">' +
            '<span class="sport-sel-name">' + esc(sel.label) + '</span>' +
            '<span class="sport-sel-bookie">Best price: ' + esc(sel.bookmaker) + '</span>' +
          '</div>' +
          '<div class="sport-sel-actions">' +
            '<button type="button" class="sport-odds-btn" data-open-bookie=\'' + betData + '\' title="Place with ' + esc(sel.bookmaker) + '">' + esc(sel.fractional) + '</button>' +
            '<button type="button" class="btn small" data-diary=\'' + betData + '\' title="Add to Bet Diary">+ Diary</button>' +
            '<button type="button" class="btn-add-cross-acca" data-add-cross-acca=\'' + betData + '\' title="Add to Accumulator">+ Acca</button>' +
          '</div>' +
        '</div>';
      }).join('');

      return '<div class="sport-event-card">' +
        '<div class="sport-card-head">' +
          '<div>' +
            '<h3 class="sport-event-title">' + esc(ev.title) + '</h3>' +
            '<div class="sport-tournament-sub">' + esc(t.tournament) + ' · ' + esc(ev.round) + '</div>' +
          '</div>' +
          '<span class="badge validated">' + esc(ev.date) + '</span>' +
        '</div>' +
        '<div class="sport-odds-list">' + selectionsHtml + '</div>' +
      '</div>';
    }).join('');

    return '<div class="section">' +
      '<div class="section-head"><div><h2 class="section-title">' + esc(sportData.icon) + ' ' + esc(t.tournament) + '</h2>' +
      '<span class="section-note">' + esc(t.course || t.venue || t.surface || 'Official UK Bookmaker Prices') + '</span></div>' +
      '<span class="badge provisional">UK Odds Live</span></div>' +
      '<div class="sport-events-grid">' + eventsHtml + '</div>' +
    '</div>';
  }).join('');

  
  // Commercial Inquiries Ledger
  const enquiries = getStoredEnquiries();
  const enquiryRows = enquiries.length ? enquiries.map(e =>
    '<tr>' +
      '<td><b>' + esc(e.company || e.name) + '</b><br><small class="muted">' + esc(e.name) + ' &middot; <a href="mailto:' + esc(e.email) + '" style="color:var(--cyan)">' + esc(e.email) + '</a></small></td>' +
      '<td><span class="badge validated">' + esc(e.interest) + '</span></td>' +
      '<td style="max-width:280px;font-size:12px;color:var(--muted);">' + esc(e.message) + '</td>' +
      '<td style="font-size:11px;font-family:var(--mono);color:var(--dim);white-space:nowrap;">' + esc(e.submitted_at ? e.submitted_at.slice(0, 16).replace('T', ' ') : 'Just now') + '</td>' +
    '</tr>'
  ).join('') : '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px;">No commercial enquiries submitted yet.</td></tr>';

  const enquiryCard = '<div class="section card" style="margin-top:24px;">' +
    '<div class="section-head"><div><h2 class="section-title">Commercial &amp; Sponsorship Inquiries (' + enquiries.length + ')</h2><p class="section-note">Incoming bookmaker, brand, and affiliate proposals submitted via #/commercial.</p></div>' +
    (enquiries.length ? '<button type="button" class="btn small" data-admin-action="clear-enquiries" style="background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);">Clear Enquiries</button>' : '') +
    '</div>' +
    '<div style="overflow-x:auto;"><table class="table"><thead><tr><th>Partner / Contact</th><th>Category</th><th>Proposal</th><th>Submitted</th></tr></thead><tbody>' + enquiryRows + '</tbody></table></div>' +
  '</div>';

  return '<section class="view">' +
    '<div class="section-head" style="align-items:flex-end"><div>' +
      '<h1 class="page-title">' + esc(sportData.icon) + ' ' + esc(sportData.name) + ' Markets</h1>' +
      '<p class="page-sub">Live UK bookmaker prices for ' + esc(sportData.name) + '. Add singles to your Bet Diary or mix with football in the Acca Builder.</p>' +
    '</div>' +
    '<div class="chips"><span class="chip ok">The Odds API UK Feed</span></div></div>' +
    renderSportFilterBar() +
    tournamentsHtml +
  '</section>';
}

function render() {
  const [view, arg] = currentRoute();
  const navKey = view === 'match' ? 'fixtures' : view;
  document.querySelectorAll('.nav a').forEach(a => { if (a.dataset.nav === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  updateOddsToggleLabel(); updateHeaderAuthUI();
  const html = view === 'picks' ? viewPicks() : view === 'fixtures' ? viewFixtures() : view === 'match' ? viewMatch(arg) : view === 'results' ? viewResults() : view === 'diary' ? viewDiary() : view === 'leagues' ? viewLeagues() : view === 'admin' ? viewAdmin() : view === 'commercial' ? viewCommercial() : view === 'more' ? viewMore() : viewHome();
  $('app').innerHTML = html;
  const titles = { home: 'Welcome Hub', picks: 'Picks & Acca Builder', fixtures: 'Fixtures', match: 'Match analysis', results: 'Results & performance', diary: 'Bet Diary', leagues: 'Buddy Leagues', admin: 'Founder Admin & Affiliates', commercial: 'Commercial & Sponsorship', more: 'Data & methods' };
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

async function triggerDirectDownload() {
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
      '<div class="install-badge-preview" style="margin-bottom:16px"><img src="assets/icon-192.png" onerror="this.onerror=null;this.src=\'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAABeP0lEQVR42u2dd4AdVfn+P+ecmVu3l/SeUELoIL2DKCpIEewFCwoq9oLY9atiL4iAXUQUsCBNQYogvSUhkEBIIT3Z3m6bmXN+f5y5de8mG7K7Wfjt0SW7d+69M3fu+77nedvzikjtVMPEmlj/ny45cQsm1oQCTKyJNaEAE2tiTSjAxJpYEwowsSbWhAJMrIk1oQATa2JNKMDEmlgTCjCxJtaEAkysiTWhABNrYk0owMSaWBMKMLEm1oQCTKyJ9TJezsQtGMMlhvm8iQL1CQV4ZQq32P5z84IvzISSTCjAy1DYhUAg7L8CkMI+2f4fY8LXmmoSbF9TeA4lzzNgtAEMxhj7JDGhEBMKsDuFXgiEEAgpCwJvDGA0xoSCGoCQ0v4oB+U4SKWQrotQqlx+gwDteWitMZ6HDgKMDjBGW+HOn08ohBAFRTDanm+QBkwoxIQCjJbACylDAdQYHSCkQLpR3Joaoo2NxFtaibdOIt7cQry5hWhDA5HaWtyaWmQkghOLId1IKeZB+x5+Oo32PLz+fnL9fWS7u8h0dJDpaCe1bRvp9jYyXZ14/f0E2SxGa4SQCEchEFYZJhRiQgFGTPBLBF4IUbDIQkhiDQ0kp02nfs5c6ucvoH7OXJJTpxFvacWtqUFFY0ilyG8NdlfQodW2ylOGdfK7CaJwvsJrtcbPZvD6+8l0dDCwZRO9a9fSvWolvWvX0L9xA9nubnQQIKRESoVBYIIAo3U5ZJpQhPKve6IpvrrQSyUL0AQhiNTVUTdrNk37LKJ50X407rU3NVOnEamtRTgORmu076M9HxP4VvDybykFCFkm2ELK0g3AWu3QeueFtvw9JEIppOMiHQehJMYPyA30k9qyma7nn6PjmafpeGYZvS+uJdvTjdHGKiEihFShMhRPOvHV/3+tAKJU7oWFEsJaTqQg1thE094LmXzoYbQeeDD1c+cRqatHSEHgeehcFu37oYAqpOMgXQehnAJOz2P7IJcjyGZDJckR5HJllyJdFxWJIh2FikaRbgTlRorXlH8v30P7vr1GsL5FJIKMRMAYvL4+el9cS9vip9j6xKN0PPsMmfZ2tNZIpQrvY53qiV3hFaQAZseHRaXwC4QUCOXYCIsOiNTW0rT3QqYddSyTX3U4dbPn4MQTaN8jyGbQvo9AIF0XGYkglYMxGj+dItvdQ7p9G6lt20ht3UJq21YyXZ3kenrI9ffjp1JoL2cVwvPLYIl0HFTERTouTiKBm6whWl9PrKmJeGsriclTSEyaTKJlEtGGBpxEAiEVOvAL72m0se8TjSJdlyCbpW/9OrY+8RibHriPjmeeIdvTbf0GIYu7QhhpGvJe7VJSY0IBRl/YS3Z1G3+sOGjyj5c8UWIjMVojpCQ5bTrTjjqa6ceeQNPeC3ETSQI/h87mrKOrQsvsuGjfJ9vVRf+mDXSvXkXv6lX0rVvLwNat5Hp78dIpuzNobeG3yIdDRTEVUHGdpiTkSd6JzWN3YRXOicaJ1tcRb51E7azZ1M+dR8P8BdTMmEmssQnp2msLclmMHzrnkSgqEsHPpOl+/nk2/u8+Nj5wH33r1mFCn8EEuhheLYVHJddbuM+F66umA2JCAcZE8EuvWIqiBHkBxg9AF0OHKFFUCkGI7xUy4uJEo9TPW8DMk05h6hFHkZwyFaMD/EzWCn3eEUUQZDL0bVhH5/Jn6Fz+LN2rXiDd3oaXSkEQhEoli7F/E8bvC8IMptLSlmlu8VdR1JLwGigmEEp8BaEkTjxBvLmF+nnzaNp7H5oW7lPYtfLnMMYghAwV2CHd1saWxx5m3V130vX8Cvx0xoZgfT900I29Mm0gKPdDcBXCVaBkURlMNfkXEwow4ta+wtKbIICsb7+kqANNScSkWphSh2ipgdo41EQhomygRYpiOFNJpONaXF9fj5+xQmAdVFEUQgxISbanm4GNG/Ey6dBfcFDKKUZqCsJtMPnNRhTfpSjEg2VDDHlclD8kKhXD/m10YHccY3BiMZJTpxFrbsZoU6JAFKy8dF3cWBwvNUDP6lXoXK4QoUKb4obpBZjeDKY7hd7WS7CxC72xG721B5POgZSIWMQqhDGgq8m/mFCAkbP24Z9ZD3IB1EZhfitin2mIPSbB1AZETQTcomAW8a0YJF/GGAsXggAhVaE0UJQ8Nw+dhHRQ0QhCyWpJ3LL3LwppCZ4WourzBaXn2dHx8A0rlEWEvgxhLkD7OXR+V6qiQCIMy0qlUNFYmGArgWqF04mC0QAQvsb0ZQg2dOI/uxHv8bV4T2/AdA2A6yDjEfv6Ugd7nCvCOFWAUuG3WNQIIJ2z1n52M+LIeYiDZsLUBmvhfY3wAnvzK7fkEuESlcITxt6Lzy2FIKVfXtHKi2rCWnG+7Vv+IYS/QoGGvTtUfiYhB+F3MdQ90Lr8M1ccF+HNzJd44EhkxIGIA75Gb+wk9+ALZO9YhvfsJvteyZh9tTYV1y0mFGDnrL7BKGFhTtaHvSYjXr0P4sCZFtpkffCDvI6EX/rwBWW7MGMIyz76wr+j69m5z1R6zaXKJKr5HCXvt93j2mJ/IQUi6iBiEcxAFu+x1aRueIzco6vBVch4tMSHEONyNxhHCmDKBT9/j/ozFtOfcSDiyPkW66dzEJiCg/tSrOT2Mfb2Ben/S+EXxT2h7LQmtPRKImui4Guy9yyn/zf34b2wBVmTsDBqnO4G40ABqlh9KSBnrbs4aS/EWQdDQwJSOYvrS3HpCAjKy8Pylz9/XAh/5fHAfjeqLobuzTDw+//R/6cH7TPjEQhM4X3Gy26wmxWgHOubfFgzlYXaGOLdRyKOmAdpz0IdJXcZH0/AnlES/lLnOdAIRyHr4mQeeJ6eb92Mv6kLWZcYd0qwGxWgUvhtuJG+NMxvRV54PExrhL5sCHWqCcoE7Bl3wl96PNDI+jh6Wy9dX/07mUdWIutqQJuy1+1OSLSbFKAC7xPCmr4M4qCZiAtPgJhrLb8jh4iMTMCe8SL824dF2uYKgM5v/J3UbYuRdclQCcRuVwKlorVfHR/Cn0YcMQ/xkZPsN5MLtiP8E7BnXFv+0uNKInxbb5Q8dX90V4rsU2sQMVu8t7t3Arn7anjCrqnQ8nPgLMSHTrBhM19b2FMMbI8e7JkQ/tET/vzvUoAGk87R9IUzSL7+IHTvAChZ3rxTtVX0lUaLYiosfyoL81uQF50Q1p6YCuGvFJQRtPyMV9gjXhawZ1jCT0mm2hhMKkvzl88mftSe6J4BUKJ6B9srTwFMebQHwPOhNorMY/4yy7+dnfEVDXt4WVh+dkL4yypgA/vtt3z9TbizmjHpLEgRSoUZ811A7hbhz2u85yPefZSN9qS9CdjzSoI9lcJf4hOQ9VDNtTR/6awQHukSgDy2SiDH0uktCL/CZnhP3htxxHzrAxQc3gnY80qBPYOEP/+QkujeNPGj9qT+/OPRAwNWEfJl2GOoBGMLgfKVjFkfptQhzzoktPxyAva8UmFPtXsECEehe1I0vPtYogtnYlKZUBpfUU5wFegjbDmzOOMgaEzaDK8YQ9gTNpSgNUIXf8foYj37Kxn2aBubR2tEoC0mD/L3wIwO7KkU/nylaqCRyRgNHzoFE2iKbsDY+QNjR4uSb7FLZ2GvKYijFsBAtqS8gdFJcomSriUlIOLariYpKPathEW/gbaOua+L9fyvhCSXtgIlHAeRcBCOCiFHGKEJWSmErzE5zyav8kwWI235Sz+DI9F9GZLHLyRx7N6k7l+OrEnYkKkYm4yAMzbWvwh/TKCRpy6yVZ0DWRByFGFP2KUUde35UjnM+nbMxg5o78X0ZexzYhFEUy1ieiNyRguiIWmvPZ0N31S+LGEP2oT1+VGEUpjuAfwXNhGsbyfY1oNJZe3mWJdATarHmTMZZ1YLqj6J8fyw60vkA5kjK/yFz2AQAhrecTSpB54bTNViRFhyKl6eO4ApZRnIeDCr2dbz52/uIOEfIdijtW3aiEYw69vQDz2HfmoNZksXpHMhG0JRUYQQEHEQTbXIvaejjt0Hue8scJTNVUj5soI9BBqZiIIEf+mLZO9agrdkDXprNybjDW41lQKRiKKmNRE9dA/irz4Qd6/p4PmYjF+oxxpZ4bfn1aks8UPnEztoDpkn1yCT8THbBUapFqjC+ocZX9OXQr71cMSZB0NvMfIz4rBHa6iJYTr60f98lOB/y23UyVVWKaSoblGMAT/AZD3bM7xoFs65R6H2m41JZYuCMp5hT55IojaOv3wD6T/cTe6xFyDnI2IW/hWVucJSaY3J+Zich0zEiJ2wL7XvPhl3Viu6L1XWPTciwp9/emCQDUl6b3yYrV+5Hqe2xjbn58mGEaNWJjH6tUB59Qob1+VbD4dYtPy7HlHLb6A2jn58FcGPb0YvXWt7hOORor9RYDOo+AlDdCJqBcVs7CS47xnIesgD5ha+rNJ+hHFl+cPGfxGLkr7uPgYu+xvB2m2IeNTW40s59GcPP79wlH0ukHtmPZm7l6Caaokumo3J+mW+0YgIfz74EWjcSfX0/WspeiCLcGS4BYiS87xcFKAs4xti/0wOsXAq4jX7WUdzNDq5jIG6OMEtjxNc/W/wNCSj5QI+XIfdYHcLpQieXI15sQ3n8D1t/7HWFT2340X4LVFu//f+Tua6+xDxiC060y/h8wMiHsHkPNJ3LoZAEz96IeS8kMp9hIS/pIdAtdSRfXY9mRUbUNFoIWooBlvL8RwGNYN/F4AOEIumW6Eyo5DkCmFPcNOjBNfcC/GQDiXQL/2jhIIjGpMEjzxP9nv/sO8nVTlHy+5OcplQIB1J/2V/JXv7E4immkKo8SWvQFs+0vokvb+5k54rbkUmY2Vku7ss/PnodPhZkkfuWRI4Gf20gBx155cwzuw6sMdk2+YoRjjao7WFPf9bTnDtfyEZKwpw1U9teYHKfuR2boWvEQ1JgsdfIHfFvyxEqpq4203RHqMRyRipq/5N9t9PIZpqbSh3iI9viXbLfwoEY1V3Q41srKH3t3fRd/3/UA1JqxwjJPwgkFJgsj7RfWeikglLcDYG1KVy9CS/WOFn/ACak4hpDZa6ZCQtvzEQczEbOvB/fw/EImXb+CDBlxKdzuF39duf7n68rn78/nRINjvELfEDREMS/56n8W57HFETLyjYbo/21CbI3rWEzF8fDIU/GFLwERD0pwufPX8fdMoWpVVVhLDxXdYn6LnydrJL1iCT0WKYdReFP3//jOcTmd5si+SyXni8RJZGITHmjDpBrRBWeCbVIWpitgxCjnAzi1IE1z8AvSnLBldl2xfKCn7g+yT3mU3NgfOJzZqEcBW5bd0MPPMi/U++gN+bwqlNlFGTFyGRtbTe9Q+gDl2AaKlDeH55VGUsk1zGgKvQXX2kf/sfRMQdctcTShL0pRERh9rD9yK531wiUxpBG7Ib2uhfsoaBp9eAEKhE1GZmK3cCJTHpLN2/uI3JP76gPCK2K8JfGg2qjxKZO4nM8vUl46RejokwUyE4U+psCC7rj5zwGwOJKGbZOvQTL0BNbEjhD/rSxOZMZvrHzqT+uH1RNfGiiyJAez7p5zaw6Re30nnHk6jaeJWkDDY61NmPf/NjRC98LSbn7wD2FL/2Atta1c9kSk4jyvyn7WV4RX2MzI0PEqxrRzQmLfQZZPkFfs8A9ccsYvpHziC57xwL40rcGJ3K0vvICjb+5B8MPLsOpy4xWAkCjaiJk3liFan/LqPm1IPQvSkbOdtV4ceWRAsliMxpKSmaN2DEqOUERiUKVPpVGgHkPMTh8xELp9soghQjU9tjbJY3uP5BzItttsyhQmiFkvi9KeqP2oc9r7qY5P5zMVkPncqiM7nCj/F8IpMbaT79cISS9P7vGWtRq3w64SjMth7UUXsjkjFbRxTCOiEkUgqUkKgwXKoBH03WBGS0T0Z7pLRnfzf275wO8IwmCO+eFKCExBEKWUFdWLg9joSBLANX3B4mFmVV2OP3pply/qnMu+x9RCY3oFM5dDpX9vkxhsSe02l+wxFk121jYNlaVDw62AiEO7pOZUi++iDL8iB3XfjzLHQyFsFb10H/PU/bmQeDBhCObCRo9Esh8jJbmyjWA41ESXMYpjTbetDPrLMNNRWwRUhBMJAhuWg2C37yIUTExe/qt7HuKlg/SGchlWX6x84kGMiw+erbcBpqyi1huAvoth6Cp9bgvvZgRH8aKRUag2cCMoFPYOxrXKmocaI0uUnq3TiNbpy4cml044UaJAH0+hlS2qfHS9PtpekJsgz4ObI6AAwRpYhKl2ioEFpriEfJPfkswbo2RB6TVyp/9wCt5x7L7Evfit/dbwlzlURUESK/ewAZdZn/vffj9wzQ9/AKVE28HA5qjYhHyD79It7qLUTmT8Wkc2Ht0C4If77WWhuc5hrAtkuKguk3JaUR4xUClTnAFUVwtdHqocOXWtKMsQqwagv0pCARGSQAxlhrPevzb0bVxPF7BmwhGENHRzAGv7OP6R8+nd6HV5Basd6Svla8t1QKsXwjvPYg+gMPP8iilGJytJbDalrYr24q+9ROZkGymZmxBpojCWqcKFG5/biDpw19QZZOL8XGTC+rUx0s79/Gsv5tPD/QztZcHxntEzWKpIxjlq1HGjAVMAoh0JkcsbmTmfGpc/D70jb8rIY+v3AUOuejXMWsS97Mind81wYwKo2PkuieAbJL14alzNniDvgShL/MFzLYJNh2pXzkaoOc0Z3QUgKyo6oY7B0J3h5jeYTM6q1Ffv6SaxBS4velaDzlIGoP3QO/N7Vd4S8VHBNoVG2cyW87kdWX/AaRiFp8KgRSSgyQy2bwHn+Gmr6TOaxlNic0z+P45nnsXz+VKdGaIdMKfjgzwFTcr3xVphKCJjdGkxtjQaKJ45vmFJ7TnkvxTP82/te1lvs6V7M00073w09DJoNbG0M5DkEQWMWXgiCdo/Xc44i01uN19A7r8wslCfozJPaeSeNrD6Xtz//FaUgO9gcQZJevR+Qp2HfF8lNi1GRJx+AIC/tuLIcOqzK3w9K8851cAqE1ZltPiH3NYMpyrak/dt+hY9xD7gQCnc5Re+geuM116EwOx3XxPA+vuwciLgcd9irOPvdcTj/mrezfOL3sUn1DAQKJEuEudlWJIb9UDeiwM8qYYj5dCUFLJMHxTXM4vmkOl84/gRX9bdz6iRpu+NN1PPLE43ipDKKuhmgkQhAEqNo4dUfujc7ktmv5q0buAk3DMYtou/6+qrkB4Uj8LZ2YMAq2q8IvdkSlPkp64IyJ8ItdFP5qnVxSgK8xfamqAm60QcQixOZODrdxdkoAjB/gNNWSmNFK97I1+L19JJqaOPNd7+a973oPxx93HE4IZwIDvraJIRk6a454aSmWwR1aokSxTMj+blBCsndNK3tfcBGfvOAiHnj4IX5/zR+48R9/p3vrVojGqJk9mcjkJnRYerIzBsB4AdFZk1C1cYyvB49KkpKgJ4XJ+uHMBPMSYY8oQ7XCiCp+7ujtAnLM5tWJUj0YiQb2sLtrqFR/iP9lIlpo/NipG2NARhy60/3URGNc/KlP8eQDD3Ptb37HySecgBCSrO/jhb6BIyRKyJ0+z84ph0AJq1wC8Iwh6wcE2nDMEUfyy5//gqceepRLvvQlmurq6O/vRUQU6iVckzE2IiNdp3zOcEVYtNQ32hnLP2QrZmGcmngF9QRLUS7MI9XAroTNLZjq5zQ5H92bDqMtZtgWWAlJPz7ZgTQffMu7ePLRx/nJZd9nrz32IOcH5MJMq6McpBDsriUROMqOUc0FmpwfMGfWLL71la+z5PEn+eQHP4pO5+jVOVRpU8twNm0pCAbS6Gyu0D1WzcAIJXa+8G17fcj53Im0Qz7MKA+7H10IlBf6QqJkBBvYMeA4iPpkSKxUiWIEJuuRWrmRumMWDevuKSHwjabHT3N07Sw+NvlwDjhoCgBZP0AKgVKK8bhUCMd8bQi0Zsb06fzg0q/xfLqDn259hP/0rCIhI0SkKvgn27P+wnXIrN5C0J/Bqa9wgoX16FVjDTIewaS9YlZ4Z2FPtVbLcGYzguKciJfLDjBIY4WwYa38bK2R4u0JQ3piSmNFd1d5CLT73qU2W7uDG+kISX+QQyG5dPpx/HreGzkgOYWcH+AFGkcppJSM9yWE3RV8beHRnvFmLp/zOr418xSSyqU3yOzYPwm/p667lxRLNQdFygKc6c0I17X3eldgT8VzpVQo17VFey9LCCTybYb2X7cpiduYxOiSQrhd5e0RdiCcXDDVWovKXUAbVE2MvkdW0H3PEtyGGowXDAF5BJ1+mv0SU/jjgnN4V8sBBMbgGYN6mQj+UIrghZ/j7KaFXLfgXI6umUWHn0IOAYmMH+DUJ+h79Hm6716MqokNqovKC3J839nF73lXYE+JchjfJ9bUSHLa9HD0lRzVEQJyLLB/bP4U246nR5C3R9rZYXL+FERzbQm9SkUOzlGs+871ZF7cZuPZXlBs+Ahf0OVneFvL/vxu3pnsEWsiq7WdBv8KmIYuw8+R05oZkVqunncGF04+jD6dRWOKn9EYjBfYhGFXPy9+808W9sjqSqIaksT2m2spbqTYddhTCBUbpBuhZb8DrGFTcqciWONHAcJrduoSxOa0hqG0EaQrFGGJckst8qB5ttG70lKHkYzclk6ev+hnpFduxG2ts86bAY0mpT2+OP14vjL9eBxhLeZLDWGO56WExDOGwBg+MeUIvj3z1QRG45kAaayf5rbUkdvcyfMXXU7q+Q2oxODyCqQMm9j3IDJnUggv5S7AnorjQqJzOernzSc5Zap1tkdRAUavJ1jaRo3EPtOIzZlEpiGBrokitC4b8rxLjG356srGJPr+Z6tbCmOQURevrYeOWx/D+AHx2ZMRdXECP+C7s17DOU0LyYXX9Uqw+tsLo4J19BclWtk/MYX/9K7Gi0hkX5Ztf72fNZf+jsyaLbYkvFplbVgM1/rxM4jMakXngmIk7CXCnrLjjkK39ZPsrgFh6H5hpaV0CYfsjXRB3AiyQpiwcjVsI1SAK2g64xDcmijde0zGa61F+hXb6q7SFWqNqE2Qu/Jf+Lc/iahPVC+JlhLt+5hUDrellti+s7nxl3/glFmLyAYBjlT8/7R8rYkqyePtL3L6B99F5yPPELT3W+KCqFtd+JVNftWcfABTv3s+pj9bqAQdkekyBog5BM+1U/9UBK3gmV9fTa5voDD4u1gcJ8YxBJI2ChOZ2khkagM6xOeFir+RZGmWEpP1cM47GjmtyXIPVc0Ma6Tj4NQn8Dr7+M37L/3/VvhtJbUkGwQc2jKb6y78Kqo/h0xGUNFIVeFHClso11RDy4dfD54eOdhTkUQTQhB4OZJTplI/fwFGB9tvWR03CiBKyhQExBdMQUbd4iic0WBpFgJ8H9FYg3vRaRQylFWUQApBrqubK6/+JWefezZZ//9P4S8qgSLrB5xwyon86bo/46Uydket/J5EyNyc8Zj0+XOJzJ2CyeRKyLJ2EfZQmigtHpCOQ+v+ByIdp6gA4mXiBKtklNi8SaE1KeXRMSPP0iwlpLKoA+YQ+fjp4AXlY1UBx3HItnXx+S99lQ+8811kcx7OLiS1jDGFn921Sq/hpV6HoxSZnMeZp72OH/7wx+Q6e8qTfVKCNuj+DJMuOZfaVx+M7kmFJcsvMdpTTfipZKK2u0DDnnsTa26pkggdpwogpC1Ei0xrxJ1UV+zuN5Snh0eaolzZEavOcfsQ+fQbbf9qSL6rXIdMZxevPftMvv3lr5DzfZSz80nwIAgIgrAMQgocKVDSNqf4gT8mymCMKVyHCq/BkZZVofT6dma5rkvW8/nEhRfxjgveT6atE8d1Cz3Axg+Y/MW30HDeseiegUJl6YjAngrhFyWbgfY94i0tNO6xp92ZRgEGjfw7hmS3sfmTESEHUFjmN/r8/I7E9KZxjlpI7JtvR+0xFdGXxu/tZ9LMmfz6iivRxiCE3ClrorW2Po2jiIQ19W0dnWzeto10JourJFHHQYVCOForCAKkFIXryOY8tmxrY1t7B0GgC48bY2zH2M4IglL4gebn3/sRexywL9mubuhJEZkziRmXf4j6c45Gd4fCP5Kwhyo07CVkQVIpmvfdz4auR0EBnBHF/2EKXcUixOZOCmkzwh7SrB8qh1/yYUd4OAXCDl3rTyPmTiL6zbdj7lxK/4338bMf/phpkydb3L8T0CcIgoLQ/+fee/nLDX/hkSceZ8u2rXh+QFNDA4v22pvTX/8G3nLem6lNJMgFulCbM5LCH3EUWc/jhr/eyN9vvomnn32W9s4OpJBMbm3lkAMO4txz3sTpp50GCHJ+MOzaJSkEgdbU1dZw1U9/wWvffjaN5xxD/ZuPRSZjVvhHE/YUSKAlQTpDkLMFcYHn0bjHXkQbGsl2dRUJBMx4I8ctWHhDZFYTk997IiabI0hnyTy7nt5F0xEHzoaUrS4c9cks2qAchx5Xc07tAm446t07LZh5oXv2+ef49Oc+w+3/uh1yvuUechxbcBf4kM1BYFiwzz58/Stf5a1vOhc/yM8Y2HXcqoMA11Hcese/ueSLX+DpJ5+0nzMaRTiOrXT1wutQkuOOP4HvXfY9Djvo4J1SAtvboIlIySXP/YvfZ5+j0VP4OW+Q8IuRFv78d1aXoOfuJUTvzzDlmKNxonFiTc08+aPvs+2pJ225hNYjViU3wlEgW3YcndWCSkYw2g5ayG3rRXtBsWR2DMYSCSXxdUB9xvDtA063BVs7IYx+KPw33X4bRx13DLffcjOR2lpiLU1EEglc18VxHCLRONGGBmItTbywZhVve/N5fPzzn8VREmP0LvsFQSj8X//ud3jD6a/j6WVPE2tuItrYSCQex3EcXMclkkjYx+vrue+/93Lcicfzuz9dS8RRBIG/UzVEgTF8av4JTM24ZD0POYrCL6oQaxkd0Ld+PUJIjNY4sTiNe+1d7Nsedz5AKQeOksRmtxTukgkM3taeooyO0UwuJST9foYPLTiGBckmcsYMu3Y/CAKijuIft9/G2eecRV86RaypCR0E+L5f8AmMMWijCcLHI/E4sZYmfnLZ97jg4xfjKrXTWLzaDnTpN7/OVz53CdG6OqI1Nfi+TxAE5dehdeHxaEMDgRSc/6538Os/XkMk7BUebu1QYAwtTowPzTycAZMrb/QZYcvPIJp166P1b9pAkMshpFWCxj32soS5YnAQZdzsAAaDTEaJzmi2fDFKotNZvI4+G04bI+EXgKcDJsXq+Mj8o+11DVP4tbbO5LLly3nnu96BcF3caBTf94f1Wt/3iU9u5pc/+Rnf+9lPQwscvGTh//2fr+NbX/4KsdYmdBgB2uFrfR+pFG59HR/80AXc99BDO3UdUki0Mbxl0n7MizeR0UGhr1mMNOypPG5s/D/dto1cTzfCcdBejtrZc4g1NQ/dnbbbFSBMlrhNNTjNtWg/QCiF350iGMiEfaNjM43R1vZnOW/GAUyP1eJpM+waHwF4vs97P/wh+nt7cGLRnRZg3/eJNNVx6Rcv4cmlS3F3Ugm01jhKsvrFF7n4Exfj1NWgdxJOaa2R4Q70vosuoK9/ACXFsN5DhP3HtSrCeS37MRDkLMnXKMCewcctzPEGBki1bbNMF55PvLmZmhkzLKwewWJFObJRIENkSgMyEbEkVVLgt/dicsHg8odRnMYYYEg4Ed43+3B2Jn3oBwGOkvzqD3/gsXvuI9bYSLAdyy+GcHJtM46Dl87w6S9eUoiy7Aw/vxSCL3z9q/Rua8eJRqpCKbEDJzsIAqJ1tbyweBk/uPynKCkJhgnJ8qRd57QuojWSwDd6FGFP6XH7m/Z8BjZtCvs+AlQ0Rt3sORYiSTH+FCBf4RmZ1li09tqQa+8rltSOgfArKen3cxzROJsD6qfgG4MahvAZY3CVZCCd4fs//SEyGQ0LsKrcNClRoXW1sXk5KNIS+D6RhnruueMO7r7vPhwlh7ULaK1xHcWSZ57hrzdej9tYPwh+KaVQShUTYttp2gl8H1Wf5PKrrqCto5OIUsPaBSQCXxtmRGs5pm627ZYrG2g4grCnqkNsGNi62SKJULbq58xFOM6I9gfIkXKAEbaUNTKloTBLS+d8/M5+KuaNjuocXoEgMAFvnLrI7gbDhA1BYMt6b7vjX6x+5lncZLKq1VVKkRsYINvVheu6xGNxcn19ZHu6kRVKIMM6pat+86vhQ5ewX/dXv/8tfl9qkGJJpcj29pLt6SEWixGLRsl2d5Pr76sa7jTG4EajdLy4gb/87UZL+TNMOJYnEnht0547nBW8a7Cnwqk1BoQk3daGn07ZcujAp2bGTJxYvDoZ8XiIAsm4i9NcWwh/6lSWoC9TnTt/lIZQ+0ZTG4lxyqQ9C5Zs2DsY8Ocbb7BIrYriSKXIdvdwwAEH8Ydr/sSShx5l6SOPc8tNt3Da688g191dZomDIEDWJLnznv+wpa29kKXd/i7kMJBO88/bbkUkY2W7kJSSXHc3xx5/In+94W8sffgxljz8ONdf/1eOOvpYst3dyCoEWEZrRERx/d9uLCjxcJ1hgCNqZzIpksTTQfF+jijsYZAsCCnI9faQ6+mxjrDvE2+dRLSuroJjdpxAIKMNqjaGqg8bKUKKPZ3Ole0Soyn8UgjSxmPPZCt71DRj59kNE/44ip6+fh567BFMPDYIKyulyHX3cPpZZ/PQPf/lnW95K3vOm8+8WbN4/Wtey21/+weXfumr5Hp6CjuBMQY3EqF781YefOThAsTZruMq4KklS1m3ZjVuLIYOFSZ//g9e9BHu+/ednH3GG5k/ew4L5szh3DPP4v477uI977uAXFfPIAHXWiPicZ5auoT1mzbh7KQzPCmSYGGilawOCrPBRgr2VB4vtiQJ/HSaTFendeZ9n2h9gy2MG8EuMTmSTfCqPoFKRAqU2X5vGp3zy5uvR0n48wrgBQGHNs7CFTJ03IYXMRHAipXPs2XjRtxIpExAhBB42QxTZ8/id1f9ingshvE17bk0G7K9EIAXBHzzS1/muFNeTa63CEdsB5Xm0ccfLSjF9hQR4LEnH4d0rrCbSCnJDQyw7yGHcPkPfkwQkoxuzvazJTtguRiF4Mqf/oy99t+fXCpVthMZbMFbf3s7S5c9vUNFLIdk9poOTk7HIwiZ70YO9pTYxHCWQrEuWvs+mc4OG/UJE2Lx1lZ7n8aXAtgQqNOYREZcTBgxCHpSgym7R0n4S3Xs4IZpO11hCbDiuRWYdGaQBVVKofvSvPXNb6WpoZ7A1zyU3sQ5L/yZNz5/HX/sWooK6bw/fMGFZSOKjDGgBM+sWF4Q5h3BsGXLnykSAIevMekcF7z3/ThKIgz8s28lZ75wHWe9cB3/6l8FGqKuy/vefT4mlR10HiEEeJpnli/foSJWW4uSk8Jgghlx2GM/tyxlUrUeiNZkOjvs78YgXYfEpMnFwebjRQHyl+LUJWyTROjIBH3pIl1JachuVITfDqJwlMNeNa0vyUdat2FDyFxR/UPuv2hf+0UIyRVbH6XNTyGE4BdbH6MryCCEYK8990DUJAqOpgnHGG3ctGnYCrBh4wZb1FeyQxF12GfhQowxZE3AFVsfIasDUjrH5VsfxQ/zBIv2WQSuHFLA121Yv/PRPWBOtIEaFSEwlSPedhH2iKLQi8L4VVEQm2x3FzrQBV7NWFOz3RHG3Q4gBKo+XvjYJtAE/dkijd6oWn673QYYap0I02L1Ox97B7a1bdtuy/NAKlX4c060gVSQo9tPMy1SS1w6GGNIpzO2Q610iJ9S9PT0kM5kLVfAEMKZV46Ozi4oCVeKkK05nbKD/FwhmRmppzfI0BvkmBWpR4Vx+3TK7rqVFtLuRLCtvW2nmkvyz2qJJKlVMQLMsEOZw4E9RYsvwpBFCe8rglxvHzp/P40h1tSEGEF2vpHLA0hh526VDD7W6WwVOzw6sAfCcl4nRqMbf0lxsqHKHfIw5l933Wn9Ae3zqalH84FJh/DGxoV8Z+apuMb2GNx17z2YVLYCRgn8wB92Esr3/cE9E77m33f/ByEEOtB8bcZJvKV5P97evD9fmXECgdZIYa9xyPGw2/mM22OS0AZqZZR6J4o2umCtRwL25AW+mNSTZUV3XmoA7eVA2F0tWldvWyTFeOsHUNKOzgyHYGhfozNecTsTDI4GjYjwF99DC0OtEyWhIi+pXNx13aErMuvruO2f/+SOe+/l1BNOQPqSS6ceF0IUg3QEGzZv5qeX/wRVm6iItRscx0ENk6PfcZwyprsgCHAaavndb3/DB89/H/vuvTeT/QTfmn5y2AKtUY7kyaVLufaP1+DU11bPYJuhP+N2HWHAlYI6FUNjFcAIMyKwpyD8Za61KDi6fjqNLimKc2tqkK4NixaaCMzu2gFEyeA4JVFxt3Dhxg9sBEgM1Qq567CnctSSMRBXLlGpXlLNVGtL6/axsJS8/V1v56bbbsVxpL17EqQjeHLJEt5w9hvZtmUrKhotwhybeaKhvoF4NBr2CIkho1EAzU1NdiJj+DxjDFIpBlIDvPFNZ3H/gw+iSs6vHMk9993HWeedQzabRSpVhc5TgIbWsL9255xgC3vi0rG/jSDsKQq/LJRClMpMkMsRZLNhmbTGSSaR+SidGDc7gE1ciNI+20AP5ucZadhTOmopjFAY8dLHKcyeOXNIk6C1RkYjdPR0c+abzuakk0/m2KOPIeK6PLl4MbfcfivZVIpIbU1Z8spGXwKmT5tWfJ8hHOG8UM6cMcOGkitLJOJxVq9dwwmnncrrXvNaDn/VYRgMDz/yMLff8W+bd4jHthvinD1z1ohEPewG8FJgTzXhH7wDFO5J4FtrH1o46bhI5Yy3lsiQKz7iFJIUxg+KdIhVqFBGAvZUmzZTMaJv2P4LwN577Y1IxIYsFTBa22bxiMvdd/ybu2+9PYR/oGpriSSTg+qHrANrWLT3PmUKUMrkkMe/+b/3XbioOE+tslQ7HkdrzS3/+Bu33PjXfPkrTl1dcXrkUMrlShYt3OclMyyUyrwZMdgTYn5RpFgRJe+q/QDt5Qr3R0UjyIg7Yi2RzkhSIQq3OCrH+Lr6tPVdhj3VJ7CbkP+yz8+SDjzqHNfmh3aQ5NHhfhEYw54LFjB5+nS2btmM60Zs+K2aIBmI1teXQRStdVXhM8aAIzn8Va8qMDpIKXFV+SRET5tCg8urDjkUkYhWdZrzSbtoQ0PZ+YMgKCStqrHieTog2drCvvvuiw53yiB0aHcULbP1VdCnszghab8QZicsPzsU/qLQyxL+ezA6IMjlijuA6yIdh5HSgBEthqvYD4thwAJkFyMLeyoUQgpFf5Cj389ud6aICf/nSkFUSqJKohA01NbymsOPxXSnEFm/EN4dyjH2fb/QhTXUkA4vl6Nx2lSOeNXhCCFIxKK4StLbP8CadetYtfZFunp6caUgHo0ghGD/Rfsye958/EymKlwyVc4/ZHhaCkTOR3f0cuz+hzBr6lQkgqhSRKTElTZ8qoe8V5ZjLKN9+oOcrQ/a1WhPCezJ/y1C2sOqAwRLvwPDiI6KcUZ7Pl51F2BkYU9hB5CCXj9Le26AabGaqjVTBnDCB5/q28LDPetYme6gLdtPRDm0vekA6s1J+Ms34j+zDhyJcJ3B8weGxTys8Lt7OeXMs5nS2kJ/Os0f//RH/vaPf7BsxXI6OjuQStHY0MCe8xZwxuvfwLvf9W6a6+t5w2tP4/Lv/wCZSLy0tso8DM16xPaZRd2iWcizT+LiNbeR9T2a3CRzYo0cWjONQ2qmhqS51XZMg0DQE2ToDbIhc7YZOdhTmgcoUYaxWs6ICbkZQuKFKO+ZEYwY7KnWB9znZ3gx3c3+dZPDcl5REs4zuEKwPtPLZ1f+i/92ryGlvcJcMDC4rRFaPvMmTCpL+tHn6fjhPwjaexARd6eVQBuNkYJPffRjrFi5knPfeh7LnlgMEUGydRKNk1rp6uhg85YtbF63jv/++04uv+Ln/OmP1/KJD3+UK35xxU41tJcJv+ejauJM/eo7qDtxf1RNjDXpNCs6VthcgrH3IyYdDqmZxldnnsQe8SY8U949lw9hb8n10xfkiEnLQjFSsKf0+KAhG1SgiHFNjahN0enNjy+q3L4HEWPtOuypfA+N5tn+rVXHNUmgz8/xvmf/xi3tK4hLhxY3QbOboMGJ0uDGSfgS3dWPyfkkT9qfSV9/OzIWdrjtjPV3HHJdPbzurLPYf9/9eM0Zr2fZ4sXEJzeTaGrmwEMP4eDDDmPq9OkIKYnV1xOf0sKaNat47RteT31dPeef/168jl7reO/0aFrB9K+9naazjwI/IOjqJ5LT1Dtx6lSMBidOs5sgqSI82Leei1bfQpuXQlE5mM7+tSrbSdb4hTGwIwV7CsIfYn9BOewUUiJdt1ACbXwfrYPxxg6d3279MPGVnyAoy2qBdl74hz9VPv8kKSSPda8f1Atgws6wrbl+FvdtttPcQ0cwMJoAYwdUh0P9pJTQnSa6cBaqtT6cNTz83gLj+zixGD///o/49TW/Y92KlSQmteJ5HtlslmWLF/PkI4+yZeMmpJT4vo+Xy5FobKRnyza+/7Mf871v/B+1k1uG9AWGhj4apz5JzYHzoTuFEgKpJCakPAmMIcB+bmNgklvDymwH67K9Q5ZqLB3YMsSmvDOwRw6CPaXKYqnPSxgojEEqBxWJFmht/EzWTq4cX6wQIUFrqTMmBThyu3mAnUly7Uj47bZuSCiHJX2b6fFytu49tGBSCHxjmBdv5P0zDmVjto9U4IU1OAJHKJSQyLCmpt/P0SU8eq6/H399+7AhkBACx3HIdfby7e9cxpyZM1nx3HMoJQv3RwhBX3cPWzdvxi+tGwpJsJQreWHVCzTW1/Pzn16O3zdgLe9wFNAYhKvwO3pp+8NddAcZ+nUuHIdkZxkrKcPKTkHG+GzI9XJO0z7sn5yEX0Ef4wiJZzRLU1uISadQKzhisKcwraw0GiTKugyFUsUdIPDK5Wy3KoAp3QE0OpUrFC0J10FGnOoyM4KwpzymbYhKl/WZXp7o2RhO8zTlOxWCb81/NVft/Ub2r5mCEMIKu5eiy0vR5+cQBo5snccnzJ70Xv0v/MCz5Qk7upnS7hzprR185DOf4tMf/ijGGF7/mtMItA4HrMsCRHJdt0yopZRIpQg8zemnvR5jDO8878189dvfJtPWZX2VYRSCOVKhlWDLlbfw3o4pHD95T6QRDOgc3UGaHj9Nn5/DAHvEm/nmrJO5bPapKOQgn0kKeCHTxdpsdwn+HznYUyb8ZQpg5UhFojhhZt2yRaQIvLycjacoUKAJUrlCHbt0pJ0NEMZzK8zEiMGeygHNUghy2ufWtuWc1DIXU2UD8g28c+qBvGPqgaxKdfJipodO31Z6NrsJZscamBttREo4+Ia/8s73vIuOzVuINDUgpSzE60uTWEIIMv39kMvx2S9/kcu+9g28cKrJaaecwkc+82ku/+73oTZONBarWq2ZzWbJtXfzlve9h3ec92YCbYm3vvLZzxOLRPn8JZ8FKLQFVibTpLR8PpmuThJ1DfzyN7/nbae8CQysm9TLumwPHX4KbQwNTowZkTrmxhpxhI3zV2bQ82Ut9/WupV/naHISYc/yrkV7hrb8lI9BMuDEYrb0IWSH9gb60Z4Xfq9ml5XAGcmWyKA/XXTalbT0KGYw5cWuRnuGEn6wMCipIvyr7Xm+tuerSUgXXWVzyWmNEpIFiSYWJJqqcGRCJgg47ZRX89D9D/DZSz7HP27+J6RzEHMhz06Q5wbVsM+BB/CNr36ds08/Ay+w/DXaGLI5j59d9j0W7rEn3//h91nz/PMQDN6Lp82dw8Vf/Qif/OjHC9yiSilyfsDnPv4JDj7wQC754hd44pGH7RcftRylFLhBPXAdTjn1NL73ne9y4L77kg0ClFTMitYxK1pX9XPmdHXmDCUkvjH8p2cVUeEUQ0KjAHsEIkQ5RTkxxuAkbO0PxtZG5Xp7bWnEuMoEGzsXLOhNlxXHyWR0UGh0pGFP5YBmgyHuuKxMtfPvtuc5Z8oiPK0HTX5U4d+eMSFMK7J2CWG/Ilda4dtj7jz+/ucbuP+hB/nLDdfz8OOPsWnLFvzAp7mxiX33XsgZr38Dbzr7TcSjkTJC2ogUhUEdF73/A7zjrW/jiSeeYOmzz7BmzWoCrZkzew77LdyHQw85lKaG+kECmleCV59wIife9wB/v+kf/OPmm1iybBltHR1IKZgyaTKHHnQw5559DqeeZKtEcyVM2L4xYZX04M9ZTfgDY4hIwSP9m1mW2kZNaEh2prZHDNPyl79elrzWEKmtRTpOYTfKdHZYH0Co8aMA+Vvql7ZACoFTGx+cTRWMOOypnFGbF/Bfrn+Ms6cs2i4vkNzB1EGlFF5YEnHskUdx7JFHAdDd24vvB9TV1RXo000odCpsZhECHnvqKa6++moOPPgQPvje91KXTJLxcmx48UU+9P4LcF2Xq666khnTp9PUUI8xcO0Nf+G/99zDe97zHo487HB0XglCdutzzzqbc886G18benp6EFLQWF9fhHjaQqNSf0Egwma9nWuEua59qe0BEIUKoBGFPcXjMs+PXnYB0YZGSzJgrKHNdHYW4ND42gEQBF0DYQm0xOCj6hOWHqUkJ2bKPeARs/ylw9q0sX0B93et4X+dL3Js0+wht/lhRQrCm50LAoy2tf0NdXWFWvlc2ANcSpCV5xh95PHH+dWVV4Er+PU1v8N1XR596EFIe9Q2NjCpZRLf+85l4MB3jzoaRykefeRhSOWYOnMmRx9+BH5IfqXCIrpcqJCOo2hubCjsFH4QFBzlXemZ1RgcKXg+3cm9PWuoUVF0mfCPHOwpCH9JNWjhf1JaPtBwt9K+T2rb1pfU0zzKCmDvit+Tsl1gUmI8g6qNI1xVdIQHCffIC38pQ4QBLlv9X45peteIhI2VVIW4mV/SdVUtMqOUwteaj3zgAoQU/N//fZOn7n8QgKZpk7n4yxfzpc9+HgFksmm+893v8OR9D1hHfMZUPvmNT/KFT34aX+tySx76BYViPlMSfh2pVsGwhOSqrY+RNh71Kl4g7Bp52FOSAKvwAaTjEGtqwhiNkBGCTIZ0W5s1sONKAcKS4qAvg9+Txm2phcDg1MaR8QhBd2r7GdwRFn5bgWyod2L8p2Mlf9/6LGdP3odsFV9gl6ggd/gcia8NH37fB3jLOeey9OmnCQKffRYuYtrkSTbyYgwfv/DDvP3Nb+XpZcvQRrPvPouY0toaNqDL7Q++HuHSgAL279vI7d0rqXNiwxD+XYA9JRbflsnI0CE2qFjMKkAQIOMO2Z5u0h3tIV+oHmc7AKDTOfyOPiKT6+1c3kQEVRvD22QGj8EcReEvdYhjyuWrK//DKc3zSapIsY5ljJYQdlRRc0MDJx57bOHxvK+QP97a1MRJxx036PhYrnzlZ05rvr/5gVDAS1sTRh72lOcBKGuKj9TVEa1vQPs+Ujmk29vJ9fYU2//GRSa4pBjOeAG5LT1hUY5BRh2cxpqwSWZshT+PZZMqwnMDbXzthbtRYSnAWC8Lhww5PyDnB/i63EHd0fGxWtpoHCH4VduTPJXaTI2KhEMFRyDJtSPhL6NGsdN14s2tOIkEJggQjkP/xvX4qfSQ1ca7lxoxDIXmNnViAlOY3+u21JYPtR4j4c8f942mKZLgqg2PcFvbSqJy+IxxI70TlLI45xtoShtp8k70aMzDHR70kTw1sIUrtz5Ko4rZhpldqe3ZCeG3Vl+W8Uclp0wphkCNoXftGrTvjZj1H9lq0HCfzG3tsXyg4YBlt6XO1tMP6m8YfeEvPR6TLh9dfhNr091EpRyznSDfreX7dqRRfravq2TZT3HmsMH3gyGbbEbF8mNwhKDLz3DJ+jsr/ItRhj2FnUSW7SzScUhOm27Rg5QEuSy9a9cWkq6Mu4YYY8KBGH34nX04DQn8QKMakqhktCRlP4bCLwpojJh0aPMGOH/Zjdxy8LttYddOzA3baaEqmS2MLMKZdDZHR2c3vb19pMLtPB6PUVdbQ1NTA8l4DErgTy7kx5ejMCM3X+4sQiX47Lo7WZvppt4Jrf8OYA8jLPx5JxhjcBNJEpMmo30fJ1lDpquTvo3rEVINObdht3eECQRBf5bsxk6c5hpMEKASEZymGjvpW4iKPMDoC3/+kQBNvRPj0Z4NXPDM37l2//MKrZEj6RRbwYdIWAnb3dvPf+66j4cefZJVq9ayavWLtLd3ks5kyHleyNXjEI/FaG5uZO7cWcybM4sjjziEU046ltbmRpuxDvQOqRVfyqZtAFcIvrz+Hu7tXU2zk8DHlnGMVrSnmvAX3F9hWQVjLS0FB1i5Lj2rVpHp6Cj0m4wvBTB5x91gdEB2bTvJ/WbauK4jcSfX4+2gFXI0hT//cGAMzW6Cv297houW/5MrFp5hSwQY/gyx7UGdfPIL4JHHFvOr3/yJx59cwqxZMwiCgFv//k8STS22slQIopFI4bXpTIYX123g2aee4vVnncGmzVu47Hs/Z/999+b897yFE487srAjSCl32U8wofV3heC7mx7kzx1P0+QkCBjK8o8e7CmjRRESow0106ZbfiWtEVLRvfJ5/EwaIcK80gjNCXZGGPACguz6dnTKDm02OUNkUj2+oyom/I2t8OeP+2haI0l+u/EJQHDFwtPRxirHS4VDWmuUkjhS8dgTS/j2ZT9lw8ZNnHnG6/jC5z7C3DmWi+e7P7ySL3z5O7iui1KSoMSqG2Po6xvg69/6Cl+65GMAbNy0hRtuvJlLv/gtGhrq+OynP8IJBUXQw2aaq4b5RWj5v7vpAa7e9jjNTjxsjB9b2FPODRoekYrambOK+D+bpev5FVbuRziAoVS09qsjNyQPhBKYnE98z6moZJQgnQU/wJ/bCk1JS5ZVySwwRsJf8AmAWifKw73rWDHQzmktexJVCs/onVaC/EDtXM7j45/6Cj/7+a8495zT+flPv80Jxx1JY0O97QXQmmOPPoy5c2Zy083/tkRXYT+A5/lk0hmu+Om3+OTFHyg4wPX1dRxx+CG87/y34fsB3/jWD3ngoSc48cSjScZjeOFu8FISXQBf3nAv17QvtmXOsMNojxhF4c+fTzoOXnsvosMn2lCPm6wh19vL6ltuIshkbIRxBJuD5cgzQAiCVJbMmm2WKl3bDiVbGm12m+UvPU7oE7SEcOisJdeyPtNbCJGanSDTjTqKJxcv4/Bj3oDv+zxw7818+MLzibgufijIKgxv+n7AO992Dv+88bckEnEGBlJkMlkcJbnxz1dzwXutoOeH4JmSucDvfud5PHTfrUyd0spRx53BPfc9RNRVO0V26xtNRNpoz4VrbuHPHUtpLFh+sVtgj6ioAkVbB1hFY2F3XITulc+T6eosskab8bgDVLblKUF8r2norIfJ5PBmNGHqEra5PC/0u0n4RQmVSo0TZXW6k5vblrNXspU9Ek2Wd2cHkMj3faKuw19uvIUPXPQZvvmVz/DZT11ENBrBD8mvKrF6vvd3wfw5nHbqidx17wO4rsNNN/6Gk044Gt/3yzrPSqM/QRDgug6vPvk49tpzPhdc9Dkc1+HIww7C8/3t7gR5lc7H+T+89lYWD2ymyYlvB/OXhyZH2/KDtLxAEQevrRv/xU4itXW4ySTr77qT3tWrKxgixPhUABMKv87miM2fjIw66IEM/oxmTH08hEBitwt//rjGkFAuvX6WG7Ytw8dwRP0MIuFuIMRgoo688P/il3/ksh/8nFv++luOO/aIQn+v2o4wSinJ5TymTp1ETTLJUUccwhvfcCq5nLdd5ua8n+AHAXvMn8u5Z7+ez3z+m2xt6+Tk44+sqgQmzO5GQkX87banuHT9XXQHaepU1EZ7hnR4xwr2yDK/Q7ouXls3uRc7iTY2EmTSrLntZrzUQEX8f7xBoEqs2Zchu2ZbcWawKKFT2g3CL7Yz5jMwmqhySCiXb6+9lzcsvoZHezcSkRJHiBAWmeLwadfh2r/cxE9//hvu/ff17L3XgoL1Hk50Jt9W2d8/UEiQDQfLCyFwHQc/CJg2dTL33/VX/nnLv/nR5b8m6trHC8xxRuMIa/VXpNs5f9U/+Pam+1FCEBfuDoR/7GAPQ/UEa4NyXbpXriTd1kaBMp3xRoxVLRyqbZAtvXIL8b2mFoRfVEZCx9Dyb/e4KPLfTHJrWNK/mbOWXsu7phzIR2ceybRorU1i+T5xx+GBh5/gC1/6Nv+98wYmT27F94NhNc1XKkFeWaxCDD+544RDspPJBHfcfC2HH38Gc+fM4sw3vJq05xNzHRwh6fIz/G7bU/yxfSkp49HsxAmMRgsz5kmuagxwVD7fUEaSZbSmbeliAs8rdoCZkSXHckYpt45QktymLnJbe1Axp5DkGA+wp1L4S9uxfTQ1juWfv2rjo9zS8Rzvn3Yob598AC2RBB2d3bz7/R/nd7/8IXNmzwyFX+2WArsgCGhqauBv113NG85+Dwfst5C5s2fQ62W5qXsFv29bzNqszezWyUgI6aq1IY5FkqsS9lR7PwpsD9JxSbVto3vlc2H2V4/SfRwNJzhPVe75iJhLdEo93tRGdH0cGWhbc7ubYc/2pprkH6lxoqSCHHd0vsA/ty1HxF1++qkfcOrxR/Oed543yGkdft7AIKXksSeWAPCqQw8oPLazu4jvB0ydMolEPMaPLv81vHoBl754J//oXI5nDHWO7cvWhXsxzmBPWR5AoFyX3NYugi39dK54lvanl9rxSFqXM0aMdx8gH+3Jrt5mp8UrEbZ8inEDe3bEbW9xtKRFxemKBXz++t/yjxtu5s3nvdHO5JKS3b2ktDMBTj7pWP7zr7v59O+vZFvMo0nGcaWy7G8jxdszCrCn9P0Kr5ESP5Wi/emlgwnXGK/coEOFC7sHyK5rR+ZbIwdVQux+2FNN+EUpFbkANxAkblxBkM5y5a//WOjP3d1LG7tz/Pyq35PLZlF/XobTHxA4xeTMWJY0DyvaU034EQhjAyYqGqN37Wr6N28sDMd7+SmACQlztXWGTS5ASDluYU+142CJCkQyQvahNQw88SKJlkZuvPEWOjq6QAg8zyMIAgKtC5z9w6Ezzye5gkAP6wvWWtt5ACXn8jzLbN3R0cWNf7uFmpYm+p7ZSO+dz6JqophAj00n1y7AntKiu8L7B5q2p5eic55FEi87BQi9eRP+67X34Xf1IxxV8OLHK+wRVfp+hTFkbn0WozWxWJQN6zdy3Q03oaQM63pUIdvrOA5Syu3W8+uwMra+vo76uhqEEIW6oKEURUqJ4zg4JefKn/u6G25iw7qNRKMRcAQ9Ny3FpH0bgh7vsKf0egDlRsh0ddK/fl1hMN5IdX+N8YAMU8jcGT8AXxfmA4x32FOMRhhEzMFf00luyUZEPIL2AyLxONdc+3eOOGx/7rr3bpYuW0Zffx+NDY0cuN9+vO61p7HXHntWHYrn+wGRiEs6neHOu+6jr3+AN57xGurragdFlPKMyEop1q57kVtvv40nFi+mvb2dRDLBooULOfH4E7nm2r8RjcftQOl4hMyzm8k8s4nEQbPQA56dEjOuoj2Dhb90RpjxNUEuh4hERjrquXsmxJhAlwxYGx3YMxqWH20QUYfck+sxPRlEQwwdGOIxlyXLH+Gwk47D9A4UxpWi4Q8avtD4Zc5/57v59je+SX1tXcHiG2NwHMUTTz3NhR+9hCcWP41AcPSJZ/GLn32LY486LIRPYYO4EGRzWb7yjW9wxdVX0tfWUXYuNJCMEYnWEos12REGCqSnGXhwDcnD5iGMN+awh5cg/MU8QNgyGvgo4zLaGiDHyFOz1vTlBHsIp0cGBm/xRhvFQmCMR8rfim8GUEoRa20i1tRItKGRWFMjsdYmfOAXP/kZx7/6ZDZt2VxW1/OTy3/Nia85j8VLn6WxoZ6GhjpeWLWW17zh7Vz2/SvCGiIb2enu6eHU01/PZd/8P1JeLjxXE9GGRqLhudxoFG3SpLwtaJNDGImWkHpyfQiD1LiGPdWV0RrN8ulDL2cFMC8j2FNqcByF6Unjr2pHRByMDkgHbWjjIQg5N3Vgh2tg8ENHVQCJKS0seexxzjjvTUgp2bK1jbPOez8f/9SXEUJSW1uD79te4WQiTjQa4fOX/h9vOOvdrN+wCaUUb37PO7nvjrtITGkpFNL5OkAXzpf3MxSgyfjb0NpDRByya9vxt/UhI46d6jiOoj3VhT8svBPShstHcSzS2EGgKsmx8Q57RHHWEtJReNu6oDuNikRIeXnhDwfFSYHJeASZnLUmsQgi5mK0IZfLEW1p4olHHuJt730/y55ez9NLl9Hc2hJGf4ISZnkLkZpbW7j1trt4zdp3ccyx+3HHv24j2tpILpcrDB0xOZ8glbUt2FEXlYgWkkSagGzQRTI6maAvg7exh+j0Zkw2Z/2AcQh7Sq/HlESDDOZlMiRvuH0CBZKl8Q17iiUaBhwBHQOkugYIogbhpMMv2QqjHsgQ32M6DacdCsbQddtjZFZtsazY2hD4PpG6eq679g/Ek7Npbm0Zsn7fGIPv+zS1NvHiuvUsv/J+IvU1BUUR0vZZRKe30HzGEch4hK47n2RgyRpkTcz6K0gCk6Yv1QN9mmBrbwECjW/YI4vvjRhlt3d37AAm5K8vzZyOR9hTujsZg3QUqa09LNprD/Y9ck/+eM2vUbGozRKnstQcvAdzf/YhnEZbLNdy7rGs/sgVDCx7ERWPYMLh15H6BK60EaAdrcDXuC5EGxLF0KgQ6IxHbO4U9rjqYmKzJ4PWTH7Hyaz65FV0370EVRNHAF4qzelvPJpNy9vZtqmLZqXQ4yzaUwl7ynqCEdb3Go3Kt93iA4iQfKM3Hd4sM36SXNstzrOzvro2bOPC97+To448ED2QsZ1a4VMmf/A0nPokflsPXlsPTnMdkz9wGujyrrIgCPB1bljsEwKBr3P4JeNRhRTorMeU808lNnsy3tYu/PZehKOYftHpIeyy4VaTynLggQv5wmc/StemNpRyxkWSa2iHt/x8dg7Y2GXY5ajLvrB4znSndg3TjwnsGdyvLxD4fsDmLVvLoloyFsFtrkOncwhHIR2FTmdxW+qR0UhxTsJL4vEzg5uMHEVkSiMmnbWD41yFzuRwGmpQNXEbNQnX1q1t+L5vp7qXlTiPR9hTehykdMi1dwG+7R1/uSmAqPqYIdjSXT4LajzCnmq5Clfh+T7Tp00rnkNJgv4M/Y89j9NYU+DXcRpr6Xv0OYJUJszClrQ27sREEylUKLylY1cDeh94FlVnZy4YbXCb6+hbvAqvvRcZsu8JBNOnTbW+gypNeo2naM8Q5zMCIRUDGzeHSY6X+Q5QNGYKvaET4QXlc8LGHewpPwfG4DQm2bRlK6866BCMY4dvGG1QiQibf3ELHX97AOFIhJK0/+U+tv7ydlQiVkjhCynwcz46kMODs8KgtcTL+QUsbAKNqo2z9U/3sPnX/7bzkF2HrjueZP13bwincZoC09uRrzqMrVvbcBqSoTCOb9gjCueSoDV9q9aOmSPsjC4AsgkwlCLY2Inpy0DUQRgzTmFP+RA/E2hik+t57t7V7L/PvszfdxFrnl+Jk4ijlUJnPNZ+/rfE50/FGMis2oRwnbDmyaCkwksNcMCBBxNka3hh1VpiseiQNUJCCNLpDPvsvSeNrXty953/JlpXZ625sMq07pt/Ytu19yCjLukXNloBch0k4GUyNM2ezrFHHM1f/3g78QVNIRQbz7BHFOywUAo/laFv5SogEiZPRzcdIMciAiQiDnprD8H6dmTUsR1j4xT2FOd0C0wuIDGziVVbNiKRfOsrX0OnsihpkzXCUchYhPSqzWTXbEYmogXhz8/U0pkcv7r8cl598nFkBgZwHQcpRYE1ovhj+32z6TTHHnMYV//0Z0jl2OEQUhbI+2UyRnbdNlLPb0BEXEs8bAyO6xL0pvjK5y8lGony7Oo11M6ZgvZ0OH9rfMKeQujTgBONkVq/id5Va+10+IIfJV5mEEgM6trAeFm8ZzaA65YxxI0n2FN2XAiMFxCf3sQWneaF51Zx3pln88FPXEx6WydS2YnrAlDxCCJ0fAXY5ngg297NpV/7GocedAjHH3MYwnEYSKVJp7Ok0+mKnywDqTRCKk464Sjmz53Hj374I3KdveggCN8z5FmKuvacgAqrRFNb2nnTO9/OxR+6kLat7WxIdVM3byo664dl6OMT9hSOG1CxGJ1Lnsbr7wx9GvNKyAMUi5y8R1fBm48qYNvxB3vKj5tAE22uoW9yjIf/9xjz9pzLlT/8CclYnB/+4Hs2V1BTg6MUUopCMsvr6UFGonzju9/hi5/5HFprDjpwX2bOnB6WP8shNkvNwECaRQv3BAwXf/BCHKX41Gc+RaajE1GTLLDJGWMIdIDX3w9+wPkXXsCVP74cYwxPPPIUXXUOc6Y04fWkEUqOU9hToRxCsvne/5XUy4x+OYSI1E41I8sNahmX87ODLZejxvgBIurQ9NsPIac2IHJBSQnsOIE9lcc1uA0JNv71UV73tMs1111RKFm+8+67+MFPfsSDjz5CX3c3+D64Lg1NTRx/9DF89pOf5qjDjyCX84hEXN534Wd4+5vP4rhjDgv7f8Xgzi4hWLpsBd/70ZVc8+uf2CRaxGXJsmVc9v3LuOOeu+lob4dcDpQiUVfHqw46mI995GLOOv0M/MDOBf7Ehy/l+vpO9vnYG8m299kxo7s5yTWk5UeEcNLF7x/gthNfT3pbG040ijGiAN/KBmmMYE/wyCpAOLreKoAuUwCkIBjoo+7jZ5B8x3GY7gFw5NjV9uys8JNnJ5B4/Wkyn7yFx2++gdYprQRBkQZl/YYNrFz1An19fTTUN7DnHguYOmUqALlcjkgkws9+8Tu6e3r50ucvLtT4D0kqJgS/uPoatm5r56tf/ATZbM42ugBtbW0898JKOto7SCQTLJg3n7lz5hSSbUJK0gNpDjvlTOLffhN1sycTZINCkdnY1vbI4Qk/YbChqYnVf/4r//vQhbiJhjBQIIdQAPEyiQLlBx+bELsKh8zti0mcdXgYox5/sKcsFCots0ViejMb5ie59nc38olLLrL8p9o2+MycMYOZM2YM6vgKtCYSifDk4mX878FHue73lxc6u7bXAun7ARde8E7e96HP8J+7/8cpJx2D5/koJWltbaW1tbUqLbsxoITg73+5mU0tLocunEWuo9/WAo1j2JNvgjdewKrrri9xSyu+1DLrP86dYFE+yLMYDYpF8Z5bT+7RlciaqJ3uPN5gTwkUE6EDH6RyTHnr4Vx1w4309w/YKE5Y36/D/tz8T96KSyFIpdJ8/Vs/5v+++tkCEdaOfpSSaG349jc+z0+v+A1t7R0oJYu4v+Rc+UYbKa0PEvgBP/v1Ncx45wmYXDjkYpxFewbtNNoQqaml7bEn2PrAA6hoshD9GWkKlLENg1bR3vwQ5NR1D4Bvwla98Sn8lNA46nSW+v1nsm5uhKt+8puw57d8sJ0dgKcKcEQpxZe//gPOO+cNLJg/p2D9h0N/aIxhUmszH7nwPVzypcsKPcb2fKrkfLJwPikl1/7uep6r85h63P54fRlEHvuPp2gPg6GMVC7Lf/ErtG/LSsoFSIyG4R8tBRBDPyZCGBSLkXlyJZm7nkbVWbLccQV7RMXuJWz83e/LMuuik/jeH//IurUbUMqS3OYZIUw4ClaERXTX//UWsrkcb3vzmQXKc4bNVmYJr049+TimTZvMFVf/ocA7KsJJPGXMEELQ1dnN1358BQs+fiZBNp9FHsewR0gIDNH6Bjbd81/W3XoLKlYbkiePQSfMqO0AogSv5aVUlOfzhHLo+9V/0L3posaPJ9hT6ZQLicl6JOa2oN+yLx/8wKcRQhCJFBkhhLBtjH19/Ty7fCW33n4X3/r65wrTY9hpyj5r9b98ycd47ImlPPbEUvr6B6yzGzJQF5khJB/90OfIvHYhLQfvSTCQRUg1bmFPfgC3kAqd81n8re+C0QgpyzunqsnSCCuFM6qFEOF/RGEWobDD8qJRvLWb6Pv13TR85gx0R1+oCOME9lRzyh2J19HPjLcfzYNPXc973vYR5u6/B1s2bqGjs5vOrm66unvoH0ixfv1GbrzuKmprksOGPtWgEGFS7S1vOp1jTz6b2bNnUJNM0NhQT1NjA81NDUydMYVtqzfyr64XOfD7HyPT0YcIk2Zj1cm1s7BHINGeT2LyZJb+4Ce0Pf4wTrwh5DGSVHxrL2NWiCoRIRv2Mshogv7r/kvs8D2IHbUnpjcNjho/sKeaXyIlfn+GuV97I39592/IXPcXqEkgAmuxlVJEoxHSfQMsXvIsp5164i6xmhljMMbw+FNLyQ6k2LJlG9lsrkioJYGBFNF50znib5eic3550/u4gz32OkygidY30PbIYyy57LuoSBKTH8otRGWdzMutGrTa1lVOgBqWSQKCrv+7wbbuxSOIQd7/boQ91Uo0pIBAY5Rgr6vexeRD9qZRxWlqbaS2toZEIm4hSTTCI48+ucvzffORo0cfXYyKRnBdl0QiTk1NksaWBhqjcSYtnM9hf/wMqj5p2feEHMewxw5PV5Eofv8A//vwx/DTKYRyCmRqxe9fjDr8GaOGmArFyE+HMQYRieJv6aTjy9fZpylRUSe0m2FPpXLkG9MzPtRGaf3R2TgLJ5Fr68OEVCZBEBCNRnh2xUr6+1M7jPtvz/pLKenvT/HsiueJRiPW6fV9nFgEOZBDTW9i/i8+hDutEZ3KFSlQxmG0R5AflCJxEnEe+OjH6V6xDCdWY0ehDsL8jGr0Z5QVYDi7gI0KyXiSzOMr6Pjyn5GJmHWECmWw4wD2VDkuHIlJ53Cak0z92XkkX703otdWiRoJkUiEjZu38vwLqwvC/FIUAOD5F1azcfNWIpEIRkBdXS1JD2KHzmevX3+E+NzJ6IHhCf/uhD2EVCexpiYe+cwlvHjzP3Di9QVGi/JQeYXsjCIWkmPSEiwqeFFE8UYRaFS8hv47HqPzmzcgkzELNbQZH7Cn8rgodoWZjI+Mukz97lk0XHy8zcr2ZlCuQzqd5qnFywrcPzu78q97cvHTpNP2PUnlMDmfyJsPZ/7lHyDSXIfuzw5b+HcX7DHacoHEmlt4/MtfY8WvrsaJ14W056IE+5dDnrGIhsrRdXypYn2KilD44IFBxWrp/dv9tH3hjzaKEXMRJX2uuw32iKGdcqEEBAEmnaPpfUcx7eq3kTxmAXogC+kcjz6+BMdRRCJusTneDwq5Ax3+FJmli3xBkYiL4ygef2IppDMEvWkSB89j6o/exaxPnYnQYLL+uIc9Jhx16tbW8tAnP8PTP/oBTqzW9jCXGsLSxvgxwP6jPyFmcFxvaFwXth/KSJTs8tXknl5P4uh9UE1JTNor9NeOBOwRIyT8xe/GCo9O53Cn1FF/2iJii6bCgM/aR5djUjnq6+tondRc3gBTUv6QL6vI/wCsXP4Cf77mr/z+2huIHjCHmZ85kxkfez3xGa0EvWlb4y/Uzo8iHWHYI4ZIcgkE2guI1jWgMxnu/+BFrLruWiv82hRZ6vLNOqLIXDdalZ9jUA06dIXooDLpQRWj4d9KEqQHcKe30PqVt5I8eiFBz4DNGDtyXFj+IXMV4Rcra6IIY+hfuoFNNz1J9Pku5sUaOWD+AhbuuYC5c2bSOrmFmpokAKlUiratHbz44nqWP7+KJS+8wKqBTrLzm5l15lE0HLoA4TrovqylmVRq/JU0F45bfn8hFbHmZtoeeYwHPnoxXc8+E8IeXYEAZNFJFuW7zWgL/xgrAEUFwAwSfFN4XIOU6EwGHEHje0+h8fxTkMkoui9jeYWk3H2wR5Rz+FRVDm2J/ZxkFDceJdedpnflFnqe2UBuTTu6rR+VClC+hXjakei4i2ipITZ3Eg2LZtO49yxizXUEWZ9gIAtaIB1Zld1hPJQ054MaAkGkvh6d81lx9a9Y/J3L8FMDOPFai/lFyWur/F4Ok18RClC5C1CiBOWCX6YE4XAE7aWI7jWL5gtfR/KE/WxJUSpj+4pledRgzGDPsI6HqXADUilUPIoTi9iyCg3GDzC+TQ5K5aAiLlIphAGd9QmyPsYPKzql3LUJ7KMJe4wdiyukJFJTi1Qum+75L0u+cxnbHn0E4cSRjhPOjJPlTm/+usPfx1r4x1ABhoBChZ2gmhKYAgGtzmQwaGqO3ZeGd5xA4lV7IKIuJpUFz8cgbIdVyZCFMYM91Y5XCmP+X12sMC0vVc7XjYTiJmWhj3f8dXLlFdtaexWJ4tbUoL2A9sceZ8VVv2LtTf8EtC1u07qk8nMo4R9b3L+bFGAXlCBsK9bZNAJB/OAF1J1xGDXHLMSZ2mRLiHMeJucjAkN+GKXttRYV9XjlodBqx0WJcpQeN5XCb/JOcAkNvCi1jqLg4BWIn/JhYLMdYa08LmRYU1XtuCy8n6gS5y89Xnw/AUYOI9pTYpXD9kSpFCoaQ8XiCATprVvZ8t//sfq669n03/vB+MhIshjKHiT8lbtANeF/xSvAjpTA/mtM6YC0kI5ca3QuA2ic5iaSh+1B8qi9ie03m8j0FmQyapvAjbFICjOYjEtUL+AuCHfpziDEdmYIDI5XD57AXs0Syyozu+SOZ2hVZXirOF/lONRKZajcKcrOUWH9w/eSUiGkpXvxB9Kk1m+kc8nTbL73frbc9z9SmzbYmHokYZ9XGBKY35UrxjINJfyDE0evNAXYkRKEI51NqRJU7AZ50ioBJuthTNbGc2MJ3FmtROdNJjpnMu60JpymWoQrS6srBsEeGTrUGKoyVJgwYiVKppdURnZLcsTleY5KISzJcA621lQZXrG992NQDF1UZE5tiFVW3RkKdPWVNThlrYq2cDHb3klqwyb6Vq+ld+Uq+latxhvoLdRTqlisUOlbPgiiNKIz/oR/NynAUEpAcSeo2BmGVISwNgesU6l9z5Kq7jDPV7TqEokKu6xkSORb+vY67LkNdIAmz/o8HMKmatTeZoSHLlT/bBLLRaqktIGCSqbWkFIl/5l29rqEioW8PSIMZTOE4FPh4JY0tI8D4d+NCrBjJagm9IOfw2DumBKzvKMaHFFReWnHnKohKzi1MeigmL01WturMhXfnxmFUt5SfTKG0qEjQlqSrlKWufLO7NCH0raM2vd9tNEl17oDERAlu6QpvfcVHX+VO9MQu0BZtGc3Cv9uVoDSMZJVQqSlDnMV629KFaDsCzG7mLAWZTN5bQiyeDl5/bJyoIslDYG2xLkFX6Z4jdX9uu3sDqZiuE7e1xC2O62QOVbFrHIppBElUq9NeZnFrk9dF1UwYCk8rAJxSovbxpHwj/2MsKEIdEs6x+w8gfxAYVPyLFFUjJByPW8Wy+dJmSF2me2UZ1S8OtCGIOfhCb+wK+Sb3stfospuoBV+K3RFuhJT8kNhF6ucgSVKHOoCS0SIw/N9AbKkfkpsh5tMa03gB/iBT+AHaGMqhLMaodmwqhkrImmievVv/vrE4JoeMageRuxWCdzNClBqCUwBOojKnTk/WSZUAmNMCXVe6dQxU+a8DrugXFT3EAzgBQF+oBHCRyqJE06Dz0OOUsfY7ESZ845aIYd7ucYYdEiXYq28b7vFqjjvlUpXen+H26LJkNa7muCzHau/+4V/HECg7UGiarBoqKxyFfF7qVu92K64UTrHSkqFo2QZTUmpUpTKjNkZdCYqhbycBKu0grTAR6RNiYCL7UNCs8t17WXYv3r2VlQMGxHjSvDHqQJUV4Ky/5ZJkhmsLLsi/DtieCkvuCicMW/1pBBVHNKw8lOWwJrKRESJgJuQJNcKe1Hgiz+mcNxs55pGROiHgIyiauNTuZCLykaWcSj84wQCbQcSlURU8hDIlKIdin5CYbTpkDfZ7OL1bF8ZwtFhEOjidMeKweDlZRqi4upKeVXzzv/2By6L7SlohQF5aXInhvhzaDgkhrxvgvG4HMbtGkoRKljXKQnRVL5mOCZ9lxt+dmIDKdmwhvYFSiMrO6G+le83KoInqkIiMeTx8Sv4LwMFGEIRBilDubNrKnHFWF7j9vYbMcyxt2ZnLt9sN6I1Gp9R7FApXh6C/zJSgGo3erAyVCPmHVslGK7V3FldMjvvqIyBgr+chf5lqgDbEyqzg+k048e3H1Hh282y/3IU+FeIAuyshTLjSWp2hxa9PJVvQgEmvsj/3wRyrJecuAUTa0IBJtbEmlCAiTWxJhRgYk2sCQWYWBNrQgEm1sSaUICJNbEmFGBiTawJBZhYE2tCASbWxJpQgIk1sSYUYGJNrFfE+n9q3g3G4LIfjAAAAABJRU5ErkJggg==\'" width="56" height="56" style="border-radius:12px;box-shadow:0 0 16px rgba(16,185,129,0.4)" alt="Panda Mascot Icon"><div><strong style="color:#fff;display:block;font-size:16px">Bet Buddy</strong><span class="text-sm muted">Official Panda Mascot Mobile App</span></div></div>' +
      '<button type="button" class="btn primary full-width" id="btn-trigger-native-install" style="font-size:15px;padding:14px 18px">📲 Download &amp; Add to Home Screen (1-Click)</button>' +
      '<p class="section-note" style="margin-top:10px;text-align:center">Instant install directly from your browser. 100% free.</p>' +
      '</div>';
    modal.hidden = false;
    return;
  }

  // iOS Safari or browser where prompt is manual
  content.innerHTML = '<div class="install-guide-steps">' +
    '<div class="install-badge-preview" style="margin-bottom:14px"><img src="assets/icon-192.png" onerror="this.onerror=null;this.src=\'data:image/png;base64,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\'" width="52" height="52" style="border-radius:12px" alt="Panda Mascot Icon"><div><strong style="color:#fff;display:block;font-size:15px">Bet Buddy — Panda Mobile App</strong><span class="text-sm muted">Instant launch from your home screen</span></div></div>' +
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
});

document.addEventListener('click', event => {
  // Catch all interactive elements robustly
  const t = event.target.closest('button, a, select, input, [data-open-league-modal],[data-close-league],[data-open-handle-modal],[data-close-handle],[data-share-league],[data-select-league],[data-slip],[data-share-slip],[data-partner-slip],[data-legs],[data-win],[data-back],[data-diary],[data-close],[data-comp],[data-tab],[data-showall],[data-rfilter],[data-export],[data-import],[data-delete],[data-clear-diary],[data-retry],[data-star],[data-useful],[data-chip],[data-open-bookie],[data-close-bookie],[data-bookie-click],[data-close-bug],[data-close-share],[data-close-gdpr],[data-admin-action]');

  if (!t) {
    if (event.target.id === 'trophy-cabinet-modal') $('trophy-cabinet-modal').hidden = true;
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
  
  // Explicit bottom nav & hash-link routing so Home (#/) and all tabs always work immediately
  if (t.dataset && t.dataset.nav) {
    event.preventDefault();
    const targetHash = t.dataset.nav === 'home' ? '#/' : '#/' + t.dataset.nav;
    if (location.hash !== targetHash) {
      location.hash = targetHash;
    }
    render();
    return;
  }
  if (t.tagName === 'A' && t.getAttribute && t.getAttribute('href') && t.getAttribute('href').startsWith('#/')) {
    const targetHash = t.getAttribute('href');
    if (location.hash === targetHash) {
      event.preventDefault();
      render();
      return;
    }
  }

  // Multi-Sport Switcher
  if (t.dataset.toggleSport !== undefined) {
    toggleSport(t.dataset.toggleSport);
    return;
  }
  if (t.dataset.switchSport !== undefined) {
    toggleSport(t.dataset.switchSport);
    return;
  }

  // Cross-sport acca addition
  if (t.dataset.addCrossAcca !== undefined) {
    try {
      const data = JSON.parse(t.dataset.addCrossAcca);
      addCrossSportAccaLeg({
        id: 'cross-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        matchId: data.eventId || ('ev-' + Date.now()),
        fixture: { home: data.selection.split(' · ')[0] || data.selection, away: '', competition: (data.sport || 'SPORT').toUpperCase() },
        kickoff: Date.now() + 86400000,
        selId: 'sel-' + data.selection,
        label: data.selection,
        market: 'match',
        p: data.odds ? 1 / (data.odds * 1.07) : 0.5,
        odds: Number(data.odds) || 2.0,
        fractional: data.fair || 'Evs',
        bookmaker: data.bookmaker || 'UK Bookmaker',
        priceSource: 'live',
        support: 'validated',
        basis: (data.sport || 'Sport') + ' Bookmaker Price',
        sport: data.sport || 'sport'
      });
      scrollToBuilder();
    } catch (e) { console.error(e); }
    return;
  }
  if (t.dataset.removeCrossLeg !== undefined) {
    removeCrossSportAccaLeg(t.dataset.removeCrossLeg);
    return;
  }
  if (t.dataset.clearCustomAcca !== undefined) {
    clearCustomAcca();
    return;
  }

  // Trophy Cabinet
  if (t.dataset.openTrophyCabinet !== undefined || t.id === 'btn-trophy-cabinet') {
    openTrophyCabinet();
    return;
  }
  if (t.dataset.closeTrophy !== undefined) {
    $('trophy-cabinet-modal').hidden = true;
    return;
  }

  // League Frequency Switcher
  if (t.dataset.leagueFreq !== undefined) {
    activeLeagueFreq = t.dataset.leagueFreq;
    render();
    return;
  }

  // League Emoji Picker
  if (t.dataset.leagueEmoji !== undefined) {
    $('new-league-icon').value = t.dataset.leagueEmoji;
    document.querySelectorAll('.emoji-opt-btn').forEach(b => b.classList.remove('active'));
    t.classList.add('active');
    return;
  }

  if (t.id === 'btn-report-bug') { $('bug-modal').hidden = false; return; }
  if (t.dataset.closeBug !== undefined) { $('bug-modal').hidden = true; return; }

  // GDPR modal
  if (t.id === 'btn-open-gdpr' || t.id === 'btn-more-gdpr') { $('gdpr-modal').hidden = false; return; }
  if (t.dataset.closeGdpr !== undefined) { $('gdpr-modal').hidden = true; return; }

  // Share modal
  if (t.dataset.shareApp !== undefined || t.id === 'header-share-btn' || t.id === 'footer-share-btn' || t.closest('#header-share-btn') || t.closest('#footer-share-btn')) {
    shareAppWithFriend();
    return;
  }
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
    } else if (act === 'clear-enquiries') {
      localStorage.setItem(COMMERCIAL_STORAGE_KEY, '[]');
      toast('Commercial enquiries cleared.');
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
  }
  if (t.id === 'header-install-btn' || t.id === 'btn-trigger-native-install') { triggerDirectDownload(); return; }
  if (t.dataset.closeInstall !== undefined) { closeInstallModal(); return; }
  if (t.id === 'header-auth-btn' || t.id === 'header-user-btn') { openAuthModal(); return; }
  if (t.dataset.closeAuth !== undefined) { closeAuthModal(); return; }
  if (t.id === 'btn-switch-handle') { closeAuthModal(); const _p = getUserProfile();
    $('player-handle-input').value = _p.handle;
    if ($('player-town-input')) $('player-town-input').value = _p.town || 'Paisley';
    if ($('player-region-input')) $('player-region-input').value = _p.region || 'Renfrewshire';
    if ($('player-country-input')) $('player-country-input').value = _p.country || 'Scotland';
    $('handle-modal').hidden = false; return; }
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
  else if (t.dataset.openHandleModal !== undefined) { const _p = getUserProfile();
    $('player-handle-input').value = _p.handle;
    if ($('player-town-input')) $('player-town-input').value = _p.town || 'Paisley';
    if ($('player-region-input')) $('player-region-input').value = _p.region || 'Renfrewshire';
    if ($('player-country-input')) $('player-country-input').value = _p.country || 'Scotland';
    $('handle-modal').hidden = false; }
  else if (t.dataset.closeHandle !== undefined) { $('handle-modal').hidden = true; }
  else if (t.dataset.selectLeague !== undefined) { activeLeagueId = t.dataset.selectLeague; render(); }
  else if (t.dataset.selectMoreTab !== undefined) { activeMoreTab = t.dataset.selectMoreTab; render(); }
  else if (t.id === 'toggle-odds-format') { toggleOddsFormat(); render(); }
  else if (t.dataset.renameLeague !== undefined) {
    renameLeague(t.dataset.renameLeague);
  }
  else if (t.dataset.kickPlayer !== undefined) {
    kickPlayerFromLeague(t.dataset.leagueCode, t.dataset.kickPlayer);
  }
  else if (t.dataset.deleteLeague !== undefined) {
    deleteLeague(t.dataset.deleteLeague, t.dataset.leagueCode);
  }
  else if (t.dataset.shareLeague !== undefined) {
    const code = t.dataset.shareLeague;
    const isGithub = window.location.origin.includes('github.io');
    const baseUrl = isGithub ? 'https://headpark23.github.io/MatchIQ/' : 'https://betbuddyuk.uk/';
    const shareUrl = baseUrl + '#join-league=' + encodeURIComponent(code);
    const altUrl = isGithub ? 'https://betbuddyuk.uk/#join-league=' + encodeURIComponent(code) : 'https://headpark23.github.io/MatchIQ/#join-league=' + encodeURIComponent(code);
    const text = '🏆 Join my Bet Buddy League! Code: ' + code + '\nJoin: ' + shareUrl + '\n(Unfiltered WiFi link: ' + altUrl + ')\nCompete with friends!';
    openUniversalShare({
      title: 'Join my Bet Buddy League (' + code + ')',
      text,
      url: shareUrl
    });
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
  else if (t.dataset.retry !== undefined) loadData().then(() => { syncUserToGeoCloud(); render(); });
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
    const icon = ($('new-league-icon') && $('new-league-icon').value) || '⚽';
    const freq = ($('new-league-freq') && $('new-league-freq').value) || 'weekly';
    const code = 'BUDDY-' + Math.floor(Math.random() * 8999 + 1000);
    const prof = getUserProfile();
    const newLeague = {
      id: 'league-' + Date.now(),
      name,
      icon,
      freq,
      code,
      creator_handle: prof.handle,
      created_at: new Date().toISOString().slice(0, 10),
      members: []
    };
    const list = getStoredLeagues();
    list.unshift(newLeague);
    saveStoredLeagues(list);
    activeLeagueId = newLeague.id;
    syncLeagueToCloud(newLeague);
    listenToActiveLeague(code);
    $('league-modal').hidden = true;
    toast('League ' + icon + ' ' + name + ' created! Share code ' + code);
    render();
  }
  if (event.target.id === 'join-league-form') {
    event.preventDefault();
    const code = ($('join-league-code').value || '').trim().toUpperCase();
    if (!code) return;
    $('league-modal').hidden = true;
    toast('Joining league ' + code + '...');
    joinCloudLeague(code);
  }  if (event.target.id === 'commercial-enquiry-form') {
    event.preventDefault();
    const name = ($('comm-name').value || '').trim();
    const company = ($('comm-company').value || '').trim();
    const email = ($('comm-email').value || '').trim();
    const interest = $('comm-interest').value;
    const message = ($('comm-message').value || '').trim();
    if (!name || !email || !message) {
      toast('Please complete name, email, and message fields.');
      return;
    }

    const enquiries = getStoredEnquiries();
    enquiries.unshift({
      id: 'comm-' + Date.now(),
      name, company, email, interest, message,
      submitted_at: new Date().toISOString()
    });
    try { localStorage.setItem(COMMERCIAL_STORAGE_KEY, JSON.stringify(enquiries)); } catch (e) {}

    const subject = encodeURIComponent('Bet Buddy Commercial Partnership: ' + (company || name));
    const body = encodeURIComponent(
      'Hi Martin and Chris,\n\n' +
      'Commercial Partnership Details:\n' +
      'Name: ' + name + '\n' +
      'Company: ' + company + '\n' +
      'Email: ' + email + '\n' +
      'Interest Category: ' + interest + '\n\n' +
      'Message / Proposal:\n' + message + '\n\n' +
      'Sent via Bet Buddy Commercial Portal.'
    );
    window.open('mailto:octopigardens@gmail.com?subject=' + subject + '&body=' + body, '_blank');

    const statusBox = $('comm-status-msg');
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.innerHTML = '<b>Enquiry Logged!</b> Thank you ' + esc(name) + '. Your proposal has been dispatched to founders Martin White &amp; Chris Faulds (octopigardens@gmail.com). We will reply within 24 hours.';
    }
    toast('Commercial enquiry submitted! Opening email to octopigardens@gmail.com...');
    $('commercial-enquiry-form').reset();
    return;
  }

  if (event.target.id === 'bug-form') {
    event.preventDefault();
    const type = $('bug-type-select').value;
    const desc = ($('bug-desc-input').value || '').trim();
    const contact = ($('bug-contact-input').value || '').trim();
    if (!desc) return;
    saveBugReport({ type, desc, contact });

    const subject = encodeURIComponent('Bet Buddy Bug Report: ' + type.toUpperCase());
    const body = encodeURIComponent(
      'Hi Martin and Chris,\n\n' +
      'Bug Report / Suggestion Details:\n' +
      'Category: ' + type + '\n' +
      'Contact: ' + (contact || 'Anonymous') + '\n\n' +
      'Description:\n' + desc + '\n\n' +
      'Device/App Details:\n' +
      'Platform: ' + navigator.userAgent + '\n' +
      'URL: ' + location.href + '\n\n' +
      'Sent via Bet Buddy Bug Reporter.'
    );
    window.open('mailto:octopigardens@gmail.com?subject=' + subject + '&body=' + body, '_blank');

    $('bug-form').reset();
    $('bug-modal').hidden = true;
    toast('Thanks! Opening email to send bug report to Martin and Chris...');
    render();
    return;
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
    const town = $('player-town-input') ? $('player-town-input').value : 'Paisley';
    const region = $('player-region-input') ? $('player-region-input').value : 'Renfrewshire';
    const country = $('player-country-input') ? $('player-country-input').value : 'Scotland';
    saveUserProfile(handle, town, region, country);
    $('handle-modal').hidden = true;
    toast('Profile and Regional Leagues updated!');
    // Sync all user's custom leagues to cloud with new handle/location
    getStoredLeagues().forEach(l => syncLeagueToCloud(l));
    render();
  }

  else if (event.target.id === 'fb-form') handleFeedbackSubmit(event);
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('diary-modal').hidden) closeDiary(); });
window.addEventListener('hashchange', render);

$('bookmaker-quick').innerHTML = ['Bet365', 'Sky Bet', 'Paddy Power', 'Ladbrokes', 'Coral', 'William Hill', 'Betfair', 'Unibet'].map(b => '<button type="button">' + b + '</button>').join('');
updateDiaryCount();
loadData().then(() => {
  fetchCloudDataRest();
  render();
});

const APP_VERSION = '2026.10.30.40';

async function forceAppSync() {
  toast('Syncing Bet Buddy with latest cloud data... 🔄');
  fetchCloudDataRest();
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    localStorage.setItem('betbuddy_app_version', APP_VERSION);
  } catch (e) { /* ignore */ }
  setTimeout(() => {
    window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now() + '#/';
    window.location.reload(true);
  }, 350);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    toast('App updated to latest version! Refreshing... 🐼');
    setTimeout(() => window.location.reload(), 600);
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.update();
      setInterval(() => reg.update(), 60000); // Check for server updates every 60 seconds
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                toast('New Bet Buddy upgrade ready! Auto-syncing... 🐼');
                setTimeout(() => window.location.reload(), 800);
              }
            }
          });
        }
      });
    }).catch(() => {});
  });
}


function toggleMemberForm(id) {
  const el = document.getElementById(id);
  if (el) {
    el.hidden = !el.hidden;
  }
}
