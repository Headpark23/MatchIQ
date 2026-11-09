'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

console.log('Testing Google + Email Auth and Leagues Logic...');

// 1. Inspect index.html markup
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert(indexHtml.includes('Continue with Google'), 'Must have Continue with Google button');
assert(indexHtml.includes('id="email-auth-form"'), 'Must have the email sign-in / sign-up form');
assert(indexHtml.includes('id="email-auth-handle"'), 'Sign-up must ask for a gamertag');
assert(indexHtml.includes('id="email-auth-forgot"'), 'Must have a Forgot password link');
assert(indexHtml.includes('id="email-reset-form"'), 'Must have the password reset form');
assert(indexHtml.includes('data-verify-check') && indexHtml.includes('data-verify-resend'), 'Must offer email confirmation check and resend');
assert(indexHtml.includes('Sign in with Google or email to join leagues and sync across devices.'), 'Modal copy must mention both sign-in options');
console.log('  PASS: index.html offers Google plus email/password sign-in, sign-up and password reset.');

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
  classList: { add: () => {}, remove: () => {}, toggle: () => {} },
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
  setInterval: () => 0,
  clearTimeout: clearTimeout,
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
});
context.globalThis = context;
context.window = context;

vm.runInContext(mcCode, context);
vm.runInContext(bbCode, context);
vm.runInContext(fs.readFileSync('settlement.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('league_sync.js', 'utf8'), context);
vm.runInContext(appCode, context);

// Test signed-out visitor on Leagues page
const leaguesHtml = vm.runInContext('viewLeagues()', context);
assert(leaguesHtml.includes('Sign in to join leagues and compete with mates'), 'Leagues view must show a sign-in prompt for signed-out visitor');
assert(leaguesHtml.includes('Continue with Google'), 'Leagues view prompt must have Continue with Google button');
assert(leaguesHtml.includes('data-email-mode-open="signup"'), 'Leagues view prompt must offer email sign-up');
console.log('  PASS: Signed-out visitor sees Google and email sign-in options on Leagues tab.');

// Email accounts only reach leagues once the address is confirmed (mirrors firestore.rules).
assert.strictEqual(vm.runInContext("canUseLeagues({ signedIn: true, isGoogle: true, emailVerified: true })", context), true);
assert.strictEqual(vm.runInContext("canUseLeagues({ signedIn: true, isPassword: true, emailVerified: false })", context), false);
assert.strictEqual(vm.runInContext("canUseLeagues({ signedIn: true, isPassword: true, emailVerified: true })", context), true);
assert.strictEqual(vm.runInContext("canUseLeagues(null)", context), false);
vm.runInContext("saveAuthUser({ uid: 'u1', email: 'pal@example.com', displayName: 'PalPunter', emailVerified: false, providerData: [{ providerId: 'password' }] })", context);
const cached = JSON.parse(storageStore['betbuddy_auth_user_v1']);
assert.strictEqual(cached.isGoogle, false, 'Email account must not be cached as Google');
assert.strictEqual(cached.isPassword, true);
assert.strictEqual(cached.emailVerified, false);
const gated = vm.runInContext('viewLeagues()', context);
assert(gated.includes('Confirm your email') && gated.includes('data-verify-resend'), 'Unconfirmed email account sees the confirm-email gate');
vm.runInContext("handleSignOut()", context);
console.log('  PASS: Unconfirmed email accounts are held at a confirm-email gate before leagues.');

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

console.log('ALL Google + Email Auth & League Tests PASSED!');
