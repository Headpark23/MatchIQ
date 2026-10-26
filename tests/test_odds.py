import datetime as dt
import io
import json
import os
import unittest

from pipeline import odds

NOW = dt.datetime(2026, 10, 28, 9, tzinfo=dt.timezone.utc)


def fixture(code, home, away, hours, season="2627", status="SCHEDULED"):
    from pipeline.teams import canonical_for, match_id
    kick = (NOW + dt.timedelta(hours=hours)).isoformat().replace("+00:00", "Z")
    return {"id": match_id(code, season, canonical_for(code, home), canonical_for(code, away)), "competition": code, "season": season,
            "home": canonical_for(code, home), "away": canonical_for(code, away), "kickoff_utc": kick, "status": status}


def event(home, away, hours, books):
    return {"home_team": home, "away_team": away, "commence_time": (NOW + dt.timedelta(hours=hours)).isoformat().replace("+00:00", "Z"), "bookmakers": books}


def h2h(title, h, d, a):
    return {"title": title, "markets": [{"key": "h2h", "last_update": "2026-10-28T08:55:00Z",
                                         "outcomes": [{"name": "Arsenal", "price": h}, {"name": "Draw", "price": d}, {"name": "Chelsea", "price": a}]}]}


FIX = [fixture("PL", "Arsenal", "Chelsea", 30), fixture("PL", "Everton", "Fulham", 60)]


class Resp(io.BytesIO):
    def __init__(self, body, remaining="490"):
        super().__init__(json.dumps(body).encode())
        self.headers = {"x-requests-remaining": remaining}

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class Parse(unittest.TestCase):
    def test_one_coherent_bookmaker_per_group_not_a_patchwork(self):
        ev = event("Arsenal", "Chelsea", 30, [h2h("Wide", 2.0, 3.0, 3.0), h2h("Tight", 2.1, 3.4, 3.6),
                                              {"title": "Partial", "markets": [{"key": "h2h", "outcomes": [{"name": "Arsenal", "price": 9.0}]}]}])
        matches, unmatched = odds.parse_events([ev], NOW, "PL", FIX)
        sel = next(iter(matches.values()))["selections"]
        self.assertEqual({s["bookmaker"] for s in sel.values()}, {"Tight"})  # lowest margin, complete set; the 9.0 outlier ignored
        self.assertEqual(sel["result:H"]["fractional"], "11/10")
        self.assertEqual(unmatched, [])

    def test_totals_only_for_known_lines_and_both_sides(self):
        totals = {"title": "T", "markets": [{"key": "totals", "outcomes": [
            {"name": "Over", "point": 2.5, "price": 1.8}, {"name": "Under", "point": 2.5, "price": 2.0},
            {"name": "Over", "point": 4.5, "price": 9.0}, {"name": "Under", "point": 4.5, "price": 1.05},
            {"name": "Over", "point": 3.5, "price": 3.0}]}]}
        matches, _ = odds.parse_events([event("Arsenal", "Chelsea", 30, [totals])], NOW, "PL", FIX)
        sel = next(iter(matches.values()))["selections"]
        self.assertEqual(sorted(sel), ["goals:over:2.5", "goals:under:2.5"])  # 4.5 unsupported, 3.5 lacks Under

    def test_started_unknown_and_mismatched_events_are_not_published(self):
        started = event("Arsenal", "Chelsea", -1, [h2h("A", 2, 3, 4)])
        unknown = event("Arsenal", "Brand New Town", 30, [h2h("A", 2, 3, 4)])
        wrong_day = event("Everton", "Fulham", 5, [h2h("A", 2, 3, 4)])
        matches, unmatched = odds.parse_events([started, unknown, wrong_day], NOW, "PL", FIX)
        self.assertEqual(matches, {})
        self.assertEqual(len(unmatched), 2)

    def test_other_league_names_match_the_schedule(self):
        fx = [fixture("BL1", "FC Bayern München", "Borussia Dortmund", 20)]
        ev = event("Bayern Munich", "Dortmund", 20, [{"title": "A", "markets": [{"key": "h2h", "outcomes": [
            {"name": "Bayern Munich", "price": 1.5}, {"name": "Draw", "price": 5.0}, {"name": "Dortmund", "price": 6.0}]}]}])
        matches, unmatched = odds.parse_events([ev], NOW, "BL1", fx)
        self.assertEqual(len(matches), 1)
        self.assertEqual(unmatched, [])


