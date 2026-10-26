const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Forecast/detail odds must pass through the same formatter as saved-bet odds.
assert.ok(/calc\.formatFairOdds\(winProb \/ 100\)/.test(html), 'match-result fair odds use the UK fair-odds formatter');
assert.ok(/calc\.formatFairOdds\(cornerProb \/ 100\)/.test(html), 'corners fair odds use the UK fair-odds formatter');
assert.ok(/calc\.formatFairOdds\(s\.prob\)/.test(html), 'signal cards show fair odds through the UK fair-odds formatter');
assert.doesNotMatch(html, /fair[^\n]{0,40}toFixed\(2\)/i, 'no fair odds rendered as decimals');
assert.ok(/calc\.formatFractionalOdds\(mktOdds\)/.test(html), 'market-consensus odds use fractional display');
assert.ok(/calc\.formatFractionalOdds\(\+entry\.odds\)/.test(html), 'saved bets use fractional display');
assert.ok(/calc\.formatFractionalOdds\(\+leg\.odds\)/.test(html), 'accumulator legs use fractional display');
assert.ok(/calc\.formatFractionalOdds\(odds\)/.test(html), 'single and combined previews use fractional display');
assert.ok(!/(?:[A-Za-z_$][\w$]*\.)?[A-Za-z_$]*[Oo]dds?\.toFixed\(/.test(html), 'no odds value is formatted as a decimal');
assert.doesNotMatch(html, /fairOdds\s*=\s*\(100\s*\/\s*winProb\)\.toFixed/);
assert.doesNotMatch(html, /mktOdds\.toFixed/);

// New user entry and export paths must not ask for or emit decimal odds.
assert.ok(/type="text"[^>]*id="modal-odds-input"/.test(html), 'single-bet odds field accepts UK fractional text');
assert.ok(/Fractional Odds Actually Offered/.test(html));
assert.match(html, /selection \| fractional odds/i);
assert.ok(/id="modal-legs-input"[^>]*oninput="updateModalPnlPreview\(\)"/.test(html), 'editing accumulator legs refreshes the combined-price preview');
assert.doesNotMatch(html, /Decimal Odds Actually Offered/i);
assert.doesNotMatch(html, /using [“"]selection \| decimal odds/i);
assert.match(html, /calc\.formatFractionalOdds\(e\.odds\)/, 'CSV exports fractional prices');
assert.match(html, /odds_fractional/, 'JSON export labels odds as fractional');
assert.doesNotMatch(html, /JSON\.stringify\(\(e\.legs/, 'CSV legs are quoted text, not raw JSON that splits columns');
assert.match(html, /const cell = value => '"' \+ String\(value \?\? ''\)\.replace\(\/"\/g, '""'\)/, 'CSV cells use RFC 4180 quoting');

const calc = require('../market_calculations.js');
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
  assert.match(calc.formatFairOdds(1 / calc.parseFractionalOdds(price)), /^≈(\d+\/\d+|Evens)$/, 'fair odds are always fractional');
}

console.log('PASS: User-facing MatchIQ odds paths are guarded against decimal display.');
