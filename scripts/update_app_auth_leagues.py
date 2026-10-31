"""Update app.js with real Firebase Auth, handle transactions, and UID-keyed leagues."""
import re
import sys
from pathlib import Path

APP_JS = Path("app.js")
content = APP_JS.read_text(encoding="utf-8")

# --- 1. Replace Phase 2 Cloud Sync block ---
start_marker = "// ------------------------------------------------------------ Firebase Firestore Cloud Sync"
end_marker = "const TROPHY_CABINET_KEY = 'betbuddy_trophy_cabinet_v1';"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"Error: markers not found. start_idx={start_idx}, end_idx={end_idx}")
    sys.exit(1)

phase2_replacement = """// ------------------------------------------------------------ Firebase Firestore & Auth Cloud Sync
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDPTMcwfVP6v8Y1jsrnUqdM5EeIMwXKxw4",
  authDomain: "betbuddyuk.firebaseapp.com",
  projectId: "betbuddyuk",
  storageBucket: "betbuddyuk.firebasestorage.app",
  messagingSenderId: "875941513115",
  appId: "1:875941513115:web:c5366ae899be00547c833e",
  measurementId: "G-K1N7N0G8NF"
};

let firestoreDb = null;
let firebaseAuth = null;

try {
  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    firestoreDb = firebase.firestore();
    if (firebase.auth) {
      firebaseAuth = firebase.auth();
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.search.includes('emulator=1')) {
      if (firebaseAuth && firebaseAuth.useEmulator) {
        firebaseAuth.useEmulator('http://127.0.0.1:9099');
      }
      if (firestoreDb && firestoreDb.useEmulator) {
        firestoreDb.useEmulator('127.0.0.1', 8080);
      }
      console.log('Attached Firebase emulators (Auth: 9099, Firestore: 8080)');
    }
  }
} catch (e) {
  console.warn('Firebase init notice:', e);
}

let activeLeagueUnsubscribe = null;
let activeMembersUnsubscribe = null;

const LEAGUE_CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function generateSecureLeagueCode(length = 8) {
  let result = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += LEAGUE_CODE_CHARS[bytes[i] % LEAGUE_CODE_CHARS.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += LEAGUE_CODE_CHARS[Math.floor(Math.random() * LEAGUE_CODE_CHARS.length)];
    }
  }
  return result;
}

function getGeoDocId(tierId, prof) {
  if (tierId === 'geo-country') return 'country-' + (prof.country || 'Scotland').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  if (tierId === 'geo-region') return 'region-' + (prof.region || 'Renfrewshire').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  if (tierId === 'geo-town') return 'town-' + (prof.town || 'Paisley').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return tierId;
}

const GEO_MEMBERS_CACHE_PREFIX = 'betbuddy_geo_cache_';
function getStoredGeoMembers(docId) {
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
}

function saveStoredGeoMembers(docId, members) {
  try {
    localStorage.setItem(GEO_MEMBERS_CACHE_PREFIX + docId, JSON.stringify(members));
  } catch (e) {}
}

function extractMembersFromDoc(data) {
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
  // Geo leagues are read-only public leaderboards in security rules; client mutations disabled
}

async function renameLeague(code) {
  const list = getStoredLeagues();
  const target = list.find(l => l.code === code);
  const currentName = target ? (typeof target.name === 'function' ? target.name() : target.name) : 'Buddy League';
  const user = getAuthUser();
  if (target && target.creatorUid && (!user || user.uid !== target.creatorUid)) {
    toast('Only the league creator can rename this league.');
    return;
  }
  const newName = prompt('Enter new name for your league (3–40 characters):', currentName);
  if (!newName || !newName.trim()) return;
  const cleanName = newName.trim();
  if (cleanName.length < 3 || cleanName.length > 40) {
    toast('League name must be between 3 and 40 characters.');
    return;
  }
  if (target) {
    target.name = cleanName;
    saveStoredLeagues(list);
  }
  if (firestoreDb && code && user && user.emailVerified) {
    try {
      await firestoreDb.collection('leagues').doc(code).update({
        name: cleanName,
        updatedAt: new Date().toISOString()
      });
      await firestoreDb.collection('users').doc(user.uid).collection('leagueMemberships').doc(code).set({
        name: cleanName
      }, { merge: true }).catch(() => {});
      toast('League renamed to ' + cleanName + '!');
    } catch (e) {
      console.warn('Rename error:', e);
      toast('Renamed locally: ' + cleanName);
    }
  }
  render();
}

async function refreshLeagueFromCloud(code) {
  if (!firestoreDb || !code) return;
  const user = getAuthUser();
  try {
    const snap = await firestoreDb.collection('leagues').doc(code).get();
    if (snap.exists) {
      const data = snap.data();
      const list = getStoredLeagues();
      const target = list.find(l => l.code === code);
      if (target) {
        const memSnap = await firestoreDb.collection('leagues').doc(code).collection('members').get();
        const mems = [];
        memSnap.forEach(d => mems.push({ ...d.data(), uid: d.id }));
        target.members = mems.filter(m => user ? m.uid !== user.uid : true);
        saveStoredLeagues(list);
        render();
      }
    }
  } catch(e) {}
}

async function refreshGeoLeagueFromCloud(docId) {
  if (!firestoreDb || !docId) return;
  try {
    const snap = await firestoreDb.collection('geo_leagues').doc(docId).get();
    if (snap.exists) {
      const data = snap.data();
      if (data && data.members) {
        saveStoredGeoMembers(docId, Object.values(data.members));
        render();
      }
    }
  } catch(e) {}
}

async function kickPlayerFromLeague(leagueCode, memberUid, handle) {
  const user = getAuthUser();
  const list = getStoredLeagues();
  const target = list.find(l => l.code === leagueCode);
  if (target && target.creatorUid && (!user || user.uid !== target.creatorUid)) {
    toast('Only the league creator can throw players out.');
    return;
  }
  if (!confirm('Are you sure you want to throw @' + (handle || 'this punter') + ' out of this league?')) return;
  toast('Removing @' + (handle || 'punter') + '...');

  if (target && target.members) {
    target.members = target.members.filter(m => (memberUid && m.uid) ? m.uid !== memberUid : m.handle !== handle);
    saveStoredLeagues(list);
  }

  if (firestoreDb && leagueCode) {
    try {
      if (memberUid) {
        await firestoreDb.collection('leagues').doc(leagueCode).collection('members').doc(memberUid).delete();
      }
      toast('@' + (handle || 'punter') + ' thrown out of league.');
    } catch (e) {
      console.warn('Kick error:', e);
      toast('@' + (handle || 'punter') + ' removed locally.');
    }
  }
  render();
}

async function leaveLeague(leagueId, leagueCode) {
  const list = getStoredLeagues();
  const target = list.find(l => l.id === leagueId || l.code === leagueCode);
  const name = target ? (typeof target.name === 'function' ? target.name() : target.name) : 'this league';
  if (!confirm('Are you sure you want to leave ' + name + '?\\nYour stats will be removed from this leaderboard.')) return;

  toast('Leaving league...');
  const user = getAuthUser();

  if (firestoreDb && leagueCode && user && user.uid) {
    try {
      await firestoreDb.collection('leagues').doc(leagueCode).collection('members').doc(user.uid).delete();
      await firestoreDb.collection('users').doc(user.uid).collection('leagueMemberships').doc(leagueCode).delete();
    } catch (e) {
      console.warn('Leave league notice:', e);
    }
  }

  const updated = list.filter(l => l.id !== leagueId && l.code !== leagueCode);
  saveStoredLeagues(updated);
  activeLeagueId = 'default';
  toast('You left ' + name + '.');
  render();
}

async function deleteLeague(leagueId, leagueCode) {
  const list = getStoredLeagues();
  const target = list.find(l => l.id === leagueId || l.code === leagueCode);
  const name = target ? (typeof target.name === 'function' ? target.name() : target.name) : 'this league';
  const user = getAuthUser();

  if (target && target.creatorUid && (!user || user.uid !== target.creatorUid)) {
    return leaveLeague(leagueId, leagueCode);
  }

  if (!confirm('Are you sure you want to permanently delete ' + name + '?\\nThis will remove the league for all members.')) return;

  toast('Deleting league...');

  if (firestoreDb && leagueCode && user && user.emailVerified) {
    try {
      await firestoreDb.collection('leagues').doc(leagueCode).delete();
      await firestoreDb.collection('users').doc(user.uid).collection('leagueMemberships').doc(leagueCode).delete().catch(() => {});
    } catch (e) {
      console.warn('Cloud league delete notice:', e);
    }
  }

  const updated = list.filter(l => l.id !== leagueId && l.code !== leagueCode);
  saveStoredLeagues(updated);

  activeLeagueId = 'default';
  toast('League deleted.');
  render();
}

async function syncLeagueToCloud(league) {
  if (!firestoreDb || !league || !league.code) return;
  const user = getAuthUser();
  if (!user || !user.signedIn || !user.emailVerified) return;

  const prof = getUserProfile();
  const uStats = getUserLeagueStats(league.freq || 'weekly');
  const nowIso = new Date().toISOString();

  const memberPayload = {
    uid: user.uid,
    handle: prof.handle,
    avatar: prof.avatar || '⚽',
    points: Math.max(-1000, Math.min(50000, parseInt(uStats.points, 10) || 0)),
    winRate: Math.max(0, Math.min(100, Math.round(+uStats.winRate || 0))),
    roi: Math.max(-100, Math.min(10000, Math.round((+uStats.roi || 0) * 10) / 10)),
    settled: Math.max(0, parseInt(uStats.settled, 10) || 0),
    form: Array.isArray(uStats.form) ? uStats.form.slice(0, 10) : ['—'],
    updatedAt: nowIso
  };

  try {
    const batch = firestoreDb.batch();
    const leagueRef = firestoreDb.collection('leagues').doc(league.code);
    const memberRef = leagueRef.collection('members').doc(user.uid);
    const membershipRef = firestoreDb.collection('users').doc(user.uid).collection('leagueMemberships').doc(league.code);

    const isCreator = !league.is_joined && (!league.creatorUid || league.creatorUid === user.uid);
    if (isCreator) {
      if (!league.creatorUid) league.creatorUid = user.uid;
      if (!league.creatorHandle) league.creatorHandle = prof.handle;
      batch.set(leagueRef, {
        code: league.code,
        name: (league.name || 'Buddy League').slice(0, 40),
        icon: (league.icon || '⚽').slice(0, 10),
        freq: ['weekly', 'monthly', 'yearly'].includes(league.freq) ? league.freq : 'weekly',
        creatorUid: user.uid,
        creatorHandle: prof.handle,
        createdAt: league.createdAt || league.created_at || nowIso,
        updatedAt: nowIso
      }, { merge: true });
    }

    batch.set(memberRef, memberPayload, { merge: true });
    batch.set(membershipRef, {
      code: league.code,
      name: (league.name || 'Buddy League').slice(0, 40),
      icon: (league.icon || '⚽').slice(0, 10),
      role: isCreator ? 'creator' : 'member',
      joinedAt: nowIso
    }, { merge: true });

    await batch.commit();
  } catch (err) {
    console.warn('syncLeagueToCloud notice:', err);
  }
}

let hasSyncedUserLeagues = false;
async function syncUserLeaguesFromCloud() {
  if (!firestoreDb || hasSyncedUserLeagues) return;
  const user = getAuthUser();
  if (!user || !user.signedIn || !user.emailVerified) return;

  try {
    const membershipsSnap = await firestoreDb.collection('users').doc(user.uid).collection('leagueMemberships').get();
    if (!membershipsSnap.empty) {
      const list = getStoredLeagues();
      let changed = false;

      for (const mDoc of membershipsSnap.docs) {
        const memData = mDoc.data() || {};
        const code = memData.code || mDoc.id;
        try {
          const leagueDoc = await firestoreDb.collection('leagues').doc(code).get();
          if (leagueDoc.exists) {
            const lData = leagueDoc.data() || {};
            const membersSnap = await firestoreDb.collection('leagues').doc(code).collection('members').get();
            const membersList = [];
            membersSnap.forEach(d => {
              membersList.push({ ...d.data(), uid: d.id });
            });

            let existing = list.find(l => l.code === code);
            const isCreator = lData.creatorUid === user.uid;
            if (!existing) {
              list.push({
                id: 'league-' + code,
                name: lData.name || ('Buddy League (' + code + ')'),
                icon: lData.icon || '⚽',
                freq: lData.freq || 'weekly',
                code: code,
                creatorUid: lData.creatorUid,
                creatorHandle: lData.creatorHandle || 'Creator',
                created_at: lData.createdAt ? lData.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
                is_joined: !isCreator,
                members: membersList.filter(m => m.uid !== user.uid)
              });
              changed = true;
            } else {
              existing.name = lData.name || existing.name;
              existing.icon = lData.icon || existing.icon;
              existing.freq = lData.freq || existing.freq;
              if (lData.creatorUid) existing.creatorUid = lData.creatorUid;
              if (lData.creatorHandle) existing.creatorHandle = lData.creatorHandle;
              existing.members = membersList.filter(m => m.uid !== user.uid);
              changed = true;
            }
          }
        } catch (lErr) {
          console.warn('Error fetching league ' + code, lErr);
        }
      }

      if (changed) {
        saveStoredLeagues(list);
        render();
      }
    }
    hasSyncedUserLeagues = true;
  } catch (e) {
    console.warn('syncUserLeaguesFromCloud notice:', e);
  }
}

let currentLeagueListeningCode = null;
function listenToActiveLeague(code) {
  if (!firestoreDb || !code) return;
  const user = getAuthUser();
  if (!user || !user.signedIn || !user.emailVerified) return;

  if (currentLeagueListeningCode === code && activeLeagueUnsubscribe) return;
  if (activeLeagueUnsubscribe) {
    try { activeLeagueUnsubscribe(); } catch (e) {}
    activeLeagueUnsubscribe = null;
  }
  if (activeMembersUnsubscribe) {
    try { activeMembersUnsubscribe(); } catch (e) {}
    activeMembersUnsubscribe = null;
  }
  currentLeagueListeningCode = code;

  try {
    const leagueRef = firestoreDb.collection('leagues').doc(code);
    activeLeagueUnsubscribe = leagueRef.onSnapshot(doc => {
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
      if (target) {
        if (data.name) target.name = data.name;
        if (data.icon) target.icon = data.icon;
        if (data.creatorUid) target.creatorUid = data.creatorUid;
        if (data.creatorHandle) target.creatorHandle = data.creatorHandle;
        saveStoredLeagues(list);
        render();
      }
    }, err => console.warn('League listener notice:', err));

    activeMembersUnsubscribe = leagueRef.collection('members').onSnapshot(snap => {
      const list = getStoredLeagues();
      const target = list.find(l => l.code === code);
      if (target && snap) {
        const membersList = [];
        snap.forEach(d => {
          membersList.push({ ...d.data(), uid: d.id });
        });
        target.members = membersList.filter(m => m.uid !== user.uid);
        saveStoredLeagues(list);
        render();
      }
    }, err => console.warn('Members listener notice:', err));
  } catch (e) {
    console.warn('listenToActiveLeague error:', e);
  }
}

async function joinCloudLeague(code) {
  if (!code) return;
  const user = getAuthUser();
  if (!user || !user.signedIn) {
    toast('Please sign in or create an account to join private leagues.');
    openAuthModal();
    return;
  }
  if (!user.emailVerified) {
    toast('Please verify your email address to join private leagues.');
    openAuthModal();
    return;
  }

  let leagueData = null;
  let membersList = [];

  if (firestoreDb) {
    try {
      const snap = await firestoreDb.collection('leagues').doc(code).get();
      if (!snap.exists) {
        toast('League ' + code + ' not found. Please check code.');
        return;
      }
      leagueData = snap.data();
      const memSnap = await firestoreDb.collection('leagues').doc(code).collection('members').get();
      if (!memSnap.empty) {
        memSnap.forEach(d => {
          membersList.push({ ...d.data(), uid: d.id });
        });
      } else if (leagueData.members) {
        membersList = extractMembersFromDoc(leagueData);
      }
    } catch (e) {
      console.warn('Join cloud fetch notice:', e);
      toast('Could not connect to cloud league: ' + (e.message || 'Error'));
      return;
    }
  }

  const prof = getUserProfile();
  const list = getStoredLeagues();
  let league = list.find(l => l.code === code);
  const leagueName = (leagueData && leagueData.name) || ('Buddy League (' + code + ')');
  const leagueIcon = (leagueData && leagueData.icon) || '⚽';
  const leagueFreq = (leagueData && leagueData.freq) || 'weekly';
  const creatorUid = (leagueData && leagueData.creatorUid) || null;
  const creatorHandle = (leagueData && leagueData.creatorHandle) || null;

  if (!league) {
    league = {
      id: 'league-' + Date.now(),
      name: leagueName,
      icon: leagueIcon,
      freq: leagueFreq,
      code: code,
      is_joined: true,
      creatorUid: creatorUid,
      creatorHandle: creatorHandle,
      created_at: (leagueData && leagueData.createdAt) || new Date().toISOString().slice(0, 10),
      members: membersList.filter(m => (m.uid ? m.uid !== user.uid : m.handle !== prof.handle))
    };
    list.push(league);
  } else {
    league.name = leagueName;
    league.icon = leagueIcon;
    league.freq = leagueFreq;
    if (creatorUid) league.creatorUid = creatorUid;
    if (creatorHandle) league.creatorHandle = creatorHandle;
    league.members = membersList.filter(m => (m.uid ? m.uid !== user.uid : m.handle !== prof.handle));
  }
  saveStoredLeagues(list);
  activeLeagueId = league.id;

  syncLeagueToCloud(league);
  listenToActiveLeague(code);
  toast('Joined ' + leagueName + '! ⚽');
  render();
}

async function syncDiaryToCloud() {
  if (!firestoreDb || !currentAuthUser) return;
  try {
    const diary = getStoredDiary();
    const batch = firestoreDb.batch();
    const userDiaryRef = firestoreDb.collection('users').doc(currentAuthUser.uid).collection('diary');
    diary.forEach(entry => {
      if (entry && entry.id) {
        const docRef = userDiaryRef.doc(String(entry.id));
        batch.set(docRef, entry, { merge: true });
      }
    });
    await batch.commit();
  } catch (e) {
    console.warn('syncDiaryToCloud notice:', e);
  }
}

async function syncDiaryFromCloud() {
  if (!firestoreDb || !currentAuthUser) return;
  try {
    const userDiaryRef = firestoreDb.collection('users').doc(currentAuthUser.uid).collection('diary');
    const snap = await userDiaryRef.get();
    if (!snap.empty) {
      const local = getStoredDiary();
      const localMap = new Map(local.map(d => [String(d.id), d]));
      let added = false;
      snap.forEach(doc => {
        const remote = doc.data();
        if (remote && remote.id && !localMap.has(String(remote.id))) {
          localMap.set(String(remote.id), remote);
          added = true;
        }
      });
      if (added) {
        const merged = Array.from(localMap.values());
        saveStoredDiary(merged);
        render();
      }
    }
  } catch (e) {
    console.warn('syncDiaryFromCloud notice:', e);
  }
}

"""

