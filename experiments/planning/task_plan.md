# Task Plan: Mission AG-030 — Goals & BTTS Probability Calibration Challenge

## Objective
Investigate whether probability calibration (Beta calibration, Logistic/Platt calibration, and historical league probability shrinkage) can improve the accuracy and reliability of MatchIQ's Total Goals (Over 2.5) and Both Teams to Score (BTTS) models without data leakage.

## Strict Boundaries & Constraints
- Work exclusively within isolated files in `experiments/`.
- Zero changes to MatchIQ production models, prediction ledgers, datasets, or Stadium Control.
- Zero data leakage: calibration parameters must be fit strictly on prior historical fixtures preceding test fixtures.
- Preserve day groupings (same-day fixtures evaluated together).
- Stop for owner review before any conclusions or recommendations are finalized.

## Applied Antigravity Skills
- `python-patterns`: Clean architecture, modular typing, vectorized operations, and error handling.
- `test-driven-development`: Red-Green-Refactor tests for calibration functions and leakage validation.
- `agent-orchestration`: Independent specialist reviews (Data Integrity Auditor, Calibration Statistician, Challenger Reviewer).
- `planning-with-files`: Persistent task planning, findings, and session logs on disk.

## Phases

### Phase 1: Baseline Reconciliation & Architecture Design
- [x] Reconcile 236 historical evaluation fixtures from AG-028 / AG-029.
- [x] Design chronological calibration and evaluation protocol (expanding walk-forward window).
- [x] Define mathematical formulations for Shrinkage, Platt/Logistic calibration, and Beta calibration.

### Phase 2: Test-Driven Development (TDD)
- [x] Write failing unit tests in `experiments/tests/test_calibration.py`.
- [x] Implement calibration classes in `experiments/calibration_research.py` and pass all tests (Green).

### Phase 3: Bounded Walk-Forward Calibration Experiment
- [x] Execute strict walk-forward evaluation across the 236 holdout matches:
  - Uncalibrated Poisson & Dixon-Coles models.
  - Historical League Baseline.
  - Shrinkage Calibrated models.
  - Logistic / Platt Calibrated models.
  - Beta Calibrated models.
  - Isotonic Regression (PAVA) Calibrated models.
- [x] Measure Brier score, Log Loss, Brier Skill Score ($BSS$), Expected Calibration Error ($ECE$), probability band reliability breakdowns, and paired uncertainty ($p$-values / 95% bootstrap CIs).

### Phase 4: Specialist Audits & Independent Challenge
- [x] Data Integrity Audit: Verify zero lookahead leakage, strict chronological ordering, same-day fixture grouping.
- [x] Statistical Review: Inspect sample size sufficiency, paired significance, and whether calibration adds genuine skill or merely shrinks predictions toward the mean.
- [x] Challenger Review: Evaluate viability for future live fixtures.

### Phase 5: Final Report & Verdict
- [x] Produce comprehensive comparative results table for Goals (Over 2.5) and BTTS (Yes).
- [x] Issue conclusion: NO-GO.
- [x] Recommend the next smallest isolated experiment.
