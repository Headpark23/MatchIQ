"""Patch app.js and styles.css to implement the 5-card Hero Welcome Screen in viewHome().

Cards:
1. Top Large Hero Card: "Pick a Bet & Build Acca" (with CTA button to jump straight to the Acca Builder / live predictions)
2. 4 Smaller Bento Cards Below:
   - 🏆 Buddy & Geo Leagues (#/leagues)
   - 📅 Upcoming Fixtures (#/fixtures)
   - 📊 Results & Dixon-Coles Form (#/results)
   - 📖 Bet Diary & Trophy Cabinet (#/diary)

Narrative Banner:
- Fun intro welcoming punter with Panda mascot, honest statistical model, and zero-fluff approach.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 1. Patch app.js
app_path = ROOT / "app.js"
app_code = app_path.read_text(encoding="utf-8")

# Let's inspect viewHome() target in app.js
target_start = "function viewHome() {\n  if (currentSport !== 'football') {\n    return viewMultiSport(currentSport);\n  }\n  const list = upcoming();\n  const sharedBanner = sharedSlipNotice\n    ? '<div class=\"notice section shared-slip-notice\" style=\"border-color:var(--cyan);background:rgba(56,189,248,0.12);color:#fff;margin-bottom:18px\"><span style=\"font-size:20px\">🐼</span><div><b>Acca shared by a mate!</b> Bet Builder is pre-filled to target £' + builderState.win + ' profit across ' + builderState.legs + ' bets.</div><button type=\"button\" class=\"icon-btn\" onclick=\"sharedSlipNotice=false;render()\" style=\"margin-left:auto\">&times;</button></div>'\n    : '';\n  let html = '<section class=\"view\">' + renderSportFilterBar() + sharedBanner + viewBuilder()"

replacement_start = """function renderWelcomeHero() {
  const diaryItems = readDiary();
  const diaryCount = diaryItems.length;
  const user = getAuthUser();
  const userName = user && user.displayName ? user.displayName.split(' ')[0] : 'Punter';

  return '<div class="welcome-hero-wrap">' +
    '<div class="welcome-hero-banner">' +
      '<div class="welcome-mascot-col">' +
        '<div class="welcome-panda-avatar">' +
          '<img src="assets/icon-192.png" alt="Bet Buddy Mascot" width="76" height="76">' +
          '<span class="mascot-online-dot" title="Live Predictions Ready"></span>' +
        '</div>' +
      '</div>' +
      '<div class="welcome-text-col">' +
        '<div class="welcome-badge-tag"><span class="badge-dot"></span> Welcome, ' + esc(userName) + '! · 100% Free &amp; Ad-Free</div>' +
        '<h1 class="welcome-hero-title">Your Honest Sports Betting Co-Pilot</h1>' +
        '<p class="welcome-hero-narrative">' +
          'Tired of bookmaker hype? Bet Buddy uses real Poisson &amp; Dixon-Coles mathematical evidence, transparent track records, and zero bull. ' +
          'Build precision accumulators, compete in local &amp; worldwide silverware leagues, track your bets privately, and verify every single price with cold mathematics.' +
        '</p>' +
      '</div>' +
    '</div>' +

    '<!-- 5 Bento Portal Cards -->' +
    '<div class="portal-grid">' +
      '<!-- 1. Top Large Card: Pick a Bet -->' +
      '<div class="portal-card portal-card-hero" onclick="scrollToBuilder()">' +
        '<div class="portal-card-hero-glow"></div>' +
        '<div class="portal-card-content">' +
          '<div class="portal-card-top">' +
            '<span class="portal-pill highlight">⚡ Primary Feature</span>' +
            '<span class="portal-odds-badge">Dixon-Coles Model Calibrated</span>' +
          '</div>' +
          '<div class="portal-hero-body">' +
            '<div class="portal-icon-large">⚽🎯</div>' +
            '<div>' +
              '<h2 class="portal-hero-heading">Pick a Bet &amp; Build Acca</h2>' +
              '<p class="portal-hero-desc">' +
                'Select targets (£10 to £1000 profit across 2 to 6 legs). Auto-filter the highest-edge value picks, compare live bookmaker prices, or explore cross-sport tennis, golf, darts &amp; rugby bets.' +
              '</p>' +
            '</div>' +
          '</div>' +
          '<div class="portal-card-action">' +
            '<button type="button" class="btn primary portal-cta-btn" onclick="scrollToBuilder();event.stopPropagation()">' +
              '<span>Launch Bet Builder &amp; Predictions</span>' +
              '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
            '</button>' +
            '<span class="portal-sub-action-hint">Or scroll down for this round’s matches</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<!-- 4 Bento Grid Cards Below -->' +
      '<div class="portal-subgrid">' +
        '<!-- 2. Leagues & Silverware -->' +
        '<a href="#/leagues" class="portal-subcard bento-leagues">' +
          '<div class="portal-subcard-icon-wrap trophy-glow">🏆</div>' +
          '<div class="portal-subcard-text">' +
            '<div class="portal-subcard-tag">Compete &amp; Win</div>' +
            '<h3 class="portal-subcard-title">Buddy &amp; Geo Leagues</h3>' +
            '<p class="portal-subcard-desc">Automatic entry into Town, Region, Scotland/UK &amp; World ladders. Points for big odds winners!</p>' +
          '</div>' +
          '<div class="portal-subcard-footer">' +
            '<span class="portal-link-label">View Silverware Ladders</span>' +
            '<span class="portal-arrow">›</span>' +
          '</div>' +
        '</a>' +

        '<!-- 3. Upcoming Fixtures -->' +
        '<a href="#/fixtures" class="portal-subcard bento-fixtures">' +
          '<div class="portal-subcard-icon-wrap calendar-glow">📅</div>' +
          '<div class="portal-subcard-text">' +
            '<div class="portal-subcard-tag">Schedule &amp; TV</div>' +
            '<h3 class="portal-subcard-title">Upcoming Fixtures</h3>' +
            '<p class="portal-subcard-desc">Comprehensive Premier League, European and domestic dates, kick-off clocks and match previews.</p>' +
          '</div>' +
          '<div class="portal-subcard-footer">' +
            '<span class="portal-link-label">Browse Match Fixtures</span>' +
            '<span class="portal-arrow">›</span>' +
          '</div>' +
        '</a>' +

        '<!-- 4. Results & Performance -->' +
        '<a href="#/results" class="portal-subcard bento-results">' +
          '<div class="portal-subcard-icon-wrap chart-glow">📊</div>' +
          '<div class="portal-subcard-text">' +
            '<div class="portal-subcard-tag">Honest Track Record</div>' +
            '<h3 class="portal-subcard-title">Results &amp; Verification</h3>' +
            '<p class="portal-subcard-desc">Permanent audit ledger of every settled prediction, Brier calibration scores and historical match scores.</p>' +
          '</div>' +
          '<div class="portal-subcard-footer">' +
            '<span class="portal-link-label">Check Settlement Ledger</span>' +
            '<span class="portal-arrow">›</span>' +
          '</div>' +
        '</a>' +

        '<!-- 5. Bet Diary & Trophy Cabinet -->' +
        '<a href="#/diary" class="portal-subcard bento-diary">' +
          '<div class="portal-subcard-icon-wrap diary-glow">📖</div>' +
          '<div class="portal-subcard-text">' +
            '<div class="portal-subcard-tag">Private Ledger (' + diaryCount + ' bets)</div>' +
            '<h3 class="portal-subcard-title">Bet Diary &amp; Cabinet</h3>' +
            '<p class="portal-subcard-desc">Track stakes, PnL and strike rates locally. Inspect your earned Gold, Silver and Bronze silverware.</p>' +
          '</div>' +
          '<div class="portal-subcard-footer">' +
            '<span class="portal-link-label">Open My Diary</span>' +
            '<span class="portal-arrow">›</span>' +
          '</div>' +
        '</a>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function scrollToBuilder() {
  const el = document.getElementById('builder-anchor') || document.querySelector('.builder-shell');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function viewHome() {
  if (currentSport !== 'football') {
    return viewMultiSport(currentSport);
  }
  const list = upcoming();
  const sharedBanner = sharedSlipNotice
    ? '<div class="notice section shared-slip-notice" style="border-color:var(--cyan);background:rgba(56,189,248,0.12);color:#fff;margin-bottom:18px"><span style="font-size:20px">🐼</span><div><b>Acca shared by a mate!</b> Bet Builder is pre-filled to target £' + builderState.win + ' profit across ' + builderState.legs + ' bets.</div><button type="button" class="icon-btn" onclick="sharedSlipNotice=false;render()" style="margin-left:auto">&times;</button></div>'
    : '';
  let html = '<section class="view">' +
    renderSportFilterBar() +
    sharedBanner +
    renderWelcomeHero() +
    '<div id="builder-anchor" style="padding-top:12px"></div>' +
    viewBuilder()"""

assert target_start in app_code, "target_start not found in app.js!"
app_code = app_code.replace(target_start, replacement_start, 1)
app_path.write_text(app_code, encoding="utf-8")
print("Successfully patched app.js with renderWelcomeHero()!")

# 2. Patch styles.css with styles for welcome hero and 5 bento portal cards
css_path = ROOT / "styles.css"
css_code = css_path.read_text(encoding="utf-8")

hero_css = """

/* ============================================================
   Bet Buddy Welcome Hero & 5-Card Bento Portal Layout
   ============================================================ */
.welcome-hero-wrap {
  margin: 10px 0 28px 0;
}

.welcome-hero-banner {
  display: flex;
  align-items: center;
  gap: 24px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%);
  border: 1px solid rgba(16, 185, 129, 0.28);
  box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.6), 0 0 20px rgba(16, 185, 129, 0.08);
  border-radius: 18px;
  padding: 24px 28px;
  margin-bottom: 22px;
  position: relative;
  overflow: hidden;
}