class Budget(unittest.TestCase):
    def test_matchday_focus(self):
        far = [fixture("PL", "Arsenal", "Chelsea", 80)]
        self.assertIsNone(odds.plan_call({}, NOW, "PL", far)[0])
        self.assertIsNone(odds.plan_call({}, NOW, "SA", FIX)[0])  # a league with no fixture is never polled
        self.assertEqual(odds.plan_call({}, NOW, "PL", FIX)[0], ["h2h", "totals"])

    def test_interval_tightens_near_kickoff(self):
        cache = {"leagues": {"PL": {"fetched_at": (NOW - dt.timedelta(hours=4)).isoformat()}}}
        self.assertIsNone(odds.plan_call(cache, NOW, "PL", FIX)[0])  # 4 h < 8 h with kickoff 30 h away
        soon = [fixture("PL", "Arsenal", "Chelsea", 5)]
        self.assertIsNotNone(odds.plan_call(cache, NOW, "PL", soon)[0])  # 4 h >= 3 h with kickoff inside 6 h

    def test_monthly_cap_and_pace(self):
        self.assertIsNone(odds.plan_call({"credits": {"spent_by_month": {"2026-10": 400}}}, NOW, "PL", FIX)[0])
        early = dt.datetime(2026, 10, 2, 9, tzinfo=dt.timezone.utc)
        fx = [fixture("PL", "Arsenal", "Chelsea", 30)]
        fx[0]["kickoff_utc"] = (early + dt.timedelta(hours=30)).isoformat().replace("+00:00", "Z")
        ahead = {"credits": {"spent_by_month": {"2026-10": 100}}}  # 100 used on day 2 is ahead of the straight-line pace
        self.assertIsNone(odds.plan_call(ahead, early, "PL", fx)[0])
        self.assertIsNotNone(odds.plan_call(ahead, NOW, "PL", FIX)[0])  # same spend is fine by day 28

    def test_low_allowance_degrades_then_stops(self):
        low = {"credits": {"provider_remaining": 80}}
        self.assertEqual(odds.plan_call(low, NOW, "PL", FIX)[0], ["h2h"])
        sa = [fixture("SA", "Inter", "Napoli", 20)]
        self.assertIsNone(odds.plan_call(low, NOW, "SA", sa)[0])
        self.assertIsNone(odds.plan_call({"credits": {"provider_remaining": 20}}, NOW, "PL", FIX)[0])

    def test_leagues_without_totals_drop_to_one_credit(self):
        cache = {"leagues": {"PL": {"totals": False}}}
        self.assertEqual(odds.plan_call(cache, NOW, "PL", FIX)[0], ["h2h"])


class Refresh(unittest.TestCase):
    def setUp(self):
        os.environ.pop("ODDS_API_KEY", None)

    def test_no_key_is_inactive(self):
        cache, notes = odds.refresh({}, NOW, FIX)
        self.assertEqual(cache, {})
        self.assertIn("not configured", notes["all"])

    def test_refresh_counts_credits_detects_missing_totals_and_never_stores_key(self):
        calls = []

        def opener(req, timeout):
            calls.append(req.full_url)
            return Resp([event("Arsenal", "Chelsea", 30, [h2h("A", 2.0, 3.5, 4.0)])])
        cache, notes = odds.refresh({}, NOW, FIX, key="SECRET", opener=opener)
        self.assertEqual(len(calls), 1)  # only PL has a match in the window
        self.assertTrue(notes["PL"].startswith("ok"))
        self.assertEqual(cache["credits"]["spent_by_month"]["2026-10"], 2)
        self.assertEqual(cache["credits"]["provider_remaining"], 490)
        self.assertFalse(cache["leagues"]["PL"]["totals"])  # none returned: next time h2h only
        self.assertNotIn("SECRET", json.dumps(cache))
        again, _ = odds.refresh(cache, NOW + dt.timedelta(hours=9), FIX, key="k", opener=opener)
        self.assertEqual(again["credits"]["spent_by_month"]["2026-10"], 3)  # h2h only: 1 credit

    def test_failure_keeps_cache_and_spends_nothing(self):
        def boom(r, timeout):
            raise OSError("down")
        old = {"matches": {"x": {"competition": "PL", "kickoff_utc": "2026-10-31T12:00:00Z"}}, "credits": {"spent_by_month": {"2026-10": 2}}}
        cache, notes = odds.refresh(old, NOW, FIX, key="k", opener=boom)
        self.assertTrue(notes["PL"].startswith("failed"))
        self.assertEqual(cache["credits"]["spent_by_month"]["2026-10"], 2)
        self.assertIn("x", cache["matches"])

    def test_past_kickoffs_are_pruned(self):
        old = {"matches": {"x": {"competition": "PL", "kickoff_utc": "2026-10-27T12:00:00Z"}}}
        cache, _ = odds.refresh(old, NOW, [], key="k", opener=lambda r, timeout: Resp([]))
        self.assertEqual(cache["matches"], {})


if __name__ == "__main__":
    unittest.main()
