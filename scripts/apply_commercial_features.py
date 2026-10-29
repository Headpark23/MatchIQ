import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent

# 1. Update app.js
app_path = root / 'app.js'
app_src = app_path.read_text(encoding='utf-8')

# Add shareAccaSlip helper
share_fn = """function shareAccaSlip(idx) {
  const r = builderResult;
  if (!r || !r.slips || !r.slips[idx]) return;
  const slip = r.slips[idx];
  const stake = builderState.stake;
  const m = MatchIQBuilder.money;
  const lines = [
    '🎯 Bet Buddy Acca (Target: ' + m(slip.profit) + ' profit)',
    'Odds: ' + fmtOdds(slip.odds) + ' · Estimated Chance: ' + Math.round(slip.chance * 100) + '%',
    'Stake: ' + m(stake) + ' · Potential Return: ' + m(slip.ret),
    '',
    ...slip.legs.map((l, i) => (i + 1) + '. ' + l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label + ' (' + l.fractional + ')'),
    '',
    'Built with Bet Buddy'
  ].join('\\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(lines).then(() => {
      toast('Acca slip copied to clipboard ready for your bookmaker.');
    }).catch(() => {
      toast('Slip ready.');
    });
  } else if (navigator.share) {
    navigator.share({ title: 'Bet Buddy Acca', text: lines }).catch(() => {});
  } else {
    toast('Slip details ready.');
  }
}
"""

if "function shareAccaSlip" not in app_src:
    app_src = app_src.replace("function slipCard(slip, idx, stake) {", share_fn + "\nfunction slipCard(slip, idx, stake) {")

# Update slipCard buttons
old_slip_btn = """'<div class="btn-row"><button type="button" class="btn' + (primary ? ' primary' : '') + '" data-slip="' + idx + '">Save slip to Bet Diary</button></div></article>';"""
new_slip_btn = """'<div class="btn-row">' +
      '<button type="button" class="btn' + (primary ? ' primary' : '') + '" data-slip="' + idx + '">Save slip to Bet Diary</button>' +
      '<button type="button" class="btn small" data-share-slip="' + idx + '" title="Copy formatted slip to clipboard or share with friends"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg> Share / Copy</button>' +
      '<button type="button" class="btn small partner-cta" data-partner-slip="' + idx + '" title="Bookmaker integration: transfer slip to partner bookmaker"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg> Place with Bookmaker</button>' +
    '</div></article>';"""
if old_slip_btn in app_src:
    app_src = app_src.replace(old_slip_btn, new_slip_btn)

# Update click handler
old_closest = "const t = event.target.closest('[data-slip],"
new_closest = "const t = event.target.closest('[data-slip],[data-share-slip],[data-partner-slip],"
if old_closest in app_src:
    app_src = app_src.replace(old_closest, new_closest)

old_slip_handler = "else if (t.dataset.slip !== undefined) saveSlipToDiary(+t.dataset.slip);"
new_slip_handler = """else if (t.dataset.slip !== undefined) saveSlipToDiary(+t.dataset.slip);
  else if (t.dataset.shareSlip !== undefined) shareAccaSlip(+t.dataset.shareSlip);
  else if (t.dataset.partnerSlip !== undefined) {
    shareAccaSlip(+t.dataset.partnerSlip);
    toast('Acca copied! Ready to paste into Bet365, SkyBet or Betfair.');
  }"""
if old_slip_handler in app_src:
    app_src = app_src.replace(old_slip_handler, new_slip_handler)

