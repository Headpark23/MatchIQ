const fs = require('fs');
const js = fs.readFileSync('app.js', 'utf8');
const bb = fs.readFileSync('bet_builder.js', 'utf8');
const mc = fs.readFileSync('market_calculations.js', 'utf8');

const DATA = {
  predictions: JSON.parse(fs.readFileSync('data/predictions.json', 'utf8')),
  reliability: JSON.parse(fs.readFileSync('data/model_reliability.json', 'utf8')),
  fixtures: JSON.parse(fs.readFileSync('data/fixtures.json', 'utf8')),
  odds: JSON.parse(fs.readFileSync('data/odds.json', 'utf8')),
  multiSport: JSON.parse(fs.readFileSync('data/multi_sport_events.json', 'utf8'))
};

const vm = require('vm');
const dummyEl = { innerHTML: '', value: '', textContent: '', setAttribute: () => {}, classList: { toggle: () => {} }, querySelector: () => null };
const context = {
  window: { addEventListener: () => {}, location: { hash: '#/picks' }, scrollTo: () => {} },
  addEventListener: () => {},
  scrollTo: () => {},
  location: { hash: '#/picks' },
  document: { addEventListener: () => {}, querySelectorAll: () => [], getElementById: () => dummyEl, querySelector: () => dummyEl, title: '' },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  navigator: {},
  setTimeout: setTimeout,
  setInterval: () => 0,
  clearTimeout: clearTimeout,
  console: console
};
context.globalThis = context;
context.window = context;

vm.createContext(context);
vm.runInContext(mc, context);
vm.runInContext(bb, context);
// Evaluate the data as of its own publication time and over every published match, not the
// wall clock and the app's 7-day window: the scheduled refresh runs this test before it
// refreshes the data, so stale prices or an international break (next club match more than
// 7 days away) emptied the pool and blocked every refresh.
vm.runInContext('Date.now = () => ' + Date.parse(DATA.predictions.generated_at) + ';' +
  'const __legPool = MatchIQBuilder.legPool;' +
  'MatchIQBuilder.legPool = (preds, opts) => __legPool(preds, Object.assign({}, opts, { horizonMs: Infinity }));', context);
vm.runInContext(fs.readFileSync('settlement.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('league_sync.js', 'utf8'), context);
vm.runInContext(js, context);
vm.runInContext('Object.assign(DATA, ' + JSON.stringify(DATA) + ');', context);

vm.runInContext(`
  // Use the full 7-day pool so the test does not depend on how many matches are scheduled today.
  builderState.timing = 'all';
  // Which win targets a given acca size can hit depends on that day's prices, so try a few
  // amounts and use the first one that produces accas (the app shows a message otherwise).
  function legsWithFittingTarget(n) {
    for (const win of [25, 40, 60, 100, 150, 250, 500]) {
      builderState.win = win;
      setBuilderLegs(n);
      const out = builderOutput();
      if (builderResult && builderResult.slips && builderResult.slips.length) return out;
    }
    throw new Error('No win target produced a ' + n + '-leg acca: ' + JSON.stringify(builderResult));
  }
  // 1. Test 2-Leg Acca
  let out2 = legsWithFittingTarget(2);
  let r2 = builderResult;
  console.log('--- LEGS = 2 ---');
  console.log('builderState.legs:', builderState.legs);
  console.log('Slips count:', r2.slips.length);
  console.log('All slips have 2 legs:', r2.slips.every(s => s.legs.length === 2));
  console.log('Output has (2-Leg Acca):', out2.includes('(2-Leg Acca)'));
  if (!r2.slips.every(s => s.legs.length === 2)) throw new Error('Legs 2 mismatch');

  // 2. Test 4-Leg Acca
  let out4 = legsWithFittingTarget(4);
  let r4 = builderResult;
  console.log('--- LEGS = 4 ---');
  console.log('builderState.legs:', builderState.legs);
  console.log('Slips count:', r4.slips.length);
  console.log('All slips have 4 legs:', r4.slips.every(s => s.legs.length === 4));
  console.log('Output has (4-Leg Acca):', out4.includes('(4-Leg Acca)'));
  if (!r4.slips.every(s => s.legs.length === 4)) throw new Error('Legs 4 mismatch');

  // 3. Test 3-Leg Acca
  let out3 = legsWithFittingTarget(3);
  let r3 = builderResult;
  console.log('--- LEGS = 3 ---');
  console.log('builderState.legs:', builderState.legs);
  console.log('Slips count:', r3.slips.length);
  console.log('All slips have 3 legs:', r3.slips.every(s => s.legs.length === 3));
  console.log('Output has (3-Leg Acca):', out3.includes('(3-Leg Acca)'));
  if (!r3.slips.every(s => s.legs.length === 3)) throw new Error('Legs 3 mismatch');

  // 4. One acca is shown at a time, with a way to step through the other options.
  let one = legsWithFittingTarget(3);
  const cards = (one.match(/<article class="slip/g) || []).length;
  console.log('Acca cards shown:', cards);
  if (cards !== 1) throw new Error('Expected exactly one acca card, got ' + cards);
  if (builderResult.slips.length > 1 && !one.includes('Show another option')) throw new Error('Missing "Show another option"');
  if (/Expect to gain/.test(one)) throw new Error('Acca must not promise an expected gain');

  console.log('ALL BUILDER RECALCULATION TESTS PASSED SUCCESFULLY!');
`, context);