.welcome-hero-banner::after {
  content: "";
  position: absolute;
  top: -60px;
  right: -60px;
  width: 180px;
  height: 180px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, transparent 70%);
  pointer-events: none;
}

.welcome-mascot-col {
  flex-shrink: 0;
}

.welcome-panda-avatar {
  position: relative;
  width: 76px;
  height: 76px;
  border-radius: 20px;
  background: #0b1526;
  border: 2px solid rgba(16, 185, 129, 0.5);
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.welcome-panda-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.welcome-hero-banner:hover .welcome-panda-avatar img {
  transform: scale(1.08) rotate(3deg);
}

.mascot-online-dot {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--pick, #10b981);
  border: 2px solid #060d19;
  box-shadow: 0 0 8px #10b981;
}

.welcome-text-col {
  flex: 1;
}

.welcome-badge-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.16);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #a7f3d0;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.welcome-badge-tag .badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  animation: pulseDot 2s infinite ease-in-out;
}

@keyframes pulseDot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.welcome-hero-title {
  margin: 0 0 8px 0;
  font-size: 1.65rem;
  font-weight: 800;
  font-family: var(--font-display, inherit);
  color: #fff;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.welcome-hero-narrative {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--muted, #94a3b8);
  max-width: 820px;
}

/* Bento Portal Cards */
.portal-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Card 1: Top Large Hero Card */
.portal-card-hero {
  background: linear-gradient(145deg, #0f1c30 0%, #070e1b 100%);
  border: 1.5px solid rgba(16, 185, 129, 0.4);
  border-radius: 18px;
  padding: 24px 28px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 28px -6px rgba(0, 0, 0, 0.5), 0 0 16px rgba(16, 185, 129, 0.12);
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
}

.portal-card-hero:hover {
  transform: translateY(-2px);
  border-color: #10b981;
  box-shadow: 0 14px 36px -8px rgba(0, 0, 0, 0.6), 0 0 28px rgba(16, 185, 129, 0.22);
}

.portal-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.portal-pill {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
}

.portal-pill.highlight {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.35);
}

