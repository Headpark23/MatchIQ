"""Every scheduled match in a predicted league gets a sealed public prediction, data never
regresses when a source is silent, and the coverage audit reports gaps. No network, no
repository writes."""
import datetime as dt
import io
import json
import tempfile
import unittest
from pathlib import Path

from pipeline import coverage, public
from pipeline.data import merge_fixtures
from pipeline.leagues import LEAGUES, PREDICTED, PUBLIC_ONLY, SCHEDULE_ONLY
from pipeline.sources import fetch_football_data_org
from pipeline.teams import match_id

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 11, 6, 12, 0, tzinfo=UTC)


def eredivisie_history():
    """Synthetic score rows for two Eredivisie seasons (test input only)."""
    clubs = ["Ajax", "PSV", "Feyenoord", "AZ Alkmaar", "FC Utrecht", "FC Twente"]
    rows, day = [], dt.date(2024, 8, 10)
    for label in ("2425", "2526"):
        for i, h in enumerate(clubs):
            for j, a in enumerate(clubs):
                if h != a:
                    rows.append({"competition": "N1", "season": label, "date": day, "home": h, "away": a,
                                 "hg": (i + 2 * j) % 4, "ag": (2 * i + j) % 3, "stats": {}, "source": "openfootball"})
                    day += dt.timedelta(days=3)
    return rows


def fixture(home, away, kickoff, sources=("football-data.org", "openfootball"), status="SCHEDULED", score=None):
    return {"id": match_id("N1", "2627", home, away), "competition": "N1", "season": "2627", "home": home, "away": away,
            "kickoff_utc": kickoff, "status": status, "score": score, "result_source": "football-data.org" if score else None,
            "sources": list(sources), "kickoff_history": []}


class LeagueRegistryTests(unittest.TestCase):
    def test_every_competition_is_either_predicted_or_schedule_only(self):
        self.assertEqual(set(PREDICTED), set(LEAGUES) | set(PUBLIC_ONLY))
        self.assertFalse(set(PREDICTED) & set(SCHEDULE_ONLY))
        self.assertIn("N1", PUBLIC_ONLY)
        self.assertIn("P1", PUBLIC_ONLY)

    def test_public_only_leagues_never_reach_the_private_research_models(self):
        source = (Path(__file__).resolve().parents[1] / "pipeline" / "run.py").read_text(encoding="utf-8")
        self.assertIn('f["competition"] not in LEAGUES', source)


class PublicOnlyLeagueTests(unittest.TestCase):
    def test_eredivisie_match_gets_a_sealed_public_prediction_and_is_settled(self):
        fx = fixture("Ajax", "PSV", "2026-11-08T13:30:00Z")
        payload, ledger, _ = public.run_public(NOW, [fx], "2627", 21, history=eredivisie_history(), validation={"leagues": {}})
        self.assertIn(fx["id"], payload["predictions"])
        record = ledger["records"][-1]
        self.assertTrue(record["record_id"].startswith("PUB-N1-"))
        self.assertEqual(set(payload["predictions"][fx["id"]]["markets"]), {"result", "goals", "btts"})
        done = {**fx, "status": "FINISHED", "score": [1, 1], "result_source": "football-data.org"}
        _, ledger, perf = public.run_public(dt.datetime(2026, 11, 8, 18, 0, tzinfo=UTC), [done], "2627", 21,
                                            history=eredivisie_history(), validation={"leagues": {}}, ledger=ledger)
        self.assertTrue(ledger["records"][-1]["evaluated"])
        self.assertEqual(perf["by_competition"]["N1"]["markets"]["result"]["n"], 1)

    def test_untimed_fixture_is_sealed_by_the_start_of_match_day(self):
        fx = fixture("Ajax", "PSV", "2026-11-08T13:30:00Z", sources=("openfootball",))
        history = eredivisie_history()
        day_before = dt.datetime(2026, 11, 7, 20, 0, tzinfo=UTC)
        payload, ledger, _ = public.run_public(day_before, [fx], "2627", 21, history=history, validation={"leagues": {}})
        sealed = ledger["records"][-1]["record_id"]
        match_day = dt.datetime(2026, 11, 8, 9, 0, tzinfo=UTC)
        # New inputs on the match day must not create a revision, but the sealed prediction stays visible.
        more = history + [{**history[0], "date": dt.date(2026, 11, 7), "season": "2627"}]
        again, ledger, _ = public.run_public(match_day, [fx], "2627", 21, history=more, validation={"leagues": {}},
                                             ledger=ledger, previous=payload["predictions"])
        self.assertEqual(ledger["records"][-1]["record_id"], sealed)
        self.assertEqual(again["predictions"][fx["id"]]["record_id"], sealed)
        # A match first seen on its match day, with no confirmed time, is not predicted at all.
        late = fixture("Feyenoord", "AZ Alkmaar", "2026-11-08T15:45:00Z", sources=("openfootball",))
        out, ledger, _ = public.run_public(match_day, [late], "2627", 21, history=history, validation={"leagues": {}}, ledger=ledger)
        self.assertNotIn(late["id"], out["predictions"])

    def test_seal_cutoff_is_uk_midnight(self):
        self.assertEqual(public.seal_cutoff(dt.datetime(2026, 7, 1, 18, 0, tzinfo=UTC)), dt.datetime(2026, 6, 30, 23, 0, tzinfo=UTC))
        self.assertEqual(public.seal_cutoff(dt.datetime(2026, 11, 8, 13, 30, tzinfo=UTC)), dt.datetime(2026, 11, 8, 0, 0, tzinfo=UTC))


