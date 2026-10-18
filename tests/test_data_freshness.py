"""Deterministic freshness tests; temporary fixtures only, no network or repository writes."""
import csv
import datetime as dt
import io
import json
import pathlib
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch
from zoneinfo import ZoneInfo

import update_data

REAL_DATETIME = dt.datetime


class RefreshMetadataTests(unittest.TestCase):
    def setUp(self):
        self.old_time = "2026-10-17T08:00:00+00:00"
        self.now = "2026-10-18T09:00:00+00:00"
        self.previous = {
            "last_successful_refresh": self.old_time,
            "season_status": [
                {"season": "2425", "rows": 380},
                {"season": "2526", "rows": 380},
                {"season": "2627", "rows": 60},
            ],
        }

    def test_current_season_success_is_reported_separately(self):
        metadata = update_data.build_refresh_metadata(
            self.previous,
            {"2425": 380, "2526": 380, "2627": 61},
            {},
            self.now,
        )
        current = metadata["current_season_status"]
        self.assertEqual(current["download_status"], "success")
        self.assertEqual(current["freshness_status"], "unverifiable")
        self.assertEqual(current["status"], "unavailable")
        self.assertIsNone(metadata["last_successful_refresh"])
        self.assertEqual(metadata["legacy_unverified_refresh_at"], self.old_time)
        self.assertEqual(current["rows"], 61)
        self.assertEqual(metadata["historical_seasons_updated"], ["2425", "2526"])

    def test_historical_success_cannot_make_failed_current_season_fresh(self):
        metadata = update_data.build_refresh_metadata(
            self.previous,
            {"2425": 380, "2526": 380},
            {"2627": "timeout"},
            self.now,
        )
        current = metadata["current_season_status"]
        self.assertEqual(current["status"], "unavailable")
        self.assertIsNone(current["last_successful_refresh"])
        self.assertIsNone(metadata["last_successful_refresh"])
        self.assertEqual(metadata["legacy_unverified_refresh_at"], self.old_time)
        self.assertNotEqual(metadata["last_successful_refresh"], self.now)
        self.assertEqual(metadata["historical_seasons_updated"], ["2425", "2526"])

    def test_failed_current_download_retains_independent_stale_freshness_warning(self):
        freshness = {
            "status": "stale",
            "verified_new": False,
            "warnings": ["expected result missing"],
        }
        metadata = update_data.build_refresh_metadata(
            self.previous, {"2425": 380}, {"2627": "timeout"}, self.now,
            freshness=freshness,
        )
        current = metadata["current_season_status"]
        self.assertEqual(current["download_status"], "failed")
        self.assertEqual(current["freshness_status"], "stale")
        self.assertIsNone(current["last_successful_refresh"])
        self.assertEqual(current["freshness_warnings"], ["expected result missing"])
        self.assertEqual(metadata["legacy_unverified_refresh_at"], self.old_time)

    def test_failed_current_download_cannot_claim_cached_rows_verified_this_run(self):
        freshness = {
            "status": "verified",
            "verified_new": True,
            "result_freshness_status": "verified",
            "result_verified_new": True,
            "statistics_freshness_status": "verified",
            "statistics_verified_new": True,
            "coverage_evidence": {"expected_completed_fixture_count": 1},
            "warnings": [],
        }
        previous = {"current_season_status": {
            "freshness_status": "verified",
            "last_freshness_verified_at": self.old_time,
            "last_result_verified_at": self.old_time,
            "last_statistics_verified_at": self.old_time,
        }}
        metadata = update_data.build_refresh_metadata(
            previous, {"2425": 380}, {"2627": "timeout"}, self.now,
            freshness=freshness,
        )
        current = metadata["current_season_status"]
        self.assertEqual(current["download_status"], "failed")
        self.assertEqual(current["freshness_status"], "unverifiable")
        self.assertFalse(current["verified_new"])
        self.assertFalse(current["result_verified_new"])
        self.assertFalse(current["statistics_verified_new"])
        self.assertEqual(current["last_freshness_verified_at"], self.old_time)
        self.assertEqual(current["last_result_verified_at"], self.old_time)
        self.assertEqual(current["last_statistics_verified_at"], self.old_time)

    def test_failed_historical_season_retains_its_last_verified_timestamp(self):
        previous = {
            "season_status": [
                {"season": "2425", "rows": 380, "status": "updated", "last_successful_refresh": self.old_time},
                {"season": "2526", "rows": 380, "status": "updated", "last_successful_refresh": self.old_time},
                {"season": "2627", "rows": 60, "status": "updated", "last_successful_refresh": self.old_time},
            ]
        }
        metadata = update_data.build_refresh_metadata(
            previous,
            {"2526": 380, "2627": 61},
            {"2425": "source unavailable"},
            self.now,
        )
        first = metadata["season_status"][0]
        self.assertEqual(first["status"], "unavailable")
        self.assertEqual(first["rows"], 380)
        self.assertEqual(first["last_successful_refresh"], self.old_time)


