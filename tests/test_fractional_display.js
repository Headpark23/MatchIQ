const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const calc = require('../market_calculations.js');
const FAIR = /^≈(\d+\/\d+|Evens)$/;

// Saved bets, accumulator legs, previews and exports use the fractional formatter.
assert.ok(/calc\.formatFractionalOdds\(\+entry\.odds\)/.test(html), 'saved bets use fractional display');
assert.ok(/calc\.formatFractionalOdds\(\+leg\.odds\)/.test(html), 'accumulator legs use fractional display');
assert.ok(/calc\.formatFractionalOdds\(odds\)/.test(html), 'single and combined previews use fractional display');
assert.match(html, /calc\.formatFractionalOdds\(e\.odds\)/, 'CSV exports fractional prices');
assert.match(html, /odds_fractional/, 'JSON export labels odds as fractional');
assert.ok(!/(?:[A-Za-z_$][\w$]*\.)?[A-Za-z_$]*[Oo]dds?\.toFixed\(/.test(html), 'no odds value is formatted as a decimal');
assert.doesNotMatch(html, /fair[^\n]{0,40}toFixed\(2\)/i, 'no fair odds rendered as decimals');
assert.doesNotMatch(html, /JSON\.stringify\(\(e\.legs/, 'CSV legs are quoted text, not raw JSON that splits columns');
assert.match(html, /const cell = value => '"' \+ String\(value \?\? ''\)\.replace\(\/"\/g, '""'\)/, 'CSV cells use RFC 4180 quoting');

// Model fair odds and bookmaker odds are kept apart, and no bookmaker price is invented.
assert.match(html, /Model fair odds/);
assert.match(html, /Bookmaker odds: not available/);
assert.match(html, /model_fair_odds/, 'diary keeps the model fair odds separate from the price taken');
assert.match(html, /That is not a bookmaker price/);

// Entry paths only accept UK fractional prices.
assert.ok(/type="text"[^>]*id="modal-odds-input"/.test(html), 'single-bet odds field accepts UK fractional text');
assert.ok(/Fractional Odds Actually Offered/.test(html));
assert.match(html, /selection \| fractional odds/i);
assert.ok(/id="modal-legs-input"[^>]*oninput="updateModalPnlPreview\(\)"/.test(html), 'editing accumulator legs refreshes the combined-price preview');
assert.doesNotMatch(html, /Decimal Odds Actually Offered/i);
assert.doesNotMatch(html, /using [“"]selection \| decimal odds/i);

// The formatter used for model fair odds.
assert.equal(calc.formatFairOdds(0.5), '≈Evens');
assert.equal(calc.formatFairOdds(2 / 3), '≈1/2');
assert.equal(calc.formatFairOdds(0.6), '≈4/6');
assert.equal(calc.formatFairOdds(0.42), '≈11/8');
assert.equal(calc.formatFairOdds(0.25), '≈3/1');
assert.equal(calc.formatFairOdds(0.03), '≈33/1');
assert.equal(calc.formatFairOdds(null), '—');
assert.equal(calc.formatFairOdds(1), '—');
for (const price of calc.UK_PRICE_LADDER) {
  assert.ok(calc.parseFractionalOdds(price) > 1, 'ladder price parses: ' + price);
  assert.match(calc.formatFairOdds(1 / calc.parseFractionalOdds(price)), FAIR, 'fair odds are always fractional');
}

// Every fair price the app will display, from the published data files.
let checked = 0;
function walk(value) {
  if (Array.isArray(value)) return value.forEach(walk);
  if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (/fair_odds$/.test(key) && typeof v === 'string') { assert.match(v, FAIR, key + ' = ' + v); checked++; }
      else walk(v);
    }
  }
}
for (const file of ['predictions.json', 'prediction_history.json']) {
  const p = path.join(root, 'data', file);
  if (fs.existsSync(p)) walk(JSON.parse(fs.readFileSync(p, 'utf8')));
}
assert.ok(checked > 0, 'published data contains fair odds to check');

console.log('PASS: User-facing MatchIQ odds paths are fractional (' + checked + ' published fair prices checked).');