content = content[:start_idx] + phase2_replacement + content[end_idx:]

# --- 2. Update Leaderboard Action buttons ---
# In kick button: add data-kick-uid
old_kick_cell = """    const kickCell = m.isYou
      ? '<td class="lb-col-action"><span class="bento-badge cyan text-xs">You</span></td>'
      : '<td class="lb-col-action"><button type="button" class="kick-player-btn" data-kick-player="' + esc(m.handle) + '" data-league-code="' + esc(currentLeague.code) + '" title="Throw @' + esc(m.handle) + ' out of this league">Kick ✕</button></td>';"""

new_kick_cell = """    const kickCell = m.isYou
      ? '<td class="lb-col-action"><span class="bento-badge cyan text-xs">You</span></td>'
      : '<td class="lb-col-action"><button type="button" class="kick-player-btn" data-kick-player="' + esc(m.handle) + '" data-kick-uid="' + esc(m.uid || '') + '" data-league-code="' + esc(currentLeague.code) + '" title="Throw @' + esc(m.handle) + ' out of this league">Kick ✕</button></td>';"""

if old_kick_cell in content:
    content = content.replace(old_kick_cell, new_kick_cell)
    print("Replaced old_kick_cell")
else:
    print("Warning: old_kick_cell not found verbatim, trying regex/partial match")

