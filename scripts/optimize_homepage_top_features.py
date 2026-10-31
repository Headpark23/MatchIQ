"""
Improve homepage top two feature cards:
- Use clean horizontal flex layout across the full card width.
- Eliminate centered text on medium/large screens.
- Use space effectively: Icon/badge on left, title + rich description in center, button on right.
- Ensure 2-column grid on desktop (or responsive flow).
"""

# 1. Update app.js
with open('app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

old_portal_block = """    '<!-- 2. Main Feature: Pick a Bet & Build Acca -->' +
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
              '<p class="portal-hero-desc">Target £10–£1000 return across 2–6 legs with verified mathematical edge.</p>' +
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

      '<!-- Today\\'s Best Value Bet Feature Hero Card -->' +
      '<div class="portal-card portal-card-best-value" onclick="openBestValueModal(\\'single\\')" style="text-decoration:none;cursor:pointer;">' +
        '<div class="portal-card-hero-glow bv-glow"></div>' +
        '<div class="portal-card-content">' +
          '<div class="portal-card-top">' +
            '<span class="portal-pill bv-highlight">🔥 High Mathematical Edge</span>' +
            '<span class="portal-odds-badge">Single &middot; Double &middot; Treble &middot; 4-Fold</span>' +
          '</div>' +
          '<div class="portal-hero-body">' +
            '<div class="portal-icon-large">💎📈</div>' +
            '<div class="portal-hero-text">' +
              '<h2 class="portal-hero-heading">Today\\'s Best Value Bet</h2>' +
              '<p class="portal-hero-desc">The strongest mathematical edge across today\\'s live bookmaker prices. View the top Value Single, Double, Treble, or 4-Fold Acca.</p>' +
            '</div>' +
            '<div class="portal-card-action">' +
              '<button type="button" class="btn primary portal-cta-btn bv-cta-btn" onclick="event.stopPropagation(); openBestValueModal(\\'single\\');">' +
                '<span>View Value Bets</span>' +
                '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +"""

new_portal_block = """    '<!-- 2. Main Features: Acca Builder & Today\\'s Best Value -->' +
    '<div class="portal-grid portal-features-dual">' +
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
              '<p class="portal-hero-desc">Target £10–£1,000 return across 2–6 legs with verified statistical edge, live odds &amp; 1-click accumulator builder.</p>' +
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

      '<!-- Today\\'s Best Value Bet Feature Hero Card -->' +
      '<div class="portal-card portal-card-best-value" onclick="openBestValueModal(\\'single\\')" style="text-decoration:none;cursor:pointer;">' +
        '<div class="portal-card-hero-glow bv-glow"></div>' +
        '<div class="portal-card-content">' +
          '<div class="portal-card-top">' +
            '<span class="portal-pill bv-highlight">🔥 Highest Edge Today</span>' +
            '<span class="portal-odds-badge">Single &bull; Double &bull; Treble &bull; 4-Fold</span>' +
          '</div>' +
          '<div class="portal-hero-body">' +
            '<div class="portal-icon-large">💎📈</div>' +
            '<div class="portal-hero-text">' +
              '<h2 class="portal-hero-heading">Today\\'s Best Value Bet</h2>' +
              '<p class="portal-hero-desc">Peak mathematical value against live UK bookies. View today\\'s recommended Value Single, Double, Treble, or 4-Fold Acca.</p>' +
            '</div>' +
            '<div class="portal-card-action">' +
              '<button type="button" class="btn primary portal-cta-btn bv-cta-btn" onclick="event.stopPropagation(); openBestValueModal(\\'single\\');">' +
                '<span>View Value</span>' +
                '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +"""

assert old_portal_block in app_js, "old_portal_block not found in app.js"
app_js = app_js.replace(old_portal_block, new_portal_block, 1)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_js)

print("Updated app.js markup for top feature cards!")

# 2. Update styles.css
with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Remove the legacy text-align: center from media 900px
old_media_900 = """@media (max-width: 900px) {
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
}"""

new_media_900 = """@media (max-width: 900px) {
  .portal-subgrid {
    grid-template-columns: repeat(2, 1fr);
  }
  .welcome-hero-banner {
    flex-direction: row;
    text-align: left;
    padding: 14px 16px;
  }
  .welcome-badge-tag {
    margin: 0 0 6px 0;
  }
  .portal-features-dual {
    grid-template-columns: 1fr !important;
  }
  .portal-hero-body {
    flex-direction: row;
    text-align: left;
  }
  .portal-card-action {
    justify-content: flex-end;
  }
}"""

assert old_media_900 in css, "old_media_900 not found in styles.css"
css = css.replace(old_media_900, new_media_900, 1)

# Add enhanced layout rules for .portal-features-dual and wide flex utilization
enhancements = """
/* Enhanced Full-Width Responsive Layout for Top Feature Cards */
.portal-features-dual {
  display: grid !important;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)) !important;
  gap: 14px !important;
  width: 100% !important;
}

.portal-features-dual .portal-card {
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  padding: 16px 20px !important;
  border-radius: 14px !important;
  text-align: left !important;
  box-sizing: border-box !important;
}

.portal-features-dual .portal-card-top {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  margin-bottom: 12px !important;
  width: 100% !important;
}

.portal-features-dual .portal-hero-body {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 16px !important;
  text-align: left !important;
  width: 100% !important;
  margin-bottom: 0 !important;
}

.portal-features-dual .portal-icon-large {
  font-size: 2rem !important;
  padding: 10px !important;
  border-radius: 12px !important;
  flex-shrink: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.portal-features-dual .portal-hero-text {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  text-align: left !important;
}

.portal-features-dual .portal-hero-heading {
  margin: 0 0 4px 0 !important;
  font-size: 1.15rem !important;
  font-weight: 800 !important;
  color: #fff !important;
  line-height: 1.25 !important;
  text-align: left !important;
}

.portal-features-dual .portal-hero-desc {
  margin: 0 !important;
  font-size: 0.82rem !important;
  color: #cbd5e1 !important;
  line-height: 1.4 !important;
  text-align: left !important;
}

.portal-features-dual .portal-card-action {
  flex-shrink: 0 !important;
  border-top: none !important;
  padding-top: 0 !important;
  margin: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
}

.portal-features-dual .portal-cta-btn {
  padding: 9px 18px !important;
  font-size: 0.84rem !important;
  font-weight: 700 !important;
  border-radius: 10px !important;
  white-space: nowrap !important;
}

@media (max-width: 580px) {
  .portal-features-dual {
    grid-template-columns: 1fr !important;
  }
  .portal-features-dual .portal-hero-body {
    flex-wrap: wrap !important;
    gap: 10px !important;
  }
  .portal-features-dual .portal-hero-text {
    flex: 1 1 calc(100% - 64px) !important;
  }
  .portal-features-dual .portal-card-action {
    width: 100% !important;
    justify-content: flex-end !important;
    margin-top: 6px !important;
  }
}
"""

css += enhancements

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(css)

print("Updated styles.css for full-width space utilization!")

