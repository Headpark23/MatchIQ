"""Walk-forward backtest of the league-specific models, one league at a time.

    python -m pipeline.league_validation          # writes data/league_validation.json

Test season: 2025-26. The model is refitted at the start of each week using only matches
played before that week (no look-ahead). Each market is scored against the same league's
average rate with the Brier score. The result is the only evidence used to label a
league's predictions; it never promotes anything to "validated" (that needs a 150-match
forward ledger, as for the Premier League).
"""
import datetime as dt
import json
import sys
from collections import defaultdict
from pathlib import Path

from .leagues import EXTRA, LEAGUES, load_results
from .models import Context, predict

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "league_validation.json"
TEST_SEASON, TEST_LABEL = "2526", "2025-26"
LINE = {"goals": 2.5, "corners": 9.5, "cards": 3.5, "shots": 8.5}
STATS = {"corners": ("HC", "AC"), "cards": ("HY", "AY"), "shots": ("HST", "AST")}


def week_start(day):
    return day - dt.timedelta(days=day.weekday())


def outcome(market, row):
    if market == "goals":
        return row["hg"] + row["ag"] > LINE["goals"]
    if market == "btts":
        return row["hg"] > 0 and row["ag"] > 0
    h, a = (row["stats"].get(k) for k in STATS[market])
    return None if h is None or a is None else h + a > LINE[market]


def validate_league(code, results, progress=None, public=False):
    rows = [r for r in results if r["competition"] == code]
    test = [r for r in rows if r["season"] == TEST_SEASON]
    by_week = defaultdict(list)
    for r in test:
        by_week[week_start(r["date"])].append(r)
    scores = defaultdict(lambda: [0, 0.0, 0.0])  # n, model brier sum, league brier sum
    tiers = defaultdict(int)
    for week in sorted(by_week):
        ctx = Context(rows, week, competition=code, league_name=LEAGUES[code]["name"], public=public)
        if not ctx.epl or ctx.base["btts"] is None:
            continue
        for r in by_week[week]:
            m = predict({"home": r["home"], "away": r["away"], "date": r["date"]}, ctx)
            res = m["result"]
            tiers[res["tier"]] += 1
            y = [r["hg"] > r["ag"], r["hg"] == r["ag"], r["hg"] < r["ag"]]
            if res["tier"] == "L1":
                s = scores["result"]
                s[0] += 1
                s[1] += sum((x["p"] - float(t)) ** 2 for x, t in zip(res["selections"], y))
                s[2] += sum((q - float(t)) ** 2 for q, t in zip(res["league_p"], y))
            for market in ("goals", "btts", "corners", "cards", "shots"):
                mk = m[market]
                if mk.get("unavailable"):
                    continue
                won = outcome(market, r)
                if won is None:
                    continue
                if market == "btts":
                    p, base = mk["selections"][0]["p"], mk["league_p"]
                else:
                    line = next(l for l in mk["lines"] if l["line"] == LINE[market])
                    p, base = line["over"]["p"], line["league_p"]
                s = scores[market]
                s[0] += 1
                s[1] += (p - float(won)) ** 2
                s[2] += (base - float(won)) ** 2
        if progress:
            progress(code, week)
    out = {"competition": code, "name": LEAGUES[code]["name"], "test_season": TEST_SEASON, "test_season_label": TEST_LABEL,
           "test_matches": len(test), "result_tiers": dict(tiers), "markets": {}}
    for market, (n, model, league) in scores.items():
        if n:
            key = "model_brier" if market == "result" else "blend_brier"
            out["markets"][market] = {"n": n, key: round(model / n, 4), "league_brier": round(league / n, 4)}
    if "result" in out["markets"]:
        r = out["markets"]["result"]
        r["blend_brier"] = r["model_brier"]  # same key as the other markets
        gain = r["league_brier"] - r["model_brier"]
        r["gain"] = round(gain, 4)
        r["strength"] = "moderate" if gain >= 0.01 else "weak" if gain >= 0.003 else "none"
    return out


def main():
    results = load_results()
    report = {"generated_at": dt.datetime.now(dt.timezone.utc).isoformat(), "method": "weekly refit walk-forward, Brier vs league average",
              "leagues": {}}
    for code in EXTRA:
        report["leagues"][code] = validate_league(code, results, lambda c, w: print(c, w, file=sys.stderr))
        OUT.write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
