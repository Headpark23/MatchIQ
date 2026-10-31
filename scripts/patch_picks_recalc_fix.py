import re

# 1. Patch app.js
with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# custom acca wipe
old_custom = """// Custom Multi-Sport Acca State
let customAccaLegs = [];
try {
  const savedCustom = JSON.parse(localStorage.getItem('betbuddy_custom_acca_v1') || '[]');
  if (Array.isArray(savedCustom)) customAccaLegs = savedCustom;
} catch (e) {}"""

new_custom = """// Custom Multi-Sport Acca State
let customAccaLegs = [];
try {
  // Wipe stale custom acca state on startup to ensure a completely clean app per user directive
  localStorage.removeItem('betbuddy_custom_acca_v1');
} catch (e) {}"""

assert old_custom in js, "custom acca state not found"
js = js.replace(old_custom, new_custom, 1)

# builderCompute
old_compute = """function builderCompute() {
  const { stake, legs, win } = builderState;
  const now = Date.now();
  const todayStr = new Date(now).toISOString().slice(0, 10);
  const upcomingToday = predictionsList().filter(p => kickoffMs(p.fixture) > now && p.fixture && p.fixture.kickoff_utc && p.fixture.kickoff_utc.slice(0, 10) === todayStr);

  // If user selected today, but today has fewer upcoming games than requested legs, auto fallback to upcoming slate
  let effectiveTiming = builderState.timing || 'today';
  if (effectiveTiming === 'today' && upcomingToday.length < legs) {
    effectiveTiming = 'all';
  }

  const footballPool = activeSports.includes('football')
    ? MatchIQBuilder.legPool(predictionsList(), { calc, reliability: DATA.reliability, feedFor, nowMs: now, timing: effectiveTiming })
    : [];"""

new_compute = """function builderCompute() {
  const { stake, legs, win } = builderState;
  const numLegs = Number(legs) || 4;
  const now = Date.now();
  const todayStr = new Date(now).toISOString().slice(0, 10);

  // If user selected today, verify today has enough distinct matches for requested legs; fallback to all if needed
  let effectiveTiming = builderState.timing || 'today';
  if (effectiveTiming === 'today') {
    const candidatePool = activeSports.includes('football')
      ? MatchIQBuilder.legPool(predictionsList(), { calc, reliability: DATA.reliability, feedFor, nowMs: now, timing: 'today' })
      : [];
    const distinctMatches = new Set(candidatePool.map(l => l.matchId)).size;
    if (distinctMatches < numLegs) {
      effectiveTiming = 'all';
    }
  }

  const footballPool = activeSports.includes('football')
    ? MatchIQBuilder.legPool(predictionsList(), { calc, reliability: DATA.reliability, feedFor, nowMs: now, timing: effectiveTiming })
    : [];"""

assert old_compute in js, "builderCompute not found"
js = js.replace(old_compute, new_compute, 1)

# buildSlips leg cast
old_slips = """  const combinedPool = footballPool.concat(multiSportPool);
  builderResult = MatchIQBuilder.buildSlips(combinedPool, { stake, win, legs, maxSlips: 4 });"""

new_slips = """  const combinedPool = footballPool.concat(multiSportPool);
  builderResult = MatchIQBuilder.buildSlips(combinedPool, { stake, win, legs: Number(legs), maxSlips: 4 });"""

assert old_slips in js, "buildSlips not found"
js = js.replace(old_slips, new_slips, 1)

# slipCard kicker
old_kicker = """'<div class="slip-head"><div><div class="slip-kicker">' + (primary ? '💎 Best Value &amp; Target Match' : 'Option ' + (idx + 1) + ' Combination') + ' ' + jargonTip('acca') + '</div>'"""
new_kicker = """'<div class="slip-head"><div><div class="slip-kicker">' + (primary ? '💎 Best Value &amp; Target Match (' + slip.legs.length + '-Leg Acca)' : 'Option ' + (idx + 1) + ' Combination (' + slip.legs.length + '-Leg Acca)') + ' ' + jargonTip('acca') + '</div>'"""

