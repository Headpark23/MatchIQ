import re

with open('app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

# Define Phase 1 bookie URL generator functions
phase1_code = """
// ------------------------------------------------------------ Phase 1: Smart Direct Bookmaker Deep Links
function getBookieSearchQuery(betData) {
  if (!betData) return 'Football';
  if (betData.legs && betData.legs.length > 0) {
    const firstLeg = betData.legs[0];
    if (firstLeg.fixture) {
      return (firstLeg.fixture.home + ' ' + firstLeg.fixture.away).trim();
    }
  }
  if (betData.fixture) {
    return (betData.fixture.home + ' ' + betData.fixture.away).trim();
  }
  return (betData.selection || 'Football').split(':')[0].replace(/ v /i, ' ').trim();
}

function getBookieDeepLinks(query) {
  const enc = encodeURIComponent(query);
  return {
    bet365: 'https://www.bet365.com/#/AX/K^' + enc + '/',
    skybet: 'https://m.skybet.com/search?q=' + enc,
    paddypower: 'https://www.paddypower.com/search?q=' + enc,
    betfair: 'https://www.betfair.com/sport/football?searchTerm=' + enc,
    leovegas: 'https://www.leovegas.com/en-gb/betting#search/' + enc
  };
}
"""

if "function getBookieSearchQuery" not in app_js:
    # insert before openBookieModal
    app_js = app_js.replace("function openBookieModal(betData) {", phase1_code + "\nfunction openBookieModal(betData) {")
    print("Inserted Phase 1 getBookieSearchQuery and getBookieDeepLinks")

# Update openBookieModal to inject dynamic links and leg jumpers
old_open_bookie = """function openBookieModal(betData) {
  currentBookieSelection = betData || { selection: 'Bet Buddy Selection', fair: 'Best Price' };
  const modal = $('bookie-modal');
  if (!modal) return;
  const labelEl = $('bookie-bet-label');
  const oddsEl = $('bookie-bet-odds');
  if (labelEl) labelEl.textContent = currentBookieSelection.selection;
  if (oddsEl) oddsEl.textContent = currentBookieSelection.fair ? 'Odds: ' + currentBookieSelection.fair : '';
  
  const copyStr = currentBookieSelection.selection + (currentBookieSelection.fair ? ' @ ' + currentBookieSelection.fair : '');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(copyStr).catch(() => {});
  }
  modal.hidden = false;
}"""

new_open_bookie = """function openBookieModal(betData) {
  currentBookieSelection = betData || { selection: 'Bet Buddy Selection', fair: 'Best Price' };
  const modal = $('bookie-modal');
  if (!modal) return;
  const labelEl = $('bookie-bet-label');
  const oddsEl = $('bookie-bet-odds');
  if (labelEl) labelEl.textContent = currentBookieSelection.selection;
  if (oddsEl) oddsEl.textContent = currentBookieSelection.fair ? 'Odds: ' + currentBookieSelection.fair : '';
  
  // Format clipboard payload for bookie slip pasting
  let copyStr = currentBookieSelection.selection;
  if (currentBookieSelection.legs && currentBookieSelection.legs.length > 0) {
    copyStr = currentBookieSelection.legs.map((l, i) => (i + 1) + '. ' + l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label + ' (' + (l.fractional || fmtOdds(l.odds)) + ')').join('\\n');
  } else if (currentBookieSelection.fair) {
    copyStr += ' @ ' + currentBookieSelection.fair;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(copyStr).catch(() => {});
  }

  // Phase 1: Dynamic Match Deep-Links on all bookie buttons
  const query = getBookieSearchQuery(currentBookieSelection);
  const links = getBookieDeepLinks(query);
  const b365Btn = modal.querySelector('[data-bookie-click="Bet365"]');
  if (b365Btn) b365Btn.href = links.bet365;
  const skyBtn = modal.querySelector('[data-bookie-click="Sky Bet"]');
  if (skyBtn) skyBtn.href = links.skybet;
  const ppBtn = modal.querySelector('[data-bookie-click="Paddy Power"]');
  if (ppBtn) ppBtn.href = links.paddypower;
  const bfBtn = modal.querySelector('[data-bookie-click="Betfair"]');
  if (bfBtn) bfBtn.href = links.betfair;
  const lvBtn = modal.querySelector('[data-bookie-click="LeoVegas"]');
  if (lvBtn) lvBtn.href = links.leovegas;

  // Render individual leg direct match launchers if this is an Acca
  const legDrawer = $('bookie-legs-drawer');
  if (legDrawer) {
    if (currentBookieSelection.legs && currentBookieSelection.legs.length > 0) {
      legDrawer.innerHTML = '<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);">' +
        '<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--pick);letter-spacing:0.08em;margin-bottom:8px;">Direct Match Launchers (' + currentBookieSelection.legs.length + ' legs)</div>' +
        currentBookieSelection.legs.map((l, i) => {
          const lQuery = (l.fixture.home + ' ' + l.fixture.away).trim();
          const lLinks = getBookieDeepLinks(lQuery);
          return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12.5px;">' +
            '<span style="font-weight:600;color:#fff;">' + (i + 1) + '. ' + esc(l.fixture.home) + ' v ' + esc(l.fixture.away) + '<small style="display:block;color:var(--soft);">' + esc(l.label) + ' (' + esc(l.fractional || fmtOdds(l.odds)) + ')</small></span>' +
            '<span style="display:flex;gap:4px;flex-shrink:0;">' +
              '<a href="' + lLinks.skybet + '" target="_blank" rel="noopener noreferrer" class="btn small" style="padding:2px 8px;font-size:11px;background:rgba(56,189,248,0.15);border:1px solid var(--cyan);color:#38bdf8;">SkyBet ↗</a>' +
              '<a href="' + lLinks.bet365 + '" target="_blank" rel="noopener noreferrer" class="btn small" style="padding:2px 8px;font-size:11px;background:rgba(16,185,129,0.15);border:1px solid var(--emerald);color:#34d399;">Bet365 ↗</a>' +
            '</span>' +
          '</div>';
        }).join('') +
      '</div>';
      legDrawer.hidden = false;
    } else {
      legDrawer.innerHTML = '';
      legDrawer.hidden = true;
    }
  }

  modal.hidden = false;
}"""

if old_open_bookie in app_js:
    app_js = app_js.replace(old_open_bookie, new_open_bookie)
    print("Updated openBookieModal with Phase 1 dynamic deep links and leg drawer")
else:
    old_crlf = old_open_bookie.replace('\n', '\r\n')
    new_crlf = new_open_bookie.replace('\n', '\r\n')
    if old_crlf in app_js:
        app_js = app_js.replace(old_crlf, new_crlf)
        print("Updated openBookieModal (CRLF) with Phase 1 dynamic deep links and leg drawer")
    else:
        print("Warning: old_open_bookie not matched")

# Update callsite in data-partner-slip so full slip is passed
old_partner_call = """    openBookieModal({
      selection: slip ? slip.legs.map(l => l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label).join(' + ') : 'Acca Slip',
      fair: slip ? fmtOdds(slip.odds) : ''
    });"""

new_partner_call = """    openBookieModal({
      selection: slip ? slip.legs.map(l => l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label).join(' + ') : 'Acca Slip',
      fair: slip ? fmtOdds(slip.odds) : '',
      legs: slip ? slip.legs : [],
      stake: slip ? slip.stake : 10,
      odds: slip ? slip.odds : 1
    });"""

if old_partner_call in app_js:
    app_js = app_js.replace(old_partner_call, new_partner_call)
    print("Updated partner slip callsite with legs")
else:
    old_p_crlf = old_partner_call.replace('\n', '\r\n')
    new_p_crlf = new_partner_call.replace('\n', '\r\n')
    if old_p_crlf in app_js:
        app_js = app_js.replace(old_p_crlf, new_p_crlf)
        print("Updated partner slip callsite (CRLF) with legs")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_js)

print("Finished applying Phase 1 updates to app.js")
