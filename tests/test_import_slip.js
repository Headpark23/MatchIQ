'use strict';
// Importing a bet from a bookmaker slip: node tests/test_import_slip.js
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
const run = code => vm.runInContext(code, context);
const plain = v => JSON.parse(JSON.stringify(v));

// ---- team names ----
const same = (a, b) => run('sameTeam(' + JSON.stringify(a) + ',' + JSON.stringify(b) + ')');
assert(same('Manchester United', 'Man United'));
assert(same('Man Utd', 'Man United'));
assert(same('Tottenham Hotspur', 'Tottenham'));
assert(same('Nottingham Forest', "Nott'm Forest"));
assert(same('Paris Saint-Germain', 'Paris SG'));
assert(same('Bayern München', 'Bayern Munich'));
assert(same('Arsenal FC', 'Arsenal'));
assert(!same('Manchester United', 'Man City'), 'two Manchester clubs are different');
assert(!same('Leeds United', 'Newcastle United'), 'a shared generic word is not a match');
assert(!same('Real Madrid', 'Real Betis'));
assert(!same('', 'Arsenal'));

// ---- matching on a small fake fixture list ----
const future = new Date(Date.now() + 2 * 86400000).toISOString(), past = new Date(Date.now() - 2 * 86400000).toISOString();
run('DATA.fixtures = { fixtures: ' + JSON.stringify([
  { id: 'f1', home: 'Man United', away: 'Arsenal', kickoff_utc: future, status: 'TIMED' },
  { id: 'f2', home: 'Chelsea', away: 'Spurs', kickoff_utc: past, status: 'FINISHED' }
]) + ' };');
const opt = k => ({ key: k, label: k, decimal: 2, est: true });
run('ownBetMarketsFor = fx => ' + JSON.stringify(['result:H', 'result:D', 'result:A', 'dc:1X', 'dc:X2', 'dc:12', 'dnb:H', 'tts:A', 'btts:yes', 'goals:over:2.5', 'goals:under:2.5'].map(k => opt(k))) + ';');

const leg = o => Object.assign({ sport: 'Football', home: '', away: '', pickedTeam: '', marketKey: 'other', outcome: 'other', line: null, selectionText: 'x', oddsText: '' }, o);
assert.strictEqual(run('findImportFixture(' + JSON.stringify(leg({ home: 'Manchester United', away: 'Arsenal' })) + ').id'), 'f1');
assert.strictEqual(run('findImportFixture(' + JSON.stringify(leg({ home: 'Arsenal', away: 'Manchester United' })) + ').id'), 'f1', 'order does not matter');
assert.strictEqual(run('findImportFixture(' + JSON.stringify(leg({ home: 'Arsenal', away: 'Chelsea' })) + ')'), null, 'both teams must match');

const key = o => run('importMarketKey(fixturesList()[0], ' + JSON.stringify(leg(o)) + ')');
assert.strictEqual(key({ marketKey: 'result', outcome: 'win', pickedTeam: 'Man Utd' }), 'result:H');
assert.strictEqual(key({ marketKey: 'result', outcome: 'win', pickedTeam: 'Arsenal' }), 'result:A');
assert.strictEqual(key({ marketKey: 'result', outcome: 'draw' }), 'result:D');
assert.strictEqual(key({ marketKey: 'dc', outcome: 'win_or_draw', pickedTeam: 'Man United' }), 'dc:1X');
assert.strictEqual(key({ marketKey: 'dc', outcome: 'win_or_draw', pickedTeam: 'Arsenal' }), 'dc:X2');
assert.strictEqual(key({ marketKey: 'dc', outcome: 'either' }), 'dc:12');
assert.strictEqual(key({ marketKey: 'dnb', outcome: 'win', pickedTeam: 'Man United' }), 'dnb:H');
assert.strictEqual(key({ marketKey: 'btts', outcome: 'yes' }), 'btts:yes');
assert.strictEqual(key({ marketKey: 'goals', outcome: 'over', line: 2.5 }), 'goals:over:2.5');
assert.strictEqual(key({ marketKey: 'goals', outcome: 'over', line: 3.5 }), '', 'a line the app does not offer is not forced');
assert.strictEqual(key({ marketKey: 'result', outcome: 'win', pickedTeam: 'Nobody FC' }), '');
assert.strictEqual(key({ marketKey: 'cards', outcome: 'over', line: 4.5 }), '');

// ---- the whole slip ----
const built = plain(run('buildImportedSlip(' + JSON.stringify({
  bookmaker: 'bet365', stake: 10,
  legs: [
    leg({ home: 'Manchester United', away: 'Arsenal', marketKey: 'result', outcome: 'win', pickedTeam: 'Manchester United', selectionText: 'Manchester United', oddsText: '6/4' }),
    leg({ home: 'Chelsea', away: 'Tottenham', marketKey: 'btts', outcome: 'yes', selectionText: 'Both teams to score', oddsText: '10/11' }),
    leg({ sport: 'Tennis', selectionText: 'Djokovic to win', oddsText: '1.5' }),
    leg({ selectionText: 'Some odd bet' })
  ]
}) + ')'));
assert.strictEqual(built.legs.length, 4);
assert.strictEqual(built.stake, 10);
assert.strictEqual(built.bookmaker, 'bet365');
assert.strictEqual(built.legs[0].kind, 'football');
assert.strictEqual(built.legs[0].key, 'result:H');
assert.strictEqual(built.legs[0].odds, 2.5, 'the price taken on the slip replaces the app price');
assert.strictEqual(built.legs[0].est, false);
assert.strictEqual(built.summary[0].upcoming, true, 'a league bet is possible before kick-off');
assert.strictEqual(built.legs[1].kind, 'football');
assert.strictEqual(built.summary[1].upcoming, false, 'a match that has kicked off is diary only');
assert.strictEqual(built.legs[2].kind, 'custom');
assert.strictEqual(built.legs[2].sport, 'Tennis');
assert.strictEqual(built.legs[2].odds, 1.5);
assert.strictEqual(built.legs[3].odds, null, 'no price printed: the player adds it');

console.log('import slip tests: ok');