assert old_kicker in js, "slipCard kicker not found"
js = js.replace(old_kicker, new_kicker, 1)

# builderOutput
old_output = """function builderOutput() {
  const r = builderResult, { stake, win } = builderState, m = MatchIQBuilder.money;
  let customHtml = customAccaLegs.length > 0 ? customAccaCard(stake) : '';
  if (!r) return customHtml;
  const need = '<p class="builder-need">To win <b>' + m(win) + '</b> from a <b>' + m(stake) + '</b> stake you need a total return of <b>' + m(stake + win) + '</b>: combined odds of about <b class="mono">' + fmtOdds((stake + win) / stake) + '</b>.</p>';
  if (r.error) {
    let helper = '';
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = predictionsList().filter(p => p.fixture && p.fixture.kickoff_utc && p.fixture.kickoff_utc.slice(0, 10) === todayStr).length;
    if (builderState.timing === 'today' && todayCount > 0 && todayCount < builderState.legs) {
      helper = '<div class="notice" style="margin-top:14px;border-color:var(--emerald);background:rgba(16,185,129,0.12);color:#fff;">' +
        '<b>⚡ ' + todayCount + ' matches playing today.</b><br>' +
        'Target is ' + builderState.legs + ' bets. Adjust legs to match today\\'s available matches, or switch to the 7-day schedule:' +
        '<div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">' +
          '<button type="button" class="btn small" onclick="setBuilderLegs(' + todayCount + ')" style="background:var(--emerald);color:#03140d;font-weight:700;">Build ' + todayCount + '-Leg Acca for Today</button>' +
          '<button type="button" class="btn small" onclick="setBuilderTiming(\\'all\\')">Switch to Next 7 Days</button>' +
        '</div>' +
      '</div>';
    }
    return customHtml + need + '<div class="empty" style="margin-top:12px">' + esc(r.error) + '</div>' + helper;
  }
  const first = r.slips[0];
  const miss = r.exact ? '' : '<p class="slip-warn">No combination lands on that target. This is the closest available: it returns ' + m(first.ret) + ' (profit ' + m(first.profit) + ').</p>';
  const fine = '<p class="builder-fine">Chances are Bet Buddy model estimates, not promises. On average this slip is expected to ' + (first.ev >= 0 ? 'make ' : 'lose ') + '<b>' + m(Math.abs(first.ev)) + '</b> per ' + m(stake) + ' staked; bookmaker margins usually push that below zero. Never stake more than you can afford to lose.</p>';
  return customHtml + need + miss + r.slips.map((s, i) => slipCard(s, i, stake)).join('') + fine;
}"""

