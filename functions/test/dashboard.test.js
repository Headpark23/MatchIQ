'use strict';
const assert = require('assert');
const d = require('../lib/dashboard');

const now = Date.parse('2026-11-08T12:00:00Z');
const DAY = 864e5;
const users = [
  { created: now - 2 * DAY, lastSeen: now - 3600e3, google: true },
  { created: now - 10 * DAY, lastSeen: now - 5 * DAY, google: true },
  { created: now - 100 * DAY, lastSeen: now - 40 * DAY, google: false }
];
const diary = [
  { uid: 'a', entry: { timestamp: '2026-11-07T10:00:00Z', type: 'single', marketName: 'Match result', bookmaker: 'Bet365', stake: 10, outcome: 'won', source: 'build' } },
  { uid: 'a', entry: { timestamp: '2026-11-08T09:00:00Z', type: 'accumulator', legs: [{}, {}, {}], stake: 5, outcome: 'pending', source: 'acca' } },
  { uid: 'b', entry: { date: '2026-10-01', type: 'single', market: 'goals', bookmaker: 'Bookmaker', stake: 20, outcome: 'lost', origin: 'independent' } },
  { uid: 'b', entry: { timestamp: '2026-11-06T09:00:00Z', type: 'single', stake: 2, outcome: 'won', recommendation: 'betai' } }
];
const leagueBets = [{ uid: 'a', day: '2026-11-07', outcome: 'won' }, { uid: 'b', day: '2026-11-08', outcome: 'pending' }];
const leagues = [{ created: now - DAY, members: 3 }, { created: now - 90 * DAY, members: 12 }, { created: now - 5 * DAY, members: 1 }];
const betai = [{ day: '2026-11-08', count: 3 }, { day: '2026-11-07', count: 4 }, { day: '2026-11-08', count: 1 }];

const s = d.aggregate({ users, diary, leagueBets, leagues, betai, now, days: 60 });

// accounts and growth
assert.strictEqual(s.users.total, 3);
assert.strictEqual(s.users.google, 2);
assert.strictEqual(s.users.new7, 1);
assert.strictEqual(s.users.new30, 2);
assert.strictEqual(s.users.active1, 1);
assert.strictEqual(s.users.active7, 2);
assert.strictEqual(s.users.growth.length, 60);
assert.strictEqual(s.users.growth[0].total, 1, 'accounts older than the window count as the starting total');
assert.strictEqual(s.users.growth[59].total, 3, 'running total ends at every account');

// bets and where they were built
assert.strictEqual(s.bets.total, 4);
assert.strictEqual(s.bets.bettors, 2);
assert.strictEqual(s.bets.last30, 3);
assert.strictEqual(s.bets.staked, 37);
const src = Object.fromEntries(s.bets.sources.map(x => [x.name, x.count]));
assert.strictEqual(src['Build your own bet'], 1);
assert.strictEqual(src['Model-built acca'], 1);
assert.strictEqual(src['BetAI'], 1);
assert.strictEqual(src['Own pick (before tracking)'], 1);
const types = Object.fromEntries(s.bets.types.map(x => [x.name, x.count]));
assert.strictEqual(types['Singles'], 3);
assert.strictEqual(types['Trebles'], 1);
assert.deepStrictEqual(s.bets.bookmakers, [{ name: 'Bet365', count: 1 }], 'placeholder bookmaker names are left out');
assert.deepStrictEqual(s.bets.outcomes, { won: 2, lost: 1, void: 0, pending: 1 });
assert.strictEqual(s.bets.activity.find(x => x.d === '2026-11-08').diary, 1);
assert.strictEqual(s.bets.activity.find(x => x.d === '2026-11-08').league, 1);

// leagues and BetAI
assert.strictEqual(s.leagues.count, 3);
assert.strictEqual(s.leagues.members, 16);
assert.strictEqual(s.leagues.sizes.find(x => x.name === '11+').count, 1);
assert.strictEqual(s.betai.usersToday, 2);
assert.strictEqual(s.betai.questionsToday, 4);

