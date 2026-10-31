import re
from pathlib import Path

app_p = Path("app.js")
app_code = app_p.read_text(encoding="utf-8")

# Bump version to v62
app_code = re.sub(r"const APP_VERSION = 'v\d+';", "const APP_VERSION = 'v62';", app_code)

# -----------------------------------------------------------------------------
# 1. BOOKMAKERS CONFIG WITH ALL 7 BOOKMAKERS AND CLEAN FOOTBALL URLS
# -----------------------------------------------------------------------------
old_bookmakers_cfg = """const BUTLER_STORAGE_KEY = 'betbuddy_butler_bookie_v1';
const BOOKMAKERS_CONFIG = {
  skybet: { key: 'skybet', name: 'Sky Bet', tag: 'SKY BET', color: '#38bdf8', perk: 'Official 1-Tap App Integration, AccaFreeze & RequestABet', appUrl: 'https://m.skybet.com/search?q=' }
};

function getButlerBookmaker() {
  return BOOKMAKERS_CONFIG.skybet;
}

function setButlerBookmaker(key) {
  if (!BOOKMAKERS_CONFIG[key]) return;
  try {
    localStorage.setItem(BUTLER_STORAGE_KEY, key);
  } catch (e) {}
  updateButlerUI();
  closeButlerModal();
  toast('🤵 Bet Butler set to ' + BOOKMAKERS_CONFIG[key].name + '! 1-tap buttons now launch your account.');
  render();
}"""

new_bookmakers_cfg = """const BUTLER_STORAGE_KEY = 'betbuddy_butler_bookie_v1';
const BOOKMAKERS_CONFIG = {
  skybet: { key: 'skybet', name: 'Sky Bet', tag: 'SKY BET', color: '#38bdf8', url: 'https://m.skybet.com/football' },
  bet365: { key: 'bet365', name: 'bet365', tag: 'BET365', color: '#10b981', url: 'https://www.bet365.com/#/AC/B1/' },
  williamhill: { key: 'williamhill', name: 'William Hill', tag: 'WILLIAM HILL', color: '#0284c7', url: 'https://sports.williamhill.com/betting/en-gb/football' },
  paddypower: { key: 'paddypower', name: 'Paddy Power', tag: 'PADDY POWER', color: '#059669', url: 'https://www.paddypower.com/football' },
  betfair: { key: 'betfair', name: 'Betfair', tag: 'BETFAIR', color: '#f59e0b', url: 'https://www.betfair.com/sport/football' },
  coral: { key: 'coral', name: 'Coral', tag: 'CORAL', color: '#2563eb', url: 'https://sports.coral.co.uk/sport/football' },
  ladbrokes: { key: 'ladbrokes', name: 'Ladbrokes', tag: 'LADBROKES', color: '#dc2626', url: 'https://sports.ladbrokes.com/sport/football' }
};

function getButlerBookmaker() {
  try {
    const saved = localStorage.getItem(BUTLER_STORAGE_KEY);
    if (saved && BOOKMAKERS_CONFIG[saved]) return BOOKMAKERS_CONFIG[saved];
  } catch (e) {}
  return BOOKMAKERS_CONFIG.skybet;
}

function setButlerBookmaker(key) {
  if (!BOOKMAKERS_CONFIG[key]) return;
  try {
    localStorage.setItem(BUTLER_STORAGE_KEY, key);
  } catch (e) {}
  updateButlerUI();
  closeButlerModal();
  toast('Slip note set to ' + BOOKMAKERS_CONFIG[key].name);
  render();
}"""

if old_bookmakers_cfg in app_code:
    app_code = app_code.replace(old_bookmakers_cfg, new_bookmakers_cfg)
    print("Updated BOOKMAKERS_CONFIG with all 7 bookmakers")

