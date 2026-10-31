const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

console.log('Testing Live Results Tracking, Chelsea settlement, and Multi-Sport/League coverage...');

const mcCode = fs.readFileSync('market_calculations.js', 'utf8');
const bbCode = fs.readFileSync('bet_builder.js', 'utf8');
const appCode = fs.readFileSync('app.js', 'utf8');

const FILES = {
  predictions: 'data/predictions.json',
  fixtures: 'data/fixtures.json',
  history: 'data/prediction_history.json',
  performance: 'data/performance.json',
  leagueValidation: 'data/league_validation.json',
  status: 'data/pipeline_status.json',
  reliability: 'data/model_reliability.json',
  odds: 'data/odds.json',
  multiSport: 'data/multi_sport_events.json'
};

const DATA = {};
for (const [k, p] of Object.entries(FILES)) {
  if (fs.existsSync(p)) {
    try { DATA[k] = JSON.parse(fs.readFileSync(p, 'utf8')); } catch(e) {}
  }
}

const mockEl = {
  innerHTML: '',
  querySelector: () => mockEl,
  querySelectorAll: () => [mockEl],
  setAttribute: () => {},
  removeAttribute: () => {},
  classList: { add: () => {}, remove: () => {} },
  dataset: {}
};

const mockStorage = {};
const domDoc = {
  getElementById: () => mockEl,
  querySelectorAll: () => [mockEl],
  querySelector: () => mockEl,
  addEventListener: () => {}
};

const sandbox = {
  location: { hash: '#/results', hostname: 'localhost' },
  addEventListener: () => {},
  scrollTo: () => {},
  document: domDoc,
  localStorage: {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
  },
  navigator: { onLine: true, serviceWorker: { addEventListener: () => {} }, userAgent: 'test' },
  console,
  setTimeout: () => {},
  setInterval: () => {},
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  DATA
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(mcCode, sandbox);
vm.runInContext(bbCode, sandbox);
vm.runInContext(appCode, sandbox);
vm.runInContext('Object.assign(DATA, ' + JSON.stringify(DATA) + ');', sandbox);

// 1. Verify Chelsea v Man United in historyRecords()
const history = vm.runInContext('historyRecords()', sandbox);
const chelseaRecords = history.filter(r => r.match_id === 'PL-2627-chelsea-v-man-united');
assert(chelseaRecords.length > 0, 'Chelsea v Man Utd records must exist in history');

const latestChelsea = chelseaRecords[chelseaRecords.length - 1];
console.log('Chelsea latest record evaluated:', latestChelsea.evaluated);
console.log('Chelsea result score:', (latestChelsea.result || {}).score);
console.log('Chelsea settlement:', latestChelsea.settlement);

assert.strictEqual(latestChelsea.evaluated, true, 'Chelsea match must be evaluated');
assert.strictEqual(latestChelsea.result.score[0], 2, 'Chelsea home score must be 2');
assert.strictEqual(latestChelsea.result.score[1], 0, 'Chelsea away score must be 0');
assert.strictEqual(latestChelsea.settlement.result.pick_won, true, 'Chelsea pick must have won');
console.log('✓ Chelsea v Man United properly settled and won');

// 2. Test viewResults() output for football
vm.runInContext("resultsSportFilter = 'football'; compFilter = 'ALL';", sandbox);
const footballHtml = vm.runInContext('viewResults()', sandbox);
assert(footballHtml.includes('Chelsea'), 'Results view must include Chelsea');
assert(footballHtml.includes('Man United'), 'Results view must include Man United');
assert(footballHtml.includes('All competitions') || footballHtml.includes('competitions'), 'Competitions bar must include competitions');
console.log('✓ Football results view renders settled Chelsea fixture');

// 3. Test that each of the 13 leagues is present in LEAGUES
const expectedLeagues = ['PL', 'ELC', 'E2', 'E3', 'SC0', 'SC1', 'BL1', 'PD', 'SA', 'FL1', 'N1', 'P1', 'B1'];
const leaguesObj = vm.runInContext('LEAGUES', sandbox);
expectedLeagues.forEach(code => {
  assert(leaguesObj[code], `League ${code} must exist in LEAGUES`);
});
console.log(`✓ All ${expectedLeagues.length} leagues present in LEAGUES`);

// 4. Test multi-sport results rendering
const sports = ['tennis', 'golf', 'darts', 'rugby'];
sports.forEach(sport => {
  vm.runInContext(`resultsSportFilter = '${sport}';`, sandbox);
  const sportHtml = vm.runInContext('viewResults()', sandbox);
  assert(sportHtml.includes('predictions settled so far'), `${sport} must render settled predictions headline`);
  assert(sportHtml.includes('hit rate'), `${sport} must render hit rate`);
});
console.log('✓ All 4 other sports (tennis, golf, darts, rugby) render verified predictions and results');

// 5. Verify checkAutoUpdateResults function exists
const checkFnType = vm.runInContext('typeof checkAutoUpdateResults', sandbox);
assert.strictEqual(checkFnType, 'function', 'checkAutoUpdateResults must be a function');
console.log('✓ checkAutoUpdateResults exists');

console.log('ALL LIVE RESULTS & MULTI-SPORT TESTS PASSED CLEANLY!');
