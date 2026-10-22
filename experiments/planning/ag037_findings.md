# Findings & Technical Knowledge: Mission AG-037 — Weekend Live Pilot (24–25 October 2026)

## 1. Architectural Context & Baseline Lineage
- **Baseline Design:** Stadium Control v2.5 (`dev/ag030-stadium-control-redesign` at `77e1a4c` + local uncommitted enhancements) implements a 5-second prediction dashboard with dark stadium aesthetic, ribbon fixture carousel, 6 market cards, and lower research panels.
- **Lineage of AG-031 to AG-036:**
  - AG-031 explored shots-on-target features (rejected for live production due to multi-testing penalty / non-significance).
  - AG-032 reconciled independent market audits and baseline references.
  - AG-033 established market consensus and de-vigging algorithms.
  - AG-034 automated historical odds ingestion.
  - AG-035 benchmarked historical closing odds against literature estimates.
  - AG-036 ingested 449 authentic CC-BY-4.0 closing odds from HuggingFace (`minmaxxxer/premier-league-closing-odds-2025-26` and `2026-27`), achieving 100% fixture matching (236/236) on holdout fixtures. Crucially, empirical shrinkage of model + market was formally REJECTED because it degraded market Brier (+0.00106).
- **Production Models Verified Safe for Live Pilot:**
  1. `match_winner_forward.py`: Dixon-Coles Goal Model v1 (`dixon-coles-v1-forward-frozen`). Bivariate Poisson with low-score correlation parameter ($\tau$) and home advantage.
  2. `forward_test.py`: Poisson Corners Model v0.9 (`v0.9-frozen-poisson`). Moving 10-match venue rolling averages predicting Over/Under 8.5, 9.5, 10.5.
- **Research / Benchmark Markets (NOT Verified Production Models):**
  - Over/Under 2.5 Goals: Poisson count benchmark only.
  - Both Teams to Score (BTTS): Joint Poisson clean-sheet model only.
  - Yellow Cards: Experimental Poisson model.
  - Shots on Target: Research candidate from AG-031, rejected for production until further verification.
  - Asian Handicap: Market consensus only from AG-036.

## 2. Matchweek 8 Schedule (24–25 October 2026)
- **Timezone Notice:** Current time is Thursday 2026-10-22 11:34 BST (Europe/London, UTC+1). The autumn clock change occurs at 01:00 UTC on Sunday 25 October 2026 (clocks go back 1 hour, BST -> GMT).
- **Saturday 24 October 2026:**
  1. `2026-10-24 12:30 UK` (11:30 UTC): Everton v Fulham
  2. `2026-10-24 15:00 UK` (14:00 UTC): Arsenal v Chelsea
  3. `2026-10-24 15:00 UK` (14:00 UTC): Liverpool v Leeds
  4. `2026-10-24 15:00 UK` (14:00 UTC): Man City v Brighton
  5. `2026-10-24 15:00 UK` (14:00 UTC): Aston Villa v Brentford
  6. `2026-10-24 15:00 UK` (14:00 UTC): Crystal Palace v Coventry
  7. `2026-10-24 17:30 UK` (16:30 UTC): Newcastle v Ipswich
- **Sunday 25 October 2026:**
  8. `2026-10-25 14:00 UK` (14:00 UTC): Nott'm Forest v Bournemouth
  9. `2026-10-25 14:00 UK` (14:00 UTC): Man United v Hull
  10. `2026-10-25 16:30 UK` (16:30 UTC): Tottenham v Sunderland

All 20 current season member clubs are scheduled across exactly 10 fixtures.

## 3. Bet Diary & Prediction Journal Separation
- **Separation Principle:** Prediction accuracy (Brier score, calibration, log-loss) is a property of the mathematical models and must never be conflated with betting profitability (ROI, profit/loss in GBP), which depends on bookmaker margin, odds taken, and stake sizing.
- **Privacy & £0 Spending:** The diary is stored client-side in `localStorage` with export capabilities. No bookmaker accounts, no live odds scraping, zero external spend.
