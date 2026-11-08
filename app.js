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
const leagueDocs = window.BetBuddyLeagues;
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
  predictions: 'data/predictions.json?v=78',
  fixtures: 'data/fixtures.json?v=78',
  history: 'data/prediction_history.json?v=78',
  performance: 'data/performance.json?v=78',
  leagueValidation: 'data/league_validation.json?v=78',
  status: 'data/pipeline_status.json?v=78',
  reliability: 'data/model_reliability.json?v=78',
  odds: 'data/odds.json?v=78',
  multiSport: 'data/multi_sport_events.json?v=78'
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
function compBar(counts) {
  let items = [['ALL', 'All competitions']].concat(Object.entries(LEAGUES));
  if (counts) {
    const total = Object.values(counts).reduce((t, n) => t + n, 0);
    items = [['ALL', 'All (' + total + ')']].concat(Object.entries(LEAGUES).filter(([k]) => counts[k] || compFilter === k).map(([k, l]) => [k, l + ' (' + (counts[k] || 0) + ')']));
  }
  return '<div class="comp-bar' + (counts ? ' scroll' : '') + '" role="group" aria-label="Competition">' + items.map(([k, l]) => '<button type="button" data-comp="' + k + '" aria-pressed="' + (compFilter === k) + '">' + esc(l) + '</button>').join('') + '</div>';
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
  const cap = $('odds-caption');
  if (cap) cap.textContent = oddsFormat === 'decimal' ? 'Decimal' : 'Fractional';
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
const kickoffIso = f => { const ms = kickoffMs(f); return Number.isFinite(ms) ? new Date(ms).toISOString() : null; };
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
const REC_LABEL = { most_likely: 'Most Likely pick', best_value: 'Price check pick' };

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
      ownBetAddBtn(diary) +
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
    detail += '<p class="muted" style="font-size:13.5px"><b>' + (v === 'value' ? 'Best value found: ' : 'Closest to value: ') + esc(best.sel.label) + '</b> at ' + esc(best.v.priceText) + ' (' + (best.v.ev >= 0 ? '+' : '') + Math.round(100 * best.v.ev) + '% estimated expected value). Checked ' + pricedCount + ' priced selection' + (pricedCount === 1 ? '' : 's') + ' across every market.</p>';
  } else {
    detail += '<p class="muted" style="font-size:13.5px">No bookmaker price is loaded for this match (the automatic feed covers Match Result and Total Goals only, when it is enabled). Type a fractional price you have seen on any selection below and Bet Buddy will check every priced selection for value.</p>';
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
  return '<div class="rec-card ' + head[0] + '"><div class="rec-kicker">Best value</div><div class="rec-pick">' + esc(head[1]) + '</div>' + detail +
    '<label class="field"><span class="lbl">Selection to test (any market or line)</span><select class="ctl" data-value-select="' + esc(pred.match_id) + '">' + opts + '</select></label>' +
    priceInput(sel, true) +
    (siblings.length ? '<details class="compare"' + (siblings.some(s => prices[s.id]) ? ' open' : '') + '><summary>Other outcomes’ prices (removes the margin)</summary><div class="grid" style="margin-top:8px">' + siblings.map(s => priceInput(s, false)).join('') + '</div></details>' : '') +
    '</div>';
}

/* The six strongest selections across every market and line, with a price box on each. */
const SUPPORT = { validated: ['validated', 'Validated model'], provisional: ['provisional', 'Provisional estimate'], unsupported: ['unsupported', 'Unsupported estimate'] };


function refreshValue(matchId) {
  const pred = DATA.predictions && DATA.predictions.predictions[matchId];
  if (!pred) return;
  const active = document.activeElement, focused = active && active.dataset ? active.dataset.price : null;
  const boxes = { ['value-' + matchId]: bestValueBlock };
  for (const [boxId, build] of Object.entries(boxes)) {
    const box = $(boxId);
    if (!box) continue;
    const holdsFocus = focused && box.contains(active);
    box.innerHTML = build(pred);
    if (holdsFocus) { const input = box.querySelector('[data-price="' + CSS.escape(focused) + '"]'); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } }
  }
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
    '<span class="fx-time">' + esc(fmtTime(ms)) + '<small>' + esc(fmtDay(ms)) + '</small></span>' +
    '<span class="fx-teams"><span class="teams-line">' + crest(f.home, 22) + '<span>' + esc(f.home) + '</span></span><span class="teams-line">' + crest(f.away, 22) + '<span>' + esc(f.away) + '</span></span></span>' +
    '<span class="fx-lean">' + lean + '</span><span class="fx-chev" aria-hidden="true">›</span></a>';
}

function fixtureCouponRow(f) {
  const pred = DATA.predictions && DATA.predictions.predictions[f.id];
  const all = ownBetMarketsFor(f), byKey = k => all.find(o => o.key === k);
  let lean = '<span class="dim">Prediction due nearer kick-off</span>';
  if (pred) {
    const r = pred.markets.result, provisional = r.evidence.status !== 'validated';
    lean = 'Leans <b>' + esc(String(r.pick.label).replace(/ win$/, '')) + '</b> ' + pct(r.pick.p) + (provisional ? ' · provisional' : '');
  }
  return '<div class="cp-row fx-cp">' +
    '<a class="cp-match" href="#/match/' + encodeURIComponent(f.id) + '">' +
      '<span class="cp-time mono">' + esc(fmtTime(kickoffMs(f))) + '</span>' +
      '<span class="cp-teams"><b>' + esc(f.home) + '</b><b>' + esc(f.away) + '</b></span></a>' +
    '<div class="cp-1x2">' + ownBetPriceBtn(f, byKey('result:H')) + ownBetPriceBtn(f, byKey('result:D')) + ownBetPriceBtn(f, byKey('result:A')) + '</div>' +
    '<a class="fx-lean-line" href="#/match/' + encodeURIComponent(f.id) + '">' + lean + ' <span class="fx-go">Analysis ›</span></a></div>';
}

