'use strict';

(function attach(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MatchIQCalculations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function build() {
  const MARKET_LABELS = Object.freeze({
    corners: 'Combined total corners',
    cards: 'Combined yellow cards',
    shots: 'Combined shots on target',
    wins: 'Home-win frequency blended with away-loss frequency, not a calibrated win chance',
    btts: 'Both teams scored at least one goal',
    goals: 'Combined total goals'
  });

  function number(value) {
    if (value === '' || value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  function total(row, homeField, awayField) {
    const home = number(row[homeField]);
    const away = number(row[awayField]);
    return home === null || away === null ? null : home + away;
  }

  function overLine(value, line) {
    return Number.isFinite(value) && Number.isFinite(Number(line)) ? value > Number(line) : false;
  }

  function bothTeamsScored(row) {
    const home = number(row.FTHG);
    const away = number(row.FTAG);
    return home === null || away === null ? null : home > 0 && away > 0;
  }

  function matchWinnerIndicator(homeMatches, awayMatches) {
    const homeResults = homeMatches.filter(row => ['H', 'D', 'A'].includes(row.FTR));
    const awayResults = awayMatches.filter(row => ['H', 'D', 'A'].includes(row.FTR));
    if (!homeResults.length || !awayResults.length) return null;
    const homeWinRate = average(homeResults.map(row => row.FTR === 'H' ? 1 : 0));
    // In an away team's away match, FTR=H means the away team lost.
    const awayLossRate = average(awayResults.map(row => row.FTR === 'H' ? 1 : 0));
    return 100 * (homeWinRate + awayLossRate) / 2;
  }

  function dataFreshnessSummary(metadata, nowValue) {
    const now = Number.isFinite(nowValue) ? nowValue : Date.now();
    const legacyStatuses = Array.isArray(metadata.season_status) ? metadata.season_status : [];
    const legacyCurrent = legacyStatuses.length ? legacyStatuses[legacyStatuses.length - 1] : null;
    const current = metadata.current_season_status || (legacyCurrent ? {
      ...legacyCurrent,
      status: 'updated',
      last_successful_refresh: legacyCurrent.last_successful_refresh || metadata.last_successful_refresh
    } : null);
    const season = metadata.current_season || (current && current.season) || 'unknown';
    const updatedAt = current && current.last_successful_refresh;
    const updatedTime = updatedAt ? Date.parse(updatedAt) : NaN;
    const historical = Array.isArray(metadata.historical_seasons_updated)
      ? metadata.historical_seasons_updated : [];
    const historyText = historical.length
      ? ` Historical seasons updated: ${historical.join(', ')}.`
      : ' No historical season was updated in this run.';

    if (!current || current.status === 'unavailable') {
      const last = Number.isFinite(updatedTime)
        ? ` Last verified current-season update: ${new Date(updatedTime).toLocaleString('en-GB')}.`
        : ' No verified current-season update is recorded.';
      return { state: 'unavailable', text: `Current season ${season} unavailable.${last}${historyText}` };
    }
    if (!Number.isFinite(updatedTime) || now - updatedTime > 4 * 86400000 || updatedTime > now) {
      const last = Number.isFinite(updatedTime)
        ? ` Last verified update: ${new Date(updatedTime).toLocaleString('en-GB')}.`
        : ' No verified update timestamp is recorded.';
      return { state: 'stale', text: `Current season ${season} stale.${last}${historyText}` };
    }
    return {
      state: 'updated',
      text: `Current season ${season} updated successfully: ${new Date(updatedTime).toLocaleString('en-GB')}.${historyText}`
    };
  }

  function poissonOver(mean, line) {
    if (!Number.isFinite(mean) || mean <= 0) return 0;
    let term = Math.exp(-mean), cdf = term;
    for (let k = 1; k <= Math.floor(line); k++) {
      term *= mean / k;
      cdf += term;
    }
    return Math.max(0, Math.min(1, 1 - cdf));
  }

  function bttsProbability(homeExpectedGoals, awayExpectedGoals) {
    if (!Number.isFinite(homeExpectedGoals) || !Number.isFinite(awayExpectedGoals)) return null;
    const pHome = 1 - Math.exp(-homeExpectedGoals);
    const pAway = 1 - Math.exp(-awayExpectedGoals);
    const yes = pHome * pAway;
    return {
      yes: Math.max(0, Math.min(1, yes)),
      no: Math.max(0, Math.min(1, 1 - yes))
    };
  }

    /**
   * Option A League Scoring Formula:
   * Winning bet: Points = (Decimal Odds - 1) * 10
   * Losing bet: -2 points (modest penalty to discourage blind longshot spamming)
   * Void bet: 0 points
   */
  function calculateLeaguePoints(odds, outcome) {
    const status = (outcome || '').toLowerCase().trim();
    if (status === 'void' || !status) return 0;
    if (status === 'lost') return -2;
    if (status === 'won') {
      let dec = null;
      if (typeof odds === 'number' && Number.isFinite(odds)) {
        dec = odds;
      } else if (typeof odds === 'string') {
        dec = parseOdds(odds) ?? parseFractionalOdds(odds);
        if (dec === null && !isNaN(+odds) && +odds > 1) dec = +odds;
      }
      if (dec === null || dec < 1.0) dec = 2.0;
      return Math.round((dec - 1) * 10);
    }
    return 0;
  }

  function calculateBetProfit(stake, decimalOdds, outcome) {
    const s = number(stake);
    const odds = number(decimalOdds);
    if (s === null || s < 0) return null;
    const status = (outcome || '').toLowerCase().trim();
    if (status === 'won') {
      if (odds === null || odds < 1.0) return null;
      return Math.round(s * (odds - 1) * 100) / 100;
    }
    if (status === 'lost') {
      return -Math.round(s * 100) / 100;
    }
    if (status === 'void') {
      return 0.0;
    }
    return null; // 'pending' or unspecified
  }

  function summarizeBetDiary(entries) {
    const list = Array.isArray(entries) ? entries : [];
    let pendingCount = 0;
    let wonCount = 0;
    let lostCount = 0;
    let voidCount = 0;
    let totalStaked = 0;
    let settledStaked = 0;
    let netProfit = 0;
    let totalReturned = 0;

    const originBreakdown = {
      matchiq: { count: 0, staked: 0, profit: 0 },
      independent: { count: 0, staked: 0, profit: 0 }
    };

    for (const entry of list) {
      const stake = number(entry.stake) || 0;
      const odds = number(entry.odds) || 1.0;
      const outcome = (entry.outcome || 'pending').toLowerCase().trim();
      const origin = (entry.origin || 'matchiq').toLowerCase().trim() === 'independent' ? 'independent' : 'matchiq';

      totalStaked += stake;
      originBreakdown[origin].count++;
      originBreakdown[origin].staked += stake;

      if (outcome === 'pending') {
        pendingCount++;
      } else {
        settledStaked += stake;
        const profit = calculateBetProfit(stake, odds, outcome);
        if (profit !== null) {
          netProfit += profit;
          totalReturned += stake + profit;
          originBreakdown[origin].profit += profit;
        }

        if (outcome === 'won') wonCount++;
        else if (outcome === 'lost') lostCount++;
        else if (outcome === 'void') voidCount++;
      }
    }

    const settledCount = wonCount + lostCount + voidCount;
    const winRatePct = settledCount > 0 ? (wonCount / settledCount) * 100 : 0;
    const roiPct = settledStaked > 0 ? (netProfit / settledStaked) * 100 : 0;

    return {
      totalEntries: list.length,
      pendingCount,
      settledCount,
      wonCount,
      lostCount,
      voidCount,
      totalStaked: Math.round(totalStaked * 100) / 100,
      settledStaked: Math.round(settledStaked * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      totalReturned: Math.round(totalReturned * 100) / 100,
      winRatePct,
      roiPct,
      originBreakdown
    };
  }

  // Standard UK betting shop price ladder. Traditional UK bookmakers lay only these familiar fractions.
  const UK_BETTING_PRICES = Object.freeze([
    // Odds-on
    [1 + 1/100, '1/100'], [1 + 1/50, '1/50'], [1 + 1/33, '1/33'], [1 + 1/25, '1/25'],
    [1 + 1/20, '1/20'], [1 + 1/16, '1/16'], [1 + 1/14, '1/14'], [1 + 1/12, '1/12'],
    [1 + 1/10, '1/10'], [1 + 1/9, '1/9'], [1 + 1/8, '1/8'], [1 + 1/7, '1/7'],
    [1 + 1/6, '1/6'], [1 + 1/5, '1/5'], [1 + 2/9, '2/9'], [1 + 1/4, '1/4'],
    [1 + 2/7, '2/7'], [1 + 3/10, '3/10'], [1 + 1/3, '1/3'], [1 + 4/11, '4/11'],
    [1 + 2/5, '2/5'], [1 + 4/9, '4/9'], [1 + 1/2, '1/2'], [1 + 8/15, '8/15'],
    [1 + 4/7, '4/7'], [1 + 8/13, '8/13'], [1 + 4/6, '4/6'], [1 + 8/11, '8/11'],
    [1 + 4/5, '4/5'], [1 + 5/6, '5/6'], [1 + 10/11, '10/11'],
    // Evens
    [2, 'Evens (1/1)'],
    // Low odds-against
    [1 + 11/10, '11/10'], [1 + 6/5, '6/5'], [1 + 5/4, '5/4'], [1 + 11/8, '11/8'],
    [1 + 6/4, '6/4'], [1 + 13/8, '13/8'], [1 + 7/4, '7/4'], [1 + 15/8, '15/8'],
    [1 + 2/1, '2/1'], [1 + 11/5, '11/5'], [1 + 9/4, '9/4'], [1 + 12/5, '12/5'],
    [1 + 5/2, '5/2'], [1 + 13/5, '13/5'], [1 + 11/4, '11/4'], [1 + 14/5, '14/5'],
    [1 + 3/1, '3/1'], [1 + 100/30, '100/30'], [1 + 7/2, '7/2'],
    [1 + 4/1, '4/1'], [1 + 9/2, '9/2'], [1 + 5/1, '5/1'], [1 + 11/2, '11/2'],
    [1 + 6/1, '6/1'], [1 + 13/2, '13/2'], [1 + 7/1, '7/1'], [1 + 15/2, '15/2'],
    [1 + 8/1, '8/1'], [1 + 17/2, '17/2'], [1 + 9/1, '9/1'], [1 + 19/2, '19/2'],
    [1 + 10/1, '10/1'], [1 + 11/1, '11/1'], [1 + 12/1, '12/1'], [1 + 14/1, '14/1'],
    [1 + 16/1, '16/1'], [1 + 18/1, '18/1'], [1 + 20/1, '20/1'], [1 + 22/1, '22/1'],
    [1 + 25/1, '25/1'], [1 + 28/1, '28/1'], [1 + 33/1, '33/1'], [1 + 40/1, '40/1'],
    [1 + 50/1, '50/1'], [1 + 66/1, '66/1'], [1 + 80/1, '80/1'], [1 + 100/1, '100/1'],
    [1 + 125/1, '125/1'], [1 + 150/1, '150/1'], [1 + 200/1, '200/1'], [1 + 250/1, '250/1'],
    [1 + 300/1, '300/1'], [1 + 400/1, '400/1'], [1 + 500/1, '500/1'], [1 + 1000/1, '1000/1']
  ]);

  function formatFractionalOdds(decimalOdds) {
    const odds = number(decimalOdds);
    if (odds === null || odds <= 1) return '—';

    // 1. Exact match check against standard canonical betting shop prices
    for (const [price, label] of UK_BETTING_PRICES) {
      if (Math.abs(odds - price) < 1e-5) return label;
    }

    // 2. High-odds accumulators (profit >= 200)
    const profit = odds - 1;
    if (profit >= 200) {
      const rounded = Math.round(profit);
      const isExact = Math.abs(profit - rounded) < 1e-4;
      return (isExact ? '' : '≈') + `${rounded}/1`;
    }

    // 3. Snap to nearest familiar UK betting shop price
    let bestLabel = 'Evens (1/1)', bestGap = Infinity;
    for (const [price, label] of UK_BETTING_PRICES) {
      const gap = Math.abs(odds - price);
      if (gap < bestGap) {
        bestGap = gap;
        bestLabel = label;
      }
    }

    const isExact = bestGap < 1e-5;
    return isExact ? bestLabel : `≈${bestLabel}`;
  }

  function formatDecimalOdds(odds) {
    const o = number(odds);
    if (o === null || o < 1) return '—';
    return o.toFixed(2);
  }

  function formatDisplayOdds(odds, format = 'fractional') {
    return format === 'decimal' ? formatDecimalOdds(odds) : formatFractionalOdds(odds);
  }

  function parseOdds(value) {
    const frac = parseFractionalOdds(value);
    if (frac !== null) return frac;
    const text = String(value ?? '').trim();
    const num = Number(text);
    if (Number.isFinite(num) && num > 1) return num;
    return null;
  }

  // Standard UK bookmaker price ladder, used only to express model-derived fair odds.
  const UK_PRICE_LADDER = Object.freeze([
    '1/20', '1/16', '1/14', '1/12', '1/10', '1/9', '1/8', '1/7', '1/6', '1/5', '2/9', '1/4', '2/7',
    '3/10', '1/3', '4/11', '2/5', '4/9', '1/2', '8/15', '4/7', '8/13', '4/6', '8/11', '4/5', '5/6',
    '10/11', 'Evens', '11/10', '6/5', '5/4', '11/8', '6/4', '13/8', '7/4', '15/8', '2/1', '9/4',
    '5/2', '11/4', '3/1', '100/30', '7/2', '4/1', '9/2', '5/1', '11/2', '6/1', '13/2', '7/1',
    '15/2', '8/1', '9/1', '10/1', '11/1', '12/1', '14/1', '16/1', '18/1', '20/1', '25/1', '33/1',
    '40/1', '50/1', '66/1', '100/1'
  ]);

  // Model fair odds are 1 / probability with no bookmaker margin. They are always an
  // approximation, so they are snapped to the nearest familiar UK price and marked "≈".
  function formatFairOdds(probability, format = 'fractional') {
    const p = number(probability);
    if (p === null || p <= 0 || p >= 1) return '—';
    if (format === 'decimal') {
      return '≈' + (1 / p).toFixed(2);
    }
    let best = UK_PRICE_LADDER[0], bestGap = Infinity;
    for (const price of UK_PRICE_LADDER) {
      const implied = 1 / parseFractionalOdds(price);
      const gap = Math.abs(implied - p);
      if (gap < bestGap) { best = price; bestGap = gap; }
    }
    return '≈' + best;
  }

  function parseFractionalOdds(value) {
    const text = String(value ?? '').trim().toLowerCase();
    if (/^(?:evens?|even money)(?:\s*\(1\/1\))?$/.test(text)) return 2;
    const match = text.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!match) return null;
    const numerator = Number(match[1]), denominator = Number(match[2]);
    if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) return null;
    return 1 + numerator / denominator;
  }

  function createAccumulator(legs, stake, profile = 'Default') {
    if (!Array.isArray(legs) || legs.length < 2 || legs.some(leg => !Number.isFinite(number(leg.odds)) || number(leg.odds) <= 1)) return null;
    const decimalOdds = legs.reduce((combined, leg) => combined * number(leg.odds), 1);
    return { type: 'accumulator', legs: legs.map(leg => ({ ...leg, odds: number(leg.odds), outcome: leg.outcome || 'pending' })), stake: number(stake), decimalOdds, potentialReturn: number(stake) * decimalOdds, profile, outcome: 'pending' };
  }

  function settleAccumulator(accumulator, legOutcomes) {
    const legs = accumulator.legs.map((leg, index) => ({ ...leg, outcome: legOutcomes[index] || leg.outcome || 'pending' }));
    // Void legs drop out of the combined price; the price is always rebuilt from the legs
    // so a partially settled accumulator never loses its odds.
    const active = legs.filter(leg => leg.outcome !== 'void');
    const decimalOdds = active.reduce((product, leg) => product * number(leg.odds), 1);
    const priced = { ...accumulator, legs, decimalOdds, potentialReturn: number(accumulator.stake) * decimalOdds };
    if (legs.some(leg => leg.outcome === 'lost')) return { ...priced, outcome: 'lost' };
    if (legs.some(leg => !['won', 'lost', 'void'].includes(leg.outcome))) return { ...priced, outcome: 'pending' };
    if (!active.length) return { ...priced, outcome: 'void' };
    return { ...priced, outcome: 'won' };
  }

  function loadBetDiary(storage, key) {
    const raw = storage.getItem(key);
    if (raw == null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Bet Diary data is invalid; existing data was not changed.');
    return parsed;
  }

  function saveBetDiary(storage, key, entries) {
    if (!Array.isArray(entries)) throw new TypeError('Bet Diary entries must be an array.');
    storage.setItem(key, JSON.stringify(entries));
    return true;
  }

  // Bet Diary backup and import. Storage is per web address (origin), so every Vercel preview URL
  // starts with an empty diary; a backup file moves entries between addresses without ever
  // overwriting or deleting what is already stored.
  function diaryBackup(entries, meta = {}) {
    return { matchiq_diary_backup: 1, exported_at: meta.exportedAt || new Date().toISOString(), origin: meta.origin || '', count: entries.length, entries };
  }

  function parseDiaryImport(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (error) { return { entries: [], rejected: 0, error: 'This file is not valid JSON.' }; }
    const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.entries) ? parsed.entries : null;
    if (!list) return { entries: [], rejected: 0, error: 'No Bet Diary entries were found in this file.' };
    const entries = [];
    let rejected = 0;
    const odds = v => (typeof v === 'number' ? v : parseFractionalOdds(v));
    for (const raw of list) {
      if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) { rejected++; continue; }
      const { odds_fractional, legs, ...rest } = raw;
      const dec = Number.isFinite(rest.odds) ? rest.odds : odds(odds_fractional);
      const stake = Number(rest.stake);
      if (!(dec > 1) || !Number.isFinite(stake) || stake < 0) { rejected++; continue; }
      const entry = { ...rest, odds: dec, stake };
      if (Array.isArray(legs)) {
        const fixed = legs.map(({ odds_fractional: lf, ...l }) => ({ ...l, odds: Number.isFinite(l.odds) ? l.odds : odds(lf) }));
        if (fixed.some(l => !(l.odds > 1))) { rejected++; continue; }
        entry.legs = fixed;
      }
      entries.push(entry);
    }
    return { entries, rejected, error: null };
  }

  function mergeDiaryEntries(existing, incoming) {
    const have = new Set(existing.map(e => e.id));
    const added = [];
    let duplicates = 0;
    for (const e of incoming) {
      if (have.has(e.id)) { duplicates++; continue; }
      have.add(e.id);
      added.push(e);
    }
    return { merged: existing.concat(added), added: added.length, duplicates };
  }

  function calculateBrierScore(probabilities, actualOutcome, marketType = 'binary') {
    if (marketType === '1x2') {
      if (!probabilities || typeof probabilities !== 'object') return null;
      const pH = number(probabilities.H) ?? 0;
      const pD = number(probabilities.D) ?? 0;
      const pA = number(probabilities.A) ?? 0;
      const actual = String(actualOutcome).toUpperCase();
      const yH = actual === 'H' ? 1 : 0;
      const yD = actual === 'D' ? 1 : 0;
      const yA = actual === 'A' ? 1 : 0;
      return (pH - yH) ** 2 + (pD - yD) ** 2 + (pA - yA) ** 2;
    }
    // Binary market (e.g. Over/Under, BTTS)
    const p = number(probabilities);
    if (p === null) return null;
    const y = number(actualOutcome) === 1 ? 1 : 0;
    return (p - y) ** 2;
  }

  // ---------------------------------------------------------------- selections, Top Six, value
  const MARKET_NAMES = Object.freeze({ result: 'Match result', goals: 'Total goals', btts: 'Both teams to score', corners: 'Total corners', cards: 'Total cards', shots: 'Shots on target' });
  const FEATURE_LINES = Object.freeze({ goals: 2.5, corners: 9.5, cards: 3.5, shots: 8.5 }); // the only lines the 409-match backtest scored
  const SHRINK_WEIGHT = 20, Z90 = 1.645, BACKTEST_N = 409, T2_BACKTEST_N = 41, VALUE_MIN_EV = 0.05;

  const marketStatus = (m) => (m.evidence.status === 'provisional' && m.evidence.strength === 'none') ? 'league' : m.evidence.status;
  const lowerBound = (p, n) => (n ? Math.max(0, p - Z90 * Math.sqrt(p * (1 - p) / n)) : 0);
  const bandFor = (bands, p) => (bands || []).find((b) => p >= b.lo && p < b.hi) || null;

  /* Every selection of a published prediction. `group` holds the outcomes that make up one
     book, so a full set of prices can remove the bookmaker's margin. */
  function allSelections(pred) {
    const out = [], mk = pred.markets;
    if (mk.result) {
      mk.result.selections.forEach((s) => out.push({ id: 'result:' + s.key, group: 'result', market: 'result', key: s.key, label: s.label, p: s.p, fair: s.fair_odds,
        status: marketStatus(mk.result), strength: mk.result.evidence.strength, tier: mk.result.tier, isPick: s.key === mk.result.pick.key }));
    }
    for (const key of ['goals', 'corners', 'cards', 'shots']) {
      const m = mk[key];
      if (!m || m.unavailable) continue;
      for (const l of m.lines) {
        for (const side of ['over', 'under']) {
          out.push({ id: key + ':' + side + ':' + l.line, group: key + ':' + l.line, market: key, key: side, line: l.line, label: MARKET_NAMES[key] + ': ' + l[side].label,
            p: l[side].p, fair: l[side].fair_odds, status: marketStatus(m), strength: m.evidence.strength, backtested: l.line === FEATURE_LINES[key],
            reference: side === 'over' ? l.league_p : (l.league_p == null ? null : 1 - l.league_p) });
        }
      }
    }
    if (mk.btts) {
      mk.btts.selections.forEach((s) => out.push({ id: 'btts:' + s.key, group: 'btts', market: 'btts', key: s.key, label: 'Both teams to score: ' + s.label, p: s.p, fair: s.fair_odds,
        status: marketStatus(mk.btts), strength: mk.btts.evidence.strength, backtested: true,
        reference: mk.btts.league_p == null ? null : (s.key === 'yes' ? mk.btts.league_p : 1 - mk.btts.league_p) }));
    }
    return out;
  }

  /* How much weight the evidence gives a selection. Returns null when the selection says
     nothing about this match (league-average fallback) and so is never promoted. */
  function evidenceFor(sel, pred, bands) {
    if (sel.strength === 'none') return null;
    if (sel.market === 'result') {
      if (!sel.isPick) return null; // backtest calibration describes the model's top pick only
      if (sel.tier === 'T1') {
        const band = bandFor(bands, sel.p);
        if (!band) return null;
        return { credible: (band.n * band.observed_rate + SHRINK_WEIGHT * sel.p) / (band.n + SHRINK_WEIGHT), n: band.n, support: 'validated', basis: 'frozen model, ' + band.n + ' backtest picks at ' + band.band };
      }
      if (sel.tier === 'T2') {
        const ref = (pred.markets.result.league_p || [])[{ H: 0, D: 1, A: 2 }[sel.key]];
        const league = ref == null ? 1 / 3 : ref;
        return { credible: (T2_BACKTEST_N * sel.p + SHRINK_WEIGHT * league) / (T2_BACKTEST_N + SHRINK_WEIGHT), n: T2_BACKTEST_N, support: 'provisional', basis: 'promoted-club model, ' + T2_BACKTEST_N + ' backtest matches' };
      }
      return null;
    }
    const ref = sel.reference;
    if (sel.backtested) {
      return { credible: ref == null ? sel.p : (BACKTEST_N * sel.p + SHRINK_WEIGHT * ref) / (BACKTEST_N + SHRINK_WEIGHT), n: BACKTEST_N, support: 'provisional', basis: 'league-anchored blend, ' + BACKTEST_N + ' backtest matches' };
    }
    // A line the backtest never scored: only the weight of the prior, pulled halfway to the league rate.
    return { credible: ref == null ? sel.p : (SHRINK_WEIGHT * sel.p + SHRINK_WEIGHT * ref) / (2 * SHRINK_WEIGHT), n: SHRINK_WEIGHT, support: 'unsupported', basis: 'line never backtested; league rate nudged by the model' };
  }

  /* Ranked selections, strongest first, on the lower 90% bound of the credible chance:
     a big number with thin evidence behind it ranks below a well-tested one. Selections on
     lines the backtest never scored (`unsupported`) rank after every backtested selection, so
     a league-rate 80% on an untested line never outranks a tested estimate. The first entry
     is the same selection the pipeline seals as Most Likely. */
  function rankSelections(pred, reliability) {
    const bands = (((reliability || {}).markets || {}).wins || {}).bands || [];
    const out = [];
    for (const sel of allSelections(pred)) {
      const ev = evidenceFor(sel, pred, bands);
      if (!ev) continue;
      out.push({ ...sel, ...ev, lower_bound: lowerBound(ev.credible, ev.n) });
    }
    const supported = (x) => (x.support === 'unsupported' ? 1 : 0);
    return out.sort((a, b) => supported(a) - supported(b) || b.lower_bound - a.lower_bound || b.credible - a.credible);
  }

  /* The six strongest: one selection per line (never Over and Under of the same line).
     Unsupported-line selections appear only when fewer than six backtested ones exist. */
  function topSix(pred, reliability) {
    const picked = [], groups = new Set();
    for (const s of rankSelections(pred, reliability)) {
      if (groups.has(s.group)) continue;
      picked.push(s); groups.add(s.group);
      if (picked.length === 6) break;
    }
    return picked;
  }

  /* Value test for one selection at a price the user saw elsewhere. MatchIQ's probability
     comes from results-based models, never from these prices, so the comparison is
     independent. Verdicts: awaiting_odds (no usable price), no_bet (not eligible to call
     value), no_value (price too short), value (Potential Value). `bands` are the backtest
     calibration bands of the frozen match-result model. */
  function valueVerdict(sel, priceText, siblings, prices, bands) {
    const text = priceText == null ? '' : String(priceText).trim();
    if (!text) return { verdict: 'awaiting_odds', why: 'No bookmaker price yet. Type a price you have seen to test it.' };
    const dec = parseFractionalOdds(text) ?? (Number.isFinite(+text) && +text > 1 ? +text : null);
    if (!Number.isFinite(dec) || dec <= 1) return { verdict: 'awaiting_odds', why: 'That price was not understood. Enter fractional (e.g. 6/4) or decimal (e.g. 2.50).' };
    const implied = 1 / dec, ev = sel.p * dec - 1;
    const sibDec = siblings.map((x) => parseFractionalOdds((prices || {})[x.id]) ?? (Number.isFinite(+(prices || {})[x.id]) && +(prices || {})[x.id] > 1 ? +(prices || {})[x.id] : null));
    const complete = siblings.length > 0 && sibDec.every((d) => Number.isFinite(d) && d > 1);
    const book = complete ? implied + sibDec.reduce((t, d) => t + 1 / d, 0) : null;
    const out = { dec, implied, ev, margin: complete ? book - 1 : null, fairImplied: complete ? implied / book : null, priceText: formatFractionalOdds(dec) };
    const pctText = (x) => Math.round(100 * x) + '%';
    if (sel.status !== 'validated') return { ...out, verdict: 'no_bet', why: 'MatchIQ’s estimate for this market has no proven edge over league averages, so no price can be called value here.' };
    if (sel.market === 'result' && sel.isPick === false) return { ...out, verdict: 'no_bet', why: 'Only the model’s top match-result pick is backtested, so no other outcome can be called value.' };
    const band = bandFor(bands, sel.p);
    if (!(band && band.established)) return { ...out, verdict: 'no_bet', why: 'Too few backtested picks at this probability to trust a value call.' };
    const compared = out.fairImplied != null ? out.fairImplied : implied;
    if (ev >= VALUE_MIN_EV) return { ...out, verdict: 'value', why: 'At ' + out.priceText + ' the price implies ' + pctText(compared) + (out.fairImplied != null ? ' once the margin is removed' : '') + ', below MatchIQ’s ' + pctText(sel.p) + '. An estimate, not a guarantee.' };
    return { ...out, verdict: 'no_value', why: 'At ' + out.priceText + ' the estimated expected value is ' + (ev >= 0 ? '+' : '') + Math.round(100 * ev) + '%, under the +' + Math.round(100 * VALUE_MIN_EV) + '% needed to call it value.' };
  }

  /* Best Value across EVERY selection that has a price, not only the Top Six. Returns the
     highest-EV Potential Value, else the highest-EV priced selection, else null. */
  function bestValue(pred, prices, bands) {
    const sels = allSelections(pred);
    const priced = sels.filter((s) => (prices || {})[s.id])
      .map((s) => ({ sel: s, v: valueVerdict(s, prices[s.id], sels.filter((x) => x.group === s.group && x.id !== s.id), prices, bands) }))
      .filter((x) => x.v.verdict !== 'awaiting_odds');
    const byEv = (a, b) => b.v.ev - a.v.ev;
    return priced.filter((x) => x.v.verdict === 'value').sort(byEv)[0] || priced.sort(byEv)[0] || null;
  }

  /* Automatic bookmaker prices (data/odds.json). A price older than maxAgeHours, or for a match that
     has started, is shown as stale and is never used as a current price for a value verdict. */
  function feedPrices(entry, nowMs, maxAgeHours = 12) {
    if (!entry || !entry.selections || !Object.keys(entry.selections).length) return { state: 'none', prices: {}, details: {} };
    const retrieved = Date.parse(entry.retrieved_at);
    const ageHours = Number.isFinite(retrieved) ? (nowMs - retrieved) / 3600000 : Infinity;
    const started = Date.parse(entry.kickoff_utc) <= nowMs;
    const details = entry.selections;
    if (started || !(ageHours <= maxAgeHours)) return { state: 'stale', ageHours, prices: {}, details };
    const prices = {};
    for (const [id, s] of Object.entries(details)) prices[id] = s.fractional;
    return { state: 'fresh', ageHours, prices, details };
  }

  return {
    feedPrices,
    MARKET_LABELS,
    number,
    average,
    total,
    overLine,
    bothTeamsScored,
    matchWinnerIndicator,
    dataFreshnessSummary,
    poissonOver,
    bttsProbability,
    calculateBetProfit,
    calculateLeaguePoints,
    summarizeBetDiary,
    formatFractionalOdds,
    formatDecimalOdds,
    formatDisplayOdds,
    formatFairOdds,
    UK_PRICE_LADDER,
    parseFractionalOdds,
    parseOdds,
    createAccumulator,
    settleAccumulator,
    loadBetDiary,
    saveBetDiary,
    diaryBackup,
    parseDiaryImport,
    mergeDiaryEntries,
    calculateBrierScore,
    MARKET_NAMES,
    FEATURE_LINES,
    VALUE_MIN_EV,
    allSelections,
    rankSelections,
    topSix,
    valueVerdict,
    bestValue
  };
});
