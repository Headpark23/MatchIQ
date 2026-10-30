import json
import re

# 1. Update app.js LEAGUES and CLUBS
with open('app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

old_leagues = "const LEAGUES = { PL: 'Premier League', ELC: 'Championship', BL1: 'Bundesliga', PD: 'La Liga', SA: 'Serie A', FL1: 'Ligue 1' };"
new_leagues = "const LEAGUES = {\n" \
              "  PL: 'Premier League',\n" \
              "  ELC: 'Championship',\n" \
              "  E2: 'League One',\n" \
              "  E3: 'League Two',\n" \
              "  SC0: 'Scottish Premiership',\n" \
              "  SC1: 'Scottish Championship',\n" \
              "  BL1: 'Bundesliga',\n" \
              "  PD: 'La Liga',\n" \
              "  SA: 'Serie A',\n" \
              "  FL1: 'Ligue 1',\n" \
              "  N1: 'Eredivisie',\n" \
              "  P1: 'Primeira Liga',\n" \
              "  CL: 'Champions League'\n" \
              "};"

if old_leagues in app_js:
    app_js = app_js.replace(old_leagues, new_leagues)
else:
    print("Warning: old_leagues not found in app.js")

# Add new clubs to CLUBS
new_clubs_str = """  // Scottish Premiership & Championship
  'Celtic': ['#018749', '#FFFFFF', 'CEL', 'Celtic Park'],
  'Rangers': ['#1B458F', '#FFFFFF', 'RAN', 'Ibrox Stadium'],
  'Aberdeen': ['#DA291C', '#FFFFFF', 'ABE', 'Pittodrie Stadium'],
  'Hearts': ['#8B1E41', '#FFFFFF', 'HEA', 'Tynecastle Park'],
  'Hibernian': ['#00693E', '#FFFFFF', 'HIB', 'Easter Road'],
  'Dundee United': ['#ED6A12', '#000000', 'UTD', 'Tannadice Park'],
  'Motherwell': ['#FDB913', '#660033', 'MOT', 'Fir Park'],
  'St. Mirren': ['#111111', '#FFFFFF', 'STM', 'The SMISA Stadium'],
  'Kilmarnock': ['#1B458F', '#FFFFFF', 'KIL', 'Rugby Park'],
  'Ross County': ['#0B2240', '#E51B24', 'ROS', 'Victoria Park'],
  'St. Johnstone': ['#1B458F', '#FFFFFF', 'STJ', 'McDiarmid Park'],
  'Dundee': ['#0B2240', '#FFFFFF', 'DND', 'Dens Park'],
  'Falkirk': ['#0B2240', '#FFFFFF', 'FAL', 'Falkirk Stadium'],
  'Livingston': ['#FDB913', '#111111', 'LIV', 'Tony Macaroni Arena'],
  'Partick Thistle': ['#ED1C24', '#FDB913', 'PAR', 'Firhill Stadium'],
  'Ayr United': ['#FFFFFF', '#111111', 'AYR', 'Somerset Park'],
  // English League One & Two
  'Birmingham': ['#0000FF', '#FFFFFF', 'BIR', 'St. Andrew\'s'],
  'Wrexham': ['#D62828', '#FFFFFF', 'WRE', 'Racecourse Ground'],
  'Charlton': ['#DA291C', '#FFFFFF', 'CHA', 'The Valley'],
  'Huddersfield': ['#0072CE', '#FFFFFF', 'HUD', 'John Smith\'s Stadium'],
  'Stockport': ['#00205B', '#FFFFFF', 'SKP', 'Edgeley Park'],
  'Bolton': ['#00205B', '#DA291C', 'BOL', 'Toughsheet Community Stadium'],
  'Reading': ['#002B7F', '#FFFFFF', 'REA', 'Select Car Leasing Stadium'],
  'Lincoln': ['#DA291C', '#111111', 'LIN', 'Sincil Bank'],
  'Port Vale': ['#111111', '#FDB913', 'PVL', 'Vale Park'],
  'Walsall': ['#DA291C', '#FFFFFF', 'WAL', 'Bescot Stadium'],
  'Doncaster': ['#DA291C', '#FFFFFF', 'DON', 'Eco-Power Stadium'],
  'Notts County': ['#111111', '#FFFFFF', 'NCO', 'Meadow Lane'],
  'Chesterfield': ['#00539F', '#FFFFFF', 'CHE', 'SMH Group Stadium'],
  'Bradford City': ['#800020', '#FDB913', 'BRA', 'Valley Parade'],
  // European & Champions League
  'Ajax': ['#DA291C', '#FFFFFF', 'AJX', 'Johan Cruyff Arena'],
  'PSV': ['#DA291C', '#FFFFFF', 'PSV', 'Philips Stadion'],
  'Feyenoord': ['#DA291C', '#FFFFFF', 'FEY', 'De Kuip'],
  'AZ Alkmaar': ['#DA291C', '#FFFFFF', 'AZ', 'AFAS Stadion'],
  'FC Utrecht': ['#DA291C', '#FFFFFF', 'UTR', 'Stadion Galgenwaard'],
  'FC Twente': ['#DA291C', '#FFFFFF', 'TWE', 'De Grolsch Veste'],
  'Sporting CP': ['#008055', '#FFFFFF', 'SCP', 'Estadio Jose Alvalade'],
  'Benfica': ['#DA291C', '#FFFFFF', 'SLB', 'Estadio da Luz'],
  'FC Porto': ['#0038A8', '#FFFFFF', 'FCP', 'Estadio do Dragao'],
  'SC Braga': ['#DA291C', '#FFFFFF', 'BRA', 'Estadio Municipal de Braga'],
  'Real Madrid': ['#FFFFFF', '#00529F', 'RMA', 'Santiago Bernabeu'],
  'AC Milan': ['#DA291C', '#111111', 'ACM', 'San Siro'],
  'Inter Milan': ['#004DA0', '#111111', 'INT', 'San Siro'],
  'Bayer Leverkusen': ['#DA291C', '#111111', 'B04', 'BayArena'],
  'Bayern Munich': ['#DC052D', '#FFFFFF', 'FCB', 'Allianz Arena'],
  'Atletico Madrid': ['#CB3524', '#FFFFFF', 'ATM', 'Metropolitano Stadium'],"""

if "'Celtic'" not in app_js:
    # insert before end of CLUBS
    app_js = app_js.replace("const CLUBS = {", "const CLUBS = {\n" + new_clubs_str)
    print("Added new clubs to app.js")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_js)
print("Updated app.js with 13 leagues and clubs")
