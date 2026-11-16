'use strict';

// Push notification text for Bet Buddy. Pure functions, so the wording is tested without Firebase.
// Every message is { title, body, url, tag }: url is the app route the tap opens, tag lets a newer
// message of the same kind replace an older one on the lock screen.

// Routes are relative: the service worker opens them on the site the app was installed from.
const APP_URL = '';

const short = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
const pts = n => (n > 0 ? '+' : '') + n + ' pt' + (Math.abs(n) === 1 ? '' : 's');

// One message for every league bet of a player that settled in this run.
// bets: [{ outcome: 'won'|'lost'|'void', points, selection }]
function settledMessage(bets) {
  const list = (bets || []).filter(b => b && ['won', 'lost', 'void'].includes(b.outcome));
  if (!list.length) return null;
  const total = list.reduce((t, b) => t + (Number(b.points) || 0), 0);
  if (list.length === 1) {
    const b = list[0], sel = short(b.selection, 80) || 'your league bet';
    const title = b.outcome === 'won' ? '✅ Winner: ' + sel : b.outcome === 'lost' ? 'Settled: ' + sel + ' lost' : 'Void: ' + sel;
    const body = b.outcome === 'void' ? 'The match did not go ahead, so no points either way.'
      : pts(total) + ' in your leagues. See where it leaves you in the table.';
    return { title: short(title, 90), body, url: APP_URL + '#/leagues', tag: 'settled' };
  }
  const won = list.filter(b => b.outcome === 'won').length, lost = list.filter(b => b.outcome === 'lost').length;
  return {
    title: list.length + ' league bets settled: ' + won + ' won, ' + lost + ' lost',
    body: pts(total) + ' in your leagues. See where it leaves you in the table.',
    url: APP_URL + '#/leagues', tag: 'settled'
  };
}

// The weekend's likeliest picks from the published predictions, for the Friday message.
// Only real leans (not league-average fallbacks) on Saturday or Sunday, most likely first.
function weekendPicks(predictions, nowMs, limit = 3) {
  const preds = Object.values((predictions && predictions.predictions) || {});
  const end = nowMs + 3 * 86400000;
  return preds.map(p => {
    const r = p.markets && p.markets.result, f = p.fixture || {};
    const ms = Date.parse(f.kickoff_utc || '');
    if (!r || !r.pick || !(ms > nowMs && ms < end)) return null;
    if (r.evidence && r.evidence.strength === 'none') return null;
    const day = new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' });
    if (day !== 'Sat' && day !== 'Sun') return null;
    return { label: r.pick.label, p: Number(r.pick.p) || 0, match: (f.home || '') + ' v ' + (f.away || '') };
  }).filter(x => x && x.p >= 0.5 && x.p <= 0.85).sort((a, b) => b.p - a.p).slice(0, limit);
}

function weekendPicksMessage(predictions, nowMs) {
  const top = weekendPicks(predictions, nowMs);
  if (!top.length) return null;
  const names = top.map(x => x.label.replace(/ win$/, '')).join(', ');
  return {
    title: 'This weekend’s picks are out',
    body: short('Top of our list: ' + names + '. Estimates, not tips. 18+', 160),
    url: APP_URL + '#/picks', tag: 'picks'
  };
}

// How our sealed picks did over the last `days` days: one result per match, counted once its
// match has finished. Same rule as the "Since you were last here" card in the app.
// history: the published prediction_history.json ({ records: [...] }).
function weeklyPickResults(history, nowMs, days = 7) {
  const since = nowMs - days * 86400000;
  const seen = new Set();
  let right = 0, total = 0;
  for (const r of (history && history.records) || []) {
    if (!r || !r.evaluated || !r.settlement || !r.settlement.result || seen.has(r.match_id)) continue;
    const ms = Date.parse((r.result && r.result.kickoff_utc) || (r.fixture && r.fixture.kickoff_utc) || '');
    if (!(ms > since && ms <= nowMs)) continue;
    seen.add(r.match_id);
    total++;
    if (r.settlement.result.pick_won) right++;
  }
  return { right, total };
}

// Monday morning recap. bets: the player's league bets that settled this week
// ([{ outcome, points }]); picks: { right, total } from weeklyPickResults.
// A player with league bets hears how they did; everyone else hears how our picks did. Nothing
// to report (no settled bets and no finished picks) means no message.
function weeklyRecapMessage(bets, picks) {
  const list = (bets || []).filter(b => b && ['won', 'lost'].includes(b.outcome));
  const hasPicks = picks && picks.total > 0;
  const pickLine = hasPicks ? 'Our picks went ' + picks.right + ' from ' + picks.total + '.' : '';
  if (list.length) {
    const won = list.filter(b => b.outcome === 'won').length, lost = list.length - won;
    const total = list.reduce((t, b) => t + (Number(b.points) || 0), 0);
    return {
      title: 'Your week: ' + won + ' won, ' + lost + ' lost (' + pts(total) + ')',
      body: short((pickLine ? pickLine + ' ' : '') + 'See your leagues. Estimates, not tips. 18+', 160),
      url: APP_URL + '#/leagues', tag: 'recap'
    };
  }
  if (!hasPicks) return null;
  return {
    title: 'Last week: our picks went ' + picks.right + ' from ' + picks.total,
    body: 'See how every league did. Estimates, not tips. 18+',
    url: APP_URL + '#/results', tag: 'recap'
  };
}

// FCM error codes meaning the token will never work again, so its document can be deleted.
const DEAD_TOKEN_CODES = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);
const isDeadToken = code => DEAD_TOKEN_CODES.has(code);

module.exports = { settledMessage, weekendPicks, weekendPicksMessage, weeklyPickResults, weeklyRecapMessage, isDeadToken, APP_URL };
