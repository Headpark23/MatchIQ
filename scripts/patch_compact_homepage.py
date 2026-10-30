import re

# 1. Patch app.js
with open('app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

old_render_welcome = """function renderWelcomeHero() {
  const diaryItems = getStoredDiary();
  const diaryCount = diaryItems.length;
  const user = getAuthUser();
  const userName = user && user.displayName ? user.displayName.split(' ')[0] : 'Punter';

  return '<div class="welcome-hero-wrap">' +
    '<div class="welcome-hero-banner">' +
      '<div class="welcome-mascot-col">' +
        '<div class="welcome-panda-avatar">' +
          '<img src="assets/icon-192.png" onerror="this.onerror=null;this.src=\\'data:image/png;base64,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\\'\" alt=\"Bet Buddy Mascot\" width=\"76\" height=\"76">' +
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
      '<a href="#/picks" class="portal-card portal-card-hero" style="text-decoration:none">' +
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
            '<span class="btn primary portal-cta-btn">' +
              '<span>Launch Bet Builder &amp; Predictions</span>' +
              '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
            '</span>' +
            '<span class="portal-sub-action-hint">Tap to open Acca Builder &amp; Multi-Sport Picks</span>' +
          '</div>' +
        '</div>' +
      '</a>' +

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
}"""

new_render_welcome = """function renderWelcomeHero() {
  const diaryItems = getStoredDiary();
  const diaryCount = diaryItems.length;
  const user = getAuthUser();
  const userName = user && user.displayName ? user.displayName.split(' ')[0] : 'Punter';

  return '<div class="welcome-hero-wrap compact-home">' +
    '<!-- 1. Introduction: Ultra-compact, low real estate -->' +
    '<div class="welcome-hero-banner">' +
      '<div class="welcome-mascot-col">' +
        '<div class="welcome-panda-avatar">' +
          '<img src="assets/icon-192.png" alt="Bet Buddy" width="40" height="40">' +
          '<span class="mascot-online-dot" title="Live Predictions Ready"></span>' +
        '</div>' +
      '</div>' +
      '<div class="welcome-text-col">' +
        '<div class="welcome-badge-tag"><span class="badge-dot"></span> Welcome, ' + esc(userName) + '! · Free &amp; Ad-Free</div>' +
        '<h1 class="welcome-hero-title">Your Honest Sports Betting Co-Pilot</h1>' +
        '<p class="welcome-hero-narrative">Real mathematical edge, live bookie odds &amp; private leagues with mates.</p>' +
      '</div>' +
    '</div>' +

    '<!-- 2. Main Feature: Pick a Bet & Build Acca -->' +
    '<div class="portal-grid">' +
      '<a href="#/picks" class="portal-card portal-card-hero" style="text-decoration:none">' +
        '<div class="portal-card-hero-glow"></div>' +
        '<div class="portal-card-content">' +
          '<div class="portal-card-top">' +
            '<span class="portal-pill highlight">⚡ Primary Feature</span>' +
            '<span class="portal-odds-badge">Dixon-Coles Model</span>' +
          '</div>' +
          '<div class="portal-hero-body">' +
            '<div class="portal-icon-large">⚽🎯</div>' +
            '<div class="portal-hero-text">' +
              '<h2 class="portal-hero-heading">Pick a Bet &amp; Build Acca</h2>' +
              '<p class="portal-hero-desc">Target £10–£1000 profit across 2–6 legs with verified mathematical edge.</p>' +
            '</div>' +
            '<div class="portal-card-action">' +
              '<span class="btn primary portal-cta-btn">' +
                '<span>Build Acca</span>' +
                '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
              '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</a>' +

      '<!-- 3. Smaller Boxes: 2x2 on Mobile, all visible without scrolling -->' +
      '<div class="portal-subgrid">' +
        '<!-- Box 1: Leagues -->' +
        '<a href="#/leagues" class="portal-subcard bento-leagues">' +
          '<div class="portal-subcard-head">' +
            '<div class="portal-subcard-icon-wrap trophy-glow">🏆</div>' +
            '<div class="portal-subcard-tag">Compete</div>' +
          '</div>' +
          '<div class="portal-subcard-text">' +
            '<h3 class="portal-subcard-title">Buddy &amp; Geo Leagues</h3>' +
            '<p class="portal-subcard-desc">Town, UK &amp; World ladders with mates.</p>' +
          '</div>' +
        '</a>' +

        '<!-- Box 2: Upcoming Fixtures -->' +
        '<a href="#/fixtures" class="portal-subcard bento-fixtures">' +
          '<div class="portal-subcard-head">' +
            '<div class="portal-subcard-icon-wrap calendar-glow">📅</div>' +
            '<div class="portal-subcard-tag">Schedule</div>' +
          '</div>' +
          '<div class="portal-subcard-text">' +
            '<h3 class="portal-subcard-title">Upcoming Fixtures</h3>' +
            '<p class="portal-subcard-desc">Match previews, TV &amp; live prices.</p>' +
          '</div>' +
        '</a>' +

        '<!-- Box 3: Results & Audit Ledger -->' +
        '<a href="#/results" class="portal-subcard bento-results">' +
          '<div class="portal-subcard-head">' +
            '<div class="portal-subcard-icon-wrap chart-glow">📊</div>' +
            '<div class="portal-subcard-tag">Track Record</div>' +
          '</div>' +
          '<div class="portal-subcard-text">' +
            '<h3 class="portal-subcard-title">Results &amp; Proof</h3>' +
            '<p class="portal-subcard-desc">Settled audit ledger &amp; accuracy.</p>' +
          '</div>' +
        '</a>' +

        '<!-- Box 4: Bet Diary -->' +
        '<a href="#/diary" class="portal-subcard bento-diary">' +
          '<div class="portal-subcard-head">' +
            '<div class="portal-subcard-icon-wrap diary-glow">📖</div>' +
            '<div class="portal-subcard-tag">Ledger (' + diaryCount + ')</div>' +
          '</div>' +
          '<div class="portal-subcard-text">' +
            '<h3 class="portal-subcard-title">Bet Diary</h3>' +
            '<p class="portal-subcard-desc">Your personal PnL &amp; trophies.</p>' +
          '</div>' +
        '</a>' +
      '</div>' +
    '</div>' +
  '</div>';
}"""

if old_render_welcome in app_js:
    app_js = app_js.replace(old_render_welcome, new_render_welcome)
    print("Replaced renderWelcomeHero in app.js successfully.")
else:
    print("Marker old_render_welcome not found!")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_js)

