const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Forecast/detail odds must pass through the same formatter as saved-bet odds.
assert.ok(/calc\.formatFractionalOdds\(100\s*\/\s*winProb\)/.test(html), 'model fair odds use fractional display');
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

console.log('PASS: User-facing MatchIQ odds paths are guarded against decimal display.');
