import re

with open('app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

# 1. Revert LEAGUES back to 6 verified real competitions
old_leagues = """const LEAGUES = {
  PL: 'Premier League',
  ELC: 'Championship',
  E2: 'League One',
  E3: 'League Two',
  SC0: 'Scottish Premiership',
  SC1: 'Scottish Championship',
  BL1: 'Bundesliga',
  PD: 'La Liga',
  SA: 'Serie A',
  FL1: 'Ligue 1',
  N1: 'Eredivisie',
  P1: 'Primeira Liga',
  CL: 'Champions League'
};"""

clean_leagues = "const LEAGUES = { PL: 'Premier League', ELC: 'Championship', BL1: 'Bundesliga', PD: 'La Liga', SA: 'Serie A', FL1: 'Ligue 1' };"

if old_leagues in app_js:
    app_js = app_js.replace(old_leagues, clean_leagues)
    print("Reverted LEAGUES to 6 verified competitions")
else:
    old_crlf = old_leagues.replace('\n', '\r\n')
    if old_crlf in app_js:
        app_js = app_js.replace(old_crlf, clean_leagues)
        print("Reverted LEAGUES (CRLF) to 6 verified competitions")

# 2. Revert fixtures subtitle
app_js = app_js.replace(
    "compFilter === 'ALL' ? 'All ' + Object.keys(LEAGUES).length + ' competitions' : esc(leagueName(compFilter))",
    "compFilter === 'ALL' ? 'All six competitions' : esc(leagueName(compFilter))"
)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_js)

print("Updated app.js back to verified leagues only")
