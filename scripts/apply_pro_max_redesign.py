import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent

# 1. Update index.html for Plus Jakarta Sans font
index_path = root / 'index.html'
index_src = index_path.read_text(encoding='utf-8')

old_font = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&family=Oswald:wght@500;600&display=swap" rel="stylesheet">'
new_font = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&family=Oswald:wght@500;600&display=swap" rel="stylesheet">'

if old_font in index_src:
    index_src = index_src.replace(old_font, new_font)
    index_path.write_text(index_src, encoding='utf-8')
    print("index.html font updated.")

# 2. Update styles.css
styles_path = root / 'styles.css'
styles = styles_path.read_text(encoding='utf-8')

# Change --display token to Plus Jakarta Sans
styles = re.sub(
    r"--display:\s*'Oswald'[^;]*;",
    "--display: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
    styles
)

# Refine Typography & Headings
old_type = """.page-title { font-family: var(--display); font-weight: 600; font-size: clamp(28px, 4.4vw, 42px); line-height: 1.05; color: #fff; }
.page-sub { color: var(--muted); max-width: 64ch; margin-top: 6px; }
.section { margin-top: 32px; }
.section-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 16px; margin-bottom: 12px; }
.section-title { font-family: var(--display); font-weight: 500; font-size: 22px; color: #fff; }"""

new_type = """.page-title { font-family: var(--display); font-weight: 800; font-size: clamp(28px, 4.2vw, 40px); line-height: 1.1; letter-spacing: -0.03em; color: #fff; }
.page-sub { color: var(--soft); max-width: 64ch; margin-top: 6px; font-size: 15px; line-height: 1.55; }
.section { margin-top: 32px; }
.section-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 16px; margin-bottom: 14px; }
.section-title { font-family: var(--display); font-weight: 700; font-size: 21px; letter-spacing: -0.02em; color: #fff; }"""

if old_type in styles:
    styles = styles.replace(old_type, new_type)

# Refine match rec-row styling with distribution bar and pro scoreboard layout
old_rec_row = """.rec-row { display: grid; grid-template-columns: 58px minmax(0, 0.9fr) minmax(0, 1.3fr) minmax(0, 1fr) 20px; gap: 14px; align-items: center; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--line); background: rgba(14, 23, 40, 0.7); text-decoration: none; color: inherit; margin-bottom: 8px; min-height: 64px; }
.rec-row:hover { border-color: var(--line-strong); background: rgba(19, 32, 58, 0.9); }
.rec-row-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
.rec-row-pick { font-family: var(--display); font-weight: 500; font-size: 17px; color: #fff; }
.rec-row-side { display: grid; gap: 6px; justify-items: start; font-size: 12.5px; }"""

new_rec_row = """.rec-row { display: grid; grid-template-columns: 78px minmax(0, 1.25fr) minmax(0, 1.2fr) minmax(0, 1fr) 22px; gap: 16px; align-items: center; padding: 14px 18px; border-radius: 16px; border: 1px solid var(--line); background: var(--surface); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); text-decoration: none; color: inherit; margin-bottom: 10px; min-height: 72px; box-shadow: 0 4px 20px -8px rgba(0, 0, 0, 0.5); transition: transform .18s cubic-bezier(0.16, 1, 0.3, 1), border-color .18s, box-shadow .18s; }
.rec-row:hover { transform: translateY(-2px); border-color: rgba(56, 189, 248, 0.35); background: rgba(19, 30, 52, 0.9); box-shadow: 0 14px 34px -10px rgba(0, 0, 0, 0.65), 0 0 20px -6px var(--cyan-glow); }
.rec-row-main { display: flex; align-items: center; gap: 12px; min-width: 0; }
.rec-row-pick { font-family: var(--display); font-weight: 700; font-size: 16.5px; color: #fff; letter-spacing: -0.015em; }
.rec-row-side { display: grid; gap: 6px; justify-items: start; font-size: 12.5px; }
.match-dist-bar { display: flex; height: 5px; border-radius: 9999px; overflow: hidden; background: rgba(255, 255, 255, 0.08); margin-top: 7px; gap: 2px; }
.bar-seg.home { background: var(--cyan); }
.bar-seg.draw { background: rgba(148, 163, 184, 0.45); }
.bar-seg.away { background: var(--amber); }"""

if old_rec_row in styles:
    styles = styles.replace(old_rec_row, new_rec_row)

# Refine Bet Builder Hero with glowing accent gradient and clean cards
old_builder_css = """.builder { position: relative; padding: 26px 28px 22px; border-radius: 22px; border: 1px solid rgba(255, 255, 255, 0.12); overflow: hidden; isolation: isolate;
  background: radial-gradient(700px 320px at 85% -20%, rgba(52, 211, 153, 0.16), transparent 60%), linear-gradient(160deg, #0d1a2e, #08111f); }"""

new_builder_css = """.builder { position: relative; padding: 30px 32px 26px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.12); overflow: hidden; isolation: isolate;
  background: radial-gradient(800px 360px at 90% -10%, rgba(16, 185, 129, 0.18), transparent 65%), radial-gradient(600px 300px at 10% 110%, rgba(56, 189, 248, 0.12), transparent 60%), linear-gradient(160deg, #0c182c, #070e1b);
  box-shadow: 0 24px 50px -15px rgba(0, 0, 0, 0.75), 0 0 30px -15px rgba(16, 185, 129, 0.2); }"""

if old_builder_css in styles:
    styles = styles.replace(old_builder_css, new_builder_css)