.portal-odds-badge {
  font-size: 0.78rem;
  font-family: var(--font-mono, monospace);
  color: #94a3b8;
  background: rgba(0, 0, 0, 0.35);
  padding: 3px 8px;
  border-radius: 4px;
}

.portal-hero-body {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}

.portal-icon-large {
  font-size: 2.8rem;
  line-height: 1;
  flex-shrink: 0;
  padding: 12px;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 16px;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.portal-hero-heading {
  margin: 0 0 6px 0;
  font-size: 1.45rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.01em;
}

.portal-hero-desc {
  margin: 0;
  font-size: 0.92rem;
  color: #cbd5e1;
  line-height: 1.5;
}

.portal-card-action {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 16px;
}

.portal-cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 700;
  padding: 10px 22px;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
}

.portal-sub-action-hint {
  font-size: 0.85rem;
  color: #94a3b8;
}

/* Bento Subgrid: 4 cards */
.portal-subgrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.portal-subcard {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-decoration: none;
  background: #0a1322;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 18px 16px;
  color: inherit;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  min-height: 190px;
}

.portal-subcard:hover {
  transform: translateY(-3px);
  text-decoration: none;
  color: inherit;
}

.portal-subcard.bento-leagues:hover {
  border-color: #f59e0b;
  box-shadow: 0 10px 24px -6px rgba(245, 158, 11, 0.25);
}

