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
assert.ok(ctx.lines[0].startsWith('Arsenal v Chelsea'), 'named team first');
assert.ok(ctx.lines[0].includes('BTTS 55%') && ctx.lines[0].includes('O2.5 60%') && !ctx.lines[0].includes('O4.5'));
ctx = b.buildContext(preds, 'any goals tips', now);
assert.ok(ctx.lines[0].startsWith('Everton v Fulham'), 'soonest first when nothing named');

// question cleaning
assert.strictEqual(b.cleanQuestion('  hi\n\nthere\u0000 '), 'hi there');
assert.strictEqual(b.cleanQuestion(42), '');
assert.strictEqual(b.cleanQuestion('x'.repeat(999)).length, b.MAX_QUESTION);

// UK day rolls over at UK midnight, not UTC
assert.strictEqual(b.ukDay(Date.parse('2026-07-01T23:30:00Z')), '2026-07-02');
assert.strictEqual(b.ukDay(Date.parse('2026-12-01T23:30:00Z')), '2026-12-01');

// normalise: confidence capped near p, acca maths done here, junk dropped
const out = b.normalise({
  kind: 'acca',
  picks: [
    { match: 'A v B', market: 'Goals', selection: 'Over 2.5', p: 0.6, confidence: 95 },
    { match: 'C v D', market: 'BTTS', selection: 'Yes', p: 0.5, confidence: 40 },
    { match: '', selection: '', p: 1, confidence: 1 }
  ],
  reasoning: { scenario: 'cagey', experts: [{ role: 'Quant', brief: 'x' }, { role: '', brief: 'y' }] }
});
assert.strictEqual(out.picks.length, 2);
assert.strictEqual(out.picks[0].confidence, 65);
assert.strictEqual(out.kind, 'acca');
assert.ok(Math.abs(out.combinedP - 0.3) < 1e-9);
assert.strictEqual(out.reasoning.experts.length, 1);
assert.strictEqual(b.normalise({ kind: 'acca', picks: [{ match: 'a', selection: 'b', p: 0.5, confidence: 50 }] }).kind, 'single');
assert.deepStrictEqual(b.normalise(null).picks, []);
console.log('betai tests passed');
