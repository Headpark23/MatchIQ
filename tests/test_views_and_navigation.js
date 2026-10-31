'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

console.log('Testing View Rendering and Navigation Routes...');

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

const domWindow = {
  location: { hash: '#/picks', hostname: 'localhost' },
  addEventListener: () => {},
  scrollTo: () => {}
};
const domDoc = {
  getElementById: () => mockEl,
  querySelectorAll: () => [mockEl],
  querySelector: () => mockEl,
  addEventListener: () => {}
};

const context = vm.createContext({
  location: domWindow.location,
  addEventListener: () => {},
  scrollTo: () => {},
  document: domDoc,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  navigator: { userAgent: 'test', clipboard: { writeText: () => Promise.resolve() } },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
});
context.globalThis = context;
context.window = context;

vm.runInContext(mcCode, context);
vm.runInContext(bbCode, context);
vm.runInContext(appCode, context);
vm.runInContext('Object.assign(DATA, ' + JSON.stringify(DATA) + ');', context);

// Test all tab views
const views = [
  { name: 'home', fn: 'viewHome' },
  { name: 'picks', fn: 'viewPicks' },
  { name: 'fixtures', fn: 'viewFixtures' },
  { name: 'results', fn: 'viewResults' },
  { name: 'diary', fn: 'viewDiary' },
  { name: 'leagues', fn: 'viewLeagues' },
  { name: 'admin', fn: 'viewAdmin' },
  { name: 'commercial', fn: 'viewCommercial' },
  { name: 'more', fn: 'viewMore' }
];

for (const v of views) {
  const html = vm.runInContext(v.fn + '()', context);
  assert(typeof html === 'string', v.fn + ' must return a string');
  assert(html.length > 50, v.fn + ' HTML must not be empty');
  console.log('  PASS: ' + v.name + ' tab (' + v.fn + ') renders valid HTML (' + html.length + ' chars)');
}

// Test render() routing
const routes = ['#/picks', '#/results', '#/fixtures', '#/leagues', '#/diary', '#/more', '#/'];
for (const r of routes) {
  context.location.hash = r;
  vm.runInContext('render()', context);
  console.log('  PASS: render() executes cleanly for route ' + r);
}

console.log('ALL View & Navigation Tests PASSED!');

