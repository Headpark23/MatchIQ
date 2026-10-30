with open('app.js', 'r', encoding='utf-8') as f:
    c = f.read()

old_join = """async function joinCloudLeague(code) {
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
  }"""

new_join = """async function joinCloudLeague(code) {
  if (!code) return;
  let leagueName = 'Buddy League (' + code + ')';
  let leagueIcon = '⚽';
  let leagueFreq = 'weekly';
  let creatorHandle = null;
  let existingMembers = [];

  if (firestoreDb) {
    try {
      const snap = await firestoreDb.collection('leagues').doc(code).get();
      if (snap.exists) {
        const d = snap.data();
        if (d.name) leagueName = d.name;
        if (d.icon) leagueIcon = d.icon;
        if (d.freq) leagueFreq = d.freq;
        if (d.creator_handle) creatorHandle = d.creator_handle;
        existingMembers = extractMembersFromDoc(d);
      }
    } catch (e) {
      console.warn('Join cloud fetch notice:', e);
    }
  }

  const prof = getUserProfile();
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
      members: existingMembers.filter(m => m && m.handle && m.handle !== prof.handle)
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
    if (existingMembers.length) {
      league.members = existingMembers.filter(m => m && m.handle && m.handle !== prof.handle);
    }
  }"""

if old_join in c:
    c = c.replace(old_join, new_join)
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Patched joinCloudLeague successfully.")
else:
    print("old_join not found")