# -----------------------------------------------------------------------------
# 2. REMOVE DEAD SCHEMES & SIMPLIFY buildBookmakerLaunchUrl
# -----------------------------------------------------------------------------
old_dead_schemes = """const ANDROID_PACKAGES = {
  skybet: 'com.skybet.android'
};

const BOOKIE_APP_SCHEMES = {
  coral: 'coral://',
  skybet: 'skybet://',
  bet365: 'bet365://',
  betfair: 'betfair://',
  ladbrokes: 'ladbrokes://',
  paddypower: 'paddypower://',
  williamhill: 'williamhill://'
};

function getBookieDeepLinks(query) {
  const enc = encodeURIComponent(query);
  return {
    coral: 'https://www.coral.co.uk/en/sportsapp/search?q=' + enc,
    ladbrokes: 'https://sports.ladbrokes.com/search?q=' + enc,
    skybet: 'https://m.skybet.com/search?q=' + enc,
    bet365: 'https://www.bet365.com/#/AX/K^' + enc + '/',
    paddypower: 'https://www.paddypower.com/search?q=' + enc,
    betfair: 'https://www.betfair.com/sport/football?searchTerm=' + enc,
    williamhill: 'https://sports.williamhill.com/betting/en-gb/search?q=' + enc,
    leovegas: 'https://www.leovegas.com/en-gb/betting#search/' + enc
  };
}


// ------------------------------------------------------------ Phase 2 & 3: 1-Click Bookmaker Launcher
function buildBookmakerLaunchUrl(bookieKey, betDataOrSlip) {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const pkg = ANDROID_PACKAGES[bookieKey];
  const query = getBookieSearchQuery(betDataOrSlip);
  const links = getBookieDeepLinks(query);
  const butler = (typeof BOOKMAKERS_CONFIG !== 'undefined' && BOOKMAKERS_CONFIG[bookieKey]) || null;
  const targetUrl = links[bookieKey] || (butler && butler.appUrl ? (butler.appUrl + encodeURIComponent(query)) : ('https://www.google.co.uk/search?q=' + encodeURIComponent(query + ' odds')));

  if (isAndroid && pkg) {
    const hostAndPath = targetUrl.replace(/^https?:\\/\\//, '');
    const fallbackEncoded = encodeURIComponent(targetUrl);
    return 'intent://' + hostAndPath + '#Intent;scheme=https;package=' + pkg + ';S.browser_fallback_url=' + fallbackEncoded + ';end;';
  }
  return targetUrl;
}"""

new_clean_schemes = """// ------------------------------------------------------------ Bookmaker Football Hub URLs
function buildBookmakerLaunchUrl(bookieKey) {
  const cfg = BOOKMAKERS_CONFIG[bookieKey] || BOOKMAKERS_CONFIG.skybet;
  return cfg.url;
}"""

if old_dead_schemes in app_code:
    app_code = app_code.replace(old_dead_schemes, new_clean_schemes)
    print("Cleaned up dead schemes and simplified buildBookmakerLaunchUrl")

