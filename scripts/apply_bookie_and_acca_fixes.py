# scripts/apply_bookie_and_acca_fixes.py
import sys
import re

print("Starting surgical updates to app.js and index.html...")

# 1. Update index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Update script versions to v=51
html = html.replace('market_calculations.js?v=43', 'market_calculations.js?v=51')
html = html.replace('bet_builder.js?v=43', 'bet_builder.js?v=51')
html = html.replace('app.js?v=50', 'app.js?v=51')

# Add Return from Bookmaker Modal if not already present
return_modal_html = '''
<!-- Return from Bookmaker Confirmation Modal -->
<div class="modal-backdrop" id="return-bookie-modal" hidden>
  <div class="modal bookie-modal-card" role="dialog" aria-modal="true" aria-labelledby="return-modal-title">
    <div class="modal-head">
      <div>
        <h2 id="return-modal-title" style="margin:0;font-size:1.15rem">🎯 Returned from <span id="return-bookie-name">Bookmaker</span></h2>
        <span class="text-sm muted">Confirm your real bet to unlock 2× League Bonus</span>
      </div>
      <button type="button" class="icon-btn" onclick="dismissReturnModal()" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <div id="return-bet-summary" class="bookie-summary-box" style="margin-bottom:12px;">
        <strong id="return-bet-label">Accumulator Pick</strong>
        <span id="return-bet-odds" class="mono text-sm" style="color:var(--pick)"></span>
      </div>
      <p style="margin:0 0 14px;font-size:13.5px;color:#cbd5e1;">Did you place this bet on <strong id="return-bookie-confirm-name">Coral</strong>?</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button type="button" class="btn primary" id="confirm-bet-placed-btn" onclick="confirmRealBetPlaced()" style="padding:12px;font-size:14px;font-weight:700;background:linear-gradient(135deg, #10b981, #059669);border:none;cursor:pointer;">
          ✓ Yes, Bet Placed! (Save &amp; Claim 2× Bonus)
        </button>
        <button type="button" class="btn" onclick="dismissReturnModal()" style="padding:10px;background:rgba(255,255,255,0.06);color:#94a3b8;cursor:pointer;">
          No, I changed my mind / did not place
        </button>
      </div>
    </div>
  </div>
</div>
'''

if 'id="return-bookie-modal"' not in html:
    # Insert right before bookie-modal
    html = html.replace('<div class="modal-backdrop" id="bookie-modal"', return_modal_html + '\n<div class="modal-backdrop" id="bookie-modal"')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Updated index.html successfully.")

# 2. Update app.js
with open('app.js', 'r', encoding='utf-8') as f:
    app = f.read()

# Update VERSION in app.js
app = re.sub(r"const APP_VERSION = '[^']+';", "const APP_VERSION = 'v51';", app)

# A. Update getBookieDeepLinks
old_deep_links = '''function getBookieDeepLinks(query) {
  const enc = encodeURIComponent(query);
  return {
    bet365: 'https://www.bet365.com/#/AX/K^' + enc + '/',
    skybet: 'https://m.skybet.com/search?q=' + enc,
    paddypower: 'https://www.paddypower.com/search?q=' + enc,
    betfair: 'https://www.betfair.com/sport/football?searchTerm=' + enc,
    leovegas: 'https://www.leovegas.com/en-gb/betting#search/' + enc
  };
}'''

new_deep_links = '''function getBookieDeepLinks(query) {
  const enc = encodeURIComponent(query);
  return {
    coral: 'https://sports.coral.co.uk/search?q=' + enc,
    ladbrokes: 'https://sports.ladbrokes.com/search?q=' + enc,
    skybet: 'https://m.skybet.com/search?q=' + enc,
    bet365: 'https://www.bet365.com/#/AX/K^' + enc + '/',
    paddypower: 'https://www.paddypower.com/search?q=' + enc,
    betfair: 'https://www.betfair.com/sport/football?searchTerm=' + enc,
    williamhill: 'https://sports.williamhill.com/betting/en-gb/search?q=' + enc,
    leovegas: 'https://www.leovegas.com/en-gb/betting#search/' + enc
  };
}'''