new_output = """function builderOutput() {
  const r = builderResult, { stake, win, legs } = builderState, m = MatchIQBuilder.money;
  let customHtml = customAccaLegs.length > 0 ? customAccaCard(stake) : '';
  if (!r) return customHtml;
  const numLegs = Number(legs) || 4;
  const need = '<p class="builder-need">To win <b>' + m(win) + '</b> from a <b>' + m(stake) + '</b> stake across <b>' + numLegs + ' bets</b> you need a total return of <b>' + m(stake + win) + '</b>: combined odds of about <b class="mono">' + fmtOdds((stake + win) / stake) + '</b>.</p>';
  if (r.error) {
    let helper = '';
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = predictionsList().filter(p => p.fixture && p.fixture.kickoff_utc && p.fixture.kickoff_utc.slice(0, 10) === todayStr).length;
    if (builderState.timing === 'today' && todayCount > 0 && todayCount < numLegs) {
      helper = '<div class="notice" style="margin-top:14px;border-color:var(--emerald);background:rgba(16,185,129,0.12);color:#fff;">' +
        '<b>⚡ ' + todayCount + ' matches playing today.</b><br>' +
        'Target is ' + numLegs + ' bets. Adjust legs to match today\\'s available matches, or switch to the 7-day schedule:' +
        '<div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">' +
          '<button type="button" class="btn small" onclick="setBuilderLegs(' + todayCount + ')" style="background:var(--emerald);color:#03140d;font-weight:700;">Build ' + todayCount + '-Leg Acca for Today</button>' +
          '<button type="button" class="btn small" onclick="setBuilderTiming(\\'all\\')">Switch to Next 7 Days</button>' +
        '</div>' +
      '</div>';
    }
    return need + '<div class="empty" style="margin-top:12px">' + esc(r.error) + '</div>' + helper + customHtml;
  }
  const first = r.slips[0];
  const miss = r.exact ? '' : '<p class="slip-warn">No combination lands on that target. This is the closest available: it returns ' + m(first.ret) + ' (profit ' + m(first.profit) + ').</p>';
  const fine = '<p class="builder-fine">Chances are Bet Buddy model estimates, not promises. On average this slip is expected to ' + (first.ev >= 0 ? 'make ' : 'lose ') + '<b>' + m(Math.abs(first.ev)) + '</b> per ' + m(stake) + ' staked; bookmaker margins usually push that below zero. Never stake more than you can afford to lose.</p>';
  return need + miss + r.slips.map((s, i) => slipCard(s, i, stake)).join('') + fine + customHtml;
}"""

assert old_output in js, "builderOutput not found"
js = js.replace(old_output, new_output, 1)

# setBuilderLegs
old_set_legs = """function setBuilderLegs(n) {
  builderState.legs = n;
  const inp = $('b-legs'); if (inp) inp.value = n;
  markLegChips();
  updateBuilder();
}"""

new_set_legs = """function setBuilderLegs(n) {
  const num = Math.max(1, Math.min(MatchIQBuilder.MAX_LEGS, Number(n) || 4));
  builderState.legs = num;
  try { localStorage.setItem(BUILDER_KEY, JSON.stringify(builderState)); } catch (e) {}
  const inp = $('b-legs'); if (inp) inp.value = num;
  markLegChips();
  updateBuilder();
  render();
}"""

assert old_set_legs in js, "setBuilderLegs not found"
js = js.replace(old_set_legs, new_set_legs, 1)

# markLegChips
old_mark = """function markLegChips() {
  document.querySelectorAll('.legpick').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.legs === builderState.legs)));
}"""

new_mark = """function markLegChips() {
  const current = Number(builderState.legs);
  document.querySelectorAll('.legpick').forEach(b => {
    const isSel = +b.dataset.legs === current;
    b.setAttribute('aria-pressed', String(isSel));
    b.classList.toggle('active', isSel);
  });
}"""

assert old_mark in js, "markLegChips not found"
js = js.replace(old_mark, new_mark, 1)

# onBuilderInput
old_input = """  else if (t.dataset.b === 'legs') { builderState.legs = Math.max(1, Math.min(MatchIQBuilder.MAX_LEGS, Math.round(v))); markLegChips(); updateBuilder(); return; }"""
new_input = """  else if (t.dataset.b === 'legs') {
    builderState.legs = Math.max(1, Math.min(MatchIQBuilder.MAX_LEGS, Math.round(v)));
    try { localStorage.setItem(BUILDER_KEY, JSON.stringify(builderState)); } catch (e) {}
    markLegChips();
    updateBuilder();
    render();
    return;
  }"""

assert old_input in js, "onBuilderInput not found"
js = js.replace(old_input, new_input, 1)

# Bump version to v71
js = re.sub(r"const APP_VERSION = 'v\d+';", "const APP_VERSION = 'v71';", js)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("Successfully patched app.js!")

# 2. Patch sw.js
with open('sw.js', 'r', encoding='utf-8') as f:
    sw = f.read()

sw = re.sub(r"const CACHE_NAME = 'betbuddy-pwa-v\d+';", "const CACHE_NAME = 'betbuddy-pwa-v71';", sw)

with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(sw)

print("Successfully patched sw.js!")