class FootballDataOrgGuardTests(unittest.TestCase):
    def opener(self, names):
        payload = {"matches": [{"status": "TIMED", "utcDate": "2026-11-08T13:30:00Z", "homeTeam": {"name": h}, "awayTeam": {"name": a},
                                "score": {"fullTime": {"home": None, "away": None}}} for h, a in names]}

        class Response(io.BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False
        return lambda request, timeout=None: Response(json.dumps(payload).encode())

    def test_known_clubs_resolve_and_unknown_spellings_are_left_out(self):
        matches, note = fetch_football_data_org("N1", 2026, "2627", token="t",
                                                opener=self.opener([("AFC Ajax", "PSV"), ("FC Twente '65", "Unknown Club FC")]))
        self.assertEqual([(m["home"], m["away"]) for m in matches], [("Ajax", "PSV")])
        self.assertIn("Unknown Club FC", note)

    def test_vitoria_spellings_resolve(self):
        matches, note = fetch_football_data_org("P1", 2026, "2627", token="t", opener=self.opener([("Vitória SC", "FC Porto")]))
        self.assertEqual([(m["home"], m["away"]) for m in matches], [("Vitoria Guimaraes", "FC Porto")])
        self.assertIsNone(note)


class SilentSourceTests(unittest.TestCase):
    def m(self, kickoff, source, status="SCHEDULED", score=None):
        return {"competition": "PD", "season": "2627", "home": "Valencia", "away": "Real Madrid", "kickoff_utc": kickoff,
                "status": status, "score": score, "source": source, "source_updated": None}

    def test_finished_match_does_not_regress_when_the_timed_source_is_silent(self):
        first = merge_fixtures([[self.m("2026-11-07T20:00:00Z", "football-data.org", "FINISHED", [1, 2])],
                                [self.m("2026-11-08T14:00:00Z", "openfootball")]], now=NOW)
        later = dt.datetime(2026, 11, 8, 3, 0, tzinfo=UTC)
        second = merge_fixtures([[self.m("2026-11-08T14:00:00Z", "openfootball")]], previous=first, now=later)
        third = merge_fixtures([[self.m("2026-11-08T14:00:00Z", "openfootball")]], previous=second, now=later)
        for run in (second, third):
            f = run[0]
            self.assertEqual((f["status"], f["score"], f["kickoff_utc"]), ("FINISHED", [1, 2], "2026-11-07T20:00:00Z"))
            self.assertIn("football-data.org", f["sources"])

    def test_scheduled_kickoff_keeps_the_timed_source_until_it_returns(self):
        first = merge_fixtures([[self.m("2026-11-29T20:00:00Z", "football-data.org")], [self.m("2026-11-29T15:00:00Z", "openfootball")]], now=NOW)
        silent = merge_fixtures([[self.m("2026-11-29T15:00:00Z", "openfootball")]], previous=first, now=NOW)
        self.assertEqual(silent[0]["kickoff_utc"], "2026-11-29T20:00:00Z")
        moved = merge_fixtures([[self.m("2026-11-30T19:00:00Z", "football-data.org")]], previous=silent, now=NOW)
        self.assertEqual(moved[0]["kickoff_utc"], "2026-11-30T19:00:00Z")


class CoverageReportTests(unittest.TestCase):
    def test_gaps_are_reported_and_strict_mode_fails(self):
        start = "2026-10-20T10:00:00+00:00"
        sealed = {"record_id": "PUB-a#r1", "match_id": "a", "fixture": {"competition": "N1"}, "published_at": start, "evaluated": True}
        fixtures = [
            {"id": "a", "competition": "N1", "kickoff_utc": "2026-10-25T12:00:00Z", "status": "FINISHED", "score": [1, 0]},
            {"id": "b", "competition": "N1", "kickoff_utc": "2026-11-05T12:00:00Z", "status": "FINISHED", "score": [0, 0]},
            {"id": "c", "competition": "N1", "kickoff_utc": "2026-11-07T12:00:00Z", "status": "SCHEDULED", "score": None},
            {"id": "d", "competition": "N1", "kickoff_utc": "2026-10-30T12:00:00Z", "status": "AWAITING_RESULT", "score": None},
        ]
        report = coverage.compute(fixtures, {}, [sealed], NOW)
        self.assertEqual(report["gaps"]["unpredicted_next_48h"], ["c"])
        self.assertEqual(report["gaps"]["unsealed_last_7d"], ["b"])
        self.assertEqual(report["gaps"]["results_overdue"], ["d"])
        self.assertEqual(report["leagues"]["N1"]["settled"], 1)
        self.assertFalse(report["complete"])
        self.assertFalse(report["leagues"]["E2"]["predicted"])
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "public").mkdir()
            Path(tmp, "fixtures.json").write_text(json.dumps({"fixtures": fixtures}), encoding="utf-8")
            Path(tmp, "public", "prediction_history.json").write_text(json.dumps({"records": [sealed]}), encoding="utf-8")
            summary = Path(tmp, "summary.md")
            self.assertEqual(coverage.main(["--data", tmp, "--now", NOW.isoformat(), "--strict", "--summary", str(summary)]), 1)
            self.assertIn("Coverage gaps", summary.read_text(encoding="utf-8"))
            self.assertTrue(Path(tmp, "coverage.json").exists())

    def test_lagging_league_reports_overdue_results_without_failing(self):
        self.assertTrue(PREDICTED["SC0"].get("results_lag"))
        rec = {"record_id": "PUB-a#r1", "match_id": "a", "fixture": {"competition": "PL"}, "published_at": "2026-10-20T10:00:00+00:00", "evaluated": True}
        fixtures = [{"id": "a", "competition": "PL", "kickoff_utc": "2026-10-25T12:00:00Z", "status": "FINISHED", "score": [1, 0]}]
        fixtures += [{"id": f"old-{c}", "competition": c, "kickoff_utc": "2026-08-01T12:00:00Z", "status": "FINISHED", "score": [0, 0]}
                     for c in PREDICTED if c not in ("PL", "SC0")]
        fixtures += [
            # Played weeks ago, source has no score yet.
            {"id": "sc-late", "competition": "SC0", "kickoff_utc": "2026-10-10T14:00:00Z", "status": "AWAITING_RESULT", "score": None, "sources": ["openfootball"]},
            # Match day, time unconfirmed, nothing sealed before today: public.py may not predict it.
            {"id": "sc-today", "competition": "SC0", "kickoff_utc": "2026-11-06T15:00:00Z", "status": "SCHEDULED", "score": None, "sources": ["openfootball"]},
            # Tomorrow: still before its seal cut-off, so a missing prediction is a real gap.
            {"id": "sc-tomorrow", "competition": "SC0", "kickoff_utc": "2026-11-07T15:00:00Z", "status": "SCHEDULED", "score": None, "sources": ["openfootball"]},
        ]
        report = coverage.compute(fixtures, {}, [rec], NOW)
        self.assertEqual(report["known_lag"]["results_overdue"], ["sc-late"])
        self.assertEqual(report["known_lag"]["untimed_match_day_unsealed"], ["sc-today"])
        self.assertEqual(report["gaps"]["results_overdue"], [])
        self.assertEqual(report["gaps"]["unpredicted_next_48h"], ["sc-tomorrow"])
        self.assertEqual(report["leagues"]["SC0"]["results_overdue"], 1)
        self.assertIn("Known source lag", coverage.markdown(report))
        # Once tomorrow's match is predicted, the lag alone does not fail the audit.
        report = coverage.compute(fixtures, {"sc-tomorrow": {}}, [rec], NOW)
        self.assertTrue(report["complete"], report["gaps"])

    def test_complete_when_every_match_is_predicted_and_settled(self):
        rec = {"record_id": "PUB-a#r1", "match_id": "a", "fixture": {"competition": "PL"}, "published_at": "2026-10-20T10:00:00+00:00", "evaluated": True}
        fixtures = [{"id": "a", "competition": "PL", "kickoff_utc": "2026-10-25T12:00:00Z", "status": "FINISHED", "score": [1, 0]},
                    {"id": "z", "competition": "PL", "kickoff_utc": "2026-11-07T12:00:00Z", "status": "SCHEDULED", "score": None}]
        # Every predicted league must have fixtures, otherwise it is a gap (league_without_fixtures).
        fixtures += [{"id": f"old-{c}", "competition": c, "kickoff_utc": "2026-08-01T12:00:00Z", "status": "FINISHED", "score": [0, 0]}
                     for c in PREDICTED if c != "PL"]
        report = coverage.compute(fixtures, {"z": {}}, [rec], NOW)
        self.assertTrue(report["complete"], report["gaps"])