// ---- retention and notifications ----
// "Now" is Monday 16 Nov 2026. Activity is tracked from 1 Nov, so u3 (signed up before that) is
// counted as active but is not part of any sign-up cohort.
const rUsers = [
  { uid: 'u1', created: Date.parse('2026-11-02T10:00:00Z') },
  { uid: 'u2', created: Date.parse('2026-11-03T10:00:00Z') },
  { uid: 'u3', created: Date.parse('2026-10-20T10:00:00Z') },
  { uid: 'u4', created: Date.parse('2026-11-12T10:00:00Z') },
  { uid: 'u5', created: Date.parse('2026-11-16T08:00:00Z') }
];
const act = (uid, day, push) => Object.assign({ uid, day, opens: 1 }, push ? { push } : {});
const activity = [
  act('u1', '2026-11-02'), act('u1', '2026-11-03'), act('u1', '2026-11-09'), act('u1', '2026-11-14', 'recap'),
  act('u2', '2026-11-03'), act('u2', '2026-11-02', 'recap'),
  act('u3', '2026-11-01'), act('u3', '2026-11-15', 'picks'),
  act('u4', '2026-11-12'), act('u4', '2026-11-13', 'recap'), act('u5', '2026-11-16')
];
const devices = [
  { uid: 'u1', settled: true, picks: true, recap: true }, { uid: 'u1', settled: true, picks: false },
  { uid: 'u4', settled: false, picks: true, recap: false }
];
const runs = [
  { kind: 'recap', at: now - DAY, sent: 4 }, { kind: 'recap', at: now - 20 * DAY, sent: 3 },
  { kind: 'picks', at: now - 3 * DAY, sent: 2 }
];
const nowMon = Date.parse('2026-11-16T12:00:00Z');
const r = d.aggregate({ users: rUsers, visits: activity, devices, runs, now: nowMon }).retention;
assert.strictEqual(r.since, '2026-11-01');
assert.strictEqual(r.tracked, 5);
assert.deepStrictEqual(r.d1, { n: 3, kept: 2, pct: 67 });      // u1, u2, u4 are old enough; u1 and u4 came back the next day
assert.deepStrictEqual(r.d7, { n: 2, kept: 1, pct: 50 });      // u1, u2; only u1 was back on day 7
assert.deepStrictEqual(r.d30, { n: 0, kept: 0, pct: null });   // nobody is 30 days old yet
assert.deepStrictEqual(r.within7, { n: 2, kept: 1, pct: 50 });
assert.strictEqual(r.wau, 4);                                  // u1, u3, u4, u5 in the last 7 days
assert.strictEqual(r.mau, 5);
assert.deepStrictEqual(r.weekOnWeek, { prior: 2, kept: 1, pct: 50 });
assert.strictEqual(r.daily.length, 30);
assert.strictEqual(r.daily[r.daily.length - 1].d, '2026-11-16');
assert.strictEqual(r.daily[r.daily.length - 1].n, 1);

const n = d.aggregate({ users: rUsers, visits: activity, devices, runs, now: nowMon }).notifications;
assert.strictEqual(n.users, 2);
assert.strictEqual(n.devices, 3);
assert.strictEqual(n.optInPct, 40);
assert.deepStrictEqual(n.switches, { settled: 2, picks: 2, recap: 1 });
assert.deepStrictEqual(n.last14.find(x => x.kind === 'recap'), { kind: 'recap', sent: 4, opened: 2, pct: 50 });
assert.deepStrictEqual(n.last14.find(x => x.kind === 'picks'), { kind: 'picks', sent: 2, opened: 1, pct: 50 });
assert.deepStrictEqual(n.last14.find(x => x.kind === 'settled'), { kind: 'settled', sent: 0, opened: 0, pct: null });

// shares of the pick record: counted over the last 14 days only
const sharedVisits = activity.concat([
  { uid: 'u1', day: '2026-11-14', opens: 1, shares: 2 }, { uid: 'u4', day: '2026-11-15', opens: 1, shares: 1 },
  { uid: 'u2', day: '2026-10-20', opens: 1, shares: 5 }
]);
const sh = d.aggregate({ users: rUsers, visits: sharedVisits, devices, runs, now: nowMon }).retention.shares;
assert.deepStrictEqual(sh, { total: 3, players: 2 });
assert.deepStrictEqual(r.shares, { total: 0, players: 0 });

// no tracking data yet: empty, not a crash, and the old fields are unchanged
const none = d.aggregate({ users: rUsers, now: nowMon });
assert.strictEqual(none.retention.since, null);
assert.strictEqual(none.retention.d1.pct, null);
assert.strictEqual(none.retention.stickiness, null);
assert.strictEqual(none.notifications.optInPct, 0);
assert.strictEqual(none.users.total, 5);

// nothing personal leaves the server
const json = JSON.stringify(s);
assert.ok(!/"uid"|Bet365 v|@/.test(json.replace('Bet365', '')), 'no ids or handles in the output');

console.log('dashboard aggregation: all tests passed');
