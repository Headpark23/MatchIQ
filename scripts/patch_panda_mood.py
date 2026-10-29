with open('app.js', 'r', encoding='utf-8') as f:
    app_text = f.read()

# 1. Update pandaMoodMarkup helper
new_panda_mood_markup = '''function pandaMoodMarkup(slip, win) {
  const pm = getPandaMood(slip, win);
  return '<div class="panda-mood-card ' + pm.badgeClass + '" title="' + esc(pm.desc) + '">' +
    '<svg viewBox="0 0 36 36" class="panda-mood-icon">' + pm.svg + '</svg>' +
    '<div><div class="panda-mood-kicker">' + esc(pm.kicker) + '</div><div class="panda-mood-desc">' + esc(pm.desc) + '</div></div>' +
  '</div>';
}'''

# 2. Rich Panda Mascot SVG generator with actual expressions based on Odds / Win / Chance
# Panda head features: ears, white face, black eye patches, white eyeballs/pupils, nose, expressive mouth, and optional sweat drops / party stars
new_panda_mood_fn = '''function getPandaMood(slip, win) {
  const stake = (builderState && builderState.stake) || 10;
  const targetWin = win || (builderState && builderState.win) || 50;
  const targetOdds = (stake + targetWin) / stake;
  const slipOdds = (slip && slip.odds) || targetOdds;
  const chance = (slip && slip.chance) || (1 / targetOdds);

  // Helper to render panda base head (ears, white face, eye patches)
  const baseHead = '<circle cx="8" cy="8" r="5" fill="#04140d"/><circle cx="28" cy="8" r="5" fill="#04140d"/>' +
    '<circle cx="8" cy="8" r="2.2" fill="#a7f3d0"/><circle cx="28" cy="8" r="2.2" fill="#a7f3d0"/>' +
    '<circle cx="18" cy="20" r="13" fill="#ffffff" stroke="#04140d" stroke-width="1.5"/>' +
    '<ellipse cx="13" cy="18" rx="3.5" ry="4.5" fill="#04140d" transform="rotate(-15 13 18)"/>' +
    '<ellipse cx="23" cy="18" rx="3.5" ry="4.5" fill="#04140d" transform="rotate(15 23 18)"/>' +
    '<ellipse cx="18" cy="22" rx="2" ry="1.4" fill="#04140d"/>';

  // 1. WILD MONSTER ODDS / MEGA LONGSHOT (Odds >= 40/1 or Win >= £400) -> Jaw-dropped, shocked, sweaty crazy panda
  if (slipOdds >= 41 || targetWin >= 400 || chance < 0.04) {
    return {
      mood: 'shocked',
      kicker: 'Crazy Longshot (' + Math.round(slipOdds) + '/1)',
      desc: 'Jaw-dropping odds! Panda is sweating bullets. Tiny stakes only!',
      badgeClass: 'rose',
      svg: baseHead +
        '<circle cx="13" cy="18" r="2.2" fill="#fff"/><circle cx="13" cy="18" r="1.1" fill="#fb7185"/>' +
        '<circle cx="23" cy="18" r="2.2" fill="#fff"/><circle cx="23" cy="18" r="1.1" fill="#fb7185"/>' +
        '<ellipse cx="18" cy="27" rx="3.5" ry="4.5" fill="#350810" stroke="#fb7185" stroke-width="1.2"/>' +
        '<path d="M30 14c1 2 0 4-1 4s-2-2-1-4c.4-.8 1.6-.8 2 0z" fill="#38bdf8"/>'
    };
  }

  // 2. BIG ACCA / ADVENTUROUS LONGSHOT (Odds >= 15/1 or Win >= £150) -> Wide-eyed, open-mouthed 'O' face, excited
  if (slipOdds >= 15 || targetWin >= 150 || chance < 0.12) {
    return {
      mood: 'wild',
      kicker: 'Ambitious Target (' + Math.round(slipOdds) + '/1)',
      desc: 'Big odds acca! Panda has his wild eyes on the prize.',
      badgeClass: 'amber',
      svg: baseHead +
        '<circle cx="13" cy="18" r="1.8" fill="#fff"/><circle cx="13" cy="18" r="1" fill="#f59e0b"/>' +
        '<circle cx="23" cy="18" r="1.8" fill="#fff"/><circle cx="23" cy="18" r="1" fill="#f59e0b"/>' +
        '<circle cx="18" cy="26" r="3.2" fill="#451a03" stroke="#f59e0b" stroke-width="1.2"/>'
    };
  }

  // 3. BALANCED WEEKEND ACCA (Odds >= 5/1 or Win >= £50) -> Cheerful, cool smirk, confident wink
  if (slipOdds >= 5 || targetWin >= 50 || chance < 0.30) {
    return {
      mood: 'balanced',
      kicker: 'Balanced Acca (' + slipOdds.toFixed(1) + '/1)',
      desc: 'Sweet spot weekend accumulator. Solid risk-to-reward.',
      badgeClass: 'cyan',
      svg: baseHead +
        '<circle cx="13" cy="18" r="1.6" fill="#fff"/><circle cx="13" cy="18" r="0.9" fill="#38bdf8"/>' +
        '<path d="M21 18c1-1 3-1 4 0" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" fill="none"/>' +
        '<path d="M15 25c1.5 1.5 4.5 1.5 6 0" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>'
    };
  }

  // 4. LOW-RISK / HIGH CONFIDENCE (Odds < 5/1, Chance >= 30%) -> Happy beaming smile, emerald glowing eyes
  return {
    mood: 'confident',
    kicker: 'High Chance Pick (' + slipOdds.toFixed(1) + '/1)',
    desc: 'Short price, high probability path backed by model evidence.',
    badgeClass: 'emerald',
    svg: baseHead +
      '<circle cx="13" cy="17.5" r="1.8" fill="#fff"/><circle cx="13" cy="17.5" r="1" fill="#10b981"/>' +
      '<circle cx="23" cy="17.5" r="1.8" fill="#fff"/><circle cx="23" cy="17.5" r="1" fill="#10b981"/>' +
      '<path d="M14 24c1.8 2.2 6.2 2.2 8 0" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>'
  };
}'''

