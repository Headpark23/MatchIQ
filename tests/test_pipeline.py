"""Regression tests for the Mission 064 refresh pipeline (stdlib unittest).

Model tests need numpy/penaltyblog and are skipped where those are not installed;
the GitHub workflow installs them and runs everything.
"""
import copy
import datetime as dt
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    from zoneinfo import ZoneInfo
    ZoneInfo("Europe/London")
except Exception:  # Windows Python without the tzdata package
    raise unittest.SkipTest("Europe/London time zone data unavailable; pip install tzdata")

from pipeline import history as hist  # noqa: E402
from pipeline import sources  # noqa: E402
from pipeline.data import merge_fixtures  # noqa: E402
from pipeline.fairodds import UK_PRICE_LADDER, fair_odds  # noqa: E402
from pipeline.teams import canonical, match_id  # noqa: E402

try:
    import numpy  # noqa: F401
    import penaltyblog  # noqa: F401
    HAVE_MODELS = True
except ImportError:
    HAVE_MODELS = False

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 10, 28, 9, 0, tzinfo=UTC)


def m(home, away, kickoff, source, status="SCHEDULED", score=None):
    return {"competition": "PL", "season": "2627", "home": canonical(home), "away": canonical(away),
            "kickoff_utc": kickoff, "status": status, "score": score, "source": source, "source_updated": None}


class TeamNames(unittest.TestCase):
    def test_every_source_spelling_resolves(self):
        cases = {"Manchester City FC": "Man City", "Manchester City": "Man City", "Man City": "Man City",
                 "Brighton & Hove Albion FC": "Brighton", "Brighton & Hove Albion": "Brighton", "FC Arsenal": "Arsenal",
                 "Nottingham Forest FC": "Nott'm Forest", "Nottingham": "Nott'm Forest", "Nott'm Forest": "Nott'm Forest",
                 "Brentford F.C.": "Brentford", "Hull City AFC": "Hull", "Hull City": "Hull", "Coventry City FC": "Coventry",
                 "AFC Bournemouth": "Bournemouth", "Tottenham Hotspur FC": "Tottenham", "Manchester Utd": "Man United",
                 "Wolverhampton Wanderers FC": "Wolves", "Ipswich Town": "Ipswich"}
        for raw, expected in cases.items():
            self.assertEqual(canonical(raw), expected, raw)

    def test_unknown_championship_club_is_stable(self):
        self.assertEqual(canonical("Wrexham AFC"), "Wrexham")
        self.assertEqual(canonical("Wrexham"), canonical("Wrexham AFC"))

    def test_match_id_survives_spelling_differences(self):
        self.assertEqual(match_id("PL", "2627", "Hull City AFC", "Ipswich Town FC"), match_id("PL", "2627", "Hull", "Ipswich"))


