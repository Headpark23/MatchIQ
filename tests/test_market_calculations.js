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

console.log('All six market calculations, labels, and freshness states PASS');
