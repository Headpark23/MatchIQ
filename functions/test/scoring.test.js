'use strict';
// Unit tests for the league server's scoring rules (no Firebase needed): node functions/test/scoring.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const scoring = require('../lib/scoring');
const leagues = require('../shared/league_sync.js');

// The server must run exactly the same settlement and period code as the app.
for (const f of ['settlement.js', 'league_sync.js']) {
  assert.strictEqual(fs.readFileSync(path.join(__dirname, '..', 'shared', f), 'utf8'), fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8'),
    'functions/shared/' + f + ' is out of date: run node scripts/sync_functions_shared.js');
}

const KO = Date.parse('2026-11-08T15:00:00Z');
const fixtures = [
  { id: 'PL-ars-tot', home: 'Arsenal', away: 'Tottenham', kickoff_utc: '2026-11-08T15:00:00Z', status: 'SCHEDULED', score: null },
  { id: 'PL-che-liv', home: 'Chelsea', away: 'Liverpool', kickoff_utc: '2026-11-08T17:30:00Z', status: 'SCHEDULED', score: null }
];
const odds = { matches: {
  'PL-ars-tot': { selections: {
    'result:H': { decimal: 1.8, bookmaker: 'Coral' }, 'result:D': { decimal: 3.8 }, 'result:A': { decimal: 15 },
    'goals:over:2.5': { decimal: 1.7 }, 'goals:under:2.5': { decimal: 2.1 }
  } }
} };
const check = (selection, extra = {}) => scoring.validateLeagueBet(Object.assign({
  bet: { fixtureId: 'PL-ars-tot', selection }, dayKey: '2026-11-08', createdMs: KO - 3600000, fixtures, odds
}, extra));

// ---- checking a bet when it is logged
let r = check('Arsenal win');
assert.strictEqual(r.status, 'pending');
assert.strictEqual(r.market, 'result:H');
assert.strictEqual(r.refOdds, 1.8, 'scores at the recorded bookmaker price, not the odds the player typed');
assert.strictEqual(r.kickoffMs, KO);
assert.strictEqual(check('Spurs').market, 'result:A');
assert.strictEqual(check('Over 2.5 goals').market, 'goals:over:2.5');
assert.strictEqual(check('Draw').market, 'result:D');
assert.strictEqual(check('Arsenal win', { createdMs: KO }).status, 'rejected', 'logged at kick-off is too late');
assert.strictEqual(check('Arsenal win', { createdMs: KO + 60000 }).reason, 'Logged after kick-off (Arsenal v Tottenham).');
assert.strictEqual(check('Arsenal win', { dayKey: '2026-11-07' }).status, 'rejected', 'filed under the wrong day');
assert.strictEqual(check('Both teams to score').status, 'rejected', 'unpriced market');
assert.strictEqual(check('Arsenal or draw').market, 'dc:1X', 'double chance is priced from the three result prices');
assert.ok(Math.abs(check('Arsenal or draw').refOdds - 1 / (1 / 1.8 + 1 / 3.8)) < 0.001);
assert.strictEqual(check('x', { bet: { fixtureId: 'PL-ars-tot', selection: 'Spurs (draw no bet)', market: 'dnb:A' } }).market, 'dnb:A');
assert.strictEqual(check('x', { bet: { fixtureId: 'PL-ars-tot', selection: 'Both teams to score', market: 'btts:yes' } }).status, 'rejected', 'no model price loaded for btts');
const preds = { predictions: { 'PL-ars-tot': { markets: { btts: { selections: [{ key: 'yes', p: 0.55 }, { key: 'no', p: 0.45 }] }, goals: { lines: [{ line: 1.5, over: { p: 0.8 }, under: { p: 0.2 } }] } } } } };
const withModel = (selection, market) => check('x', { bet: { fixtureId: 'PL-ars-tot', selection, market }, predictions: preds });
assert.strictEqual(withModel('Both teams to score', 'btts:yes').market, 'btts:yes');
assert.ok(Math.abs(withModel('Both teams to score', 'btts:yes').refOdds - 1 / (0.55 * 1.07)) < 0.001, 'btts scores at the model price less a typical margin');
assert.strictEqual(withModel('Over 1.5 goals', 'goals:over:1.5').status, 'pending');
assert.strictEqual(withModel('Arsenal to score', 'tts:H').status, 'rejected', 'markets that cannot be settled from the score never count');
assert.strictEqual(withModel('corners', 'corners:over:9.5').status, 'rejected');
assert.strictEqual(withModel('Over 3.5 goals', 'goals:over:3.5').status, 'rejected', 'a line with no price still cannot count');
assert.strictEqual(scoring.validateLeagueBet({ bet: { fixtureId: 'PL-ars-tot', selection: 'a', legs: [{ fixtureId: 'PL-ars-tot', selection: 'Arsenal or draw', market: 'dc:1X' }, { fixtureId: 'PL-che-liv', selection: 'Chelsea', market: 'result:H' }] }, dayKey: '2026-11-08', createdMs: KO - 3600000, fixtures, odds, predictions: preds }).status, 'rejected', 'second match has no prices');
assert.strictEqual(check('Over 3.5 goals').status, 'rejected', 'line without a price');
assert.strictEqual(scoring.validateLeagueBet({ bet: { fixtureId: 'PL-che-liv', selection: 'Chelsea' }, dayKey: '2026-11-08', createdMs: KO, fixtures, odds }).status, 'rejected', 'match with no prices');
assert.strictEqual(scoring.validateLeagueBet({ bet: { fixtureId: 'nope', selection: 'x' }, dayKey: '2026-11-08', createdMs: KO, fixtures, odds }).status, 'rejected');
{
  const st = require('../shared/settlement.js').create(() => fixtures);
  const cases = [['dc:1X', [1, 1], 'won'], ['dc:1X', [0, 1], 'lost'], ['dc:X2', [0, 0], 'won'], ['dc:12', [2, 2], 'lost'], ['dnb:H', [1, 1], 'void'], ['dnb:H', [2, 1], 'won'], ['dnb:A', [2, 1], 'lost'], ['btts:yes', [1, 1], 'won'], ['btts:yes', [1, 0], 'lost'], ['btts:no', [0, 0], 'won'], ['btts:no', [2, 3], 'lost']];
  cases.forEach(([m, sc, out]) => assert.strictEqual(st.settleMarket(m, sc), out, m + ' ' + sc));
}
console.log('PASS: bets are checked against kick-off, match day and a recorded bookmaker price');

