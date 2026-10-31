"""Update the Bet Butler dropdown modal in index.html and styles.css for clean layout, graphics, and text."""

def patch_index_html():
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()

    start_str = '<div class="modal-backdrop" id="butler-modal" hidden>'
    end_str = '<div class="responsible-gambling-note" style="margin-top:14px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:#94a3b8;text-align:center;">'

    start_idx = content.find(start_str)
    end_idx = content.find(end_str)
    assert start_idx != -1 and end_idx != -1, "Target section not found in index.html"

    new_butler_modal = """<div class="modal-backdrop" id="butler-modal" hidden>
  <div class="modal butler-dialog" role="dialog" aria-modal="true" aria-labelledby="butler-modal-title">
    <div class="modal-head">
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="butler-avatar-badge">🤵</div>
        <div>
          <div class="slip-card-badge" style="color:#38bdf8;font-size:11px;font-weight:700;letter-spacing:0.06em;">BET BUTLER &middot; SLIP NOTE SETTINGS</div>
          <h2 id="butler-modal-title" style="margin:2px 0 0;font-size:1.25rem;font-weight:800;color:#fff;">
            Choose Your Bookmaker
          </h2>
        </div>
      </div>
      <button type="button" class="icon-btn" onclick="closeButlerModal()" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body" style="padding-top:12px;">
      <div class="butler-intro-box">
        <p style="margin:0;font-size:13.5px;color:#cbd5e1;line-height:1.45;">
          <strong style="color:#fff;">No account transfer or betting credentials needed.</strong> Select your bookmaker below. Bet Buddy keeps your calculated accumulator slip in front of you on a <b>Slip Card</b> so you can glance, copy, and tick off each selection in your bookmaker app.
        </p>
      </div>

      <div class="butler-bookie-grid" role="radiogroup" aria-label="Select your preferred bookmaker">
        <!-- Sky Bet -->
        <button type="button" class="butler-choice-card" data-select-butler="skybet" onclick="setButlerBookmaker('skybet')">
          <div class="butler-choice-left">
            <span class="bookie-tag skybet">SKY</span>
            <div class="butler-choice-details">
              <strong>Sky Bet</strong>
              <span class="butler-choice-sub">UK Football &amp; Acca Markets</span>
            </div>
          </div>
          <span class="butler-active-check" id="check-skybet">✓ Active</span>
        </button>

        <!-- bet365 -->
        <button type="button" class="butler-choice-card" data-select-butler="bet365" onclick="setButlerBookmaker('bet365')">
          <div class="butler-choice-left">
            <span class="bookie-tag b365">365</span>
            <div class="butler-choice-details">
              <strong>bet365</strong>
              <span class="butler-choice-sub">Football &amp; Global Sports</span>
            </div>
          </div>
          <span class="butler-active-check" id="check-bet365">✓ Active</span>
        </button>

        <!-- William Hill -->
        <button type="button" class="butler-choice-card" data-select-butler="williamhill" onclick="setButlerBookmaker('williamhill')">
          <div class="butler-choice-left">
            <span class="bookie-tag wh">WH</span>
            <div class="butler-choice-details">
              <strong>William Hill</strong>
              <span class="butler-choice-sub">UK Betting &amp; Daily Coup</span>
            </div>
          </div>
          <span class="butler-active-check" id="check-williamhill">✓ Active</span>
        </button>

        <!-- Paddy Power -->
        <button type="button" class="butler-choice-card" data-select-butler="paddypower" onclick="setButlerBookmaker('paddypower')">
          <div class="butler-choice-left">
            <span class="bookie-tag pp">PP</span>
            <div class="butler-choice-details">
              <strong>Paddy Power</strong>
              <span class="butler-choice-sub">Football &amp; Multi-Sport</span>
            </div>
          </div>
          <span class="butler-active-check" id="check-paddypower">✓ Active</span>
        </button>

        <!-- Betfair -->
        <button type="button" class="butler-choice-card" data-select-butler="betfair" onclick="setButlerBookmaker('betfair')">
          <div class="butler-choice-left">
            <span class="bookie-tag bf">BF</span>
            <div class="butler-choice-details">
              <strong>Betfair Sportsbook</strong>
              <span class="butler-choice-sub">Football &amp; Exchange Odds</span>
            </div>
          </div>
          <span class="butler-active-check" id="check-betfair">✓ Active</span>
        </button>

        <!-- Coral -->
        <button type="button" class="butler-choice-card" data-select-butler="coral" onclick="setButlerBookmaker('coral')">
          <div class="butler-choice-left">
            <span class="bookie-tag coral">COR</span>
            <div class="butler-choice-details">
              <strong>Coral</strong>
              <span class="butler-choice-sub">Football Coupon &amp; Accas</span>
            </div>
          </div>
          <span class="butler-active-check" id="check-coral">✓ Active</span>
        </button>

        <!-- Ladbrokes -->
        <button type="button" class="butler-choice-card" data-select-butler="ladbrokes" onclick="setButlerBookmaker('ladbrokes')">
          <div class="butler-choice-left">
            <span class="bookie-tag ladbrokes">LAD</span>
            <div class="butler-choice-details">
              <strong>Ladbrokes</strong>
              <span class="butler-choice-sub">Football &amp; Weekend Coupons</span>
            </div>
          </div>
          <span class="butler-active-check" id="check-ladbrokes">✓ Active</span>
        </button>
      </div>

      <div class="butler-perks-box" style="margin-top:16px;">
        <div class="butler-perk-item"><span>📋</span> <div><strong>Slip Card Checklist:</strong> View your model acca and tick off each leg as you add it.</div></div>
        <div class="butler-perk-item"><span>📑</span> <div><strong>1-Click Copy:</strong> Copy formatted selections directly to clipboard for quick entry.</div></div>
        <div class="butler-perk-item"><span>📱</span> <div><strong>Direct App Link:</strong> Convenient one-tap shortcut to open your bookmaker's football hub.</div></div>
      </div>

      """

    content = content[:start_idx] + new_butler_modal + content[end_idx:]

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('index.html patched')

