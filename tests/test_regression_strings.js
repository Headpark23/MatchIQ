// UI regression checks for the Mission 064 single-design-system app.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const calcSrc = fs.readFileSync(path.join(root, 'market_calculations.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const predictions = JSON.parse(fs.readFileSync(path.join(root, 'data', 'predictions.json'), 'utf8')).predictions;

const checks = [
  ['one stylesheet, no legacy inline style block', html.includes('href="styles.css') && !/<style>/.test(html)],
  ['no legacy Stadium Control dashboard markup', !/stadium-control-card|research-hub|ribbon-bar/.test(html + app)],
  ['every view is routed through one renderer', ['viewHome', 'viewFixtures', 'viewMatch', 'viewResults', 'viewDiary', 'viewMore'].every(v => app.includes('function ' + v + '('))],
  ['every match analysis lists all six markets', /MARKET_ORDER = \['result', 'goals', 'btts', 'corners', 'cards', 'shots'\]/.test(app)],
  ['evidence strength shown separately from probability', app.includes('function meter(') && app.includes('Probability and evidence strength are shown separately')],
  ['diary storage key preserved', app.includes("'matchiq_bet_diary_v1'")],
  ['feedback storage key preserved', app.includes("'matchiq_ux_feedback_v1'")],
  ['hidden attribute always wins over component display rules', /\[hidden\] \{ display: none !important; \}/.test(css)],
  ['fixed tab bar is not trapped by header backdrop-filter', /\.app-header \{ backdrop-filter: none;/.test(css)],
  ['ring classes do not collide with the hero card', !/ring\([^)]*'hero/.test(app)],
  ['every upcoming prediction has a match result distribution', Object.values(predictions).every(p => p.markets.result && Math.abs(p.markets.result.selections.reduce((s, x) => s + x.p, 0) - 1) < 0.01)],
  ['promoted clubs are predicted, not dropped', Object.values(predictions).some(p => p.promoted.length > 0)],
  ['every prediction covers all six markets', Object.values(predictions).every(p => ['result', 'goals', 'btts', 'corners', 'cards', 'shots'].every(k => p.markets[k]))],
  ['every upcoming match has a sealed Most Likely or No Bet decision', Object.values(predictions).every(p => p.recommendations && ['most_likely', 'no_bet'].includes(p.recommendations.most_likely.decision) && p.recommendations.best_value.decision === 'no_bet')],
  ['value calls need a real price and the validated model', /sel\.status !== 'validated'/.test(calcSrc) && /VALUE_MIN_EV = 0\.05/.test(calcSrc) && /parseFractionalOdds\(text\)/.test(calcSrc)],
  ['bookmaker margin is removed when every outcome is priced', /fairImplied: complete \? implied \/ book : null/.test(calcSrc)],
  ['match page leads with a dynamic Top Six and keeps every market reachable', /calc\.topSix\(/.test(app) && /Every market and line/.test(app) && !/Every market<\/h2>/.test(app)],
  ['Best Value scans every selection, not only the Top Six', /calc\.bestValue\(/.test(app) && /function bestValue\(/.test(calcSrc)],
  ['Most Likely and Best Value both feed the Bet Diary', /rec: 'most_likely'/.test(app) && /rec: 'best_value'/.test(app)],
  ['non-validated estimates are labelled provisional', Object.values(predictions).every(p => p.markets.result.tier === 'T1' ? p.markets.result.evidence.status === 'validated' : p.markets.result.evidence.status === 'provisional')],
];

console.log('Regression Checks:');
let allPass = true;
for (const [name, pass] of checks) {
  console.log(' ', name, '->', pass ? 'PASS' : 'FAIL');
  if (!pass) allPass = false;
}
process.exit(allPass ? 0 : 1);
