# patch_v38_master_fixes.py
with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Add renameLeague function and direct cloud refresh functions
new_functions = """
async function renameLeague(code) {
  const list = getStoredLeagues();
  const target = list.find(l => l.code === code);
  const currentName = target ? (typeof target.name === 'function' ? target.name() : target.name) : 'Buddy League';
  const newName = prompt('Enter new name for your league:', currentName);
  if (!newName || !newName.trim()) return;
  const cleanName = newName.trim();
  if (target) {
    target.name = cleanName;
    saveStoredLeagues(list);
  }
  if (firestoreDb && code) {
    try {
      await firestoreDb.collection('leagues').doc(code).set({ name: cleanName }, { merge: true });
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
  try {
    const snap = await firestoreDb.collection('leagues').doc(code).get();
    if (snap.exists) {
      const data = snap.data();
      const list = getStoredLeagues();
      const target = list.find(l => l.code === code);
      if (target && data.members) {
        const prof = getUserProfile();
        target.members = Object.values(data.members).filter(m => m.handle !== prof.handle);
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
"""

if 'async function renameLeague' not in js:
    js = js.replace('async function kickPlayerFromLeague', new_functions + '\nasync function kickPlayerFromLeague', 1)
    print('Added renameLeague and direct cloud refresh functions')

# 2. Fix listenToActiveLeague: remove false kick check and always render
old_listener_body = """        const prof = getUserProfile();
        if (data.members) {
          if (target.is_joined && !data.members[prof.handle]) {
            const updated = list.filter(l => l.code !== code);
            saveStoredLeagues(updated);
            if (activeLeagueId === target.id) {
              activeLeagueId = 'default';
              toast('You have been removed from ' + (target.name || 'this league') + '.');
              render();
            }
            return;
          }
          target.members = Object.values(data.members).filter(m => m.handle !== prof.handle);
        }
        saveStoredLeagues(list);
        if (activeLeagueId === target.id) {
          render();
        }"""

new_listener_body = """        const prof = getUserProfile();
        if (data.members) {
          target.members = Object.values(data.members).filter(m => m.handle !== prof.handle);
        }
        saveStoredLeagues(list);
        render();"""

if old_listener_body in js:
    js = js.replace(old_listener_body, new_listener_body, 1)
    print('Cleaned listener body: removed false kick check and ensure render()')
else:
    print('old_listener_body not matched')

# 3. In viewLeagues(), call direct refresh and ensure all members map
old_members_code = """  if (isGeo) {
    const geoDocId = getGeoDocId(currentLeague.id, prof);
    listenToActiveGeoLeague(geoDocId);
    const realGeoMembers = getStoredGeoMembers(geoDocId).filter(m => m.handle !== prof.handle);
    const bots = (currentLeague.competitors || []).filter(b => !realGeoMembers.some(r => r.handle === b.handle));
    allMembers = [...realGeoMembers, userEntry, ...bots];
  } else {
    allMembers = (currentLeague.members || []).slice();
    allMembers.push(userEntry);
  }"""

