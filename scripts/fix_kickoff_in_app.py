import re

with open('app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

# 1. Update builderCompute
old_compute = """function builderCompute() {
  const { stake, legs, win } = builderState;
  const timing = builderState.timing || 'today';
  const footballPool = activeSports.includes('football')
    ? MatchIQBuilder.legPool(predictionsList(), { calc, reliability: DATA.reliability, feedFor, nowMs: Date.now(), timing })
    : [];"""

new_compute = """function builderCompute() {
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

if old_compute in app_js:
    app_js = app_js.replace(old_compute, new_compute)
    print("Updated builderCompute in app.js")
else:
    old_crlf = old_compute.replace('\n', '\r\n')
    new_crlf = new_compute.replace('\n', '\r\n')
    if old_crlf in app_js:
        app_js = app_js.replace(old_crlf, new_crlf)
        print("Updated builderCompute (CRLF) in app.js")
    else:
        print("Error: old_compute not found in app.js")

# 2. Update viewBuilder today count
old_counts = """  const todayStr = new Date().toISOString().slice(0, 10);
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
  '</div>';"""

new_counts = """  const now = Date.now();
  const todayStr = new Date(now).toISOString().slice(0, 10);
  const allPreds = predictionsList();
  const todayUpcomingCount = allPreds.filter(p => kickoffMs(p.fixture) > now && p.fixture && p.fixture.kickoff_utc && p.fixture.kickoff_utc.slice(0, 10) === todayStr).length;
  const upcomingMatchesCount = allPreds.filter(p => kickoffMs(p.fixture) > now).length;

  const todayCountLabel = todayUpcomingCount > 0 ? (todayUpcomingCount + ' matches remaining') : '0 remaining (in-play)';
  const todayDesc = todayUpcomingCount >= legs ? 'Only picks games playing today (settles tonight)' : (todayUpcomingCount > 0 ? ('Only ' + todayUpcomingCount + ' games left today') : 'All today\\'s games kicked off. Auto-showing weekend slate.');

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
          '<span class="scope-count">' + todayCountLabel + '</span>' +
        '</div>' +
        '<div class="scope-pill-name">Today\\'s Games Only</div>' +
        '<div class="scope-pill-desc">' + todayDesc + '</div>' +
      '</button>' +
      '<button type="button" class="scope-pill' + (curTiming === 'all' ? ' active' : '') + '" data-timing="all" role="radio" aria-checked="' + (curTiming === 'all') + '">' +
        '<div class="scope-pill-top">' +
          '<span class="scope-badge all">📅 FULL SLATE</span>' +
          '<span class="scope-count">' + upcomingMatchesCount + ' upcoming matches</span>' +
        '</div>' +
        '<div class="scope-pill-name">Next 7 Days (Weekend Slips)</div>' +
        '<div class="scope-pill-desc">Searches upcoming rounds kicking off tomorrow & across week</div>' +
      '</button>' +
    '</div>' +
  '</div>';"""

if old_counts in app_js:
    app_js = app_js.replace(old_counts, new_counts)
    print("Updated viewBuilder counts in app.js")
else:
    old_crlf = old_counts.replace('\n', '\r\n')
    new_crlf = new_counts.replace('\n', '\r\n')
    if old_crlf in app_js:
        app_js = app_js.replace(old_crlf, new_crlf)
        print("Updated viewBuilder counts (CRLF) in app.js")
    else:
        print("Error: old_counts not found in app.js")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_js)

print("Updated app.js with strict future kickoff checks")

