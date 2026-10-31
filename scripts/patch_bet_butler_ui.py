"""Patch Bet Butler UI:
1. Make Bet Butler button long, elegant, and unsquashed across desktop and mobile.
2. Transform bookmaker dropdown into a clean left-aligned list with distinct interactive checkboxes.
3. Update app.js and bump versions to v76.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# -------------------------------------------------------------
# 1. Update index.html
# -------------------------------------------------------------
index_path = ROOT / 'index.html'
with open(index_path, 'r', encoding='utf-8') as f:
    index_html = f.read()

# Update header button label from "Butler: ..." to "Bet Butler: ..."
old_header_btn = """      <button type="button" class="butler-pill-btn" id="header-butler-btn" onclick="openButlerModal()" title="Your Bet Butler: Choose your bookmaker slip note">
        <span class="butler-icon">🤵</span>
        <span class="butler-label">Butler: <b id="header-butler-name">Sky Bet</b></span>
        <span class="butler-caret">▾</span>
      </button>"""

new_header_btn = """      <button type="button" class="butler-pill-btn" id="header-butler-btn" onclick="openButlerModal()" title="Your Bet Butler: Choose your bookmaker slip note">
        <span class="butler-icon">🤵</span>
        <span class="butler-label">Bet Butler: <b id="header-butler-name">Sky Bet</b></span>
        <span class="butler-caret">▾</span>
      </button>"""

if old_header_btn in index_html:
    index_html = index_html.replace(old_header_btn, new_header_btn)
    print("Updated header-butler-btn in index.html")

# Update bookmaker choices in modal to include checkboxes and left-aligned layout
old_grid_regex = r'<div class="butler-bookie-grid" role="radiogroup" aria-label="Select your preferred bookmaker">[\s\S]*?</div>\s*<div class="butler-perks-box"'

new_grid = """<div class="butler-bookie-grid" role="radiogroup" aria-label="Select your preferred bookmaker">
        <!-- Sky Bet -->
        <button type="button" class="butler-choice-card" data-select-butler="skybet" onclick="setButlerBookmaker('skybet')" role="radio" aria-checked="false">
          <div class="butler-choice-left">
            <span class="butler-checkbox" id="check-box-skybet">
              <svg viewBox="0 0 24 24" class="butler-check-svg" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span class="bookie-tag skybet">SKY</span>
            <div class="butler-choice-details">
              <strong>Sky Bet</strong>
              <span class="butler-choice-sub">UK Football &amp; Acca Markets</span>
            </div>
          </div>
          <span class="butler-active-pill" id="check-skybet">Active ✓</span>
        </button>

        <!-- bet365 -->
        <button type="button" class="butler-choice-card" data-select-butler="bet365" onclick="setButlerBookmaker('bet365')" role="radio" aria-checked="false">
          <div class="butler-choice-left">
            <span class="butler-checkbox" id="check-box-bet365">
              <svg viewBox="0 0 24 24" class="butler-check-svg" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span class="bookie-tag b365">365</span>
            <div class="butler-choice-details">
              <strong>bet365</strong>
              <span class="butler-choice-sub">Football &amp; Global Sports</span>
            </div>
          </div>
          <span class="butler-active-pill" id="check-bet365">Active ✓</span>
        </button>

        <!-- William Hill -->
        <button type="button" class="butler-choice-card" data-select-butler="williamhill" onclick="setButlerBookmaker('williamhill')" role="radio" aria-checked="false">
          <div class="butler-choice-left">
            <span class="butler-checkbox" id="check-box-williamhill">
              <svg viewBox="0 0 24 24" class="butler-check-svg" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span class="bookie-tag wh">WH</span>
            <div class="butler-choice-details">
              <strong>William Hill</strong>
              <span class="butler-choice-sub">UK Betting &amp; Daily Coup</span>
            </div>
          </div>
          <span class="butler-active-pill" id="check-williamhill">Active ✓</span>
        </button>

        <!-- Paddy Power -->
        <button type="button" class="butler-choice-card" data-select-butler="paddypower" onclick="setButlerBookmaker('paddypower')" role="radio" aria-checked="false">
          <div class="butler-choice-left">
            <span class="butler-checkbox" id="check-box-paddypower">
              <svg viewBox="0 0 24 24" class="butler-check-svg" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span class="bookie-tag pp">PP</span>
            <div class="butler-choice-details">
              <strong>Paddy Power</strong>
              <span class="butler-choice-sub">Football &amp; Multi-Sport</span>
            </div>
          </div>
          <span class="butler-active-pill" id="check-paddypower">Active ✓</span>
        </button>

        <!-- Betfair -->
        <button type="button" class="butler-choice-card" data-select-butler="betfair" onclick="setButlerBookmaker('betfair')" role="radio" aria-checked="false">
          <div class="butler-choice-left">
            <span class="butler-checkbox" id="check-box-betfair">
              <svg viewBox="0 0 24 24" class="butler-check-svg" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span class="bookie-tag bf">BF</span>
            <div class="butler-choice-details">
              <strong>Betfair Sportsbook</strong>
              <span class="butler-choice-sub">Football &amp; Exchange Odds</span>
            </div>
          </div>
          <span class="butler-active-pill" id="check-betfair">Active ✓</span>
        </button>

        <!-- Coral -->
        <button type="button" class="butler-choice-card" data-select-butler="coral" onclick="setButlerBookmaker('coral')" role="radio" aria-checked="false">
          <div class="butler-choice-left">
            <span class="butler-checkbox" id="check-box-coral">
              <svg viewBox="0 0 24 24" class="butler-check-svg" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span class="bookie-tag coral">COR</span>
            <div class="butler-choice-details">
              <strong>Coral</strong>
              <span class="butler-choice-sub">Football Coupon &amp; Accas</span>
            </div>
          </div>
          <span class="butler-active-pill" id="check-coral">Active ✓</span>
        </button>

        <!-- Ladbrokes -->
        <button type="button" class="butler-choice-card" data-select-butler="ladbrokes" onclick="setButlerBookmaker('ladbrokes')" role="radio" aria-checked="false">
          <div class="butler-choice-left">
            <span class="butler-checkbox" id="check-box-ladbrokes">
              <svg viewBox="0 0 24 24" class="butler-check-svg" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span class="bookie-tag ladbrokes">LAD</span>
            <div class="butler-choice-details">
              <strong>Ladbrokes</strong>
              <span class="butler-choice-sub">Football &amp; Weekend Coupons</span>
            </div>
          </div>
          <span class="butler-active-pill" id="check-ladbrokes">Active ✓</span>
        </button>
      </div>

      <div class="butler-perks-box\""""

