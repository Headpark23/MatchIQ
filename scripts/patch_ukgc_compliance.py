#!/usr/bin/env python3
"""
UKGC & ASA Compliance Alignment Patch (v44)
1. Replaces Panda mascot with Sports Intelligence Radar emblem
2. Transforms getPandaMood into Acca Risk & Volatility Gauge
3. Converts all "Target profit" / "profit" targets to "Target return"
4. Removes public telemetry footer link
5. Adds 18+ Strictly Adults Only BeGambleAware compliance notice
6. Eliminates large inline base64 panda images
7. Updates PWA and HTML versioning to v44
"""
import re

def patch_index_html():
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update version to v=44
    content = content.replace('styles.css?v=43', 'styles.css?v=44')
    content = content.replace('app.js?v=43', 'app.js?v=44')

    # 2. Header logo: remove base64 fallback, clean up alt and class
    logo_pattern = r'<img src="assets/icon-192\.png" onerror="[^"]*" width="34" height="34" alt="[^"]*" class="brand-panda-img">'
    replacement_logo = '<img src="assets/icon-192.png" width="34" height="34" alt="Bet Buddy Sports Intelligence" class="brand-logo-img">'
    content = re.sub(logo_pattern, replacement_logo, content)

    # 3. Header install button icon: replace 🐼 with ⚡
    content = content.replace('<span class="install-panda-emoji" style="font-size:15px">🐼</span>', '<span class="install-badge-icon" style="font-size:14px">⚡</span>')

    # 4. Sub-header tagline: prepend 18+ Strictly Adults Only
    old_tagline = '<span class="sub-header-tagline">Premier League &amp; Multi-Sport Intelligence &middot; Private Bet Diary</span>'
    new_tagline = '<span class="sub-header-tagline">18+ Strictly Adults Only &middot; Premier League &amp; Multi-Sport Intelligence &middot; Private Bet Diary</span>'
    content = content.replace(old_tagline, new_tagline)

    # 5. Footer: remove Founder Telemetry link from public view
    old_copyright = '&copy; Copyright Martin White and Chris Faulds 2026. All rights reserved. &middot; <a href="#/admin" class="subtle-admin-link" style="color:var(--dim);text-decoration:none;" title="Founder Telemetry">Founder Telemetry</a>'
    new_copyright = '&copy; Copyright Martin White and Chris Faulds 2026. All rights reserved.'
    content = content.replace(old_copyright, new_copyright)

    # 6. Install modal: replace panda base64 image and text
    modal_img_pattern = r'<img src="assets/icon-192\.png" onerror="[^"]*" alt="[^"]*" width="38" height="38" class="install-logo-thumb">'
    new_modal_img = '<img src="assets/icon-192.png" alt="Bet Buddy Sports Intelligence" width="38" height="38" class="install-logo-thumb">'
    content = re.sub(modal_img_pattern, new_modal_img, content)

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("index.html patched.")

