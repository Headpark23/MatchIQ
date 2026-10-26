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
