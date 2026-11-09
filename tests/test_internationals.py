"""Nations League A: OpenLigaDB fixtures, CC0 international history and the public model.
No network, no repository writes."""
import datetime as dt
import io
import json
import tempfile
import unittest
from pathlib import Path

from pipeline import internationals, public
from pipeline.leagues import PREDICTED, PUBLIC_ONLY
from pipeline.run import default_extra_fetchers
from pipeline.sources import fetch_openfootball, fetch_openligadb
from pipeline.teams import NATIONAL_TEAMS, canonical_for, match_id

UTC = dt.timezone.utc

CSV = """date,home_team,away_team,home_score,away_score,tournament,city,country,neutral
2021-06-30,Spain,Italy,1,1,Friendly,Madrid,Spain,FALSE
2025-09-05,Spain,Bulgaria,3,0,FIFA World Cup qualification,Madrid,Spain,FALSE
2025-09-06,Brazil,Chile,2,0,FIFA World Cup qualification,Rio,Brazil,FALSE
2026-06-20,Germany,Ivory Coast,1,1,FIFA World Cup,Toronto,Canada,TRUE
2026-09-24,Netherlands,Germany,1,2,UEFA Nations League,Amsterdam,Netherlands,FALSE
2026-11-15,Spain,England,NA,NA,UEFA Nations League,Seville,Spain,FALSE
2026-03-01,Elba Island,Northern Cyprus,0,0,Friendly,Portoferraio,Italy,FALSE
"""


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def olg_match(home, away, when, goals=None):
    return {"matchDateTimeUTC": when, "team1": {"teamName": home}, "team2": {"teamName": away}, "matchIsFinished": goals is not None,
            "matchResults": [{"resultTypeID": 2, "pointsTeam1": goals[0], "pointsTeam2": goals[1]}] if goals else [], "lastUpdateDateTime": None}


class InternationalsTest(unittest.TestCase):
    def test_registered_as_public_only_without_openfootball(self):
        self.assertIn("NLA", PREDICTED)
        self.assertTrue(PUBLIC_ONLY["NLA"]["international"])
        self.assertEqual(set(default_extra_fetchers()["NLA"]), {"openligadb"})
        ms, note = fetch_openfootball("NLA", "2026-27", "2627", opener=lambda *a, **k: self.fail("network call"))
        self.assertEqual(ms, [])
        self.assertIn("not published", note)

    def test_history_keeps_matches_involving_european_teams_only(self):
        rows = internationals.parse(CSV, "NLA")
        pairs = [(r["h"], r["a"]) for r in rows]
        self.assertEqual(pairs, [("Spain", "Bulgaria"), ("Germany", "Ivory Coast"), ("Netherlands", "Germany")])
        self.assertEqual([r["s"] for r in rows], ["2526", "2526", "2627"])
        self.assertTrue(all(r["c"] == "NLA" for r in rows))

    def test_german_openligadb_names_resolve_to_dataset_names(self):
        self.assertEqual(len(NATIONAL_TEAMS), len(internationals.UEFA))
        self.assertEqual(set(NATIONAL_TEAMS), set(internationals.UEFA))
        for german, english in [("Deutschland", "Germany"), ("Tschechien", "Czech Republic"), ("Dänemark", "Denmark"), ("Türkei", "Turkey"),
                                ("Niederlande", "Netherlands"), ("Kroatien", "Croatia"), ("Island", "Iceland"), ("Irland", "Republic of Ireland"),
                                ("Nordirland", "Northern Ireland"), ("Bosnien und Herzegowina", "Bosnia and Herzegovina"), ("Schweiz", "Switzerland")]:
            self.assertEqual(canonical_for("NLA", german), english, german)
        # Exact match only: no word containment for national teams.
        self.assertEqual(canonical_for("NLA", "Elba Island"), "Elba Island")
        self.assertEqual(canonical_for("NLA", "Northern Cyprus"), "Northern Cyprus")

    def test_openligadb_fixture_ids_match_history_ids(self):
        payload = [olg_match("Niederlande", "Deutschland", "2026-09-24T18:45:00Z", (1, 2)),
                   olg_match("Spanien", "England", "2026-11-15T19:45:00Z")]
        opener = lambda request, timeout=20: Response(json.dumps(payload).encode())
        ms, error = fetch_openligadb("NLA", 2026, "2627", opener=opener)
        self.assertIsNone(error)
        self.assertEqual([(m["home"], m["away"], m["status"], m["score"]) for m in ms],
                         [("Netherlands", "Germany", "FINISHED", [1, 2]), ("Spain", "England", "SCHEDULED", None)])
        row = [r for r in internationals.parse(CSV, "NLA") if r["h"] == "Netherlands"][0]
        self.assertEqual(match_id("NLA", row["s"], row["h"], row["a"]), match_id("NLA", ms[0]["season"], ms[0]["home"], ms[0]["away"]))

    def test_history_rows_are_a_permitted_public_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "h.json"
            path.write_text(json.dumps({"results": internationals.parse(CSV, "NLA")}), encoding="utf-8")
            rows = public.load_history(path, internationals.SOURCE)
        self.assertTrue(rows)
        self.assertTrue(all(r["source"] in public.PERMITTED_RESULT_SOURCES for r in rows))

    def test_evidence_wording_for_international_competition(self):
        v = {"competition": "NLA", "name": "Nations League A", "test_season_label": "2025-26",
             "markets": {"result": {"n": 220, "model_brier": 0.435, "league_brier": 0.632, "strength": "moderate"}}}
        tiers = public.evidence_tiers(v)
        self.assertIn("220 international matches involving European teams", tiers["L1"]["summary"])
        self.assertIn("one team", tiers["T3"]["summary"])
        self.assertNotIn("promoted", tiers["T3"]["summary"])
        club = public.evidence_tiers({**v, "competition": "N1", "name": "Eredivisie"})
        self.assertIn("for the league average", club["L1"]["summary"])
        self.assertIn("newly promoted", club["T3"]["summary"])


if __name__ == "__main__":
    unittest.main()
