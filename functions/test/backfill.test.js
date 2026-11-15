'use strict';
// Unit tests for the owner backfill planner (no Firebase needed): node functions/test/backfill.test.js
const assert = require('assert');
const backfill = require('../lib/backfill');

const fixtures = [
  { id: 'PL-ars-tot', home: 'Arsenal', away: 'Tottenham', kickoff_utc: '2026-11-08T15:00:00Z', status: 'FINISHED', score: [2, 1] },
  { id: 'PL-che-liv', home: 'Chelsea', away: 'Liverpool', kickoff_utc: '2026-11-08T17:30:00Z', status: 'FINISHED', score: [0, 0] },
  { id: 'PL-new-avl', home: 'Newcastle', away: 'Aston Villa', kickoff_utc: '2026-11-09T20:00:00Z', status: 'FINISHED', score: [1, 1] }
];
const odds = { matches: { 'PL-ars-tot': { selections: { 'result:H': { decimal: 1.8 }, 'result:D': { decimal: 3.8 }, 'result:A': { decimal: 15 } } } } };
const e = (id, extra) => Object.assign({ id, type: 'single', date: '2026-11-08', timestamp: '2026-11-08T16:00:00Z', marketName: 'Match result', odds: 2.5, outcome: 'won' }, extra);

const diary = [
  { uid: 'u1', entry: e('b1', { match_id: 'PL-ars-tot', selection: 'Arsenal' }) },                    // linked, after kick-off: still added
  { uid: 'u1', entry: e('b2', { selection: 'Chelsea v Liverpool draw' }) },                          // found from text
  { uid: 'u1', entry: e('b3', { selection: 'Golf: Rory to win', match_id: undefined }) },            // not football
  { uid: 'u1', entry: e('b4', { match_id: 'PL-ars-tot', selection: 'Arsenal', date: '2026-10-20' }) }, // before the window
  { uid: 'u2', entry: e('c1', { match_id: 'PL-ars-tot', selection: 'Spurs' }) },
  { uid: 'u2', entry: { id: 'c2', type: 'accumulator', date: '2026-11-08', timestamp: '2026-11-08T10:00:00Z', selection: 'Arsenal + Newcastle', odds: 4,
    legs: [{ selection: 'Arsenal v Tottenham: Arsenal', odds: 1.8 }, { selection: 'Newcastle v Aston Villa: Newcastle', odds: 2.2 }] } }
];
const existing = [{ uid: 'u2', slot: '2026-11-08', betId: 'old' }, { uid: 'u1', slot: '2026-11-08-2', betId: 'b2' }];

const plan = backfill.planBackfill({ diary, existing, fixtures, odds, predictions: null, since: '2026-11-01' });
const ids = plan.add.map(a => a.uid + ':' + a.doc.betId + '@' + a.slot).sort();
assert.deepStrictEqual(ids, ['u1:b1@2026-11-08', 'u2:c1@2026-11-08-3', 'u2:c2@2026-11-08-2'], JSON.stringify(ids));
const b1 = plan.add.find(a => a.doc.betId === 'b1');
assert.strictEqual(b1.checked.status, 'pending');
assert.strictEqual(b1.checked.refOdds, 1.8, 'bookmaker price where there is one');
const c2 = plan.add.find(a => a.doc.betId === 'c2');
assert.strictEqual(c2.checked.market, 'acca');
assert.strictEqual(c2.checked.legs[1].refOdds, 2.2, 'unpriced leg at the player price');
assert.strictEqual(plan.skipped, 1, 'only the golf bet is skipped (b2 already in, b4 outside the window)');

// Five a day at most, counting what is already there.
const many = [];
for (let i = 0; i < 7; i++) many.push({ uid: 'u3', entry: e('m' + i, { match_id: 'PL-ars-tot', selection: 'Arsenal', timestamp: '2026-11-08T0' + i + ':00:00Z' }) });
const capped = backfill.planBackfill({ diary: many, existing: [{ uid: 'u3', slot: '2026-11-08', betId: 'x' }], fixtures, odds, since: '2026-11-01' });
assert.strictEqual(capped.add.length, 4);
assert.deepStrictEqual(capped.add.map(a => a.doc.betId), ['m0', 'm1', 'm2', 'm3'], 'earliest saved take the free slots');
assert.strictEqual(capped.reasons['Already 5 league bets that day.'], 3);

console.log('backfill planner: all tests passed');
