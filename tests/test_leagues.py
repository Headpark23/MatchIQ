import datetime as dt
import json
import unittest
from pathlib import Path

from pipeline import leagues, odds
from pipeline.history import performance
from pipeline.models import Context, predict
from pipeline.recommend import recommend
from pipeline.teams import canonical_for

HERE = Path(__file__).resolve().parent
TEAMS = json.loads((HERE / "openfootball_2026_27_teams.json").read_text(encoding="utf-8"))


class LeagueNames(unittest.TestCase):
    def test_every_2026_27_club_resolves_to_a_football_data_co_uk_club(self):
        rows = leagues.load_results()
        for code, names in TEAMS.items():
            known = {r["home"] for r in rows if r["competition"] == code and r["season"] in ("2526", "2627")}
            missing = [n for n in names if canonical_for(code, n) not in known]
            self.assertEqual(missing, [], f"{code}: schedule clubs with no results history")

    def test_known_spellings(self):
        self.assertEqual(canonical_for("BL1", "FC Bayern München"), canonical_for("BL1", "Bayern Munich"))
        self.assertEqual(canonical_for("FL1", "Paris Saint-Germain FC"), canonical_for("FL1", "Paris SG"))
        self.assertEqual(canonical_for("PD", "Villarreal CF"), canonical_for("PD", "Villarreal"))
        self.assertEqual(canonical_for("ELC", "Sheffield Wednesday FC"), canonical_for("ELC", "Sheffield Weds"))


class LeagueData(unittest.TestCase):
    CSV = "Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,HC,AC,HY,AY,HST,AST\nD1,22/08/2025,Bayern Munich,RB Leipzig,6,0,5,5,1,1,10,1\nD1,23/08/2025,Dortmund,St Pauli,x,0,5,5,1,1,10,1\n"

    def test_parse_csv_skips_unplayed_rows_and_keeps_statistics(self):
        rows = leagues.parse_csv(self.CSV, "BL1", "2526")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["stats"]["HC"], 5.0)
        self.assertEqual(rows[0]["date"], dt.date(2025, 8, 22))

    def test_failed_download_keeps_stored_copy(self):
        stored = leagues.parse_csv(self.CSV, "BL1", "2627")

        def boom(request, timeout):
            raise OSError("offline")
        rows, status = leagues.refresh_current(stored, "2627", opener=boom)
        self.assertEqual([r for r in rows if r["competition"] == "BL1"], stored)
        self.assertFalse(status["BL1"]["ok"])

    def test_promoted_clubs_are_per_league(self):
        mk = lambda c, s, h, a: {"competition": c, "season": s, "home": h, "away": a}
        rows = [mk("SA", "2425", "Inter", "Milan"), mk("SA", "2526", "Inter", "Pisa"), mk("BL1", "2425", "A", "B"), mk("BL1", "2526", "A", "B")]
        self.assertEqual(leagues.promoted_by_season(rows, "SA")["2526"], {"Pisa"})
        self.assertEqual(leagues.promoted_by_season(rows, "BL1")["2526"], set())


