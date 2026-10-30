with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Replace create-league-form
old_create_form = '''      <form id="create-league-form" style="margin-top:14px">
        <div class="field">
          <label for="new-league-name">League Name</label>
          <input id="new-league-name" class="ctl" placeholder="e.g. The 10p Legends, Sunday Pub Crew" maxlength="32" required>
        </div>
        <p class="section-note" style="margin:8px 0 14px">Ranked strictly on Win % and ROI %. Anyone can join and compete with 10p bets on equal terms.</p>
        <button type="submit" class="btn primary full-width">Create League & Get Invite Code</button>
      </form>'''

new_create_form = '''      <form id="create-league-form" style="margin-top:14px">
        <div class="field">
          <label for="new-league-name">League Name</label>
          <input id="new-league-name" class="ctl" placeholder="e.g. The 10p Legends, Sunday Pub Crew" maxlength="32" required>
        </div>
        <div class="field">
          <label>League Icon</label>
          <div class="emoji-picker-grid" id="new-league-emojis">
            <button type="button" class="emoji-opt-btn active" data-league-emoji="⚽">⚽</button>
            <button type="button" class="emoji-opt-btn" data-league-emoji="🎯">🎯</button>
            <button type="button" class="emoji-opt-btn" data-league-emoji="🍺">🍺</button>
            <button type="button" class="emoji-opt-btn" data-league-emoji="🏆">🏆</button>
            <button type="button" class="emoji-opt-btn" data-league-emoji="🔥">🔥</button>
            <button type="button" class="emoji-opt-btn" data-league-emoji="⛳">⛳</button>
            <button type="button" class="emoji-opt-btn" data-league-emoji="🎾">🎾</button>
            <button type="button" class="emoji-opt-btn" data-league-emoji="🏉">🏉</button>
            <button type="button" class="emoji-opt-btn" data-league-emoji="🏴󠁧󠁢󠁳󠁣󠁴󠁿">🏴󠁧󠁢󠁳󠁣󠁴󠁿</button>
            <button type="button" class="emoji-opt-btn" data-league-emoji="🇬🇧">🇬🇧</button>
          </div>
          <input type="hidden" id="new-league-icon" value="⚽">
        </div>
        <div class="field">
          <label for="new-league-freq">League Duration</label>
          <select id="new-league-freq" class="ctl">
            <option value="weekly" selected>Weekly (Resets every Monday 00:00)</option>
            <option value="monthly">Monthly (Calendar Month Championship)</option>
            <option value="yearly">Yearly (Season Championship)</option>
          </select>
        </div>
        <p class="section-note" style="margin:8px 0 14px"><b>Option A Scoring:</b> Win points = (Decimal Odds - 1) &times; 10. A 20/1 winner scores 200 pts, Evens scores 10 pts. Losses deduct -2 pts. Win % &amp; ROI % used as tie-breakers. Top 3 win Gold, Silver &amp; Bronze!</p>
        <button type="submit" class="btn primary full-width">Create League & Get Invite Code</button>
      </form>'''

assert old_create_form in html, 'old_create_form not found'
html = html.replace(old_create_form, new_create_form)

# 2. Update handle-form to include Town, Region, Country
old_handle_form = '''        <div class="field">
          <label for="player-handle-input">Your Custom Username / Gamertag</label>
          <input id="player-handle-input" class="ctl" placeholder="e.g. PandaPunter, TheAccaKing" maxlength="24" required>
        </div>
        <p class="section-note" style="margin:8px 0 14px">This name appears on the leaderboard in all your Buddy Leagues. Stored privately in this browser.</p>
        <button type="submit" class="btn primary full-width">Save Username</button>'''

new_handle_form = '''        <div class="field">
          <label for="player-handle-input">Your Custom Username / Gamertag</label>
          <input id="player-handle-input" class="ctl" placeholder="e.g. PandaPunter, TheAccaKing" maxlength="24" required>
        </div>
        <div class="field" style="margin-top:10px">
          <label for="player-town-input">Hometown / City</label>
          <input id="player-town-input" class="ctl" placeholder="e.g. Paisley" maxlength="32" value="Paisley">
        </div>
        <div class="field" style="margin-top:10px">
          <label for="player-region-input">County / Region</label>
          <input id="player-region-input" class="ctl" placeholder="e.g. Renfrewshire" maxlength="32" value="Renfrewshire">
        </div>
        <div class="field" style="margin-top:10px">
          <label for="player-country-input">Country</label>
          <input id="player-country-input" class="ctl" placeholder="e.g. Scotland" maxlength="32" value="Scotland">
        </div>
        <p class="section-note" style="margin:8px 0 14px">Automatically places you into your Town, County, Country, UK, Europe, and Worldwide leagues with distinct trophies and medals!</p>
        <button type="submit" class="btn primary full-width">Save Profile & Leagues</button>'''

assert old_handle_form in html, 'old_handle_form not found'
html = html.replace(old_handle_form, new_handle_form)

# 3. Add Trophy Cabinet Modal right after handle-modal
trophy_modal = '''
<!-- Trophy Cabinet Modal -->
<div class="modal-backdrop" id="trophy-cabinet-modal" hidden>
  <div class="modal trophy-cabinet-box" role="dialog" aria-modal="true" aria-labelledby="trophy-modal-title">
    <div class="modal-head">
      <div>
        <h2 id="trophy-modal-title">🏆 Punter Trophy Cabinet</h2>
        <p class="section-note">Your permanent silverware collection across Town, County, National, Europe, World &amp; Buddy Leagues.</p>
      </div>
      <button type="button" class="icon-btn" data-close-trophy aria-label="Close">&times;</button>
    </div>
    <div class="modal-body" id="trophy-modal-body">
      <!-- Populated dynamically by app.js -->
    </div>
  </div>
</div>
'''

target_after_handle = '<!-- Google Sign-In Modal -->'
assert target_after_handle in html, 'target_after_handle not found'
html = html.replace(target_after_handle, trophy_modal + '\n' + target_after_handle)

with open('index.html', 'w', encoding='utf-8', newline='\n') as f:
    f.write(html)

print('Updated index.html with enhanced leagues, geo profile, and trophy cabinet modal')

