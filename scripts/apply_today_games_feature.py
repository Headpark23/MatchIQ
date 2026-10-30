import re

with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update builderState initialization
old_state = "const builderState = { stake: 10, legs: 4, win: 50 };\ntry {\n  const v = JSON.parse(localStorage.getItem(BUILDER_KEY) || 'null');\n  if (v && v.stake > 0 && v.win > 0 && v.legs >= 1 && v.legs <= MatchIQBuilder.MAX_LEGS) Object.assign(builderState, { stake: +v.stake, legs: +v.legs, win: +v.win });\n} catch (e) { /* the inputs are a convenience */ }"

new_state = """const builderState = { stake: 10, legs: 4, win: 50, timing: 'today' };
try {
  const v = JSON.parse(localStorage.getItem(BUILDER_KEY) || 'null');
  if (v && v.stake > 0 && v.win > 0 && v.legs >= 1 && v.legs <= MatchIQBuilder.MAX_LEGS) {
    Object.assign(builderState, { stake: +v.stake, legs: +v.legs, win: +v.win, timing: (v.timing === 'all' ? 'all' : 'today') });
  }
} catch (e) { /* the inputs are a convenience */ }"""

if old_state in code:
    code = code.replace(old_state, new_state)
else:
    old_state_crlf = old_state.replace('\n', '\r\n')
    new_state_crlf = new_state.replace('\n', '\r\n')
    if old_state_crlf in code:
        code = code.replace(old_state_crlf, new_state_crlf)
    else:
        print("Warning: old_state not matched directly")

# 2. Update builderCompute() to pass timing
old_compute = """function builderCompute() {
  const { stake, legs, win } = builderState;
  const footballPool = activeSports.includes('football')
    ? MatchIQBuilder.legPool(predictionsList(), { calc, reliability: DATA.reliability, feedFor, nowMs: Date.now() })
    : [];"""

new_compute = """function builderCompute() {
  const { stake, legs, win } = builderState;
  const timing = builderState.timing || 'today';
  const footballPool = activeSports.includes('football')
    ? MatchIQBuilder.legPool(predictionsList(), { calc, reliability: DATA.reliability, feedFor, nowMs: Date.now(), timing })
    : [];"""

if old_compute in code:
    code = code.replace(old_compute, new_compute)
else:
    old_compute_crlf = old_compute.replace('\n', '\r\n')
    new_compute_crlf = new_compute.replace('\n', '\r\n')
    if old_compute_crlf in code:
        code = code.replace(old_compute_crlf, new_compute_crlf)
    else:
        print("Warning: old_compute not matched directly")

# 3. Add setBuilderTiming function
old_setlegs = """function setBuilderLegs(n) {
  builderState.legs = n;
  const inp = $('b-legs'); if (inp) inp.value = n;
  markLegChips();
  updateBuilder();
}"""

new_setlegs = """function setBuilderLegs(n) {
  builderState.legs = n;
  const inp = $('b-legs'); if (inp) inp.value = n;
  markLegChips();
  updateBuilder();
}

function setBuilderTiming(mode) {
  builderState.timing = mode;
  try { localStorage.setItem(BUILDER_KEY, JSON.stringify(builderState)); } catch (e) {}
  document.querySelectorAll('.scope-pill').forEach(b => {
    const isActive = b.dataset.timing === mode;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-checked', String(isActive));
  });
  updateBuilder();
  render();
}
window.setBuilderTiming = setBuilderTiming;
window.setBuilderLegs = setBuilderLegs;"""

if old_setlegs in code:
    code = code.replace(old_setlegs, new_setlegs)
else:
    old_setlegs_crlf = old_setlegs.replace('\n', '\r\n')
    new_setlegs_crlf = new_setlegs.replace('\n', '\r\n')
    if old_setlegs_crlf in code:
        code = code.replace(old_setlegs_crlf, new_setlegs_crlf)
    else:
        print("Warning: old_setlegs not matched directly")