# Replace getPandaMood in app.js
import re
app_text = re.sub(r'function getPandaMood\(slip, win\) \{.*?\n\}', new_panda_mood_fn, app_text, flags=re.DOTALL)

# Insert pandaMoodMarkup
app_text = app_text.replace(new_panda_mood_fn, new_panda_mood_fn + '\n\n' + new_panda_mood_markup)

# In viewBuilder, replace the IIFE with container that has id="builder-panda-mood"
old_builder_panda = '''      (function() {
        const pm = getPandaMood(builderResult && builderResult.slips && builderResult.slips[0], builderState.win);
        return '<div class="panda-mood-card ' + pm.badgeClass + '" title="' + esc(pm.desc) + '">' +
          '<svg viewBox="0 0 24 24" class="panda-mood-icon">' + pm.svg + '</svg>' +
          '<div><div class="panda-mood-kicker">' + esc(pm.kicker) + '</div><div class="panda-mood-desc">' + esc(pm.desc) + '</div></div>' +
        '</div>';
      })()'''

new_builder_panda = '''      '<div id="builder-panda-mood">' + pandaMoodMarkup(builderResult && builderResult.slips && builderResult.slips[0], builderState.win) + '</div>\''''

app_text = app_text.replace(old_builder_panda, new_builder_panda)

# In updateBuilder(), update the panda mood in the header live!
old_update_builder = '''function updateBuilder() {
  builderCompute();
  const out = $('builder-out');
  if (out) out.innerHTML = builderOutput();
}'''

new_update_builder = '''function updateBuilder() {
  builderCompute();
  const out = $('builder-out');
  if (out) out.innerHTML = builderOutput();
  const moodWrap = $('builder-panda-mood');
  if (moodWrap) {
    moodWrap.innerHTML = pandaMoodMarkup(builderResult && builderResult.slips && builderResult.slips[0], builderState.win);
  }
}'''

app_text = app_text.replace(old_update_builder, new_update_builder)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_text)

print('Updated app.js with live-reactive Panda expressions')
