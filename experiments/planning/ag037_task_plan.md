# Task Plan: MatchIQ Mission AG-037 — Weekend Live Pilot (24–25 October 2026)

## Mission Objective
Prepare MatchIQ for a genuine hands-on user trial during this weekend's Premier League fixtures (24–25 October 2026).
The owner wants to use the application, review predictions, make independent betting choices for entertainment, record actual outcomes in a personal Bet Diary, maintain a pre-match Prediction Journal, capture user feedback, and evaluate performance.
External spending budget: £0.00. Zero modifications to frozen prediction models or historical prediction ledgers.

---

## Phases & Milestones

### Phase 1: Preflight & Environment Setup
- [x] Inspect existing Stadium Control redesign baseline and current Git branches/worktrees.
- [x] Review AG-030 through AG-036 assets, models, and market consensus datasets.
- [x] Review installed UI/UX, browser automation, testing, and frontend skills.
- [x] Identify latest verified production-safe prediction models (`dixon-coles-v1-forward-frozen` and `v0.9-frozen-poisson`).
- [x] Create isolated weekend pilot branch `dev/ag037-weekend-pilot`.
- [x] Ensure non-destructive preservation of frozen models and ledgers.

### Phase 2: Weekend Fixtures Verification & Integration
- [x] Verify the 10 Premier League Matchweek 8 fixtures scheduled for 24–25 October 2026.
- [x] Verify fixture dates and kickoff times in UK local time (7 on Sat 24 Oct, 3 on Sun 25 Oct).
- [x] Verify home and away teams against canonical 2026/27 clubs.
- [x] Verify latest genuine pre-match venue statistics from historical matches (830 completed matches).
- [x] Populate active fixture schedule into `data/matches.json` cleanly under pipeline freshness rules.
- [x] Generate pre-match predictions using verified production models:
  - 1X2 Match Winner via Dixon-Coles goal model.
  - Total Corners (Over/Under 8.5, 9.5, 10.5) via Poisson corner model.
- [x] Clearly flag experimental/unsupported markets (Over/Under 2.5 goals, BTTS, Cards, Shots) as research benchmarks, never presenting them as verified production predictions.

### Phase 3: Stadium Control Experience Enhancement
- [x] Maintain approved Stadium Control v2.5 dark architectural layout.
- [x] Ensure immediate, fluid access to all 10 weekend fixtures via top ribbon and fixture selector.
- [x] Display one clearly supported leading prediction per betting-market card with confidence indicators.
- [x] Implement attractive, readable probability graphics (dynamic progress bars, gauges, percentage badges, SVG vector club crests).
- [x] Include plain-English explanations of how each bet settles and what conditions trigger win/loss.
- [x] Provide transparent distinction between internal model predictions and external market consensus odds (from AG-036).
- [x] Clearly articulate model limitations, sample sizes, and uncertainty.
- [x] Guarantee mobile (390px) and desktop (1280px+) responsive elegance with touch targets ≥44px.

### Phase 4: Personal Bet Diary Feature
- [x] Build interactive, enjoyable, client-side Bet Diary inside Stadium Control:
  - Select fixture & market.
  - Automatically populate MatchIQ's original prediction and probability.
  - Toggle whether selection was suggested by MatchIQ or chosen independently.
  - Record actual bet selection, bookmaker name, decimal odds offered, stake in GBP.
  - Capture timestamp when recorded.
  - Track final outcome: Pending / Won / Lost / Void.
  - Compute net profit/loss based on stake and decimal odds ($Profit = Stake \times (Odds - 1)$ for win, $-Stake$ for loss, $0$ for void/pending).
  - Add personal notes field.
- [x] Store diary entries privately in browser `localStorage`.
- [x] Provide one-click CSV and JSON export facilities.
- [x] Strictly ensure no external gambling APIs, no bookmaker credentials, £0 financial risk from app.

### Phase 5: Prediction Journal
- [x] Implement pre-kickoff Prediction Journal recording all eligible MatchIQ predictions before kickoff (including non-bet selections).
- [x] Lock down original prediction values and timestamps so they cannot be rewritten retrospectively.
- [x] Provide post-match evaluation view:
  - Prediction accuracy vs actual outcome.
  - Win/loss record and Brier score tracking.
  - Comparison of owner choices vs MatchIQ suggestions.
  - Strict separation of statistical model accuracy from betting financial P&L.

### Phase 6: Personal UX Feedback Capture
- [x] Build lightweight, enjoyable, quick user feedback modal/widget:
  - Understandability of predictions (1–5 scale or quick rating).
  - Convincingness of probabilities.
  - Usefulness of suggested selections.
  - Clarity / confusion areas.
  - Free-form suggestions for improvement.
- [x] Persist feedback locally with export option.

### Phase 7: Automated QA, Browser Testing & Delivery
- [x] Comprehensive automated test suite:
  - Unit tests for Bet Diary calculations (P&L, settlements, stake math).
  - Unit tests for fixture and prediction mapping.
  - Regression tests for freshness and settlement safety.
- [x] Browser automation testing:
  - Launch local preview server.
  - Test desktop viewport (1440x900) and mobile viewport (390x844).
  - Verify fixture switching, market tab filtering, diary entry creation, P&L update, export download, and feedback submission.
  - Capture desktop and mobile screenshots for deliverable artifacts.
- [x] Verify £0 external spending and zero leakage into production/frozen assets.
- [x] Deliver comprehensive release report with clear GO / NO-GO recommendation and next-mission roadmap.
