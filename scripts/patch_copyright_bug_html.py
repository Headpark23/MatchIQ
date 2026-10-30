with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Update footer with Copyright Martin White & Chris Faulds 2026 and Report Bug button
old_footer = '''<footer class="site-foot">
  <div>Statistical estimates for information and entertainment. No prediction is guaranteed, and a high probability is not the same as good betting value. Fixtures and results: football-data.org, OpenLigaDB contributors (ODbL 1.0) and openfootball (CC0). Bookmaker prices: The Odds API.</div>
  <div class="compliance-bar">
    <span class="compliance-seal" title="18+ Strictly Adults Only">18+</span>
    <span>Please Gamble Responsibly. <a href="https://www.begambleaware.org" target="_blank" rel="noopener" class="compliance-link">BeGambleAware.org</a> · <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener" class="compliance-link">GamCare</a></span>
    <span>Take Time To Think</span>
    <span style="margin-left:auto"><a href="#/more" class="compliance-link">Commercial & Sponsorship Inquiries</a></span>
  </div>
</footer>'''

new_footer = '''<footer class="site-foot">
  <div>Statistical estimates for information and entertainment. No prediction is guaranteed, and a high probability is not the same as good betting value. Fixtures and results: football-data.org, OpenLigaDB contributors (ODbL 1.0) and openfootball (CC0). Bookmaker prices: The Odds API.</div>
  <div class="copyright-bar">
    <span>© Copyright Martin White and Chris Faulds 2026. All rights reserved.</span>
    <button type="button" class="btn small report-bug-btn" id="btn-report-bug" title="Report an issue or bug">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6Z"/><path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M18 13h4M21 21c0-2.1-1.7-3.9-3.8-4"/></svg>
      <span>Report a Bug</span>
    </button>
  </div>
  <div class="compliance-bar">
    <span class="compliance-seal" title="18+ Strictly Adults Only">18+</span>
    <span>Please Gamble Responsibly. <a href="https://www.begambleaware.org" target="_blank" rel="noopener" class="compliance-link">BeGambleAware.org</a> · <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener" class="compliance-link">GamCare</a></span>
    <span>Take Time To Think</span>
    <span style="margin-left:auto"><a href="#/more" class="compliance-link">Commercial & Sponsorship Inquiries</a></span>
  </div>
</footer>'''

assert old_footer in html, 'old_footer not found'
html = html.replace(old_footer, new_footer)

# 2. Add Bug Report Modal before </body>
bug_modal = '''
<!-- Report Bug Modal -->
<div class="modal-backdrop" id="bug-modal" hidden>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="bug-modal-title">
    <form id="bug-form">
      <div class="modal-head">
        <h2 id="bug-modal-title">Report a Bug / Suggestion</h2>
        <button type="button" class="icon-btn" data-close-bug aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <p class="section-note" style="margin-bottom:12px">Found an odd glitch, display error, or calculation issue? Let Martin and Chris know so we can fix it immediately.</p>
        <div class="field">
          <label for="bug-type-select">Issue Type</label>
          <select id="bug-type-select" class="ctl">
            <option value="ui">Display / Mobile layout bug</option>
            <option value="odds">Odds or calculation issue</option>
            <option value="league">Buddy League leaderboard bug</option>
            <option value="diary">Bet Diary storage issue</option>
            <option value="feature">Feature idea / feedback</option>
          </select>
        </div>
        <div class="field">
          <label for="bug-desc-input">Describe what happened</label>
          <textarea id="bug-desc-input" class="ctl" rows="3" placeholder="e.g. On iPhone, the odds toggle overlapped or diary entry didn't save..." required></textarea>
        </div>
        <div class="field">
          <label for="bug-contact-input">Your Email or Telegram (optional)</label>
          <input id="bug-contact-input" class="ctl" placeholder="name@email.com (if you'd like a response)">
        </div>
        <button type="submit" class="btn primary full-width" style="margin-top:14px">Submit Bug Report</button>
      </div>
    </form>
  </div>
</div>
'''

if 'id="bug-modal"' not in html:
    html = html.replace('</body>', bug_modal + '\n</body>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Updated index.html: Copyright, Report Bug button and Modal')