if old_deep_links in app:
    app = app.replace(old_deep_links, new_deep_links)
    print("Replaced getBookieDeepLinks with Coral support.")

# B. Update builderSlipCard bookie buttons
old_slip_bookie_btns = '''      '<div class="slip-bookie-buttons" role="group" aria-label="1-Click bookmaker launcher">' +
        '<button type="button" class="bookie-pill b365" data-launch-bookie="bet365" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#10b981;"></span> Bet365 ↗</button>' +
        '<button type="button" class="bookie-pill sky" data-launch-bookie="skybet" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#38bdf8;"></span> Sky Bet ↗</button>' +
        '<button type="button" class="bookie-pill lv" data-launch-bookie="leovegas" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#f97316;"></span> LeoVegas ↗</button>' +
        '<button type="button" class="bookie-pill bf" data-launch-bookie="betfair" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#fbbf24;"></span> Betfair ↗</button>' +
      '</div>' +'''

new_slip_bookie_btns = '''      '<div class="slip-bookie-buttons" role="group" aria-label="1-Click bookmaker launcher">' +
        '<button type="button" class="bookie-pill coral" data-launch-bookie="coral" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#0284c7;"></span> Coral ↗</button>' +
        '<button type="button" class="bookie-pill sky" data-launch-bookie="skybet" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#38bdf8;"></span> Sky Bet ↗</button>' +
        '<button type="button" class="bookie-pill b365" data-launch-bookie="bet365" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#10b981;"></span> Bet365 ↗</button>' +
        '<button type="button" class="bookie-pill bf" data-launch-bookie="betfair" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#fbbf24;"></span> Betfair ↗</button>' +
      '</div>' +'''

if old_slip_bookie_btns in app:
    app = app.replace(old_slip_bookie_btns, new_slip_bookie_btns)
    print("Added Coral to builderSlipCard bookie buttons.")

# C. Update customAccaCard to include bookie buttons
old_custom_card_end = '''    '<div class="btn-row" style="margin-top:12px;">' +
      '<button type="button" class="btn primary" onclick="saveCustomAccaToDiary()">Save Custom Acca to Bet Diary</button>' +'''

new_custom_card_end = '''    '<div class="slip-bookie-bar" style="margin: 12px 0 8px;">' +
      '<div class="slip-bookie-header">' +
        '<span class="slip-bookie-bolt">⚡</span>' +
        '<span class="slip-bookie-title">1-Click Load into Bookmaker:</span>' +
        '<span class="slip-bookie-hint">Opens app &amp; copies slip</span>' +
      '</div>' +
      '<div class="slip-bookie-buttons" role="group" aria-label="1-Click bookmaker launcher">' +
        '<button type="button" class="bookie-pill coral" data-launch-bookie="coral" data-slip-idx="custom"><span class="pill-dot" style="background:#0284c7;"></span> Coral ↗</button>' +
        '<button type="button" class="bookie-pill sky" data-launch-bookie="skybet" data-slip-idx="custom"><span class="pill-dot" style="background:#38bdf8;"></span> Sky Bet ↗</button>' +
        '<button type="button" class="bookie-pill b365" data-launch-bookie="bet365" data-slip-idx="custom"><span class="pill-dot" style="background:#10b981;"></span> Bet365 ↗</button>' +
        '<button type="button" class="bookie-pill bf" data-launch-bookie="betfair" data-slip-idx="custom"><span class="pill-dot" style="background:#fbbf24;"></span> Betfair ↗</button>' +
      '</div>' +
    '</div>' +
    '<div class="btn-row" style="margin-top:12px;">' +
      '<button type="button" class="btn primary" onclick="saveCustomAccaToDiary()">Save Custom Acca to Bet Diary</button>' +'''

if old_custom_card_end in app:
    app = app.replace(old_custom_card_end, new_custom_card_end)
    print("Added 1-Click bookie buttons to customAccaCard.")

