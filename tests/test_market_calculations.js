'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const calc = require('../market_calculations.js');

const page = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.match(page, /calc\.matchWinnerIndicator\(hv,av\)/, 'Dashboard uses the tested winner calculation');
assert.doesNotMatch(page, /avg\(av\.map\(r=>r\.FTR==='A'\?1:0\)\)/,
  'Dashboard no longer treats away wins as away losses');
assert.match(page, /calc\.dataFreshnessSummary\(d\)/, 'Dashboard uses per-season freshness reporting');

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}

// Known, independently calculated examples for all six displayed markets.
assert.equal(calc.total({ FTHG: '2', FTAG: '1' }, 'FTHG', 'FTAG'), 3, 'Goals total');
assert.equal(calc.overLine(3, 2.5), true, 'Goals label is Over 2.5');
assert.equal(calc.bothTeamsScored({ FTHG: '2', FTAG: '1' }), true, 'BTTS Yes');
assert.equal(calc.bothTeamsScored({ FTHG: '2', FTAG: '0' }), false, 'BTTS No');
assert.equal(calc.total({ HC: '6', AC: '5' }, 'HC', 'AC'), 11, 'Corners total');
assert.equal(calc.total({ HST: '4', AST: '3' }, 'HST', 'AST'), 7, 'Shots-on-target total');
assert.equal(calc.total({ HY: '2', AY: '3' }, 'HY', 'AY'), 5, 'Yellow-card total');

const homeMatches = [{ FTR: 'H' }, { FTR: 'H' }, { FTR: 'D' }];
const awayMatches = [{ FTR: 'H' }, { FTR: 'H' }, { FTR: 'A' }];
close(calc.matchWinnerIndicator(homeMatches, awayMatches), 200 / 3,
  'Two home wins out of three blended with two away losses out of three');
assert.equal(calc.MARKET_LABELS.wins,
  'Home-win frequency blended with away-loss frequency, not a calibrated win chance');
assert.deepEqual(Object.keys(calc.MARKET_LABELS).sort(),
  ['btts', 'cards', 'corners', 'goals', 'shots', 'wins']);
assert.match(page, /Historical home-win\/away-loss indicator/,
  'Displayed Match Winner label describes the corrected blend');

const recent = '2026-10-17T12:00:00+00:00';
const now = Date.parse('2026-10-18T12:00:00+00:00');
let summary = calc.dataFreshnessSummary({
  current_season: '2627',
  current_season_status: { season: '2627', status: 'updated', last_successful_refresh: recent },
  historical_seasons_updated: ['2425', '2526']
}, now);
assert.equal(summary.state, 'updated');
assert.match(summary.text, /Current season 2627 updated successfully/);
assert.match(summary.text, /Historical seasons updated: 2425, 2526/);

summary = calc.dataFreshnessSummary({
  current_season: '2627',
  current_season_status: { season: '2627', status: 'unavailable', last_successful_refresh: recent },
  historical_seasons_updated: ['2425', '2526']
}, now);
assert.equal(summary.state, 'unavailable');
assert.match(summary.text, /Current season 2627 unavailable/);

summary = calc.dataFreshnessSummary({
  current_season: '2627',
  current_season_status: { season: '2627', status: 'updated', last_successful_refresh: '2026-10-01T12:00:00+00:00' },
  historical_seasons_updated: []
}, now);
assert.equal(summary.state, 'stale');
assert.match(summary.text, /Current season 2627 stale/);

summary = calc.dataFreshnessSummary({
  last_successful_refresh: recent,
  season_status: [
    { season: '2425', rows: 380 },
    { season: '2526', rows: 380 },
    { season: '2627', rows: 60 }
  ]
}, now);
assert.equal(summary.state, 'updated');
assert.match(summary.text, /Current season 2627 updated successfully/);

