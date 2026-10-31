from pathlib import Path
import re

index_p = Path("index.html")
html = index_p.read_text(encoding="utf-8")

# 1. Update header button title
html = html.replace(
    'title="Your Bet Butler: Tailors bets and 1-tap launching to your betting account"',
    'title="Your Bet Butler: Choose your bookmaker slip note"'
)

# 2. Add #slip-card-modal right before #butler-modal
slip_card_modal_html = """<!-- Slip Card Modal / Bottom Sheet -->
<div class="modal-backdrop" id="slip-card-modal" hidden>
  <div class="modal slip-card-dialog" role="dialog" aria-modal="true" aria-labelledby="slip-card-title">
    <div class="modal-head">
      <div>
        <div class="slip-card-badge">SLIP NOTE &middot; BET BUTLER</div>
        <h2 id="slip-card-title" class="slip-card-heading">Acca Slip Note</h2>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button type="button" class="btn small" id="btn-slip-pip" title="Pop out into floating window" style="display:none;min-height:36px;padding:4px 10px;font-size:12px;">Pop out ❐</button>
        <button type="button" class="icon-btn" onclick="closeSlipCardModal()" aria-label="Close">&times;</button>
      </div>
    </div>
    <div class="modal-body slip-card-body">
      <div class="slip-card-hint-bar">
        <span>💡 <b>Tip:</b> Keep this slip note open while you add the bets in your bookmaker app. Tick off each leg as you add it.</span>
      </div>

      <div id="slip-card-legs-list" class="slip-card-legs">
        <!-- Rendered dynamically with checkboxes -->
      </div>

      <div class="slip-card-summary" id="slip-card-summary">
        <!-- Summary: Stake, Estimated Odds, Estimated Return -->
      </div>

      <div class="slip-card-actions">
        <button type="button" class="btn primary full-width" id="btn-open-bookie-tab" onclick="openBookmakerFootball()" style="width:100%;min-height:48px;font-size:15px;font-weight:700;">
          Open <span id="slip-card-bookie-name">Sky Bet</span> Football ↗
        </button>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button type="button" class="btn" id="btn-slip-copy-all" onclick="copySlipCardText()" style="flex:1;min-height:44px;">
            📋 Copy All
          </button>
          <button type="button" class="btn" onclick="closeSlipCardModal(); openButlerModal();" style="min-height:44px;">
            Change Bookmaker
          </button>
        </div>
      </div>

      <p class="slip-card-disclaimer">
        Bet Buddy does not place bets. Prices may differ at your bookmaker. 18+ only. Play responsibly (<a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" style="color:var(--cyan);">BeGambleAware.org</a>).
      </p>
    </div>
  </div>
</div>
"""

if 'id="slip-card-modal"' not in html:
    html = html.replace('<div class="modal-backdrop" id="butler-modal"', slip_card_modal_html + '\n<div class="modal-backdrop" id="butler-modal"')
    print("Added #slip-card-modal")

