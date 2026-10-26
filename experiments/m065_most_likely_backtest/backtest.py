"""Mission 065: chronological comparison of Most Likely against the match-result favourite.

Research only. Reads the Mission 063 walk-forward predictions (every probability was made
from matches played strictly before its date) and settles them against data/matches.json.
Nothing here changes a frozen model, the ledger or production data.

Leakage controls, all expanding-window (a match on day D only sees matches before D):
  * the league base rates used in the 30/70 blend and as the shrink reference
  * the calibration-band hit rates used to rank the match-result pick
  * the sample size behind the lower 90% bound
No bookmaker prices are used: the open data holds consensus closing *probabilities*, not
bookable prices, so no profit or loss is claimed.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from pipeline.teams import canonical  # noqa: E402

OUT = Path(__file__).resolve().parent
Z90, SHRINK, MIN_BAND_N, BLEND, MIN_PRIOR = 1.645, 20, 20, 0.3, 30
# market -> (home field, away field, line); goals uses the full-time score
LINES = {"goals": ("FTHG", "FTAG", 2.5), "corners": ("HC", "AC", 9.5), "cards": ("HY", "AY", 3.5), "shots": ("HST", "AST", 8.5)}
RAW_COLUMN = {"goals": "over25", "corners": "corners", "cards": "cards", "shots": "shots"}
BASE_KEYS = ["H", "D", "A", "btts_yes", "goals_over", "corners_over", "cards_over", "shots_over"]


def lb(p, n):
    return max(0.0, p - Z90 * math.sqrt(p * (1 - p) / n)) if n else 0.0


def wilson(h, n, z=1.96):
    p = h / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    w = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (c - w, c + w)


def settle(m):
    """True/False/None for every selection a candidate can name."""
    num = lambda k: float(m[k]) if m.get(k) not in (None, "") else math.nan
    hg, ag = num("FTHG"), num("FTAG")
    out = {s: m["FTR"] == s for s in "HDA"}
    out["btts_yes"] = hg > 0 and ag > 0
    out["btts_no"] = not out["btts_yes"]
    for mk, (h, a, line) in LINES.items():
        total = num(h) + num(a)
        out[mk + "_over"] = None if math.isnan(total) else total > line
        out[mk + "_under"] = None if math.isnan(total) else total < line
    return out


def opposite(sel):
    return sel.replace("_over", "_under").replace("_yes", "_no") if sel.endswith(("_over", "_yes")) else sel.replace("_under", "_over").replace("_no", "_yes")


def main():
    raw = json.loads((ROOT / "data" / "matches.json").read_text(encoding="utf8"))["matches"]
    rows = []
    for m in raw:
        try:
            d = pd.to_datetime(m["Date"], format="%d/%m/%Y")
        except Exception:
            continue
        key = f"{d:%Y-%m-%d}|{canonical(m['HomeTeam'])}|{canonical(m['AwayTeam'])}"
        rows.append((d, key, settle(m)))
    rows.sort(key=lambda r: r[0])
    day = {k: d for d, k, _ in rows}
    ind = pd.DataFrame({k: s for _, k, s in rows}).T  # index = match key, one column per selection

    preds = pd.read_csv(ROOT / "experiments" / "m063_prediction_challenge" / "predictions.csv")
    preds = preds[preds.eligible]
    preds["key"] = preds.date + "|" + preds.home.map(canonical) + "|" + preds.away.map(canonical)
    dc = preds[(preds.model == "dc_frozen") & (preds.market == "1x2")].set_index("key").probability.map(json.loads)
    r10 = {mk: preds[(preds.model == "rolling10") & (preds.market == mk)].set_index("key").probability.astype(float) for mk in ("over25", "btts", "corners", "cards", "shots")}
    close = {}
    for f in ("premier_league_2025_26_closing_odds.csv", "premier_league_2026_27_odds.csv"):
        for r in pd.read_csv(ROOT / "experiments" / "raw_market_data" / f).itertuples():
            close[f"{r.date_uk}|{canonical(r.home_team)}|{canonical(r.away_team)}"] = [r.close_home_prob, r.close_draw_prob, r.close_away_prob]

    keys = [k for _, k, _ in rows if k in dc.index and all(k in s.index for s in r10.values())]
    top_pick = {k: "HDA"[int(np.argmax(dc[k]))] for k in keys}
    records = []
    for k in keys:
        d = day[k]
        prior_keys = [j for _, j, _ in rows if day[j] < d]
        if len(prior_keys) < MIN_PRIOR:
            continue
        prior = ind.loc[prior_keys]
        n_prior = len(prior_keys)
        base = {s: float(prior[s].dropna().astype(bool).mean()) for s in BASE_KEYS}
        base.update({opposite(s): 1 - base[s] for s in BASE_KEYS if s.endswith(("_over", "_yes"))})

        # candidates: (market, selection, model p, credible p, evidence n)
        cand = []
        pv, fav = dc[k], top_pick[k]
        p_fav = max(pv)
        lo = min(int(p_fav * 10), 9) / 10
        in_band = [bool(ind.at[j, top_pick[j]]) for j in keys if day[j] < d and lo <= max(dc[j]) < lo + 0.1]
        if len(in_band) >= MIN_BAND_N:
            rate = float(np.mean(in_band))
            cand.append(("result", fav, p_fav, (len(in_band) * rate + SHRINK * p_fav) / (len(in_band) + SHRINK), len(in_band)))
        for mk in ("goals", "corners", "cards", "shots", "btts"):
            praw = r10["btts" if mk == "btts" else RAW_COLUMN[mk]][k]
            for sel, p0 in ((mk + ("_yes" if mk == "btts" else "_over"), praw), (mk + ("_no" if mk == "btts" else "_under"), 1 - praw)):
                p = BLEND * p0 + (1 - BLEND) * base[sel]
                cand.append((mk, sel, p, (n_prior * p + SHRINK * base[sel]) / (n_prior + SHRINK), n_prior))
        best = max(cand, key=lambda c: (lb(c[3], c[4]), c[3]))
        rawtop = max(cand, key=lambda c: c[2])
        naive = max(base.items(), key=lambda kv: kv[1])
        hit = lambda s: None if pd.isna(ind.at[k, s]) else bool(ind.at[k, s])
        rec = {"key": k, "date": f"{d:%Y-%m-%d}", "fav": fav, "fav_p": p_fav, "fav_hit": hit(fav), "fav_base": base[fav],
               "ml_sel": best[1], "ml_is_result": best[0] == "result", "ml_p": best[2], "ml_hit": hit(best[1]), "ml_base": base[best[1]],
               "raw_sel": rawtop[1], "raw_p": rawtop[2], "raw_hit": hit(rawtop[1]), "raw_base": base[rawtop[1]],
               "naive_sel": naive[0], "naive_p": naive[1], "naive_hit": hit(naive[0]), "home_p": base["H"], "home_hit": hit("H")}
        if k in close:
            cf = "HDA"[int(np.argmax(close[k]))]
            rec.update({"close_p": max(close[k]), "close_hit": hit(cf)})
        records.append(rec)

    df = pd.DataFrame(records).sort_values("date").reset_index(drop=True)
    df.to_csv(OUT / "decisions.csv", index=False)

    def summary(name, hit, p, base=None):
        cols = [hit, p] + ([base] if base else [])
        d = df[cols].dropna()
        h, m = int(d[hit].astype(bool).sum()), len(d)
        mean_base = float(d[base].mean()) if base else float(d[p].mean())
        return {"strategy": name, "n": m, "hits": h, "hit_rate": h / m, "ci95": list(wilson(h, m)), "mean_claimed_p": float(d[p].mean()),
                "brier_of_claim": float(((d[p] - d[hit].astype(float)) ** 2).mean()), "mean_base_rate": mean_base, "edge_over_base": h / m - mean_base}

    S = [summary("Match-result favourite (frozen Dixon-Coles)", "fav_hit", "fav_p", "fav_base"),
         summary("Most Likely (lower-90%-bound rule)", "ml_hit", "ml_p", "ml_base"),
         summary("Highest raw probability, no evidence adjustment", "raw_hit", "raw_p", "raw_base"),
         summary("Naive: most common selection in the league so far", "naive_hit", "naive_p"),
         summary("Always back the home win", "home_hit", "home_p")]
    if "close_hit" in df:
        S.append(summary("Bookmaker closing favourite (benchmark, not available live)", "close_hit", "close_p"))
        S[-1]["mean_base_rate"] = None
        S[-1]["edge_over_base"] = None

    rng = np.random.default_rng(65)
    days = list(df.date.unique())
    groups = {d: g for d, g in df.groupby("date")}

    def paired(a, b):
        base = df[[a, b]].dropna()
        diffs = []
        for _ in range(2000):
            s = pd.concat([groups[d] for d in rng.choice(days, len(days))])[[a, b]].dropna()
            diffs.append(s[a].astype(float).mean() - s[b].astype(float).mean())
        return {"diff": float(base[a].astype(float).mean() - base[b].astype(float).mean()), "ci95": [float(np.percentile(diffs, 2.5)), float(np.percentile(diffs, 97.5))]}

    thirds = []
    for part in np.array_split(df.index, 3):
        p_ = df.loc[part]
        thirds.append({"period": f"{p_.date.iloc[0]} to {p_.date.iloc[-1]}", "n": len(p_), "favourite_hit": float(p_.fav_hit.astype(float).mean()),
                       "favourite_claimed": float(p_.fav_p.mean()), "most_likely_hit": float(p_.ml_hit.dropna().astype(float).mean()), "most_likely_claimed": float(p_.ml_p.mean())})
    by_sel = {s: {"n": int(len(g)), "hit_rate": float(g.ml_hit.dropna().astype(float).mean()), "mean_claimed": float(g.ml_p.mean())} for s, g in df.groupby("ml_sel")}
    result = {"source": "experiments/m063_prediction_challenge/predictions.csv", "n": len(df), "first_match": df.date.iloc[0], "last_match": df.date.iloc[-1],
              "strategies": S,
              "paired_hit_rate_differences": {"most_likely_minus_favourite": paired("ml_hit", "fav_hit"), "most_likely_minus_raw": paired("ml_hit", "raw_hit"),
                                              "most_likely_minus_naive": paired("ml_hit", "naive_hit")},
              "chronological_thirds": thirds, "most_likely_by_selection": by_sel, "most_likely_chose_result_share": float(df.ml_is_result.mean())}
    (OUT / "results.json").write_text(json.dumps(result, indent=2), encoding="utf8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