# In delete league vs leave league button
old_del_btn = """            '<button type="button" class="btn danger small" data-delete-league="' + esc(currentLeague.id) + '" data-league-code="' + esc(currentLeague.code) + '" title="Delete this league">Delete League 🗑️</button>' +"""
new_del_btn = """            (isLeagueCreator
              ? '<button type="button" class="btn danger small" data-delete-league="' + esc(currentLeague.id) + '" data-league-code="' + esc(currentLeague.code) + '" title="Delete this league">Delete League 🗑️</button>'
              : '<button type="button" class="btn secondary small" data-leave-league="' + esc(currentLeague.id) + '" data-league-code="' + esc(currentLeague.code) + '" title="Leave this league">Leave League 🚪</button>') +"""

if old_del_btn in content:
    content = content.replace(old_del_btn, new_del_btn)
    print("Replaced old_del_btn")
else:
    print("Warning: old_del_btn not found")

# --- 3. Replace Auth Implementation Block ---
auth_start_marker = "// ------------------------------------------------------------ Google Auth & PWA Installation"
auth_end_marker = "function isIos() {"

auth_start_idx = content.find(auth_start_marker)
auth_end_idx = content.find(auth_end_marker)

if auth_start_idx == -1 or auth_end_idx == -1:
    print(f"Error: auth markers not found. auth_start_idx={auth_start_idx}, auth_end_idx={auth_end_idx}")
    sys.exit(1)

