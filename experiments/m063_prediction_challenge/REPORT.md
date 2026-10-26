# Mission 063: Prediction challenge and open-source model review

Research only. No frozen model, ledger or production prediction was changed.

## Verdict

**No challenger beat the frozen production models with statistical support. Retain Dixon-Coles v1 (Match Winner) and Poisson v0.9 (Corners).**

What the backtest did establish:

- The frozen Dixon-Coles 1X2 model has real skill. Its Brier score is 0.6217 against 0.6598 for the league base rate (ΔBrier −0.038, 95% CI [−0.061, −0.015]), and it is reasonably calibrated in the 50–70% range. Bookmaker closing prices are better still (0.6091), which is expected.
- The frozen corners model and the rolling-10 goals, BTTS, cards and shots-on-target estimates shown in the app have **no skill over the league base rate**. Corners and Over 2.5 are significantly *worse* than predicting the league average. The interface now says so and keeps these markets out of the ranking.
- The README-style gradient-boosting approach (`Y0SRIBH/soccer-predictor`) was reproduced on our data. It performed significantly **worse** than the frozen DC model (ΔBrier +0.022, CI [+0.003, +0.041]).
- The most promising 1X2 direction is time-decay Dixon-Coles combined with a shots-on-target goals proxy (`ens_dc_xg`: ΔBrier −0.0039, CI [−0.0089, +0.0014]). This is not significant on 409 matches, so it is a candidate for a prospective shadow ledger, not a replacement.

## Protocol

- Data: `data/matches.json` (830 Premier League matches, 2024/25 to 19 Oct 2026) for results and match statistics. The closing-odds benchmark uses `experiments/raw_market_data/` (CC-BY-4.0, HuggingFace `minmaxxxer`) and covered all 409 test fixtures.
- Walk-forward: every match on day D is predicted from matches played strictly before D. Models are refitted each match day. 2024/25 is burn-in only. The test window is 15 Aug 2025 to 18 Oct 2026, n = 409.
- Identical fixtures: the test set is the frozen models' own eligibility set (at least 5 prior home matches for the home side and 5 prior away matches for the away side). Every model is scored on the same 409 fixtures.
- Pre-registered settings, fixed before any result was seen: time decay ξ = 0.0018/day (penaltyblog default), GLM ridge α = 0.01, goals/shot-proxy blend 0.5 (as in `callumfm/dixon-coles`), Elo k = 20 with home advantage 60. Nothing was tuned on the test window.
- Uncertainty: paired block bootstrap over match days (2,000 resamples, seed 63). A challenger "wins" only if ΔBrier < 0 and its 95% CI excludes 0.
- Replica check: the `dc_frozen` and `rolling10` corners baselines reproduce `data/match_winner_forward.json` and `data/forward_test.json` exactly for fixtures predicted with the same training cut-off.

Reproduce with:

```
python -m venv .venv-m063 && .venv-m063/Scripts/pip install -r experiments/m063_prediction_challenge/requirements.txt
.venv-m063/Scripts/python -I experiments/m063_prediction_challenge/challenge.py
python -I experiments/m063_prediction_challenge/export_reliability.py
```

## Results (n = 409, lower is better; Δ is challenger − baseline)

### Match result (1X2): baseline `dc_frozen`

