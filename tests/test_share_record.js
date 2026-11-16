'use strict';
// Sharing how our picks did: node tests/test_share_record.js
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const mockEl = { innerHTML: '', querySelector: () => mockEl, querySelectorAll: () => [mockEl], setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} }, dataset: {} };
const context = vm.createContext({
  location: { hash: '#/', hostname: 'localhost' }, addEventListener() {}, scrollTo() {},
  document: { getElementById: () => mockEl, querySelectorAll: () => [mockEl], querySelector: () => mockEl, addEventListener() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { userAgent: 'test', clipboard: { writeText: () => Promise.resolve() } },
  console, setTimeout, setInterval: () => 0, clearTimeout, fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
});
context.globalThis = context; context.window = context;
['market_calculations.js', 'bet_builder.js', 'settlement.js', 'league_sync.js', 'app.js'].forEach(f => vm.runInContext(fs.readFileSync(f, 'utf8'), context));

const now = Date.parse('2026-11-16T12:00:00Z');
const rec = (id, kick, won) => ({ match_id: id, evaluated: true, fixture: { competition: 'PL', kickoff_utc: kick }, settlement: { result: { pick_won: won } } });
const set = history => vm.runInContext('DATA.history = { records: ' + JSON.stringify(history) + ' }; DATA.performance = null;', context);

// Fewer than 5 finished picks this week: falls back to the overall record, or says nothing if there is none.
set([rec('a', '2026-11-14T15:00:00Z', true)]);
assert.strictEqual(vm.runInContext('weeklyPicksRecord(' + now + ')', context).total, 1);
assert.strictEqual(vm.runInContext('ourRecordShareText(' + now + ')', context), '');

// Enough this week: the weekly record, counted once per match, wins and losses alike.
const week = [];
['a', 'b', 'c', 'd', 'e', 'f'].forEach((id, i) => week.push(rec(id, '2026-11-1' + (1 + (i % 4)) + 'T15:00:00Z', i < 4)));
week.push(rec('a', '2026-11-11T15:00:00Z', true));             // duplicate record of a match
week.push(rec('old', '2026-11-01T15:00:00Z', true));          // outside the 7 days
week.push(rec('future', '2026-11-20T15:00:00Z', true));       // not played yet
set(week);
const wk = JSON.parse(JSON.stringify(vm.runInContext('weeklyPicksRecord(' + now + ')', context)));
assert.deepStrictEqual(wk, { right: 4, total: 6 });
const text = vm.runInContext('ourRecordShareText(' + now + ')', context);
assert(text.startsWith('Bet Buddy’s football picks this week: 4 right from 6 (67%).'), text);
assert(text.includes('sealed before kick-off') && text.includes('wins and losses alike'), 'says how the record is kept');
assert(text.includes('Estimates, not tips') && text.includes('18+') && text.includes('BeGambleAware'), 'keeps the responsible-gambling wording');
assert(!/£|profit|stake|winnings/i.test(text), 'never shares money or bets');
assert(!text.includes('Overall'), 'no overall line when there is no overall record');
vm.runInContext('DATA.performance = { markets: { result: { n: 100, hits: 55, pick_hit_rate: 0.55, mean_pick_p: 0.55, sufficient_sample: true } }, by_competition: {} };', context);
const withAll = vm.runInContext('ourRecordShareText(' + now + ')', context);
assert(/Overall so far: 55 from 100 \(55%\)/.test(withAll), 'a good or bad week is always shown beside the overall record: ' + withAll);

console.log('share record tests: ok');
