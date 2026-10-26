"""Mission 063 prediction challenge: frozen baselines vs open-source challengers.

Research only. Reads data/matches.json and the CC-BY-4.0 closing-odds research CSVs;
never writes to data/ or to any production ledger. Every prediction for a fixture
played on day D is made from matches played strictly before D (no same-day leakage).

Usage (isolated venv with requirements.txt from this folder):
    python -I experiments/m063_prediction_challenge/challenge.py
Outputs (this folder): results.json, predictions.csv, REPORT.md is written by hand
from results.json.
"""
import csv
import datetime as dt
import json
import math
import sys
import warnings
from collections import defaultdict
from pathlib import Path

import numpy as np
import penaltyblog as pb
from scipy.stats import nbinom, poisson
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression, PoissonRegressor
from sklearn.model_selection import TimeSeriesSplit

warnings.filterwarnings("ignore")

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DATA = ROOT / "data" / "matches.json"
ODDS = [ROOT / "experiments" / "raw_market_data" / name for name in
        ("premier_league_2025_26_closing_odds.csv", "premier_league_2026_27_odds.csv")]
ODDS_NAMES = {"Manchester City": "Man City", "Manchester Utd": "Man United", "Nottingham": "Nott'm Forest"}

# Pre-registered settings (fixed before any result was seen; not tuned on the test window).
EVAL_START = dt.date(2025, 8, 15)   # first day of 2025/26; 2024/25 is burn-in only
XI = 0.0018                         # penaltyblog default time decay per day (~Dixon & Coles 1997)
GLM_ALPHA = 0.01                    # mild ridge for team-strength GLMs
XG_BLEND = 0.5                      # goals/shot-proxy blend, as in callumfm/dixon-coles
LINES = {"goals": 2.5, "corners": 9.5, "cards": 3.5, "shots": 8.5}
COUNT_FIELDS = {"goals": ("FTHG", "FTAG"), "corners": ("HC", "AC"), "cards": ("HY", "AY"), "shots": ("HST", "AST")}
BOOTSTRAP = 2000
SEED = 63


def num(value):
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    return out if math.isfinite(out) else None


def load_matches():
    payload = json.loads(DATA.read_text(encoding="utf-8"))
    rows = []
    for r in payload["matches"]:
        try:
            day = dt.datetime.strptime(r["Date"], "%d/%m/%Y").date()
            hg, ag = int(r["FTHG"]), int(r["FTAG"])
        except (KeyError, TypeError, ValueError):
            continue
        outcome = "H" if hg > ag else "A" if ag > hg else "D"
        if r.get("FTR") != outcome or not (0 <= hg <= 30 and 0 <= ag <= 30):
            continue
        row = {"date": day, "home": r["HomeTeam"], "away": r["AwayTeam"], "hg": hg, "ag": ag,
               "result": outcome, "season": r.get("season")}
        for field in ("HC", "AC", "HY", "AY", "HST", "AST", "HS", "AS"):
            row[field] = num(r.get(field))
        row["FTHG"], row["FTAG"] = hg, ag
        rows.append(row)
    counts = defaultdict(int)
    for row in rows:
        counts[(row["date"], row["home"], row["away"])] += 1
    rows = [row for row in rows if counts[(row["date"], row["home"], row["away"])] == 1]
    rows.sort(key=lambda row: (row["date"], row["home"]))
    return rows


def load_market():
    market = {}
    for path in ODDS:
        with path.open(encoding="utf-8") as handle:
            for r in csv.DictReader(handle):
                home = ODDS_NAMES.get(r["home_team"], r["home_team"])
                away = ODDS_NAMES.get(r["away_team"], r["away_team"])
                probs = [num(r.get(k)) for k in ("close_home_prob", "close_draw_prob", "close_away_prob")]
                if None in probs:
                    continue
                total = sum(probs)
                market[(r["date_uk"], home, away)] = {
                    "1x2": [p / total for p in probs],
                    "over25": num(r.get("close_over25_prob")),
                    "btts": num(r.get("close_btts_prob")),
                }
    return market