# -----------------------------------------------------------------------------
# 3. NEW SLIP CARD ENGINE: DATA, CHECKBOX TICKS, PIP, MODAL CONTROL
# -----------------------------------------------------------------------------
slip_card_engine_js = """
// ============================================================ 
// SLIP CARD ENGINE: Honest Slip Note & Leg Checklist
// ============================================================ 
let activeSlipCardData = null;

function getSlipCardTicks(slipKey) {
  try {
    const raw = sessionStorage.getItem('betbuddy_slip_ticks_' + slipKey);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function saveSlipCardTicks(slipKey, ticks) {
  try {
    sessionStorage.setItem('betbuddy_slip_ticks_' + slipKey, JSON.stringify(ticks));
  } catch (e) {}
}

function toggleLegTick(slipKey, legIdx, isChecked) {
  const ticks = getSlipCardTicks(slipKey);
  ticks[legIdx] = !!isChecked;
  saveSlipCardTicks(slipKey, ticks);
  const item = document.getElementById('slip-card-leg-' + legIdx);
  if (item) {
    if (isChecked) item.classList.add('ticked');
    else item.classList.remove('ticked');
  }
}

function openSlipCard(slipIdx) {
  let slip = null;
  let slipKey = 'slip_' + slipIdx;
  if (slipIdx === 'custom') {
    if (customAccaLegs.length === 0) return;
    const stake = (builderState && builderState.stake) || 10;
    const odds = customAccaLegs.reduce((t, l) => t * (l.odds || 2.0), 1);
    slip = { legs: customAccaLegs, stake, odds, ret: stake * odds };
    slipKey = 'slip_custom';
  } else {
    slip = builderResult && builderResult.slips && builderResult.slips[+slipIdx];
  }
  if (!slip || !slip.legs) return;

  activeSlipCardData = { ...slip, slipKey };
  renderSlipCardModal(activeSlipCardData);
}

function openSlipCardSingle(dataStr) {
  try {
    const raw = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
    const betData = enrichSingleBetData(raw);
    const stake = 10;
    const odds = betData.odds || 2.0;
    const leg = {
      label: betData.selection || 'Football Bet',
      fixture: betData.fixture || {},
      odds: odds,
      fractional: betData.fair,
      bookmaker: 'Market price'
    };
    activeSlipCardData = {
      legs: [leg],
      stake: stake,
      odds: odds,
      ret: stake * odds,
      slipKey: 'single_' + (betData.id || Date.now()),
      isSingle: true
    };
    renderSlipCardModal(activeSlipCardData);
  } catch (e) {
    console.error('Error opening single slip card:', e);
  }
}

function renderSlipCardModal(slip) {
  const modal = $('slip-card-modal');
  if (!modal) return;

  const bookie = getButlerBookmaker();
  if ($('slip-card-bookie-name')) $('slip-card-bookie-name').textContent = bookie.name;
  if ($('btn-open-bookie-tab')) $('btn-open-bookie-tab').textContent = 'Open ' + bookie.name + ' Football ↗';

  const titleEl = $('slip-card-title');
  if (titleEl) {
    titleEl.textContent = slip.isSingle ? 'Match Slip Note' : 'Acca Slip Note (' + slip.legs.length + ' Legs)';
  }

  const ticks = getSlipCardTicks(slip.slipKey);
  const listEl = $('slip-card-legs-list');
  if (listEl) {
    listEl.innerHTML = slip.legs.map((l, i) => {
      const isTicked = !!ticks[i];
      const fixHome = (l.fixture && l.fixture.home) || '';
      const fixAway = (l.fixture && l.fixture.away) || '';
      const matchText = (fixHome && fixAway && fixHome !== fixAway) ? (fixHome + ' v ' + fixAway) : (fixHome || 'Match');
      const oddsLabel = oddsFormat === 'decimal' ? calc.formatDecimalOdds(l.odds) : (l.fractional || fmtOdds(l.odds));

      return '<div class="slip-card-leg-item' + (isTicked ? ' ticked' : '') + '" id="slip-card-leg-' + i + '">' +
        '<div class="slip-card-leg-left">' +
          '<label class="slip-leg-checkbox-wrap" title="Tick when added to bookmaker">' +
            '<input type="checkbox" class="slip-leg-checkbox" ' + (isTicked ? 'checked' : '') + ' onchange="toggleLegTick(\\'' + slip.slipKey + '\\', ' + i + ', this.checked)" aria-label="Mark leg ' + (i + 1) + ' as added">' +
          '</label>' +
          '<div class="slip-card-leg-info">' +
            '<span class="slip-card-leg-num">Leg ' + (i + 1) + '</span>' +
            '<span class="slip-card-leg-match">' + esc(matchText) + '</span>' +
            '<span class="slip-card-leg-sel">' + esc(l.label || l.selection) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="slip-card-leg-right">' +
          '<span class="slip-card-leg-odds">' + esc(oddsLabel) + '</span>' +
          '<label class="slip-card-tick-label" onclick="const cb = document.querySelector(\\'#slip-card-leg-' + i + ' input\\'); if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event(\\'change\\')); }">Added to slip</label>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  const sumEl = $('slip-card-summary');
  if (sumEl) {
    const retVal = slip.ret ? slip.ret.toFixed(2) : (slip.stake * slip.odds).toFixed(2);
    sumEl.innerHTML = '<span>Stake: <b class="mono">£' + slip.stake + '</b></span>' +
      '<span>Total Odds: <b class="mono">' + fmtOdds(slip.odds) + ' (estimate)</b></span>' +
      '<span>Return: <b class="mono">£' + retVal + ' (estimate)</b></span>';
  }

  // Feature detect Document Picture-in-Picture
  const pipBtn = $('btn-slip-pip');
  if (pipBtn) {
    if ('documentPictureInPicture' in window) {
      pipBtn.style.display = 'inline-flex';
      pipBtn.onclick = async () => {
        try {
          const pipWin = await window.documentPictureInPicture.requestWindow({ width: 360, height: 520 });
          document.querySelectorAll('link[rel="stylesheet"], style').forEach(s => pipWin.document.head.appendChild(s.cloneNode(true)));
          const clone = modal.querySelector('.slip-card-dialog').cloneNode(true);
          pipWin.document.body.appendChild(clone);
          pipWin.document.body.style.background = '#050b14';
          pipWin.document.body.style.color = '#fff';
          pipWin.document.body.style.padding = '10px';
        } catch (err) { console.log('PiP not available:', err); }
      };
    } else {
      pipBtn.style.display = 'none';
    }
  }

  modal.hidden = false;
}

function closeSlipCardModal() {
  const modal = $('slip-card-modal');
  if (modal) modal.hidden = true;
}

function openBookmakerFootball() {
  const bookie = getButlerBookmaker();
  const url = buildBookmakerLaunchUrl(bookie.key);
  if (activeSlipCardData) {
    trackBookieLaunch(bookie.name, activeSlipCardData);
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function copySlipCardText() {
  if (!activeSlipCardData) return;
  const slip = activeSlipCardData;
  const textLines = [
    '🎯 Bet Buddy ' + slip.legs.length + '-Leg Acca (' + fmtOdds(slip.odds) + ')',
    ...slip.legs.map((l, i) => (i + 1) + '. ' + (l.fixture ? (l.fixture.home + ' v ' + l.fixture.away + ': ') : '') + l.label + ' (' + (l.fractional || fmtOdds(l.odds)) + ')'),
    'Stake: £' + slip.stake + ' · Target Return: £' + (slip.ret ? slip.ret.toFixed(2) : (slip.stake * slip.odds).toFixed(2)) + ' (estimate)'
  ];
  const copyStr = textLines.join('\\n');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(copyStr).then(() => {
        toast('📋 Slip note copied to clipboard!');
      }).catch(() => {
        toast('⚠️ Unable to copy automatically. Please copy text manually.');
      });
      return;
    }
  } catch (e) {}
  toast('⚠️ Clipboard not supported on this browser.');
}
"""

