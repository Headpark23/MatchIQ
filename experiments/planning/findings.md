# Research Findings: Mission AG-030 — Goals & BTTS Probability Calibration

## Final Empirical Results (N = 236 Holdout Matches: 2026-01-07 to 2026-05-24)

### Market 1: Total Goals (Over 2.5)
- **Empirical Holdout Hit Rate**: 54.7% (129 / 236)
- **Unconditional Baseline Brier**: **0.2483** | **LogLoss**: **0.6897** | **ECE**: **0.0096** | 95% CI: [0.2409, 0.2554]

| Model / Calibrator | Brier | Log Loss | BSS vs Base | ECE | 95% CI Brier | Permutation p-val |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Unconditional Baseline** | **0.2483** | **0.6897** | **Ref** | **0.0096** | [0.2409, 0.2554] | — |
| **Poisson (Raw)** | 0.2601 | 0.7140 | -4.75% | 0.0831 | [0.2492, 0.2708] | 0.9798 |
| **Poisson + Shrinkage** | 0.2492 | 0.6916 | -0.37% | 0.0081 | [0.2420, 0.2563] | 0.9674 |
| **Poisson + Platt (Logistic)** | 0.2564 | 0.7065 | -3.28% | 0.0856 | [0.2470, 0.2655] | 0.9714 |
| **Poisson + Isotonic** | 0.2520 | 0.6990 | -1.52% | 0.0397 | [0.2431, 0.2612] | 0.8386 |
| **Poisson + Beta** | 0.2590 | 0.7117 | -4.30% | 0.0823 | [0.2484, 0.2695] | 0.9816 |
| **Dixon-Coles (Raw)** | 0.2584 | 0.7112 | -4.06% | 0.0758 | [0.2461, 0.2705] | 0.9506 |
| **Dixon-Coles + Shrinkage** | 0.2497 | 0.6926 | -0.57% | 0.0145 | [0.2427, 0.2564] | 0.8978 |
| **Dixon-Coles + Platt (Logistic)** | 0.2552 | 0.7041 | -2.79% | 0.0471 | [0.2451, 0.2651] | 0.9330 |
| **Dixon-Coles + Isotonic** | 0.2542 | 0.7019 | -2.39% | 0.0356 | [0.2457, 0.2624] | 0.9600 |
| **Dixon-Coles + Beta** | 0.2576 | 0.7093 | -3.75% | 0.0688 | [0.2462, 0.2692] | 0.9498 |

---

### Market 2: Both Teams to Score (BTTS Yes)
- **Empirical Holdout Hit Rate**: 57.2% (135 / 236)
- **Unconditional Baseline Brier**: **0.2452** | **LogLoss**: **0.6835** | **ECE**: **0.0064** | 95% CI: [0.2369, 0.2536]

| Model / Calibrator | Brier | Log Loss | BSS vs Base | ECE | 95% CI Brier | Permutation p-val |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Unconditional Baseline** | **0.2452** | **0.6835** | **Ref** | **0.0064** | [0.2369, 0.2536] | — |
| **Poisson (Raw)** | 0.2491 | 0.6917 | -1.62% | 0.0847 | [0.2392, 0.2586] | 0.8128 |
| **Poisson + Shrinkage** | 0.2462 | 0.6857 | -0.43% | 0.0212 | [0.2380, 0.2540] | 0.7396 |
| **Poisson + Platt (Logistic)** | 0.2482 | 0.6900 | -1.25% | 0.0681 | [0.2370, 0.2588] | 0.7896 |
| **Poisson + Isotonic** | 0.2518 | 0.7941 | -2.70% | 0.0391 | [0.2394, 0.2652] | 0.9016 |
| **Poisson + Beta** | 0.2490 | 0.6914 | -1.56% | 0.0923 | [0.2383, 0.2593] | 0.8180 |
| **Dixon-Coles (Raw)** | 0.2482 | 0.6896 | -1.24% | 0.0447 | [0.2380, 0.2587] | 0.7646 |
| **Dixon-Coles + Shrinkage** | 0.2455 | 0.6842 | -0.15% | 0.0107 | [0.2376, 0.2539] | 0.6306 |
| **Dixon-Coles + Platt (Logistic)** | 0.2474 | 0.6881 | -0.92% | 0.0460 | [0.2369, 0.2587] | 0.7374 |
| **Dixon-Coles + Isotonic** | 0.2470 | 0.6872 | -0.75% | 0.0308 | [0.2366, 0.2576] | 0.6928 |
| **Dixon-Coles + Beta** | 0.2481 | 0.6894 | -1.19% | 0.0577 | [0.2372, 0.2591] | 0.7724 |

