with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add "Admin" to nav
old_nav = '''      <a href="#/leagues" data-nav="leagues"><svg viewBox="0 0 24 24"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2M4 22h16M10 14.66V17c0 .55-.45 1-1 1H7M14 14.66V17c0 .55.45 1 1 1h2M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>Leagues</a>
      <a href="#/more" data-nav="more"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>More</a>'''

new_nav = '''      <a href="#/leagues" data-nav="leagues"><svg viewBox="0 0 24 24"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2M4 22h16M10 14.66V17c0 .55-.45 1-1 1H7M14 14.66V17c0 .55.45 1 1 1h2M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>Leagues</a>
      <a href="#/admin" data-nav="admin"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>Admin</a>
      <a href="#/more" data-nav="more"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>More</a>'''

assert old_nav in html, 'old_nav not found'
html = html.replace(old_nav, new_nav)

# 2. Add Bookmaker Selector Modal before </body>
bookie_modal = '''
<!-- Bookmaker Placement Selector Modal -->
<div class="modal-backdrop" id="bookie-modal" hidden>
  <div class="modal bookie-modal-card" role="dialog" aria-modal="true" aria-labelledby="bookie-modal-title">
    <div class="modal-head">
      <div>
        <h2 id="bookie-modal-title" style="margin:0;font-size:1.15rem">Place Bet with Bookmaker</h2>
        <span class="text-sm muted">Choose your preferred licensed UK bookmaker</span>
      </div>
      <button type="button" class="icon-btn" data-close-bookie aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <div id="bookie-bet-summary" class="bookie-summary-box">
        <strong id="bookie-bet-label">Arsenal Win</strong>
        <span id="bookie-bet-odds" class="mono text-sm" style="color:var(--pick)">6/4</span>
      </div>
      <p class="section-note" style="margin:10px 0 14px">Selection and odds copied to your clipboard automatically. Tap any bookmaker to open app or site:</p>
      <div class="bookie-list-grid">
        <a href="https://www.bet365.com/#/HO/" target="_blank" rel="noopener noreferrer" class="bookie-choice-btn" data-bookie-click="Bet365">
          <span class="bookie-tag b365">bet365</span>
          <div><strong>bet365</strong><span class="text-sm muted">Best live in-play odds & Bet Builder</span></div>
          <span class="bookie-go-arrow">›</span>
        </a>
        <a href="https://www.skybet.com/football" target="_blank" rel="noopener noreferrer" class="bookie-choice-btn" data-bookie-click="Sky Bet">
          <span class="bookie-tag skybet">SKY</span>
          <div><strong>Sky Bet</strong><span class="text-sm muted">RequestABet & UK accumulator specials</span></div>
          <span class="bookie-go-arrow">›</span>
        </a>
        <a href="https://www.paddypower.com/football" target="_blank" rel="noopener noreferrer" class="bookie-choice-btn" data-bookie-click="Paddy Power">
          <span class="bookie-tag pp">PP</span>
          <div><strong>Paddy Power</strong><span class="text-sm muted">Super Sub & acca insurance rewards</span></div>
          <span class="bookie-go-arrow">›</span>
        </a>
        <a href="https://www.betfair.com/sport/football" target="_blank" rel="noopener noreferrer" class="bookie-choice-btn" data-bookie-click="Betfair">
          <span class="bookie-tag bf">BF</span>
          <div><strong>Betfair Sportsbook</strong><span class="text-sm muted">Exchange & top football price ladder</span></div>
          <span class="bookie-go-arrow">›</span>
        </a>
        <a href="https://sports.williamhill.com/betting/en-gb/football" target="_blank" rel="noopener noreferrer" class="bookie-choice-btn" data-bookie-click="William Hill">
          <span class="bookie-tag wh">WH</span>
          <div><strong>William Hill</strong><span class="text-sm muted">Epic Odds & traditional UK betting shop</span></div>
          <span class="bookie-go-arrow">›</span>
        </a>
      </div>
      <p class="section-note" style="margin-top:14px;font-size:11.5px;color:var(--dim)">18+ GambleAware.org. Bet Buddy routes via verified bookmaker gateways. We may earn commission at zero extra cost to you.</p>
    </div>
  </div>
</div>
'''

if 'id="bookie-modal"' not in html:
    html = html.replace('</body>', bookie_modal + '\n</body>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Updated index.html: added Admin nav and Bookmaker modal')