auth_replacement = """// ------------------------------------------------------------ Firebase Auth & Handles
const AUTH_STORAGE_KEY = 'betbuddy_auth_user_v1';
let deferredInstallPrompt = null;
let currentAuthUser = null;
let currentAuthProfile = null;
let lastResendVerificationTime = 0;

const HANDLE_REGEX = /^[A-Za-z0-9_]{3,20}$/;
function isValidHandle(h) {
  return typeof h === 'string' && HANDLE_REGEX.test(h);
}

function mapAuthError(err) {
  if (!err) return 'An unexpected error occurred. Please try again.';
  const code = err.code || '';
  if (code === 'auth/unauthorized-domain') {
    console.error('Firebase Auth unauthorized domain:', window.location.hostname);
    return 'This web domain is not authorised in Firebase Auth console. Check developer console for details.';
  }
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please check and try again.';
    case 'auth/user-not-found':
      return 'No Bet Buddy account found with this email.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 8 characters long.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in window closed before completing. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes before trying again.';
    case 'auth/requires-recent-login':
      return 'Please sign out and sign in again before changing your password.';
    default:
      return err.message || 'Authentication error. Please try again.';
  }
}

function showAuthError(boxId, message) {
  const box = $(boxId);
  if (box) {
    box.textContent = message;
    box.hidden = false;
  }
}

function getAuthUser() {
  if (!currentAuthUser) return null;
  const prof = currentAuthProfile || getUserProfile();
  const providerIds = (currentAuthUser.providerData || []).map(p => p.providerId);
  const isGoogle = providerIds.includes('google.com');
  const isPassword = providerIds.includes('password');

  return {
    signedIn: true,
    uid: currentAuthUser.uid,
    name: currentAuthUser.displayName || prof.handle || 'Punter',
    email: currentAuthUser.email || '',
    handle: prof.handle || 'Punter',
    emailVerified: Boolean(currentAuthUser.emailVerified || isGoogle),
    isGoogle,
    isPassword
  };
}

function saveAuthUser(user) {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {}
  updateHeaderAuthUI();
}

async function claimHandleTransaction(uid, handle, avatar = '⚽') {
  if (!firestoreDb) throw new Error('Firestore not initialized');
  if (!isValidHandle(handle)) throw new Error('Gamertag must be 3–20 letters, numbers, or underscores.');

  const handleLower = handle.toLowerCase();
  const handleRef = firestoreDb.collection('handles').doc(handleLower);
  const userRef = firestoreDb.collection('users').doc(uid);

  return firestoreDb.runTransaction(async tx => {
    const handleDoc = await tx.get(handleRef);
    if (handleDoc.exists) {
      const data = handleDoc.data() || {};
      if (data.uid !== uid) {
        throw new Error('This gamertag is already taken. Please choose another.');
      }
    }
    const userDoc = await tx.get(userRef);
    const existingUserData = userDoc.exists ? userDoc.data() : null;

    let oldHandleLower = null;
    if (existingUserData && existingUserData.handle && existingUserData.handle.toLowerCase() !== handleLower) {
      oldHandleLower = existingUserData.handle.toLowerCase();
    }

    const nowIso = new Date().toISOString();
    tx.set(handleRef, {
      uid: uid,
      handle: handle,
      createdAt: (handleDoc.exists && handleDoc.data().createdAt) ? handleDoc.data().createdAt : nowIso
    });

    if (oldHandleLower) {
      tx.delete(firestoreDb.collection('handles').doc(oldHandleLower));
    }

    const userPayload = {
      handle: handle,
      avatar: avatar,
      updatedAt: nowIso
    };
    if (!existingUserData || !existingUserData.createdAt) {
      userPayload.createdAt = nowIso;
    } else {
      userPayload.createdAt = existingUserData.createdAt;
    }

    tx.set(userRef, userPayload, { merge: true });
  });
}

async function ensureUserProfile(user) {
  if (!firestoreDb || !user) return;
  try {
    const userDocRef = firestoreDb.collection('users').doc(user.uid);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      currentAuthProfile = userDoc.data();
      const cur = getUserProfile();
      saveUserProfile(currentAuthProfile.handle || cur.handle, cur.town, cur.region, cur.country);
      return;
    }

    let baseHandle = (user.displayName || (user.email ? user.email.split('@')[0] : 'Punter'))
      .replace(/[^A-Za-z0-9_]/g, '');
    if (baseHandle.length < 3) baseHandle = 'Punter_' + baseHandle;
    if (baseHandle.length > 16) baseHandle = baseHandle.slice(0, 16);

    let finalHandle = baseHandle;
    let claimed = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await claimHandleTransaction(user.uid, finalHandle, '⚽');
        claimed = true;
        break;
      } catch (err) {
        finalHandle = (baseHandle.slice(0, 14) + Math.floor(Math.random() * 899 + 100)).slice(0, 20);
      }
    }
    if (claimed) {
      currentAuthProfile = { handle: finalHandle, avatar: '⚽', createdAt: new Date().toISOString() };
      const cur = getUserProfile();
      saveUserProfile(finalHandle, cur.town, cur.region, cur.country);
    }
  } catch (e) {
    console.warn('ensureUserProfile notice:', e);
  }
}

function updateHeaderAuthUI() {
  const container = $('header-auth-container');
  if (!container) return;
  const user = getAuthUser();
  if (user && user.signedIn) {
    const initials = (user.name || user.email || 'U').slice(0, 1).toUpperCase();
    container.innerHTML = '<button type="button" class="header-user-btn" id="header-user-btn" title="Signed in as ' + esc(user.name || user.email) + '">' +
      '<span class="header-avatar">' + esc(initials) + '</span>' +
      '<span>@' + esc(user.handle || 'Punter') + '</span>' +
      (!user.emailVerified ? ' <span style="color:#fbbf24;font-size:11px;" title="Unverified Email">⚠️</span>' : '') +
      '</button>';
  } else {
    container.innerHTML = '<button type="button" class="google-sub-btn" id="header-auth-btn" title="Sign in or join">' +
      '<svg class="google-g" viewBox="0 0 24 24" width="13" height="13"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>' +
      '<span>Sign In / Join</span></button>';
  }
}

function switchAuthModalView(viewName) {
  const views = ['auth-signin-view', 'auth-register-view', 'auth-verify-view', 'auth-forgot-view', 'auth-authed-view'];
  views.forEach(id => {
    const el = $(id);
    if (el) el.hidden = (id !== viewName);
  });
  ['signin-error', 'register-error', 'change-pass-error', 'forgot-msg'].forEach(id => {
    const el = $(id);
    if (el) { el.hidden = true; el.textContent = ''; }
  });
}

function openAuthModal() {
  const modal = $('google-auth-modal');
  if (!modal) return;
  const user = getAuthUser();
  if (user && user.signedIn) {
    switchAuthModalView('auth-authed-view');
    $('modal-avatar-initials').textContent = (user.name || user.email || 'U').slice(0, 1).toUpperCase();
    $('modal-auth-name').textContent = user.name || 'Bet Buddy User';
    $('modal-auth-email').textContent = user.email || '';

    const badge = $('modal-auth-badge');
    const warning = $('modal-unverified-warning');
    if (user.emailVerified) {
      if (badge) { badge.textContent = 'Verified Account'; badge.className = 'badge-status-green'; }
      if (warning) warning.hidden = true;
    } else {
      if (badge) { badge.textContent = 'Unverified Email'; badge.className = 'badge-status-yellow'; }
      if (warning) warning.hidden = false;
    }

    const passSec = $('profile-password-section');
    const googleNote = $('profile-google-note');
    if (user.isPassword) {
      if (passSec) passSec.hidden = false;
      if (googleNote) googleNote.hidden = true;
    } else {
      if (passSec) passSec.hidden = true;
      if (googleNote) googleNote.hidden = false;
    }
  } else {
    switchAuthModalView('auth-signin-view');
  }
  modal.hidden = false;
}

function closeAuthModal() {
  const modal = $('google-auth-modal');
  if (modal) modal.hidden = true;
}

async function signInWithGoogle() {
  if (!firebaseAuth) {
    toast('Authentication is not available in this browser.');
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    if (isInStandaloneMode() || isIos()) {
      await firebaseAuth.signInWithRedirect(provider);
      return;
    }
    await firebaseAuth.signInWithPopup(provider);
    closeAuthModal();
    toast('Signed in with Google! ⚽');
  } catch (err) {
    if (err.code === 'auth/popup-blocked') {
      try {
        await firebaseAuth.signInWithRedirect(provider);
        return;
      } catch (rErr) {
        showAuthError('signin-error', mapAuthError(rErr));
      }
    } else {
      showAuthError('signin-error', mapAuthError(err));
    }
  }
}

async function handleSignInWithEmail(email, password) {
  if (!firebaseAuth) return;
  try {
    await firebaseAuth.signInWithEmailAndPassword(email, password);
    closeAuthModal();
    toast('Welcome back! Signed in. ⚽');
  } catch (err) {
    showAuthError('signin-error', mapAuthError(err));
  }
}

async function handleRegisterWithEmail(handle, email, password, isAgeChecked) {
  if (!isAgeChecked) {
    showAuthError('register-error', 'You must confirm you are 18+ to create an account.');
    return;
  }
  if (!isValidHandle(handle)) {
    showAuthError('register-error', 'Gamertag must be 3–20 letters, numbers, or underscores.');
    return;
  }
  if (!password || password.length < 8) {
    showAuthError('register-error', 'Password must be at least 8 characters long.');
    return;
  }
  if (!firebaseAuth) return;

  try {
    if (firestoreDb) {
      const handleDoc = await firestoreDb.collection('handles').doc(handle.toLowerCase()).get();
      if (handleDoc.exists) {
        showAuthError('register-error', 'Gamertag @' + handle + ' is already taken. Please choose another.');
        return;
      }
    }

    const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
    if (cred.user) {
      await cred.user.sendEmailVerification();
      await claimHandleTransaction(cred.user.uid, handle, '⚽');
      currentAuthProfile = { handle, avatar: '⚽', createdAt: new Date().toISOString() };
      saveUserProfile(handle);
      $('verify-email-display').textContent = email;
      switchAuthModalView('auth-verify-view');
      toast('Account created! Verification link sent to ' + email);
    }
  } catch (err) {
    showAuthError('register-error', mapAuthError(err));
  }
}

async function resendVerificationEmail() {
  const now = Date.now();
  if (now - lastResendVerificationTime < 60000) {
    const remaining = Math.ceil((60000 - (now - lastResendVerificationTime)) / 1000);
    toast('Please wait ' + remaining + 's before requesting another verification email.');
    return;
  }
  if (!firebaseAuth || !firebaseAuth.currentUser) {
    toast('No signed-in user found.');
    return;
  }
  try {
    await firebaseAuth.currentUser.sendEmailVerification();
    lastResendVerificationTime = Date.now();
    toast('Verification email resent! Check your inbox or spam folder.');
    const status = $('verify-resend-status');
    if (status) status.textContent = 'Verification email sent just now.';
  } catch (err) {
    toast(mapAuthError(err));
  }
}

async function checkEmailVerified() {
  if (!firebaseAuth || !firebaseAuth.currentUser) return;
  try {
    await firebaseAuth.currentUser.reload();
    if (firebaseAuth.currentUser.emailVerified) {
      toast('Email verified! You now have full league access. ⚽');
      closeAuthModal();
      updateHeaderAuthUI();
      render();
    } else {
      toast('Email not verified yet. Please tap the link sent to your inbox.');
    }
  } catch (e) {
    toast('Error checking verification: ' + (e.message || 'Try again'));
  }
}

async function handleForgotPassword(email) {
  if (!email || !firebaseAuth) return;
  try {
    await firebaseAuth.sendPasswordResetEmail(email);
    const box = $('forgot-msg');
    if (box) {
      box.hidden = false;
      box.textContent = 'Password reset email sent to ' + email + '. Follow the instructions to reset your password.';
    }
    toast('Password reset link dispatched.');
  } catch (err) {
    showAuthError('forgot-msg', mapAuthError(err));
  }
}

async function handleChangePassword(currentPass, newPass) {
  if (!firebaseAuth || !firebaseAuth.currentUser) return;
  if (!newPass || newPass.length < 8) {
    showAuthError('change-pass-error', 'New password must be at least 8 characters long.');
    return;
  }
  try {
    const cred = firebase.auth.EmailAuthProvider.credential(firebaseAuth.currentUser.email, currentPass);
    await firebaseAuth.currentUser.reauthenticateWithCredential(cred);
    await firebaseAuth.currentUser.updatePassword(newPass);
    toast('Password successfully updated!');
    const errBox = $('change-pass-error');
    if (errBox) errBox.hidden = true;
    $('profile-change-password-form').reset();
  } catch (err) {
    showAuthError('change-pass-error', mapAuthError(err));
  }
}

async function handleSignOut() {
  if (firebaseAuth) {
    try {
      await firebaseAuth.signOut();
    } catch (e) {}
  }
  currentAuthUser = null;
  currentAuthProfile = null;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {}
  closeAuthModal();
  toast('Signed out.');
  updateHeaderAuthUI();
  render();
}

function initFirebaseAuth() {
  if (!firebaseAuth) return;

  firebaseAuth.getRedirectResult().then(result => {
    if (result && result.user) {
      toast('Signed in with Google! ⚽');
    }
  }).catch(err => {
    console.warn('Redirect sign-in notice:', err);
    toast(mapAuthError(err));
  });

  firebaseAuth.onAuthStateChanged(async user => {
    currentAuthUser = user;
    if (user) {
      try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (e) {}
      await ensureUserProfile(user);
      hasSyncedUserLeagues = false;
      await syncUserLeaguesFromCloud();
      try { await syncDiaryFromCloud(); } catch (e) {}
    } else {
      currentAuthProfile = null;
      try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (e) {}
    }
    updateHeaderAuthUI();
    render();
  });
}

"""

