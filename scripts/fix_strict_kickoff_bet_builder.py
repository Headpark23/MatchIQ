with open('bet_builder.js', 'r', encoding='utf-8') as f:
    code = f.read()

old_loop = """    for (const pred of preds) {
      const ko = Date.parse(pred.fixture.kickoff_utc);
      const koDateStr = pred.fixture.kickoff_utc ? pred.fixture.kickoff_utc.slice(0, 10) : '';
      if (timing === 'today') {
        if (koDateStr !== todayStr) continue;
        if (ko < nowMs - 4 * 3600000) continue;
      } else {
        if (!(ko > nowMs && ko - nowMs <= horizonMs)) continue;
      }"""

new_loop = """    for (const pred of preds) {
      const ko = Date.parse(pred.fixture.kickoff_utc);
      // HARD SAFETY RULE: Kickoff must be strictly in the future. Never pick kicked-off games!
      if (!Number.isFinite(ko) || ko <= nowMs) continue;

      const koDateStr = pred.fixture.kickoff_utc ? pred.fixture.kickoff_utc.slice(0, 10) : '';
      if (timing === 'today') {
        if (koDateStr !== todayStr) continue;
      } else {
        if (ko - nowMs > horizonMs) continue;
      }"""

if old_loop in code:
    code = code.replace(old_loop, new_loop)
    print("Replaced old loop in bet_builder.js")
else:
    old_crlf = old_loop.replace('\n', '\r\n')
    new_crlf = new_loop.replace('\n', '\r\n')
    if old_crlf in code:
        code = code.replace(old_crlf, new_crlf)
        print("Replaced old loop (CRLF) in bet_builder.js")
    else:
        print("Error: old_loop not matched in bet_builder.js")

with open('bet_builder.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated bet_builder.js with strict future kickoff check")
