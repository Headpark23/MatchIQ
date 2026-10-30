# scripts/deploy_bet_butler.py
import re

print("Starting Bet Butler Engine deployment...")

# 1. Update styles.css with Bet Butler styles
with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

butler_css = '''
/* ------------------------------------------------------------ Bet Butler Styles */
.butler-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  min-height: 32px;
  border-radius: 9999px;
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.22), rgba(16, 185, 129, 0.16));
  border: 1px solid rgba(56, 189, 248, 0.45);
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  transition: all .15s ease;
}
.butler-pill-btn:hover {
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.35), rgba(16, 185, 129, 0.25));
  border-color: var(--cyan);
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.35);
  transform: translateY(-1px);
}
.butler-pill-btn .butler-icon { font-size: 14px; }
.butler-pill-btn b { color: var(--cyan); font-weight: 700; }
.butler-pill-btn .butler-caret { font-size: 10px; color: var(--muted); margin-left: 2px; }

.butler-intro-box {
  padding: 12px 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.12), rgba(15, 23, 42, 0.8));
  border: 1px solid rgba(56, 189, 248, 0.25);
  margin-bottom: 14px;
}
.butler-bookie-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin: 12px 0 16px;
  max-height: 52vh;
  overflow-y: auto;
  padding-right: 4px;
}
.butler-choice-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
  color: #fff;
  text-align: left;
  cursor: pointer;
  transition: all .15s ease;
}
.butler-choice-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: var(--cyan);
  transform: translateX(3px);
}
.butler-choice-card.active {
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(16, 185, 129, 0.12));
  border-color: var(--cyan);
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.22);
}
.butler-choice-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.butler-active-check {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--emerald);
  display: none;
}
.butler-choice-card.active .butler-active-check {
  display: inline-block;
}
.bookie-tag.coral { background: #0284c7; color: #fff; }
.bookie-pill.coral:hover { background: rgba(2, 132, 199, 0.22); border-color: #0284c7; color: #38bdf8; }

.butler-perks-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 12px;
  color: var(--soft);
}
.butler-perk-item strong { color: #fff; }

.btn-place-bet-inline.butler-btn {
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(16, 185, 129, 0.2));
  border-color: rgba(56, 189, 248, 0.45);
}
.btn-place-bet-inline.butler-btn:hover {
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.35), rgba(16, 185, 129, 0.3));
  border-color: var(--cyan);
}
'''

