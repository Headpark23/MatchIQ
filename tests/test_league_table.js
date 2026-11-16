'use strict';
// League table and earlier meetings on the match page: node tests/test_league_table.js
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

const fx = (id, home, away, score, day, comp = 'PL') => ({ id, competition: comp, season: '2627', home, away, kickoff_utc: '2026-10-' + day + 'T15:00:00Z', status: score ? 'FINISHED' : 'SCHEDULED', score: score || undefined });
const fixtures = [
  fx('a', 'Arsenal', 'Chelsea', [2, 1], '10'),
  fx('b', 'Chelsea', 'Leeds', [1, 1], '17'),
  fx('c', 'Leeds', 'Arsenal', [0, 3], '24'),
  fx('d', 'Arsenal', 'Leeds', null, '31'),            // not played: counts for nothing
  fx('e', 'Ajax', 'PSV', [4, 0], '12', 'N1'),          // another league: kept apart
  fx('f', 'Chelsea', 'Arsenal', null, '28', 'PL')
];
vm.runInContext('Object.assign(DATA, { fixtures: { fixtures: ' + JSON.stringify(fixtures) + ' }, predictions: { predictions: {} } })', context);

const plain = v => JSON.parse(JSON.stringify(v));  // arrays from the vm context have a different prototype
const table = plain(vm.runInContext('leagueTable("PL")', context));
assert.deepStrictEqual(table.map(r => r.team), ['Arsenal', 'Chelsea', 'Leeds']);
assert.deepStrictEqual(table.map(r => r.pts), [6, 1, 1]);
const arsenal = table[0];
assert.deepStrictEqual([arsenal.p, arsenal.w, arsenal.d, arsenal.l, arsenal.gf, arsenal.ga, arsenal.gd], [2, 2, 0, 0, 5, 1, 4]);
// Chelsea and Leeds are level on points: Chelsea 2 for, 3 against (GD -1); Leeds 1 for, 4 against (GD -3).
assert.strictEqual(table[1].team, 'Chelsea');
assert.strictEqual(table[1].gd, -1);
assert.strictEqual(vm.runInContext('leagueTable("N1")', context).length, 2);

const meet = plain(vm.runInContext('earlierMeetings({ id: "f", season: "2627", home: "Chelsea", away: "Arsenal" })', context));
assert.deepStrictEqual(meet.map(m => m.id), ['a']);
assert.strictEqual(vm.runInContext('earlierMeetings({ id: "a", season: "2627", home: "Arsenal", away: "Chelsea" }).length', context), 0);

const html = vm.runInContext('matchTableBlock({ id: "f", competition: "PL", season: "2627", home: "Chelsea", away: "Arsenal" })', context);
assert(html.includes('League table'), 'renders the table card');
assert(html.includes('Chelsea 2nd'), 'shows the home side\'s position');
assert(html.includes('Arsenal 1st'), 'shows the away side\'s position');
assert(html.includes('Earlier this season') && html.includes('2–1'), 'shows the earlier meeting');
assert(html.includes('tie-breaks'), 'says how ties are ordered');
// Competitions without a table (cups, internationals) show nothing, and so does a league with no results yet.
assert.strictEqual(vm.runInContext('matchTableBlock({ id: "x", competition: "CL", season: "2627", home: "A", away: "B" })', context), '');
assert.strictEqual(vm.runInContext('matchTableBlock({ id: "x", competition: "SA", season: "2627", home: "A", away: "B" })', context), '');

console.log('league table tests: ok');
