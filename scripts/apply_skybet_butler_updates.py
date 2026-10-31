"""Apply Sky Bet setup, Bet Butler promotion hero box, bonus points, and remove unsupported bookies."""
import re
from pathlib import Path

# --- 1. Update index.html ---
index_path = Path("index.html")
index_html = index_path.read_text(encoding="utf-8")

# Update header butler name from Coral to Sky Bet
index_html = index_html.replace(
    '<span class="butler-label">Butler: <b id="header-butler-name">Coral</b></span>',
    '<span class="butler-label">Butler: <b id="header-butler-name">Sky Bet</b></span>'
)

# Update butler-modal grid to feature Sky Bet as verified app and remove unsupported bookmakers
old_butler_grid_pattern = re.compile(
    r'<div class="butler-bookie-grid" role="radiogroup" aria-label="Select your preferred bookmaker">.*?</div>\s*<div class="butler-perks-box">',
    re.DOTALL
)

new_butler_grid = """<div class="butler-bookie-grid" role="radiogroup" aria-label="Select your preferred bookmaker">
        <!-- Sky Bet Verified App -->
        <button type="button" class="butler-choice-card active" data-select-butler="skybet" onclick="setButlerBookmaker('skybet')">
          <div class="butler-choice-top">
            <span class="bookie-tag skybet">SKY BET</span>
            <span class="butler-active-check" id="check-skybet" style="display:inline-block;">✓ Official Verified App</span>
          </div>
          <strong>Sky Bet App</strong>
          <span class="text-sm muted">Verified 1-Tap App Integration: Accas, RequestABet, AccaFreeze &amp; Return Bridge.</span>
        </button>
      </div>

      <div class="butler-perks-box">
        <div class="butler-perk-item"><span>🏆</span> <strong>+5 League Bonus Points:</strong> Every real bet placed via Bet Butler and verified by the Return Bridge awards +5 extra points on your league leaderboard!</div>
        <div class="butler-perk-item"><span>⚡</span> <strong>Zero Manual Typing:</strong> Bet Butler passes your selections directly into your installed Sky Bet app.</div>
        <div class="butler-perk-item"><span>🔄</span> <strong>Return Bridge:</strong> Seamlessly brings you back to Bet Buddy to record odds, stake, and track cumulative P&amp;L in your Bet Diary.</div>
      </div>"""

if '<div class="butler-bookie-grid"' in index_html:
    # Find start and end of butler grid and perks box
    start_pos = index_html.find('<div class="butler-bookie-grid"')
    end_marker = '<div class="responsible-gambling-note"'
    end_pos = index_html.find(end_marker, start_pos)
    if start_pos != -1 and end_pos != -1:
        # replace up to end_pos
        index_html = index_html[:start_pos] + new_butler_grid + "\n\n      " + index_html[end_pos:]
        print("Updated butler-modal in index.html")
    else:
        print("Warning: could not locate butler-modal bounds in index.html")

# Update return-bookie-modal copy for Sky Bet and +5 Bonus Points
index_html = index_html.replace(
    'Confirm your real bet to unlock 2x League Bonus',
    'Confirm your real bet to unlock +5 League Bonus Points'
)
index_html = index_html.replace(
    '<p style="margin:0 0 14px;font-size:13px;color:#cbd5e1;">Did you place this bet on <strong id="return-bookie-confirm-name">Coral</strong>?</p>',
    '<p style="margin:0 0 14px;font-size:13px;color:#cbd5e1;">Did you place this bet on <strong id="return-bookie-confirm-name">Sky Bet</strong>?</p>'
)
index_html = index_html.replace(
    '✓ Yes, Bet Placed! (Save &amp; Claim 2× Bonus)',
    '✓ Yes, Bet Placed! (Save &amp; Claim +5 Bonus Points)'
)

index_path.write_text(index_html, encoding="utf-8")
print("Saved index.html")

# --- 2. Update styles.css ---
styles_path = Path("styles.css")
styles_css = styles_path.read_text(encoding="utf-8")

