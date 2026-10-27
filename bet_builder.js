'use strict';

/* Bet Builder: given a stake, a number of legs and a profit target, pick the accumulator
   whose combined price lands on the target and whose combined chance is highest.
   Pure functions only. The browser passes in published predictions and prices; nothing here
   fetches or predicts. One leg per match, so legs are treated as independent. */
(function attach(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MatchIQBuilder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function build() {
  const BIN = 0.01;                  // price resolution of the search, in ln(decimal odds)
  const WINDOW_BELOW = 0.03;         // accept up to ~3% short of the target return...
  const WINDOW_ABOVE = 0.10;         // ...or ~10% over it, then pick the likeliest slip inside
  const MIN_LEG_ODDS = 1.05;         // bookmakers will not take shorter prices into an accumulator reliably
  const ESTIMATED_MARGIN = 1.07;     // used only when no fresh bookmaker price exists
  const MAX_LEGS = 12;
  const MARKETS = ['result', 'goals'];   // the markets the price feed covers, so every leg can be priced and placed

  const money = (x) => '£' + (Math.round(x * 100) / 100).toFixed(2);

  /* Turn published predictions into one flat pool of legs.
     preds        published prediction objects (data/predictions.json values)
     opts.calc    MatchIQCalculations
     opts.feedFor (matchId) => { state, details } as returned by calc.feedPrices (details keyed by selection id)
     opts.reliability  data/model_reliability.json
     opts.nowMs, opts.horizonMs  only matches kicking off inside this window
     Only backtested selections are used (`validated` or `provisional`); a line the backtest never
     scored is never put in a slip. Only Match Result and Total Goals are used: they are the markets with
     bookmaker prices, so every leg is something you can actually place. A real bookmaker price is used when a fresh one exists, otherwise an
     estimated price (model chance + typical margin), flagged on the leg. */
  function legPool(preds, opts) {
    const { calc, feedFor, reliability } = opts;
    const nowMs = opts.nowMs == null ? Date.now() : opts.nowMs;
    const horizonMs = opts.horizonMs == null ? 7 * 86400000 : opts.horizonMs;
    const pool = [];
    for (const pred of preds) {
      const ko = Date.parse(pred.fixture.kickoff_utc);
      if (!(ko > nowMs && ko - nowMs <= horizonMs)) continue;
      const feed = feedFor ? feedFor(pred.match_id) : { state: 'none', details: {} };
      const ranked = new Map(calc.rankSelections(pred, reliability).map((r) => [r.id, r]));
      for (const s of calc.allSelections(pred)) {
        // Skip the league-average fallbacks (no match-specific information) and lines the backtest never scored.
        if (!MARKETS.includes(s.market) || s.strength === 'none' || (s.market !== 'result' && !s.backtested)) continue;
        const r = ranked.get(s.id);
        const sel = { id: s.id, label: s.label, market: s.market, credible: r ? r.credible : s.p, support: r ? r.support : 'provisional', basis: r ? r.basis : 'backtested model' };
        const live = feed.state === 'fresh' && feed.details && feed.details[sel.id];
        const dec = live ? Number(live.decimal) : 1 / (sel.credible * ESTIMATED_MARGIN);
        if (!Number.isFinite(dec) || dec < MIN_LEG_ODDS) continue;
        pool.push({
          matchId: pred.match_id, fixture: pred.fixture, kickoff: ko,
          selId: sel.id, label: sel.label, market: sel.market,
          p: sel.credible, support: sel.support, basis: sel.basis,
          odds: dec, fractional: live ? live.fractional : calc.formatFractionalOdds(dec),
          priceSource: live ? 'live' : 'estimated', bookmaker: live ? live.bookmaker : null
        });
      }
    }
    return pool;
  }

  /* Best leg set by exact search: dynamic programming over matches, with the combined
     price held in 0.01 ln-odds buckets. Returns up to `maxSlips` slips, best first. */
  function buildSlips(pool, { stake, win, legs, maxSlips = 3 }) {
    if (!(stake > 0) || !(win > 0)) return { error: 'Enter a stake and a win amount above £0.' };
    if (!Number.isInteger(legs) || legs < 1 || legs > MAX_LEGS) return { error: 'Choose between 1 and ' + MAX_LEGS + ' bets.' };
    const targetOdds = (stake + win) / stake;
    const lnT = Math.log(targetOdds);

    const byMatch = new Map();
    for (const c of pool) {
      if (!byMatch.has(c.matchId)) byMatch.set(c.matchId, []);
      byMatch.get(c.matchId).push(c);
    }
    const matches = [...byMatch.values()];
    if (matches.length < legs) return { error: 'Only ' + matches.length + ' upcoming match' + (matches.length === 1 ? ' has' : 'es have') + ' usable bets, so a ' + legs + '-bet accumulator is not possible yet.', targetOdds };

    const cap = Math.max(lnT, Math.log(MIN_LEG_ODDS) * legs) + WINDOW_ABOVE + 0.25;
    const B = Math.ceil(cap / BIN) + 2, W = (legs + 1) * B;
    const NEG = -Infinity;
    const layers = [];
    let prev = { lp: new Float64Array(W).fill(NEG), ex: new Float64Array(W), ch: new Int16Array(W), pb: new Int32Array(W) };
    prev.lp[0] = 0;
    for (const options of matches) {
      const cur = { lp: prev.lp.slice(), ex: prev.ex.slice(), ch: new Int16Array(W), pb: new Int32Array(W) };
      for (let i = 0; i < W; i++) { cur.pb[i] = i; }   // default: leg skipped, state carried over
      const logs = options.map((o) => [Math.log(o.odds), Math.log(o.p)]);
      for (let k = 0; k < legs; k++) {
        for (let b = 0; b < B; b++) {
          const from = k * B + b, lp = prev.lp[from];
          if (lp === NEG) continue;
          for (let o = 0; o < options.length; o++) {
            const ex = prev.ex[from] + logs[o][0];
            if (ex > cap) continue;
            const nb = Math.round(ex / BIN), to = (k + 1) * B + nb;
            const score = lp + logs[o][1];
            if (score > cur.lp[to]) { cur.lp[to] = score; cur.ex[to] = ex; cur.ch[to] = o + 1; cur.pb[to] = from; }
          }
        }
      }
      layers.push(cur);
      prev = cur;
    }

    const finals = [];
    for (let b = 0; b < B; b++) {
      const i = legs * B + b;
      if (prev.lp[i] !== NEG) finals.push({ i, lp: prev.lp[i], err: prev.ex[i] - lnT });
    }
    if (!finals.length) return { error: 'No ' + legs + '-bet combination fits that target. Try fewer bets or a different win amount.', targetOdds };
    const inside = finals.filter((f) => f.err >= -WINDOW_BELOW && f.err <= WINDOW_ABOVE).sort((a, b) => b.lp - a.lp);
    const ordered = inside.length ? inside : finals.sort((a, b) => Math.abs(a.err) - Math.abs(b.err) || b.lp - a.lp);

    const slips = [], seen = new Set();
    for (const f of ordered) {
      const chosen = [];
      let idx = f.i;
      for (let m = layers.length - 1; m >= 0; m--) {
        const ch = layers[m].ch[idx], from = layers[m].pb[idx];
        if (ch > 0) chosen.push(matches[m][ch - 1]);
        idx = from;
      }
      chosen.reverse();
      if (chosen.length !== legs) continue;
      const key = chosen.map((c) => c.selId + '@' + c.matchId).join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const odds = chosen.reduce((t, c) => t * c.odds, 1), chance = chosen.reduce((t, c) => t * c.p, 1);
      slips.push({
        legs: chosen, odds, chance,
        ret: stake * odds, profit: stake * odds - stake,
        ev: chance * stake * odds - stake,
        onTarget: inside.length > 0,
        estimated: chosen.some((c) => c.priceSource !== 'live')
      });
      if (slips.length >= maxSlips) break;
    }
    return { slips, targetOdds, targetReturn: stake + win, exact: inside.length > 0 };
  }

  return { legPool, buildSlips, money, MAX_LEGS, MIN_LEG_ODDS, ESTIMATED_MARGIN };
});