# ---------------------------------------------------------------- probability helpers
def grid_from_rates(lh, la, max_goals=10):
    h = poisson.pmf(np.arange(max_goals + 1), lh)
    a = poisson.pmf(np.arange(max_goals + 1), la)
    grid = np.outer(h, a)
    return grid / grid.sum()


def markets_from_grid(grid):
    n = grid.shape[0]
    i, j = np.indices(grid.shape)
    return {
        "1x2": [float(grid[i > j].sum()), float(grid[i == j].sum()), float(grid[i < j].sum())],
        "over25": float(grid[(i + j) > 2.5].sum()),
        "btts": float(grid[1:, 1:].sum()),
    }


def markets_from_pb(pred):
    return {"1x2": [float(x) for x in pred.home_draw_away],
            "over25": float(pred.total_goals("over", 2.5)),
            "btts": float(pred.btts_yes)}


def count_over(mean, line, dispersion=None):
    """P(count > line); negative binomial when dispersion (var/mean) > 1, else Poisson."""
    k = math.floor(line)
    if dispersion and dispersion > 1.0001:
        r = mean / (dispersion - 1)
        return float(1 - nbinom.cdf(k, r, r / (r + mean)))
    return float(1 - poisson.cdf(k, mean))


# ---------------------------------------------------------------- baselines (exact replicas)
def rolling_venue(prior, home, away, home_field, away_field):
    """MatchIQ's current displayed method: last 10 home games of the home side, last 10 away
    games of the away side; expected total = (hF + aF_conceded + aA + hA_conceded) / 2."""
    h = [m for m in prior if m["home"] == home and m[home_field] is not None and m[away_field] is not None][-10:]
    a = [m for m in prior if m["away"] == away and m[home_field] is not None and m[away_field] is not None][-10:]
    if len(h) < 5 or len(a) < 5:
        return None
    avg = lambda xs: sum(xs) / len(xs)
    home_rate = (avg([m[home_field] for m in h]) + avg([m[home_field] for m in a])) / 2
    away_rate = (avg([m[away_field] for m in a]) + avg([m[away_field] for m in h])) / 2
    return home_rate, away_rate


def eligible(prior, home, away):
    """Frozen Match Winner and Corners governance: >=5 prior home / away matches."""
    return sum(m["home"] == home for m in prior) >= 5 and sum(m["away"] == away for m in prior) >= 5


def fit_pb(model_cls, prior, day, weighted):
    weights = pb.models.dixon_coles_weights([m["date"] for m in prior], xi=XI, base_date=day) if weighted else None
    model = model_cls([m["hg"] for m in prior], [m["ag"] for m in prior],
                      [m["home"] for m in prior], [m["away"] for m in prior], weights=weights)
    model.fit()
    return model


def fit_team_glm(prior, day, home_field, away_field, blend=None):
    """Team attack/defence Poisson GLM with time decay. `blend` mixes a shot-based proxy into
    the goals target (xG-informed variant)."""
    teams = sorted({m["home"] for m in prior} | {m["away"] for m in prior})
    index = {t: i for i, t in enumerate(teams)}
    n = len(teams)
    rows, target, weight = [], [], []
    conv = None
    if blend:
        g = sum(m["hg"] + m["ag"] for m in prior if m["HST"] is not None and m["AST"] is not None)
        s = sum(m["HST"] + m["AST"] for m in prior if m["HST"] is not None and m["AST"] is not None)
        conv = g / s
    for m in prior:
        hv, av = m[home_field], m[away_field]
        if hv is None or av is None:
            continue
        if blend:
            if m["HST"] is None or m["AST"] is None:
                continue
            hv = (1 - blend) * hv + blend * conv * m["HST"]
            av = (1 - blend) * av + blend * conv * m["AST"]
        w = math.exp(-XI * (day - m["date"]).days)
        for att, dfn, is_home, value in ((m["home"], m["away"], 1, hv), (m["away"], m["home"], 0, av)):
            x = np.zeros(2 * n + 1)
            x[index[att]] = 1
            x[n + index[dfn]] = 1
            x[2 * n] = is_home
            rows.append(x); target.append(value); weight.append(w)
    model = PoissonRegressor(alpha=GLM_ALPHA, max_iter=1000)
    model.fit(np.array(rows), np.array(target), sample_weight=np.array(weight))

    def rate(att, dfn, is_home):
        if att not in index or dfn not in index:
            return None
        x = np.zeros(2 * n + 1)
        x[index[att]] = 1
        x[n + index[dfn]] = 1
        x[2 * n] = is_home
        return float(model.predict(x[None, :])[0])
    return rate


