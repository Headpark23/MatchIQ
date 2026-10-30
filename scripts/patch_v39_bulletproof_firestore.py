import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add extractMembersFromDoc & update geo listening / syncing
old_sync_geo_marker = """let activeGeoUnsubscribe = null;
let currentGeoListeningDocId = null;
function listenToActiveGeoLeague(docId) {
  if (!firestoreDb || !docId) return;
  if (currentGeoListeningDocId === docId && activeGeoUnsubscribe) return;
  if (activeGeoUnsubscribe) {
    try { activeGeoUnsubscribe(); } catch (e) {}
    activeGeoUnsubscribe = null;
  }
  currentGeoListeningDocId = docId;
  try {
    activeGeoUnsubscribe = firestoreDb.collection('geo_leagues').doc(docId).onSnapshot(doc => {
      if (!doc || !doc.exists) return;
      const data = doc.data() || {};
      const membersObj = data.members || {};
      const membersList = Object.values(membersObj);
      saveStoredGeoMembers(docId, membersList);
      render();
    }, err => console.warn('Geo listener notice:', err));
  } catch (e) {
    console.warn('Geo listener error:', e);
  }
}

function syncUserToGeoCloud() {
  if (!firestoreDb) return;
  try {
    const prof = getUserProfile();
    const uStats = getUserLeagueStats('weekly');
    const userEntry = {
      handle: prof.handle,
      avatar: prof.avatar || '⚽',
      town: prof.town || 'Paisley',
      region: prof.region || 'Renfrewshire',
      country: prof.country || 'Scotland',
      points: uStats.points,
      winRate: uStats.winRate,
      roi: uStats.roi,
      settled: uStats.settled,
      form: uStats.form,
      updated_at: new Date().toISOString()
    };
    const safeTown = getGeoDocId('geo-town', prof);
    const safeRegion = getGeoDocId('geo-region', prof);
    const safeCountry = getGeoDocId('geo-country', prof);
    const targets = ['geo-world', 'geo-europe', 'geo-uk', safeCountry, safeRegion, safeTown];
    targets.forEach(tId => {
      firestoreDb.collection('geo_leagues').doc(tId).set({
        ['members.' + prof.handle]: userEntry
      }, { merge: true }).catch(() => {});
    });
  } catch (e) {}
}"""

new_sync_geo_code = """function extractMembersFromDoc(data) {
  if (!data) return [];
  const map = {};
  if (data.members && typeof data.members === 'object') {
    Object.entries(data.members).forEach(([k, v]) => {
      if (v && typeof v === 'object') {
        const handle = v.handle || k;
        map[handle] = { ...v, handle };
      }
    });
  }
  Object.keys(data).forEach(k => {
    if (k.startsWith('members.') && data[k] && typeof data[k] === 'object') {
      const handle = data[k].handle || k.slice(8);
      map[handle] = { ...data[k], handle };
    }
  });
  return Object.values(map);
}

let activeGeoUnsubscribe = null;
let currentGeoListeningDocId = null;
function listenToActiveGeoLeague(docId) {
  if (!firestoreDb || !docId) return;
  if (currentGeoListeningDocId === docId && activeGeoUnsubscribe) return;
  if (activeGeoUnsubscribe) {
    try { activeGeoUnsubscribe(); } catch (e) {}
    activeGeoUnsubscribe = null;
  }
  currentGeoListeningDocId = docId;
  try {
    activeGeoUnsubscribe = firestoreDb.collection('geo_leagues').doc(docId).onSnapshot(doc => {
      if (!doc || !doc.exists) return;
      const data = doc.data() || {};
      const membersList = extractMembersFromDoc(data);
      saveStoredGeoMembers(docId, membersList);
      render();
    }, err => console.warn('Geo listener notice:', err));
  } catch (e) {
    console.warn('Geo listener error:', e);
  }
}

function syncUserToGeoCloud() {
  if (!firestoreDb) return;
  try {
    const prof = getUserProfile();
    const uStats = getUserLeagueStats('weekly');
    const userEntry = {
      handle: prof.handle,
      avatar: prof.avatar || '⚽',
      town: prof.town || 'Paisley',
      region: prof.region || 'Renfrewshire',
      country: prof.country || 'Scotland',
      points: uStats.points,
      winRate: uStats.winRate,
      roi: uStats.roi,
      settled: uStats.settled,
      form: uStats.form,
      updated_at: new Date().toISOString()
    };
    const safeTown = getGeoDocId('geo-town', prof);
    const safeRegion = getGeoDocId('geo-region', prof);
    const safeCountry = getGeoDocId('geo-country', prof);
    const targets = ['geo-world', 'geo-europe', 'geo-uk', safeCountry, safeRegion, safeTown];
    targets.forEach(tId => {
      firestoreDb.collection('geo_leagues').doc(tId).set({
        members: {
          [prof.handle]: userEntry
        }
      }, { merge: true }).catch(() => {});
    });
  } catch (e) {}
}"""

