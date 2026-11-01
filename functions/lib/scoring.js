'use strict';

// League scoring rules, kept free of Firebase so they can be unit tested.
// A league bet is one bet per match day, logged in the app before kick-off: a single, or an
// accumulator whose every leg is a priced match result or over/under goals pick. The server decides
// everything that counts: which fixtures and markets they are, the bookmaker prices they score at,
// the results, and the points. Nothing the player's device sends about odds or outcomes is trusted.
const leagues = require('../shared/league_sync.js');
const settlement = require('../shared/settlement.js');

const DAY_MS = 86400000;
const SETTLE_AFTER_MS = 105 * 60000;   // a match is over well within 105 minutes of kick-off
const VOID_AFTER_MS = 3 * DAY_MS;      // no result three days after kick-off: postponed or abandoned
const LADDER_SIZE = 50;
const MAX_LEGS = 10;
const PRICED_MARKET = /^(result:[HDA]|goals:(over|under):\d+(\.\d+)?)$/;

// ---------------------------------------------------------- bet checks
// Checks one pick (a single, or one leg of an accumulator) against its fixture and the recorded
// bookmaker prices. Returns the checked leg, or { reason } when it cannot count.
function checkPick(fixtureId, selection, createdMs, fixtures, odds, settler) {
  const fixture = (fixtures || []).find(f => f.id === fixtureId);
  if (!fixture) return { reason: 'Match not found in the fixture list.' };
  const kickoff = Date.parse(fixture.kickoff_utc || '');
  if (!Number.isFinite(kickoff)) return { reason: 'Match has no kick-off time yet.' };
  if (!(createdMs < kickoff)) return { reason: 'Logged after kick-off (' + fixture.home + ' v ' + fixture.away + ').' };
  const selections = ((((odds && odds.matches) || {})[fixture.id]) || {}).selections || {};
  const candidates = Object.keys(selections).filter(k => PRICED_MARKET.test(k));
  if (!candidates.length) return { reason: 'No bookmaker price for ' + fixture.home + ' v ' + fixture.away + ', so it cannot be scored.' };
  const market = settler.classifyMarket(String(selection || ''), fixture.home, fixture.away, candidates);
  if (!market) return { reason: 'Only match result and over/under goals picks with a bookmaker price can count ("' + String(selection || '').slice(0, 60) + '").' };
  const refOdds = Number(selections[market].decimal);
  if (!(refOdds > 1)) return { reason: 'No usable bookmaker price for "' + String(selection || '').slice(0, 60) + '".' };
  return {
    fixtureId: fixture.id,
    home: fixture.home,
    away: fixture.away,
    kickoffMs: kickoff,
    market,
    refOdds,
    refBookmaker: String(selections[market].bookmaker || '').slice(0, 40)
  };
}

// Returns the fields the server stores on a newly logged league bet.
function validateLeagueBet({ bet, dayKey, createdMs, fixtures, odds }) {
  const reject = reason => ({ status: 'rejected', reason });
  const settler = settlement.create(() => fixtures);
  const isAcca = Array.isArray(bet.legs);
  const picks = isAcca ? bet.legs : [{ fixtureId: bet.fixtureId, selection: bet.selection }];
  if (isAcca && (picks.length < 2 || picks.length > MAX_LEGS)) return reject('Accumulators need 2 to ' + MAX_LEGS + ' legs.');
  const legs = [];
  for (const p of picks) {
    if (!p || typeof p.fixtureId !== 'string' || typeof p.selection !== 'string') return reject('Accumulator leg is missing its match.');
    const leg = checkPick(p.fixtureId, p.selection, createdMs, fixtures, odds, settler);
    if (leg.reason) return reject(leg.reason);
    if (legs.some(l => l.fixtureId === leg.fixtureId)) return reject('Each accumulator leg must be a different match.');
    legs.push(leg);
  }
  legs.sort((a, b) => a.kickoffMs - b.kickoffMs);
  const first = legs[0];
  if (new Date(first.kickoffMs).toISOString().slice(0, 10) !== dayKey) return reject('League bets are filed under the day of the first match.');
  if (!isAcca) return Object.assign({ status: 'pending' }, first);
  return {
    status: 'pending',
    fixtureId: first.fixtureId,
    kickoffMs: first.kickoffMs,   // first leg: withdrawing is allowed until then
    market: 'acca',
    refOdds: Math.round(legs.reduce((t, l) => t * l.refOdds, 1) * 1000) / 1000,
    legs
  };
}