// ---- points
assert.strictEqual(scoring.pointsFor('won', 1.8), 8);
assert.strictEqual(scoring.pointsFor('won', 15), 100, 'odds count up to 10/1');
assert.strictEqual(scoring.pointsFor('lost', 15), -2);
assert.strictEqual(scoring.pointsFor('void', 15), 0);

// ---- settling
const bet = { fixtureId: 'PL-ars-tot', market: 'result:H', refOdds: 1.8, kickoffMs: KO };
const finished = score => [Object.assign({}, fixtures[0], { status: 'FINISHED', score })];
assert.deepStrictEqual(scoring.settleLeagueBet(bet, finished([2, 1]), KO + 3 * 3600000), { status: 'settled', outcome: 'won', points: 8, finalScore: '2-1' });
assert.strictEqual(scoring.settleLeagueBet(bet, finished([0, 0]), KO + 3 * 3600000).outcome, 'lost');
assert.strictEqual(scoring.settleLeagueBet(Object.assign({}, bet, { market: 'goals:over:2.5' }), finished([2, 1]), KO + 3 * 3600000).outcome, 'won');
assert.strictEqual(scoring.settleLeagueBet(bet, fixtures, KO + 3 * 3600000), null, 'no result yet: wait');
assert.strictEqual(scoring.settleLeagueBet(bet, fixtures, KO + 4 * 86400000).outcome, 'void', 'no result after 3 days: void');
assert.strictEqual(scoring.settleLeagueBet(bet, [Object.assign({}, fixtures[0], { status: 'POSTPONED' })], KO + 3600000).outcome, 'void');
assert.strictEqual(scoring.settleLeagueBet(bet, [Object.assign({}, fixtures[0], { status: 'POSTPONED', kickoff_utc: '2026-12-01T15:00:00Z' })], KO + 3600000), null, 'rescheduled: wait');
assert.strictEqual(scoring.settleLeagueBet(bet, [], KO + 3600000), null, 'match missing from feed briefly: wait');
assert.strictEqual(scoring.settleLeagueBet(bet, [], KO + 4 * 86400000).outcome, 'void');
console.log('PASS: bets settle from official results; postponed or missing matches void');