# D. Fix saveCustomAccaToDiary
old_save_custom = '''function saveCustomAccaToDiary() {
  const legs = customAccaLegs;
  if (!legs.length) return;
  const stake = (builderState && builderState.stake) || 10;
  const odds = legs.reduce((t, l) => t * (l.odds || 2.0), 1);
  openDiary({});
  $('modal-bet-type').value = 'accumulator';
  toggleAccumulatorFields();
  $('modal-stake').value = stake;
  $('modal-odds').value = fmtOdds(odds);
  $('modal-legs-input').value = legs.map(l => l.label + ' | ' + (l.fractional || fmtOdds(l.odds))).join('\\n');
  toast('Custom Acca loaded into Bet Diary modal!');
}'''

new_save_custom = '''function saveCustomAccaToDiary() {
  const legs = customAccaLegs;
  if (!legs.length) return;
  const stake = (builderState && builderState.stake) || 10;
  const odds = legs.reduce((t, l) => t * (l.odds || 2.0), 1);
  openDiary({});
  $('modal-bet-type').value = 'accumulator';
  toggleAccumulatorFields();
  if ($('modal-stake-input')) $('modal-stake-input').value = Number(stake).toFixed(2);
  if ($('modal-odds-input')) $('modal-odds-input').value = fmtOdds(odds).replace(/[≈~]/g, '');
  if ($('modal-origin-select')) $('modal-origin-select').value = 'matchiq';
  if ($('modal-notes-input')) $('modal-notes-input').value = 'Custom Accumulator (' + legs.length + ' legs) built in Bet Buddy.';
  if ($('modal-legs-input')) {
    $('modal-legs-input').value = legs.map(l => {
      const matchLabel = l.fixture && l.fixture.home ? (l.fixture.home + (l.fixture.away ? ' v ' + l.fixture.away : '') + ': ') : '';
      const frac = String(l.fractional || fmtOdds(l.odds)).replace(/[≈~]/g, '').trim();
      return (matchLabel + l.label).replace(/^([^:]+:\\s*)\\1/, '$1') + ' | ' + (frac || 'Evens');
    }).join('\\n');
  }
  updateModalPnlPreview();
  toast('Custom Acca loaded into Bet Diary modal!');
}'''

if old_save_custom in app:
    app = app.replace(old_save_custom, new_save_custom)
    print("Fixed saveCustomAccaToDiary element IDs and odds formatting.")

# E. Fix saveSlipToDiary
old_save_slip = '''function saveSlipToDiary(i) {
  const slip = builderResult && builderResult.slips && builderResult.slips[i];
  if (!slip) return;
  openDiary({});
  $('modal-bet-type').value = 'accumulator';
  toggleAccumulatorFields();
  $('modal-legs-input').value = slip.legs.map(l => l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label + ' | ' + String(l.fractional).replace('≈', '')).join('\\n');
  $('modal-stake-input').value = builderState.stake.toFixed(2);
  $('modal-origin-select').value = 'matchiq';
  $('modal-notes-input').value = 'Built by Bet Buddy Bet Builder for a £' + builderState.win + ' win. Check any price marked estimate with your bookmaker.';
  updateModalPnlPreview();
}'''

new_save_slip = '''function saveSlipToDiary(i) {
  const slip = builderResult && builderResult.slips && builderResult.slips[i];
  if (!slip) return;
  openDiary({});
  $('modal-bet-type').value = 'accumulator';
  toggleAccumulatorFields();
  if ($('modal-legs-input')) {
    $('modal-legs-input').value = slip.legs.map(l => {
      const matchLabel = l.fixture && l.fixture.home ? (l.fixture.home + (l.fixture.away ? ' v ' + l.fixture.away : '') + ': ') : '';
      const frac = String(l.fractional || fmtOdds(l.odds)).replace(/[≈~]/g, '').trim();
      return (matchLabel + l.label).replace(/^([^:]+:\\s*)\\1/, '$1') + ' | ' + (frac || 'Evens');
    }).join('\\n');
  }
  if ($('modal-stake-input')) $('modal-stake-input').value = Number((builderState && builderState.stake) || 10).toFixed(2);
  if ($('modal-odds-input')) $('modal-odds-input').value = fmtOdds(slip.odds).replace(/[≈~]/g, '');
  if ($('modal-origin-select')) $('modal-origin-select').value = 'matchiq';
  if ($('modal-notes-input')) $('modal-notes-input').value = 'Built by Bet Buddy Bet Builder for a £' + ((builderState && builderState.win) || 50) + ' win. Check any price marked estimate with your bookmaker.';
  updateModalPnlPreview();
}'''