# 3. Rewrite #butler-modal completely to bring back all 7 bookmakers and honest copy
old_butler_modal_regex = r'<div class="modal-backdrop" id="butler-modal".*?</div>\s*</div>\s*</div>'
new_butler_modal = """<div class="modal-backdrop" id="butler-modal" hidden>
  <div class="modal bookie-modal-card" role="dialog" aria-modal="true" aria-labelledby="butler-modal-title">
    <div class="modal-head">
      <div>
        <h2 id="butler-modal-title" style="margin:0;font-size:1.15rem;display:flex;align-items:center;gap:8px;">
          <span>🤵</span> The Bet Butler (Your Slip Note)
        </h2>
        <span class="text-sm muted">Keep your slip in front of you while you add the bets in your bookmaker's app.</span>
      </div>
      <button type="button" class="icon-btn" onclick="closeButlerModal()" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="butler-intro-box">
        <p style="margin:0;font-size:13.5px;color:#e2e8f0;line-height:1.45;">
          <strong>No new betting account needed.</strong> Choose the bookmaker you already use. When you build an acca, Bet Buddy generates a Slip Card note so you can easily check off each pick in your betting app.
        </p>
      </div>

      <div class="butler-bookie-grid" role="radiogroup" aria-label="Select your preferred bookmaker" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px;margin-top:14px;">
        <button type="button" class="butler-choice-card" data-select-butler="skybet" onclick="setButlerBookmaker('skybet')">
          <div class="butler-choice-top">
            <span class="bookie-tag skybet">SKY BET</span>
            <span class="butler-active-check" id="check-skybet">✓ Active</span>
          </div>
          <strong>Sky Bet</strong>
          <span class="text-sm muted">Opens Sky Bet football hub in new tab.</span>
        </button>

        <button type="button" class="butler-choice-card" data-select-butler="bet365" onclick="setButlerBookmaker('bet365')">
          <div class="butler-choice-top">
            <span class="bookie-tag bet365">BET365</span>
            <span class="butler-active-check" id="check-bet365">✓ Active</span>
          </div>
          <strong>bet365</strong>
          <span class="text-sm muted">Opens bet365 football hub in new tab.</span>
        </button>

        <button type="button" class="butler-choice-card" data-select-butler="williamhill" onclick="setButlerBookmaker('williamhill')">
          <div class="butler-choice-top">
            <span class="bookie-tag williamhill">WILLIAM HILL</span>
            <span class="butler-active-check" id="check-williamhill">✓ Active</span>
          </div>
          <strong>William Hill</strong>
          <span class="text-sm muted">Opens William Hill football hub in new tab.</span>
        </button>

        <button type="button" class="butler-choice-card" data-select-butler="paddypower" onclick="setButlerBookmaker('paddypower')">
          <div class="butler-choice-top">
            <span class="bookie-tag paddypower">PADDY POWER</span>
            <span class="butler-active-check" id="check-paddypower">✓ Active</span>
          </div>
          <strong>Paddy Power</strong>
          <span class="text-sm muted">Opens Paddy Power football hub in new tab.</span>
        </button>

        <button type="button" class="butler-choice-card" data-select-butler="betfair" onclick="setButlerBookmaker('betfair')">
          <div class="butler-choice-top">
            <span class="bookie-tag betfair">BETFAIR</span>
            <span class="butler-active-check" id="check-betfair">✓ Active</span>
          </div>
          <strong>Betfair</strong>
          <span class="text-sm muted">Opens Betfair football hub in new tab.</span>
        </button>

        <button type="button" class="butler-choice-card" data-select-butler="coral" onclick="setButlerBookmaker('coral')">
          <div class="butler-choice-top">
            <span class="bookie-tag coral">CORAL</span>
            <span class="butler-active-check" id="check-coral">✓ Active</span>
          </div>
          <strong>Coral</strong>
          <span class="text-sm muted">Opens Coral football hub in new tab.</span>
        </button>

        <button type="button" class="butler-choice-card" data-select-butler="ladbrokes" onclick="setButlerBookmaker('ladbrokes')">
          <div class="butler-choice-top">
            <span class="bookie-tag ladbrokes">LADBROKES</span>
            <span class="butler-active-check" id="check-ladbrokes">✓ Active</span>
          </div>
          <strong>Ladbrokes</strong>
          <span class="text-sm muted">Opens Ladbrokes football hub in new tab.</span>
        </button>
      </div>

      <div class="butler-perks-box" style="margin-top:14px;">
        <div class="butler-perk-item"><span>📋</span> <strong>Slip Card Checklist:</strong> Keep your calculated acca open and tick off legs as you add them in your betting app.</div>
        <div class="butler-perk-item"><span>📑</span> <strong>Copy All Selections:</strong> Fast 1-click formatted copy if you want to paste the lines into notes or chats.</div>
        <div class="butler-perk-item"><span>💾</span> <strong>Bet Diary Tracking:</strong> Log placed bets directly into your private diary to track verified returns.</div>
      </div>

      <div class="responsible-gambling-note" style="margin-top:14px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:#94a3b8;text-align:center;">
        Bet Buddy does not place bets. Prices may differ at your bookmaker. 18+ only. Bet responsibly (<a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" style="color:#38bdf8;text-decoration:underline;">BeGambleAware.org</a>).
      </div>
    </div>
  </div>
</div>"""

