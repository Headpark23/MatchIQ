const path = require('path');
const fs = require('fs');

const calc = require(path.join(__dirname, '../market_calculations.js'));
const builder = require(path.join(__dirname, '../bet_builder.js'));

const predsRaw = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/predictions.json'), 'utf8'));
const preds = Object.values(predsRaw.predictions || {});
const odds = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/odds.json'), 'utf8'));

console.log('Testing legPool generation with', preds.length, 'predictions...');
const pool = builder.legPool(preds, odds, calc, {
  userOddsFormat: 'fractional',
  scope: 'all'
});

console.log('Pool size:', pool.length);
const target = pool.filter(p => p.fixture.home.includes('West') || p.fixture.home.includes('Nice') || p.fixture.home.includes('Lille'));
console.log('Target legs in pool:', target.map(p => ({
  match: p.fixture.home + ' v ' + p.fixture.away,
  sel: p.label,
  odds: p.odds,
  fractional: p.fractional,
  priceSource: p.priceSource
})));

// Build slips for £10 stake, £30 win, 3 legs
const result = builder.buildSlips(pool, { stake: 10, win: 30, legs: 3, maxSlips: 5 });
console.log('Build result slips count:', result.slips ? result.slips.length : 0);
if (result.slips) {
  result.slips.forEach((s, idx) => {
    console.log(`\nSlip #${idx + 1}: ${s.legs.length} legs, combined odds: ${s.odds}`);
    s.legs.forEach(l => {
      console.log(`  - ${l.fixture.home} v ${l.fixture.away}: ${l.label} | fractional: "${l.fractional}" | odds: ${l.odds}`);
    });
  });
}