if old_save_slip in app:
    app = app.replace(old_save_slip, new_save_slip)
    print("Fixed saveSlipToDiary.")

# F. Fix parseAccumulatorLegs
old_parse_legs = '''function parseAccumulatorLegs() {
  return ($('modal-legs-input').value || '').split('\\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [selection, oddsText] = line.split('|').map(part => (part || '').trim());
    const parsedOdds = (calc.parseOdds ? calc.parseOdds(oddsText) : null) ?? calc.parseFractionalOdds(oddsText);
    return { selection, odds: parsedOdds, outcome: 'pending' };
  });
}'''

new_parse_legs = '''function parseAccumulatorLegs() {
  return ($('modal-legs-input').value || '').split('\\n').map(l => l.trim()).filter(Boolean).map(line => {
    let selection = line;
    let oddsText = '';
    if (line.includes('|')) {
      const parts = line.split('|');
      selection = parts[0].trim();
      oddsText = parts.slice(1).join('|').trim();
    } else {
      const match = line.match(/^(.*?)(?:@|\\sat\\s|\\s+)(≈?~?\\d+\\/\\d+|≈?~?evens?|≈?~?\\d+(?:\\.\\d+)?)\\s*$/i);
      if (match) {
        selection = match[1].trim();
        oddsText = match[2].trim();
      }
    }
    const cleanOdds = oddsText.replace(/[≈~]/g, '').trim();
    let parsedOdds = null;
    if (/^evens?$/i.test(cleanOdds) || /^even money$/i.test(cleanOdds)) {
      parsedOdds = 2.0;
    } else {
      parsedOdds = (calc.parseOdds ? calc.parseOdds(cleanOdds) : null) ?? (calc.parseFractionalOdds ? calc.parseFractionalOdds(cleanOdds) : null);
    }
    if (!parsedOdds || !Number.isFinite(parsedOdds) || parsedOdds <= 1) {
      const fracMatch = cleanOdds.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
      if (fracMatch) {
        const num = Number(fracMatch[1]), den = Number(fracMatch[2]);
        if (den > 0) parsedOdds = 1 + (num / den);
      } else {
        const decMatch = cleanOdds.match(/(\\d+\\.\\d+)/);
        if (decMatch) {
          const dec = Number(decMatch[1]);
          if (dec > 1) parsedOdds = dec;
        }
      }
    }
    if (!parsedOdds || !Number.isFinite(parsedOdds) || parsedOdds <= 1) {
      parsedOdds = 2.0;
    }
    return { selection: selection || 'Leg', odds: parsedOdds, outcome: 'pending' };
  });
}'''

if old_parse_legs in app:
    app = app.replace(old_parse_legs, new_parse_legs)
    print("Fixed parseAccumulatorLegs to be fully robust.")

# G. Add + Acca buttons to football selections in marketCard, mostLikelyBlock, topSixCard
old_market_btn = '''    return '<button type="button" class="btn small" data-diary=\\'' + jsonStr + '\\' aria-label="Add ' + esc(row.label) + ' to Bet Diary">+ Diary</button>' +
      '<button type="button" class="btn-place-bet-inline" data-open-bookie=\\'' + jsonStr + '\\' title="Open in bookmaker app/site">Place Bet</button>';'''

new_market_btn = '''    return '<button type="button" class="btn small" data-diary=\\'' + jsonStr + '\\' aria-label="Add ' + esc(row.label) + ' to Bet Diary">+ Diary</button>' +
      '<button type="button" class="btn small acca-btn" data-add-football-acca=\\'' + jsonStr + '\\' title="Add to custom Acca Builder" style="background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.4);color:#38bdf8;">+ Acca</button>' +
      '<button type="button" class="btn-place-bet-inline" data-open-bookie=\\'' + jsonStr + '\\' title="Open in bookmaker app/site">Place Bet</button>';'''