# 4. Update viewBuilder to render the Scope / Timing bar
old_view_builder = """function viewBuilder() {
  builderCompute();
  const { stake, legs, win } = builderState;
  const legChips = [2, 3, 4, 5, 6, 8].map(n => '<button type="button" class="legpick" data-legs="' + n + '" aria-pressed="' + (legs === n) + '">' + n + '</button>').join('');
  const winPresets = [10, 25, 50, 100, 250].map(w => '<button type="button" class="win-chip" data-win="' + w + '" aria-pressed="' + (win === w) + '">£' + w + '</button>').join('');
  return '<section class="builder" aria-labelledby="builder-title">' +
    '<div class="builder-top-bar">' +
      '<div><div class="builder-kicker">Bet Builder</div><h1 class="page-title" id="builder-title">Tell us the win. We’ll build the bet.</h1></div>' +
      '<div id="builder-panda-mood">' + accaVolatilityMarkup(builderResult && builderResult.slips && builderResult.slips[0], builderState.win) + '</div>' +
    '</div>' +
    '<p class="page-sub">Pick a stake, how many bets and how much you want to win. Bet Buddy searches every upcoming match for the combined bet (accumulator) that hits your target with the best chance of landing.</p>' +
    '<div class="builder-form"><div class="field"><label for="b-stake">Stake (£)</label><input id="b-stake" class="ctl mono" type="number" inputmode="decimal" min="0.5" max="10000" step="0.5" value="' + stake + '" data-b="stake"></div>'"""

new_view_builder = """function viewBuilder() {
  builderCompute();
  const { stake, legs, win, timing } = builderState;
  const curTiming = timing || 'today';
  const legChips = [2, 3, 4, 5, 6, 8].map(n => '<button type="button" class="legpick" data-legs="' + n + '" aria-pressed="' + (legs === n) + '">' + n + '</button>').join('');
  const winPresets = [10, 25, 50, 100, 250].map(w => '<button type="button" class="win-chip" data-win="' + w + '" aria-pressed="' + (win === w) + '">£' + w + '</button>').join('');

  const todayStr = new Date().toISOString().slice(0, 10);
  const allPreds = predictionsList();
  const todayMatchesCount = allPreds.filter(p => p.fixture && p.fixture.kickoff_utc && p.fixture.kickoff_utc.slice(0, 10) === todayStr).length;
  const upcomingMatchesCount = allPreds.filter(p => kickoffMs(p.fixture) > Date.now()).length;

  const scopeToggle = '<div class="builder-scope-bar">' +
    '<div class="scope-header">' +
      '<span class="scope-icon">⚡</span>' +
      '<span class="scope-title">Match Schedule (Obvious Choice)</span>' +
      '<span class="scope-hint">Tap to switch when your acca settles</span>' +
    '</div>' +
    '<div class="scope-pills" role="radiogroup" aria-label="Acca Match Schedule">' +
      '<button type="button" class="scope-pill' + (curTiming === 'today' ? ' active' : '') + '" data-timing="today" role="radio" aria-checked="' + (curTiming === 'today') + '">' +
        '<div class="scope-pill-top">' +
          '<span class="scope-badge today">⚡ SETTLE TONIGHT</span>' +
          '<span class="scope-count">' + todayMatchesCount + ' matches</span>' +
        '</div>' +
        '<div class="scope-pill-name">Today\\'s Games Only</div>' +
        '<div class="scope-pill-desc">Only picks games playing today (all legs settle tonight)</div>' +
      '</button>' +
      '<button type="button" class="scope-pill' + (curTiming === 'all' ? ' active' : '') + '" data-timing="all" role="radio" aria-checked="' + (curTiming === 'all') + '">' +
        '<div class="scope-pill-top">' +
          '<span class="scope-badge all">📅 FULL SLATE</span>' +
          '<span class="scope-count">' + (upcomingMatchesCount || allPreds.length) + ' matches</span>' +
        '</div>' +
        '<div class="scope-pill-name">Next 7 Days (Weekend Slips)</div>' +
        '<div class="scope-pill-desc">Searches full week across all upcoming weekend rounds</div>' +
      '</button>' +
    '</div>' +
  '</div>';

  return '<section class="builder" aria-labelledby="builder-title">' +
    '<div class="builder-top-bar">' +
      '<div><div class="builder-kicker">Bet Builder</div><h1 class="page-title" id="builder-title">Tell us the win. We’ll build the bet.</h1></div>' +
      '<div id="builder-panda-mood">' + accaVolatilityMarkup(builderResult && builderResult.slips && builderResult.slips[0], builderState.win) + '</div>' +
    '</div>' +
    '<p class="page-sub">Pick a stake, how many bets and how much you want to win. Bet Buddy searches every upcoming match for the combined bet (accumulator) that hits your target with the best chance of landing.</p>' +
    scopeToggle +
    '<div class="builder-form"><div class="field"><label for="b-stake">Stake (£)</label><input id="b-stake" class="ctl mono" type="number" inputmode="decimal" min="0.5" max="10000" step="0.5" value="' + stake + '" data-b="stake"></div>'"""

