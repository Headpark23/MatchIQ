import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
app_path = root / 'app.js'
app_src = app_path.read_text(encoding='utf-8')

# 1. Update updateOddsToggleLabel
old_update_odds = """function updateOddsToggleLabel() {
  const lbl = $('odds-mode-val');
  if (lbl) lbl.textContent = oddsFormat === 'decimal' ? 'Decimal' : 'Fractional';
}"""
new_update_odds = """function updateOddsToggleLabel() {
  const lbl = $('odds-mode-val');
  if (lbl) lbl.textContent = oddsFormat === 'decimal' ? 'Decimal' : 'Fractional';
  const btn = $('odds-toggle');
  if (btn) btn.setAttribute('data-active-mode', oddsFormat);
}"""
assert old_update_odds in app_src, "old_update_odds not found"
app_src = app_src.replace(old_update_odds, new_update_odds)

# 2. Update crest with halo glow
old_crest = """function crest(name, size = 32) {
  const [c1, c2, abbr] = CLUBS[name] || ['#1E293B', '#94A3B8', String(name || 'FC').slice(0, 3).toUpperCase()];
  const ink = ['#F4F4F4', '#FFFFFF', '#FDB913', '#F5A12D', '#59CBE8', '#6CABDD'].includes(c1) ? '#0b1220' : '#FFFFFF';
  return '<svg class="crest" width="' + size + '" height="' + size + '" viewBox="0 0 48 48" role="img" aria-label="' + esc(name) + ' crest">' +
    '<path d="M24 4 40 10v14c0 9-8 17-16 20C16 41 8 33 8 24V10Z" fill="' + c1 + '" stroke="' + c2 + '" stroke-width="2.4"/>' +
    '<text x="24" y="28.5" text-anchor="middle" font-family="Oswald, sans-serif" font-weight="600" font-size="12" fill="' + ink + '">' + esc(abbr) + '</text></svg>';
}"""
new_crest = """function crest(name, size = 32) {
  const [c1, c2, abbr] = CLUBS[name] || ['#1E293B', '#94A3B8', String(name || 'FC').slice(0, 3).toUpperCase()];
  const ink = ['#F4F4F4', '#FFFFFF', '#FDB913', '#F5A12D', '#59CBE8', '#6CABDD'].includes(c1) ? '#0b1220' : '#FFFFFF';
  const glow = (c1.startsWith('#') && c1.length === 7) ? c1 + '44' : 'rgba(56, 189, 248, 0.25)';
  return '<svg class="crest" style="--crest-glow:' + glow + '" width="' + size + '" height="' + size + '" viewBox="0 0 48 48" role="img" aria-label="' + esc(name) + ' crest">' +
    '<path d="M24 4 40 10v14c0 9-8 17-16 20C16 41 8 33 8 24V10Z" fill="' + c1 + '" stroke="' + c2 + '" stroke-width="2.4"/>' +
    '<text x="24" y="28.5" text-anchor="middle" font-family="Oswald, sans-serif" font-weight="600" font-size="12" fill="' + ink + '">' + esc(abbr) + '</text></svg>';
}"""
assert old_crest in app_src, "old_crest not found"
app_src = app_src.replace(old_crest, new_crest)

# 3. Currency symbol wrapper on win input
old_win_input = """'<div class="win-input-wrap"><input id="b-win" class="ctl mono win-input" type="number" inputmode="decimal" min="1" max="10000" step="1" value="' + win + '" data-b="win" placeholder="50">' +"""
new_win_input = """'<div class="win-input-wrap"><div class="currency-input-wrap"><span class="currency-symbol">£</span><input id="b-win" class="ctl mono win-input" type="number" inputmode="decimal" min="1" max="10000" step="1" value="' + win + '" data-b="win" placeholder="50"></div>' +"""
assert old_win_input in app_src, "old_win_input not found"
app_src = app_src.replace(old_win_input, new_win_input)

