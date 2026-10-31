// Test suite for Today's Best Value Bet feature and modal
const assert = require('assert');
const fs = require('fs');

console.log('--- Running Today\'s Best Value Feature Tests ---');

// 1. Verify app.js contains all necessary functions
const appCode = fs.readFileSync('app.js', 'utf8');
assert(appCode.includes('function getTodayBestValuePicks()'), 'getTodayBestValuePicks exists');
assert(appCode.includes('function openBestValueModal('), 'openBestValueModal exists');
assert(appCode.includes('function closeBestValueModal()'), 'closeBestValueModal exists');
assert(appCode.includes('function setBestValueTier('), 'setBestValueTier exists');
assert(appCode.includes('function renderBestValueModalContent()'), 'renderBestValueModalContent exists');
assert(appCode.includes('function addBestValueToDiary('), 'addBestValueToDiary exists');
assert(appCode.includes('function openSlipCardFromBestValue('), 'openSlipCardFromBestValue exists');
assert(appCode.includes("Today\\'s Best Value Bet") || appCode.includes("Today's Best Value Bet"), 'Hero card label exists in app.js');
console.log('✓ All Best Value core functions and hero card present in app.js');

// 2. Verify index.html contains modal backdrop
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert(indexHtml.includes('id="best-value-modal"'), 'Modal backdrop exists in index.html');
assert(indexHtml.includes('id="best-value-modal-body"'), 'Modal body container exists in index.html');
console.log('✓ Best Value modal markup verified in index.html');

// 3. Verify styles.css contains card & modal styles
const stylesCss = fs.readFileSync('styles.css', 'utf8');
assert(stylesCss.includes('.portal-card-best-value'), 'Card styles present in styles.css');
assert(stylesCss.includes('.best-value-dialog'), 'Modal dialog styles present in styles.css');
assert(stylesCss.includes('.bv-tabs'), 'Tab navigation styles present in styles.css');
assert(stylesCss.includes('.bv-summary-card'), 'Summary card styles present in styles.css');
console.log('✓ Best Value design tokens and responsive CSS present in styles.css');

// 4. Test calculation behavior with mock predictions
const calc = require('../market_calculations.js');
const builder = require('../bet_builder.js');
const predsData = JSON.parse(fs.readFileSync('data/predictions.json', 'utf8'));
const oddsData = JSON.parse(fs.readFileSync('data/odds.json', 'utf8'));
const relData = JSON.parse(fs.readFileSync('data/model_reliability.json', 'utf8'));
const preds = Object.values(predsData.predictions);

function feedFor(id) {
  return calc.feedPrices((oddsData.matches || {})[id], Date.now(), 12);
}

const pool = builder.legPool(preds, {
  calc,
  reliability: relData,
  feedFor,
  nowMs: Date.now(),
  timing: 'all'
});

assert(pool.length > 0, 'Leg pool has candidates');

const withEv = pool.map(leg => {
  const ev = (leg.odds * leg.p) - 1;
  return { ...leg, ev };
});

const todayStr = new Date().toISOString().slice(0, 10);
const todayPool = withEv.filter(l => l.fixture && l.fixture.kickoff_utc && l.fixture.kickoff_utc.slice(0, 10) === todayStr);
const candidatePool = todayPool.length >= 4 ? todayPool : withEv;
candidatePool.sort((a, b) => b.ev - a.ev);

const unique = [];
const seenMatches = new Set();
for (const leg of candidatePool) {
  if (!seenMatches.has(leg.matchId)) {
    seenMatches.add(leg.matchId);
    unique.push(leg);
    if (unique.length === 4) break;
  }
}

assert.strictEqual(unique.length, 4, 'Successfully extracts 4 unique matches for best value');
const single = unique.slice(0, 1);
const double = unique.slice(0, 2);
const treble = unique.slice(0, 3);
const fourFold = unique.slice(0, 4);

assert.strictEqual(single.length, 1, 'Single has 1 leg');
assert.strictEqual(double.length, 2, 'Double has 2 legs');
assert.strictEqual(treble.length, 3, 'Treble has 3 legs');
assert.strictEqual(fourFold.length, 4, '4-Fold has 4 legs');

const singleOdds = single[0].odds;
const doubleOdds = double[0].odds * double[1].odds;
const trebleOdds = doubleOdds * treble[2].odds;
const fourFoldOdds = trebleOdds * fourFold[3].odds;

assert(doubleOdds > singleOdds, 'Double odds compound higher than single');
assert(trebleOdds > doubleOdds, 'Treble odds compound higher than double');
assert(fourFoldOdds > trebleOdds, '4-Fold odds compound higher than treble');

console.log('✓ Value calculations and compounding verified cleanly');
console.log('\nALL TODAY\'S BEST VALUE BET TESTS PASSED! ✓');
