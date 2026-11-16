'use strict';
// Push notification wording: node functions/test/push.test.js
const assert = require('assert');
const push = require('../lib/push');

// Settled: one winner, one loser, a void, and several at once.
let m = push.settledMessage([{ outcome: 'won', points: 12, selection: 'Arsenal v Chelsea: Arsenal win' }]);
assert.ok(m.title.startsWith('✅ Winner: Arsenal v Chelsea'));
assert.ok(m.body.startsWith('+12 pts'));
assert.strictEqual(m.url, '#/leagues');
assert.strictEqual(m.tag, 'settled');

m = push.settledMessage([{ outcome: 'lost', points: -2, selection: 'Leeds win' }]);
assert.strictEqual(m.title, 'Settled: Leeds win lost');
assert.ok(m.body.startsWith('-2 pts'));

m = push.settledMessage([{ outcome: 'void', points: 0, selection: 'Hull win' }]);
assert.ok(m.title.startsWith('Void'));
assert.ok(/did not go ahead/.test(m.body));

m = push.settledMessage([{ outcome: 'won', points: 10 }, { outcome: 'lost', points: -2 }, { outcome: 'won', points: 6 }]);
assert.strictEqual(m.title, '3 league bets settled: 2 won, 1 lost');
assert.ok(m.body.startsWith('+14 pts'));

assert.strictEqual(push.settledMessage([]), null);
assert.strictEqual(push.settledMessage([{ outcome: 'pending' }]), null);
assert.ok(push.settledMessage([{ outcome: 'won', points: 1, selection: 'x'.repeat(300) }]).title.length <= 90);

// Weekend picks: Friday evening, only Sat/Sun matches with a real lean between 50% and 85%.
const fri = Date.parse('2026-11-20T18:00:00Z');
const pred = (id, ko, label, p, strength = 'moderate') => [id, { fixture: { home: id + 'H', away: id + 'A', kickoff_utc: ko },
  markets: { result: { pick: { label, p }, evidence: { strength } } } }];
const predictions = { predictions: Object.fromEntries([
  pred('a', '2026-11-21T15:00:00Z', 'Man City win', 0.66),
  pred('b', '2026-11-22T14:00:00Z', 'Roma win', 0.64),
  pred('c', '2026-11-21T17:30:00Z', 'Schalke 04 win', 0.70, 'none'),   // league-average fallback: skipped
  pred('d', '2026-11-21T12:30:00Z', 'Bayern Munich win', 0.90),        // too short: skipped
  pred('e', '2026-11-20T19:30:00Z', 'Lens win', 0.60),                  // Friday: skipped
  pred('f', '2026-11-24T19:45:00Z', 'Inter win', 0.70),                 // Tuesday: skipped
  pred('g', '2026-11-22T16:30:00Z', 'Draw', 0.52),
  pred('h', '2026-11-21T15:00:00Z', 'Wolves win', 0.55)
]) };
const top = push.weekendPicks(predictions, fri);
assert.deepStrictEqual(top.map(x => x.label), ['Man City win', 'Roma win', 'Wolves win']);
m = push.weekendPicksMessage(predictions, fri);
assert.strictEqual(m.title, 'This weekend’s picks are out');
assert.ok(m.body.includes('Man City, Roma, Wolves'));
assert.ok(m.body.includes('18+'));
assert.strictEqual(m.url, '#/picks');
assert.strictEqual(push.weekendPicksMessage({ predictions: {} }, fri), null);

// Monday recap: our picks over the last 7 days, and the two message shapes.
const mon = Date.parse('2026-11-16T09:00:00Z');
const rec = (id, kick, won, extra) => Object.assign({ match_id: id, evaluated: true, fixture: { kickoff_utc: kick }, settlement: { result: { pick_won: won } } }, extra);
const history = { records: [
  rec('a', '2026-11-14T15:00:00Z', true),
  rec('b', '2026-11-14T17:30:00Z', false),
  rec('b', '2026-11-14T17:30:00Z', true),          // a second record for the same match is not counted twice
  rec('c', '2026-11-08T15:00:00Z', true),          // more than 7 days ago
  rec('d', '2026-11-17T15:00:00Z', true),          // not played yet
  { match_id: 'e', evaluated: false, fixture: { kickoff_utc: '2026-11-15T15:00:00Z' } },
  rec('f', '2026-11-15T12:00:00Z', true, { result: { kickoff_utc: '2026-11-15T12:30:00Z' } })
] };
const wk = push.weeklyPickResults(history, mon);
assert.deepStrictEqual(wk, { right: 2, total: 3 });
assert.deepStrictEqual(push.weeklyPickResults({ records: [] }, mon), { right: 0, total: 0 });
assert.deepStrictEqual(push.weeklyPickResults(null, mon), { right: 0, total: 0 });

m = push.weeklyRecapMessage([{ outcome: 'won', points: 12 }, { outcome: 'lost', points: -2 }, { outcome: 'won', points: 6 }, { outcome: 'void', points: 0 }], wk);
assert.strictEqual(m.title, 'Your week: 2 won, 1 lost (+16 pts)');
assert.ok(m.body.startsWith('Our picks went 2 from 3.'));
assert.ok(m.body.includes('18+'));
assert.strictEqual(m.url, '#/leagues');
assert.strictEqual(m.tag, 'recap');
m = push.weeklyRecapMessage([{ outcome: 'lost', points: -2 }], { right: 0, total: 0 });
assert.strictEqual(m.title, 'Your week: 0 won, 1 lost (-2 pts)');
assert.ok(!/Our picks/.test(m.body));
m = push.weeklyRecapMessage([], wk);                  // no league bets: how our picks did
assert.strictEqual(m.title, 'Last week: our picks went 2 from 3');
assert.strictEqual(m.url, '#/results');
assert.ok(m.body.includes('18+'));
m = push.weeklyRecapMessage([{ outcome: 'void', points: 0 }], wk);  // only a void: not a bet result
assert.strictEqual(m.url, '#/results');
assert.strictEqual(push.weeklyRecapMessage([], { right: 0, total: 0 }), null);
assert.strictEqual(push.weeklyRecapMessage(undefined, undefined), null);

assert.ok(push.isDeadToken('messaging/registration-token-not-registered'));
assert.ok(!push.isDeadToken('messaging/internal-error'));

console.log('push tests: ok');
