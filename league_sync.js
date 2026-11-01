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

  function clampStats(stats) {
    const s = stats || {};
    return {
      points: Math.max(-1000, Math.min(50000, parseInt(s.points, 10) || 0)),
      winRate: Math.max(0, Math.min(100, Math.round(+s.winRate || 0))),
      roi: Math.max(-100, Math.min(10000, Math.round((+s.roi || 0) * 10) / 10)),
      settled: Math.max(0, Math.min(1000000, parseInt(s.settled, 10) || 0)),
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

  // leagues/{code}/members/{uid}: created once on join; joinedAt never changes afterwards.
  function newMemberDoc({ handle, avatar, stats, now }) {
    return Object.assign({
      handle: cleanHandle(handle) || 'Player',
      avatar: cleanIcon(avatar),
      joinedAt: now,
      updatedAt: now
    }, clampStats(stats));
  }

  // Later stat refreshes only ever update an existing member record, so a kicked or
  // departed player (or a deleted league) cannot be recreated by a background sync.
  function memberStatsUpdate({ handle, avatar, stats, now }) {
    return Object.assign({
      handle: cleanHandle(handle) || 'Player',
      avatar: cleanIcon(avatar),
      updatedAt: now
    }, clampStats(stats));
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

  return {
    FREQS,
    NAME_MAX,
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
