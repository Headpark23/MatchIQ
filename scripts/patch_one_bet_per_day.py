# patch_one_bet_per_day.py
import re

# 1. Update app.js
with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

old_stats_code = """  const settled = filteredDiary.filter(e => e.outcome && e.outcome !== 'pending');
  const won = settled.filter(e => e.outcome === 'won');
  const totalStaked = settled.reduce((sum, e) => sum + (+e.stake || 0), 0);
  const totalProfit = settled.reduce((sum, e) => sum + (calc.calculateBetProfit(e.stake, e.odds, e.outcome) || 0), 0);
  
  // Option A Scoring: (Decimal Odds - 1) * 10 on won; -2 on lost; 0 on void
  const points = settled.reduce((sum, e) => sum + (calc.calculateLeaguePoints(e.odds, e.outcome) || 0), 0);
  const winRate = settled.length ? Math.round((won.length / settled.length) * 100) : 0;
  const roi = totalStaked > 0 ? +( (totalProfit / totalStaked) * 100 ).toFixed(1) : 0.0;
  const last5 = settled.slice(0, 5).map(e => e.outcome === 'won' ? 'W' : e.outcome === 'lost' ? 'L' : 'V');
  return { points, settled: settled.length, won: won.length, winRate, roi, form: last5.length ? last5 : ['—'] };"""

new_stats_code = """  const settled = filteredDiary.filter(e => e.outcome && e.outcome !== 'pending');

  // FAIR PLAY RULE: Exactly 1 settled bet per calendar day counts toward league standings.
  // Chronologically earliest bet logged each day qualifies; extra bets on the same day are excluded.
  const dailyQualifyingMap = new Map();
  settled.slice().reverse().forEach(e => {
    const dayKey = (e.date || (e.timestamp ? e.timestamp.slice(0, 10) : '') || 'undated').slice(0, 10);
    if (!dailyQualifyingMap.has(dayKey)) {
      dailyQualifyingMap.set(dayKey, e);
    }
  });
  const leagueBets = Array.from(dailyQualifyingMap.values()).reverse();

  const won = leagueBets.filter(e => e.outcome === 'won');
  const totalStaked = leagueBets.reduce((sum, e) => sum + (+e.stake || 0), 0);
  const totalProfit = leagueBets.reduce((sum, e) => sum + (calc.calculateBetProfit(e.stake, e.odds, e.outcome) || 0), 0);
  
  // Option A Scoring: (Decimal Odds - 1) * 10 on won; -2 on lost; 0 on void
  const points = leagueBets.reduce((sum, e) => sum + (calc.calculateLeaguePoints(e.odds, e.outcome) || 0), 0);
  const winRate = leagueBets.length ? Math.round((won.length / leagueBets.length) * 100) : 0;
  const roi = totalStaked > 0 ? +( (totalProfit / totalStaked) * 100 ).toFixed(1) : 0.0;
  const last5 = leagueBets.slice(0, 5).map(e => e.outcome === 'won' ? 'W' : e.outcome === 'lost' ? 'L' : 'V');
  return { points, settled: leagueBets.length, won: won.length, winRate, roi, form: last5.length ? last5 : ['—'] };"""

if old_stats_code in js:
    js = js.replace(old_stats_code, new_stats_code, 1)
    print('Updated getUserLeagueStats with 1-bet-per-day restriction in app.js')
else:
    print('old_stats_code not matched')

# Add fair-play-banner to viewLeagues()
old_view_leagues_header = """  return '<section class="view">' +
    '<div class="section-head" style="align-items:flex-end"><div>' +
      '<h1 class="page-title">Buddy &amp; Regional Leagues</h1>' +
      '<p class="page-sub">Compete in your 6 automatic hometown and global leagues, or create private mini-leagues with mates. Option A: 20/1 winner = 200 pts, Evens = 10 pts, Loss = -2 pts.</p>' +
    '</div>' +"""

new_view_leagues_header = """  return '<section class="view">' +
    '<div class="fair-play-banner">' +
      '<span class="fair-play-icon">🛡️</span>' +
      '<div><strong>Fair Play Rule (1 Bet Per Day Cap):</strong> Exactly <strong>1 settled bet per calendar day</strong> counts toward your league score. Placing multiple small bets on the same day in your diary will not inflate your score.</div>' +
    '</div>' +
    '<div class="section-head" style="align-items:flex-end"><div>' +
      '<h1 class="page-title">Buddy &amp; Regional Leagues</h1>' +
      '<p class="page-sub">Compete in your 6 automatic hometown and global leagues, or create private mini-leagues with mates. Option A: 20/1 winner = 200 pts, Evens = 10 pts, Loss = -2 pts. <b>Max 1 qualifying bet per day.</b></p>' +
    '</div>' +"""

if old_view_leagues_header in js:
    js = js.replace(old_view_leagues_header, new_view_leagues_header, 1)
    print('Added fair-play-banner to viewLeagues in app.js')
else:
    print('old_view_leagues_header not matched')

# Update trophy notes in viewLeagues
js = js.replace(
    'Top 3 win Gold, Silver &amp; Bronze</span>',
    'Top 3 win Gold, Silver &amp; Bronze · <b style="color:var(--cyan)">Max 1 bet/day</b></span>'
)
print('Updated trophy notes with 1 bet/day reminder')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)


# 2. Update styles.css
with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

fair_play_css = """
/* Fair Play Banner */
.fair-play-banner {
  display: flex; align-items: center; gap: 12px;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(16, 185, 129, 0.08));
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: 12px; padding: 11px 16px; margin: 0 0 16px;
  font-size: 13px; color: #e2e8f0; line-height: 1.45;
}
.fair-play-banner strong { color: #fff; }
.fair-play-icon { font-size: 20px; flex-shrink: 0; }
"""

if '.fair-play-banner' not in css:
    css += '\n' + fair_play_css
    with open('styles.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print('Added .fair-play-banner styles to styles.css')


# 3. Update index.html create league note
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

old_modal_note = """<p class="section-note" style="margin:8px 0 14px"><b>Option A Scoring:</b> Win points = (Decimal Odds - 1) &times; 10. A 20/1 winner scores 200 pts, Evens scores 10 pts. Losses deduct -2 pts. Win % &amp; ROI % used as tie-breakers. Top 3 win Gold, Silver &amp; Bronze!</p>"""

new_modal_note = """<p class="section-note" style="margin:8px 0 14px"><b>Option A Scoring:</b> Win points = (Decimal Odds - 1) &times; 10. Losses deduct -2 pts. <b>🛡️ Fair Play Cap: Exactly 1 settled bet per calendar day counts toward league standings</b> to prevent spamming multiple small bets.</p>"""

if old_modal_note in html:
    html = html.replace(old_modal_note, new_modal_note, 1)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print('Updated create-league-form modal note in index.html')
