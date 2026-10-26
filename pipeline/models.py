"""MatchIQ prediction hierarchy and market estimates.

Match result (1X2), first tier that applies:
  T1 frozen   dixon-coles-v1-forward-frozen: Premier League results only, unweighted;
              requires >=5 prior home games (home side) and >=5 prior away games (away side).
              Identical to match_winner_forward.py; an existing frozen-ledger record is used verbatim.
  T2 pooled   dc-pooled-shrunk50-v1: Dixon-Coles with time decay over Premier League AND
              Championship results (clubs that moved between divisions link the two
              scales), then shrunk 50% toward Premier League average frequencies. The
              unshrunk pooled model under-rated promoted clubs (23% predicted vs 32%
              observed wins, 41 backtest fixtures). Requires >=10 pooled matches per side
              in the last 400 days.
  T3 league   league-average-v1: Premier League home/draw/away frequencies.
A promoted-club frequency prior was tested and rejected (Brier 0.746 vs 0.630 league).
No tier uses bookmaker odds. A market-derived estimate is only ever shown separately.

Goals, BTTS, corners, cards and shots: provisional blend = 30% model + 70% league
average (pre-registered; Mission 063/064 backtests show it is statistically
indistinguishable from the league average, so it is labelled "no proven edge").
"""
import datetime as dt
import math
from collections import Counter, defaultdict

import numpy as np
import penaltyblog as pb
from scipy.stats import poisson

from .fairodds import fair_odds

XI = 0.0018
BLEND_MODEL_WEIGHT = 0.3
POOLED_MIN_MATCHES = 10
POOLED_WINDOW_DAYS = 400
LINES = {"goals": (1.5, 2.5, 3.5), "corners": (8.5, 9.5, 10.5), "cards": (2.5, 3.5, 4.5), "shots": (7.5, 8.5, 9.5)}
MAIN_LINE = {"goals": 2.5, "corners": 9.5, "cards": 3.5, "shots": 8.5}
STAT_FIELDS = {"goals": ("FTHG", "FTAG"), "corners": ("HC", "AC"), "cards": ("HY", "AY"), "shots": ("HST", "AST")}
MARKET_NAMES = {"result": "Match result", "goals": "Total goals", "btts": "Both teams to score",
                "corners": "Total corners", "cards": "Total cards (yellow)", "shots": "Shots on target"}
POOLED_SHRINK = 0.5
LEAGUE_MODEL_VERSION = "dc-league-v1"  # kept out of VERSIONS: VERSIONS feeds the Premier League input fingerprint
VERSIONS = {"T1": "dixon-coles-v1-forward-frozen", "T2": "dc-pooled-shrunk50-v1", "T3": "league-average-v1",
            "blend": "blend30-league-v1", "corners_frozen": "v0.9-frozen-poisson"}
SHADOW_VERSION = "dc-decay-epl-v1-shadow"


def stat(row, field):
    value = (row.get("stats") or {}).get(field)
    if field in ("FTHG", "FTAG"):
        value = row["hg"] if field == "FTHG" else row["ag"]
    return None if value is None else float(value)


def poisson_over(mean, line):
    return float(1 - poisson.cdf(math.floor(line), mean)) if mean and mean > 0 else None