| Model | Brier | Log loss | RPS | ECE (top pick) | ΔBrier [95% CI] |
|---|---|---|---|---|---|
| market_close (benchmark, not usable live) | 0.6091 | 1.0135 | 0.2029 | 0.025 | −0.0126 [−0.0250, +0.0003] |
| ens_dc_xg (DC-decay + shot-proxy GLM) | 0.6178 | 1.0302 | 0.2074 | 0.062 | −0.0039 [−0.0089, +0.0014] |
| xg_glm (goals/SoT blend, decay) | 0.6187 | 1.0321 | 0.2075 | 0.039 | −0.0030 [−0.0118, +0.0060] |
| dc_decay (DC + time decay) | 0.6194 | 1.0320 | 0.2083 | 0.044 | −0.0023 [−0.0056, +0.0009] |
| ens_dc_elo | 0.6199 | 1.0315 | 0.2084 | 0.048 | −0.0018 [−0.0096, +0.0060] |
| bp_decay (bivariate Poisson) | 0.6203 | 1.0334 | 0.2084 | 0.038 | −0.0014 [−0.0056, +0.0027] |
| **dc_frozen (production)** | **0.6217** | **1.0358** | **0.2095** | 0.045 | baseline |
| pi_logit (pi-ratings) | 0.6248 | 1.0392 | 0.2107 | 0.048 | +0.0031 [−0.0106, +0.0172] |
| elo_logit | 0.6258 | 1.0411 | 0.2108 | 0.056 | +0.0041 [−0.0091, +0.0180] |
| logit_features | 0.6341 | 1.0711 | 0.2136 | 0.063 | +0.0124 [−0.0055, +0.0314] |
| hgb_features (calibrated gradient boosting) | 0.6438 | 1.0680 | 0.2192 | 0.022 | +0.0221 [+0.0029, +0.0407] |
| base_rate | 0.6598 | 1.0890 | 0.2283 | 0.010 | +0.0381 [+0.0146, +0.0611] |

Frozen DC calibration by confidence range of its top pick:

| Predicted | n | Mean predicted | Observed |
|---|---|---|---|
| 0–40% | 83 | 37.7% | 38.6% |
| 40–50% | 170 | 44.6% | 37.6% |
| 50–60% | 104 | 55.0% | 59.6% |
| 60–70% | 37 | 63.5% | 62.2% |
| 70–80% | 13 | 74.1% | 76.9% (limited evidence) |
| 80–100% | 2 | 83.1% | 100% (limited evidence) |

By season (Brier): 2025/26 0.6248 (n = 352), 2026/27 0.6028 (n = 57). Only the Premier League is available, so no by-league breakdown is possible.

### Binary markets (ΔBrier vs the rolling-10 method currently displayed)

| Market | Displayed method | League base rate | Best challenger | Market close |
|---|---|---|---|---|
| Over 2.5 goals | 0.2587 | **0.2478** (−0.0110 [−0.0189, −0.0033]) | xg_glm 0.2500 (−0.0088 [−0.0158, −0.0020]) | 0.2445 |
| BTTS | 0.2485 | 0.2460 (−0.0025 [−0.0092, +0.0044]) | xg_glm 0.2452 (−0.0033 [−0.0096, +0.0028]) | 0.2432 |
| Corners O9.5 (frozen v0.9) | 0.2579 | **0.2470** (−0.0109 [−0.0213, −0.0006]) | team_glm_nb 0.2552 (−0.0028, n.s.) | n/a |
| Yellow cards O3.5 | 0.2457 | 0.2452 (n.s.) | none better | n/a |
| Shots on target O8.5 | 0.2566 | 0.2522 (n.s.) | team_glm 0.2551 (n.s.) | n/a |

The shot-proxy GLM improves Over 2.5 relative to the displayed method, but it does not beat the plain league base rate. So it is not an improvement worth shipping. This matches AG-030: historical goal counts carry almost no match-level signal for totals.

Frozen corners top-pick calibration: picks rated 50–60% landed 49.6% (n = 266), and picks rated 60–70% landed 52.3% (n = 130). The model is systematically over-confident.

## Open-source candidates

