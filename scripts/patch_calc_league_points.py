with open('market_calculations.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = 'function calculateBetProfit(stake, decimalOdds, outcome) {'
func_code = '''  /**
   * Option A League Scoring Formula:
   * Winning bet: Points = (Decimal Odds - 1) * 10
   * Losing bet: -2 points (modest penalty to discourage blind longshot spamming)
   * Void bet: 0 points
   */
  function calculateLeaguePoints(odds, outcome) {
    const status = (outcome || '').toLowerCase().trim();
    if (status === 'void' || !status) return 0;
    if (status === 'lost') return -2;
    if (status === 'won') {
      let dec = null;
      if (typeof odds === 'number' && Number.isFinite(odds)) {
        dec = odds;
      } else if (typeof odds === 'string') {
        dec = parseOdds(odds) ?? parseFractionalOdds(odds);
        if (dec === null && !isNaN(+odds) && +odds > 1) dec = +odds;
      }
      if (dec === null || dec < 1.0) dec = 2.0;
      return Math.round((dec - 1) * 10);
    }
    return 0;
  }

  '''

assert target in text, 'target not found'
text = text.replace(target, func_code + target, 1)

export_target = 'calculateBetProfit,'
assert export_target in text, 'export_target not found'
text = text.replace(export_target, 'calculateBetProfit,\n    calculateLeaguePoints,', 1)

with open('market_calculations.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(text)

print('Added calculateLeaguePoints to market_calculations.js')

