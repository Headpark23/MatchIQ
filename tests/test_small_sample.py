"""Domestic leagues: a club with few recent matches (a newly promoted side) gets the league
model blended toward the average (weight n/10) from 3 matches, not the flat league average."""
import datetime as dt
import random
import unittest

from pipeline.leagues import LEAGUES, PREDICTED, PUBLIC_ONLY
from pipeline.models import Context


def season(teams, start, rng):
    rows, day = [], start
    for h in teams:
        for a in teams:
            if h != a:
                rows.append({"competition": "BL1", "season": "2526", "date": day, "home": h, "away": a,
                             "hg": rng.randint(0, 3), "ag": rng.randint(0, 2), "stats": {}})
                day += dt.timedelta(days=1)
    return rows


class SmallSampleTest(unittest.TestCase):
    def test_domestic_leagues_use_the_small_sample_rule(self):
        for code, meta in PREDICTED.items():
            if meta.get("european") or meta.get("international"):
                continue
            self.assertEqual(meta["min_matches"], 3, code)
            self.assertEqual(meta["full_weight_matches"], 10, code)
        self.assertEqual(PUBLIC_ONLY["CL"]["min_matches"], 3)  # European settings untouched
        self.assertIn("min_matches", LEAGUES["PL"])

    def test_promoted_club_blends_then_falls_back(self):
        rng = random.Random(7)
        teams = ["T%d" % i for i in range(12)]
        rows = season(teams, dt.date(2025, 8, 1), rng)  # 132 matches, all within 400 days
        last = rows[-1]["date"]
        new = []
        for i, opp in enumerate(teams[:5]):  # the promoted club: 5 matches this season
            day = last + dt.timedelta(days=i + 1)
            new.append({"competition": "BL1", "season": "2627", "date": day, "home": "New" if i % 2 else opp,
                        "away": opp if i % 2 else "New", "hg": 1, "ag": 1, "stats": {}})
        as_of = last + dt.timedelta(days=10)
        meta = PREDICTED["BL1"]
        ctx = Context(rows + new, as_of, competition="BL1", league_name="Bundesliga", public=True,
                      min_matches=meta["min_matches"], full_weight_matches=meta["full_weight_matches"])
        res = ctx.result({"home": "New", "away": "T7", "date": as_of})
        self.assertEqual(res["tier"], "L1")
        self.assertEqual(res["model_weight"], 0.5)
        self.assertAlmostEqual(sum(res["p"]), 1.0, places=6)

        ctx2 = Context(rows + new[:2], as_of, competition="BL1", league_name="Bundesliga", public=True,
                       min_matches=meta["min_matches"], full_weight_matches=meta["full_weight_matches"])
        self.assertEqual(ctx2.result({"home": "New", "away": "T7", "date": as_of})["tier"], "T3")


if __name__ == "__main__":
    unittest.main()