# Refine Ticket Slip styling
old_slip = """.slip { padding: 16px; border-radius: var(--radius); border: 1px solid var(--line); background: rgba(5, 12, 22, 0.55); }
.slip.primary { border-color: rgba(52, 211, 153, 0.5); box-shadow: 0 0 0 1px rgba(52, 211, 153, 0.12), 0 18px 40px -22px var(--pick-glow); }"""

new_slip = """.slip { padding: 20px 22px; border-radius: 20px; border: 1px solid var(--line); background: rgba(9, 16, 30, 0.75); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); position: relative; }
.slip.primary { border-color: rgba(16, 185, 129, 0.5); box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.2), 0 20px 44px -20px var(--pick-glow); background: linear-gradient(165deg, rgba(16, 185, 129, 0.08), rgba(9, 16, 30, 0.88) 45%); }"""

if old_slip in styles:
    styles = styles.replace(old_slip, new_slip)

styles_path.write_text(styles, encoding='utf-8')
print("styles.css pro max design applied.")

# 3. Update app.js for matchRecRow to include the probability distribution bar
app_path = root / 'app.js'
app_src = app_path.read_text(encoding='utf-8')

old_row_fn = """function matchRecRow(pred) {
  const f = pred.fixture, ms = kickoffMs(f), m = (pred.recommendations || {}).most_likely || {}, r = pred.markets.result;
  const status = m.status === 'provisional' && m.strength === 'none' ? 'league' : m.status;
  const pick = m.decision === 'most_likely'
    ? ring(m.p, 56, status === 'validated' ? '' : 'provisional') + '<span><span class="dim" style="display:block;font-size:12px">Most likely · ' + esc(MARKETS[m.market].name) + '</span><b class="rec-row-pick">' + esc(m.label) + '</b></span>'
    : '<span><b class="rec-row-pick">No bet</b><span class="dim" style="display:block;font-size:12px">Not enough evidence</span></span>';
  return '<a class="rec-row" href="#/match/' + encodeURIComponent(pred.match_id) + '">' +
    '<span class="fx-time">' + esc(fmtTime(ms)) + '<small>' + esc(fmtDay(ms)) + '</small>' + (compFilter === 'ALL' ? '<small class="lg-tag">' + esc(f.competition || 'PL') + '</small>' : '') + '</span>' +
    '<span class="fx-teams"><span class="teams-line">' + crest(f.home, 22) + '<span>' + esc(f.home) + '</span></span><span class="teams-line">' + crest(f.away, 22) + '<span>' + esc(f.away) + '</span></span></span>' +
    '<span class="rec-row-main">' + pick + '</span>' +
    '<span class="rec-row-side"><span class="dim">Result lean: <b style="color:#fff">' + esc(r.pick.label) + '</b> ' + pct(r.pick.p) + (r.evidence.status !== 'validated' ? ' <span class="badge provisional">Provisional</span>' : '') + '</span>' + valueStatus(pred) + '</span>' +
    '<span class="fx-chev" aria-hidden="true">›</span></a>';
}"""

new_row_fn = """function matchRecRow(pred) {
  const f = pred.fixture, ms = kickoffMs(f), m = (pred.recommendations || {}).most_likely || {}, r = pred.markets.result;
  const status = m.status === 'provisional' && m.strength === 'none' ? 'league' : m.status;
  const pick = m.decision === 'most_likely'
    ? ring(m.p, 54, status === 'validated' ? '' : 'provisional') + '<span><span class="dim" style="display:block;font-size:11.5px">Most likely · ' + esc(MARKETS[m.market].name) + '</span><b class="rec-row-pick">' + esc(m.label) + '</b></span>'
    : '<span><b class="rec-row-pick">No bet</b><span class="dim" style="display:block;font-size:11.5px">Not enough evidence</span></span>';

  // Horizontal match result distribution bar
  const sels = (r && r.selections) || [];
  const hP = Math.round(((sels.find(s => s.outcome === 'home') || {}).p || 0) * 100);
  const dP = Math.round(((sels.find(s => s.outcome === 'draw') || {}).p || 0) * 100);
  const aP = Math.max(0, 100 - hP - dP);
  const distBar = sels.length >= 3
    ? '<div class="match-dist-bar" title="Model probabilities: Home ' + hP + '%, Draw ' + dP + '%, Away ' + aP + '%"><span class="bar-seg home" style="width:' + hP + '%"></span><span class="bar-seg draw" style="width:' + dP + '%"></span><span class="bar-seg away" style="width:' + aP + '%"></span></div>'
    : '';

  return '<a class="rec-row" href="#/match/' + encodeURIComponent(pred.match_id) + '">' +
    '<span class="fx-time">' + esc(fmtTime(ms)) + '<small>' + esc(fmtDay(ms)) + '</small>' + (compFilter === 'ALL' ? '<small class="lg-tag">' + esc(f.competition || 'PL') + '</small>' : '') + '</span>' +
    '<span class="fx-teams"><span class="teams-line">' + crest(f.home, 22) + '<span>' + esc(f.home) + '</span></span><span class="teams-line">' + crest(f.away, 22) + '<span>' + esc(f.away) + '</span></span>' + distBar + '</span>' +
    '<span class="rec-row-main">' + pick + '</span>' +
    '<span class="rec-row-side"><span class="dim">Lean: <b style="color:#fff">' + esc(r.pick.label) + '</b> ' + pct(r.pick.p) + (r.evidence.status !== 'validated' ? ' <span class="badge provisional">Provisional</span>' : '') + '</span>' + valueStatus(pred) + '</span>' +
    '<span class="fx-chev" aria-hidden="true">›</span></a>';
}"""

if old_row_fn in app_src:
    app_src = app_src.replace(old_row_fn, new_row_fn)
    app_path.write_text(app_src, encoding='utf-8')
    print("app.js matchRecRow updated with distribution bar.")
