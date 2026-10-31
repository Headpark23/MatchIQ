with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix line 940
text = text.replace("getButlerLaunchUrl(\\'custom\\')", "getButlerLaunchUrl('custom')")
text = text.replace("prepareButlerLaunch(\\'custom\\')", "prepareButlerLaunch('custom')")

# Fix line 529
bad_line_529 = '\'<a href="\' + esc(getButlerLaunchSingleUrl({ id: ctx.id, market: meta.diary, selection: selText, p: row.p, fair: row.fair })) + \'" class="btn-place-bet-inline butler-btn" onclick="prepareButlerSingleLaunch(\\\'\' + jsonStr + \'\\\')\"\' + jsonStr + \'\\\' title="Open in bookmaker app/site">Place Bet</button>\';'
good_line_529 = '\'<a href="\' + esc(getButlerLaunchSingleUrl({ id: ctx.id, market: meta.diary, selection: selText, p: row.p, fair: row.fair })) + \'" class="btn-place-bet-inline butler-btn" onclick="prepareButlerSingleLaunch(this.dataset.betData)" data-bet-data=\\\'\' + jsonStr + \'\\\' title="Open in your bookmaker app">⚡ Place at <span class="current-butler-name">\' + esc(getButlerBookmaker().name) + \'</span> ↗</a>\';'

if bad_line_529 in text:
    text = text.replace(bad_line_529, good_line_529)
    print("Fixed line 529.")
else:
    # Try regex replacement for line 529
    import re
    text = re.sub(
        r"'<a href=\"'\s*\+\s*esc\(getButlerLaunchSingleUrl\([^)]+\)\)\s*\+\s*'\" class=\"btn-place-bet-inline butler-btn\" onclick=\"prepareButlerSingleLaunch\(\\'\s*'\s*\+\s*jsonStr\s*\+\s*'\\'\)\"'[^;]+;",
        good_line_529,
        text
    )
    print("Replaced line 529 with regex.")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("Finished fixing quotes in app.js.")