class LedgerHonestyTests(unittest.TestCase):
    """Guards against the hand-written and back-dated records found in November 2026."""
    DATA = Path(__file__).resolve().parents[1] / "data"

    def test_no_hand_written_or_back_filled_records_in_the_ledgers(self):
        for rel in ("prediction_history.json", "public/prediction_history.json"):
            records = json.loads((self.DATA / rel).read_text(encoding="utf-8"))["records"]
            bad = [r["record_id"] for r in records if r.get("inputs_fingerprint") in ("league-model-import", "b35b9a3d37c2a170")]
            self.assertEqual(bad, [], rel)
            typed = [r["record_id"] for r in records if (r.get("result") or {}).get("confirmed_at") == "2026-10-31T17:25:00+00:00"]
            self.assertEqual(typed, [], rel)

    def test_public_ledger_only_predicts_modelled_competitions(self):
        records = json.loads((self.DATA / "public" / "prediction_history.json").read_text(encoding="utf-8"))["records"]
        self.assertFalse({r["fixture"]["competition"] for r in records} - set(PREDICTED))


SPFL_TXT = """= Scotland | Premiership 2026/27

▪ 1st Phase - 1
Fri Jul 31 2026
  20:00   Dundee United  1-1 (1-0)  Rangers
                  (Lachlan Rose 38'; Thelo AASGAARD 56')
Sat Aug 1
  15:00   Falkirk  0-2 (0-1)  St. Mirren
          Aberdeen  2-1  Heart of Midlothian
Sat Jan 2
  12:30   Celtic   v   Rangers
          Saint Johnstone FC   v   Hibernian
"""


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class ScottishPremiershipTests(unittest.TestCase):
    def test_scottish_premiership_is_predicted(self):
        self.assertIn("SC0", PREDICTED)
        self.assertNotIn("SC0", SCHEDULE_ONLY)

    def test_text_schedule_parses_both_layouts_dates_times_and_club_names(self):
        from pipeline.sources import parse_openfootball_txt
        ms = parse_openfootball_txt(SPFL_TXT, "SC0", "2627", 2026)
        self.assertEqual([(m["home"], m["away"], m["score"]) for m in ms], [
            ("Dundee United", "Rangers", [1, 1]), ("Falkirk", "St. Mirren", [0, 2]), ("Aberdeen", "Hearts", [2, 1]),
            ("Celtic", "Rangers", None), ("St. Johnstone", "Hibernian", None)])
        self.assertEqual(ms[0]["kickoff_utc"], "2026-07-31T19:00:00Z")   # 20:00 BST
        self.assertEqual(ms[2]["kickoff_utc"], "2026-08-01T14:00:00Z")   # inherits 15:00 from the line above
        self.assertEqual(ms[4]["kickoff_utc"], "2027-01-02T12:30:00Z")   # January belongs to the second calendar year
        self.assertEqual(ms[3]["status"], "SCHEDULED")

    def test_falls_back_to_openfootball_europe_when_football_json_lacks_the_league(self):
        import urllib.error
        from pipeline.sources import fetch_openfootball
        seen = []

        def opener(request, timeout=None):
            seen.append(request.full_url)
            if "football.json" in request.full_url:
                raise urllib.error.HTTPError(request.full_url, 404, "Not Found", {}, None)
            return FakeResponse(SPFL_TXT.encode("utf-8"))

        ms, error = fetch_openfootball("SC0", "2026-27", "2627", opener=opener)
        self.assertIsNone(error)
        self.assertEqual(len(ms), 5)
        self.assertTrue(seen[-1].endswith("/openfootball/europe/master/scotland/2026-27_sco1.txt"))

    def test_no_football_data_org_call_for_a_league_off_its_free_tier(self):
        ms, note = fetch_football_data_org("SC0", 2026, "2627", token="x", opener=lambda *a, **k: self.fail("network call"))
        self.assertEqual(ms, [])
        self.assertIn("free tier", note)

    def test_repeat_meetings_of_the_same_pairing_keep_separate_fixtures(self):
        from pipeline.sources import parse_openfootball_txt
        text = SPFL_TXT + "Sat Mar 6\n  15:00   Celtic   v   Rangers\n"
        ms = parse_openfootball_txt(text, "SC0", "2627", 2026)
        merged = merge_fixtures([ms], now=NOW)
        ids = sorted(f["id"] for f in merged if f["home"] == "Celtic")
        self.assertEqual(ids, ["SC0-2627-celtic-v-rangers", "SC0-2627-celtic-v-rangers-2"])
        self.assertEqual(len(merged), len(ms))

    def test_a_predicted_league_with_no_fixtures_is_a_coverage_gap(self):
        report = coverage.compute([], {}, [], NOW)
        self.assertIn("SC0", report["gaps"]["league_without_fixtures"])
        self.assertFalse(report["complete"])


if __name__ == "__main__":
    unittest.main()