class FixtureMerging(unittest.TestCase):
    def test_priority_source_sets_kickoff_and_reschedule_is_recorded(self):
        first = merge_fixtures([[m("Hull", "Ipswich", "2026-10-31T15:00:00Z", "openfootball")]], now=NOW)
        moved = merge_fixtures([[m("Hull City", "Ipswich Town", "2026-11-01T14:00:00Z", "openligadb")],
                                [m("Hull", "Ipswich", "2026-10-31T15:00:00Z", "openfootball")]], previous=first, now=NOW)
        self.assertEqual(len(moved), 1)
        self.assertEqual(moved[0]["kickoff_utc"], "2026-11-01T14:00:00Z")
        self.assertEqual(moved[0]["kickoff_history"][0]["from"], "2026-10-31T15:00:00Z")
        self.assertEqual(moved[0]["first_seen"], first[0]["first_seen"])

    def test_past_kickoff_without_score_is_awaiting_not_finished(self):
        out = merge_fixtures([[m("Arsenal", "Everton", "2026-10-24T14:00:00Z", "openligadb")]], now=NOW)
        self.assertEqual(out[0]["status"], "AWAITING_RESULT")
        self.assertIsNone(out[0]["score"])

    def test_postponed_status_is_kept(self):
        out = merge_fixtures([[m("Arsenal", "Everton", "2026-10-24T14:00:00Z", "football-data.org", "POSTPONED")]], now=NOW)
        self.assertEqual(out[0]["status"], "POSTPONED")

    def test_majority_resolves_score_conflict_and_tie_does_not(self):
        lists = [[m("Bournemouth", "Brentford", "2026-09-12T14:00:00Z", "openligadb", "FINISHED", [2, 1])],
                 [m("Bournemouth", "Brentford", "2026-09-12T14:00:00Z", "openfootball", "FINISHED", [2, 2])],
                 [m("Bournemouth", "Brentford", "2026-09-12T14:00:00Z", "football-data.co.uk", "FINISHED", [2, 2])]]
        out = merge_fixtures(lists, now=NOW)[0]
        self.assertEqual((out["status"], out["score"]), ("FINISHED", [2, 2]))
        self.assertIn("result_note", out)
        tie = merge_fixtures(lists[:2], now=NOW)[0]
        self.assertEqual((tie["status"], tie["score"]), ("RESULT_CONFLICT", None))

    def test_fixture_dropped_by_all_sources_is_kept_as_removed(self):
        first = merge_fixtures([[m("Chelsea", "Wolves", "2026-11-20T15:00:00Z", "openfootball")]], now=NOW)
        later = merge_fixtures([[m("Arsenal", "Hull", "2026-11-07T15:00:00Z", "openfootball")]], previous=first, now=NOW)
        removed = [f for f in later if f["home"] == "Chelsea"]
        self.assertEqual(removed[0]["status"], "REMOVED_FROM_SCHEDULE")


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class Sources(unittest.TestCase):
    def test_rate_limit_is_respected_then_succeeds(self):
        calls = []

        def opener(request, timeout):
            calls.append(request.full_url)
            if len(calls) == 1:
                raise urllib.error.HTTPError(request.full_url, 429, "Too Many", {"Retry-After": "7"}, None)
            return FakeResponse(b'{"ok": true}')
        with mock.patch.object(sources.time, "sleep") as sleep:
            self.assertEqual(sources.http_json("https://x.test", opener=opener), {"ok": True})
        sleep.assert_any_call(7)
        self.assertEqual(len(calls), 2)

    def test_forbidden_is_not_retried(self):
        calls = []

        def opener(request, timeout):
            calls.append(1)
            raise urllib.error.HTTPError(request.full_url, 403, "Forbidden", {}, None)
        with mock.patch.object(sources.time, "sleep"):
            with self.assertRaises(RuntimeError):
                sources.http_json("https://x.test", opener=opener)
        self.assertEqual(len(calls), 1)

    def test_football_data_org_needs_token_and_never_leaks_it(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            matches, note = sources.fetch_football_data_org("PL", 2026, "2627")
        self.assertEqual(matches, [])
        self.assertIn("not configured", note)
        seen = {}

        def opener(request, timeout):
            seen.update(request.headers)
            return FakeResponse(json.dumps({"matches": [{"utcDate": "2026-10-31T15:00:00Z", "status": "POSTPONED",
                                                         "homeTeam": {"name": "Hull City AFC"}, "awayTeam": {"name": "Ipswich Town FC"},
                                                         "score": {"fullTime": {"home": None, "away": None}}}]}).encode())
        out, err = sources.fetch_football_data_org("PL", 2026, "2627", token="secret-token", opener=opener)
        self.assertIsNone(err)
        self.assertEqual(out[0]["status"], "POSTPONED")
        self.assertEqual(seen.get("X-auth-token"), "secret-token")
        self.assertNotIn("secret-token", json.dumps(out))

    def test_openfootball_uk_local_times_convert_to_utc(self):
        payload = {"matches": [{"date": "2026-10-24", "time": "15:00", "team1": "Arsenal FC", "team2": "Everton FC"},
                               {"date": "2026-10-31", "time": "15:00", "team1": "Hull City AFC", "team2": "Ipswich Town FC",
                                "score": {"ft": [1, 1]}}]}
        out = sources.parse_openfootball(payload, "PL", "2627")
        self.assertEqual(out[0]["kickoff_utc"], "2026-10-24T14:00:00Z")  # BST
        self.assertEqual(out[1]["kickoff_utc"], "2026-10-31T15:00:00Z")  # GMT after clocks change
        self.assertEqual((out[1]["status"], out[1]["score"]), ("FINISHED", [1, 1]))


def sample_markets(p_home=0.5):
    sel = lambda k, l, p: {"key": k, "label": l, "p": p, "fair_odds": fair_odds(p)}
    sels = [sel("H", "Hull win", p_home), sel("D", "Draw", 0.25), sel("A", "Ipswich win", 0.75 - p_home)]
    line = lambda ln, p: {"line": ln, "over": sel("over", f"Over {ln}", p), "under": sel("under", f"Under {ln}", 1 - p)}
    ou = lambda ln, p: {"model_version": "blend30-league-v1", "evidence": {"status": "provisional", "strength": "weak"},
                        "pick": {**sel("over", f"Over {ln}", p), "line": ln}, "lines": [line(ln, p)]}
    return {"result": {"model_version": "dc-pooled-shrunk50-v1", "tier": "T2", "evidence": {"status": "provisional", "strength": "weak"},
                       "pick": max(sels, key=lambda s: s["p"]), "selections": sels},
            "goals": ou(2.5, 0.55), "corners": ou(9.5, 0.56),
            "btts": {"model_version": "blend30-league-v1", "evidence": {"status": "provisional", "strength": "weak"},
                     "pick": sel("yes", "Yes", 0.55), "selections": [sel("yes", "Yes", 0.55), sel("no", "No", 0.45)]}}


FIXTURE = {"id": "PL-2627-hull-v-ipswich", "competition": "PL", "season": "2627", "home": "Hull", "away": "Ipswich",
           "kickoff_utc": "2026-10-31T15:00:00Z"}


class History(unittest.TestCase):
    def test_publish_only_before_kickoff_and_only_when_inputs_change(self):
        ledger = hist.empty_ledger()
        self.assertIsNotNone(hist.publish(ledger, FIXTURE, sample_markets(), "fp1", ["openligadb"], NOW))
        self.assertIsNone(hist.publish(ledger, FIXTURE, sample_markets(), "fp1", ["openligadb"], NOW))
        second = hist.publish(ledger, FIXTURE, sample_markets(0.45), "fp2", ["openligadb"], NOW + dt.timedelta(days=1))
        self.assertEqual(second["revision"], 2)
        self.assertEqual(ledger["records"][0]["superseded_by"], second["record_id"])
        after = dt.datetime(2026, 10, 31, 15, 1, tzinfo=UTC)
        self.assertIsNone(hist.publish(ledger, FIXTURE, sample_markets(0.3), "fp3", ["openligadb"], after))
        self.assertTrue(hist.verify(ledger))

    def test_tampering_with_a_published_prediction_is_detected(self):
        ledger = hist.empty_ledger()
        hist.publish(ledger, FIXTURE, sample_markets(), "fp1", ["openligadb"], NOW)
        ledger["records"][0]["markets"]["result"]["selections"][0]["p"] = 0.99
        with self.assertRaises(hist.IntegrityError):
            hist.verify(ledger)

    def test_settlement_evaluates_last_pre_kickoff_revision_and_keeps_seal(self):
        ledger = hist.empty_ledger()
        hist.publish(ledger, FIXTURE, sample_markets(0.5), "fp1", ["openligadb"], NOW)
        hist.publish(ledger, FIXTURE, sample_markets(0.45), "fp2", ["openligadb"], NOW + dt.timedelta(days=1))
        finished = [{**FIXTURE, "status": "FINISHED", "score": [2, 1], "result_source": "openligadb"}]
        hist.settle(ledger, finished, {}, NOW + dt.timedelta(days=4))
        first, second = ledger["records"]
        self.assertFalse(first["evaluated"])
        self.assertTrue(second["evaluated"])
        self.assertEqual(second["settlement"]["result"]["outcome"], "H")
        self.assertTrue(second["settlement"]["result"]["pick_won"])
        self.assertTrue(second["settlement"]["goals"]["pick_won"])
        self.assertIn("pending", second["settlement"]["corners"])
        hist.settle(ledger, finished, {FIXTURE["id"]: {"HC": 4, "AC": 3}}, NOW + dt.timedelta(days=6))
        self.assertEqual(second["settlement"]["corners"]["total"], 7)
        self.assertFalse(second["settlement"]["corners"]["pick_won"])
        self.assertTrue(hist.verify(ledger))

    def test_later_score_change_is_flagged_not_overwritten(self):
        ledger = hist.empty_ledger()
        hist.publish(ledger, FIXTURE, sample_markets(), "fp1", ["openligadb"], NOW)
        hist.settle(ledger, [{**FIXTURE, "status": "FINISHED", "score": [2, 1], "result_source": "openligadb"}], {}, NOW + dt.timedelta(days=4))
        hist.settle(ledger, [{**FIXTURE, "status": "FINISHED", "score": [2, 2], "result_source": "openligadb"}], {}, NOW + dt.timedelta(days=5))
        record = ledger["records"][0]
        self.assertEqual(record["result"]["score"], [2, 1])
        self.assertIn("result_disputed", record)

    def test_performance_flags_small_samples(self):
        ledger = hist.empty_ledger()
        hist.publish(ledger, FIXTURE, sample_markets(), "fp1", ["openligadb"], NOW)
        hist.settle(ledger, [{**FIXTURE, "status": "FINISHED", "score": [0, 0], "result_source": "openligadb"}], {}, NOW + dt.timedelta(days=4))
        perf = hist.performance(ledger)
        self.assertEqual(perf["markets"]["result"]["n"], 1)
        self.assertFalse(perf["markets"]["result"]["sufficient_sample"])
        self.assertIn("T2", perf["tiers"])


class ChallengerGate(unittest.TestCase):
    def ledger_with(self, n, p_home, version, tier):
        ledger = hist.empty_ledger()
        for i in range(n):
            fixture = {**FIXTURE, "id": f"PL-2627-m{i}", "kickoff_utc": (NOW + dt.timedelta(days=1 + i)).isoformat().replace("+00:00", "Z")}
            markets = sample_markets(p_home)
            markets["result"]["model_version"], markets["result"]["tier"] = version, tier
            hist.publish(ledger, fixture, markets, "fp", ["openligadb"], NOW)
            hist.settle(ledger, [{**fixture, "status": "FINISHED", "score": [1, 0], "result_source": "openligadb"}], {}, NOW + dt.timedelta(days=400))
        return ledger

    def test_no_recommendation_below_minimum_sample(self):
        out = hist.compare_challenger(self.ledger_with(20, 0.4, "prod", "T1"), self.ledger_with(20, 0.6, "shadow", "shadow"))
        self.assertEqual(out["n"], 20)
        self.assertIn("Collecting evidence", out["recommendation"])

    def test_recommends_review_only_with_enough_clear_evidence(self):
        out = hist.compare_challenger(self.ledger_with(160, 0.4, "prod", "T1"), self.ledger_with(160, 0.6, "shadow", "shadow"))
        self.assertLess(out["delta_brier_ci95"][1], 0)
        self.assertIn("Recommend owner review", out["recommendation"])
        worse = hist.compare_challenger(self.ledger_with(160, 0.6, "prod", "T1"), self.ledger_with(160, 0.4, "shadow", "shadow"))
        self.assertIn("Keep production", worse["recommendation"])


class Recommendations(unittest.TestCase):
    RELIABILITY = {"markets": {"wins": {"bands": [{"band": "60-70%", "lo": 0.6, "hi": 0.7, "n": 104, "observed_rate": 0.66}]}}}

    def markets(self, tier, p_home, goals_over=0.55, goals_strength="weak"):
        mk = sample_markets(p_home)
        mk["result"]["tier"] = tier
        mk["result"]["league_p"] = [0.44, 0.24, 0.32]
        mk["result"]["evidence"] = {"status": "validated" if tier == "T1" else "provisional", "strength": "moderate" if tier == "T1" else "weak"}
        line = {"line": 2.5, "over": {"key": "over", "label": "Over 2.5", "p": goals_over, "fair_odds": fair_odds(goals_over)},
                "under": {"key": "under", "label": "Under 2.5", "p": 1 - goals_over, "fair_odds": fair_odds(1 - goals_over)}}
        mk["goals"] = {**mk["goals"], "lines": [line], "evidence": {"status": "provisional", "strength": goals_strength}}
        mk.pop("corners")
        return mk

    def test_validated_70_outranks_provisional_80_with_little_evidence(self):
        from pipeline.recommend import recommend
        validated = recommend(self.markets("T1", 0.66, goals_over=0.5), self.RELIABILITY)["most_likely"]
        self.assertEqual((validated["market"], validated["key"]), ("result", "H"))
        mk = self.markets("T2", 0.72, goals_over=0.5)
        mk["result"]["pick"]["p"] = 0.80  # hypothetical: larger number, far less evidence
        provisional = recommend(mk, self.RELIABILITY)["most_likely"]
        self.assertLess(provisional["lower_bound"], validated["lower_bound"])

    def test_league_average_lines_are_never_featured_and_no_bet_is_possible(self):
        from pipeline.recommend import recommend
        mk = self.markets("T3", 0.45, goals_over=0.9, goals_strength="none")
        mk["btts"]["evidence"]["strength"] = "none"
        rec = recommend(mk, self.RELIABILITY)
        self.assertEqual(rec["most_likely"]["decision"], "no_bet")
        self.assertEqual(rec["best_value"]["decision"], "no_bet")

    def test_most_likely_is_sealed_and_settled(self):
        from pipeline.recommend import recommend
        ledger = hist.empty_ledger()
        mk = self.markets("T1", 0.66)
        hist.publish(ledger, FIXTURE, mk, "fp1", ["openligadb"], NOW, recommendations=recommend(mk, self.RELIABILITY))
        ledger["records"][0]["recommendations"]["most_likely"]["p"] = 0.99
        with self.assertRaises(hist.IntegrityError):
            hist.verify(ledger)
        ledger = hist.empty_ledger()
        hist.publish(ledger, FIXTURE, mk, "fp1", ["openligadb"], NOW, recommendations=recommend(mk, self.RELIABILITY))
        hist.settle(ledger, [{**FIXTURE, "status": "FINISHED", "score": [2, 0], "result_source": "openligadb"}], {}, NOW + dt.timedelta(days=4))
        s = ledger["records"][0]["settlement"]["most_likely"]
        self.assertTrue(s["won"])
        perf = hist.performance(ledger)
        self.assertEqual(perf["most_likely"]["n"], 1)
        self.assertEqual(perf["decisions"]["best_value:no_bet"], 1)

    def test_records_sealed_before_mission_065_still_verify(self):
        ledger = hist.empty_ledger()
        hist.publish(ledger, FIXTURE, sample_markets(), "fp1", ["openligadb"], NOW)
        self.assertNotIn("recommendations", ledger["records"][0])
        self.assertTrue(hist.verify(ledger))


class FairOddsParity(unittest.TestCase):
    def test_python_matches_javascript_formatter(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node not installed")
        probs = [i / 200 for i in range(1, 200)]
        script = ("const c=require(%r);console.log(JSON.stringify(%s.map(p=>c.formatFairOdds(p))))"
                  % (str(ROOT / "market_calculations.js"), json.dumps(probs)))
        js = json.loads(subprocess.run([node, "-e", script], capture_output=True, text=True, encoding="utf-8", check=True).stdout)
        self.assertEqual(js, [fair_odds(p) for p in probs])
        self.assertEqual(len(UK_PRICE_LADDER), 66)


@unittest.skipUnless(HAVE_MODELS, "numpy/penaltyblog not installed")
class ModelsAndRun(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from pipeline.data import championship_history, load_co_uk, promoted_by_season
        from pipeline.models import Context
        epl = load_co_uk()
        cls.ctx = Context(epl + championship_history(), dt.date(2026, 10, 26), promoted_by_season(epl))

    def check_markets(self, markets):
        for key in ("result", "goals", "btts", "corners", "cards", "shots"):
            self.assertIn(key, markets)
            self.assertTrue(0 < markets[key]["pick"]["p"] < 1, key)
            self.assertRegex(markets[key]["pick"]["fair_odds"], r"^≈(\d+/\d+|Evens)$")
        self.assertAlmostEqual(sum(s["p"] for s in markets["result"]["selections"]), 1, places=2)

    def test_promoted_club_gets_pooled_tier(self):
        from pipeline.models import predict
        markets = predict({"date": dt.date(2026, 10, 31), "home": "Coventry", "away": "Sunderland", "season": "2627"}, self.ctx)
        self.assertEqual(markets["result"]["tier"], "T2")
        self.check_markets(markets)

    def test_established_clubs_use_frozen_tier(self):
        from pipeline.models import predict
        markets = predict({"date": dt.date(2026, 10, 31), "home": "Chelsea", "away": "Man United", "season": "2627"}, self.ctx)
        self.assertEqual(markets["result"]["tier"], "T1")
        self.assertEqual(markets["result"]["evidence"]["status"], "validated")
        self.check_markets(markets)

    def test_unknown_club_falls_back_to_league_average(self):
        from pipeline.models import predict
        markets = predict({"date": dt.date(2026, 10, 31), "home": "Nowhere Town", "away": "Arsenal", "season": "2627"}, self.ctx)
        self.assertEqual(markets["result"]["tier"], "T3")
        self.assertEqual(markets["result"]["evidence"]["strength"], "none")
        self.check_markets(markets)

    def test_failed_sources_keep_previous_schedule_or_fail_visibly(self):
        from pipeline import run as runner
        down = {"openligadb": lambda: ([], "HTTP 503")}
        with tempfile.TemporaryDirectory() as out:
            failed = runner.run(out, NOW, fetchers=down)
            self.assertFalse(failed["ok"])
            self.assertIsNone(failed["last_success"])
            self.assertFalse((Path(out) / "predictions.json").exists())
            self.assertTrue((Path(out) / "pipeline_status.json").exists())
            good = {"openligadb": lambda: ([m("Hull City", "Ipswich Town", "2026-10-31T15:00:00Z", "openligadb")], None)}
            ok = runner.run(out, NOW, fetchers=good)
            stale = runner.run(out, NOW + dt.timedelta(hours=6), fetchers=down)
            self.assertTrue(stale["ok"])
            self.assertIn("No fixture source responded; keeping the previous schedule.", stale["warnings"])
            self.assertEqual(stale["last_success"], (NOW + dt.timedelta(hours=6)).isoformat())
            self.assertEqual(ok["upcoming_predicted"], stale["upcoming_predicted"])

    def test_run_is_idempotent_and_refuses_tampered_history(self):
        from pipeline import run as runner
        schedule = [m("Hull City", "Ipswich Town", "2026-10-31T15:00:00Z", "openligadb"),
                    m("Chelsea", "Man United", "2026-10-31T12:30:00Z", "openligadb"),
                    m("Arsenal", "Everton", "2026-10-24T14:00:00Z", "openligadb")]
        fetchers = {"openligadb": lambda: (copy.deepcopy(schedule), None)}
        with tempfile.TemporaryDirectory() as out:
            first = runner.run(out, NOW, fetchers=fetchers)
            self.assertTrue(first["ok"])
            self.assertEqual(first["upcoming_predicted"], 2)
            fixtures = {f["home"]: f for f in json.loads((Path(out) / "fixtures.json").read_text(encoding="utf-8"))["fixtures"]}
            self.assertEqual(fixtures["Arsenal"]["status"], "AWAITING_RESULT")
            second = runner.run(out, NOW + dt.timedelta(hours=6), fetchers=fetchers)
            self.assertEqual(second["published_revisions"], 0)
            path = Path(out) / "prediction_history.json"
            ledger = json.loads(path.read_text(encoding="utf-8"))
            ledger["records"][-1]["markets"]["result"]["pick"]["p"] = 0.99
            path.write_text(json.dumps(ledger), encoding="utf-8")
            before = (Path(out) / "predictions.json").read_text(encoding="utf-8")
            with self.assertRaises(hist.IntegrityError):
                runner.run(out, NOW + dt.timedelta(hours=12), fetchers=fetchers)
            self.assertEqual((Path(out) / "predictions.json").read_text(encoding="utf-8"), before)


if __name__ == "__main__":
    unittest.main()
