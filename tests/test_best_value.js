'use strict';

const assert = require('node:assert/strict');
const calc = require('../market_calculations.js');

const bands = [
  { band: '40-50%', lo: 0.4, hi: 0.5, n: 170, observed_rate: 0.376, established: true },
  { band: '50-60%', lo: 0.5, hi: 0.6, n: 104, observed_rate: 0.596, established: true },
  { band: '80-100%', lo: 0.8, hi: 1.01, n: 2, observed_rate: 1, established: false }
];
const reliability = { markets: { wins: { bands } } };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: expected ${b}, got ${a}`);

const sel = (over = {}) => ({ id: 'result:H', group: 'result', market: 'result', key: 'H', p: 0.55, status: 'validated', isPick: true, ...over });
const sibs = [{ id: 'result:D' }, { id: 'result:A' }];

// ---- valueVerdict: missing or unreadable odds are Awaiting Odds, never a verdict
for (const bad of [undefined, null, '', '   ', 'abc', '0/1', '-3', '1/0']) {
  assert.equal(calc.valueVerdict(sel(), bad, sibs, {}, bands).verdict, 'awaiting_odds', `awaiting odds for ${JSON.stringify(bad)}`);
}

// ---- fractional odds, implied probability and expected value (6/4 = 2.5 decimal)
let v = calc.valueVerdict(sel({ p: 0.55 }), '6/4', sibs, {}, bands);
near(v.dec, 2.5, 'decimal odds'); near(v.implied, 0.4, 'implied probability'); near(v.ev, 0.55 * 2.5 - 1, 'expected value');
assert.equal(v.verdict, 'value', '+37.5% EV is Potential Value');
assert.equal(v.margin, null, 'no margin without every outcome priced');
assert.equal(v.priceText, '6/4');
assert.equal(calc.valueVerdict(sel(), 'Evens', sibs, {}, bands).dec, 2, 'Evens is 2.0');

// ---- the +5% line: exactly +5% is value, just under is not
assert.equal(calc.VALUE_MIN_EV, 0.05);
assert.equal(calc.valueVerdict(sel({ p: 0.5 }), '11/10', sibs, {}, bands).verdict, 'value', '+5% EV is value');
v = calc.valueVerdict(sel({ p: 0.55 }), '4/5', sibs, {}, bands);
assert.equal(v.verdict, 'no_value', 'a short price is No Value');
assert.ok(v.ev < 0 && /under the \+5%/.test(v.why));

// ---- bookmaker margin: 6/4, 5/2, 2/1 -> overround of 1.9%, removed from the implied chance
const prices = { 'result:H': '6/4', 'result:D': '5/2', 'result:A': '2/1' };
v = calc.valueVerdict(sel(), prices['result:H'], sibs, prices, bands);
const book = 1 / 2.5 + 1 / 3.5 + 1 / 3;
near(v.margin, book - 1, 'bookmaker margin'); near(v.fairImplied, 0.4 / book, 'implied chance with margin removed');
assert.ok(v.margin > 0 && /margin is removed/.test(v.why), 'verdict explains margin removal');
// One missing sibling price keeps the margin unknown rather than guessing
assert.equal(calc.valueVerdict(sel(), '6/4', sibs, { 'result:D': '5/2' }, bands).margin, null);

// ---- No Bet: never value without a validated model, a backtested outcome and an established band
assert.equal(calc.valueVerdict(sel({ status: 'provisional' }), '10/1', sibs, {}, bands).verdict, 'no_bet', 'provisional estimate');
assert.equal(calc.valueVerdict(sel({ status: 'league' }), '10/1', sibs, {}, bands).verdict, 'no_bet', 'league fallback');
assert.equal(calc.valueVerdict(sel({ isPick: false, p: 0.55 }), '10/1', sibs, {}, bands).verdict, 'no_bet', 'result outcome that is not the top pick');
assert.equal(calc.valueVerdict(sel({ p: 0.85 }), '5/1', sibs, {}, bands).verdict, 'no_bet', 'band with too few backtest picks');
assert.equal(calc.valueVerdict(sel({ p: 0.2 }), '5/1', sibs, {}, bands).verdict, 'no_bet', 'no band covers the probability');
assert.equal(calc.valueVerdict(sel(), '10/1', sibs, {}, undefined).verdict, 'no_bet', 'no reliability data at all');
// A No Bet still reports the numbers so the user can see why
v = calc.valueVerdict(sel({ status: 'provisional', p: 0.55 }), '6/4', sibs, {}, bands);
near(v.ev, 0.375, 'No Bet still reports EV');

// ---- synthetic prediction for ranking and best-value scans
const sels2 = (pairs) => pairs.map(([key, label, p]) => ({ key, label, p, fair_odds: '1/1' }));
const line = (l, over, ref) => ({ line: l, over: { key: 'over', label: 'Over ' + l, p: over, fair_odds: '1/1' }, under: { key: 'under', label: 'Under ' + l, p: 1 - over, fair_odds: '1/1' }, league_p: ref });
const pred = (tier = 'T1') => ({
  match_id: 'm1',
  markets: {
    result: { tier, evidence: { status: tier === 'T1' ? 'validated' : 'provisional', strength: tier === 'T1' ? 'moderate' : 'weak' }, league_p: [0.45, 0.25, 0.3],
      pick: { key: 'H', label: 'Home win', p: 0.55 }, selections: sels2([['H', 'Home win', 0.55], ['D', 'Draw', 0.25], ['A', 'Away win', 0.2]]) },
    goals: { evidence: { status: 'provisional', strength: 'weak' }, lines: [line(1.5, 0.8, 0.79), line(2.5, 0.56, 0.55), line(3.5, 0.3, 0.3)] },
    corners: { evidence: { status: 'provisional', strength: 'none' }, lines: [line(9.5, 0.9, null)] },
    cards: { unavailable: true },
    btts: { evidence: { status: 'provisional', strength: 'weak' }, league_p: 0.56, selections: sels2([['yes', 'Yes', 0.57], ['no', 'No', 0.43]]) }
  }
});

let ranked = calc.rankSelections(pred(), reliability);
assert.ok(ranked.every((s) => s.strength !== 'none'), 'league-average fallback markets are never ranked');
assert.ok(!ranked.some((s) => s.id === 'result:D' || s.id === 'result:A'), 'only the top match-result pick is calibrated');
let firstUnsupported = ranked.findIndex((s) => s.support === 'unsupported');
assert.ok(ranked.slice(firstUnsupported).every((s) => s.support === 'unsupported'), 'unsupported lines rank after every backtested selection');
assert.ok(ranked.find((s) => s.id === 'goals:over:1.5').support === 'unsupported' && ranked.find((s) => s.id === 'goals:over:2.5').support === 'provisional');
assert.ok(ranked.indexOf(ranked.find((s) => s.id === 'goals:over:1.5')) > ranked.indexOf(ranked.find((s) => s.id === 'goals:over:2.5')), 'an 80% untested line does not outrank a tested 56% one');
for (let i = 1; i < firstUnsupported; i++) assert.ok(ranked[i - 1].lower_bound >= ranked[i].lower_bound, 'backtested selections are ordered by lower bound');

const six = calc.topSix(pred(), reliability);
assert.ok(six.length <= 6);
assert.equal(new Set(six.map((s) => s.group)).size, six.length, 'never both sides of one line');
assert.equal(six[0].id, ranked[0].id, 'the leader is the strongest ranked selection');
assert.ok(six.some((s) => s.market === 'result' && s.support === 'validated'), 'the validated result pick is eligible');
assert.ok(six.some((s) => s.support === 'unsupported'), 'unsupported lines fill in when fewer than six are backtested');
assert.equal(calc.topSix(pred('T3'), reliability).some((s) => s.market === 'result'), false, 'league-average result is never promoted');
const t2 = calc.topSix(pred('T2'), reliability).find((s) => s.market === 'result');
assert.equal(t2.support, 'provisional'); assert.equal(t2.n, 41);

// A heavy backtested favourite does not get a probability boost from thin evidence
const thin = calc.rankSelections(pred('T2'), reliability).find((s) => s.market === 'result');
assert.ok(thin.credible < thin.p, 'promoted-club probability is pulled toward the league rate');

// ---- Best Value is assessed across every selection, not just the top six
const p = pred();
assert.equal(calc.bestValue(p, {}, bands), null, 'no prices -> Awaiting Odds');
assert.equal(calc.bestValue(p, { 'goals:over:3.5': 'abc' }, bands), null, 'unreadable prices do not count');
let bv = calc.bestValue(p, { 'goals:over:3.5': '9/1', 'result:H': '6/4' }, bands);
assert.equal(bv.sel.id, 'result:H', 'a Potential Value selection beats a bigger-EV No Bet');
assert.equal(bv.v.verdict, 'value');
assert.ok(!six.some((s) => s.id === 'goals:over:3.5') && calc.allSelections(p).some((s) => s.id === 'goals:over:3.5'), 'goals over 3.5 is outside the top six but still assessable');
bv = calc.bestValue(p, { 'goals:over:3.5': '9/1', 'goals:over:1.5': '1/5' }, bands);
assert.equal(bv.v.verdict, 'no_bet', 'only unsupported markets priced -> No Bet');
assert.equal(bv.sel.id, 'goals:over:3.5', 'closest to value is the highest EV');
bv = calc.bestValue(p, { 'result:H': '4/5' }, bands);
assert.equal(bv.v.verdict, 'no_value');

console.log('PASS: valueVerdict, Top Six ranking and Best Value scan (fractional odds, EV, margin, missing odds, Potential Value, No Bet, Awaiting Odds)');