# ---------------------------------------------------------------- sequential rating features
class SequentialFeatures:
    """Pre-match Elo / pi-rating / rolling-form features computed strictly from earlier days."""

    def __init__(self):
        self.elo = pb.ratings.Elo(k=20, home_field_advantage=60)
        self.pi = pb.ratings.PiRatingSystem()
        self.history = defaultdict(list)  # team -> list of (date, venue, gf, ga, sotf, sota, pts)
        self.rows = []                    # (date, features, result_index)

    def features(self, home, away, day):
        def form(team, venue=None, n=5):
            games = [g for g in self.history[team] if venue is None or g[1] == venue][-n:]
            if len(games) < 3:
                return [np.nan] * 5
            arr = np.array([g[2:] for g in games], dtype=float)
            return list(np.nanmean(arr, axis=0))

        def rest(team):
            return (day - self.history[team][-1][0]).days if self.history[team] else np.nan

        elo_diff = (self.elo.get_team_rating(home) + self.elo.hfa - self.elo.get_team_rating(away)) / 100
        pi_gd = self.pi.expected_goal_difference(home, away)
        return [elo_diff, pi_gd] + form(home) + form(away) + form(home, "H") + form(away, "A") + [rest(home), rest(away)]

    def update(self, day_matches):
        day = day_matches[0]["date"]
        feats = [(m, self.features(m["home"], m["away"], day)) for m in day_matches]
        for m, f in feats:
            self.rows.append((day, f, "HDA".index(m["result"])))
            self.elo.update_ratings(m["home"], m["away"], "HDA".index(m["result"]))
            self.pi.update_ratings(m["home"], m["away"], m["hg"] - m["ag"], day)
            pts_h = 3 if m["result"] == "H" else 1 if m["result"] == "D" else 0
            pts_a = 3 if m["result"] == "A" else 1 if m["result"] == "D" else 0
            self.history[m["home"]].append((day, "H", m["hg"], m["ag"], m["HST"], m["AST"], pts_h))
            self.history[m["away"]].append((day, "A", m["ag"], m["hg"], m["AST"], m["HST"], pts_a))


def fit_rating_logit(rows, column):
    X = np.array([[r[1][column]] for r in rows[60:]])
    y = np.array([r[2] for r in rows[60:]])
    return LogisticRegression(C=1.0, max_iter=1000).fit(X, y)


def fit_hgb(rows):
    X = np.array([r[1] for r in rows[60:]], dtype=float)
    y = np.array([r[2] for r in rows[60:]])
    base = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=150,
                                          l2_regularization=1.0, random_state=SEED)
    model = CalibratedClassifierCV(base, method="sigmoid", cv=TimeSeriesSplit(n_splits=3))
    return model.fit(X, y)


def fit_feature_logit(rows):
    X = np.array([r[1] for r in rows[60:]], dtype=float)
    means = np.nanmean(X, axis=0)
    X = np.where(np.isnan(X), means, X)
    mu, sd = X.mean(axis=0), X.std(axis=0) + 1e-9
    y = np.array([r[2] for r in rows[60:]])
    model = LogisticRegression(C=0.1, max_iter=2000).fit((X - mu) / sd, y)
    return lambda f: model.predict_proba(((np.where(np.isnan(f), means, f) - mu) / sd)[None, :])[0]


# ---------------------------------------------------------------- scoring
def rps(p, outcome_index):
    cum_p = np.cumsum(p)[:-1]
    cum_o = np.cumsum([1.0 if i == outcome_index else 0.0 for i in range(3)])[:-1]
    return float(np.sum((cum_p - cum_o) ** 2) / 2)


