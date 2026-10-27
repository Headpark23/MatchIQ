'use strict';

const assert = require('node:assert/strict');
const builder = require('../bet_builder.js');
const calc = require('../market_calculations.js');

// deterministic pseudo-random pool: 9 matches, 1 to 4 options each
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pool = [];
for (let m = 0; m < 9; m++) {
  for (let o = 0; o < 1 + Math.floor(rnd() * 4); o++) {
    const p = 0.25 + rnd() * 0.6;
    pool.push({ matchId: 'M' + m, selId: 'sel' + o, label: 'm' + m + 'o' + o, p, odds: Math.max(1.06, 1 / (p * 1.06)), priceSource: 'live', fractional: '' });
  }
}

// brute force: best chance among every legal set whose price is inside the same window
function brute(stake, win, legs) {
  const lnT = Math.log((stake + win) / stake), byMatch = {};
  pool.forEach((c) => { (byMatch[c.matchId] = byMatch[c.matchId] || []).push(c); });
  const ms = Object.values(byMatch);
  let best = null, nearest = null;
  (function rec(i, k, ln, lp) {
    if (k === legs) {
      const err = ln - lnT;
      if (err >= -0.03 && err <= 0.10 && (!best || lp > best)) best = lp;
      if (!nearest || Math.abs(err) < nearest.e) nearest = { e: Math.abs(err), lp };
      return;
    }
    if (i >= ms.length || ms.length - i < legs - k) return;
    rec(i + 1, k, ln, lp);
    for (const c of ms[i]) rec(i + 1, k + 1, ln + Math.log(c.odds), lp + Math.log(c.p));
  })(0, 0, 0, 0);
  return { best, nearest };
}

for (const [stake, win, legs] of [[10, 50, 4], [10, 20, 3], [5, 100, 5], [10, 9, 2], [20, 60, 4]]) {
  const res = builder.buildSlips(pool, { stake, win, legs });
  const ref = brute(stake, win, legs);
  const top = res.slips[0];
  assert.equal(top.legs.length, legs, 'leg count');
  assert.equal(new Set(top.legs.map((l) => l.matchId)).size, legs, 'one leg per match');
  if (ref.best !== null) {
    assert.ok(top.onTarget, `on target for ${stake}/${win}/${legs}`);
    const lnT = Math.log((stake + win) / stake), err = Math.log(top.odds) - lnT;
    assert.ok(err > -0.035 && err < 0.105, `price inside window (${err})`);
    assert.ok(Math.abs(Math.log(top.chance) - ref.best) < 0.08, `chance matches brute force for ${stake}/${win}/${legs}: ${Math.log(top.chance)} vs ${ref.best}`);
  }
  assert.ok(Math.abs(top.ret - top.odds * stake) < 1e-9, 'return = stake x odds');
  assert.ok(Math.abs(top.profit - (top.ret - stake)) < 1e-9, 'profit = return - stake');
  assert.ok(res.slips.length >= 1);
}

// an impossible target is answered with the nearest slip, flagged off target
const far = builder.buildSlips(pool, { stake: 10, win: 100000, legs: 2 });
assert.ok(far.slips[0].onTarget === false || far.error, 'unreachable target is not claimed as hit');

// validation
assert.ok(builder.buildSlips(pool, { stake: 0, win: 10, legs: 3 }).error);
assert.ok(builder.buildSlips(pool, { stake: 10, win: 10, legs: 0 }).error);
assert.ok(builder.buildSlips(pool, { stake: 10, win: 10, legs: 40 }).error);
assert.ok(/not possible/.test(builder.buildSlips(pool.slice(0, 1), { stake: 10, win: 10, legs: 3 }).error), 'too few matches');

// legPool: live prices used when fresh, estimates when not, unsupported lines never used, past matches skipped
const sel = (key, label, p) => ({ key, label, p, fair_odds: '' });
const pred = (id, hoursAhead) => ({
  match_id: id, fixture: { competition: 'SA', home: 'A', away: 'B', kickoff_utc: new Date(Date.now() + hoursAhead * 3600000).toISOString() },
  markets: {
    result: { tier: 'L1', evidence: { status: 'provisional', strength: 'moderate' }, pick: { key: 'H' }, selections: [sel('H', 'A win', 0.6), sel('D', 'Draw', 0.25), sel('A', 'B win', 0.15)] },
    goals: { evidence: { status: 'provisional', strength: 'weak' }, pick: { key: 'over', line: 2.5 }, lines: [
      { line: 2.5, over: { label: 'Over 2.5', p: 0.55, fair_odds: '' }, under: { label: 'Under 2.5', p: 0.45, fair_odds: '' }, league_p: 0.5 },
      { line: 3.5, over: { label: 'Over 3.5', p: 0.3, fair_odds: '' }, under: { label: 'Under 3.5', p: 0.7, fair_odds: '' }, league_p: 0.3 }] }
  }
});
const rel = { markets: { wins: { bands: [] } } };
const live = { 'M1': { state: 'fresh', details: { 'result:H': { decimal: 1.8, fractional: '4/5', bookmaker: 'Smarkets' } } } };
const pl = builder.legPool([pred('M1', 5), pred('M2', 6), pred('OLD', -3), pred('FAR', 24 * 30)], { calc, reliability: rel, feedFor: (id) => live[id] || { state: 'none', details: {} } });
assert.ok(!pl.some((l) => l.matchId === 'OLD' || l.matchId === 'FAR'), 'only matches inside the window');
assert.ok(!pl.some((l) => /3\.5/.test(l.label)), 'line never backtested is excluded');
const hLive = pl.find((l) => l.matchId === 'M1' && l.selId === 'result:H');
assert.equal(hLive.priceSource, 'live'); assert.equal(hLive.odds, 1.8); assert.equal(hLive.bookmaker, 'Smarkets');
const hEst = pl.find((l) => l.matchId === 'M2' && l.selId === 'result:H');
assert.equal(hEst.priceSource, 'estimated'); assert.ok(hEst.odds > 1.05 && hEst.odds < 3);

console.log('bet_builder tests passed');