if old_market_btn in app:
    app = app.replace(old_market_btn, new_market_btn)
    print("Added + Acca button to marketCard.")

old_most_likely_btn = '''    '<button type="button" class="btn small" data-diary=\\'' + esc(JSON.stringify(diary)) + '\\'>+ Diary</button></div>';'''
new_most_likely_btn = '''    '<div class="btn-row" style="margin-top:8px;">' +
      '<button type="button" class="btn small" data-diary=\\'' + esc(JSON.stringify(diary)) + '\\'>+ Diary</button>' +
      '<button type="button" class="btn small" data-add-football-acca=\\'' + esc(JSON.stringify(diary)) + '\\' style="background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.4);color:#38bdf8;">+ Acca</button>' +
    '</div></div>';'''

if old_most_likely_btn in app:
    app = app.replace(old_most_likely_btn, new_most_likely_btn)
    print("Added + Acca button to mostLikelyBlock.")

old_top_six_btn = '''    '<button type="button" class="btn small" data-diary=\\'' + esc(JSON.stringify(diary)) + '\\'>+ Diary</button></article>';'''
new_top_six_btn = '''    '<div class="btn-row" style="margin-top:8px;">' +
      '<button type="button" class="btn small" data-diary=\\'' + esc(JSON.stringify(diary)) + '\\'>+ Diary</button>' +
      '<button type="button" class="btn small" data-add-football-acca=\\'' + esc(JSON.stringify(diary)) + '\\' style="background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.4);color:#38bdf8;">+ Acca</button>' +
    '</div></article>';'''

if old_top_six_btn in app:
    app = app.replace(old_top_six_btn, new_top_six_btn)
    print("Added + Acca button to topSixCard.")

# H. Wire click delegation for data-add-football-acca
delegate_marker = '  // Cross-sport acca addition'
football_acca_delegate = '''  // Football acca addition
  if (t.dataset.addFootballAcca !== undefined || (t.closest && t.closest('[data-add-football-acca]'))) {
    const btn = t.dataset.addFootballAcca !== undefined ? t : t.closest('[data-add-football-acca]');
    try {
      const data = JSON.parse(btn.dataset.addFootballAcca);
      const f = fixtureById(data.id);
      const cleanOddsStr = String(data.fair || 'Evens').replace(/[≈~]/g, '').trim();
      const decOdds = (calc.parseOdds ? calc.parseOdds(cleanOddsStr) : null) ?? (calc.parseFractionalOdds ? calc.parseFractionalOdds(cleanOddsStr) : 2.0) ?? 2.0;
      addCrossSportAccaLeg({
        id: 'fb-' + data.id + '-' + (data.selection || '').replace(/[^a-zA-Z0-9]/g, '_'),
        matchId: data.id,
        fixture: f ? { home: f.home, away: f.away, competition: (f.competition || 'FOOTBALL').toUpperCase() } : { home: data.selection, away: '', competition: 'FOOTBALL' },
        kickoff: f ? kickoffMs(f) : (Date.now() + 86400000),
        selId: 'sel-' + data.id + '-' + data.selection,
        label: (f ? (f.home + ' v ' + f.away + ': ') : '') + data.selection,
        market: data.market || 'wins',
        p: data.p || 0.5,
        odds: decOdds,
        fractional: data.fair || 'Evens',
        bookmaker: 'Bet Buddy Fair',
        priceSource: 'model',
        support: 'validated',
        basis: 'Bet Buddy Football Model',
        sport: 'football'
      });
      scrollToBuilder();
    } catch (e) { console.error(e); }
    return;
  }

'''

if delegate_marker in app and 'Football acca addition' not in app:
    app = app.replace(delegate_marker, football_acca_delegate + delegate_marker)
    print("Wired click delegation for data-add-football-acca.")

