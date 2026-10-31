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
  clearTimeout: clearTimeout,
  console: console
};
context.globalThis = context;
context.window = context;

vm.createContext(context);
vm.runInContext(mc, context);
vm.runInContext(bb, context);
vm.runInContext(js, context);
vm.runInContext('Object.assign(DATA, ' + JSON.stringify(DATA) + ');', context);

vm.runInContext(`
  // 1. Test 2-Leg Acca
  setBuilderLegs(2);
  let out2 = builderOutput();
  let r2 = builderResult;
  console.log('--- LEGS = 2 ---');
  console.log('builderState.legs:', builderState.legs);
  console.log('Slips count:', r2.slips.length);
  console.log('All slips have 2 legs:', r2.slips.every(s => s.legs.length === 2));
  console.log('Output has (2-Leg Acca):', out2.includes('(2-Leg Acca)'));
  if (!r2.slips.every(s => s.legs.length === 2)) throw new Error('Legs 2 mismatch');

  // 2. Test 4-Leg Acca
  setBuilderLegs(4);
  let out4 = builderOutput();
  let r4 = builderResult;
  console.log('--- LEGS = 4 ---');
  console.log('builderState.legs:', builderState.legs);
  console.log('Slips count:', r4.slips.length);
  console.log('All slips have 4 legs:', r4.slips.every(s => s.legs.length === 4));
  console.log('Output has (4-Leg Acca):', out4.includes('(4-Leg Acca)'));
  if (!r4.slips.every(s => s.legs.length === 4)) throw new Error('Legs 4 mismatch');

  // 3. Test 3-Leg Acca
  setBuilderLegs(3);
  let out3 = builderOutput();
  let r3 = builderResult;
  console.log('--- LEGS = 3 ---');
  console.log('builderState.legs:', builderState.legs);
  console.log('Slips count:', r3.slips.length);
  console.log('All slips have 3 legs:', r3.slips.every(s => s.legs.length === 3));
  console.log('Output has (3-Leg Acca):', out3.includes('(3-Leg Acca)'));
  if (!r3.slips.every(s => s.legs.length === 3)) throw new Error('Legs 3 mismatch');

  // 4. Test ordering with custom items
  customAccaLegs = [{ id: 1, label: 'Test Custom', p: 0.5, odds: 2 }];
  let outCustom = builderOutput();
  let bestValIdx = outCustom.indexOf('Best Value &amp; Target Match');
  let customIdx = outCustom.indexOf('Your Custom Mixed Acca');
  console.log('Best Value comes BEFORE Custom Acca in output:', bestValIdx < customIdx);
  if (bestValIdx >= customIdx) throw new Error('Custom acca is overriding Best Value top position');

  console.log('ALL BUILDER RECALCULATION TESTS PASSED SUCCESFULLY!');
`, context);
