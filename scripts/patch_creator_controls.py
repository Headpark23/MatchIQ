import re

# 1. Patch styles.css for kick-player-btn and lb-col-action
with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

lb_styles = """
/* League Creator Controls */
.lb-col-action { width: 70px; text-align: center; }
.kick-player-btn {
  padding: 3px 8px; font-size: 11px; min-height: 24px; border-radius: 6px;
  background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5; cursor: pointer; transition: all .15s ease;
}
.kick-player-btn:hover {
  background: #ef4444; color: #fff; border-color: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
}
"""

if '.kick-player-btn' not in css:
    css += '\n' + lb_styles
    with open('styles.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print('Added league creator styles to styles.css')


# 2. Patch app.js
with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Add kickPlayerFromLeague and deleteLeague functions
helper_funcs = """
async function kickPlayerFromLeague(leagueCode, handle) {
  if (!confirm('Are you sure you want to throw @' + handle + ' out of this league?')) return;
  toast('Removing @' + handle + '...');

  const list = getStoredLeagues();
  const target = list.find(l => l.code === leagueCode);
  if (target && target.members) {
    target.members = target.members.filter(m => m.handle !== handle);
    saveStoredLeagues(list);
  }

  if (firestoreDb && leagueCode) {
    try {
      const fieldPath = 'members.' + handle;
      const FieldValue = firebase.firestore.FieldValue;
      await firestoreDb.collection('leagues').doc(leagueCode).update({
        [fieldPath]: FieldValue.delete()
      });
      toast('@' + handle + ' thrown out of league.');
    } catch (e) {
      console.warn('Kick error:', e);
      toast('@' + handle + ' removed.');
    }
  }
  render();
}

async function deleteLeague(leagueId, leagueCode) {
  const list = getStoredLeagues();
  const target = list.find(l => l.id === leagueId || l.code === leagueCode);
  const name = target ? (typeof target.name === 'function' ? target.name() : target.name) : 'this league';
  if (!confirm('Are you sure you want to permanently delete ' + name + '?\\nThis will remove the league for all members.')) return;

  toast('Deleting league...');

  if (firestoreDb && leagueCode) {
    try {
      await firestoreDb.collection('leagues').doc(leagueCode).delete();
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
"""

if 'async function kickPlayerFromLeague' not in js:
    js = js.replace('function syncLeagueToCloud(league) {', helper_funcs + '\nfunction syncLeagueToCloud(league) {', 1)
    print('Added kickPlayerFromLeague and deleteLeague functions to app.js')

# Update createLeague in create-league-form submit to set creator_handle
old_new_league = """    const newLeague = {
      id: 'league-' + Date.now(),
      name,
      icon,
      freq,
      code,
      created_at: new Date().toISOString().slice(0, 10),
      members: []
    };"""

new_new_league = """    const prof = getUserProfile();
    const newLeague = {
      id: 'league-' + Date.now(),
      name,
      icon,
      freq,
      code,
      creator_handle: prof.handle,
      created_at: new Date().toISOString().slice(0, 10),
      members: []
    };"""

if old_new_league in js:
    js = js.replace(old_new_league, new_new_league, 1)
    print('Updated create-league-form to record creator_handle in app.js')

# Update syncLeagueToCloud to include creator_handle in Firestore doc
old_sync_cloud = """  firestoreDb.collection('leagues').doc(league.code).set({
    name: league.name,
    icon: league.icon || '🏆',
    freq: league.freq || 'weekly',
    code: league.code,
    created_at: league.created_at || new Date().toISOString().slice(0, 10),
    members: {
      [prof.handle]: userEntry
    }
  }, { merge: true }).catch(err => console.warn('Cloud league sync notice:', err));"""

new_sync_cloud = """  const isLeagueCreator = !league.is_joined && (!league.creator_handle || league.creator_handle === prof.handle);
  const creatorHandle = league.creator_handle || (isLeagueCreator ? prof.handle : null);
  if (isLeagueCreator && !league.creator_handle) {
    league.creator_handle = prof.handle;
  }
  const cloudData = {
    name: league.name,
    icon: league.icon || '🏆',
    freq: league.freq || 'weekly',
    code: league.code,
    created_at: league.created_at || new Date().toISOString().slice(0, 10),
    members: {
      [prof.handle]: userEntry
    }
  };
  if (creatorHandle) cloudData.creator_handle = creatorHandle;
  firestoreDb.collection('leagues').doc(league.code).set(cloudData, { merge: true }).catch(err => console.warn('Cloud league sync notice:', err));"""

if old_sync_cloud in js:
    js = js.replace(old_sync_cloud, new_sync_cloud, 1)
    print('Updated syncLeagueToCloud with creator_handle in app.js')

# Update listenToActiveLeague for doc deletion or kicked player removal
old_listener = """    activeLeagueUnsubscribe = firestoreDb.collection('leagues').doc(code).onSnapshot(doc => {
      if (!doc || !doc.exists) return;
      const data = doc.data();
      const list = getStoredLeagues();
      const target = list.find(l => l.code === code);
      if (target) {
        if (data.name) target.name = data.name;
        if (data.icon) target.icon = data.icon;
        if (data.members) {
          const prof = getUserProfile();
          // Store remote members (excluding current user to avoid duplicate)
          target.members = Object.values(data.members).filter(m => m.handle !== prof.handle);
        }
        saveStoredLeagues(list);
        if (activeLeagueId === target.id) {
          render();
        }
      }
    }, err => console.warn('League listener notice:', err));"""

new_listener = """    activeLeagueUnsubscribe = firestoreDb.collection('leagues').doc(code).onSnapshot(doc => {
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
        if (data.name) target.name = data.name;
        if (data.icon) target.icon = data.icon;
        if (data.creator_handle) target.creator_handle = data.creator_handle;
        const prof = getUserProfile();
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
        }
      }
    }, err => console.warn('League listener notice:', err));"""

if old_listener in js:
    js = js.replace(old_listener, new_listener, 1)
    print('Updated listenToActiveLeague in app.js')

# Update renderLeagues to determine isCreator and add kick/delete controls
old_render_lb_prep = """  // Find active league
  let currentLeague = customLeagues.find(l => l.id === activeLeagueId);
  let isGeo = false;
  if (!currentLeague) {
    currentLeague = geoTiers.find(g => g.id === activeLeagueId);
    if (currentLeague) isGeo = true;
  }
  if (!currentLeague) {
    if (customLeagues.length) {
      currentLeague = customLeagues[0];
      activeLeagueId = currentLeague.id;
      isGeo = false;
    } else {
      currentLeague = geoTiers[0];
      activeLeagueId = currentLeague.id;
      isGeo = true;
    }
  }
  if (!isGeo && currentLeague && currentLeague.code) {
    syncLeagueToCloud(currentLeague);
    listenToActiveLeague(currentLeague.code);
  }"""

new_render_lb_prep = """  // Find active league
  let currentLeague = customLeagues.find(l => l.id === activeLeagueId);
  let isGeo = false;
  if (!currentLeague) {
    currentLeague = geoTiers.find(g => g.id === activeLeagueId);
    if (currentLeague) isGeo = true;
  }
  if (!currentLeague) {
    if (customLeagues.length) {
      currentLeague = customLeagues[0];
      activeLeagueId = currentLeague.id;
      isGeo = false;
    } else {
      currentLeague = geoTiers[0];
      activeLeagueId = currentLeague.id;
      isGeo = true;
    }
  }
  const isLeagueCreator = !isGeo && currentLeague && !currentLeague.is_joined && (!currentLeague.creator_handle || currentLeague.creator_handle === prof.handle);

  if (!isGeo && currentLeague && currentLeague.code) {
    syncLeagueToCloud(currentLeague);
    listenToActiveLeague(currentLeague.code);
  }"""

if old_render_lb_prep in js:
    js = js.replace(old_render_lb_prep, new_render_lb_prep, 1)
    print('Added isLeagueCreator check to renderLeagues in app.js')

# Update rowsHtml in renderLeagues to add action column for kick
old_row_html = """    return '<tr class="lb-row' + (m.isYou ? ' user-row' : '') + '">' +
      '<td class="lb-col-rank"><span class="rank-badge ' + rankClass + '">' + rankIcon + '</span></td>' +
      '<td class="lb-col-player">' +
        '<button type="button" class="lb-player-btn" onclick="toggleMemberForm(\\'' + memberId + '\\')" title="Click to view recent form">' +
          '<b class="lb-handle">' + esc(m.handle) + '</b>' +
          (m.isYou ? ' <span class="bento-badge emerald lb-you-tag">YOU</span>' : '') +
          '<span class="lb-form-indicator" title="Form: ' + esc(formStr) + '">📈</span>' +
        '</button>' +
        '<div id="' + memberId + '" class="lb-member-form-drawer" hidden>' +
          '<div class="lb-drawer-inner"><span class="lb-drawer-label">Form:</span><div class="form-chips">' + formChips + '</div></div>' +
        '</div>' +
      '</td>' +
      '<td class="lb-col-pts"><b class="lb-pts-val">' + m.points + '</b></td>' +
      '<td class="lb-col-win"><span class="win-pct-pill">' + m.winRate + '%</span></td>' +
      '<td class="lb-col-roi"><span class="roi-pct-pill ' + roiClass + '">' + roiSign + m.roi + '%</span></td>' +
      '<td class="lb-col-bets num mono">' + m.settled + '</td>' +
    '</tr>';"""

new_row_html = """    const kickCell = isLeagueCreator ? (
      m.isYou
        ? '<td class="lb-col-action"><span class="bento-badge cyan text-xs">Host</span></td>'
        : '<td class="lb-col-action"><button type="button" class="kick-player-btn" data-kick-player="' + esc(m.handle) + '" data-league-code="' + esc(currentLeague.code) + '" title="Throw @' + esc(m.handle) + ' out of this league">Kick ✕</button></td>'
    ) : '';

    return '<tr class="lb-row' + (m.isYou ? ' user-row' : '') + '">' +
      '<td class="lb-col-rank"><span class="rank-badge ' + rankClass + '">' + rankIcon + '</span></td>' +
      '<td class="lb-col-player">' +
        '<button type="button" class="lb-player-btn" onclick="toggleMemberForm(\\'' + memberId + '\\')" title="Click to view recent form">' +
          '<b class="lb-handle">' + esc(m.handle) + '</b>' +
          (m.isYou ? ' <span class="bento-badge emerald lb-you-tag">YOU</span>' : '') +
          '<span class="lb-form-indicator" title="Form: ' + esc(formStr) + '">📈</span>' +
        '</button>' +
        '<div id="' + memberId + '" class="lb-member-form-drawer" hidden>' +
          '<div class="lb-drawer-inner"><span class="lb-drawer-label">Form:</span><div class="form-chips">' + formChips + '</div></div>' +
        '</div>' +
      '</td>' +
      '<td class="lb-col-pts"><b class="lb-pts-val">' + m.points + '</b></td>' +
      '<td class="lb-col-win"><span class="win-pct-pill">' + m.winRate + '%</span></td>' +
      '<td class="lb-col-roi"><span class="roi-pct-pill ' + roiClass + '">' + roiSign + m.roi + '%</span></td>' +
      '<td class="lb-col-bets num mono">' + m.settled + '</td>' +
      kickCell +
    '</tr>';"""

if old_row_html in js:
    js = js.replace(old_row_html, new_row_html, 1)
    print('Updated row rendering with kickCell in app.js')

# Update buddy league table header and delete league button
old_buddy_table = """          '<div style="display:flex;gap:10px;align-items:center">' +
            '<div class="frequency-toggle-bar">' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'weekly' ? ' active' : '') + '" data-league-freq="weekly">Weekly</button>' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'monthly' ? ' active' : '') + '" data-league-freq="monthly">Monthly</button>' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'yearly' ? ' active' : '') + '" data-league-freq="yearly">Yearly</button>' +
            '</div>' +
            '<button type="button" class="btn small" data-share-league="' + esc(currentLeague.code) + '">Invite Friends</button>' +
          '</div>' +
        '</div>' +
        '<div class="lb-table-wrap"><table class="lb-table compact-lb"><thead><tr>' +
          '<th class="lb-col-rank">#</th>' +
          '<th class="lb-col-player">Player (Form)</th>' +
          '<th class="lb-col-pts" style="color:var(--cyan)">Points</th>' +
          '<th class="lb-col-win">Win %</th>' +
          '<th class="lb-col-roi">ROI %</th>' +
          '<th class="lb-col-bets num">Bets</th>' +
        '</tr></thead><tbody>'"""

new_buddy_table = """          '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
            '<div class="frequency-toggle-bar">' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'weekly' ? ' active' : '') + '" data-league-freq="weekly">Weekly</button>' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'monthly' ? ' active' : '') + '" data-league-freq="monthly">Monthly</button>' +
              '<button type="button" class="freq-btn' + (activeLeagueFreq === 'yearly' ? ' active' : '') + '" data-league-freq="yearly">Yearly</button>' +
            '</div>' +
            '<button type="button" class="btn small" data-share-league="' + esc(currentLeague.code) + '">Invite Friends</button>' +
            (isLeagueCreator ? '<button type="button" class="btn danger small" data-delete-league="' + esc(currentLeague.id) + '" data-league-code="' + esc(currentLeague.code) + '" title="Permanently delete this league">Delete League 🗑️</button>' : '') +
          '</div>' +
        '</div>' +
        '<div class="lb-table-wrap"><table class="lb-table compact-lb"><thead><tr>' +
          '<th class="lb-col-rank">#</th>' +
          '<th class="lb-col-player">Player (Form)</th>' +
          '<th class="lb-col-pts" style="color:var(--cyan)">Points</th>' +
          '<th class="lb-col-win">Win %</th>' +
          '<th class="lb-col-roi">ROI %</th>' +
          '<th class="lb-col-bets num">Bets</th>' +
          (isLeagueCreator ? '<th class="lb-col-action">Manage</th>' : '') +
        '</tr></thead><tbody>'"""

if old_buddy_table in js:
    js = js.replace(old_buddy_table, new_buddy_table, 1)
    print('Updated buddy league table header and delete league button in app.js')

# Add click handlers for data-delete-league and data-kick-player
click_route = """  else if (t.dataset.shareLeague !== undefined) {"""
new_click_routes = """  else if (t.dataset.kickPlayer !== undefined) {
    kickPlayerFromLeague(t.dataset.leagueCode, t.dataset.kickPlayer);
  }
  else if (t.dataset.deleteLeague !== undefined) {
    deleteLeague(t.dataset.deleteLeague, t.dataset.leagueCode);
  }
  else if (t.dataset.shareLeague !== undefined) {"""

if click_route in js and 'data-kick-player' not in js:
    js = js.replace(click_route, new_click_routes, 1)
    print('Added click handlers for kickPlayer and deleteLeague in app.js')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)