class Context:
    """Everything fitted from results strictly before `as_of`. Built once per run (or
    once per backtest day) so every fixture on that day sees identical inputs."""

    def __init__(self, results, as_of, promoted_by_season=None, frozen_ledger=None, competition="PL", league_name="Premier League", validation=None):
        self.as_of = as_of
        self.competition, self.league_name, self.validation = competition, league_name, validation or {}
        self.prior = sorted([r for r in results if r["date"] < as_of], key=lambda r: r["date"])
        self.epl = [r for r in self.prior if r["competition"] == competition]  # the league being predicted
        self.frozen_ledger = frozen_ledger or {}
        self.promoted_by_season = promoted_by_season or {}
        self.home_counts = Counter(r["home"] for r in self.epl)
        self.away_counts = Counter(r["away"] for r in self.epl)
        other = competition != "PL"  # frozen/pooled/shadow models exist for the Premier League only
        self.frozen = self._fit(self.epl, weighted=False) if len(self.epl) > 100 and not other else None
        window = as_of - dt.timedelta(days=POOLED_WINDOW_DAYS)
        self.pooled_counts = Counter()
        for r in self.prior:
            if r["date"] >= window:
                self.pooled_counts[r["home"]] += 1
                self.pooled_counts[r["away"]] += 1
        self.pooled = self._fit(self.prior, weighted=True) if len(self.prior) > 100 and not other else None
        self.shadow = self._fit(self.epl, weighted=True) if len(self.epl) > 100 and not other else None
        self.league_model = self._fit(self.epl, weighted=True) if other and len(self.epl) > 100 else None
        self.base = self._base_rates()
        self.prior_rates = self._promoted_prior()

    @staticmethod
    def _fit(rows, weighted):
        weights = pb.models.dixon_coles_weights([r["date"] for r in rows], xi=XI, base_date=rows[-1]["date"] + dt.timedelta(days=1)) if weighted else None
        model = pb.models.DixonColesGoalModel([r["hg"] for r in rows], [r["ag"] for r in rows],
                                              [r["home"] for r in rows], [r["away"] for r in rows], weights=weights)
        model.fit()
        return model

    def _base_rates(self):
        base = {"result": [0.0, 0.0, 0.0], "btts": None, "lines": {}}
        if not self.epl:
            return base
        counts = Counter("HDA"[0 if r["hg"] > r["ag"] else 1 if r["hg"] == r["ag"] else 2] for r in self.epl)
        base["result"] = [counts[k] / len(self.epl) for k in "HDA"]
        base["btts"] = sum(r["hg"] > 0 and r["ag"] > 0 for r in self.epl) / len(self.epl)
        for market, (hf, af) in STAT_FIELDS.items():
            totals = [stat(r, hf) + stat(r, af) for r in self.epl if stat(r, hf) is not None and stat(r, af) is not None]
            base["lines"][market] = {"n": len(totals), "mean": float(np.mean(totals)) if totals else None,
                                     **{line: sum(t > line for t in totals) / len(totals) for line in LINES[market]}} if totals else None
        return base

    def _promoted_prior(self):
        """Outcome frequencies by role in fixtures where a club is in its first
        top-flight season (known from prior-season membership only)."""
        roles = defaultdict(Counter)
        for r in self.epl:
            promoted = self.promoted_by_season.get(r["season"], set())
            role = ("P" if r["home"] in promoted else "E") + ("P" if r["away"] in promoted else "E")
            roles[role]["HDA"[0 if r["hg"] > r["ag"] else 1 if r["hg"] == r["ag"] else 2]] += 1
        return {role: {"n": sum(c.values()), "p": [c[k] / sum(c.values()) for k in "HDA"]} for role, c in roles.items() if sum(c.values()) >= 30}

    # ---------------------------------------------------------------- match result tiers
    def frozen_eligible(self, home, away):
        return self.frozen is not None and self.home_counts[home] >= 5 and self.away_counts[away] >= 5

    def league_result(self, fixture):
        """Other leagues: Dixon-Coles with time decay fitted on that league's own results.
        A club with fewer than POOLED_MIN_MATCHES recent matches (a newly promoted side)
        falls back to the league average, because no second-division data is held."""
        home, away = fixture["home"], fixture["away"]
        if self.league_model is not None and min(self.pooled_counts[home], self.pooled_counts[away]) >= POOLED_MIN_MATCHES:
            pred = self.league_model.predict(home, away)
            return {"tier": "L1", "p": [float(x) for x in pred.home_draw_away], "grid": pred, "note": f"{self.league_name} Dixon-Coles fitted on {self.league_name} results only",
                    "training_matches": len(self.epl)}
        return {"tier": "T3", "p": self.base["result"], "note": f"{self.league_name} average result frequencies (not enough recent matches for one of the clubs)",
                "training_matches": len(self.epl)}

    def result(self, fixture):
        home, away = fixture["home"], fixture["away"]
        if self.competition != "PL":
            return self.league_result(fixture)
        ledger = self.frozen_ledger.get((fixture["date"].isoformat(), home, away))
        if ledger:
            p = [ledger["probabilities"][k] for k in "HDA"]
            return {"tier": "T1", "p": p, "grid_model": self.frozen, "note": "Frozen ledger record, written before kick-off",
                    "training_matches": ledger.get("training_matches")}
        if self.frozen_eligible(home, away):
            pred = self.frozen.predict(home, away)
            return {"tier": "T1", "p": [float(x) for x in pred.home_draw_away], "grid": pred, "grid_model": self.frozen,
                    "note": "Frozen Dixon-Coles v1", "training_matches": len(self.epl)}
        if self.pooled is not None and min(self.pooled_counts[home], self.pooled_counts[away]) >= POOLED_MIN_MATCHES:
            pred = self.pooled.predict(home, away)
            pooled = [float(x) for x in pred.home_draw_away]
            p = [POOLED_SHRINK * a + (1 - POOLED_SHRINK) * b for a, b in zip(pooled, self.base["result"])]
            return {"tier": "T2", "p": p, "grid": pred, "pooled_raw": pooled,
                    "note": "Premier League + Championship Dixon-Coles, shrunk 50% toward league averages",
                    "training_matches": len(self.prior)}
        return {"tier": "T3", "p": self.base["result"], "note": "Premier League average result frequencies",
                "training_matches": len(self.epl)}

    # ---------------------------------------------------------------- venue form
    def venue_rows(self, team, venue, field_pair=None, n=10):
        rows = [r for r in self.epl if (r["home"] if venue == "H" else r["away"]) == team]
        if field_pair:
            rows = [r for r in rows if stat(r, field_pair[0]) is not None and stat(r, field_pair[1]) is not None]
        return rows[-n:]

    def form(self, team, venue, n=5):
        rows = self.venue_rows(team, venue, n=n)
        out = []
        for r in rows:
            gf, ga = (r["hg"], r["ag"]) if venue == "H" else (r["ag"], r["hg"])
            out.append({"date": r["date"].isoformat(), "opponent": r["away"] if venue == "H" else r["home"],
                        "gf": gf, "ga": ga, "res": "W" if gf > ga else "L" if gf < ga else "D"})
        return out

    def rolling_mean(self, market, home, away):
        """MatchIQ's established venue method (same as frozen corners v0.9)."""
        pair = STAT_FIELDS[market]
        h = self.venue_rows(home, "H", pair)
        a = self.venue_rows(away, "A", pair)
        if len(h) < 5 or len(a) < 5:
            return None, len(h), len(a)
        avg = lambda xs: sum(xs) / len(xs)
        home_rate = (avg([stat(r, pair[0]) for r in h]) + avg([stat(r, pair[0]) for r in a])) / 2
        away_rate = (avg([stat(r, pair[1]) for r in a]) + avg([stat(r, pair[1]) for r in h])) / 2
        return home_rate + away_rate, len(h), len(a)


