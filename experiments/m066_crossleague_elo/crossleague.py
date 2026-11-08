"""Mission 066: does time decay or an Elo blend improve Dixon-Coles 1X2 across leagues?

Research only. Reads data/league_results.json (already in the repo, 5 leagues x 3+ seasons);
writes only results.json in this folder. No network access, no production change.

Why: M063 found dc_decay and ens_dc_elo trending better than dc_frozen on 409 Premier League
matches but not significant. This pools ~5,000 matches from BL1, ELC, FL1, PD and SA.

Pre-registered before any result was seen:
  baseline   dc_frozen  Dixon-Coles, unweighted (as production)
  challenger dc_decay   Dixon-Coles, time decay xi=0.0018/day
  challenger ens_dc_elo mean of dc_decay and an Elo-difference multinomial logit
  walk-forward, refit once per 7-day block (M063 refit every match day), burn-in = 2023/24,
  a fixture needs both teams seen in the training window and >=5 prior home / away matches.
  Metric RPS (primary), Brier, log loss. Paired block bootstrap over match days, 2,000 resamples.

Usage: python -I experiments/m066_crossleague_elo/crossleague.py
"""
import datetime as dt
import json
import math
import warnings
from collections import defaultdict
from pathlib import Path

import numpy as np
import penaltyblog as pb
from sklearn.linear_model import LogisticRegression

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parents[2]
XI = 0.0018
SEED = 66
BOOTSTRAP = 2000
BURN_IN = "2324"
ELO_K, ELO_HFA = 20.0, 60.0


def load():
    rows = json.loads((ROOT / "data" / "league_results.json").read_text(encoding="utf-8"))["results"]
    out = []
    for r in rows:
        if r.get("hg") is None or r.get("ag") is None:
            continue
        out.append({"c": r["c"], "s": r["s"], "date": dt.date.fromisoformat(r["d"]), "home": r["h"],
                    "away": r["a"], "hg": int(r["hg"]), "ag": int(r["ag"])})
    out.sort(key=lambda m: (m["date"], m["home"]))
    return out


def outcome(m):
    return 0 if m["hg"] > m["ag"] else 1 if m["hg"] == m["ag"] else 2


class Elo:
    def __init__(self):
        self.r = defaultdict(lambda: 1500.0)

    def diff(self, home, away):
        return (self.r[home] + ELO_HFA - self.r[away]) / 100.0

    def update(self, m):
        exp = 1 / (1 + 10 ** (-(self.r[m["home"]] + ELO_HFA - self.r[m["away"]]) / 400))
        score = 1.0 if m["hg"] > m["ag"] else 0.5 if m["hg"] == m["ag"] else 0.0
        delta = ELO_K * (score - exp)
        self.r[m["home"]] += delta
        self.r[m["away"]] -= delta


def rps(p, y):
    cp = np.cumsum(p)[:-1]
    co = np.cumsum([1.0 if i == y else 0.0 for i in range(3)])[:-1]
    return float(np.sum((cp - co) ** 2) / 2)


def score(p, y):
    p = np.clip(np.array(p, dtype=float), 1e-12, 1)
    p /= p.sum()
    oh = np.eye(3)[y]
    return {"rps": rps(p, y), "brier": float(np.sum((p - oh) ** 2)), "logloss": float(-math.log(p[y]))}


def fit_dc(prior, day, weighted):
    w = pb.models.dixon_coles_weights([m["date"] for m in prior], xi=XI, base_date=day) if weighted else None
    model = pb.models.DixonColesGoalModel([m["hg"] for m in prior], [m["ag"] for m in prior],
                                          [m["home"] for m in prior], [m["away"] for m in prior], weights=w)
    model.fit()
    return model


def run_league(code, matches):
    prior, rows, elo = [], [], Elo()   # rows: (elo_diff, result) for the Elo logit
    block_start, records = None, []
    models = None
    for m in matches:
        if block_start is None or (m["date"] - block_start).days >= 7:
            block_start = m["date"]
            models = None
            if len(prior) >= 150 and m["s"] != BURN_IN:
                models = {"frozen": fit_dc(prior, m["date"], False), "decay": fit_dc(prior, m["date"], True)}
                X = np.array([[r[0]] for r in rows]); y = np.array([r[1] for r in rows])
                models["elo"] = LogisticRegression(C=1.0, max_iter=1000).fit(X, y)
        if models is not None and m["s"] != BURN_IN:
            known = {t for p in prior for t in (p["home"], p["away"])}
            if (m["home"] in known and m["away"] in known
                    and sum(p["home"] == m["home"] for p in prior) >= 5
                    and sum(p["away"] == m["away"] for p in prior) >= 5):
                y = outcome(m)
                P = {"dc_frozen": [float(x) for x in models["frozen"].predict(m["home"], m["away"]).home_draw_away],
                     "dc_decay": [float(x) for x in models["decay"].predict(m["home"], m["away"]).home_draw_away]}
                P["elo_logit"] = [float(x) for x in models["elo"].predict_proba([[elo.diff(m["home"], m["away"])]])[0]]
                P["ens_dc_elo"] = list(np.mean([P["dc_decay"], P["elo_logit"]], axis=0))
                records.append({"league": code, "date": m["date"].isoformat(), "y": y,
                                "scores": {k: score(v, y) for k, v in P.items()}})
        prior.append(m)
        rows.append((elo.diff(m["home"], m["away"]), outcome(m)))
        elo.update(m)
    return records


def bootstrap(diffs, dates, rng):
    by_day = defaultdict(list)
    for d, x in zip(dates, diffs):
        by_day[d].append(x)
    sums = np.array([sum(v) for v in by_day.values()]); sizes = np.array([len(v) for v in by_day.values()])
    means = np.array([sums[p].sum() / sizes[p].sum() for p in (rng.integers(0, len(sums), len(sums)) for _ in range(BOOTSTRAP))])
    return [float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))]


def summarise(records, rng):
    out = {}
    for key in ("dc_frozen", "dc_decay", "elo_logit", "ens_dc_elo"):
        entry = {m: round(float(np.mean([r["scores"][key][m] for r in records])), 5) for m in ("rps", "brier", "logloss")}
        if key != "dc_frozen":
            for m in ("rps", "brier", "logloss"):
                diffs = [r["scores"][key][m] - r["scores"]["dc_frozen"][m] for r in records]
                ci = bootstrap(diffs, [r["date"] for r in records], rng)
                entry["d_" + m] = round(float(np.mean(diffs)), 5)
                entry["d_" + m + "_ci95"] = [round(ci[0], 5), round(ci[1], 5)]
        out[key] = entry
    return out


def main():
    rng = np.random.default_rng(SEED)
    matches = load()
    by_league = defaultdict(list)
    for m in matches:
        by_league[m["c"]].append(m)
    records = []
    for code, ms in sorted(by_league.items()):
        recs = run_league(code, ms)
        print(code, len(recs), flush=True)
        records += recs
    result = {"n": len(records), "pooled": summarise(records, rng),
              "per_league": {c: {"n": sum(r["league"] == c for r in records),
                                 **summarise([r for r in records if r["league"] == c], rng)} for c in by_league}}
    (Path(__file__).parent / "results.json").write_text(json.dumps(result, indent=1), encoding="utf-8")
    print(json.dumps(result["pooled"], indent=1))


if __name__ == "__main__":
    main()
