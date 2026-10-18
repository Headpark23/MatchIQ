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

  return {
    MARKET_LABELS,
    number,
    average,
    total,
    overLine,
    bothTeamsScored,
    matchWinnerIndicator,
    dataFreshnessSummary
  };
});