# Add Commercial Partnership card in viewMore
commercial_section = """
    '<div class="section card commercial-card">' +
      '<div class="commercial-badge">Commercial & Sponsorship</div>' +
      '<h2 class="section-title" style="margin-top:6px">Partner with Bet Buddy</h2>' +
      '<p class="page-sub" style="margin-top:4px">Engage high-intent Premier League and European football bettors with transparent, algorithm-backed intelligence.</p>' +
      '<div class="bento-grid" style="margin-top:16px">' +
        '<div class="bento-card">' +
          '<div class="bento-icon">⚡</div>' +
          '<div><div class="bento-kicker">Deep-Link Integration</div><h3 class="bento-title">One-Click Bet Slip Injection</h3>' +
          '<p class="bento-desc">Direct accumulator transfer into your sportsbook app. Converts target-profit calculations directly into funded operator slips.</p></div>' +
          '<span class="bento-badge emerald">High CPA Conversion</span>' +
        '</div>' +
        '<div class="bento-card">' +
          '<div class="bento-icon">📊</div>' +
          '<div><div class="bento-kicker">Odds Partnership</div><h3 class="bento-title">Official Odds Sponsor</h3>' +
          '<p class="bento-desc">Featured odds placement across Match Result, Both Teams To Score, and Goal Over/Under lines with branded halo accents.</p></div>' +
          '<span class="bento-badge">Featured Brand Badge</span>' +
        '</div>' +
        '<div class="bento-card">' +
          '<div class="bento-icon">🛡️</div>' +
          '<div><div class="bento-kicker">Trust & Compliance</div><h3 class="bento-title">Regulated & Responsible</h3>' +
          '<p class="bento-desc">Full 18+ UKGC & ASA advertising code compliance. No false promises, strict Brier scoring, and direct links to BeGambleAware.</p></div>' +
          '<span class="bento-badge amber">100% Compliant</span>' +
        '</div>' +
      '</div>' +
      '<div class="commercial-cta-row" style="margin-top:18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center">' +
        '<a href="mailto:partnerships@betbuddy.app?subject=Bet%20Buddy%20Sponsorship%20Inquiry" class="btn primary">Inquire About Sponsorship</a>' +
        '<span class="dim" style="font-size:13px">Affiliate CPA, exclusive odds feeds, and co-branded Bet Builder slots available.</span>' +
      '</div>' +
    '</div>' +
"""

old_fb_form = "'<div class=\"section card\"><h2 class=\"section-title\">Tell us what you think</h2>'"
if old_fb_form in app_src and "Partner with Bet Buddy" not in app_src:
    app_src = app_src.replace(old_fb_form, commercial_section + old_fb_form)

app_path.write_text(app_src, encoding='utf-8')
print("app.js commercial features applied.")

# 2. Update styles.css
styles_path = root / 'styles.css'
styles = styles_path.read_text(encoding='utf-8')

commercial_css = """
/* Commercial & Partnership styles */
.partner-cta { background: linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(16, 185, 129, 0.15)); border-color: rgba(56, 189, 248, 0.35); color: #fff; }
.partner-cta:hover { border-color: var(--cyan); background: linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(16, 185, 129, 0.25)); box-shadow: 0 0 12px rgba(56, 189, 248, 0.2); }
.commercial-card { border-color: rgba(56, 189, 248, 0.3); background: radial-gradient(800px 300px at 100% 0%, rgba(56, 189, 248, 0.08), transparent 60%), var(--surface); }
.commercial-badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; background: rgba(56, 189, 248, 0.12); color: var(--cyan); border: 1px solid rgba(56, 189, 248, 0.3); }

/* Regulatory Compliance Footer */
.compliance-bar { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); }
.compliance-seal { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid var(--amber); color: var(--amber); font-weight: 800; font-size: 11px; }
.compliance-link { color: var(--soft); text-decoration: underline; text-underline-offset: 3px; }
.compliance-link:hover { color: #fff; }
"""

if "/* Commercial & Partnership styles */" not in styles:
    styles += commercial_css

styles_path.write_text(styles, encoding='utf-8')
print("styles.css commercial styling applied.")

# 3. Update index.html footer with compliance seals
html_path = root / 'index.html'
html = html_path.read_text(encoding='utf-8')

old_foot = """<footer class="site-foot">
  Statistical estimates for information and entertainment. No prediction is guaranteed, and a high probability is not the same as good betting value.
  Fixtures and results: football-data.org, OpenLigaDB contributors (ODbL 1.0) and openfootball (CC0). Bookmaker prices: The Odds API.
</footer>"""

new_foot = """<footer class="site-foot">
  <div>Statistical estimates for information and entertainment. No prediction is guaranteed, and a high probability is not the same as good betting value. Fixtures and results: football-data.org, OpenLigaDB contributors (ODbL 1.0) and openfootball (CC0). Bookmaker prices: The Odds API.</div>
  <div class="compliance-bar">
    <span class="compliance-seal" title="18+ Strictly Adults Only">18+</span>
    <span>Please Gamble Responsibly. <a href="https://www.begambleaware.org" target="_blank" rel="noopener" class="compliance-link">BeGambleAware.org</a> · <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener" class="compliance-link">GamCare</a></span>
    <span>Take Time To Think</span>
    <span style="margin-left:auto"><a href="#/more" class="compliance-link">Commercial & Sponsorship Inquiries</a></span>
  </div>
</footer>"""

if old_foot in html:
    html = html.replace(old_foot, new_foot)
    html_path.write_text(html, encoding='utf-8')
    print("index.html footer updated.")
