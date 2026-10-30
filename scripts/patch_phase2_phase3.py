import re

with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add launchBookmakerSlip function
phase2_func = """
// ------------------------------------------------------------ Phase 2 & 3: 1-Click Bookmaker Launcher
function launchBookmakerSlip(bookieKey, slipIdx) {
  const r = builderResult;
  let slip = null;
  if (slipIdx === 'custom') {
    if (customAccaLegs.length === 0) return;
    const stake = (builderState && builderState.stake) || 10;
    const odds = customAccaLegs.reduce((t, l) => t * (l.odds || 2.0), 1);
    slip = { legs: customAccaLegs, stake, odds, ret: stake * odds };
  } else {
    slip = r && r.slips && r.slips[+slipIdx];
  }
  if (!slip) return;

  const bookieNames = {
    bet365: 'bet365',
    skybet: 'Sky Bet',
    leovegas: 'LeoVegas',
    betfair: 'Betfair',
    paddypower: 'Paddy Power'
  };
  const bName = bookieNames[bookieKey] || 'Bookmaker';

  // Format slip payload for bookmaker quick-slip paste
  const textLines = [
    '🎯 Bet Buddy ' + slip.legs.length + '-Leg Acca (' + fmtOdds(slip.odds) + ')',
    ...slip.legs.map((l, i) => (i + 1) + '. ' + l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label + ' (' + (l.fractional || fmtOdds(l.odds)) + ')'),
    'Stake: £' + slip.stake + ' · Target Return: £' + (slip.ret ? slip.ret.toFixed(2) : (slip.stake * slip.odds).toFixed(2))
  ];
  const copyStr = textLines.join('\\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(copyStr).catch(() => {});
  }

  // Generate deep-link for this bookmaker
  const query = getBookieSearchQuery({ legs: slip.legs });
  const links = getBookieDeepLinks(query);
  const targetUrl = links[bookieKey] || links.skybet;

  // Track telemetry
  try {
    const stats = getTrafficStats();
    stats.push({ type: 'bookie_click', bookie: bName, ts: Date.now() });
    localStorage.setItem('betbuddy_telemetry_events_v1', JSON.stringify(stats));
  } catch (e) {}

  toast('⚡ Slip copied! Opening ' + bName + ' betslip...');
  setTimeout(() => {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }, 350);
}
window.launchBookmakerSlip = launchBookmakerSlip;
"""

if "function launchBookmakerSlip" not in code:
    code = code.replace("function openBookieModal(betData) {", phase2_func + "\nfunction openBookieModal(betData) {")
    print("Added launchBookmakerSlip function")

# 2. Update slipCard to include .slip-bookie-bar
old_btn_row = """    '<div class="btn-row">' +
      '<button type="button" class="btn' + (primary ? ' primary' : '') + '" data-slip="' + idx + '">Save slip to Bet Diary</button>'"""

new_btn_row = """    '<div class="slip-bookie-bar">' +
      '<div class="slip-bookie-header">' +
        '<span class="slip-bookie-bolt">⚡</span>' +
        '<span class="slip-bookie-title">1-Click Load into Bookmaker:</span>' +
        '<span class="slip-bookie-hint">Auto-copies slip & opens match search</span>' +
      '</div>' +
      '<div class="slip-bookie-buttons" role="group" aria-label="1-Click bookmaker launcher">' +
        '<button type="button" class="bookie-pill b365" data-launch-bookie="bet365" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#10b981;"></span> Bet365 ↗</button>' +
        '<button type="button" class="bookie-pill sky" data-launch-bookie="skybet" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#38bdf8;"></span> Sky Bet ↗</button>' +
        '<button type="button" class="bookie-pill lv" data-launch-bookie="leovegas" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#f97316;"></span> LeoVegas ↗</button>' +
        '<button type="button" class="bookie-pill bf" data-launch-bookie="betfair" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#fbbf24;"></span> Betfair ↗</button>' +
      '</div>' +
    '</div>' +
    '<div class="btn-row">' +
      '<button type="button" class="btn' + (primary ? ' primary' : '') + '" data-slip="' + idx + '">Save slip to Bet Diary</button>'"""

if old_btn_row in code:
    code = code.replace(old_btn_row, new_btn_row)
    print("Added slip-bookie-bar to slipCard")
else:
    old_crlf = old_btn_row.replace('\n', '\r\n')
    new_crlf = new_btn_row.replace('\n', '\r\n')
    if old_crlf in code:
        code = code.replace(old_crlf, new_crlf)
        print("Added slip-bookie-bar (CRLF) to slipCard")
    else:
        print("Warning: old_btn_row not matched")

# 3. Add click handler delegation for data-launch-bookie
old_click = """  else if (t.closest('[data-timing]')) {"""
new_click = """  else if (t.closest('[data-launch-bookie]')) {
    const btn = t.closest('[data-launch-bookie]');
    launchBookmakerSlip(btn.dataset.launchBookie, btn.dataset.slipIdx);
  }
  else if (t.closest('[data-timing]')) {"""

if old_click in code:
    code = code.replace(old_click, new_click)
    print("Added data-launch-bookie delegation")
else:
    old_c_crlf = old_click.replace('\n', '\r\n')
    new_c_crlf = new_click.replace('\n', '\r\n')
    if old_c_crlf in code:
        code = code.replace(old_c_crlf, new_c_crlf)
        print("Added data-launch-bookie delegation (CRLF)")
    else:
        print("Warning: old_click not matched")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Finished updating app.js for Phase 2 & 3")
