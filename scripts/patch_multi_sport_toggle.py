"""Implement multi-sport toggles allowing users to toggle individual sports ON and OFF and mix sports across the accumulator builder and match listings.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

app_path = ROOT / "app.js"
app_js = app_path.read_text(encoding="utf-8")

# 1. Replace single currentSport with activeSports Set/Array
old_sport_state = "let currentSport = 'football';"
new_sport_state = """const ACTIVE_SPORTS_KEY = 'betbuddy_active_sports_v1';
let activeSports = ['football'];
try {
  const savedSports = JSON.parse(localStorage.getItem(ACTIVE_SPORTS_KEY) || 'null');
  if (Array.isArray(savedSports) && savedSports.length > 0) {
    activeSports = savedSports;
  }
} catch (e) { /* ignore */ }

function toggleSport(sportKey) {
  if (activeSports.includes(sportKey)) {
    if (activeSports.length > 1) {
      activeSports = activeSports.filter(s => s !== sportKey);
    } else {
      toast('At least one sport must be selected!');
      return;
    }
  } else {
    activeSports.push(sportKey);
  }
  try { localStorage.setItem(ACTIVE_SPORTS_KEY, JSON.stringify(activeSports)); } catch (e) { /* ignore */ }
  toast((activeSports.includes(sportKey) ? 'Added ' : 'Removed ') + sportKey.toUpperCase() + ' from Acca &amp; view');
  updateBuilder();
  render();
}

