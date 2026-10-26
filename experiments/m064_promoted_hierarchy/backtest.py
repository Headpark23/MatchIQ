"""Mission 064: validate the match-result hierarchy on fixtures the frozen model skips.

Test set: every Premier League match in 2025/26 and 2026/27 (to 19 Oct 2026) where
the frozen Dixon-Coles model was ineligible on that day (a side with <5 prior venue
games) — in practice, promoted clubs early in the season. Each match day is predicted
from results strictly before that day, using pipeline.models.Context (the shipped code).

Run: python -I experiments/m064_promoted_hierarchy/backtest.py   (repo venv with penaltyblog)
Writes results.json beside this file.
"""
import csv
import datetime as dt
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from pipeline.data import championship_history, load_co_uk, promoted_by_season  # noqa: E402
from pipeline.models import Context  # noqa: E402
from pipeline.teams import canonical  # noqa: E402

HERE = Path(__file__).resolve().parent
ODDS = [ROOT / "experiments" / "raw_market_data" / n for n in
        ("premier_league_2025_26_closing_odds.csv", "premier_league_2026_27_odds.csv")]


def market():
    out = {}
    for path in ODDS:
        for r in csv.DictReader(path.open(encoding="utf-8")):
            p = [float(r[k]) for k in ("close_home_prob", "close_draw_prob", "close_away_prob")]
            out[(r["date_uk"], canonical(r["home_team"]), canonical(r["away_team"]))] = [x / sum(p) for x in p]
    return out


def score(p, y):
    p = np.clip(np.array(p, float), 1e-12, 1); p = p / p.sum()
    o = np.eye(3)[y]
    cp, co = np.cumsum(p)[:-1], np.cumsum(o)[:-1]
    return {"brier": float(((p - o) ** 2).sum()), "logloss": float(-math.log(p[y])), "rps": float(((cp - co) ** 2).sum() / 2)}


def bootstrap(diffs, days, rng, n=2000):
    blocks = defaultdict(list)
    for d, x in zip(days, diffs):
        blocks[d].append(x)
    b = list(blocks.values()); sums = np.array([sum(x) for x in b]); sizes = np.array([len(x) for x in b])
    means = []
    for _ in range(n):
        pick = rng.integers(0, len(b), len(b))
        means.append(sums[pick].sum() / sizes[pick].sum())
    return [round(float(np.percentile(means, 2.5)), 4), round(float(np.percentile(means, 97.5)), 4)]


def main():
    epl = load_co_uk()
    results = epl + championship_history()
    promoted = promoted_by_season(epl)
    mk = market()
    rng = np.random.default_rng(64)
    test = [r for r in epl if r["season"] in ("2526", "2627")]
    days = sorted({r["date"] for r in test})
    rows = []
    for day in days:
        todays = [r for r in test if r["date"] == day]
        ctx = None
        for r in todays:
            prior_epl = [x for x in epl if x["date"] < day]
            hc = sum(x["home"] == r["home"] for x in prior_epl); ac = sum(x["away"] == r["away"] for x in prior_epl)
            if hc >= 5 and ac >= 5:
                continue
            ctx = ctx or Context(results, day, promoted)
            fixture = {"date": day, "home": r["home"], "away": r["away"], "season": r["season"]}
            y = 0 if r["hg"] > r["ag"] else 1 if r["hg"] == r["ag"] else 2
            chosen = ctx.result(fixture)
            entry = {"date": day.isoformat(), "home": r["home"], "away": r["away"], "y": y, "tier": chosen["tier"],
                     "hierarchy": chosen["p"], "league": ctx.base["result"]}
            if ctx.pooled is not None:
                try:
                    entry["pooled_unshrunk"] = [float(x) for x in ctx.pooled.predict(r["home"], r["away"]).home_draw_away]
                except (KeyError, ValueError):
                    pass
            role = ("P" if r["home"] in promoted.get(r["season"], set()) else "E") + ("P" if r["away"] in promoted.get(r["season"], set()) else "E")
            if role in ctx.prior_rates:
                entry["prior"] = ctx.prior_rates[role]["p"]
            m = mk.get((day.isoformat(), r["home"], r["away"]))
            if m:
                entry["market_close"] = m
            rows.append(entry)
        print(day, len(rows), file=sys.stderr)

    out = {"n": len(rows), "tiers_used": dict(sorted(defaultdict(int, {t: sum(r["tier"] == t for r in rows) for t in {r["tier"] for r in rows}}).items())),
           "date_range": [rows[0]["date"], rows[-1]["date"]], "models": {}}
    for name in ("hierarchy", "pooled_unshrunk", "prior", "league", "market_close"):
        subset = [r for r in rows if name in r]
        s = [score(r[name], r["y"]) for r in subset]
        entry = {"n": len(subset), **{k: round(float(np.mean([x[k] for x in s])), 4) for k in ("brier", "logloss", "rps")},
                 "top_pick_hit_rate": round(float(np.mean([int(np.argmax(r[name]) == r["y"]) for r in subset])), 4)}
        if name != "league":
            base = [score(r["league"], r["y"])["brier"] for r in subset]
            diffs = [a["brier"] - b for a, b in zip(s, base)]
            entry["delta_brier_vs_league"] = round(float(np.mean(diffs)), 4)
            entry["delta_brier_vs_league_ci95"] = bootstrap(diffs, [r["date"] for r in subset], rng)
        out["models"][name] = entry
    by_team = defaultdict(list)
    for r in rows:
        for team in (r["home"], r["away"]):
            if team in promoted.get("2526", set()) | promoted.get("2627", set()):
                by_team[team].append(score(r["hierarchy"], r["y"])["brier"])
    out["hierarchy_brier_by_promoted_team"] = {k: {"n": len(v), "brier": round(float(np.mean(v)), 4)} for k, v in sorted(by_team.items())}
    out["promoted_clubs"] = {k: sorted(v) for k, v in promoted.items()}
    (HERE / "results.json").write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    (HERE / "predictions.json").write_text(json.dumps(rows, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in out.items() if k != "promoted_clubs"}, indent=1))
    print(out["promoted_clubs"])


if __name__ == "__main__":
    main()