def score_1x2(p, outcome_index):
    p = np.clip(np.array(p, dtype=float), 1e-12, 1)
    p = p / p.sum()
    y = np.eye(3)[outcome_index]
    return {"brier": float(np.sum((p - y) ** 2)), "logloss": float(-math.log(p[outcome_index])), "rps": rps(p, outcome_index)}


def score_binary(p, y):
    p = min(max(p, 1e-12), 1 - 1e-12)
    return {"brier": (p - y) ** 2, "logloss": -(y * math.log(p) + (1 - y) * math.log(1 - p))}


def ece(probs, outcomes, bins=10):
    probs, outcomes = np.array(probs), np.array(outcomes)
    total = 0.0
    for b in range(bins):
        mask = (probs >= b / bins) & (probs < (b + 1) / bins if b < bins - 1 else probs <= 1)
        if mask.any():
            total += mask.sum() / len(probs) * abs(probs[mask].mean() - outcomes[mask].mean())
    return float(total)


def reliability(probs, outcomes, edges=(0, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0001)):
    probs, outcomes = np.array(probs), np.array(outcomes)
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        mask = (probs >= lo) & (probs < hi)
        if mask.any():
            out.append({"band": f"{int(lo * 100)}-{min(100, int(hi * 100))}%", "n": int(mask.sum()),
                        "mean_predicted": round(float(probs[mask].mean()), 4),
                        "observed_rate": round(float(outcomes[mask].mean()), 4)})
    return out


def paired_bootstrap(diffs, dates, rng):
    """Block bootstrap over match days: CI for mean(challenger - baseline)."""
    by_day = defaultdict(list)
    for d, x in zip(dates, diffs):
        by_day[d].append(x)
    blocks = [np.array(v) for v in by_day.values()]
    sums = np.array([b.sum() for b in blocks]); sizes = np.array([len(b) for b in blocks])
    means = []
    for _ in range(BOOTSTRAP):
        pick = rng.integers(0, len(blocks), len(blocks))
        means.append(sums[pick].sum() / sizes[pick].sum())
    means = np.array(means)
    return [float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))], float((means >= 0).mean())


# ---------------------------------------------------------------- walk-forward run
def main():
    rng = np.random.default_rng(SEED)
    matches = load_matches()
    market = load_market()
    days = sorted({m["date"] for m in matches})
    seq = SequentialFeatures()
    records = []
    prior = []
    for day in days:
        todays = [m for m in matches if m["date"] == day]
        if day >= EVAL_START:
            preds = predict_day(prior, todays, day, seq, market)
            records.extend(preds)
            print(day, len(prior), "prior;", len(preds), "scored", file=sys.stderr)
        seq.update(todays)
        prior.extend(todays)
    write_outputs(records, rng)


