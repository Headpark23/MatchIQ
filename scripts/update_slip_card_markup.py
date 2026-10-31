import re
from pathlib import Path

app_path = Path("app.js")
app_code = app_path.read_text(encoding="utf-8")

# Streamline slipCard bookmaker button and btn-row
old_slip_card_buttons = """    '<div style="margin: 12px 0 8px;">' +
      '<a href="' + esc(getButlerLaunchUrl(idx)) + '" class="btn" onclick="prepareButlerLaunch(' + idx + ')" style="width:100%;padding:12px;font-size:14px;font-weight:700;background:linear-gradient(135deg, #0284c7, #0369a1);color:#fff;border:none;border-radius:10px;box-shadow:0 3px 12px rgba(2,132,199,0.3);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">' +
        '<span>⚡</span> 1-Tap Place with <span class="current-butler-name">' + esc(getButlerBookmaker().name) + '</span> ↗' +
      '</a>' +
    '</div>' +
    '<div class="slip-bookie-bar">' +
      '<div class="slip-bookie-header">' +
        '<span class="slip-bookie-bolt">⚡</span>' +
        '<span class="slip-bookie-title">1-Click Load into Bookmaker:</span>' +
        '<span class="slip-bookie-hint">Auto-copies slip & opens match search</span>' +
      '</div>' +
      '<div class="slip-bookie-buttons verified-only" role="group" aria-label="1-Click bookmaker launcher">' +
        '<button type="button" class="bookie-pill sky sky-prominent" data-launch-bookie="skybet" data-slip-idx="' + idx + '"><span class="pill-dot" style="background:#38bdf8;"></span> ⚡ Open in Sky Bet App (+5 League Bonus) ↗</button>' +
      '</div>' +
    '</div>' +
    '<div class="btn-row">' +
      '<button type="button" class="btn' + (primary ? ' primary' : '') + '" data-slip="' + idx + '">Save slip to Bet Diary</button>' +
      '<button type="button" class="btn small" data-share-slip="' + idx + '" title="Copy formatted slip to clipboard or share with friends"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg> Share / Copy</button>' +
      '<button type="button" class="btn small partner-cta" data-partner-slip="' + idx + '" title="Bookmaker integration: transfer slip to partner bookmaker"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg> Place with Bookmaker</button>' +
    '</div></article>';"""

new_slip_card_buttons = """    '<div class="slip-bookie-bar" style="margin: 12px 0 10px;">' +
      '<a href="' + esc(getButlerLaunchUrl(idx)) + '" class="bookie-pill sky sky-prominent" onclick="prepareButlerLaunch(' + idx + ')" style="text-decoration:none;">' +
        '<span class="pill-dot" style="background:#38bdf8;"></span> ⚡ Open in Sky Bet App (+5 League Bonus) ↗' +
      '</a>' +
      '<div style="font-size:11.5px;color:var(--muted);text-align:center;margin-top:5px;">Auto-copies slip &amp; opens Sky Bet logged in</div>' +
    '</div>' +
    '<div class="btn-row">' +
      '<button type="button" class="btn' + (primary ? ' primary' : '') + '" data-slip="' + idx + '">Save slip to Bet Diary</button>' +
      '<button type="button" class="btn small" data-share-slip="' + idx + '" title="Copy formatted slip to clipboard or share with friends"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg> Share / Copy</button>' +
    '</div></article>';"""

if old_slip_card_buttons in app_code:
    app_code = app_code.replace(old_slip_card_buttons, new_slip_card_buttons)
    print("Replaced slipCard buttons successfully")
else:
    print("WARNING: old_slip_card_buttons target not found verbatim, checking regex...")
    # fallback regex
    app_code = re.sub(
        r"'<div style=\"margin: 12px 0 8px;\">'.*?'</div></article>';",
        new_slip_card_buttons,
        app_code,
        flags=re.DOTALL
    )

# Fix customAccaCard inner leg markup
old_custom_leg = """        return '<li class="slip-leg" style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span style="font-size:16px;">' + icon + '</span>' +
            '<div><b>' + esc(l.label) + '</b><small style="display:block;color:#94a3b8">' + esc(l.bookmaker || 'UK Odds') + '</small></div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span class="slip-price live">' + esc(l.fractional || fmtOdds(l.odds)) + '</span>' +
            '<button type="button" class="btn small" data-remove-cross-leg="' + esc(l.id) + '" title="Remove from Acca" style="padding:2px 8px;font-size:11px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;">✕</button>' +
          '</div>' +
        '</li>';"""

new_custom_leg = """        return '<li class="slip-leg" style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);min-width:0;width:100%;box-sizing:border-box;">' +
          '<div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto;overflow:hidden;">' +
            '<span style="font-size:16px;flex-shrink:0;">' + icon + '</span>' +
            '<div style="min-width:0;overflow:hidden;"><b style="word-break:break-word;display:block;font-size:13px;">' + esc(l.label) + '</b><small style="display:block;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;">' + esc(l.bookmaker || 'UK Odds') + '</small></div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:8px;">' +
            '<span class="slip-price live" style="padding:3px 8px;font-size:12.5px;">' + esc(l.fractional || fmtOdds(l.odds)) + '</span>' +
            '<button type="button" class="btn small" data-remove-cross-leg="' + esc(l.id) + '" title="Remove from Acca" style="padding:2px 8px;font-size:11px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;">✕</button>' +
          '</div>' +
        '</li>';"""

if old_custom_leg in app_code:
    app_code = app_code.replace(old_custom_leg, new_custom_leg)
    print("Replaced custom acca leg markup successfully")

app_path.write_text(app_code, encoding="utf-8")
print("app.js updated")