# 4. celebrateSave function and hook in handleDiaryFormSubmit
celebrate_fn = """
function celebrateSave() {
  try {
    const container = document.createElement('div');
    container.className = 'celebration-wrap';
    document.body.appendChild(container);
    const ring = document.createElement('div');
    ring.className = 'celebration-ring';
    container.appendChild(ring);
    const colors = ['#10b981', '#34d399', '#38bdf8', '#f59e0b', '#ffffff'];
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('span');
      p.className = 'celebration-sparkle';
      const angle = (i / 20) * 2 * Math.PI;
      const dist = 60 + Math.random() * 80;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist - 20;
      p.style.setProperty('--tx', tx + 'px');
      p.style.setProperty('--ty', ty + 'px');
      p.style.backgroundColor = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.1) + 's';
      container.appendChild(p);
    }
    setTimeout(() => container.remove(), 1200);
  } catch (e) { /* ignore */ }
}
"""

if "function celebrateSave()" not in app_src:
    app_src = app_src.replace("function handleDiaryFormSubmit(event) {", celebrate_fn + "\nfunction handleDiaryFormSubmit(event) {")

old_close = "closeDiary();\n  toast('Saved to your Bet Diary.');"
new_close = "closeDiary();\n  celebrateSave();\n  toast('Saved to your Bet Diary.');"
assert old_close in app_src, "old_close not found"
app_src = app_src.replace(old_close, new_close)

# 5. Beginner Bento Guides
beginner_guides_fn = """
function beginnerGuides() {
  return '<div class="section"><div class="section-head"><h2 class="section-title">New to Bet Buddy? Quick intelligence guides</h2><span class="section-note">Tap any card to understand how honest football prediction works.</span></div>' +
    '<div class="bento-grid">' +
      '<div class="bento-card"><div class="bento-icon">🎯</div><div><div class="bento-kicker">Betting Intelligence</div><h3 class="bento-title">What is Value?</h3><p class="bento-desc">A 60% chance isn’t value if the bookmaker odds are too low. Value is when the payout beats the true risk.</p></div><span class="bento-badge emerald">+5% EV threshold</span></div>' +
      '<div class="bento-card"><div class="bento-icon">🎲</div><div><div class="bento-kicker">Odds Demystified</div><h3 class="bento-title">6/4 vs 2.50 Odds</h3><p class="bento-desc">6/4 is UK fractional: £6 profit per £4 stake. 2.50 is decimal: total return including stake. Switch anytime in the header!</p></div><span class="bento-badge">Toggle in header</span></div>' +
      '<div class="bento-card"><div class="bento-icon">⚡</div><div><div class="bento-kicker">Accas & Builders</div><h3 class="bento-title">Target Profit Bet Builder</h3><p class="bento-desc">Combine selections for higher returns. Bet Buddy checks upcoming matches to find the highest-chance path to your win goal.</p></div><span class="bento-badge">Real-time scan</span></div>' +
      '<div class="bento-card"><div class="bento-icon">🛡️</div><div><div class="bento-kicker">Honest Predictions</div><h3 class="bento-title">No Bet is an Answer</h3><p class="bento-desc">When evidence is thin, odds are bad or data is missing, we say No Bet. We never invent fake confidence or forced picks.</p></div><span class="bento-badge amber">Zero hype</span></div>' +
    '</div></div>';
}
"""

if "function beginnerGuides()" not in app_src:
    app_src = app_src.replace("function viewHome() {", beginner_guides_fn + "\nfunction viewHome() {")

old_explain = "html += '<details class=\"card section\"><summary class=\"section-title\""
new_explain = "html += beginnerGuides() + '<details class=\"card section\"><summary class=\"section-title\""
assert old_explain in app_src, "old_explain not found"
app_src = app_src.replace(old_explain, new_explain)

app_path.write_text(app_src, encoding='utf-8')
print("app.js updated successfully.")

