with open('app.js', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Update shareLeague handler
old_share_league = """  else if (t.dataset.shareLeague !== undefined) {
    const code = t.dataset.shareLeague;
    const isGithub = window.location.origin.includes('github.io');
    const baseUrl = isGithub ? 'https://headpark23.github.io/MatchIQ/' : 'https://betbuddyuk.uk/';
    const shareUrl = baseUrl + '#join-league=' + encodeURIComponent(code);
    const altUrl = isGithub ? 'https://betbuddyuk.uk/#join-league=' + encodeURIComponent(code) : 'https://headpark23.github.io/MatchIQ/#join-league=' + encodeURIComponent(code);
    const text = '🏆 Join my Bet Buddy League! Code: ' + code + '\\nJoin: ' + shareUrl + '\\n(Unfiltered WiFi link: ' + altUrl + ')\\nCompete with friends!';
    openUniversalShare({
      title: 'Join my Bet Buddy League (' + code + ')',
      text,
      url: shareUrl
    });
  }"""

new_share_league = """  else if (t.dataset.shareLeague !== undefined) {
    const code = t.dataset.shareLeague;
    const shareUrl = 'https://betbuddyuk.uk/#join-league=' + encodeURIComponent(code);
    const text = '🏆 Join my Bet Buddy League (Code: ' + code + ')';
    openUniversalShare({
      title: 'Join my Bet Buddy League (' + code + ')',
      text: text,
      url: shareUrl
    });
  }"""

if old_share_league in c:
    c = c.replace(old_share_league, new_share_league)
    print("Replaced shareLeague successfully.")
else:
    print("Marker old_share_league not found!")

# 2. Tighten newline in fullText inside openUniversalShare
old_fulltext = """  const fullText = currentSharePayload.text.includes(finalUrl)
    ? currentSharePayload.text
    : currentSharePayload.text + (finalUrl ? '\\n\\n' + finalUrl : '');"""

new_fulltext = """  const fullText = currentSharePayload.text.includes(finalUrl)
    ? currentSharePayload.text
    : currentSharePayload.text + (finalUrl ? '\\n' + finalUrl : '');"""

if old_fulltext in c:
    c = c.replace(old_fulltext, new_fulltext)
    print("Replaced fullText spacing successfully.")
else:
    print("Marker old_fulltext not found!")

# 3. Clean up shareAccaSlip
old_slip = """  const text = [
    '🎯 Bet Buddy Acca (Target: ' + m(slip.profit) + ' profit)',
    'Odds: ' + fmtOdds(slip.odds) + ' · Estimated Chance: ' + Math.round(slip.chance * 100) + '%',
    'Stake: ' + m(stake) + ' · Potential Return: ' + m(slip.ret),
    '',
    'Review selection: ' + shareUrl,
    '',
    'Track bets & compare live odds across major bookies with Bet Buddy UK.'
  ].join('\\n');"""

new_slip = """  const text = '🎯 Bet Buddy Acca (' + fmtOdds(slip.odds) + ' · ' + m(stake) + ' returns ' + m(slip.ret) + ')';"""

if old_slip in c:
    c = c.replace(old_slip, new_slip)
    print("Replaced slip text successfully.")
else:
    print("Marker old_slip not found!")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(c)

print("Finished updating clean share links.")
