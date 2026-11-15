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

// FCM error codes meaning the token will never work again, so its document can be deleted.
const DEAD_TOKEN_CODES = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);
const isDeadToken = code => DEAD_TOKEN_CODES.has(code);

module.exports = { settledMessage, weekendPicks, weekendPicksMessage, isDeadToken, APP_URL };
