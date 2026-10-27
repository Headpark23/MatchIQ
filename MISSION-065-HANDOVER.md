# MatchIQ: Mission 065 handover

Read this first in any new session. It is kept current at each checkpoint.

## Where things are

- **Branch:** `dev/mission065-best-bet`, stacked on `dev/mission064-complete-app` and `dev/mission063-strongest-signals`. Nothing has been pushed to GitHub; all of it is local commits.
- **Base:** `main` does not contain any Mission 063–065 work. Do not merge without owner approval.
- **Uncommitted on purpose:** the owner's own `.gitignore` edit (`.obsidian_vault/`), `.claude/launch.json` (local preview server), `public-dist/.gitignore` (Vercel link artifact).
- **Latest preview:** see "Checkpoint log" below. Previews are deployed by hand from `public-dist/` to the Vercel project `martin-whites-projects/matchiq`. Production (`matchiq-brown.vercel.app`) has never been touched.

## What is done (do not redo)

**Mission 063**
- Strongest Signals ranking.
- Fractional fair odds on the UK price ladder (`formatFairOdds`).
- Accumulator partial-settlement and all-void fixes.
- CSV quoting fix.
- 409-match walk-forward challenge of open-source models (`experiments/m063_prediction_challenge/REPORT.md`). No challenger beat the frozen models. Corners and goals methods do not beat the league average.

**Mission 064**
- `pipeline/` (Python):
  - Sources: football-data.org (optional token), OpenLigaDB (ODbL) and openfootball (CC0).
  - Canonical team names and stable match ids.
  - Handles rescheduled, postponed, removed and awaiting-result fixtures, with a majority rule for score conflicts.
- Match-result hierarchy: T1 frozen Dixon-Coles, T2 pooled PL+Championship model shrunk 50% toward league averages, T3 league averages. Validated in `experiments/m064_promoted_hierarchy/REPORT.md`.
- Six markets, with a 30% model / 70% league blend for everything except match result.
- SHA-256 sealed append-only `data/prediction_history.json`, plus settlement, performance summaries and a shadow challenger with a 150-match promotion gate.
- App rebuilt as `index.html` + `styles.css` + `app.js`, one design system.
- Workflow `.github/workflows/matchiq-refresh.yml`, which is inactive until it reaches the default branch.

## Commands

```
# Python env (repo .venv already has these)
.venv/Scripts/python -m pip install -r pipeline/requirements.txt
# Tests: about 89 Python tests + 4 JS suites, all passing at the last checkpoint
.venv/Scripts/python -W ignore -m unittest discover -s tests -p "test_*.py"
for t in tests/*.js; do node "$t"; done
# Refresh data (live sources) and rebuild the public bundle
.venv/Scripts/python -W ignore -m pipeline.run
python build_public_dist.py
# Isolated pipeline run (never touches data/)
.venv/Scripts/python -m pipeline.run --out <scratch dir> --now 2026-10-28T09:00:00Z
# Local preview: .claude/launch.json "matchiq-static" serves public-dist on :8063
# Dev preview deploy (never add --prod):
cd public-dist && npx vercel link --yes --project matchiq --scope martin-whites-projects && rm -f .env.local && npx vercel deploy --yes --scope martin-whites-projects; rm -f .env.local
```

`vercel link` writes `public-dist/.env.local` containing an OIDC token. Delete it every time. Vercel does not upload it, but never commit it.

## Configuration and external dependencies (no secrets in the repo)

| Item | Needed for | Status |
|---|---|---|
| GitHub secret `FOOTBALL_DATA_ORG_TOKEN` | Timely results and postponement status (free registration at football-data.org; 10 requests/minute) | **Not set.** The owner must register; Claude cannot create accounts |
| GitHub secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Automated deploy of `public-dist/` from Actions | **Not set.** Project id is `prj_wXS9PKDxWoNMIo6VOLf5FFrYMZt1` (not secret); org is the `martin-whites-projects` team |
| Push of the dev branch to GitHub | Running the workflow by hand ("Run workflow") | **Not authorised yet.** Ask the owner |
| Merge to `main` | Activates the 6-hourly schedule | Owner approval required |