if old_view_builder in code:
    code = code.replace(old_view_builder, new_view_builder)
else:
    old_view_builder_crlf = old_view_builder.replace('\n', '\r\n')
    new_view_builder_crlf = new_view_builder.replace('\n', '\r\n')
    if old_view_builder_crlf in code:
        code = code.replace(old_view_builder_crlf, new_view_builder_crlf)
    else:
        print("Warning: old_view_builder not matched directly")

# 5. Update builderOutput for error helper & slipCard today badge
old_out = """  if (r.error) return customHtml + need + '<div class="empty" style="margin-top:12px">' + esc(r.error) + '</div>';"""
new_out = """  if (r.error) {
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
  }"""

if old_out in code:
    code = code.replace(old_out, new_out)
else:
    old_out_crlf = old_out.replace('\n', '\r\n')
    new_out_crlf = new_out.replace('\n', '\r\n')
    if old_out_crlf in code:
        code = code.replace(old_out_crlf, new_out_crlf)
    else:
        print("Warning: old_out not matched directly")

# 6. Update slipCard with today's badge
old_slip_card = """  return '<article class="slip' + (primary ? ' primary' : '') + '"><div class="slip-head"><div><div class="slip-kicker">' + (primary ? 'Best match for your target' : 'Alternative ' + idx) + '</div>'"""
new_slip_card = """  const isTodayAcca = builderState.timing === 'today';
  const todayBadge = isTodayAcca ? '<div class="today-slip-pill">⚡ TODAY\\'S GAMES ONLY &bull; ALL LEGS SETTLE TONIGHT</div>' : '';
  return '<article class="slip' + (primary ? ' primary' : '') + '">' + todayBadge + '<div class="slip-head"><div><div class="slip-kicker">' + (primary ? 'Best match for your target' : 'Alternative ' + idx) + '</div>'"""

if old_slip_card in code:
    code = code.replace(old_slip_card, new_slip_card)
else:
    old_slip_card_crlf = old_slip_card.replace('\n', '\r\n')
    new_slip_card_crlf = new_slip_card.replace('\n', '\r\n')
    if old_slip_card_crlf in code:
        code = code.replace(old_slip_card_crlf, new_slip_card_crlf)
    else:
        print("Warning: old_slip_card not matched directly")

# 7. Add click handler delegation for data-timing
old_click = """  else if (t.dataset.legs) setBuilderLegs(+t.dataset.legs);"""
new_click = """  else if (t.closest('[data-timing]')) {
    const timingBtn = t.closest('[data-timing]');
    setBuilderTiming(timingBtn.dataset.timing);
  }
  else if (t.dataset.legs) setBuilderLegs(+t.dataset.legs);"""

if old_click in code:
    code = code.replace(old_click, new_click)
else:
    old_click_crlf = old_click.replace('\n', '\r\n')
    new_click_crlf = new_click.replace('\n', '\r\n')
    if old_click_crlf in code:
        code = code.replace(old_click_crlf, new_click_crlf)
    else:
        print("Warning: old_click not matched directly")

# 8. Clean up any remaining panda emoji in sharedBanner
code = code.replace('<span style="font-size:20px">🐼</span>', '<span style="font-size:20px">🎯</span>')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Finished applying Today's Games Only updates to app.js")

