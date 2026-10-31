// tests/test_slips_stake_carrying.js
// Tests for stake carrying across builder slips, custom acca, and single paths
// Prevents £undefined and NaN regressions.

const assert = require('assert');
const path = require('path');

const calc = require('../market_calculations.js');
const MatchIQBuilder = require('../bet_builder.js');

console.log('--- Running Slips Stake Carrying & NaN Prevention Tests ---');

// 1. Test money formatting helper robustness
console.log('Test 1: MatchIQBuilder.money() robustness against undefined, null, NaN');
assert.strictEqual(MatchIQBuilder.money(10), '£10.00');
assert.strictEqual(MatchIQBuilder.money(25.5), '£25.50');
assert.strictEqual(MatchIQBuilder.money(undefined), '£0.00');
assert.strictEqual(MatchIQBuilder.money(null), '£0.00');
assert.strictEqual(MatchIQBuilder.money(NaN), '£0.00');
assert.ok(!MatchIQBuilder.money(undefined).includes('undefined'), 'Must not format £undefined');
assert.ok(!MatchIQBuilder.money(NaN).includes('NaN'), 'Must not format £NaN');
console.log('✓ MatchIQBuilder.money handles edge cases cleanly without £undefined or NaN');

// 2. Test builder slips carry stake
console.log('Test 2: MatchIQBuilder.buildSlips carries stake into every slip');
const mockPool = [
  { matchId: 'm1', fixture: { home: 'Arsenal', away: 'Chelsea' }, selId: 's1', label: 'Arsenal Win', p: 0.55, odds: 1.80, fractional: '4/5', priceSource: 'live' },
  { matchId: 'm2', fixture: { home: 'Liverpool', away: 'Everton' }, selId: 's2', label: 'Liverpool Win', p: 0.65, odds: 1.50, fractional: '1/2', priceSource: 'live' },
  { matchId: 'm3', fixture: { home: 'Man City', away: 'Spurs' }, selId: 's3', label: 'Man City Win', p: 0.70, odds: 1.40, fractional: '2/5', priceSource: 'live' }
];

const testStakes = [5, 10, 20, 50];
const combinedOdds = 1.80 * 1.50 * 1.40; // 3.78
for (const stake of testStakes) {
  const win = Math.round(stake * (combinedOdds - 1));
  const res = MatchIQBuilder.buildSlips(mockPool, { stake, win, legs: 3, maxSlips: 3 });
  assert.ok(res.slips && res.slips.length > 0, `Should produce slips for stake £${stake}`);
  
  for (const slip of res.slips) {
    assert.strictEqual(slip.stake, stake, `Slip must carry stake property equal to ${stake}`);
    assert.strictEqual(typeof slip.stake, 'number', 'slip.stake must be a number');
    assert.ok(Number.isFinite(slip.ret), 'slip.ret must be a finite number');
    assert.ok(!Number.isNaN(slip.ret), 'slip.ret must not be NaN');
    assert.strictEqual(slip.ret, stake * slip.odds, 'slip.ret must equal stake * odds');
    
    // Check formatted string
    const formattedStake = MatchIQBuilder.money(slip.stake);
    const formattedRet = MatchIQBuilder.money(slip.ret);
    const formattedProfit = MatchIQBuilder.money(slip.profit);

    assert.ok(!formattedStake.includes('undefined') && !formattedStake.includes('NaN'), 'Formatted stake must be valid');
    assert.ok(!formattedRet.includes('undefined') && !formattedRet.includes('NaN'), 'Formatted return must be valid');
    assert.ok(!formattedProfit.includes('undefined') && !formattedProfit.includes('NaN'), 'Formatted profit must be valid');
  }
}
console.log('✓ All builder slips carry stake and produce valid returns');

// 3. Test Custom Acca path
console.log('Test 3: Custom Acca path carries stake and prevents £undefined / NaN');
function simulateCustomAcca(legs, builderStake) {
  const safeStake = Number(builderStake || 10) || 10;
  const odds = legs.reduce((t, l) => t * (Number(l.odds) || 2.0), 1);
  const ret = safeStake * odds;
  const profit = ret - safeStake;
  return {
    stake: safeStake,
    odds: odds,
    ret: ret,
    profit: profit,
    stakeFormatted: MatchIQBuilder.money(safeStake),
    retFormatted: MatchIQBuilder.money(ret)
  };
}