def patch_styles_css():
    with open('styles.css', 'r', encoding='utf-8') as f:
        content = f.read()

    css_patch = """
/* Enhanced Butler Modal Dialog & Bookmaker Choice Cards */
.butler-dialog {
  max-width: 540px;
  width: 95vw;
  background: #081220;
  border: 1px solid rgba(56, 189, 248, 0.35);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.12);
  border-radius: 18px;
}
.butler-avatar-badge {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}
.butler-bookie-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 10px;
  margin: 14px 0 16px;
  max-height: 46vh;
  overflow-y: auto;
  padding-right: 4px;
}
.butler-choice-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #fff;
  text-align: left;
  cursor: pointer;
  transition: all 0.18s ease;
  min-height: 52px;
}
.butler-choice-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: #38bdf8;
  transform: translateY(-1px);
}
.butler-choice-card.active {
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.22), rgba(16, 185, 129, 0.14));
  border-color: #38bdf8;
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.25);
}
.butler-choice-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.butler-choice-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.butler-choice-details strong {
  font-size: 14px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.butler-choice-sub {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.butler-active-check {
  font-size: 12px;
  font-weight: 800;
  color: #34d399;
  background: rgba(16, 185, 129, 0.16);
  padding: 3px 8px;
  border-radius: 6px;
  display: none;
  flex-shrink: 0;
}
.butler-choice-card.active .butler-active-check {
  display: inline-block;
}
.butler-perk-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 12.5px;
  line-height: 1.4;
  color: #94a3b8;
}
.butler-perk-item strong {
  color: #f1f5f9;
}
@media (max-width: 520px) {
  .butler-bookie-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
"""

    content += '\n' + css_patch
    with open('styles.css', 'w', encoding='utf-8') as f:
        f.write(content)
    print('styles.css patched')

if __name__ == '__main__':
    patch_index_html()
    patch_styles_css()