if "function openSlipCard" not in app_code:
    app_code += "\n" + slip_card_engine_js
    print("Added Slip Card engine to app.js")

# -----------------------------------------------------------------------------
# 4. REWORD SLIP CARD BUTTONS ON BUILDER ACCA AND CUSTOM ACCA
# -----------------------------------------------------------------------------
# Slip card builder button
old_slip_card_btn = """    '<div class="slip-bookie-bar" style="margin: 12px 0 10px;">' +
      '<a href="' + esc(getButlerLaunchUrl(idx)) + '" class="bookie-pill sky sky-prominent" onclick="prepareButlerLaunch(' + idx + ')" style="text-decoration:none;">' +
        '<span class="pill-dot" style="background:#38bdf8;"></span> ⚡ Open in Sky Bet App (+5 League Bonus) ↗' +
      '</a>' +
      '<div style="font-size:11.5px;color:var(--muted);text-align:center;margin-top:5px;">Auto-copies slip &amp; opens Sky Bet logged in</div>' +
    '</div>' +"""

new_slip_card_btn = """    '<div style="margin: 12px 0 10px;">' +
      '<button type="button" class="btn primary" onclick="openSlipCard(' + idx + ')" style="width:100%;min-height:48px;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;">' +
        '<span>📋</span> Open Slip Card' +
      '</button>' +
      '<div style="font-size:12px;color:var(--soft);text-align:center;margin-top:5px;">Tick off legs as you place them in your bookmaker app</div>' +
    '</div>' +"""

if old_slip_card_btn in app_code:
    app_code = app_code.replace(old_slip_card_btn, new_slip_card_btn)
    print("Replaced builder acca button with 'Open Slip Card'")

# Custom acca button
old_custom_btn = """      '<a href="' + esc(getButlerLaunchUrl('custom')) + '" class="btn primary butler-acca-launch-btn" onclick="prepareButlerLaunch(this.dataset.slipIdx)" data-slip-idx="custom" style="width:100%;padding:14px;font-size:15px;font-weight:700;background:linear-gradient(135deg, #0284c7, #0369a1);border:none;border-radius:12px;box-shadow:0 4px 14px rgba(2,132,199,0.35);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">' +
        '<span>⚡</span> 1-Tap Place with <span class="current-butler-name">' + esc(getButlerBookmaker().name) + '</span> (Your Butler) ↗' +
      '</a>' +"""

new_custom_btn = """      '<button type="button" class="btn primary butler-acca-launch-btn" onclick="openSlipCard(\\'custom\\')" style="width:100%;min-height:48px;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;">' +
        '<span>📋</span> Open Slip Card' +
      '</button>' +"""