new_styles = """
/* ------------------------------------------------------------ Bet Butler Home Hero Showcase & Prominent Bookie Button */
.butler-home-hero-card {
  margin-top: 16px;
  margin-bottom: 8px;
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.16), rgba(15, 23, 42, 0.85));
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 16px;
  padding: 20px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
.butler-home-hero-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 140px;
  height: 140px;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, transparent 70%);
  pointer-events: none;
}
.butler-home-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  color: #e0f2fe;
  margin-bottom: 10px;
}
.butler-bonus-tag {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
}
.butler-home-title {
  margin: 0 0 8px;
  font-size: 1.25rem;
  color: #fff;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.butler-home-desc {
  margin: 0 0 14px;
  font-size: 13.5px;
  color: #cbd5e1;
  line-height: 1.5;
  max-width: 680px;
}
.butler-home-features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}
.butler-feat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: #f1f5f9;
  background: rgba(255, 255, 255, 0.04);
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.butler-home-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.bookie-pill.sky-prominent {
  width: 100%;
  padding: 10px 14px;
  font-size: 13.5px;
  font-weight: 700;
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.25), rgba(56, 189, 248, 0.2));
  border: 1px solid rgba(56, 189, 248, 0.5);
  color: #38bdf8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 10px;
  transition: all .15s ease;
}
.bookie-pill.sky-prominent:hover {
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.4), rgba(56, 189, 248, 0.35));
  border-color: #38bdf8;
  box-shadow: 0 0 16px rgba(56, 189, 248, 0.35);
  transform: translateY(-1px);
}
.slip-bookie-buttons.verified-only {
  display: block;
  margin-top: 8px;
}
"""

if ".butler-home-hero-card" not in styles_css:
    styles_css += new_styles
    styles_path.write_text(styles_css, encoding="utf-8")
    print("Added butler hero styles to styles.css")

# --- 3. Update app.js ---
app_path = Path("app.js")
app_js = app_path.read_text(encoding="utf-8")

# Fix ANDROID_PACKAGES: correct skybet package to com.skybet.android and remove unsupported
old_android_packages = """const ANDROID_PACKAGES = {
  coral: 'com.galacoral.android',
  skybet: 'com.skybet.app.skybet',
  bet365: 'com.bet365Wrapper.sportsbook',
  betfair: 'com.betfair.sports',
  ladbrokes: 'com.ladbrokes.android',
  williamhill: 'com.williamhill.sportsbook',
  paddypower: 'com.paddypower.sports'
};"""

new_android_packages = """const ANDROID_PACKAGES = {
  skybet: 'com.skybet.android'
};"""

if old_android_packages in app_js:
    app_js = app_js.replace(old_android_packages, new_android_packages)
    print("Updated ANDROID_PACKAGES with com.skybet.android")
else:
    print("Warning: old_android_packages not matched directly")

# Fix BOOKMAKERS_CONFIG: set skybet as primary and default
old_bookmakers_config_start = "const BOOKMAKERS_CONFIG = {"
old_bookmakers_config_end = "function getButlerBookmaker() {"

cfg_start_idx = app_js.find(old_bookmakers_config_start)
cfg_end_idx = app_js.find(old_bookmakers_config_end)

if cfg_start_idx != -1 and cfg_end_idx != -1:
    new_bookmakers_config = """const BOOKMAKERS_CONFIG = {
  skybet: { key: 'skybet', name: 'Sky Bet', tag: 'SKY BET', color: '#38bdf8', perk: 'Official 1-Tap App Integration, AccaFreeze & RequestABet', appUrl: 'https://m.skybet.com/search?q=' }
};

function getButlerBookmaker() {
  return BOOKMAKERS_CONFIG.skybet;
}
"""
    # Replace from cfg_start_idx through getButlerBookmaker end
    after_fn = app_js.find("function setButlerBookmaker", cfg_end_idx)
    app_js = app_js[:cfg_start_idx] + new_bookmakers_config + "\n" + app_js[after_fn:]
    print("Updated BOOKMAKERS_CONFIG and getButlerBookmaker")