if 'Bet Butler Styles' not in css:
    css += '\n' + butler_css
    with open('styles.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print("Added Bet Butler CSS to styles.css.")

# 2. Update index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Add Butler Pill to header-tools
header_tools_target = '<div class="header-tools">'
butler_header_button = '''<div class="header-tools">
      <button type="button" class="butler-pill-btn" id="header-butler-btn" onclick="openButlerModal()" title="Your Bet Butler: Tailors bets and 1-tap launching to your betting account">
        <span class="butler-icon">🤵</span>
        <span class="butler-label">Butler: <b id="header-butler-name">Coral</b></span>
        <span class="butler-caret">▾</span>
      </button>'''

if 'id="header-butler-btn"' not in html and header_tools_target in html:
    html = html.replace(header_tools_target, butler_header_button, 1)
    print("Added Butler button to header-tools in index.html.")

# Add Butler Modal to index.html
butler_modal_html = '''
<!-- Bet Butler Bookmaker Preference Modal -->
<div class="modal-backdrop" id="butler-modal" hidden>
  <div class="modal bookie-modal-card" role="dialog" aria-modal="true" aria-labelledby="butler-modal-title">
    <div class="modal-head">
      <div>
        <h2 id="butler-modal-title" style="margin:0;font-size:1.15rem;display:flex;align-items:center;gap:8px;">
          <span>🤵</span> Your Bet Butler
        </h2>
        <span class="text-sm muted">Choose your betting account. Bet Buddy acts as your butler inside it.</span>
      </div>
      <button type="button" class="icon-btn" onclick="closeButlerModal()" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="butler-intro-box">
        <p style="margin:0;font-size:13.5px;color:#e2e8f0;line-height:1.45;">
          <strong>No new betting account needed.</strong> Bet Buddy sits on your side of the table — finding high-probability edges, filtering out bookmaker traps, and letting you place bets in 1 tap directly in your chosen app.
        </p>
      </div>

      <div class="butler-bookie-grid" role="radiogroup" aria-label="Select your preferred bookmaker">
        <!-- Coral -->
        <button type="button" class="butler-choice-card" data-select-butler="coral" onclick="setButlerBookmaker('coral')">
          <div class="butler-choice-top">
            <span class="bookie-tag coral">CORAL</span>
            <span class="butler-active-check" id="check-coral">✓ Active Butler</span>
          </div>
          <strong>Coral</strong>
          <span class="text-sm muted">Football Super Series, Acca Insurance &amp; fast app loading</span>
        </button>

        <!-- Sky Bet -->
        <button type="button" class="butler-choice-card" data-select-butler="skybet" onclick="setButlerBookmaker('skybet')">
          <div class="butler-choice-top">
            <span class="bookie-tag skybet">SKY BET</span>
            <span class="butler-active-check" id="check-skybet">✓ Active Butler</span>
          </div>
          <strong>Sky Bet</strong>
          <span class="text-sm muted">RequestABet, AccaFreeze &amp; UK accumulator specials</span>
        </button>

        <!-- Bet365 -->
        <button type="button" class="butler-choice-card" data-select-butler="bet365" onclick="setButlerBookmaker('bet365')">
          <div class="butler-choice-top">
            <span class="bookie-tag b365">BET365</span>
            <span class="butler-active-check" id="check-bet365">✓ Active Butler</span>
          </div>
          <strong>bet365</strong>
          <span class="text-sm muted">Best in-play depth, 2 Goals Ahead early payout</span>
        </button>

        <!-- Betfair -->
        <button type="button" class="butler-choice-card" data-select-butler="betfair" onclick="setButlerBookmaker('betfair')">
          <div class="butler-choice-top">
            <span class="bookie-tag bf">BETFAIR</span>
            <span class="butler-active-check" id="check-betfair">✓ Active Butler</span>
          </div>
          <strong>Betfair</strong>
          <span class="text-sm muted">Exchange value pricing &amp; Sportsbook multi-bets</span>
        </button>

        <!-- Ladbrokes -->
        <button type="button" class="butler-choice-card" data-select-butler="ladbrokes" onclick="setButlerBookmaker('ladbrokes')">
          <div class="butler-choice-top">
            <span class="bookie-tag ladbrokes">LADBROKES</span>
            <span class="butler-active-check" id="check-ladbrokes">✓ Active Butler</span>
          </div>
          <strong>Ladbrokes</strong>
          <span class="text-sm muted">1-2-Free predictor &amp; UK high street network</span>
        </button>

        <!-- William Hill -->
        <button type="button" class="butler-choice-card" data-select-butler="williamhill" onclick="setButlerBookmaker('williamhill')">
          <div class="butler-choice-top">
            <span class="bookie-tag wh">WILLIAM HILL</span>
            <span class="butler-active-check" id="check-williamhill">✓ Active Butler</span>
          </div>
          <strong>William Hill</strong>
          <span class="text-sm muted">Epic Odds boosts &amp; traditional UK football betting</span>
        </button>

        <!-- Paddy Power -->
        <button type="button" class="butler-choice-card" data-select-butler="paddypower" onclick="setButlerBookmaker('paddypower')">
          <div class="butler-choice-top">
            <span class="bookie-tag pp">PADDY POWER</span>
            <span class="butler-active-check" id="check-paddypower">✓ Active Butler</span>
          </div>
          <strong>Paddy Power</strong>
          <span class="text-sm muted">Super Sub player bets &amp; multi-sport rewards</span>
        </button>
      </div>

      <div class="butler-perks-box">
        <div class="butler-perk-item">⚡ <strong>1-Tap Launching</strong>: Direct handoff to your bookmaker app with slip pre-copied.</div>
        <div class="butler-perk-item">🛡️ <strong>2× League Points</strong>: Placing real bets via your Butler earns double points.</div>
        <div class="butler-perk-item">🔒 <strong>100% Private</strong>: No passwords or bank details ever stored. You stay in full control.</div>
      </div>
    </div>
  </div>
</div>
'''

if 'id="butler-modal"' not in html:
    html = html.replace('<div class="modal-backdrop" id="return-bookie-modal"', butler_modal_html + '\n<div class="modal-backdrop" id="return-bookie-modal"')
    print("Added Butler modal to index.html.")

# Bump version to v53 in index.html
html = html.replace('app.js?v=52', 'app.js?v=53')
html = html.replace('market_calculations.js?v=52', 'market_calculations.js?v=53')
html = html.replace('bet_builder.js?v=52', 'bet_builder.js?v=53')
html = html.replace('styles.css?v=50', 'styles.css?v=53')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Updated index.html successfully.")

# 3. Update sw.js for v53
with open('sw.js', 'r', encoding='utf-8') as f:
    sw = f.read()
sw = re.sub(r"const CACHE_NAME = '[^']+';", "const CACHE_NAME = 'betbuddy-pwa-v53-bet-butler-engine';", sw)
with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(sw)
print("Updated sw.js for v53.")

# 4. Update app.js
with open('app.js', 'r', encoding='utf-8') as f:
    app = f.read()

# Update version to v53
app = re.sub(r"const APP_VERSION = '[^']+';", "const APP_VERSION = 'v53';", app)

# Append Bet Butler Module
butler_js = '''
// ============================================================
// THE BET BUTLER: Personal Assistant for Existing Bookmaker Account
// ============================================================
const BUTLER_STORAGE_KEY = 'betbuddy_butler_bookie_v1';
const BOOKMAKERS_CONFIG = {
  coral: { key: 'coral', name: 'Coral', tag: 'CORAL', color: '#0284c7', perk: 'Football Super Series & Acca Boosts', appUrl: 'https://sports.coral.co.uk/search?q=' },
  skybet: { key: 'skybet', name: 'Sky Bet', tag: 'SKY BET', color: '#38bdf8', perk: 'RequestABet & AccaFreeze', appUrl: 'https://m.skybet.com/search?q=' },
  bet365: { key: 'bet365', name: 'bet365', tag: 'BET365', color: '#10b981', perk: '2 Goals Ahead Early Payout & In-Play', appUrl: 'https://www.bet365.com/#/AX/K^' },
  betfair: { key: 'betfair', name: 'Betfair', tag: 'BETFAIR', color: '#fbbf24', perk: 'Top Exchange Prices & Multiples', appUrl: 'https://www.betfair.com/sport/football?searchTerm=' },
  ladbrokes: { key: 'ladbrokes', name: 'Ladbrokes', tag: 'LADBROKES', color: '#ef4444', perk: '1-2-Free Predictor & High Street', appUrl: 'https://sports.ladbrokes.com/search?q=' },
  williamhill: { key: 'williamhill', name: 'William Hill', tag: 'WILLIAM HILL', color: '#0284c7', perk: 'Epic Odds & Football Coupons', appUrl: 'https://sports.williamhill.com/betting/en-gb/search?q=' },
  paddypower: { key: 'paddypower', name: 'Paddy Power', tag: 'PADDY POWER', color: '#059669', perk: 'Super Sub & Money Back Specials', appUrl: 'https://www.paddypower.com/search?q=' }
};

function getButlerBookmaker() {
  try {
    const saved = localStorage.getItem(BUTLER_STORAGE_KEY);
    if (saved && BOOKMAKERS_CONFIG[saved]) return BOOKMAKERS_CONFIG[saved];
  } catch (e) {}
  return BOOKMAKERS_CONFIG.coral;
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
}

function updateButlerUI() {
  const current = getButlerBookmaker();
  const nameEls = document.querySelectorAll('#header-butler-name, .current-butler-name');
  nameEls.forEach(el => { el.textContent = current.name; });

  document.querySelectorAll('.butler-choice-card').forEach(card => {
    if (card.dataset.selectButler === current.key) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
}

function openButlerModal() {
  const modal = $('butler-modal');
  if (modal) {
    updateButlerUI();
    modal.hidden = false;
  }
}

function closeButlerModal() {
  const modal = $('butler-modal');
  if (modal) modal.hidden = true;
}

function launchButlerAcca(slipIdx) {
  const butler = getButlerBookmaker();
  launchBookmakerSlip(butler.key, slipIdx);
}

function launchButlerSingle(betData) {
  const butler = getButlerBookmaker();
  let copyStr = betData.selection || 'Football Bet';
  if (betData.fair) copyStr += ' @ ' + betData.fair;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(copyStr).catch(() => {});
    }
  } catch (e) {}

  trackBookieLaunch(butler.name, betData);
  toast('⚡ Copied to clipboard! Launching ' + butler.name + ' app...');

  const query = getBookieSearchQuery(betData);
  const links = getBookieDeepLinks(query);
  const targetUrl = links[butler.key] || butler.appUrl + encodeURIComponent(query);
  window.location.href = targetUrl;
}

if (typeof window !== 'undefined') {
  window.getButlerBookmaker = getButlerBookmaker;
  window.setButlerBookmaker = setButlerBookmaker;
  window.openButlerModal = openButlerModal;
  window.closeButlerModal = closeButlerModal;
  window.launchButlerAcca = launchButlerAcca;
  window.launchButlerSingle = launchButlerSingle;
}
'''

if 'THE BET BUTLER: Personal Assistant' not in app:
    app += '\n' + butler_js
    print("Appended Bet Butler JS to app.js.")

# Update customAccaCard with Bet Butler premier 1-tap button
old_custom_bookie_bar = '''    '<div class="slip-bookie-bar" style="margin: 12px 0 8px;">' +
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
    '</div>' +'''

new_custom_bookie_bar = '''    '<div style="margin: 14px 0 10px;">' +
      '<button type="button" class="btn primary butler-acca-launch-btn" onclick="launchButlerAcca(\\'custom\\')" style="width:100%;padding:14px;font-size:15px;font-weight:700;background:linear-gradient(135deg, #0284c7, #0369a1);border:none;border-radius:12px;box-shadow:0 4px 14px rgba(2,132,199,0.35);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">' +
        '<span>⚡</span> 1-Tap Place with <span class="current-butler-name">' + esc(getButlerBookmaker().name) + '</span> (Your Butler) ↗' +
      '</button>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding:0 4px;">' +
        '<span class="dim text-xs" style="color:#94a3b8">Copies slip &amp; opens your app &middot; 2× League Bonus</span>' +
        '<a href="javascript:void(0)" onclick="openButlerModal()" class="text-xs" style="color:var(--cyan);text-decoration:none;font-weight:600;">Change Butler ▾</a>' +
      '</div>' +
    '</div>' +
    '<div class="slip-bookie-bar" style="margin: 8px 0;">' +
      '<div class="slip-bookie-header">' +
        '<span class="slip-bookie-bolt">⚡</span>' +
        '<span class="slip-bookie-title">Or switch bookmaker:</span>' +
      '</div>' +
      '<div class="slip-bookie-buttons" role="group" aria-label="1-Click bookmaker launcher">' +
        '<button type="button" class="bookie-pill coral" data-launch-bookie="coral" data-slip-idx="custom"><span class="pill-dot" style="background:#0284c7;"></span> Coral ↗</button>' +
        '<button type="button" class="bookie-pill sky" data-launch-bookie="skybet" data-slip-idx="custom"><span class="pill-dot" style="background:#38bdf8;"></span> Sky Bet ↗</button>' +
        '<button type="button" class="bookie-pill b365" data-launch-bookie="bet365" data-slip-idx="custom"><span class="pill-dot" style="background:#10b981;"></span> Bet365 ↗</button>' +
        '<button type="button" class="bookie-pill bf" data-launch-bookie="betfair" data-slip-idx="custom"><span class="pill-dot" style="background:#fbbf24;"></span> Betfair ↗</button>' +
      '</div>' +
    '</div>' +'''

if old_custom_bookie_bar in app:
    app = app.replace(old_custom_bookie_bar, new_custom_bookie_bar)
    print("Replaced customAccaCard with Butler 1-tap launcher.")

# Wire data-launch-butler-single in click delegation
delegate_target = '  // Football acca addition'
butler_single_delegate = '''  // Bet Butler single launch
  if (t.dataset.launchButlerSingle !== undefined || (t.closest && t.closest('[data-launch-butler-single]'))) {
    const btn = t.dataset.launchButlerSingle !== undefined ? t : t.closest('[data-launch-butler-single]');
    try {
      const data = JSON.parse(btn.dataset.launchButlerSingle);
      launchButlerSingle(data);
    } catch (e) { console.error(e); }
    return;
  }

'''

if delegate_target in app and 'Bet Butler single launch' not in app:
    app = app.replace(delegate_target, butler_single_delegate + delegate_target)
    print("Wired click delegation for data-launch-butler-single.")

# Update marketCard Place Bet button to use Bet Butler
old_market_place_btn = '\'<button type="button" class="btn-place-bet-inline" data-open-bookie=\\\'\''
new_market_place_btn = '\'<button type="button" class="btn-place-bet-inline butler-btn" data-launch-butler-single=\\\'\''
if old_market_place_btn in app:
    app = app.replace(old_market_place_btn, new_market_place_btn)
    print("Updated marketCard Place Bet buttons to Butler 1-tap.")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app)
print("Updated app.js successfully.")