if old_custom_btn in app_code:
    app_code = app_code.replace(old_custom_btn, new_custom_btn)
    print("Replaced custom acca button with 'Open Slip Card'")

# Single selection button in marketCard
old_single_btn = """      '<a href="' + esc(getButlerLaunchSingleUrl(betPayload)) + '" class="btn-place-bet-inline butler-btn" onclick="prepareButlerSingleLaunch(this.dataset.betData)" data-bet-data=\\'' + jsonStr + '\\' title="Open in your bookmaker app">⚡ Place at <span class="current-butler-name">' + esc(getButlerBookmaker().name) + '</span> ↗</a>';"""

new_single_btn = """      '<button type="button" class="btn-place-bet-inline butler-btn" onclick="openSlipCardSingle(this.dataset.betData)" data-bet-data=\\'' + jsonStr + '\\' title="Open slip note">📋 Slip Note</button>';"""

if old_single_btn in app_code:
    app_code = app_code.replace(old_single_btn, new_single_btn)
    print("Replaced single selection button with 'Slip Note'")

# -----------------------------------------------------------------------------
# 5. REWORD HOME PAGE BUTLER HERO CARD
# -----------------------------------------------------------------------------
old_home_butler_hero = """      '<!-- Bet Butler Feature Hero Card -->' +
      '<div class="butler-home-hero-card">' +
        '<div class="butler-home-hero-content">' +
          '<div class="butler-home-badge">' +
            '<span class="badge-dot" style="background:#38bdf8;"></span>' +
            '<span>🤵 Official App Hand-Off: Sky Bet</span>' +
            '<span class="butler-bonus-tag">🏆 +5 League Bonus Points</span>' +
          '</div>' +
          '<h2 class="butler-home-title">1-Tap Bookie Hand-Off with The Bet Butler</h2>' +
          '<p class="butler-home-desc">' +
            'Stop retyping match names and searching for odds. Bet Butler transfers your calculated Accas and value bets straight into your installed <strong>Sky Bet</strong> app. One tap launches the app ready to place, and the Return Bridge logs your real bets for <strong>+5 bonus points in your leagues</strong>.' +
          '</p>' +
          '<div class="butler-home-features">' +
            '<div class="butler-feat-item"><span class="feat-icon">⚡</span> 1-Tap App Launch</div>' +
            '<div class="butler-feat-item"><span class="feat-icon">📋</span> Automatic Slip Transfer</div>' +
            '<div class="butler-feat-item"><span class="feat-icon">🏆</span> +5 League Bonus Points</div>' +
            '<div class="butler-feat-item"><span class="feat-icon">🔄</span> Return Bridge Diary Sync</div>' +
          '</div>' +
          '<div class="butler-home-actions">' +
            '<a href="#/picks" class="btn primary butler-cta-btn">' +
              '<span>Launch Bet Butler Acca</span>' +
              '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
            '</a>' +
            '<button type="button" class="btn butler-change-btn" onclick="openButlerModal()">' +
              '<span>Change Partner Bookie</span>' +
            '</button>' +
          '</div>' +
          '<p class="butler-home-footnote">' +
            '18+ only. Bet responsibly. Official verified partner: <strong>Sky Bet</strong> (Free 1-Tap Hand-Off).' +
          '</p>' +
        '</div>' +
      '</div>';"""

new_home_butler_hero = """      '<!-- Bet Butler Feature Hero Card -->' +
      '<div class="butler-home-hero-card">' +
        '<div class="butler-home-hero-content">' +
          '<div class="butler-home-badge">' +
            '<span class="badge-dot" style="background:#38bdf8;"></span>' +
            '<span>🤵 The Bet Butler: Your Slip Note</span>' +
          '</div>' +
          '<h2 class="butler-home-title">Keep Your Slip In Front Of You</h2>' +
          '<p class="butler-home-desc">' +
            'Keep your slip note open while you add the bets in your bookmaker app. The Butler gives you a clean checklist to tick off selections, copy all lines, and link directly to your bookmaker football hub.' +
          '</p>' +
          '<div class="butler-home-features">' +
            '<div class="butler-feat-item"><span class="feat-icon">📋</span> Slip Card Checklist</div>' +
            '<div class="butler-feat-item"><span class="feat-icon">📑</span> 1-Click Copy All</div>' +
            '<div class="butler-feat-item"><span class="feat-icon">↗️</span> Link to Bookmaker Hub</div>' +
            '<div class="butler-feat-item"><span class="feat-icon">💾</span> Self-Reported Diary</div>' +
          '</div>' +
          '<div class="butler-home-actions">' +
            '<a href="#/picks" class="btn primary butler-cta-btn">' +
              '<span>Build Slip Card Acca</span>' +
              '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
            '</a>' +
            '<button type="button" class="btn butler-change-btn" onclick="openButlerModal()">' +
              '<span>Choose Bookmaker</span>' +
            '</button>' +
          '</div>' +
          '<p class="butler-home-footnote">' +
            '18+ only. Bet responsibly. Bet Buddy does not place bets. Prices may differ at your bookmaker.' +
          '</p>' +
        '</div>' +
      '</div>';"""

