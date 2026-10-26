"""Most Likely / Best Value / No Bet decisions for one match.

Most Likely: the selection with the highest *credible* chance across markets. Each
probability is first shrunk toward its empirical reference with a 20-match weight
(the backtest hit rate of its probability band for the validated model, the league
rate otherwise), then ranked by the lower 90% confidence bound using the size of the
backtest behind that market. A provisional 80% backed by 41 matches therefore ranks
below a calibrated 66% backed by 104. Only selections whose
line was backtested are eligible, and pure league-average lines (no input from either
team) are never featured.

Best Value needs a real bookmaker price. The pipeline has no lawful free price feed,
so its decision is always No Bet with that reason; the app lets users enter prices
they see and applies the same value rules in the browser (app.js valueVerdict).
"""
import math

RULE_VERSION = "lb90-v1"
Z90 = 1.645
SHRINK_WEIGHT = 20
VALUE_MIN_EV = 0.05          # +5% expected value before a price is called value
FEATURE_LINES = {"goals": 2.5, "corners": 9.5, "cards": 3.5, "shots": 8.5}
BLEND_BACKTEST_N = 409       # Mission 063 test set, blend validated in Mission 064
T2_BACKTEST_N = 41           # Mission 064 promoted-club fixtures


def lower_bound(p, n):
    return max(0.0, p - Z90 * math.sqrt(p * (1 - p) / n)) if n else 0.0


def _band(reliability, p):
    bands = ((reliability or {}).get("markets", {}).get("wins", {}) or {}).get("bands", [])
    return next((b for b in bands if b["lo"] <= p < b["hi"]), None)


def candidates(markets, reliability, validation=None):
    """`validation` (data/league_validation.json entry) is given for leagues other than the
    Premier League: their sample sizes come from that league's own backtest, never from the
    Premier League's 409 matches."""
    out = []
    vmarkets = (validation or {}).get("markets") or {}
    league_name = (validation or {}).get("name", "league")
    blend_n = lambda market: vmarkets.get(market, {}).get("n", 0) if validation else BLEND_BACKTEST_N
    basis_n = lambda market: f"league-anchored blend, {blend_n(market)} {league_name + ' ' if validation else ''}backtest matches"
    result = markets.get("result")
    if result:
        for s in [result["pick"]]:  # backtest calibration bands describe top picks only
            if result["tier"] == "T1":
                band = _band(reliability, s["p"])
                if not band:
                    continue
                # Calibrated chance: pull toward how often this range landed in the backtest.
                p = (band["n"] * band["observed_rate"] + 20 * s["p"]) / (band["n"] + 20)
                n, basis = band["n"], f"frozen model, {band['n']} backtest picks at {band['band']}"
            elif result["tier"] == "T2":
                league = dict(zip("HDA", result.get("league_p") or [1 / 3] * 3))[s["key"]]
                p = (T2_BACKTEST_N * s["p"] + SHRINK_WEIGHT * league) / (T2_BACKTEST_N + SHRINK_WEIGHT)
                n, basis = T2_BACKTEST_N, "promoted-club model, 41 backtest matches"
            elif result["tier"] == "L1" and validation and result["evidence"]["strength"] != "none":
                league = dict(zip("HDA", result.get("league_p") or [1 / 3] * 3))[s["key"]]
                n = vmarkets.get("result", {}).get("n", 0)
                p = (n * s["p"] + SHRINK_WEIGHT * league) / (n + SHRINK_WEIGHT) if n else league
                basis = f"{league_name} model, {n} backtest matches ({validation.get('test_season_label')})"
            else:
                continue  # league average: says nothing about this match
            out.append({"market": "result", "key": s["key"], "label": s["label"], "p": s["p"], "credible_p": round(p, 4),
                        "n": n, "status": result["evidence"]["status"], "strength": result["evidence"]["strength"], "basis": basis})
    for market in ("goals", "corners", "cards", "shots"):
        m = markets.get(market)
        if not m or m.get("unavailable") or m["evidence"]["strength"] == "none":
            continue
        line = next(l for l in m["lines"] if l["line"] == FEATURE_LINES[market])
        for side in ("over", "under"):
            s = line[side]
            league = line.get("league_p")
            league = None if league is None else (league if side == "over" else 1 - league)
            credible = s["p"] if league is None else (blend_n(market) * s["p"] + SHRINK_WEIGHT * league) / (blend_n(market) + SHRINK_WEIGHT)
            out.append({"market": market, "key": side, "line": line["line"], "label": s["label"], "p": s["p"], "credible_p": round(credible, 4),
                        "n": blend_n(market), "status": m["evidence"]["status"], "strength": m["evidence"]["strength"],
                        "basis": basis_n(market)})
    btts = markets.get("btts")
    if btts and btts["evidence"]["strength"] != "none":
        for s in btts["selections"]:
            league = btts.get("league_p")
            league = None if league is None else (league if s["key"] == "yes" else 1 - league)
            credible = s["p"] if league is None else (blend_n(market) * s["p"] + SHRINK_WEIGHT * league) / (blend_n(market) + SHRINK_WEIGHT)
            out.append({"market": "btts", "key": s["key"], "label": s["label"], "p": s["p"], "credible_p": round(credible, 4), "n": blend_n("btts"),
                        "status": btts["evidence"]["status"], "strength": btts["evidence"]["strength"],
                        "basis": basis_n("btts")})
    for c in out:
        c["lower_bound"] = round(lower_bound(c["credible_p"], c["n"]), 4)
    return out


def recommend(markets, reliability, validation=None):
    pool = candidates(markets, reliability, validation)
    if not pool:
        most = {"decision": "no_bet", "reason": "No market has enough evidence about this match to feature a selection."}
    else:
        best = max(pool, key=lambda c: (c["lower_bound"], c["credible_p"]))
        most = {"decision": "most_likely", **best}
    value = {"decision": "no_bet", "reason": "No bookmaker price is available to compare. Enter a price you have seen to test it for value."}
    return {"most_likely": most, "best_value": value, "rule": "rank by lower 90% bound; value needs a real price, a validated model and +5% expected value"}
