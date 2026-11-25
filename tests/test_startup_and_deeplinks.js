'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const appCode = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

// 1. Verify top-of-file deep-link guard preserves push & share-target routes
const guardSnippet = appCode.slice(0, appCode.indexOf("'use strict';"));
function runGuard(hash, search) {
  const ctx = { window: { location: { hash, search } } };
  vm.runInNewContext(guardSnippet, ctx);
  return ctx.window.location.hash;
}

assert.strictEqual(runGuard('#/results', '?from=push&k=recap'), '#/results', 'from=push must preserve target hash');
assert.strictEqual(runGuard('#/leagues', '?from=push&k=settled'), '#/leagues', 'from=push settled must preserve hash');
assert.strictEqual(runGuard('#/import', '?shared=1'), '#/import', 'shared=1 must preserve #/import');
assert.strictEqual(runGuard('#/leagues?join-league=ABCD2345', ''), '#/leagues?join-league=ABCD2345', 'join-league deep link preserved');
assert.strictEqual(runGuard('#/picks?slip=abc', ''), '#/picks?slip=abc', 'slip deep link preserved');
assert.strictEqual(runGuard('#/fixtures', ''), '#/', 'normal launch still lands on Home');

// 2. Verify loadData skips prediction_history.json and ensureHistoryLoaded fetches it on demand
assert.ok(appCode.includes("filter(([key]) => key !== 'history')"), 'loadData should defer prediction_history.json');
assert.ok(appCode.includes('async function ensureHistoryLoaded()'), 'ensureHistoryLoaded should exist');
assert.ok(!appCode.includes("fetch(url, { cache: 'no-store' })"), 'loadData should use conditional cache revalidation (no-cache), not no-store');

// 3. Verify verified-email error messages exist in client and Cloud Functions
assert.ok(appCode.includes("'verify-email-required'"), 'app.js should handle verify-email-required');
const fnCode = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
assert.ok(fnCode.includes('function isVerifiedToken(tok)'), 'functions/index.js should define isVerifiedToken');
assert.strictEqual(
  (fnCode.match(/if\s*\(!isVerifiedToken\(tok\)\)/g) || []).length,
  2,
  'both betAI and parseBetSlip should enforce isVerifiedToken'
);

console.log('PASS: test_startup_and_deeplinks.js');