if old_home_butler_hero in app_code:
    app_code = app_code.replace(old_home_butler_hero, new_home_butler_hero)
    print("Reworded Home page Butler hero card")

# -----------------------------------------------------------------------------
# 6. REMOVE +5 BONUS POINTS AND FAIR PLAY BONUS CLAIMS IN LEAGUES
# -----------------------------------------------------------------------------
# In getUserLeagueStats, remove bonus calculation
old_points_calc = """  const points = leagueBets.reduce((sum, e) => {
    const base = calc.calculateLeaguePoints(e.odds, e.outcome) || 0;
    const bonus = (e.realBetVerified && e.outcome === 'won') ? 5 : 0;
    return sum + base + bonus;
  }, 0);"""

new_points_calc = """  const points = leagueBets.reduce((sum, e) => {
    return sum + (calc.calculateLeaguePoints(e.odds, e.outcome) || 0);
  }, 0);"""

if old_points_calc in app_code:
    app_code = app_code.replace(old_points_calc, new_points_calc)
    print("Removed bonus points from league calculations")

# In Fair Play banner text:
old_fair_play_text = """      '<div><strong>Fair Play &amp; Bet Butler Bonus:</strong> Exactly <strong>1 settled bet per calendar day</strong> counts toward your league score. Official bets placed via <strong>The Bet Butler (Sky Bet)</strong> earn <strong>+5 League Bonus Points</strong> upon winning!</div>' +"""

new_fair_play_text = """      '<div><strong>Fair Play Rule:</strong> Exactly <strong>1 settled bet per calendar day</strong> counts toward your league score. Chronologically first qualifying bet logged each day counts, keeping the competition fair for all players.</div>' +"""

if old_fair_play_text in app_code:
    app_code = app_code.replace(old_fair_play_text, new_fair_play_text)
    print("Updated Fair Play banner in Leagues view")

# In confirmRealBetPlaced:
old_confirm_entry = """    realBetVerified: true,
    bonusMultiplier: 2,
    notes: 'Official real bet placed at Sky Bet via Bet Butler (+5 League Bonus Active).', bonusPoints: 5"""

new_confirm_entry = """    source: 'self-reported',
    notes: 'Self-reported bet placed at ' + (launch.bookie || getButlerBookmaker().name) + '.'"""

if old_confirm_entry in app_code:
    app_code = app_code.replace(old_confirm_entry, new_confirm_entry)
    print("Removed realBetVerified and bonus points in confirmRealBetPlaced")

# In toast for confirmRealBetPlaced:
old_confirm_toast = """toast('🎉 Sky Bet real bet confirmed! Added to Bet Diary with +5 League Bonus.');"""
new_confirm_toast = """toast('Bet saved to your Bet Diary (self-reported)!');"""
if old_confirm_toast in app_code:
    app_code = app_code.replace(old_confirm_toast, new_confirm_toast)

# In Diary entry badge rendering:
old_diary_badge = """      (entry.realBetVerified ? ' <span class="badge" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;">🌟 Real Bet (2× Pts)</span>' : '') +"""
new_diary_badge = """      (entry.realBetVerified || entry.source === 'self-reported' ? ' <span class="badge" style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);">Self-reported</span>' : '') +"""

if old_diary_badge in app_code:
    app_code = app_code.replace(old_diary_badge, new_diary_badge)
    print("Replaced 2x Real Bet badge with neutral Self-reported badge")

app_p.write_text(app_code, encoding="utf-8")
print("app.js updated successfully with all Slip Card & Honest Butler changes")