if old_sync_geo_marker in content:
    content = content.replace(old_sync_geo_marker, new_sync_geo_code)
    print("Replaced sync_geo code successfully.")
else:
    print("WARNING: old_sync_geo_marker not found exactly!")

# 2. Update syncLeagueToCloud and listenToActiveLeague
old_sync_league_marker = """function syncLeagueToCloud(league) {
  syncUserToGeoCloud();
  if (!firestoreDb || !league || !league.code) return;
  const prof = getUserProfile();
  const uStats = getUserLeagueStats(league.freq || 'weekly');
  const userEntry = {
    handle: prof.handle,
    avatar: prof.avatar || '⚽',
    points: uStats.points,
    winRate: uStats.winRate,
    roi: uStats.roi,
    settled: uStats.settled,
    form: uStats.form,
    updated_at: new Date().toISOString()
  };

  const isLeagueCreator = !league.is_joined && (!league.creator_handle || league.creator_handle === prof.handle);

  if (isLeagueCreator) {
    if (!league.creator_handle) league.creator_handle = prof.handle;
    firestoreDb.collection('leagues').doc(league.code).set({
      name: league.name,
      icon: league.icon || '⚽',
      freq: league.freq || 'weekly',
      code: league.code,
      creator_handle: prof.handle,
      created_at: league.created_at || new Date().toISOString().slice(0, 10),
      ['members.' + prof.handle]: userEntry
    }, { merge: true }).catch(err => console.warn('Cloud league sync notice:', err));
  } else {
    // Member only updates their own stats, never overwrites league name or other members
    firestoreDb.collection('leagues').doc(league.code).set({
      ['members.' + prof.handle]: userEntry
    }, { merge: true }).catch(err => console.warn('Cloud member sync notice:', err));
  }
}

let currentLeagueListeningCode = null;
function listenToActiveLeague(code) {
  if (!firestoreDb || !code) return;
  if (currentLeagueListeningCode === code && activeLeagueUnsubscribe) return;
  if (activeLeagueUnsubscribe) {
    try { activeLeagueUnsubscribe(); } catch (e) {}
    activeLeagueUnsubscribe = null;
  }
  currentLeagueListeningCode = code;
  try {
    activeLeagueUnsubscribe = firestoreDb.collection('leagues').doc(code).onSnapshot(doc => {
      const list = getStoredLeagues();
      const target = list.find(l => l.code === code);
      if (!doc || !doc.exists) {
        if (target) {
          const updated = list.filter(l => l.code !== code);
          saveStoredLeagues(updated);
          if (activeLeagueId === target.id) {
            activeLeagueId = 'default';
            toast('This league was deleted by the creator.');
            render();
          }
        }
        return;
      }
      const data = doc.data();
      if (target) {
        if (data.name) {
          if (!target.is_joined && target.name && !target.name.startsWith('Buddy League (') && data.name.startsWith('Buddy League (')) {
            firestoreDb.collection('leagues').doc(code).update({ name: target.name }).catch(() => {});
          } else {
            target.name = data.name;
          }
        }
        if (data.icon) target.icon = data.icon;
        if (data.creator_handle) target.creator_handle = data.creator_handle;
        const prof = getUserProfile();
        if (data.members) {
          target.members = Object.values(data.members).filter(m => m.handle !== prof.handle);
        }
        saveStoredLeagues(list);
        render();
      }
    }, err => console.warn('League listener notice:', err));
  } catch (e) {
    console.warn('Listener error:', e);
  }
}"""

