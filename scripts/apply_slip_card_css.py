from pathlib import Path
import re

styles_p = Path("styles.css")
css = styles_p.read_text(encoding="utf-8")

slip_card_css = """
/* ============================================================
   SLIP CARD COMPONENT & MODAL (Bet Butler Slip Note)
   ============================================================ */
.slip-card-dialog {
  max-width: 520px !important;
  width: 95% !important;
  background: #09101e !important;
  border: 1px solid rgba(56, 189, 248, 0.35) !important;
  border-radius: 20px !important;
  padding: 0 !important;
  overflow: hidden !important;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85) !important;
}
.slip-card-dialog .modal-head {
  padding: 16px 20px !important;
  background: rgba(15, 23, 42, 0.8) !important;
  border-bottom: 1px solid var(--line) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
}
.slip-card-badge {
  font-size: 11px !important;
  font-weight: 800 !important;
  letter-spacing: 0.08em !important;
  color: var(--cyan) !important;
  text-transform: uppercase !important;
  margin-bottom: 2px !important;
}
.slip-card-heading {
  font-size: 1.25rem !important;
  font-weight: 800 !important;
  color: #fff !important;
  margin: 0 !important;
}
.slip-card-body {
  padding: 16px 20px 20px !important;
  max-height: 82vh !important;
  overflow-y: auto !important;
}
.slip-card-hint-bar {
  padding: 10px 14px !important;
  border-radius: 10px !important;
  background: rgba(56, 189, 248, 0.08) !important;
  border: 1px solid rgba(56, 189, 248, 0.25) !important;
  font-size: 12.5px !important;
  color: #cbd5e1 !important;
  line-height: 1.4 !important;
  margin-bottom: 14px !important;
}
.slip-card-legs {
  display: flex !important;
  flex-direction: column !important;
  gap: 10px !important;
  margin-bottom: 16px !important;
}
.slip-card-leg-item {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
  padding: 12px 14px !important;
  border-radius: 12px !important;
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1.5px solid var(--line-strong) !important;
  transition: all 0.15s ease !important;
  min-height: 52px !important;
}
.slip-card-leg-item.ticked {
  background: rgba(16, 185, 129, 0.08) !important;
  border-color: rgba(16, 185, 129, 0.4) !important;
}
.slip-card-leg-left {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  min-width: 0 !important;
  flex: 1 1 auto !important;
}
.slip-leg-checkbox-wrap {
  display: flex !important;
  align-items: center !important;
  cursor: pointer !important;
  flex-shrink: 0 !important;
}
.slip-leg-checkbox {
  appearance: none !important;
  -webkit-appearance: none !important;
  width: 24px !important;
  height: 24px !important;
  border: 2px solid var(--line-strong) !important;
  border-radius: 6px !important;
  background: rgba(15, 23, 42, 0.8) !important;
  cursor: pointer !important;
  display: grid !important;
  place-content: center !important;
  transition: all 0.15s ease !important;
}
.slip-leg-checkbox:checked {
  background: var(--pick) !important;
  border-color: var(--pick) !important;
}
.slip-leg-checkbox:checked::before {
  content: "✓" !important;
  color: #03140d !important;
  font-size: 15px !important;
  font-weight: 900 !important;
}
.slip-card-leg-info {
  min-width: 0 !important;
  overflow: hidden !important;
}
.slip-card-leg-num {
  font-size: 11px !important;
  font-weight: 700 !important;
  color: var(--muted) !important;
  text-transform: uppercase !important;
  display: block !important;
  margin-bottom: 2px !important;
}
.slip-card-leg-match {
  font-size: 13.5px !important;
  font-weight: 700 !important;
  color: #fff !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  display: block !important;
}
.slip-card-leg-item.ticked .slip-card-leg-match,
.slip-card-leg-item.ticked .slip-card-leg-sel {
  color: #a7f3d0 !important;
}
.slip-card-leg-sel {
  font-size: 12.5px !important;
  font-weight: 600 !important;
  color: var(--cyan) !important;
  display: block !important;
  margin-top: 2px !important;
}
.slip-card-leg-right {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-end !important;
  gap: 4px !important;
  flex-shrink: 0 !important;
}
.slip-card-leg-odds {
  font-family: var(--mono) !important;
  font-size: 14px !important;
  font-weight: 700 !important;
  padding: 4px 10px !important;
  border-radius: 8px !important;
  background: rgba(56, 189, 248, 0.12) !important;
  border: 1px solid rgba(56, 189, 248, 0.3) !important;
  color: #fff !important;
}
.slip-card-tick-label {
  font-size: 11px !important;
  color: var(--muted) !important;
  cursor: pointer !important;
}
.slip-card-leg-item.ticked .slip-card-tick-label {
  color: #34d399 !important;
  font-weight: 600 !important;
}
.slip-card-summary {
  padding: 12px 14px !important;
  border-radius: 12px !important;
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid var(--line) !important;
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  gap: 8px !important;
  margin-bottom: 16px !important;
  font-size: 12.5px !important;
}
.slip-card-summary span {
  color: var(--muted) !important;
}
.slip-card-summary b {
  color: #fff !important;
  font-family: var(--mono) !important;
}
.slip-card-disclaimer {
  font-size: 11.5px !important;
  color: var(--muted) !important;
  text-align: center !important;
  margin-top: 14px !important;
  line-height: 1.4 !important;
}
"""

if "/* ============================================================\n   SLIP CARD COMPONENT & MODAL" not in css:
    css += "\n" + slip_card_css
else:
    css = re.sub(
        r"/\* ============================================================\n   SLIP CARD COMPONENT & MODAL.*?(?=\Z)",
        slip_card_css.strip(),
        css,
        flags=re.DOTALL
    )

styles_p.write_text(css, encoding="utf-8")
print("styles.css updated with Slip Card styles")

