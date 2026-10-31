// tests/test_league_diary_option.js
// Tests for dual option: 'Add to Bet Diary and to League' vs 'Add to Bet Diary only'
// and single league bet per day constraint.

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const calc = require('../market_calculations.js');

console.log('--- Running League vs Diary-Only Bet Option Tests ---');

// Mock localStorage and DOM environment for app logic
let storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { storage = {}; }
};

// 1. Simulate day key and league bet query logic
function getLeagueBetForDay(diary, dayKey) {
  if (!dayKey) return null;
  return diary.find(e => {
    const d = (e.date || (e.timestamp ? e.timestamp.slice(0, 10) : '') || '').slice(0, 10);
    return d === dayKey && e.inLeague;
  }) || null;
}

// 2. Simulate saving logic with option
function addBetToDiary(diary, betData, destinationOption) {
  const targetDate = betData.date || new Date().toISOString().slice(0, 10);
  const existingLeagueBet = getLeagueBetForDay(diary, targetDate);

  // If user already picked a bet for the league, option is removed: defaults to diary only
  const inLeague = destinationOption === 'league' && !existingLeagueBet;

  const entry = {
    id: 'bet-' + Math.random().toString(36).slice(2, 7),
    selection: betData.selection,
    date: targetDate,
    odds: betData.odds || 2.0,
    stake: betData.stake || 10,
    outcome: betData.outcome || 'pending',
    inLeague: inLeague,
    timestamp: new Date().toISOString()
  };

  diary.unshift(entry);
  return { entry, allowedInLeague: inLeague, hadExisting: !!existingLeagueBet };
}

// 3. Simulate getUserLeagueStats logic
function calculateLeagueStats(diary, freq = 'weekly') {
  const settled = diary.filter(e => e.outcome && e.outcome !== 'pending');
  const dailyQualifyingMap = new Map();

  // ONLY bets where inLeague !== false qualify
  const candidateLeagueBets = settled.filter(e => e.inLeague !== false);
  candidateLeagueBets.slice().reverse().forEach(e => {
    const dayKey = (e.date || (e.timestamp ? e.timestamp.slice(0, 10) : '') || 'undated').slice(0, 10);
    if (!dailyQualifyingMap.has(dayKey)) {
      dailyQualifyingMap.set(dayKey, e);
    }
  });
  const leagueBets = Array.from(dailyQualifyingMap.values()).reverse();

  const won = leagueBets.filter(e => e.outcome === 'won');
  const totalStaked = leagueBets.reduce((sum, e) => sum + (+e.stake || 0), 0);
  const totalProfit = leagueBets.reduce((sum, e) => sum + (calc.calculateBetProfit(e.stake, e.odds, e.outcome) || 0), 0);
  const points = leagueBets.reduce((sum, e) => sum + (calc.calculateLeaguePoints(e.odds, e.outcome) || 0), 0);
  const winRate = leagueBets.length ? Math.round((won.length / leagueBets.length) * 100) : 0;
  const roi = totalStaked > 0 ? +( (totalProfit / totalStaked) * 100 ).toFixed(1) : 0.0;

  return { points, settled: leagueBets.length, won: won.length, winRate, roi, leagueBets };
}

// TEST CASES

console.log('Test 1: User puts first bet of day with "Add to bet diary and to league"');
const diary = [];
const today = '2026-11-01';

const bet1 = { selection: 'Arsenal Win', date: today, odds: 2.0, stake: 10, outcome: 'won' };
const res1 = addBetToDiary(diary, bet1, 'league');

assert.strictEqual(res1.allowedInLeague, true, 'First bet of day must be allowed in league');
assert.strictEqual(diary[0].inLeague, true, 'Bet entry must have inLeague = true');
assert.strictEqual(getLeagueBetForDay(diary, today).selection, 'Arsenal Win');
console.log('✓ First bet successfully designated as league qualifying bet');

console.log('Test 2: User puts second bet on same day: league option removed / constrained to diary only');
const bet2 = { selection: 'Chelsea Win', date: today, odds: 3.0, stake: 10, outcome: 'won' };
// User attempts to select 'league', but existingLeagueBet already exists for that day
const res2 = addBetToDiary(diary, bet2, 'league');

assert.strictEqual(res2.hadExisting, true, 'Must detect existing league bet for today');
assert.strictEqual(res2.allowedInLeague, false, 'Second bet must NOT be allowed into league for same day');
assert.strictEqual(diary[0].inLeague, false, 'Second bet must be marked inLeague = false (diary only)');
console.log('✓ Second bet on same day automatically constrained to diary only');

console.log('Test 3: User explicitly selects "Add to bet diary only" on third bet');
const bet3 = { selection: 'Over 2.5 Goals', date: today, odds: 2.5, stake: 10, outcome: 'lost' };
const res3 = addBetToDiary(diary, bet3, 'diary');

assert.strictEqual(res3.allowedInLeague, false);
assert.strictEqual(diary[0].inLeague, false);
console.log('✓ Third bet successfully added as diary only');

console.log('Test 4: League scoring counts ONLY the 1 designated league bet, not the diary-only bets');
const stats = calculateLeagueStats(diary);

assert.strictEqual(stats.settled, 1, 'Only 1 qualifying bet must count in league stats');
assert.strictEqual(stats.won, 1, 'Only the designated league bet (Arsenal won) counts');
// Arsenal odds 2.0 won: (2.0 - 1) * 10 = 10 pts
assert.strictEqual(stats.points, 10, 'Points should only reflect the 1 league bet (+10)');
assert.strictEqual(stats.leagueBets[0].selection, 'Arsenal Win');
console.log('✓ League stats strictly isolate the 1 designated bet (extra diary bets do not contaminate standings)');

console.log('Test 5: New calendar day permits a new league bet');
const tomorrow = '2026-11-02';
const betTomorrow = { selection: 'Liverpool Win', date: tomorrow, odds: 1.8, stake: 10, outcome: 'won' };
const resTomorrow = addBetToDiary(diary, betTomorrow, 'league');

assert.strictEqual(resTomorrow.allowedInLeague, true, 'New calendar day allows league bet');
assert.strictEqual(diary[0].inLeague, true);

const statsMultiDay = calculateLeagueStats(diary);
assert.strictEqual(statsMultiDay.settled, 2, '2 days = 2 settled league bets');
console.log('✓ Subsequent calendar days properly allow new league bet');

console.log('\nALL LEAGUE VS DIARY-ONLY TESTS PASSED! ✓');
