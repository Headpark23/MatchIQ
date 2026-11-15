'use strict';

// Owner backfill: works out which past Bet Diary bets (synced to users/{uid}/diary) should join the
// player's league history. Kept free of Firebase so it can be unit tested.
// Every football bet that can be matched to a listed fixture and settles from the final score is
// added, at its reference price (bookmaker, model, or the player's own price as a best guess),
// up to five per match day including any league bets the player already has that day.
const leagues = require('../shared/league_sync.js');
const settlement = require('../shared/settlement.js');
const scoring = require('./scoring');

const BACKFILL_SINCE = '2026-11-01';

function diaryBetText(entry) {
  return (entry.marketName && entry.marketName !== 'Match result' ? entry.marketName + ' ' : '') + (entry.selection || '');
}

function entryDay(entry) {
  return String(entry.date || entry.timestamp || '').slice(0, 10);
}

// The league bet the app would have sent for this diary entry, or { reason }.
function betFromEntry(entry, fixtures, settler) {
  const byId = id => (id ? fixtures.find(f => f.id === id) : null);
  const savedMs = Date.parse(entry.timestamp || '') || Date.parse(entryDay(entry) + 'T00:00:00Z') || 0;
  if (entry.type === 'accumulator') {
    const legs = Array.isArray(entry.legs) ? entry.legs : [];
    if (legs.length < 2 || legs.length > scoring.MAX_LEGS) return { reason: 'Accumulator needs 2 to 10 legs.' };
    const since = Math.min(savedMs, Date.parse(entryDay(entry) + 'T00:00:00Z') || savedMs) - 6 * 3600000;
    const out = [];
    for (const l of legs) {
      const text = String((l && l.selection) || '');
      const fx = byId(l && (l.fixtureId || l.matchId || l.match_id)) || settler.findUpcomingFixture(text, since);
      if (!fx) return { reason: 'An accumulator leg is not linked to a listed match.' };
      out.push({ fixtureId: fx.id, selection: text, market: l && l.market, odds: l && l.odds });
    }
    const doc = leagues.leagueBetDoc({ betId: entry.id, fixtureId: out[0].fixtureId, selection: entry.selection || out.map(l => l.selection).join(' + '), odds: entry.odds, legs: out, now: null });
    delete doc.createdAt;
    return { bet: doc, savedMs };
  }
  const text = diaryBetText(entry);
  const fx = byId(entry.match_id) || settler.findDiaryFixture(text, entry);
  if (!fx) return { reason: 'Not linked to a listed football match.' };
  const market = /^(dc|dnb|btts|result|goals):/.test(String(entry.leagueMarket || '')) ? entry.leagueMarket : undefined;
  const doc = leagues.leagueBetDoc({ betId: entry.id, fixtureId: fx.id, selection: text, odds: entry.odds, market, now: null });
  delete doc.createdAt;
  return { bet: doc, savedMs };
}

// diary: [{ uid, entry }]; existing: [{ uid, slot, betId }]. Returns
// { add: [{ uid, slot, doc, checked }], skipped, reasons: { reason: count } }.
function planBackfill({ diary, existing, fixtures, odds, predictions, since }) {
  const fx = fixtures || [];
  const settler = settlement.create(() => fx);
  const from = since || BACKFILL_SINCE;
  const haveBet = new Set((existing || []).map(e => e.uid + '|' + e.betId));
  const usedSlots = new Set((existing || []).map(e => e.uid + '|' + e.slot));
  const reasons = {};
  let skipped = 0;
  const skip = reason => { skipped++; reasons[reason] = (reasons[reason] || 0) + 1; };

  const candidates = [];
  (diary || []).forEach(({ uid, entry }) => {
    if (!uid || !entry || entry.id == null) return;
    if (entryDay(entry) < from) return;  // older than the backfill window: not counted at all
    if (haveBet.has(uid + '|' + entry.id)) return;  // already a league bet
    const made = betFromEntry(entry, fx, settler);
    if (made.reason) { skip(made.reason); return; }
    // Filed under the day of the first match to kick off.
    const kickoffs = (made.bet.legs || [made.bet]).map(l => fx.find(f => f.id === l.fixtureId))
      .filter(Boolean).map(f => String(f.kickoff_utc || '')).sort();
    const dayKey = kickoffs[0].slice(0, 10);
    const checked = scoring.validateLeagueBet({ bet: made.bet, dayKey, createdMs: made.savedMs, fixtures: fx, odds, predictions, allowAfterKickoff: true });
    if (checked.status !== 'pending') { skip(String(checked.reason || 'Could not be checked.').replace(/ \(".*$|"[^"]*"/g, '').slice(0, 90)); return; }
    candidates.push({ uid, dayKey, savedMs: made.savedMs, doc: made.bet, checked });
  });

  // Earliest-saved bets take the free slots for their day first.
  candidates.sort((a, b) => a.savedMs - b.savedMs);
  const add = [];
  candidates.forEach(c => {
    const slot = leagues.leagueBetSlots(c.dayKey).find(s => !usedSlots.has(c.uid + '|' + s));
    if (!slot) { skip('Already 5 league bets that day.'); return; }
    usedSlots.add(c.uid + '|' + slot);
    add.push({ uid: c.uid, slot, doc: c.doc, checked: c.checked });
  });
  return { add, skipped, reasons };
}

module.exports = { BACKFILL_SINCE, planBackfill, betFromEntry };
