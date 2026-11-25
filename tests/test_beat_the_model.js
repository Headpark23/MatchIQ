'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const store = {};
const toasts = [];
const context = {
  console, Date, Math, JSON, Object, Array, Set, Map, Number, String, Boolean, RegExp, Error, Promise, URL, URLSearchParams, encodeURIComponent, decodeURIComponent,
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: i => Object.keys(store)[i] || null
  },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { hash: '#/', search: '', origin: 'https://betbuddyuk.com', pathname: '/' },
  history: { replaceState: () => {} },
  navigator: { userAgent: 'node-test' },
  document: {
    getElementById: () => ({ innerHTML: '', textContent: '', hidden: false, setAttribute: () => {}, querySelector: () => null }),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  scrollTo: () => {},
    title: ''
  },
  addEventListener: () => {},
  scrollTo: () => {},
  fetch: () => Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
};
context.window = context;

vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'market_calculations.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'bet_builder.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'settlement.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'league_sync.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8'), context);

// Override toast so we can verify feedback messages
context.toast = msg => toasts.push(msg);

const future1 = new Date(Date.now() + 3 * 3600000).toISOString();
const future2 = new Date(Date.now() + 6 * 3600000).toISOString();
const past1 = new Date(Date.now() - 4 * 3600000).toISOString();

vm.runInContext(`
  DATA.fixtures = {
    fixtures: [
      { id: 'PL-f1', home: 'Arsenal', away: 'Chelsea', competition: 'PL', status: 'SCHEDULED', kickoff_utc: '${future1}' },
      { id: 'PL-f2', home: 'Liverpool', away: 'Everton', competition: 'PL', status: 'SCHEDULED', kickoff_utc: '${future2}' },
      { id: 'PL-past', home: 'Man City', away: 'Spurs', competition: 'PL', status: 'FINISHED', kickoff_utc: '${past1}', score: [2, 1] }
    ]
  };
  DATA.predictions = {
    predictions: {
      'PL-f1': { match_id: 'PL-f1', fixture: DATA.fixtures.fixtures[0], markets: { result: { evidence: { status: 'validated', strength: 'strong' }, pick: { key: 'H', p: 0.62 }, probs: { H: 0.62, D: 0.22, A: 0.16 }, selections: [{ key: 'H', label: 'Arsenal', p: 0.62 }, { key: 'D', label: 'Draw', p: 0.22 }, { key: 'A', label: 'Chelsea', p: 0.16 }] } } },
      'PL-f2': { match_id: 'PL-f2', fixture: DATA.fixtures.fixtures[1], markets: { result: { evidence: { status: 'validated', strength: 'strong' }, pick: { key: 'H', p: 0.58 }, probs: { H: 0.58, D: 0.24, A: 0.18 }, selections: [{ key: 'H', label: 'Liverpool', p: 0.58 }, { key: 'D', label: 'Draw', p: 0.24 }, { key: 'A', label: 'Everton', p: 0.18 }] } } }
    }
  };
`, context);

// 1. Home renders Beat the Model card above the fold
const homeInitial = vm.runInContext('viewHome()', context);
assert.ok(homeInitial.includes('Beat the Model'), 'Home should render Beat the Model card');
assert.ok(homeInitial.includes('Arsenal'), 'Home should show upcoming featured match');
assert.ok(homeInitial.includes('Next kick-off'), 'Hero should include live countdown pulse');

// 2. 1-tap picking works without signing in & shows challenge CTA + guest sign-in nudge
vm.runInContext("pickBeatTheModel('PL-f1', 'A')", context);
assert.ok(toasts.some(t => t.includes('taking on Bet Buddy')), 'Fading model should show taking-on feedback');
const homePicked = vm.runInContext('viewHome()', context);
assert.ok(homePicked.includes('Challenge a mate'), 'Picking should unlock Challenge a mate button');
assert.ok(homePicked.includes('Save your streak'), 'Guest user should see gentle sign-in nudge after picking');

// 3. Auto-settlement from official finished score + streak tracking
vm.runInContext(`
  const st = loadBtmState();
  st.picks['PL-past'] = {
    fixtureId: 'PL-past', home: 'Man City', away: 'Spurs', kickoff_utc: '${past1}',
    userPick: 'H', modelPick: 'A', modelProb: 0.4, pickedAt: '${past1}',
    outcome: null, userWon: null, modelWon: null, settledAt: null
  };
  saveBtmState(st);
  settleBeatTheModel();
`, context);
const stats = vm.runInContext('getBtmStats(loadBtmState())', context);
assert.strictEqual(stats.settledCount, 1);
assert.strictEqual(stats.userWins, 1);
assert.strictEqual(stats.modelWins, 0);
assert.strictEqual(stats.streak, 1);

// 4. Mate challenge URL round-trip
const url = vm.runInContext('buildBtmChallengeUrl(getBeatTheModelMatches(), loadBtmState())', context);
assert.ok(url.includes('#/?btm='), 'Challenge URL should contain btm param');
context.location.hash = url.slice(url.indexOf('#'));
vm.runInContext('parseMateChallengeFromHash()', context);
const homeMate = vm.runInContext('viewHome()', context);
assert.ok(homeMate.includes('challenged you!'), 'Opening mate challenge URL should show H2H banner');

// 5. Completing all featured matches auto-collapses the card, with Show/Hide toggle
vm.runInContext("pickBeatTheModel('PL-f2', 'H')", context);
const homeCollapsed = vm.runInContext('viewHome()', context);
assert.ok(homeCollapsed.includes('btm-card is-collapsed'), 'Completing all picks should auto-collapse Beat the Model');
assert.ok(homeCollapsed.includes('Show picks'), 'Collapsed card should offer Show picks toggle');
vm.runInContext('toggleBtmExpanded()', context);
const homeExpanded = vm.runInContext('viewHome()', context);
assert.ok(homeExpanded.includes('Hide ▴'), 'Expanded completed card should offer Hide toggle');

console.log('PASS: test_beat_the_model.js');