- **Results lag without the token.** The keyless sources' results lag: OpenLigaDB had results to 12 Oct and openfootball to 20 Sep when last checked, so recent matches stay `AWAITING_RESULT` until football-data.co.uk is refreshed (manual `update.yml`) or the token is added.
- **No bookmaker prices.** No free bookmaker-odds source with clear reuse rights was found, so Best Value uses prices the user types in.

## Known issues and limits

- Promoted-club evidence rests on 41 backtest matches. T2 is provisional, with no proven edge.
- Corners, cards and shots statistics come only from football-data.co.uk (personal/research terms) through the manual refresh.
- The live scorecard has only 7 settled frozen-ledger predictions; figures are flagged as small samples.

## Checkpoint log

- **C0 (Mission 065 start).** All Mission 063/064 work committed at `ea73acb`; preview `https://matchiq-8fv9258g4-martin-whites-projects.vercel.app`.
- **C1 `79d1d65`.** Pipeline seals a Most Likely decision for every match, ranked on the lower 90% bound of a reference-shrunk probability. Best Value is No Bet when no price exists. Results are settled and summarised in `performance.json`.
- **C2 `0da99d6`.** App screens:
  - "This round" home: Most Likely hero and a match-by-match list.
  - Match screen: Most Likely card plus a Best Value checker with manual fractional prices. The margin is removed when every outcome is priced. Only the validated model can call value, and only at +5% EV or more.
  - League-average fallback badges; diary entries carry the recommendation type; Results has the scorecard.
- **CI `.github/workflows/matchiq-refresh.yml`.** Adds a Vercel deploy step for `public-dist/` only:
  - Preview from branches.
  - Production only from `main` with the variable `MATCHIQ_DEPLOY_PRODUCTION=true`.
  - Skipped unless `VERCEL_TOKEN` is set.
  - All steps were reproduced in a clean worktree; GitHub itself has not run them.
- **C3 `c29d095`.** The ledger is strictly append-only (no re-sorting) and byte-stable across runs.
  - Preview: **https://matchiq-l2hl02dbd-martin-whites-projects.vercel.app**. Tested on mobile and desktop: Most Likely, Best Value with manual odds and margin removal, promoted-club No Bet, Diary from both cards, scorecard.
- **C4 (dynamic Top Six, value tests, historical comparison, mobile scorecards).**
  - Match screen leads with a **Top Six**: the six strongest individual selections across every market and Over/Under line, computed in the browser by `topSix()` in `market_calculations.js` from the published predictions (the sealed ledger and frozen models are untouched). Ranked on the lower 90% bound of the credible chance, one selection per line. Selections on lines the backtest never scored (everything except goals 2.5, corners 9.5, cards 3.5, shots 8.5 and BTTS) are labelled **Unsupported** and rank after every backtested one, so they appear only when fewer than six backtested selections exist (promoted clubs). League-average fallback markets and non-top result outcomes are never promoted. #1 is always the sealed Most Likely pick. Every other prediction is under "Every market and line".
  - Each Top Six card has its own price box. **Best Value** (`bestValue()`) scans every priced selection in every market, not only the Top Six: states are Awaiting Odds, No Bet, Potential Value.
  - `valueVerdict`, `allSelections`, `rankSelections`, `topSix`, `bestValue` moved to `market_calculations.js` with `tests/test_best_value.js`. Behaviour change: only the model's top match-result pick can be called value (the 40%-band calibration describes top picks only).
  - `experiments/m065_most_likely_backtest/` (REPORT.md, results.json, decisions.csv): Most Likely hits 56.7% vs the favourite's 47.2% (+9.5 pts, CI [+2.7, +16.2]) but only because it picks likelier events; its edge over base rate is -0.8 pts against +8.6 for the favourite. No prices exist for these comparisons, so no profit/loss is claimed.
  - Results scorecards are now cards (`statCard`) instead of wide tables. Service-worker cache bumped to v5.
  - Preview: **https://matchiq-c8objec2o-martin-whites-projects.vercel.app** (commit `92cc0e8`). Production untouched.

