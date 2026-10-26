'use strict';
const assert = require('node:assert/strict');
const calc = require('../market_calculations.js');

const NOW = Date.parse('2026-10-28T12:00:00Z');
const entry = (retrieved, kickoff = '2026-10-31T12:30:00Z') => ({ kickoff_utc: kickoff, retrieved_at: retrieved,
  selections: { 'result:H': { fractional: '6/4', bookmaker: 'Bet365' }, 'goals:over:2.5': { fractional: '4/5', bookmaker: 'Bet365' } } });

let f = calc.feedPrices(entry('2026-10-28T09:00:00Z'), NOW);
assert.equal(f.state, 'fresh'); assert.equal(f.prices['result:H'], '6/4'); assert.equal(Math.round(f.ageHours), 3);

f = calc.feedPrices(entry('2026-10-27T20:00:00Z'), NOW);       // 16 h old
assert.equal(f.state, 'stale'); assert.deepEqual(f.prices, {}, 'stale prices are never used'); assert.ok(f.details['result:H'], 'but are still described');

f = calc.feedPrices(entry('2026-10-28T11:00:00Z', '2026-10-28T11:30:00Z'), NOW);  // kicked off
assert.equal(f.state, 'stale');

assert.equal(calc.feedPrices(undefined, NOW).state, 'none');
assert.equal(calc.feedPrices({ selections: {} }, NOW).state, 'none');
assert.equal(calc.feedPrices(entry('not a date'), NOW).state, 'stale');
assert.equal(calc.feedPrices(entry('2026-10-28T09:00:00Z'), NOW, 2).state, 'stale', 'custom limit');

// a fresh feed price is a real price: it produces a verdict instead of Awaiting Odds
const sel = { id: 'result:H', group: 'result', market: 'result', key: 'H', p: 0.5, status: 'provisional', isPick: true };
const v = calc.valueVerdict(sel, calc.feedPrices(entry('2026-10-28T09:00:00Z'), NOW).prices['result:H'], [], {}, []);
assert.notEqual(v.verdict, 'awaiting_odds');
console.log('PASS: automatic odds freshness, stale handling and verdict wiring');
