# Mission 065: Most Likely against the match-result favourite

Research only. No frozen model, ledger or production prediction was changed.
Reproduce: `.venv/Scripts/python -W ignore -I experiments/m065_most_likely_backtest/backtest.py` (about one minute; writes `results.json` and `decisions.csv`).

## Verdict

**Most Likely lands more often than the match-result favourite, but that is because it picks likelier events, not because it sees more.** Its hit rate is 56.7% against 47.2% (paired difference +9.5 points, 95% CI [+2.7, +16.2]), yet it hit almost exactly as often as the league base rate of the selections it chose (57.5%). The match-result favourite is the only strategy here with a demonstrated edge over base rate (+8.6 points). Treat Most Likely as "the safest-looking call", not as skill. The app already says this ("Likely does not mean good value").

## Protocol

- Fixtures: the 409 Mission 063 walk-forward test matches (15 Aug 2025 to 18 Oct 2026), the same eligibility set the frozen models are scored on. Every probability in `predictions.csv` was produced from matches strictly before its date.
- Most Likely is **reconstructed** with the production rule (`pipeline/recommend.py`): rank every candidate by the lower 90% bound of its credible chance. Candidates are the frozen Dixon-Coles top pick and both sides of Over/Under 2.5 goals, 9.5 corners, 3.5 cards, 8.5 shots on target and BTTS, using the 30% model / 70% league blend that production uses for those markets.
- **No future-data leakage.** For a match on day D, all of these use only matches before D: the league base rates (blend and shrink reference), the calibration-band hit rate for the result pick (a band needs at least 20 earlier picks, otherwise the pick is ineligible), and the sample size behind the lower bound. The first 30 matches are skipped for lack of history, so 409 matches are scored.
- Results come from `data/matches.json`. A selection with missing match statistics is excluded from that strategy's tally, not guessed.
- Uncertainty: Wilson 95% intervals for hit rates; paired bootstrap over match days (2,000 resamples, seed 65) for differences.
- "Edge over base" is the hit rate minus the average league base rate of the selections chosen. It is the fair test of skill, because a strategy that picks 58% events will hit more often than one that picks 48% events without knowing anything.

## Results (n = 409)

| Strategy | Hit rate [95% CI] | Mean claimed chance | Base rate of what it picks | Edge over base | Brier of the claim |
|---|---|---|---|---|---|
| Match-result favourite (frozen Dixon-Coles) | 47.2% [42.4, 52.0] | 48.7% | 38.6% | **+8.6 pts** | 0.237 |
| **Most Likely (lower-90%-bound rule)** | **56.7% [51.9, 61.4]** | 58.1% | 57.5% | −0.8 pts | 0.245 |
| Highest raw probability, no evidence adjustment | 58.2% [53.4, 62.9] | 58.4% | 56.0% | +2.2 pts | 0.243 |
| Naive: most common selection in the league so far | 55.5% [50.7, 60.2] | 58.3% | 58.3% | −2.8 pts | 0.248 |
| Always back the home win | 41.1% [36.4, 45.9] | 42.0% | 42.0% | −1.0 pts | 0.242 |
| Bookmaker closing favourite (benchmark, not usable live) | 49.4% [44.6, 54.2] | 51.3% | n/a | n/a | 0.239 |

Paired differences in hit rate (first minus second, same matches):

| Comparison | Difference | 95% CI |
|---|---|---|
| Most Likely − match-result favourite | +9.5 pts | [+2.7, +16.2] |
| Most Likely − highest raw probability | −1.5 pts | [−4.0, +1.0] |
| Most Likely − naive league base rate | +1.2 pts | [−4.3, +6.6] |

Chronological stability (hit rate / mean claimed chance):

| Period | n | Favourite | Most Likely |
|---|---|---|---|
| 15 Aug to 20 Dec 2025 | 137 | 53.3% / 49.2% | 61.3% / 58.5% |
| 20 Dec 2025 to 16 Mar 2026 | 136 | 42.6% / 49.3% | 51.5% / 57.9% |
| 20 Mar to 18 Oct 2026 | 136 | 45.6% / 47.5% | 57.4% / 58.0% |

What Most Likely chose: corners over 9.5 (188 matches, 56.4% landed), cards over 3.5 (107, 58.9%), BTTS yes (89, 56.2%), goals over 2.5 (20, 45.0%) and shots on target under 8.5 (5, 80%). It **never chose the match-result favourite**: its calibrated chance, cut to the cautious end, never beat a 55% to 59% total-count selection. Live predictions show the same pattern.

## What this does and does not show

1. Most Likely is well calibrated at the level of the whole sample (claims 58.1%, lands 56.7%), and stable in every third of the season.
2. It adds **no demonstrated skill**. Its edge over base is −0.8 points, and the selections it favours (corners, cards, shots, goals totals) are the markets Mission 063 found no better than the league average. Its advantage over the favourite is the choice of an easier target, not better information.
3. The evidence adjustment did not help on this sample: ranking by raw probability alone hit 58.2% against 56.7% (difference −1.5 points, CI crosses zero). The lower-bound rule is retained because it is cautious by design and the difference is not significant, but this backtest does not prove it is better.
4. The match-result favourite is the more informative signal: its +8.6 point edge over base is the only one with a clear margin. It is correctly the validated, calibrated market.

## Limits

- **No prices, so no profit or loss.** The open data holds bookmaker consensus *probabilities* for match result, Over/Under 2.5 goals and BTTS, not bookable prices with their margin, and nothing at all for corners, cards or shots. Hit rates are therefore the only honest comparison, and nothing here says whether any strategy would have made money. The closing-favourite row is a benchmark of information, not something the app can offer, because closing prices are unknown beforehand.
- The corners, cards and shots outcomes come from football-data.co.uk statistics (personal and research terms). All 409 matches had them, so no selection was dropped.
- 409 matches is a small sample for differences of a few points. Only the +9.5 and +8.6 point gaps clear their intervals.
- The Top Six also ranks selections on lines the backtest never scored (for example Over 1.5 goals). They are labelled unsupported and rank last because there is no history to test them against here.
- Promoted-club (T2) behaviour is not covered: it rests on the 41-match Mission 064 evidence.
