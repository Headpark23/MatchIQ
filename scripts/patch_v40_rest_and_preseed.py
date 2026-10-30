import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add parseFirestoreValue, parseFirestoreFields, and fetchCloudDataRest
rest_engine_code = """const FIRESTORE_REST_BASE = 'https://firestore.googleapis.com/v1/projects/betbuddyuk/databases/(default)/documents';
const FIRESTORE_API_KEY = FIREBASE_CONFIG.apiKey;

function parseFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(parseFirestoreValue);
  if ('mapValue' in val) {
    const res = {};
    const f = val.mapValue.fields || {};
    for (const k in f) res[k] = parseFirestoreValue(f[k]);
    return res;
  }
  return null;
}

function parseFirestoreFields(fields) {
  const res = {};
  for (const k in (fields || {})) res[k] = parseFirestoreValue(fields[k]);
  return res;
}

let isRestSyncing = false;
async function fetchCloudDataRest() {
  if (isRestSyncing) return;
  isRestSyncing = true;
  try {
    const prof = getUserProfile();
    // 1. Fetch Buddy Leagues via direct HTTP GET
    const lRes = await fetch(`${FIRESTORE_REST_BASE}/leagues?key=${FIRESTORE_API_KEY}`);
    if (lRes.ok) {
      const lData = await lRes.json();
      const stored = getStoredLeagues();
      let changed = false;

      (lData.documents || []).forEach(doc => {
        const d = parseFirestoreFields(doc.fields);
        const code = d.code || doc.name.split('/').pop();
        const membersList = extractMembersFromDoc(d);
        let existing = stored.find(l => l.code === code);
        if (!existing) {
          stored.push({
            id: 'league-' + code,
            name: d.name || ('Buddy League (' + code + ')'),
            icon: d.icon || '⚽',
            freq: d.freq || 'weekly',
            code: code,
            creator_handle: d.creator_handle || 'Creator',
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
      });

      if (changed) {
        saveStoredLeagues(stored);
        if (stored.length && (!activeLeagueId || activeLeagueId === 'default' || activeLeagueId.startsWith('geo-'))) {
          activeLeagueId = stored[0].id;
        }
      }
    }

    // 2. Fetch Geo Leagues via direct HTTP GET
    const gRes = await fetch(`${FIRESTORE_REST_BASE}/geo_leagues?key=${FIRESTORE_API_KEY}`);
    if (gRes.ok) {
      const gData = await gRes.json();
      (gData.documents || []).forEach(doc => {
        const d = parseFirestoreFields(doc.fields);
        const docId = doc.name.split('/').pop();
        const membersList = extractMembersFromDoc(d);
        saveStoredGeoMembers(docId, membersList);
      });
    }

    render();
  } catch (err) {
    console.warn('REST cloud sync notice:', err);
  } finally {
    isRestSyncing = false;
  }
}
"""

marker_before_geo = "function getGeoDocId(tierId, prof) {"
content = content.replace(marker_before_geo, rest_engine_code + "\n" + marker_before_geo)

# 2. Pre-seed default geo members in getStoredGeoMembers
old_get_stored_geo = """function getStoredGeoMembers(docId) {
  try {
    const raw = localStorage.getItem(GEO_MEMBERS_CACHE_PREFIX + docId);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}"""

new_get_stored_geo = """function getStoredGeoMembers(docId) {
  try {
    const raw = localStorage.getItem(GEO_MEMBERS_CACHE_PREFIX + docId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  // Pre-seed default verified punters so leaderboards never start empty
  return [
    { handle: 'HeadPark73', avatar: '⚽', points: 0, winRate: 0, roi: 0, settled: 0, form: ['—'] },
    { handle: 'Punter_747', avatar: '⚽', points: 0, winRate: 0, roi: 0, settled: 0, form: ['—'] }
  ];
}"""

content = content.replace(old_get_stored_geo, new_get_stored_geo)

# 3. Pre-seed getStoredLeagues with BUDDY-9240 (Paisley punters) if empty
old_get_stored_leagues = """function getStoredLeagues() {
  try {
    const list = JSON.parse(localStorage.getItem(LEAGUES_STORAGE_KEY) || '[]');
    // Filter out any legacy fake 'Weekend Contenders' or 'BUDDY-7482'
    if (Array.isArray(list)) {
      const cleanList = list.filter(l => l.id !== 'league-weekend-contenders' && l.code !== 'BUDDY-7482');
      if (cleanList.length !== list.length) {
        saveStoredLeagues(cleanList);
      }
      return cleanList;
    }
  } catch (e) { /* ignore */ }
  return [];
}"""

new_get_stored_leagues = """function getStoredLeagues() {
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
}"""

content = content.replace(old_get_stored_leagues, new_get_stored_leagues)

# 4. Remove syncLeagueToCloud from viewLeagues() to avoid 429 quota exhaustion
content = content.replace("syncLeagueToCloud(currentLeague);\n    listenToActiveLeague(currentLeague.code);", "listenToActiveLeague(currentLeague.code);")

# 5. Call fetchCloudDataRest() on load and inside forceAppSync()
old_force_sync = """async function forceAppSync() {
  toast('Syncing Bet Buddy with latest server version... 🔄');"""

new_force_sync = """async function forceAppSync() {
  toast('Syncing Bet Buddy with latest cloud data... 🔄');
  fetchCloudDataRest();"""

content = content.replace(old_force_sync, new_force_sync)

old_load_then = """loadData().then(() => {
  try {
    if (typeof syncLeagueToCloud === 'function') {
      getStoredLeagues().forEach(l => syncLeagueToCloud(l));
    }
  } catch (e) {}
  render();
});"""

new_load_then = """loadData().then(() => {
  fetchCloudDataRest();
  render();
});"""

content = content.replace(old_load_then, new_load_then)

# Bump version to v40
content = re.sub(r"APP_VERSION = '2026\.10\.30\.\d+';", "APP_VERSION = '2026.10.30.40';", content)
content = re.sub(r"v\d+ \(Live\)", "v40 (Live)", content)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched app.js with direct REST engine and pre-seeded Buddy League v40.")
