"""Refactor app.js and index.html:
1. Make viewHome() a dedicated, clean Hero Welcome Hub with the 5 Bento Portal cards and intro narrative.
2. Put the full predictions and acca builder into viewPicks() under route '#/picks'.
3. Update header nav to:
   - Home (#/) -> Hero Welcome Portal
   - Picks (#/picks) -> Bet Builder & Predictions
   - Fixtures (#/fixtures)
   - Results (#/results)
   - Diary (#/diary)
   - Leagues (#/leagues)
   - More (#/more)
4. Bump Service Worker cache to v16 and add ?v=16 to index.html asset tags.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 1. Update app.js
app_path = ROOT / "app.js"
app_js = app_path.read_text(encoding="utf-8")

# Replace onclick="scrollToBuilder()" with a link to #/picks
old_card_pattern = '<div class="portal-card portal-card-hero" onclick="scrollToBuilder()">'
new_card_pattern = '<a href="#/picks" class="portal-card portal-card-hero" style="text-decoration:none">'
assert old_card_pattern in app_js, "old_card_pattern not found!"
app_js = app_js.replace(old_card_pattern, new_card_pattern, 1)

# Replace the closing </div> of the card with </a>
old_card_end = '<!-- 4 Bento Grid Cards Below -->'
idx_card = app_js.find(new_card_pattern)
idx_bento = app_js.find(old_card_end, idx_card)
# The </div></div> right before <!-- 4 Bento Grid Cards Below -->
sub = app_js[idx_card:idx_bento]
sub_replaced = sub.replace('<button type="button" class="btn primary portal-cta-btn" onclick="scrollToBuilder();event.stopPropagation()">' +
              '<span>Launch Bet Builder &amp; Predictions</span>' +
              '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
            '</button>',
            '<span class="btn primary portal-cta-btn">' +
              '<span>Launch Acca Builder &amp; Predictions</span>' +
              '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
            '</span>')
# Replace the end </div></div> with </div></a>
last_div_idx = sub_replaced.rfind('</div>')
second_last_div_idx = sub_replaced.rfind('</div>', 0, last_div_idx)
sub_final = sub_replaced[:last_div_idx] + '</a>' + sub_replaced[last_div_idx+6:]
app_js = app_js[:idx_card] + sub_final + app_js[idx_bento:]

# Now replace viewHome with viewHome + viewPicks
old_view_home_marker = "function viewHome() {\n  if (currentSport !== 'football') {\n    return viewMultiSport(currentSport);\n  }\n  const list = upcoming();\n  const sharedBanner = sharedSlipNotice"
new_view_home_block = """function viewHome() {
  return '<section class="view">' +
    renderWelcomeHero() +
    beginnerGuides() +
    homeFixtures() +
  '</section>';
}

function viewPicks() {
  if (currentSport !== 'football') {
    return viewMultiSport(currentSport);
  }
  const list = upcoming();
  const sharedBanner = sharedSlipNotice"""

assert old_view_home_marker in app_js, "old_view_home_marker not found!"
app_js = app_js.replace(old_view_home_marker, new_view_home_block, 1)

# In viewPicks, remove renderWelcomeHero() call
old_picks_render = "renderWelcomeHero() +\n    '<div id=\"builder-anchor\" style=\"padding-top:12px\"></div>' +\n    viewBuilder()"
new_picks_render = "viewBuilder()"
assert old_picks_render in app_js, "old_picks_render not found!"
app_js = app_js.replace(old_picks_render, new_picks_render, 1)

# Now update currentRoute handling and render() in app.js
old_render = "const html = view === 'fixtures' ? viewFixtures() : view === 'match' ? viewMatch(arg) : view === 'results' ? viewResults() : view === 'diary' ? viewDiary() : view === 'leagues' ? viewLeagues() : view === 'admin' ? viewAdmin() : view === 'more' ? viewMore() : viewHome();"
new_render = "const html = view === 'picks' ? viewPicks() : view === 'fixtures' ? viewFixtures() : view === 'match' ? viewMatch(arg) : view === 'results' ? viewResults() : view === 'diary' ? viewDiary() : view === 'leagues' ? viewLeagues() : view === 'admin' ? viewAdmin() : view === 'more' ? viewMore() : viewHome();"
assert old_render in app_js, "old_render not found!"
app_js = app_js.replace(old_render, new_render, 1)

old_titles = "const titles = { home: 'Best Picks', fixtures: 'Fixtures', match: 'Match analysis', results: 'Results & performance', diary: 'Bet Diary', leagues: 'Buddy Leagues', admin: 'Founder Admin & Affiliates', more: 'Data & methods' };"
new_titles = "const titles = { home: 'Welcome Hub', picks: 'Picks & Acca Builder', fixtures: 'Fixtures', match: 'Match analysis', results: 'Results & performance', diary: 'Bet Diary', leagues: 'Buddy Leagues', admin: 'Founder Admin & Affiliates', more: 'Data & methods' };"
assert old_titles in app_js, "old_titles not found!"
app_js = app_js.replace(old_titles, new_titles, 1)

# Update currentRoute for slip= and match=
app_js = app_js.replace("return ['home'];\n  }\n  if (hash.startsWith('match=')) return ['home'];", "return ['picks'];\n  }\n  if (hash.startsWith('match=')) return ['picks'];")

app_path.write_text(app_js, encoding="utf-8")
print("Successfully refactored app.js!")

# 2. Update index.html navigation links and bump version to v16
index_path = ROOT / "index.html"
index_html = index_path.read_text(encoding="utf-8")

old_nav = """    <nav class="nav" aria-label="Main">
      <a href="#/" data-nav="home"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>Picks</a>
      <a href="#/fixtures" data-nav="fixtures"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>Fixtures</a>"""

new_nav = """    <nav class="nav" aria-label="Main">
      <a href="#/" data-nav="home"><svg viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Home</a>
      <a href="#/picks" data-nav="picks"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>Picks</a>
      <a href="#/fixtures" data-nav="fixtures"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>Fixtures</a>"""

assert old_nav in index_html, "old_nav not found!"
index_html = index_html.replace(old_nav, new_nav, 1)

# Add cache busters
index_html = index_html.replace('<link rel="stylesheet" href="styles.css">', '<link rel="stylesheet" href="styles.css?v=16">')
index_html = index_html.replace('<script src="app.js"></script>', '<script src="app.js?v=16"></script>')

index_path.write_text(index_html, encoding="utf-8")
print("Successfully updated index.html!")

# 3. Bump Service Worker cache to v16
sw_path = ROOT / "sw.js"
sw_js = sw_path.read_text(encoding="utf-8")
sw_js = sw_js.replace("betbuddy-pwa-v15", "betbuddy-pwa-v16")
sw_path.write_text(sw_js, encoding="utf-8")
print("Successfully bumped sw.js to v16!")