// ---- accumulators
const accaFixtures = fixtures.concat([
  { id: 'PL-new-avl', home: 'Newcastle', away: 'Aston Villa', kickoff_utc: '2026-11-09T20:00:00Z', status: 'SCHEDULED', score: null },
  { id: 'PL-bur-ful', home: 'Burnley', away: 'Fulham', kickoff_utc: '2026-11-09T20:00:00Z', status: 'SCHEDULED', score: null }
]);
const accaOdds = { matches: Object.assign({}, odds.matches, {
  'PL-new-avl': { selections: { 'result:H': { decimal: 2.5 }, 'result:A': { decimal: 2.9 }, 'goals:over:2.5': { decimal: 1.9 } } },
  'PL-bur-ful': { selections: { 'result:H': { decimal: 3.0 } } }
}) };
const checkAcca = (legs, extra = {}) => scoring.validateLeagueBet(Object.assign({
  bet: { fixtureId: legs[0].fixtureId, selection: legs.map(l => l.selection).join(' + '), legs }, dayKey: '2026-11-08', createdMs: KO - 3600000, fixtures: accaFixtures, odds: accaOdds
}, extra));
const ars = { fixtureId: 'PL-ars-tot', selection: 'Arsenal' };
const newc = { fixtureId: 'PL-new-avl', selection: 'Newcastle win' };
let acc = checkAcca([newc, ars]);
assert.strictEqual(acc.status, 'pending');
assert.strictEqual(acc.market, 'acca');
assert.strictEqual(acc.refOdds, 4.5, 'legs multiply: 1.8 x 2.5');
assert.strictEqual(acc.kickoffMs, KO, 'withdrawal deadline is the first leg');
assert.deepStrictEqual(acc.legs.map(l => [l.fixtureId, l.market]), [['PL-ars-tot', 'result:H'], ['PL-new-avl', 'result:H']], 'legs sorted by kick-off');
assert.strictEqual(checkAcca([newc, ars], { dayKey: '2026-11-09' }).status, 'rejected', 'filed under the first match day');
assert(/different match/.test(checkAcca([ars, { fixtureId: 'PL-ars-tot', selection: 'Over 2.5' }]).reason), 'same match twice');
assert(/No bookmaker price for Chelsea v Liverpool/.test(checkAcca([ars, { fixtureId: 'PL-che-liv', selection: 'Chelsea' }]).reason), 'unpriced leg');
assert(/Only markets that settle from the final score/.test(checkAcca([ars, { fixtureId: 'PL-new-avl', selection: 'Both teams to score' }]).reason), 'unpriced market in a leg');
assert(/2 to 10 legs/.test(checkAcca([ars]).reason), 'one leg is not an accumulator');
assert(/Logged after kick-off/.test(checkAcca([newc, ars], { createdMs: KO + 60000 }).reason), 'after the first leg kicked off');
assert.strictEqual(scoring.validateLeagueBet({ bet: { legs: [ars, { nope: 1 }] }, dayKey: '2026-11-08', createdMs: KO - 1, fixtures: accaFixtures, odds: accaOdds }).status, 'rejected', 'malformed leg');

const pendingAcca = Object.assign({}, acc);
const withResults = map => accaFixtures.map(f => map[f.id] ? Object.assign({}, f, { status: 'FINISHED', score: map[f.id] }) : f);
const t = Date.parse('2026-11-10T12:00:00Z');
assert.strictEqual(scoring.settleLeagueBet(pendingAcca, withResults({ 'PL-ars-tot': [2, 0] }), KO + 3 * 3600000), null, 'first leg won, second still to play: wait');
let s1 = scoring.settleLeagueBet(pendingAcca, withResults({ 'PL-ars-tot': [0, 1] }), KO + 3 * 3600000);
assert.deepStrictEqual([s1.outcome, s1.points], ['lost', -2], 'a losing leg loses the acca straight away');
s1 = scoring.settleLeagueBet(pendingAcca, withResults({ 'PL-ars-tot': [2, 0], 'PL-new-avl': [3, 1] }), t);
assert.deepStrictEqual([s1.outcome, s1.refOdds, s1.points], ['won', 4.5, 35], 'won at the combined price: (4.5 - 1) x 10');
s1 = scoring.settleLeagueBet(pendingAcca, withResults({ 'PL-ars-tot': [2, 0] }).map(f => f.id === 'PL-new-avl' ? Object.assign({}, f, { status: 'POSTPONED' }) : f), t);
assert.deepStrictEqual([s1.outcome, s1.refOdds, s1.points], ['won', 1.8, 8], 'postponed leg drops out; the rest still count');
const big = checkAcca([ars, newc, { fixtureId: 'PL-bur-ful', selection: 'Burnley' }]);
s1 = scoring.settleLeagueBet(big, withResults({ 'PL-ars-tot': [2, 0], 'PL-new-avl': [3, 1], 'PL-bur-ful': [1, 0] }), t);
assert.deepStrictEqual([s1.outcome, s1.refOdds, s1.points], ['won', 13.5, 100], 'combined price above 10/1 scores the 100-point cap');
assert.deepStrictEqual(s1.legs.map(l => l.outcome), ['won', 'won', 'won'], 'each leg result is recorded');
console.log('PASS: accumulators: every leg priced, combined price capped at 10/1, a losing leg loses, void legs drop out');

