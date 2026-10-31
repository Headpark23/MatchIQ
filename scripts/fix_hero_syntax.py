from pathlib import Path

app_path = Path("app.js")
text = app_path.read_text(encoding="utf-8")

old_snippet = """      '</a>' +

      
    <!-- Bet Butler Feature Hero Card -->
    <div class="butler-home-hero-card">
      <div class="butler-home-hero-content">
        <div class="butler-home-badge">
          <span class="badge-dot" style="background:#38bdf8;"></span>
          <span>🤵 Official App Hand-Off: Sky Bet</span>
          <span class="butler-bonus-tag">🏆 +5 League Bonus Points</span>
        </div>
        <h2 class="butler-home-title">1-Tap Bookie Hand-Off with The Bet Butler</h2>
        <p class="butler-home-desc">
          Stop retyping match names and searching for odds. Bet Butler transfers your calculated Accas and value bets straight into your installed <strong>Sky Bet</strong> app. One tap launches the app ready to place, and the Return Bridge logs your real bets for <strong>+5 bonus points in your leagues</strong>.
        </p>
        <div class="butler-home-features">
          <div class="butler-feat-item"><span class="feat-icon">⚡</span> 1-Tap App Launch</div>
          <div class="butler-feat-item"><span class="feat-icon">📋</span> Automatic Slip Transfer</div>
          <div class="butler-feat-item"><span class="feat-icon">🏆</span> +5 League Bonus Points</div>
          <div class="butler-feat-item"><span class="feat-icon">🔄</span> Return Bridge Diary Sync</div>
        </div>
        <div class="butler-home-actions">
          <a href="#/picks" class="btn primary small" style="background:#0284c7;border:none;font-weight:700;">Build Acca for Sky Bet ↗</a>
          <button type="button" class="btn small" onclick="openButlerModal()">Butler Info &amp; Settings ⚙️</button>
        </div>
      </div>
    </div>
    '<!-- 3. Smaller Boxes: 2x2 on Mobile, all visible without scrolling -->' +"""

new_snippet = """      '</a>' +

      '<!-- Bet Butler Feature Hero Card -->' +
      '<div class="butler-home-hero-card">' +
        '<div class="butler-home-hero-content">' +
          '<div class="butler-home-badge">' +
            '<span class="badge-dot" style="background:#38bdf8;"></span>' +
            '<span>🤵 Official App Hand-Off: Sky Bet</span>' +
            '<span class="butler-bonus-tag">🏆 +5 League Bonus Points</span>' +
          '</div>' +
          '<h2 class="butler-home-title">1-Tap Bookie Hand-Off with The Bet Butler</h2>' +
          '<p class="butler-home-desc">' +
            'Stop retyping match names and searching for odds. Bet Butler transfers your calculated Accas and value bets straight into your installed <strong>Sky Bet</strong> app. One tap launches the app ready to place, and the Return Bridge logs your real bets for <strong>+5 bonus points in your leagues</strong>.' +
          '</p>' +
          '<div class="butler-home-features">' +
            '<div class="butler-feat-item"><span class="feat-icon">⚡</span> 1-Tap App Launch</div>' +
            '<div class="butler-feat-item"><span class="feat-icon">📋</span> Automatic Slip Transfer</div>' +
            '<div class="butler-feat-item"><span class="feat-icon">🏆</span> +5 League Bonus Points</div>' +
            '<div class="butler-feat-item"><span class="feat-icon">🔄</span> Return Bridge Diary Sync</div>' +
          '</div>' +
          '<div class="butler-home-actions">' +
            '<a href="#/picks" class="btn primary small" style="background:#0284c7;border:none;font-weight:700;">Build Acca for Sky Bet ↗</a>' +
            '<button type="button" class="btn small" onclick="openButlerModal()">Butler Info &amp; Settings ⚙️</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<!-- 3. Smaller Boxes: 2x2 on Mobile, all visible without scrolling -->' +"""

if old_snippet in text:
    text = text.replace(old_snippet, new_snippet)
    app_path.write_text(text, encoding="utf-8")
    print("Successfully patched string syntax in app.js")
else:
    # Try normalizing newlines
    text_norm = text.replace("\r\n", "\n")
    old_norm = old_snippet.replace("\r\n", "\n")
    new_norm = new_snippet.replace("\r\n", "\n")
    if old_norm in text_norm:
        text_norm = text_norm.replace(old_norm, new_norm)
        app_path.write_text(text_norm, encoding="utf-8")
        print("Successfully patched string syntax in app.js (normalized CRLF)")
    else:
        print("Error: snippet not found")
