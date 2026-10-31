"""Patch app.js and bet_builder.js to:
1. Ensure buildSlips takes maxSlips = 4 (default 4 options).
2. Label "Number of bets in accumulator (e.g. 2 = 2 teams, 3 = 3 teams, 4 = 4 teams)".
3. When user changes number of bets (chip or input), immediately recalculate and display options.
4. Sort slips by Expected Value (EV) descending so Best Value is always at the top with a clear badge.
"""

def patch_bet_builder():
    with open('bet_builder.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # Change maxSlips default from 3 to 4
    content = content.replace('function buildSlips(pool, { stake, win, legs, maxSlips = 3 }) {',
                              'function buildSlips(pool, { stake, win, legs, maxSlips = 4 }) {')

    with open('bet_builder.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print('bet_builder.js patched')

def patch_app_js():
    with open('app.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update builderCompute to pass maxSlips: 4 and sort by EV
    old_call = 'builderResult = MatchIQBuilder.buildSlips(combinedPool, { stake, win, legs });'
    new_call = '''builderResult = MatchIQBuilder.buildSlips(combinedPool, { stake, win, legs, maxSlips: 4 });
  // Always sort slips by Expected Value (EV) descending so the Best Value combination is noted and at the top
  if (builderResult && builderResult.slips && builderResult.slips.length > 0) {
    builderResult.slips.sort((a, b) => (b.ev != null ? b.ev : 0) - (a.ev != null ? a.ev : 0));
  }'''
    assert old_call in content, "old_call not found in app.js"
    content = content.replace(old_call, new_call, 1)

    # 2. Update cross-sport mix pop limit to 4 if more than 4
    content = content.replace('if (builderResult.slips.length > 3) builderResult.slips.pop();',
                              'if (builderResult.slips.length > 4) builderResult.slips.pop();')

    # 3. Clarify Number of bets label in viewBuilder
    old_lbl = '<span class="lbl" id="b-legs-l">Number of bets</span><div class="legpicks" role="group" aria-labelledby="b-legs-l">'
    new_lbl = '<span class="lbl" id="b-legs-l">Number of bets in accumulator <small style="color:var(--soft);font-weight:normal;">(2 = 2-team acca, 3 = 3 teams, 4 = 4 teams...)</small></span><div class="legpicks" role="group" aria-labelledby="b-legs-l">'
    assert old_lbl in content, "old_lbl not found in app.js"
    content = content.replace(old_lbl, new_lbl, 1)

    # 4. Clarify slipCard kicker with Best Value badge for top slip
    old_kicker = "'<div class=\"slip-head\"><div><div class=\"slip-kicker\">' + (primary ? 'Best match for your target' : 'Alternative ' + idx) + ' ' + jargonTip('acca') + '</div>' +"
    new_kicker = "'<div class=\"slip-head\"><div><div class=\"slip-kicker\">' + (primary ? '💎 Best Value &amp; Target Match' : 'Option ' + (idx + 1) + ' Combination') + ' ' + jargonTip('acca') + '</div>' +"
    assert old_kicker in content, "old_kicker not found in app.js"
    content = content.replace(old_kicker, new_kicker, 1)

    # 5. Ensure immediate recalculation when legs change in onBuilderInput
    old_input = "else if (t.dataset.b === 'legs') { builderState.legs = Math.max(1, Math.min(MatchIQBuilder.MAX_LEGS, Math.round(v))); markLegChips(); }"
    new_input = "else if (t.dataset.b === 'legs') { builderState.legs = Math.max(1, Math.min(MatchIQBuilder.MAX_LEGS, Math.round(v))); markLegChips(); updateBuilder(); return; }"
    assert old_input in content, "old_input not found in app.js"
    content = content.replace(old_input, new_input, 1)

    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print('app.js patched')

if __name__ == '__main__':
    patch_bet_builder()
    patch_app_js()