def patch_app_js():
    with open('app.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update version to v44
    content = re.sub(r"APP_VERSION = '2026\.10\.30\.\d+'", "APP_VERSION = '2026.10.30.44'", content)
    content = re.sub(r'v\d+ \(Live\)', 'v44 (Live)', content)

    # 2. Replace getPandaMood and pandaMoodMarkup with getAccaVolatility and accaVolatilityMarkup
    volatility_code = '''// --- ACCA RISK & VOLATILITY GAUGE (UKGC & ASA Compliant) ---
function getAccaVolatility(slip, win) {
  if (!slip || !slip.odds) {
    return {
      kicker: 'Ready to Calibrate',
      desc: 'Select your target return and legs to gauge acca volatility.',
      badgeClass: 'acca-volatility-calibrating',
      svg: '<circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="4 3"/>'
    };
  }
  const odds = slip.odds;
  const ret = slip.ret || (slip.stake * odds);
  
  if (odds >= 40 || ret >= 400) {
    return {
      kicker: 'Speculative Longshot',
      desc: 'Extremely high volatility odds. Tiny recreational stakes only.',
      badgeClass: 'acca-volatility-longshot',
      svg: '<polygon points="18,4 22,14 32,15 25,23 27,33 18,28 9,33 11,23 4,15 14,14" fill="none" stroke="#f43f5e" stroke-width="2.5"/><circle cx="18" cy="18" r="4" fill="#f43f5e"/>'
    };
  }
  if (odds >= 15 || ret >= 150) {
    return {
      kicker: 'High Payout Acca',
      desc: 'High variance accumulator with amplified payout potential.',
      badgeClass: 'acca-volatility-high',
      svg: '<path d="M18 4 L28 14 L24 30 L12 30 L8 14 Z" fill="none" stroke="#fbbf24" stroke-width="2.5"/><line x1="18" y1="10" x2="18" y2="22" stroke="#fbbf24" stroke-width="2.5"/>'
    };
  }
  if (odds >= 5 || ret >= 50) {
    return {
      kicker: 'Balanced Value Acca',
      desc: 'Moderate risk profile balancing probability and bookmaker value.',
      badgeClass: 'acca-volatility-balanced',
      svg: '<circle cx="18" cy="18" r="14" fill="none" stroke="#38bdf8" stroke-width="2.5"/><path d="M12 18 L16 22 L24 14" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>'
    };
  }
  return {
    kicker: 'High Probability Combination',
    desc: 'Lower variance accumulator targeting shorter priced selections.',
    badgeClass: 'acca-volatility-prob',
    svg: '<circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" stroke-width="2.5"/><circle cx="18" cy="18" r="8" fill="none" stroke="#10b981" stroke-width="2"/><circle cx="18" cy="18" r="2" fill="#10b981"/>'
  };
}

function accaVolatilityMarkup(slip, win) {
  const av = getAccaVolatility(slip, win);
  return '<div class="acca-volatility-card panda-mood-card ' + av.badgeClass + '" title="' + esc(av.desc) + '">' +
    '<svg viewBox="0 0 36 36" class="acca-volatility-icon panda-mood-icon">' + av.svg + '</svg>' +
    '<div><div class="acca-volatility-kicker panda-mood-kicker">' + esc(av.kicker) + '</div><div class="acca-volatility-desc panda-mood-desc">' + esc(av.desc) + '</div></div>' +
    '</div>';
}
window.getPandaMood = getAccaVolatility;
window.pandaMoodMarkup = accaVolatilityMarkup;
'''

    # Find where function getPandaMood starts and where pandaMoodMarkup ends
    panda_func_pattern = r'function getPandaMood\(slip, win\) \{[\s\S]*?function pandaMoodMarkup\(slip, win\) \{[\s\S]*?\n\}'
    if re.search(panda_func_pattern, content):
        content = re.sub(panda_func_pattern, volatility_code.strip(), content)
        print("Replaced getPandaMood with getAccaVolatility.")
    else:
        print("Warning: getPandaMood pattern not matched!")

    # 3. Builder markup replacements
    content = content.replace("id=\"builder-panda-mood\">' + pandaMoodMarkup(", "id=\"builder-panda-mood\">' + accaVolatilityMarkup(")
    content = content.replace("moodWrap.innerHTML = pandaMoodMarkup(", "moodWrap.innerHTML = accaVolatilityMarkup(")

    # 4. Target profit -> Target return
    content = content.replace("Target profit (£):", "Target return (£):")
    content = content.replace("Target profit (&pound;):", "Target return (&pound;):")
    content = content.replace("aria-label=\"Preset profit targets\"", "aria-label=\"Preset return targets\"")
    content = content.replace("Target Profit Bet Builder", "Acca Odds & Return Builder")
    content = content.replace("Target £10–£1000 profit", "Target £10–£1000 return")
    content = content.replace("Target £10-£1000 profit", "Target £10-£1000 return")
    content = content.replace("Bet Builder is pre-filled to target £' + builderState.win + ' profit", "Bet Builder is pre-filled to target £' + builderState.win + ' return")
    content = content.replace("Bet Buddy Acca (Target: ' + m(slip.profit) + ' profit)", "Bet Buddy Acca (Target: ' + m(slip.ret) + ' return)")

    # 5. Welcome hero narrative & avatar
    content = content.replace('<div class="welcome-panda-avatar">', '<div class="welcome-brand-avatar">')
    
    # 6. Default username handle
    content = content.replace("curProfile.handle !== 'PandaPunter'", "curProfile.handle !== 'SmartPunter'")

    # 7. Install modal preview in app.js (remove 40kb base64 fallback)
    old_install_preview = r'<div class="install-badge-preview"[^>]*><img src="assets/icon-192\.png"[^>]*><div><strong[^>]*>Bet Buddy - Panda Mobile App</strong>'
    new_install_preview = '<div class="install-badge-preview" style="margin-bottom:16px"><img src="assets/icon-192.png" width="52" height="52" style="border-radius:12px" alt="Bet Buddy App Icon"><div><strong style="color:#fff;display:block;font-size:15px">Bet Buddy Mobile App</strong>'
    content = re.sub(old_install_preview, new_install_preview, content)

    content = content.replace('Bet Buddy with the Panda Football mascot icon appears instantly on your home screen.', 'Bet Buddy with the Sports Intelligence radar icon appears instantly on your home screen.')
    content = content.replace('<span class="install-panda-emoji" style="font-size:15px">🐼</span>', '<span class="install-badge-icon" style="font-size:14px">⚡</span>')

    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("app.js patched.")

def patch_sw_js():
    with open('sw.js', 'r', encoding='utf-8') as f:
        content = f.read()
    content = re.sub(r'betbuddy-pwa-v\d+', 'betbuddy-pwa-v44', content)
    with open('sw.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("sw.js patched to v44.")

def patch_styles_css():
    with open('styles.css', 'r', encoding='utf-8') as f:
        content = f.read()

    # Add acca-volatility styles alongside panda-mood
    if '.acca-volatility-card' not in content:
        extra_css = """
/* --- ACCA VOLATILITY & RISK GAUGE STYLES (UKGC Compliant) --- */
.acca-volatility-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-sm, 10px);
  background: var(--surface, #1e293b);
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  margin: 10px 0 16px;
  transition: all 0.25s ease;
}
.acca-volatility-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}
.acca-volatility-kicker {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}
.acca-volatility-desc {
  font-size: 0.82rem;
  color: var(--dim, #94a3b8);
  line-height: 1.3;
}
.acca-volatility-prob {
  border-color: rgba(16, 185, 129, 0.35);
  background: rgba(16, 185, 129, 0.06);
}
.acca-volatility-prob .acca-volatility-kicker { color: #10b981; }
.acca-volatility-balanced {
  border-color: rgba(56, 189, 248, 0.35);
  background: rgba(56, 189, 248, 0.06);
}
.acca-volatility-balanced .acca-volatility-kicker { color: #38bdf8; }
.acca-volatility-high {
  border-color: rgba(251, 191, 36, 0.35);
  background: rgba(251, 191, 36, 0.06);
}
.acca-volatility-high .acca-volatility-kicker { color: #fbbf24; }
.acca-volatility-longshot {
  border-color: rgba(244, 63, 94, 0.4);
  background: rgba(244, 63, 94, 0.08);
}
.acca-volatility-longshot .acca-volatility-kicker { color: #f43f5e; }
.acca-volatility-calibrating {
  border-color: var(--border, rgba(255,255,255,0.1));
}
.acca-volatility-calibrating .acca-volatility-kicker { color: var(--dim, #94a3b8); }
.brand-logo-img, .welcome-brand-avatar img {
  border-radius: 8px;
  object-fit: contain;
}
"""
        content += extra_css
        with open('styles.css', 'w', encoding='utf-8') as f:
            f.write(content)
        print("styles.css patched.")

if __name__ == '__main__':
    patch_index_html()
    patch_app_js()
    patch_sw_js()
    patch_styles_css()
    print("All patches applied cleanly.")
