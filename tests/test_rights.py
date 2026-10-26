import datetime as dt
import json
import unittest
from pathlib import Path

from pipeline import public, rights
from pipeline.leagues import load_results
from pipeline.teams import match_id

DATA = Path(__file__).resolve().parents[1] / "data"
RESTRICTED = rights.RESTRICTED_MARKETS


def keys(node):
    if isinstance(node, dict):
        for k, v in node.items():
            yield k
            yield from keys(v)
    elif isinstance(node, list):
        for v in node:
            yield from keys(v)


def synthetic_history():
    """Test input only: score rows reshaped like the permitted-source history. Never written anywhere."""
    rows = [dict(r, stats={}, source="football-data.org") for r in load_results() if r["competition"] in ("BL1",)]
    pl = [dict(r, competition="PL", stats={}) for r in rows]
    return rows + pl


class PublicPathTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        history = synthetic_history()
        teams = sorted({r["home"] for r in history if r["competition"] == "BL1" and r["season"] == "2526"})[:6]
        now = dt.datetime(2026, 10, 26, 12, 0, tzinfo=dt.timezone.utc)
        cls.fixtures = []
        for code in ("BL1", "PL"):
            for i in range(0, 4, 2):
                h, a = teams[i], teams[i + 1]
                cls.fixtures.append({"id": match_id(code, "2627", h, a), "competition": code, "season": "2627", "home": h, "away": a,
                                     "kickoff_utc": "2026-10-31T15:30:00Z", "status": "SCHEDULED", "score": None, "sources": ["football-data.org"],
                                     "kickoff_history": []})
        cls.payload, cls.ledger, cls.perf = public.run_public(now, cls.fixtures, "2627", 21, history=history, validation={"leagues": {}})

    def test_only_permitted_markets_and_distinct_identity(self):
        self.assertEqual(len(self.payload["predictions"]), 4)
        for p in self.payload["predictions"].values():
            self.assertEqual(set(p["markets"]), {"result", "goals", "btts"})
            self.assertTrue(p["record_id"].startswith(public.RECORD_PREFIX))
            self.assertEqual(p["derivation"], "public-derived")
            self.assertNotIn(p["recommendations"]["most_likely"].get("market"), RESTRICTED)
            for m in p["markets"].values():
                self.assertEqual(m["model_version"], public.PUBLIC_MODEL_VERSION)
        for r in self.ledger["records"]:
            self.assertEqual(r["origin"], "public-derived")
            self.assertTrue(r["record_id"].startswith(public.RECORD_PREFIX))
        self.assertIn("not the originally sealed", self.ledger["description"])

    def test_no_restricted_keys_anywhere(self):
        for doc in (self.payload, self.ledger, self.perf):
            self.assertFalse(set(keys(doc)) & set(RESTRICTED))
            self.assertNotIn("football-data.co.uk", json.dumps(doc))

    def test_premier_league_uses_the_public_league_model_not_the_frozen_one(self):
        for p in self.payload["predictions"].values():
            if p["fixture"]["competition"] == "PL":
                self.assertIn(p["markets"]["result"]["tier"], ("L1", "T3"))

    def test_rerun_is_idempotent_and_append_only(self):
        again = public.run_public(dt.datetime(2026, 10, 26, 13, 0, tzinfo=dt.timezone.utc), self.fixtures, "2627", 21,
                                  history=synthetic_history(), validation={"leagues": {}}, ledger=self.ledger)[1]
        self.assertEqual(len(again["records"]), 4)

    def test_training_rows_exclude_restricted_result_sources(self):
        fx = [{"id": "x", "status": "FINISHED", "score": [1, 0], "season": "2627", "competition": "BL1", "home": "A", "away": "B",
               "kickoff_utc": "2026-10-01T15:30:00Z", "result_source": "football-data.co.uk"}]
        self.assertEqual(public.training_rows([], fx, "2627"), [])
        fx[0]["result_source"] = "football-data.org"
        self.assertEqual(len(public.training_rows([], fx, "2627")), 1)


