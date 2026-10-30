with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

bookie_css = """
/* ---------- Phase 3: 1-Click Bookmaker Launcher Bar on Slip Cards ---------- */
.slip-bookie-bar {
  margin: 14px 0 10px;
  padding: 10px 14px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
}
.slip-bookie-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.slip-bookie-bolt { font-size: 13px; color: var(--emerald); }
.slip-bookie-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #fff; }
.slip-bookie-hint { font-size: 11px; color: var(--muted); margin-left: auto; }
.slip-bookie-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.bookie-pill {
  appearance: none;
  border: 1px solid var(--line-strong);
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
  border-radius: 10px;
  padding: 7px 10px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.bookie-pill:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.bookie-pill .pill-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.bookie-pill.b365:hover { background: rgba(16, 185, 129, 0.18); border-color: #10b981; color: #34d399; }
.bookie-pill.sky:hover { background: rgba(56, 189, 248, 0.18); border-color: #38bdf8; color: #38bdf8; }
.bookie-pill.lv:hover { background: rgba(249, 115, 22, 0.18); border-color: #f97316; color: #fb923c; }
.bookie-pill.bf:hover { background: rgba(251, 191, 36, 0.18); border-color: #fbbf24; color: #fde68a; }

@media (max-width: 600px) {
  .slip-bookie-buttons { grid-template-columns: 1fr 1fr; gap: 6px; }
  .slip-bookie-hint { display: none; }
}
"""

if ".slip-bookie-bar" not in css:
    css = css + "\n" + bookie_css
    with open('styles.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print("Added slip-bookie-bar CSS styles")
else:
    print("slip-bookie-bar CSS already in styles.css")

