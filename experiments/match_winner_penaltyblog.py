"""Offline-only MatchIQ 1X2 experiment. Never imported by the live website.
Optional dependency: penaltyblog (not installed by this script).
Run manually in an isolated environment after approving dependencies.
"""
import json
import math
from collections import Counter
from datetime import datetime
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data" / "matches.json"

def load_matches():
    payload = json.loads(DATA.read_text(encoding="utf-8"))
    out = []
    for r in payload["matches"]:
        try:
            date = datetime.strptime(r["Date"], "%d/%m/%Y")
            hg, ag = int(r["FTHG"]), int(r["FTAG"])
            outcome = "H" if hg > ag else "A" if ag > hg else "D"
            out.append((date, r["HomeTeam"], r["AwayTeam"], hg, ag, outcome))
        except (ValueError, TypeError, KeyError):
            continue
    return sorted(out, key=lambda r: r[0])

def brier(p, outcome):
    return sum((p[k] - (1 if k == outcome else 0)) ** 2 for k in ("H", "D", "A"))

def independent_poisson(home_rate, away_rate, limit=14):
    h = [math.exp(-home_rate)]
    a = [math.exp(-away_rate)]
    for i in range(1, limit + 1):
        h.append(h[-1] * home_rate / i)
        a.append(a[-1] * away_rate / i)
    p = {"H": 0., "D": 0., "A": 0.}
    for i, hp in enumerate(h):
        for j, ap in enumerate(a):
            p["H" if i > j else "A" if j > i else "D"] += hp * ap
    total = sum(p.values())
    return {k: v / total for k, v in p.items()}

def baseline(train):
    counts = Counter(r[5] for r in train)
    return {k: counts[k] / len(train) for k in ("H", "D", "A")}

def simple_poisson(train, match):
    home = [r for r in train if r[1] == match[1]][-10:]
    away = [r for r in train if r[2] == match[2]][-10:]
    if len(home) < 5 or len(away) < 5:
        return None
    mean = lambda xs: sum(xs) / len(xs)
    lh = (mean([r[3] for r in home]) + mean([r[3] for r in away])) / 2
    la = (mean([r[4] for r in away]) + mean([r[4] for r in home])) / 2
    return independent_poisson(lh, la)

def dixon_coles(train, matches):
    import penaltyblog as pb
    model = pb.models.DixonColesGoalModel(
        [r[3] for r in train], [r[4] for r in train],
        [r[1] for r in train], [r[2] for r in train])
    model.fit()
    results = {}
    for m in matches:
        if m[1] not in set(r[1] for r in train) | set(r[2] for r in train) or m[2] not in set(r[1] for r in train) | set(r[2] for r in train):
            continue
        ph, pd, pa = model.predict(m[1], m[2]).home_draw_away
        results[m] = {"H": float(ph), "D": float(pd), "A": float(pa)}
    return results

def main():
    games = load_matches()
    cut = int(len(games) * .7)
    train, test = games[:cut], games[cut:]
    totals = {k: 0. for k in ("Baseline", "Simple Poisson", "Dixon-Coles")}
    n = 0
    # Walk-forward by calendar day. Refit once per day, never using that day's results.
    i = 0
    while i < len(test):
        j = i + 1
        while j < len(test) and test[j][0] == test[i][0]:
            j += 1
        day = test[i:j]
        dc = dixon_coles(train, day)
        league = baseline(train)
        for m in day:
            simple = simple_poisson(train, m)
            if simple is None or m not in dc:
                continue
            n += 1
            for name, p in (("Baseline", league), ("Simple Poisson", simple), ("Dixon-Coles", dc[m])):
                totals[name] += brier(p, m[5])
        train.extend(day)
        i = j
    print("MatchIQ offline 1X2 comparison | evaluated:", n, "| chronological 70/30 split")
    for name, score in totals.items():
        print(name, "multiclass Brier:", round(score / n, 4) if n else "N/A")
    print("Research-only; reused historical holdout, no independent forward validation.")

if __name__ == "__main__":
    main()