.portal-subcard.bento-fixtures:hover {
  border-color: #38bdf8;
  box-shadow: 0 10px 24px -6px rgba(56, 189, 248, 0.25);
}

.portal-subcard.bento-results:hover {
  border-color: #a855f7;
  box-shadow: 0 10px 24px -6px rgba(168, 85, 247, 0.25);
}

.portal-subcard.bento-diary:hover {
  border-color: #10b981;
  box-shadow: 0 10px 24px -6px rgba(16, 185, 129, 0.25);
}

.portal-subcard-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  margin-bottom: 12px;
}

.trophy-glow {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.calendar-glow {
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.3);
}

.chart-glow {
  background: rgba(168, 85, 247, 0.15);
  border: 1px solid rgba(168, 85, 247, 0.3);
}

.diary-glow {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.portal-subcard-tag {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  margin-bottom: 4px;
}

.portal-subcard-title {
  margin: 0 0 6px 0;
  font-size: 1.08rem;
  font-weight: 700;
  color: #fff;
  line-height: 1.25;
}

.portal-subcard-desc {
  margin: 0 0 12px 0;
  font-size: 0.82rem;
  color: #94a3b8;
  line-height: 1.45;
}

.portal-subcard-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 10px;
  margin-top: auto;
}

.portal-link-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #cbd5e1;
}

.portal-arrow {
  font-size: 1.1rem;
  color: #64748b;
  transition: transform 0.2s ease, color 0.2s ease;
}

.portal-subcard:hover .portal-arrow {
  transform: translateX(3px);
  color: #fff;
}

/* Responsive adjustments */
@media (max-width: 900px) {
  .portal-subgrid {
    grid-template-columns: repeat(2, 1fr);
  }
  .welcome-hero-banner {
    flex-direction: column;
    text-align: center;
    padding: 20px 18px;
  }
  .welcome-badge-tag {
    margin: 0 auto 10px auto;
  }
  .portal-hero-body {
    flex-direction: column;
    text-align: center;
  }
  .portal-card-action {
    justify-content: center;
  }
}

@media (max-width: 580px) {
  .portal-subgrid {
    grid-template-columns: 1fr;
  }
  .welcome-hero-title {
    font-size: 1.35rem;
  }
  .portal-hero-heading {
    font-size: 1.2rem;
  }
  .welcome-panda-avatar {
    width: 64px;
    height: 64px;
  }
}
"""

css_code += hero_css
css_path.write_text(css_code, encoding="utf-8")
print("Successfully appended welcome hero styles to styles.css!")
