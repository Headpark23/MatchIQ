import re
from pathlib import Path

styles_path = Path("styles.css")
styles = styles_path.read_text(encoding="utf-8")

# 1. Fix .slip-legs base rule to include padding: 0 and max-width: 100%
styles = re.sub(
    r"\.slip-legs\s*\{\s*list-style:\s*none;\s*margin:\s*12px 0 4px;\s*display:\s*grid;\s*\}",
    ".slip-legs { list-style: none; margin: 12px 0 4px; padding: 0; display: grid; width: 100%; max-width: 100%; box-sizing: border-box; }",
    styles
)

# 2. Add box-sizing: border-box and overflow: hidden to base .slip
styles = re.sub(
    r"\.slip\s*\{\s*padding:\s*20px 22px;\s*border-radius:\s*20px;\s*border:\s*1px solid var\(--line\);\s*background:\s*rgba\(9, 16, 30, 0\.75\);\s*backdrop-filter:\s*blur\(14px\);\s*-webkit-backdrop-filter:\s*blur\(14px\);\s*position:\s*relative;\s*\}",
    ".slip { padding: 20px 22px; border-radius: 20px; border: 1px solid var(--line); background: rgba(9, 16, 30, 0.75); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); position: relative; max-width: 100%; box-sizing: border-box; overflow: hidden; }",
    styles
)

# 3. Add thorough mobile acca slip styles inside @media (max-width: 680px)
mobile_slip_css = """
/* Responsive Mobile Acca Slip Layout (Phone width <= 680px) */
@media (max-width: 680px) {
  .builder { padding: 16px 12px 16px !important; }
  .slip {
    padding: 14px 12px !important;
    border-radius: 16px !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
  }
  .slip-legs {
    padding: 0 !important;
    margin: 10px 0 4px !important;
    width: 100% !important;
  }
  .slip-leg {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    grid-template-rows: auto auto !important;
    gap: 4px 8px !important;
    padding: 9px 0 !important;
    align-items: center !important;
    min-width: 0 !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }
  .slip-teams {
    grid-column: 1 !important;
    grid-row: 1 !important;
    min-width: 0 !important;
    overflow: hidden !important;
    gap: 8px !important;
  }
  .slip-match {
    min-width: 0 !important;
    overflow: hidden !important;
    font-size: 13.5px !important;
    line-height: 1.25 !important;
  }
  .slip-match small {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    font-size: 11px !important;
    display: block !important;
  }
  .slip-price {
    grid-column: 2 !important;
    grid-row: 1 !important;
    justify-self: end !important;
    align-self: center !important;
    padding: 3px 8px !important;
    min-width: 58px !important;
    font-size: 13px !important;
    box-sizing: border-box !important;
  }
  .slip-price small {
    font-size: 10px !important;
  }
  .slip-pick {
    grid-column: 1 / span 2 !important;
    grid-row: 2 !important;
    min-width: 0 !important;
    width: 100% !important;
    display: flex !important;
    flex-wrap: wrap !important;
    justify-content: space-between !important;
    align-items: baseline !important;
    gap: 2px 8px !important;
    padding: 3px 0 1px !important;
    border-top: 1px dashed rgba(255, 255, 255, 0.06) !important;
  }
  .slip-pick b {
    font-size: 13px !important;
    color: #38bdf8 !important;
    word-break: break-word !important;
    flex: 1 1 auto !important;
    min-width: 0 !important;
  }
  .slip-pick small {
    font-size: 11px !important;
    color: var(--muted) !important;
    flex-shrink: 0 !important;
  }
  .slip-sum {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    gap: 4px 8px !important;
    padding-top: 10px !important;
    font-size: 12px !important;
  }
  .slip-sum span {
    font-size: 11.5px !important;
  }
  .slip-sum b {
    font-size: 12.5px !important;
  }
  .today-slip-pill {
    white-space: normal !important;
    text-align: center !important;
    max-width: 100% !important;
    font-size: 10.5px !important;
    padding: 4px 8px !important;
    box-sizing: border-box !important;
    line-height: 1.3 !important;
  }
  .bookie-pill.sky-prominent {
    white-space: normal !important;
    text-align: center !important;
    padding: 10px 12px !important;
    font-size: 13px !important;
    line-height: 1.35 !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }
  .slip .btn-row {
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
    width: 100% !important;
  }
  .slip .btn-row .btn {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
    box-sizing: border-box !important;
  }
}
"""

if "/* Responsive Mobile Acca Slip Layout" not in styles:
    styles += "\n" + mobile_slip_css
else:
    # replace existing block
    styles = re.sub(
        r"/\* Responsive Mobile Acca Slip Layout.*?(?=\Z|\n/\*|\n@media)",
        mobile_slip_css.strip(),
        styles,
        flags=re.DOTALL
    )

styles_path.write_text(styles, encoding="utf-8")
print("Updated styles.css with mobile acca slip layout")