function isSportActive(sportKey) {
  return activeSports.includes(sportKey);
}"""

assert old_sport_state in app_js, "old_sport_state not found!"
app_js = app_js.replace(old_sport_state, new_sport_state, 1)

# 2. Update renderSportFilterBar to support toggle pills with checkboxes/indicator
old_sport_filter = """function renderSportFilterBar() {
  const sports = [
    { key: 'football', label: '⚽ Football' },
    { key: 'tennis', label: '🎾 Tennis' },
    { key: 'golf', label: '⛳ Golf' },
    { key: 'darts', label: '🎯 Darts' },
    { key: 'rugby', label: '🏉 Rugby' }
  ];
  return '<div class="sport-filter-bar">' +
    sports.map(s => '<button type="button" class="sport-pill' + (currentSport === s.key ? ' active' : '') + '" data-switch-sport="' + s.key + '">' + s.label + '</button>').join('') +
  '</div>';
}"""

new_sport_filter = """function renderSportFilterBar() {
  const sports = [
    { key: 'football', label: '⚽ Football' },
    { key: 'tennis', label: '🎾 Tennis' },
    { key: 'golf', label: '⛳ Golf' },
    { key: 'darts', label: '🎯 Darts' },
    { key: 'rugby', label: '🏉 Rugby' }
  ];
  const count = activeSports.length;
  return '<div class="sport-filter-section">' +
    '<div class="sport-filter-head">' +
      '<span class="sport-filter-title">Mix Sports in Acca (' + count + ' active)</span>' +
      '<span class="sport-filter-hint">Tap any sport to toggle ON / OFF</span>' +
    '</div>' +
    '<div class="sport-filter-bar" role="group" aria-label="Toggle sports on and off">' +
      sports.map(s => {
        const active = activeSports.includes(s.key);
        return '<button type="button" class="sport-pill' + (active ? ' active' : '') + '" data-toggle-sport="' + s.key + '" aria-pressed="' + active + '">' +
          '<span class="sport-toggle-dot' + (active ? ' on' : '') + '"></span>' +
          '<span>' + s.label + '</span>' +
        '</button>';
      }).join('') +
    '</div>' +
  '</div>';
}"""

assert old_sport_filter in app_js, "old_sport_filter not found!"
app_js = app_js.replace(old_sport_filter, new_sport_filter, 1)

# 3. Update viewPicks() to show builder with multi-sport pool and render active multi-sport cards below
old_view_picks = """function viewPicks() {
  if (currentSport !== 'football') {
    return viewMultiSport(currentSport);
  }
  const list = upcoming();
  const sharedBanner = sharedSlipNotice"""

new_view_picks = """function viewPicks() {
  const list = upcoming();
  const sharedBanner = sharedSlipNotice"""

assert old_view_picks in app_js, "old_view_picks not found!"
app_js = app_js.replace(old_view_picks, new_view_picks, 1)

# Also in viewPicks: append multi-sport events cards if tennis, golf, darts or rugby are active
old_view_picks_end = "return html + homeFixtures() + '</section>';\n}"
new_view_picks_end = """  // Append any active other sports below football
  const otherActive = activeSports.filter(s => s !== 'football');
  if (otherActive.length > 0) {
    html += '<div class="section"><div class="section-head"><div><h2 class="section-title">Cross-Sport Fixtures &amp; Markets</h2>' +
      '<span class="section-note">Active sports: ' + otherActive.map(s => s.toUpperCase()).join(', ') + '</span></div>' +
      '<span class="badge validated">The Odds API Feed</span></div>' +
      otherActive.map(renderMultiSportSection).join('') +
    '</div>';
  }

  return html + homeFixtures() + '</section>';
}

function renderMultiSportSection(sportKey) {
  const sportData = (DATA.multiSport && DATA.multiSport.sports && DATA.multiSport.sports[sportKey]);
  if (!sportData) return '';
  return (sportData.tournaments || []).map(t => {
    const eventsHtml = (t.events || []).map(ev => {
      const selectionsHtml = (ev.selections || []).map(sel => {
        const betData = esc(JSON.stringify({
          selection: ev.title + ' · ' + sel.label,
          fair: sel.fractional,
          odds: sel.decimal,
          bookmaker: sel.bookmaker
        }));
        return '<div class="sport-selection-row">' +
          '<div class="sport-sel-info">' +
            '<span class="sport-sel-name">' + esc(sel.label) + '</span>' +
            '<span class="sport-sel-bookie">Best price: ' + esc(sel.bookmaker) + '</span>' +
          '</div>' +
          '<div class="sport-sel-actions">' +
            '<button type="button" class="sport-odds-btn" data-open-bookie=\\'' + betData + '\\' title="Place with ' + esc(sel.bookmaker) + '">' + esc(sel.fractional) + '</button>' +
            '<button type="button" class="btn small" data-diary=\\'' + betData + '\\' title="Add to Bet Diary">+ Diary</button>' +
            '<button type="button" class="btn-add-cross-acca" data-add-cross-acca=\\'' + betData + '\\' title="Add to Accumulator">+ Acca</button>' +
          '</div>' +
        '</div>';
      }).join('');

      return '<div class="sport-event-card">' +
        '<div class="sport-card-head">' +
          '<div>' +
            '<h3 class="sport-event-title">' + esc(ev.title) + '</h3>' +
            '<div class="sport-tournament-sub">' + esc(t.tournament) + ' · ' + esc(ev.round) + '</div>' +
          '</div>' +
          '<span class="badge validated">' + esc(ev.date) + '</span>' +
        '</div>' +
        '<div class="sport-odds-list">' + selectionsHtml + '</div>' +
      '</div>';
    }).join('');

    return '<div class="sport-tournament-block" style="margin-bottom:18px">' +
      '<div class="section-head" style="margin-bottom:10px"><div><h3 class="section-title" style="font-size:1.15rem">' + esc(sportData.icon) + ' ' + esc(t.tournament) + '</h3>' +
      '<span class="section-note">' + esc(t.course || t.venue || t.surface || 'Official UK Bookmaker Prices') + '</span></div>' +
      '<span class="badge provisional">UK Odds Live</span></div>' +
      '<div class="sport-events-grid">' + eventsHtml + '</div>' +
    '</div>';
  }).join('');
}"""

assert old_view_picks_end in app_js, "old_view_picks_end not found!"
app_js = app_js.replace(old_view_picks_end, new_view_picks_end, 1)

# 4. Integrate multi-sport selections into builderCompute() leg pool when other sports are active
old_builder_compute = """function builderCompute() {
  const { stake, legs, win } = builderState;
  const pool = MatchIQBuilder.legPool(predictionsList(), { calc, reliability: DATA.reliability, feedFor, nowMs: Date.now() });
  builderResult = MatchIQBuilder.buildSlips(pool, { stake, win, legs });
  try { localStorage.setItem(BUILDER_KEY, JSON.stringify(builderState)); } catch (e) { /* ignore */ }
}"""

new_builder_compute = """function builderCompute() {
  const { stake, legs, win } = builderState;
  const footballPool = activeSports.includes('football')
    ? MatchIQBuilder.legPool(predictionsList(), { calc, reliability: DATA.reliability, feedFor, nowMs: Date.now() })
    : [];

  // Multi-Sport Pool Injection
  const multiSportPool = [];
  if (DATA.multiSport && DATA.multiSport.sports) {
    activeSports.forEach(sportKey => {
      if (sportKey === 'football') return;
      const sp = DATA.multiSport.sports[sportKey];
      if (!sp || !sp.tournaments) return;
      sp.tournaments.forEach(t => {
        (t.events || []).forEach(ev => {
          (ev.selections || []).forEach(sel => {
            if (sel.decimal && sel.decimal > 1.05) {
              const estimatedProb = 1 / (sel.decimal * 1.07);
              multiSportPool.push({
                matchId: ev.id,
                fixture: { home: ev.title, away: sp.name, competition: sportKey.toUpperCase() },
                kickoff: Date.now() + 86400000,
                id: ev.id + '-' + sel.label,
                label: sel.label + ' (' + sp.name + ')',
                market: 'match',
                p: estimatedProb,
                odds: sel.decimal,
                fractional: sel.fractional,
                bookmaker: sel.bookmaker || 'UK Bookmaker',
                priceSource: 'live',
                support: 'validated',
                basis: sp.name + ' UK Odds'
              });
            }
          });
        });
      });
    });
  }

  const combinedPool = footballPool.concat(multiSportPool);
  builderResult = MatchIQBuilder.buildSlips(combinedPool, { stake, win, legs });
  try { localStorage.setItem(BUILDER_KEY, JSON.stringify(builderState)); } catch (e) { /* ignore */ }
}"""

assert old_builder_compute in app_js, "old_builder_compute not found!"
app_js = app_js.replace(old_builder_compute, new_builder_compute, 1)

# 5. Update click handler in app.js for data-toggle-sport
old_click_sport = """  if (t.dataset.switchSport !== undefined) {
    setSport(t.dataset.switchSport);
    return;
  }"""

new_click_sport = """  if (t.dataset.toggleSport !== undefined) {
    toggleSport(t.dataset.toggleSport);
    return;
  }
  if (t.dataset.switchSport !== undefined) {
    toggleSport(t.dataset.switchSport);
    return;
  }"""

assert old_click_sport in app_js, "old_click_sport not found!"
app_js = app_js.replace(old_click_sport, new_click_sport, 1)

# Write app.js
app_path.write_text(app_js, encoding="utf-8")
print("Successfully patched app.js with multi-sport toggle support!")

# 6. Add CSS in styles.css for sport toggle pills with indicator dots
css_path = ROOT / "styles.css"
css_code = css_path.read_text(encoding="utf-8")

toggle_css = """

/* Multi-Sport Toggle Header & Indicator */
.sport-filter-section {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.sport-filter-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 6px;
}
.sport-filter-title {
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #38bdf8;
}
.sport-filter-hint {
  font-size: 0.76rem;
  color: #94a3b8;
}
.sport-toggle-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
  display: inline-block;
  transition: all 0.2s ease;
}
.sport-toggle-dot.on {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}
.sport-pill.active {
  background: rgba(16, 185, 129, 0.16);
  border-color: #10b981;
  color: #fff;
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.25);
}
"""

css_code += toggle_css
css_path.write_text(css_code, encoding="utf-8")
print("Successfully appended toggle styles to styles.css!")
