# Task Plan: MatchIQ Mission AG-037A — Emergency Weekend Fixture & Prediction Integrity Repair

## Mission Objective
Correct the emergency fixture mismatch reported by Rocky.
Replace incorrect Matchday 8 fixtures with the genuine Premier League Matchweek 8 schedule for 23–25 October 2026.
Quarantine the incorrect predictions as audit evidence.
Safely preserve historical settled ledgers in `data/forward_test.json` and `data/match_winner_forward.json`.
Regenerate forward predictions for authentic fixtures using approved frozen models.
Enforce strict minimum-sample safeguards (<5 matches threshold).
Remove fabricated market consensus odds, marking unavailable odds transparently.
Verify Bet Diary, Prediction Journal, feedback, desktop/mobile responsive UI.
External spending: £0.00.

---

## Phases & Milestones

### Phase 1: Investigation & Evidence Quarantine
- [x] Document discrepancy between incorrect fixtures loaded in AG-037 and authentic schedule.
- [x] Quarantine incorrect fixtures and prediction outputs to `experiments/audit_evidence/ag037_quarantine/`.
- [x] Verify baseline state of `data/match_winner_forward.json` and `data/forward_test.json` (7 historical settled matches).
- [x] Create `ag037a_findings.md` and `ag037a_progress.md`.

### Phase 2: Schedule Authentication & UK Daylight Saving Correction
- [x] Authenticate the 10 real Matchweek 8 fixtures:
  - Fri 23 Oct 20:00 BST: Ipswich v Nott'm Forest
  - Sat 24 Oct 12:30 BST: Aston Villa v Man City
  - Sat 24 Oct 15:00 BST: Arsenal v Everton
  - Sat 24 Oct 15:00 BST: Coventry v Fulham
  - Sat 24 Oct 17:30 BST: Chelsea v Tottenham
  - Sun 25 Oct 14:00 GMT: Crystal Palace v Newcastle
  - Sun 25 Oct 14:00 GMT: Hull v Brentford
  - Sun 25 Oct 14:00 GMT: Liverpool v Brighton
  - Sun 25 Oct 14:00 GMT: Man United v Bournemouth
  - Sun 25 Oct 16:30 GMT: Sunderland v Leeds
- [x] Calculate precise UTC kickoff timestamps reflecting BST on Friday/Saturday and GMT on Sunday (following 01:00 UTC clock fall-back).
- [x] Ingest authenticated fixtures into `data/matches.json`.

### Phase 3: Model Execution & Independent Minimum-History Safeguards
- [x] Clean active pending records from `data/match_winner_forward.json` and `data/forward_test.json` while keeping 7 settled historical records intact.
- [x] Run `match_winner_forward.py` on the 10 authenticated fixtures.
- [x] Run `forward_test.py` on the 10 authenticated fixtures.
- [x] Verify that Coventry v Fulham and Hull v Brentford are withheld under <5 matches safeguard.
- [x] Verify 8 authentic fixtures have valid pre-kickoff predictions.
- [x] Verify execution idempotency.

### Phase 4: Market Odds Audit & Fabricated Price Removal
- [x] Audit market odds availability: Matchweek 8 is upcoming; authentic closing odds do not exist yet.
- [x] Remove hardcoded estimated bookmaker consensus odds from `index.html`.
- [x] Mark market consensus as "Pre-match odds unavailable (pending live feed)" in UI, preventing any fabricated prices.
- [x] Retain owner manual odds entry in Bet Diary so owner can enter genuine live odds offered by their bookmaker.

### Phase 5: Stadium Control UI & Component Updates
- [x] Update fixture selector and ribbon to start with Friday 23 Oct (Ipswich v Nott'm Forest).
- [x] Update all match cards, settlement explanations, and probability gauges.
- [x] Update Prediction Journal table with real fixtures and authentic predictions.
- [x] Update Bet Diary dropdowns to list authentic fixtures.
- [x] Verify Feedback module functions cleanly.

### Phase 6: Automated Testing & Verification
- [x] Update test fixtures in `tests/test_data_freshness.py` if needed.
- [x] Run Python test suite (`python -m unittest discover tests/`).
- [x] Run JavaScript test suites (`test_regression_strings.js`, `test_bet_diary.js`, `test_market_calculations.js`).

### Phase 7: Browser Automation QA & Delivery
- [x] Test Desktop View (1440x900) via `browser_subagent`:
  - Verify all 10 fixtures rendered across Friday, Saturday, Sunday.
  - Verify Friday opening match Ipswich v Nott'm Forest.
  - Verify sample < 5 warning on Coventry v Fulham and Hull v Brentford.
  - Verify Bet Diary logging, settlement, CSV/JSON export.
  - Verify Prediction Journal displays 8 pending predictions.
  - Verify feedback form submission.
- [x] Test Mobile View (390x844).
- [x] Capture verified QA screenshots.
- [x] Commit all changes to isolated branch `dev/ag037-weekend-pilot`.
- [x] Issue final sign-off report with GO/NO-GO verdict.
