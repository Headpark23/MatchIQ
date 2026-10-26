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
