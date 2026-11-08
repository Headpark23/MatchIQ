'use strict';
// Owner dashboard: turns raw account, diary, league and BetAI records into the counts the founder
// dashboard charts. Pure (no Firebase), so it is unit-tested; functions/index.js feeds it real data.
// Only totals and counts leave the server: no names, emails or individual bets.

const DAY = 864e5;
const dayOf = ms => new Date(ms).toISOString().slice(0, 10);

const SOURCE_NAMES = {
  build: 'Build your own bet', log: 'Log a bet', acca: 'Model-built acca', toppicks: "Today's top picks",
  betai: 'BetAI', match: 'Match page', fixtures: 'Matches', home: 'Home', picks: 'Picks'
};

function sourceOf(e) {
  if (e.source && SOURCE_NAMES[e.source]) return SOURCE_NAMES[e.source];
  if (e.recommendation === 'betai' || e.rec === 'betai') return 'BetAI';
  return e.origin === 'independent' ? 'Own pick (before tracking)' : 'Bet Buddy pick (before tracking)';
}

function betType(e) {
  const n = e.type === 'accumulator' && Array.isArray(e.legs) ? e.legs.length : 1;
  return n <= 1 ? 'Singles' : n === 2 ? 'Doubles' : n === 3 ? 'Trebles' : '4-folds and bigger';
}

function bump(obj, key, by) { obj[key] = (obj[key] || 0) + (by == null ? 1 : by); }
function top(obj, n) { return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n || 8).map(([name, count]) => ({ name, count })); }

// users: [{ created, lastSeen, google }] (ms); diary: [{ uid, entry }]; leagueBets: [{ uid, day, outcome }];
// leagues: [{ created, members }]; betai: [{ day, count }].
function aggregate({ users = [], diary = [], leagueBets = [], leagues = [], betai = [], now = Date.now(), days = 60 }) {
  const today = dayOf(now);
  const span = [];
  for (let i = days - 1; i >= 0; i--) span.push(dayOf(now - i * DAY));
  const inSpan = new Set(span);

  // Accounts
  const signups = {};
  let google = 0, new7 = 0, new30 = 0, active1 = 0, active7 = 0, active30 = 0, before = 0;
  users.forEach(u => {
    if (u.google) google++;
    const c = Number(u.created), s = Number(u.lastSeen);
    if (now - c < 7 * DAY) new7++;
    if (now - c < 30 * DAY) new30++;
    if (now - s < DAY) active1++;
    if (now - s < 7 * DAY) active7++;
    if (now - s < 30 * DAY) active30++;
    const d = Number.isFinite(c) ? dayOf(c) : '';
    if (inSpan.has(d)) bump(signups, d); else if (d && d < span[0]) before++;
  });
  let running = before;
  const growth = span.map(d => { running += signups[d] || 0; return { d, n: signups[d] || 0, total: running }; });

  // Bets logged in diaries (signed-in players whose diaries sync)
  const perDay = {}, types = {}, sources = {}, markets = {}, books = {}, outcomes = { won: 0, lost: 0, void: 0, pending: 0 };
  const bettors = new Set(), bettors7 = new Set();
  let staked = 0, last30 = 0;
  diary.forEach(({ uid, entry: e }) => {
    if (!e) return;
    const d = String(e.timestamp || e.date || '').slice(0, 10);
    bettors.add(uid);
    if (d && now - Date.parse(d) < 7 * DAY) bettors7.add(uid);
    if (inSpan.has(d)) bump(perDay, d);
    if (d && now - Date.parse(d) < 30 * DAY) last30++;
    bump(types, betType(e));
    bump(sources, sourceOf(e));
    bump(markets, e.type === 'accumulator' ? 'Accumulators' : (e.marketName || e.market || 'Other'));
    if (e.bookmaker && e.bookmaker !== 'Bookmaker') bump(books, e.bookmaker);
    const o = String(e.outcome || 'pending').toLowerCase();
    if (o in outcomes) outcomes[o]++;
    staked += Number(e.stake) || 0;
  });

  const leaguePerDay = {}, leagueOutcomes = { won: 0, lost: 0, void: 0, pending: 0 };
  const leaguePlayers = new Set();
  leagueBets.forEach(b => {
    leaguePlayers.add(b.uid);
    if (inSpan.has(b.day)) bump(leaguePerDay, b.day);
    const o = String(b.outcome || 'pending').toLowerCase();
    if (o in leagueOutcomes) leagueOutcomes[o]++;
  });
  const activity = span.map(d => ({ d, diary: perDay[d] || 0, league: leaguePerDay[d] || 0 }));

  // Private leagues
  const sizes = { '1': 0, '2–3': 0, '4–6': 0, '7–10': 0, '11+': 0 };
  let members = 0;
  const leaguesByDay = {};
  leagues.forEach(l => {
    const m = Number(l.members) || 0;
    members += m;
    bump(sizes, m <= 1 ? '1' : m <= 3 ? '2–3' : m <= 6 ? '4–6' : m <= 10 ? '7–10' : '11+');
    const d = Number.isFinite(Number(l.created)) ? dayOf(Number(l.created)) : '';
    if (inSpan.has(d)) bump(leaguesByDay, d);
  });

  const betaiToday = betai.filter(b => b.day === today);
  return {
    at: new Date(now).toISOString(),
    days,
    users: { total: users.length, google, new7, new30, active1, active7, active30, growth },
    bets: {
      total: diary.length, last30, staked: Math.round(staked * 100) / 100, bettors: bettors.size, bettors7: bettors7.size,
      activity, types: top(types, 6), sources: top(sources, 10), markets: top(markets, 8), bookmakers: top(books, 8), outcomes
    },
    league: { bets: leagueBets.length, players: leaguePlayers.size, outcomes: leagueOutcomes },
    leagues: { count: leagues.length, members, sizes: Object.entries(sizes).map(([name, count]) => ({ name, count })), created: span.map(d => ({ d, n: leaguesByDay[d] || 0 })) },
    betai: { usersToday: betaiToday.length, questionsToday: betaiToday.reduce((t, b) => t + (Number(b.count) || 0), 0) }
  };
}

module.exports = { aggregate, sourceOf, betType, SOURCE_NAMES };
