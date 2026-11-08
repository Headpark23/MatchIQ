'use strict';
const assert = require('assert');
const b = require('../lib/betai');

const now = Date.parse('2026-11-08T12:00:00Z');
const rec = (home, away, kick) => ({
  fixture: { home, away, competition: 'PL', kickoff_utc: kick, status: 'SCHEDULED' },
  markets: {
    result: { selections: [{ key: 'H', p: 0.5 }, { key: 'D', p: 0.25 }, { key: 'A', p: 0.25 }], evidence: { strength: 'weak' } },
    goals: { pick: { line: 2.5 }, lines: [{ line: 1.5, over: { p: 0.8 } }, { line: 2.5, over: { p: 0.6 } }, { line: 4.5, over: { p: 0.1 } }] },
    btts: { selections: [{ key: 'yes', p: 0.55 }, { key: 'no', p: 0.45 }] }
  }
});
const preds = { predictions: {
  a: rec('Arsenal', 'Chelsea', '2026-11-09T15:00:00Z'),
  b: rec('Everton', 'Fulham', '2026-11-08T15:00:00Z'),
  c: rec('Leeds', 'Wolves', '2026-12-30T15:00:00Z'),
  d: Object.assign(rec('Spurs', 'Villa', '2026-11-09T15:00:00Z'), { fixture: { home: 'Spurs', away: 'Villa', competition: 'PL', kickoff_utc: '2026-11-09T15:00:00Z', status: 'FINISHED' } })
} };

// context: only scheduled fixtures inside the horizon, named teams first
let ctx = b.buildContext(preds, 'what about arsenal?', now);
assert.strictEqual(ctx.count, 2);
assert.ok(ctx.lines[0].includes('Arsenal v Chelsea'), 'named team first');
assert.ok(ctx.lines[0].includes('BTTS 55%') && ctx.lines[0].includes('O2.5 60%') && !ctx.lines[0].includes('O4.5'));
ctx = b.buildContext(preds, 'any goals tips', now);
assert.ok(ctx.lines[0].includes('Everton v Fulham'), 'soonest first when nothing named');

// question cleaning
assert.strictEqual(b.cleanQuestion('  hi\n\nthere\u0000 '), 'hi there');
assert.strictEqual(b.cleanQuestion(42), '');
assert.strictEqual(b.cleanQuestion('x'.repeat(999)).length, b.MAX_QUESTION);

// UK day rolls over at UK midnight, not UTC
assert.strictEqual(b.ukDay(Date.parse('2026-07-01T23:30:00Z')), '2026-07-02');
assert.strictEqual(b.ukDay(Date.parse('2026-12-01T23:30:00Z')), '2026-12-01');

// normalise: picks are resolved against the data, so labels and p are the app's, not the AI's
const withIds = { predictions: { a: rec('Arsenal', 'Chelsea', '2026-11-09T15:00:00Z'), b: rec('Everton', 'Fulham', '2026-11-08T15:00:00Z') } };
withIds.predictions.a.match_id = 'A1'; withIds.predictions.b.match_id = 'B1';
withIds.predictions.a.markets.goals.lines.forEach(l => { l.over.label = 'Over ' + l.line; l.over.fair_odds = '~4/6'; });
withIds.predictions.a.markets.goals.name = 'Total goals';
withIds.predictions.a.markets.result.selections[0].label = 'Arsenal win';
withIds.predictions.b.markets.btts.selections[0].label = 'Yes';
const idx = b.buildContext(withIds, 'x', now).index;
assert.ok(b.buildContext(withIds, 'x', now).lines[0].startsWith('id='), 'lines carry the match id');
assert.strictEqual(b.resolvePick(withIds.predictions.a, 'goals', 'over', 2.5).label, 'Over 2.5');
assert.strictEqual(b.resolvePick(withIds.predictions.a, 'goals', 'over', 9.5), null, 'unknown line');
assert.strictEqual(b.resolvePick(withIds.predictions.a, 'result', 'h').label, 'Arsenal win');
const out = b.normalise({
  kind: 'acca',
  picks: [
    { matchId: 'A1', marketKey: 'goals', outcome: 'over', line: 2.5, confidence: 95, p: 0.99 },
    { matchId: 'B1', marketKey: 'btts', outcome: 'yes', confidence: 40 },
    { matchId: 'GHOST', marketKey: 'result', outcome: 'H', confidence: 90 },
    { matchId: 'A1', marketKey: 'goals', outcome: 'over', line: 2.5, confidence: 50 }
  ],
  reasoning: { scenario: 'cagey', experts: [{ role: 'Quant', brief: 'x' }, { role: '', brief: 'y' }] }
}, idx);
assert.strictEqual(out.picks.length, 2, 'invented fixture and duplicate dropped');
assert.strictEqual(out.picks[0].matchId, 'A1');
assert.strictEqual(out.picks[0].match, 'Arsenal v Chelsea');
assert.strictEqual(out.picks[0].selection, 'Over 2.5');
assert.strictEqual(out.picks[0].p, 0.6, 'p comes from the data');
assert.strictEqual(out.picks[0].confidence, 65, 'confidence capped near data p');
assert.strictEqual(out.kind, 'acca');
assert.ok(Math.abs(out.combinedP - 0.6 * 0.55) < 1e-9);
assert.strictEqual(out.reasoning.experts.length, 1);
assert.strictEqual(b.normalise({ kind: 'acca', picks: [
  { matchId: 'A1', marketKey: 'goals', outcome: 'over', line: 2.5, confidence: 50 },
  { matchId: 'A1', marketKey: 'result', outcome: 'H', confidence: 50 }] }, idx).kind, 'single');
assert.ok(b.normalise({ picks: [{ matchId: 'GHOST', marketKey: 'result', outcome: 'H', confidence: 50 }] }, idx).notice.length > 0);
assert.deepStrictEqual(b.normalise(null, idx).picks, []);
console.log('betai tests passed');
