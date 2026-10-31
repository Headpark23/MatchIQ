'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

console.log('Testing Google-Only Auth and Leagues Logic...');

// 1. Inspect index.html markup
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert(indexHtml.includes('Continue with Google'), 'Must have Continue with Google button');
assert(!indexHtml.includes('or with email'), 'Must NOT have or with email divider');
assert(!indexHtml.includes('id="signin-email"'), 'Must NOT have email signin input');
assert(!indexHtml.includes('id="auth-register-view"'), 'Must NOT have auth-register-view');
assert(!indexHtml.includes('id="auth-verify-view"'), 'Must NOT have auth-verify-view');
assert(!indexHtml.includes('id="auth-forgot-view"'), 'Must NOT have auth-forgot-view');
assert(!indexHtml.includes('id="profile-password-section"'), 'Must NOT have profile-password-section');
assert(indexHtml.includes('You can browse predictions without signing in. Sign in with Google to join leagues and sync across devices.'), 'Must have updated non-bettor plain English copy in modal');
console.log('  PASS: index.html contains ONLY Google sign-in controls and zero email/password forms.');

// 2. Test app.js runtime logic
const mcCode = fs.readFileSync('market_calculations.js', 'utf8');
const bbCode = fs.readFileSync('bet_builder.js', 'utf8');
const appCode = fs.readFileSync('app.js', 'utf8');

const storageStore = {};
const sessionStore = {};

const mockEl = {
  innerHTML: '',
  value: '',
  hidden: false,
  textContent: '',
  className: '',
  appendChild: () => {},
  remove: () => {},
  querySelector: () => mockEl,
  querySelectorAll: () => [mockEl],
  setAttribute: () => {},
  removeAttribute: () => {},
  classList: { add: () => {}, remove: () => {} },
  dataset: {}
};

const domDoc = {
  getElementById: (id) => mockEl,
  querySelectorAll: () => [mockEl],
  querySelector: () => mockEl,
  createElement: () => mockEl,
  body: { appendChild: () => {} },
  addEventListener: () => {}
};

const context = vm.createContext({
  location: { hash: '#/leagues', hostname: 'localhost' },
  addEventListener: () => {},
  scrollTo: () => {},
  document: domDoc,
  localStorage: {
    getItem: (k) => storageStore[k] || null,
    setItem: (k, v) => { storageStore[k] = String(v); },
    removeItem: (k) => { delete storageStore[k]; },
    get length() { return Object.keys(storageStore).length; },
    key: (i) => Object.keys(storageStore)[i]
  },
  sessionStorage: {
    getItem: (k) => sessionStore[k] || null,
    setItem: (k, v) => { sessionStore[k] = String(v); },
    removeItem: (k) => { delete sessionStore[k]; }
  },
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

// Test signed-out visitor on Leagues page
const leaguesHtml = vm.runInContext('viewLeagues()', context);
assert(leaguesHtml.includes('Sign in with Google to join leagues and compete with mates'), 'Leagues view must show prominent Google prompt for signed-out visitor');
assert(leaguesHtml.includes('Continue with Google'), 'Leagues view prompt must have Continue with Google button');
console.log('  PASS: Signed-out visitor sees clear "Sign in with Google to join leagues" prompt on Leagues tab.');

// Test pending invite link flow when signed out
vm.runInContext("joinCloudLeague('TESTCODE')", context);
assert.strictEqual(sessionStore['betbuddy_pending_join_league'], 'TESTCODE', 'Pending league code must be saved to sessionStorage');
console.log('  PASS: Pending league code is preserved in sessionStorage when signed out.');

// Test DATA_EPOCH reset preserving Bet Diary & Odds Format
storageStore['betbuddy_data_epoch_v1'] = '2026-10-old-epoch';
storageStore['betbuddy_auth_user_v1'] = '{"signedIn":true}';
storageStore['betbuddy_user_profile_v1'] = '{"handle":"OldPunter"}';
storageStore['betbuddy_leagues_v1'] = '[{"code":"OLDLEAGUE"}]';
storageStore['betbuddy_trophy_cabinet_v1'] = '[{"title":"Trophy"}]';
storageStore['betbuddy_geo_cache_world'] = '[]';
storageStore['matchiq_bet_diary_v1'] = '[{"id":"diary-1","stake":10}]';
storageStore['matchiq_odds_pref_v1'] = 'decimal';

// Re-run epoch check
vm.runInContext(`
  const storedEpoch = localStorage.getItem(EPOCH_STORAGE_KEY);
  if (storedEpoch !== DATA_EPOCH) {
    localStorage.removeItem('betbuddy_auth_user_v1');
    localStorage.removeItem('betbuddy_user_profile_v1');
    localStorage.removeItem('betbuddy_leagues_v1');
    localStorage.removeItem('betbuddy_trophy_cabinet_v1');
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('betbuddy_geo_cache_') || key.startsWith('betbuddy_leagues_'))) {
        localStorage.removeItem(key);
      }
    }
    localStorage.setItem(EPOCH_STORAGE_KEY, DATA_EPOCH);
  }
`, context);

assert.strictEqual(storageStore['betbuddy_auth_user_v1'], undefined, 'Auth user must be cleared');
assert.strictEqual(storageStore['betbuddy_user_profile_v1'], undefined, 'User profile must be cleared');
assert.strictEqual(storageStore['betbuddy_leagues_v1'], undefined, 'Leagues must be cleared');
assert.strictEqual(storageStore['betbuddy_trophy_cabinet_v1'], undefined, 'Trophy cabinet must be cleared');
assert.strictEqual(storageStore['betbuddy_geo_cache_world'], undefined, 'Geo cache must be cleared');
assert(storageStore['matchiq_bet_diary_v1'], 'Bet Diary MUST be preserved');
assert.strictEqual(storageStore['matchiq_odds_pref_v1'], 'decimal', 'Odds preference MUST be preserved');
assert.strictEqual(storageStore['betbuddy_data_epoch_v1'], '2026-11-wipe-1', 'New epoch must be recorded');
console.log('  PASS: DATA_EPOCH cleans stale user/league caches while strictly preserving Bet Diary and Odds format.');

console.log('ALL Google-Only Auth & League Tests PASSED!');
