'use strict';

const assert = require('node:assert/strict');
const calc = require('../market_calculations.js');

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}

console.log('Testing Bet Diary & Settlement Engine...');

// 1. calculateBetProfit
// Won bets: profit = stake * (odds - 1)
close(calc.calculateBetProfit(10, 2.50, 'won'), 15.00, 'Standard win');
close(calc.calculateBetProfit(20, 1.50, 'won'), 10.00, 'Short odds win');
close(calc.calculateBetProfit(5, 11.00, 'won'), 50.00, 'Long shot win');
close(calc.calculateBetProfit(12.50, 1.833, 'won'), 10.41, 'Decimal precision win rounding');

// Lost bets: profit = -stake
close(calc.calculateBetProfit(10, 2.50, 'lost'), -10.00, 'Standard loss');
close(calc.calculateBetProfit(25.50, 1.50, 'lost'), -25.50, 'Decimal stake loss');

// Void bets: profit = 0
close(calc.calculateBetProfit(10, 2.50, 'void'), 0.00, 'Void bet returns zero profit');

// Pending bets: profit = null
assert.equal(calc.calculateBetProfit(10, 2.50, 'pending'), null, 'Pending bet profit is null');
assert.equal(calc.calculateBetProfit(10, 2.50, ''), null, 'Empty status is null');

// Edge / defensive cases
assert.equal(calc.calculateBetProfit(-10, 2.0, 'won'), null, 'Negative stake rejected');
assert.equal(calc.calculateBetProfit(10, 0.5, 'won'), null, 'Odds below 1.0 rejected');
assert.equal(calc.calculateBetProfit(null, 2.0, 'won'), null, 'Null stake rejected');

// 2. summarizeBetDiary
// Empty diary
const emptySummary = calc.summarizeBetDiary([]);
assert.equal(emptySummary.totalEntries, 0);
assert.equal(emptySummary.totalStaked, 0);
assert.equal(emptySummary.netProfit, 0);
assert.equal(emptySummary.winRatePct, 0);
assert.equal(emptySummary.roiPct, 0);

// Comprehensive diary with mixed outcomes
const testDiary = [
  { id: 'b1', fixture: 'Everton v Fulham', market: 'wins', selection: 'Everton Win', odds: 2.40, stake: 10, outcome: 'won', origin: 'matchiq' },
  { id: 'b2', fixture: 'Arsenal v Chelsea', market: 'wins', selection: 'Arsenal Win', odds: 1.85, stake: 20, outcome: 'won', origin: 'matchiq' },
  { id: 'b3', fixture: 'Liverpool v Leeds', market: 'corners', selection: 'Over 9.5', odds: 1.90, stake: 15, outcome: 'lost', origin: 'matchiq' },
  { id: 'b4', fixture: 'Man City v Brighton', market: 'wins', selection: 'Draw', odds: 4.80, stake: 5, outcome: 'lost', origin: 'independent' },
  { id: 'b5', fixture: 'Newcastle v Ipswich', market: 'wins', selection: 'Newcastle Win', odds: 1.35, stake: 30, outcome: 'void', origin: 'independent' },
  { id: 'b6', fixture: 'Tottenham v Sunderland', market: 'corners', selection: 'Over 9.5', odds: 1.80, stake: 10, outcome: 'pending', origin: 'matchiq' }
];

const summary = calc.summarizeBetDiary(testDiary);
assert.equal(summary.totalEntries, 6, 'Total entries count');
assert.equal(summary.pendingCount, 1, '1 pending bet');
assert.equal(summary.settledCount, 5, '5 settled bets');
assert.equal(summary.wonCount, 2, '2 won bets');
assert.equal(summary.lostCount, 2, '2 lost bets');
assert.equal(summary.voidCount, 1, '1 void bet');

// Total staked: 10 + 20 + 15 + 5 + 30 + 10 = 90
close(summary.totalStaked, 90.00, 'Total staked');
// Settled staked: 10 + 20 + 15 + 5 + 30 = 80
close(summary.settledStaked, 80.00, 'Settled staked');

// Profits:
// b1: 10 * (2.40 - 1) = +14.00
// b2: 20 * (1.85 - 1) = +17.00
// b3: -15.00
// b4: -5.00
// b5: 0.00
// Net = 14 + 17 - 15 - 5 + 0 = +11.00
close(summary.netProfit, 11.00, 'Net profit calculation');
close(summary.totalReturned, 91.00, 'Settled returns include winning payouts and returned void stakes');
assert.equal(summary.totalEntries, 6, 'Total bets placed');