content = content[:auth_start_idx] + auth_replacement + content[auth_end_idx:]

# --- 4. Update Click and Submit event handlers ---

# Click handler replacements
old_auth_clicks = """  if (t.id === 'header-auth-btn' || t.id === 'header-user-btn') { openAuthModal(); return; }
  if (t.dataset.closeAuth !== undefined) { closeAuthModal(); return; }
  if (t.id === 'btn-switch-handle') { closeAuthModal(); const _p = getUserProfile();
    $('player-handle-input').value = _p.handle;
    if ($('player-town-input')) $('player-town-input').value = _p.town || 'Paisley';
    if ($('player-region-input')) $('player-region-input').value = _p.region || 'Renfrewshire';
    if ($('player-country-input')) $('player-country-input').value = _p.country || 'Scotland';
    $('handle-modal').hidden = false; return; }
  if (t.id === 'btn-google-signout') {
    saveAuthUser(null);
    closeAuthModal();
    toast('Signed out from Google account.');
    render();
    return;
  }"""

new_auth_clicks = """  if (t.id === 'header-auth-btn' || t.id === 'header-user-btn' || t.dataset.openAuth !== undefined) { openAuthModal(); return; }
  if (t.dataset.closeAuth !== undefined) { closeAuthModal(); return; }
  if (t.id === 'btn-auth-google') { signInWithGoogle(); return; }
  if (t.id === 'link-to-register') { switchAuthModalView('auth-register-view'); return; }
  if (t.id === 'link-to-signin' || t.id === 'link-verify-to-signin' || t.id === 'link-forgot-to-signin') { switchAuthModalView('auth-signin-view'); return; }
  if (t.id === 'link-to-forgot') { switchAuthModalView('auth-forgot-view'); return; }
  if (t.id === 'btn-check-verified') { checkEmailVerified(); return; }
  if (t.id === 'btn-resend-verification' || t.id === 'btn-profile-resend-verify') { resendVerificationEmail(); return; }
  if (t.id === 'btn-switch-handle') { closeAuthModal(); const _p = getUserProfile();
    $('player-handle-input').value = _p.handle;
    if ($('player-town-input')) $('player-town-input').value = _p.town || 'Paisley';
    if ($('player-region-input')) $('player-region-input').value = _p.region || 'Renfrewshire';
    if ($('player-country-input')) $('player-country-input').value = _p.country || 'Scotland';
    $('handle-modal').hidden = false; return; }
  if (t.id === 'btn-signout' || t.id === 'btn-google-signout') {
    handleSignOut();
    return;
  }
  if (t.id === 'btn-auth-open-gdpr') { $('gdpr-modal').hidden = false; return; }"""