new_sync_league_code = """function syncLeagueToCloud(league) {
  syncUserToGeoCloud();
  if (!firestoreDb || !league || !league.code) return;
  const prof = getUserProfile();
  const uStats = getUserLeagueStats(league.freq || 'weekly');
  const userEntry = {
    handle: prof.handle,
    avatar: prof.avatar || '⚽',
    points: uStats.points,
    winRate: uStats.winRate,
    roi: uStats.roi,
    settled: uStats.settled,
    form: uStats.form,
    updated_at: new Date().toISOString()
  };

  const isLeagueCreator = !league.is_joined && (!league.creator_handle || league.creator_handle === prof.handle);

  if (isLeagueCreator) {
    if (!league.creator_handle) league.creator_handle = prof.handle;
    firestoreDb.collection('leagues').doc(league.code).set({
      name: league.name,
      icon: league.icon || '⚽',
      freq: league.freq || 'weekly',
      code: league.code,
      creator_handle: prof.handle,
      created_at: league.created_at || new Date().toISOString().slice(0, 10),
      members: {
        [prof.handle]: userEntry
      }
    }, { merge: true }).catch(err => console.warn('Cloud league sync notice:', err));
  } else {
    firestoreDb.collection('leagues').doc(league.code).set({
      members: {
        [prof.handle]: userEntry
      }
    }, { merge: true }).catch(err => console.warn('Cloud member sync notice:', err));
  }
}

let hasSyncedUserLeagues = false;
async function syncUserLeaguesFromCloud() {
  if (!firestoreDb || hasSyncedUserLeagues) return;
  try {
    const prof = getUserProfile();
    const snap = await firestoreDb.collection('leagues').get();
    if (!snap.empty) {
      const list = getStoredLeagues();
      let changed = false;
      snap.forEach(doc => {
        const d = doc.data() || {};
        const code = d.code || doc.id;
        const membersList = extractMembersFromDoc(d);
        const isMember = membersList.some(m => m && m.handle === prof.handle);
        const isCreator = d.creator_handle === prof.handle;
        if (isMember || isCreator) {
          let existing = list.find(l => l.code === code);
          if (!existing) {
            list.push({
              id: 'league-' + code,
              name: d.name || ('Buddy League (' + code + ')'),
              icon: d.icon || '⚽',
              freq: d.freq || 'weekly',
              code: code,
              creator_handle: d.creator_handle || prof.handle,
              created_at: d.created_at || new Date().toISOString().slice(0, 10),
              members: membersList.filter(m => m && m.handle && m.handle !== prof.handle)
            });
            changed = true;
          } else {
            if (d.name && (!existing.name || existing.name.startsWith('Buddy League ('))) {
              existing.name = d.name;
              changed = true;
            }
            existing.members = membersList.filter(m => m && m.handle && m.handle !== prof.handle);
            changed = true;
          }
        }
      });
      if (changed) {
        saveStoredLeagues(list);
        hasSyncedUserLeagues = true;
        render();
      }
    }
  } catch (e) {
    console.warn('Sync user leagues notice:', e);
  }
}

let currentLeagueListeningCode = null;
function listenToActiveLeague(code) {
  if (!firestoreDb || !code) return;
  if (currentLeagueListeningCode === code && activeLeagueUnsubscribe) return;
  if (activeLeagueUnsubscribe) {
    try { activeLeagueUnsubscribe(); } catch (e) {}
    activeLeagueUnsubscribe = null;
  }
  currentLeagueListeningCode = code;
  try {
    activeLeagueUnsubscribe = firestoreDb.collection('leagues').doc(code).onSnapshot(doc => {
      const list = getStoredLeagues();
      const target = list.find(l => l.code === code);
      if (!doc || !doc.exists) {
        if (target) {
          const updated = list.filter(l => l.code !== code);
          saveStoredLeagues(updated);
          if (activeLeagueId === target.id) {
            activeLeagueId = 'default';
            toast('This league was deleted by the creator.');
            render();
          }
        }
        return;
      }
      const data = doc.data() || {};
      const membersList = extractMembersFromDoc(data);
      if (target) {
        if (data.name) {
          if (!target.is_joined && target.name && !target.name.startsWith('Buddy League (') && data.name.startsWith('Buddy League (')) {
            firestoreDb.collection('leagues').doc(code).set({ name: target.name }, { merge: true }).catch(() => {});
          } else {
            target.name = data.name;
          }
        }
        if (data.icon) target.icon = data.icon;
        if (data.creator_handle) target.creator_handle = data.creator_handle;
        const prof = getUserProfile();
        target.members = membersList.filter(m => m && m.handle && m.handle !== prof.handle);
        saveStoredLeagues(list);
        render();
      }
    }, err => console.warn('League listener notice:', err));
  } catch (e) {
    console.warn('Listener error:', e);
  }
}"""