class RightsHelperTests(unittest.TestCase):
    def test_public_status_has_no_restricted_source_and_names_football_data_org(self):
        s = rights.public_status(json.loads((DATA / "pipeline_status.json").read_text(encoding="utf-8")))
        self.assertFalse(any("co.uk" in k for k in s["sources"]))
        self.assertIn("football-data.org", s["attribution"])

    def test_co_uk_disabled_is_not_reported_as_failure(self):
        from pipeline import leagues
        _, status = leagues.refresh_current([], "2627")
        self.assertTrue(all(st.get("disabled") for st in status.values()))


if __name__ == "__main__":
    unittest.main()


class NoRestrictedFallbackTests(unittest.TestCase):
    def test_public_module_never_references_restricted_data(self):
        import ast
        src = (Path(__file__).resolve().parents[1] / "pipeline" / "public.py").read_text(encoding="utf-8")
        tree = ast.parse(src)
        names = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)} | {n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)}
        strings = {n.value for n in ast.walk(tree) if isinstance(n, ast.Constant) and isinstance(n.value, str) and len(n.value) < 80}
        for needle in ("load_co_uk", "load_results", "co_uk_as_matches", "frozen_ledger", "shadow_result", "fetch_csv", "refresh_current"):
            self.assertNotIn(needle, names, needle)
        for needle in ("matches.json", "league_results.json", "prediction_history.json"):
            self.assertNotIn(needle, strings, needle)

    def test_conflicted_or_restricted_results_are_not_public_results(self):
        base = {"status": "FINISHED", "score": [1, 0], "result_source": "football-data.org"}
        self.assertTrue(public.permitted_result(base))
        self.assertFalse(public.permitted_result({**base, "result_source": "football-data.co.uk"}))
        self.assertFalse(public.permitted_result({**base, "conflicting_scores": [{"source": "x", "score": [0, 0]}]}))
        shown = public.public_fixtures([{**base, "result_source": "football-data.co.uk"}])
        self.assertEqual((shown[0]["status"], shown[0]["score"]), ("AWAITING_RESULT", None))

    def test_settlement_of_pub_records_updates_public_scorecard(self):
        history = synthetic_history()
        h, a = sorted({r["home"] for r in history if r["competition"] == "BL1" and r["season"] == "2526"})[:2]
        fid = match_id("BL1", "2627", h, a)
        fx = {"id": fid, "competition": "BL1", "season": "2627", "home": h, "away": a, "kickoff_utc": "2026-10-31T15:30:00Z",
              "status": "SCHEDULED", "score": None, "result_source": None, "sources": ["football-data.org"], "kickoff_history": []}
        before = dt.datetime(2026, 10, 30, 12, 0, tzinfo=dt.timezone.utc)
        payload, ledger, perf = public.run_public(before, [fx], "2627", 21, history=history, validation={"leagues": {}})
        self.assertEqual(perf["by_competition"]["BL1"]["evaluated_matches"] if "BL1" in perf.get("by_competition", {}) else 0, 0)
        done = {**fx, "status": "FINISHED", "score": [2, 1], "result_source": "football-data.org"}
        after = dt.datetime(2026, 10, 31, 18, 0, tzinfo=dt.timezone.utc)
        payload, ledger, perf = public.run_public(after, [done], "2627", 21, history=history, validation={"leagues": {}}, ledger=ledger)
        rec = [r for r in ledger["records"] if r["match_id"] == fid][-1]
        self.assertTrue(rec["record_id"].startswith("PUB-") and rec.get("evaluated"))
        self.assertEqual(rec["settlement"]["result"]["outcome"], "H")
        self.assertEqual(perf["by_competition"]["BL1"]["markets"]["result"]["n"], 1)
        self.assertNotIn("football-data.co.uk", json.dumps(perf))
