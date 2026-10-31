import re
from pathlib import Path

# 1. Update app.js
app_p = Path("app.js")
code = app_p.read_text(encoding="utf-8")

# Replace Home Hero Card
old_home_hero = """      '<!-- Bet Butler Feature Hero Card -->' +
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
            '<a href="#/picks" class="btn primary small" style="background:#0284c7;border:none;font-weight:700;">Build Acca for Sky Bet ↗</a>' +
            '<button type="button" class="btn small" onclick="openButlerModal()">Butler Info &amp; Settings ⚙️</button>' +
          '</div>' +
        '</div>' +
      '</div>' +"""

new_home_hero = """      '<!-- Bet Butler Feature Hero Card -->' +
      '<div class="butler-home-hero-card">' +
        '<div class="butler-home-hero-content">' +
          '<div class="butler-home-badge">' +
            '<span class="badge-dot" style="background:#38bdf8;"></span>' +
            '<span>🤵 Your Slip Note: The Bet Butler</span>' +
          '</div>' +
          '<h2 class="butler-home-title">Keep Your Slip In Front Of You With Bet Butler</h2>' +
          '<p class="butler-home-desc">' +
            'Keep your slip in front of you while you add the bets in your bookmaker app. Open your slip card, tick off legs as you enter them, or copy formatted selections with one tap.' +
          '</p>' +
          '<div class="butler-home-features">' +
            '<div class="butler-feat-item"><span class="feat-icon">📋</span> Slip Card Checklist</div>' +
            '<div class="butler-feat-item"><span class="feat-icon">☑️</span> Tick Off Legs in View</div>' +
            '<div class="butler-feat-item"><span class="feat-icon">📑</span> 1-Click Formatted Copy</div>' +
            '<div class="butler-feat-item"><span class="feat-icon">📱</span> Open Bookmaker Football</div>' +
          '</div>' +
          '<div class="butler-home-actions">' +
            '<a href="#/picks" class="btn primary small" style="background:#0284c7;border:none;font-weight:700;">Build Acca in Picks ↗</a>' +
            '<button type="button" class="btn small" onclick="openButlerModal()">Bookmaker Links &amp; Settings ⚙️</button>' +
          '</div>' +
        '</div>' +
      '</div>' +"""

if old_home_hero in code:
    code = code.replace(old_home_hero, new_home_hero)
    print("Replaced Home hero butler card with honest slip note card")
else:
    print("WARNING: old_home_hero not found directly, trying normalized match")
    # try normalized
    old_norm = "\n".join(l.strip() for l in old_home_hero.splitlines())
    # find by key phrases
    start_str = "'<!-- Bet Butler Feature Hero Card -->'"
    end_str = "'<!-- 3. Smaller Boxes: 2x2 on Mobile, all visible without scrolling -->'"
    if start_str in code and end_str in code:
        idx1 = code.index(start_str)
        idx2 = code.index(end_str)
        code = code[:idx1] + new_home_hero + "\n\n      " + code[idx2:]
        print("Replaced Home hero card by section index")

# Replace customAccaCard leftover bonus and fake launcher
old_custom_bonus = """      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding:0 4px;">' +
        '<span class="dim text-xs" style="color:#94a3b8">Copies slip &amp; opens your app &middot; 2× League Bonus</span>' +
        '<a href="javascript:void(0)" onclick="openButlerModal()" class="text-xs" style="color:var(--cyan);text-decoration:none;font-weight:600;">Change Butler ▾</a>' +
      '</div>' +
    '</div>' +
    '<div class="slip-bookie-bar" style="margin: 8px 0;">' +
      '<div class="slip-bookie-header">' +
        '<span class="slip-bookie-bolt">⚡</span>' +
        '<span class="slip-bookie-title">Or switch bookmaker:</span>' +
      '</div>' +
      '<div class="slip-bookie-buttons verified-only" role="group" aria-label="1-Click bookmaker launcher">' +
        '<button type="button" class="bookie-pill sky sky-prominent" data-launch-bookie="skybet" data-slip-idx="custom"><span class="pill-dot" style="background:#38bdf8;"></span> ⚡ Open Custom Acca in Sky Bet App (+5 League Bonus) ↗</button>' +
      '</div>' +
    '</div>' +"""