index_html, count = re.subn(old_grid_regex, new_grid, index_html)
assert count == 1, f"Failed to replace bookie grid in index.html (count={count})"
print("Updated butler bookie list with checkboxes in index.html")

# Bump version to v76 in footer
index_html = index_html.replace('v75</b>', 'v76</b>')

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(index_html)

# -------------------------------------------------------------
# 2. Update styles.css
# -------------------------------------------------------------
styles_path = ROOT / 'styles.css'
with open(styles_path, 'r', encoding='utf-8') as f:
    styles_css = f.read()

# Replace desktop .butler-pill-btn
old_pill_css = """.butler-pill-btn {
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
.butler-pill-btn .butler-caret { font-size: 10px; color: var(--muted); margin-left: 2px; }"""

new_pill_css = """.butler-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  min-height: 36px;
  min-width: 175px;
  border-radius: 9999px;
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.26), rgba(16, 185, 129, 0.2));
  border: 1.5px solid rgba(56, 189, 248, 0.55);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  transition: all .15s ease;
  white-space: nowrap;
  flex-shrink: 0;
}
.butler-pill-btn:hover {
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.4), rgba(16, 185, 129, 0.3));
  border-color: var(--cyan);
  box-shadow: 0 0 18px rgba(56, 189, 248, 0.45);
  transform: translateY(-1px);
}
.butler-pill-btn .butler-icon { font-size: 16px; flex-shrink: 0; }
.butler-pill-btn .butler-label { font-size: 13px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; }
.butler-pill-btn b { color: var(--cyan); font-weight: 700; }
.butler-pill-btn .butler-caret { font-size: 11px; color: var(--muted); margin-left: 4px; flex-shrink: 0; }"""

assert old_pill_css in styles_css, "Could not find old_pill_css in styles.css"
styles_css = styles_css.replace(old_pill_css, new_pill_css)
print("Updated desktop .butler-pill-btn in styles.css")

# Replace media query squashing:
# 1. in line 2724:
old_mq1 = """.butler-pill-btn {
    padding: 3px 8px;
    min-height: 30px;
    font-size: 11.5px;
    gap: 4px;
  }
  .butler-pill-btn .butler-label {
    font-size: 11.5px;
  }"""
new_mq1 = """.butler-pill-btn {
    padding: 5px 12px;
    min-height: 34px;
    min-width: 155px;
    font-size: 12px;
    gap: 6px;
  }
  .butler-pill-btn .butler-label {
    font-size: 12px;
    white-space: nowrap;
  }"""
if old_mq1 in styles_css:
    styles_css = styles_css.replace(old_mq1, new_mq1)
    print("Updated tablet media query in styles.css")

# 2. in line 3383 (max-width: 115px !important):
old_mq2 = """.butler-pill-btn {
    max-width: 115px !important;
    padding: 3px 6px !important;
    font-size: 11px !important;
  }
  .butler-label {
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }"""
new_mq2 = """.butler-pill-btn {
    min-width: 145px !important;
    max-width: none !important;
    padding: 5px 12px !important;
    font-size: 12px !important;
    white-space: nowrap !important;
  }
  .butler-label {
    overflow: visible !important;
    text-overflow: clip !important;
    white-space: nowrap !important;
  }"""
if old_mq2 in styles_css:
    styles_css = styles_css.replace(old_mq2, new_mq2)
    print("Updated mobile media query (removed 115px max-width) in styles.css")