function groupedRows(fixtures, coupon) {
  const days = [];
  for (const f of fixtures) {
    const key = dayKey(kickoffMs(f));
    let d = days.find(x => x.key === key);
    if (!d) days.push(d = { key, ms: kickoffMs(f), list: [] });
    d.list.push(f);
  }
  const order = Object.keys(LEAGUES);
  const rank = c => { const i = order.indexOf(c || 'PL'); return i < 0 ? 99 : i; };
  return days.map(d => {
    const comps = [...new Set(d.list.map(f => f.competition || 'PL'))].sort((a, b) => rank(a) - rank(b));
    return '<h3 class="day-label">' + esc(london(d.ms, { weekday: 'long', day: 'numeric', month: 'long' })) + '</h3>' +
      comps.map(c => {
        const rows = d.list.filter(f => (f.competition || 'PL') === c);
        return coupon
          ? '<div class="cp-group"><div class="cp-ghead"><span>' + esc(leagueName(c)) + '</span><span class="cp-cols"><span>Home</span><span>Draw</span><span>Away</span></span></div>' + rows.map(fixtureCouponRow).join('') + '</div>'
          : '<div class="fx-group"><div class="fx-ghead">' + esc(leagueName(c)) + '</div>' + rows.map(fixtureRow).join('') + '</div>';
      }).join('');
  }).join('');
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
      ownBetAddBtn(betPayload) +
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
const builderState = { stake: 10, legs: 2, win: 25, timing: 'today' };
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
          // Fair chance from the event's own prices: when the selections cover the whole market
          // (head-to-head or 1X2), strip the bookmaker overround. Partial markets such as golf
          // outrights only list the favourites, so they keep the typical-margin estimate.
          const book = (ev.selections || []).reduce((t, s) => t + (s.decimal > 1 ? 1 / s.decimal : 0), 0);
          const fullMarket = book >= 0.9;
          (ev.selections || []).forEach(sel => {
            if (sel.decimal && sel.decimal > 1.05) {
              const estimatedProb = fullMarket ? (1 / sel.decimal) / book : 1 / (sel.decimal * MatchIQBuilder.ESTIMATED_MARGIN);
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
  // Search wider than we show, so cross-sport combinations are not cut before the value sort
  builderResult = MatchIQBuilder.buildSlips(combinedPool, { stake, win, legs: Number(legs), maxSlips: 12 });
  if (builderResult && builderResult.slips && multiSportPool.length) {
    // Also search the other sports on their own, so an all-non-football slip can compete
    const others = MatchIQBuilder.buildSlips(multiSportPool, { stake, win, legs: Number(legs), maxSlips: 4 });
    if (others && others.slips) {
      const key = s => s.legs.map(l => l.selId + '@' + l.matchId).join('|');
      const seen = new Set(builderResult.slips.map(key));
      others.slips.forEach(s => { if (s.onTarget && !seen.has(key(s))) builderResult.slips.push(s); });
    }
  }
  // Always sort slips by Expected Value (EV) descending so the Best Value combination is noted and at the top
  if (builderResult && builderResult.slips && builderResult.slips.length > 0) {
    builderResult.slips.sort((a, b) => (b.ev != null ? b.ev : 0) - (a.ev != null ? a.ev : 0));
    const isCross = s => s.legs.some(l => l.sport && l.sport !== 'football');
    const shown = builderResult.slips.slice(0, 4);
    // With other sports switched on, always show the best slip that uses them
    const bestCross = builderResult.slips.find(isCross);
    if (bestCross && !shown.some(isCross)) shown[shown.length - 1] = bestCross;
    builderResult.slips = shown;
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

// One acca at a time, in plain words: the chance it lands, how often it loses, the legs and what it pays.
// "Show another option" steps through the other combinations instead of stacking four near-copies.
function slipCard(slip, idx, stake, total) {
  const m = MatchIQBuilder.money;
  const safeStake = Number(stake || (slip && slip.stake) || (builderState && builderState.stake) || 10) || 10;
  const odds = Number(slip.odds) || 1;
  const ret = Number.isFinite(Number(slip.ret)) ? Number(slip.ret) : (safeStake * odds);
  const profit = Number.isFinite(Number(slip.profit)) ? Number(slip.profit) : (ret - safeStake);
  const chance = slip.chance >= 0.1 ? Math.round(slip.chance * 100) : (slip.chance * 100).toFixed(1);
  const loses = slip.chance >= 0.5 ? 'It still loses about ' + Math.round((1 - slip.chance) * 10) + ' times in 10.'
    : slip.chance >= 0.1 ? 'It loses about ' + Math.round((1 - slip.chance) * 10) + ' times in 10.'
    : 'Roughly a 1 in ' + Math.round(1 / Math.max(slip.chance, 0.001)) + ' shot: most slips like this lose.';
  const kicker = (idx === 0 ? 'Our best ' : 'Option ' + (idx + 1) + ': ') + slip.legs.length + '-leg acca' + (builderState.timing === 'today' ? ' · all games today' : '');
  return '<article class="slip primary acca-one">' +
    '<div class="slip-head"><div><div class="slip-kicker">' + esc(kicker) + ' ' + jargonTip('acca') + '</div>' +
    '<div class="slip-odds mono">' + esc(fmtOdds(odds)) + '</div></div>' +
    '<div class="slip-chance"><b class="mono">' + chance + '%</b><small>chance every leg wins</small></div></div>' +
    '<p class="acca-loses">' + esc(loses) + '</p>' +
    '<ol class="slip-legs">' + slip.legs.map(slipLegRow).join('') + '</ol>' +
    '<div class="slip-sum"><span>Stake <b class="mono">' + m(safeStake) + '</b></span><span>Returns <b class="mono">' + m(ret) + '</b></span><span>Profit <b class="mono">' + m(profit) + '</b></span></div>' +
    (slip.estimated ? '<p class="slip-note">Some prices are estimates, not live bookmaker prices. Your bookmaker’s price will differ, so the return will too.</p>' : '') +
    '<div class="acca-actions">' +
      '<button type="button" class="btn primary" onclick="addAccaToOwnBet(' + idx + ')">Add to my bet slip</button>' +
      '<button type="button" class="btn" onclick="openSlipCard(' + idx + ')" title="Tick off legs as you place them in your bookmaker app">📋 Open Slip Card</button>' +
      '<button type="button" class="btn" data-share-slip="' + idx + '">Share</button>' +
    '</div>' +
    (total > 1 ? '<button type="button" class="acca-next" onclick="nextAccaOption()">↻ Show another option <span>(' + (idx + 1) + ' of ' + total + ')</span></button>' : '') +
    '</article>';
}

let accaOption = 0;
function nextAccaOption() {
  const n = builderResult && builderResult.slips ? builderResult.slips.length : 0;
  if (!n) return;
  accaOption = (accaOption + 1) % n;
  const out = $('builder-out');
  if (out) out.innerHTML = builderOutput();
}

// Model legs (from the acca builder or today's top picks) onto the player's bet slip. With replace,
// the slip becomes exactly these legs (after asking if it already holds others); otherwise they are added.
function addLegsToOwnBet(modelLegs, replace) {
  if (replace && ownBet.legs.length && !confirm('Your bet slip already has ' + ownBet.legs.length + ' selection' + (ownBet.legs.length === 1 ? '' : 's') + '. Replace them?')) return false;
  const legs = [];
  modelLegs.forEach(l => {
    const id = 'ob' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const fx = l.sport && l.sport !== 'football' ? null : fixtureById(l.matchId);
    const opt = fx && ownBetMarketsFor(fx).find(o => o.key === l.selId || o.src === l.label || o.label === l.label);
    if (fx && opt) {
      const leg = ownBetFootballLeg(fx, opt, id);
      if (l.odds > 1) { leg.odds = Number(l.odds); leg.est = l.priceSource !== 'live'; }
      leg.origin = 'matchiq';
      legs.push(leg);
    } else {
      const sport = String(l.sport || 'Football');
      legs.push({ id, kind: 'custom', sport: sport.charAt(0).toUpperCase() + sport.slice(1), pick: String(l.label || '').slice(0, 120), odds: Number(l.odds) > 1 ? Number(l.odds) : null, origin: 'matchiq' });
    }
  });
  if (replace) { ownBet.legs = legs.slice(0, OWN_BET_MAX_LEGS); ownBet.stake = Number(builderState.stake) || ownBet.stake; ownBet.origin = ''; }
  else {
    const room = OWN_BET_MAX_LEGS - ownBet.legs.length;
    if (room <= 0) { toast('A bet can have up to ' + OWN_BET_MAX_LEGS + ' selections.', 'warn'); return false; }
    ownBet.legs = ownBet.legs.concat(legs.slice(0, room));
    toast('Added to your bet slip (' + ownBetName(ownBet.legs.length) + ').');
  }
  persistOwnBet();
  updateOwnBetBar();
  return true;
}

// Puts the model's acca on the player's bet slip, where it is saved to the Diary or League like any bet.
function addAccaToOwnBet(idx) {
  const slip = builderResult && builderResult.slips && builderResult.slips[idx];
  if (!slip || !addLegsToOwnBet(slip.legs, true)) return;
  location.hash = '#/build';
  toast('Acca added to your bet slip. Add your stake and save it.');
}




function builderOutput() {
  const r = builderResult, { stake, win, legs } = builderState, m = MatchIQBuilder.money;
  if (!r) return '';
  const numLegs = Number(legs) || 4;
  const need = '<p class="builder-need">To win <b>' + m(win) + '</b> from <b>' + m(stake) + '</b> with ' + numLegs + ' legs you need combined odds of about <b class="mono">' + fmtOdds((stake + win) / stake) + '</b>.</p>';
  if (r.error) {
    let helper = '';
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = predictionsList().filter(p => p.fixture && p.fixture.kickoff_utc && p.fixture.kickoff_utc.slice(0, 10) === todayStr).length;
    if (builderState.timing === 'today' && todayCount > 0 && todayCount < numLegs) {
      helper = '<div class="acca-actions" style="margin-top:10px">' +
        '<button type="button" class="btn" onclick="setBuilderLegs(' + todayCount + ')">Build a ' + todayCount + '-leg acca for today</button>' +
        '<button type="button" class="btn" onclick="setBuilderTiming(\'all\')">Use the next 7 days</button></div>';
    }
    return need + '<div class="empty" style="margin-top:12px">' + esc(r.error) + '</div>' + helper;
  }
  const n = r.slips.length, idx = accaOption % n, slip = r.slips[idx];
  const miss = r.exact ? '' : '<p class="slip-warn">Nothing lands exactly on that target. This is the closest: it returns ' + m(slip.ret) + ' (profit ' + m(slip.profit) + ').</p>';
  const fine = '<p class="builder-fine">Chances are Bet Buddy estimates, not promises. Bookmakers build a margin into every price, so over time most accas lose money. Only stake what you are happy to lose.</p>';
  return need + miss + slipCard(slip, idx, stake, n) + fine;
}


// --- ACCA RISK & VOLATILITY GAUGE (UKGC & ASA Compliant) ---
function getAccaVolatility(slip, win) {
  if (!slip || !slip.odds) {
    return {
      kicker: 'Ready to Calibrate',
      desc: 'Pick your legs and stake to see how risky the accumulator is.',
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
  const now = Date.now(), todayStr = new Date(now).toISOString().slice(0, 10);
  const allPreds = predictionsList();
  const todayN = allPreds.filter(p => kickoffMs(p.fixture) > now && p.fixture && p.fixture.kickoff_utc && p.fixture.kickoff_utc.slice(0, 10) === todayStr).length;
  const weekN = allPreds.filter(p => kickoffMs(p.fixture) > now).length;
  const chip = (attrs, on, label) => '<button type="button" ' + attrs + ' aria-pressed="' + on + '">' + label + '</button>';
  const row = (label, body) => '<div class="bq-row"><span class="bq-label">' + label + '</span><div class="bq-chips">' + body + '</div></div>';
  const sports = [['football', '⚽ Football'], ['tennis', '🎾 Tennis'], ['golf', '⛳ Golf'], ['darts', '🎯 Darts'], ['rugby', '🏉 Rugby']];
  const stakeChips = [2, 5, 10, 20].map(v => chip('onclick="setBuilderStake(' + v + ')"', Number(stake) === v, '£' + v)).join('') +
    '<label class="bq-own"><span class="sr-only">Other stake in pounds</span>£<input id="b-stake" class="ctl mono" type="number" inputmode="decimal" min="0.5" max="10000" step="0.5" value="' + stake + '" data-b="stake"></label>';
  const winChips = [10, 25, 50, 100, 250].map(w => chip('class="win-chip" data-win="' + w + '"', win === w, '£' + w)).join('') +
    '<label class="bq-own"><span class="sr-only">Other win amount in pounds</span>£<input id="b-win" class="ctl mono" type="number" inputmode="decimal" min="1" max="10000" step="1" value="' + win + '" data-b="win"></label>';
  return '<section class="builder card" aria-labelledby="builder-title">' +
    '<div class="builder-kicker">Model-built acca</div>' +
    '<h1 class="page-title" id="builder-title">Tell us the win. We’ll build the acca.</h1>' +
    '<p class="page-sub">Pick when, how many legs and what you’d like to win. Bet Buddy finds the combination most likely to land.</p>' +
    '<div class="bq">' +
      row('When', chip('data-timing="today"', curTiming === 'today', 'Today <small>' + todayN + ' games</small>') + chip('data-timing="all"', curTiming === 'all', 'Next 7 days <small>' + weekN + ' games</small>')) +
      row('Legs', [2, 3, 4, 5, 6, 8].map(n => chip('class="legpick" data-legs="' + n + '"', legs === n, String(n))).join('')) +
      row('Stake', stakeChips) +
      row('To win', winChips) +
      row('Sports', sports.map(sp => chip('data-toggle-sport="' + sp[0] + '"', activeSports.includes(sp[0]), sp[1])).join('')) +
    '</div>' +
    '<p class="stake-safety-note">Only stake what you are happy to lose. Most people keep it to £5–£10.</p>' +
    '<div id="builder-out" class="builder-out" aria-live="polite">' + builderOutput() + '</div>' +
    '<p class="builder-foot">18+ only. Gambling can be addictive; play responsibly. <a href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware.org</a>. Bet Buddy does not take bets, and nothing here is a guarantee.</p></section>';
}

function setBuilderStake(v) {
  builderState.stake = Math.max(0.5, Math.min(10000, Number(v) || 10));
  try { localStorage.setItem(BUILDER_KEY, JSON.stringify(builderState)); } catch (e) { /* ignore */ }
  render();
}

function updateBuilder() {
  accaOption = 0;
  builderCompute();
  const out = $('builder-out');
  if (out) out.innerHTML = builderOutput();
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



function beginnerGuides() {
  return '<div class="section"><div class="section-head"><h2 class="section-title">New to Bet Buddy? Quick intelligence guides</h2><span class="section-note">Tap any card to understand how honest football prediction works.</span></div>' +
    '<div class="bento-grid">' +
      '<div class="bento-card"><div class="bento-icon">' + hubIcon('scale', 22) + '</div><div><div class="bento-kicker">Betting Intelligence</div><h3 class="bento-title">What is Value?</h3><p class="bento-desc">A 60% chance isn’t value if the bookmaker odds are too low. Value is when the payout beats the true risk.</p></div><span class="bento-badge emerald">+5% EV threshold</span></div>' +
      '<div class="bento-card"><div class="bento-icon">' + hubIcon('dice', 22) + '</div><div><div class="bento-kicker">Odds Demystified</div><h3 class="bento-title">6/4 vs 2.50 Odds</h3><p class="bento-desc">6/4 is UK fractional: £6 profit per £4 stake. 2.50 is decimal: total return including stake. Switch anytime in the header!</p></div><span class="bento-badge">Toggle in header</span></div>' +
      '<div class="bento-card"><div class="bento-icon">' + hubIcon('layers', 22) + '</div><div><div class="bento-kicker">Accas & Builders</div><h3 class="bento-title">Acca Odds & Return Builder</h3><p class="bento-desc">Combine selections for higher returns. Bet Buddy checks upcoming matches to find the highest-chance path to your win goal.</p></div><span class="bento-badge">Real-time scan</span></div>' +
      '<div class="bento-card"><div class="bento-icon">' + hubIcon('shield', 22) + '</div><div><div class="bento-kicker">Honest Predictions</div><h3 class="bento-title">No Bet is an Answer</h3><p class="bento-desc">When evidence is thin, odds are bad or data is missing, we say No Bet. We never invent fake confidence or forced picks.</p></div><span class="bento-badge amber">Zero hype</span></div>' +
    '</div></div>';
}

function dismissOnboarding() {
  try { localStorage.setItem('betbuddy_onboarded_v1', 'true'); } catch (e) {}
  const card = $('onboarding-card');
  if (card) card.remove();
}

/* Home hub icons: one consistent 24px line set (stroke inherits colour) in place of emoji. */
const HUB_ICONS = {
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m12 8 1.6 2.4L16 12l-2.4 1.6L12 16l-1.6-2.4L8 12l2.4-1.6z"/>',
  slip: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="m9 9 2 2 4-4M9 15h6"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a2 2 0 0 0 0 4h3M16 6h3a2 2 0 0 1 0 4h-3M12 13v4M8.5 20h7M10 17h4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  book: '<path d="M5 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2z"/><path d="M9 8h6M9 12h6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  scale: '<path d="M12 3v18M5 21h14M5 7h14"/><path d="m5 7-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>'
};
function hubIcon(name, size) {
  const s = size || 22;
  return '<svg class="hub-ico" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (HUB_ICONS[name] || '') + '</svg>';
}

function renderWelcomeHero() {
  let onboardHtml = '';
  try {
    if (!localStorage.getItem('betbuddy_onboarded_v1')) {
      onboardHtml = '<div class="onboarding-card" id="onboarding-card">' +
        '<h3>Welcome to Bet Buddy</h3>' +
        '<div class="onboarding-steps">' +
          '<div class="onboarding-step-item"><span class="onboarding-step-num">1</span><div><b>Pick Your Slate</b><span>Choose today\'s games or the 7-day slate.</span></div></div>' +
          '<div class="onboarding-step-item"><span class="onboarding-step-num">2</span><div><b>Set Your Stake</b><span>Choose a stake you can afford to lose.</span></div></div>' +
          '<div class="onboarding-step-item"><span class="onboarding-step-num">3</span><div><b>Review the Risk</b><span>Check the model probability and how often accas like this lose.</span></div></div>' +
        '</div>' +
        '<button type="button" class="btn small primary" onclick="dismissOnboarding()" style="min-height:40px;">Got it</button>' +
      '</div>';
    }
  } catch (e) {}

  const diaryCount = getStoredDiary().length;
  const user = getAuthUser();
  const userName = user && user.signedIn ? (user.handle || user.name || '').replace(/^@+/, '').split(' ')[0] : '';

  const card = (tag, cls, icon, title, desc, cta, attrs) =>
    '<' + tag + ' class="hub-card ' + cls + '" ' + attrs + '>' +
      '<span class="hub-card-ico">' + hubIcon(icon, 24) + '</span>' +
      '<span class="hub-card-body"><span class="hub-card-title">' + title + '</span><span class="hub-card-desc">' + desc + '</span></span>' +
      '<span class="hub-card-cta">' + cta + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>' +
    '</' + tag + '>';

  return '<div class="hub">' +
    '<div class="hub-head">' +
      '<h1 class="hub-title">' + (userName ? 'Hi ' + esc(userName) + ', what first?' : 'What would you like to do?') + '</h1>' +
      '<p class="hub-sub">Honest football estimates, with a clear No bet when the evidence isn&rsquo;t there.</p>' +
    '</div>' +
    card('a', 'hub-build', 'slip', 'Build your own bet', 'Single, double, treble, 4-fold, 5-fold and bigger. Football or any sport, then save it to your Diary or League.', 'Start', 'href="#/build"') +
    '<div class="hub-grid">' +
      card('a', 'hub-pick', 'target', 'Model-built acca', 'We build an acca to your target return.', 'Build', 'href="#/picks"') +
      card('button type="button"', 'hub-models portal-card-best-value', 'spark', 'Model picks of the day', 'Biggest model-vs-price gaps. Information only.', 'View', 'onclick="openBestValueModal(\'single\')"') +
      card('button type="button"', 'hub-betai', 'compass', 'BetAI', 'Ask anything: a team, an acca, goals, cards, corners. Picks only.', 'Ask', 'onclick="openBetAI()"') +
      card('a', 'hub-leagues', 'trophy', 'Leagues', 'Compete with mates and in local ladders.', 'Join', 'href="#/leagues"') +
    '</div>' +
    '<nav class="hub-more" aria-label="More">' +
      '<a href="#/fixtures">' + hubIcon('calendar', 16) + 'Fixtures</a>' +
      '<a href="#/results">' + hubIcon('chart', 16) + 'Our record</a>' +
      '<a href="#/diary">' + hubIcon('book', 16) + 'Diary' + (diaryCount ? ' (' + diaryCount + ')' : '') + '</a>' +
    '</nav>' +
    '<button type="button" class="hub-quiet-link" onclick="openButlerModal()">' + hubIcon('slip', 14) + 'My bookmakers &amp; slip note settings</button>' +
    onboardHtml +
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

  // Tiered selection so the feature never goes blank while fixtures exist:
  //   verified - validated evidence + live bookmaker price + at least 5% edge (strictest)
  //   live     - live bookmaker price + at least 5% edge, evidence still provisional
  //   model    - no fresh bookmaker prices at all: the model's most likely picks at indicative prices
  const withEv = pool.map(leg => ({ ...leg, ev: (Number(leg.odds) * Number(leg.p)) - 1 }));
  const isValidated = leg => leg.support === 'validated' || (leg.evidence && leg.evidence.status === 'validated');
  let mode = 'verified';
  // Edges above 35% and longshots under 35% chance are almost always a price or model outlier, not value.
  const saneEdge = leg => leg.ev >= 0.05 && leg.ev <= 0.35 && leg.p >= 0.35;
  let qualified = withEv.filter(leg => isValidated(leg) && leg.priceSource === 'live' && saneEdge(leg));
  if (!qualified.length) {
    mode = 'live';
    qualified = withEv.filter(leg => leg.priceSource === 'live' && saneEdge(leg));
  }
  if (!qualified.length) {
    mode = 'model';
    qualified = withEv.filter(leg => leg.p >= 0.5);
  }
  if (!qualified.length) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayPool = qualified.filter(l => l.fixture && l.fixture.kickoff_utc && l.fixture.kickoff_utc.slice(0, 10) === todayStr);
  const candidatePool = todayPool.length >= 1 ? todayPool : qualified;
  if (mode === 'model') {
    candidatePool.sort((a, b) => (isValidated(b) - isValidated(a)) || (b.p - a.p));
  } else {
    candidatePool.sort((a, b) => b.ev - a.ev);
  }

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
    mode,
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

// Today's top model picks: a hero "pick of the day", the other picks, then a way to combine them.
// Each pick shows the gap that makes it interesting: our chance against the chance the price implies.
function bvGap(l, mode, big) {
  const ours = Math.round(l.p * 100), implied = Math.round(100 / Number(l.odds || 1));
  if (mode === 'model') {
    return '<div class="bv-gap' + (big ? ' big' : '') + '"><div class="bv-gap-row"><span>Our chance</span><i><em class="ours" style="--w:' + ours + '%"></em></i><b>' + ours + '%</b></div></div>';
  }
  return '<div class="bv-gap' + (big ? ' big' : '') + '">' +
    '<div class="bv-gap-row"><span>Our chance</span><i><em class="ours" style="--w:' + ours + '%"></em></i><b>' + ours + '%</b></div>' +
    '<div class="bv-gap-row"><span>Price says</span><i><em style="--w:' + implied + '%"></em></i><b>' + implied + '%</b></div>' +
    (big ? '<p class="bv-gap-say">We rate it <b>' + (ours - implied) + ' points</b> likelier than the ' + esc(l.bookmaker || 'bookmaker') + ' price suggests.</p>' : '') +
  '</div>';
}

function bvPrice(l) { return oddsFormat === 'decimal' ? calc.formatDecimalOdds(l.odds) : (l.fractional || fmtOdds(l.odds)); }
function bvWhen(l) {
  const ms = l.kickoff || kickoffMs(l.fixture), f = l.fixture || {};
  return (Number.isFinite(ms) ? fmtDay(ms) + ' ' + fmtTime(ms) : '') + (f.competition ? ' · ' + leagueName(f.competition) : '');
}
function bvMatch(l) { const f = l.fixture || {}; return f.home && f.away ? f.home + ' v ' + f.away : (f.home || 'Match'); }

function renderBestValueModalContent() {
  const data = getTodayBestValuePicks();
  const body = $('best-value-modal-body');
  if (!body) return;
  const kicker = $('best-value-kicker');
  if (kicker) kicker.textContent = !data ? 'Nothing qualifies right now' : data.mode === 'verified' ? '💎 Live prices · proven markets' : data.mode === 'live' ? '⚡ Live prices · early evidence' : '🧠 Model picks · estimated prices';
  if (!data) {
    body.innerHTML = '<div class="bv-empty"><div class="bv-empty-ico">⚖️</div><h3>No picks today</h3>' +
      '<p>None of today’s prices beat our estimates by enough. We would rather show nothing than force a pick.</p>' +
      '<a href="#/picks" class="btn primary" onclick="closeBestValueModal()">Build an acca instead</a></div>';
    return;
  }
  const all = data.fourFold.legs, top = all[0], rest = all.slice(1);
  const onSlip = l => ownBet.legs.some(x => x.fixtureId === l.matchId && x.key === l.selId);
  const addBtn = (l, i, big) => '<button type="button" class="' + (big ? 'btn primary bv-add' : 'bv-plus') + (onSlip(l) ? ' on' : '') + '" onclick="addBestValueLeg(' + i + ')" aria-label="Add ' + esc(l.label) + ' to my bet slip">' +
    (onSlip(l) ? (big ? '✓ On your slip' : '✓') : big ? '+ Add to bet slip' : '+') + '</button>';

  const hero = '<article class="bv-hero">' +
    '<div class="bv-hero-kicker">⭐ Pick of the day</div>' +
    '<div class="bv-hero-when">' + esc(bvWhen(top)) + '</div>' +
    '<div class="bv-hero-match">' + esc(bvMatch(top)) + '</div>' +
    '<div class="bv-hero-pick"><b>' + esc(top.label) + '</b><span class="bv-price mono">' + esc(bvPrice(top)) + '<small>' + esc(data.mode === 'model' ? 'estimate' : (top.bookmaker || 'bookmaker')) + '</small></span></div>' +
    bvGap(top, data.mode, true) +
    '<div class="bv-hero-actions">' + addBtn(top, 0, true) + '<a class="btn" href="#/match/' + encodeURIComponent(top.matchId) + '" onclick="closeBestValueModal()">Analysis ›</a></div>' +
  '</article>';

  const more = rest.length ? '<h3 class="bv-h">More picks today</h3><div class="bv-legs-list">' + rest.map((l, i) =>
    '<div class="bv-leg-item"><div class="bv-leg-info"><div class="bv-leg-when">' + esc(bvWhen(l)) + '</div><div class="bv-leg-match">' + esc(bvMatch(l)) + '</div>' +
      '<div class="bv-leg-sel">' + esc(l.label) + ' <span class="mono">' + esc(bvPrice(l)) + '</span></div>' + bvGap(l, data.mode, false) + '</div>' + addBtn(l, i + 1, false) + '</div>').join('') + '</div>' : '';

  const tiers = [['single', 'Single', 1], ['double', 'Double', 2], ['treble', 'Treble', 3], ['fourFold', '4-fold', 4]].filter(t => all.length >= t[2]);
  if (!tiers.some(t => t[0] === activeBestValueTier)) activeBestValueTier = tiers[tiers.length - 1][0];
  const tierData = data[activeBestValueTier];
  const stake = Number((builderState && builderState.stake) || 10) || 10;
  const chance = tierData.estProb >= 0.1 ? Math.round(tierData.estProb * 100) : (tierData.estProb * 100).toFixed(1);
  const combine = all.length > 1 ? '<h3 class="bv-h">Combine them</h3>' +
    '<div class="bv-tabs" role="group" aria-label="How many picks">' + tiers.map(t => '<button type="button" class="bv-tab' + (activeBestValueTier === t[0] ? ' active' : '') + '" aria-pressed="' + (activeBestValueTier === t[0]) + '" onclick="setBestValueTier(\'' + t[0] + '\')">' + t[1] + '</button>').join('') + '</div>' +
    '<div class="bv-summary-card"><div><span>Odds</span><b class="mono">' + esc(fmtOdds(tierData.odds)) + '</b></div><div><span>Chance all land</span><b class="mono">' + chance + '%</b></div><div><span>£' + stake.toFixed(0) + ' returns</span><b class="mono pos">£' + (stake * tierData.odds).toFixed(2) + '</b></div></div>' +
    '<div class="bv-modal-actions"><button type="button" class="btn primary" onclick="addBestValueToDiary(\'' + activeBestValueTier + '\')">Put the ' + esc(tierData.type.toLowerCase()) + ' on my bet slip</button>' +
      '<button type="button" class="btn" onclick="openSlipCardFromBestValue(\'' + activeBestValueTier + '\')">📋 Slip card</button></div>' : '';

  const note = data.mode === 'model'
    ? 'Bookmaker prices are not fresh right now, so these are our most likely picks at estimated prices. Check the real price before you bet.'
    : data.mode === 'live'
      ? 'Our evidence for these markets is still early, so a gap against the price is a lead, not proof. No bet is certain.'
      : 'A gap against the price is not a promise. No bet is certain.';
  body.innerHTML = hero + more + combine + '<p class="bv-note">' + esc(note) + ' 18+. Only stake what you can afford to lose.</p>';
}

// One pick onto the bet slip (added alongside anything already there).
function addBestValueLeg(i) {
  const data = getTodayBestValuePicks();
  const l = data && data.fourFold.legs[i];
  if (!l) return;
  if (ownBet.legs.some(x => x.fixtureId === l.matchId && x.key === l.selId)) { toast('Already on your bet slip.'); return; }
  addLegsToOwnBet([l], false);
  renderBestValueModalContent();
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

// Puts the chosen combination on the bet slip, where it is saved to the Diary or League like any bet.
function addBestValueToDiary(tier) {
  const data = getTodayBestValuePicks();
  if (!data) return;
  const tierData = data[tier] || data.single;
  if (!addLegsToOwnBet(tierData.legs, true)) return;
  closeBestValueModal();
  location.hash = '#/build';
  toast('Picks added to your bet slip. Add your stake and save it.');
}

// Nudges signed-in players who have not set their full location: regional ladders are opt-in by location.
function locationPromptBanner() {
  const authUser = getAuthUser();
  if (!(authUser && authUser.signedIn)) return '';
  const prof = getUserProfile();
  if (prof.town && prof.region && prof.country) return '';
  return '<a href="#/more" data-select-more-tab="account" class="guide-banner"><span class="guide-banner-ico">📍</span><span><b>Join your regional leagues: add your location</b><small>Set your town, county and country in your profile to get on the Hometown, County and Country ladders.</small></span><span class="guide-banner-go">&rarr;</span></a>';
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
    locationPromptBanner() +
    '<a href="#/guide" class="guide-banner"><span class="guide-banner-ico">'+hubIcon('compass',22)+'</span><span><b>New here? Read the how-to guide</b><small>Features, private leagues and regional ladders explained in two minutes.</small></span><span class="guide-banner-go">&rarr;</span></a>' +
    beginnerGuides() +
  '</section>';
}

function viewPicks() {
  const topHubNav = '<div class="picks-top-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:4px 0;">' +
    '<a href="#/" class="btn small" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none;font-weight:700;background:rgba(56,189,248,0.14);border:1px solid var(--cyan);color:#fff;">← Welcome Hub</a>' +
  '</div>';
  const list = upcoming();
  const sharedBanner = sharedSlipNotice
    ? '<div class="notice section shared-slip-notice" style="border-color:var(--cyan);background:rgba(56,189,248,0.12);color:#fff;margin-bottom:18px"><span style="font-size:20px">🎯</span><div><b>Acca shared by a mate!</b> Bet Builder is pre-filled to target £' + builderState.win + ' return across ' + builderState.legs + ' bets.</div><button type="button" class="icon-btn" onclick="sharedSlipNotice=false;render()" style="margin-left:auto">&times;</button></div>'
    : '';

  let html = '<section class="view">' +
    topHubNav +
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
  html += '<details class="card section"><summary class="section-title" style="cursor:pointer;min-height:44px;display:flex;align-items:center">How Most Likely, Best Value and No Bet work</summary><ol class="explain" style="margin-top:8px">' +
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
            '<button type="button" class="sport-odds-btn" data-open-bookie=\'' + betData + '\' title="Open on ' + esc(sel.bookmaker) + '">' + esc(sel.fractional) + '</button>' +
            '<button type="button" class="btn small" data-diary=\'' + betData + '\' title="Add to Bet Diary">+ Diary</button>' +
            '<button type="button" class="btn small own-add-btn" data-own-bet=\'' + betData + '\' title="Add to my own bet slip">+ My bet</button>' +
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
      '<span class="section-note">' + esc(t.course || t.venue || t.surface || 'Live UK Bookmaker Prices') + '</span></div>' +
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
let fixturesLimit = 60;
let resultsLimit = 40;
function viewFixtures() {
  const now = Date.now();
  const tabs = { upcoming: 'Upcoming', awaiting: 'Awaiting result', results: 'Results' };
  let base;
  if (fixturesTab === 'upcoming') {
    // Strictly upcoming scheduled future matches: exclude cancelled, removed, or past fixtures
    base = fixturesList().filter(f => f.status === 'SCHEDULED' && kickoffMs(f) > now).sort((a, b) => kickoffMs(a) - kickoffMs(b));
    if (!fixturesShowAll) base = base.filter(f => kickoffMs(f) - now < 35 * 86400000);
  } else if (fixturesTab === 'awaiting') {
    base = fixturesList().filter(f => f.status === 'AWAITING_RESULT' || f.status === 'RESULT_CONFLICT').sort((a, b) => kickoffMs(b) - kickoffMs(a));
  } else {
    base = fixturesList().filter(f => f.status === 'FINISHED').sort((a, b) => kickoffMs(b) - kickoffMs(a));
  }
  if (clubFilter) base = base.filter(f => f.home.toLowerCase().includes(clubFilter) || f.away.toLowerCase().includes(clubFilter));
  const counts = {};
  base.forEach(f => { const c = f.competition || 'PL'; counts[c] = (counts[c] || 0) + 1; });
  let list = base.filter(f => inComp(f.competition));
  if (fixturesTab === 'results') list = list.slice(0, fixturesShowAll ? 400 : 30);
  const fixturesTotal = list.length;
  list = list.slice(0, fixturesLimit);
  const searchBar = '<div class="search-bar"><svg viewBox="0 0 24 24" class="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input type="search" id="club-search" class="ctl search-input" placeholder="Search club (e.g. Arsenal, Liverpool)..." value="' + esc(clubFilter) + '" autocomplete="off"></div>';
  let html = '<section class="view"><h1 class="page-title">Fixtures</h1><p class="page-sub">' + (compFilter === 'ALL' ? 'All ' + Object.keys(LEAGUES).length + ' competitions' : esc(leagueName(compFilter))) + ' 2026/27. The schedule refreshes automatically; matches leave Upcoming at kick-off and move to Results once a source confirms the score.</p>' +
    searchBar + '<div class="section" style="margin-top:16px;display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between"><div class="seg" role="group" aria-label="Fixture list">' +
    Object.entries(tabs).map(([k, label]) => '<button type="button" data-tab="' + k + '" aria-pressed="' + (fixturesTab === k) + '">' + label + '</button>').join('') + '</div><div class="chips">' + freshnessChips() + '</div></div>' + compBar(counts) +
    (fixturesTab === 'upcoming' ? '<p class="own-hint cp-how">Tap a match for the full analysis, or tap a price to put it on your bet slip.</p>' : '');
  if (LOAD_ERRORS.fixtures) return html + errorPanel('fixtures') + '</section>';
  html += list.length ? groupedRows(list, fixturesTab === 'upcoming') : '<div class="empty" style="margin-top:16px">' + (fixturesTab === 'awaiting' ? 'No matches are waiting for a confirmed result.' : 'Nothing to show yet.') + '</div>';
  if ((fixturesTab === 'upcoming' || fixturesTab === 'results') && !fixturesShowAll) html += '<button type="button" class="btn" data-showall style="margin-top:8px">Show ' + (fixturesTab === 'upcoming' ? 'the rest of the season' : 'all results') + '</button>';
  if (fixturesTotal > list.length) html += '<button type="button" class="btn" data-more style="margin-top:8px">Show more matches (' + (fixturesTotal - list.length) + ' left)</button>';
  return html + '</section>';
}


// Model chance for every market the coupon shows, so the match page can print it under each price.
// Double chance and draw no bet come straight from the three result chances.
function modelProbsFor(pred) {
  const p = {};
  if (!pred) return p;
  allSelections(pred).forEach(x => { p[x.id] = Number(x.p); });
  const H = p['result:H'], D = p['result:D'], A = p['result:A'];
  if (H >= 0 && D >= 0 && A >= 0) {
    p['dc:1X'] = H + D; p['dc:X2'] = D + A; p['dc:12'] = H + A;
    if (H + A > 0) { p['dnb:H'] = H / (H + A); p['dnb:A'] = A / (H + A); }
  }
  return p;
}

// One card that says, in plain words, how the match looks and whether any price is worth a bet.
// It replaces the old verdict, Most likely / Best value pair, result card and Top six, which could
// appear to disagree with each other.
function matchViewCard(pred, fx) {
  const r = pred.markets.result;
  const res = ['H', 'D', 'A'].map(k => r.selections.find(x => x.key === k) || { key: k, p: 0 });
  const name = k => k === 'H' ? fx.home : k === 'A' ? fx.away : 'Draw';
  const ranked = res.slice().sort((a, b) => b.p - a.p);
  const top = ranked[0], gap = ranked[0].p - ranked[1].p;
  const headline = top.key === 'D' ? 'Looks tight: a draw is the single most likely result'
    : gap < 0.06 ? 'Too close to call'
    : top.p >= 0.55 ? name(top.key) + ' are clear favourites'
    : name(top.key) + ' are slight favourites';
  const bar = '<div class="mv-bar" role="img" aria-label="' + esc(res.map(x => name(x.key) + ' ' + pct(x.p)).join(', ')) + '">' +
    res.map(x => '<span class="mv-seg mv-' + x.key + '" style="flex:' + Math.max(0.04, x.p).toFixed(3) + '"></span>').join('') + '</div>' +
    '<div class="mv-legend">' + res.map(x => '<span class="mv-' + x.key + '"><b>' + pct(x.p) + '</b> ' + esc(name(x.key)) + '</span>').join('') + '</div>';

  const m = (pred.recommendations || {}).most_likely;
  const likely = m && m.decision === 'most_likely'
    ? 'Most likely to land: <b>' + esc(MARKETS[m.market].name) + ', ' + esc(m.label) + '</b>, about ' + Math.round(m.p * 10) + ' times in 10.'
    : 'No single selection stands out for this match.';

  const best = calc.bestValue(pred, pricesFor(pred.match_id), matchIQBands());
  const v = best ? best.v.verdict : 'awaiting_odds';
  const verdict = {
    value: ['value', '✅ Worth a look', esc(best && best.sel.label) + ' at ' + esc(best && best.v.priceText) + ' is a longer price than our estimate says it should be. That is not a guarantee: it still loses often.'],
    no_value: ['nobet', '✋ No bet', 'The prices on offer are shorter than our estimates, so none of them looks good value.'],
    no_bet: ['nobet', '✋ No bet', 'Our model has no proven edge on the markets with prices here, so we will not call any of them value.'],
    awaiting_odds: ['awaiting', '🕐 No prices yet', 'There are no bookmaker prices for this match yet, so we cannot say whether any bet is good value.']
  }[v] || ['awaiting', 'No prices yet', ''];
  const sel = res.find(x => x.key === r.pick.key) || top;
  const selFull = allSelections(pred).find(x => x.id === 'result:' + sel.key) || {};

  return '<section class="card section mv-card">' +
    '<div class="mv-kicker"><span>Bet Buddy’s view</span><span class="evidence-row">' + statusBadge(selFull.status) + meter(selFull.strength) + '</span></div>' +
    '<h2 class="mv-head">' + esc(headline) + '</h2>' + bar +
    '<p class="mv-line">' + likely + '</p>' +
    '<div class="mv-verdict ' + verdict[0] + '"><b>' + verdict[1] + '</b><span>' + verdict[2] + '</span></div>' +
    '<details class="mv-why"><summary>Why, and check a price you were offered</summary>' +
      '<ul class="explain" style="margin-top:6px">' + resultExplanation(pred) + '</ul>' +
      '<p class="dim" style="font-size:13px;margin-top:10px">' + esc(r.evidence.summary) + ' The models use results and match statistics only. They know nothing about injuries, team news, line-ups or motivation.</p>' +
      '<div id="value-' + esc(pred.match_id) + '" style="margin-top:10px">' + bestValueBlock(pred) + '</div>' +
    '</details></section>';
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
    html += matchViewCard(pred, fx) +
      '<section class="card section mv-markets"><div class="section-head"><h2 class="section-title">Markets</h2></div>' +
      '<p class="own-hint" style="margin-top:0">Each button shows the price, and underneath it how often we think it happens. Tap a price to put it on your bet slip, then save it to your Diary or League from there.</p>' +
      ownBetMatchPanel(fx, modelProbsFor(pred)) + '</section>';
    html += '<details class="card section all-markets"><summary class="section-title" style="cursor:pointer;min-height:44px;display:flex;align-items:center">Every market and line: full model figures (' + allSelections(pred).length + ' selections)</summary>' +
      '<p class="dim" style="font-size:13px;margin:6px 0 12px">Published ' + esc(ago(pred.published_at)) + ' · record ' + esc(pred.record_id) + '. Probability and evidence strength are shown separately: a 60% estimate with weak evidence is still weak.</p>' +
      '<div class="grid grid-2">' + MARKET_ORDER.filter(k => pred.markets[k]).map(k => marketCard(k, normaliseMarket(k, pred.markets[k]), { id, canLog: false })).join('') + '</div></details>';
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

// ---- Prediction record tiles: one per league, flipping over to a small infographic ----
function recordLeagueName(c) { return c === 'CL' ? 'Champions League' : leagueName(c); }

function recordStats(perf) {
  const r = (perf && perf.markets && perf.markets.result) || null;
  if (!r || !r.n) return null;
  const hits = r.hits != null ? r.hits : Math.round((r.pick_hit_rate || 0) * r.n);
  const timeline = (perf.result_timeline || []).slice().sort((a, b) => Date.parse(a.kickoff_utc) - Date.parse(b.kickoff_utc));
  return { n: r.n, hits, rate: hits / r.n, said: r.mean_pick_p, small: !r.sufficient_sample, timeline };
}

function recordAll(allPerf) {
  const parts = [allPerf].concat(Object.values(allPerf.by_competition || {})).map(recordStats).filter(Boolean);
  if (!parts.length) return null;
  const n = parts.reduce((t, x) => t + x.n, 0), hits = parts.reduce((t, x) => t + x.hits, 0);
  const said = parts.reduce((t, x) => t + (x.said || 0) * x.n, 0) / n;
  const timeline = [].concat(...parts.map(x => x.timeline)).sort((a, b) => Date.parse(a.kickoff_utc) - Date.parse(b.kickoff_utc));
  return { n, hits, rate: hits / n, said, small: n < 20, timeline };
}

function recordDonut(st, size) {
  const r = size / 2 - 6, c = 2 * Math.PI * r, won = c * st.rate;
  return '<svg class="rt-donut" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + st.hits + ' right, ' + (st.n - st.hits) + ' wrong">' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="rt-donut-bg"/>' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="rt-donut-fg" style="--off:' + won.toFixed(1) + '" stroke-dasharray="' + won.toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
    '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" class="rt-donut-t">' + Math.round(st.rate * 100) + '%</text></svg>';
}

function recordForm(st, count) {
  const last = st.timeline.slice(-count);
  if (!last.length) return '';
  return '<div class="rt-form" aria-label="Last ' + last.length + ' picks: ' + last.filter(x => x.won).length + ' right">' +
    last.map(x => '<span class="' + (x.won ? 'w' : 'l') + '" title="' + (x.won ? 'Right' : 'Wrong') + '"></span>').join('') + '</div>';
}

function recordSaidBars(st) {
  const said = Math.round((st.said || 0) * 100), did = Math.round(st.rate * 100), gap = did - said;
  const verdict = Math.abs(gap) <= 5 ? 'About as often as we said' : gap > 0 ? 'Right more often than we said' : 'Right less often than we said';
  return '<div class="rt-said"><div><span>We said</span><b>' + said + '%</b><i style="--w:' + said + '%"></i></div>' +
    '<div><span>Happened</span><b>' + did + '%</b><i class="did" style="--w:' + did + '%"></i></div><p>' + esc(verdict) + '</p></div>';
}

// Running share of picks that were right, pick by pick.
function recordSpark(st, w, h) {
  if (st.timeline.length < 5) return '';
  let hits = 0;
  const skip = Math.min(10, Math.floor(st.timeline.length / 4)), span = Math.max(1, st.timeline.length - 1 - skip);
  const rates = [];
  st.timeline.forEach((x, i) => { if (x.won) hits++; if (i >= skip) rates.push(hits / (i + 1)); });
  // Zoom to the range the line and the "we said" level cover, so the movement is visible.
  const lo = Math.max(0, Math.min(...rates, st.said || 0) - 0.05), hi = Math.min(1, Math.max(...rates, st.said || 0) + 0.05);
  const y = v => h - (v - lo) / (hi - lo) * h;
  const line = rates.map((v, i) => (i / span * w).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  const said = y(st.said || 0);
  return '<svg class="rt-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="Share of picks right over time">' +
    '<line x1="0" x2="' + w + '" y1="' + said.toFixed(1) + '" y2="' + said.toFixed(1) + '" class="rt-spark-said"/>' +
    '<polyline points="' + line + '" class="rt-spark-line" pathLength="1"/></svg>' +
    '<div class="rt-spark-key"><span><i class="ln"></i>Right so far</span><span><i class="dash"></i>What we said</span></div>';
}

function recordTile(code, name, st, wide) {
  const sub = st.hits + ' of ' + st.n + ' right';
  const front = '<div class="rt-face rt-front"><div class="rt-name">' + esc(name) + '</div>' +
    '<div class="rt-big">' + Math.round(st.rate * 100) + '<small>%</small></div><div class="rt-sub">' + esc(sub) + '</div>' +
    recordForm(st, wide ? 16 : 8) + (st.small ? '<span class="rt-small">Small sample</span>' : '') +
    '<span class="rt-hint">Tap to flip ↻</span></div>';
  const back = '<div class="rt-face rt-back"><div class="rt-name">' + esc(name) + '</div>' +
    '<div class="rt-back-top">' + recordDonut(st, wide ? 92 : 68) + '<div class="rt-legend"><span class="w">' + st.hits + ' right</span><span class="l">' + (st.n - st.hits) + ' wrong</span></div></div>' +
    recordSaidBars(st) + (wide ? recordSpark(st, 300, 60) : '') +
    (st.small ? '<p class="rt-note">Too few matches to judge yet.</p>' : '') +
    (code ? '<button type="button" class="rt-see" data-record-see="' + esc(code) + '">See predictions ↓</button>' : '') + '</div>';
  return '<div class="rt' + (wide ? ' wide' : '') + '" role="button" tabindex="0" aria-pressed="false" aria-label="' + esc(name + ': ' + sub + '. Tap for details') + '" data-record-tile>' +
    '<div class="rt-inner">' + front + back + '</div></div>';
}

function recordTiles(allPerf) {
  const all = recordAll(allPerf);
  if (!all) return '<div class="empty section">No settled predictions yet. The record fills in as matches finish.</div>';
  const order = Object.keys(LEAGUES);
  const rank = c => { const i = order.indexOf(c); return i < 0 ? 99 : i; };
  const leagues = [['PL', allPerf]].concat(Object.entries(allPerf.by_competition || {}))
    .map(([c, perf]) => [c, recordStats(perf)]).filter(x => x[1]).sort((a, b) => rank(a[0]) - rank(b[0]));
  return '<div class="rt-grid">' + recordTile('', 'All leagues', all, true) +
    leagues.map(([c, st]) => recordTile(c, recordLeagueName(c), st, false)).join('') + '</div>' +
    '<p class="own-hint">Each tile counts the match-result pick only: the result we rated most likely. Leagues are scored separately and never pooled, except in the All leagues total.</p>';
}

function flipRecordTile(tile) {
  const on = !tile.classList.contains('flipped');
  tile.classList.toggle('flipped', on);
  tile.setAttribute('aria-pressed', String(on));
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', e => {
    const see = e.target.closest && e.target.closest('[data-record-see]');
    if (see) {
      compFilter = see.dataset.recordSee; resultsFilter = 'settled';
      try { localStorage.setItem(COMP_KEY, compFilter); } catch (err) { /* the filter is a convenience */ }
      render();
      const log = $('rt-log');
      if (log) log.scrollIntoView({ block: 'start' });
      return;
    }
    const tile = e.target.closest && e.target.closest('[data-record-tile]');
    if (tile) flipRecordTile(tile);
  });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('[data-record-tile]')) { e.preventDefault(); flipRecordTile(e.target); }
  });
}

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


  let html = '<section class="view rt-view"><h1 class="page-title">Our prediction record</h1>' +
    '<p class="page-sub">Every football prediction Bet Buddy makes is sealed before kick-off, then marked right or wrong once the result is confirmed. Nothing is edited afterwards. Tap a league to see how it is going.</p>' +
    '<p class="rt-scores">Looking for scores? <a href="#/fixtures" onclick="fixturesTab=\'results\'">Fixtures → Results</a></p>' +
    recordTiles(allPerf);
  if (LOAD_ERRORS.history) return html + errorPanel('history') + '</section>';

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


  const shown = resultsFilter === 'settled' ? settled : resultsFilter === 'pending' ? pending : future;
  html += '<div class="section card" id="rt-log" style="padding:0"><div class="section-head" style="padding:16px 16px 0"><h2 class="section-title">Prediction log' +
    (compFilter !== 'ALL' ? ' <button type="button" class="rt-filter" data-comp="ALL" title="Show every league">' + esc(recordLeagueName(compFilter)) + ' ✕</button>' : '') + '</h2><div class="seg" role="group" aria-label="Prediction log">' +
    [['settled', 'Settled'], ['pending', 'Awaiting result'], ['future', 'Upcoming']].map(([k, l]) => '<button type="button" data-rfilter="' + k + '" aria-pressed="' + (resultsFilter === k) + '">' + l + '</button>').join('') + '</div></div>' +
    (shown.length ? shown.slice(0, resultsLimit).map(logRow).join('') + (shown.length > resultsLimit ? '<div style="padding:12px"><button type="button" class="btn" data-rmore>Show more (' + (shown.length - resultsLimit) + ' left)</button></div>' : '') : '<p class="muted" style="padding:16px">Nothing here yet.</p>') + '</div>';
  html += '<details class="section card maths-section" style="margin-top:20px;">' +
    '<summary style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;min-height:44px;font-weight:600;font-size:15px;color:var(--cyan);">' +
      '<span>🔬 Show the maths: ' + esc(compFilter === 'ALL' ? 'Premier League' : recordLeagueName(compFilter)) + ' (Brier score, calibration &amp; model details)</span>' +
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
  const labels = { most_likely: 'Most Likely picks', best_value: 'Price check picks', other: 'Other bets' };
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
  const isPast = ms <= Date.now();
  const isStuck = isPast && (Date.now() - ms > 2.2 * 3600000);
  const pendingBadge = isStuck
    ? '<span class="badge warn" style="font-size:11px;" title="Match completed; awaiting official score confirmation from match feed">Full Time (Awaiting Feed)</span>'
    : '<span class="badge pending">' + (isPast ? 'Awaiting' : 'Upcoming') + '</span>';
  const right = s ? '<span class="badge ' + (s.pick_won ? 'won' : 'lost') + '">' + (s.pick_won ? 'Right' : 'Wrong') + '</span>' : r.result ? '' : pendingBadge;
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
// The nav badge counts live (pending) bets only; settled bets are archived and live in the stats.
function updateDiaryCount() { const n = getStoredDiary().filter(e => e && e.outcome === 'pending').length; $('diary-count').textContent = n ? String(n) : ''; }
const money = v => '£' + Math.abs(v).toFixed(2);




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
  if (tierId === 'geo-country') return 'country-' + (prof.country || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  if (tierId === 'geo-region') return 'region-' + (prof.region || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  if (tierId === 'geo-town') return 'town-' + (prof.town || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return tierId;
}

// Only real Google-registered users may appear on any leaderboard: no placeholder "Punter_###" handles,
// no seeded names, and every non-self member must carry an account uid.
const BLOCKED_MEMBER_HANDLES = ['HeadPark73', 'Punter_747', 'Punter_737'];
function isRealMember(m) {
  return !!(m && m.handle && m.uid && !/^Punter_\d*$/i.test(String(m.handle)) && !BLOCKED_MEMBER_HANDLES.includes(m.handle));
}

const GEO_MEMBERS_CACHE_PREFIX = 'betbuddy_geo_cache_';
function getStoredGeoMembers(docId) {
  try {
    const raw = localStorage.getItem(GEO_MEMBERS_CACHE_PREFIX + docId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(isRealMember);
      }
    }
  } catch (e) {}
  return [];
}

function saveStoredGeoMembers(docId, members) {
  try {
    localStorage.setItem(GEO_MEMBERS_CACHE_PREFIX + docId, JSON.stringify((members || []).filter(isRealMember)));
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

function leagueRefs(code, uid) {
  const leagueRef = firestoreDb.collection('leagues').doc(code);
  return {
    leagueRef,
    memberRef: leagueRef.collection('members').doc(uid),
    membershipRef: firestoreDb.collection('users').doc(uid).collection('leagueMemberships').doc(code)
  };
}

// Drops a league from this device only. Reads the stored list fresh so concurrent syncs never
// write back a stale copy.
function forgetLeagueLocally(code, message) {
  const list = getStoredLeagues();
  const target = list.find(l => l.code === code);
  if (!target) return;
  saveStoredLeagues(list.filter(l => l.code !== code));
  if (activeLeagueId === target.id) {
    activeLeagueId = 'default';
    if (message) toast(message);
  }
  render();
}

function updateStoredLeague(code, changes) {
  const list = getStoredLeagues();
  const target = list.find(l => l.code === code);
  if (!target) return null;
  Object.assign(target, changes);
  saveStoredLeagues(list);
  return target;
}

// A failed write can mean the league was deleted or this player was kicked or left elsewhere.
// Confirm with a fresh read before removing anything, so a network blip never loses a league.
async function confirmLeagueGone(code, uid) {
  try {
    const { leagueRef, memberRef, membershipRef } = leagueRefs(code, uid);
    const leagueSnap = await leagueRef.get();
    let reason = null;
    if (!leagueSnap.exists) reason = 'This league was deleted by its creator.';
    else if (!(await memberRef.get()).exists) reason = 'You are no longer a member of ' + (leagueSnap.data().name || 'this league') + '.';
    if (!reason) return false;
    await membershipRef.delete().catch(() => {});
    forgetLeagueLocally(code, reason);
    return true;
  } catch (e) {
    return false;
  }
}

// Saves a league this player created: the league record, their member record and their own index
// entry. Safe to repeat; used for new leagues and for leagues that so far only exist on this device.
async function publishLeague(league, user) {
  const prof = getUserProfile();
  const nowIso = new Date().toISOString();
  const { leagueRef, memberRef, membershipRef } = leagueRefs(league.code, user.uid);
  const existing = await leagueRef.get();
  if (existing.exists && existing.data().creatorUid !== user.uid) {
    forgetLeagueLocally(league.code, 'That league code is already in use. Please create the league again.');
    return false;
  }
  const memberSnap = existing.exists ? await memberRef.get() : null;
  const memberData = { handle: prof.handle, avatar: prof.avatar, now: nowIso };
  const batch = firestoreDb.batch();
  if (!existing.exists) {
    batch.set(leagueRef, leagueDocs.leagueDoc({
      code: league.code, name: league.name, icon: league.icon, freq: league.freq,
      creatorUid: user.uid, creatorHandle: prof.handle, now: nowIso
    }));
  }
  if (memberSnap && memberSnap.exists) batch.update(memberRef, leagueDocs.memberProfileUpdate(memberData));
  else batch.set(memberRef, leagueDocs.newMemberDoc(memberData));
  batch.set(membershipRef, leagueDocs.membershipDoc({ code: league.code, name: league.name, icon: league.icon, role: 'creator', now: nowIso }));
  await batch.commit();
  updateStoredLeague(league.code, { cloudCreated: true, creatorUid: user.uid, creatorHandle: prof.handle, is_joined: false });
  return true;
}

async function renameLeague(code) {
  const list = getStoredLeagues();
  const target = list.find(l => l.code === code);
  const currentName = target ? target.name : 'Buddy League';
  const user = getAuthUser();
  if (!target || !user || target.creatorUid !== user.uid) {
    toast('Only the league creator can rename this league.');
    return;
  }
  const newName = prompt('Enter new name for your league (3–40 characters):', currentName);
  if (!newName || !newName.trim()) return;
  const cleanName = leagueDocs.cleanLeagueName(newName);
  if (cleanName.length < 3) {
    toast('League name must be between 3 and 40 characters.');
    return;
  }
  if (!firestoreDb) return;
  try {
    const { leagueRef, membershipRef } = leagueRefs(code, user.uid);
    await leagueRef.update(leagueDocs.leagueRename(cleanName, new Date().toISOString()));
    await membershipRef.set({ name: cleanName }, { merge: true }).catch(() => {});
    updateStoredLeague(code, { name: cleanName });
    toast('League renamed to ' + cleanName + '!');
  } catch (e) {
    console.warn('Rename error:', e);
    toast('Could not rename the league. Check your connection and try again.');
  }
  render();
}

async function refreshLeagueFromCloud(code) {
  if (!firestoreDb || !code) return;
  const user = getAuthUser();
  try {
    const snap = await firestoreDb.collection('leagues').doc(code).get();
    if (snap.exists) {
      const memSnap = await firestoreDb.collection('leagues').doc(code).collection('members').get();
      const mems = [];
      memSnap.forEach(d => mems.push({ ...d.data(), uid: d.id }));
      if (updateStoredLeague(code, { members: mems.filter(m => user ? m.uid !== user.uid : true) })) render();
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

// Kicking removes the member record and adds them to the league's banned list, so the
// kicked player cannot rejoin with the code or be re-added by their own device syncing.
async function kickPlayerFromLeague(leagueCode, memberUid, handle) {
  const user = getAuthUser();
  const target = getStoredLeagues().find(l => l.code === leagueCode);
  if (!target || !user || target.creatorUid !== user.uid) {
    toast('Only the league creator can throw players out.');
    return;
  }
  if (!memberUid || memberUid === user.uid) return;
  if (!confirm('Are you sure you want to throw @' + (handle || 'this punter') + ' out of this league?\nThey will not be able to rejoin with the code.')) return;
  if (!firestoreDb) return;
  toast('Removing @' + (handle || 'punter') + '...');
  try {
    const { leagueRef } = leagueRefs(leagueCode, user.uid);
    const batch = firestoreDb.batch();
    batch.delete(leagueRef.collection('members').doc(memberUid));
    batch.set(leagueRef.collection('banned').doc(memberUid), leagueDocs.banDoc({ handle, now: new Date().toISOString() }));
    await batch.commit();
    updateStoredLeague(leagueCode, { members: (target.members || []).filter(m => m.uid !== memberUid) });
    toast('@' + (handle || 'punter') + ' thrown out of league.');
  } catch (e) {
    console.warn('Kick error:', e);
    toast('Could not remove @' + (handle || 'punter') + '. Check your connection and try again.');
  }
  render();
}

async function leaveLeague(leagueId, leagueCode) {
  const target = getStoredLeagues().find(l => l.id === leagueId || l.code === leagueCode);
  const name = target ? target.name : 'this league';
  if (!confirm('Are you sure you want to leave ' + name + '?\nYour stats will be removed from this leaderboard.')) return;

  const user = getAuthUser();
  // Stop listening first so our own record disappearing is not mistaken for a kick.
  if (currentLeagueListeningCode === leagueCode) stopLeagueListeners();
  if (firestoreDb && leagueCode && user && user.uid) {
    toast('Leaving league...');
    try {
      const { memberRef, membershipRef } = leagueRefs(leagueCode, user.uid);
      await memberRef.delete();
      await membershipRef.delete();
    } catch (e) {
      console.warn('Leave league notice:', e);
      toast('Could not leave the league. Check your connection and try again.');
      return;
    }
  }
  saveStoredLeagues(getStoredLeagues().filter(l => l.id !== leagueId && l.code !== leagueCode));
  activeLeagueId = 'default';
  toast('You left ' + name + '.');
  render();
}

// Deletes every member and ban record first (the creator may do that while the league still
// exists), then the league itself. Other members' devices drop it on their next sync.
async function deleteLeague(leagueId, leagueCode) {
  const target = getStoredLeagues().find(l => l.id === leagueId || l.code === leagueCode);
  const name = target ? target.name : 'this league';
  const user = getAuthUser();

  if (!target || !user || target.creatorUid !== user.uid) {
    return leaveLeague(leagueId, leagueCode);
  }
  if (!confirm('Are you sure you want to permanently delete ' + name + '?\nThis will remove the league for all members.')) return;
  if (!firestoreDb) return;

  toast('Deleting league...');
  if (currentLeagueListeningCode === leagueCode) stopLeagueListeners();
  try {
    const { leagueRef, membershipRef } = leagueRefs(leagueCode, user.uid);
    const [membersSnap, bannedSnap] = await Promise.all([leagueRef.collection('members').get(), leagueRef.collection('banned').get()]);
    const refs = membersSnap.docs.map(d => d.ref).concat(bannedSnap.docs.map(d => d.ref));
    for (let i = 0; i < refs.length; i += 400) {
      const batch = firestoreDb.batch();
      refs.slice(i, i + 400).forEach(r => batch.delete(r));
      await batch.commit();
    }
    const batch = firestoreDb.batch();
    batch.delete(leagueRef);
    batch.delete(membershipRef);
    await batch.commit();
  } catch (e) {
    console.warn('Cloud league delete notice:', e);
    toast('Could not delete the league. Check your connection and try again.');
    return;
  }

  saveStoredLeagues(getStoredLeagues().filter(l => l.id !== leagueId && l.code !== leagueCode));
  activeLeagueId = 'default';
  toast('League deleted.');
  render();
}

// Refreshes this player's gamertag and avatar in a league (their stats are written by the server).
// It only ever updates an existing member record: joining happens in joinCloudLeague and creating
// in publishLeague.
const leagueSyncInFlight = new Map();
async function syncLeagueToCloud(league) {
  if (!firestoreDb || !league || !league.code) return;
  const user = getAuthUser();
  if (!user || !user.signedIn || !user.emailVerified) return;
  const code = league.code;
  if (leagueSyncInFlight.has(code)) {
    leagueSyncInFlight.set(code, true);  // run once more when the current sync finishes
    return;
  }
  leagueSyncInFlight.set(code, false);
  try {
    const isCreator = !league.is_joined && (!league.creatorUid || league.creatorUid === user.uid);
    if (!league.cloudCreated && isCreator) {
      await publishLeague(league, user);
    } else {
      const prof = getUserProfile();
      const { memberRef } = leagueRefs(code, user.uid);
      await memberRef.update(leagueDocs.memberProfileUpdate({ handle: prof.handle, avatar: prof.avatar, now: new Date().toISOString() }));
    }
  } catch (err) {
    if (!(err && (err.code === 'not-found' || err.code === 'permission-denied') && await confirmLeagueGone(code, user.uid))) {
      console.warn('syncLeagueToCloud notice:', err);
    }
  } finally {
    const again = leagueSyncInFlight.get(code);
    leagueSyncInFlight.delete(code);
    if (again) {
      const fresh = getStoredLeagues().find(l => l.code === code);
      if (fresh) syncLeagueToCloud(fresh);
    }
  }
}

// Makes this device's league list match the player's leagues in the cloud: adds leagues joined
// elsewhere and drops ones that were deleted, left or kicked from.
let hasSyncedUserLeagues = false;
async function syncUserLeaguesFromCloud() {
  if (!firestoreDb || hasSyncedUserLeagues) return;
  const user = getAuthUser();
  if (!user || !user.signedIn || !user.emailVerified) return;
  hasSyncedUserLeagues = true;

  try {
    const membershipsSnap = await firestoreDb.collection('users').doc(user.uid).collection('leagueMemberships').get();
    const cloudCodes = new Set();

    for (const mDoc of membershipsSnap.docs) {
      const code = (mDoc.data() || {}).code || mDoc.id;
      try {
        const { leagueRef } = leagueRefs(code, user.uid);
        const leagueDoc = await leagueRef.get();
        if (!leagueDoc.exists) {
          await mDoc.ref.delete().catch(() => {});
          forgetLeagueLocally(code);
          continue;
        }
        const lData = leagueDoc.data() || {};
        const membersSnap = await leagueRef.collection('members').get();
        const membersList = membersSnap.docs.map(d => ({ ...d.data(), uid: d.id }));
        if (!membersList.some(m => m.uid === user.uid)) {
          await mDoc.ref.delete().catch(() => {});
          forgetLeagueLocally(code);
          continue;
        }
        cloudCodes.add(code);
        const isCreator = lData.creatorUid === user.uid;
        const fields = {
          name: lData.name || ('Buddy League (' + code + ')'),
          icon: lData.icon || '⚽',
          freq: lData.freq || 'weekly',
          creatorUid: lData.creatorUid,
          creatorHandle: lData.creatorHandle || 'Creator',
          is_joined: !isCreator,
          cloudCreated: true,
          members: membersList.filter(m => isRealMember(m) && m.uid !== user.uid)
        };
        if (!updateStoredLeague(code, fields)) {
          const list = getStoredLeagues();
          list.push(Object.assign({
            id: 'league-' + code,
            code,
            created_at: typeof lData.createdAt === 'string' ? lData.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
          }, fields));
          saveStoredLeagues(list);
        }
      } catch (lErr) {
        cloudCodes.add(code);  // unknown state: keep the league rather than lose it
        console.warn('Error fetching league ' + code, lErr);
      }
    }

    // Leagues confirmed in the cloud before but no longer in the player's index were left on another device.
    getStoredLeagues().filter(l => l.cloudCreated && !cloudCodes.has(l.code)).forEach(l => forgetLeagueLocally(l.code));
    // Leagues that so far only exist on this device are published (creator) or checked (joined).
    getStoredLeagues().filter(l => !l.cloudCreated).forEach(l => syncLeagueToCloud(l));
    render();
  } catch (e) {
    hasSyncedUserLeagues = false;
    console.warn('syncUserLeaguesFromCloud notice:', e);
  }
}

// Live league updates redraw at most a few times a second, and only while Leagues (or, for
// league-bet updates, the Bet Diary) is on screen.
let leaguesRenderTimer = null;
let leaguesRenderDiary = false;
function scheduleLeaguesRender(alsoDiary) {
  if (alsoDiary) leaguesRenderDiary = true;
  if (leaguesRenderTimer) return;
  leaguesRenderTimer = setTimeout(() => {
    leaguesRenderTimer = null;
    const view = currentRoute()[0];
    if (view === 'leagues' || (leaguesRenderDiary && view === 'diary')) render();
    leaguesRenderDiary = false;
  }, 300);
}

let currentLeagueListeningCode = null;
function stopLeagueListeners() {
  if (activeLeagueUnsubscribe) { try { activeLeagueUnsubscribe(); } catch (e) {} }
  if (activeMembersUnsubscribe) { try { activeMembersUnsubscribe(); } catch (e) {} }
  activeLeagueUnsubscribe = null;
  activeMembersUnsubscribe = null;
  currentLeagueListeningCode = null;
}

function listenToActiveLeague(code) {
  if (!firestoreDb || !code) return;
  const user = getAuthUser();
  if (!user || !user.signedIn || !user.emailVerified) return;

  if (currentLeagueListeningCode === code && activeLeagueUnsubscribe) return;
  stopLeagueListeners();
  currentLeagueListeningCode = code;

  try {
    const leagueRef = firestoreDb.collection('leagues').doc(code);
    activeLeagueUnsubscribe = leagueRef.onSnapshot(doc => {
      const target = getStoredLeagues().find(l => l.code === code);
      if (!doc || !doc.exists) {
        // Only a league known to have been in the cloud can have been deleted.
        if (target && target.cloudCreated && !doc.metadata.fromCache) {
          leagueRefs(code, user.uid).membershipRef.delete().catch(() => {});
          stopLeagueListeners();
          forgetLeagueLocally(code, 'This league was deleted by the creator.');
        }
        return;
      }
      const data = doc.data() || {};
      const changes = {};
      if (data.name) changes.name = data.name;
      if (data.icon) changes.icon = data.icon;
      if (data.creatorUid) changes.creatorUid = data.creatorUid;
      if (data.creatorHandle) changes.creatorHandle = data.creatorHandle;
      if (updateStoredLeague(code, changes)) scheduleLeaguesRender();
    }, err => console.warn('League listener notice:', err));

    activeMembersUnsubscribe = leagueRef.collection('members').onSnapshot(snap => {
      const target = getStoredLeagues().find(l => l.code === code);
      if (!target || !snap) return;
      const membersList = snap.docs.map(d => ({ ...d.data(), uid: d.id }));
      // Our own record vanishing means we were kicked (or left on another device): double-check, then drop it.
      if (target.cloudCreated && !snap.metadata.fromCache && !snap.metadata.hasPendingWrites && !membersList.some(m => m.uid === user.uid)) {
        confirmLeagueGone(code, user.uid).then(gone => { if (gone) stopLeagueListeners(); });
      }
      updateStoredLeague(code, { members: membersList.filter(m => isRealMember(m) && m.uid !== user.uid) });
      scheduleLeaguesRender();
    }, err => console.warn('Members listener notice:', err));
  } catch (e) {
    console.warn('listenToActiveLeague error:', e);
  }
}

const LEAGUE_CODE_RE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;
const leagueJoinsInFlight = new Set();
async function joinCloudLeague(code) {
  if (!code) return;
  const user = getAuthUser();
  if (!user || !user.signedIn || !currentAuthUser) {
    // Not signed in, or Firebase is still restoring the session: join once sign-in completes.
    sessionStorage.setItem('betbuddy_pending_join_league', code);
    if (!user || !user.signedIn) {
      toast('Sign in with Google to join leagues and compete with mates');
      openAuthModal();
    }
    return;
  }
  code = String(code).trim().toUpperCase();
  if (!LEAGUE_CODE_RE.test(code)) {
    toast('League codes are 8 letters and numbers. Please check the code.');
    return;
  }
  if (!firestoreDb || leagueJoinsInFlight.has(code)) return;
  leagueJoinsInFlight.add(code);

  try {
    const { leagueRef, memberRef, membershipRef } = leagueRefs(code, user.uid);
    const snap = await leagueRef.get();
    if (!snap.exists) {
      toast('League ' + code + ' not found. Please check code.');
      return;
    }
    const leagueData = snap.data() || {};
    const membersSnap = await leagueRef.collection('members').get();
    const membersList = membersSnap.docs.map(d => ({ ...d.data(), uid: d.id }));
    const alreadyMember = membersList.some(m => m.uid === user.uid);
    if (!alreadyMember && membersList.length >= leagueDocs.MAX_LEAGUE_MEMBERS) {
      toast('This league is full (' + leagueDocs.MAX_LEAGUE_MEMBERS + ' players). Ask the creator to make room, or start your own.');
      return;
    }
    const isCreator = leagueData.creatorUid === user.uid;
    const prof = getUserProfile();
    const nowIso = new Date().toISOString();
    const memberData = { handle: prof.handle, avatar: prof.avatar, now: nowIso };

    const batch = firestoreDb.batch();
    if (alreadyMember) batch.update(memberRef, leagueDocs.memberProfileUpdate(memberData));
    else batch.set(memberRef, leagueDocs.newMemberDoc(memberData));
    batch.set(membershipRef, leagueDocs.membershipDoc({ code, name: leagueData.name, icon: leagueData.icon, role: isCreator ? 'creator' : 'member', now: nowIso }));
    try {
      await batch.commit();
    } catch (e) {
      if (e && e.code === 'permission-denied') {
        const banned = await leagueRef.collection('banned').doc(user.uid).get().catch(() => null);
        toast(banned && banned.exists ? 'The creator has removed you from this league.' : 'Could not join this league.');
        return;
      }
      throw e;
    }

    const fields = {
      name: leagueData.name || ('Buddy League (' + code + ')'),
      icon: leagueData.icon || '⚽',
      freq: leagueData.freq || 'weekly',
      creatorUid: leagueData.creatorUid || null,
      creatorHandle: leagueData.creatorHandle || null,
      is_joined: !isCreator,
      cloudCreated: true,
      members: membersList.filter(m => isRealMember(m) && m.uid !== user.uid)
    };
    let league = updateStoredLeague(code, fields);
    if (!league) {
      league = Object.assign({
        id: 'league-' + code,
        code,
        created_at: typeof leagueData.createdAt === 'string' ? leagueData.createdAt.slice(0, 10) : nowIso.slice(0, 10)
      }, fields);
      const list = getStoredLeagues();
      list.push(league);
      saveStoredLeagues(list);
    }
    activeLeagueId = league.id;
    listenToActiveLeague(code);
    toast('Joined ' + fields.name + '! ⚽');
    render();
  } catch (e) {
    console.warn('Join cloud league notice:', e);
    toast('Could not connect to cloud league: ' + (e.message || 'Error'));
  } finally {
    leagueJoinsInFlight.delete(code);
  }
}

// Bet Diary cloud copy: users/{uid}/diary/{betId}. Only new, changed and deleted entries are
// written (in batches under Firestore's 500-write limit), so saves stay cheap however big the diary.
const DIARY_SYNCED_PREFIX = 'betbuddy_diary_synced_v1_';
function getDiarySynced(uid) {
  try { return JSON.parse(localStorage.getItem(DIARY_SYNCED_PREFIX + uid) || '{}') || {}; } catch (e) { return {}; }
}
function saveDiarySynced(uid, map) {
  try { localStorage.setItem(DIARY_SYNCED_PREFIX + uid, JSON.stringify(map)); } catch (e) { /* ignore */ }
}

let diaryPushTimer = null;
let diaryPushRunning = false;
let diaryPushAgain = false;
function syncDiaryToCloud() {
  // Rapid saves (auto-settling several bets, editing) are combined into one push.
  clearTimeout(diaryPushTimer);
  diaryPushTimer = setTimeout(pushDiaryToCloud, 1500);
}

async function pushDiaryToCloud() {
  if (!firestoreDb || !currentAuthUser || diaryReadFailed) return;
  if (diaryPushRunning) { diaryPushAgain = true; return; }
  diaryPushRunning = true;
  const uid = currentAuthUser.uid;
  try {
    const synced = getDiarySynced(uid);
    const { upserts, deletes } = leagueDocs.planDiaryPush(getStoredDiary(), synced);
    const col = firestoreDb.collection('users').doc(uid).collection('diary');
    const ops = upserts.map(e => ({ id: String(e.id), entry: e })).concat(deletes.map(id => ({ id, entry: null })));
    for (let i = 0; i < ops.length; i += 400) {
      const chunk = ops.slice(i, i + 400);
      const batch = firestoreDb.batch();
      chunk.forEach(op => op.entry ? batch.set(col.doc(op.id), JSON.parse(JSON.stringify(op.entry))) : batch.delete(col.doc(op.id)));
      await batch.commit();
      chunk.forEach(op => { if (op.entry) synced[op.id] = leagueDocs.diaryFingerprint(op.entry); else delete synced[op.id]; });
      saveDiarySynced(uid, synced);
    }
  } catch (e) {
    console.warn('syncDiaryToCloud notice:', e);
  } finally {
    diaryPushRunning = false;
    if (diaryPushAgain) { diaryPushAgain = false; syncDiaryToCloud(); }
  }
}

async function syncDiaryFromCloud() {
  if (!firestoreDb || !currentAuthUser || diaryReadFailed) return;
  const uid = currentAuthUser.uid;
  try {
    const snap = await firestoreDb.collection('users').doc(uid).collection('diary').get();
    const remote = snap.docs.map(d => d.data()).filter(e => e && e.id != null);
    const merged = leagueDocs.mergeDiaryFromCloud(getStoredDiary(), remote, getDiarySynced(uid));
    saveDiarySynced(uid, merged.synced);
    if (merged.changed) {
      saveStoredDiary(merged.entries);  // also pushes anything only this device has
      render();
    } else {
      syncDiaryToCloud();
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
  const activeUser = currentAuthUser || cachedAuthUser;
  if (activeUser && (activeUser.displayName || activeUser.handle || activeUser.email)) {
    let h = String(activeUser.handle || activeUser.displayName || toUsername('', activeUser.email)).replace(/^@+/, '');
    if (/^Punter_\d*$/i.test(h)) h = toUsername(activeUser.displayName || activeUser.name, activeUser.email);  // never show a placeholder handle
    if (h && !h.startsWith('Punter_')) {
      try {
        const p = JSON.parse(localStorage.getItem(USER_PROFILE_KEY) || 'null');
        if (p) {
          return {
            handle: h,
            avatar: p.avatar || '⚽',
            town: p.town || '',
            region: p.region || '',
            country: p.country || ''
          };
        }
      } catch (e) {}
      return {
        handle: h,
        avatar: '⚽',
        town: '',
        region: '',
        country: ''
      };
    }
  }
  try {
    const p = JSON.parse(localStorage.getItem(USER_PROFILE_KEY) || 'null');
    if (p && p.handle && /^Punter_\d*$/i.test(String(p.handle))) {
      localStorage.removeItem(USER_PROFILE_KEY);  // legacy placeholder profile
    } else if (p && p.handle) {
      return {
        handle: p.handle,
        avatar: p.avatar || '⚽',
        town: p.town || '',
        region: p.region || '',
        country: p.country || ''
      };
    }
  } catch (e) { /* ignore */ }
  // Signed-out visitors get a transient, never-saved profile: no fake handle is ever created.
  const defaultProfile = {
    handle: 'Guest',
    avatar: '⚽',
    town: '',
    region: '',
    country: ''
  };
  return defaultProfile;
}

function saveUserProfile(handle, town, region, country) {
  const clean = (handle || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'Punter';
  const prof = {
    ...getUserProfile(),
    handle: clean,
    town: leagueDocs.cleanPlace(town),
    region: leagueDocs.cleanPlace(region),
    country: leagueDocs.cleanPlace(country)
  };
  try { localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(prof)); } catch (e) { /* ignore */ }
  return prof;
}

// ------------------------------------------------------------ Server-scored league stats & league bets
// League points are calculated by the server (functions/) from league bets it has checked and
// settled. The app listens to this player's stats (leagueStats/{uid}) and recent league bets.
let myLeagueStats = null;
const myLeagueBets = new Map();  // match day (YYYY-MM-DD) -> server record of that day's league bet
let myLeagueUnsubs = [];
function stopMyLeagueListeners() {
  myLeagueUnsubs.forEach(u => { try { u(); } catch (e) { /* ignore */ } });
  myLeagueUnsubs = [];
  myLeagueStats = null;
  myLeagueBets.clear();
}
function listenToMyLeagueData(uid) {
  stopMyLeagueListeners();
  if (!firestoreDb || !uid) return;
  try {
    myLeagueUnsubs.push(firestoreDb.collection('leagueStats').doc(uid).onSnapshot(doc => {
      myLeagueStats = doc && doc.exists ? Object.assign({ serverScored: true }, doc.data()) : null;
      scheduleLeaguesRender();
    }, err => console.warn('League stats listener notice:', err)));
    const since = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    myLeagueUnsubs.push(firestoreDb.collection('users').doc(uid).collection('leagueBets')
      .where(firebase.firestore.FieldPath.documentId(), '>=', since).onSnapshot(snap => {
        myLeagueBets.clear();
        snap.docs.forEach(d => myLeagueBets.set(d.id, Object.assign({ day: d.id }, d.data())));
        if (['diary', 'leagues'].includes(currentRoute()[0])) scheduleLeaguesRender(true);
      }, err => console.warn('League bets listener notice:', err)));
  } catch (e) {
    console.warn('listenToMyLeagueData notice:', e);
  }
}

// This player's server-scored stats for one period (zeros until the server has scored a bet).
function getUserLeagueStats(freq = 'weekly', now = new Date()) {
  return leagueDocs.memberStatsFor(myLeagueStats, freq, leagueDocs.currentPeriodKey(freq, now));
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
      name: (profile.country || 'Your Country') + ' Championship',
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
      name: (profile.region || 'Your Region') + ' Regional',
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
      name: (profile.town || 'Your Hometown') + ' League',
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

// ------------------------------------------------------------ Regional ladders
// Built by the league server every 30 minutes: ladders/{period}__{tier} holds the top 50.
function ladderSlug(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
// The server's ladder id for a geo tier, or null when the player has not set that part of their location.
function ladderTierId(geoTierId, prof) {
  if (geoTierId === 'geo-world') return 'world';
  if (geoTierId === 'geo-europe') return 'europe';
  if (geoTierId === 'geo-uk') return 'uk';
  const part = { 'geo-country': 'country', 'geo-region': 'region', 'geo-town': 'town' }[geoTierId];
  return part && ladderSlug(prof[part]) ? part + '-' + ladderSlug(prof[part]) : null;
}
const ladderCache = new Map();  // ladder id -> { at, data (null when nobody is on it yet), loading }
function getLadder(id) {
  const hit = ladderCache.get(id);
  if (firestoreDb && (!hit || (!hit.loading && Date.now() - hit.at > 5 * 60000))) {
    ladderCache.set(id, Object.assign({}, hit, { loading: true }));
    firestoreDb.collection('ladders').doc(id).get().then(doc => {
      ladderCache.set(id, { at: Date.now(), data: doc.exists ? doc.data() : null, loading: false });
      scheduleLeaguesRender();
    }).catch(err => {
      console.warn('Ladder load notice:', err);
      ladderCache.set(id, { at: Date.now(), data: hit ? hit.data : null, loading: false, failed: true });
      scheduleLeaguesRender();
    });
  }
  return hit && 'data' in hit ? hit.data : undefined;
}

/* Illustrative examples for empty states. Everything here is invented and labelled SAMPLE: no real people, matches or results. */
function sampleBadge() { return '<span class="sample-badge">Sample</span>'; }
function sampleLeaderboard() {
  const rows = [['1', 'SampleSam', 'Hometown', 142, '+6'], ['2', 'ExampleEmma', 'Hometown', 131, '+2'], ['3', 'DemoDave', 'Hometown', 127, '-1'], ['4', 'You (after joining)', 'Hometown', 0, '']];
  return '<div class="sample-box" role="group" aria-label="Sample leaderboard, not real users">' +
    '<div class="sample-head"><h2 class="section-title">What a league looks like</h2>' + sampleBadge() + '</div>' +
    '<p class="section-note">Example weekly table with invented names and points, to show how ranking and promotion work. Leagues use pretend picks, not real money.</p>' +
    '<div class="sample-table" role="table" aria-label="Sample weekly league table">' +
      '<div class="sample-row sample-row-h" role="row"><span role="columnheader">#</span><span role="columnheader">Player</span><span role="columnheader" class="num">Pts</span><span role="columnheader" class="num">Week</span></div>' +
      rows.map(r => '<div class="sample-row' + (r[0] === '4' ? ' sample-row-you' : '') + '" role="row"><span role="cell" class="mono">' + r[0] + '</span><span role="cell">' + esc(r[1]) + '<small>' + esc(r[2]) + (r[0] === '1' ? ' &middot; promoted to County' : '') + '</small></span><span role="cell" class="num mono">' + (r[3] || '&ndash;') + '</span><span role="cell" class="num mono">' + esc(r[4] || '&ndash;') + '</span></div>').join('') +
    '</div>' +
    '<p class="sample-foot">Top finishers each week move up the ladder: Hometown, County, Region, Nation, UK, Global.</p>' +
  '</div>';
}
function sampleDiaryBet() {
  return '<div class="sample-box" role="group" aria-label="Sample diary entry, not a real bet">' +
    '<div class="sample-head"><h2 class="section-title">What a settled bet looks like</h2>' + sampleBadge() + '</div>' +
    '<p class="section-note">An invented example. Nothing here is a real match, price or result.</p>' +
    '<div class="sample-bet">' +
      '<div class="sample-bet-top"><b>Example FC v Sample United</b><span class="badge validated">Won</span></div>' +
      '<div class="sample-bet-sub">Match result &middot; Example FC to win</div>' +
      '<dl class="sample-stats">' +
        '<div><dt>Stake</dt><dd class="mono">&pound;10.00</dd></div>' +
        '<div><dt>Price taken</dt><dd class="mono">2.10</dd></div>' +
        '<div><dt>Returned</dt><dd class="mono">&pound;21.00</dd></div>' +
        '<div><dt>Profit</dt><dd class="mono pos">+&pound;11.00</dd></div>' +
      '</dl>' +
      '<p class="sample-foot">Recording the price you actually took lets the Diary work out true profit and show whether you beat the price the market settled on.</p>' +
    '</div>' +
  '</div>';
}

function viewLeagues() {
  const prof = getUserProfile();
  const authUser = getAuthUser();
  const isUserSignedIn = Boolean(authUser && authUser.signedIn);
  if (!isUserSignedIn) {
    const googleBtn = '<button type="button" class="btn google-primary-btn" onclick="signInWithGoogle()" style="margin:0 auto;min-height:46px;display:inline-flex;align-items:center;gap:10px;padding:0 24px;">' +
          '<svg class="google-g" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>' +
          '<span>Continue with Google</span>' +
        '</button>';
    const pod = [['🥈', 'ExampleEmma', 131, 'p2'], ['🥇', 'SampleSam', 142, 'p1'], ['🥉', 'DemoDave', 127, 'p3']];
    return '<section class="view lg-view lg-out">' +
      '<div class="lg-welcome">' +
        '<div class="lg-cup" aria-hidden="true">🏆</div>' +
        '<h1 class="lg-title">Beat your mates.<br>Climb the ladders.</h1>' +
        '<p class="lg-lead">One pick a day, points for every winner. Free, and no money changes hands.</p>' +
        googleBtn.replace('class="btn google-primary-btn"', 'class="btn google-primary-btn lg-google"') +
        '<p class="lg-fine">Sign in with Google to join leagues and compete with mates. Got an invite code? Sign in and it is one tap to join.</p>' +
      '</div>' +
      '<ol class="lg-steps">' +
        '<li><span>⚽</span><b>Pick one bet a day</b><small>Any football result, goals or both-teams-to-score bet</small></li>' +
        '<li><span>🎯</span><b>Score points</b><small>An Evens winner is 10 pts</small></li>' +
        '<li><span>🥇</span><b>Win silverware</b><small>Weekly, monthly and season</small></li>' +
      '</ol>' +
      '<div class="lg-preview" role="group" aria-label="Sample league, invented names">' +
        '<div class="lg-preview-head"><span>This week’s podium</span>' + sampleBadge() + '</div>' +
        '<div class="lg-podium">' + pod.map(x => '<div class="pod ' + x[3] + '"><span class="pod-medal">' + x[0] + '</span><span class="pod-name">' + x[1] + '</span><span class="pod-pts">' + x[2] + ' pts</span><span class="pod-block"></span></div>').join('') + '</div>' +
        '<div class="lg-ladder-line" aria-label="Six automatic ladders"><span>🏘️ Town</span><i>›</i><span>🏛️ County</span><i>›</i><span>🏴 Country</span><i>›</i><span>🇬🇧 UK</span><i>›</i><span>🇪🇺 Europe</span><i>›</i><span>🌍 World</span></div>' +
        '<p class="lg-fine">Your league picks count on all six local ladders automatically, plus any private leagues with mates.</p>' +
      '</div>' +
    '</section>';
  }

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
  const isLeagueCreator = !isGeo && currentLeague && (currentLeague.creatorUid ? currentLeague.creatorUid === authUser.uid : !currentLeague.is_joined);

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
  let ladderNotice = '';
  if (isGeo) {
    const tierId = ladderTierId(currentLeague.id, prof);
    const ladder = tierId ? getLadder(activeLeagueFreq + '__' + tierId) : null;
    const entries = (ladder && ladder.key === leagueDocs.currentPeriodKey(activeLeagueFreq) && ladder.entries) || [];
    allMembers = entries.map(e => Object.assign({}, e, e.uid === authUser.uid ? { isYou: true } : {}));
    // Always list the player on a ladder their location puts them on, even before their first settled league bet.
    if (tierId && !allMembers.some(m => m.isYou)) allMembers.push(Object.assign({}, userEntry, { outsideTop: true, unranked: !(uStats.settled > 0) }));
    if (!tierId) {
      ladderNotice = 'Add your ' + ({ 'geo-country': 'country', 'geo-region': 'region', 'geo-town': 'town' }[currentLeague.id]) + ' to your profile to join this ladder. <a href="#/more" data-select-more-tab="account" style="color:var(--cyan)">Edit profile &rarr;</a>';
    } else if (ladder === undefined) {
      ladderNotice = 'Loading the ladder…';
    } else if (!entries.length) {
      ladderNotice = 'Nobody has a settled league bet on this ladder yet this ' + (activeLeagueFreq === 'weekly' ? 'week' : activeLeagueFreq === 'monthly' ? 'month' : 'season') + '. Log a league bet before kick-off; you are ranked here once it settles.';
    } else {
      ladderNotice = 'Top ' + entries.length + ' of ' + ladder.total + ' players · updated every 30 minutes.';
    }
  } else {
    // One row per account (uid), never merged by gamertag. Each member shows their numbers for
    // the selected period, or zero if they have not refreshed since it reset.
    const currentKey = leagueDocs.currentPeriodKey(activeLeagueFreq);
    const memberMap = new Map();
    (currentLeague.members || []).forEach(m => {
      if (isRealMember(m) && m.uid !== authUser.uid) {
        memberMap.set(m.uid, Object.assign({}, leagueDocs.memberStatsFor(m, activeLeagueFreq, currentKey, currentLeague.freq), { uid: m.uid, handle: m.handle }));
      }
    });
    allMembers = Array.from(memberMap.values()).concat(userEntry);
  }

  // OPTION A SCORING RANK:
  // Primary: Points (odds-weighted)
  // Secondary: Win Rate %
  // Tie-breaker: ROI %
  // Anyone with no settled bet sits below everyone who has bet (even a loser on negative points) and shows dashes.
  const hasNoBets = m => !(Number(m.settled) > 0);
  allMembers.sort((a, b) => (Number(!!a.outsideTop) - Number(!!b.outsideTop)) || (Number(hasNoBets(a)) - Number(hasNoBets(b))) || (b.points - a.points) || (b.winRate - a.winRate) || (b.roi - a.roi));

  const rowsHtml = allMembers.map((m, idx) => {
    const rank = idx + 1;
    const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'standard';
    const noBets = hasNoBets(m);
    const rankIcon = (m.unranked || noBets) ? '—' : m.outsideTop ? '50+' : rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const formChips = (m.form || ['—']).map(f => f === '—' ? '<span class="dim">—</span>' : '<span class="form-chip ' + f.toLowerCase() + '">' + f + '</span>').join('');
    const roiSign = m.roi > 0 ? '+' : '';
    const roiClass = m.roi > 0 ? 'pos' : m.roi < 0 ? 'neg' : '';
    const formStr = (m.form || []).join(' · ');
    const memberId = 'mem-form-' + idx;
    const kickCell = m.isYou
      ? '<td class="lb-col-action"></td>'
      : !isLeagueCreator || !m.uid
      ? '<td class="lb-col-action"></td>'
      : '<td class="lb-col-action"><button type="button" class="kick-player-btn" data-kick-player="' + esc(m.handle) + '" data-kick-uid="' + esc(m.uid || '') + '" data-league-code="' + esc(currentLeague.code) + '" title="Throw @' + esc(m.handle) + ' out of this league" aria-label="Remove @' + esc(m.handle) + ' from this league">✕</button></td>';

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
      '<td class="lb-col-pts"><b class="lb-pts-val">' + (noBets ? '—' : m.points) + '</b></td>' +
      '<td class="lb-col-win">' + (noBets ? '<span class="dim">—</span>' : '<span class="win-pct-pill">' + m.winRate + '%</span>') + '</td>' +
      '<td class="lb-col-roi">' + (noBets ? '<span class="dim">—</span>' : '<span class="roi-pct-pill ' + roiClass + '">' + roiSign + m.roi + '%</span>') + '</td>' +
      '<td class="lb-col-bets num mono">' + m.settled + '</td>' +
      kickCell +
    '</tr>';
  }).join('');

  const leagueTitle = esc(typeof currentLeague.name === 'function' ? currentLeague.name() : currentLeague.name);
  const trophyTitle = esc(currentLeague.trophyName || (currentLeague.name + ' Silverware'));
  const trophyIcon = esc(currentLeague.trophyIcon || currentLeague.icon || '🏆');
  const periodWord = activeLeagueFreq === 'weekly' ? 'this week' : activeLeagueFreq === 'monthly' ? 'this month' : 'this season';

  // Your private leagues as cards, then the create / join cards.
  const leagueCards = customLeagues.map(l => {
    const memCount = (l.members ? l.members.length : 0) + 1;
    return '<button type="button" class="lg-card' + (l.id === activeLeagueId ? ' on' : '') + '" data-select-league="' + esc(l.id) + '">' +
      '<span class="lg-card-ico">' + esc(l.icon || '👥') + '</span><b>' + esc(l.name) + '</b><small>' + memCount + (memCount === 1 ? ' player' : ' players') + '</small></button>';
  }).join('') +
    '<button type="button" class="lg-card lg-card-add" data-open-league-modal="create"><span class="lg-card-ico">＋</span><b>New league</b><small>Invite your mates</small></button>' +
    '<button type="button" class="lg-card lg-card-add" data-open-league-modal="join"><span class="lg-card-ico">🔑</span><b>Join with code</b><small>Got an invite?</small></button>';

  // The six automatic ladders, closest to home first.
  const shortTier = { 'geo-town': 'Town', 'geo-region': 'County', 'geo-country': 'Country', 'geo-uk': 'UK', 'geo-europe': 'Europe', 'geo-world': 'World' };
  const ladderChips = geoTiers.slice().reverse().map(t => {
    const joined = Boolean(ladderTierId(t.id, prof));
    return '<button type="button" class="lg-ladder' + (t.id === activeLeagueId ? ' on' : '') + (joined ? '' : ' off') + '" data-select-league="' + t.id + '" title="' + esc(typeof t.name === 'function' ? t.name() : t.name) + '">' +
      '<span>' + t.icon + '</span>' + esc(shortTier[t.id] || t.name) + (joined ? '' : ' <small>add location</small>') + '</button>';
  }).join('');

  // Podium: the top three who have a settled bet this period.
  const podSrc = allMembers.filter(m => !hasNoBets(m) && !m.outsideTop).slice(0, 3);
  const podOrder = [[1, '🥈', 'p2'], [0, '🥇', 'p1'], [2, '🥉', 'p3']].filter(x => podSrc[x[0]]);
  const podium = podSrc.length ? '<div class="lg-podium">' + podOrder.map(([i, medal, cls]) => {
    const m = podSrc[i];
    return '<div class="pod ' + cls + (m.isYou ? ' you' : '') + '"><span class="pod-medal">' + medal + '</span><span class="pod-name">' + esc(m.handle) + (m.isYou ? ' (you)' : '') + '</span><span class="pod-pts">' + m.points + ' pts</span><span class="pod-block"></span></div>';
  }).join('') + '</div>' : '<div class="lg-empty">No settled league bets ' + periodWord + ' yet. Log one before kick-off and you are on the board.</div>';

  const periodSeg = '<div class="seg lg-period" role="group" aria-label="Table period">' +
    [['weekly', 'Week'], ['monthly', 'Month'], ['yearly', 'Season']].map(([k, l]) => '<button type="button" class="freq-btn' + (activeLeagueFreq === k ? ' active' : '') + '" aria-pressed="' + (activeLeagueFreq === k) + '" data-league-freq="' + k + '">' + l + '</button>').join('') + '</div>';

  const table = allMembers.length ? '<div class="lb-table-wrap"><table class="lb-table compact-lb"><thead><tr>' +
      '<th class="lb-col-rank">#</th><th class="lb-col-player">Player</th><th class="lb-col-pts">Pts</th><th class="lb-col-win">Win %</th><th class="lb-col-roi">ROI</th><th class="lb-col-bets num">Bets</th><th class="lb-col-action"></th>' +
    '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>' : '';

  const board = '<section class="lg-board">' +
    '<div class="lg-board-head"><div class="lg-board-title"><span class="lg-board-ico">' + esc(isGeo ? currentLeague.icon : (currentLeague.icon || '👥')) + '</span><div><h2>' + leagueTitle +
      (!isGeo && isLeagueCreator ? ' <button type="button" class="lg-mini" data-rename-league="' + esc(currentLeague.code) + '" title="Rename this league">✏️</button>' : '') + '</h2>' +
      '<small>' + trophyIcon + ' ' + trophyTitle + ' · top 3 win medals</small></div></div>' + periodSeg + '</div>' +
    (isGeo ? '<p class="lg-notice">' + ladderNotice + '</p>' : '') +
    podium + table +
    (!isGeo ? '<div class="lg-board-foot"><button type="button" class="btn primary" data-share-league="' + esc(currentLeague.code) + '">Invite friends</button>' +
      (isLeagueCreator
        ? '<button type="button" class="lg-quiet danger" data-delete-league="' + esc(currentLeague.id) + '" data-league-code="' + esc(currentLeague.code) + '">Delete league</button>'
        : '<button type="button" class="lg-quiet" data-leave-league="' + esc(currentLeague.id) + '" data-league-code="' + esc(currentLeague.code) + '">Leave league</button>') + '</div>' : '') +
  '</section>';

  const me = '<div class="lg-me">' +
    '<span class="lg-me-avatar">' + esc(prof.avatar) + '</span>' +
    '<div class="lg-me-id"><b>@' + esc(prof.handle) + '</b><small>' + (prof.town || prof.region ? esc([prof.town, prof.region].filter(Boolean).join(', ')) : 'No location set') + ' · <a href="#/more" data-select-more-tab="account">Edit</a></small></div>' +
    '<div class="lg-me-stats"><span><b>' + uStats.points + '</b>pts</span><span><b>' + uStats.winRate + '%</b>wins</span><span><b>' + uStats.settled + '</b>bets</span></div>' +
    '<button type="button" class="lg-cabinet" data-open-trophy-cabinet title="Trophy cabinet">🏆<b>' + trophies.length + '</b></button>' +
  '</div>';

  return '<section class="view lg-view">' + locationPromptBanner() +
    '<h1 class="page-title">Leagues</h1>' + me +
    '<h2 class="lg-h">Your leagues</h2><div class="lg-cards">' + leagueCards + '</div>' +
    '<h2 class="lg-h">Local ladders <small>automatic, from your location</small></h2><div class="lg-ladders">' + ladderChips + '</div>' +
    board +
    '<p class="lg-rules">🛡️ <b>1 league bet a day</b>, logged before kick-off · a winner scores (price − 1) × 10, so Evens = 10 pts, capped at 100 · a loser −2 · <a href="#/guide">Full rules ›</a></p>' +
  '</section>';
}

// ---- Diary dashboard ----
let diaryRange = 'all', diaryBreak = 'type';
function setDiaryRange(r) { diaryRange = r; render(); }
function setDiaryBreak(b) { diaryBreak = b; render(); }
const diaryDay = e => String(e.date || (e.timestamp ? e.timestamp.slice(0, 10) : '') || '').slice(0, 10);
const diarySettleKey = e => String(e.settledAt || e.date || e.timestamp || '');
const diaryProfit = e => calc.calculateBetProfit(e.stake, e.odds, e.outcome);
const diarySigned = v => (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v));
function diaryInRange(list) {
  if (diaryRange === 'all') return list;
  const cut = Date.now() - Number(diaryRange) * 86400000;
  return list.filter(e => { const t = Date.parse(diarySettleKey(e).slice(0, 10)); return !Number.isFinite(t) || t >= cut - 86400000; });
}

function diaryHero(settled, live) {
  const pl = settled.reduce((t, e) => t + (diaryProfit(e) || 0), 0);
  const staked = settled.reduce((t, e) => t + (Number(e.stake) || 0), 0);
  const roi = staked > 0 ? pl / staked * 100 : 0;
  const ranges = [['all', 'All time'], ['30', '30 days'], ['7', '7 days']];
  let chart = '<div class="dy-chart-empty">Your profit line appears once two bets have settled.</div>';
  if (settled.length >= 2) {
    let cum = 0;
    const pts = [{ y: 0 }].concat(settled.map(e => { const p = diaryProfit(e) || 0; cum += p; return { y: cum, p, e }; }));
    const W = 640, H = 190, PX = 8, PY = 14;
    const lo = Math.min(0, ...pts.map(x => x.y)), hi = Math.max(0, ...pts.map(x => x.y)), span = (hi - lo) || 1;
    const X = i => PX + i / (pts.length - 1) * (W - 2 * PX), Y = v => PY + (hi - v) / span * (H - 2 * PY);
    const line = pts.map((x, i) => X(i).toFixed(1) + ',' + Y(x.y).toFixed(1)).join(' ');
    const up = cum >= 0, col = up ? 'var(--pick)' : '#fb7185';
    const dots = pts.length <= 80 ? '<div class="dy-dots">' + pts.slice(1).map((x, i) => '<span class="dy-dot ' + (x.p > 0 ? 'w' : x.p < 0 ? 'l' : 'v') + '" style="left:' + (X(i + 1) / W * 100).toFixed(2) + '%;top:' + (Y(x.y) / H * 100).toFixed(2) + '%" title="' + esc((x.e.selection || 'Bet').slice(0, 60) + ': ' + diarySigned(x.p)) + '"></span>').join('') + '</div>' : '';
    chart = '<div class="dy-chart-wrap"><svg class="dy-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Running profit after each settled bet, now ' + diarySigned(cum) + '">' +
      '<defs><linearGradient id="dyfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".38"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>' +
      '<line x1="0" x2="' + W + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" class="dy-zero"/>' +
      '<polygon points="' + line + ' ' + X(pts.length - 1).toFixed(1) + ',' + Y(lo).toFixed(1) + ' ' + X(0).toFixed(1) + ',' + Y(lo).toFixed(1) + '" fill="url(#dyfill)"/>' +
      '<polyline points="' + line + '" class="dy-line" style="stroke:' + col + '" pathLength="1"/>' +
    '</svg>' + dots + '</div><div class="dy-chart-axis"><span>Start</span><span>' + settled.length + ' settled bets</span><span>Now</span></div>';
  }
  return '<section class="dy-hero ' + (pl > 0 ? 'up' : pl < 0 ? 'down' : '') + '">' +
    '<div class="dy-hero-top"><div><div class="dy-kicker">Profit / loss</div><div class="dy-big">' + diarySigned(pl) + '</div>' +
      '<div class="dy-sub">from ' + settled.length + ' settled bet' + (settled.length === 1 ? '' : 's') + ' · ' + money(staked) + ' staked' + (live.length ? ' · ' + live.length + ' waiting' : '') + '</div></div>' +
      '<span class="dy-roi ' + (roi > 0 ? 'pos' : roi < 0 ? 'neg' : '') + '">' + (roi > 0 ? '+' : '') + roi.toFixed(1) + '% ROI</span></div>' +
    '<div class="dy-ranges" role="group" aria-label="Period">' + ranges.map(r => '<button type="button" aria-pressed="' + (diaryRange === r[0]) + '" onclick="setDiaryRange(\'' + r[0] + '\')">' + r[1] + '</button>').join('') + '</div>' +
    chart + '</section>';
}

function diaryTiles(settled, live) {
  const won = settled.filter(e => e.outcome === 'won').length, lost = settled.filter(e => e.outcome === 'lost').length;
  const decided = won + lost, rate = decided ? won / decided : 0;
  const staked = settled.reduce((t, e) => t + (Number(e.stake) || 0), 0);
  const waiting = live.reduce((t, e) => t + (Number(e.stake) || 0), 0);
  const returned = settled.reduce((t, e) => { const p = diaryProfit(e); return t + (p === null ? 0 : (Number(e.stake) || 0) + p); }, 0);
  const best = settled.reduce((b, e) => { const p = diaryProfit(e) || 0; return p > (b ? b.p : 0) ? { p, e } : b; }, null);
  const seq = settled.filter(e => e.outcome === 'won' || e.outcome === 'lost').map(e => e.outcome);
  let cur = 0, curType = seq.length ? seq[seq.length - 1] : '';
  for (let i = seq.length - 1; i >= 0 && seq[i] === curType; i--) cur++;
  let bestRun = 0, run = 0;
  seq.forEach(o => { run = o === 'won' ? run + 1 : 0; bestRun = Math.max(bestRun, run); });
  const r = 30, c = 2 * Math.PI * r;
  const ring = '<svg class="dy-ring" viewBox="0 0 76 76" role="img" aria-label="' + won + ' won, ' + lost + ' lost"><circle cx="38" cy="38" r="' + r + '" class="dy-ring-bg"/>' +
    '<circle cx="38" cy="38" r="' + r + '" class="dy-ring-fg" stroke-dasharray="' + (c * rate).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 38 38)"/>' +
    '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central">' + Math.round(rate * 100) + '%</text></svg>';
  return '<div class="dy-tiles">' +
    '<div class="dy-tile dy-tile-ring">' + ring + '<div class="dy-ring-txt"><span>Win rate</span><b>' + won + ' won</b><small>' + lost + ' lost</small></div></div>' +
    '<div class="dy-tile"><span>Staked</span><b>' + money(staked) + '</b><small>returned ' + money(returned) + (waiting ? ' · ' + money(waiting) + ' waiting' : '') + '</small></div>' +
    '<div class="dy-tile"><span>Biggest win</span><b class="pos">' + (best ? '+' + money(best.p) : '—') + '</b><small>' + (best ? esc(String(best.e.selection || '').slice(0, 40)) : 'No winners yet') + '</small></div>' +
    '<div class="dy-tile"><span>Streak</span><b>' + (cur ? cur + (curType === 'won' ? ' 🔥' : ' ❄️') : '—') + '</b><small>' + (cur ? (curType === 'won' ? 'wins in a row' : 'losses in a row') + ' · best run ' + bestRun : 'Settle a bet to start one') + '</small></div>' +
  '</div>';
}

function diaryGroupKey(e, by) {
  const legs = e.type === 'accumulator' && Array.isArray(e.legs) ? e.legs.length : 1;
  const odds = Number(e.odds) || 0;
  if (by === 'type') return legs <= 1 ? 'Singles' : legs === 2 ? 'Doubles' : legs === 3 ? 'Trebles' : '4-folds and bigger';
  if (by === 'market') return legs > 1 ? 'Accumulators' : (e.marketName || e.market || 'Other');
  if (by === 'bookmaker') return (e.bookmaker && e.bookmaker !== 'Bookmaker') ? e.bookmaker : 'Not recorded';
  if (by === 'origin') return e.origin === 'independent' ? '💡 Your own picks' : '🎯 Bet Buddy picks';
  return odds < 2 ? 'Odds-on (shorter than Evens)' : odds < 3 ? 'Evens to 2/1' : odds < 5 ? '2/1 to 4/1' : odds < 10 ? '4/1 to 9/1' : '9/1 and bigger';
}

function diaryBreakdownCard(settled) {
  const tabs = [['type', 'Bet type'], ['market', 'Market'], ['bookmaker', 'Bookmaker'], ['price', 'Price'], ['origin', 'Whose pick']];
  if (!settled.length) return '';
  const groups = {};
  settled.forEach(e => {
    const k = diaryGroupKey(e, diaryBreak);
    const g = groups[k] = groups[k] || { n: 0, won: 0, lost: 0, staked: 0, profit: 0, implied: 0 };
    g.n++; if (e.outcome === 'won') g.won++; if (e.outcome === 'lost') g.lost++;
    g.staked += Number(e.stake) || 0; g.profit += diaryProfit(e) || 0; g.implied += Number(e.odds) > 1 ? 1 / Number(e.odds) : 0;
  });
  const priceOrder = ['Odds-on (shorter than Evens)', 'Evens to 2/1', '2/1 to 4/1', '4/1 to 9/1', '9/1 and bigger'];
  const rows = Object.entries(groups).sort((a, b) => diaryBreak === 'price' ? priceOrder.indexOf(a[0]) - priceOrder.indexOf(b[0]) : b[1].staked - a[1].staked);
  const maxStake = Math.max(...rows.map(x => x[1].staked), 1);
  return '<section class="dy-card"><h2 class="dy-h">Where your money went</h2>' +
    '<div class="dy-tabs" role="group" aria-label="Break down by">' + tabs.map(t => '<button type="button" aria-pressed="' + (diaryBreak === t[0]) + '" onclick="setDiaryBreak(\'' + t[0] + '\')">' + t[1] + '</button>').join('') + '</div>' +
    '<div class="dy-bars">' + rows.map(([name, g]) => {
      const decided = g.won + g.lost, rate = decided ? Math.round(g.won / decided * 100) : 0;
      const need = Math.round(g.implied / g.n * 100);
      return '<div class="dy-bar-row"><div class="dy-bar-top"><b>' + esc(name) + '</b><span class="' + (g.profit > 0 ? 'pos' : g.profit < 0 ? 'neg' : '') + '">' + diarySigned(g.profit) + '</span></div>' +
        '<div class="dy-bar"><i class="' + (g.profit >= 0 ? 'up' : 'down') + '" style="--w:' + Math.max(3, Math.round(g.staked / maxStake * 100)) + '%"></i></div>' +
        '<small>' + money(g.staked) + ' staked · ' + g.n + (g.n === 1 ? ' bet' : ' bets') + ' · won ' + rate + '%' +
          (diaryBreak === 'price' && decided ? ' · needed about ' + need + '% to break even' : '') + '</small></div>';
    }).join('') + '</div>' +
    (diaryBreak === 'price' ? '<p class="dy-hint">If you win more often than the price needs, you are beating the bookmaker on those bets.</p>' : '') +
  '</section>';
}

// Ten weeks of results as a calendar, each day coloured by how much it won or lost.
function diaryHeatmap(settledAll) {
  if (!settledAll.length) return '';
  const byDay = {};
  settledAll.forEach(e => { const d = diarySettleKey(e).slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) byDay[d] = (byDay[d] || 0) + (diaryProfit(e) || 0); });
  const today = new Date(); today.setUTCHours(12, 0, 0, 0);
  const dow = (today.getUTCDay() + 6) % 7;
  const start = new Date(today.getTime() - (dow + 9 * 7) * 86400000);
  const max = Math.max(1, ...Object.values(byDay).map(Math.abs));
  const cells = [];
  for (let i = 0; i < 70; i++) {
    const d = new Date(start.getTime() + i * 86400000), key = d.toISOString().slice(0, 10);
    if (d > today) { cells.push('<span class="dy-cell future"></span>'); continue; }
    const v = byDay[key];
    const cls = v == null ? '' : v > 0 ? 'w' : v < 0 ? 'l' : 'z';
    const a = v == null ? 0 : 0.25 + 0.75 * Math.min(1, Math.abs(v) / max);
    cells.push('<span class="dy-cell ' + cls + '" style="--a:' + a.toFixed(2) + '" title="' + esc(d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + (v == null ? ': no bets settled' : ': ' + diarySigned(v))) + '"></span>');
  }
  const days = Object.keys(byDay), upDays = days.filter(k => byDay[k] > 0).length;
  return '<section class="dy-card"><h2 class="dy-h">Your last 10 weeks</h2>' +
    '<div class="dy-heat"><div class="dy-heat-days"><span>M</span><span></span><span>W</span><span></span><span>F</span><span></span><span>S</span></div><div class="dy-heat-grid">' + cells.join('') + '</div></div>' +
    '<div class="dy-heat-key"><span><i class="w"></i>Up day</span><span><i class="l"></i>Down day</span><span>' + upDays + ' of ' + days.length + ' betting days in profit</span></div></section>';
}

function viewDiary() {
  const all = getStoredDiary();
  if (!all.length) {
    return '<section class="view">' +
      '<h1 class="page-title">Bet Diary</h1>' +
      '<p class="page-sub">Your private record of bets and prices. ' + (getAuthUser() && getAuthUser().signedIn ? 'Saved on this device and synced to your account when you are signed in.' : 'Saved only in this browser. Sign in with Google to sync it between devices.') + '</p>' +
      (diaryReadFailed ? '<div class="notice error">Saved diary data could not be read. It has been left untouched, and saving is disabled to protect it.</div>' : '') +
      '<div class="empty-diary-card card section" style="text-align:center;padding:48px 24px;border:1px dashed rgba(255,255,255,0.18);border-radius:16px;max-width:540px;margin:28px auto 0;">' +
        '<div style="font-size:42px;margin-bottom:12px;">📓</div>' +
        '<h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 8px;">Your Bet Diary is empty</h2>' +
        '<p style="color:var(--soft);font-size:14px;line-height:1.5;margin:0 0 20px;">Keep track of your bets, monitor your returns over time, and see whether following Bet Buddy or your own picks works best.</p>' +
        '<a href="#/build/log" class="btn primary" style="min-height:44px;padding:8px 24px;font-size:15px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center">Add your first bet</a>' +
        '<input type="file" id="diary-import" accept="application/json,.json" hidden>' +
      '</div>' +
      sampleDiaryBet() +
    '</section>';
  }

  const diary = diaryProfileFilter === 'all' ? all : all.filter(e => (e.profile || 'Default') === diaryProfileFilter);
  const s = calc.summarizeBetDiary(diary);
  const profiles = Array.from(new Set(all.map(e => e.profile || 'Default'))).sort();
  const signedIn = getAuthUser() && getAuthUser().signedIn;
  const tools = '<details class="dy-tools"><summary>⋯ More</summary><div class="dy-tools-menu">' +
    '<label class="dy-profile"><span>Profile</span><select id="diary-profile-filter" class="ctl"><option value="all">All profiles</option>' +
      profiles.map(p => '<option value="' + esc(p) + '"' + (diaryProfileFilter === p ? ' selected' : '') + '>' + esc(p) + '</option>').join('') + '</select></label>' +
    '<button type="button" class="btn small" data-export="csv">Export CSV</button><button type="button" class="btn small" data-export="json">Export JSON</button>' +
    '<button type="button" class="btn small" data-export="backup">Backup</button><button type="button" class="btn small" data-import="diary">Import</button>' +
    '<input type="file" id="diary-import" accept="application/json,.json" hidden>' +
    '<button type="button" class="btn small danger" data-clear-diary>Clear diary</button>' +
    '<p>' + (signedIn ? 'Synced to your account.' : 'Saved in this browser only. Sign in to sync it, or use Backup and Import to move it.') + '</p></div></details>';
  let html = '<section class="view dy-view"><div class="dy-head"><h1 class="page-title">Bet Diary</h1><div class="dy-head-actions"><a href="#/build/log" class="btn primary">+ Log a bet</a>' + tools + '</div></div>';
  if (diaryReadFailed) html += '<div class="notice error">Saved diary data could not be read. It has been left untouched, and saving is disabled to protect it.</div>';
  if (!diary.length) return html + '<div class="empty section">No bets match this profile filter.</div></section>';

  const live = diary.filter(e => e.outcome === 'pending');
  const settledAll = diary.filter(e => e.outcome && e.outcome !== 'pending');
  const settled = diaryInRange(settledAll).sort((a, b) => diarySettleKey(a).localeCompare(diarySettleKey(b)));
  html += diaryHero(settled, live) + diaryTiles(settled, live) + diaryBreakdownCard(settled) + diaryHeatmap(settledAll);

  html += '<section class="dy-section"><h2 class="dy-h">Waiting on results <span>' + live.length + '</span></h2>' +
    (live.length ? '<div class="grid grid-2 dy-live">' + live.map(betCard).join('') + '</div>' : '<div class="dy-empty">Nothing waiting. Log a bet and it shows here until it settles.</div>') + '</section>';

  if (settledAll.length) {
    const months = [];
    settledAll.slice().sort((a, b) => diarySettleKey(b).localeCompare(diarySettleKey(a))).forEach(e => {
      const k = diarySettleKey(e).slice(0, 7);
      let m = months.find(x => x.k === k);
      if (!m) months.push(m = { k, list: [] });
      m.list.push(e);
    });
    html += '<section class="dy-section"><h2 class="dy-h">History <span>' + settledAll.length + '</span></h2>' +
      months.map((m, idx) => {
        const pl = m.list.reduce((t, e) => t + (diaryProfit(e) || 0), 0);
        const label = /^\d{4}-\d{2}$/.test(m.k) ? new Date(m.k + '-01T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'Earlier';
        return '<details class="dy-month"' + (idx === 0 ? ' open' : '') + '><summary><span>' + esc(label) + '</span><small>' + m.list.length + (m.list.length === 1 ? ' bet' : ' bets') + '</small><b class="' + (pl > 0 ? 'pos' : pl < 0 ? 'neg' : '') + '">' + diarySigned(pl) + '</b></summary>' +
          '<div class="arch-table" role="table" aria-label="Settled bets, ' + esc(label) + '">' + m.list.map(archiveRow).join('') + '</div></details>';
      }).join('') +
      '<p class="dy-hint">Tap a bet to see it in full, correct its result or delete it.</p></section>';
  }
  return html + '</section>';
}

// One compact line per settled bet: date, bet type, legs won of total, profit/loss. The full card opens on tap.
function archiveRow(entry) {
  const legs = entry.type === 'accumulator' && Array.isArray(entry.legs) && entry.legs.length ? entry.legs : null;
  const total = legs ? legs.length : 1;
  const wonLegs = legs ? legs.filter(l => l.outcome === 'won').length : (entry.outcome === 'won' ? 1 : 0);
  const profit = calc.calculateBetProfit(entry.stake, entry.odds, entry.outcome);
  const d = String(entry.date || (entry.timestamp ? entry.timestamp.slice(0, 10) : '') || '').slice(0, 10);
  const dateText = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(8) + '/' + d.slice(5, 7) + '/' + d.slice(2, 4) : (d || '-');
  const kind = legs ? total + '-team acca' : 'Single';
  const plText = profit === null ? '-' : (profit > 0 ? '+' : profit < 0 ? '-' : '') + money(profit);
  return '<details class="arch-item"><summary class="arch-row" role="row"><span>' + esc(dateText) + '</span><span>' + kind + '</span>' +
    '<span>' + wonLegs + '/' + total + '</span><span class="' + (profit > 0 ? 'pos' : profit < 0 ? 'neg' : '') + '">' + plText + '</span></summary>' +
    '<div class="arch-detail">' + betCard(entry) + '</div></details>';
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
  // The price is editable because legs saved from the builder carry Bet Buddy's estimate, not the bookmaker's price.
  const legs = entry.type === 'accumulator' ? (entry.legs || []).map((leg, i) => '<div class="leg"><span>' + (leg.match ? '<span class="dim" style="display:block;font-size:12px">' + esc(leg.match) + '</span>' : '') + esc(leg.selection) + ' • <b class="mono">' + legOddsText(leg) + '</b>' +
    '<input class="ctl mono" style="width:84px;min-height:32px;margin-left:8px;padding:2px 8px;font-size:12.5px" inputmode="text" autocomplete="off" placeholder="Edit price" aria-label="Bookmaker price for ' + esc(leg.selection) + '" data-leg-odds="' + esc(entry.id) + '" data-index="' + i + '"></span>' +
    outcomeSelect(leg.outcome, 'data-leg="' + esc(entry.id) + '" data-index="' + i + '"', 'Settle ' + leg.selection) + '</div>').join('') : '';
  const priceTaken = oddsFormat === 'decimal' ? calc.formatDecimalOdds(+entry.odds) : calc.formatFractionalOdds(+entry.odds);

  const dayKey = (entry.date || (entry.timestamp ? entry.timestamp.slice(0, 10) : '') || '').slice(0, 10);
  const leagueRec = leagueBetRecordFor(entry);
  const greenBadge = text => ' <span class="badge" style="background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.5);color:#34d399;font-weight:700;">' + text + '</span>';
  const greyBadge = (text, title) => ' <span class="badge" style="background:rgba(148,163,184,0.12);border:1px solid rgba(148,163,184,0.25);color:#94a3b8;"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + text + '</span>';
  const leagueBadge = !entry.inLeague && !leagueRec ? greyBadge('Diary only')
    : !leagueRec ? greenBadge('🏆 League Bet')
    : leagueRec.status === 'rejected' ? greyBadge('Not in league', leagueRec.reason || '')
    : leagueRec.status === 'settled' ? greenBadge('🏆 League ' + (leagueRec.outcome === 'void' ? 'void · 0 pts' : (leagueRec.points > 0 ? '+' : '') + leagueRec.points + ' pts'))
    : leagueRec.status === 'pending' ? greenBadge('🏆 League Bet · scores at ' + esc(calc.formatFractionalOdds(leagueRec.refOdds)))
    : greenBadge('🏆 League Bet · checking…');

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
    (entry.settledBy === 'auto' ? '<p class="dim" style="font-size:12.5px;margin:0 0 6px">✅ Settled automatically' + (entry.finalScore ? ' · final score ' + esc(entry.finalScore) : '') + '</p>' : '') +
    '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between"><span>' + pl + '</span><span style="display:flex;gap:8px;align-items:center">' +
      leagueActionBtn +
      outcomeSelect(entry.outcome, 'data-outcome="' + esc(entry.id) + '"', 'Settle bet') +
      '<button type="button" class="btn small danger" data-delete="' + esc(entry.id) + '" aria-label="Delete bet">Delete</button></span></div>' +
    (entry.notes ? '<p class="dim" style="font-size:13px">' + esc(entry.notes) + '</p>' : '') + '</article>';
}

// Replaces a leg's price with what the bookmaker actually gave, then rebuilds the combined price.
function updateAccumulatorLegOdds(id, index, text) {
  const raw = String(text || '').replace(/[≈~]/g, '').trim();
  if (!raw) return;
  const odds = /^evens?$/i.test(raw) ? 2 : ((calc.parseOdds ? calc.parseOdds(raw) : null) ?? calc.parseFractionalOdds(raw));
  if (!Number.isFinite(odds) || odds <= 1) { toast('Enter the price as 6/5, Evens or 2.20.', 'error'); return; }
  const diary = getStoredDiary();
  const entry = diary.find(item => item.id === id && item.type === 'accumulator');
  if (!entry || !entry.legs || !entry.legs[index]) return;
  entry.legs[index].odds = odds;
  const priced = calc.settleAccumulator(entry, entry.legs.map(leg => leg.outcome));
  entry.odds = priced.decimalOdds;
  entry.potentialReturn = priced.potentialReturn;
  try { saveStoredDiary(diary); } catch (error) { toast('Could not save the price. Check browser storage.', 'error'); return; }
  render();
}

function updateAccumulatorLegOutcome(id, index, outcome) {
  const diary = getStoredDiary();
  const entry = diary.find(item => item.id === id && item.type === 'accumulator');
  if (!entry || !entry.legs || !entry.legs[index]) return;
  entry.legs[index].outcome = outcome;
  entry.manualOverride = true;
  const settled = calc.settleAccumulator(entry, entry.legs.map(leg => leg.outcome));
  entry.outcome = settled.outcome;
  entry.odds = settled.decimalOdds;
  entry.potentialReturn = settled.potentialReturn;
  try { saveStoredDiary(diary); } catch (error) { toast('Could not save the settlement. Check browser storage.', 'error'); return; }
  render();
}

// ------------------------------------------------------------ Bet Diary auto-settlement
// Pending bets settle themselves once the match result is confirmed. Only markets that the final score
// decides are settled (match result, draw, double chance, total goals, both teams to score); corners,
// cards, shots, player and handicap bets stay pending for the user to settle.
// Team matching and settlement live in settlement.js, shared with the server's league scoring.
const settler = window.BetBuddySettlement.create(() => fixturesList());
const { fixtureFinished, liteText, teamGroup, teamMentions, settleTextAgainstScore, findDiaryFixture } = settler;

function autoSettleDiary() {
  const diary = getStoredDiary();
  let settledCount = 0;
  let changed = false;
  const stamp = new Date().toISOString();
  diary.forEach(entry => {
    if (!entry || entry.manualOverride) return;
    // A lost acca is archived with its other legs still pending; resolve those legs so the record is complete.
    // The bet's own outcome and odds are left exactly as they are.
    if (entry.outcome !== 'pending') {
      if (entry.type === 'accumulator' && Array.isArray(entry.legs)) {
        entry.legs.forEach(leg => {
          if (!leg || ['won', 'lost', 'void'].includes(leg.outcome)) return;
          const fx = (leg.fixtureId && fixtureById(leg.fixtureId)) || findDiaryFixture(leg.selection, entry);
          if (!fixtureFinished(fx)) return;
          const r = leg.market ? settler.settleMarket(leg.market, fx.score) : settleTextAgainstScore(leg.selection, fx.home, fx.away, fx.score);
          if (r) { leg.outcome = r; leg.auto = true; leg.kickoffAt = kickoffIso(fx); changed = true; }
        });
      }
      return;
    }
    if (entry.type === 'accumulator' && Array.isArray(entry.legs)) {
      let legChanged = false;
      entry.legs.forEach(leg => {
        if (!leg || ['won', 'lost', 'void'].includes(leg.outcome)) return;
        const fx = (leg.fixtureId && fixtureById(leg.fixtureId)) || findDiaryFixture(leg.selection, entry);
        if (!fixtureFinished(fx)) return;
        const r = leg.market ? settler.settleMarket(leg.market, fx.score) : settleTextAgainstScore(leg.selection, fx.home, fx.away, fx.score);
        if (r) { leg.outcome = r; leg.auto = true; leg.kickoffAt = kickoffIso(fx); legChanged = true; }
      });
      if (legChanged) {
        changed = true;
        const res = calc.settleAccumulator(entry, entry.legs.map(l => l.outcome));
        if (res.outcome !== 'pending') {
          entry.outcome = res.outcome;
          entry.odds = res.decimalOdds;
          entry.potentialReturn = res.potentialReturn;
          entry.settledBy = 'auto'; entry.settledAt = stamp;
          // Leagues need the bet logged before the first leg kicked off.
          const kicks = entry.legs.map(l => l && l.kickoffAt).filter(Boolean).sort();
          if (kicks.length) entry.kickoffAt = kicks[0];
          settledCount++;
        }
      }
      return;
    }
    const fx = (entry.match_id && fixtureById(entry.match_id)) || findDiaryFixture((entry.fixture || '') + ' ' + (entry.selection || ''), entry);
    if (!fixtureFinished(fx)) return;
    const r = entry.leagueMarket ? settler.settleMarket(entry.leagueMarket, fx.score) : settleTextAgainstScore((entry.marketName && entry.marketName !== 'Match result' ? entry.marketName + ' ' : '') + (entry.selection || ''), fx.home, fx.away, fx.score);
    if (r) {
      entry.outcome = r; entry.settledBy = 'auto'; entry.settledAt = stamp; entry.finalScore = fx.score[0] + '-' + fx.score[1]; entry.kickoffAt = kickoffIso(fx);
      changed = true;
      settledCount++;
    }
  });
  if (!changed) return 0;
  try { saveStoredDiary(diary); } catch (e) { console.warn('autoSettleDiary notice:', e); return 0; }
  if (settledCount) {
    toast('✅ ' + settledCount + (settledCount === 1 ? ' bet' : ' bets') + ' in your Bet Diary settled automatically.');
    try { syncDiaryToCloud(); } catch (e) {}
  }
  try { updateDiaryCount(); } catch (e) {}
  render();
  return settledCount;
}

function updateDiaryEntryOutcome(id, outcome) {
  const diary = getStoredDiary();
  const entry = diary.find(e => e.id === id);
  if (!entry) return;
  entry.outcome = outcome;
  entry.manualOverride = true;
  entry.settledBy = 'manual';
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

// The league bet already entered for a match day: the server's record when signed in, otherwise
// a diary bet marked for the league on this device.
function getLeagueBetForDay(dayKey) {
  if (!dayKey) return null;
  const server = myLeagueBets.get(dayKey);
  if (server) return server;
  const diary = getStoredDiary();
  return diary.find(e => {
    const d = (e.date || (e.timestamp ? e.timestamp.slice(0, 10) : '') || '').slice(0, 10);
    return d === dayKey && e.inLeague;
  }) || null;
}

// The text the settlement code reads for a diary bet (the same as Bet Diary auto-settlement).
function diaryBetText(entry) {
  return (entry.marketName && entry.marketName !== 'Match result' ? entry.marketName + ' ' : '') + (entry.selection || '');
}

const LEAGUE_MARKET_RE = /^(result:[HDA]|goals:(over|under):\d+(\.\d+)?)$/;

// The markets the league can score for a match, with their reference prices (the same code the server runs).
function leaguePricedMarkets(fx) {
  const feed = ((((DATA.odds && DATA.odds.matches) || {})[fx.id]) || {}).selections || {};
  const pred = DATA.predictions && DATA.predictions.predictions && DATA.predictions.predictions[fx.id];
  return window.BetBuddySettlement.pricedMarkets(feed, pred);
}

// Checks one pick (a single, or one accumulator leg) on its match: not kicked off, and a market that
// settles from the final score with a price. `market` is the market key when the app knows it.
function checkLeaguePick(text, fx, market) {
  if (!(kickoffMs(fx) > Date.now())) return { ok: false, reason: fx.home + ' v ' + fx.away + ' has already kicked off.' };
  const priced = leaguePricedMarkets(fx);
  const candidates = Object.keys(priced);
  if (!candidates.length) return { ok: false, reason: 'There is no price for ' + fx.home + ' v ' + fx.away + ' yet, so it cannot count in leagues.' };
  let key = market || settler.classifyMarket(text, fx.home, fx.away, candidates);
  if (!key) return { ok: false, reason: 'Only markets that settle from the final score, with a price, count in leagues ("' + text + '").' };
  if (!priced[key] && /^(corners|cards|shots|tts|other)/.test(key)) return { ok: false, reason: 'Corners, cards, shots and team-to-score bets cannot be checked against the final score, so they stay in your diary.' };
  if (!priced[key]) return { ok: false, reason: 'There is no usable price for "' + text + '" on ' + fx.home + ' v ' + fx.away + ', so it cannot count in leagues.' };
  return { ok: true, fixture: fx, market: key, refOdds: Number(priced[key].decimal) };
}

// Checks a diary bet the same way the league server will, so the player hears straight away if it
// cannot count: a single, or an accumulator whose every leg is a priced pick on a different match,
// logged before the first kick-off.
function leagueBetCheck(entry) {
  if (!entry) return { ok: false, reason: 'Bet not found.' };
  if (entry.type === 'accumulator') {
    const legs = entry.legs || [];
    if (legs.length < 2 || legs.length > 10) return { ok: false, reason: 'League accumulators need 2 to 10 legs.' };
    // Look from a few hours back, so a leg whose match has just kicked off is caught rather than
    // matched to that club's next fixture.
    const since = Date.now() - 6 * 3600000;
    const picks = [];
    for (let i = 0; i < legs.length; i++) {
      const text = String((legs[i] && legs[i].selection) || '');
      const fx = (legs[i] && legs[i].fixtureId && fixtureById(legs[i].fixtureId)) || settler.findUpcomingFixture(text, since);
      if (!fx) return { ok: false, reason: 'Leg ' + (i + 1) + ' ("' + text + '") does not say which match it is for, so the league cannot check the result. Add a club name to the leg, e.g. "Arsenal v Chelsea over 2.5 goals".' };
      if (picks.some(p => p.fixture.id === fx.id)) return { ok: false, reason: 'Leg ' + (i + 1) + ' is on the same match as an earlier leg. Each accumulator leg must be a different match.' };
      const pick = checkLeaguePick(text, fx, legs[i] && legs[i].market);
      if (!pick.ok) return pick;
      picks.push(Object.assign(pick, { selection: text }));
    }
    picks.sort((x, y) => kickoffMs(x.fixture) - kickoffMs(y.fixture));
    return {
      ok: true,
      acca: true,
      fixture: picks[0].fixture,
      day: picks[0].fixture.kickoff_utc.slice(0, 10),
      refOdds: picks.reduce((t, p) => t * p.refOdds, 1),
      legs: picks.map(p => ({ fixtureId: p.fixture.id, selection: p.selection, market: p.market }))
    };
  }
  const fx = (entry.match_id && fixtureById(entry.match_id)) || findDiaryFixture(diaryBetText(entry), entry);
  if (!fx) return { ok: false, reason: 'Choose the match from the list so the league can check the result.' };
  const pick = checkLeaguePick(diaryBetText(entry), fx, entry.leagueMarket);
  return pick.ok ? Object.assign(pick, { day: fx.kickoff_utc.slice(0, 10) }) : pick;
}

// Sends a diary bet to the league server as the player's league bet for its match day.
async function submitLeagueBet(entry) {
  const user = getAuthUser();
  if (!firestoreDb || !currentAuthUser || !user || !user.signedIn) return { ok: false, reason: 'Sign in with Google to enter league bets.' };
  const chk = leagueBetCheck(entry);
  if (!chk.ok) return chk;
  const existing = myLeagueBets.get(chk.day);
  if (existing && existing.betId !== entry.id) return { ok: false, reason: 'You already have a league bet for ' + chk.day + '.' };
  try {
    await firestoreDb.collection('users').doc(currentAuthUser.uid).collection('leagueBets').doc(chk.day).set(leagueDocs.leagueBetDoc({
      betId: entry.id, fixtureId: chk.fixture.id, selection: chk.acca ? entry.selection : diaryBetText(entry), odds: entry.odds,
      legs: chk.acca ? chk.legs : undefined, market: !chk.acca && /^(dc|dnb|btts):/.test(chk.market) ? chk.market : undefined, now: firebase.firestore.FieldValue.serverTimestamp()
    }));
    return chk;
  } catch (e) {
    console.warn('submitLeagueBet notice:', e);
    return { ok: false, reason: e && e.code === 'permission-denied' ? 'You already have a league bet for ' + chk.day + '.' : 'Could not reach the league server. Please try again.' };
  }
}

function leagueBetRecordFor(entry) {
  for (const rec of myLeagueBets.values()) if (rec.betId === entry.id) return rec;
  return null;
}

// Enters a just-saved diary bet into the leagues, or explains why it stays in the diary only.
async function enterLeagueBet(id) {
  const entry = getStoredDiary().find(e => e.id === id);
  if (!entry) return;
  const res = await submitLeagueBet(entry);
  const diary = getStoredDiary();
  const saved = diary.find(e => e.id === id);
  if (saved) {
    saved.inLeague = !!res.ok;
    saveStoredDiary(diary);
  }
  toast(res.ok
    ? 'Entered into your leagues 🏆 It scores at the bookmaker price of ' + calc.formatFractionalOdds(res.refOdds) + (res.refOdds > leagueDocs.MAX_COUNTED_ODDS ? ' (counted as 10/1, the 100-point cap)' : '') + ' if it wins.'
    : 'Saved to your Bet Diary only. ' + res.reason);
  if (['diary', 'leagues'].includes(currentRoute()[0])) render();
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

async function toggleLeagueBet(id) {
  const diary = getStoredDiary();
  const entry = diary.find(e => e.id === id);
  if (!entry) return;
  if (entry.inLeague) {
    const rec = leagueBetRecordFor(entry);
    const beforeKickoff = rec && rec.status === 'pending' && rec.kickoffAt && rec.kickoffAt.toMillis && rec.kickoffAt.toMillis() > Date.now();
    if (rec && rec.status !== 'rejected' && !beforeKickoff) {
      toast('League bets stand once the match has kicked off.', 'warn');
      return;
    }
    if (rec) {
      try {
        await firestoreDb.collection('users').doc(currentAuthUser.uid).collection('leagueBets').doc(rec.day).delete();
      } catch (e) {
        toast('Could not remove the league bet. Please try again.', 'warn');
        return;
      }
    }
    const fresh = getStoredDiary();
    const target = fresh.find(e => e.id === id);
    if (target) { target.inLeague = false; saveStoredDiary(fresh); }
    toast('Removed from League. Bet is now Diary only.');
    render();
  } else {
    const chk = leagueBetCheck(entry);
    const existing = chk.ok ? getLeagueBetForDay(chk.day) : null;
    if (existing && existing.betId !== entry.id && existing.id !== entry.id) {
      toast('You already have a league bet for ' + chk.day + ' (' + (existing.selection || 'existing bet') + '). Remove it first to swap.', 'warn');
      return;
    }
    toast('Checking with the league…');
    enterLeagueBet(id);
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
  $('modal-leg-match-select').innerHTML = '<option value="">+ Add a leg: choose the match</option>' + options.map(f => '<option value="' + esc(f.id) + '">' + esc(f.home + ' v ' + f.away + ' · ' + fmtDay(kickoffMs(f)) + ' ' + fmtTime(kickoffMs(f))) + '</option>').join('');
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

// Starts a new accumulator leg with the match filled in, so the player only adds the pick and price.
function addLegForMatch(fixtureId) {
  const f = fixtureById(fixtureId);
  const sel = $('modal-leg-match-select');
  if (sel) sel.value = '';
  if (!f) return;
  const box = $('modal-legs-input');
  const lines = (box.value || '').split('\n');
  // Fill an unfinished last line (e.g. "Over 2.5 goals | 10/11" with no match) rather than leaving a gap.
  const last = lines.length ? lines[lines.length - 1].trim() : '';
  const prefix = f.home + ' v ' + f.away + ': ';
  if (last && !teamNamed(last)) lines[lines.length - 1] = prefix + last;
  else { if (!last) lines.pop(); lines.push(prefix); }
  box.value = lines.join('\n');
  box.focus();
  box.setSelectionRange(box.value.length, box.value.length);
  updateModalPnlPreview();
}

function teamNamed(text) {
  return settler.teamMentions(text).found.length > 0;
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
    inLeague: false,  // set once the league server accepts it (enterLeagueBet)
    model_p: linked && modalPrefill.p != null ? modalPrefill.p : undefined, model_fair_odds: linked ? modalPrefill.fair : undefined,
    recommendation: linked && modalPrefill.rec && $('modal-selection-input').value.trim() === modalPrefill.selection ? modalPrefill.rec : undefined,
    notes: $('modal-notes-input').value.trim()
  };
  try { const diary = getStoredDiary(); diary.unshift(entry); saveStoredDiary(diary); }
  catch (error) { console.error(error); toast('Could not save to this browser. Check storage space or privacy settings.', 'error'); return; }
  closeDiary();
  celebrateSave();
  if (inLeague) enterLeagueBet(entry.id);
  else toast('Saved to your Bet Diary.');
  if (currentRoute()[0] === 'diary') render();
}

// ------------------------------------------------------------ Build your own bet (#/build)
// One bet at a time: a single, double, treble, 4-fold and so on. Football legs picked from the
// fixture list are checked for league eligibility; typed-in selections (any sport) are diary only.
const OWN_BET_KEY = 'betbuddy_own_bet_v1';
const OWN_BET_MAX_LEGS = 10;
const OWN_BET_SPORTS = ['Football', 'Tennis', 'Golf', 'Darts', 'Rugby', 'Cricket', 'Horse racing', 'Other'];
let ownBet = { legs: [], stake: 10, bookmaker: '', dest: 'league', origin: '', notes: '' };
let ownBetUI = { tab: 'football', q: '', day: '', comp: 'all', open: '', mtab: 'popular' };
try {
  const savedOwn = JSON.parse(localStorage.getItem(OWN_BET_KEY) || 'null');
  if (savedOwn && Array.isArray(savedOwn.legs)) ownBet = Object.assign(ownBet, savedOwn);
} catch (e) { /* start with an empty slip */ }

function persistOwnBet() { try { localStorage.setItem(OWN_BET_KEY, JSON.stringify(ownBet)); } catch (e) { /* ignore */ } }
function ownBetName(n) { return n === 1 ? 'Single' : n === 2 ? 'Double' : n === 3 ? 'Treble' : n + '-fold'; }
function parseOwnBetOdds(text) {
  const t = String(text || '').replace(/[≈~]/g, '').trim();
  if (!t) return null;
  if (/^evens?$/i.test(t)) return 2;
  const v = (calc.parseOdds ? calc.parseOdds(t) : null) ?? calc.parseFractionalOdds(t);
  return Number.isFinite(v) && v > 1 ? v : null;
}
const ownBetOddsText = odds => odds > 1 ? fmtOdds(odds).replace(/[≈~]/g, '') : '';

// Every market offered for a match: the football result and goals lines with the latest recorded
// bookmaker price, plus the model's other markets (both teams to score, corners, cards, shots) and
// double chance, where the player types in the price they were offered. `src` is the app's own label,
// used to match selections added from other pages.
const OWN_BET_GROUPS = [['result', 'Match result'], ['dc', 'Double chance'], ['dnb', 'Draw no bet'], ['goals', 'Total goals'], ['btts', 'Both teams to score'], ['tts', 'Team to score'], ['corners', 'Corners'], ['cards', 'Cards'], ['shots', 'Shots on target']];
const MARKET_NAMES_OWN = { goals: 'Total goals', corners: 'Total corners', cards: 'Total cards', shots: 'Shots on target' };
const OWN_BET_NOUN = { goals: 'goals', corners: 'corners', cards: 'cards', shots: 'shots on target' };
function ownBetMarketsFor(fx) {
  const feed = (((DATA.odds && DATA.odds.matches) || {})[fx.id] || {}).selections || {};
  const pred = DATA.predictions && DATA.predictions.predictions && DATA.predictions.predictions[fx.id];
  const out = [];
  const scoreable = window.BetBuddySettlement.pricedMarkets(feed, pred);
  const sels = pred ? allSelections(pred).filter(x => x.market !== 'result') : [];
  const modelP = {};
  sels.forEach(x => { modelP[x.id] = Number(x.p); });
  // Price shown on the button: the bookmaker price on record, else one worked out from the result prices
  // or the model (with a typical bookmaker margin). Anything not from a bookmaker is flagged `est`.
  const add = (key, group, label, src) => {
    const f = feed[key];
    let decimal = f && Number(f.decimal) > 1 ? Number(f.decimal) : null, est = false;
    if (!decimal && scoreable[key]) { decimal = Number(scoreable[key].decimal); est = true; }
    if (!decimal && modelP[key] > 0.02 && modelP[key] < 0.98) { decimal = Math.round(100 / (modelP[key] * 1.07)) / 100; est = true; }
    out.push({ key, group, label, src: src || label, decimal, est, bookmaker: f && !est ? f.bookmaker : '', league: !!scoreable[key] });
  };
  add('result:H', 'result', fx.home + ' win'); add('result:D', 'result', 'Draw'); add('result:A', 'result', fx.away + ' win');
  add('dc:1X', 'dc', fx.home + ' or draw'); add('dc:X2', 'dc', fx.away + ' or draw'); add('dc:12', 'dc', fx.home + ' or ' + fx.away);
  if (sels.length) {
    sels.forEach(x => {
      if (x.market === 'btts') add(x.id, 'btts', 'Both teams to score: ' + (x.key === 'yes' ? 'Yes' : 'No'), x.label);
      else add(x.id, x.market, (x.key === 'over' ? 'Over ' : 'Under ') + x.line + ' ' + OWN_BET_NOUN[x.market], x.label);
    });
  } else {
    add('goals:over:2.5', 'goals', 'Over 2.5 goals', 'Total goals: Over 2.5'); add('goals:under:2.5', 'goals', 'Under 2.5 goals', 'Total goals: Under 2.5');
    add('btts:yes', 'btts', 'Both teams to score: Yes', 'Both teams to score: Yes'); add('btts:no', 'btts', 'Both teams to score: No', 'Both teams to score: No');
  }
  // Standard lines the model does not publish, so a bet can still be built (the player types the price).
  const lines = { goals: [0.5, 1.5, 2.5, 3.5, 4.5], corners: [8.5, 9.5, 10.5, 11.5], cards: [2.5, 3.5, 4.5, 5.5], shots: [7.5, 8.5, 9.5] };
  Object.keys(lines).forEach(g => lines[g].forEach(line => ['over', 'under'].forEach(side => {
    const key = g + ':' + side + ':' + line;
    if (out.some(o => o.key === key)) return;
    add(key, g, (side === 'over' ? 'Over ' : 'Under ') + line + ' ' + OWN_BET_NOUN[g], MARKET_NAMES_OWN[g] + ': ' + (side === 'over' ? 'Over ' : 'Under ') + line);
  })));
  add('dnb:H', 'dnb', fx.home + ' (draw no bet)'); add('dnb:A', 'dnb', fx.away + ' (draw no bet)');
  add('tts:H', 'tts', fx.home + ' to score'); add('tts:A', 'tts', fx.away + ' to score');
  // A priced goals line the model does not publish (e.g. 3.5) still belongs on the list.
  Object.keys(feed).filter(k => /^goals:(over|under):/.test(k) && !out.some(o => o.key === k)).forEach(k => {
    const [, side, line] = k.split(':');
    add(k, 'goals', (side === 'over' ? 'Over ' : 'Under ') + line + ' goals', 'Total goals: ' + (side === 'over' ? 'Over ' : 'Under ') + line);
  });
  const lineOf = o => { const p = o.key.split(':'); return p.length === 3 ? Number(p[2]) : -1; };
  const rank = g => OWN_BET_GROUPS.findIndex(x => x[0] === g);
  return out.map((o, i) => [o, i]).sort((a, b) => rank(a[0].group) - rank(b[0].group) || lineOf(a[0]) - lineOf(b[0]) ||
    (a[0].key.includes(':over:') ? -1 : b[0].key.includes(':over:') ? 1 : 0) || a[1] - b[1]).map(x => x[0]);
}

function setOwnBetTab(tab) { ownBetUI.tab = tab; render(); }

// Adds a selection from anywhere in the app (match page, picks, other sports) to the own-bet slip.
function addToOwnBet(data) {
  if (ownBet.legs.length >= OWN_BET_MAX_LEGS) { toast('A bet can have up to ' + OWN_BET_MAX_LEGS + ' selections.', 'warn'); return; }
  const id = 'ob' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const fx = data.id ? fixtureById(data.id) : null;
  let leg = null;
  if (fx) {
    const markets = ownBetMarketsFor(fx);
    const text = (data.marketName && data.marketName !== 'Match result' ? data.marketName + ' ' : '') + String(data.selection || '');
    const sel = String(data.selection || ''), full = data.marketName ? data.marketName + ': ' + sel : sel;
    const upcoming = kickoffMs(fx) > Date.now();
    let opt = upcoming ? markets.find(o => o.src === sel || o.src === full || o.label === sel) : null;
    if (upcoming && !opt) {
      const key = settler.classifyMarket(text, fx.home, fx.away, markets.filter(o => o.league).map(o => o.key));
      opt = key && markets.find(o => o.key === key);
    }
    leg = opt
      ? ownBetFootballLeg(fx, opt, id)
      : { id, kind: 'custom', sport: 'Football', pick: (fx.home + ' v ' + fx.away + ': ' + String(data.selection || '')).slice(0, 120), odds: null };
  } else if (data.sport) {
    const sport = String(data.sport).charAt(0).toUpperCase() + String(data.sport).slice(1);
    leg = { id, kind: 'custom', sport, pick: String(data.selection || '').slice(0, 120), odds: Number(data.odds) > 1 ? Number(data.odds) : null };
  }
  if (!leg) return;
  leg.origin = 'matchiq'; // '+ My bet' sits on Bet Buddy's own picks
  if (ownBet.legs.some(l => (leg.kind === 'football' ? l.fixtureId === leg.fixtureId && l.key === leg.key : l.pick === leg.pick))) { toast('Already on your bet slip.'); return; }
  ownBet.legs.push(leg);
  persistOwnBet();
  updateOwnBetBar();
  toast('Added to your bet slip (' + ownBetName(ownBet.legs.length) + '). Keep browsing, or tap the slip bar to finish.');
}

// A slim bar on every page except the builder, so the slip is one tap away while browsing.
function updateOwnBetBar() {
  let bar = $('own-bet-bar');
  const legs = ownBet.legs, n = legs.length;
  const onBuild = currentRoute()[0] === 'build';
  if (!n) { if (bar) bar.hidden = true; return; }
  if (!bar) {
    bar = document.createElement('a');
    bar.id = 'own-bet-bar'; bar.className = 'own-bar'; bar.href = '#/build';
    // On the builder itself the bar jumps down to the slip instead of navigating.
    bar.addEventListener('click', e => {
      if (currentRoute()[0] !== 'build') return;
      e.preventDefault();
      const slip = $('own-slip');
      if (slip) slip.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.body.appendChild(bar);
  }
  const priced = legs.every(l => l.odds > 1);
  bar.hidden = false;
  bar.classList.toggle('on-build', onBuild);
  bar.innerHTML = '<span>🧾 <b>Bet slip</b> · ' + esc(ownBetName(n)) + ' · ' + n + (n === 1 ? ' selection' : ' selections') +
    (priced ? ' · ' + esc(fmtOdds(legs.reduce((t, l) => t * l.odds, 1))) : '') + '</span><span class="own-bar-go">' + (onBuild ? 'Slip ↓' : 'View ›') + '</span>';
}

function ownBetAddBtn(payload) {
  return '<button type="button" class="btn small own-add-btn" data-own-bet=\'' + esc(JSON.stringify(payload)) + '\' title="Add to my own bet slip">+ My bet</button>';
}

// ---- The coupon: a bookmaker-style list of matches by day and competition. Home / Draw / Away prices
// go straight on the slip with one tap; "More markets" opens the match's other markets in tabs.
const OWN_BET_GROUP_NAME = Object.fromEntries(OWN_BET_GROUPS);
const OWN_BET_HELP = {
  result: 'Who wins after 90 minutes, or a draw.',
  dc: 'Two results in one: you win if either happens. Safer, so a shorter price.',
  dnb: 'Back a team to win. If it ends a draw you get your stake back.',
  goals: 'Goals by both teams added up. Over 2.5 means 3 or more goals.',
  btts: 'Do both teams score at least once?',
  tts: 'Does this team score at least once?',
  corners: 'Corners taken by both teams added up.',
  cards: 'Yellow and red cards shown to both teams added up.',
  shots: 'Shots on target by both teams added up.'
};
const OWN_BET_MTABS = [['popular', 'Popular'], ['result', 'Result'], ['goals', 'Goals'], ['corners', 'Corners'], ['cards', 'Cards'], ['shots', 'Shots']];

function ownBetFootballLeg(fx, opt, id) {
  return { id: id || 'ob' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: 'football', fixtureId: fx.id, key: opt.key,
    match: fx.home + ' v ' + fx.away, market: OWN_BET_GROUP_NAME[opt.group] || '', pick: opt.label, odds: opt.decimal, est: !!opt.est, bookmaker: opt.bookmaker || '', origin: 'independent' };
}

// Taps a price: adds it to the slip, or takes it off if it is already there (as bookmakers do).
function toggleOwnBetLeg(fxId, key) {
  const fx = fixtureById(fxId);
  if (!fx) return;
  const existing = ownBet.legs.find(l => l.fixtureId === fxId && l.key === key);
  if (existing) { ownBet.legs = ownBet.legs.filter(l => l !== existing); persistOwnBet(); render(); return; }
  if (ownBet.legs.length >= OWN_BET_MAX_LEGS) { toast('A bet can have up to ' + OWN_BET_MAX_LEGS + ' selections.', 'warn'); return; }
  const opt = ownBetMarketsFor(fx).find(o => o.key === key);
  if (!opt) return;
  ownBet.legs.push(ownBetFootballLeg(fx, opt));
  persistOwnBet(); render();
}

function ownBetUpcoming() { const now = Date.now(); return diaryFixtureOptions().filter(f => kickoffMs(f) > now); }
function ownBetDayLabel(ms) {
  const k = dayKey(ms), now = Date.now();
  return k === dayKey(now) ? 'Today' : k === dayKey(now + 86400000) ? 'Tomorrow' : fmtDay(ms);
}
function setOwnBetDay(d) { ownBetUI.day = d; ownBetUI.comp = 'all'; ownBetUI.open = ''; render(); }
function setOwnBetComp(c) { ownBetUI.comp = c; render(); }
function toggleOwnBetMatch(id) { ownBetUI.open = ownBetUI.open === id ? '' : id; ownBetUI.mtab = 'popular'; render(); }
function setOwnBetMarketTab(t) { ownBetUI.mtab = t; render(); }
function filterOwnBetFixtures(q) {
  ownBetUI.q = q;
  const box = $('own-coupon');
  if (box) box.innerHTML = ownBetCouponHtml();
}

function ownBetPriceBtn(fx, o, label, model) {
  if (!o) return '<span class="cp-price nop" aria-hidden="true"><b>–</b></span>';
  const on = ownBet.legs.some(l => l.fixtureId === fx.id && l.key === o.key);
  const price = o.decimal ? ownBetOddsText(o.decimal).replace(' (1/1)', '') : '+ Add';
  const aria = (on ? 'Remove ' : 'Add ') + o.label + (o.decimal ? ' at ' + price : '') + ', ' + fx.home + ' v ' + fx.away;
  return '<button type="button" class="cp-price' + (on ? ' on' : '') + (o.est ? ' est' : '') + (o.decimal ? '' : ' nop') + '" aria-pressed="' + on + '" aria-label="' + esc(aria) + '"' +
    ' onclick="toggleOwnBetLeg(\'' + esc(fx.id) + '\',\'' + esc(o.key) + '\')">' + (label ? '<span>' + esc(label) + '</span>' : '') + '<b class="mono">' + esc(price) + '</b>' +
    (model && model[o.key] > 0 ? '<small class="cp-p">' + pct(model[o.key]) + '</small>' : '') + '</button>';
}

function ownBetMarketBlock(fx, group, rows, title, model) {
  if (!rows.length) return '';
  const league = rows.some(o => o.league);
  const head = '<div class="cp-mk-head"><h4>' + esc(title || OWN_BET_GROUP_NAME[group]) + '</h4>' + (league ? '<span class="cp-lg" title="Can count in your leagues">🏆 League</span>' : '') + '</div>' +
    '<p class="cp-help">' + esc(OWN_BET_HELP[group] || '') + '</p>';
  if (/^(goals|corners|cards|shots)$/.test(group)) {
    const lines = [...new Set(rows.map(o => Number(o.key.split(':')[2])))].sort((a, b) => a - b);
    const find = (side, line) => rows.find(o => o.key === group + ':' + side + ':' + line);
    return '<div class="cp-mk">' + head + '<div class="cp-ou"><span></span><span class="cp-col">Over</span><span class="cp-col">Under</span>' +
      lines.map(line => '<span class="cp-line">' + line + '</span>' + ownBetPriceBtn(fx, find('over', line), '', model) + ownBetPriceBtn(fx, find('under', line), '', model)).join('') + '</div></div>';
  }
  const short = o => group === 'result' ? (o.key === 'result:D' ? 'Draw' : o.key === 'result:H' ? fx.home : fx.away)
    : group === 'btts' ? (o.key === 'btts:yes' ? 'Yes' : 'No')
    : group === 'dnb' ? (o.key === 'dnb:H' ? fx.home : fx.away)
    : group === 'tts' ? (o.key === 'tts:H' ? fx.home : fx.away) : o.label;
  return '<div class="cp-mk">' + head + '<div class="cp-sels cols-' + rows.length + '">' + rows.map(o => ownBetPriceBtn(fx, o, short(o), model)).join('') + '</div></div>';
}

function ownBetMatchPanel(fx, model) {
  const all = ownBetMarketsFor(fx), tab = ownBetUI.mtab || 'popular';
  const g = k => all.filter(o => o.group === k);
  let body;
  if (tab === 'popular') {
    body = ownBetMarketBlock(fx, 'result', g('result'), '', model) + ownBetMarketBlock(fx, 'btts', g('btts'), '', model) +
      ownBetMarketBlock(fx, 'goals', g('goals').filter(o => /:2\.5$/.test(o.key)), 'Total goals 2.5', model) + ownBetMarketBlock(fx, 'dc', g('dc'), '', model);
  } else if (tab === 'result') body = ['result', 'dc', 'dnb'].map(k => ownBetMarketBlock(fx, k, g(k), '', model)).join('');
  else if (tab === 'goals') body = ['goals', 'btts', 'tts'].map(k => ownBetMarketBlock(fx, k, g(k), '', model)).join('');
  else body = ownBetMarketBlock(fx, tab, g(tab), '', model);
  const fs = feedFor(fx.id), anyFeed = Object.keys(fs.details || {}).length;
  const note = all.some(o => o.est)
    ? 'Prices with a dotted outline are estimates (worked out from the bookmaker result prices or our model). Change any price on your slip to the one you were offered.'
    : anyFeed && fs.state !== 'fresh' ? 'These prices are about ' + Math.round(fs.ageHours) + ' hours old and may have moved. Change them on your slip if yours differ.'
    : 'Recent UK bookmaker prices. Change them on your slip if yours differ.';
  return '<div class="cp-panel" id="cp-panel-' + esc(fx.id) + '">' +
    '<div class="cp-mtabs" role="tablist" aria-label="Markets">' + OWN_BET_MTABS.map(t => '<button type="button" role="tab" aria-selected="' + (tab === t[0]) + '" onclick="setOwnBetMarketTab(\'' + t[0] + '\')">' + t[1] + '</button>').join('') + '</div>' +
    body + '<p class="own-hint">' + esc(note) + ' 🏆 League markets settle from the final score and can count in your leagues; the rest save to your diary.</p></div>';
}

function ownBetMatchRow(fx) {
  const all = ownBetMarketsFor(fx), byKey = k => all.find(o => o.key === k);
  const open = ownBetUI.open === fx.id;
  const picked = ownBet.legs.filter(l => l.fixtureId === fx.id && !/^result:/.test(l.key)).length;
  return '<div class="cp-row' + (open ? ' open' : '') + '">' +
    '<button type="button" class="cp-match" aria-expanded="' + open + '" aria-controls="cp-panel-' + esc(fx.id) + '" onclick="toggleOwnBetMatch(\'' + esc(fx.id) + '\')">' +
      '<span class="cp-time mono">' + esc(fmtTime(kickoffMs(fx))) + '</span>' +
      '<span class="cp-teams"><b>' + esc(fx.home) + '</b><b>' + esc(fx.away) + '</b></span>' +
      '<span class="cp-more">' + (open ? 'Hide markets ▴' : (all.length - 3) + ' more markets ▾') + (picked ? ' <i>' + picked + ' picked</i>' : '') + '</span></button>' +
    '<div class="cp-1x2">' + ownBetPriceBtn(fx, byKey('result:H')) + ownBetPriceBtn(fx, byKey('result:D')) + ownBetPriceBtn(fx, byKey('result:A')) + '</div>' +
    (open ? ownBetMatchPanel(fx) : '') + '</div>';
}

function ownBetCouponHtml() {
  const term = String(ownBetUI.q || '').trim().toLowerCase();
  const upcoming = ownBetUpcoming();
  if (!upcoming.length) return '<div class="empty">No upcoming matches in the list right now. Use <b>Type it in</b> to add any selection.</div>';
  let list, chips = '';
  if (term) {
    list = upcoming.filter(f => (f.home + ' ' + f.away + ' ' + leagueName(f.competition)).toLowerCase().includes(term));
    if (!list.length) return '<div class="empty">No matches found for “' + esc(ownBetUI.q) + '”. Try a club or league name.</div>';
  } else {
    const days = [];
    upcoming.forEach(f => { const k = dayKey(kickoffMs(f)); if (!days.some(d => d.k === k)) days.push({ k, ms: kickoffMs(f) }); });
    if (!days.some(d => d.k === ownBetUI.day)) ownBetUI.day = days[0].k;
    const dayList = upcoming.filter(f => dayKey(kickoffMs(f)) === ownBetUI.day);
    const comps = [...new Set(dayList.map(f => f.competition || 'PL'))].sort((a, b) => Object.keys(LEAGUES).indexOf(a) - Object.keys(LEAGUES).indexOf(b));
    if (ownBetUI.comp !== 'all' && !comps.includes(ownBetUI.comp)) ownBetUI.comp = 'all';
    list = ownBetUI.comp === 'all' ? dayList : dayList.filter(f => (f.competition || 'PL') === ownBetUI.comp);
    chips = '<div class="cp-chips" role="group" aria-label="Day">' + days.slice(0, 10).map(d => '<button type="button" aria-pressed="' + (d.k === ownBetUI.day) + '" onclick="setOwnBetDay(\'' + esc(d.k) + '\')">' + esc(ownBetDayLabel(d.ms)) + '</button>').join('') + '</div>' +
      (comps.length > 1 ? '<div class="cp-chips small" role="group" aria-label="Competition"><button type="button" aria-pressed="' + (ownBetUI.comp === 'all') + '" onclick="setOwnBetComp(\'all\')">All (' + dayList.length + ')</button>' +
        comps.map(c => '<button type="button" aria-pressed="' + (ownBetUI.comp === c) + '" onclick="setOwnBetComp(\'' + esc(c) + '\')">' + esc(leagueName(c)) + ' (' + dayList.filter(f => (f.competition || 'PL') === c).length + ')</button>').join('') + '</div>' : '');
  }
  // Grouped like a bookmaker coupon: competition header with Home / Draw / Away columns, then each match.
  const groups = [];
  list.forEach(f => {
    const name = leagueName(f.competition) + (term ? ' · ' + ownBetDayLabel(kickoffMs(f)) : '');
    let grp = groups.find(x => x.name === name);
    if (!grp) groups.push(grp = { name, rows: [] });
    grp.rows.push(f);
  });
  if (!term) { const rank = n => { const i = Object.values(LEAGUES).indexOf(n); return i < 0 ? 99 : i; }; groups.sort((a, b) => rank(a.name) - rank(b.name)); }
  return chips + groups.map(grp => '<div class="cp-group"><div class="cp-ghead"><span>' + esc(grp.name) + '</span><span class="cp-cols"><span>Home</span><span>Draw</span><span>Away</span></span></div>' +
    grp.rows.map(ownBetMatchRow).join('') + '</div>').join('');
}

function addOwnBetCustomLeg() {
  const text = ($('own-custom-text').value || '').trim();
  const odds = parseOwnBetOdds($('own-custom-odds').value);
  if (!text) { toast('Enter what you backed, e.g. "Djokovic to win".', 'error'); return; }
  if (!odds) { toast('Enter valid odds, such as 6/4, Evens or 2.50.', 'error'); return; }
  if (ownBet.legs.length >= OWN_BET_MAX_LEGS) { toast('A bet can have up to ' + OWN_BET_MAX_LEGS + ' selections.', 'warn'); return; }
  ownBet.legs.push({ id: 'ob' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: 'custom', sport: $('own-custom-sport').value, pick: text.slice(0, 120), odds });
  persistOwnBet(); render();
}

function removeOwnBetLeg(id) { ownBet.legs = ownBet.legs.filter(l => l.id !== id); persistOwnBet(); render(); }
function clearOwnBet() { ownBet.legs = []; ownBet.origin = ''; ownBet.notes = ''; persistOwnBet(); render(); }
function setOwnBetLegOdds(id, text) {
  const leg = ownBet.legs.find(l => l.id === id);
  if (!leg) return;
  const odds = parseOwnBetOdds(text);
  if (!odds) { toast('Enter valid odds, such as 6/4, Evens or 2.50.', 'error'); render(); return; }
  leg.odds = odds; leg.est = false; persistOwnBet(); render();
}
function setOwnBetStake(v) { ownBet.stake = Math.max(0, Number(v) || 0); persistOwnBet(); render(); }
function setOwnBetBookmaker(v) { ownBet.bookmaker = String(v || '').slice(0, 40); persistOwnBet(); }
// Whose pick the bet was, for the Diary's "following Bet Buddy vs own choice" record. Worked out from
// where the selections came from unless the player says otherwise.
function ownBetOrigin() {
  if (ownBet.origin === 'matchiq' || ownBet.origin === 'independent') return ownBet.origin;
  return ownBet.legs.length && ownBet.legs.every(l => l.origin === 'matchiq') ? 'matchiq' : 'independent';
}
function setOwnBetOrigin(v) { ownBet.origin = v === 'matchiq' ? 'matchiq' : 'independent'; persistOwnBet(); render(); }
function setOwnBetNotes(v) { ownBet.notes = String(v || '').slice(0, 280); persistOwnBet(); }
function setOwnBetDest(v) { ownBet.dest = v === 'diary' ? 'diary' : 'league'; persistOwnBet(); render(); }

function ownBetLegText(l) {
  if (l.kind === 'football') return l.match + ': ' + l.pick;
  return l.sport && l.sport !== 'Football' && l.sport !== 'Other' ? l.sport + ': ' + l.pick : l.pick;
}

// The diary entry for the slip, in the same shape the Add a bet form saves.
function buildOwnBetEntry() {
  const legs = ownBet.legs, acca = legs.length > 1;
  const odds = legs.reduce((t, l) => t * (l.odds || 0), 1), stake = Number(ownBet.stake);
  const fixtures = legs.filter(l => l.fixtureId).map(l => fixtureById(l.fixtureId)).filter(Boolean).sort((a, b) => kickoffMs(a) - kickoffMs(b));
  const first = fixtures[0];
  const user = getAuthUser();
  const handle = getUserProfile().handle;
  const entry = {
    id: 'bet-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), type: acca ? 'accumulator' : 'single',
    profile: (user && user.signedIn) ? ('@' + (user.handle || (user.name || 'User').split(' ')[0])) : (handle && handle !== 'Tester A' ? handle : 'Default'),
    date: first ? first.kickoff_utc.slice(0, 10) : new Date().toISOString().slice(0, 10),
    origin: ownBetOrigin(), bookmaker: ownBet.bookmaker.trim() || 'Bookmaker',
    odds, stake, potentialReturn: stake * odds, outcome: 'pending', timestamp: new Date().toISOString(), inLeague: false, notes: String(ownBet.notes || '').trim()
  };
  if (acca) {
    Object.assign(entry, { fixture: 'Accumulator', market: 'accumulator', marketName: 'Accumulator', selection: legs.map(ownBetLegText).join(' + '),
      legs: legs.map(l => Object.assign({ selection: ownBetLegText(l), odds: l.odds, outcome: 'pending' }, l.kind === 'football' ? { fixtureId: l.fixtureId, market: l.key } : {})) });
  } else if (legs[0].kind === 'football') {
    const l = legs[0], grp = l.key.split(':')[0];
    const names = { result: ['wins', 'Match result'], goals: ['goals', 'Total goals'], btts: ['btts', 'Both teams to score'], corners: ['corners', 'Total corners'], cards: ['cards', 'Total cards'], shots: ['shots', 'Shots on target'], dc: ['other', 'Double chance'], dnb: ['other', 'Draw no bet'], tts: ['other', 'Team to score'] }[grp] || ['other', 'Other'];
    Object.assign(entry, { match_id: l.fixtureId, fixture: l.match, market: names[0], marketName: names[1], selection: l.pick, leagueMarket: l.key });
  } else {
    Object.assign(entry, { fixture: 'Not linked to a listed match', market: 'other', marketName: 'Other', selection: ownBetLegText(legs[0]) });
  }
  return entry;
}

// Whether the slip can count in a league, and if not, why not (in plain words).
function ownBetLeagueState(entry) {
  if (ownBet.legs.some(l => l.kind !== 'football')) return { ok: false, reason: 'League bets are football match result or over/under goals picked from the match list. Typed-in selections stay in your diary.' };
  const chk = leagueBetCheck(entry);
  if (!chk.ok) return chk;
  const existing = getLeagueBetForDay(chk.day);
  if (existing) return { ok: false, reason: 'You already have a league bet for ' + chk.day + ' (' + (existing.selection || 'an earlier bet') + '). This one goes in your diary only.' };
  return chk;
}

function saveOwnBetToDiary() {
  const legs = ownBet.legs, stake = Number(ownBet.stake);
  if (!legs.length) { toast('Add at least one selection first.', 'error'); return; }
  if (legs.some(l => !(l.odds > 1))) { toast('Every selection needs odds. Type the price you were offered.', 'error'); return; }
  if (!Number.isFinite(stake) || stake <= 0) { toast('Enter a stake greater than £0.', 'error'); return; }
  const entry = buildOwnBetEntry();
  const state = ownBet.dest === 'league' ? ownBetLeagueState(entry) : null;
  try { const diary = getStoredDiary(); diary.unshift(entry); saveStoredDiary(diary); }
  catch (error) { console.error(error); toast('Could not save to this browser. Check storage space or privacy settings.', 'error'); return; }
  ownBet.legs = []; ownBet.origin = ''; ownBet.notes = ''; persistOwnBet();
  celebrateSave();
  location.hash = '#/diary';
  if (state && state.ok) enterLeagueBet(entry.id);
  else toast(state ? 'Saved to your Bet Diary only. ' + state.reason : 'Saved to your Bet Diary.');
}

function viewBuild(mode) {
  const logging = mode === 'log';
  const legs = ownBet.legs, n = legs.length;
  const priced = n > 0 && legs.every(l => l.odds > 1);
  const odds = priced ? legs.reduce((t, l) => t * l.odds, 1) : 0;
  const stake = Number(ownBet.stake) || 0;
  const m = MatchIQBuilder.money;
  const now = Date.now();

  const football = '<label class="sr-only" for="own-fixture-search">Search matches</label>' +
    '<input id="own-fixture-search" type="search" class="ctl" placeholder="🔍 Search a club or league, e.g. Arsenal" autocomplete="off" value="' + esc(ownBetUI.q || '') + '" oninput="filterOwnBetFixtures(this.value)">' +
    '<p class="own-hint cp-how">Tap a price to put it on your slip, tap it again to take it off. One pick is a single, picks from two matches a double, three a treble and so on.</p>' +
    '<div id="own-coupon" class="cp">' + ownBetCouponHtml() + '</div>';

  const custom = '<div class="own-custom">' +
    '<div class="field"><label for="own-custom-sport">Sport</label><select id="own-custom-sport" class="ctl">' + OWN_BET_SPORTS.map(s => '<option>' + s + '</option>').join('') + '</select></div>' +
    '<div class="field"><label for="own-custom-text">What did you back?</label><input id="own-custom-text" class="ctl" maxlength="120" placeholder="e.g. Djokovic to win, Both teams to score" autocomplete="off"></div>' +
    '<div class="field"><label for="own-custom-odds">Odds</label><input id="own-custom-odds" class="ctl mono" inputmode="text" placeholder="e.g. 6/4 or 2.50" autocomplete="off"></div>' +
    '<button type="button" class="btn primary" onclick="addOwnBetCustomLeg()">Add to slip</button>' +
    '<p class="own-hint">For other sports, or a football match that has already kicked off. These save to your Bet Diary and you settle them yourself. Only football matches picked from the list can count in leagues.</p></div>';

  const addCard = '<section class="card own-add"><h2 class="section-title">1. Add selections</h2>' +
    '<div class="own-tabs" role="tablist"><button type="button" role="tab" aria-selected="' + (ownBetUI.tab === 'football') + '" class="' + (ownBetUI.tab === 'football' ? 'on' : '') + '" onclick="setOwnBetTab(\'football\')">⚽ Football</button>' +
    '<button type="button" role="tab" aria-selected="' + (ownBetUI.tab === 'custom') + '" class="' + (ownBetUI.tab === 'custom' ? 'on' : '') + '" onclick="setOwnBetTab(\'custom\')">✍️ Type it in</button></div>' +
    (ownBetUI.tab === 'football' ? football : custom) + '</section>';

  let slip;
  if (!n) {
    slip = '<section class="card own-slip" id="own-slip"><h2 class="section-title">2. Your slip</h2><div class="empty">Nothing on your slip yet. Add one selection for a single, two for a double, three for a treble and so on, up to ' + OWN_BET_MAX_LEGS + '.</div></section>';
  } else {
    const entry = priced && stake > 0 ? buildOwnBetEntry() : null;
    const state = entry ? ownBetLeagueState(entry) : null;
    const signedIn = (getAuthUser() || {}).signedIn;
    const rows = legs.map(l => '<li class="own-leg"><div class="own-leg-main"><b>' + esc(l.pick) + '</b><small>' + esc(l.kind === 'football' ? (l.market ? l.market + ' · ' : '') + l.match : (l.sport || 'Other') + ' · typed in') + '</small>' +
      (l.est ? '<small class="own-est">Estimated price: change it to the one you were offered</small>' : '') + '</div>' +
      '<label class="sr-only" for="odds-' + esc(l.id) + '">Odds for ' + esc(l.pick) + '</label>' +
      '<input id="odds-' + esc(l.id) + '" class="ctl mono own-leg-odds" inputmode="text" value="' + esc(ownBetOddsText(l.odds)) + '" placeholder="odds" onchange="setOwnBetLegOdds(\'' + esc(l.id) + '\', this.value)">' +
      '<button type="button" class="icon-btn" aria-label="Remove ' + esc(l.pick) + '" onclick="removeOwnBetLeg(\'' + esc(l.id) + '\')">&times;</button></li>').join('');
    const leagueNote = ownBet.dest !== 'league' ? '' :
      !state ? '<p class="own-hint">Enter your odds and stake to check league eligibility.</p>' :
      state.ok ? '<p class="own-ok">✓ Eligible for leagues' + (signedIn ? '.' : '. Sign in with Google to enter it.') + '</p>' :
      '<p class="own-warn">Diary only: ' + esc(state.reason) + '</p>';
    const fxIds = legs.filter(l => l.fixtureId).map(l => l.fixtureId);
    const sameMatch = fxIds.length !== new Set(fxIds).size;
    slip = '<section class="card own-slip" id="own-slip"><div class="own-slip-head"><h2 class="section-title">2. Your slip</h2><span class="own-kind">' + esc(ownBetName(n)) + '</span></div>' +
      '<ul class="own-legs">' + rows + '</ul>' +
      (sameMatch ? '<p class="own-warn">Two picks from the same match. Most bookmakers only take that as a Bet Builder, not a normal ' + esc(ownBetName(n).toLowerCase()) + ', and it cannot count in leagues.</p>' : '') +
      '<div class="own-sum"><span>Combined odds <b class="mono">' + (priced ? esc(fmtOdds(odds)) : '—') + '</b></span>' +
      '<span>Returns <b class="mono">' + (priced && stake > 0 ? m(stake * odds) : '—') + '</b></span></div>' +
      '<div class="own-who" role="radiogroup" aria-label="Whose pick was it?"><span>Whose pick?</span>' +
        [['independent', '💡 My own idea'], ['matchiq', '🎯 Bet Buddy pick']].map(o => '<button type="button" role="radio" aria-checked="' + (ownBetOrigin() === o[0]) + '" onclick="setOwnBetOrigin(\'' + o[0] + '\')">' + o[1] + '</button>').join('') + '</div>' +
      '<div class="own-fields"><div class="field"><label for="own-stake">Stake (£)</label><input id="own-stake" type="number" class="ctl mono" step="0.50" min="0.50" max="10000" value="' + esc(stake ? stake.toFixed(2) : '') + '" onchange="setOwnBetStake(this.value)"></div>' +
      '<div class="field"><label for="own-bookie">Bookmaker (optional)</label><input id="own-bookie" class="ctl" maxlength="40" value="' + esc(ownBet.bookmaker) + '" placeholder="e.g. Bet365" onchange="setOwnBetBookmaker(this.value)"></div>' +
      '<div class="field own-note"><label for="own-notes">Note (optional)</label><input id="own-notes" class="ctl" maxlength="280" value="' + esc(ownBet.notes || '') + '" placeholder="e.g. cash out offered at half-time" onchange="setOwnBetNotes(this.value)"></div></div>' +
      '<div class="dest-toggle-group" role="radiogroup" aria-label="Where to save">' +
        '<label class="dest-opt"><input type="radio" name="own-dest" value="league"' + (ownBet.dest === 'league' ? ' checked' : '') + ' onchange="setOwnBetDest(\'league\')"><div class="dest-opt-content"><span class="dest-opt-title">🏆 Bet Diary &amp; League</span><span class="dest-opt-sub">Your 1 qualifying bet for the day, football only.</span></div></label>' +
        '<label class="dest-opt diary-only"><input type="radio" name="own-dest" value="diary"' + (ownBet.dest === 'diary' ? ' checked' : '') + ' onchange="setOwnBetDest(\'diary\')"><div class="dest-opt-content"><span class="dest-opt-title">📓 Bet Diary only</span><span class="dest-opt-sub">Private. Does not affect league scores.</span></div></label></div>' +
      leagueNote +
      '<div class="btn-row"><button type="button" class="btn primary" onclick="saveOwnBetToDiary()">' + (ownBet.dest === 'league' ? 'Save to Diary &amp; League' : 'Save to Bet Diary') + '</button>' +
      '<button type="button" class="btn small" onclick="clearOwnBet()">Clear slip</button></div>' +
      '<p class="own-hint">Bet Buddy never places bets. Place yours with your bookmaker, then log it here. 18+. Play safe.</p></section>';
  }

  return '<section class="view own-build">' +
    '<div class="picks-top-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' + (logging ? '<a href="#/diary" class="btn small" style="text-decoration:none">← Bet Diary</a>' : '<a href="#/" class="btn small" style="text-decoration:none">← Welcome Hub</a>') + '</div>' +
    (logging
      ? '<h1 class="page-title">Log a bet</h1><p class="page-sub">Placed a bet with your bookmaker? Find the match, tap the prices you backed, then add your stake. It goes straight into your Diary and, for football, can count in your League.</p>'
      : '<h1 class="page-title">Build your own bet</h1><p class="page-sub">Singles, doubles, trebles, 4-folds, 5-folds and bigger. Add your selections, then save the bet to your Diary and, for football, your League.</p>') +
    '<div class="own-cols">' + addCard + slip + '</div></section>';
}

// ------------------------------------------------------------ How To guide
function viewGuide() {
  const step = (n, title, body) => '<li class="guide-step"><span class="guide-step-num">' + n + '</span><div><b>' + title + '</b><span>' + body + '</span></div></li>';
  const sec = (id, icon, title, inner, open) => '<details class="guide-sec card" id="guide-' + id + '"' + (open ? ' open' : '') + '><summary><span class="guide-ico">' + icon + '</span><span>' + title + '</span></summary><div class="guide-body">' + inner + '</div></details>';
  const jump = [['start', 'Quick start'], ['around', 'Finding your way'], ['picks', 'Reading a pick'], ['acca', 'Build an acca'], ['diary', 'Bet Diary'], ['private', 'Private leagues'], ['regional', 'Regional leagues'], ['rules', 'League rules'], ['faq', 'FAQ']];
  const jumpHtml = '<div class="guide-jump">' + jump.map(j => '<button type="button" data-guide-jump="' + j[0] + '">' + j[1] + '</button>').join('') + '</div>';

  const start = '<ol class="guide-steps">' +
    step(1, 'Browse the picks', 'Open <b>Picks</b> to see every upcoming match with the model&rsquo;s view. No account needed.') +
    step(2, 'Check the price', 'Bet Buddy compares its own probability with UK bookmaker prices. A pick is only flagged as value when the price is better than the chance deserves.') +
    step(3, 'Log your bet', 'Tap <b>Add a bet</b> in the <b>Diary</b> and record the odds and stake. Your private profit &amp; loss builds up automatically.') +
    step(4, 'Compete', 'Sign in with Google, then create a private league with mates or just play: your league bets also climb the regional ladders.') +
    '</ol>' +
    '<p class="guide-tip">Bet Buddy never places bets for you. It helps you decide, then you place the bet with your own bookmaker.</p>';

  const around = '<div class="guide-grid">' +
    '<div><b>🏠 Home</b><span>The welcome hub: today&rsquo;s best-value bet, BetAI and shortcuts.</span></div>' +
    '<div><b>🎯 Picks</b><span>The Bet Builder and a card for every upcoming match with its lean and verdict.</span></div>' +
    '<div><b>📅 Fixtures</b><span>The full schedule by competition. Tap a match for its full analysis page.</span></div>' +
    '<div><b>📊 Record</b><span>Every football prediction is sealed before kick-off and marked right or wrong afterwards, league by league. For scores, see Fixtures → Results.</span></div>' +
    '<div><b>📖 Diary</b><span>Your private record of bets, with profit, ROI and win rate.</span></div>' +
    '<div><b>🏆 Leagues</b><span>Private leagues with friends plus the automatic regional ladders.</span></div>' +
    '<div><b>⋯ More</b><span>Your profile and location, data sources, feedback and app version.</span></div>' +
    '<div><b>6/4 &#8596; 2.50</b><span>The toggle at the top switches every price between fractional and decimal.</span></div>' +
    '</div>';

  const picks = '<p>Each pick card shows a few simple things:</p><ul class="guide-list">' +
    '<li><b>Probability</b> &ndash; the model&rsquo;s estimate of how likely the outcome is.</li>' +
    '<li><b>Fair odds</b> &ndash; 1 &divide; probability, shown as a familiar UK price. It is not a bookmaker price.</li>' +
    '<li><b>Value</b> &ndash; flagged only when a recent bookmaker price is longer than the fair odds. A likely outcome at a short price is <i>not</i> value.</li>' +
    '<li><b>No bet</b> &ndash; a real answer. Bet Buddy says it when evidence is thin or the price is not good enough.</li>' +
    '<li><b>Provisional</b> &ndash; the estimate has little track record yet, so treat it with extra caution.</li></ul>' +
    '<p class="guide-tip">Estimates are for information and entertainment. A high probability is not a guarantee.</p>';

  const acca = '<ol class="guide-steps">' +
    step(1, 'Open the Bet Builder', 'Go to <b>Picks</b>. Choose today&rsquo;s games or the 7-day slate.') +
    step(2, 'Set your target', 'Enter your stake and how much you would like to win.') +
    step(3, 'Review the acca', 'Bet Buddy suggests legs and shows the combined odds, the probability of every leg landing and the expected value.') +
    step(4, 'Use the slip note','Pick your bookmaker, then tick legs off as you enter them in their app, or copy the selections with one tap.') +
    step(5, 'Share it', 'Send the slip link to a mate and their Bet Builder opens pre-filled.') +
    '</ol><p class="guide-tip">An acca only pays if <b>every</b> leg wins. More legs means bigger returns but a much lower chance.</p>';

  const diary = '<ol class="guide-steps">' +
    step(1, 'Add a bet', 'Tap <b>Add a bet</b> in the Diary, or log a pick straight from a match. Enter the selection, the odds you were offered and your stake.') +
    step(2, 'Choose where it counts', 'Under <b>League participation</b> pick <i>Add to Bet Diary &amp; to League</i> or <i>Diary only</i>. Diary-only bets never affect league scores.') +
    step(3, 'Let it settle', 'Results update automatically after the final whistle, and your profit, ROI and win rate update with them.') +
    step(4, 'Keep it safe', 'Signed-in diaries sync to your account. Otherwise the diary lives only in this browser, so use <b>Backup</b> and <b>Import</b> to move it, and avoid clearing site data.') +
    '</ol>';

  const priv = '<h3>Create a league</h3><ol class="guide-steps">' +
    step(1, 'Sign in', 'Leagues need a Google sign-in (button at the top right). Pick your username at the same time.') +
    step(2, 'Open Leagues', 'Tap the <b>Leagues</b> tab, then <b>Create or Join League</b>.') +
    step(3, 'Fill in the details', 'On <b>Create a League</b> choose a name (up to 32 characters), an icon and a duration: <b>Weekly</b> (resets every Monday 00:00), <b>Monthly</b> or <b>Yearly</b>.') +
    step(4, 'Get your invite', 'Tap <b>Create League &amp; Get Invite Code</b>. Share the code or link with <b>Invite Friends</b>.') +
    '</ol><h3>Join a league</h3><ol class="guide-steps">' +
    step(1, 'Using a link', 'Open the invite link. Sign in if asked and the join screen opens with the code filled in.') +
    step(2, 'Using a code', 'Go to <b>Leagues</b> &rarr; <b>Create or Join League</b> &rarr; <b>Join with Code</b>. Paste the 8-character code and tap <b>Join League</b>.') +
    '</ol><h3>Managing it</h3><ul class="guide-list">' +
    '<li>Switch between <b>Weekly / Monthly / Yearly</b> tables above the league table.</li>' +
    '<li>The creator can <b>Rename</b> or <b>Delete</b> the league; everyone else can <b>Leave</b>.</li>' +
    '<li>The top three each period win Gold, Silver and Bronze for your Trophy Cabinet.</li>' +
    '<li>You can be in as many leagues as you like. Your one qualifying bet a day counts in all of them.</li></ul>';

  const regional = '<p>You do not need to join anything. Once your location is set, every league bet you make is entered on <b>six ladders</b> automatically:</p>' +
    '<div class="guide-tiers"><span>🏘️ Hometown</span><span>🏛️ Region / County</span><span>🏴 Country</span><span>🇬🇧 UK</span><span>🇪🇺 Europe</span><span>🌍 Worldwide</span></div>' +
    '<ol class="guide-steps">' +
    step(1, 'Set your location', 'Go to <b>More</b> &rarr; <b>Account</b> &rarr; <b>Edit Profile &amp; Location</b> and enter your town, region and country. Players who spell a place the same way land on the same ladder.') +
    step(2, 'Place a league bet', 'Log a bet with <i>Add to Bet Diary &amp; to League</i> before kick-off. Once it settles it scores on all your ladders.') +
    step(3, 'Check the ladders', 'On <b>Leagues</b>, scroll to <b>Automatic Geographical Leagues</b> and pick a ladder. Use Weekly / Monthly / Yearly to change the period.') +
    '</ol><p class="guide-tip">Ladders show the top 50 players and refresh every 30 minutes, so a new result can take a little while to appear. If a ladder asks you to add your location, finish step 1.</p>';

  const rules = '<ul class="guide-list">' +
    '<li><b>Win:</b> (bookmaker price &minus; 1) &times; 10 points. Evens = 10 pts. Prices count up to 10/1, so 100 pts is the most one bet can score.</li>' +
    '<li><b>Loss:</b> &minus;2 points.</li>' +
    '<li><b>One league bet per match day</b>, logged before kick-off. Extra bets that day go to your Diary only.</li>' +
    '<li><b>What counts:</b> a single, or an accumulator, on any football market that settles from the final score: match result, double chance, draw no bet, both teams to score and goals over/under. Corners, cards, shots and other sports stay in your Diary. Leg prices are multiplied (still capped at 10/1). One losing leg loses the acca; a postponed or void leg drops out.</li><li><b>Which price:</b> the league uses a recorded bookmaker price where there is one. Double chance and draw no bet are worked out from the three result prices; both teams to score and other goals lines use Bet Buddy&rsquo;s model price less a typical bookmaker margin. The odds you type never count.</li>' +
    '<li><b>Fair play:</b> the league server records the bookmaker price when you log the bet and settles it from the official result, so scores cannot be edited.</li>' +
    '<li><b>Locked in:</b> once the match has kicked off a league bet stands and cannot be removed.</li></ul>';

  const faq = '<details class="guide-q"><summary>Do I need an account?</summary><p>Not for picks, fixtures, results or a local diary. Google sign-in is needed for leagues, ladders and cross-device diary sync.</p></details>' +
    '<details class="guide-q"><summary>I joined a league but cannot see anyone else.</summary><p>Members appear as they join. Check you used the right 8-character code, then share the invite link again.</p></details>' +
    '<details class="guide-q"><summary>Why am I not on a ladder?</summary><p>You need a location in your profile and at least one settled league bet in the current period.</p></details>' +
    '<details class="guide-q"><summary>Can I change my username or location?</summary><p>Yes, under <b>More</b> &rarr; <b>Account</b>. Ladders update at the next refresh.</p></details>' +
    '<details class="guide-q"><summary>Something looks wrong.</summary><p>Use <b>Report a Bug</b> in the page footer, or <b>Force App Sync</b> under <b>More</b> to load the latest version.</p></details>' +
    '<p class="guide-tip">18+ only. Bet with money you can afford to lose. Help is available at <a href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware.org</a> and <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener">GamCare</a>.</p>';

  return '<section class="view guide-view">' +
    '<div class="section-head"><div><h1 class="page-title">How to use Bet Buddy</h1>' +
    '<p class="page-sub">A two-minute walkthrough of every feature, plus how to start private leagues and climb the regional ladders.</p></div>' +
    '<div class="btn-row"><a href="#/leagues" class="btn primary" style="text-decoration:none">Go to Leagues</a><a href="#/picks" class="btn" style="text-decoration:none">Go to Picks</a></div></div>' +
    jumpHtml +
    sec('start', '🚀', 'Quick start', start, true) +
    sec('around', '🧭', 'Finding your way around', around) +
    sec('picks', '🎯', 'Reading a pick', picks) +
    sec('acca', '⚡', 'Build an acca with the Bet Builder', acca) +
    sec('diary', '📖', 'Track bets in your Diary', diary) +
    sec('private', '👥', 'Private leagues: create &amp; join', priv) +
    sec('regional', '🏛️', 'Regional leagues &amp; ladders', regional) +
    sec('rules', '📏', 'League scoring &amp; rules', rules) +
    sec('faq', '❓', 'FAQ &amp; help', faq) +
  '</section>';
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
    (isAppOwner() ? '<a href="#/admin" class="more-nav-btn" style="text-decoration:none;text-align:center;border-color:var(--cyan);color:var(--cyan)">📈 Telemetry</a>' : '') +
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

// Open the league modal on the Join tab with the invite code pre-filled.
function showJoinLeagueModal(code) {
  const inp = $('join-league-code');
  if (inp) inp.value = code || '';
  $('create-league-form').hidden = true;
  $('join-league-form').hidden = false;
  $('tab-join-league').classList.add('active');
  $('tab-create-league').classList.remove('active');
  $('league-modal').hidden = false;
}

let sharedSlipNotice = false;
function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash.startsWith('join-league=')) {
    try {
      const code = decodeURIComponent(hash.slice(12)).trim().toUpperCase();
      // Consume the invite link so later re-renders do not join again (each join re-renders).
      try { history.replaceState(null, '', location.pathname + location.search + '#/leagues'); } catch (e) { /* ignore */ }
      const u = getAuthUser();
      if (u && u.signedIn) showJoinLeagueModal(code);
      else {
        // Sign in first; the modal opens with the code once sign-in completes.
        try { sessionStorage.setItem('betbuddy_invite_code', code); } catch (e) { /* ignore */ }
        toast('Sign in with Google to join this league');
        openAuthModal();
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
        '<p class="muted" style="font-size:13px;line-height:1.5">Direct outbound links into licensed UK sportsbooks (Sky Bet, Bet365, William Hill, Paddy Power, Betfair, Coral, Ladbrokes).</p>' +
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

// Telemetry dashboard is visible only to the app owner's signed-in, verified account.
const OWNER_EMAILS = ['headpark@gmail.com'];
function isAppOwner() {
  const u = getAuthUser();
  return Boolean(u && u.emailVerified && OWNER_EMAILS.includes((u.email || '').toLowerCase()));
}

// Owner-only snapshot of every private league in Firestore (rules allow the list for the owner only).
let adminLeagueStats = null;
let adminLeagueLoading = false;
async function loadAdminLeagueStats() {
  if (adminLeagueLoading || !isAppOwner()) return;
  if (!firestoreDb) { adminLeagueStats = { error: 'cloud offline' }; render(); return; }
  adminLeagueLoading = true;
  try {
    const snap = await firestoreDb.collection('leagues').get();
    const leagues = await Promise.all(snap.docs.map(async doc => {
      const d = doc.data() || {};
      const memSnap = await doc.ref.collection('members').get().catch(() => null);
      const members = memSnap ? memSnap.docs.map(m => ({ uid: m.id, ...m.data() })) : [];
      const creator = members.find(m => m.uid === d.creatorUid);
      const leader = members.slice().sort((a, b) => (+b.points || 0) - (+a.points || 0))[0];
      const created = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate() : (d.createdAt ? new Date(d.createdAt) : null);
      return {
        code: doc.id, name: d.name || doc.id, icon: d.icon || '🏆', freq: d.freq || '',
        created, creator: creator ? creator.handle : '', leader: leader ? leader.handle : '',
        members: memSnap ? members.length : (+d.memberCount || 0),
        memberUids: members.map(m => m.uid)
      };
    }));
    leagues.sort((a, b) => b.members - a.members || a.name.localeCompare(b.name));
    adminLeagueStats = { leagues, uniqueMembers: new Set(leagues.flatMap(l => l.memberUids)).size, loadedAt: new Date() };
  } catch (e) {
    console.warn('Admin league stats failed:', e);
    adminLeagueStats = { error: (e && e.code) || 'unavailable' };
  }
  adminLeagueLoading = false;
  if (currentRoute()[0] === 'admin') render();
}

// Owner-only count of real Firebase Auth accounts (browsers can't list them, so a Cloud Function does).
let adminUserStats = null;
let adminUserLoading = false;
async function loadAdminUserStats() {
  if (adminUserLoading || !isAppOwner() || !firebaseAuth || !firebaseAuth.currentUser) return;
  adminUserLoading = true;
  try {
    const token = await firebaseAuth.currentUser.getIdToken();
    const res = await fetch('https://europe-west1-betbuddyuk.cloudfunctions.net/ownerUserStats', { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    adminUserStats = await res.json();
  } catch (e) {
    console.warn('Admin user stats failed:', e);
    adminUserStats = { error: (e && e.message) || 'unavailable' };
  }
  adminUserLoading = false;
  if (currentRoute()[0] === 'admin') render();
}

function renderAdminUsersSection() {
  const s = adminUserStats;
  if (!s && !adminUserLoading) setTimeout(loadAdminUserStats, 0);
  const head = '<div class="section-head"><h2 class="section-title">Registered Users</h2><span class="section-note">Real Firebase sign-ins, counted on the server.</span></div>';
  if (!s) return '<div class="section" style="margin-top:28px">' + head + '<p class="muted">Counting sign-ins…</p></div>';
  if (s.error) return '<div class="section" style="margin-top:28px">' + head + '<p class="muted">Could not load user counts (' + esc(s.error) + '). Tap Refresh Telemetry to retry.</p></div>';
  return '<div class="section" style="margin-top:28px">' + head +
    '<div class="admin-metric-grid">' +
      '<div class="admin-metric-card"><div>Signed in with Google</div><div class="admin-metric-val cyan">' + s.google + '</div><div class="admin-metric-sub">' + s.total + ' accounts in total</div></div>' +
      '<div class="admin-metric-card"><div>New this week</div><div class="admin-metric-val emerald">' + s.new7 + '</div><div class="admin-metric-sub">Accounts created in the last 7 days</div></div>' +
      '<div class="admin-metric-card"><div>Active this week</div><div class="admin-metric-val amber">' + s.active7 + '</div><div class="admin-metric-sub">Signed in during the last 7 days</div></div>' +
    '</div></div>';
}

function renderAdminLeaguesSection() {
  const head = '<div class="section-head"><h2 class="section-title">Private Buddy Leagues</h2><span class="section-note">Every private league in the cloud, biggest first.</span></div>';
  const s = adminLeagueStats;
  if (!s) {
    if (!adminLeagueLoading) setTimeout(loadAdminLeagueStats, 0);
    return '<div class="section" style="margin-top:28px">' + head + '<p class="muted">Loading leagues from the cloud…</p></div>';
  }
  if (s.error) {
    return '<div class="section" style="margin-top:28px">' + head + '<p class="muted">Could not load leagues (' + esc(s.error) + '). Sign in with Google as the owner account and tap Refresh Telemetry.</p></div>';
  }
  const ls = s.leagues;
  const memberships = ls.reduce((sum, l) => sum + l.members, 0);
  const biggest = ls[0];
  const rows = ls.map(l => '<tr>' +
    '<td><b>' + esc(l.icon) + ' ' + esc(l.name) + '</b><br><small class="muted mono">' + esc(l.code) + '</small></td>' +
    '<td class="mono">' + l.members + '</td>' +
    '<td>' + (l.creator ? '@' + esc(l.creator) : '<span class="dim">not in league</span>') + '</td>' +
    '<td>' + (l.leader ? '@' + esc(l.leader) : '<span class="dim">–</span>') + '</td>' +
    '<td class="dim">' + esc(l.freq) + '</td>' +
    '<td class="dim" style="font-size:12px;white-space:nowrap">' + (l.created && !isNaN(l.created) ? esc(l.created.toLocaleDateString()) : '–') + '</td>' +
    '<td><button type="button" class="btn small" data-admin-action="delete-league" data-code="' + esc(l.code) + '" style="background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);">Delete</button></td>' +
  '</tr>').join('');
  return '<div class="section" style="margin-top:28px">' + head +
    '<div class="admin-metric-grid">' +
      '<div class="admin-metric-card"><div>Private Leagues</div><div class="admin-metric-val cyan">' + ls.length + '</div><div class="admin-metric-sub">Loaded ' + esc(s.loadedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) + '</div></div>' +
      '<div class="admin-metric-card"><div>Players in Leagues</div><div class="admin-metric-val">' + s.uniqueMembers + '</div><div class="admin-metric-sub">' + memberships + ' memberships in total</div></div>' +
      '<div class="admin-metric-card"><div>Average League Size</div><div class="admin-metric-val amber">' + (ls.length ? (memberships / ls.length).toFixed(1) : '0') + '</div><div class="admin-metric-sub">Members per league</div></div>' +
      '<div class="admin-metric-card"><div>Biggest League</div><div class="admin-metric-val emerald">' + (biggest ? biggest.members : 0) + '</div><div class="admin-metric-sub">' + (biggest ? esc(biggest.icon + ' ' + biggest.name) : 'No leagues yet') + '</div></div>' +
    '</div>' +
    '<div class="admin-table-card" style="overflow-x:auto">' +
      '<table class="admin-table">' +
        '<thead><tr><th>League</th><th>Members</th><th>Creator</th><th>Leader</th><th>Period</th><th>Created</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="7" class="muted" style="text-align:center;padding:20px">No private leagues created yet.</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>' +
  '</div>';
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

    renderAdminUsersSection() +
    renderAdminLeaguesSection() +

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
            '<button type="button" class="sport-odds-btn" data-open-bookie=\'' + betData + '\' title="Open on ' + esc(sel.bookmaker) + '">' + esc(sel.fractional) + '</button>' +
            '<button type="button" class="btn small" data-diary=\'' + betData + '\' title="Add to Bet Diary">+ Diary</button>' +
            '<button type="button" class="btn small own-add-btn" data-own-bet=\'' + betData + '\' title="Add to my own bet slip">+ My bet</button>' +
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
      '<span class="section-note">' + esc(t.course || t.venue || t.surface || 'Live UK Bookmaker Prices') + '</span></div>' +
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
  let [view, arg] = currentRoute();
  if (view === 'admin' && !isAppOwner()) view = 'home';
  // Live league listeners cost a read per member update; keep them only while Leagues is open.
  if (view !== 'leagues' && currentLeagueListeningCode) stopLeagueListeners();
  const navKey = view === 'match' ? 'fixtures' : view;
  document.querySelectorAll('.nav a').forEach(a => { if (a.dataset.nav === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  updateOddsToggleLabel(); updateHeaderAuthUI();
  const html = view === 'picks' ? viewPicks() : view === 'fixtures' ? viewFixtures() : view === 'match' ? viewMatch(arg) : view === 'results' ? viewResults() : view === 'diary' ? viewDiary() : view === 'leagues' ? viewLeagues() : view === 'admin' ? viewAdmin() : view === 'guide' ? viewGuide() : view === 'build' ? viewBuild(arg) : view === 'commercial' ? viewCommercial() : view === 'more' ? viewMore() : viewHome();
  $('app').innerHTML = html;
  const titles = { home: 'Welcome Hub', picks: 'Picks & Acca Builder', build: 'Build your own bet', fixtures: 'Fixtures', match: 'Match analysis', results: 'Our prediction record', diary: 'Bet Diary', leagues: 'Buddy Leagues', guide: 'How to use Bet Buddy', admin: 'Founder Admin & Affiliates', commercial: 'Commercial & Sponsorship', more: 'Data & methods' };
  document.title = (view === 'build' && arg === 'log' ? 'Log a bet' : titles[view] || 'Bet Buddy') + ' · Bet Buddy';
  const key = view + '/' + arg;
  if (key !== lastRoute) {
    // Animate and scroll only on navigation, not on in-page updates.
    const first = $('app').querySelector('.view');
    if (first) first.classList.add('enter');
    window.scrollTo({ top: 0 });
    lastRoute = key;
  }
  updateOwnBetBar();
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

// Gamertag-style username: strips '@', spaces and symbols so a Google display name like "Alan Park" shows as "AlanPark"
function toUsername(raw, email) {
  let u = String(raw || '').replace(/^@+/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 20);
  if (u.length < 3 && email) u = String(email).split('@')[0].replace(/[^A-Za-z0-9_]/g, '').slice(0, 20);
  return u.length >= 3 ? u : 'Punter';
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

  username = toUsername(username, activeUser.email);

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
    handle: toUsername(username, user.email),
    photoURL: user.photoURL || '',
    isGoogle: true
  };
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(cachedAuthUser));
  } catch (e) {}
  updateHeaderAuthUI();
}

class HandleTakenError extends Error {}

// Claims a gamertag in the handles registry and writes the public profile in one transaction.
// Registry entries are create-only in the rules, so an entry this player already owns is left alone.
async function claimHandleTransaction(uid, handle, avatar = '⚽', location = null) {
  if (!firestoreDb) throw new Error('Firestore not initialized');
  if (!isValidHandle(handle)) throw new Error('Gamertag must be 3–20 letters, numbers, or underscores.');

  const handleLower = handle.toLowerCase();
  const handlesCol = firestoreDb.collection('handles');
  const handleRef = handlesCol.doc(handleLower);
  const userRef = firestoreDb.collection('users').doc(uid);
  const now = firebase.firestore.FieldValue.serverTimestamp();

  return firestoreDb.runTransaction(async tx => {
    const handleDoc = await tx.get(handleRef);
    if (handleDoc.exists && (handleDoc.data() || {}).uid !== uid) {
      throw new HandleTakenError('This gamertag is already taken. Please choose another.');
    }
    const userDoc = await tx.get(userRef);
    const existingUserData = userDoc.exists ? userDoc.data() : null;

    let oldHandleDoc = null;
    if (existingUserData && existingUserData.handle && existingUserData.handle.toLowerCase() !== handleLower) {
      const oldDoc = await tx.get(handlesCol.doc(existingUserData.handle.toLowerCase()));
      if (oldDoc.exists && (oldDoc.data() || {}).uid === uid) oldHandleDoc = oldDoc.ref;
    }

    if (!handleDoc.exists) tx.set(handleRef, leagueDocs.handleDoc({ uid, handle, now }));
    if (oldHandleDoc) tx.delete(oldHandleDoc);

    // Keep the saved location unless a new one was chosen.
    const place = location || (existingUserData ? { town: existingUserData.town, region: existingUserData.region, country: existingUserData.country } : null);
    const profile = leagueDocs.userProfileDoc({ handle, avatar, now, isNew: true, location: place });
    if (existingUserData && existingUserData.createdAt) profile.createdAt = existingUserData.createdAt;
    tx.set(userRef, profile);
  });
}

// Reserves `wanted`, or a numbered variant of it if someone else already has it.
async function claimFreeHandle(uid, wanted, avatar) {
  let handle = wanted;
  for (let attempt = 0; ; attempt++) {
    try {
      await claimHandleTransaction(uid, handle, avatar || '⚽');
      return handle;
    } catch (e) {
      if (!(e instanceof HandleTakenError) || attempt >= 4) throw e;
      handle = wanted.slice(0, 16) + String(1000 + Math.floor(Math.random() * 9000));
    }
  }
}

async function ensureUserProfile(user) {
  if (!user) return;
  try {
    let baseHandle = (user.displayName || (user.email ? user.email.split('@')[0] : 'Punter'))
      .replace(/[^A-Za-z0-9_]/g, '');
    if (baseHandle.length < 3) baseHandle = 'Player' + String(user.uid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
    if (baseHandle.length > 20) baseHandle = baseHandle.slice(0, 20);

    if (firestoreDb) {
      const userDocRef = firestoreDb.collection('users').doc(user.uid);
      const userDoc = await userDocRef.get();
      if (userDoc.exists) {
        currentAuthProfile = userDoc.data();
        // Leaderboards only accept a gamertag reserved in the registry by its owner. Older
        // profiles may never have reserved theirs, so reserve it now (or a free variant).
        const saved = currentAuthProfile.handle;
        const reg = isValidHandle(saved) ? await firestoreDb.collection('handles').doc(saved.toLowerCase()).get() : null;
        if (!reg || !reg.exists || (reg.data() || {}).uid !== user.uid) {
          const handle = await claimFreeHandle(user.uid, isValidHandle(saved) ? saved : baseHandle, currentAuthProfile.avatar);
          currentAuthProfile = { handle, avatar: currentAuthProfile.avatar || '⚽' };
        }
        const cur = getUserProfile();
        saveUserProfile(currentAuthProfile.handle || cur.handle, currentAuthProfile.town || cur.town, currentAuthProfile.region || cur.region, currentAuthProfile.country || cur.country);
        saveAuthUser(user);
        return;
      }
      // New player: reserve a unique gamertag, adding digits if the name is already taken.
      const handle = await claimFreeHandle(user.uid, baseHandle, '⚽');
      currentAuthProfile = { handle, avatar: '⚽' };
      saveUserProfile(handle);
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
    const username = user.handle || 'Punter';
    const initials = username.slice(0, 1).toUpperCase();
    container.innerHTML = '<div style="display:flex;align-items:center;gap:6px;">' +
      (isAppOwner() ? '<a href="#/admin" class="btn small" title="Owner telemetry dashboard" style="min-height:32px;padding:2px 8px;font-size:11px;text-decoration:none;border:1px solid var(--cyan);color:var(--cyan);">📈 Telemetry</a>' : '') +
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
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    // Popup first on every device: redirect sign-in loses its session on iOS/PWAs because the
    // auth domain differs from the site origin (partitioned storage), leaving the user logged out.
    const cred = await firebaseAuth.signInWithPopup(provider);
    if (cred && cred.user) {
      currentAuthUser = cred.user;
      saveAuthUser(cred.user);
    }
    closeAuthModal();
    toast('Signed in with Google! ⚽');
    updateHeaderAuthUI();
    render();
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
      try {
        await firebaseAuth.signInWithRedirect(provider);
        return;
      } catch (rErr) {
        showAuthError('signin-error', mapAuthError(rErr));
        toast(mapAuthError(rErr));
      }
    } else {
      showAuthError('signin-error', mapAuthError(err));
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') toast(mapAuthError(err));
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
    try { betai.remaining = null; betai.result = null; betai.error = ''; if ($('betai-modal') && !$('betai-modal').hidden) openBetAI(); } catch (e) {}
    currentAuthUser = user;
    if (user) {
      // Reflect the signed-in state immediately; cloud sync below must never block or break it.
      try { saveAuthUser(user); } catch (e) { console.warn('saveAuthUser notice:', e); }
      updateHeaderAuthUI();
      render();
      try {
        await ensureUserProfile(user);
        hasSyncedUserLeagues = false;
        listenToMyLeagueData(user.uid);
        await syncUserLeaguesFromCloud();
        try { await syncDiaryFromCloud(); } catch (e) {}

        // Preserve pending league invite across sign-in popup/redirect
        const inviteCode = sessionStorage.getItem('betbuddy_invite_code');
        if (inviteCode) {
          sessionStorage.removeItem('betbuddy_invite_code');
          setTimeout(() => { showJoinLeagueModal(inviteCode); }, 600);
        }
        const pendingLeague = sessionStorage.getItem('betbuddy_pending_join_league');
        if (pendingLeague) {
          sessionStorage.removeItem('betbuddy_pending_join_league');
          setTimeout(() => { joinCloudLeague(pendingLeague); }, 600);
        }
      } catch (e) {
        console.warn('Post sign-in sync notice:', e);
      }
    } else {
      currentAuthUser = null;
      stopMyLeagueListeners();
      currentAuthProfile = null;
      // Do NOT wipe cachedAuthUser here: onAuthStateChanged fires with null on initial boot before resolving session.
      // Explicit sign-out is handled by handleSignOut().
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

  // Slip note single launch
  if (t.dataset.launchButlerSingle !== undefined || (t.closest && t.closest('[data-launch-butler-single]'))) {
    const btn = t.dataset.launchButlerSingle !== undefined ? t : t.closest('[data-launch-butler-single]');
    try {
      const data = JSON.parse(btn.dataset.launchButlerSingle);
      launchButlerSingle(data);
    } catch (e) { console.error(e); }
    return;
  }

  // Football acca addition
  if (t.dataset.ownBet !== undefined) {
    try { addToOwnBet(JSON.parse(t.dataset.ownBet)); } catch (e) { console.error(e); }
    return;
  }
  if (t.dataset.addFootballAcca !== undefined || t.dataset.addCrossAcca !== undefined) {
    try { addToOwnBet(JSON.parse(t.dataset.addFootballAcca !== undefined ? t.dataset.addFootballAcca : t.dataset.addCrossAcca)); } catch (e) { console.error(e); }
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
      adminLeagueStats = null;
      adminUserStats = null;
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
    } else if (act === 'delete-league') {
      const code = t.dataset.code;
      const lg = adminLeagueStats && adminLeagueStats.leagues && adminLeagueStats.leagues.find(x => x.code === code);
      if (!code || !isAppOwner() || !firestoreDb) return;
      if (!confirm('Permanently delete "' + (lg ? lg.name : code) + '" (' + code + ') and its ' + (lg ? lg.members : 0) + ' member record(s)?')) return;
      (async () => {
        try {
          const ref = firestoreDb.collection('leagues').doc(code);
          const mem = await ref.collection('members').get();
          await Promise.all(mem.docs.map(m => m.ref.delete()));
          await ref.delete();
          adminLeagueStats = null;
          toast('League deleted.');
        } catch (e) {
          console.warn('League delete failed:', e);
          toast('Delete failed (' + ((e && e.code) || 'error') + ').');
        }
        render();
      })();
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
  if (t.id === 'header-auth-btn' || t.id === 'header-user-btn' || t.dataset.openAuth !== undefined || t.closest('#header-auth-btn') || t.closest('#header-user-btn') || t.closest('.google-sub-btn')) { openAuthModal(); return; }
  if (t.dataset.closeAuth !== undefined || t.closest('[data-close-auth]')) { closeAuthModal(); return; }
  if (t.id === 'btn-auth-google' || t.closest('#btn-auth-google') || t.closest('.google-primary-btn')) { signInWithGoogle(); return; }

  if (t.id === 'btn-switch-handle') { closeAuthModal(); const _p = getUserProfile();
    $('player-handle-input').value = _p.handle;
    if ($('player-town-input')) $('player-town-input').value = _p.town || '';
    if ($('player-region-input')) $('player-region-input').value = _p.region || '';
    if ($('player-country-input')) $('player-country-input').value = _p.country || '';
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
  if (t.id === 'odds-toggle' || t.id === 'odds-caption') toggleOddsFormat();
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
      const tab = $(t.dataset.openLeagueModal === 'join' ? 'tab-join-league' : 'tab-create-league');
      if (tab && t.dataset.openLeagueModal) tab.click();
    }
  }
  else if (t.dataset.closeLeague !== undefined) { $('league-modal').hidden = true; }
  else if (t.dataset.openHandleModal !== undefined) { const _p = getUserProfile();
    $('player-handle-input').value = _p.handle;
    if ($('player-town-input')) $('player-town-input').value = _p.town || '';
    if ($('player-region-input')) $('player-region-input').value = _p.region || '';
    if ($('player-country-input')) $('player-country-input').value = _p.country || '';
    $('handle-modal').hidden = false; }
  else if (t.dataset.closeHandle !== undefined) { $('handle-modal').hidden = true; }
  else if (t.dataset.selectLeague !== undefined) { activeLeagueId = t.dataset.selectLeague; render(); }
  else if (t.dataset.selectMoreTab !== undefined) { activeMoreTab = t.dataset.selectMoreTab; render(); }
  else if (t.dataset.guideJump !== undefined) {
    const sec = document.getElementById('guide-' + t.dataset.guideJump);
    if (sec) { sec.open = true; sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
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
  else if (t.dataset.comp) { compFilter = t.dataset.comp; fixturesLimit = 60; resultsLimit = 40; try { localStorage.setItem(COMP_KEY, compFilter); } catch (e) { /* ignore */ } render(); }
  else if (t.dataset.tab) { fixturesTab = t.dataset.tab; fixturesShowAll = false; fixturesLimit = 60; render(); }
  else if (t.dataset.more !== undefined) { fixturesLimit += 60; render(); }
  else if (t.dataset.rmore !== undefined) { resultsLimit += 40; render(); }
  else if (t.dataset.showall !== undefined) { fixturesShowAll = true; fixturesLimit = 60; render(); }
  else if (t.dataset.sportRfilter) { resultsSportFilter = t.dataset.sportRfilter; render(); }
  else if (t.dataset.rfilter) { resultsFilter = t.dataset.rfilter; resultsLimit = 40; render(); }
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
  else if (t.dataset.legOdds) updateAccumulatorLegOdds(t.dataset.legOdds, +t.dataset.index, t.value);
  else if (t.dataset.leg) updateAccumulatorLegOutcome(t.dataset.leg, +t.dataset.index, t.value);
  else if (t.id === 'diary-profile-filter') { diaryProfileFilter = t.value; render(); }
  else if (t.id === 'modal-bet-type') toggleAccumulatorFields();
  else if (t.id === 'modal-fixture-select') updateDiaryDestinationOptions();
  else if (t.id === 'modal-leg-match-select') addLegForMatch(t.value);
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
    const name = leagueDocs.cleanLeagueName(($('new-league-name').value || '').trim() || 'My Friends League');
    const icon = leagueDocs.cleanIcon(($('new-league-icon') && $('new-league-icon').value) || '⚽');
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
    $('league-modal').hidden = true;
    render();
    if (firestoreDb) {
      publishLeague(newLeague, user).then(ok => {
        if (!ok) return;
        listenToActiveLeague(code);
        toast('League ' + icon + ' ' + name + ' created! Share code ' + code);
        render();
      }).catch(err => {
        console.warn('Create league notice:', err);
        toast('League saved on this device only for now; it will be shared once you are back online.');
      });
    }
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
    try { navigator.clipboard.writeText(['Bet Buddy ' + type + ' report', 'Contact: ' + (contact || 'Anonymous'), '', desc, '', 'URL: ' + location.href, 'Platform: ' + navigator.userAgent].join('\n')); } catch (e) { /* clipboard is a convenience */ }
    window.open('mailto:octopigardens@gmail.com?subject=' + subject + '&body=' + body, '_blank');

    $('bug-form').reset();
    $('bug-modal').hidden = true;
    toast('Thanks! Your report is saved and copied. If no email app opens, paste it to octopigardens@gmail.com.');
    render();
    return;
  }
  if (event.target.id === 'handle-form') {
    event.preventDefault();
    const handle = ($('player-handle-input').value || '').trim();
    const town = $('player-town-input') ? $('player-town-input').value.trim() : '';
    const region = $('player-region-input') ? $('player-region-input').value.trim() : '';
    const country = $('player-country-input') ? $('player-country-input').value.trim() : '';

    if (!isValidHandle(handle)) {
      toast('Gamertag must be 3–20 characters (letters, numbers, underscores only).');
      return;
    }

    const user = getAuthUser();
    if (user && user.signedIn && firestoreDb) {
      toast('Updating gamertag...');
      claimHandleTransaction(user.uid, handle, getUserProfile().avatar || '⚽', { town, region, country }).then(() => {
        currentAuthProfile = Object.assign({}, currentAuthProfile, { handle, town: leagueDocs.cleanPlace(town), region: leagueDocs.cleanPlace(region), country: leagueDocs.cleanPlace(country) });
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
// Opening Results from anywhere else always starts on Football, all competitions, settled predictions.
let wasOnResults = false;
function applyResultsDefaults() {
  const onResults = window.location.hash.startsWith('#/results');
  if (onResults && !wasOnResults) {
    resultsSportFilter = 'football';
    resultsFilter = 'settled';
    compFilter = 'ALL';
    try { localStorage.setItem(COMP_KEY, 'ALL'); } catch (e) { /* ignore */ }
  }
  wasOnResults = onResults;
}
applyResultsDefaults();
window.addEventListener('hashchange', () => { applyResultsDefaults(); render(); if (/^#\/(results|diary|leagues)/.test(window.location.hash)) checkAutoUpdateResults(); });
// Keep results fresh in the background so the Bet Diary settles itself without the user doing anything.
setInterval(() => { if (!document.hidden) checkAutoUpdateResults(true); }, 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkAutoUpdateResults(); });

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
    try { autoSettleDiary(); } catch (e) { console.warn('autoSettleDiary notice:', e); }
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
  try { autoSettleDiary(); } catch (e) { console.warn('autoSettleDiary notice:', e); }
});
initFirebaseAuth();

const APP_VERSION = 'v112';
try { const fv = document.getElementById('footer-app-version'); if (fv) fv.textContent = APP_VERSION; } catch (e) {}

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
    legs: isAcca ? launch.data.legs.map(l => ({ selection: l.label, odds: l.odds || 2.0, outcome: 'pending', match: (l.fixture && l.fixture.home && l.fixture.away) ? l.fixture.home + ' v ' + l.fixture.away : undefined })) : undefined,
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
// SLIP NOTE & BOOKMAKER PREFERENCES (formerly "Bet Butler"; function names kept for stability)
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

/* Several bookmaker accounts can be ticked. The first ticked one is the "primary" used for one-tap launches;
   the old single-value key is kept in step with it so older saved settings and code paths keep working. */
const BUTLER_MULTI_KEY = 'betbuddy_butler_bookies_v2';
function getButlerBookmakers() {
  try {
    const raw = localStorage.getItem(BUTLER_MULTI_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      const keys = Array.isArray(arr) ? arr.filter((k, i) => BOOKMAKERS_CONFIG[k] && arr.indexOf(k) === i) : [];
      if (keys.length) return keys.map(k => BOOKMAKERS_CONFIG[k]);
    }
    const saved = localStorage.getItem(BUTLER_STORAGE_KEY);
    if (saved && BOOKMAKERS_CONFIG[saved]) return [BOOKMAKERS_CONFIG[saved]];
  } catch (e) {}
  return [BOOKMAKERS_CONFIG.skybet];
}

function getButlerBookmaker() { return getButlerBookmakers()[0]; }

function saveButlerBookmakers(keys) {
  try {
    localStorage.setItem(BUTLER_MULTI_KEY, JSON.stringify(keys));
    localStorage.setItem(BUTLER_STORAGE_KEY, keys[0]);
  } catch (e) {}
}

/* Tick or untick one bookmaker. At least one must stay ticked. */
function toggleButlerBookmaker(key) {
  if (!BOOKMAKERS_CONFIG[key]) return;
  const keys = getButlerBookmakers().map(b => b.key);
  const i = keys.indexOf(key);
  if (i >= 0) {
    if (keys.length === 1) { toast('Keep at least one bookmaker ticked'); return; }
    keys.splice(i, 1);
  } else {
    keys.push(key);
  }
  saveButlerBookmakers(keys);
  updateButlerUI();
  render();
}

/* Choose exactly one bookmaker (used by single-choice shortcuts). */
function setButlerBookmaker(key) {
  if (!BOOKMAKERS_CONFIG[key]) return;
  saveButlerBookmakers([key]);
  updateButlerUI();
  closeButlerModal();
  toast('Slip note set to ' + BOOKMAKERS_CONFIG[key].name);
  render();
}

function updateButlerUI() {
  const chosen = getButlerBookmakers();
  const keys = chosen.map(b => b.key);
  const nameEls = document.querySelectorAll('#header-butler-name, .current-butler-name');
  nameEls.forEach(el => { el.textContent = chosen.map(b => b.name).join(', '); });
  document.querySelectorAll('.butler-choice-card').forEach(card => {
    const isSelected = keys.indexOf(card.dataset.selectButler) >= 0;
    if (isSelected) {
      card.classList.add('active');
      card.setAttribute('aria-checked', 'true');
    } else {
      card.classList.remove('active');
      card.setAttribute('aria-checked', 'false');
    }
  });
  const summary = document.getElementById('butler-selected-summary');
  if (summary) summary.textContent = chosen.length === 1 ? '1 bookmaker selected' : chosen.length + ' bookmakers selected';
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

// ============================================================
// BETAI: ask anything, get predictions only. Signed-in users, 4 questions a day.
// The Gemini call happens in the betAI Cloud Function; this only shows what it returns.
// ============================================================
const BETAI_URL = 'https://europe-west1-betbuddyuk.cloudfunctions.net/betAI';
const BETAI_EXAMPLES = ['Best bets for Arsenal this week', 'Build me a 4-fold acca', 'Over 2.5 goals tips today', 'Corners or cards value this weekend'];
const betai = { remaining: null, limit: 4, loading: false, result: null, error: '', showWhy: false, question: '' };

function betaiSignedIn() { const u = getAuthUser(); return Boolean(u && u.signedIn && firebaseAuth && firebaseAuth.currentUser); }

async function betaiCall(payload) {
  const token = await firebaseAuth.currentUser.getIdToken();
  const res = await fetch(BETAI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(payload) });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) { const err = new Error(data.error || ('HTTP ' + res.status)); err.data = data; throw err; }
  return data;
}

function renderBetAI() {
  const body = $('betai-body');
  if (!body) return;
  if (!betaiSignedIn()) {
    body.innerHTML = '<div class="betai-gate"><p>BetAI is for signed-in accounts. Sign in with Google to ask up to 4 questions a day.</p>' +
      '<button type="button" class="btn google-primary-btn" onclick="signInWithGoogle()" style="min-height:46px;">Sign in with Google</button></div>' + betaiFoot();
    return;
  }
  const out = betai.remaining === 0;
  const left = betai.remaining == null ? '' : betai.remaining + ' of ' + betai.limit + ' questions left today';
  let html = '<form class="betai-form" onsubmit="askBetAI(event)">' +
    '<label class="sr-only" for="betai-input">Your question</label>' +
    '<textarea id="betai-input" class="betai-input" rows="2" maxlength="300" placeholder="e.g. Best bets for Liverpool, or a goals acca for Saturday"' +
      (betai.loading || out ? ' disabled' : '') + '>' + esc(betai.question) + '</textarea>' +
    '<div class="betai-row"><span class="betai-left' + (out ? ' is-out' : '') + '">' + esc(out ? 'No questions left today. Resets at midnight UK time.' : left) + '</span>' +
    '<button type="submit" class="btn primary betai-go"' + (betai.loading || out ? ' disabled' : '') + '>' + (betai.loading ? 'Thinking…' : 'Ask') + '</button></div>' +
  '</form>';
  if (!betai.result && !betai.loading) {
    html += '<div class="betai-chips">' + BETAI_EXAMPLES.map(q => '<button type="button" class="betai-chip" data-betai-q="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>';
  }
  if (betai.error) html += '<p class="betai-error" role="alert">' + esc(betai.error) + '</p>';
  if (betai.result) html += renderBetAIResult(betai.result);
  body.innerHTML = html + betaiFoot();
}

function betaiFoot() {
  return '<p class="slip-card-disclaimer">AI estimates built from Bet Buddy&rsquo;s model data, not tips or guarantees. Lineups and injuries are not included. 18+ only. Play responsibly (<a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" style="color:var(--cyan);">BeGambleAware.org</a>).</p>';
}

function renderBetAIResult(r) {
  let html = '';
  if (r.notice) html += '<p class="betai-notice">' + esc(r.notice) + '</p>';
  if (r.picks && r.picks.length) {
    html += '<ul class="betai-picks">' + r.picks.map((p, i) =>
      '<li class="betai-pick"><div class="betai-pick-top"><span class="betai-match">' + esc(p.match) + '</span><span class="betai-conf" title="Confidence">' + esc(p.confidence) + '%</span></div>' +
      '<div class="betai-angle"><b>' + esc(p.selection) + '</b> <span>' + esc(p.market) + '</span></div>' +
      (p.scoreline ? '<div class="betai-sub">Scoreline: ' + esc(p.scoreline) + '</div>' : '') +
      (p.pivot ? '<div class="betai-sub">If it turns: ' + esc(p.pivot) + '</div>' : '') +
      (r.kind === 'acca' ? '' : betaiSaveButtons('single', i)) + '</li>').join('') + '</ul>';
    if (r.kind === 'acca' && r.combinedP != null) {
      html += '<p class="betai-acca">Accumulator: all ' + r.picks.length + ' legs landing is about <b>' + (r.combinedP < 0.01 ? '<1' : Math.round(r.combinedP * 100)) + '%</b> on the model. Most accas lose.</p>' + betaiSaveButtons('acca');
    }
  }
  const why = r.reasoning || {};
  if ((why.experts && why.experts.length) || why.scenario) {
    html += '<button type="button" class="betai-why-btn" data-betai-why aria-expanded="' + betai.showWhy + '">' + (betai.showWhy ? 'Hide' : 'Show') + ' thought process</button>';
    if (betai.showWhy) {
      html += '<div class="betai-why">' + (why.scenario ? '<p><b>Game script.</b> ' + esc(why.scenario) + '</p>' : '') +
        (why.experts || []).map(e => '<p><b>' + esc(e.role) + '.</b> ' + esc(e.brief) + '</p>').join('') + '</div>';
    }
  }
  return html;
}

function betaiSaveButtons(kind, i) {
  const a = ' data-betai-save="' + kind + '"' + (i != null ? ' data-i="' + i + '"' : '');
  return '<div class="betai-save">' +
    '<button type="button" class="btn small"' + a + ' data-dest="diary">Add to diary</button>' +
    '<button type="button" class="btn small primary"' + a + ' data-dest="league">Add to diary &amp; league</button></div>';
}

// Hands a BetAI pick (or the whole accumulator) to the normal Bet Diary form, which asks for the stake and the
// price actually offered and applies the league rules. dest 'diary' = diary only; 'league' = diary and league.
// The price to prefill: the latest bookmaker price on record for the selection, else the model's probability
// with a typical 7% bookmaker margin. Always labelled as an estimate; the player can overwrite it.
function betaiEstimatedOdds(pick) {
  let dec = 0, source = 'estimated from the model';
  try {
    const fx = fixtureById(pick.matchId);
    const priced = fx ? leaguePricedMarkets(fx) : {};
    if (pick.key && priced[pick.key] && priced[pick.key].source === 'feed') { dec = Number(priced[pick.key].decimal); source = 'latest bookmaker price on record'; }
  } catch (e) { /* fall through to the model estimate */ }
  if (!(dec > 1)) dec = 1 / (Math.min(Math.max(pick.p, 0.02), 0.97) * 1.07);
  return { text: calc.formatFractionalOdds(dec).replace(/[≈~]/g, ''), source };
}

function betaiSaveToDiary(kind, idx, dest) {
  const r = betai.result;
  if (!r || !r.picks) return;
  const pick = kind === 'single' ? r.picks[idx] : null;
  if (kind === 'single' && !pick) return;
  closeBetAI();
  if (kind === 'single') {
    const est = betaiEstimatedOdds(pick);
    openDiary({
      id: pick.matchId, selection: pick.selection, market: MARKETS[pick.marketKey] ? MARKETS[pick.marketKey].diary : 'wins',
      odds: est.text, p: pick.p, fair: pick.fair, rec: 'betai',
      notes: 'BetAI pick (model estimate ' + Math.round(pick.p * 100) + '%; not a recommendation). Price ' + est.text + ' is ' + est.source + ': change it if you were offered something different.'
    });
    if ($('modal-notes-input')) $('modal-notes-input').value = modalPrefill.notes || '';
  } else {
    openDiary({});
    $('modal-bet-type').value = 'accumulator';
    toggleAccumulatorFields();
    $('modal-legs-input').value = r.picks.map(p => p.match + ': ' + (p.marketKey === 'result' || p.marketKey === 'btts' ? '' : p.market + ' ') + p.selection + ' | ' + betaiEstimatedOdds(p).text).join('\n');
    $('modal-origin-select').value = 'matchiq';
    $('modal-notes-input').value = 'BetAI accumulator, ' + r.picks.length + ' legs (model estimate ' + Math.round(r.combinedP * 100) + '% for all to land; not a recommendation).';
    updateModalPnlPreview();
    toast('Prices are estimates (bookmaker price where we have one, otherwise the model). Change any leg to the price you were offered, then add your stake.');
  }
  const diaryRadio = $('dest-diary-radio'), bothRadio = $('dest-both-radio');
  if (dest === 'diary' && diaryRadio) { diaryRadio.checked = true; if (bothRadio) bothRadio.checked = false; }
  else if (dest === 'league' && bothRadio && bothRadio.offsetParent !== null) { bothRadio.checked = true; if (diaryRadio) diaryRadio.checked = false; }
  updateDiarySubmitBtn();
}

function betaiErrorText(e) {
  const code = e && e.message;
  if (code === 'daily-limit') return 'You have used your 4 questions for today. Back at midnight UK time.';
  if (code === 'sign-in-required') return 'Please sign in again to use BetAI.';
  if (code === 'ai-unavailable') return 'BetAI could not answer just now. That question was not counted. Try again shortly.';
  return 'Something went wrong. Please try again.';
}

async function openBetAI() {
  const modal = $('betai-modal');
  if (!modal) return;
  modal.hidden = false;
  if (!betai.loading) { betai.result = null; betai.error = ''; betai.showWhy = false; betai.question = ''; }
  renderBetAI();
  if (betaiSignedIn() && betai.remaining == null) {
    try {
      const q = await betaiCall({ quota: true });
      betai.remaining = q.remaining; betai.limit = q.limit || 4;
    } catch (e) { /* the count will arrive with the first answer */ }
    renderBetAI();
  }
}
function closeBetAI() { const m = $('betai-modal'); if (m) m.hidden = true; }

async function askBetAI(ev) {
  if (ev) ev.preventDefault();
  const input = $('betai-input');
  const question = ((input && input.value) || '').trim();
  if (betai.loading || !betaiSignedIn()) return;
  if (question.length < 3) { betai.error = 'Type a question first.'; renderBetAI(); return; }
  betai.question = question; betai.error = ''; betai.loading = true; betai.result = null; betai.showWhy = false;
  renderBetAI();
  try {
    const out = await betaiCall({ question });
    betai.result = out; betai.remaining = out.remaining; betai.limit = out.limit || 4;
  } catch (e) {
    betai.error = betaiErrorText(e);
    if (e && e.data && typeof e.data.remaining === 'number') betai.remaining = e.data.remaining;
  }
  betai.loading = false;
  renderBetAI();
}

document.addEventListener('click', e => {
  const t = e.target;
  if (!t || !t.closest) return;
  const chip = t.closest('[data-betai-q]');
  if (chip) { betai.question = chip.dataset.betaiQ; renderBetAI(); const i = $('betai-input'); if (i) i.focus(); return; }
  const save = t.closest('[data-betai-save]');
  if (save) { betaiSaveToDiary(save.dataset.betaiSave, save.dataset.i != null ? Number(save.dataset.i) : null, save.dataset.dest); return; }
  if (t.closest('[data-betai-why]')) { betai.showWhy = !betai.showWhy; renderBetAI(); return; }
  if (t.id === 'betai-modal') closeBetAI();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeBetAI(); });
if (typeof window !== 'undefined') { window.openBetAI = openBetAI; window.closeBetAI = closeBetAI; window.askBetAI = askBetAI; }

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
  window.toggleButlerBookmaker = toggleButlerBookmaker;
  window.getButlerBookmakers = getButlerBookmakers;
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
  const extraEl = $('slip-card-more-bookies');
  if (extraEl) {
    extraEl.innerHTML = getButlerBookmakers().slice(1).map(b =>
      '<button type="button" class="btn full-width" onclick="openBookmakerFootball(\'' + b.key + '\')" style="width:100%;min-height:44px;font-weight:600;margin-top:8px;">Open ' + esc(b.name) + ' Football ↗</button>'
    ).join('');
  }

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
          '<label class="slip-card-tick-label" onclick="const cb = document.querySelector(\'#slip-card-leg-' + i + ' input\'); if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event(\'change\')); }">Tap when added</label>' +
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

function openBookmakerFootball(key) {
  const bookie = (key && BOOKMAKERS_CONFIG[key]) || getButlerBookmaker();
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