new_custom_bonus = """      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding:0 4px;">' +
        '<span class="dim text-xs" style="color:#94a3b8">Tick off legs in slip note while placing in your bookmaker app</span>' +
        '<a href="javascript:void(0)" onclick="openButlerModal()" class="text-xs" style="color:var(--cyan);text-decoration:none;font-weight:600;">Change Bookmaker ▾</a>' +
      '</div>' +
    '</div>' +"""

if old_custom_bonus in code:
    code = code.replace(old_custom_bonus, new_custom_bonus)
    print("Removed 2x / +5 bonus from customAccaCard")
else:
    print("WARNING: old_custom_bonus not found directly, doing regex replace")
    code = re.sub(
        r"'<div style=\"display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding:0 4px;\">'.*?<\/div>' \+\s*'<\/div>' \+",
        new_custom_bonus,
        code,
        flags=re.DOTALL
    )

# Replace commercial claims
old_comm = """      '<div class="card commercial-pitch-card">' +
        '<div class="portal-card-top"><span class="portal-pill">🎯 Direct Transfer</span></div>' +
        '<h3 class="card-title" style="margin-top:8px">1-Click Betslip Deep-Linking</h3>' +
        '<p class="muted" style="font-size:13px;line-height:1.5">Deep-link integration into licensed UK sportsbooks (Bet365, Sky Bet, Paddy Power, Ladbrokes, Coral, William Hill, Betfair, Unibet) with tracked affiliate attribution.</p>' +
      '</div>' +"""

new_comm = """      '<div class="card commercial-pitch-card">' +
        '<div class="portal-card-top"><span class="portal-pill">🎯 Outbound Links</span></div>' +
        '<h3 class="card-title" style="margin-top:8px">Bookmaker Deep-Linking &amp; Slip Notes</h3>' +
        '<p class="muted" style="font-size:13px;line-height:1.5">Direct outbound links into licensed UK sportsbooks (Sky Bet, Bet365, William Hill, Paddy Power, Betfair, Coral, Ladbrokes) with tracked affiliate attribution.</p>' +
      '</div>' +"""

if old_comm in code:
    code = code.replace(old_comm, new_comm)
    print("Updated commercial pitch to honest wording")

# Update version string to v63
code = re.sub(r"v6[0-2]", "v63", code)

app_p.write_text(code, encoding="utf-8")
print("app.js updated successfully")

# 2. Update index.html version tags
index_p = Path("index.html")
i_code = index_p.read_text(encoding="utf-8")
i_code = re.sub(r'styles\.css\?v=\d+', 'styles.css?v=63', i_code)
i_code = re.sub(r'market_calculations\.js\?v=\d+', 'market_calculations.js?v=63', i_code)
i_code = re.sub(r'bet_builder\.js\?v=\d+', 'bet_builder.js?v=63', i_code)
i_code = re.sub(r'app\.js\?v=\d+', 'app.js?v=63', i_code)
i_code = re.sub(r'v6[0-2]', 'v63', i_code)
index_p.write_text(i_code, encoding="utf-8")
print("index.html query params bumped to v63")

# 3. Update sw.js cache name
sw_p = Path("sw.js")
sw_code = sw_p.read_text(encoding="utf-8")
sw_code = re.sub(r"betbuddy-pwa-v\d+", "betbuddy-pwa-v63", sw_code)
sw_code = re.sub(r"// Bet Buddy Progressive Web App Service Worker \(v\d+\)", "// Bet Buddy Progressive Web App Service Worker (v63)", sw_code)
sw_p.write_text(sw_code, encoding="utf-8")
print("sw.js cache name bumped to betbuddy-pwa-v63")