html = re.sub(old_butler_modal_regex, new_butler_modal, html, flags=re.DOTALL)
print("Updated #butler-modal with all 7 bookmakers and honest slip note copy")

# 4. Rewrite #return-bookie-modal without bonus claims
old_return_modal_regex = r'<div class="modal-backdrop" id="return-bookie-modal".*?</div>\s*</div>\s*</div>'
new_return_modal = """<div class="modal-backdrop" id="return-bookie-modal" hidden>
  <div class="modal bookie-modal-card" role="dialog" aria-modal="true" aria-labelledby="return-modal-title">
    <div class="modal-head">
      <div>
        <h2 id="return-modal-title" style="margin:0;font-size:1.15rem">Did you place this bet?</h2>
        <span class="text-sm muted">Save it to your Bet Diary to track your performance (self-reported)</span>
      </div>
      <button type="button" class="icon-btn" onclick="dismissReturnModal()" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <div id="return-bet-summary" class="bookie-summary-box" style="margin-bottom:12px;">
        <strong id="return-bet-label">Accumulator Pick</strong>
        <span id="return-bet-odds" class="mono text-sm" style="color:var(--pick)"></span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div>
          <label for="return-stake-input" class="text-sm" style="display:block;margin-bottom:4px;color:#cbd5e1;font-weight:600;">Stake (£)</label>
          <input type="number" id="return-stake-input" min="0.1" step="0.5" value="10" class="input" style="width:100%;padding:8px 10px;font-size:14px;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#fff;">
        </div>
        <div>
          <label for="return-odds-input" class="text-sm" style="display:block;margin-bottom:4px;color:#cbd5e1;font-weight:600;">Price Taken</label>
          <input type="text" id="return-odds-input" value="Evens" placeholder="e.g. 6/4 or 2.50" class="input" style="width:100%;padding:8px 10px;font-size:14px;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#fff;">
        </div>
      </div>
      <p style="margin:0 0 14px;font-size:13px;color:#cbd5e1;">Did you place this bet on <strong id="return-bookie-confirm-name">your bookmaker</strong>?</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button type="button" class="btn primary" id="confirm-bet-placed-btn" onclick="confirmRealBetPlaced()" style="padding:12px;font-size:14px;font-weight:700;background:linear-gradient(135deg, #10b981, #059669);border:none;border-radius:8px;cursor:pointer;">
          ✓ Yes, Save to Bet Diary
        </button>
        <button type="button" class="btn" onclick="dismissReturnModal()" style="padding:10px;background:rgba(255,255,255,0.06);color:#cbd5e1;border-radius:8px;border:none;cursor:pointer;">
          No, didn't place
        </button>
      </div>
      <div class="responsible-gambling-note" style="margin-top:14px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:#94a3b8;text-align:center;">
        Bet Buddy does not take bets. Always gamble responsibly (<a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" style="color:#38bdf8;text-decoration:underline;">BeGambleAware.org</a>).
      </div>
    </div>
  </div>
</div>"""

html = re.sub(old_return_modal_regex, new_return_modal, html, flags=re.DOTALL)
print("Updated #return-bookie-modal with honest self-reported diary copy")

# Clean up any leftover RequestABet in bookie modal
html = html.replace('RequestABet & UK accumulator specials', 'Football accumulator markets')

index_p.write_text(html, encoding="utf-8")
print("index.html updated successfully")