## Next steps for the next session

1. Owner actions:
   - Authorise pushing `dev/mission065-best-bet`.
   - Add the secrets `FOOTBALL_DATA_ORG_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`.
   - Run the workflow once by hand on the branch and confirm that the preview deploy and the data commit both happen.
2. The Most Likely scorecard still has 0 settled picks; the populated mobile cards were only checked with mock numbers in the browser.
3. Possible follow-ups: show the backtest comparison in the app (it lives only in the experiment report); a browser-level test for the Top Six cards.

## Final release sweep (this session)

- **Verified baseline** at `6ed8ec7`: 96 Python tests + 5 JS suites passing; user-owned `.gitignore`, `.claude/`, `public-dist/.gitignore` left untouched.
- **C5: bookmaker odds feed (built, locally tested, NOT operational).**
  - `pipeline/odds.py`: The Odds API free Starter plan (500 credits/month). Requests Match Result + Total Goals 1.5/2.5/3.5 for the Premier League, UK region = 2 credits/call. Self-caps at 400 credits/month, minimum 12 h between calls, keeps the old cache on any failure, drops started matches, key read from `ODDS_API_KEY` env only and never written. Output `data/odds.json` (best UK price per selection, bookmaker, timestamp, fractional + decimal, credits used), included in `public-dist` and the service-worker precache (cache v6).
  - App: `pricesFor()` in `app.js` uses feed prices as defaults; anything the user types overrides them. BTTS, corners, cards and shots stay manual-entry (not requested from the feed; coverage on the free plan was not verified).
  - Tests: `tests/test_odds.py` (5). Full suite now 101 Python tests.
  - **Not verified:** a live call (no key), and the feed-prefill in a browser (the preview pane failed to load the page this session). Do both before trusting it.
  - Activation: register free at the-odds-api.com, add GitHub secret `ODDS_API_KEY`. The workflow already passes it.
- **Not done this session (by design, needs owner/credentials or is a research programme):** multi-league expansion (football-data.org free tier lists PL, ELC, BL1, PD, SA, FL1, but models, promoted-team handling and calibration are PL-only and each league needs its own validation), extra markets for Best Value, live GitHub Actions run, push/deploy.

## Final sweep, part 2 (commits d534af7 .. latest on `dev/mission065-best-bet`)

Preview: **https://matchiq-igrroq2wf-martin-whites-projects.vercel.app** (dev preview, production untouched, branch still unpushed).

**Leagues (implemented, locally tested, live-fetched fixtures; not yet run by GitHub)**
- Championship, Bundesliga, La Liga, Serie A, Ligue 1 added beside the Premier League. Registry and results: `pipeline/leagues.py`; results and corners/cards/shots statistics from football-data.co.uk (`data/league_results.json`, three seasons, refreshed every run, stored copy kept if the download fails). Fixtures from openfootball (all five), OpenLigaDB (BL1), football-data.org when the token exists. openfootball lists non-English kick-offs in local time (Europe/Paris offset used).
- Club names: `canonical_for()` in `pipeline/teams.py` with per-league alias tables plus readable display names; `tests/test_leagues.py` proves every 2026-27 club in each schedule resolves to a club with results history.
- Model: `Context(..., competition=code)`. Each league gets its own time-weighted Dixon-Coles fitted on that league only (tier `L1`, version `dc-league-v1`); a club with < 10 matches in the last 400 days (promoted sides: no second-division data is held) gets that league's average (`T3`). Goals/BTTS/corners/cards/shots use the same 30/70 blend with the league's own rates. The frozen Premier League models, their fingerprint and all existing sealed records are untouched (verified: 0 new PL revisions on a live run).
- Validation: `python -m pipeline.league_validation` writes `data/league_validation.json` (weekly-refit walk-forward on 2025-26). Result-model Brier gain over the league average: BL1 +0.078, SA +0.069, FL1 +0.046, PD +0.048, ELC +0.017. Blend markets (goals, BTTS, corners, cards, shots) are within ±0.003 of the league average everywhere, so they stay "no proven edge"; a market whose blend is worse than the league average is labelled strength `none` and never featured. Everything for these leagues is **provisional** (one-season backtest, no forward record), so Best Value can only say Awaiting Odds or No Bet there.
- Scorecards are never pooled: `performance.json` keeps the PL figures in the old keys and adds `by_competition`.
- App: competition bar (All, six leagues; remembered in localStorage) on Home, Fixtures and Results; league names on cards; per-league Results scorecard and backtest card.

