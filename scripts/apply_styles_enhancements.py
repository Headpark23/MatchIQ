import re
from pathlib import Path

# ==============================================================================
# 1. UPDATE styles.css
# ==============================================================================
styles_p = Path("styles.css")
css = styles_p.read_text(encoding="utf-8")

# A. Boost contrast variables in :root
css = re.sub(r"--soft:\s*#[a-fA-F0-9]+;", "--soft: #e2e8f0;", css)
css = re.sub(r"--muted:\s*#[a-fA-F0-9]+;", "--muted: #cbd5e1;", css)
css = re.sub(r"--dim:\s*#[a-fA-F0-9]+;", "--dim: #94a3b8;", css)

# B. Jargon tooltip button, service worker update banner, onboarding card, maths toggle, trust bar
extra_css = """
/* ---------- Jargon & Glossary Tooltip Buttons ---------- */
.jargon-tip-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  min-height: 18px !important;
  border-radius: 50%;
  border: 1px solid rgba(56, 189, 248, 0.4);
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  margin-left: 5px;
  padding: 0;
  vertical-align: middle;
  transition: all 0.15s ease;
}
.jargon-tip-btn:hover, .jargon-tip-btn:focus {
  background: #38bdf8;
  color: #03140d;
  border-color: #38bdf8;
  transform: scale(1.1);
}

/* ---------- SW Update Available Banner ---------- */
.sw-update-banner {
  position: sticky;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 10001;
  background: linear-gradient(90deg, #0284c7, #0369a1);
  color: #fff;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  font-size: 13px;
  font-weight: 600;
}
.sw-update-content {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sw-update-banner button {
  min-height: 34px !important;
  padding: 4px 14px;
  font-size: 12.5px;
  background: #fff;
  color: #0369a1;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
}

/* ---------- Slip Trust & Expected Loss Bar ---------- */
.slip-trust-bar {
  margin: 10px 0 6px;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12.5px;
  line-height: 1.4;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.slip-trust-bar.positive {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.4);
  color: #a7f3d0;
}
.slip-trust-bar.negative {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.4);
  color: #fde68a;
}

/* ---------- First-Run Onboarding Walkthrough ---------- */
.onboarding-card {
  padding: 16px 18px;
  border-radius: 16px;
  background: linear-gradient(145deg, rgba(56, 189, 248, 0.12), rgba(15, 23, 42, 0.95));
  border: 1.5px solid rgba(56, 189, 248, 0.35);
  margin-bottom: 20px;
}
.onboarding-card h3 {
  font-size: 16px;
  color: #fff;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.onboarding-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.onboarding-step-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 12.5px;
  color: var(--soft);
}
.onboarding-step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #38bdf8;
  color: #03140d;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}
.onboarding-step-item b {
  display: block;
  color: #fff;
  font-size: 13px;
  margin-bottom: 2px;
}

/* ---------- Match List Collapsible & Legend ---------- */
.match-list-collapsible summary {
  cursor: pointer;
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: 15px;
  color: #fff;
  border-radius: 12px;
  list-style: none;
}
.match-list-collapsible summary::-webkit-details-marker {
  display: none;
}
.match-list-legend {
  margin: 12px 16px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
  font-size: 12px;
  color: var(--soft);
  line-height: 1.45;
}

/* ---------- Maths & Statistical Details Toggle ---------- */
.maths-section summary {
  cursor: pointer;
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: 15px;
  color: #fff;
  list-style: none;
}
.maths-section summary::-webkit-details-marker {
  display: none;
}

/* ---------- Mobile Tap Targets & Typography Refinements ---------- */
@media (max-width: 680px) {
  button,
  .btn,
  .link-btn,
  .opt,
  .seg button,
  .sport-pill,
  .bookie-pill,
  .win-chip,
  .legpick {
    min-height: 44px !important;
  }
  .slip-match small,
  .slip-price small,
  .slip-pick small,
  .slip-sum span,
  .today-slip-pill,
  .sub-header-bar,
  .section-note,
  .field-hint {
    font-size: 12px !important;
  }
  .app-header-inner {
    padding: 0 12px !important;
  }
  .header-tools {
    display: none !important;
  }
  .sub-header-bar {
    padding: 6px 12px !important;
  }
  .sub-header-inner {
    padding: 0 !important;
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    width: 100% !important;
  }
  .sub-header-tagline {
    display: none !important;
  }
  .nav {
    position: fixed !important;
    bottom: 0 !important;
    left: 0 !important;
    width: 100% !important;
    display: flex !important;
    justify-content: space-around !important;
    background: rgba(9, 16, 30, 0.98) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border-top: 1px solid var(--line) !important;
    padding: 6px 2px 8px !important;
    box-sizing: border-box !important;
    z-index: 1000 !important;
    overflow-x: hidden !important;
  }
  .nav a {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    font-size: 10.5px !important;
    padding: 4px 0 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 3px !important;
    text-decoration: none !important;
    color: var(--muted) !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }
  .nav a svg {
    width: 20px !important;
    height: 20px !important;
  }
}
"""

if "/* ---------- Jargon & Glossary Tooltip Buttons ---------- */" not in css:
    css += "\n" + extra_css
else:
    css = re.sub(
        r"/\* ---------- Jargon & Glossary Tooltip Buttons ---------- \*/.*?(?=\Z)",
        extra_css.strip(),
        css,
        flags=re.DOTALL
    )

styles_p.write_text(css, encoding="utf-8")
print("styles.css updated with contrast, jargon tips, tap targets, and layout fixes")