// Unit tests for Poisson calculations and BTTS probability model
close(calc.poissonOver(10.45, 9.5), 0.5969605533394432, 'Corners Poisson Over 9.5');
close(calc.poissonOver(3.45, 2.5), 0.6698056996226208, 'Goals Poisson Over 2.5');
const bttsResult = calc.bttsProbability(2.30, 1.15);
assert.ok(bttsResult !== null);
close(bttsResult.yes, 0.6148500232762109, 'BTTS Yes Poisson');
close(bttsResult.no, 0.38514997672378914, 'BTTS No Poisson');

// Unit tests for Bet Diary calculations and Brier evaluation
// 1. calculateBetProfit
close(calc.calculateBetProfit(10.0, 2.5, 'won'), 15.0, 'Bet Won: £10 @ 2.50 = £15 profit');
close(calc.calculateBetProfit(15.0, 1.85, 'won'), 12.75, 'Bet Won: £15 @ 1.85 = £12.75 profit');
close(calc.calculateBetProfit(10.0, 2.5, 'lost'), -10.0, 'Bet Lost: £10 stake lost');
close(calc.calculateBetProfit(10.0, 2.5, 'void'), 0.0, 'Bet Void: £0 return');
assert.equal(calc.calculateBetProfit(10.0, 2.5, 'pending'), null, 'Bet Pending: null profit');

// 2. summarizeBetDiary
const sampleDiary = [
  { id: '1', stake: 10, odds: 2.5, outcome: 'won', origin: 'matchiq' },
  { id: '2', stake: 10, odds: 3.0, outcome: 'lost', origin: 'independent' },
  { id: '3', stake: 5, odds: 2.0, outcome: 'won', origin: 'matchiq' },
  { id: '4', stake: 10, odds: 1.9, outcome: 'void', origin: 'matchiq' },
  { id: '5', stake: 20, odds: 2.1, outcome: 'pending', origin: 'independent' }
];
const diarySummary = calc.summarizeBetDiary(sampleDiary);
assert.equal(diarySummary.totalEntries, 5, '5 total diary entries');
assert.equal(diarySummary.pendingCount, 1, '1 pending bet');
assert.equal(diarySummary.settledCount, 4, '4 settled bets');
assert.equal(diarySummary.wonCount, 2, '2 won bets');
assert.equal(diarySummary.lostCount, 1, '1 lost bet');
assert.equal(diarySummary.voidCount, 1, '1 void bet');
close(diarySummary.totalStaked, 55.0, 'Total staked £55');
close(diarySummary.settledStaked, 35.0, 'Settled staked £35');
// Profit: Won 10*(2.5-1)=15, Lost -10, Won 5*(2-1)=5, Void 0 => 15 - 10 + 5 + 0 = 10.0
close(diarySummary.netProfit, 10.0, 'Net profit £10.00');
close(diarySummary.winRatePct, 50.0, 'Win rate 50% (2 of 4 settled)');
close(diarySummary.roiPct, 28.57142857142857, 'ROI % on settled stakes');
assert.equal(diarySummary.originBreakdown.matchiq.count, 3, '3 MatchIQ suggestions');
assert.equal(diarySummary.originBreakdown.independent.count, 2, '2 Independent choices');

// 3. calculateBrierScore
// Binary: probability 0.60, outcome 1 (hit) => (0.6 - 1)^2 = 0.16
close(calc.calculateBrierScore(0.60, 1, 'binary'), 0.16, 'Binary Brier score');
// Multi-class 1X2: H:0.55, D:0.25, A:0.20, outcome 'H' => (0.55-1)^2 + 0.25^2 + 0.20^2 = 0.2025 + 0.0625 + 0.04 = 0.305
close(calc.calculateBrierScore({ H: 0.55, D: 0.25, A: 0.20 }, 'H', '1x2'), 0.305, '1X2 Multi-class Brier score');

console.log('All six market calculations, labels, freshness states, Bet Diary, and Brier PASS');