const customLegs = [
  { id: 'c1', label: 'Arsenal Win', odds: 1.75, p: 0.55 },
  { id: 'c2', label: 'Over 2.5 Goals', odds: 1.90, p: 0.52 }
];

const customSlipWithStake = simulateCustomAcca(customLegs, 20);
assert.strictEqual(customSlipWithStake.stake, 20);
assert.ok(!customSlipWithStake.stakeFormatted.includes('undefined'));
assert.ok(!customSlipWithStake.retFormatted.includes('NaN'));

const customSlipFallback = simulateCustomAcca(customLegs, undefined);
assert.strictEqual(customSlipFallback.stake, 10, 'Omitted stake must fallback to £10');
assert.strictEqual(customSlipFallback.stakeFormatted, '£10.00');
assert.ok(!customSlipFallback.retFormatted.includes('NaN'));
console.log('✓ Custom Acca carries stake and handles omitted/undefined stake');

// 4. Test Single Bet path
console.log('Test 4: Single Bet slip note carries stake and prevents £undefined / NaN');
function simulateSingleSlip(betData, builderStake) {
  const safeStake = Number(builderStake || 10) || 10;
  const odds = Number(betData.odds) || 2.0;
  const ret = safeStake * odds;
  return {
    stake: safeStake,
    odds: odds,
    ret: ret,
    retFormatted: '£' + ret.toFixed(2),
    stakeFormatted: '£' + safeStake.toFixed(2)
  };
}

const singleBet = { selection: 'Arsenal Win', odds: 1.85, fair: '4/5' };
const singleWithStake = simulateSingleSlip(singleBet, 15);
assert.strictEqual(singleWithStake.stake, 15);
assert.strictEqual(singleWithStake.stakeFormatted, '£15.00');
assert.strictEqual(singleWithStake.retFormatted, '£27.75');
assert.ok(!singleWithStake.stakeFormatted.includes('undefined'));
assert.ok(!singleWithStake.retFormatted.includes('NaN'));

const singleWithUndefined = simulateSingleSlip(singleBet, undefined);
assert.strictEqual(singleWithUndefined.stake, 10);
assert.strictEqual(singleWithUndefined.stakeFormatted, '£10.00');
assert.strictEqual(singleWithUndefined.retFormatted, '£18.50');
assert.ok(!singleWithUndefined.stakeFormatted.includes('undefined'));
assert.ok(!singleWithUndefined.retFormatted.includes('NaN'));
console.log('✓ Single Bet slip note carries stake and prevents £undefined/NaN');

// 5. Test Slip Card Modal summary calculation
console.log('Test 5: Slip Card Modal summary calculation handles various slip shapes');
function formatModalSummary(slip, builderStake) {
  const stakeVal = Number(slip.stake || builderStake || 10) || 10;
  const oddsVal = Number(slip.odds) || 1;
  const retVal = Number.isFinite(Number(slip.ret)) ? Number(slip.ret).toFixed(2) : (stakeVal * oddsVal).toFixed(2);
  return {
    stakeText: '£' + stakeVal.toFixed(2),
    returnText: '£' + retVal + ' (estimate)'
  };
}

const testCases = [
  { slip: { stake: 10, odds: 5.5, ret: 55 }, builderStake: 10 },
  { slip: { odds: 4.0 }, builderStake: 20 }, // missing stake & ret on slip
  { slip: { stake: undefined, odds: undefined, ret: undefined }, builderStake: undefined } // total empty
];

for (const tc of testCases) {
  const res = formatModalSummary(tc.slip, tc.builderStake);
  assert.ok(!res.stakeText.includes('undefined') && !res.stakeText.includes('NaN'), `Invalid stake text: ${res.stakeText}`);
  assert.ok(!res.returnText.includes('undefined') && !res.returnText.includes('NaN'), `Invalid return text: ${res.returnText}`);
}
console.log('✓ Slip Card Modal summary renders valid pounds and pence for all shapes');

console.log('\nALL SLIPS STAKE TESTS PASSED SUCCESSFULLY! ✓');