class CurrentSeasonFreshnessTests(unittest.TestCase):
    NOW = dt.datetime(2026, 10, 20, 12, 0, tzinfo=dt.timezone.utc)
    OLD_VERIFIED = "2026-10-12T20:00:00+00:00"

    @staticmethod
    def fixture(day="2026-10-17", time="14:00", home="Brentford", away="Liverpool"):
        return {"Date": day, "Time": time, "HomeTeam": home, "AwayTeam": away}

    @staticmethod
    def match(day="17/10/2026", home="Brentford", away="Liverpool", hg="1", ag="2",
              ftr="A", hc="7", ac="5"):
        return {
            "Date": day, "HomeTeam": home, "AwayTeam": away,
            "FTHG": hg, "FTAG": ag, "FTR": ftr, "HC": hc, "AC": ac,
        }

    def test_parse_synthetic_csv_from_temporary_file(self):
        csv_text = "Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HC,AC\n" \
                   "17/10/2026,Brentford,Liverpool,1,2,A,7,5\n"
        with tempfile.TemporaryDirectory() as temp_dir:
            path = pathlib.Path(temp_dir) / "E0.csv"
            path.write_text(csv_text, encoding="utf-8")
            rows = update_data.parse_season_csv(path.read_text(encoding="utf-8"), "2627")
        self.assertEqual(rows[0]["season"], "2627")
        self.assertEqual(rows[0]["FTR"], "A")

    def test_empty_valid_fixture_feed_is_not_offseason_proof(self):
        fixtures, evidence = update_data.parse_fixture_schedule_csv(
            "Div,Date,Time,HomeTeam,AwayTeam\n", dt.date(2026, 10, 20)
        )
        self.assertEqual(fixtures, [])
        self.assertEqual(evidence["feed_status"], "available")
        self.assertEqual(evidence["window_fixture_count"], 0)
        self.assertEqual(evidence["raw_e0_fixture_count"], 0)
        self.assertEqual(evidence["off_season_status"], "unconfirmed")
        self.assertFalse(evidence["off_season_confirmed"])
        self.assertEqual(evidence["source_record_count"], 0)

    def test_non_premier_feed_rows_are_not_fixture_coverage_or_offseason_proof(self):
        fixtures, evidence = update_data.parse_fixture_schedule_csv(
            "Div,Date,Time,HomeTeam,AwayTeam\nE1,21/10/2026,15:00,Team A,Team B\n",
            dt.date(2026, 10, 20),
        )
        freshness = update_data.assess_current_season_freshness(
            [], fixtures, [], self.NOW, schedule_evidence=evidence,
        )
        self.assertEqual(evidence["source_record_count"], 1)
        self.assertEqual(evidence["raw_e0_fixture_count"], 0)
        self.assertEqual(freshness["status"], "unverifiable")
        self.assertEqual(freshness["coverage_evidence"]["schedule_completeness"], "not_independently_attested")

    def test_ambiguous_schedule_dates_are_counted_as_unusable_coverage(self):
        body = "Div,Date,Time,HomeTeam,AwayTeam\nE0,not-a-date,14:00,Brentford,Liverpool\n"
        fixtures, evidence = update_data.parse_fixture_schedule_csv(
            body, dt.date(2026, 10, 20)
        )
        self.assertEqual(fixtures, [])
        self.assertEqual(evidence["raw_e0_fixture_count"], 1)
        self.assertEqual(evidence["invalid_window_fixture_count"], 1)
        self.assertEqual(evidence["window_fixture_count"], 0)

    def test_current_schedule_rows_provide_counted_coverage_evidence(self):
        body = "Div,Date,Time,HomeTeam,AwayTeam\nE0,21/10/2026,15:00,Arsenal,Leeds\n"
        fixtures, evidence = update_data.parse_fixture_schedule_csv(
            body, dt.date(2026, 10, 20)
        )
        self.assertEqual(len(fixtures), 1)
        self.assertEqual(evidence["feed_status"], "available")
        self.assertEqual(evidence["raw_e0_fixture_count"], 1)
        self.assertEqual(evidence["window_fixture_count"], 1)
        self.assertEqual(evidence["source_record_count"], 1)
        self.assertEqual(evidence["off_season_status"], "not_indicated")

    def test_valid_but_stale_download_does_not_advance_verified_timestamp(self):
        expected = [self.fixture()]
        freshness = update_data.assess_current_season_freshness(
            [], expected, [], self.NOW
        )
        retrieval_time = "2026-10-20T12:01:00+00:00"
        verification_time = "2026-10-20T12:05:00+00:00"
        attempt_time = "2026-10-20T11:59:00+00:00"
        metadata = update_data.build_refresh_metadata(
            {"current_season_status": {
                "freshness_status": "verified",
                "last_freshness_verified_at": self.OLD_VERIFIED,
            }},
            {"2627": 60}, {}, verification_time, freshness=freshness,
            attempted_at=attempt_time, last_download_at=retrieval_time,
        )
        current = metadata["current_season_status"]
        self.assertEqual(freshness["status"], "unverifiable")
        self.assertEqual(freshness["known_fixture_status"], "stale")
        self.assertEqual(current["download_status"], "success")
        self.assertEqual(current["freshness_status"], "unverifiable")
        self.assertEqual(current["known_fixture_status"], "stale")
        self.assertEqual(current["status"], "unavailable")
        self.assertEqual(current["last_successful_refresh"], self.OLD_VERIFIED)
        self.assertEqual(current["last_freshness_verified_at"], self.OLD_VERIFIED)
        self.assertEqual(current["last_download_at"], retrieval_time)
        self.assertEqual(current["freshness_checked_at"], verification_time)
        self.assertIsNone(current["provider_published_at"])
        self.assertEqual(metadata["refresh_attempted_at"], attempt_time)
        self.assertEqual(metadata["last_successful_refresh"], self.OLD_VERIFIED)

    def test_valid_current_download_keeps_known_results_but_not_comprehensive_freshness(self):
        rows = [self.match()]
        original = [dict(row) for row in rows]
        freshness = update_data.assess_current_season_freshness(
            rows, [self.fixture()], [], self.NOW
        )
        metadata = update_data.build_refresh_metadata(
            {"current_season_status": {
                "freshness_status": "verified",
                "last_freshness_verified_at": self.OLD_VERIFIED,
            }},
            {"2627": 61}, {}, self.NOW.isoformat(), freshness=freshness,
        )
        current = metadata["current_season_status"]
        self.assertEqual(freshness["status"], "unverifiable")
        self.assertEqual(freshness["known_fixture_status"], "verified")
        self.assertEqual(freshness["result_freshness_status"], "verified")
        self.assertEqual(freshness["coverage_completeness_status"], "unverifiable")
        self.assertEqual(current["status"], "unavailable")
        self.assertEqual(current["freshness_status"], "unverifiable")
        self.assertEqual(current["result_freshness_status"], "verified")
        self.assertTrue(current["result_verified_new"])
        self.assertEqual(current["last_result_verified_at"], self.NOW.isoformat())
        self.assertEqual(current["last_successful_refresh"], self.OLD_VERIFIED)
        self.assertEqual(rows, original)

    def test_metadata_never_reports_updated_without_new_verification(self):
        freshness = {
            "status": "verified",
            "verified_new": False,
            "result_freshness_status": "verified",
            "statistics_freshness_status": "verified",
            "coverage_evidence": {"expected_completed_fixture_count": 0},
            "warnings": [],
        }
        metadata = update_data.build_refresh_metadata(
            {"current_season_status": {
                "freshness_status": "verified",
                "last_freshness_verified_at": self.OLD_VERIFIED,
            }},
            {"2627": 60}, {}, self.NOW.isoformat(), freshness=freshness,
        )
        current = metadata["current_season_status"]
        self.assertEqual(current["status"], "unavailable")
        self.assertEqual(current["freshness_status"], "unverifiable")
        self.assertEqual(current["last_freshness_verified_at"], self.OLD_VERIFIED)
        self.assertEqual(metadata["last_successful_refresh"], self.OLD_VERIFIED)
        self.assertEqual(current["coverage_evidence"]["expected_completed_fixture_count"], 0)

    def test_verified_flag_with_nonverified_status_does_not_advance_overall_timestamp(self):
        freshness = {
            "status": "stale",
            "verified_new": True,
            "result_freshness_status": "verified",
            "result_verified_new": True,
            "statistics_freshness_status": "stale",
            "statistics_verified_new": False,
            "coverage_evidence": {"expected_completed_fixture_count": 1},
            "warnings": [],
        }
        metadata = update_data.build_refresh_metadata(
            {"current_season_status": {
                "freshness_status": "verified",
                "last_freshness_verified_at": self.OLD_VERIFIED,
                "last_result_verified_at": self.OLD_VERIFIED,
                "last_statistics_verified_at": self.OLD_VERIFIED,
            }},
            {"2627": 61}, {}, self.NOW.isoformat(), freshness=freshness,
        )
        current = metadata["current_season_status"]
        self.assertEqual(current["status"], "unavailable")
        self.assertEqual(current["freshness_status"], "stale")
        self.assertEqual(current["last_successful_refresh"], self.OLD_VERIFIED)
        self.assertEqual(current["last_result_verified_at"], self.NOW.isoformat())
        self.assertEqual(current["last_statistics_verified_at"], self.OLD_VERIFIED)

    def test_missing_scores_are_stale_but_missing_corners_are_reported_separately(self):
        no_score = self.match(hg="", ftr="")
        freshness = update_data.assess_current_season_freshness(
            [no_score], [self.fixture()], [], self.NOW
        )
        self.assertEqual(freshness["status"], "unverifiable")
        self.assertEqual(freshness["known_fixture_status"], "stale")
        self.assertEqual(len(freshness["missing_scores"]), 1)

        no_corners = self.match(hc="", ac="")
        freshness = update_data.assess_current_season_freshness(
            [no_corners], [self.fixture()], [], self.NOW
        )
        self.assertEqual(freshness["status"], "unverifiable")
        self.assertEqual(freshness["known_fixture_status"], "stale")
        self.assertEqual(len(freshness["missing_statistics"]), 1)
        self.assertEqual(freshness["missing_scores"], [])
        self.assertEqual(freshness["result_freshness_status"], "verified")
        self.assertEqual(freshness["statistics_freshness_status"], "stale")
        self.assertEqual(freshness["coverage_evidence"]["verified_score_count"], 1)
        self.assertEqual(freshness["coverage_evidence"]["verified_statistics_count"], 0)
        metadata = update_data.build_refresh_metadata(
            {}, {"2627": 61}, {}, self.NOW.isoformat(), freshness=freshness,
        )
        current = metadata["current_season_status"]
        self.assertEqual(current["result_freshness_status"], "verified")
        self.assertEqual(current["statistics_freshness_status"], "stale")
        self.assertTrue(current["result_verified_new"])
        self.assertFalse(current["statistics_verified_new"])
        self.assertEqual(current["last_result_verified_at"], self.NOW.isoformat())
        self.assertIsNone(current["last_statistics_verified_at"])
        self.assertEqual(current["status"], "unavailable")

    def test_empty_current_schedule_cannot_verify_from_previous_schedule_only(self):
        freshness = update_data.assess_current_season_freshness(
            [self.match()], [self.fixture()], [], self.NOW,
            previous_freshness_status="verified",
            schedule_evidence={
                "feed_status": "available",
                "window_fixture_count": 0,
                "raw_e0_fixture_count": 0,
                "off_season_status": "unconfirmed",
                "off_season_confirmed": False,
            },
        )
        self.assertEqual(freshness["status"], "unverifiable")
        self.assertFalse(freshness["verified_new"])
        self.assertEqual(freshness["coverage_evidence"]["schedule_feed_status"], "available")
        self.assertEqual(freshness["coverage_evidence"]["raw_e0_fixture_count"], 0)
        self.assertEqual(freshness["coverage_evidence"]["off_season_status"], "unconfirmed")

    def test_duplicate_identical_or_conflicting_rows_are_not_verified(self):
        same = self.match()
        for duplicate in (dict(same), self.match(hg="3", ag="2", ftr="H")):
            freshness = update_data.assess_current_season_freshness(
                [same, duplicate], [self.fixture()], [], self.NOW
            )
            self.assertEqual(freshness["status"], "unverifiable")
            self.assertEqual(freshness["known_fixture_status"], "stale")
            self.assertEqual(len(freshness["duplicate_fixtures"]), 1)

    def test_missing_result_inside_publication_grace_is_delayed_not_stale(self):
        now = dt.datetime(2026, 10, 18, 12, 0, tzinfo=dt.timezone.utc)
        freshness = update_data.assess_current_season_freshness(
            [], [self.fixture()], [], now
        )
        self.assertEqual(freshness["status"], "unverifiable")
        self.assertEqual(freshness["known_fixture_status"], "awaiting_publication")
        self.assertTrue(freshness["pending_fixtures"])
        self.assertIn("48-hour", " ".join(freshness["warnings"]))

    def test_date_only_fixture_uses_conservative_48_hour_grace(self):
        fixture = self.fixture(time="")
        within_grace = update_data.assess_current_season_freshness(
            [], [fixture], [], dt.datetime(2026, 10, 19, 23, 59, tzinfo=dt.timezone.utc)
        )
        beyond_grace = update_data.assess_current_season_freshness(
            [], [fixture], [], dt.datetime(2026, 10, 20, 0, 0, tzinfo=dt.timezone.utc)
        )
        self.assertEqual(within_grace["status"], "unverifiable")
        self.assertEqual(within_grace["known_fixture_status"], "awaiting_publication")
        self.assertEqual(beyond_grace["status"], "unverifiable")
        self.assertEqual(beyond_grace["known_fixture_status"], "stale")

    def test_utc_date_rollover_controls_when_fixture_becomes_expected(self):
        fixture = self.fixture(day="2026-10-20", time="")
        london = ZoneInfo("Europe/London")
        before_utc_rollover = update_data.assess_current_season_freshness(
            [], [fixture], [], dt.datetime(2026, 10, 21, 0, 30, tzinfo=london)
        )
        after_utc_rollover = update_data.assess_current_season_freshness(
            [], [fixture], [], dt.datetime(2026, 10, 21, 1, 0, tzinfo=london)
        )
        self.assertEqual(
            before_utc_rollover["coverage_evidence"]["expected_completed_fixture_count"], 0
        )
        self.assertEqual(
            after_utc_rollover["coverage_evidence"]["expected_completed_fixture_count"], 1
        )
        self.assertEqual(after_utc_rollover["status"], "unverifiable")
        self.assertEqual(after_utc_rollover["known_fixture_status"], "awaiting_publication")

    def test_spring_dst_transition_does_not_shorten_utc_grace(self):
        fixture = self.fixture(day="2026-03-28", time="")
        london = ZoneInfo("Europe/London")
        before_deadline = update_data.assess_current_season_freshness(
            [], [fixture], [], dt.datetime(2026, 3, 31, 0, 59, tzinfo=london)
        )
        at_deadline = update_data.assess_current_season_freshness(
            [], [fixture], [], dt.datetime(2026, 3, 31, 1, 0, tzinfo=london)
        )
        self.assertEqual(before_deadline["status"], "unverifiable")
        self.assertEqual(before_deadline["known_fixture_status"], "awaiting_publication")
        self.assertEqual(at_deadline["status"], "unverifiable")
        self.assertEqual(at_deadline["known_fixture_status"], "stale")

    def test_autumn_dst_transition_does_not_extend_utc_grace(self):
        fixture = self.fixture(day="2026-10-24", time="")
        london = ZoneInfo("Europe/London")
        before_deadline = update_data.assess_current_season_freshness(
            [], [fixture], [], dt.datetime(2026, 10, 26, 23, 59, tzinfo=london)
        )
        at_deadline = update_data.assess_current_season_freshness(
            [], [fixture], [], dt.datetime(2026, 10, 27, 0, 0, tzinfo=london)
        )
        self.assertEqual(before_deadline["status"], "unverifiable")
        self.assertEqual(before_deadline["known_fixture_status"], "awaiting_publication")
        self.assertEqual(at_deadline["status"], "unverifiable")
        self.assertEqual(at_deadline["known_fixture_status"], "stale")

    def test_missing_kickoff_does_not_prevent_valid_coverage_check(self):
        fixture = self.fixture(time="")
        freshness = update_data.assess_current_season_freshness(
            [self.match()], [fixture], [], self.NOW
        )
        self.assertEqual(freshness["status"], "unverifiable")
        self.assertEqual(freshness["known_fixture_status"], "verified")
        self.assertEqual(freshness["result_freshness_status"], "verified")
        self.assertTrue(any("authoritative fixture-completeness" in warning for warning in freshness["warnings"]))

    def test_no_current_fixture_coverage_does_not_reuse_prior_verification(self):
        freshness = update_data.assess_current_season_freshness(
            [self.match()], [], [], self.NOW, previous_freshness_status="verified"
        )
        self.assertEqual(freshness["status"], "unverifiable")
        self.assertFalse(freshness["verified_new"])
        evidence = freshness["coverage_evidence"]
        self.assertEqual(evidence["expected_completed_fixture_count"], 0)
        self.assertEqual(evidence["verified_score_count"], 0)
        self.assertFalse(evidence["off_season_confirmed"])
        self.assertEqual(evidence["off_season_status"], "unconfirmed")
        self.assertEqual(
            evidence["reschedule_reconciliation"],
            "unavailable_without_stable_provider_fixture_id",
        )

    def test_same_day_fixture_is_not_assumed_completed(self):
        fixture = self.fixture(day="2026-10-20", time="")
        freshness = update_data.assess_current_season_freshness(
            [], [fixture], [], self.NOW, previous_freshness_status="verified"
        )
        self.assertEqual(freshness["status"], "unverifiable")
        self.assertFalse(freshness["verified_new"])
        self.assertEqual(freshness["pending_fixtures"], [])

    def test_old_independently_valid_fixture_remains_usable_when_another_is_missing(self):
        valid = self.match(day="10/10/2026", home="Aston Villa", away="Brentford",
                           hg="2", ag="2", ftr="D", hc="2", ac="2")
        expected = [
            self.fixture(day="2026-10-10", time="15:00", home="Aston Villa", away="Brentford"),
            self.fixture(day="2026-10-17"),
        ]
        freshness = update_data.assess_current_season_freshness(
            [valid], expected, [], self.NOW
        )
        self.assertEqual(freshness["status"], "unverifiable")
        self.assertEqual(freshness["known_fixture_status"], "stale")
        self.assertEqual(len(freshness["pending_fixtures"]), 1)
        self.assertEqual(freshness["pending_fixtures"][0]["HomeTeam"], "Brentford")
        self.assertEqual(valid["FTHG"], "2")

    def test_saved_pending_fixture_survives_fixture_feed_rollover(self):
        pending = [{"Date": "2026-10-17", "Time": "14:00", "HomeTeam": "Brentford",
                    "AwayTeam": "Liverpool", "kickoff_utc": "2026-10-17T13:00:00+00:00"}]
        freshness = update_data.assess_current_season_freshness(
            [], [], pending, self.NOW
        )
        self.assertEqual(freshness["status"], "unverifiable")
        self.assertEqual(freshness["known_fixture_status"], "stale")
        self.assertEqual(len(freshness["pending_fixtures"]), 1)
        self.assertIn("stable provider fixture ID", " ".join(freshness["warnings"]))

    def test_unattested_schedule_cannot_claim_complete_freshness(self):
        known_fixture = self.fixture(
            day="2026-10-10", home="Arsenal", away="Leeds"
        )
        future_fixture = self.fixture(
            day="2026-10-21", home="Chelsea", away="Spurs"
        )
        valid_result = self.match(
            day="10/10/2026", home="Arsenal", away="Leeds",
            hg="2", ag="1", ftr="H", hc="4", ac="2",
        )
        schedule_evidence = {
            "source": "synthetic fixture feed",
            "feed_status": "available",
            "source_record_count": 1,
            "window_fixture_count": 1,
            "raw_e0_fixture_count": 1,
            "invalid_window_fixture_count": 0,
            "off_season_status": "not_indicated",
            "off_season_confirmed": False,
            "completeness_attested": False,
        }
        freshness = update_data.assess_current_season_freshness(
            [valid_result], [known_fixture, future_fixture], [], self.NOW,
            schedule_evidence=schedule_evidence,
        )

        # A recently completed fixture may be absent from both known schedules;
        # do not invent it, but do not claim the known subset is comprehensive.
        self.assertEqual(freshness["status"], "unverifiable")
        self.assertEqual(freshness["known_fixture_status"], "verified")
        self.assertEqual(freshness["coverage_completeness_status"], "unverifiable")
        self.assertEqual(freshness["result_freshness_status"], "verified")
        self.assertTrue(freshness["result_verified_new"])
        self.assertFalse(freshness["verified_new"])
        self.assertEqual(
            freshness["coverage_evidence"]["expected_completed_fixture_count"], 1
        )
        self.assertEqual(
            freshness["coverage_evidence"]["schedule_completeness"],
            "not_independently_attested",
        )

        metadata = update_data.build_refresh_metadata(
            {}, {"2627": 1}, {}, self.NOW.isoformat(), freshness=freshness,
        )
        current = metadata["current_season_status"]
        self.assertEqual(current["status"], "unavailable")
        self.assertEqual(current["freshness_status"], "unverifiable")
        self.assertEqual(current["known_fixture_status"], "verified")
        self.assertEqual(current["result_freshness_status"], "verified")
        self.assertFalse(current["verified_new"])
    def _run_main_with_synthetic_downloads(
        self, current_rows, previous_matches, previous_fixtures, pending_fixtures,
        previous_current_status=None, run_at=None,
    ):
        fields = ["Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR",
                  "HC", "AC", "HY", "AY", "HST", "AST", "HS", "AS"]

        def csv_body(rows):
            stream = io.StringIO()
            writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
            return stream.getvalue()

        historic_2425 = self.match(
            day="01/05/2025", home="Historic A", away="Historic B"
        )
        historic_2526 = self.match(
            day="01/05/2026", home="Historic C", away="Historic D"
        )
        season_bodies = {
            "2425": csv_body([historic_2425]),
            "2526": csv_body([historic_2526]),
            "2627": csv_body(current_rows),
        }
        run_at = run_at or self.NOW
        fixture_day = (run_at.date() + dt.timedelta(days=1)).strftime("%d/%m/%Y")
        fixture_body = "\n".join([
            "Div,Date,Time,HomeTeam,AwayTeam",
            f"E0,{fixture_day},15:00,Upcoming,Future",
        ]) + "\n"
        old_timestamp = self.OLD_VERIFIED
        previous = {
            "matches": previous_matches,
            "fixtures": previous_fixtures,
            "pending_expected_fixtures": pending_fixtures,
            "current_season_status": previous_current_status or {
                "freshness_status": "verified",
                "last_successful_refresh": old_timestamp,
                "last_freshness_verified_at": old_timestamp,
                "last_result_verified_at": old_timestamp,
                "last_statistics_verified_at": old_timestamp,
            },
        }

        frozen_now = run_at

        class FrozenDateTime(REAL_DATETIME):
            @classmethod
            def now(cls, tz=None):
                return frozen_now if tz is not None else frozen_now.replace(tzinfo=None)

        def fake_urlopen(request, timeout=20):
            url = request.full_url
            if url.endswith("/fixtures.csv"):
                return io.BytesIO(fixture_body.encode("utf-8"))
            season = url.rsplit("/", 2)[-2]
            return io.BytesIO(season_bodies[season].encode("utf-8"))

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = pathlib.Path(temp_dir) / "matches.json"
            output_path.write_text(json.dumps(previous), encoding="utf-8")
            with (
                patch.object(update_data, "OUT", output_path),
                patch.object(update_data.urllib.request, "urlopen", side_effect=fake_urlopen),
                patch.object(update_data.dt, "datetime", FrozenDateTime),
                redirect_stdout(io.StringIO()),
            ):
                update_data.main()
            return json.loads(output_path.read_text(encoding="utf-8"))

    def _cached_match(self, day, home, away, prediction_id):
        row = self.match(day=day, home=home, away=away)
        row["season"] = update_data.CURRENT_SEASON
        row["prediction_record"] = {
            "id": prediction_id,
            "market": "Match Winner",
            "probabilities": {"H": 0.6, "D": 0.25, "A": 0.15},
        }
        return row

    def test_main_omitted_fixture_does_not_reverify_cached_results(self):
        good_fixture = self.fixture(
            day="2026-10-10", home="Arsenal", away="Leeds"
        )
        omitted_fixture = self.fixture(
            day="2026-10-11", home="Spurs", away="Wolves"
        )
        good = self._cached_match("10/10/2026", "Arsenal", "Leeds", "forecast-good")
        omitted = self._cached_match("11/10/2026", "Spurs", "Wolves", "forecast-omitted")
        payload = self._run_main_with_synthetic_downloads(
            [dict(good)], [good, omitted], [good_fixture], [omitted_fixture]
        )

        current = payload["current_season_status"]
        self.assertEqual(current["result_freshness_status"], "stale")
        self.assertEqual(current["statistics_freshness_status"], "stale")
        self.assertFalse(current["result_verified_new"])
        self.assertFalse(current["statistics_verified_new"])
        self.assertEqual(current["last_result_verified_at"], self.OLD_VERIFIED)
        self.assertEqual(current["last_statistics_verified_at"], self.OLD_VERIFIED)
        self.assertEqual(current["last_freshness_verified_at"], self.OLD_VERIFIED)

        stored = {
            update_data.fixture_key(row): row
            for row in payload["matches"]
            if row.get("season") == update_data.CURRENT_SEASON
        }
        self.assertEqual(stored[update_data.fixture_key(omitted)]["FTHG"], omitted["FTHG"])
        self.assertEqual(stored[update_data.fixture_key(omitted)]["prediction_record"], omitted["prediction_record"])
        self.assertEqual(
            tuple(stored[update_data.fixture_key(good)][field] for field in ("FTHG", "FTAG", "FTR", "HC", "AC")),
            ("1", "2", "A", "7", "5"),
        )
        self.assertEqual(stored[update_data.fixture_key(good)]["prediction_record"], good["prediction_record"])

    def test_main_blank_scores_do_not_inherit_for_verification(self):
        fixture = self.fixture(day="2026-10-10", home="Arsenal", away="Leeds")
        cached = self._cached_match("10/10/2026", "Arsenal", "Leeds", "forecast-score")
        current_row = self.match(
            day="10/10/2026", home="Arsenal", away="Leeds",
            hg="", ag="", ftr="", hc="7", ac="5",
        )
        payload = self._run_main_with_synthetic_downloads(
            [current_row], [cached], [fixture], []
        )
        current = payload["current_season_status"]
        self.assertEqual(current["result_freshness_status"], "stale")
        self.assertEqual(current["statistics_freshness_status"], "verified")
        self.assertFalse(current["result_verified_new"])
        self.assertTrue(current["statistics_verified_new"])
        self.assertEqual(current["last_result_verified_at"], self.OLD_VERIFIED)
        self.assertEqual(current["last_statistics_verified_at"], self.NOW.isoformat())
        stored = next(row for row in payload["matches"] if row.get("season") == update_data.CURRENT_SEASON
                      and update_data.fixture_key(row) == update_data.fixture_key(fixture))
        self.assertEqual((stored["FTHG"], stored["FTAG"], stored["FTR"]), ("1", "2", "A"))
        self.assertEqual(stored["prediction_record"], cached["prediction_record"])

    def test_main_blank_corners_do_not_inherit_for_verification(self):
        fixture = self.fixture(day="2026-10-10", home="Arsenal", away="Leeds")
        cached = self._cached_match("10/10/2026", "Arsenal", "Leeds", "forecast-corners")
        current_row = self.match(
            day="10/10/2026", home="Arsenal", away="Leeds",
            hg="1", ag="2", ftr="A", hc="", ac="",
        )
        payload = self._run_main_with_synthetic_downloads(
            [current_row], [cached], [fixture], []
        )
        current = payload["current_season_status"]
        self.assertEqual(current["result_freshness_status"], "verified")
        self.assertEqual(current["statistics_freshness_status"], "stale")
        self.assertTrue(current["result_verified_new"])
        self.assertFalse(current["statistics_verified_new"])
        self.assertEqual(current["last_result_verified_at"], self.NOW.isoformat())
        self.assertEqual(current["last_statistics_verified_at"], self.OLD_VERIFIED)
        stored = next(row for row in payload["matches"] if row.get("season") == update_data.CURRENT_SEASON
                      and update_data.fixture_key(row) == update_data.fixture_key(fixture))
        self.assertEqual((stored["HC"], stored["AC"]), ("7", "5"))
        self.assertEqual(stored["prediction_record"], cached["prediction_record"])

    def test_main_two_refreshes_retain_verified_fixture_identity_after_pending_clears(self):
        verified_fixture = self.fixture(
            day="2026-10-10", home="Arsenal", away="Leeds"
        )
        still_pending_fixture = self.fixture(
            day="2026-10-11", home="Spurs", away="Wolves"
        )
        cached_verified = self._cached_match(
            "10/10/2026", "Arsenal", "Leeds", "forecast-retained"
        )
        cached_pending = self._cached_match(
            "11/10/2026", "Spurs", "Wolves", "forecast-pending"
        )
        first_verified_row = self.match(
            day="10/10/2026", home="Arsenal", away="Leeds",
            hg="2", ag="1", ftr="H", hc="5", ac="3",
        )
        first_pending_row = self.match(
            day="11/10/2026", home="Spurs", away="Wolves",
            hg="1", ag="0", ftr="H", hc="", ac="",
        )

        first = self._run_main_with_synthetic_downloads(
            [first_verified_row, first_pending_row],
            [cached_verified, cached_pending],
            [],
            [verified_fixture, still_pending_fixture],
        )
        first_status = first["current_season_status"]
        self.assertEqual(first_status["result_freshness_status"], "verified")
        self.assertTrue(first_status["result_verified_new"])
        self.assertEqual(first_status["statistics_freshness_status"], "stale")
        self.assertEqual(first_status["last_result_verified_at"], self.NOW.isoformat())
        self.assertEqual(first["pending_expected_fixtures"], [
            {"Date": "2026-10-11", "Time": "14:00", "HomeTeam": "Spurs", "AwayTeam": "Wolves"}
        ])
        self.assertEqual(first["fixtures"], [{
            "Date": "2026-10-21", "Time": "15:00",
            "HomeTeam": "Upcoming", "AwayTeam": "Future",
        }])

        second_now = self.NOW + dt.timedelta(days=1)
        second_valid_row = self.match(
            day="11/10/2026", home="Spurs", away="Wolves",
            hg="1", ag="0", ftr="H", hc="6", ac="4",
        )
        second = self._run_main_with_synthetic_downloads(
            [second_valid_row],
            first["matches"],
            first["fixtures"],
            first["pending_expected_fixtures"],
            previous_current_status=first_status,
            run_at=second_now,
        )
        second_status = second["current_season_status"]
        self.assertEqual(second_status["result_freshness_status"], "stale")
        self.assertEqual(second_status["statistics_freshness_status"], "stale")
        self.assertFalse(second_status["result_verified_new"])
        self.assertFalse(second_status["statistics_verified_new"])
        self.assertEqual(second_status["last_result_verified_at"], first_status["last_result_verified_at"])
        self.assertEqual(second_status["last_statistics_verified_at"], first_status["last_statistics_verified_at"])
        self.assertNotEqual(second_status["last_result_verified_at"], second_now.isoformat())
        self.assertNotEqual(second_status["last_statistics_verified_at"], second_now.isoformat())
        self.assertEqual(
            second["current_season_status"]["last_freshness_verified_at"],
            first_status["last_freshness_verified_at"],
        )
        self.assertIn(
            update_data.fixture_key(verified_fixture),
            {update_data.fixture_key(row) for row in second["pending_expected_fixtures"]},
        )
        second_matches = {
            update_data.fixture_key(row): row for row in second["matches"]
            if row.get("season") == update_data.CURRENT_SEASON
        }
        self.assertEqual(second_matches[update_data.fixture_key(verified_fixture)]["prediction_record"],
                         cached_verified["prediction_record"])
        self.assertEqual(second_matches[update_data.fixture_key(still_pending_fixture)]["FTR"], "H")

if __name__ == "__main__":
    unittest.main()
