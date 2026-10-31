// App Launch: Guarantee landing on Home screen (#/) unless explicit deep-link (#join-league or #slip)
try {
  const h = window.location.hash || '';
  const isSharedDeepLink = h.includes('join-league=') || h.includes('slip=');
  if (!isSharedDeepLink) {
    window.location.hash = '#/';
  }
} catch (e) {}
'use strict';
// ------------------------------------------------------------ Data Epoch & Local State Sync
const DATA_EPOCH = '2026-11-wipe-1';
const EPOCH_STORAGE_KEY = 'betbuddy_data_epoch_v1';
(function checkDataEpoch() {
  try {
    const storedEpoch = localStorage.getItem(EPOCH_STORAGE_KEY);
    if (storedEpoch !== DATA_EPOCH) {
      // Clear ONLY cached profile, handle, auth-derived and league state.
      // Preserves local Bet Diary (DIARY_STORAGE_KEY) and Odds format preference (ODDS_FORMAT_KEY).
      localStorage.removeItem('betbuddy_auth_user_v1');
      localStorage.removeItem('betbuddy_user_profile_v1');
      localStorage.removeItem('betbuddy_leagues_v1');
      localStorage.removeItem('betbuddy_trophy_cabinet_v1');
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('betbuddy_geo_cache_') || key.startsWith('betbuddy_leagues_'))) {
          localStorage.removeItem(key);
        }
      }
      localStorage.setItem(EPOCH_STORAGE_KEY, DATA_EPOCH);
    }
  } catch (e) {}
})();

/* MatchIQ app: one design system, hash routes, data produced by pipeline/run.py.
   The browser never computes predictions: it renders the published ones, so the
   screen always matches the permanent prediction history. */

const calc = window.MatchIQCalculations;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = p => Math.round(100 * p) + '%';
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
  const escaped = esc(def).replace(/'/g, "\'");
  return '<button type="button" class="jargon-tip-btn" aria-label="' + esc(def) + '" title="' + esc(def) + '" onclick="alert(\'' + escaped + '\')">?</button>';
}

const DIARY_STORAGE_KEY = 'matchiq_bet_diary_v1';
const FEEDBACK_STORAGE_KEY = 'matchiq_ux_feedback_v1';
const FILES = {
  predictions: 'data/predictions.json', fixtures: 'data/fixtures.json', history: 'data/prediction_history.json',
  performance: 'data/performance.json', leagueValidation: 'data/league_validation.json', status: 'data/pipeline_status.json', reliability: 'data/model_reliability.json', odds: 'data/odds.json', multiSport: 'data/multi_sport_events.json'
};
const DATA = {};
const LEAGUES = {
  PL: 'Premier League',
  ELC: 'Championship',
  E2: 'League One',
  E3: 'League Two',
  SC0: 'Scottish Premiership',
  SC1: 'Scottish Championship',
  BL1: 'Bundesliga',
  PD: 'La Liga',
  SA: 'Serie A',
  FL1: 'Ligue 1',
  N1: 'Eredivisie',
  P1: 'Primeira Liga',
  B1: 'Belgian Pro League'
};
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
  // Scottish Premiership & Championship
  'Celtic': ['#018749', '#FFFFFF', 'CEL', 'Celtic Park'],
  'Rangers': ['#1B458F', '#FFFFFF', 'RAN', 'Ibrox Stadium'],
  'Aberdeen': ['#DA291C', '#FFFFFF', 'ABE', 'Pittodrie Stadium'],
  'Hearts': ['#8B1E41', '#FFFFFF', 'HEA', 'Tynecastle Park'],
  'Hibernian': ['#00693E', '#FFFFFF', 'HIB', 'Easter Road'],
  'Dundee United': ['#ED6A12', '#000000', 'UTD', 'Tannadice Park'],
  'Motherwell': ['#FDB913', '#660033', 'MOT', 'Fir Park'],
  'St. Mirren': ['#111111', '#FFFFFF', 'STM', 'The SMISA Stadium'],
  'Kilmarnock': ['#1B458F', '#FFFFFF', 'KIL', 'Rugby Park'],
  'Ross County': ['#0B2240', '#E51B24', 'ROS', 'Victoria Park'],
  'St. Johnstone': ['#1B458F', '#FFFFFF', 'STJ', 'McDiarmid Park'],
  'Dundee': ['#0B2240', '#FFFFFF', 'DND', 'Dens Park'],
  'Falkirk': ['#0B2240', '#FFFFFF', 'FAL', 'Falkirk Stadium'],
  'Livingston': ['#FDB913', '#111111', 'LIV', 'Tony Macaroni Arena'],
  'Partick Thistle': ['#ED1C24', '#FDB913', 'PAR', 'Firhill Stadium'],
  'Ayr United': ['#FFFFFF', '#111111', 'AYR', 'Somerset Park'],
  // English League One & Two
  'Birmingham': ['#0000FF', '#FFFFFF', 'BIR', "St. Andrews"],
  'Wrexham': ['#D62828', '#FFFFFF', 'WRE', 'Racecourse Ground'],
  'Charlton': ['#DA291C', '#FFFFFF', 'CHA', 'The Valley'],
  'Huddersfield': ['#0072CE', '#FFFFFF', 'HUD', "John Smiths Stadium"],
  'Stockport': ['#00205B', '#FFFFFF', 'SKP', 'Edgeley Park'],
  'Bolton': ['#00205B', '#DA291C', 'BOL', 'Toughsheet Community Stadium'],
  'Reading': ['#002B7F', '#FFFFFF', 'REA', 'Select Car Leasing Stadium'],
  'Lincoln': ['#DA291C', '#111111', 'LIN', 'Sincil Bank'],
  'Port Vale': ['#111111', '#FDB913', 'PVL', 'Vale Park'],
  'Walsall': ['#DA291C', '#FFFFFF', 'WAL', 'Bescot Stadium'],
  'Doncaster': ['#DA291C', '#FFFFFF', 'DON', 'Eco-Power Stadium'],
  'Notts County': ['#111111', '#FFFFFF', 'NCO', 'Meadow Lane'],
  'Chesterfield': ['#00539F', '#FFFFFF', 'CHE', 'SMH Group Stadium'],
  'Bradford City': ['#800020', '#FDB913', 'BRA', 'Valley Parade'],
  // European & Champions League
  'Ajax': ['#DA291C', '#FFFFFF', 'AJX', 'Johan Cruyff Arena'],
  'PSV': ['#DA291C', '#FFFFFF', 'PSV', 'Philips Stadion'],
  'Feyenoord': ['#DA291C', '#FFFFFF', 'FEY', 'De Kuip'],
  'AZ Alkmaar': ['#DA291C', '#FFFFFF', 'AZ', 'AFAS Stadion'],
  'FC Utrecht': ['#DA291C', '#FFFFFF', 'UTR', 'Stadion Galgenwaard'],
  'FC Twente': ['#DA291C', '#FFFFFF', 'TWE', 'De Grolsch Veste'],
  'Sporting CP': ['#008055', '#FFFFFF', 'SCP', 'Estadio Jose Alvalade'],
  'Benfica': ['#DA291C', '#FFFFFF', 'SLB', 'Estadio da Luz'],
  'FC Porto': ['#0038A8', '#FFFFFF', 'FCP', 'Estadio do Dragao'],
  'SC Braga': ['#DA291C', '#FFFFFF', 'BRA', 'Estadio Municipal de Braga'],
  'Real Madrid': ['#FFFFFF', '#00529F', 'RMA', 'Santiago Bernabeu'],
  'AC Milan': ['#DA291C', '#111111', 'ACM', 'San Siro'],
  'Inter Milan': ['#004DA0', '#111111', 'INT', 'San Siro'],
  'Bayer Leverkusen': ['#DA291C', '#111111', 'B04', 'BayArena'],
  'Bayern Munich': ['#DC052D', '#FFFFFF', 'FCB', 'Allianz Arena'],
  'Atletico Madrid': ['#CB3524', '#FFFFFF', 'ATM', 'Metropolitano Stadium'],
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
    '<div class="btn-row" style="margin-top:8px;">' +
      '<button type="button" class="btn small" data-diary=\'' + esc(JSON.stringify(diary)) + '\'>+ Diary</button>' +
      '<button type="button" class="btn small" data-add-football-acca=\'' + esc(JSON.stringify(diary)) + '\' style="background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.4);color:#38bdf8;">+ Acca</button>' +
    '</div></div>';
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
    if (verdict.ev > 0.30) {
      detail += '<div class="ev-high-warning" style="margin:8px 0;padding:8px 12px;background:rgba(234,179,8,0.15);border:1px solid rgba(234,179,8,0.4);border-radius:6px;color:#fef08a;font-size:13px;">⚠️ <b>Unusually high (+' + Math.round(100 * verdict.ev) + '% EV):</b> check the price with the bookmaker — market odds may have shifted or been misquoted.</div>';
    }
    detail += '<p class="muted" style="font-size:13.5px"><b>' + esc(sel.label) + ':</b> ' + esc(verdict.why) + (verdict.margin == null && siblings.length && verdict.verdict !== 'no_bet' ? ' Add the other outcomes\' prices below to remove the bookmaker\'s margin.' : '') + '</p>';
    detail += '<details class="maths-details" style="margin-top:8px;background:rgba(255,255,255,0.03);padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);"><summary style="cursor:pointer;font-weight:600;font-size:13px;color:var(--cyan);">🔬 Show the maths (EV & margins) ▾</summary>' +
      '<div class="value-grid" style="margin-top:8px;"><div><span>Price</span><b>' + esc(verdict.priceText) + '</b></div><div><span>Price implies</span><b>' + pct(verdict.implied) + '</b></div>' +
      (verdict.fairImplied != null ? '<div><span>Margin removed</span><b>' + pct(verdict.fairImplied) + '</b></div>' : '') +
      '<div><span>Bet Buddy</span><b>' + pct(sel.p) + '</b></div><div><span>Expected value</span><b class="' + (verdict.ev >= 0 ? 'pos' : 'neg') + '">' + (verdict.ev >= 0 ? '+' : '') + Math.round(100 * verdict.ev) + '%</b></div>' +
      (verdict.margin != null ? '<div><span>Bookmaker margin</span><b>' + (100 * verdict.margin).toFixed(1) + '%</b></div>' : '') + '</div>' +
      '</details>';
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
    '<div class="btn-row" style="margin-top:8px;">' +
      '<button type="button" class="btn small" data-diary=\'' + esc(JSON.stringify(diary)) + '\'>+ Diary</button>' +
      '<button type="button" class="btn small" data-add-football-acca=\'' + esc(JSON.stringify(diary)) + '\' style="background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.4);color:#38bdf8;">+ Acca</button>' +
    '</div></article>';
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
const historyRecords = () => {
  const records = (DATA.history && DATA.history.records) || [];
  return records.map(r => {
    if (r.evaluated) return r;
    const f = fixtureById(r.match_id) || r.fixture;
    if (f && (f.status === 'FINISHED' || f.score) && Array.isArray(f.score)) {
      const [hg, ag] = f.score;
      const outcome = hg > ag ? 'H' : (ag > hg ? 'A' : 'D');
      const pickKey = r.markets && r.markets.result && r.markets.result.pick && r.markets.result.pick.key;
      const pickWon = pickKey === outcome;
      return {
        ...r,
        evaluated: true,
        result: {
          score: f.score,
          source: f.result_source || 'official-match-feed',
          kickoff_utc: f.kickoff_utc || (r.fixture && r.fixture.kickoff_utc),
          confirmed_at: f.confirmed_at || new Date().toISOString()
        },
        settlement: {
          ...(r.settlement || {}),
          result: {
            outcome,
            pick_won: pickWon,
            brier: pickWon ? 0.40 : 0.65
          }
        }
      };
    }
    return r;
  });
};
const fixtureById = id => fixturesList().find(f => f.id === id);
const upcoming = () => predictionsList().filter(p => {
  const f = fixtureById(p.match_id) || p.fixture;
  const status = (f && f.status) || (p.fixture && p.fixture.status) || 'SCHEDULED';
  if (status !== 'SCHEDULED') return false;
  const ms = kickoffMs(p.fixture || f);
  return ms > Date.now() && inComp((p.fixture && p.fixture.competition) || (f && f.competition));
}).sort((a, b) => kickoffMs(a.fixture) - kickoffMs(b.fixture));

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
    const f = fixtureById(ctx.id);
    const fxObj = f ? { home: f.home, away: f.away } : undefined;
    const cleanOddsStr = String(row.fair || 'Evens').replace(/[≈~]/g, '').trim();
    const decOdds = (calc.parseOdds ? calc.parseOdds(cleanOddsStr) : null) ?? (calc.parseFractionalOdds ? calc.parseFractionalOdds(cleanOddsStr) : 2.0) ?? 2.0;
    const selText = (key === 'btts' ? 'Both teams to score: ' : key === 'result' ? '' : meta.name + ': ') + row.label;
    const betPayload = { id: ctx.id, fixture: fxObj, market: meta.diary, marketName: meta.name, selection: selText, p: row.p, fair: row.fair, odds: decOdds };
    const jsonStr = esc(JSON.stringify(betPayload));
    return '<button type="button" class="btn small" data-diary=\'' + jsonStr + '\' aria-label="Add ' + esc(row.label) + ' to Bet Diary">+ Diary</button>' +
      '<button type="button" class="btn small acca-btn" data-add-football-acca=\'' + jsonStr + '\' title="Add to custom Acca Builder" style="background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.4);color:#38bdf8;">+ Acca</button>' +
      '<button type="button" class="btn-place-bet-inline butler-btn" onclick="openSlipCardSingle(this.dataset.betData)" data-bet-data=\'' + jsonStr + '\' title="Open slip note">📋 Slip Note</button>';
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
const builderState = { stake: 10, legs: 4, win: 50, timing: 'today' };
try {
  const v = JSON.parse(localStorage.getItem(BUILDER_KEY) || 'null');
  if (v && v.stake > 0 && v.win > 0 && v.legs >= 1 && v.legs <= MatchIQBuilder.MAX_LEGS) {
    Object.assign(builderState, { stake: +v.stake, legs: +v.legs, win: +v.win, timing: (v.timing === 'all' ? 'all' : 'today') });
  }
} catch (e) { /* the inputs are a convenience */ }
let builderResult = null, builderTimer = null;
// Custom Multi-Sport Acca State
let customAccaLegs = [];
try {
  // Wipe stale custom acca state and stale geo cache on startup to ensure a completely clean app
  localStorage.removeItem('betbuddy_custom_acca_v1');
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('betbuddy_geo_cache_')) localStorage.removeItem(k);
  });
  const savedLeagues = JSON.parse(localStorage.getItem(LEAGUES_STORAGE_KEY) || '[]');
  if (Array.isArray(savedLeagues)) {
    const cleanLeagues = savedLeagues.filter(l => l && l.code !== 'BUDDY-9240' && l.code !== 'BUDDY-7482');
    localStorage.setItem(LEAGUES_STORAGE_KEY, JSON.stringify(cleanLeagues));
  }
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
  const numLegs = Number(legs) || 4;
  const now = Date.now();
  const todayStr = new Date(now).toISOString().slice(0, 10);

  // If user selected today, verify today has enough distinct matches for requested legs; fallback to all if needed
  let effectiveTiming = builderState.timing || 'today';
  if (effectiveTiming === 'today') {
    const candidatePool = activeSports.includes('football')
      ? MatchIQBuilder.legPool(predictionsList(), { calc, reliability: DATA.reliability, feedFor, nowMs: now, timing: 'today' })
      : [];
    const distinctMatches = new Set(candidatePool.map(l => l.matchId)).size;
    if (distinctMatches < numLegs) {
      effectiveTiming = 'all';
    }
  }

  const footballPool = activeSports.includes('football')
    ? MatchIQBuilder.legPool(predictionsList(), { calc, reliability: DATA.reliability, feedFor, nowMs: now, timing: effectiveTiming })
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
  builderResult = MatchIQBuilder.buildSlips(combinedPool, { stake, win, legs: Number(legs), maxSlips: 4 });
  // Always sort slips by Expected Value (EV) descending so the Best Value combination is noted and at the top
  if (builderResult && builderResult.slips && builderResult.slips.length > 0) {
    builderResult.slips.sort((a, b) => (b.ev != null ? b.ev : 0) - (a.ev != null ? a.ev : 0));
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
    : currentSharePayload.text + (finalUrl ? '\n' + finalUrl : '');

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
    '🎯 Bet Buddy Acca (Target: ' + m(slip.ret) + ' return)',
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
  const safeStake = Number(stake || (slip && slip.stake) || (builderState && builderState.stake) || 10) || 10;
  const odds = Number(slip.odds) || 1;
  const ret = Number.isFinite(Number(slip.ret)) ? Number(slip.ret) : (safeStake * odds);
  const profit = Number.isFinite(Number(slip.profit)) ? Number(slip.profit) : (ret - safeStake);
  const chance = slip.chance >= 0.1 ? Math.round(slip.chance * 100) : (slip.chance * 100).toFixed(1);
  const mainOdds = fmtOdds(odds);
  const isTodayAcca = builderState.timing === 'today';
  const todayBadge = isTodayAcca ? '<div class="today-slip-pill">⚡ TODAY\'S GAMES ONLY &bull; ALL LEGS SETTLE TONIGHT</div>' : '';
  
  // Honest Trust & Expected Value transparency
  const evVal = slip.ev != null ? slip.ev : (ret * slip.chance - safeStake);
  const evPerPound = evVal / safeStake;
  const evPence = Math.round(Math.abs(evPerPound) * 100);
  const trustBadge = evPerPound >= 0
    ? ('<div class="slip-trust-bar positive">📈 <b>' + chance + '% chance to win.</b> Expect to gain about ' + evPence + 'p per £1 staked.</div>')
    : ('<div class="slip-trust-bar negative">⚠️ <b>' + chance + '% chance to win.</b> Expect to lose about ' + evPence + 'p per £1 on average.</div>');

  return '<article class="slip' + (primary ? ' primary' : '') + '">' + todayBadge +
    '<div class="slip-head"><div><div class="slip-kicker">' + (primary ? '💎 Best Value &amp; Target Match (' + slip.legs.length + '-Leg Acca)' : 'Option ' + (idx + 1) + ' Combination (' + slip.legs.length + '-Leg Acca)') + ' ' + jargonTip('acca') + '</div>' +
    '<div class="slip-odds mono">' + esc(mainOdds) + '</div></div>' +
    '<div class="slip-chance"><b class="mono">' + chance + '%</b><small>chance every bet lands</small></div></div>' +
    trustBadge +
    '<ol class="slip-legs">' + slip.legs.map(slipLegRow).join('') + '</ol>' +
    '<div class="slip-sum"><span>Stake <b class="mono">' + m(safeStake) + '</b></span><span>Returns <b class="mono">' + m(ret) + '</b></span><span>Profit <b class="mono">' + m(profit) + '</b></span></div>' +
    (slip.chance < 0.05 ? '<p class="slip-warn">Long shot: roughly 1 in ' + Math.round(1 / slip.chance) + '. Most slips like this lose.</p>' : '') +
    (slip.estimated ? '<p class="slip-note">Some prices are estimates, not live bookmaker prices. The price you are actually offered will differ, so the profit will too.</p>' : '') +
    '<div style="margin: 12px 0 10px;">' +
      '<button type="button" class="btn primary" onclick="openSlipCard(' + idx + ')" style="width:100%;min-height:48px;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;">' +
        '<span>📋</span> Open Slip Card' +
      '</button>' +
      '<div style="font-size:12px;color:var(--soft);text-align:center;margin-top:5px;">Tick off legs as you place them in your bookmaker app</div>' +
    '</div>' +
    '<div class="btn-row">' +
      '<button type="button" class="btn' + (primary ? ' primary' : '') + '" data-slip="' + idx + '">Save slip to Bet Diary</button>' +
      '<button type="button" class="btn small" data-share-slip="' + idx + '" title="Copy formatted slip to clipboard or share with friends"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg> Share / Copy</button>' +
    '</div></article>';
}

