"""Update viewLeagues() and styles.css so all metrics fit in one responsive view without side scrolling.
User form (e.g. W, L, W, W, V) is placed in an expandable row/modal when clicking the user's name or a mini form badge.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 1. Update app.js
app_path = ROOT / "app.js"
app_js = app_path.read_text(encoding="utf-8")

idx_start = app_js.find('const rowsHtml = allMembers.map((m, idx) => {')
idx_end = app_js.find("}).join('');", idx_start) + len("}).join('');")

old_snippet = app_js[idx_start:idx_end]

new_rows_html = """const rowsHtml = allMembers.map((m, idx) => {
    const rank = idx + 1;
    const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'standard';
    const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const formChips = (m.form || ['—']).map(f => f === '—' ? '<span class="dim">—</span>' : '<span class="form-chip ' + f.toLowerCase() + '">' + f + '</span>').join('');
    const roiSign = m.roi > 0 ? '+' : '';
    const roiClass = m.roi > 0 ? 'pos' : m.roi < 0 ? 'neg' : '';
    const formStr = (m.form || []).join(' · ');
    const memberId = 'mem-form-' + idx;

    return '<tr class="lb-row' + (m.isYou ? ' user-row' : '') + '">' +
      '<td class="lb-col-rank"><span class="rank-badge ' + rankClass + '">' + rankIcon + '</span></td>' +
      '<td class="lb-col-player">' +
        '<button type="button" class="lb-player-btn" onclick="toggleMemberForm(\\'' + memberId + '\\')" title="Click to view recent form">' +
          '<b class="lb-handle">' + esc(m.handle) + '</b>' +
          (m.isYou ? ' <span class="bento-badge emerald lb-you-tag">YOU</span>' : '') +
          '<span class="lb-form-indicator" title="Form: ' + esc(formStr) + '">📊</span>' +
        '</button>' +
        '<div id="' + memberId + '" class="lb-member-form-drawer" hidden>' +
          '<div class="lb-drawer-inner"><span class="lb-drawer-label">Form:</span><div class="form-chips">' + formChips + '</div></div>' +
        '</div>' +
      '</td>' +
      '<td class="lb-col-pts"><b class="lb-pts-val">' + m.points + '</b></td>' +
      '<td class="lb-col-win"><span class="win-pct-pill">' + m.winRate + '%</span></td>' +
      '<td class="lb-col-roi"><span class="roi-pct-pill ' + roiClass + '">' + roiSign + m.roi + '%</span></td>' +
      '<td class="lb-col-bets num mono">' + m.settled + '</td>' +
    '</tr>';
  }).join('');"""

app_js = app_js[:idx_start] + new_rows_html + app_js[idx_end:]

# Replace table header in viewLeagues()
old_table_head = """      '<div style="overflow-x:auto"><table class="lb-table"><thead><tr>' +
        '<th>Rank</th><th>Player</th><th>Form</th><th class="num">Settled</th>' +
        '<th style="color:var(--cyan)">Points (Odds)</th><th>Win Rate</th><th>ROI %</th>' +
      '</tr></thead><tbody>' +"""

new_table_head = """      '<div class="lb-table-wrap"><table class="lb-table compact-lb"><thead><tr>' +
        '<th class="lb-col-rank">#</th>' +
        '<th class="lb-col-player">Player (Form)</th>' +
        '<th class="lb-col-pts" style="color:var(--cyan)">Points</th>' +
        '<th class="lb-col-win">Win %</th>' +
        '<th class="lb-col-roi">ROI %</th>' +
        '<th class="lb-col-bets num">Bets</th>' +
      '</tr></thead><tbody>' +"""

assert old_table_head in app_js, "old_table_head not found!"
app_js = app_js.replace(old_table_head, new_table_head, 1)

# Add helper toggleMemberForm function
if "function toggleMemberForm(" not in app_js:
    app_js += """

function toggleMemberForm(id) {
  const el = document.getElementById(id);
  if (el) {
    el.hidden = !el.hidden;
  }
}
"""

app_path.write_text(app_js, encoding="utf-8")
print("Successfully patched app.js with no-scroll compact league table and form drawer!")

# 2. Add styles in styles.css
css_path = ROOT / "styles.css"
css_code = css_path.read_text(encoding="utf-8")

compact_table_css = """

/* Compact No-Scroll League Table */
.lb-table-wrap {
  width: 100%;
  overflow-x: hidden;
}
.compact-lb {
  table-layout: fixed;
  width: 100%;
}
.compact-lb th, .compact-lb td {
  padding: 10px 6px;
  white-space: nowrap;
}
.lb-col-rank { width: 36px; text-align: center; }
.lb-col-player { width: auto; overflow: hidden; text-overflow: ellipsis; }
.lb-col-pts { width: 64px; text-align: right; }
.lb-col-win { width: 58px; text-align: right; }
.lb-col-roi { width: 58px; text-align: right; }
.lb-col-bets { width: 42px; text-align: right; }

.lb-player-btn {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  color: inherit;
  font-size: inherit;
  text-align: left;
  max-width: 100%;
}
.lb-handle {
  color: #fff;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
}
.lb-you-tag {
  font-size: 9px;
  padding: 1px 4px;
}
.lb-form-indicator {
  font-size: 11px;
  opacity: 0.75;
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.lb-player-btn:hover .lb-form-indicator {
  opacity: 1;
  transform: scale(1.2);
}

.lb-pts-val {
  color: var(--cyan);
  font-family: var(--mono);
  font-size: 13.5px;
}
.compact-lb .win-pct-pill {
  padding: 2px 5px;
  font-size: 11px;
}
.compact-lb .roi-pct-pill {
  font-size: 11px;
}

.lb-member-form-drawer {
  margin-top: 4px;
  padding: 4px 8px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 6px;
  display: flex;
}
.lb-drawer-inner {
  display: flex;
  align-items: center;
  gap: 6px;
}
.lb-drawer-label {
  font-size: 10px;
  color: var(--muted);
  font-weight: 600;
}

@media (max-width: 480px) {
  .compact-lb th, .compact-lb td {
    padding: 8px 3px;
    font-size: 11.5px;
  }
  .lb-col-rank { width: 30px; }
  .lb-col-pts { width: 50px; }
  .lb-col-win { width: 48px; }
  .lb-col-roi { width: 48px; }
  .lb-col-bets { width: 34px; }
  .lb-handle { max-width: 75px; font-size: 11.5px; }
}
"""

css_code += compact_table_css
css_path.write_text(css_code, encoding="utf-8")
print("Successfully appended compact no-scroll league styles to styles.css!")
