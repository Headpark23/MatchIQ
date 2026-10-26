import json
import unittest
from pathlib import Path

from pipeline import rights

DATA = Path(__file__).resolve().parents[1] / "data"
read = lambda n: json.loads((DATA / n).read_text(encoding="utf-8"))
RESTRICTED = rights.RESTRICTED_MARKETS


def keys(node):
    if isinstance(node, dict):
        for k, v in node.items():
            yield k
            yield from keys(v)
    elif isinstance(node, list):
        for v in node:
            yield from keys(v)


class PublicRightsGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rel, cls.lv = read("model_reliability.json"), read("league_validation.json")
        cls.preds = rights.public_predictions(read("predictions.json"), cls.rel, cls.lv)
        cls.ledger = rights.public_ledger(read("prediction_history.json"), cls.rel, cls.lv)

    def test_no_restricted_market_anywhere_public(self):
        perf = rights.public_performance(self.ledger, read("performance.json"))
        for name, doc in {"predictions": self.preds, "ledger": self.ledger, "performance": perf,
                          "reliability": rights.public_reliability(self.rel), "validation": rights.public_league_validation(self.lv)}.items():
            self.assertFalse(set(keys(doc)) & set(RESTRICTED), name)
            self.assertFalse(any(w in json.dumps(doc) for w in ("football-data.co.uk",)), name)

    def test_public_most_likely_never_a_restricted_market(self):
        for p in self.preds["predictions"].values():
            self.assertNotIn(p["recommendations"]["most_likely"].get("market"), RESTRICTED)
        for r in self.ledger["records"]:
            ml = (r.get("recommendations") or {}).get("most_likely") or {}
            self.assertNotIn(ml.get("market"), RESTRICTED)
            self.assertNotIn(((r.get("settlement") or {}).get("most_likely") or {}).get("market"), RESTRICTED)

    def test_private_files_unchanged_and_keep_research_markets(self):
        self.assertTrue(any(m in p["markets"] for p in read("predictions.json")["predictions"].values() for m in RESTRICTED))
        self.assertTrue(len(self.ledger["records"]) == len(read("prediction_history.json")["records"]))

    def test_public_status_has_no_restricted_source_and_names_football_data_org(self):
        s = rights.public_status(read("pipeline_status.json"))
        self.assertFalse(any("co.uk" in k for k in s["sources"]))
        self.assertIn("football-data.org", s["attribution"])

    def test_co_uk_disabled_is_not_reported_as_failure(self):
        from pipeline import leagues
        _, status = leagues.refresh_current([], "2627")
        self.assertTrue(all(st.get("disabled") for st in status.values()))


if __name__ == "__main__":
    unittest.main()
