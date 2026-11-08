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

// nothing personal leaves the server
const json = JSON.stringify(s);
assert.ok(!/"uid"|Bet365 v|@/.test(json.replace('Bet365', '')), 'no ids or handles in the output');

console.log('dashboard aggregation: all tests passed');
