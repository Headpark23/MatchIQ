import re
from pathlib import Path

app_path = Path("app.js")
code = app_path.read_text(encoding="utf-8")

# 1. Add JARGON_DEFS and jargonTip
jargon_code = """
// --- Non-Bettor Jargon Explanations ---
const JARGON_DEFS = {
  'acca': 'Acca (Accumulator): Combines multiple match picks into 1 bet. All must win for the slip to pay out.',
  'value': 'Value: The bookmaker is paying better odds than our statistical model thinks the true probability warrants (+5% EV).',
  'lean': 'Lean: Which outcome our model rates as having the highest probability to win (1X2 match winner).',
  'most likely': 'Most likely: Our highest-confidence selection across all 6 analysed betting markets.',
  'provisional': 'Provisional: Preliminary model estimate based on limited historical match data.',
  'fair odds': 'Fair odds: The true mathematical price with zero bookmaker profit margin built in.',
  'brier': 'Brier score: Measures forecast accuracy from 0 to 1. Lower is better (0 is a perfect score).',
  'roi': 'ROI (Return on Investment): Percentage profit or loss earned per £1 staked.',
  'awaiting odds': 'Awaiting Odds: Bookmakers have not yet published official pricing for this fixture.'
};

function jargonTip(term) {
  const key = String(term || '').toLowerCase().trim();
  const def = JARGON_DEFS[key];
  if (!def) return '';
  const escaped = esc(def).replace(/'/g, "\\\\'");
  return '<button type="button" class="jargon-tip-btn" aria-label="' + esc(def) + '" title="' + esc(def) + '" onclick="alert(\\'' + escaped + '\\')">?</button>';
}
"""

if "function jargonTip" not in code:
    pattern = r"(const pct = p => Math\.round\(100 \* p\) \+ '%';)"
    if re.search(pattern, code):
        code = re.sub(pattern, r"\1" + jargon_code, code, count=1)
        print("Injected jargonTip helper")
    else:
        print("Could not find const pct anchor")

# 2. Add missing variables in viewResults: tiers, tierLabel, teams, ch
# Target the line before `html += '<details class="section card maths-section"'`
target_maths = "html += '<details class=\"section card maths-section\""
missing_vars = """  const tiers = perf.tiers || {};
  const tierLabel = { T1: 'Validated frozen model', T2: 'Provisional: promoted clubs', T3: 'League average fallback', L1: 'League model (provisional, one-season backtest)' };
  const teams = Object.entries(perf.teams || {}).filter(([, t]) => t.n >= 5).sort((a, b) => b[1].n - a[1].n);
  const ch = perf.challenger;
  """

if "const tiers = perf.tiers" not in code and target_maths in code:
    code = code.replace(target_maths, missing_vars + target_maths)
    print("Injected missing variables into viewResults")

app_path.write_text(code, encoding="utf-8")
print("app.js updated successfully")