# I. Return Bridge and Bookie Tracking
bridge_code = '''
// ------------------------------------------------------------ Return Bridge & Bookmaker Tracking
let pendingBookieLaunch = null;
try {
  const stored = sessionStorage.getItem('betbuddy_pending_bookie');
  if (stored) pendingBookieLaunch = JSON.parse(stored);
} catch (e) {}

function trackBookieLaunch(bookieName, betData) {
  pendingBookieLaunch = {
    bookie: bookieName,
    data: betData,
    time: Date.now()
  };
  try {
    sessionStorage.setItem('betbuddy_pending_bookie', JSON.stringify(pendingBookieLaunch));
  } catch (e) {}
}

function showReturnModal(launch) {
  const modal = $('return-bookie-modal');
  if (!modal) return;
  const nameEl = $('return-bookie-name');
  const confirmNameEl = $('return-bookie-confirm-name');
  const labelEl = $('return-bet-label');
  const oddsEl = $('return-bet-odds');
  if (nameEl) nameEl.textContent = launch.bookie;
  if (confirmNameEl) confirmNameEl.textContent = launch.bookie;
  if (labelEl) {
    if (launch.data && launch.data.legs) {
      labelEl.textContent = launch.data.legs.length + '-Leg Accumulator (' + launch.data.legs.map(l => l.label).join(' + ') + ')';
    } else {
      labelEl.textContent = (launch.data && launch.data.selection) || 'Bet Selection';
    }
  }
  if (oddsEl) {
    oddsEl.textContent = (launch.data && (launch.data.fair || fmtOdds(launch.data.odds))) || '';
  }
  modal.hidden = false;
}

function dismissReturnModal() {
  const modal = $('return-bookie-modal');
  if (modal) modal.hidden = true;
  pendingBookieLaunch = null;
  try { sessionStorage.removeItem('betbuddy_pending_bookie'); } catch (e) {}
}

function confirmRealBetPlaced() {
  if (!pendingBookieLaunch) return;
  const launch = pendingBookieLaunch;
  dismissReturnModal();

  const isAcca = !!(launch.data && launch.data.legs);
  const stake = Number((builderState && builderState.stake) || 10);
  let odds = 2.0;
  if (isAcca) {
    odds = launch.data.legs.reduce((t, l) => t * (l.odds || 2.0), 1);
  } else if (launch.data && launch.data.odds) {
    odds = Number(launch.data.odds);
  }

  const entry = {
    id: 'bet-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    type: isAcca ? 'accumulator' : 'single',
    profile: (getAuthUser() && getAuthUser().signedIn) ? ('@' + (getAuthUser().handle || (getAuthUser().name || 'User').split(' ')[0])) : 'Default',
    date: new Date().toISOString().slice(0, 10),
    fixture: isAcca ? 'Accumulator' : (launch.data && launch.data.fixture ? (launch.data.fixture.home + ' v ' + launch.data.fixture.away) : 'Listed Match'),
    market: isAcca ? 'accumulator' : ((launch.data && launch.data.market) || 'wins'),
    marketName: isAcca ? 'Accumulator' : 'Match Result',
    selection: isAcca ? launch.data.legs.map(l => l.label).join(' + ') : ((launch.data && launch.data.selection) || 'Selection'),
    legs: isAcca ? launch.data.legs.map(l => ({ selection: l.label, odds: l.odds || 2.0, outcome: 'pending' })) : undefined,
    origin: 'matchiq',
    bookmaker: launch.bookie,
    odds,
    stake,
    potentialReturn: stake * odds,
    outcome: 'pending',
    timestamp: new Date().toISOString(),
    realBetVerified: true,
    bonusMultiplier: 2,
    notes: 'Real bet confirmed placed at ' + launch.bookie + '. 2× League Bonus Active.'
  };

  try {
    const diary = getStoredDiary();
    diary.unshift(entry);
    saveStoredDiary(diary);
  } catch (e) { console.error(e); }

  celebrateSave();
  toast('🎉 ' + launch.bookie + ' real bet confirmed! Added to Bet Diary with 2× League Bonus.');
  if (currentRoute()[0] === 'diary') render();
}

let returnCheckDebounce = false;
function checkReturnFromBookie() {
  if (returnCheckDebounce) return;
  returnCheckDebounce = true;
  setTimeout(() => { returnCheckDebounce = false; }, 2000);

  if (!pendingBookieLaunch) {
    try {
      const stored = sessionStorage.getItem('betbuddy_pending_bookie');
      if (stored) pendingBookieLaunch = JSON.parse(stored);
    } catch (e) {}
  }
  if (pendingBookieLaunch && (Date.now() - pendingBookieLaunch.time < 3600000)) {
    setTimeout(() => {
      showReturnModal(pendingBookieLaunch);
    }, 600);
  }
}
window.addEventListener('focus', checkReturnFromBookie);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkReturnFromBookie();
});
if (typeof window !== 'undefined') {
  window.dismissReturnModal = dismissReturnModal;
  window.confirmRealBetPlaced = confirmRealBetPlaced;
}
'''

