with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

target = "    const memberId = 'mem-form-' + idx;\n\n    return '<tr class=\"lb-row' + (m.isYou ? ' user-row' : '') + '\">' +"
replacement = """    const memberId = 'mem-form-' + idx;
    const kickCell = isLeagueCreator ? (
      m.isYou
        ? '<td class="lb-col-action"><span class="bento-badge cyan text-xs">Host</span></td>'
        : '<td class="lb-col-action"><button type="button" class="kick-player-btn" data-kick-player="' + esc(m.handle) + '" data-league-code="' + esc(currentLeague.code) + '" title="Throw @' + esc(m.handle) + ' out of this league">Kick ✕</button></td>'
    ) : '';

    return '<tr class="lb-row' + (m.isYou ? ' user-row' : '') + '">' +"""

target2 = "      '<td class=\"lb-col-bets num mono\">' + m.settled + '</td>' +\n    '</tr>';"
replacement2 = """      '<td class="lb-col-bets num mono">' + m.settled + '</td>' +
      kickCell +
    '</tr>';"""

if target in js and target2 in js:
    js = js.replace(target, replacement, 1)
    js = js.replace(target2, replacement2, 1)
    print('Updated kickCell in rowsHtml')
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(js)
else:
    print('Target not matched')