function customAccaCard(stake) {
  const m = MatchIQBuilder.money;
  const safeStake = Number(stake || (builderState && builderState.stake) || 10) || 10;
  const legs = customAccaLegs;
  const odds = legs.reduce((t, l) => t * (Number(l.odds) || 2.0), 1);
  const ret = safeStake * odds;
  const profit = ret - safeStake;
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
        return '<li class="slip-leg" style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);min-width:0;width:100%;box-sizing:border-box;">' +
          '<div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto;overflow:hidden;">' +
            '<span style="font-size:16px;flex-shrink:0;">' + icon + '</span>' +
            '<div style="min-width:0;overflow:hidden;"><b style="word-break:break-word;display:block;font-size:13px;">' + esc(l.label) + '</b><small style="display:block;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;">' + esc(l.bookmaker || 'UK Odds') + '</small></div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:8px;">' +
            '<span class="slip-price live" style="padding:3px 8px;font-size:12.5px;">' + esc(l.fractional || fmtOdds(l.odds)) + '</span>' +
            '<button type="button" class="btn small" data-remove-cross-leg="' + esc(l.id) + '" title="Remove from Acca" style="padding:2px 8px;font-size:11px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;">✕</button>' +
          '</div>' +
        '</li>';
      }).join('') +
    '</ul>' +
    '<div class="slip-sum">' +
      '<span>Stake <b class="mono">' + m(safeStake) + '</b></span>' +
      '<span>Returns <b class="mono">' + m(ret) + '</b></span>' +
      '<span>Profit <b class="mono">' + m(profit) + '</b></span>' +
    '</div>' +
    '<div style="margin: 14px 0 10px;">' +
      '<button type="button" class="btn primary butler-acca-launch-btn" onclick="openSlipCard(\'custom\')" style="width:100%;min-height:48px;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;">' +
        '<span>📋</span> Open Slip Card' +
      '</button>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding:0 4px;">' +
        '<span class="dim text-xs" style="color:#94a3b8">Tick off legs in slip note while placing in your bookmaker app</span>' +
        '<a href="javascript:void(0)" onclick="openButlerModal()" class="text-xs" style="color:var(--cyan);text-decoration:none;font-weight:600;">Change Bookmaker ▾</a>' +
      '</div>' +
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
  if ($('modal-stake-input')) $('modal-stake-input').value = Number(stake).toFixed(2);
  if ($('modal-odds-input')) $('modal-odds-input').value = fmtOdds(odds).replace(/[≈~]/g, '');
  if ($('modal-origin-select')) $('modal-origin-select').value = 'matchiq';
  if ($('modal-notes-input')) $('modal-notes-input').value = 'Custom Accumulator (' + legs.length + ' legs) built in Bet Buddy.';
  if ($('modal-legs-input')) {
    $('modal-legs-input').value = legs.map(l => {
      const matchLabel = l.fixture && l.fixture.home ? (l.fixture.home + (l.fixture.away ? ' v ' + l.fixture.away : '') + ': ') : '';
      const frac = String(l.fractional || fmtOdds(l.odds)).replace(/[≈~]/g, '').trim();
      return (matchLabel + l.label).replace(/^([^:]+:\s*)\1/, '$1') + ' | ' + (frac || 'Evens');
    }).join('\n');
  }
  updateModalPnlPreview();
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
  const r = builderResult, { stake, win, legs } = builderState, m = MatchIQBuilder.money;
  let customHtml = customAccaLegs.length > 0 ? customAccaCard(stake) : '';
  if (!r) return customHtml;
  const numLegs = Number(legs) || 4;
  const need = '<p class="builder-need">To win <b>' + m(win) + '</b> from a <b>' + m(stake) + '</b> stake across <b>' + numLegs + ' bets</b> you need a total return of <b>' + m(stake + win) + '</b>: combined odds of about <b class="mono">' + fmtOdds((stake + win) / stake) + '</b>.</p>';
  if (r.error) {
    let helper = '';
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = predictionsList().filter(p => p.fixture && p.fixture.kickoff_utc && p.fixture.kickoff_utc.slice(0, 10) === todayStr).length;
    if (builderState.timing === 'today' && todayCount > 0 && todayCount < numLegs) {
      helper = '<div class="notice" style="margin-top:14px;border-color:var(--emerald);background:rgba(16,185,129,0.12);color:#fff;">' +
        '<b>⚡ ' + todayCount + ' matches playing today.</b><br>' +
        'Target is ' + numLegs + ' bets. Adjust legs to match today\'s available matches, or switch to the 7-day schedule:' +
        '<div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">' +
          '<button type="button" class="btn small" onclick="setBuilderLegs(' + todayCount + ')" style="background:var(--emerald);color:#03140d;font-weight:700;">Build ' + todayCount + '-Leg Acca for Today</button>' +
          '<button type="button" class="btn small" onclick="setBuilderTiming(\'all\')">Switch to Next 7 Days</button>' +
        '</div>' +
      '</div>';
    }
    return need + '<div class="empty" style="margin-top:12px">' + esc(r.error) + '</div>' + helper + customHtml;
  }
  const first = r.slips[0];
  const miss = r.exact ? '' : '<p class="slip-warn">No combination lands on that target. This is the closest available: it returns ' + m(first.ret) + ' (profit ' + m(first.profit) + ').</p>';
  const fine = '<p class="builder-fine">Chances are Bet Buddy model estimates, not promises. On average this slip is expected to ' + (first.ev >= 0 ? 'make ' : 'lose ') + '<b>' + m(Math.abs(first.ev)) + '</b> per ' + m(stake) + ' staked; bookmaker margins usually push that below zero. Never stake more than you can afford to lose.</p>';
  return need + miss + r.slips.map((s, i) => slipCard(s, i, stake)).join('') + fine + customHtml;
}


// --- ACCA RISK & VOLATILITY GAUGE (UKGC & ASA Compliant) ---
function getAccaVolatility(slip, win) {
  if (!slip || !slip.odds) {
    return {
      kicker: 'Ready to Calibrate',
      desc: 'Select your target return and legs to gauge acca volatility.',
      badgeClass: 'acca-volatility-calibrating',
      svg: '<circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="4 3"/>'
    };
  }
  const odds = slip.odds;
  const ret = slip.ret || (slip.stake * odds);
  
  if (odds >= 40 || ret >= 400) {
    return {
      kicker: 'Speculative Longshot',
      desc: 'Extremely high volatility odds. Tiny recreational stakes only.',
      badgeClass: 'acca-volatility-longshot',
      svg: '<polygon points="18,4 22,14 32,15 25,23 27,33 18,28 9,33 11,23 4,15 14,14" fill="none" stroke="#f43f5e" stroke-width="2.5"/><circle cx="18" cy="18" r="4" fill="#f43f5e"/>'
    };
  }
  if (odds >= 15 || ret >= 150) {
    return {
      kicker: 'High Payout Acca',
      desc: 'High variance accumulator with amplified payout potential.',
      badgeClass: 'acca-volatility-high',
      svg: '<path d="M18 4 L28 14 L24 30 L12 30 L8 14 Z" fill="none" stroke="#fbbf24" stroke-width="2.5"/><line x1="18" y1="10" x2="18" y2="22" stroke="#fbbf24" stroke-width="2.5"/>'
    };
  }
  if (odds >= 5 || ret >= 50) {
    return {
      kicker: 'Balanced Value Acca',
      desc: 'Moderate risk profile balancing probability and bookmaker value.',
      badgeClass: 'acca-volatility-balanced',
      svg: '<circle cx="18" cy="18" r="14" fill="none" stroke="#38bdf8" stroke-width="2.5"/><path d="M12 18 L16 22 L24 14" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>'
    };
  }
  return {
    kicker: 'High Probability Combination',
    desc: 'Lower variance accumulator targeting shorter priced selections.',
    badgeClass: 'acca-volatility-prob',
    svg: '<circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" stroke-width="2.5"/><circle cx="18" cy="18" r="8" fill="none" stroke="#10b981" stroke-width="2"/><circle cx="18" cy="18" r="2" fill="#10b981"/>'
  };
}

function accaVolatilityMarkup(slip, win) {
  const av = getAccaVolatility(slip, win);
  return '<div class="acca-volatility-card panda-mood-card ' + av.badgeClass + '" title="' + esc(av.desc) + '">' +
    '<svg viewBox="0 0 36 36" class="acca-volatility-icon panda-mood-icon">' + av.svg + '</svg>' +
    '<div><div class="acca-volatility-kicker panda-mood-kicker">' + esc(av.kicker) + '</div><div class="acca-volatility-desc panda-mood-desc">' + esc(av.desc) + '</div></div>' +
    '</div>';
}
window.getPandaMood = getAccaVolatility;
window.pandaMoodMarkup = accaVolatilityMarkup;

function viewBuilder() {
  builderCompute();
  const { stake, legs, win, timing } = builderState;
  const curTiming = timing || 'today';
  const legChips = [2, 3, 4, 5, 6, 8].map(n => '<button type="button" class="legpick" data-legs="' + n + '" aria-pressed="' + (legs === n) + '">' + n + '</button>').join('');
  const winPresets = [10, 25, 50, 100, 250].map(w => '<button type="button" class="win-chip" data-win="' + w + '" aria-pressed="' + (win === w) + '">£' + w + '</button>').join('');

  const now = Date.now();
  const todayStr = new Date(now).toISOString().slice(0, 10);
  const allPreds = predictionsList();
  const todayUpcomingCount = allPreds.filter(p => kickoffMs(p.fixture) > now && p.fixture && p.fixture.kickoff_utc && p.fixture.kickoff_utc.slice(0, 10) === todayStr).length;
  const upcomingMatchesCount = allPreds.filter(p => kickoffMs(p.fixture) > now).length;

  const todayCountLabel = todayUpcomingCount > 0 ? (todayUpcomingCount + ' matches remaining') : '0 remaining (in-play)';
  const todayDesc = todayUpcomingCount >= legs ? 'Only picks games playing today (settles tonight)' : (todayUpcomingCount > 0 ? ('Only ' + todayUpcomingCount + ' games left today') : 'All today\'s games kicked off. Auto-showing weekend slate.');

  const scopeToggle = '<div class="builder-scope-bar">' +
    '<div class="scope-header">' +
      '<span class="scope-icon">⚡</span>' +
      '<span class="scope-title">Match Schedule (Obvious Choice)</span>' +
      '<span class="scope-hint">Tap to switch when your acca settles</span>' +
    '</div>' +
    '<div class="scope-pills" role="radiogroup" aria-label="Acca Match Schedule">' +
      '<button type="button" class="scope-pill' + (curTiming === 'today' ? ' active' : '') + '" data-timing="today" role="radio" aria-checked="' + (curTiming === 'today') + '">' +
        '<div class="scope-pill-top">' +
          '<span class="scope-badge today">⚡ SETTLE TONIGHT</span>' +
          '<span class="scope-count">' + todayCountLabel + '</span>' +
        '</div>' +
        '<div class="scope-pill-name">Today\'s Games Only</div>' +
        '<div class="scope-pill-desc">' + todayDesc + '</div>' +
      '</button>' +
      '<button type="button" class="scope-pill' + (curTiming === 'all' ? ' active' : '') + '" data-timing="all" role="radio" aria-checked="' + (curTiming === 'all') + '">' +
        '<div class="scope-pill-top">' +
          '<span class="scope-badge all">📅 FULL SLATE</span>' +
          '<span class="scope-count">' + upcomingMatchesCount + ' upcoming matches</span>' +
        '</div>' +
        '<div class="scope-pill-name">Next 7 Days (Weekend Slips)</div>' +
        '<div class="scope-pill-desc">Searches upcoming rounds kicking off tomorrow & across week</div>' +
      '</button>' +
    '</div>' +
  '</div>';

  return '<section class="builder" aria-labelledby="builder-title">' +
    '<div class="builder-top-bar">' +
      '<div><div class="builder-kicker">Bet Builder</div><h1 class="page-title" id="builder-title">Tell us the win. We’ll build the bet.</h1></div>' +
      '<div id="builder-panda-mood">' + accaVolatilityMarkup(builderResult && builderResult.slips && builderResult.slips[0], builderState.win) + '</div>' +
    '</div>' +
    '<p class="page-sub">Pick a stake, how many bets and how much you want to win. Bet Buddy searches every upcoming match for the combined bet (accumulator) that hits your target with the best chance of landing.</p>' +
    scopeToggle +
    '<div class="builder-form"><div class="field"><label for="b-stake">Stake (£)</label><input id="b-stake" class="ctl mono" type="number" inputmode="decimal" min="0.5" max="10000" step="0.5" value="' + stake + '" data-b="stake" aria-label="Stake amount in pounds">' +
    '<div class="stake-safety-note" style="font-size:12px;color:#fbbf24;margin-top:4px;display:flex;align-items:center;gap:4px;"><span>⚠️</span><span>Recreational limit: only stake what you are happy to lose (£5–£10).</span></div></div>' +
    '<div class="field"><span class="lbl" id="b-legs-l">Number of bets in accumulator <small style="color:var(--soft);font-weight:normal;">(2 = 2-team acca, 3 = 3 teams, 4 = 4 teams...)</small></span><div class="legpicks" role="group" aria-labelledby="b-legs-l">' + legChips +
    '<input id="b-legs" class="ctl mono legs-input" type="number" inputmode="numeric" min="1" max="' + MatchIQBuilder.MAX_LEGS + '" step="1" value="' + legs + '" data-b="legs" aria-label="Number of bets"></div></div>' +
    '<div class="field full"><label for="b-win">Target return (£): <b class="mono" id="b-win-out">' + MatchIQBuilder.money(win) + '</b></label>' +
    '<div class="win-input-wrap"><div class="currency-input-wrap"><span class="currency-symbol">£</span><input id="b-win" class="ctl mono win-input" type="number" inputmode="decimal" min="1" max="10000" step="1" value="' + win + '" data-b="win" placeholder="50"></div>' +
    '<div class="win-chips" role="group" aria-label="Preset return targets">' + winPresets + '</div></div></div></div>' +
    '<div id="builder-out" class="builder-out" aria-live="polite">' + builderOutput() + '</div>' +
    '<p class="builder-foot">18+ only. Gambling can be addictive; play responsibly. <a href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware.org</a>. Bet Buddy does not take bets, and nothing here is a guarantee.</p></section>';
}

function updateBuilder() {
  builderCompute();
  const out = $('builder-out');
  if (out) out.innerHTML = builderOutput();
  const moodWrap = $('builder-panda-mood');
  if (moodWrap) {
    moodWrap.innerHTML = accaVolatilityMarkup(builderResult && builderResult.slips && builderResult.slips[0], builderState.win);
  }
}

function markLegChips() {
  const current = Number(builderState.legs);
  document.querySelectorAll('.legpick').forEach(b => {
    const isSel = +b.dataset.legs === current;
    b.setAttribute('aria-pressed', String(isSel));
    b.classList.toggle('active', isSel);
  });
}

function markWinChips() {
  document.querySelectorAll('.win-chip').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.win === builderState.win)));
}

function setBuilderLegs(n) {
  const num = Math.max(1, Math.min(MatchIQBuilder.MAX_LEGS, Number(n) || 4));
  builderState.legs = num;
  try { localStorage.setItem(BUILDER_KEY, JSON.stringify(builderState)); } catch (e) {}
  const inp = $('b-legs'); if (inp) inp.value = num;
  markLegChips();
  updateBuilder();
  render();
}

function setBuilderTiming(mode) {
  builderState.timing = mode;
  try { localStorage.setItem(BUILDER_KEY, JSON.stringify(builderState)); } catch (e) {}
  document.querySelectorAll('.scope-pill').forEach(b => {
    const isActive = b.dataset.timing === mode;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-checked', String(isActive));
  });
  updateBuilder();
  render();
}
window.setBuilderTiming = setBuilderTiming;
window.setBuilderLegs = setBuilderLegs;

function onBuilderInput(t) {
  const v = Number(t.value);
  if (t.dataset.b === 'win') {
    builderState.win = Math.max(1, v);
    $('b-win-out').textContent = MatchIQBuilder.money(builderState.win);
    markWinChips();
  } else if (!Number.isFinite(v) || v <= 0) return;
  else if (t.dataset.b === 'stake') builderState.stake = Math.min(10000, v);
  else if (t.dataset.b === 'legs') {
    builderState.legs = Math.max(1, Math.min(MatchIQBuilder.MAX_LEGS, Math.round(v)));
    try { localStorage.setItem(BUILDER_KEY, JSON.stringify(builderState)); } catch (e) {}
    markLegChips();
    updateBuilder();
    render();
    return;
  }
  clearTimeout(builderTimer);
  builderTimer = setTimeout(updateBuilder, 120);
}

function saveSlipToDiary(i) {
  const slip = builderResult && builderResult.slips && builderResult.slips[i];
  if (!slip) return;
  openDiary({});
  $('modal-bet-type').value = 'accumulator';
  toggleAccumulatorFields();
  if ($('modal-legs-input')) {
    $('modal-legs-input').value = slip.legs.map(l => {
      const matchLabel = l.fixture && l.fixture.home ? (l.fixture.home + (l.fixture.away ? ' v ' + l.fixture.away : '') + ': ') : '';
      const frac = String(l.fractional || fmtOdds(l.odds)).replace(/[≈~]/g, '').trim();
      return (matchLabel + l.label).replace(/^([^:]+:\s*)\1/, '$1') + ' | ' + (frac || 'Evens');
    }).join('\n');
  }
  if ($('modal-stake-input')) $('modal-stake-input').value = Number((builderState && builderState.stake) || 10).toFixed(2);
  if ($('modal-odds-input')) $('modal-odds-input').value = fmtOdds(slip.odds).replace(/[≈~]/g, '');
  if ($('modal-origin-select')) $('modal-origin-select').value = 'matchiq';
  if ($('modal-notes-input')) $('modal-notes-input').value = 'Built by Bet Buddy Bet Builder for a £' + ((builderState && builderState.win) || 50) + ' win. Check any price marked estimate with your bookmaker.';
  updateModalPnlPreview();
}


function beginnerGuides() {
  return '<div class="section"><div class="section-head"><h2 class="section-title">New to Bet Buddy? Quick intelligence guides</h2><span class="section-note">Tap any card to understand how honest football prediction works.</span></div>' +
    '<div class="bento-grid">' +
      '<div class="bento-card"><div class="bento-icon">🎯</div><div><div class="bento-kicker">Betting Intelligence</div><h3 class="bento-title">What is Value?</h3><p class="bento-desc">A 60% chance isn’t value if the bookmaker odds are too low. Value is when the payout beats the true risk.</p></div><span class="bento-badge emerald">+5% EV threshold</span></div>' +
      '<div class="bento-card"><div class="bento-icon">🎲</div><div><div class="bento-kicker">Odds Demystified</div><h3 class="bento-title">6/4 vs 2.50 Odds</h3><p class="bento-desc">6/4 is UK fractional: £6 profit per £4 stake. 2.50 is decimal: total return including stake. Switch anytime in the header!</p></div><span class="bento-badge">Toggle in header</span></div>' +
      '<div class="bento-card"><div class="bento-icon">⚡</div><div><div class="bento-kicker">Accas & Builders</div><h3 class="bento-title">Acca Odds & Return Builder</h3><p class="bento-desc">Combine selections for higher returns. Bet Buddy checks upcoming matches to find the highest-chance path to your win goal.</p></div><span class="bento-badge">Real-time scan</span></div>' +
      '<div class="bento-card"><div class="bento-icon">🛡️</div><div><div class="bento-kicker">Honest Predictions</div><h3 class="bento-title">No Bet is an Answer</h3><p class="bento-desc">When evidence is thin, odds are bad or data is missing, we say No Bet. We never invent fake confidence or forced picks.</p></div><span class="bento-badge amber">Zero hype</span></div>' +
    '</div></div>';
}

function dismissOnboarding() {
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
          '<div class="onboarding-step-item"><span class="onboarding-step-num">1</span><div><b>Pick Your Slate</b><span>Choose today\'s games or the 7-day slate.</span></div></div>' +
          '<div class="onboarding-step-item"><span class="onboarding-step-num">2</span><div><b>Set Target Return</b><span>Enter stake & how much you aim to win.</span></div></div>' +
          '<div class="onboarding-step-item"><span class="onboarding-step-num">3</span><div><b>Review Model Acca</b><span>Check mathematical probability & expected value.</span></div></div>' +
        '</div>' +
        '<button type="button" class="btn small primary" onclick="dismissOnboarding()" style="min-height:40px;">Got It, Let\'s Go ➔</button>' +
      '</div>';
    }
  } catch (e) {}

  const diaryItems = getStoredDiary();
  const diaryCount = diaryItems.length;
  const user = getAuthUser();
  const userName = user && user.signedIn ? (user.handle || user.name || 'Punter').replace(/^@+/, '').split(' ')[0] : 'Punter';

  return '<div class="welcome-hero-wrap compact-home">' +
    '<!-- 1. Introduction: Ultra-compact, low real estate -->' +
    '<div class="welcome-hero-banner">' +
      '<div class="welcome-mascot-col">' +
        '<div class="welcome-brand-avatar">' +
          '<img src="assets/icon-192.png?v=44" alt="Bet Buddy" width="40" height="40">' +
          '<span class="mascot-online-dot" title="Live Predictions Ready"></span>' +
        '</div>' +
      '</div>' +
      '<div class="welcome-text-col">' +
        '<div class="welcome-badge-tag"><span class="badge-dot"></span> Welcome, ' + esc(userName) + '! · Free &amp; Ad-Free</div>' +
        '<h1 class="welcome-hero-title">Your Honest Sports Betting Co-Pilot</h1>' +
        '<p class="welcome-hero-narrative">Real mathematical edge, live bookie odds &amp; private leagues with mates.</p>' +
      '</div>' +
    '</div>' +

    '<!-- 2. Main Features: Acca Builder & Today\'s Best Value -->' +
    '<div class="portal-grid portal-features-dual">' +
      '<a href="#/picks" class="portal-card portal-card-hero" style="text-decoration:none">' +
        '<div class="portal-card-hero-glow"></div>' +
        '<div class="portal-card-content">' +
          '<div class="portal-card-top">' +
            '<span class="portal-pill highlight">⚡ Primary Feature</span>' +
            '<span class="portal-odds-badge">Dixon-Coles Model</span>' +
          '</div>' +
          '<div class="portal-hero-body">' +
            '<div class="portal-icon-large">⚽🎯</div>' +
            '<div class="portal-hero-text">' +
              '<h2 class="portal-hero-heading">Pick a Bet &amp; Build Acca</h2>' +
              '<p class="portal-hero-desc">Target £10–£1,000 return across 2–6 legs with verified statistical edge, live odds &amp; 1-click accumulator builder.</p>' +
            '</div>' +
            '<div class="portal-card-action">' +
              '<span class="btn primary portal-cta-btn">' +
                '<span>Build Acca</span>' +
                '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
              '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</a>' +

      '<!-- Today\'s Best Value Bet Feature Hero Card -->' +
      '<div class="portal-card portal-card-best-value" onclick="openBestValueModal(\'single\')" style="text-decoration:none;cursor:pointer;">' +
        '<div class="portal-card-hero-glow bv-glow"></div>' +
        '<div class="portal-card-content">' +
          '<div class="portal-card-top">' +
            '<span class="portal-pill bv-highlight">🔥 Highest Edge Today</span>' +
            '<span class="portal-odds-badge">Single &bull; Double &bull; Treble &bull; 4-Fold</span>' +
          '</div>' +
          '<div class="portal-hero-body">' +
            '<div class="portal-icon-large">💎📈</div>' +
            '<div class="portal-hero-text">' +
              '<h2 class="portal-hero-heading">Today\'s Best Value Bet</h2>' +
              '<p class="portal-hero-desc">Peak mathematical value against live UK bookies. View today\'s recommended Value Single, Double, Treble, or 4-Fold Acca.</p>' +
            '</div>' +
            '<div class="portal-card-action">' +
              '<button type="button" class="btn primary portal-cta-btn bv-cta-btn" onclick="event.stopPropagation(); openBestValueModal(\'single\');">' +
                '<span>View Value</span>' +
                '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<!-- Bet Butler Feature Hero Card -->' +
      '<div class="butler-home-hero-card">' +
        '<div class="butler-home-hero-content">' +
          '<div class="butler-home-badge">' +
            '<span class="badge-dot" style="background:#38bdf8;"></span>' +
            '<span>🤵 Your Slip Note: The Bet Butler</span>' +
          '</div>' +
          '<h2 class="butler-home-title">Keep Your Slip In Front Of You With Bet Butler</h2>' +
          '<p class="butler-home-desc">' +
            'Keep your slip in front of you while you add the bets in your bookmaker app. Open your slip card, tick off legs as you enter them, or copy formatted selections with one tap.' +
          '</p>' +
          '<div class="butler-home-features">' +
            '<div class="butler-feat-item"><span class="feat-icon">📋</span> Slip Card Checklist</div>' +
            '<div class="butler-feat-item"><span class="feat-icon">☑️</span> Tick Off Legs in View</div>' +
            '<div class="butler-feat-item"><span class="feat-icon">📑</span> 1-Click Formatted Copy</div>' +
            '<div class="butler-feat-item"><span class="feat-icon">📱</span> Open Bookmaker Football</div>' +
          '</div>' +
          '<div class="butler-home-actions">' +
            '<a href="#/picks" class="btn primary small" style="background:#0284c7;border:none;font-weight:700;">Build Acca in Picks ↗</a>' +
            '<button type="button" class="btn small" onclick="openButlerModal()">Bookmaker Links &amp; Settings ⚙️</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<!-- 3. Smaller Boxes: 2x2 on Mobile, all visible without scrolling -->' +
      '<div class="portal-subgrid">' +
        '<!-- Box 1: Leagues -->' +
        '<a href="#/leagues" class="portal-subcard bento-leagues">' +
          '<div class="portal-subcard-head">' +
            '<div class="portal-subcard-icon-wrap trophy-glow">🏆</div>' +
            '<div class="portal-subcard-tag">Compete</div>' +
          '</div>' +
          '<div class="portal-subcard-text">' +
            '<h3 class="portal-subcard-title">Buddy &amp; Geo Leagues</h3>' +
            '<p class="portal-subcard-desc">Town, UK &amp; World ladders with mates.</p>' +
          '</div>' +
        '</a>' +

        '<!-- Box 2: Upcoming Fixtures -->' +
        '<a href="#/fixtures" class="portal-subcard bento-fixtures">' +
          '<div class="portal-subcard-head">' +
            '<div class="portal-subcard-icon-wrap calendar-glow">📅</div>' +
            '<div class="portal-subcard-tag">Schedule</div>' +
          '</div>' +
          '<div class="portal-subcard-text">' +
            '<h3 class="portal-subcard-title">Upcoming Fixtures</h3>' +
            '<p class="portal-subcard-desc">Match previews, TV &amp; live prices.</p>' +
          '</div>' +
        '</a>' +

        '<!-- Box 3: Results & Audit Ledger -->' +
        '<a href="#/results" class="portal-subcard bento-results">' +
          '<div class="portal-subcard-head">' +
            '<div class="portal-subcard-icon-wrap chart-glow">📊</div>' +
            '<div class="portal-subcard-tag">Track Record</div>' +
          '</div>' +
          '<div class="portal-subcard-text">' +
            '<h3 class="portal-subcard-title">Results &amp; Proof</h3>' +
            '<p class="portal-subcard-desc">Settled audit ledger &amp; accuracy.</p>' +
          '</div>' +
        '</a>' +

        '<!-- Box 4: Bet Diary -->' +
        '<a href="#/diary" class="portal-subcard bento-diary">' +
          '<div class="portal-subcard-head">' +
            '<div class="portal-subcard-icon-wrap diary-glow">📖</div>' +
            '<div class="portal-subcard-tag">Ledger (' + diaryCount + ')</div>' +
          '</div>' +
          '<div class="portal-subcard-text">' +
            '<h3 class="portal-subcard-title">Bet Diary</h3>' +
            '<p class="portal-subcard-desc">Your personal PnL &amp; trophies.</p>' +
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


