import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent

# 1. Update styles.css
styles_path = root / 'styles.css'
styles = styles_path.read_text(encoding='utf-8')

# Body background
old_bg = re.search(r'background:\s*radial-gradient\(1200px.*?var\(--bg\);', styles, re.DOTALL)
if old_bg:
    new_bg = """background:
    radial-gradient(1100px 520px at 50% -40px, rgba(56, 189, 248, 0.13), transparent 72%),
    radial-gradient(900px 600px at 90% 12%, rgba(16, 185, 129, 0.08), transparent 60%),
    radial-gradient(750px 500px at 10% 28%, rgba(99, 102, 241, 0.06), transparent 55%),
    var(--bg);"""
    styles = styles[:old_bg.start()] + new_bg + styles[old_bg.end():]

# Card styling
styles = styles.replace(
    ".card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; box-shadow: var(--shadow); }",
    ".card { background: var(--surface); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; box-shadow: var(--shadow); transition: transform .18s cubic-bezier(0.16, 1, 0.3, 1), border-color .18s, box-shadow .18s; }\n.card:hover { border-color: rgba(255, 255, 255, 0.14); }"
)

# Crest halos & tactile spring feedback
crest_target = ".crest { flex: none; display: block; }"
crest_replacement = """.crest { flex: none; display: block; filter: drop-shadow(0 0 8px var(--crest-glow, rgba(56, 189, 248, 0.25))) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6)); transition: transform .22s cubic-bezier(0.34, 1.56, 0.64, 1), filter .22s ease; }
.crest:hover { transform: scale(1.12); filter: drop-shadow(0 0 14px var(--crest-glow, rgba(56, 189, 248, 0.45))) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.7)); }
.btn, .legpick, .win-chip, .odds-toggle { transition: transform .12s cubic-bezier(0.34, 1.56, 0.64, 1), background .15s, border-color .15s, box-shadow .15s; }
.btn:active, .legpick:active, .win-chip:active, .odds-toggle:active { transform: scale(0.95); }"""
styles = styles.replace(crest_target, crest_replacement)

# Segmented odds toggle styling
odds_target = ".odds-toggle { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; min-height: 38px; border-radius: 10px; border: 1px solid var(--line-strong); background: rgba(255, 255, 255, 0.05); font-size: 13px; font-weight: 500; color: var(--muted); transition: border-color .15s, background .15s; }\n.odds-toggle:hover { border-color: var(--cyan); background: rgba(255, 255, 255, 0.08); color: #fff; }\n.odds-toggle b { color: var(--cyan); }"
odds_replacement = """.odds-toggle { display: inline-flex; align-items: center; gap: 3px; padding: 3px 5px; min-height: 36px; border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(14, 23, 40, 0.75); backdrop-filter: blur(10px); font-size: 13px; font-weight: 500; color: var(--muted); box-shadow: 0 2px 10px rgba(0,0,0,0.25); cursor: pointer; }
.odds-toggle:hover { border-color: var(--cyan); box-shadow: 0 0 14px rgba(56, 189, 248, 0.25); }
.odds-segment { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; color: var(--muted); transition: all .2s cubic-bezier(0.16, 1, 0.3, 1); user-select: none; }
.odds-toggle[data-active-mode="fractional"] .odds-segment[data-seg="fractional"],
.odds-toggle[data-active-mode="decimal"] .odds-segment[data-seg="decimal"] { background: linear-gradient(135deg, rgba(56, 189, 248, 0.24), rgba(16, 185, 129, 0.24)); color: #fff; border: 1px solid rgba(56, 189, 248, 0.4); box-shadow: 0 0 10px rgba(56, 189, 248, 0.2); }"""
styles = styles.replace(odds_target, odds_replacement)

# Currency floating wrapper, celebration, and bento cards CSS
append_css = """
/* Floating currency symbol and celebration */
.currency-input-wrap { position: relative; display: inline-flex; align-items: center; }
.currency-symbol { position: absolute; left: 14px; font-family: var(--mono); font-weight: 700; font-size: 16px; color: var(--pick); pointer-events: none; z-index: 2; }
.currency-input-wrap .win-input { padding-left: 32px !important; max-width: 170px; font-size: 16px; }

.celebration-wrap { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; z-index: 10000; display: flex; align-items: center; justify-content: center; }
.celebration-ring { width: 40px; height: 40px; border-radius: 50%; border: 3px solid var(--pick); box-shadow: 0 0 30px var(--pick), inset 0 0 20px var(--pick); animation: ringBurst 0.75s cubic-bezier(0.1, 0.9, 0.2, 1) forwards; }
@keyframes ringBurst { 0% { transform: scale(0.3); opacity: 1; } 100% { transform: scale(5.5); opacity: 0; } }
.celebration-sparkle { position: absolute; width: 7px; height: 7px; border-radius: 50%; box-shadow: 0 0 8px currentColor; animation: sparkleFly 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
@keyframes sparkleFly { 0% { transform: translate(0, 0) scale(1); opacity: 1; } 100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; } }

/* Beginner Explainer Bento Cards */
.bento-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-top: 14px; }
.bento-card { background: var(--surface); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; box-shadow: var(--shadow); display: flex; flex-direction: column; justify-content: space-between; gap: 12px; position: relative; overflow: hidden; transition: transform .2s cubic-bezier(0.16, 1, 0.3, 1), border-color .2s, box-shadow .2s; }
.bento-card:hover { transform: translateY(-2px); border-color: rgba(56, 189, 248, 0.3); box-shadow: 0 12px 28px -10px rgba(56, 189, 248, 0.15); }
.bento-icon { font-size: 24px; line-height: 1; }
.bento-kicker { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--cyan); }
.bento-title { font-family: var(--display); font-weight: 600; font-size: 18px; color: #fff; margin-top: 2px; }
.bento-desc { font-size: 13.5px; color: var(--soft); line-height: 1.5; }
.bento-badge { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: rgba(56, 189, 248, 0.1); color: var(--cyan); border: 1px solid rgba(56, 189, 248, 0.25); }
.bento-badge.emerald { background: rgba(16, 185, 129, 0.1); color: #34d399; border-color: rgba(16, 185, 129, 0.25); }
.bento-badge.amber { background: var(--amber-soft); color: #fde68a; border-color: rgba(245, 158, 11, 0.3); }
"""

if "/* Floating currency symbol and celebration */" not in styles:
    styles += append_css

styles_path.write_text(styles, encoding='utf-8')
print("styles.css updated successfully.")