// Wins score (odds - 1) x 10 with odds counted up to 10/1; losses -2; voids 0.
function pointsFor(outcome, refOdds) {
  if (outcome === 'won') return Math.round((Math.min(Number(refOdds) || 2, leagues.MAX_COUNTED_ODDS) - 1) * 10);
  if (outcome === 'lost') return -2;
  return 0;
}

// The result of one pick once its match is over: 'won', 'lost' or 'void', or null while waiting.
function settlePick(pick, fixtures, nowMs, settler) {
  const fixture = (fixtures || []).find(f => f.id === pick.fixtureId);
  const kickoff = fixture ? Date.parse(fixture.kickoff_utc || '') : pick.kickoffMs;
  if (fixture && settler.fixtureFinished(fixture)) {
    return { outcome: settler.settleMarket(pick.market, fixture.score), score: fixture.score[0] + '-' + fixture.score[1] };
  }
  if (fixture && Number.isFinite(kickoff) && kickoff > nowMs) return null;  // rescheduled to a later date
  const cancelled = fixture && /POSTPONED|CANCELLED|CANCELED|SUSPENDED|ABANDONED/.test(String(fixture.status || '').toUpperCase());
  const overdue = Number.isFinite(kickoff) && nowMs - kickoff > VOID_AFTER_MS;
  return cancelled || overdue ? { outcome: 'void', score: null } : null;
}

// Settles a pending bet once its matches have results. Returns null while there is nothing to do yet.
// An accumulator loses as soon as any leg loses; otherwise it waits for every leg. Void legs drop out
// and the rest count at their combined price; if every leg is void the bet is void.
function settleLeagueBet(bet, fixtures, nowMs) {
  const settler = settlement.create(() => fixtures);
  if (!Array.isArray(bet.legs)) {
    const r = settlePick(bet, fixtures, nowMs, settler);
    if (!r || !r.outcome) return null;
    return { status: 'settled', outcome: r.outcome, points: pointsFor(r.outcome, bet.refOdds), finalScore: r.score };
  }
  const results = bet.legs.map(leg => settlePick(leg, fixtures, nowMs, settler));
  const legs = bet.legs.map((leg, i) => Object.assign({}, leg, results[i] && results[i].outcome ? { outcome: results[i].outcome, finalScore: results[i].score } : {}));
  if (results.some(r => r && r.outcome === 'lost')) return { status: 'settled', outcome: 'lost', points: -2, legs };
  if (results.some(r => !r || !r.outcome)) return null;
  const won = legs.filter(l => l.outcome === 'won');
  if (!won.length) return { status: 'settled', outcome: 'void', points: 0, legs };
  const odds = Math.round(won.reduce((t, l) => t * l.refOdds, 1) * 1000) / 1000;
  return { status: 'settled', outcome: 'won', points: pointsFor('won', odds), refOdds: odds, legs };
}

// ---------------------------------------------------------- player stats
// The earliest date any current period (week, month, season) starts on; bets before it are not needed.
function statsWindowStart(now) {
  const today = leagues.londonDate(now);
  const weekStart = leagues.currentPeriodKey('weekly', now).slice(1);
  const monthStart = today.slice(0, 7) + '-01';
  const y = +today.slice(0, 4), m = +today.slice(5, 7);
  const seasonStart = (m >= 8 ? y : y - 1) + '-08-01';
  return [weekStart, monthStart, seasonStart].sort()[0];
}

