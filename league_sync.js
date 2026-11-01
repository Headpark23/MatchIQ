'use strict';

// Builds every Firestore document the app writes for leagues, profiles and gamertags.
// The security-rules tests import these same builders, so the rules are always tested
// against exactly what the app sends.
(function attach(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BetBuddyLeagues = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function build() {
  const FREQS = ['weekly', 'monthly', 'yearly'];
  const HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;
  const NAME_MAX = 40;
  // Every member's update is pushed live to every other member, so leagues stay small.
  const MAX_LEAGUE_MEMBERS = 50;

  // League names are shown to every member, so markup characters are removed outright.
  function cleanLeagueName(name) {
    const clean = String(name || '').replace(/[<>"'`&\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
    return clean || 'Buddy League';
  }

  function cleanIcon(icon) {
    const clean = String(icon || '').replace(/[<>"'`&\\]/g, '').trim();
    // Keep whole code points (emoji are surrogate pairs) within the 10-unit rules limit.
    let out = '';
    for (const ch of clean) {
      if (out.length + ch.length > 10) break;
      out += ch;
    }
    return out || '⚽';
  }

  function cleanHandle(handle) {
    const h = String(handle || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 20);
    return HANDLE_RE.test(h) ? h : null;
  }

  // ---------------------------------------------------------- league periods (UK time)
  // Weeks start Monday, months on the 1st, seasons on 1 August, all by the UK calendar,
  // so every player's table resets at the same moment wherever their phone is.
  function londonDate(now) {
    const parts = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now || new Date()).forEach(p => { parts[p.type] = p.value; });
    return parts.year + '-' + parts.month + '-' + parts.day;
  }

  function periodKey(freq, dateStr) {
    const d = String(dateStr || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    const y = +d.slice(0, 4), m = +d.slice(5, 7), day = +d.slice(8, 10);
    if (freq === 'monthly') return 'M' + d.slice(0, 7);
    if (freq === 'yearly') return 'S' + (m >= 8 ? y : y - 1);
    const t = Date.UTC(y, m - 1, day);
    const sinceMonday = (new Date(t).getUTCDay() + 6) % 7;
    return 'W' + new Date(t - sinceMonday * 86400000).toISOString().slice(0, 10);
  }

  function currentPeriodKey(freq, now) {
    return periodKey(freq, londonDate(now));
  }

  // ---------------------------------------------------------- league scoring eligibility
  // Wins count at most these odds (10/1), so one lucky long shot cannot decide a league.
  const MAX_COUNTED_ODDS = 11;

  // Only bets the app settled itself from the official result, logged before kick-off, count in
  // leagues. Bets settled by hand still count in the Bet Diary.
  function isLeagueEligible(entry, kickoffIso) {
    if (!entry || entry.inLeague === false || entry.manualOverride || entry.settledBy !== 'auto') return false;
    if (!['won', 'lost', 'void'].includes(entry.outcome)) return false;
    const placed = Date.parse(entry.timestamp || '');
    const kickoff = Date.parse(kickoffIso || entry.kickoffAt || '');
    return Number.isFinite(placed) && Number.isFinite(kickoff) && placed < kickoff;
  }

  function clampStats(stats) {
    const s = stats || {};
    return {
      points: Math.max(-1000, Math.min(36600, parseInt(s.points, 10) || 0)),
      winRate: Math.max(0, Math.min(100, Math.round(+s.winRate || 0))),
      roi: Math.max(-100, Math.min(10000, Math.round((+s.roi || 0) * 10) / 10)),
      settled: Math.max(0, Math.min(366, parseInt(s.settled, 10) || 0)),
      form: (Array.isArray(s.form) && s.form.length ? s.form : ['—']).slice(0, 10).map(f => String(f).slice(0, 2))
    };
  }

  // leagues/{code}: written once, by the creator, when the league is made.
  function leagueDoc({ code, name, icon, freq, creatorUid, creatorHandle, now }) {
    const doc = {
      code,
      name: cleanLeagueName(name),
      icon: cleanIcon(icon),
      freq: FREQS.includes(freq) ? freq : 'weekly',
      creatorUid,
      createdAt: now,
      updatedAt: now
    };
    const h = cleanHandle(creatorHandle);
    if (h) doc.creatorHandle = h;
    return doc;
  }

  function leagueRename(name, now) {
    return { name: cleanLeagueName(name), updatedAt: now };
  }

  // Stats for every period, each tagged with its period key so a leaderboard can tell this
  // week's numbers from last week's: { weekly: { key, points, ... }, monthly: ..., yearly: ... }.
  function periodsDoc(periods) {
    const out = {};
    FREQS.forEach(f => {
      const p = periods && periods[f];
      if (p && typeof p.key === 'string') out[f] = Object.assign({ key: p.key.slice(0, 12) }, clampStats(p));
    });
    return out;
  }

  // leagues/{code}/members/{uid}: created once on join; joinedAt never changes afterwards.
  // Top-level stats are the league's own period; `periods` holds all three.
  function newMemberDoc({ handle, avatar, stats, periods, now }) {
    return Object.assign({
      handle: cleanHandle(handle) || 'Player',
      avatar: cleanIcon(avatar),
      joinedAt: now,
      updatedAt: now,
      periods: periodsDoc(periods)
    }, clampStats(stats));
  }

  // Later stat refreshes only ever update an existing member record, so a kicked or
  // departed player (or a deleted league) cannot be recreated by a background sync.
  function memberStatsUpdate({ handle, avatar, stats, periods, now }) {
    return Object.assign({
      handle: cleanHandle(handle) || 'Player',
      avatar: cleanIcon(avatar),
      updatedAt: now,
      periods: periodsDoc(periods)
    }, clampStats(stats));
  }

  // The stats to show for a member in the given period: this period's numbers, or zeros when
  // their latest numbers are from an earlier period (they have not bet since it reset).
  function memberStatsFor(member, freq, currentKey, leagueFreq) {
    const empty = { points: 0, winRate: 0, roi: 0, settled: 0, form: ['—'] };
    const p = member && member.periods && member.periods[freq];
    if (p) return p.key === currentKey ? clampStats(p) : empty;
    // Records saved before periods existed only hold the league's own period.
    return member && freq === (leagueFreq || 'weekly') ? clampStats(member) : empty;
  }

  // users/{uid}/leagueMemberships/{code}: the player's own index of leagues.
  function membershipDoc({ code, name, icon, role, now }) {
    return { code, name: cleanLeagueName(name), icon: cleanIcon(icon), role: role === 'creator' ? 'creator' : 'member', joinedAt: now };
  }

  // leagues/{code}/banned/{uid}: written by the creator when kicking, blocks re-joining.
  function banDoc({ handle, now }) {
    return { handle: cleanHandle(handle) || 'Player', bannedAt: now };
  }

  // users/{uid}: public profile. `now` must be a Firestore timestamp (serverTimestamp()).
  function userProfileDoc({ handle, avatar, now, isNew }) {
    const doc = { handle, avatar: cleanIcon(avatar), updatedAt: now };
    if (isNew) doc.createdAt = now;
    return doc;
  }

  // handles/{handleLower}: gamertag registry. `now` must be a Firestore timestamp.
  function handleDoc({ uid, handle, now }) {
    return { uid, handle, createdAt: now };
  }

  // ---------------------------------------------------------- Bet Diary cloud sync
  // `synced` maps entry id -> fingerprint of the copy the cloud last confirmed. It lets each side
  // tell "changed here" from "changed on another device", and "deleted" from "never uploaded".
  function diaryFingerprint(entry) {
    const str = JSON.stringify(entry);
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    return h.toString(36) + ':' + str.length;
  }

  // What to send: entries new or changed since the last confirmed sync, and ids deleted here.
  function planDiaryPush(local, synced) {
    const ids = new Set();
    const upserts = [];
    (local || []).forEach(e => {
      if (!e || e.id == null) return;
      const id = String(e.id);
      ids.add(id);
      if (synced[id] !== diaryFingerprint(e)) upserts.push(e);
    });
    const deletes = Object.keys(synced || {}).filter(id => !ids.has(id));
    return { upserts, deletes };
  }

  // Folds the cloud copy into this device's diary:
  // - entries only in the cloud are added, unless this device deleted them since the last sync;
  // - entries this device synced before but the cloud no longer has were deleted elsewhere;
  // - when both changed, the cloud wins only if this device has not edited it since the last sync,
  //   or if it settled a bet that is still pending here.
  function mergeDiaryFromCloud(local, remote, synced) {
    const remoteMap = new Map((remote || []).filter(e => e && e.id != null).map(e => [String(e.id), e]));
    const nextSynced = Object.assign({}, synced);
    const out = [];
    let changed = false;
    (local || []).forEach(e => {
      const id = e && e.id != null ? String(e.id) : null;
      if (!id) { out.push(e); return; }
      const r = remoteMap.get(id);
      if (!r) {
        if (synced[id]) { changed = true; delete nextSynced[id]; return; }  // deleted on another device
        out.push(e);
        return;
      }
      remoteMap.delete(id);
      const rf = diaryFingerprint(r);
      const lf = diaryFingerprint(e);
      if (rf === lf) { nextSynced[id] = rf; out.push(e); return; }
      const localUnchanged = synced[id] === lf;
      const remoteSettledPendingHere = e.outcome === 'pending' && r.outcome && r.outcome !== 'pending';
      if (localUnchanged || remoteSettledPendingHere) {
        nextSynced[id] = rf;
        out.push(r);
        changed = true;
      } else {
        out.push(e);
      }
    });
    remoteMap.forEach((r, id) => {
      if (synced[id]) return;  // deleted here; the next push removes it from the cloud
      out.push(r);
      nextSynced[id] = diaryFingerprint(r);
      changed = true;
    });
    return { entries: out, synced: nextSynced, changed };
  }

  return {
    diaryFingerprint,
    planDiaryPush,
    mergeDiaryFromCloud,
    FREQS,
    NAME_MAX,
    MAX_LEAGUE_MEMBERS,
    MAX_COUNTED_ODDS,
    londonDate,
    periodKey,
    currentPeriodKey,
    isLeagueEligible,
    memberStatsFor,
    cleanLeagueName,
    cleanIcon,
    cleanHandle,
    leagueDoc,
    leagueRename,
    newMemberDoc,
    memberStatsUpdate,
    membershipDoc,
    banDoc,
    userProfileDoc,
    handleDoc
  };
});