def predict_day(prior, todays, day, seq, market):
    dc_frozen = fit_pb(pb.models.DixonColesGoalModel, prior, day, weighted=False)
    dc_decay = fit_pb(pb.models.DixonColesGoalModel, prior, day, weighted=True)
    bp_decay = fit_pb(pb.models.BivariatePoissonGoalModel, prior, day, weighted=True)
    xg_rate = fit_team_glm(prior, day, "FTHG", "FTAG", blend=XG_BLEND)
    count_rate = {k: fit_team_glm(prior, day, *COUNT_FIELDS[k]) for k in ("corners", "cards", "shots")}
    elo_logit = fit_rating_logit(seq.rows, 0)
    pi_logit = fit_rating_logit(seq.rows, 1)
    hgb = fit_hgb(seq.rows)
    feat_logit = fit_feature_logit(seq.rows)

    # Prior-only league base rates and dispersion (var/mean) for count markets.
    base = {}
    for key, (hf, af) in COUNT_FIELDS.items():
        totals = [m[hf] + m[af] for m in prior if m[hf] is not None and m[af] is not None]
        base[key] = (float(np.mean([t > LINES[key] for t in totals])), float(np.var(totals) / np.mean(totals)))
    btts_base = float(np.mean([m["hg"] > 0 and m["ag"] > 0 for m in prior]))
    draw_freq = np.bincount([("HDA".index(m["result"])) for m in prior], minlength=3) / len(prior)

    out = []
    for m in todays:
        home, away = m["home"], m["away"]
        rec ={"date": m["date"].isoformat(), "season": m["season"], "home": home, "away": away,
               "result": m["result"], "goals": m["hg"] + m["ag"], "btts": int(m["hg"] > 0 and m["ag"] > 0),
               "eligible": eligible(prior, home, away), "p": {}}
        for key, (hf, af) in COUNT_FIELDS.items():
            rec[key + "_total"] = None if m[hf] is None or m[af] is None else m[hf] + m[af]
        known = {t for p in prior for t in (p["home"], p["away"])}
        if home not in known or away not in known:
            rec["eligible"] = False
            out.append(rec)
            continue
        P = rec["p"]
        P["dc_frozen"] = markets_from_pb(dc_frozen.predict(home, away))
        P["dc_decay"] = markets_from_pb(dc_decay.predict(home, away))
        P["bp_decay"] = markets_from_pb(bp_decay.predict(home, away))
        P["xg_glm"] = markets_from_grid(grid_from_rates(xg_rate(home, away, 1), xg_rate(away, home, 0)))
        f = np.array(seq.features(home, away, m["date"]), dtype=float)
        P["elo_logit"] = {"1x2": [float(x) for x in elo_logit.predict_proba([[f[0]]])[0]]}
        P["pi_logit"] = {"1x2": [float(x) for x in pi_logit.predict_proba([[f[1]]])[0]]}
        P["hgb_features"] = {"1x2": [float(x) for x in hgb.predict_proba(f[None, :])[0]]}
        P["logit_features"] = {"1x2": [float(x) for x in feat_logit(f)]}
        P["base_rate"] = {"1x2": [float(x) for x in draw_freq], "btts": btts_base}
        P["ens_dc_elo"] = {"1x2": list(np.mean([P["dc_decay"]["1x2"], P["elo_logit"]["1x2"]], axis=0))}
        P["ens_dc_xg"] = {k: (list(np.mean([P["dc_decay"][k], P["xg_glm"][k]], axis=0)) if k == "1x2"
                              else (P["dc_decay"][k] + P["xg_glm"][k]) / 2) for k in ("1x2", "over25", "btts")}
        mk = market.get((rec["date"], home, away))
        if mk:
            P["market_close"] = {k: v for k, v in mk.items() if v is not None}

        # Count markets: current displayed rolling method and challengers.
        for key, (hf, af) in COUNT_FIELDS.items():
            line = LINES[key]
            rv = rolling_venue(prior, home, away, hf, af)
            mk_key = "over25" if key == "goals" else key
            if rv:
                P.setdefault("rolling10", {})[mk_key] = count_over(sum(rv), line)
                P.setdefault("rolling10_nb", {})[mk_key] = count_over(sum(rv), line, base[key][1])
                if key == "goals":
                    gb = (1 - math.exp(-rv[0])) * (1 - math.exp(-rv[1]))
                    P["rolling10"]["btts"] = gb
                    P["rolling10_nb"]["btts"] = gb
            P["base_rate"][mk_key] = base[key][0]
            if key != "goals":
                lam = count_rate[key](home, away, 1) + count_rate[key](away, home, 0)
                P.setdefault("team_glm", {})[key] = count_over(lam, line)
                P.setdefault("team_glm_nb", {})[key] = count_over(lam, line, base[key][1])
        out.append(rec)
    return out


MARKETS = {
    "1x2": {"baseline": "dc_frozen", "outcome": lambda r: "HDA".index(r["result"])},
    "over25": {"baseline": "rolling10", "outcome": lambda r: int(r["goals"] > 2.5)},
    "btts": {"baseline": "rolling10", "outcome": lambda r: r["btts"]},
    "corners": {"baseline": "rolling10", "outcome": lambda r: None if r["corners_total"] is None else int(r["corners_total"] > 9.5)},
    "cards": {"baseline": "rolling10", "outcome": lambda r: None if r["cards_total"] is None else int(r["cards_total"] > 3.5)},
    "shots": {"baseline": "rolling10", "outcome": lambda r: None if r["shots_total"] is None else int(r["shots_total"] > 8.5)},
}