def shadow_result(fixture, ctx):
    """Shadow challenger (Mission 063's best simple candidate): Dixon-Coles with time
    decay on Premier League results. Recorded for evaluation only, never displayed as
    a prediction, and only for fixtures the frozen model also covers."""
    if ctx.shadow is None or not ctx.frozen_eligible(fixture["home"], fixture["away"]):
        return None
    p = [float(x) for x in ctx.shadow.predict(fixture["home"], fixture["away"]).home_draw_away]
    labels = [f"{fixture['home']} win", "Draw", f"{fixture['away']} win"]
    sels = [_sel(k, l, x) for k, l, x in zip("HDA", labels, p)]
    return {"result": {"market": "result", "model_version": SHADOW_VERSION, "tier": "shadow",
                       "evidence": {"status": "shadow", "strength": "none"}, "pick": max(sels, key=lambda s: s["p"]), "selections": sels}}


def _sel(key, label, p):
    return {"key": key, "label": label, "p": round(float(p), 4), "fair_odds": fair_odds(p)}


def league_evidence(ctx, market, has_inputs, label="the model"):
    """Evidence block for the blended markets. Premier League keeps its Mission 063/064
    wording; other leagues use their own walk-forward backtest (data/league_validation.json)."""
    if ctx is None or ctx.competition == "PL":
        return {"status": "provisional", "strength": "none" if not has_inputs else "weak",
                "summary": "Backtests show no proven edge over the league average (409 matches). Read this as the league rate nudged by " + label + "."
                if has_inputs else "No team-level data for this market; this is the Premier League average."}
    v = (ctx.validation.get("markets") or {}).get(market)
    if not v:
        return {"status": "provisional", "strength": "none", "summary": f"Not yet backtested for the {ctx.league_name}: read this as the {ctx.league_name} rate."}
    ok = has_inputs and v["blend_brier"] <= v["league_brier"] + 0.0005
    return {"status": "provisional", "strength": "weak" if ok else "none",
            "summary": f"{ctx.league_name} backtest ({v['n']} matches, {ctx.validation.get('test_season_label')}): Brier {v['blend_brier']:.3f} against {v['league_brier']:.3f} for the league average. "
                       + (f"No proven edge: read this as the league rate nudged by {label}." if ok else "No better than the league average, so this is shown as the league rate.")}


