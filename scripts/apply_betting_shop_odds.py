import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent

# 1. Update market_calculations.js
calc_path = root / 'market_calculations.js'
calc_src = calc_path.read_text(encoding='utf-8')

old_fn = """  function formatFractionalOdds(decimalOdds) {
    const odds = number(decimalOdds);
    if (odds === null || odds <= 1) return '—';

    // Preserve familiar UK display conventions, including the commonly quoted 6/4.
    const canonical = [
      [1.5, '1/2'], [1.8, '4/5'], [2, 'Evens (1/1)'],
      [2.5, '6/4'], [3, '2/1'], [4.5, '7/2']
    ];
    const known = canonical.find(([price]) => Math.abs(odds - price) < 1e-10);
    if (known) return known[1];

    const profit = odds - 1;
    let bestNumerator = 1, bestDenominator = 1, bestError = Infinity;
    for (let denominator = 1; denominator <= 20; denominator++) {
      const numerator = Math.max(1, Math.round(profit * denominator));
      const error = Math.abs(numerator / denominator - profit);
      if (error < bestError || (error === bestError && denominator < bestDenominator)) {
        bestNumerator = numerator;
        bestDenominator = denominator;
        bestError = error;
      }
    }
    function gcd(a, b) { return b ? gcd(b, a % b) : a; }
    const divisor = gcd(bestNumerator, bestDenominator);
    const fraction = `${bestNumerator / divisor}/${bestDenominator / divisor}`;
    return bestError > 1e-10 ? `≈${fraction}` : fraction;
  }"""

new_fn = """  // Standard UK betting shop price ladder. Traditional UK bookmakers lay only these familiar fractions.
  const UK_BETTING_PRICES = Object.freeze([
    // Odds-on
    [1 + 1/100, '1/100'], [1 + 1/50, '1/50'], [1 + 1/33, '1/33'], [1 + 1/25, '1/25'],
    [1 + 1/20, '1/20'], [1 + 1/16, '1/16'], [1 + 1/14, '1/14'], [1 + 1/12, '1/12'],
    [1 + 1/10, '1/10'], [1 + 1/9, '1/9'], [1 + 1/8, '1/8'], [1 + 1/7, '1/7'],
    [1 + 1/6, '1/6'], [1 + 1/5, '1/5'], [1 + 2/9, '2/9'], [1 + 1/4, '1/4'],
    [1 + 2/7, '2/7'], [1 + 3/10, '3/10'], [1 + 1/3, '1/3'], [1 + 4/11, '4/11'],
    [1 + 2/5, '2/5'], [1 + 4/9, '4/9'], [1 + 1/2, '1/2'], [1 + 8/15, '8/15'],
    [1 + 4/7, '4/7'], [1 + 8/13, '8/13'], [1 + 4/6, '4/6'], [1 + 8/11, '8/11'],
    [1 + 4/5, '4/5'], [1 + 5/6, '5/6'], [1 + 10/11, '10/11'],
    // Evens
    [2, 'Evens (1/1)'],
    // Low odds-against
    [1 + 11/10, '11/10'], [1 + 6/5, '6/5'], [1 + 5/4, '5/4'], [1 + 11/8, '11/8'],
    [1 + 6/4, '6/4'], [1 + 13/8, '13/8'], [1 + 7/4, '7/4'], [1 + 15/8, '15/8'],
    [1 + 2/1, '2/1'], [1 + 11/5, '11/5'], [1 + 9/4, '9/4'], [1 + 12/5, '12/5'],
    [1 + 5/2, '5/2'], [1 + 13/5, '13/5'], [1 + 11/4, '11/4'], [1 + 14/5, '14/5'],
    [1 + 3/1, '3/1'], [1 + 100/30, '100/30'], [1 + 7/2, '7/2'],
    [1 + 4/1, '4/1'], [1 + 9/2, '9/2'], [1 + 5/1, '5/1'], [1 + 11/2, '11/2'],
    [1 + 6/1, '6/1'], [1 + 13/2, '13/2'], [1 + 7/1, '7/1'], [1 + 15/2, '15/2'],
    [1 + 8/1, '8/1'], [1 + 17/2, '17/2'], [1 + 9/1, '9/1'], [1 + 19/2, '19/2'],
    [1 + 10/1, '10/1'], [1 + 11/1, '11/1'], [1 + 12/1, '12/1'], [1 + 14/1, '14/1'],
    [1 + 16/1, '16/1'], [1 + 18/1, '18/1'], [1 + 20/1, '20/1'], [1 + 22/1, '22/1'],
    [1 + 25/1, '25/1'], [1 + 28/1, '28/1'], [1 + 33/1, '33/1'], [1 + 40/1, '40/1'],
    [1 + 50/1, '50/1'], [1 + 66/1, '66/1'], [1 + 80/1, '80/1'], [1 + 100/1, '100/1'],
    [1 + 125/1, '125/1'], [1 + 150/1, '150/1'], [1 + 200/1, '200/1'], [1 + 250/1, '250/1'],
    [1 + 300/1, '300/1'], [1 + 400/1, '400/1'], [1 + 500/1, '500/1'], [1 + 1000/1, '1000/1']
  ]);

  function formatFractionalOdds(decimalOdds) {
    const odds = number(decimalOdds);
    if (odds === null || odds <= 1) return '—';

    // 1. Exact match check against standard canonical betting shop prices
    for (const [price, label] of UK_BETTING_PRICES) {
      if (Math.abs(odds - price) < 1e-5) return label;
    }

    // 2. High-odds accumulators (profit >= 200)
    const profit = odds - 1;
    if (profit >= 200) {
      const rounded = Math.round(profit);
      const isExact = Math.abs(profit - rounded) < 1e-4;
      return (isExact ? '' : '≈') + `${rounded}/1`;
    }

    // 3. Snap to nearest familiar UK betting shop price
    let bestLabel = 'Evens (1/1)', bestGap = Infinity;
    for (const [price, label] of UK_BETTING_PRICES) {
      const gap = Math.abs(odds - price);
      if (gap < bestGap) {
        bestGap = gap;
        bestLabel = label;
      }
    }

    const isExact = bestGap < 1e-5;
    return isExact ? bestLabel : `≈${bestLabel}`;
  }"""

assert old_fn in calc_src, "old_fn not found in market_calculations.js"
calc_src = calc_src.replace(old_fn, new_fn)
calc_path.write_text(calc_src, encoding='utf-8')
print("market_calculations.js updated.")

# 2. Update test_bet_diary.js
test_path = root / 'tests' / 'test_bet_diary.js'
test_src = test_path.read_text(encoding='utf-8')
old_test = "assert.equal(calc.formatFractionalOdds(3.1897), '≈35/16');"
new_test = "assert.equal(calc.formatFractionalOdds(3.1897), '≈11/5'); // Snaps to standard UK betting shop price ladder instead of 35/16 or 75/17"
assert old_test in test_src, "old_test not found in test_bet_diary.js"
test_src = test_src.replace(old_test, new_test)
test_path.write_text(test_src, encoding='utf-8')
print("test_bet_diary.js updated.")

