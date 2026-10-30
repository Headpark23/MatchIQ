with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Fix listener churn with guards
old_geo_listener = """let activeGeoUnsubscribe = null;
function listenToActiveGeoLeague(docId) {
  if (!firestoreDb || !docId) return;
  if (activeGeoUnsubscribe) {
    try { activeGeoUnsubscribe(); } catch (e) {}
    activeGeoUnsubscribe = null;
  }"""

new_geo_listener = """let activeGeoUnsubscribe = null;
let currentGeoListeningDocId = null;
function listenToActiveGeoLeague(docId) {
  if (!firestoreDb || !docId) return;
  if (currentGeoListeningDocId === docId && activeGeoUnsubscribe) return;
  if (activeGeoUnsubscribe) {
    try { activeGeoUnsubscribe(); } catch (e) {}
    activeGeoUnsubscribe = null;
  }
  currentGeoListeningDocId = docId;"""

if old_geo_listener in js:
    js = js.replace(old_geo_listener, new_geo_listener, 1)
    print('Added currentGeoListeningDocId guard')

# 2. Fix syncUserToGeoCloud to use dot-notation for members
old_geo_sync = """    targets.forEach(tId => {
      firestoreDb.collection('geo_leagues').doc(tId).set({
        members: { [prof.handle]: userEntry }
      }, { merge: true }).catch(() => {});
    });"""

new_geo_sync = """    targets.forEach(tId => {
      firestoreDb.collection('geo_leagues').doc(tId).set({
        ['members.' + prof.handle]: userEntry
      }, { merge: true }).catch(() => {});
    });"""

if old_geo_sync in js:
    js = js.replace(old_geo_sync, new_geo_sync, 1)
    print('Updated syncUserToGeoCloud with dot notation')

# 3. Fix syncLeagueToCloud
old_sync_league = """function syncLeagueToCloud(league) {
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
  const creatorHandle = league.creator_handle || (isLeagueCreator ? prof.handle : null);
  if (isLeagueCreator && !league.creator_handle) {
    league.creator_handle = prof.handle;
  }
  const cloudData = {
    name: league.name,
    icon: league.icon || '⚽',
    freq: league.freq || 'weekly',
    code: league.code,
    created_at: league.created_at || new Date().toISOString().slice(0, 10),
    members: {
      [prof.handle]: userEntry
    }
  };
  if (creatorHandle) cloudData.creator_handle = creatorHandle;
  firestoreDb.collection('leagues').doc(league.code).set(cloudData, { merge: true }).catch(err => console.warn('Cloud league sync notice:', err));
}"""

new_sync_league = """function syncLeagueToCloud(league) {
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
}"""

if old_sync_league in js:
    js = js.replace(old_sync_league, new_sync_league, 1)
    print('Updated syncLeagueToCloud with member protection')
else:
    print('old_sync_league not matched')

# 4. Fix listenToActiveLeague listener guard
old_league_listener = """function listenToActiveLeague(code) {
  if (!firestoreDb || !code) return;
  if (activeLeagueUnsubscribe) {
    try { activeLeagueUnsubscribe(); } catch (e) {}
    activeLeagueUnsubscribe = null;
  }"""

new_league_listener = """let currentLeagueListeningCode = null;
function listenToActiveLeague(code) {
  if (!firestoreDb || !code) return;
  if (currentLeagueListeningCode === code && activeLeagueUnsubscribe) return;
  if (activeLeagueUnsubscribe) {
    try { activeLeagueUnsubscribe(); } catch (e) {}
    activeLeagueUnsubscribe = null;
  }
  currentLeagueListeningCode = code;"""

if old_league_listener in js:
    js = js.replace(old_league_listener, new_league_listener, 1)
    print('Added currentLeagueListeningCode guard')

# 5. Fix joinCloudLeague
old_join_cloud = """async function joinCloudLeague(code) {
  if (!code) return;
  const list = getStoredLeagues();
  let league = list.find(l => l.code === code);
  if (!league) {
    league = {
      id: 'league-' + Date.now(),
      name: 'Buddy League (' + code + ')',
      icon: '⚽',
      freq: 'weekly',
      code: code,
      created_at: new Date().toISOString().slice(0, 10),
      members: []
    };
    list.push(league);
    saveStoredLeagues(list);
  }
  activeLeagueId = league.id;

  if (firestoreDb) {
    try {
      const snap = await firestoreDb.collection('leagues').doc(code).get();
      if (snap.exists) {
        const data = snap.data();
        if (data.name) league.name = data.name;
        if (data.icon) league.icon = data.icon;
        if (data.freq) league.freq = data.freq;
        const prof = getUserProfile();
        if (data.members) {
          league.members = Object.values(data.members).filter(m => m.handle !== prof.handle);
        }
        saveStoredLeagues(list);
        syncLeagueToCloud(league);
        listenToActiveLeague(code);
      }
    } catch (e) {
      console.warn('Join cloud fetch notice:', e);
    }
  }
  render();
}"""

new_join_cloud = """async function joinCloudLeague(code) {
  if (!code) return;
  let leagueName = 'Buddy League (' + code + ')';
  let leagueIcon = '⚽';
  let leagueFreq = 'weekly';
  let creatorHandle = null;

  if (firestoreDb) {
    try {
      const snap = await firestoreDb.collection('leagues').doc(code).get();
      if (snap.exists) {
        const d = snap.data();
        if (d.name) leagueName = d.name;
        if (d.icon) leagueIcon = d.icon;
        if (d.freq) leagueFreq = d.freq;
        if (d.creator_handle) creatorHandle = d.creator_handle;
      }
    } catch (e) {
      console.warn('Join cloud fetch notice:', e);
    }
  }

  const list = getStoredLeagues();
  let league = list.find(l => l.code === code);
  if (!league) {
    league = {
      id: 'league-' + Date.now(),
      name: leagueName,
      icon: leagueIcon,
      freq: leagueFreq,
      code: code,
      is_joined: true,
      creator_handle: creatorHandle,
      created_at: new Date().toISOString().slice(0, 10),
      members: []
    };
    list.push(league);
  } else {
    // Only update name if not creator or if local name is default
    if (league.is_joined || !league.name || league.name.startsWith('Buddy League (')) {
      league.name = leagueName;
    }
    league.icon = leagueIcon;
    league.freq = leagueFreq;
    if (creatorHandle) league.creator_handle = creatorHandle;
  }
  saveStoredLeagues(list);
  activeLeagueId = league.id;

  syncLeagueToCloud(league);
  listenToActiveLeague(code);
  render();
}"""

if old_join_cloud in js:
    js = js.replace(old_join_cloud, new_join_cloud, 1)
    print('Updated joinCloudLeague to preserve real league name')
else:
    print('old_join_cloud not matched')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)
