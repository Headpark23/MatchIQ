#!/usr/bin/env python3
with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_block = [
    '  const diaryBtn = row => {\n',
    '    if (!ctx.canLog) return \'\';\n',
    '    const f = fixtureById(ctx.id);\n',
    '    const fxObj = f ? { home: f.home, away: f.away } : undefined;\n',
    '    const cleanOddsStr = String(row.fair || \'Evens\').replace(/[≈~]/g, \'\').trim();\n',
    '    const decOdds = (calc.parseOdds ? calc.parseOdds(cleanOddsStr) : null) ?? (calc.parseFractionalOdds ? calc.parseFractionalOdds(cleanOddsStr) : 2.0) ?? 2.0;\n',
    '    const selText = (key === \'btts\' ? \'Both teams to score: \' : key === \'result\' ? \'\' : meta.name + \': \') + row.label;\n',
    '    const betPayload = { id: ctx.id, fixture: fxObj, market: meta.diary, marketName: meta.name, selection: selText, p: row.p, fair: row.fair, odds: decOdds };\n',
    '    const jsonStr = esc(JSON.stringify(betPayload));\n',
    '    return \'<button type="button" class="btn small" data-diary=\\\'\' + jsonStr + \'\\\' aria-label="Add \' + esc(row.label) + \' to Bet Diary">+ Diary</button>\' +\n',
    '      \'<button type="button" class="btn small acca-btn" data-add-football-acca=\\\'\' + jsonStr + \'\\\' title="Add to custom Acca Builder" style="background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.4);color:#38bdf8;">+ Acca</button>\' +\n',
    '      \'<a href="\' + esc(getButlerLaunchSingleUrl(betPayload)) + \'" class="btn-place-bet-inline butler-btn" onclick="prepareButlerSingleLaunch(this.dataset.betData)" data-bet-data=\\\'\' + jsonStr + \'\\\' title="Open in your bookmaker app">⚡ Place at <span class="current-butler-name">\' + esc(getButlerBookmaker().name) + \'</span> ↗</a>\';\n',
    '  };\n'
]

# Find index of const diaryBtn = row => {
idx = None
for i, line in enumerate(lines):
    if 'const diaryBtn = row =>' in line:
        idx = i
        break

assert idx is not None, "Could not find diaryBtn"
# Find end of diaryBtn
end_idx = None
for j in range(idx, idx + 15):
    if lines[j].strip() == '};':
        end_idx = j + 1
        break

assert end_idx is not None, "Could not find end of diaryBtn"

print(f"Replacing lines {idx} to {end_idx}")
lines[idx:end_idx] = new_block

with open('app.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Updated diaryBtn in app.js successfully.")