if old_auth_clicks in content:
    content = content.replace(old_auth_clicks, new_auth_clicks)
    print("Replaced old_auth_clicks")
else:
    print("Warning: old_auth_clicks not found")

# Replace kick & delete click handling
old_kd = """  else if (t.dataset.kickPlayer !== undefined) {
    kickPlayerFromLeague(t.dataset.leagueCode, t.dataset.kickPlayer);
  }
  else if (t.dataset.deleteLeague !== undefined) {
    deleteLeague(t.dataset.deleteLeague, t.dataset.leagueCode);
  }"""

new_kd = """  else if (t.dataset.kickPlayer !== undefined) {
    kickPlayerFromLeague(t.dataset.leagueCode, t.dataset.kickUid, t.dataset.kickPlayer);
  }
  else if (t.dataset.deleteLeague !== undefined) {
    deleteLeague(t.dataset.deleteLeague, t.dataset.leagueCode);
  }
  else if (t.dataset.leaveLeague !== undefined) {
    leaveLeague(t.dataset.leaveLeague, t.dataset.leagueCode);
  }"""

if old_kd in content:
    content = content.replace(old_kd, new_kd)
    print("Replaced kick/delete clicks")
else:
    print("Warning: old_kd not found")

# Replace Submit events
old_submit_start = "if (event.target.id === 'create-league-form') {"
submit_start_idx = content.find(old_submit_start)

