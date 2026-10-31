"""Remove the hardcoded 4-sport synthetic acca injection in builderCompute in app.js
so that the user's selected 'legs' (number of teams) strictly and dynamically governs all 4 generated combination slips,
with the best-value combination always at the top."""

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''  // When non-football sports are active, synthesize a guaranteed Cross-Sport Mix Acca
  const otherActive = activeSports.filter(s => s !== 'football');
  if (builderResult && builderResult.slips && builderResult.slips.length > 0 && otherActive.length > 0 && multiSportPool.length > 0) {
    const hasOtherSport = builderResult.slips[0].legs.some(l => l.sport && l.sport !== 'football');
    if (!hasOtherSport) {
      // Pick top selection from each active non-football sport
      const crossLegs = [];
      otherActive.forEach(sk => {
        const best = multiSportPool.find(l => l.sport === sk && !crossLegs.some(c => c.matchId === l.matchId));
        if (best) crossLegs.push(best);
      });
      // Fill remaining legs from footballPool
      const remainingNeeded = Math.max(0, legs - crossLegs.length);
      for (const fb of footballPool) {
        if (crossLegs.length >= legs) break;
        if (!crossLegs.some(c => c.matchId === fb.matchId)) crossLegs.push(fb);
      }
      if (crossLegs.length === legs) {
        const odds = crossLegs.reduce((t, c) => t * c.odds, 1);
        const chance = crossLegs.reduce((t, c) => t * c.p, 1);
        const crossSlip = {
          legs: crossLegs,
          odds,
          chance,
          ret: stake * odds,
          profit: stake * odds - stake,
          ev: chance * stake * odds - stake,
          onTarget: true,
          estimated: crossLegs.some(c => c.priceSource !== 'live'),
          isCrossSportMix: true
        };
        // Insert as top recommendation!
        builderResult.slips.unshift(crossSlip);
        if (builderResult.slips.length > 4) builderResult.slips.pop();
      }
    }
  }'''

assert target in content, "Target block not found in app.js"
content = content.replace(target, '')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Successfully removed synthetic cross-sport unshift from builderCompute.')