new_members_code = """  if (isGeo) {
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

if old_members_code in js:
    js = js.replace(old_members_code, new_members_code, 1)
    print('Updated allMembers with memberMap and direct cloud refresh in viewLeagues')
else:
    print('old_members_code not matched')

# 4. Make Rename and Delete buttons unconditionally visible in Buddy League card header
old_card_head = """          <div>
            <h2 class=\"section-title\">' + (typeof currentLeague.name === 'function' ? currentLeague.name() : currentLeague.name) + '</h2>
            <span class=\"section-note\">Trophy at Stake: <b>' + trophyIcon + ' ' + trophyTitle + '</b> · Top 3 win Gold, Silver &amp; Bronze · <b style=\"color:var(--cyan)\">Max 1 bet/day</b></span>
          </div>
          <div style=\"display:flex;gap:10px;align-items:center;flex-wrap:wrap\">
            <div class=\"frequency-toggle-bar\">
              <button type=\"button\" class=\"freq-btn' + (activeLeagueFreq === 'weekly' ? ' active' : '') + '\" data-league-freq=\"weekly\">Weekly</button>
              <button type=\"button\" class=\"freq-btn' + (activeLeagueFreq === 'monthly' ? ' active' : '') + '\" data-league-freq=\"monthly\">Monthly</button>
              <button type=\"button\" class=\"freq-btn' + (activeLeagueFreq === 'yearly' ? ' active' : '') + '\" data-league-freq=\"yearly\">Yearly</button>
            </div>
            <button type=\"button\" class=\"btn small\" data-share-league=\"' + esc(currentLeague.code) + '\">Invite Friends</button>
            (isLeagueCreator ? '<button type=\"button\" class=\"btn danger small\" data-delete-league=\"' + esc(currentLeague.id) + '\" data-league-code=\"' + esc(currentLeague.code) + '\" title=\"Permanently delete this league\">Delete League 🗑️</button>' : '')
          </div>"""

# Let's use direct string search for card head
target_head = """          <div>' +
            '<h2 class="section-title">' + (typeof currentLeague.name === 'function' ? currentLeague.name() : currentLeague.name) + '</h2>' +
            '<span class="section-note">Trophy at Stake: <b>' + trophyIcon + ' ' + trophyTitle + '</b> · Top 3 win Gold, Silver &amp; Bronze · <b style="color:var(--cyan)">Max 1 bet/day</b></span>' +
          '</div>' +
          '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
            '<div class="frequency-toggle-bar">' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'weekly' ? ' active' : '') + '" data-league-freq="weekly">Weekly</button>' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'monthly' ? ' active' : '') + '" data-league-freq="monthly">Monthly</button>' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'yearly' ? ' active' : '') + '" data-league-freq="yearly">Yearly</button>' +
            '</div>' +
            '<button type="button" class="btn small" data-share-league="' + esc(currentLeague.code) + '">Invite Friends</button>' +
            (isLeagueCreator ? '<button type="button" class="btn danger small" data-delete-league="' + esc(currentLeague.id) + '" data-league-code="' + esc(currentLeague.code) + '" title="Permanently delete this league">Delete League 🗑️</button>' : '') +
          '</div>'"""

replacement_head = """          <div>' +
            '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
              '<h2 class="section-title" style="margin:0">' + (typeof currentLeague.name === 'function' ? currentLeague.name() : currentLeague.name) + '</h2>' +
              '<button type="button" class="btn small" data-rename-league="' + esc(currentLeague.code) + '" title="Rename this league" style="padding:3px 10px;font-size:12px;">✏️ Rename</button>' +
            '</div>' +
            '<span class="section-note">Trophy at Stake: <b>' + trophyIcon + ' ' + trophyTitle + '</b> · Top 3 win Gold, Silver &amp; Bronze · <b style="color:var(--cyan)">Max 1 bet/day</b></span>' +
          '</div>' +
          '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
            '<div class="frequency-toggle-bar">' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'weekly' ? ' active' : '') + '" data-league-freq="weekly">Weekly</button>' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'monthly' ? ' active' : '') + '" data-league-freq="monthly">Monthly</button>' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'yearly' ? ' active' : '') + '" data-league-freq="yearly">Yearly</button>' +
            '</div>' +
            '<button type="button" class="btn small" data-share-league="' + esc(currentLeague.code) + '">Invite Friends</button>' +
            '<button type="button" class="btn danger small" data-delete-league="' + esc(currentLeague.id) + '" data-league-code="' + esc(currentLeague.code) + '" title="Delete this league">Delete League 🗑️</button>' +
          '</div>'"""

if target_head in js:
    js = js.replace(target_head, replacement_head, 1)
    print('Updated Buddy League card header with Rename and Delete buttons')
else:
    print('target_head not matched')

# 5. Always show Manage column and Kick button
old_manage_th = """(isLeagueCreator ? '<th class="lb-col-action">Manage</th>' : '')"""
new_manage_th = """'<th class="lb-col-action">Manage</th>'"""
if old_manage_th in js:
    js = js.replace(old_manage_th, new_manage_th, 1)
    print('Made Manage column header unconditionally visible')

old_kick_cell = """    const kickCell = isLeagueCreator ? (
      m.isYou
        ? '<td class="lb-col-action"><span class="bento-badge cyan text-xs">Host</span></td>'
        : '<td class="lb-col-action"><button type="button" class="kick-player-btn" data-kick-player="' + esc(m.handle) + '" data-league-code="' + esc(currentLeague.code) + '" title="Throw @' + esc(m.handle) + ' out of this league">Kick ✕</button></td>'
    ) : '';"""

new_kick_cell = """    const kickCell = m.isYou
      ? '<td class="lb-col-action"><span class="bento-badge cyan text-xs">You</span></td>'
      : '<td class="lb-col-action"><button type="button" class="kick-player-btn" data-kick-player="' + esc(m.handle) + '" data-league-code="' + esc(currentLeague.code) + '" title="Throw @' + esc(m.handle) + ' out of this league">Kick ✕</button></td>';"""

if old_kick_cell in js:
    js = js.replace(old_kick_cell, new_kick_cell, 1)
    print('Updated kickCell to be unconditionally available')

# 6. Add click handler for data-rename-league
old_click_handler = """  else if (t.dataset.kickPlayer !== undefined) {"""
new_click_handler = """  else if (t.dataset.renameLeague !== undefined) {
    renameLeague(t.dataset.renameLeague);
  }
  else if (t.dataset.kickPlayer !== undefined) {"""

if old_click_handler in js and 't.dataset.renameLeague' not in js:
    js = js.replace(old_click_handler, new_click_handler, 1)
    print('Added click handler for data-rename-league')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)