old_submit_end = "if (event.target.id === 'handle-form') {"
submit_mid_idx = content.find(old_submit_end)

old_fb_form = "else if (event.target.id === 'fb-form') handleFeedbackSubmit(event);"
fb_form_idx = content.find(old_fb_form)

if submit_start_idx != -1 and fb_form_idx != -1:
    # We replace from create-league-form through handle-form
    new_submits = """  if (event.target.id === 'auth-signin-form') {
    event.preventDefault();
    handleSignInWithEmail($('signin-email').value.trim(), $('signin-password').value);
    return;
  }
  if (event.target.id === 'auth-register-form') {
    event.preventDefault();
    handleRegisterWithEmail(
      $('register-handle').value.trim(),
      $('register-email').value.trim(),
      $('register-password').value,
      $('register-age-check').checked
    );
    return;
  }
  if (event.target.id === 'auth-forgot-form') {
    event.preventDefault();
    handleForgotPassword($('forgot-email').value.trim());
    return;
  }
  if (event.target.id === 'profile-change-password-form') {
    event.preventDefault();
    handleChangePassword($('change-current-pass').value, $('change-new-pass').value);
    return;
  }
  if (event.target.id === 'create-league-form') {
    event.preventDefault();
    const user = getAuthUser();
    if (!user || !user.signedIn) {
      toast('Please sign in or create an account to start a private league.');
      openAuthModal();
      return;
    }
    if (!user.emailVerified) {
      toast('Please verify your email address before creating a league.');
      openAuthModal();
      return;
    }
    const name = ($('new-league-name').value || '').trim() || 'My Friends League';
    const icon = ($('new-league-icon') && $('new-league-icon').value) || '⚽';
    const freq = ($('new-league-freq') && $('new-league-freq').value) || 'weekly';
    const code = generateSecureLeagueCode();
    const prof = getUserProfile();
    const newLeague = {
      id: 'league-' + Date.now(),
      name,
      icon,
      freq,
      code,
      creatorUid: user.uid,
      creatorHandle: prof.handle,
      created_at: new Date().toISOString().slice(0, 10),
      is_joined: false,
      members: []
    };
    const list = getStoredLeagues();
    list.unshift(newLeague);
    saveStoredLeagues(list);
    activeLeagueId = newLeague.id;
    syncLeagueToCloud(newLeague);
    listenToActiveLeague(code);
    $('league-modal').hidden = true;
    toast('League ' + icon + ' ' + name + ' created! Share code ' + code);
    render();
    return;
  }
  if (event.target.id === 'join-league-form') {
    event.preventDefault();
    const code = ($('join-league-code').value || '').trim().toUpperCase();
    if (!code) return;
    $('league-modal').hidden = true;
    toast('Joining league ' + code + '...');
    joinCloudLeague(code);
    return;
  }
  if (event.target.id === 'commercial-enquiry-form') {
    event.preventDefault();
    const name = ($('comm-name').value || '').trim();
    const company = ($('comm-company').value || '').trim();
    const email = ($('comm-email').value || '').trim();
    const interest = $('comm-interest').value;
    const message = ($('comm-message').value || '').trim();
    if (!name || !email || !message) {
      toast('Please complete name, email, and message fields.');
      return;
    }

    const enquiries = getStoredEnquiries();
    enquiries.unshift({
      id: 'comm-' + Date.now(),
      name, company, email, interest, message,
      submitted_at: new Date().toISOString()
    });
    try { localStorage.setItem(COMMERCIAL_STORAGE_KEY, JSON.stringify(enquiries)); } catch (e) {}

    const subject = encodeURIComponent('Bet Buddy Commercial Partnership: ' + (company || name));
    const body = encodeURIComponent(
      'Hi Martin and Chris,\\n\\n' +
      'Commercial Partnership Details:\\n' +
      'Name: ' + name + '\\n' +
      'Company: ' + company + '\\n' +
      'Email: ' + email + '\\n' +
      'Interest Category: ' + interest + '\\n\\n' +
      'Message / Proposal:\\n' + message + '\\n\\n' +
      'Sent via Bet Buddy Commercial Portal.'
    );
    window.open('mailto:octopigardens@gmail.com?subject=' + subject + '&body=' + body, '_blank');

    const statusBox = $('comm-status-msg');
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.innerHTML = '<b>Enquiry Logged!</b> Thank you ' + esc(name) + '. Your proposal has been dispatched to founders Martin White &amp; Chris Faulds (octopigardens@gmail.com). We will reply within 24 hours.';
    }
    toast('Commercial enquiry submitted! Opening email to octopigardens@gmail.com...');
    $('commercial-enquiry-form').reset();
    return;
  }

  if (event.target.id === 'bug-form') {
    event.preventDefault();
    const type = $('bug-type-select').value;
    const desc = ($('bug-desc-input').value || '').trim();
    const contact = ($('bug-contact-input').value || '').trim();
    if (!desc) return;
    saveBugReport({ type, desc, contact });

    const subject = encodeURIComponent('Bet Buddy Bug Report: ' + type.toUpperCase());
    const body = encodeURIComponent(
      'Hi Martin and Chris,\\n\\n' +
      'Bug Report / Suggestion Details:\\n' +
      'Category: ' + type + '\\n' +
      'Contact: ' + (contact || 'Anonymous') + '\\n\\n' +
      'Description:\\n' + desc + '\\n\\n' +
      'Device/App Details:\\n' +
      'Platform: ' + navigator.userAgent + '\\n' +
      'URL: ' + location.href + '\\n\\n' +
      'Sent via Bet Buddy Bug Reporter.'
    );
    window.open('mailto:octopigardens@gmail.com?subject=' + subject + '&body=' + body, '_blank');

    $('bug-form').reset();
    $('bug-modal').hidden = true;
    toast('Thanks! Opening email to send bug report to Martin and Chris...');
    render();
    return;
  }
  if (event.target.id === 'handle-form') {
    event.preventDefault();
    const handle = ($('player-handle-input').value || '').trim();
    const town = $('player-town-input') ? $('player-town-input').value.trim() : 'Paisley';
    const region = $('player-region-input') ? $('player-region-input').value.trim() : 'Renfrewshire';
    const country = $('player-country-input') ? $('player-country-input').value.trim() : 'Scotland';

    if (!isValidHandle(handle)) {
      toast('Gamertag must be 3–20 characters (letters, numbers, underscores only).');
      return;
    }

    const user = getAuthUser();
    if (user && user.signedIn && firestoreDb) {
      toast('Updating gamertag...');
      claimHandleTransaction(user.uid, handle, getUserProfile().avatar || '⚽').then(() => {
        saveUserProfile(handle, town, region, country);
        $('handle-modal').hidden = true;
        toast('Gamertag and location updated! ⚽');
        getStoredLeagues().forEach(l => syncLeagueToCloud(l));
        render();
      }).catch(err => {
        toast(err.message || 'Error updating gamertag.');
      });
      return;
    }

    saveUserProfile(handle, town, region, country);
    $('handle-modal').hidden = true;
    toast('Profile and Regional Leagues updated!');
    getStoredLeagues().forEach(l => syncLeagueToCloud(l));
    render();
    return;
  }
  """
    content = content[:submit_start_idx] + new_submits + content[fb_form_idx:]
    print("Replaced submit handlers successfully")