# 2. Patch styles.css for ultra-compact above-the-fold layout
with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

compact_css = """
/* --- Compact Above-The-Fold Home Dashboard --- */
.welcome-hero-wrap.compact-home {
  margin-bottom: 24px;
}

.welcome-hero-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.95) 100%);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 14px;
  padding: 12px 16px;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
}

.welcome-panda-avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #0b1526;
  border: 1.5px solid rgba(16, 185, 129, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

.welcome-badge-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.14);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #a7f3d0;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 3px;
}

.welcome-hero-title {
  margin: 0 0 2px 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.welcome-hero-narrative {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.35;
  color: var(--muted, #94a3b8);
}

.portal-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.portal-card-hero {
  background: linear-gradient(145deg, #0f1c30 0%, #070e1b 100%);
  border: 1.5px solid rgba(16, 185, 129, 0.4);
  border-radius: 14px;
  padding: 14px 16px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 20px -4px rgba(0, 0, 0, 0.5);
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.portal-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

.portal-hero-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.portal-icon-large {
  font-size: 1.8rem;
  line-height: 1;
  flex-shrink: 0;
  padding: 8px;
  background: rgba(16, 185, 129, 0.12);
  border-radius: 10px;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.portal-hero-text {
  flex: 1;
}

.portal-hero-heading {
  margin: 0 0 3px 0;
  font-size: 1.12rem;
  font-weight: 800;
  color: #fff;
  line-height: 1.25;
}

.portal-hero-desc {
  margin: 0;
  font-size: 0.78rem;
  color: #cbd5e1;
  line-height: 1.35;
}

.portal-cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 8px 14px;
  border-radius: 8px;
  white-space: nowrap;
}

/* 4 Compact Subcards - 2x2 grid on mobile & tablet, 4x1 on desktop */
.portal-subgrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

@media (max-width: 900px) {
  .portal-subgrid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}

.portal-subcard {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  text-decoration: none;
  background: #0a1322;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 10px 12px;
  color: inherit;
  transition: transform 0.15s ease, border-color 0.15s ease;
  min-height: 74px;
}

.portal-subcard-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
}

.portal-subcard-icon-wrap {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  margin-bottom: 0;
}

.portal-subcard-tag {
  font-size: 0.64rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #94a3b8;
}

.portal-subcard-title {
  margin: 0 0 2px 0;
  font-size: 0.88rem;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
}

.portal-subcard-desc {
  margin: 0;
  font-size: 0.72rem;
  color: #94a3b8;
  line-height: 1.3;
}

@media (max-width: 580px) {
  .welcome-hero-banner {
    flex-direction: row !important;
    text-align: left !important;
    padding: 10px 12px !important;
    gap: 10px !important;
  }
  .welcome-panda-avatar {
    width: 38px !important;
    height: 38px !important;
  }
  .welcome-hero-title {
    font-size: 0.98rem !important;
  }
  .welcome-hero-narrative {
    font-size: 0.74rem !important;
  }
  .portal-hero-body {
    flex-direction: row !important;
    text-align: left !important;
    gap: 10px !important;
  }
  .portal-icon-large {
    font-size: 1.5rem !important;
    padding: 6px !important;
  }
  .portal-hero-heading {
    font-size: 0.98rem !important;
  }
  .portal-hero-desc {
    font-size: 0.72rem !important;
  }
  .portal-cta-btn {
    padding: 6px 10px !important;
    font-size: 0.74rem !important;
  }
  .portal-subgrid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 8px !important;
  }
  .portal-subcard {
    padding: 8px 10px !important;
  }
  .portal-subcard-title {
    font-size: 0.82rem !important;
  }
  .portal-subcard-desc {
    font-size: 0.68rem !important;
  }
}
"""

with open('styles.css', 'a', encoding='utf-8') as f:
    f.write('\n' + compact_css)

print("Updated styles.css with compact dashboard layout.")

