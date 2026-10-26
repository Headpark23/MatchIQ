# MatchIQ

Premier League predictions with honest evidence labels, a sealed prediction history and a private Bet Diary.

## How it fits together

- `pipeline/` (Python) fetches the schedule and results, publishes predictions, seals them in `data/prediction_history.json`, settles results and writes performance summaries. Run `python -m pipeline.run` (add `--offline` or `--out <dir> --now <iso>` for isolated test runs).
- `index.html`, `styles.css`, `app.js` and `market_calculations.js` make up the static app. It only renders what the pipeline published; it never computes predictions.
- `.github/workflows/matchiq-refresh.yml` runs the pipeline every 6 hours once it is on the default branch. It can also be started by hand with "Run workflow". The frozen-model workflows (`winner-forward.yml`, `forward.yml`) are unchanged.
- `python build_public_dist.py` builds the allowlisted `public-dist/` bundle that is deployed.

## Data sources

| Source | Use | Terms |
|---|---|---|
| football-data.org (free tier) | Schedule, results, postponements | Optional. Needs a free token in the repository secret `FOOTBALL_DATA_ORG_TOKEN`; limit 10 requests/minute |
| OpenLigaDB | Schedule and results | ODbL 1.0, attribution required |
| openfootball/football.json | Schedule, results, Championship history | CC0 |
| football-data.co.uk (`data/matches.json`) | Corners, cards, shots statistics; results | Personal/research use only; refreshed manually by `update.yml`, not automated |

When sources disagree on a score, a majority of two or more wins and the dissent is recorded. A tie stays `RESULT_CONFLICT` and is not settled.

## Tests

```
python -m pip install -r pipeline/requirements.txt
python -m unittest discover -s tests -p "test_*.py"
for t in tests/*.js; do node "$t"; done
```

Research and evidence: `experiments/m063_prediction_challenge/REPORT.md` and `experiments/m064_promoted_hierarchy/REPORT.md`.