else:
    print(f"Warning: submit handlers markers not matched: submit_start_idx={submit_start_idx}, fb_form_idx={fb_form_idx}")

# Also replace startup fetchCloudDataRest call
old_startup = """loadData().then(() => {
  fetchCloudDataRest();
  render();
});"""

new_startup = """loadData().then(() => {
  render();
});
initFirebaseAuth();"""

if old_startup in content:
    content = content.replace(old_startup, new_startup)
    print("Replaced old_startup with initFirebaseAuth")
else:
    print("Warning: old_startup not found")

# Also add diary sync to saveStoredDiary
old_save_diary = """function saveStoredDiary(entries) {
  if (diaryReadFailed) throw new Error('Bet Diary read failed; refusing to overwrite existing data.');
  calc.saveBetDiary(localStorage, DIARY_STORAGE_KEY, entries);
  updateDiaryCount();
  try {
    if (typeof syncLeagueToCloud === 'function') {
      getStoredLeagues().forEach(l => syncLeagueToCloud(l));
    }
  } catch (e) {}
}"""

new_save_diary = """function saveStoredDiary(entries) {
  if (diaryReadFailed) throw new Error('Bet Diary read failed; refusing to overwrite existing data.');
  calc.saveBetDiary(localStorage, DIARY_STORAGE_KEY, entries);
  updateDiaryCount();
  try {
    if (typeof syncLeagueToCloud === 'function') {
      getStoredLeagues().forEach(l => syncLeagueToCloud(l));
    }
    if (typeof syncDiaryToCloud === 'function') {
      syncDiaryToCloud();
    }
  } catch (e) {}
}"""

if old_save_diary in content:
    content = content.replace(old_save_diary, new_save_diary)
    print("Replaced saveStoredDiary with diary sync")
else:
    print("Warning: old_save_diary not found")

APP_JS.write_text(content, encoding="utf-8")
print("Finished writing updated app.js")