else:
    print("Warning: BOOKMAKERS_CONFIG markers not found")

# Update Acca Builder bookmaker buttons to verified Sky Bet prominent button
old_builder_pills_1 = """      '<div class="slip-bookie-buttons" role="group" aria-label="1-Click bookmaker launcher">' +
        '<button type="button" class="bookie-pill coral" data-launch-bookie="coral" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#0284c7;"></span> Coral ↗</button>' +
        '<button type="button" class="bookie-pill sky" data-launch-bookie="skybet" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#38bdf8;"></span> Sky Bet ↗</button>' +
        '<button type="button" class="bookie-pill b365" data-launch-bookie="bet365" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#10b981;"></span> Bet365 ↗</button>' +
        '<button type="button" class="bookie-pill bf" data-launch-bookie="betfair" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#fbbf24;"></span> Betfair ↗</button>' +
      '</div>'"""

new_builder_pills_1 = """      '<div class="slip-bookie-buttons verified-only" role="group" aria-label="1-Click bookmaker launcher">' +
        '<button type="button" class="bookie-pill sky sky-prominent" data-launch-bookie="skybet" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#38bdf8;"></span> ⚡ Open in Sky Bet App (+5 League Bonus) ↗</button>' +
      '</div>'"""

if old_builder_pills_1 in app_js:
    app_js = app_js.replace(old_builder_pills_1, new_builder_pills_1)
    print("Updated Acca builder pills 1")

old_builder_pills_2 = """      '<div class="slip-bookie-buttons" role="group" aria-label="1-Click bookmaker launcher">' +
        '<button type="button" class="bookie-pill coral" data-launch-bookie="coral" data-slip-idx="custom"><span class="pill-dot" style="background:#0284c7;"></span> Coral ↗</button>' +
        '<button type="button" class="bookie-pill sky" data-launch-bookie="skybet" data-slip-idx="custom"><span class="pill-dot" style="background:#38bdf8;"></span> Sky Bet ↗</button>' +
        '<button type="button" class="bookie-pill b365" data-launch-bookie="bet365" data-slip-idx="custom"><span class="pill-dot" style="background:#10b981;"></span> Bet365 ↗</button>' +
        '<button type="button" class="bookie-pill bf" data-launch-bookie="betfair" data-slip-idx="custom"><span class="pill-dot" style="background:#fbbf24;"></span> Betfair ↗</button>' +
      '</div>'"""

new_builder_pills_2 = """      '<div class="slip-bookie-buttons verified-only" role="group" aria-label="1-Click bookmaker launcher">' +
        '<button type="button" class="bookie-pill sky sky-prominent" data-launch-bookie="skybet" data-slip-idx="custom"><span class="pill-dot" style="background:#38bdf8;"></span> ⚡ Open Custom Acca in Sky Bet App (+5 League Bonus) ↗</button>' +
      '</div>'"""

if old_builder_pills_2 in app_js:
    app_js = app_js.replace(old_builder_pills_2, new_builder_pills_2)
    print("Updated Acca builder pills 2 (custom)")

# Update getUserLeagueStats to award +5 bonus points on verified Bet Butler bets
old_calc_points = """  // Option A Scoring: (Decimal Odds - 1) * 10 on won; -2 on lost; 0 on void
  const points = leagueBets.reduce((sum, e) => sum + (calc.calculateLeaguePoints(e.odds, e.outcome) || 0), 0);"""

new_calc_points = """  // Option A Scoring: (Decimal Odds - 1) * 10 on won; -2 on lost; 0 on void
  // Official Bet Butler Bonus: +5 points on every settled winning qualifying bet placed through Bet Butler
  const points = leagueBets.reduce((sum, e) => {
    const base = calc.calculateLeaguePoints(e.odds, e.outcome) || 0;
    const bonus = (e.realBetVerified && e.outcome === 'won') ? 5 : 0;
    return sum + base + bonus;
  }, 0);"""

if old_calc_points in app_js:
    app_js = app_js.replace(old_calc_points, new_calc_points)
    print("Updated getUserLeagueStats with +5 Butler bonus")