**Odds (v2, `pipeline/odds.py`; implemented and tested with simulated responses, no live call made, no key)**
- Per-league sport keys; coverage requested: Match Result and Total Goals 1.5/2.5/3.5 only. The provider documents totals as mainly US, so a league that returns no totals is dropped to h2h only (1 credit). Corners, cards, shots, BTTS stay manual.
- One coherent bookmaker per market group (lowest margin that quotes every outcome), never a patchwork, so margin removal stays honest. Bookmaker and retrieval time are kept and shown in the match screen; prices older than 12 h, or for a match that has started, are shown as stale and never used as current prices (`feedPrices` in `market_calculations.js`, tested in `tests/test_odds_feed.js`; verified in the browser with mock fresh and 20 h-old prices). Manual entry always wins and still works.
- Budget: poll a league only when it has a match in the next 36 h; >= 8 h between polls (3 h inside 6 h of kick-off); spend never ahead of a straight-line monthly pace (cap 400 of 500); at <= 100 credits left PL and h2h only; at <= 25 nothing. Events that do not match our schedule (name or kick-off differs) are listed in `odds.json -> leagues[code].unmatched`. The cron runs every 6 h, so in practice polls land about every 12 h (6 h near kick-off).
- Activation: free key at the-odds-api.com, GitHub secret `ODDS_API_KEY`. After the first live run check `data/pipeline_status.json -> sources.the-odds-api` and `data/odds.json -> leagues` for matched/unmatched counts and whether totals exist.

**Automation**: a clean-worktree rehearsal of the workflow steps (tests, refresh, bundle) passed and was idempotent. GitHub itself has not run it; nothing pushed. The workflow now also commits `data/odds.json` and `data/league_results.json`.

**Local-only ledger note**: `dea1cd2` briefly contained league predictions with unpolished names (e.g. "Paris Sg"); `7d8588a` replaced them before anything was pushed. If you want a clean history squash those two commits before pushing.

## Release-candidate pass, part 1 (this session)

- **State verified:** branch `dev/mission065-best-bet` at `004f739`, unpushed; 121 Python tests + 5 JS suites pass. `.gitignore`, `.claude/` and `public-dist/.gitignore` untouched.
- **Secrets wiring verified by reading `matchiq-refresh.yml`:** it uses the exact names `FOOTBALL_DATA_ORG_TOKEN` and `ODDS_API_KEY`. Neither is present in the local environment, `gh` is not installed locally, and nothing is pushed, so **no live call has been made**. Live verification needs one Actions run, which needs the branch pushed (owner approval).
- **Licensing finding (football-data.co.uk):** the site's data page limits use to "private individuals only, NOT commercial or data training products using automated bots/scrapers/AI", states no licence and says the data is for league match prediction. The pipeline downloaded it automatically on every run. **Fixed:** automated download is now off unless `MATCHIQ_ALLOW_COUK_DOWNLOAD=1` (`pipeline/leagues.py`, test in `tests/test_leagues.py`); runs keep the stored copy. `update.yml` is manual-only and still fetches it when the owner presses the button.
- **Unresolved (owner decision):** the stored co.uk-derived rows in `data/league_results.json` / `data/matches.json` still feed the public models and the corners/cards/shots markets, which have no other permitted source. Options: ask the site's owner for permission, or drop those markets from the public app. Not changed yet.
- **football-data.org:** the free tier lists PL, ELC, BL1, PD, SA, FL1 (coverage page); rate limits and redistribution terms were not on that page, so confirm with the first live run and their terms/contact.
- **The Odds API:** credit cost is 1 per market per region (docs). Docs say totals are mainly US and BTTS is not listed; only `soccer_epl` is confirmed by the docs page I read, so the other league keys must be checked against the free `/sports` call.

