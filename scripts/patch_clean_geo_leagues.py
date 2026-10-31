import re

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Update getStoredGeoMembers to return empty array and filter dummy handles
old_stored_geo = '''function getStoredGeoMembers(docId) {
  try {
    const raw = localStorage.getItem(GEO_MEMBERS_CACHE_PREFIX + docId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [
    { handle: 'HeadPark73', avatar: '⚽', points: 0, winRate: 0, roi: 0, settled: 0, form: ['—'] },
    { handle: 'Punter_747', avatar: '⚽', points: 0, winRate: 0, roi: 0, settled: 0, form: ['—'] }
  ];
}'''

new_stored_geo = '''function getStoredGeoMembers(docId) {
  try {
    const raw = localStorage.getItem(GEO_MEMBERS_CACHE_PREFIX + docId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(m => m && m.handle && m.handle !== 'HeadPark73' && m.handle !== 'Punter_747' && m.handle !== 'Punter_737');
      }
    }
  } catch (e) {}
  return [];
}'''

assert old_stored_geo in js, "old_stored_geo not found in app.js"
js = js.replace(old_stored_geo, new_stored_geo, 1)

# 2. Update getStoredLeagues to return empty clean array, no dummy pre-seeding
old_stored_leagues = '''function getStoredLeagues() {
  try {
    const list = JSON.parse(localStorage.getItem(LEAGUES_STORAGE_KEY) || '[]');
    if (Array.isArray(list)) {
      let cleanList = list.filter(l => l.id !== 'league-weekend-contenders' && l.code !== 'BUDDY-7482');
      if (cleanList.length === 0) {
        // Pre-seed Paisley punters (BUDDY-9240) so friend & creator are visible immediately
        cleanList = [{
          id: 'league-BUDDY-9240',
          name: 'Paisley punters',
          icon: '⚽',
          freq: 'monthly',
          code: 'BUDDY-9240',
          creator_handle: 'HeadPark73',
          created_at: '2026-10-30',
          members: [
            { handle: 'HeadPark73', avatar: '⚽', points: 0, winRate: 0, roi: 0, settled: 0, form: ['—'] },
            { handle: 'Punter_747', avatar: '⚽', points: 0, winRate: 0, roi: 0, settled: 0, form: ['—'] }
          ]
        }];
        saveStoredLeagues(cleanList);
      }
      return cleanList;
    }
  } catch (e) { /* ignore */ }
  return [{
    id: 'league-BUDDY-9240',
    name: 'Paisley punters',
    icon: '⚽',
    freq: 'monthly',
    code: 'BUDDY-9240',
    creator_handle: 'HeadPark73',
    created_at: '2026-10-30',
    members: [
      { handle: 'HeadPark73', avatar: '⚽', points: 0, winRate: 0, roi: 0, settled: 0, form: ['—'] },
      { handle: 'Punter_747', avatar: '⚽', points: 0, winRate: 0, roi: 0, settled: 0, form: ['—'] }
    ]
  }];
}'''

new_stored_leagues = '''function getStoredLeagues() {
  try {
    const list = JSON.parse(localStorage.getItem(LEAGUES_STORAGE_KEY) || '[]');
    if (Array.isArray(list)) {
      return list.filter(l => l && l.id && l.id !== 'league-weekend-contenders' && l.code !== 'BUDDY-7482' && l.code !== 'BUDDY-9240');
    }
  } catch (e) { /* ignore */ }
  return [];
}'''

assert old_stored_leagues in js, "old_stored_leagues not found in app.js"
js = js.replace(old_stored_leagues, new_stored_leagues, 1)

# 3. Update viewLeagues member assembly
old_assembly = '''  if (isGeo) {
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
  }'''