class LeagueModels(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = [r for r in leagues.load_results() if r["competition"] == "SA"]
        cls.ctx = Context(cls.rows, dt.date(2026, 10, 27), competition="SA", league_name="Serie A",
                          validation={"name": "Serie A", "test_season_label": "2025-26", "markets": {"result": {"n": 350, "strength": "moderate"}, "goals": {"n": 380, "blend_brier": 0.24, "league_brier": 0.25}}})

    def test_established_clubs_use_their_own_league_model(self):
        m = predict({"home": "Inter", "away": "Napoli", "date": dt.date(2026, 10, 31)}, self.ctx)
        self.assertEqual(m["result"]["tier"], "L1")
        self.assertEqual(m["result"]["model_version"], "dc-league-v1")
        self.assertAlmostEqual(sum(s["p"] for s in m["result"]["selections"]), 1, places=2)
        self.assertIn("Serie A", m["goals"]["explanation"][-1])
        self.assertNotIn("Premier League", json.dumps(m))

    def test_unknown_club_falls_back_to_league_average_and_is_never_featured(self):
        m = predict({"home": "Brand New FC", "away": "Napoli", "date": dt.date(2026, 10, 31)}, self.ctx)
        self.assertEqual(m["result"]["tier"], "T3")
        rec = recommend(m, {}, self.ctx.validation)
        self.assertNotEqual(rec["most_likely"].get("market"), "result")

    def test_untested_markets_have_no_strength(self):
        m = predict({"home": "Inter", "away": "Napoli", "date": dt.date(2026, 10, 31)}, self.ctx)
        self.assertEqual(m["corners"]["evidence"]["strength"], "none")  # no backtest entry in this fixture
        self.assertEqual(m["result"]["evidence"]["status"], "provisional")  # never "validated" without a forward record

    def test_most_likely_uses_the_leagues_own_sample_size(self):
        m = predict({"home": "Inter", "away": "Napoli", "date": dt.date(2026, 10, 31)}, self.ctx)
        rec = recommend(m, {}, self.ctx.validation)["most_likely"]
        self.assertIn("Serie A", rec["basis"])
        self.assertNotIn("409", rec["basis"])

    def test_performance_is_never_pooled_across_leagues(self):
        record = lambda comp: {"fixture": {"competition": comp, "home": "A", "away": "B", "kickoff_utc": "2026-10-31T12:00:00Z"}, "match_id": comp, "evaluated": True,
                               "markets": {"result": {"tier": "L1", "model_version": "v", "pick": {"p": 0.5}}},
                               "settlement": {"result": {"brier": 0.5, "logloss": 0.7, "pick_won": True}}}
        out = performance({"records": [record("PL"), record("SA")]})
        self.assertEqual(out["markets"]["result"]["n"], 1)
        self.assertEqual(out["by_competition"]["SA"]["markets"]["result"]["n"], 1)


class LeagueLifecycle(unittest.TestCase):
    """Fixture -> sealed prediction -> reschedule -> result -> settlement -> scorecard, for a non-PL league."""

    def test_bundesliga_end_to_end(self):
        import copy
        import tempfile
        from pipeline import run as runner
        from pipeline.teams import canonical

        def pl(home, away, kick, status="SCHEDULED", score=None):
            return {"competition": "PL", "season": "2627", "home": canonical(home), "away": canonical(away), "kickoff_utc": kick,
                    "status": status, "score": score, "source": "openligadb", "source_updated": None}

        def bl(home, away, kick, status="SCHEDULED", score=None):
            return {"competition": "BL1", "season": "2627", "home": canonical_for("BL1", home), "away": canonical_for("BL1", away),
                    "kickoff_utc": kick, "status": status, "score": score, "source": "openfootball", "source_updated": None}
        utc = dt.timezone.utc
        t0 = dt.datetime(2026, 10, 28, 9, tzinfo=utc)
        pl_fx = {"openligadb": lambda: ([pl("Chelsea", "Man United", "2026-10-31T12:30:00Z")], None)}
        stored = leagues.load_results()
        with tempfile.TemporaryDirectory() as out:
            def go(now, fixture):
                extra = {"BL1": {"openfootball": lambda: ([copy.deepcopy(fixture)], None)}}
                return runner.run(out, now, fetchers=pl_fx, extra_fetchers=extra, league_rows=stored)
            go(t0, bl("FC Bayern München", "Borussia Dortmund", "2026-10-31T17:30:00Z"))
            preds = json.loads((Path(out) / "predictions.json").read_text(encoding="utf-8"))["predictions"]
            bay = next(v for v in preds.values() if v["fixture"]["competition"] == "BL1")
            self.assertEqual(bay["markets"]["result"]["tier"], "L1")
            self.assertEqual(bay["markets"]["result"]["evidence"]["status"], "provisional")
            self.assertEqual(bay["recommendations"]["best_value"]["decision"], "no_bet")
            # Reschedule: a new revision is NOT needed for a kick-off change alone, but the move is recorded.
            go(t0 + dt.timedelta(hours=6), bl("Bayern Munich", "Dortmund", "2026-10-31T19:30:00Z"))
            fixtures = json.loads((Path(out) / "fixtures.json").read_text(encoding="utf-8"))["fixtures"]
            fx = next(f for f in fixtures if f["id"] == "BL1-2627-bayern-munich-v-dortmund")
            self.assertEqual(len(fx["kickoff_history"]), 1)
            ledger = json.loads((Path(out) / "prediction_history.json").read_text(encoding="utf-8"))
            sealed = [r for r in ledger["records"] if r["fixture"]["competition"] == "BL1"]
            self.assertTrue(sealed)
            first_hash = sealed[0]["sha256"]
            # Result arrives after kick-off.
            after = dt.datetime(2026, 11, 1, 9, tzinfo=utc)
            go(after, bl("Bayern Munich", "Dortmund", "2026-10-31T19:30:00Z", "FINISHED", [3, 1]))
            ledger = json.loads((Path(out) / "prediction_history.json").read_text(encoding="utf-8"))
            sealed = [r for r in ledger["records"] if r["fixture"]["competition"] == "BL1" and r.get("evaluated")]
            self.assertEqual(len(sealed), 1)
            self.assertEqual(sealed[0]["result"]["score"], [3, 1])
            self.assertEqual([r for r in ledger["records"] if r["fixture"]["competition"] == "BL1"][0]["sha256"], first_hash)
            perf = json.loads((Path(out) / "performance.json").read_text(encoding="utf-8"))
            self.assertEqual(perf["by_competition"]["BL1"]["evaluated_matches"], 1)
            pl_done = {r["match_id"] for r in ledger["records"] if r["fixture"]["competition"] == "PL" and r.get("evaluated")}
            self.assertEqual(perf["evaluated_matches"], len(pl_done))  # the Premier League scorecard excludes other leagues
            preds = json.loads((Path(out) / "predictions.json").read_text(encoding="utf-8"))["predictions"]
            self.assertFalse([v for v in preds.values() if v["fixture"]["competition"] == "BL1"], "finished match leaves Upcoming")


if __name__ == "__main__":
    unittest.main()