| Repository | Licence | What it predicts / how | Evidence | MatchIQ equivalent | Recommendation |
|---|---|---|---|---|---|
| [martineastwood/penaltyblog](https://github.com/martineastwood/penaltyblog) | MIT, 244★, active (Oct 2026) | Dixon-Coles, Poisson, bivariate Poisson, negative binomial, zero-inflated, Weibull copula and Bayesian goal models. Elo, pi, Massey and Colley ratings. RPS and Brier metrics, de-vigging. | Library, no accuracy claim. Its models were the strongest challengers here. | Already the frozen model's engine | **Keep as the single modelling dependency.** Use its time-decay weights in any future challenger. |
| [callumfm/dixon-coles](https://github.com/callumfm/dixon-coles) | MIT, 2★ | DC with time decay, shrinkage and a 50/50 goals/xG target | Claims RPS 0.205 on 2024/25 and a "1–2% RPS" gain from xG. Not reproducible directly: it needs its own xG data. The *approach* (decay plus shot-proxy blend) was tested as `xg_glm`/`ens_dc_xg`: small, non-significant gain. | Partly (`ens_dc_xg` research) | Borrow the idea, not the code. Its xG comes from vaastav/FPL and Understat, whose reuse terms need checking before any production use. |
| [Hicruben/theopenmodel](https://github.com/Hicruben/theopenmodel) | MIT code, CC-BY-4.0 forecasts, 1★ | ClubElo → expected goals → DC (ρ = −0.13) → Monte Carlo | Walk-forward RPS 0.175 on *internationals*, which is not comparable with club 1X2. Daily committed snapshots are a good pattern. | Elo path tested (`elo_logit`): worse than DC | Adopt its "commit predictions before kick-off" receipts idea (MatchIQ already does this). Do not adopt the model. |
| [Y0SRIBH/soccer-predictor](https://github.com/Y0SRIBH/soccer-predictor) | MIT, 0★ | Elo, rolling form and H2H into a calibrated HistGradientBoosting classifier | Claims log loss 1.011 vs bookmaker 0.994 on six leagues. Re-implemented on our data: log loss 1.068, significantly worse than DC. Uses football-data.co.uk bulk downloads. | `hgb_features` | **Reject.** With roughly 800 training matches, ML on rolling form overfits. |
| [probberechts/soccerdata](https://github.com/probberechts/soccerdata) | Apache-2.0, 2.1k★ | Scrapers for FBref, Understat, ClubElo, Sofascore, football-data and others | Data tool, not a model | none | Do not use in production. Each source's terms of use apply, and several forbid scraping or commercial reuse. The library licence does not grant data rights. |
| [opisthokonta/goalmodel](https://github.com/opisthokonta/goalmodel) | no licence, R | DC, negative binomial, CMP goal models | well-cited blog | penaltyblog covers it | Not reusable (no licence). |
| [Torvaney/regista](https://github.com/Torvaney/regista) | GPL-3.0, R | DC | — | penaltyblog covers it | No benefit; R and GPL. |
| [ML-KULeuven/socceraction](https://github.com/ML-KULeuven/socceraction) | MIT, 823★ | VAEP/xT player-action values from event data | — | none | Needs event data MatchIQ does not have. |

## Data availability and cost

- `data/matches.json` comes from football-data.co.uk. Its free data is for personal and academic use with limited automated downloads. It is acceptable for this research backtest. **It is not cleared as legally reusable production data** for a publicly shared app. This is the biggest open licensing question and is unchanged by this mission.
- Closing odds (HuggingFace `minmaxxxer`, CC-BY-4.0) are fine for research benchmarking with attribution. They are historical only and are not a live odds feed. Live bookmaker odds remain "not loaded" in the UI rather than invented.
- No new external dataset, API, subscription or paid service was introduced. Cost stays at £0.

## Research-only challenger

Under the mission rules, a challenger may only be implemented behind a research flag when it genuinely outperforms. None did, so nothing was wired into the app. The strongest candidate (`ens_dc_xg`) is fully reproducible via `challenge.py`.

## Smallest useful next steps

1. Add a **shadow forward ledger** for `dc_decay` and `ens_dc_xg`, written before kick-off next to the frozen ledger, and compare after about 150 new matches. 409 backtest matches cannot resolve a ~0.003 Brier difference.
2. Resolve the production data licence: either get permission from football-data.co.uk or move to a source with explicit reuse rights.
3. Re-run `challenge.py` and `export_reliability.py` after each data refresh so the UI's calibration bands stay current.