## Live integration (2026-10-26, this session)

**Branch pushed** (`dev/mission065-best-bet`, never main, private repo). `matchiq-refresh.yml` exists only on this branch, and GitHub only lets you manually run a workflow that is on the default branch, so it cannot be dispatched yet. Instead `.github/workflows/live-integration-check.yml` runs only on a push to this branch that changes `.github/live-check-request.txt` (edit that file and push to re-run). Job 1 writes `data/live_check/report.json`; job 2 runs tests, the full pipeline and `build_public_dist.py`, then commits data to this branch. No deploy, no main. Remove this workflow before merging to main.

**Actual results (real calls, credentials never logged)**
- football-data.org free tier: HTTP 200 for PL, ELC, BL1, PD, SA, FL1 (season 2026; 380/552/306/380/380/306 matches). All clubs resolved; 100% of fixture ids matched the schedule. Latest results 24-25 Oct. Statuses seen: FINISHED, TIMED, SCHEDULED, CANCELLED (1 in La Liga). Limit: 10 requests/minute.
- Full pipeline run: ok, 2304 fixtures, 144 upcoming predicted, 126 new revisions, 16 results settled. Source mix per league confirmed in `data/pipeline_status.json`. 0 errors.
- The Odds API (host `api.the-odds-api.com`): all six sport keys exist and are active (`soccer_epl`, `soccer_efl_champ`, `soccer_germany_bundesliga`, `soccer_spain_la_liga`, `soccer_italy_serie_a`, `soccer_france_ligue_one`). UK region returns ~20 bookmakers. Match Result everywhere; Totals lines 2.5/3.5 everywhere (1.5 only La Liga, 4.5 in BL1/PD). **BTTS is rejected (HTTP 422) on this endpoint: stays manual.** An h2h_lay (exchange lay) market also comes back and is ignored. Cost 2 credits per league call.
- Credits: two diagnostic runs plus one pipeline poll; provider reports 470 of 500 remaining after the first pipeline run. The pipeline's own counter (`odds.json -> credits`) does not include the diagnostic spend, but it also reads the provider's remaining figure, so the low-balance rules still hold.
- Matching: after the pipeline run (football-data.org kick-off times) 60 of 60 priced events matched our schedule (the earlier La Liga/PSG mismatches were only stale openfootball kick-offs).
- App logic on the real files (Node, the app's own `market_calculations.js`): 60 priced matches have predictions; at 1 h old all 60 are `fresh` and produce a Best Value verdict (provisional leagues say "no proven edge", as designed); at 20 h old all 60 are `stale` and contribute no prices; Top Six returns 6 selections. Not checked in a browser: the Browser pane could not load localhost this session.

**Rights audit (football-data.co.uk)**: automated download stays off (`MATCHIQ_ALLOW_COUK_DOWNLOAD=1` only for a manual research run). Research data is preserved untouched. The public bundle contains no raw co.uk rows (`matches.json`, `league_results.json` are not in the allowlist), but the models behind corners, cards and shots, and the sealed history for them, were trained on it; with downloads off those markets cannot settle for new matches (no statistics) and the pipeline status warns "download failed" (wording should say "disabled"). **No preview was deployed**, so nothing with unresolved rights was newly published. Owner decision needed: get written permission from football-data.co.uk, or have the public bundle withhold corners/cards/shots.

**Vercel**: not attempted. Needed only for automated deploys (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`); manual preview deploys still work from this machine's linked CLI.

## Public-rights pass (2026-10-26/27)

**Rule:** matching scores is not legal clearance. Everything trained on football-data.co.uk data (frozen PL models, pooled/promoted models, the sealed private ledgers, corners/cards/shots) is a **private research artefact**: kept, never deleted or replaced, never shipped.

**Public path (`pipeline/public.py`, model `dc-public-v1`)**
- Training data: football-data.org final scores only (`data/public_results.json`: 6 leagues x seasons 2023-25, built by `python -m pipeline.public --history`, 18 free requests, refreshed monthly by the workflows) plus current-season results whose `result_source` is football-data.org/OpenLigaDB/openfootball. Rows with a co.uk source are excluded (tested).
- Model: per-league time-weighted Dixon-Coles for all six leagues, Premier League included (not the frozen model). Markets: Match Result, Goals, BTTS. Corners, cards, shots: not modelled publicly (no permitted statistics source).
- Chronological validation: weekly-refit walk-forward on 2025-26, `data/public/league_validation.json`. Result Brier gain over league average: PL +0.039 (n 351), ELC +0.016, BL1 +0.078, PD +0.048, SA +0.069, FL1 +0.046; goals/BTTS within +-0.004 of league average (no proven edge). All provisional; no forward record.
- Identity: public records live in `data/public/prediction_history.json` with ids `PUB-<match id>#rN`, `origin: public-derived`, `model_version: dc-public-v1`, `derivation: public-derived`. They are **not** the originally sealed predictions, which are not shown or re-derived. Public history/scorecards start empty on the day the public model went live (first run 2026-10-26: 144 predictions).
- Public bundle (`build_public_dist.py`): predictions, history, performance and validation come only from `data/public/`; fixtures drop co.uk labels; `model_reliability.json` is an empty placeholder (`public: true`); `match_winner_forward.json` and `forward_test.json` are not shipped; the build aborts if any public data file contains corners/cards/shots or "football-data.co.uk" (except `rights.json`). With no public data it ships empty predictions, never private ones. The build now preserves `public-dist/.gitignore` and `.vercel` (it used to delete them; I relinked Vercel and the `.gitignore` is regenerated, untracked).
- `data/provenance_audit.json`: dependency table plus score parity against football-data.org: 6517/6532 equal (99.77%); 5 ELC mismatches per season.

**Verified:** 128 Python tests + 5 JS suites pass. Browser (own static server, port 8070; the built-in preview server proxy failed): real Odds API prices and bookmaker names (Smarkets, William Hill), fractional 4/1, margin removal, Best Value No Bet ("no proven edge"), Awaiting Odds without prices, Most Likely, Top Six (fewer than six selections when only 3 markets exist), stale/started prices rejected, Results page with per-league backtest, More page attribution and method text, footer credits football-data.org, OpenLigaDB, openfootball and The Odds API. No restricted words in the shipped data.

**Dev preview (production untouched):** https://matchiq-dnzqrfoy5-martin-whites-projects.vercel.app

**Automation and environments**
- `.github/workflows/live-integration-check.yml`: dev-branch-only, push-triggered by editing `.github/live-check-request.txt`; runs the API check, provenance audit, public history/validation, tests, full refresh, bundle build, commits data to the branch. No deploy. Delete before merging to main.
- `.github/workflows/matchiq-refresh.yml`: the production-intended workflow (6-hourly cron; inactive until on main). Now also refreshes public history/validation monthly. Deploy step: preview from any branch, production only from `main` AND repository variable `MATCHIQ_DEPLOY_PRODUCTION=true`; skipped unless `VERCEL_TOKEN` exists. Needs secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (project id `prj_wXS9PKDxWoNMIo6VOLf5FFrYMZt1`, org `martin-whites-projects`).

**Open items (owner)**
1. football-data.org free-tier terms for storing history in the repo and showing derived predictions publicly are unchecked (private repo for now; email the address on their coverage page, or check the terms).
2. The Odds API display/redistribution terms are unchecked.
3. Bookmaker prices appear only for Match Result and Total Goals; BTTS is rejected by the provider.
4. Merge to main and the Vercel secrets are still needed for fully automatic operation. The co.uk research data stays private; ask the site owner for permission before any public use.

## Release-readiness pass (2026-10-26)

**Preview:** https://matchiq-nylg6t146-martin-whites-projects.vercel.app (dev preview; production untouched). 133 Python + 5 JS suites pass.

**1. Terms and attribution (nothing assumed approved)**
- football-data.org: shipped attribution in the footer and More page. Their pricing page lists the free plan as 10 calls/minute with delayed scores and says nothing about commercial use, attribution or public display; no terms page was reachable (/terms is 404). **Unverified:** whether the free tier permits a public app, storing history (`data/public_results.json`, in the private repo) and showing derived predictions. Ask daniel@football-data.org (address on their site) before a public launch.
- The Odds API: terms say showing odds in an app, including commercially, is allowed; storing is allowed; reselling or redistributing raw data or offering it through your own API/files is not; crediting is welcome, not mandatory; responsible-gambling messaging encouraged; verify prices with the operator. We display only, credit them in the footer, and `data/odds.json` is served as a static file, which is a redistribution grey area: a real risk to confirm with them. Free-plan quota terms not found on that page; observed 500 credits/month.
- OpenLigaDB: ODbL 1.0 (site states it). Credit "OpenLigaDB contributors (ODbL 1.0)" shown. Share-alike/database-notice obligations for a derived database were not reviewed (details at openligadb.de/lizenz).
- Club logos: none used. Crests are generated SVG initials in approximate club colours (`crest()` in `app.js`); club names are used descriptively. Low risk; not legal advice.
- football-data.co.uk: unchanged, research-only, no automated download.

**2. No fallback to restricted data.** `run_public` now (a) treats only results with `result_source` in football-data.org/OpenLigaDB/openfootball and no `conflicting_scores` as usable (`permitted_result`), (b) hides every other finished match from both training and settlement (`public_fixtures`), (c) asserts every training row has a permitted source. Tests assert `public.py` never references the co.uk loaders, `league_results.json`, `matches.json`, the private ledger or frozen models.

**3. Bet Diary persistence.** localStorage is per web address, so each Vercel preview URL (and the production alias) has its own empty diary; nothing is lost or shared. Added **Backup** (lossless file), **Import** (non-destructive merge by id; never overwrites or deletes; rejects bad files untouched) and kept CSV/JSON export. Verified in the browser at 375px (merge, duplicate skip, existing entry untouched). Stable release: serve from ONE fixed address (the production alias) and have testers Backup then Import once. Never change the address after launch without a Backup.

**4. Vercel and production safety.** API check: the Vercel project is linked to GitHub (`Headpark23/MatchIQ`, production branch `main`) but `createDeployments` is **disabled**, so merging or pushing deploys nothing by itself. The only deploy path is the workflow step, which needs `VERCEL_TOKEN`; it runs `vercel deploy` (preview) unless ref is `main` AND repository variable `MATCHIQ_DEPLOY_PRODUCTION` = `true`. Merging with the secrets but without the variable yields previews only. Secrets to add (Settings > Secrets and variables > Actions): `VERCEL_TOKEN` (new token at vercel.com/account/tokens), `VERCEL_ORG_ID` = `team_sVLi6QCcm52lUG0yR3iw9qwK`, `VERCEL_PROJECT_ID` = `prj_wXS9PKDxWoNMIo6VOLf5FFrYMZt1` (the two IDs are identifiers, not secrets). Do not create `MATCHIQ_DEPLOY_PRODUCTION` until you are ready for production.

**5. Settlement of PUB- predictions.** Unit-tested (publish, then finish, then settle, scorecard n=1). Replay on REAL data: published the 24-25 Oct weekend fixtures as of 23 Oct, then settled with the real football-data.org results: 47 PUB- records settled, per-league result scorecards populated (PL 4, ELC 11, BL1 8, PD 8, SA 9, FL1 7), Most Likely scorecard 3 settled. Samples are tiny. The first genuine forward settlements (tonight's 26 Oct matches such as Paris SG v Lyon and Sevilla v Osasuna, kick-offs 19:30/20:00 UTC) are NOT yet confirmed: free-tier scores are delayed. To confirm, after those finish edit `.github/live-check-request.txt` and push; the dev workflow will settle and commit `data/public/*`.

**6. Regression (browser, own static server):** competition filters (each league shows only its own matches), Top Six, Most Likely, Best Value with live bookmaker prices (Betfair, William Hill, fractional 11/10 etc.; no decimal odds shown), stale rejection, Results, More, Diary; no horizontal overflow at 375px on all six screens; no corners/cards/shots text.

**Remaining before a public stable release:** the three provider-terms confirmations above; the three Vercel secrets; merge to `main` (delete `live-integration-check.yml` first); decide the single stable URL; first genuine forward settlement; permission from football-data.co.uk if the research markets are ever to go public.

## Forward settlement test (prepared 2026-10-26, run scheduled 2026-10-27 08:30 UTC)

Football-data.org had not yet reported tonight's matches when requested (it was 17:5x UTC), so the live run was deferred. Prepared:
- `data/forward_check/baseline.json`: sealed hashes and published times of the 144 genuine forward PUB- records (all published 2026-10-26T17:03Z; baseline committed 17:53Z, before the evening kick-offs). Only these count; replays do not.
- `pipeline/forward_check.py`: seven checks (sealed before kick-off, result matched to fixture from a permitted unconflicted source, independent win/loss recomputation, immutability versus the baseline, scorecards recomputed per league, finished fixtures out of Upcoming but kept in history, idempotent re-settlement). Self-tested on a replay in a temp directory (not counted as forward): 7 of 7 PASS.
- `.github/workflows/forward-settlement-check.yml`: dev-branch only, triggered by pushing `.github/forward-check-request.txt`; football-data.org token only, the Odds API key is not passed (zero bookmaker credits); no deploy.
- A one-off scheduled task (`matchiq-forward-settlement-check`) runs it on 27 Oct 08:30 UTC and appends the PASS/FAIL result here. It needs the desktop app open (otherwise it runs at next launch). Manual alternative: create the request file, commit, push to the dev branch, then read `data/forward_check/report.json`.

## First live forward settlement (27 Oct)

Run 2026-10-27 08:31Z via `.github/forward-check-request.txt` (request 1), workflow commit `9ce8da0` "Forward settlement check". Dev branch only; no deploy, no Odds API credits, nothing merged to main. Baseline: 144 sealed PUB- records (published 2026-10-26, baseline committed 17:53Z).

**Verdict: PASS (7 of 7).** Forward-settled records: **2** (not 144; football-data.org had reported only these two of the 26 Oct evening matches as FINISHED, the free tier delays scores). The sample is tiny and proves the mechanism, not model quality.

| # | Check | Result |
|---|---|---|
| 1 | Sealed before kick-off | PASS (n 2) |
| 2 | Results match fixtures | PASS |
| 3 | Settlement correct | PASS (picks won 3, lost 3) |
| 4 | History immutable vs baseline | PASS (ledger verified; 286 records, 142 new revisions since baseline, no baseline record altered) |
| 5 | Scorecards accurate | PASS |
| 6 | Left Upcoming, kept in history | PASS |
| 7 | Idempotent | PASS |

**Settled per league:** FL1 1 (Paris SG 2-0 Lyon), PD 1 (Sevilla 2-0 Osasuna); PL, ELC, BL1, SA 0. Result-market picks: 2 won, 0 lost. Goals O/U 2.5: 1 won (Sevilla under), 1 lost (PSG over). BTTS: 0 won, 2 lost (both picked Yes, both games ended 2-0). Most Likely: 1 won (PSG win), 1 lost (Sevilla BTTS Yes).

**Hand spot-check against `data/fixtures.json`** (both 2-0, source football-data.org): outcome H for both; PSG goals total 2 vs Over 2.5 pick = lost, BTTS no vs Yes = lost; Sevilla total 2 vs Under pick = won, BTTS lost. All match the ledger. Only 2 records were settled, so a third could not be checked.

**Tests:** 131 Python tests OK; all JS suites PASS.

**Blockers / remaining:** other 26 Oct matches and later rounds are not yet settled (delayed free-tier scores), so per-league samples stay far below any meaningful size; scorecards are flagged insufficient sample. Owner items from the earlier sections (provider terms, Vercel secrets, merge to main) are unchanged.
