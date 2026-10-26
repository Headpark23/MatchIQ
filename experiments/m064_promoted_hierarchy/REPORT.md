# Mission 064: match-result hierarchy for promoted clubs

**Problem.** The frozen Dixon-Coles model needs at least 5 prior Premier League home games for the home side and 5 away games for the away side. Promoted clubs fail that rule for their first weeks, so their fixtures had no prediction at all.

**Test set.** All 41 Premier League matches in 2025/26 and 2026/27 (to 19 Oct 2026) where the frozen model was ineligible on the day. That covers Burnley, Leeds and Sunderland (2025/26), and Coventry and Hull (2026/27). Each match day is predicted from results strictly before that day by `pipeline.models.Context`, the exact code the app ships. Run with `python -I experiments/m064_promoted_hierarchy/backtest.py`.

| Candidate | n | Brier | Log loss | RPS | ΔBrier vs league [95% CI] |
|---|---|---|---|---|---|
| Bookmaker closing prices (benchmark only) | 40 | 0.592 | 0.998 | 0.212 | −0.041 [−0.126, +0.056] |
| **Shipped T2: pooled PL+Championship DC, shrunk 50% to league** | 41 | **0.629** | 1.044 | 0.228 | −0.001 [−0.050, +0.048] |
| League average frequencies (T3) | 41 | 0.630 | 1.046 | 0.229 | reference |
| Pooled PL+Championship DC, unshrunk | 41 | 0.667 | 1.103 | 0.246 | +0.037 [−0.058, +0.138] |
| Promoted-club frequency prior | 38 | 0.746 | 1.255 | 0.280 | +0.112 [−0.037, +0.259] |

**Reading.**
- **The unshrunk pooled model under-rates promoted clubs.** It gave them a 23% chance to win on average; they actually won 32% of these games.
- **The 50% shrink removes that damage but adds no proven edge.** That is why T2 is labelled *provisional, weak evidence* in the app.
- **The sample is small** (41 matches), so the confidence intervals are wide.
- **Disclosure:** two shrink weights (0.5 and 0.3) were tried on these 41 matches. 0.5 was chosen as the more conservative one, before any wider validation; 0.3 scored 0.625.

**Hierarchy shipped** (`pipeline/models.py`):
1. **T1:** frozen Dixon-Coles v1, unchanged, validated.
2. **T2:** pooled Dixon-Coles, shrunk 50%, provisional.
3. **T3:** league averages, limited evidence.

No tier uses bookmaker odds. No free bookmaker source with clear reuse rights exists, so market estimates are not shown.

**Other markets.** A pre-registered blend (30% model, 70% league rate) was scored on the Mission 063 test set (409 matches). For every market, its ΔBrier against the league rate sits within ±0.003, with confidence intervals spanning zero. The app labels these markets *provisional, no proven edge* rather than hiding them or overstating them.

**Improvement cycle.** `dc-decay-epl-v1-shadow` (Mission 063's best simple challenger) is recorded before kick-off in `data/shadow_history.json` and never displayed. `pipeline.history.compare_challenger` recommends owner review only after at least 150 paired settled matches with a 95% CI below zero.