# Update Fair Play banner text in app.js
old_fair_play = "<div><strong>Fair Play Rule (1 Bet Per Day Cap):</strong> Exactly <strong>1 settled bet per calendar day</strong> counts toward your league score. Placing multiple small bets on the same day in your diary will not inflate your score.</div>"
new_fair_play = "<div><strong>Fair Play &amp; Bet Butler Bonus:</strong> Exactly <strong>1 settled bet per calendar day</strong> counts toward your league score. Official bets placed via <strong>The Bet Butler (Sky Bet)</strong> earn <strong>+5 League Bonus Points</strong> upon winning!</div>"

if old_fair_play in app_js:
    app_js = app_js.replace(old_fair_play, new_fair_play)
    print("Updated Fair Play banner in app.js")

# Add Hero Box in renderWelcomeHero
hero_box_code = """
    <!-- Bet Butler Feature Hero Card -->
    <div class="butler-home-hero-card">
      <div class="butler-home-hero-content">
        <div class="butler-home-badge">
          <span class="badge-dot" style="background:#38bdf8;"></span>
          <span>🤵 Official App Hand-Off: Sky Bet</span>
          <span class="butler-bonus-tag">🏆 +5 League Bonus Points</span>
        </div>
        <h2 class="butler-home-title">1-Tap Bookie Hand-Off with The Bet Butler</h2>
        <p class="butler-home-desc">
          Stop retyping match names and searching for odds. Bet Butler transfers your calculated Accas and value bets straight into your installed <strong>Sky Bet</strong> app. One tap launches the app ready to place, and the Return Bridge logs your real bets for <strong>+5 bonus points in your leagues</strong>.
        </p>
        <div class="butler-home-features">
          <div class="butler-feat-item"><span class="feat-icon">⚡</span> 1-Tap App Launch</div>
          <div class="butler-feat-item"><span class="feat-icon">📋</span> Automatic Slip Transfer</div>
          <div class="butler-feat-item"><span class="feat-icon">🏆</span> +5 League Bonus Points</div>
          <div class="butler-feat-item"><span class="feat-icon">🔄</span> Return Bridge Diary Sync</div>
        </div>
        <div class="butler-home-actions">
          <a href="#/picks" class="btn primary small" style="background:#0284c7;border:none;font-weight:700;">Build Acca for Sky Bet ↗</a>
          <button type="button" class="btn small" onclick="openButlerModal()">Butler Info &amp; Settings ⚙️</button>
        </div>
      </div>
    </div>
"""

old_portal_grid = "'<!-- 2. Main Feature: Pick a Bet & Build Acca -->'"
# We will insert hero_box_code right before '<!-- 3. Smaller Boxes: 2x2 on Mobile'
old_subgrid_marker = "'<!-- 3. Smaller Boxes: 2x2 on Mobile, all visible without scrolling -->'"

if old_subgrid_marker in app_js:
    app_js = app_js.replace(old_subgrid_marker, hero_box_code + "    " + old_subgrid_marker)
    print("Added Bet Butler Hero Box to renderWelcomeHero")
else:
    print("Warning: old_subgrid_marker not found")

# Update confirmRealBetPlaced notes and toast
old_confirm_notes = "notes: 'Real bet placed at ' + launch.bookie + '. 2× League Bonus Active.'"
new_confirm_notes = "notes: 'Official real bet placed at Sky Bet via Bet Butler (+5 League Bonus Active).', bonusPoints: 5"

if old_confirm_notes in app_js:
    app_js = app_js.replace(old_confirm_notes, new_confirm_notes)

old_confirm_toast = "toast('🎉 ' + launch.bookie + ' real bet confirmed! Added to Bet Diary with 2× League Bonus.');"
new_confirm_toast = "toast('🎉 Sky Bet real bet confirmed! Added to Bet Diary with +5 League Bonus.');"

if old_confirm_toast in app_js:
    app_js = app_js.replace(old_confirm_toast, new_confirm_toast)

app_path.write_text(app_js, encoding="utf-8")
print("Saved app.js")

