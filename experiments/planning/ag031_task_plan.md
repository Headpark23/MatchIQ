# Task Plan: Mission AG-031 — Find Better Signals for Goals and BTTS

## Objective
Investigate why MatchIQ's Goals and BTTS models struggle to beat simple historical baselines, audit pre-match features derivable from existing data, assess xG data licensing and feasibility, evaluate lightweight modeling options, and produce a ranked shortlist of up to three candidate improvements recommending just ONE first experiment.

## Applied Antigravity Skills
- `python-patterns`: Clean data extraction, feature engineering, and statistical modeling.
- `planning-with-files`: Persistent state tracking on disk in `experiments/planning/`.
- `test-driven-development`: Methodical, test-verified feature construction.
- `agent-orchestration`: Independent specialist reviews (Data Integrity, Statistical Calibration, Licensing/Feasibility).

## Strict Boundaries
- Research and planning only.
- No new model training for production, no dependency additions, no changes to frozen ledgers or Stadium Control.
- Stop for owner review before any implementation.

## Phases
- [x] Phase 1: Review AG-028, AG-029, and AG-030 root causes of baseline underperformance.
- [x] Phase 2: Audit available pre-match features in `data/matches.json` (Shots, Shots on Target, Corners, Cards).
- [x] Phase 3: Empirical correlation analysis of feature candidates vs actual match outcomes.
- [ ] Phase 4: Assessment of external xG data (utility, legal licensing, and operational viability).
- [ ] Phase 5: Evaluate lightweight modeling options (L2 Logistic Regression vs Shot Poisson vs Time-Decayed Dixon-Coles).
- [ ] Phase 6: Formulate ranked shortlist of 3 candidate improvements and recommend ONE single first experiment.