// ---- period stats (UK calendar)
const now = new Date('2026-11-11T12:00:00Z');  // Wednesday
const bets = [
  { day: '2026-11-10', status: 'settled', outcome: 'won', points: 20, refOdds: 3 },
  { day: '2026-11-09', status: 'settled', outcome: 'lost', points: -2, refOdds: 2 },
  { day: '2026-11-08', status: 'settled', outcome: 'won', points: 8, refOdds: 1.8 },   // last week (Sunday)
  { day: '2026-11-11', status: 'pending' },
  { day: '2026-10-20', status: 'settled', outcome: 'void', points: 0, refOdds: 2 }     // last month
];
const p = scoring.computePeriods(bets, now);
assert.strictEqual(p.weekly.key, 'W2026-11-09');
assert.deepStrictEqual([p.weekly.points, p.weekly.settled, p.weekly.winRate], [18, 2, 50]);
assert.deepStrictEqual(p.weekly.form, ['W', 'L']);
assert.strictEqual(p.weekly.roi, 50, 'one win at 3.0 and one loss: +1 unit on 2 staked = +50%');
assert.deepStrictEqual([p.monthly.points, p.monthly.settled], [26, 3]);
assert.deepStrictEqual([p.yearly.points, p.yearly.settled, p.yearly.key], [26, 4, 'S2026']);
assert.strictEqual(scoring.statsWindowStart(now), '2026-08-01');
assert.strictEqual(scoring.statsWindowStart(new Date('2026-08-02T12:00:00Z')), '2026-07-27', 'week that began before the season');
// The app reads these exactly as its own member stats.
assert.strictEqual(leagues.memberStatsFor({ periods: p, scoredAt: 1 }, 'weekly', p.weekly.key, 'weekly').points, 18);
console.log('PASS: week, month and season stats use the UK calendar');

// ---- regional ladders
assert.deepStrictEqual(scoring.tiersFor({ town: 'Paisley', region: 'Renfrewshire', country: 'Scotland' }),
  ['world', 'europe', 'uk', 'country-scotland', 'region-renfrewshire', 'town-paisley']);
assert.deepStrictEqual(scoring.tiersFor({ country: 'France' }), ['world', 'europe', 'country-france']);
assert.deepStrictEqual(scoring.tiersFor({}), ['world'], 'no location: world ladder only');
const players = [];
for (let i = 0; i < 60; i++) {
  players.push({ uid: 'u' + i, handle: 'P' + i, town: i % 2 ? 'Paisley' : 'Glasgow', country: 'Scotland', periods: scoring.computePeriods([{ day: '2026-11-10', status: 'settled', outcome: 'won', points: i, refOdds: 2 }], now) });
}
players.push({ uid: 'stale', handle: 'Old', country: 'Scotland', periods: scoring.computePeriods([{ day: '2026-11-03', status: 'settled', outcome: 'won', points: 99, refOdds: 2 }], new Date('2026-11-04T12:00:00Z')) });
const ladders = scoring.buildLadders(players, now);
const world = ladders.find(l => l.id === 'weekly__world');
assert.strictEqual(world.total, 60, 'last week\'s stats are not on this week\'s ladder');
assert.strictEqual(world.entries.length, 50, 'top 50 only');
assert.strictEqual(world.entries[0].handle, 'P59');
const paisley = ladders.find(l => l.id === 'weekly__town-paisley');
assert.strictEqual(paisley.total, 30);
assert(paisley.entries.every(e => Number(e.handle.slice(1)) % 2 === 1));
assert(ladders.find(l => l.id === 'yearly__uk'));
console.log('PASS: ladders rank the current period only, per tier, top 50');

console.log('ALL LEAGUE SERVER SCORING TESTS PASSED');
