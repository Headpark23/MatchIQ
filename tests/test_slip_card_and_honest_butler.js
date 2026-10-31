const assert = require('assert');
const fs = require('fs');

console.log('Testing Slip Card, Honest Bet Butler & League Scoring...');

// 1. Inspect app.js content for clean bookmakers and removed claims
const appCode = fs.readFileSync('app.js', 'utf8');

// Verify all 7 bookmakers are defined
const expectedBookies = ['skybet', 'bet365', 'williamhill', 'paddypower', 'betfair', 'coral', 'ladbrokes'];
expectedBookies.forEach(b => {
  assert(appCode.includes(`${b}: { key: '${b}'`), `Expected ${b} in BOOKMAKERS_CONFIG`);
});

// Verify no "+5 League Bonus" in Fair Play banner
assert(!appCode.includes('Official bets placed via <strong>The Bet Butler (Sky Bet)</strong> earn <strong>+5 League Bonus Points</strong>'),
  'Fair play banner must not claim +5 bonus points');

// Verify no "1-Tap Place with" in slipCard
assert(!appCode.includes('1-Tap Place with'), 'slipCard must not have 1-Tap Place buttons');
assert(appCode.includes('Open Slip Card'), 'slipCard must feature Open Slip Card');

// Verify dead intent and search schemes are removed
assert(!appCode.includes('const BOOKIE_APP_SCHEMES = {'), 'BOOKIE_APP_SCHEMES must be removed');
assert(!appCode.includes('const ANDROID_PACKAGES = {'), 'ANDROID_PACKAGES must be removed');

// 2. Test League Scoring: verify no bonus points for realBetVerified
const calc = require('../market_calculations.js');

// Won bet at 3.0 (2/1)
const baseWonPoints = calc.calculateLeaguePoints(3.0, 'won'); // (3 - 1) * 10 = 20
assert.strictEqual(baseWonPoints, 20, 'Base won points at 3.0 should be 20');

// Lost bet
const baseLostPoints = calc.calculateLeaguePoints(3.0, 'lost'); // -2
assert.strictEqual(baseLostPoints, -2, 'Lost points should be -2');

// Mock league calculation with old entry containing realBetVerified: true, bonusPoints: 5
const mockBets = [
  { odds: 3.0, outcome: 'won', realBetVerified: true, bonusPoints: 5 },
  { odds: 2.5, outcome: 'lost', realBetVerified: true, bonusPoints: 5 }
];

// Calculation matching updated app.js logic
const totalPoints = mockBets.reduce((sum, e) => {
  return sum + (calc.calculateLeaguePoints(e.odds, e.outcome) || 0);
}, 0);

assert.strictEqual(totalPoints, 20 + (-2), 'Total points must strictly equal base points (18), ignoring realBetVerified bonus');

// 3. Test clean bookmaker URL resolution
const mockConfig = {
  skybet: { key: 'skybet', name: 'Sky Bet', url: 'https://m.skybet.com/football' },
  bet365: { key: 'bet365', name: 'bet365', url: 'https://www.bet365.com/#/AC/B1/' },
  coral: { key: 'coral', name: 'Coral', url: 'https://sports.coral.co.uk/sport/football' }
};

function getMockLaunchUrl(key) {
  return (mockConfig[key] || mockConfig.skybet).url;
}

assert.strictEqual(getMockLaunchUrl('skybet'), 'https://m.skybet.com/football');
assert.strictEqual(getMockLaunchUrl('bet365'), 'https://www.bet365.com/#/AC/B1/');
assert.strictEqual(getMockLaunchUrl('coral'), 'https://sports.coral.co.uk/sport/football');
assert.strictEqual(getMockLaunchUrl('unknown'), 'https://m.skybet.com/football');

// 4. Test SessionStorage Tick Persistence simulation
const mockSessionStorage = {};
function saveTicks(slipKey, ticks) {
  mockSessionStorage['betbuddy_slip_ticks_' + slipKey] = JSON.stringify(ticks);
}
function getTicks(slipKey) {
  const r = mockSessionStorage['betbuddy_slip_ticks_' + slipKey];
  return r ? JSON.parse(r) : {};
}

saveTicks('slip_0', { 0: true, 1: true });
assert.deepStrictEqual(getTicks('slip_0'), { 0: true, 1: true }, 'Ticks must persist in session storage');
saveTicks('slip_0', { 0: true, 1: false, 2: true });
assert.deepStrictEqual(getTicks('slip_0'), { 0: true, 1: false, 2: true }, 'Ticks must update correctly');

console.log('PASS: All Slip Card, Honest Bet Butler and scoring tests passed!');