def evaluate(records, market_key, spec, rng, require=None):
    baseline = spec["baseline"]
    pool = [r for r in records if r["eligible"] and baseline in r["p"] and market_key in r["p"][baseline]
            and spec["outcome"](r) is not None]
    models = sorted({name for r in pool for name, v in r["p"].items() if market_key in v})
    # Identical fixtures: every model except the market benchmark must cover the whole pool.
    models = [mname for mname in models if all(market_key in r["p"].get(mname, {}) for r in pool) or mname == "market_close"]
    result = {"n": len(pool), "baseline": baseline,
              "date_range": [min(r["date"] for r in pool), max(r["date"] for r in pool)], "models": {}}
    base_scores = None
    for mname in [baseline] + [x for x in models if x != baseline]:
        subset = pool if mname != "market_close" else [r for r in pool if "market_close" in r["p"] and market_key in r["p"]["market_close"]]
        scores, top_probs, top_hits, probs, ys = [], [], [], [], []
        for r in subset:
            p, y = r["p"][mname][market_key], spec["outcome"](r)
            if market_key == "1x2":
                s = score_1x2(p, y)
                top = int(np.argmax(p)); top_probs.append(max(p)); top_hits.append(int(top == y))
            else:
                s = score_binary(p, y)
                probs.append(p); ys.append(y)
                top_probs.append(max(p, 1 - p)); top_hits.append(int((p >= 0.5) == bool(y)))
            scores.append(s)
        entry = {"n": len(subset)}
        for metric in scores[0]:
            entry[metric] = round(float(np.mean([s[metric] for s in scores])), 5)
        entry["top_pick_hit_rate"] = round(float(np.mean(top_hits)), 4)
        entry["ece_top_pick"] = round(ece(top_probs, top_hits), 4)
        entry["reliability_top_pick"] = reliability(top_probs, top_hits)
        if market_key != "1x2":
            entry["ece"] = round(ece(probs, ys), 4)
        by_season = defaultdict(list)
        for r, s in zip(subset, scores):
            by_season[r["season"]].append(s["brier"])
        entry["brier_by_season"] = {k: {"n": len(v), "brier": round(float(np.mean(v)), 5)} for k, v in sorted(by_season.items())}
        if mname == baseline:
            base_scores = {(r["date"], r["home"]): s for r, s in zip(subset, scores)}
        else:
            keys = [(r["date"], r["home"]) for r in subset]
            for metric in ("brier", "logloss") + (("rps",) if market_key == "1x2" else ()):
                diffs = [s[metric] - base_scores[k][metric] for s, k in zip(scores, keys)]
                ci, p_worse = paired_bootstrap(diffs, [k[0] for k in keys], rng)
                entry["delta_" + metric] = round(float(np.mean(diffs)), 5)
                entry["delta_" + metric + "_ci95"] = [round(ci[0], 5), round(ci[1], 5)]
                entry["p_not_better_" + metric] = round(p_worse, 4)
            entry["same_fixtures_as_baseline"] = len(subset) == len(pool)
        result["models"][mname] = entry
    return result


def write_outputs(records, rng):
    results = {"generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
               "settings": {"eval_start": EVAL_START.isoformat(), "xi": XI, "glm_alpha": GLM_ALPHA,
                            "xg_blend": XG_BLEND, "bootstrap": BOOTSTRAP, "seed": SEED,
                            "penaltyblog": pb.__version__},
               "markets": {}}
    for key, spec in MARKETS.items():
        results["markets"][key] = evaluate(records, key, spec, rng)
    (HERE / "results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    with (HERE / "predictions.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["date", "home", "away", "eligible", "model", "market", "probability"])
        for r in records:
            for mname, markets in r["p"].items():
                for mk, p in markets.items():
                    writer.writerow([r["date"], r["home"], r["away"], r["eligible"], mname, mk,
                                     json.dumps([round(x, 6) for x in p]) if isinstance(p, list) else round(p, 6)])
    print(json.dumps({k: {m: {x: v.get(x) for x in ("n", "brier", "logloss", "rps", "delta_brier", "delta_brier_ci95")}
                          for m, v in res["models"].items()} for k, res in results["markets"].items()}, indent=1))


if __name__ == "__main__":
    main()
