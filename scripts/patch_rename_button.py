with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

target = """        '<div style="padding:16px 20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
          '<div>' +
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
          '</div>' +"""

replacement = """        '<div style="padding:16px 20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
          '<div>' +
            '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
              '<h2 class="section-title" style="margin:0">' + (typeof currentLeague.name === 'function' ? currentLeague.name() : currentLeague.name) + '</h2>' +
              '<button type="button" class="btn small" data-rename-league="' + esc(currentLeague.code) + '" title="Rename this league" style="padding:2px 8px;font-size:11px;">✏️ Rename</button>' +
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
          '</div>' +"""

if target in js:
    js = js.replace(target, replacement, 1)
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print('SUCCESS: Updated Buddy League header with Rename and Delete buttons')
else:
    print('Target not matched')