if 'Return Bridge & Bookmaker Tracking' not in app:
    app = app + '\n' + bridge_code
    print("Appended Return Bridge code to app.js.")

# J. Update launchBookmakerSlip to track bookie launch and support coral
old_launch_slip = '''function launchBookmakerSlip(bookieKey, slipIdx) {
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
  const bName = bookieNames[bookieKey] || 'Bookmaker';'''

new_launch_slip = '''function launchBookmakerSlip(bookieKey, slipIdx) {
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
    coral: 'Coral',
    skybet: 'Sky Bet',
    bet365: 'bet365',
    betfair: 'Betfair',
    paddypower: 'Paddy Power',
    ladbrokes: 'Ladbrokes',
    williamhill: 'William Hill',
    leovegas: 'LeoVegas'
  };
  const bName = bookieNames[bookieKey] || 'Bookmaker';
  trackBookieLaunch(bName, slip);'''

if old_launch_slip in app:
    app = app.replace(old_launch_slip, new_launch_slip)
    print("Updated launchBookmakerSlip with Coral and trackBookieLaunch.")

# K. Update openBookieModal to track launch as well
old_open_bookie = '''  const query = getBookieSearchQuery(currentBookieSelection);
  const links = getBookieDeepLinks(query);
  const b365Btn = modal.querySelector('[data-bookie-click="Bet365"]');'''

new_open_bookie = '''  const query = getBookieSearchQuery(currentBookieSelection);
  const links = getBookieDeepLinks(query);
  const coralBtn = modal.querySelector('[data-bookie-click="Coral"]');
  if (coralBtn) {
    coralBtn.href = links.coral;
    coralBtn.onclick = () => trackBookieLaunch('Coral', currentBookieSelection);
  }
  const ladBtn = modal.querySelector('[data-bookie-click="Ladbrokes"]');
  if (ladBtn) {
    ladBtn.href = links.ladbrokes;
    ladBtn.onclick = () => trackBookieLaunch('Ladbrokes', currentBookieSelection);
  }
  const b365Btn = modal.querySelector('[data-bookie-click="Bet365"]');'''

if old_open_bookie in app:
    app = app.replace(old_open_bookie, new_open_bookie)
    print("Updated openBookieModal with Coral direct links.")

# L. Update betCard to show 2x Verified Real Bet badge
old_badge_in_bet = '''<span class="badge ' + (entry.origin === 'independent' ? 'market' : 'validated') + '">' + (entry.origin === 'independent' ? 'Own choice' : 'Bet Buddy pick') + '</span>\''''
new_badge_in_bet = '''<span class="badge ' + (entry.origin === 'independent' ? 'market' : 'validated') + '">' + (entry.origin === 'independent' ? 'Own choice' : 'Bet Buddy pick') + '</span>\'' +
      (entry.realBetVerified ? ' <span class="badge" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;">🛡️ Real Bet (2× Pts)</span>' : '')'''

if old_badge_in_bet in app:
    app = app.replace(old_badge_in_bet, new_badge_in_bet)
    print("Added Real Bet 2x badge to betCard.")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app)
print("Updated app.js successfully.")
