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
        const profit = calculateBetProfit(stake, odds, outcome) || 0;
        netProfit += profit;
        originBreakdown[origin].profit += profit;

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
      winRatePct,
      roiPct,
      originBreakdown
    };
  }

  function formatFractionalOdds(decimalOdds) {
    const odds = number(decimalOdds);
    if (odds === null || odds < 1) return '—';
    const value = odds - 1;
    if (value === 0) return 'Evens';
    // Continued-fraction approximation; keeps display concise without altering stored decimal odds.
    let x = value, h0 = 0, h1 = 1, k0 = 1, k1 = 0;
    for (let i = 0; i < 32; i++) {
      const a = Math.floor(x), h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > 10000) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (Math.abs(h1 / k1 - value) < 1e-10) break;
      const fraction = x - a;
      if (fraction === 0) break;
      x = 1 / fraction;
    }
    function gcd(a, b) { return b ? gcd(b, a % b) : a; }
    const divisor = gcd(Math.abs(h1), k1);
    return `${h1 / divisor}/${k1 / divisor}`;
  }

  function createAccumulator(legs, stake, profile = 'Default') {
    if (!Array.isArray(legs) || legs.length < 2 || legs.some(leg => !Number.isFinite(number(leg.odds)) || number(leg.odds) <= 1)) return null;
    const decimalOdds = legs.reduce((combined, leg) => combined * number(leg.odds), 1);
    return { type: 'accumulator', legs: legs.map(leg => ({ ...leg, odds: number(leg.odds), outcome: leg.outcome || 'pending' })), stake: number(stake), decimalOdds, potentialReturn: number(stake) * decimalOdds, profile, outcome: 'pending' };
  }

  function settleAccumulator(accumulator, legOutcomes) {
    const legs = accumulator.legs.map((leg, index) => ({ ...leg, outcome: legOutcomes[index] || leg.outcome || 'pending' }));
    if (legs.some(leg => leg.outcome === 'lost')) return { ...accumulator, legs, outcome: 'lost' };
    const active = legs.filter(leg => leg.outcome !== 'void');
    if (legs.some(leg => !['won', 'lost', 'void'].includes(leg.outcome))) return { ...accumulator, legs, outcome: 'pending' };
    const decimalOdds = active.reduce((product, leg) => product * leg.odds, 1);
    return { ...accumulator, legs, decimalOdds, potentialReturn: accumulator.stake * decimalOdds, outcome: 'won' };
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

  return {
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
    summarizeBetDiary,
    formatFractionalOdds,
    createAccumulator,
    settleAccumulator,
    loadBetDiary,
    saveBetDiary,
    calculateBrierScore
  };
});