if old_sync_league_marker in content:
    content = content.replace(old_sync_league_marker, new_sync_league_code)
    print("Replaced sync_league code successfully.")
else:
    print("WARNING: old_sync_league_marker not found exactly!")

# 3. In viewLeagues(), call syncUserLeaguesFromCloud() and remove recursive refresh calls
old_view_leagues_call = """  if (isGeo) {
    const geoDocId = getGeoDocId(currentLeague.id, prof);
    listenToActiveGeoLeague(geoDocId);
    refreshGeoLeagueFromCloud(geoDocId);
    const realGeoMembers = getStoredGeoMembers(geoDocId).filter(m => m.handle !== prof.handle);
    const bots = (currentLeague.competitors || []).filter(b => !realGeoMembers.some(r => r.handle === b.handle));
    allMembers = [...realGeoMembers, userEntry, ...bots];
  } else {
    refreshLeagueFromCloud(currentLeague.code);
    const memberMap = new Map();
    (currentLeague.members || []).forEach(m => {
      if (m && m.handle && m.handle !== prof.handle) {
        memberMap.set(m.handle, m);
      }
    });
    memberMap.set(prof.handle, userEntry);
    allMembers = Array.from(memberMap.values());
  }"""

new_view_leagues_call = """  syncUserLeaguesFromCloud();
  if (isGeo) {
    const geoDocId = getGeoDocId(currentLeague.id, prof);
    listenToActiveGeoLeague(geoDocId);
    const realGeoMembers = getStoredGeoMembers(geoDocId).filter(m => m.handle !== prof.handle);
    const bots = (currentLeague.competitors || []).filter(b => !realGeoMembers.some(r => r.handle === b.handle));
    allMembers = [...realGeoMembers, userEntry, ...bots];
  } else {
    const memberMap = new Map();
    (currentLeague.members || []).forEach(m => {
      if (m && m.handle && m.handle !== prof.handle) {
        memberMap.set(m.handle, m);
      }
    });
    memberMap.set(prof.handle, userEntry);
    allMembers = Array.from(memberMap.values());
  }"""

if old_view_leagues_call in content:
    content = content.replace(old_view_leagues_call, new_view_leagues_call)
    print("Replaced viewLeagues calls successfully.")
else:
    print("WARNING: old_view_leagues_call not found exactly!")

# 4. Show member count on buddy tabs
old_buddy_tabs = """  const buddyTabsHtml = customLeagues.map(l => {
    return '<button type="button" class="league-tab-btn' + (l.id === activeLeagueId ? ' active' : '') + '" data-select-league="' + esc(l.id) + '">' +
      (l.icon || '👥') + ' ' + esc(l.name) +
    '</button>';
  }).join('');"""

new_buddy_tabs = """  const buddyTabsHtml = customLeagues.map(l => {
    const memCount = (l.members ? l.members.length : 0) + 1;
    return '<button type="button" class="league-tab-btn' + (l.id === activeLeagueId ? ' active' : '') + '" data-select-league="' + esc(l.id) + '">' +
      (l.icon || '👥') + ' ' + esc(l.name) + ' <span class="tab-member-count" style="opacity:0.75;font-size:11px">(' + memCount + ' ' + (memCount === 1 ? 'punter' : 'punters') + ')</span>' +
    '</button>';
  }).join('');"""

if old_buddy_tabs in content:
    content = content.replace(old_buddy_tabs, new_buddy_tabs)
    print("Replaced buddy tabs successfully.")
else:
    print("WARNING: old_buddy_tabs not found exactly!")

# Bump APP_VERSION
content = re.sub(r"APP_VERSION = '2026\.10\.30\.\d+';", "APP_VERSION = '2026.10.30.39';", content)
content = re.sub(r"v\d+ \(Live\)", "v39 (Live)", content)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Finished patching app.js to v39.")