# Replace .butler-bookie-grid and .butler-choice-card block around line 3670 with left-aligned list and checkboxes
old_modal_styles = """.butler-bookie-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 10px;
  margin: 14px 0 16px;
  max-height: 46vh;
  overflow-y: auto;
  padding-right: 4px;
}
.butler-choice-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #fff;
  text-align: left;
  cursor: pointer;
  transition: all 0.18s ease;
  min-height: 52px;
}
.butler-choice-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: #38bdf8;
  transform: translateY(-1px);
}
.butler-choice-card.active {
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.22), rgba(16, 185, 129, 0.14));
  border-color: #38bdf8;
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.25);
}
.butler-choice-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.butler-choice-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.butler-choice-details strong {
  font-size: 14px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.butler-choice-sub {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.butler-active-check {
  font-size: 12px;
  font-weight: 800;
  color: #34d399;
  background: rgba(16, 185, 129, 0.16);
  padding: 3px 8px;
  border-radius: 6px;
  display: none;
  flex-shrink: 0;
}
.butler-choice-card.active .butler-active-check {
  display: inline-block;
}"""

new_modal_styles = """.butler-bookie-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 14px 0 16px;
  max-height: 48vh;
  overflow-y: auto;
  padding-right: 4px;
}
.butler-choice-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 11px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #fff;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 52px;
}
.butler-choice-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(56, 189, 248, 0.5);
  transform: translateX(3px);
}
.butler-choice-card.active {
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.15), rgba(2, 132, 199, 0.12), rgba(15, 23, 42, 0.85));
  border-color: #10b981;
  box-shadow: 0 0 16px rgba(16, 185, 129, 0.22);
}
.butler-choice-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  text-align: left;
  flex: 1;
}
.butler-checkbox {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 2px solid rgba(255, 255, 255, 0.32);
  background: rgba(15, 23, 42, 0.8);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.18s ease;
}
.butler-choice-card:hover .butler-checkbox {
  border-color: #38bdf8;
}
.butler-choice-card.active .butler-checkbox {
  border-color: #10b981;
  background: #10b981;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
}
.butler-check-svg {
  width: 14px;
  height: 14px;
  stroke: #ffffff;
  stroke-width: 3.5;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.butler-choice-card.active .butler-check-svg {
  opacity: 1;
  transform: scale(1);
}
.butler-choice-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
  text-align: left;
}
.butler-choice-details strong {
  font-size: 14.5px;
  color: #fff;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.butler-choice-sub {
  font-size: 11.5px;
  color: #94a3b8;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.butler-active-pill {
  font-size: 11.5px;
  font-weight: 700;
  color: #34d399;
  background: rgba(16, 185, 129, 0.16);
  border: 1px solid rgba(16, 185, 129, 0.35);
  padding: 3px 9px;
  border-radius: 9999px;
  display: none;
  flex-shrink: 0;
}
.butler-choice-card.active .butler-active-pill {
  display: inline-flex;
}"""

assert old_modal_styles in styles_css, "Could not find old_modal_styles in styles.css"
styles_css = styles_css.replace(old_modal_styles, new_modal_styles)
print("Updated modal styles for left-aligned list and checkboxes in styles.css")

with open(styles_path, 'w', encoding='utf-8') as f:
    f.write(styles_css)

# -------------------------------------------------------------
# 3. Update app.js
# -------------------------------------------------------------
app_path = ROOT / 'app.js'
with open(app_path, 'r', encoding='utf-8') as f:
    app_js = f.read()

# Update updateButlerUI to set aria-checked
old_update_fn = """function updateButlerUI() {
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
}"""

new_update_fn = """function updateButlerUI() {
  const current = getButlerBookmaker();
  const nameEls = document.querySelectorAll('#header-butler-name, .current-butler-name');
  nameEls.forEach(el => { el.textContent = current.name; });
  document.querySelectorAll('.butler-choice-card').forEach(card => {
    const isSelected = card.dataset.selectButler === current.key;
    if (isSelected) {
      card.classList.add('active');
      card.setAttribute('aria-checked', 'true');
    } else {
      card.classList.remove('active');
      card.setAttribute('aria-checked', 'false');
    }
  });
}"""

assert old_update_fn in app_js, "Could not find old_update_fn in app.js"
app_js = app_js.replace(old_update_fn, new_update_fn)

# Bump version to v76
app_js = app_js.replace("const APP_VERSION = 'v75';", "const APP_VERSION = 'v76';")

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(app_js)
print("Updated updateButlerUI in app.js and bumped to v76")

# -------------------------------------------------------------
# 4. Update sw.js
# -------------------------------------------------------------
sw_path = ROOT / 'sw.js'
with open(sw_path, 'r', encoding='utf-8') as f:
    sw_js = f.read()

sw_js = sw_js.replace('betbuddy-pwa-v75', 'betbuddy-pwa-v76')
with open(sw_path, 'w', encoding='utf-8') as f:
    f.write(sw_js)
print("Bumped sw.js to v76")