// ------------------------------------------------------------ Today's Best Value Multi-Leg Acca Engine
function getTodayBestValuePicks() {
  const preds = predictionsList();
  if (!preds || !preds.length) return null;
  const pool = MatchIQBuilder.legPool(preds, {
    calc,
    reliability: DATA.reliability,
    feedFor,
    nowMs: Date.now(),
    timing: 'all'
  });
  if (!pool || !pool.length) return null;

  const withEv = pool.map(leg => {
    const ev = (leg.odds * leg.p) - 1;
    return { ...leg, ev };
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayPool = withEv.filter(l => l.fixture && l.fixture.kickoff_utc && l.fixture.kickoff_utc.slice(0, 10) === todayStr);
  const candidatePool = todayPool.length >= 4 ? todayPool : withEv;
  candidatePool.sort((a, b) => b.ev - a.ev);

  const unique = [];
  const seenMatches = new Set();
  for (const leg of candidatePool) {
    if (!seenMatches.has(leg.matchId)) {
      seenMatches.add(leg.matchId);
      unique.push(leg);
      if (unique.length === 4) break;
    }
  }
  if (!unique.length) return null;

  function formatType(type, legs) {
    const odds = legs.reduce((t, l) => t * (Number(l.odds) || 1), 1);
    const avgEv = legs.reduce((t, l) => t + l.ev, 0) / legs.length;
    const estProb = legs.reduce((t, l) => t * l.p, 1);
    return { type, legs, odds, avgEv, estProb };
  }

  return {
    single: formatType('Single', unique.slice(0, 1)),
    double: formatType('Double', unique.slice(0, 2)),
    treble: formatType('Treble', unique.slice(0, 3)),
    fourFold: formatType('4-Fold Acca', unique.slice(0, 4)),
    topLeg: unique[0]
  };
}

let activeBestValueTier = 'single';

function openBestValueModal(tier) {
  if (tier) activeBestValueTier = tier;
  const modal = $('best-value-modal');
  if (!modal) return;
  renderBestValueModalContent();
  modal.hidden = false;
}

function closeBestValueModal() {
  const modal = $('best-value-modal');
  if (modal) modal.hidden = true;
}

function setBestValueTier(tier) {
  activeBestValueTier = tier;
  renderBestValueModalContent();
}

function renderBestValueModalContent() {
  const data = getTodayBestValuePicks();
  const body = $('best-value-modal-body');
  if (!body) return;
  if (!data) {
    body.innerHTML = '<div class="empty" style="padding:24px;text-align:center;">No upcoming fixtures with live bookmaker prices currently available. Check back soon.</div>';
    return;
  }

  const tierData = data[activeBestValueTier] || data.single;
  const legs = tierData.legs;
  const totalOdds = tierData.odds;
  const avgEv = tierData.avgEv;
  const estProb = tierData.estProb;
  const stake = Number((builderState && builderState.stake) || 10) || 10;
  const potRet = (stake * totalOdds).toFixed(2);
  const profit = (stake * totalOdds - stake).toFixed(2);

  const tabsHtml = '<div class="bv-tabs">' +
    '<button type="button" class="bv-tab' + (activeBestValueTier === 'single' ? ' active' : '') + '" onclick="setBestValueTier(\'single\')">Single (1)</button>' +
    '<button type="button" class="bv-tab' + (activeBestValueTier === 'double' ? ' active' : '') + '" onclick="setBestValueTier(\'double\')">Double (2)</button>' +
    '<button type="button" class="bv-tab' + (activeBestValueTier === 'treble' ? ' active' : '') + '" onclick="setBestValueTier(\'treble\')">Treble (3)</button>' +
    '<button type="button" class="bv-tab' + (activeBestValueTier === 'fourFold' ? ' active' : '') + '" onclick="setBestValueTier(\'fourFold\')">4-Fold (4)</button>' +
  '</div>';

  const legsHtml = '<div class="bv-legs-list">' +
    legs.map((l, i) => {
      const fix = l.fixture || {};
      const matchText = (fix.home && fix.away) ? (fix.home + ' v ' + fix.away) : (fix.home || 'Match');
      const oddsLabel = oddsFormat === 'decimal' ? calc.formatDecimalOdds(l.odds) : (l.fractional || fmtOdds(l.odds));
      const evPct = Math.round(l.ev * 100);
      return '<div class="bv-leg-item">' +
        '<div class="bv-leg-left">' +
          '<span class="bv-leg-num">' + (i + 1) + '</span>' +
          '<div class="bv-leg-info">' +
            '<div class="bv-leg-match">' + esc(matchText) + '</div>' +
            '<div class="bv-leg-sel">' + esc(l.label) + '</div>' +
            '<div class="bv-leg-ev-badge">+' + evPct + '% edge vs ' + esc(l.bookmaker || 'market') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="bv-leg-right">' +
          '<div class="bv-leg-odds mono">' + esc(oddsLabel) + '</div>' +
          '<div class="bv-leg-prob">' + Math.round(l.p * 100) + '% model chance</div>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';

  const statsHtml = '<div class="bv-summary-card">' +
    '<div class="bv-sum-col"><span>Total Odds</span><b class="mono">' + fmtOdds(totalOdds) + '</b></div>' +
    '<div class="bv-sum-col"><span>Est. Edge</span><b class="pos">+' + Math.round(avgEv * 100) + '% EV</b></div>' +
    '<div class="bv-sum-col"><span>Win Chance</span><b class="mono">' + (estProb >= 0.1 ? Math.round(estProb * 100) : (estProb * 100).toFixed(1)) + '%</b></div>' +
    '<div class="bv-sum-col"><span>Returns (£' + stake.toFixed(2) + ')</span><b class="mono emerald">£' + potRet + '</b></div>' +
  '</div>';

  const actionsHtml = '<div class="bv-modal-actions">' +
    '<button type="button" class="btn primary" onclick="addBestValueToDiary(\'' + activeBestValueTier + '\')" style="flex:1;min-height:48px;font-size:15px;font-weight:700;">' +
      '📓 Add to Bet Diary / League 🏆' +
    '</button>' +
    '<button type="button" class="btn" onclick="openSlipCardFromBestValue(\'' + activeBestValueTier + '\')" style="min-height:48px;">' +
      '📋 Slip Card' +
    '</button>' +
  '</div>';

  body.innerHTML = tabsHtml + statsHtml + legsHtml + actionsHtml;
}

function openSlipCardFromBestValue(tier) {
  const data = getTodayBestValuePicks();
  if (!data) return;
  const tierData = data[tier] || data.single;
  closeBestValueModal();
  const stake = Number((builderState && builderState.stake) || 10) || 10;
  activeSlipCardData = {
    isSingle: tierData.legs.length === 1,
    legs: tierData.legs,
    odds: tierData.odds,
    stake: stake,
    ret: (stake * tierData.odds).toFixed(2),
    slipKey: 'bv_' + tier + '_' + tierData.legs.map(l => l.matchId).join('_')
  };
  renderSlipCardModal(activeSlipCardData);
}

function addBestValueToDiary(tier) {
  const data = getTodayBestValuePicks();
  if (!data) return;
  const tierData = data[tier] || data.single;
  closeBestValueModal();
  const legs = tierData.legs;
  const isSingle = legs.length === 1;

  if (isSingle) {
    const l = legs[0];
    const fix = l.fixture || {};
    openDiary({
      id: l.matchId,
      selection: l.label,
      market: MARKETS[l.market] ? MARKETS[l.market].diary : 'wins',
      odds: l.fractional || fmtOdds(l.odds),
      p: l.p,
      fair: calc.formatFractionalOdds(1 / l.p),
      rec: 'best_value',
      notes: "Today\'s Best Value Bet (" + Math.round(l.ev * 100) + "% edge vs " + (l.bookmaker || 'bookmaker') + ")"
    });
  } else {
    openDiary({});
    $('modal-bet-type').value = 'accumulator';
    toggleAccumulatorFields();
    if ($('modal-legs-input')) {
      $('modal-legs-input').value = legs.map(l => {
        const matchLabel = l.fixture && l.fixture.home ? (l.fixture.home + (l.fixture.away ? ' v ' + l.fixture.away : '') + ': ') : '';
        const frac = String(l.fractional || fmtOdds(l.odds)).replace(/[≈~]/g, '').trim();
        return (matchLabel + l.label).replace(/^([^:]+:\s*)\1/, '$1') + ' | ' + (frac || 'Evens');
      }).join('\n');
    }
    if ($('modal-stake-input')) $('modal-stake-input').value = Number((builderState && builderState.stake) || 10).toFixed(2);
    if ($('modal-odds-input')) $('modal-odds-input').value = fmtOdds(tierData.odds).replace(/[≈~]/g, '');
    if ($('modal-origin-select')) $('modal-origin-select').value = 'matchiq';
    if ($('modal-notes-input')) $('modal-notes-input').value = "Today\'s Best Value " + tierData.type + " (avg +" + Math.round(tierData.avgEv * 100) + "% expected value).";
    updateModalPnlPreview();
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
    ? '<div class="notice section shared-slip-notice" style="border-color:var(--cyan);background:rgba(56,189,248,0.12);color:#fff;margin-bottom:18px"><span style="font-size:20px">🎯</span><div><b>Acca shared by a mate!</b> Bet Builder is pre-filled to target £' + builderState.win + ' return across ' + builderState.legs + ' bets.</div><button type="button" class="icon-btn" onclick="sharedSlipNotice=false;render()" style="margin-left:auto">&times;</button></div>'
    : '';
  const beginnerGlossary = '<details class="section card guide-collapsible" style="margin:16px 0 20px;padding:12px 16px;background:rgba(15,23,42,0.6);border:1px solid rgba(56,189,248,0.25);border-radius:12px;">' +
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
  const searchBar = '<div class="search-bar"><label for="club-search" class="sr-only">Search clubs</label><svg viewBox="0 0 24 24" class="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input type="search" id="club-search" class="ctl search-input" placeholder="Search by club (e.g. Arsenal, Liverpool)..." value="' + esc(clubFilter) + '" autocomplete="off" aria-label="Search clubs by name"></div>';
  const legendBox = '<div class="match-list-legend">💡 <b>Quick Guide:</b> <b>Most likely</b>' + jargonTip('most likely') + ' is our highest-confidence statistical call across all 6 markets. <b>Lean</b>' + jargonTip('lean') + ' shows the pure 1X2 match winner probability.</div>';
  
  html += '<details class="section card match-list-collapsible" style="margin-top:28px;"' + (clubFilter ? ' open' : '') + '>' +
    '<summary><span>⚽ Match by Match Predictions (' + filteredRound.length + ' matches)</span><span class="btn small" style="pointer-events:none;">Tap to view ▾</span></summary>' +
    legendBox +
    searchBar +
    (filteredRound.length ? filteredRound.map(matchRecRow).join('') : '<div class="empty">No matches found for "' + esc(clubFilter) + '".</div>') +
    '</details>';
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
    // Strictly upcoming scheduled future matches: exclude cancelled, removed, or past fixtures
    list = all.filter(f => f.status === 'SCHEDULED' && kickoffMs(f) > now).sort((a, b) => kickoffMs(a) - kickoffMs(b));
    if (!fixturesShowAll) list = list.filter(f => kickoffMs(f) - now < 35 * 86400000);
  } else if (fixturesTab === 'awaiting') {
    list = all.filter(f => f.status === 'AWAITING_RESULT' || f.status === 'RESULT_CONFLICT').sort((a, b) => kickoffMs(b) - kickoffMs(a));
  } else {
    list = all.filter(f => f.status === 'FINISHED').sort((a, b) => kickoffMs(b) - kickoffMs(a)).slice(0, fixturesShowAll ? 400 : 30);
  }
  if (clubFilter) list = list.filter(f => f.home.toLowerCase().includes(clubFilter) || f.away.toLowerCase().includes(clubFilter));
  const searchBar = '<div class="search-bar"><svg viewBox="0 0 24 24" class="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input type="search" id="club-search" class="ctl search-input" placeholder="Search club (e.g. Arsenal, Liverpool)..." value="' + esc(clubFilter) + '" autocomplete="off"></div>';
  let html = '<section class="view"><h1 class="page-title">Fixtures</h1><p class="page-sub">' + (compFilter === 'ALL' ? 'All ' + Object.keys(LEAGUES).length + ' competitions' : esc(leagueName(compFilter))) + ' 2026/27. The schedule refreshes automatically; matches leave Upcoming at kick-off and move to Results once a source confirms the score.</p>' +
    compBar() + searchBar + '<div class="section" style="margin-top:16px;display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between"><div class="seg" role="group" aria-label="Fixture list">' +
    Object.entries(tabs).map(([k, label]) => '<button type="button" data-tab="' + k + '" aria-pressed="' + (fixturesTab === k) + '">' + label + '</button>').join('') + '</div><div class="chips">' + freshnessChips() + '</div></div>';
  if (LOAD_ERRORS.fixtures) return html + errorPanel('fixtures') + '</section>';
  html += list.length ? groupedRows(list) : '<div class="empty" style="margin-top:16px">' + (fixturesTab === 'awaiting' ? 'No matches are waiting for a confirmed result.' : 'Nothing to show yet.') + '</div>';
  if ((fixturesTab === 'upcoming' || fixturesTab === 'results') && !fixturesShowAll) html += '<button type="button" class="btn" data-showall style="margin-top:8px">Show ' + (fixturesTab === 'upcoming' ? 'the rest of the season' : 'all results') + '</button>';
  return html + '</section>';
}

function matchVerdictCard(pred) {
  if (!pred) return '';
  const sels = allSelections(pred), prices = pricesFor(pred.match_id);
  const best = calc.bestValue(pred, prices, matchIQBands());
  const sel = sels.find(s => s.id === prices._selected) || (best && best.sel) || sels.find(s => s.id === 'result:' + pred.markets.result.pick.key) || sels[0];
  if (!sel) return '';
  const siblings = sels.filter(s => s.group === sel.group && s.id !== sel.id);
  const verdict = valueVerdict(sel, prices[sel.id], siblings, prices);
  const v = best ? best.v.verdict : verdict.verdict;

  // Line 1: our estimate
  const estLine = 'Our estimate: <b>' + esc(sel.label) + '</b> ' + pct(sel.p) + ' (fair odds <span class="mono">' + esc(fmtFairOdds(sel.fair, sel.p)) + '</span>)';

  // Line 2: smallest price worth taking (+5% EV threshold)
  const minWorthTakingDec = (1 + (calc.VALUE_MIN_EV || 0.05)) / sel.p;
  const minOddsText = fmtOdds(minWorthTakingDec);
  const minLine = 'Smallest price worth taking: <b class="mono">' + esc(minOddsText) + '</b> (' + minWorthTakingDec.toFixed(2) + ')';

  // Line 3: verdict in words
  let verdictWords = 'Awaiting Odds — no live bookmaker price entered yet';
  let verdictBadge = 'awaiting';
  if (v === 'value') {
    verdictWords = 'Potential Value — bookmaker price exceeds minimum worth taking';
    verdictBadge = 'value';
  } else if (v === 'no_value') {
    verdictWords = 'No Bet — price too short for estimated win chance';
    verdictBadge = 'nobet';
  } else if (v === 'no_bet') {
    verdictWords = 'No Bet — insufficient backtest edge or sample';
    verdictBadge = 'nobet';
  }
  const verdictLine = 'Verdict: <b class="badge ' + verdictBadge + '" style="font-size:12px;vertical-align:middle;margin:0 4px;">' + (VALUE_HEAD[v] ? VALUE_HEAD[v][1] : 'No Bet') + '</b> ' + esc(verdictWords);

  // High EV warning flag (> 30%)
  let flagHtml = '';
  if (verdict.ev != null && verdict.ev > 0.30) {
    flagHtml = '<div class="ev-high-flag" style="margin-top:10px;padding:8px 12px;background:rgba(234,179,8,0.15);border:1px solid rgba(234,179,8,0.4);border-radius:8px;color:#fef08a;font-size:13px;display:flex;align-items:center;gap:8px;">' +
      '<span style="font-size:16px;">⚠️</span><span><b>Unusually high (+' + Math.round(verdict.ev * 100) + '% EV):</b> check the price with the bookmaker — market odds may have shifted or been misquoted.</span>' +
    '</div>';
  }

  return '<div class="match-top-verdict card section" style="background:linear-gradient(145deg, rgba(15,23,42,0.95), rgba(30,41,59,0.85));border:1px solid rgba(56,189,248,0.3);box-shadow:0 8px 24px rgba(0,0,0,0.3);padding:16px 18px;border-radius:14px;margin-bottom:16px;">' +
    '<div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--cyan);margin-bottom:8px;">Match Verdict</div>' +
    '<div class="verdict-three-lines" style="display:flex;flex-direction:column;gap:6px;font-size:14px;line-height:1.45;color:#e2e8f0;">' +
      '<div>' + estLine + '</div>' +
      '<div>' + minLine + '</div>' +
      '<div>' + verdictLine + '</div>' +
    '</div>' +
    flagHtml +
  '</div>';
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
    html += matchVerdictCard(pred) +
      '<div class="section">' + recommendationPair(pred) + '</div>' +
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

let resultsSportFilter = 'football';
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
}
function viewResults() {
  if (resultsSportFilter && resultsSportFilter !== 'football') {
    return renderMultiSportResults(resultsSportFilter);
  }

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

  const minReportN = perf.min_report_n || 20;
  const isEarly = settled.length < minReportN;
  const headlineStatus = isEarly ? 'too early to judge' : 'tracking live';
  const headlineText = settled.length + ' prediction' + (settled.length === 1 ? '' : 's') + ' settled so far; ' + headlineStatus;
  const hitRateSummary = res && res.n ? Math.round(res.pick_hit_rate * 100) + '% of match-result picks won (' + res.hits + ' of ' + res.n + ')' : 'No settled results in this competition yet';

  const sportResultsBar = '<div class="comp-bar" role="group" aria-label="Sport Selection" style="margin-bottom:14px;">' +
    [['football', '⚽ Football'], ['tennis', '🎾 Tennis'], ['golf', '⛳ Golf'], ['darts', '🎯 Darts'], ['rugby', '🏉 Rugby']].map(([k, l]) =>
      '<button type="button" data-sport-rfilter="' + k + '" aria-pressed="' + (resultsSportFilter === k) + '">' + esc(l) + '</button>'
    ).join('') +
  '</div>';

  const liveSyncBar = '<div class="results-live-tracker" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:8px 12px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:8px;margin-bottom:12px;font-size:13px;">' +
    '<span style="display:inline-flex;align-items:center;gap:7px;color:#10b981;font-weight:600;">' +
      '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;animation:pulse 2s infinite;"></span>' +
      'All Leagues & Sports Auto-Tracking Active' +
    '</span>' +
    '<button type="button" class="btn small" onclick="checkAutoUpdateResults(true)" style="padding:4px 10px;font-size:12px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:6px;cursor:pointer;">Check Latest Scores 🔄</button>' +
  '</div>';

  let html = '<section class="view"><h1 class="page-title">Results & performance</h1><p class="page-sub">Every prediction Bet Buddy publishes is sealed before kick-off and scored once the result is confirmed. Nothing here is edited after the fact.</p>' +
    liveSyncBar + sportResultsBar + compBar() +
    (compFilter === 'ALL' ? '<div class="notice section">Scorecards are kept per competition and never pooled. The figures below are the Premier League; choose a competition above for another.</div>' + byCompetitionCards(allPerf) : '');
  if (LOAD_ERRORS.history) return html + errorPanel('history') + '</section>';

  // Plain headline first
  html += '<div class="results-lead-card card section" style="background:linear-gradient(135deg, rgba(30,41,59,0.8), rgba(15,23,42,0.95));border:1px solid rgba(255,255,255,0.1);padding:18px 20px;border-radius:12px;margin:16px 0;">' +
    '<h2 style="font-size:20px;font-weight:700;margin:0 0 6px;color:#fff;">' + esc(headlineText) + '</h2>' +
    '<p style="margin:0;font-size:14.5px;color:var(--soft);">' + esc(hitRateSummary) + '. Live sample needs at least ' + minReportN + ' settled matches before accuracy figures are statistically meaningful.</p>' +
  '</div>';

  // Lead with simple "How often were we right?" tiles
  html += '<div class="tiles section" style="margin-top:16px">' +
    '<div class="tile"><div class="k">Settled predictions</div><div class="v">' + settled.length + '</div><div class="s">' + pending.length + ' awaiting a result • ' + future.length + ' upcoming</div></div>' +
    '<div class="tile"><div class="k">Match-result picks won</div><div class="v">' + (res ? pct(res.pick_hit_rate) : '–') + '</div><div class="s">' + (res ? res.n + ' matches • average pick ' + pct(res.mean_pick_p) : 'none settled yet') + '</div></div>' +
  '</div>';

  // Move technical stats (Brier score, calibration, live record by market, challenger) under "Show the maths"
  const marketCards = MARKET_ORDER.filter(k => (perf.markets || {})[k]).map(k => { const m = perf.markets[k];
    return statCard(esc(MARKETS[k].name), m.sufficient_sample ? '' : '<span class="badge pending">small sample</span>',
      [['Settled', m.n], ['Picks right', pct(m.pick_hit_rate)], ['Brier', m.brier.toFixed(3)]], { claimed: m.mean_pick_p, actual: m.pick_hit_rate }); }).join('');

  const bands = (perf.bands || {}).result || {};
  const bandRows = Object.entries(bands).sort().map(([band, b]) => '<div class="calib-row"><span class="mono">' + esc(band) + '</span><div class="calib-bars" aria-label="Predicted ' + pct(b.mean_pick_p) + ', happened ' + pct(b.pick_hit_rate) + '"><span class="pred" style="width:' + (100 * b.mean_pick_p).toFixed(0) + '%"></span><span class="obs" style="width:' + (100 * b.pick_hit_rate).toFixed(0) + '%"></span></div><span class="mono dim">' + pct(b.pick_hit_rate) + ' • n=' + b.n + '</span></div>').join('');
  const tiers = perf.tiers || {};
  const tierLabel = { T1: 'Validated frozen model', T2: 'Provisional: promoted clubs', T3: 'League average fallback', L1: 'League model (provisional, one-season backtest)' };
  const teams = Object.entries(perf.teams || {}).filter(([, t]) => t.n >= 5).sort((a, b) => b[1].n - a[1].n);
  const ch = perf.challenger;

  html += '<details class="section card maths-section" style="margin-top:20px;">' +
    '<summary style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;min-height:44px;font-weight:600;font-size:15px;color:var(--cyan);">' +
      '<span>🔬 Show the maths (Brier score, calibration & model details)</span>' +
      '<span class="btn small" style="pointer-events:none;">Toggle ▾</span>' +
    '</summary>' +
    '<div style="padding:16px 0 6px;">' +
      '<div class="tiles section" style="margin-top:0;margin-bottom:16px;">' +
        '<div class="tile"><div class="k">Forecast accuracy (Brier score)</div><div class="v">' + (res ? res.brier.toFixed(3) : '–') + '</div><div class="s">Lower is better (closer to 0 is more accurate). League average was ' + (lv && lv.markets.result ? lv.markets.result.league_brier.toFixed(3) : rel ? rel.markets.wins.league_average_brier.toFixed(3) : '0.660') + ' in the backtest.</div></div>' +
        '<div class="tile"><div class="k">Published records</div><div class="v">' + (perf.published_records || 0) + '</div><div class="s">including earlier revisions</div></div>' +
      '</div>' +
      '<div class="section card"><div class="section-head"><h2 class="section-title">Live record by market</h2><span class="section-note">The two bars should sit close together if the estimates are honest.</span></div>' +
        (marketCards ? '<div class="stat-cards">' + marketCards + '</div>' : '<p class="muted">No settled predictions yet.</p>') +
      '</div>' +
      '<div class="grid grid-2" style="margin-top:16px;"><div class="card"><h2 class="section-title">Calibration, live</h2><p class="section-note" style="margin:4px 0 12px">Pale bar: average predicted chance. Green bar: how often it happened.</p>' + (bandRows ? '<div class="calib">' + bandRows + '</div>' : '<p class="muted">Appears once predictions settle.</p>') + '</div>' +
      (other ? leagueBacktestCard(lv) : backtestCard(rel)) + '</div>' +
      scorecard(perf) +
      '<div class="grid grid-2" style="margin-top:16px;"><div class="card"><h2 class="section-title">By prediction source</h2><table class="table" style="margin-top:8px"><tbody>' +
      (Object.keys(tiers).length ? Object.entries(tiers).map(([t, s]) => '<tr><td>' + esc(tierLabel[t] || t) + '</td><td class="num">' + s.n + '</td><td class="num">' + pct(s.pick_hit_rate) + '</td><td class="num">' + s.brier.toFixed(3) + '</td></tr>').join('') : '<tr><td class="muted">No settled predictions yet.</td></tr>') +
      '</tbody></table>' + (teams.length ? '<h3 class="day-label">By club (5+ settled)</h3><table class="table"><tbody>' + teams.map(([t, s]) => '<tr><td><span class="teams-line">' + crest(t, 18) + esc(t) + '</span></td><td class="num">' + s.n + '</td><td class="num">' + pct(s.pick_hit_rate) + '</td></tr>').join('') + '</tbody></table>' : '<p class="section-note" style="margin-top:10px">Club breakdowns appear once a club has 5 settled predictions.</p>') + '</div>' +
      '<div class="card"><h2 class="section-title">Challenger watch</h2><p class="muted" style="margin-top:6px">' + (ch ? esc(ch.challenger) + ' runs in the shadow of ' + esc(ch.production) + ' on the same fixtures. It never changes what you see.' : 'No challenger data.') + '</p>' +
      (ch ? '<p style="margin-top:10px"><b>' + esc(ch.recommendation) + '</b></p>' + (ch.delta_brier != null ? '<p class="dim mono" style="margin-top:6px">ΔBrier ' + ch.delta_brier.toFixed(4) + ' [' + ch.delta_brier_ci95.join(', ') + '], n=' + ch.n + '</p>' : '') : '') +
      '<p class="section-note" style="margin-top:10px">Promotion needs ' + (ch ? ch.min_n_for_promotion : 150) + '+ settled matches, a 95% interval clear of zero and owner approval. The current model stays pinned for rollback.</p></div></div>' +
    '</div></details>';

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
    if (typeof syncDiaryToCloud === 'function') {
      syncDiaryToCloud();
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

// ------------------------------------------------------------ Firebase Firestore & Auth Cloud Sync
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
let firebaseAuth = null;

try {
  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    firestoreDb = firebase.firestore();
    if (firebase.auth) {
      firebaseAuth = firebase.auth();
      try {
        if (firebase.auth.Auth && firebase.auth.Auth.Persistence) {
          firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(e) {
            console.warn('Firebase setPersistence notice:', e);
          });
        }
      } catch (e) {}
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.search.includes('emulator=1')) {
      if (firebaseAuth && firebaseAuth.useEmulator) {
        firebaseAuth.useEmulator('http://127.0.0.1:9099');
      }
      if (firestoreDb && firestoreDb.useEmulator) {
        firestoreDb.useEmulator('127.0.0.1', 8080);
      }
      console.log('Attached Firebase emulators (Auth: 9099, Firestore: 8080)');
    }
  }
} catch (e) {
  console.warn('Firebase init notice:', e);
}

let activeLeagueUnsubscribe = null;
let activeMembersUnsubscribe = null;

const LEAGUE_CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function generateSecureLeagueCode(length = 8) {
  let result = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += LEAGUE_CODE_CHARS[bytes[i] % LEAGUE_CODE_CHARS.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += LEAGUE_CODE_CHARS[Math.floor(Math.random() * LEAGUE_CODE_CHARS.length)];
    }
  }
  return result;
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
      if (Array.isArray(parsed)) {
        return parsed.filter(m => m && m.handle && m.handle !== 'HeadPark73' && m.handle !== 'Punter_747' && m.handle !== 'Punter_737');
      }
    }
  } catch (e) {}
  return [];
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
  // Geo leagues are read-only public leaderboards in security rules; client mutations disabled
}

async function renameLeague(code) {
  const list = getStoredLeagues();
  const target = list.find(l => l.code === code);
  const currentName = target ? (typeof target.name === 'function' ? target.name() : target.name) : 'Buddy League';
  const user = getAuthUser();
  if (target && target.creatorUid && (!user || user.uid !== target.creatorUid)) {
    toast('Only the league creator can rename this league.');
    return;
  }
  const newName = prompt('Enter new name for your league (3–40 characters):', currentName);
  if (!newName || !newName.trim()) return;
  const cleanName = newName.trim();
  if (cleanName.length < 3 || cleanName.length > 40) {
    toast('League name must be between 3 and 40 characters.');
    return;
  }
  if (target) {
    target.name = cleanName;
    saveStoredLeagues(list);
  }
  if (firestoreDb && code && user && user.emailVerified) {
    try {
      await firestoreDb.collection('leagues').doc(code).update({
        name: cleanName,
        updatedAt: new Date().toISOString()
      });
      await firestoreDb.collection('users').doc(user.uid).collection('leagueMemberships').doc(code).set({
        name: cleanName
      }, { merge: true }).catch(() => {});
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
  const user = getAuthUser();
  try {
    const snap = await firestoreDb.collection('leagues').doc(code).get();
    if (snap.exists) {
      const data = snap.data();
      const list = getStoredLeagues();
      const target = list.find(l => l.code === code);
      if (target) {
        const memSnap = await firestoreDb.collection('leagues').doc(code).collection('members').get();
        const mems = [];
        memSnap.forEach(d => mems.push({ ...d.data(), uid: d.id }));
        target.members = mems.filter(m => user ? m.uid !== user.uid : true);
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

async function kickPlayerFromLeague(leagueCode, memberUid, handle) {
  const user = getAuthUser();
  const list = getStoredLeagues();
  const target = list.find(l => l.code === leagueCode);
  if (target && target.creatorUid && (!user || user.uid !== target.creatorUid)) {
    toast('Only the league creator can throw players out.');
    return;
  }
  if (!confirm('Are you sure you want to throw @' + (handle || 'this punter') + ' out of this league?')) return;
  toast('Removing @' + (handle || 'punter') + '...');

  if (target && target.members) {
    target.members = target.members.filter(m => (memberUid && m.uid) ? m.uid !== memberUid : m.handle !== handle);
    saveStoredLeagues(list);
  }

  if (firestoreDb && leagueCode) {
    try {
      if (memberUid) {
        await firestoreDb.collection('leagues').doc(leagueCode).collection('members').doc(memberUid).delete();
      }
      toast('@' + (handle || 'punter') + ' thrown out of league.');
    } catch (e) {
      console.warn('Kick error:', e);
      toast('@' + (handle || 'punter') + ' removed locally.');
    }
  }
  render();
}

async function leaveLeague(leagueId, leagueCode) {
  const list = getStoredLeagues();
  const target = list.find(l => l.id === leagueId || l.code === leagueCode);
  const name = target ? (typeof target.name === 'function' ? target.name() : target.name) : 'this league';
  if (!confirm('Are you sure you want to leave ' + name + '?\nYour stats will be removed from this leaderboard.')) return;

  toast('Leaving league...');
  const user = getAuthUser();

  if (firestoreDb && leagueCode && user && user.uid) {
    try {
      await firestoreDb.collection('leagues').doc(leagueCode).collection('members').doc(user.uid).delete();
      await firestoreDb.collection('users').doc(user.uid).collection('leagueMemberships').doc(leagueCode).delete();
    } catch (e) {
      console.warn('Leave league notice:', e);
    }
  }

  const updated = list.filter(l => l.id !== leagueId && l.code !== leagueCode);
  saveStoredLeagues(updated);
  activeLeagueId = 'default';
  toast('You left ' + name + '.');
  render();
}

async function deleteLeague(leagueId, leagueCode) {
  const list = getStoredLeagues();
  const target = list.find(l => l.id === leagueId || l.code === leagueCode);
  const name = target ? (typeof target.name === 'function' ? target.name() : target.name) : 'this league';
  const user = getAuthUser();

  if (target && target.creatorUid && (!user || user.uid !== target.creatorUid)) {
    return leaveLeague(leagueId, leagueCode);
  }

  if (!confirm('Are you sure you want to permanently delete ' + name + '?\nThis will remove the league for all members.')) return;

  toast('Deleting league...');

  if (firestoreDb && leagueCode && user && user.emailVerified) {
    try {
      await firestoreDb.collection('leagues').doc(leagueCode).delete();
      await firestoreDb.collection('users').doc(user.uid).collection('leagueMemberships').doc(leagueCode).delete().catch(() => {});
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

async function syncLeagueToCloud(league) {
  if (!firestoreDb || !league || !league.code) return;
  const user = getAuthUser();
  if (!user || !user.signedIn || !user.emailVerified) return;

  const prof = getUserProfile();
  const uStats = getUserLeagueStats(league.freq || 'weekly');
  const nowIso = new Date().toISOString();

  const memberPayload = {
    uid: user.uid,
    handle: prof.handle,
    avatar: prof.avatar || '⚽',
    points: Math.max(-1000, Math.min(50000, parseInt(uStats.points, 10) || 0)),
    winRate: Math.max(0, Math.min(100, Math.round(+uStats.winRate || 0))),
    roi: Math.max(-100, Math.min(10000, Math.round((+uStats.roi || 0) * 10) / 10)),
    settled: Math.max(0, parseInt(uStats.settled, 10) || 0),
    form: Array.isArray(uStats.form) ? uStats.form.slice(0, 10) : ['—'],
    updatedAt: nowIso
  };

  try {
    const batch = firestoreDb.batch();
    const leagueRef = firestoreDb.collection('leagues').doc(league.code);
    const memberRef = leagueRef.collection('members').doc(user.uid);
    const membershipRef = firestoreDb.collection('users').doc(user.uid).collection('leagueMemberships').doc(league.code);

    const isCreator = !league.is_joined && (!league.creatorUid || league.creatorUid === user.uid);
    if (isCreator) {
      if (!league.creatorUid) league.creatorUid = user.uid;
      if (!league.creatorHandle) league.creatorHandle = prof.handle;
      batch.set(leagueRef, {
        code: league.code,
        name: (league.name || 'Buddy League').slice(0, 40),
        icon: (league.icon || '⚽').slice(0, 10),
        freq: ['weekly', 'monthly', 'yearly'].includes(league.freq) ? league.freq : 'weekly',
        creatorUid: user.uid,
        creatorHandle: prof.handle,
        createdAt: league.createdAt || league.created_at || nowIso,
        updatedAt: nowIso
      }, { merge: true });
    }

    batch.set(memberRef, memberPayload, { merge: true });
    batch.set(membershipRef, {
      code: league.code,
      name: (league.name || 'Buddy League').slice(0, 40),
      icon: (league.icon || '⚽').slice(0, 10),
      role: isCreator ? 'creator' : 'member',
      joinedAt: nowIso
    }, { merge: true });

    await batch.commit();
  } catch (err) {
    console.warn('syncLeagueToCloud notice:', err);
  }
}

let hasSyncedUserLeagues = false;
async function syncUserLeaguesFromCloud() {
  if (!firestoreDb || hasSyncedUserLeagues) return;
  const user = getAuthUser();
  if (!user || !user.signedIn || !user.emailVerified) return;

  try {
    const membershipsSnap = await firestoreDb.collection('users').doc(user.uid).collection('leagueMemberships').get();
    if (!membershipsSnap.empty) {
      const list = getStoredLeagues();
      let changed = false;

      for (const mDoc of membershipsSnap.docs) {
        const memData = mDoc.data() || {};
        const code = memData.code || mDoc.id;
        try {
          const leagueDoc = await firestoreDb.collection('leagues').doc(code).get();
          if (leagueDoc.exists) {
            const lData = leagueDoc.data() || {};
            const membersSnap = await firestoreDb.collection('leagues').doc(code).collection('members').get();
            const membersList = [];
            membersSnap.forEach(d => {
              membersList.push({ ...d.data(), uid: d.id });
            });

            let existing = list.find(l => l.code === code);
            const isCreator = lData.creatorUid === user.uid;
            if (!existing) {
              list.push({
                id: 'league-' + code,
                name: lData.name || ('Buddy League (' + code + ')'),
                icon: lData.icon || '⚽',
                freq: lData.freq || 'weekly',
                code: code,
                creatorUid: lData.creatorUid,
                creatorHandle: lData.creatorHandle || 'Creator',
                created_at: lData.createdAt ? lData.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
                is_joined: !isCreator,
                members: membersList.filter(m => m.uid !== user.uid)
              });
              changed = true;
            } else {
              existing.name = lData.name || existing.name;
              existing.icon = lData.icon || existing.icon;
              existing.freq = lData.freq || existing.freq;
              if (lData.creatorUid) existing.creatorUid = lData.creatorUid;
              if (lData.creatorHandle) existing.creatorHandle = lData.creatorHandle;
              existing.members = membersList.filter(m => m.uid !== user.uid);
              changed = true;
            }
          }
        } catch (lErr) {
          console.warn('Error fetching league ' + code, lErr);
        }
      }

      if (changed) {
        saveStoredLeagues(list);
        render();
      }
    }
    hasSyncedUserLeagues = true;
  } catch (e) {
    console.warn('syncUserLeaguesFromCloud notice:', e);
  }
}

let currentLeagueListeningCode = null;
function listenToActiveLeague(code) {
  if (!firestoreDb || !code) return;
  const user = getAuthUser();
  if (!user || !user.signedIn || !user.emailVerified) return;

  if (currentLeagueListeningCode === code && activeLeagueUnsubscribe) return;
  if (activeLeagueUnsubscribe) {
    try { activeLeagueUnsubscribe(); } catch (e) {}
    activeLeagueUnsubscribe = null;
  }
  if (activeMembersUnsubscribe) {
    try { activeMembersUnsubscribe(); } catch (e) {}
    activeMembersUnsubscribe = null;
  }
  currentLeagueListeningCode = code;

  try {
    const leagueRef = firestoreDb.collection('leagues').doc(code);
    activeLeagueUnsubscribe = leagueRef.onSnapshot(doc => {
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
      if (target) {
        if (data.name) target.name = data.name;
        if (data.icon) target.icon = data.icon;
        if (data.creatorUid) target.creatorUid = data.creatorUid;
        if (data.creatorHandle) target.creatorHandle = data.creatorHandle;
        saveStoredLeagues(list);
        render();
      }
    }, err => console.warn('League listener notice:', err));

    activeMembersUnsubscribe = leagueRef.collection('members').onSnapshot(snap => {
      const list = getStoredLeagues();
      const target = list.find(l => l.code === code);
      if (target && snap) {
        const membersList = [];
        snap.forEach(d => {
          membersList.push({ ...d.data(), uid: d.id });
        });
        target.members = membersList.filter(m => m.uid !== user.uid);
        saveStoredLeagues(list);
        render();
      }
    }, err => console.warn('Members listener notice:', err));
  } catch (e) {
    console.warn('listenToActiveLeague error:', e);
  }
}

async function joinCloudLeague(code) {
  if (!code) return;
  const user = getAuthUser();
  if (!user || !user.signedIn) {
    sessionStorage.setItem('betbuddy_pending_join_league', code);
    toast('Sign in with Google to join leagues and compete with mates');
    openAuthModal();
    return;
  }

  let leagueData = null;
  let membersList = [];

  if (firestoreDb) {
    try {
      const snap = await firestoreDb.collection('leagues').doc(code).get();
      if (!snap.exists) {
        toast('League ' + code + ' not found. Please check code.');
        return;
      }
      leagueData = snap.data();
      const memSnap = await firestoreDb.collection('leagues').doc(code).collection('members').get();
      if (!memSnap.empty) {
        memSnap.forEach(d => {
          membersList.push({ ...d.data(), uid: d.id });
        });
      } else if (leagueData.members) {
        membersList = extractMembersFromDoc(leagueData);
      }
    } catch (e) {
      console.warn('Join cloud fetch notice:', e);
      toast('Could not connect to cloud league: ' + (e.message || 'Error'));
      return;
    }
  }

  const prof = getUserProfile();
  const list = getStoredLeagues();
  let league = list.find(l => l.code === code);
  const leagueName = (leagueData && leagueData.name) || ('Buddy League (' + code + ')');
  const leagueIcon = (leagueData && leagueData.icon) || '⚽';
  const leagueFreq = (leagueData && leagueData.freq) || 'weekly';
  const creatorUid = (leagueData && leagueData.creatorUid) || null;
  const creatorHandle = (leagueData && leagueData.creatorHandle) || null;

  if (!league) {
    league = {
      id: 'league-' + Date.now(),
      name: leagueName,
      icon: leagueIcon,
      freq: leagueFreq,
      code: code,
      is_joined: true,
      creatorUid: creatorUid,
      creatorHandle: creatorHandle,
      created_at: (leagueData && leagueData.createdAt) || new Date().toISOString().slice(0, 10),
      members: membersList.filter(m => (m.uid ? m.uid !== user.uid : m.handle !== prof.handle))
    };
    list.push(league);
  } else {
    league.name = leagueName;
    league.icon = leagueIcon;
    league.freq = leagueFreq;
    if (creatorUid) league.creatorUid = creatorUid;
    if (creatorHandle) league.creatorHandle = creatorHandle;
    league.members = membersList.filter(m => (m.uid ? m.uid !== user.uid : m.handle !== prof.handle));
  }
  saveStoredLeagues(list);
  activeLeagueId = league.id;

  syncLeagueToCloud(league);
  listenToActiveLeague(code);
  toast('Joined ' + leagueName + '! ⚽');
  render();
}

async function syncDiaryToCloud() {
  if (!firestoreDb || !currentAuthUser) return;
  try {
    const diary = getStoredDiary();
    const batch = firestoreDb.batch();
    const userDiaryRef = firestoreDb.collection('users').doc(currentAuthUser.uid).collection('diary');
    diary.forEach(entry => {
      if (entry && entry.id) {
        const docRef = userDiaryRef.doc(String(entry.id));
        batch.set(docRef, entry, { merge: true });
      }
    });
    await batch.commit();
  } catch (e) {
    console.warn('syncDiaryToCloud notice:', e);
  }
}

async function syncDiaryFromCloud() {
  if (!firestoreDb || !currentAuthUser) return;
  try {
    const userDiaryRef = firestoreDb.collection('users').doc(currentAuthUser.uid).collection('diary');
    const snap = await userDiaryRef.get();
    if (!snap.empty) {
      const local = getStoredDiary();
      const localMap = new Map(local.map(d => [String(d.id), d]));
      let added = false;
      snap.forEach(doc => {
        const remote = doc.data();
        if (remote && remote.id && !localMap.has(String(remote.id))) {
          localMap.set(String(remote.id), remote);
          added = true;
        }
      });
      if (added) {
        const merged = Array.from(localMap.values());
        saveStoredDiary(merged);
        render();
      }
    }
  } catch (e) {
    console.warn('syncDiaryFromCloud notice:', e);
  }
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
  // Only bets explicitly entered into the league (inLeague !== false) qualify. Extra bets are Bet Diary only.
  const dailyQualifyingMap = new Map();
  const candidateLeagueBets = settled.filter(e => e.inLeague !== false);
  candidateLeagueBets.slice().reverse().forEach(e => {
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
  // Official Bet Butler Bonus: +5 points on every settled winning qualifying bet placed through Bet Butler
  const points = leagueBets.reduce((sum, e) => {
    return sum + (calc.calculateLeaguePoints(e.odds, e.outcome) || 0);
  }, 0);
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
  return [];
}

function openTrophyCabinet() {
  const trophies = getStoredTrophies();
  const golds = trophies.filter(t => t.placement === 'gold').length;
  const silvers = trophies.filter(t => t.placement === 'silver').length;
  const bronzes = trophies.filter(t => t.placement === 'bronze').length;

  if (trophies.length === 0) {
    $('trophy-cards-grid').innerHTML = '<div class="empty" style="grid-column:1/-1;padding:28px 16px;text-align:center;"><div style="font-size:42px;margin-bottom:10px;">🏆</div><h3 style="color:#fff;margin-bottom:6px;">Trophy Cabinet is Empty</h3><p style="font-size:13px;color:var(--muted);max-width:44ch;margin:0 auto;">You have 0 Silverware. Place top-3 in weekly or monthly Buddy Leagues to win trophies and medals!</p></div>';
    $('trophy-cabinet-modal').hidden = false;
    return;
  }
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
      return list.filter(l => l && l.id && l.id !== 'league-weekend-contenders' && l.code !== 'BUDDY-7482' && l.code !== 'BUDDY-9240');
    }
  } catch (e) { /* ignore */ }
  return [];
}

function saveStoredLeagues(leagues) {
  try { localStorage.setItem(LEAGUES_STORAGE_KEY, JSON.stringify(leagues)); } catch (e) { /* ignore */ }
}

function viewLeagues() {
  const prof = getUserProfile();
  const authUser = getAuthUser();
  const isUserSignedIn = Boolean(authUser && authUser.signedIn);
  const signedOutBanner = !isUserSignedIn
    ? '<div class="signed-out-league-banner" style="margin-bottom:20px;padding:22px 16px;background:linear-gradient(135deg, rgba(2,132,199,0.18), rgba(15,23,42,0.95));border:1px solid rgba(56,189,248,0.4);border-radius:12px;text-align:center;">' +
        '<div style="font-size:32px;margin-bottom:8px;">🏆</div>' +
        '<h2 style="font-size:18px;font-weight:700;color:#fff;margin:0 0 6px;">Sign in with Google to join leagues and compete with mates</h2>' +
        '<p class="muted" style="font-size:13.5px;max-width:480px;margin:0 auto 16px;">Create private leagues, track live leaderboards, and compete against friends with verified model predictions.</p>' +
        '<button type="button" class="btn google-primary-btn" onclick="signInWithGoogle()" style="margin:0 auto;min-height:46px;display:inline-flex;align-items:center;gap:10px;padding:0 24px;">' +
          '<svg class="google-g" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>' +
          '<span>Continue with Google</span>' +
        '</button>' +
      '</div>'
    : '';

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
    const realGeoMembers = getStoredGeoMembers(geoDocId).filter(m => m.handle !== prof.handle && m.handle !== 'HeadPark73' && m.handle !== 'Punter_747' && m.handle !== 'Punter_737');
    allMembers = [...realGeoMembers, userEntry];
  } else {
    const memberMap = new Map();
    (currentLeague.members || []).forEach(m => {
      if (m && m.handle && m.handle !== prof.handle && m.handle !== 'HeadPark73' && m.handle !== 'Punter_747' && m.handle !== 'Punter_737') {
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
      : '<td class="lb-col-action"><button type="button" class="kick-player-btn" data-kick-player="' + esc(m.handle) + '" data-kick-uid="' + esc(m.uid || '') + '" data-league-code="' + esc(currentLeague.code) + '" title="Throw @' + esc(m.handle) + ' out of this league">Kick ✕</button></td>';

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

  return '<section class="view">' + signedOutBanner +
    '<div class="fair-play-banner">' +
      '<span class="fair-play-icon">🛡️</span>' +
      '<div><strong>Fair Play Rule:</strong> Exactly <strong>1 settled bet per calendar day</strong> counts toward your league score. Chronologically first qualifying bet logged each day counts, keeping the competition fair for all players.</div>' +
    '</div>' +
    '<div class="section-head" style="align-items:flex-end"><div>' +
      '<h1 class="page-title">Buddy &amp; Regional Leagues</h1>' +
      '<p class="page-sub">Compete in your 6 automatic hometown and global leagues, or create private mini-leagues with mates. Option A: 20/1 winner = 200 pts, Evens = 10 pts, Loss = -2 pts. <b>Max 1 qualifying bet per day.</b></p>' +
    '</div>' +
    '<div class="btn-row">' +
      '<button type="button" class="btn primary" data-open-league-modal>Create or Join League</button>' +
      '<button type="button" class="trophy-summary-pill' + (trophies.length === 0 ? ' empty' : '') + '" data-open-trophy-cabinet style="' + (trophies.length === 0 ? 'opacity:0.75;' : '') + '">🏆 Trophy Cabinet (' + trophies.length + ' Silverware)</button>' +
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
            (isLeagueCreator
              ? '<button type="button" class="btn danger small" data-delete-league="' + esc(currentLeague.id) + '" data-league-code="' + esc(currentLeague.code) + '" title="Delete this league">Delete League 🗑️</button>'
              : '<button type="button" class="btn secondary small" data-leave-league="' + esc(currentLeague.id) + '" data-league-code="' + esc(currentLeague.code) + '" title="Leave this league">Leave League 🚪</button>') +
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
  if (!all.length) {
    return '<section class="view">' +
      '<h1 class="page-title">Bet Diary</h1>' +
      '<p class="page-sub">Your private record of bets and prices. Stored only in this browser and only for this web address.</p>' +
      (diaryReadFailed ? '<div class="notice error">Saved diary data could not be read. It has been left untouched, and saving is disabled to protect it.</div>' : '') +
      '<div class="empty-diary-card card section" style="text-align:center;padding:48px 24px;border:1px dashed rgba(255,255,255,0.18);border-radius:16px;max-width:540px;margin:28px auto 0;">' +
        '<div style="font-size:42px;margin-bottom:12px;">📓</div>' +
        '<h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 8px;">Your Bet Diary is empty</h2>' +
        '<p style="color:var(--soft);font-size:14px;line-height:1.5;margin:0 0 20px;">Keep track of your bets, monitor your returns over time, and see whether following Bet Buddy or your own picks works best.</p>' +
        '<button type="button" class="btn primary" data-diary="{}" style="min-height:44px;padding:8px 24px;font-size:15px;font-weight:600;">Add your first bet</button>' +
        '<input type="file" id="diary-import" accept="application/json,.json" hidden>' +
      '</div>' +
    '</section>';
  }

  const diary = diaryProfileFilter === 'all' ? all : all.filter(e => (e.profile || 'Default') === diaryProfileFilter);
  const s = calc.summarizeBetDiary(diary);
  const profiles = Array.from(new Set(all.map(e => e.profile || 'Default'))).sort();
  let html = '<section class="view"><div class="section-head" style="align-items:flex-end"><div><h1 class="page-title">Bet Diary</h1><p class="page-sub">Your private record of bets and prices. Stored only in this browser and only for this web address: it does not sync between devices, a different preview address starts empty, and clearing site data removes it. Use Backup, then Import on the other address, to move it.</p></div>' +
    '<div class="btn-row"><button type="button" class="btn primary" data-diary="{}">Add a bet</button><button type="button" class="btn" data-export="csv">Export CSV</button><button type="button" class="btn" data-export="json">Export JSON</button><button type="button" class="btn" data-export="backup">Backup</button><button type="button" class="btn" data-import="diary">Import</button><input type="file" id="diary-import" accept="application/json,.json" hidden></div></div>';
  if (diaryReadFailed) html += '<div class="notice error">Saved diary data could not be read. It has been left untouched, and saving is disabled to protect it.</div>';
  html += '<div class="tiles section" style="margin-top:16px">' +
    '<div class="tile"><div class="k">Profit / loss</div><div class="v ' + (s.netProfit > 0 ? 'pos' : s.netProfit < 0 ? 'neg' : '') + '">' + (s.netProfit > 0 ? '+' : s.netProfit < 0 ? '-' : '') + money(s.netProfit) + '</div><div class="s">ROI ' + s.roiPct.toFixed(1) + '% on settled stakes</div></div>' +
    '<div class="tile"><div class="k">Staked</div><div class="v">' + money(s.totalStaked) + '</div><div class="s">' + money(s.settledStaked) + ' settled • ' + s.pendingCount + ' pending</div></div>' +
    '<div class="tile"><div class="k">Returned</div><div class="v">' + money(s.totalReturned) + '</div><div class="s">winnings plus void stakes</div></div>' +
    '<div class="tile"><div class="k">Won • lost • void</div><div class="v">' + s.wonCount + ' • ' + s.lostCount + ' • ' + s.voidCount + '</div><div class="s">' + s.originBreakdown.matchiq.count + ' following Bet Buddy • ' + s.originBreakdown.independent.count + ' own choice</div></div></div>';
  html += '<div class="section" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between"><label class="field" style="grid-auto-flow:column;align-items:center;gap:10px"><span class="lbl">Profile</span><select id="diary-profile-filter" class="ctl" style="width:auto"><option value="all">All profiles</option>' +
    profiles.map(p => '<option value="' + esc(p) + '"' + (diaryProfileFilter === p ? ' selected' : '') + '>' + esc(p) + '</option>').join('') + '</select></label>' +
    '<button type="button" class="btn small danger" data-clear-diary>Clear diary</button></div>';
  const chartHtml = diaryPerformanceChart(diary);
  if (!diary.length) return html + '<div class="empty section">No bets match this profile filter.</div></section>';
  return html + chartHtml + '<div class="grid grid-2 section">' + diary.map(betCard).join('') + '</div></section>';
}

function outcomeSelect(value, attrs, label) {
  return '<select class="ctl" style="width:auto;min-height:40px" aria-label="' + esc(label) + '" ' + attrs + '>' +
    ['pending', 'won', 'lost', 'void'].map(o => '<option value="' + o + '"' + (value === o ? ' selected' : '') + '>' + o[0].toUpperCase() + o.slice(1) + '</option>').join('') + '</select>';
}

function betCard(entry) {
  const profit = calc.calculateBetProfit(entry.stake, entry.odds, entry.outcome);
  const pl = profit === null ? '<span class="dim">Potential return ' + money(entry.stake * (entry.odds || 0)) + '</span>'
    : '<span class="' + (profit > 0 ? 'pos' : profit < 0 ? 'neg' : '') + '">' + (profit > 0 ? '+' : profit < 0 ? '-' : '') + money(profit) + '</span> <span class="dim">returned ' + money(entry.stake + profit) + '</span>';
  const legOddsText = leg => (oddsFormat === 'decimal' ? calc.formatDecimalOdds(+leg.odds) : calc.formatFractionalOdds(+leg.odds));
  const legs = entry.type === 'accumulator' ? (entry.legs || []).map((leg, i) => '<div class="leg"><span>' + esc(leg.selection) + ' • <b class="mono">' + legOddsText(leg) + '</b></span>' +
    outcomeSelect(leg.outcome, 'data-leg="' + esc(entry.id) + '" data-index="' + i + '"', 'Settle ' + leg.selection) + '</div>').join('') : '';
  const priceTaken = oddsFormat === 'decimal' ? calc.formatDecimalOdds(+entry.odds) : calc.formatFractionalOdds(+entry.odds);

  const dayKey = (entry.date || (entry.timestamp ? entry.timestamp.slice(0, 10) : '') || '').slice(0, 10);
  const leagueBadge = entry.inLeague
    ? ' <span class="badge" style="background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.5);color:#34d399;font-weight:700;">🏆 League Bet</span>'
    : ' <span class="badge" style="background:rgba(148,163,184,0.12);border:1px solid rgba(148,163,184,0.25);color:#94a3b8;">Diary only</span>';

  const leagueActionBtn = entry.inLeague
    ? '<button type="button" class="btn small" data-toggle-league="' + esc(entry.id) + '" title="Remove from league standings" style="padding:2px 8px;font-size:11px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);color:var(--muted)">Remove from League</button>'
    : (!getLeagueBetForDay(dayKey)
      ? '<button type="button" class="btn small" data-toggle-league="' + esc(entry.id) + '" title="Designate as your 1 qualifying league bet for this day" style="padding:2px 8px;font-size:11px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.35);color:#34d399">🏆 Make League Bet</button>'
      : '');

  return '<article class="card bet"><div class="bet-top"><div><div class="bet-sel">' + esc(entry.selection) + '</div><div class="dim" style="font-size:13px">' + esc(entry.fixture || '') + ' • ' + esc(entry.date || '') + ' • ' + esc(entry.marketName || entry.market || '') + '</div></div>' +
    '<span style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end">' + leagueBadge + '<span class="badge ' + (entry.origin === 'independent' ? 'market' : 'validated') + '">' + (entry.origin === 'independent' ? 'Own choice' : 'Bet Buddy pick') + '</span>' +
      (entry.realBetVerified ? ' <span class="badge" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;">🎖️ Real Bet (2x Pts)</span>' : '') +
      (entry.recommendation ? '<span class="badge provisional">' + esc(REC_LABEL[entry.recommendation] || entry.recommendation) + '</span>' : '') + '</span></div>' + legs +
    '<div class="bet-facts"><div><span>Price taken</span><b>' + priceTaken + '</b></div>' +
      (entry.model_fair_odds ? '<div><span>Model fair odds</span><b>' + esc(fmtFairOdds(entry.model_fair_odds, entry.model_p)) + '</b></div>' : '') +
      '<div><span>Stake</span><b>' + money(+entry.stake) + '</b></div><div><span>Bookmaker</span><b style="font-family:var(--body)">' + esc(entry.bookmaker || '-') + '</b></div>' +
      '<div><span>Profile</span><b style="font-family:var(--body)">' + esc(entry.profile || 'Default') + (entry.type === 'accumulator' ? ' • ' + (entry.legs || []).length + '-pick combined bet' : '') + '</b></div></div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between"><span>' + pl + '</span><span style="display:flex;gap:8px;align-items:center">' +
      leagueActionBtn +
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

function getLeagueBetForDay(dayKey) {
  if (!dayKey) return null;
  const diary = getStoredDiary();
  return diary.find(e => {
    const d = (e.date || (e.timestamp ? e.timestamp.slice(0, 10) : '') || '').slice(0, 10);
    return d === dayKey && e.inLeague;
  }) || null;
}

function updateDiarySubmitBtn() {
  const submitBtn = document.querySelector('#diary-form button[type="submit"]');
  if (!submitBtn) return;
  const diaryRadio = $('dest-diary-radio');
  submitBtn.textContent = (diaryRadio && diaryRadio.checked) ? 'Save to Bet Diary only' : 'Save to Diary & League';
}

function updateDiaryDestinationOptions() {
  const acc = $('modal-bet-type') && $('modal-bet-type').value === 'accumulator';
  const f = !acc && $('modal-fixture-select') ? fixtureById($('modal-fixture-select').value) : null;
  const targetDate = f ? f.kickoff_utc.slice(0, 10) : ((modalPrefill && modalPrefill.date) || new Date().toISOString().slice(0, 10));

  const existingLeagueBet = getLeagueBetForDay(targetDate);
  const bothOpt = $('dest-option-both');
  const usedNote = $('modal-dest-league-used-note');
  const bothRadio = $('dest-both-radio');
  const diaryRadio = $('dest-diary-radio');

  if (existingLeagueBet) {
    // If user already picked a bet for the league for that day, remove the option from future bets!
    if (bothOpt) bothOpt.style.display = 'none';
    if (bothRadio) bothRadio.checked = false;
    if (diaryRadio) diaryRadio.checked = true;
    if (usedNote) {
      usedNote.style.display = 'block';
      const nameEl = $('modal-existing-league-bet');
      if (nameEl) nameEl.textContent = existingLeagueBet.selection || existingLeagueBet.fixture || 'Selected bet';
    }
  } else {
    // Both options available: default to 'Add to Bet Diary & to League'
    if (bothOpt) bothOpt.style.display = 'flex';
    if (bothRadio && (!diaryRadio || !diaryRadio.checked)) bothRadio.checked = true;
    if (usedNote) usedNote.style.display = 'none';
  }
  updateDiarySubmitBtn();
}

function toggleLeagueBet(id) {
  const diary = getStoredDiary();
  const entry = diary.find(e => e.id === id);
  if (!entry) return;
  const dayKey = (entry.date || (entry.timestamp ? entry.timestamp.slice(0, 10) : '') || '').slice(0, 10);
  if (entry.inLeague) {
    entry.inLeague = false;
    saveStoredDiary(diary);
    toast('Removed from League. Bet is now Diary only.');
    render();
  } else {
    const existing = getLeagueBetForDay(dayKey);
    if (existing && existing.id !== entry.id) {
      toast('You already have a league bet for ' + dayKey + ' (' + (existing.selection || 'existing bet') + '). Remove it first to swap.', 'warn');
      return;
    }
    entry.inLeague = true;
    saveStoredDiary(diary);
    toast('Designated as your League Bet for ' + dayKey + '! 🏆');
    render();
  }
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
  updateDiaryDestinationOptions();
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
  updateDiaryDestinationOptions();
}

function parseAccumulatorLegs() {
  return ($('modal-legs-input').value || '').split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    let selection = line;
    let oddsText = '';
    if (line.includes('|')) {
      const parts = line.split('|');
      selection = parts[0].trim();
      oddsText = parts.slice(1).join('|').trim();
    } else {
      const match = line.match(/^(.*?)(?:@|\sat\s)(≈?~?\d+\/\d+|≈?~?evens?|≈?~?\d+(?:\.\d+)?)\s*$/i);
      if (match) {
        selection = match[1].trim();
        oddsText = match[2].trim();
      }
    }
    const cleanOdds = oddsText.replace(/[≈~]/g, '').trim();
    let parsedOdds = null;
    if (/^evens?$/i.test(cleanOdds) || /^even money$/i.test(cleanOdds)) {
      parsedOdds = 2.0;
    } else if (cleanOdds) {
      parsedOdds = (calc.parseOdds ? calc.parseOdds(cleanOdds) : null) ?? (calc.parseFractionalOdds ? calc.parseFractionalOdds(cleanOdds) : null);
      if (!parsedOdds || !Number.isFinite(parsedOdds) || parsedOdds <= 1) {
        const fracMatch = cleanOdds.match(/(\d+)\s*\/\s*(\d+)/);
        if (fracMatch) {
          const num = Number(fracMatch[1]), den = Number(fracMatch[2]);
          if (den > 0) parsedOdds = 1 + (num / den);
        } else {
          const decMatch = cleanOdds.match(/(\d+\.\d+)/);
          if (decMatch) {
            const dec = Number(decMatch[1]);
            if (dec > 1) parsedOdds = dec;
          }
        }
      }
    }
    return { selection: selection || 'Leg', odds: (parsedOdds && Number.isFinite(parsedOdds) && parsedOdds > 1) ? parsedOdds : null, outcome: 'pending' };
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
  if (acc && (legs.length < 2 || legs.some(l => !l.selection || !Number.isFinite(l.odds) || l.odds <= 1))) { toast('Add at least two legs with valid odds (e.g. "Arsenal win | 4/6" or "Over 2.5 @ Evens").', 'error'); return; }
  if (!acc && (!Number.isFinite(singleOdds) || singleOdds <= 1)) { toast('Enter valid UK fractional odds, such as 6/4, 1/2 or Evens.', 'error'); return; }
  if (!acc && !$('modal-selection-input').value.trim()) { toast('Enter what you backed.', 'error'); return; }
  const odds = acc ? legs.reduce((t, l) => t * l.odds, 1) : singleOdds;
  const f = fixtureById($('modal-fixture-select').value);
  const market = $('modal-market-select').value;
  const linked = f && modalPrefill.id === f.id && !acc;
  const targetDate = f ? f.kickoff_utc.slice(0, 10) : ((modalPrefill && modalPrefill.date) || new Date().toISOString().slice(0, 10));
  const destVal = (document.querySelector('input[name="modal-destination"]:checked') || {}).value || 'diary';
  const existingLeagueBet = getLeagueBetForDay(targetDate);
  const inLeague = destVal === 'league' && !existingLeagueBet;

  const entry = {
    id: 'bet-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), type: acc ? 'accumulator' : 'single',
    profile: (getAuthUser() && getAuthUser().signedIn) ? ('@' + (getAuthUser().handle || (getAuthUser().name || 'User').split(' ')[0])) : ($('modal-profile').value.trim() || 'Default'),
    date: targetDate, match_id: f ? f.id : undefined,
    fixture: f ? f.home + ' v ' + f.away : acc ? 'Accumulator' : 'Not linked to a listed match',
    market: acc ? 'accumulator' : market, marketName: acc ? 'Accumulator' : (Object.values(MARKETS).find(m => m.diary === market) || {}).name || market,
    selection: acc ? legs.map(l => l.selection).join(' + ') : $('modal-selection-input').value.trim(), legs: acc ? legs : undefined,
    origin: $('modal-origin-select').value, bookmaker: $('modal-bookmaker-input').value.trim() || 'Bookmaker',
    odds, stake, potentialReturn: stake * odds, outcome: 'pending', timestamp: new Date().toISOString(),
    inLeague: inLeague,
    model_p: linked && modalPrefill.p != null ? modalPrefill.p : undefined, model_fair_odds: linked ? modalPrefill.fair : undefined,
    recommendation: linked && modalPrefill.rec && $('modal-selection-input').value.trim() === modalPrefill.selection ? modalPrefill.rec : undefined,
    notes: $('modal-notes-input').value.trim()
  };
  try { const diary = getStoredDiary(); diary.unshift(entry); saveStoredDiary(diary); }
  catch (error) { console.error(error); toast('Could not save to this browser. Check storage space or privacy settings.', 'error'); return; }
  closeDiary();
  celebrateSave();
  if (inLeague) {
    toast('Saved to Bet Diary & entered into today\'s leagues! 🏆');
  } else {
    toast('Saved to your Bet Diary.');
  }
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
          '<div class="v mono" style="font-size:16px">' + APP_VERSION + ' (Live)</div>' +
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
      const inp = $('join-league-code');
      if (inp) inp.value = code;
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
const AFFILIATE_TRACKING_KEY = 'betbuddy_affiliate_clicks_v2';
let currentBookieSelection = null;

function getActualPunterCount() {
  const punters = new Set();
  const auth = getAuthUser();
  if (auth && auth.handle) punters.add(auth.handle);

  try {
    const leagues = getStoredLeagues();
    leagues.forEach(l => {
      if (l && l.members && Array.isArray(l.members)) {
        l.members.forEach(m => { if (m && m.handle) punters.add(m.handle); });
      }
    });
  } catch (e) {}

  return Math.max(auth && auth.signedIn ? 1 : 0, punters.size);
}

function getAffiliateClicks() {
  try {
    localStorage.removeItem('betbuddy_affiliate_clicks_v1');
    const list = JSON.parse(localStorage.getItem(AFFILIATE_TRACKING_KEY) || '[]');
    if (Array.isArray(list)) {
      const realList = list.filter(c => c && c.bookie && !['Arsenal Win', '4-Fold Weekend Acca', 'Over 2.5 Goals'].includes(c.selection));
      if (realList.length !== list.length) {
        try { localStorage.setItem(AFFILIATE_TRACKING_KEY, JSON.stringify(realList)); } catch (e) {}
      }
      return realList;
    }
  } catch (e) { /* ignore */ }
  return [];
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


// ------------------------------------------------------------ Phase 1: Smart Direct Bookmaker Deep Links
function getBookieSearchQuery(betData) {
  if (!betData) return 'Football';
  if (betData.legs && betData.legs.length > 0) {
    const firstLeg = betData.legs[0];
    if (firstLeg.fixture) {
      return (firstLeg.fixture.home + ' ' + firstLeg.fixture.away).trim();
    }
  }
  if (betData.fixture) {
    return (betData.fixture.home + ' ' + betData.fixture.away).trim();
  }
  return (betData.selection || 'Football').split(':')[0].replace(/ v /i, ' ').trim();
}



// ------------------------------------------------------------ Bookmaker Football Hub URLs
function buildBookmakerLaunchUrl(bookieKey) {
  const cfg = BOOKMAKERS_CONFIG[bookieKey] || BOOKMAKERS_CONFIG.skybet;
  return cfg.url;
}

function launchBookmakerSlip(bookieKey, slipIdx) {
  const r = builderResult;
  let slip = null;
  if (slipIdx === 'custom') {
    if (customAccaLegs.length === 0) return;
    const stake = (builderState && builderState.stake) || 10;
    const odds = customAccaLegs.reduce((t, l) => t * (l.odds || 2.0), 1);
    slip = { legs: customAccaLegs, stake, odds, ret: stake * odds };
  } else {
    slip = r && r.slips && r.slips[+slipIdx];
  }
  if (!slip) return;

  const bookieNames = {
    coral: 'Coral',
    skybet: 'Sky Bet',
    bet365: 'bet365',
    betfair: 'Betfair',
    paddypower: 'Paddy Power',
    ladbrokes: 'Ladbrokes',
    williamhill: 'William Hill',
    leovegas: 'LeoVegas'
  };
  const bName = bookieNames[bookieKey] || 'Bookmaker';
  trackBookieLaunch(bName, slip);

  const textLines = [
    '🎯 Bet Buddy ' + slip.legs.length + '-Leg Acca (' + fmtOdds(slip.odds) + ')',
    ...slip.legs.map((l, i) => (i + 1) + '. ' + l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label + ' (' + (l.fractional || fmtOdds(l.odds)) + ')'),
    'Stake: £' + slip.stake + ' · Target Return: £' + (slip.ret ? slip.ret.toFixed(2) : (slip.stake * slip.odds).toFixed(2))
  ];
  const copyStr = textLines.join('\n');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(copyStr).catch(() => {});
    }
  } catch (e) {}

  try {
    const stats = getTrafficStats();
    stats.push({ type: 'bookie_click', bookie: bName, ts: Date.now() });
    localStorage.setItem('betbuddy_telemetry_events_v1', JSON.stringify(stats));
  } catch (e) {}

  toast('⚡ Slip copied! Launching ' + bName + ' app...');
  window.location.href = buildBookmakerLaunchUrl(bookieKey, { legs: slip.legs });
}
if (typeof window !== 'undefined') {
  window.buildBookmakerLaunchUrl = buildBookmakerLaunchUrl;
  window.launchBookmakerSlip = launchBookmakerSlip;
}

function openBookieModal(betData) {
  currentBookieSelection = betData || { selection: 'Bet Buddy Selection', fair: 'Best Price' };
  const modal = $('bookie-modal');
  if (!modal) return;
  const labelEl = $('bookie-bet-label');
  const oddsEl = $('bookie-bet-odds');
  if (labelEl) labelEl.textContent = currentBookieSelection.selection;
  if (oddsEl) oddsEl.textContent = currentBookieSelection.fair ? 'Odds: ' + currentBookieSelection.fair : '';
  
  // Format clipboard payload for bookie slip pasting
  let copyStr = currentBookieSelection.selection;
  if (currentBookieSelection.legs && currentBookieSelection.legs.length > 0) {
    copyStr = currentBookieSelection.legs.map((l, i) => (i + 1) + '. ' + l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label + ' (' + (l.fractional || fmtOdds(l.odds)) + ')').join('\n');
  } else if (currentBookieSelection.fair) {
    copyStr += ' @ ' + currentBookieSelection.fair;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(copyStr).catch(() => {});
  }

  // Phase 1: Dynamic Match Deep-Links on all bookie buttons
  const query = getBookieSearchQuery(currentBookieSelection);
  const links = getBookieDeepLinks(query);
  const coralBtn = modal.querySelector('[data-bookie-click="Coral"]');
  if (coralBtn) {
    coralBtn.href = links.coral;
    coralBtn.onclick = () => trackBookieLaunch('Coral', currentBookieSelection);
  }
  const ladBtn = modal.querySelector('[data-bookie-click="Ladbrokes"]');
  if (ladBtn) {
    ladBtn.href = links.ladbrokes;
    ladBtn.onclick = () => trackBookieLaunch('Ladbrokes', currentBookieSelection);
  }
  const b365Btn = modal.querySelector('[data-bookie-click="Bet365"]');
  if (b365Btn) b365Btn.href = links.bet365;
  const skyBtn = modal.querySelector('[data-bookie-click="Sky Bet"]');
  if (skyBtn) skyBtn.href = links.skybet;
  const ppBtn = modal.querySelector('[data-bookie-click="Paddy Power"]');
  if (ppBtn) ppBtn.href = links.paddypower;
  const bfBtn = modal.querySelector('[data-bookie-click="Betfair"]');
  if (bfBtn) bfBtn.href = links.betfair;
  const lvBtn = modal.querySelector('[data-bookie-click="LeoVegas"]');
  if (lvBtn) lvBtn.href = links.leovegas;

  // Render individual leg direct match launchers if this is an Acca
  const legDrawer = $('bookie-legs-drawer');
  if (legDrawer) {
    if (currentBookieSelection.legs && currentBookieSelection.legs.length > 0) {
      legDrawer.innerHTML = '<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);">' +
        '<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--pick);letter-spacing:0.08em;margin-bottom:8px;">Direct Match Launchers (' + currentBookieSelection.legs.length + ' legs)</div>' +
        currentBookieSelection.legs.map((l, i) => {
          const lQuery = (l.fixture.home + ' ' + l.fixture.away).trim();
          const lLinks = getBookieDeepLinks(lQuery);
          return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12.5px;">' +
            '<span style="font-weight:600;color:#fff;">' + (i + 1) + '. ' + esc(l.fixture.home) + ' v ' + esc(l.fixture.away) + '<small style="display:block;color:var(--soft);">' + esc(l.label) + ' (' + esc(l.fractional || fmtOdds(l.odds)) + ')</small></span>' +
            '<span style="display:flex;gap:4px;flex-shrink:0;">' +
              '<a href="' + lLinks.skybet + '" target="_blank" rel="noopener noreferrer" class="btn small" style="padding:2px 8px;font-size:11px;background:rgba(56,189,248,0.15);border:1px solid var(--cyan);color:#38bdf8;">SkyBet ↗</a>' +
              '<a href="' + lLinks.bet365 + '" target="_blank" rel="noopener noreferrer" class="btn small" style="padding:2px 8px;font-size:11px;background:rgba(16,185,129,0.15);border:1px solid var(--emerald);color:#34d399;">Bet365 ↗</a>' +
            '</span>' +
          '</div>';
        }).join('') +
      '</div>';
      legDrawer.hidden = false;
    } else {
      legDrawer.innerHTML = '';
      legDrawer.hidden = true;
    }
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
  const actualPunters = getActualPunterCount();

  if (!stats || typeof stats !== 'object' || stats.date !== today) {
    const prevVisits = (stats && stats.totalVisits) || 0;
    stats = {
      date: today,
      visitsToday: 1,
      totalVisits: prevVisits + 1,
      uniquePunters: actualPunters,
      slipsBuilt: 0,
      lastRefreshed: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dailyHistory: past7
    };
    const lastDay = stats.dailyHistory[stats.dailyHistory.length - 1];
    if (lastDay) {
      lastDay.visits = 1;
      lastDay.clicks = clicks.length;
    }
  } else {
    stats.visitsToday = (stats.visitsToday || 0) + 1;
    stats.totalVisits = (stats.totalVisits || 0) + 1;
    stats.uniquePunters = actualPunters;
    if (!Array.isArray(stats.dailyHistory) || stats.dailyHistory.length < 2) {
      stats.dailyHistory = past7;
    }
    const lastDay = stats.dailyHistory[stats.dailyHistory.length - 1];
    if (lastDay) {
      lastDay.visits = stats.visitsToday;
      lastDay.clicks = clicks.length;
    }
    stats.lastRefreshed = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Force clean metrics strictly matching verified reality
  stats.uniquePunters = actualPunters;
  if (Array.isArray(stats.dailyHistory) && clicks.length === 0) {
    stats.dailyHistory.forEach(day => { day.clicks = 0; });
  }

  try { localStorage.setItem(TRAFFIC_STORAGE_KEY, JSON.stringify(stats)); } catch (e) {}
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
  const h = (Array.isArray(history) && history.length >= 2) ? history : getPast7Days();
  const width = 600, height = 140, pad = 30;
  const maxV = Math.max(...h.map(item => Number(item.visits) || 0), 10);
  const stepX = (width - pad * 2) / (h.length - 1);
  const getY = v => height - pad - (v / maxV) * (height - pad * 2);

  const ptsVisits = h.map((item, i) => ({ x: pad + i * stepX, y: getY(item.visits) }));
  const pathVisits = 'M ' + ptsVisits.map(p => p.x + ' ' + p.y).join(' L ');
  const areaVisits = pathVisits + ' L ' + ptsVisits[ptsVisits.length - 1].x + ' ' + (height - pad) + ' L ' + ptsVisits[0].x + ' ' + (height - pad) + ' Z';

  const ptsClicks = h.map((item, i) => ({ x: pad + i * stepX, y: getY((item.clicks || 0) * 4) }));
  const pathClicks = 'M ' + ptsClicks.map(p => p.x + ' ' + p.y).join(' L ');

  const xLabels = h.map((item, i) => '<text x="' + (pad + i * stepX) + '" y="' + (height - 8) + '" text-anchor="middle" font-size="11" fill="var(--dim)">' + item.day + '</text>').join('');

  return '<svg viewBox="0 0 ' + width + ' ' + height + '" class="pnl-svg-chart" style="width:100%;height:140px">' +
    '<defs>' +
      '<linearGradient id="visGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35"/><stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/></linearGradient>' +
    '</defs>' +
    '<line x1="' + pad + '" y1="' + (height - pad) + '" x2="' + (width - pad) + '" y2="' + (height - pad) + '" stroke="var(--line-strong)" stroke-width="1"/>' +
    '<path d="' + areaVisits + '" fill="url(#visGrad)"/>' +
    '<path d="' + pathVisits + '" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="' + pathClicks + '" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4,4" stroke-linecap="round"/>' +
    ptsVisits.map((p, i) => '<circle cx="' + p.x + '" cy="' + p.y + '" r="3" fill="#38bdf8"><title>' + h[i].day + ': ' + h[i].visits + ' visits</title></circle>').join('') +
    ptsClicks.map((p, i) => '<circle cx="' + p.x + '" cy="' + p.y + '" r="2.5" fill="#f59e0b"><title>' + h[i].day + ': ' + (h[i].clicks || 0) + ' affiliate clicks</title></circle>').join('') +
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
        '<div class="portal-card-top"><span class="portal-pill">🎯 Outbound Links</span></div>' +
        '<h3 class="card-title" style="margin-top:8px">Bookmaker Deep-Linking &amp; Slip Notes</h3>' +
        '<p class="muted" style="font-size:13px;line-height:1.5">Direct outbound links into licensed UK sportsbooks (Sky Bet, Bet365, William Hill, Paddy Power, Betfair, Coral, Ladbrokes) with tracked affiliate attribution.</p>' +
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

  // Bookmaker affiliation status: currently inactive (£0.00 until approved)
  const isAffiliationActivated = false;
  const estCommission = isAffiliationActivated ? (clicks.length * 3.50 + (totalStakedEst * 0.05)).toFixed(2) : '0.00';

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
      '<button type="button" class="chip" data-admin-action="clear-clicks" title="Clear outbound click log" style="background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);">Clear Outbounds</button>' +
    '</div></div>' +
    
    '<div class="admin-metric-grid">' +
      '<div class="admin-metric-card"><div>Total App Visits</div><div class="admin-metric-val cyan">' + stats.totalVisits + '</div><div class="admin-metric-sub">+' + stats.visitsToday + ' today across all devices</div></div>' +
      '<div class="admin-metric-card"><div>Active Punters / Users</div><div class="admin-metric-val">' + stats.uniquePunters + '</div><div class="admin-metric-sub">' + (authUser ? '1 Signed-In (@' + esc(authUser.handle || 'User') + ')' : '1 Signed-In (@HeadPark73)') + '</div></div>' +
      '<div class="admin-metric-card"><div>Bookmaker Outbounds</div><div class="admin-metric-val amber">' + clicks.length + '</div><div class="admin-metric-sub">Affiliate tracking gateways triggered</div></div>' +
      '<div class="admin-metric-card"><div>Est. Commission Earned</div><div class="admin-metric-val emerald">£' + estCommission + '</div><div class="admin-metric-sub">' + (isAffiliationActivated ? 'Projected CPA + 25% NGR pool' : '£0.00 until affiliation activated') + '</div></div>' +
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


// ------------------------------------------------------------ Firebase Auth & Handles
const AUTH_STORAGE_KEY = 'betbuddy_auth_user_v1';
let deferredInstallPrompt = null;
let currentAuthUser = null;
let currentAuthProfile = null;
let cachedAuthUser = null;
try {
  const savedUser = localStorage.getItem(AUTH_STORAGE_KEY);
  if (savedUser) {
    const parsed = JSON.parse(savedUser);
    if (parsed && (parsed.uid || parsed.signedIn)) {
      cachedAuthUser = parsed;
    }
  }
} catch (e) {}
let lastResendVerificationTime = 0;

const HANDLE_REGEX = /^[A-Za-z0-9_]{3,20}$/;
function isValidHandle(h) {
  return typeof h === 'string' && HANDLE_REGEX.test(h);
}

function mapAuthError(err) {
  if (!err) return 'An unexpected error occurred. Please try again.';
  const code = err.code || '';
  if (code === 'auth/unauthorized-domain') {
    const host = window.location.hostname || 'current domain';
    console.error('Firebase Auth unauthorized domain:', host);
    return 'Domain "' + host + '" is not authorised in Firebase. To fix: Go to Firebase Console > Authentication > Settings > Authorised Domains and add ' + host + '.';
  }
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in window closed before completing. Please try again.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
    case 'auth/cancelled-popup-request':
      return 'Previous sign-in request was cancelled. Please try again.';
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled for this project. Check Firebase Console.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes before trying again.';
    default:
      return err.message || 'Authentication error. Please try again.';
  }
}

function showAuthError(boxId, message) {
  const box = $(boxId);
  if (box) {
    box.textContent = message;
    box.hidden = false;
  }
}

function getAuthUser() {
  const activeUser = currentAuthUser || cachedAuthUser;
  if (!activeUser) return null;
  const prof = currentAuthProfile || getUserProfile();
  const providerIds = (activeUser.providerData || []).map(p => p.providerId);
  const isGoogle = providerIds.includes('google.com') || activeUser.isGoogle || activeUser.providerId === 'google.com';
  const isPassword = providerIds.includes('password') || activeUser.isPassword;

  // Derive display username: custom handle > Google name > email username
  let username = (currentAuthProfile && currentAuthProfile.handle) ||
                 (cachedAuthUser && cachedAuthUser.handle && !cachedAuthUser.handle.startsWith('Punter_') ? cachedAuthUser.handle : '') ||
                 (prof && prof.handle && !prof.handle.startsWith('Punter_') ? prof.handle : '') ||
                 activeUser.displayName ||
                 activeUser.name ||
                 (activeUser.email ? activeUser.email.split('@')[0] : 'Punter');

  username = String(username).replace(/^@+/, '').trim() || 'Punter';

  return {
    signedIn: true,
    uid: activeUser.uid,
    name: activeUser.displayName || activeUser.name || username,
    email: activeUser.email || '',
    handle: username,
    photoURL: activeUser.photoURL || '',
    emailVerified: Boolean(activeUser.emailVerified || isGoogle),
    isGoogle,
    isPassword
  };
}

function saveAuthUser(user) {
  if (!user) {
    cachedAuthUser = null;
    try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (e) {}
    updateHeaderAuthUI();
    return;
  }
  const prof = currentAuthProfile || getUserProfile();
  const username = (currentAuthProfile && currentAuthProfile.handle) ||
                   (prof && prof.handle && !prof.handle.startsWith('Punter_') ? prof.handle : '') ||
                   user.displayName ||
                   (user.email ? user.email.split('@')[0] : 'Punter');
  cachedAuthUser = {
    signedIn: true,
    uid: user.uid,
    displayName: user.displayName || username,
    name: user.displayName || username,
    email: user.email || '',
    handle: String(username).replace(/^@+/, ''),
    photoURL: user.photoURL || '',
    isGoogle: true
  };
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(cachedAuthUser));
  } catch (e) {}
  updateHeaderAuthUI();
}

async function claimHandleTransaction(uid, handle, avatar = '⚽') {
  if (!firestoreDb) throw new Error('Firestore not initialized');
  if (!isValidHandle(handle)) throw new Error('Gamertag must be 3–20 letters, numbers, or underscores.');

  const handleLower = handle.toLowerCase();
  const handleRef = firestoreDb.collection('handles').doc(handleLower);
  const userRef = firestoreDb.collection('users').doc(uid);

  return firestoreDb.runTransaction(async tx => {
    const handleDoc = await tx.get(handleRef);
    if (handleDoc.exists) {
      const data = handleDoc.data() || {};
      if (data.uid !== uid) {
        throw new Error('This gamertag is already taken. Please choose another.');
      }
    }
    const userDoc = await tx.get(userRef);
    const existingUserData = userDoc.exists ? userDoc.data() : null;

    let oldHandleLower = null;
    if (existingUserData && existingUserData.handle && existingUserData.handle.toLowerCase() !== handleLower) {
      oldHandleLower = existingUserData.handle.toLowerCase();
    }

    const nowIso = new Date().toISOString();
    tx.set(handleRef, {
      uid: uid,
      handle: handle,
      createdAt: (handleDoc.exists && handleDoc.data().createdAt) ? handleDoc.data().createdAt : nowIso
    });

    if (oldHandleLower) {
      tx.delete(firestoreDb.collection('handles').doc(oldHandleLower));
    }

    const userPayload = {
      handle: handle,
      avatar: avatar,
      updatedAt: nowIso
    };
    if (!existingUserData || !existingUserData.createdAt) {
      userPayload.createdAt = nowIso;
    } else {
      userPayload.createdAt = existingUserData.createdAt;
    }

    tx.set(userRef, userPayload, { merge: true });
  });
}

async function ensureUserProfile(user) {
  if (!user) return;
  try {
    let baseHandle = (user.displayName || (user.email ? user.email.split('@')[0] : 'Punter'))
      .replace(/[^A-Za-z0-9_]/g, '');
    if (baseHandle.length < 3) baseHandle = 'Punter_' + baseHandle;
    if (baseHandle.length > 20) baseHandle = baseHandle.slice(0, 20);

    if (firestoreDb) {
      const userDocRef = firestoreDb.collection('users').doc(user.uid);
      const userDoc = await userDocRef.get();
      if (userDoc.exists) {
        currentAuthProfile = userDoc.data();
        const cur = getUserProfile();
        saveUserProfile(currentAuthProfile.handle || cur.handle, cur.town, cur.region, cur.country);
        saveAuthUser(user);
        return;
      }
      const initialProfile = {
        uid: user.uid,
        handle: baseHandle,
        name: user.displayName || baseHandle,
        email: user.email || '',
        avatar: '⚽',
        createdAt: new Date().toISOString()
      };
      await userDocRef.set(initialProfile, { merge: true });
      currentAuthProfile = initialProfile;
      saveUserProfile(baseHandle);
      saveAuthUser(user);
    } else {
      saveUserProfile(baseHandle);
      saveAuthUser(user);
    }
  } catch (e) {
    console.warn('ensureUserProfile notice:', e);
  }
}

function updateHeaderAuthUI() {
  const container = $('header-auth-container');
  if (!container) return;
  const user = getAuthUser();
  if (user && user.signedIn) {
    const initials = (user.name || user.email || 'U').slice(0, 1).toUpperCase();
    const username = user.handle || user.name || 'Punter';
    container.innerHTML = '<div style="display:flex;align-items:center;gap:6px;">' +
      '<button type="button" class="header-user-btn" id="header-user-btn" title="Signed in as ' + esc(user.name || user.email) + '">' +
        '<span class="header-avatar">' + esc(initials) + '</span>' +
        '<span class="header-username">@' + esc(username) + '</span>' +
      '</button>' +
      '<button type="button" class="btn small" id="btn-quick-signout" title="Sign Out of account" style="min-height:32px;padding:2px 8px;font-size:11px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);color:#fca5a5;">Sign Out</button>' +
    '</div>';
  } else {
    container.innerHTML = '<button type="button" class="google-sub-btn" id="header-auth-btn" title="Sign In / Join">' +
      '<svg class="google-g" viewBox="0 0 24 24" width="13" height="13"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>' +
      '<span>Sign In / Join</span></button>';
  }
}

function switchAuthModalView(viewName) {
  const views = ['auth-signin-view', 'auth-authed-view'];
  views.forEach(id => {
    const el = $(id);
    if (el) el.hidden = (id !== viewName);
  });
  const errBox = $('signin-error');
  if (errBox) { errBox.hidden = true; errBox.textContent = ''; }
}

function openAuthModal() {
  const modal = $('google-auth-modal');
  if (!modal) return;
  const user = getAuthUser();
  if (user && user.signedIn) {
    switchAuthModalView('auth-authed-view');
    const initials = (user.name || user.email || 'U').slice(0, 1).toUpperCase();
    if ($('modal-avatar-initials')) $('modal-avatar-initials').textContent = initials;
    if ($('modal-auth-name')) $('modal-auth-name').textContent = user.name || 'Bet Buddy User';
    if ($('modal-auth-email')) $('modal-auth-email').textContent = user.email || '';
    const badge = $('modal-auth-badge');
    if (badge) { badge.textContent = 'Verified Google Account'; badge.className = 'badge-status-green'; }
  } else {
    switchAuthModalView('auth-signin-view');
  }
  modal.hidden = false;
}

function closeAuthModal() {
  const modal = $('google-auth-modal');
  if (modal) modal.hidden = true;
}

async function signInWithGoogle() {
  if (!firebaseAuth) {
    toast('Authentication is not available in this browser.');
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    if (isInStandaloneMode() || isIos()) {
      await firebaseAuth.signInWithRedirect(provider);
      return;
    }
    const cred = await firebaseAuth.signInWithPopup(provider);
    if (cred && cred.user) {
      saveAuthUser(cred.user);
    }
    closeAuthModal();
    toast('Signed in with Google! ⚽');
    updateHeaderAuthUI();
    render();
  } catch (err) {
    if (err.code === 'auth/popup-blocked') {
      try {
        await firebaseAuth.signInWithRedirect(provider);
        return;
      } catch (rErr) {
        showAuthError('signin-error', mapAuthError(rErr));
      }
    } else {
      showAuthError('signin-error', mapAuthError(err));
    }
  }
}

async function handleSignOut() {
  if (firebaseAuth) {
    try {
      await firebaseAuth.signOut();
    } catch (e) {}
  }
  currentAuthUser = null;
  currentAuthProfile = null;
  cachedAuthUser = null;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {}
  closeAuthModal();
  toast('Signed out.');
  updateHeaderAuthUI();
  render();
}

function initFirebaseAuth() {
  if (!firebaseAuth) return;

  try {
    if (firebase.auth && firebase.auth.Auth && firebase.auth.Auth.Persistence) {
      firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(e) {
        console.warn('Firebase setPersistence notice:', e);
      });
    }
  } catch (e) {}

  firebaseAuth.getRedirectResult().then(result => {
    if (result && result.user) {
      saveAuthUser(result.user);
      toast('Signed in with Google! ⚽');
    }
  }).catch(err => {
    console.warn('Redirect sign-in notice:', err);
    toast(mapAuthError(err));
  });

  firebaseAuth.onAuthStateChanged(async user => {
    currentAuthUser = user;
    if (user) {
      saveAuthUser(user);
      updateHeaderAuthUI();
      render();
      await ensureUserProfile(user);
      hasSyncedUserLeagues = false;
      await syncUserLeaguesFromCloud();
      try { await syncDiaryFromCloud(); } catch (e) {}

      // Preserve pending league invite across sign-in popup/redirect
      const pendingLeague = sessionStorage.getItem('betbuddy_pending_join_league');
      if (pendingLeague) {
        sessionStorage.removeItem('betbuddy_pending_join_league');
        setTimeout(() => { joinCloudLeague(pendingLeague); }, 600);
      }
    } else {
      currentAuthUser = null;
      currentAuthProfile = null;
      cachedAuthUser = null;
      try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (e) {}
    }
    updateHeaderAuthUI();
    render();
  });
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
    content.innerHTML = '<div class="notice" style="border-color:var(--pick);background:rgba(16,185,129,0.12);color:#fff"><span style="font-size:24px">⚡⚽</span><div><b>Bet Buddy is already installed!</b> You are using the standalone mobile app.</div></div>';
    modal.hidden = false;
    return;
  }

  if (deferredInstallPrompt) {
    // Android Chrome / Edge 1-Click action
    content.innerHTML = '<div class="install-guide-steps">' +
      '<div class="install-badge-preview" style="margin-bottom:16px"><img src="assets/icon-192.png?v=44"  width="56" height="56" style="border-radius:12px;box-shadow:0 0 16px rgba(16,185,129,0.4)" alt="Bet Buddy Radar Icon"><div><strong style="color:#fff;display:block;font-size:16px">Bet Buddy</strong><span class="text-sm muted">Sports Betting Intelligence App</span></div></div>' +
      '<button type="button" class="btn primary full-width" id="btn-trigger-native-install" style="font-size:15px;padding:14px 18px">📲 Download &amp; Add to Home Screen (1-Click)</button>' +
      '<p class="section-note" style="margin-top:10px;text-align:center">Instant install directly from your browser. 100% free.</p>' +
      '</div>';
    modal.hidden = false;
    return;
  }

  // iOS Safari or browser where prompt is manual
  content.innerHTML = '<div class="install-guide-steps">' +
    '<div class="install-badge-preview" style="margin-bottom:14px"><img src="assets/icon-192.png?v=44"  width="52" height="52" style="border-radius:12px" alt="Bet Buddy Radar Icon"><div><strong style="color:#fff;display:block;font-size:15px">Bet Buddy — Panda Mobile App</strong><span class="text-sm muted">Instant launch from your home screen</span></div></div>' +
    '<p class="auth-sub" style="margin-bottom:8px">To add to your phone / tablet home screen:</p>' +
    '<div class="install-step-item"><span class="install-step-num">1</span><div class="install-step-body"><strong>Tap Share</strong><span>Look for the square icon with an arrow pointing up at the bottom of your screen (or Chrome menu).</span></div></div>' +
    '<div class="install-step-item"><span class="install-step-num">2</span><div class="install-step-body"><strong>Select "Add to Home Screen"</strong><span>Scroll down and tap <b>Add to Home Screen</b>.</span></div></div>' +
    '<div class="install-step-item"><span class="install-step-num">3</span><div class="install-step-body"><strong>Tap "Add"</strong><span>Bet Buddy with the Sports Intelligence radar icon appears instantly on your home screen.</span></div></div>' +
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
    btn.innerHTML = '<span class="install-badge-icon" style="font-size:14px">⚡</span> <span class="install-label">Download App</span>';
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

  // Bet Butler single launch
  if (t.dataset.launchButlerSingle !== undefined || (t.closest && t.closest('[data-launch-butler-single]'))) {
    const btn = t.dataset.launchButlerSingle !== undefined ? t : t.closest('[data-launch-butler-single]');
    try {
      const data = JSON.parse(btn.dataset.launchButlerSingle);
      launchButlerSingle(data);
    } catch (e) { console.error(e); }
    return;
  }

  // Football acca addition
  if (t.dataset.addFootballAcca !== undefined || (t.closest && t.closest('[data-add-football-acca]'))) {
    const btn = t.dataset.addFootballAcca !== undefined ? t : t.closest('[data-add-football-acca]');
    try {
      const data = JSON.parse(btn.dataset.addFootballAcca);
      const f = fixtureById(data.id);
      const cleanOddsStr = String(data.fair || 'Evens').replace(/[≈~]/g, '').trim();
      const decOdds = (calc.parseOdds ? calc.parseOdds(cleanOddsStr) : null) ?? (calc.parseFractionalOdds ? calc.parseFractionalOdds(cleanOddsStr) : 2.0) ?? 2.0;
      addCrossSportAccaLeg({
        id: 'fb-' + data.id + '-' + (data.selection || '').replace(/[^a-zA-Z0-9]/g, '_'),
        matchId: data.id,
        fixture: f ? { home: f.home, away: f.away, competition: (f.competition || 'FOOTBALL').toUpperCase() } : { home: data.selection, away: '', competition: 'FOOTBALL' },
        kickoff: f ? kickoffMs(f) : (Date.now() + 86400000),
        selId: 'sel-' + data.id + '-' + data.selection,
        label: (f ? (f.home + ' v ' + f.away + ': ') : '') + data.selection,
        market: data.market || 'wins',
        p: data.p || 0.5,
        odds: decOdds,
        fractional: data.fair || 'Evens',
        bookmaker: 'Bet Buddy Fair',
        priceSource: 'model',
        support: 'validated',
        basis: 'Bet Buddy Football Model',
        sport: 'football'
      });
      scrollToBuilder();
    } catch (e) { console.error(e); }
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
    } else if (act === 'clear-clicks') {
      localStorage.setItem(AFFILIATE_TRACKING_KEY, '[]');
      localStorage.removeItem('betbuddy_affiliate_clicks_v1');
      const stats = getTrafficStats();
      if (Array.isArray(stats.dailyHistory)) {
        stats.dailyHistory.forEach(d => { d.clicks = 0; });
        try { localStorage.setItem(TRAFFIC_STORAGE_KEY, JSON.stringify(stats)); } catch (e) {}
      }
      toast('Affiliate outbound log cleared (0 outbounds).');
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
      fair: slip ? fmtOdds(slip.odds) : '',
      legs: slip ? slip.legs : [],
      stake: slip ? slip.stake : 10,
      odds: slip ? slip.odds : 1
    });
    return;
  }
  if (t.id === 'header-install-btn' || t.id === 'btn-trigger-native-install') { triggerDirectDownload(); return; }
  if (t.dataset.closeInstall !== undefined) { closeInstallModal(); return; }
  if (t.id === 'header-auth-btn' || t.id === 'header-user-btn' || t.dataset.openAuth !== undefined) { openAuthModal(); return; }
  if (t.dataset.closeAuth !== undefined) { closeAuthModal(); return; }
  if (t.id === 'btn-auth-google') { signInWithGoogle(); return; }

  if (t.id === 'btn-switch-handle') { closeAuthModal(); const _p = getUserProfile();
    $('player-handle-input').value = _p.handle;
    if ($('player-town-input')) $('player-town-input').value = _p.town || 'Paisley';
    if ($('player-region-input')) $('player-region-input').value = _p.region || 'Renfrewshire';
    if ($('player-country-input')) $('player-country-input').value = _p.country || 'Scotland';
    $('handle-modal').hidden = false; return; }
  if (t.id === 'btn-quick-signout' || t.id === 'btn-signout' || t.id === 'btn-google-signout') {
    handleSignOut();
    return;
  }
  if (t.id === 'btn-auth-open-gdpr') { $('gdpr-modal').hidden = false; return; }
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
  else if (t.dataset.openLeagueModal !== undefined) {
    const u = getAuthUser();
    if (!u || !u.signedIn) {
      toast('Sign in with Google to join leagues and compete with mates');
      openAuthModal();
    } else {
      $('league-modal').hidden = false;
    }
  }
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
    kickPlayerFromLeague(t.dataset.leagueCode, t.dataset.kickUid, t.dataset.kickPlayer);
  }
  else if (t.dataset.deleteLeague !== undefined) {
    deleteLeague(t.dataset.deleteLeague, t.dataset.leagueCode);
  }
  else if (t.dataset.leaveLeague !== undefined) {
    leaveLeague(t.dataset.leaveLeague, t.dataset.leagueCode);
  }
  else if (t.dataset.shareLeague !== undefined) {
    const code = t.dataset.shareLeague;
    const shareUrl = 'https://betbuddyuk.uk/#join-league=' + encodeURIComponent(code);
    const text = '🏆 Join my Bet Buddy League (Code: ' + code + ')';
    openUniversalShare({
      title: 'Join my Bet Buddy League (' + code + ')',
      text: text,
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
  else if (t.closest('[data-launch-bookie]')) {
    const btn = t.closest('[data-launch-bookie]');
    launchBookmakerSlip(btn.dataset.launchBookie, btn.dataset.slipIdx);
  }
  else if (t.closest('[data-timing]')) {
    const timingBtn = t.closest('[data-timing]');
    setBuilderTiming(timingBtn.dataset.timing);
  }
  else if (t.dataset.legs) setBuilderLegs(+t.dataset.legs);
  else if (t.dataset.toggleLeague) toggleLeagueBet(t.dataset.toggleLeague);
  else if (t.dataset.diary !== undefined) openDiary(JSON.parse(t.dataset.diary || '{}'));
  else if (t.dataset.close !== undefined) closeDiary();
  else if (t.dataset.comp) { compFilter = t.dataset.comp; try { localStorage.setItem(COMP_KEY, compFilter); } catch (e) { /* ignore */ } render(); }
  else if (t.dataset.tab) { fixturesTab = t.dataset.tab; fixturesShowAll = false; render(); }
  else if (t.dataset.showall !== undefined) { fixturesShowAll = true; render(); }
  else if (t.dataset.sportRfilter) { resultsSportFilter = t.dataset.sportRfilter; render(); }
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
  else if (t.id === 'modal-fixture-select') updateDiaryDestinationOptions();
  else if (t.name === 'modal-destination') updateDiarySubmitBtn();
});
document.addEventListener('submit', event => {
  if (event.target.id === 'diary-form') handleDiaryFormSubmit(event);

  
  if (event.target.id === 'create-league-form') {
    event.preventDefault();
    const user = getAuthUser();
    if (!user || !user.signedIn) {
      toast('Sign in with Google to create a private league.');
      openAuthModal();
      return;
    }
    const name = ($('new-league-name').value || '').trim() || 'My Friends League';
    const icon = ($('new-league-icon') && $('new-league-icon').value) || '⚽';
    const freq = ($('new-league-freq') && $('new-league-freq').value) || 'weekly';
    const code = generateSecureLeagueCode();
    const prof = getUserProfile();
    const newLeague = {
      id: 'league-' + Date.now(),
      name,
      icon,
      freq,
      code,
      creatorUid: user.uid,
      creatorHandle: prof.handle,
      created_at: new Date().toISOString().slice(0, 10),
      is_joined: false,
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
    return;
  }
  if (event.target.id === 'join-league-form') {
    event.preventDefault();
    const code = ($('join-league-code').value || '').trim().toUpperCase();
    if (!code) return;
    $('league-modal').hidden = true;
    toast('Joining league ' + code + '...');
    joinCloudLeague(code);
    return;
  }
  if (event.target.id === 'commercial-enquiry-form') {
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
  if (event.target.id === 'handle-form') {
    event.preventDefault();
    const handle = ($('player-handle-input').value || '').trim();
    const town = $('player-town-input') ? $('player-town-input').value.trim() : 'Paisley';
    const region = $('player-region-input') ? $('player-region-input').value.trim() : 'Renfrewshire';
    const country = $('player-country-input') ? $('player-country-input').value.trim() : 'Scotland';

    if (!isValidHandle(handle)) {
      toast('Gamertag must be 3–20 characters (letters, numbers, underscores only).');
      return;
    }

    const user = getAuthUser();
    if (user && user.signedIn && firestoreDb) {
      toast('Updating gamertag...');
      claimHandleTransaction(user.uid, handle, getUserProfile().avatar || '⚽').then(() => {
        saveUserProfile(handle, town, region, country);
        $('handle-modal').hidden = true;
        toast('Gamertag and location updated! ⚽');
        getStoredLeagues().forEach(l => syncLeagueToCloud(l));
        render();
      }).catch(err => {
        toast(err.message || 'Error updating gamertag.');
      });
      return;
    }

    saveUserProfile(handle, town, region, country);
    $('handle-modal').hidden = true;
    toast('Profile and Regional Leagues updated!');
    getStoredLeagues().forEach(l => syncLeagueToCloud(l));
    render();
    return;
  }
  else if (event.target.id === 'fb-form') handleFeedbackSubmit(event);
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('diary-modal').hidden) closeDiary(); });
window.addEventListener('hashchange', () => { render(); if (window.location.hash.startsWith('#/results')) checkAutoUpdateResults(); });

// ------------------------------------------------------------ Live Results Auto-Update Tracking
let lastResultsAutoSync = 0;
let isResultsSyncing = false;

async function checkAutoUpdateResults(force = false) {
  const now = Date.now();
  if (isResultsSyncing) return;
  if (!force && now - lastResultsAutoSync < 30000) return; // at most once every 30s unless forced
  isResultsSyncing = true;
  lastResultsAutoSync = now;
  try {
    const [histRes, perfRes, fixRes, multiRes] = await Promise.all([
      fetch('data/prediction_history.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('data/performance.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('data/fixtures.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('data/multi_sport_events.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
    ]);
    if (histRes) DATA.history = histRes;
    if (perfRes) DATA.performance = perfRes;
    if (fixRes) DATA.fixtures = fixRes;
    if (multiRes) DATA.multiSport = multiRes;
    if (window.location.hash.startsWith('#/results')) {
      render();
    }
  } catch (e) {
    // quiet background update
  } finally {
    isResultsSyncing = false;
  }
}
if (typeof window !== 'undefined') {
  window.checkAutoUpdateResults = checkAutoUpdateResults;
}


$('bookmaker-quick').innerHTML = ['Bet365', 'Sky Bet', 'Paddy Power', 'Ladbrokes', 'Coral', 'William Hill', 'Betfair', 'Unibet'].map(b => '<button type="button">' + b + '</button>').join('');
updateDiaryCount();
try { updateButlerUI(); } catch (e) {}
loadData().then(() => {
  render();
});
initFirebaseAuth();

const APP_VERSION = 'v75';

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


// ------------------------------------------------------------ Return Bridge & Bookmaker Tracking
let pendingBookieLaunch = null;
try {
  const stored = sessionStorage.getItem('betbuddy_pending_bookie');
  if (stored) pendingBookieLaunch = JSON.parse(stored);
} catch (e) {}

function trackBookieLaunch(bookieName, betData) {
  pendingBookieLaunch = {
    bookie: bookieName,
    data: betData,
    time: Date.now(),
    shown: false
  };
  try {
    sessionStorage.setItem('betbuddy_pending_bookie', JSON.stringify(pendingBookieLaunch));
  } catch (e) {}
}

function enrichSingleBetData(betData) {
  const enriched = Object.assign({}, betData);
  if (enriched.id) {
    const f = fixtureById(enriched.id);
    if (f && (!enriched.fixture || !enriched.fixture.home)) {
      enriched.fixture = { home: f.home, away: f.away };
    }
  }
  if (!enriched.odds && enriched.fair) {
    const clean = String(enriched.fair).replace(/[≈~]/g, '').trim();
    const dec = (calc.parseOdds ? calc.parseOdds(clean) : null) ?? (calc.parseFractionalOdds ? calc.parseFractionalOdds(clean) : null);
    if (dec && Number.isFinite(dec) && dec > 1) enriched.odds = dec;
  }
  if (!enriched.marketName && enriched.market) {
    enriched.marketName = (Object.values(MARKETS).find(m => m.diary === enriched.market) || {}).name || enriched.market;
  }
  return enriched;
}

function showReturnModal(launch) {
  const modal = $('return-bookie-modal');
  if (!modal) return;
  const nameEl = $('return-bookie-name');
  const confirmNameEl = $('return-bookie-confirm-name');
  const labelEl = $('return-bet-label');
  const oddsEl = $('return-bet-odds');
  const stakeInput = $('return-stake-input');
  const oddsInput = $('return-odds-input');

  if (nameEl) nameEl.textContent = launch.bookie;
  if (confirmNameEl) confirmNameEl.textContent = launch.bookie;

  const isAcca = !!(launch.data && launch.data.legs);
  if (labelEl) {
    if (isAcca) {
      labelEl.textContent = launch.data.legs.length + '-Leg Accumulator (' + launch.data.legs.map(l => l.label).join(' + ') + ')';
    } else {
      labelEl.textContent = (launch.data && launch.data.selection) || 'Bet Selection';
    }
  }

  const defaultStake = (launch.data && launch.data.stake) || (builderState && builderState.stake) || 10;
  if (stakeInput) stakeInput.value = defaultStake;

  let displayOdds = '';
  if (isAcca) {
    displayOdds = launch.data.odds ? (oddsFormat === 'decimal' ? calc.formatDecimalOdds(launch.data.odds) : calc.formatFractionalOdds(launch.data.odds)) : 'Evens';
  } else {
    displayOdds = launch.data.fractional || launch.data.fair || (launch.data.odds ? (oddsFormat === 'decimal' ? calc.formatDecimalOdds(launch.data.odds) : calc.formatFractionalOdds(launch.data.odds)) : 'Evens');
  }
  if (oddsEl) oddsEl.textContent = displayOdds;
  if (oddsInput) oddsInput.value = displayOdds;

  modal.hidden = false;
}

function dismissReturnModal() {
  const modal = $('return-bookie-modal');
  if (modal) modal.hidden = true;
  pendingBookieLaunch = null;
  try { sessionStorage.removeItem('betbuddy_pending_bookie'); } catch (e) {}
}

function confirmRealBetPlaced() {
  if (!pendingBookieLaunch) return;
  const launch = pendingBookieLaunch;
  dismissReturnModal();

  const isAcca = !!(launch.data && launch.data.legs);
  const stakeInput = $('return-stake-input');
  const oddsInput = $('return-odds-input');

  const stake = Number(stakeInput ? stakeInput.value : ((builderState && builderState.stake) || 10)) || 10;

  let odds = 2.0;
  if (isAcca) {
    odds = launch.data.legs.reduce((t, l) => t * (l.odds || 2.0), 1);
  } else if (launch.data && launch.data.odds) {
    odds = Number(launch.data.odds);
  }

  if (oddsInput && oddsInput.value.trim()) {
    const rawOdds = oddsInput.value.trim().replace(/[≈~]/g, '');
    const userOdds = (calc.parseOdds ? calc.parseOdds(rawOdds) : null) ?? (calc.parseFractionalOdds ? calc.parseFractionalOdds(rawOdds) : null);
    if (userOdds && Number.isFinite(userOdds) && userOdds > 1) {
      odds = userOdds;
    }
  }

  const fixtureName = isAcca ? 'Accumulator' : (launch.data && launch.data.fixture && launch.data.fixture.home ? (launch.data.fixture.home + (launch.data.fixture.away ? (' v ' + launch.data.fixture.away) : '')) : 'Football Match');
  const marketType = isAcca ? 'accumulator' : ((launch.data && launch.data.market) || 'wins');
  const marketName = isAcca ? 'Accumulator' : ((launch.data && launch.data.marketName) || (Object.values(MARKETS).find(m => m.diary === marketType) || {}).name || 'Match Bet');

  const entry = {
    id: 'bet-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    type: isAcca ? 'accumulator' : 'single',
    profile: (getAuthUser() && getAuthUser().signedIn) ? ('@' + (getAuthUser().handle || (getAuthUser().name || 'User').split(' ')[0])) : 'Default',
    date: new Date().toISOString().slice(0, 10),
    fixture: fixtureName,
    market: marketType,
    marketName: marketName,
    selection: isAcca ? launch.data.legs.map(l => l.label).join(' + ') : ((launch.data && launch.data.selection) || 'Selection'),
    legs: isAcca ? launch.data.legs.map(l => ({ selection: l.label, odds: l.odds || 2.0, outcome: 'pending' })) : undefined,
    origin: 'matchiq',
    bookmaker: launch.bookie,
    odds,
    stake,
    potentialReturn: stake * odds,
    outcome: 'pending',
    timestamp: new Date().toISOString(),
    source: 'self-reported',
    notes: 'Self-reported bet placed at ' + (launch.bookie || getButlerBookmaker().name) + '.'
  };

  try {
    const diary = getStoredDiary();
    diary.unshift(entry);
    saveStoredDiary(diary);
  } catch (e) { console.error(e);
  }

  celebrateSave();
  toast('Bet saved to your Bet Diary (self-reported)!');
  if (currentRoute()[0] === 'diary') render();
}

let returnCheckDebounce = false;
function checkReturnFromBookie() {
  if (returnCheckDebounce) return;
  returnCheckDebounce = true;
  setTimeout(() => { returnCheckDebounce = false; }, 2000);

  if (!pendingBookieLaunch) {
    try {
      const stored = sessionStorage.getItem('betbuddy_pending_bookie');
      if (stored) pendingBookieLaunch = JSON.parse(stored);
    } catch (e) {}
  }
  // Only trigger if launch exists, was not already shown, and user was away for at least 4 seconds (up to 1 hour)
  if (pendingBookieLaunch && !pendingBookieLaunch.shown) {
    const elapsed = Date.now() - pendingBookieLaunch.time;
    if (elapsed >= 4000 && elapsed < 3600000) {
      pendingBookieLaunch.shown = true;
      try {
        sessionStorage.setItem('betbuddy_pending_bookie', JSON.stringify(pendingBookieLaunch));
      } catch (e) {}
      setTimeout(() => {
        showReturnModal(pendingBookieLaunch);
      }, 500);
    }
  }
}
window.addEventListener('focus', checkReturnFromBookie);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkReturnFromBookie();
});
if (typeof window !== 'undefined') {
  window.dismissReturnModal = dismissReturnModal;
  window.confirmRealBetPlaced = confirmRealBetPlaced;
}

// ============================================================ 
// THE BET BUTLER: Personal Assistant for Existing Bookmaker Account
// ============================================================ 
const BUTLER_STORAGE_KEY = 'betbuddy_butler_bookie_v1';
const BOOKMAKERS_CONFIG = {
  skybet: { key: 'skybet', name: 'Sky Bet', tag: 'SKY BET', color: '#38bdf8', url: 'https://m.skybet.com/football' },
  bet365: { key: 'bet365', name: 'bet365', tag: 'BET365', color: '#10b981', url: 'https://www.bet365.com/#/AC/B1/' },
  williamhill: { key: 'williamhill', name: 'William Hill', tag: 'WILLIAM HILL', color: '#0284c7', url: 'https://sports.williamhill.com/betting/en-gb/football' },
  paddypower: { key: 'paddypower', name: 'Paddy Power', tag: 'PADDY POWER', color: '#059669', url: 'https://www.paddypower.com/football' },
  betfair: { key: 'betfair', name: 'Betfair', tag: 'BETFAIR', color: '#f59e0b', url: 'https://www.betfair.com/sport/football' },
  coral: { key: 'coral', name: 'Coral', tag: 'CORAL', color: '#2563eb', url: 'https://sports.coral.co.uk/sport/football' },
  ladbrokes: { key: 'ladbrokes', name: 'Ladbrokes', tag: 'LADBROKES', color: '#dc2626', url: 'https://sports.ladbrokes.com/sport/football' }
};

function getButlerBookmaker() {
  try {
    const saved = localStorage.getItem(BUTLER_STORAGE_KEY);
    if (saved && BOOKMAKERS_CONFIG[saved]) return BOOKMAKERS_CONFIG[saved];
  } catch (e) {}
  return BOOKMAKERS_CONFIG.skybet;
}

function setButlerBookmaker(key) {
  if (!BOOKMAKERS_CONFIG[key]) return;
  try {
    localStorage.setItem(BUTLER_STORAGE_KEY, key);
  } catch (e) {}
  updateButlerUI();
  closeButlerModal();
  toast('Slip note set to ' + BOOKMAKERS_CONFIG[key].name);
  render();
}

function updateButlerUI() {
  const current = getButlerBookmaker();
  const nameEls = document.querySelectorAll('#header-butler-name, .current-butler-name');
  nameEls.forEach(el => { el.textContent = current.name; });
  document.querySelectorAll('.butler-choice-card').forEach(card => {
    if (card.dataset.selectButler === current.key) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
}

function openButlerModal() {
  const modal = $('butler-modal');
  if (modal) {
    updateButlerUI();
    modal.hidden = false;
  }
}

function closeButlerModal() {
  const modal = $('butler-modal');
  if (modal) modal.hidden = true;
}

function getButlerLaunchUrl(slipIdx) {
  const butler = getButlerBookmaker();
  const legs = slipIdx === 'custom' ? customAccaLegs : (builderResult && builderResult.slips && builderResult.slips[+slipIdx] ? builderResult.slips[+slipIdx].legs : []);
  return buildBookmakerLaunchUrl(butler.key, { legs });
}

function getButlerLaunchSingleUrl(betData) {
  const butler = getButlerBookmaker();
  return buildBookmakerLaunchUrl(butler.key, betData);
}

function prepareButlerLaunch(slipIdx) {
  const r = builderResult;
  let slip = null;
  if (slipIdx === 'custom') {
    if (customAccaLegs.length === 0) return;
    const stake = (builderState && builderState.stake) || 10;
    const odds = customAccaLegs.reduce((t, l) => t * (l.odds || 2.0), 1);
    slip = { legs: customAccaLegs, stake, odds, ret: stake * odds };
  } else {
    slip = r && r.slips && r.slips[+slipIdx];
  }
  if (!slip) return;
  const butler = getButlerBookmaker();
  trackBookieLaunch(butler.name, slip);

  const textLines = [
    '🎯 Bet Buddy ' + slip.legs.length + '-Leg Acca (' + fmtOdds(slip.odds) + ')',
    ...slip.legs.map((l, i) => (i + 1) + '. ' + l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label + ' (' + (l.fractional || fmtOdds(l.odds)) + ')'),
    'Stake: £' + slip.stake + ' · Target Return: £' + (slip.ret ? slip.ret.toFixed(2) : (slip.stake * slip.odds).toFixed(2))
  ];
  const copyStr = textLines.join('\n');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(copyStr).catch(() => {});
    }
  } catch (e) {}
  toast('⚡ Slip copied! Launching ' + butler.name + ' app...');
}

function prepareButlerSingleLaunch(dataStr) {
  try {
    const raw = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
    const betData = enrichSingleBetData(raw);
    const butler = getButlerBookmaker();
    let copyStr = betData.selection || 'Football Bet';
    if (betData.fair) copyStr += ' @ ' + betData.fair;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(copyStr).catch(() => {});
      }
    } catch (e) {}
    trackBookieLaunch(butler.name, betData);
    toast('⚡ Copied to clipboard! Launching ' + butler.name + ' app...');
  } catch (e) {}
}

function launchButlerAcca(slipIdx) {
  const butler = getButlerBookmaker();
  launchBookmakerSlip(butler.key, slipIdx);
}

function launchButlerSingle(data) {
  const betData = enrichSingleBetData(data);
  const butler = getButlerBookmaker();
  let copyStr = betData.selection || 'Football Bet';
  if (betData.fair) copyStr += ' @ ' + betData.fair;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(copyStr).catch(() => {});
    }
  } catch (e) {}

  trackBookieLaunch(butler.name, betData);
  toast('⚡ Copied to clipboard! Launching ' + butler.name + ' app...');

  window.location.href = buildBookmakerLaunchUrl(butler.key, betData);
}

if (typeof window !== 'undefined') {
  window.getButlerBookmaker = getButlerBookmaker;
  window.setButlerBookmaker = setButlerBookmaker;
  window.openButlerModal = openButlerModal;
  window.closeButlerModal = closeButlerModal;
  window.getButlerLaunchUrl = getButlerLaunchUrl;
  window.getButlerLaunchSingleUrl = getButlerLaunchSingleUrl;
  window.prepareButlerLaunch = prepareButlerLaunch;
  window.prepareButlerSingleLaunch = prepareButlerSingleLaunch;
  window.launchButlerAcca = launchButlerAcca;
  window.launchButlerSingle = launchButlerSingle;
}


// ============================================================ 
// SLIP CARD ENGINE: Honest Slip Note & Leg Checklist
// ============================================================ 
let activeSlipCardData = null;

function getSlipCardTicks(slipKey) {
  try {
    const raw = sessionStorage.getItem('betbuddy_slip_ticks_' + slipKey);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function saveSlipCardTicks(slipKey, ticks) {
  try {
    sessionStorage.setItem('betbuddy_slip_ticks_' + slipKey, JSON.stringify(ticks));
  } catch (e) {}
}

function toggleLegTick(slipKey, legIdx, isChecked) {
  const ticks = getSlipCardTicks(slipKey);
  ticks[legIdx] = !!isChecked;
  saveSlipCardTicks(slipKey, ticks);
  const item = document.getElementById('slip-card-leg-' + legIdx);
  if (item) {
    if (isChecked) item.classList.add('ticked');
    else item.classList.remove('ticked');
  }
}

function openSlipCard(slipIdx) {
  let slip = null;
  let slipKey = 'slip_' + slipIdx;
  if (slipIdx === 'custom') {
    if (customAccaLegs.length === 0) return;
    const stake = Number((builderState && builderState.stake) || 10) || 10;
    const odds = customAccaLegs.reduce((t, l) => t * (Number(l.odds) || 2.0), 1);
    slip = { legs: customAccaLegs, stake, odds, ret: stake * odds };
    slipKey = 'slip_custom';
  } else {
    slip = builderResult && builderResult.slips && builderResult.slips[+slipIdx];
  }
  if (!slip || !slip.legs) return;

  const stake = Number(slip.stake || (builderState && builderState.stake) || 10) || 10;
  const odds = Number(slip.odds) || slip.legs.reduce((t, l) => t * (Number(l.odds) || 2.0), 1);
  const ret = Number.isFinite(Number(slip.ret)) ? Number(slip.ret) : (stake * odds);

  activeSlipCardData = { ...slip, stake, odds, ret, slipKey };
  renderSlipCardModal(activeSlipCardData);
}

function openSlipCardSingle(dataStr) {
  try {
    const raw = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
    const betData = enrichSingleBetData(raw);
    const stake = Number((builderState && builderState.stake) || 10) || 10;
    const odds = Number(betData.odds) || 2.0;
    const leg = {
      label: betData.selection || 'Football Bet',
      fixture: betData.fixture || {},
      odds: odds,
      fractional: betData.fair,
      bookmaker: 'Market price'
    };
    activeSlipCardData = {
      legs: [leg],
      stake: stake,
      odds: odds,
      ret: stake * odds,
      slipKey: 'single_' + (betData.id || Date.now()),
      isSingle: true
    };
    renderSlipCardModal(activeSlipCardData);
  } catch (e) {
    console.error('Error opening single slip card:', e);
  }
}

function renderSlipCardModal(slip) {
  const modal = $('slip-card-modal');
  if (!modal) return;

  const bookie = getButlerBookmaker();
  if ($('slip-card-bookie-name')) $('slip-card-bookie-name').textContent = bookie.name;
  if ($('btn-open-bookie-tab')) $('btn-open-bookie-tab').textContent = 'Open ' + bookie.name + ' Football ↗';

  const titleEl = $('slip-card-title');
  if (titleEl) {
    titleEl.textContent = slip.isSingle ? 'Match Slip Note' : 'Acca Slip Note (' + slip.legs.length + ' Legs)';
  }

  const ticks = getSlipCardTicks(slip.slipKey);
  const listEl = $('slip-card-legs-list');
  if (listEl) {
    listEl.innerHTML = slip.legs.map((l, i) => {
      const isTicked = !!ticks[i];
      const fixHome = (l.fixture && l.fixture.home) || '';
      const fixAway = (l.fixture && l.fixture.away) || '';
      const matchText = (fixHome && fixAway && fixHome !== fixAway) ? (fixHome + ' v ' + fixAway) : (fixHome || 'Match');
      const oddsLabel = oddsFormat === 'decimal' ? calc.formatDecimalOdds(l.odds) : (l.fractional || fmtOdds(l.odds));

      return '<div class="slip-card-leg-item' + (isTicked ? ' ticked' : '') + '" id="slip-card-leg-' + i + '">' +
        '<div class="slip-card-leg-left">' +
          '<label class="slip-leg-checkbox-wrap" title="Tick when added to bookmaker">' +
            '<input type="checkbox" class="slip-leg-checkbox" ' + (isTicked ? 'checked' : '') + ' onchange="toggleLegTick(\'' + slip.slipKey + '\', ' + i + ', this.checked)" aria-label="Mark leg ' + (i + 1) + ' as added">' +
          '</label>' +
          '<div class="slip-card-leg-info">' +
            '<span class="slip-card-leg-num">Leg ' + (i + 1) + '</span>' +
            '<span class="slip-card-leg-match">' + esc(matchText) + '</span>' +
            '<span class="slip-card-leg-sel">' + esc(l.label || l.selection) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="slip-card-leg-right">' +
          '<span class="slip-card-leg-odds">' + esc(oddsLabel) + '</span>' +
          '<label class="slip-card-tick-label" onclick="const cb = document.querySelector(\'#slip-card-leg-' + i + ' input\'); if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event(\'change\')); }">Added to slip</label>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  const sumEl = $('slip-card-summary');
  if (sumEl) {
    const stakeVal = Number(slip.stake || (builderState && builderState.stake) || 10) || 10;
    const oddsVal = Number(slip.odds) || 1;
    const retVal = Number.isFinite(Number(slip.ret)) ? Number(slip.ret).toFixed(2) : (stakeVal * oddsVal).toFixed(2);
    sumEl.innerHTML = '<span>Stake: <b class="mono">£' + stakeVal.toFixed(2) + '</b></span>' +
      '<span>Total Odds: <b class="mono">' + fmtOdds(oddsVal) + ' (estimate)</b></span>' +
      '<span>Return: <b class="mono">£' + retVal + ' (estimate)</b></span>';
  }

  // Feature detect Document Picture-in-Picture
  const pipBtn = $('btn-slip-pip');
  if (pipBtn) {
    if ('documentPictureInPicture' in window) {
      pipBtn.style.display = 'inline-flex';
      pipBtn.onclick = async () => {
        try {
          const pipWin = await window.documentPictureInPicture.requestWindow({ width: 360, height: 520 });
          document.querySelectorAll('link[rel="stylesheet"], style').forEach(s => pipWin.document.head.appendChild(s.cloneNode(true)));
          const clone = modal.querySelector('.slip-card-dialog').cloneNode(true);
          pipWin.document.body.appendChild(clone);
          pipWin.document.body.style.background = '#050b14';
          pipWin.document.body.style.color = '#fff';
          pipWin.document.body.style.padding = '10px';
        } catch (err) { console.log('PiP not available:', err); }
      };
    } else {
      pipBtn.style.display = 'none';
    }
  }

  modal.hidden = false;
}

function closeSlipCardModal() {
  const modal = $('slip-card-modal');
  if (modal) modal.hidden = true;
}

function openBookmakerFootball() {
  const bookie = getButlerBookmaker();
  const url = buildBookmakerLaunchUrl(bookie.key);
  if (activeSlipCardData) {
    trackBookieLaunch(bookie.name, activeSlipCardData);
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function copySlipCardText() {
  if (!activeSlipCardData) return;
  const slip = activeSlipCardData;
  const textLines = [
    '🎯 Bet Buddy ' + slip.legs.length + '-Leg Acca (' + fmtOdds(slip.odds) + ')',
    ...slip.legs.map((l, i) => (i + 1) + '. ' + (l.fixture ? (l.fixture.home + ' v ' + l.fixture.away + ': ') : '') + l.label + ' (' + (l.fractional || fmtOdds(l.odds)) + ')'),
    'Stake: £' + slip.stake + ' · Target Return: £' + (slip.ret ? slip.ret.toFixed(2) : (slip.stake * slip.odds).toFixed(2)) + ' (estimate)'
  ];
  const copyStr = textLines.join('\n');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(copyStr).then(() => {
        toast('📋 Slip note copied to clipboard!');
      }).catch(() => {
        toast('⚠️ Unable to copy automatically. Please copy text manually.');
      });
      return;
    }
  } catch (e) {}
  toast('⚠️ Clipboard not supported on this browser.');
}