// bets: [{ day, status, outcome, points, refOdds }]; returns { weekly, monthly, yearly }, each tagged
// with its period key, in the shape league_sync.memberStatsFor reads.
function computePeriods(bets, now) {
  const out = {};
  leagues.FREQS.forEach(freq => {
    const key = leagues.currentPeriodKey(freq, now);
    const counted = bets
      .filter(b => b.status === 'settled' && leagues.periodKey(freq, b.day) === key)
      .sort((a, b) => (a.day < b.day ? 1 : -1));
    const won = counted.filter(b => b.outcome === 'won').length;
    const decided = counted.filter(b => b.outcome === 'won' || b.outcome === 'lost');
    const profit = decided.reduce((s, b) => s + (b.outcome === 'won' ? (Number(b.refOdds) || 2) - 1 : -1), 0);
    out[freq] = {
      key,
      points: counted.reduce((s, b) => s + (Number(b.points) || 0), 0),
      winRate: decided.length ? Math.round((won / decided.length) * 100) : 0,
      roi: decided.length ? Math.round((profit / decided.length) * 1000) / 10 : 0,
      settled: counted.length,
      form: counted.slice(0, 5).map(b => (b.outcome === 'won' ? 'W' : b.outcome === 'lost' ? 'L' : 'V'))
    };
    if (!out[freq].form.length) out[freq].form = ['—'];
  });
  return out;
}

// ---------------------------------------------------------- regional ladders
const UK_NATIONS = ['england', 'scotland', 'wales', 'northern ireland', 'united kingdom', 'uk', 'great britain', 'britain'];
const EUROPE = UK_NATIONS.concat(['ireland', 'republic of ireland', 'france', 'germany', 'spain', 'italy', 'portugal', 'netherlands',
  'belgium', 'luxembourg', 'switzerland', 'austria', 'denmark', 'norway', 'sweden', 'finland', 'iceland', 'poland', 'czechia',
  'czech republic', 'slovakia', 'hungary', 'romania', 'bulgaria', 'greece', 'croatia', 'slovenia', 'serbia', 'bosnia and herzegovina',
  'montenegro', 'north macedonia', 'albania', 'kosovo', 'estonia', 'latvia', 'lithuania', 'ukraine', 'moldova', 'cyprus', 'malta',
  'gibraltar', 'isle of man', 'jersey', 'guernsey', 'andorra', 'monaco', 'san marino', 'liechtenstein', 'turkey', 'georgia', 'armenia']);

function slug(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

// Which ladders a player belongs to, from the location they chose in their profile.
function tiersFor(loc) {
  const country = String((loc && loc.country) || '').trim().toLowerCase();
  const tiers = ['world'];
  if (EUROPE.includes(country)) tiers.push('europe');
  if (UK_NATIONS.includes(country)) tiers.push('uk');
  if (slug(loc && loc.country)) tiers.push('country-' + slug(loc.country));
  if (slug(loc && loc.region)) tiers.push('region-' + slug(loc.region));
  if (slug(loc && loc.town)) tiers.push('town-' + slug(loc.town));
  return tiers;
}

// players: [{ uid, handle, avatar, town, region, country, periods }]. Returns one ladder per period
// and tier that has players this period: { id, period, key, tier, entries (top 50), total }.
function buildLadders(players, now) {
  const ladders = new Map();
  leagues.FREQS.forEach(freq => {
    const key = leagues.currentPeriodKey(freq, now);
    players.forEach(p => {
      const st = p.periods && p.periods[freq];
      if (!st || st.key !== key || !(st.settled > 0)) return;
      const row = { uid: p.uid, handle: p.handle, avatar: p.avatar || '⚽', points: st.points, winRate: st.winRate, roi: st.roi, settled: st.settled, form: st.form };
      tiersFor(p).forEach(tier => {
        const id = freq + '__' + tier;
        if (!ladders.has(id)) ladders.set(id, { id, period: freq, key, tier, rows: [] });
        ladders.get(id).rows.push(row);
      });
    });
  });
  return Array.from(ladders.values()).map(l => {
    l.rows.sort((a, b) => (b.points - a.points) || (b.winRate - a.winRate) || (b.roi - a.roi) || String(a.handle).localeCompare(String(b.handle)));
    return { id: l.id, period: l.period, key: l.key, tier: l.tier, total: l.rows.length, entries: l.rows.slice(0, LADDER_SIZE) };
  });
}

module.exports = {
  SETTLE_AFTER_MS,
  MAX_LEGS,
  LADDER_SIZE,
  validateLeagueBet,
  pointsFor,
  settleLeagueBet,
  statsWindowStart,
  computePeriods,
  slug,
  tiersFor,
  buildLadders
};