// Win rate on settled: 2 won out of 5 settled = 40.0%
close(summary.winRatePct, 40.0, 'Win rate %');
// ROI on settled: 11 / 80 * 100 = 13.75%
close(summary.roiPct, 13.75, 'ROI %');

// Origin breakdown
assert.equal(summary.originBreakdown.matchiq.count, 4);
close(summary.originBreakdown.matchiq.staked, 55.00);
// matchiq profit: +14 + 17 - 15 = +16.00
close(summary.originBreakdown.matchiq.profit, 16.00);

assert.equal(summary.originBreakdown.independent.count, 2);
close(summary.originBreakdown.independent.staked, 35.00);
// independent profit: -5 + 0 = -5.00
close(summary.originBreakdown.independent.profit, -5.00);

// 3. calculateBrierScore
// Binary: (p - y)^2
close(calc.calculateBrierScore(0.80, 1, 'binary'), 0.04, 'Binary confident hit');
close(calc.calculateBrierScore(0.80, 0, 'binary'), 0.64, 'Binary confident miss');
close(calc.calculateBrierScore(0.50, 1, 'binary'), 0.25, 'Binary neutral');

// Multi-class 1X2: (pH - yH)^2 + (pD - yD)^2 + (pA - yA)^2
const p1X2 = { H: 0.60, D: 0.25, A: 0.15 };
// Outcome 'H' -> (0.60-1)^2 + 0.25^2 + 0.15^2 = 0.16 + 0.0625 + 0.0225 = 0.245
close(calc.calculateBrierScore(p1X2, 'H', '1x2'), 0.245, 'Multi-class home win');
// Outcome 'D' -> 0.60^2 + (0.25-1)^2 + 0.15^2 = 0.36 + 0.5625 + 0.0225 = 0.945
close(calc.calculateBrierScore(p1X2, 'D', '1x2'), 0.945, 'Multi-class draw surprise');
// Outcome 'A' -> 0.60^2 + 0.25^2 + (0.15-1)^2 = 0.36 + 0.0625 + 0.7225 = 1.145
close(calc.calculateBrierScore(p1X2, 'A', '1x2'), 1.145, 'Multi-class away upset');

// UK fractional rendering and independent accumulator calculations
assert.equal(calc.formatFractionalOdds(2.5), '3/2');
assert.equal(calc.formatFractionalOdds(1.833333333333), '5/6');
assert.equal(calc.formatFractionalOdds(1), 'Evens');
assert.equal(calc.formatFractionalOdds(1.91), '10/11');
assert.equal(calc.formatFractionalOdds(3.1897), '35/16');
const accA = calc.createAccumulator([{ selection: 'A', odds: 2.2 }, { selection: 'B', odds: 1.75 }], 10, 'Tester A');
const accB = calc.createAccumulator([{ selection: 'C', odds: 3.1 }, { selection: 'D', odds: 1.4 }], 5, 'Tester B');
close(accA.decimalOdds, 3.85, 'Accumulator A precise combined odds');
close(accA.potentialReturn, 38.5, 'Accumulator A potential return');
close(accB.decimalOdds, 4.34, 'Accumulator B remains independent');
assert.equal(accA.legs.length, 2);
assert.equal(accA.profile, 'Tester A');
assert.equal(calc.settleAccumulator(accA, ['won', 'lost']).outcome, 'lost');
assert.equal(calc.settleAccumulator(accA, ['won', 'void']).decimalOdds, 2.2);

assert.equal(calc.loadBetDiary({ getItem: () => null }, 'diary').length, 0);
const memoryStorage = { value: null, setItem(key, value) { this.value = value; }, getItem() { return this.value; } };
const storedAcc = [accA, accB];
calc.saveBetDiary(memoryStorage, 'diary', storedAcc);
assert.equal(calc.loadBetDiary(memoryStorage, 'diary').length, 2, 'Two separate bets survive storage reload');
assert.throws(() => calc.saveBetDiary({ setItem() { throw new Error('quota'); } }, 'diary', []), /quota/);
assert.throws(() => calc.loadBetDiary({ getItem() { throw new Error('blocked'); } }, 'diary'), /blocked/);

console.log('PASS: All Bet Diary and Brier score unit tests successfully verified.');