---

## Detailed Probability Band Breakdown

### Total Goals (Over 2.5) Tail Disconnect:
- **Raw Dixon-Coles Tail Disconnect**:
  - In band $[0.00, 0.40)$ (where the model predicted only 35.98% mean probability of Over 2.5, $N=20$), the actual hit rate was **65.00%**!
  - In band $[0.70, 1.01)$ (where the model predicted 72.20% probability of Over 2.5, $N=4$), the actual hit rate was only **25.00%**!
- **Effect of Calibration**:
  - Platt, Beta, Isotonic, and Shrinkage aggressively squash extreme tail probabilities inward toward the league mean (~55%).
  - For example, under Isotonic calibration, 182 out of 236 matches (77.1%) are forced into the $[0.50, 0.60)$ band.
  - Under Shrinkage, $\alpha \to 1.0$, pulling predictions closer and closer to 0.55.

---

## Mathematical Murphy Decomposition Analysis
$$\text{Brier} = \text{Reliability} - \text{Resolution} + \text{Uncertainty}$$
- **Uncertainty**: Invariant holdout entropy $\bar{y}(1 - \bar{y}) = 0.5466 \times (1 - 0.5466) = 0.2483$.
- **Reliability (Calibration Error)**: Quantifies distance between predicted probability and conditional hit rate. Uncalibrated Poisson had poor reliability ($\approx 0.012$); calibration successfully squashed this to $< 0.001$.
- **Resolution (Discrimination Power)**: Measures the variance of conditional probabilities across outcome classes. The raw Poisson and Dixon-Coles models have **near-zero or negative resolution** on Goals and BTTS because historical goal tallies have high Poisson noise and lack predictive signal for match-level pace and shot volume.
- **Why Calibration Cannot Beat Baseline**: Calibration can only optimize the Reliability term ($\text{Reliability} \to 0$). It **cannot increase Resolution**. When a model's resolution is zero or negative, the best any calibrator can do is collapse all probabilities to the unconditional base rate ($\text{Reliability} = 0, \text{Resolution} = 0$), yielding $BSS = 0.0\%$.

---

## Specialist Review Findings

### 1. Data Integrity Auditor Review
- **Chronological Walk-Forward**: Strict verification that every calibrator was fit strictly on matches occurring before the evaluation date ($\text{date} < \text{eval\_date}$). Zero lookahead leakage.
- **Fixture Grouping**: Same-day fixtures evaluated concurrently without intra-day leakage.

### 2. Calibration Statistician Review
- **Did calibration improve Brier/LogLoss relative to raw models?** Yes. For Poisson Goals, Brier improved from 0.2601 to 0.2492; for Dixon-Coles, from 0.2584 to 0.2497.
- **Did calibration beat the unconditional baseline?** No. Every single calibrated model across all 4 calibration families (Platt, Beta, Isotonic, Shrinkage) produced negative Brier Skill Score ($BSS < 0$) and Log Loss higher than the naive baseline.
- **Statistical Significance**: Permutation tests vs unconditional baseline show $p > 0.60$ for all models; none achieve a statistically significant edge over the historical league base rate.

### 3. Production Challenger Review
- **Decision**: **NO-GO**.
- **Rationale**: Deploying probability calibration to production would be a cosmetic placebo. While it dampens the overconfidence of raw Poisson and Dixon-Coles models, it cannot fix the absence of predictive signal. Betting or predicting with these calibrated probabilities offers zero positive expected value ($+EV$) over a simple naive historical base rate.
- **Next Small Mission Recommendation**: AG-031 — Signal enrichment (pre-match Shots on Target and regularized logistic models) to create genuine positive Resolution before revisiting calibration.