def _ou_market(market, lines_p, base, model_label, model_note, inputs, explanation, model_version, ctx=None):
    lines = []
    for line, p_model in lines_p.items():
        base_p = base[line]
        p = BLEND_MODEL_WEIGHT * p_model + (1 - BLEND_MODEL_WEIGHT) * base_p if p_model is not None else base_p
        lines.append({"line": line, "over": _sel("over", f"Over {line}", p), "under": _sel("under", f"Under {line}", 1 - p),
                      "model_p": None if p_model is None else round(p_model, 4), "league_p": round(base_p, 4)})
    main = next(x for x in lines if x["line"] == MAIN_LINE[market])
    pick = main["over"] if main["over"]["p"] >= 0.5 else main["under"]
    return {"market": market, "name": MARKET_NAMES[market], "model_version": model_version,
            "evidence": league_evidence(ctx, market, any(v is not None for v in lines_p.values()), model_label),
            "pick": {**pick, "line": main["line"]}, "lines": lines, "inputs": inputs, "explanation": explanation, "method": model_note}


def predict(fixture, ctx, evidence=None):
    """All markets for one fixture. Uses only ctx (data before kickoff day)."""
    home, away = fixture["home"], fixture["away"]
    evidence = evidence or {}
    res = ctx.result(fixture)
    labels = [f"{home} win", "Draw", f"{away} win"]
    selections = [_sel(k, l, p) for k, l, p in zip("HDA", labels, res["p"])]
    pick = max(selections, key=lambda s: s["p"])
    tier_evidence = evidence.get(res["tier"], {})
    result_market = {
        "market": "result", "name": MARKET_NAMES["result"], "tier": res["tier"], "model_version": VERSIONS.get(res["tier"], LEAGUE_MODEL_VERSION),
        "evidence": {"status": "validated" if res["tier"] == "T1" else "provisional",
                     "strength": tier_evidence.get("strength", {"T1": "moderate", "T2": "weak"}.get(res["tier"], "none")),
                     "summary": tier_evidence.get("summary", res["note"])},
        "pick": pick, "selections": selections, "method": res["note"], "training_matches": res.get("training_matches"),
        "form": {"home": ctx.form(home, "H"), "away": ctx.form(away, "A")},
        "venue_games": {"home": ctx.home_counts[home], "away": ctx.away_counts[away]},
        "league_p": [round(x, 4) for x in ctx.base["result"]],
        "pooled_matches": {"home": ctx.pooled_counts[home], "away": ctx.pooled_counts[away]},
    }
    if "pooled_raw" in res:
        result_market["pooled_raw"] = [round(x, 4) for x in res["pooled_raw"]]

    # Goals and BTTS from the result model's score grid when it has one.
    grid = res.get("grid")
    if grid is None and res.get("grid_model") is not None:
        grid = res["grid_model"].predict(home, away)
    if grid is None and ctx.pooled is not None and home in ctx.pooled_counts and away in ctx.pooled_counts:
        try:
            grid = ctx.pooled.predict(home, away)
        except (KeyError, ValueError):
            grid = None
    goal_lines = {line: (float(grid.total_goals("over", line)) if grid is not None else None) for line in LINES["goals"]}
    expected = None
    if grid is not None:
        dist = lambda d: float(sum(k * p for k, p in enumerate(np.asarray(d() if callable(d) else d))))
        expected = [round(dist(grid.home_goal_distribution), 2), round(dist(grid.away_goal_distribution), 2)]
    base_goals = ctx.base["lines"]["goals"]
    goal_expl = [f"{ctx.league_name} matches average {base_goals['mean']:.2f} goals; {round(100 * base_goals[2.5])}% go over 2.5."]
    if expected:
        goal_expl.insert(0, f"The score model expects about {expected[0]:.1f} goals for {home} and {expected[1]:.1f} for {away}.")
    goals = _ou_market("goals", goal_lines, base_goals, "the Dixon-Coles score model",
                       f"30% score-model probability + 70% {ctx.league_name} rate for each line",
                       {"league_mean_goals": round(base_goals["mean"], 2), "expected_goals": expected},
                       goal_expl, VERSIONS["blend"], ctx)
    btts_model = float(grid.btts_yes) if grid is not None else None
    btts_p = BLEND_MODEL_WEIGHT * btts_model + (1 - BLEND_MODEL_WEIGHT) * ctx.base["btts"] if btts_model is not None else ctx.base["btts"]
    yes, no = _sel("yes", "Yes", btts_p), _sel("no", "No", 1 - btts_p)
    btts = {"market": "btts", "name": MARKET_NAMES["btts"], "model_version": VERSIONS["blend"],
            "evidence": ({"status": "provisional", "strength": "weak" if btts_model is not None else "none",
                          "summary": "Backtests show no proven edge over the league average (409 matches)."}
                         if ctx.competition == "PL" else league_evidence(ctx, "btts", btts_model is not None, "the Dixon-Coles score model")),
            "pick": yes if yes["p"] >= 0.5 else no, "selections": [yes, no],
            "model_p": None if btts_model is None else round(btts_model, 4), "league_p": round(ctx.base["btts"], 4),
            "explanation": [f"Both teams scored in {round(100 * ctx.base['btts'])}% of {ctx.league_name} matches in the training data."],
            "method": f"30% score-model probability + 70% {ctx.league_name} rate"}

    markets = {"result": result_market, "goals": goals, "btts": btts}
    for market in ("corners", "cards", "shots"):
        base = ctx.base["lines"][market]
        if not base:
            markets[market] = {"market": market, "name": MARKET_NAMES[market], "unavailable": True,
                               "evidence": {"status": "unavailable", "strength": "none", "summary": "No match statistics available."}}
            continue
        mean, nh, na = ctx.rolling_mean(market, home, away)
        line_p = {line: (poisson_over(mean, line) if mean else None) for line in LINES[market]}
        expl = [f"{ctx.league_name} average: {base['mean']:.1f} per match; {round(100 * base[MAIN_LINE[market]])}% go over {MAIN_LINE[market]}."]
        if mean:
            expl.insert(0, f"Recent venue form points to about {mean:.1f} (last {nh} {home} home games, last {na} {away} away games).")
        else:
            expl.insert(0, f"Not enough venue statistics yet ({nh} home / {na} away games with data), so this is the league average.")
        m = _ou_market(market, line_p, base, "recent venue averages", f"30% venue-average Poisson + 70% {ctx.league_name} rate",
                       {"venue_expected": None if mean is None else round(mean, 2), "league_mean": round(base["mean"], 2),
                        "home_games": nh, "away_games": na}, expl, VERSIONS["blend"], ctx)
        if market == "corners" and mean:
            raw = poisson_over(mean, 9.5)
            m["frozen_reference"] = {"model_version": VERSIONS["corners_frozen"], "over_9_5": round(raw, 4),
                                     "note": "Frozen v0.9 raw output. Backtest: over-confident and worse than the league average, so it is shown for reference, not used."}
        markets[market] = m
    return markets