new_assembly = '''  if (isGeo) {
    const geoDocId = getGeoDocId(currentLeague.id, prof);
    listenToActiveGeoLeague(geoDocId);
    const realGeoMembers = getStoredGeoMembers(geoDocId).filter(m => m.handle !== prof.handle && m.handle !== 'HeadPark73' && m.handle !== 'Punter_747' && m.handle !== 'Punter_737');
    allMembers = [...realGeoMembers, userEntry];
  } else {
    const memberMap = new Map();
    (currentLeague.members || []).forEach(m => {
      if (m && m.handle && m.handle !== prof.handle && m.handle !== 'HeadPark73' && m.handle !== 'Punter_747' && m.handle !== 'Punter_737') {
        memberMap.set(m.handle, m);
      }
    });
    memberMap.set(prof.handle, userEntry);
    allMembers = Array.from(memberMap.values());
  }'''

assert old_assembly in js, "old_assembly not found in app.js"
js = js.replace(old_assembly, new_assembly, 1)

# 4. Clean getActualPunterCount
old_punter_count = '''function getActualPunterCount() {
  const punters = new Set();
  const auth = getAuthUser();
  if (auth && auth.handle) punters.add(auth.handle);
  else punters.add('HeadPark73');

  try {
    const leagues = getStoredLeagues();
    leagues.forEach(l => {
      if (l && l.members) {
        Object.keys(l.members).forEach(m => punters.add(m));
      }
    });
  } catch (e) {}

  // Active verified punters on Bet Buddy platform
  punters.add('Punter_747');
  punters.add('Punter_737');

  return Math.max(3, punters.size);
}'''

new_punter_count = '''function getActualPunterCount() {
  const punters = new Set();
  const auth = getAuthUser();
  if (auth && auth.handle) punters.add(auth.handle);

  try {
    const leagues = getStoredLeagues();
    leagues.forEach(l => {
      if (l && l.members && Array.isArray(l.members)) {
        l.members.forEach(m => { if (m && m.handle) punters.add(m.handle); });
      }
    });
  } catch (e) {}

  return Math.max(auth && auth.signedIn ? 1 : 0, punters.size);
}'''

assert old_punter_count in js, "old_punter_count not found in app.js"
js = js.replace(old_punter_count, new_punter_count, 1)

# 5. Add startup cache wiper for old geo cache keys
old_wipe_hook = '''// Custom Multi-Sport Acca State
let customAccaLegs = [];
try {
  // Wipe stale custom acca state on startup to ensure a completely clean app per user directive
  localStorage.removeItem('betbuddy_custom_acca_v1');
} catch (e) {}'''

new_wipe_hook = '''// Custom Multi-Sport Acca State
let customAccaLegs = [];
try {
  // Wipe stale custom acca state and stale geo cache on startup to ensure a completely clean app
  localStorage.removeItem('betbuddy_custom_acca_v1');
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('betbuddy_geo_cache_')) localStorage.removeItem(k);
  });
  const savedLeagues = JSON.parse(localStorage.getItem(LEAGUES_STORAGE_KEY) || '[]');
  if (Array.isArray(savedLeagues)) {
    const cleanLeagues = savedLeagues.filter(l => l && l.code !== 'BUDDY-9240' && l.code !== 'BUDDY-7482');
    localStorage.setItem(LEAGUES_STORAGE_KEY, JSON.stringify(cleanLeagues));
  }
} catch (e) {}'''

assert old_wipe_hook in js, "old_wipe_hook not found in app.js"
js = js.replace(old_wipe_hook, new_wipe_hook, 1)

# 6. Bump to v74
js = re.sub(r"const APP_VERSION = 'v\d+';", "const APP_VERSION = 'v74';", js)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)
print("Updated app.js with zero dummy users in regional automatic leagues.")

# 7. Bump index.html to v74
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()
html = re.sub(r"id=\"footer-app-version\" style=\"color:var\(--cyan\)\">v\d+<", 'id="footer-app-version" style="color:var(--cyan)">v74<', html)
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Updated index.html to v74.")

# 8. Bump sw.js to v74
with open('sw.js', 'r', encoding='utf-8') as f:
    sw = f.read()
sw = re.sub(r"const CACHE_NAME = 'betbuddy-pwa-v\d+';", "const CACHE_NAME = 'betbuddy-pwa-v74';", sw)
with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(sw)
print("Updated sw.js to v74.")

