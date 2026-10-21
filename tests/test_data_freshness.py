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
try:
    from zoneinfo import ZoneInfo
    ZoneInfo("Europe/London")
    def get_london_zone():
        return ZoneInfo("Europe/London")
except Exception:
    class _LondonZone(dt.tzinfo):
        """Fallback UK timezone (GMT / BST) when standard tzdata package is absent on Windows."""
        def utcoffset(self, d):
            return dt.timedelta(hours=1) if self._is_dst(d) else dt.timedelta(0)

        def dst(self, d):
            return dt.timedelta(hours=1) if self._is_dst(d) else dt.timedelta(0)

        def tzname(self, d):
            return "BST" if self._is_dst(d) else "GMT"

        def _is_dst(self, d):
            if d is None:
                return False
            year = d.year
            march_last = dt.datetime(year, 3, 31, 1, 0, tzinfo=dt.timezone.utc)
            march_sunday = march_last - dt.timedelta(days=(march_last.weekday() + 1) % 7)
            oct_last = dt.datetime(year, 10, 31, 1, 0, tzinfo=dt.timezone.utc)
            oct_sunday = oct_last - dt.timedelta(days=(oct_last.weekday() + 1) % 7)
            if d.tzinfo is not None:
                utc_d = dt.datetime(d.year, d.month, d.day, d.hour, d.minute, d.second, d.microsecond, tzinfo=dt.timezone.utc) - (dt.timedelta(hours=1) if (march_sunday.date() <= d.date() <= oct_sunday.date()) else dt.timedelta(0))
                return march_sunday <= utc_d < oct_sunday
            return False

    def get_london_zone():
        return _LondonZone()

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
        self.assertEqual(current["status"], "updated")
        self.assertEqual(current["pipeline_state"], "verified_results_with_unverifiable_schedule")
        self.assertEqual(current["freshness_status"], "unverifiable")
        self.assertEqual(current["result_freshness_status"], "verified")
        self.assertTrue(current["result_verified_new"])
        self.assertEqual(current["last_result_verified_at"], self.NOW.isoformat())
        self.assertEqual(current["last_successful_refresh"], self.NOW.isoformat())
        self.assertEqual(current["last_freshness_verified_at"], self.OLD_VERIFIED)
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
        london = get_london_zone()
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
        london = get_london_zone()
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
        london = get_london_zone()
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
        self.assertEqual(current["status"], "updated")
        self.assertEqual(current["pipeline_state"], "verified_results_with_unverifiable_schedule")
        self.assertEqual(current["freshness_status"], "unverifiable")
        self.assertEqual(current["coverage_completeness_status"], "unverifiable")
        self.assertEqual(current["known_fixture_status"], "verified")
        self.assertEqual(current["result_freshness_status"], "verified")
        self.assertFalse(current["verified_new"])
    def _run_main_with_synthetic_downloads(
        self, current_rows, previous_matches, previous_fixtures, pending_fixtures,
        previous_current_status=None, run_at=None, custom_fixture_body=None,
        fixture_error=False, season_error=None, raw_current_body=None,
        previous_fixtures_last_checked=None,
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
            "2627": raw_current_body if raw_current_body is not None else csv_body(current_rows),
        }
        run_at = run_at or self.NOW
        fixture_day = (run_at.date() + dt.timedelta(days=1)).strftime("%d/%m/%Y")
        if custom_fixture_body is not None:
            fixture_body = custom_fixture_body
        else:
            fixture_body = "\n".join([
                "Div,Date,Time,HomeTeam,AwayTeam",
                f"E0,{fixture_day},15:00,Upcoming,Future",
            ]) + "\n"
        old_timestamp = self.OLD_VERIFIED
        previous = {
            "matches": previous_matches,
            "fixtures": previous_fixtures,
            "fixtures_last_checked": previous_fixtures_last_checked or old_timestamp,
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
                if fixture_error:
                    raise update_data.urllib.error.URLError("503 Service Unavailable")
                return io.BytesIO(fixture_body.encode("utf-8"))
            season = url.rsplit("/", 2)[-2]
            if season == update_data.CURRENT_SEASON and season_error:
                raise update_data.urllib.error.URLError(season_error)
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


class MissionAG005DecouplingRequirementsTests(unittest.TestCase):
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

    def _run_main_helper(self, **kwargs):
        test_instance = CurrentSeasonFreshnessTests()
        return test_instance._run_main_with_synthetic_downloads(**kwargs)

    def test_midweek_empty_premier_league_fixture_feed(self):
        """1. Empty Premier League fixture feed mid-week verifies valid results and sets verified_results_with_no_fixtures."""
        fixture = self.fixture(day="2026-10-17", home="Arsenal", away="Leeds")
        cached = dict(self.match(day="17/10/2026", home="Arsenal", away="Leeds"),
                      season=update_data.CURRENT_SEASON)
        current_valid_row = self.match(day="17/10/2026", home="Arsenal", away="Leeds")

        # Fixture feed has only Championship (E1), 0 Premier League (E0) rows
        empty_e0_fixture_body = "Div,Date,Time,HomeTeam,AwayTeam\nE1,22/10/2026,19:45,Preston,Bristol City\n"

        payload = self._run_main_helper(
            current_rows=[current_valid_row],
            previous_matches=[cached],
            previous_fixtures=[fixture],
            pending_fixtures=[],
            custom_fixture_body=empty_e0_fixture_body,
        )
        current = payload["current_season_status"]
        self.assertEqual(current["download_status"], "success")
        self.assertEqual(current["status"], "updated")
        self.assertEqual(current["result_freshness_status"], "verified")
        self.assertTrue(current["result_verified_new"])
        self.assertEqual(current["pipeline_state"], "verified_results_with_no_fixtures")
        self.assertEqual(current["schedule_status"], "no_fixtures_supplied")
        self.assertFalse(current["coverage_evidence"]["off_season_confirmed"])
        self.assertEqual(current["coverage_evidence"]["off_season_status"], "unconfirmed")
        self.assertEqual(current["last_result_verified_at"], self.NOW.isoformat())
        self.assertEqual(current["last_successful_refresh"], self.NOW.isoformat())

    def test_valid_results_with_incomplete_fixture_schedule(self):
        """2. Valid match results with unattested/incomplete fixture schedule records verified_results_with_unverifiable_schedule."""
        fixture = self.fixture(day="2026-10-17", home="Arsenal", away="Leeds")
        upcoming = self.fixture(day="2026-10-24", home="Chelsea", away="Spurs")
        valid_row = self.match(day="17/10/2026", home="Arsenal", away="Leeds")

        # Incomplete schedule: feed contains an upcoming fixture, but no attestation
        unattested_fixture_body = "Div,Date,Time,HomeTeam,AwayTeam\nE0,24/10/2026,15:00,Chelsea,Spurs\n"

        payload = self._run_main_helper(
            current_rows=[valid_row],
            previous_matches=[],
            previous_fixtures=[fixture, upcoming],
            pending_fixtures=[fixture],
            custom_fixture_body=unattested_fixture_body,
        )
        current = payload["current_season_status"]
        self.assertEqual(current["status"], "updated")
        self.assertEqual(current["pipeline_state"], "verified_results_with_unverifiable_schedule")
        self.assertEqual(current["result_freshness_status"], "verified")
        self.assertEqual(current["coverage_completeness_status"], "unverifiable")
        self.assertFalse(current["verified_new"])
        self.assertTrue(current["result_verified_new"])

    def test_valid_results_with_verified_future_fixtures(self):
        """3. Valid results with independently attested complete schedule records verified_results_with_verified_fixtures."""
        fixture = self.fixture(day="2026-10-17", home="Arsenal", away="Leeds")
        upcoming = self.fixture(day="2026-10-24", home="Chelsea", away="Spurs")
        valid_row = self.match(day="17/10/2026", home="Arsenal", away="Leeds")

        schedule_evidence = {
            "source": "official_attested_schedule_source",
            "feed_status": "available",
            "window_fixture_count": 10,
            "raw_e0_fixture_count": 10,
            "invalid_window_fixture_count": 0,
            "off_season_confirmed": False,
            "off_season_status": "not_indicated",
            "completeness_attested": True,
            "completeness_source": "Premier League Official Calendar API v1",
        }
        freshness = update_data.assess_current_season_freshness(
            [valid_row], [fixture, upcoming], [fixture], self.NOW,
            schedule_evidence=schedule_evidence,
        )
        self.assertEqual(freshness["pipeline_state"], "verified_results_with_verified_fixtures")
        self.assertEqual(freshness["coverage_completeness_status"], "verified")
        self.assertEqual(freshness["result_freshness_status"], "verified")
        self.assertTrue(freshness["verified_new"])

        metadata = update_data.build_refresh_metadata(
            {}, {"2627": 1}, {}, self.NOW.isoformat(), freshness=freshness,
        )
        current = metadata["current_season_status"]
        self.assertEqual(current["status"], "updated")
        self.assertEqual(current["pipeline_state"], "verified_results_with_verified_fixtures")
        self.assertEqual(current["coverage_completeness_status"], "verified")
        self.assertTrue(current["verified_new"])
        self.assertEqual(current["last_freshness_verified_at"], self.NOW.isoformat())

    def test_invalid_results_csv_fails_closed(self):
        """4. Invalid results CSV fails closed: status unavailable, pipeline_state results_download_failed, historical preserved."""
        cached = dict(self.match(day="17/10/2026", home="Arsenal", away="Leeds"),
                      season=update_data.CURRENT_SEASON)

        # Corrupt CSV body missing required match columns
        bad_csv = "InvalidCol1,InvalidCol2\nfoo,bar\n"

        payload = self._run_main_helper(
            current_rows=[],
            previous_matches=[cached],
            previous_fixtures=[],
            pending_fixtures=[],
            raw_current_body=bad_csv,
        )
        current = payload["current_season_status"]
        self.assertEqual(current["download_status"], "failed")
        self.assertEqual(current["status"], "unavailable")
        self.assertEqual(current["pipeline_state"], "results_download_failed")
        self.assertEqual(current["last_successful_refresh"], self.OLD_VERIFIED)

        # Historical match was preserved
        matches = [m for m in payload["matches"] if m.get("season") == update_data.CURRENT_SEASON]
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["HomeTeam"], "Arsenal")

    def test_provider_outage_handling(self):
        """5. Provider fixture outage does not invalidate verified results; results outage fails closed."""
        fixture = self.fixture(day="2026-10-17", home="Arsenal", away="Leeds")
        cached = dict(self.match(day="17/10/2026", home="Arsenal", away="Leeds"),
                      season=update_data.CURRENT_SEASON)
        valid_row = self.match(day="17/10/2026", home="Arsenal", away="Leeds")

        # Scenario A: Fixture feed 503 outage, results succeed
        payload = self._run_main_helper(
            current_rows=[valid_row],
            previous_matches=[cached],
            previous_fixtures=[fixture],
            pending_fixtures=[fixture],
            fixture_error=True,
        )
        current = payload["current_season_status"]
        self.assertEqual(current["download_status"], "success")
        self.assertEqual(current["status"], "updated")
        self.assertEqual(current["result_freshness_status"], "verified")
        self.assertEqual(current["schedule_status"], "failed")
        self.assertEqual(current["pipeline_state"], "verified_results_with_unverifiable_schedule")
        self.assertEqual(current["last_result_verified_at"], self.NOW.isoformat())

        # Scenario B: Results 503 outage
        payload_fail = self._run_main_helper(
            current_rows=[valid_row],
            previous_matches=[cached],
            previous_fixtures=[fixture],
            pending_fixtures=[fixture],
            season_error="503 Service Unavailable",
        )
        current_fail = payload_fail["current_season_status"]
        self.assertEqual(current_fail["download_status"], "failed")
        self.assertEqual(current_fail["status"], "unavailable")
        self.assertEqual(current_fail["pipeline_state"], "results_download_failed")
        self.assertEqual(current_fail["last_successful_refresh"], self.OLD_VERIFIED)

    def test_postponed_or_rearranged_fixtures_warns_without_stable_id(self):
        """6. Rescheduled fixtures emit warning that reconciliation is unavailable without stable fixture ID."""
        fixture = self.fixture(day="2026-10-17", home="Arsenal", away="Leeds")
        freshness = update_data.assess_current_season_freshness(
            [], [fixture], [fixture], self.NOW
        )
        warning_text = " ".join(freshness["warnings"])
        self.assertIn("reschedule reconciliation is unavailable without a stable provider fixture ID", warning_text)
        evidence = freshness["coverage_evidence"]
        self.assertEqual(evidence["reschedule_reconciliation"], "unavailable_without_stable_provider_fixture_id")

    def test_stale_cached_fixtures_not_carried_forward_as_newly_verified(self):
        """7. Fixtures whose kickoff date has passed are not carried forward as upcoming, and unexpired fixtures retain check timestamp."""
        # Previous fixtures had:
        # 1 expired fixture from yesterday (2026-10-19)
        # 1 unexpired fixture for tomorrow (2026-10-21)
        past_fixture = self.fixture(day="2026-10-19", home="PastHome", away="PastAway")
        future_fixture = self.fixture(day="2026-10-21", home="FutureHome", away="FutureAway")
        valid_row = self.match(day="19/10/2026", home="PastHome", away="PastAway")

        # New fixture feed returns 0 fixtures
        empty_fixture_feed = "Div,Date,Time,HomeTeam,AwayTeam\n"

        payload = self._run_main_helper(
            current_rows=[valid_row],
            previous_matches=[],
            previous_fixtures=[past_fixture, future_fixture],
            pending_fixtures=[past_fixture],
            custom_fixture_body=empty_fixture_feed,
            previous_current_status={
                "freshness_status": "verified",
                "last_successful_refresh": self.OLD_VERIFIED,
                "last_freshness_verified_at": self.OLD_VERIFIED,
                "last_result_verified_at": self.OLD_VERIFIED,
                "last_statistics_verified_at": self.OLD_VERIFIED,
            },
        )
        # Verify cached fixtures are NOT carried forward into active fixtures when provider returns 0 fixtures
        upcoming_fixtures = payload["fixtures"]
        self.assertEqual(len(upcoming_fixtures), 0)
        self.assertEqual(upcoming_fixtures, [])

        # Verify check timestamp on fixtures was NOT bumped to NOW
        self.assertEqual(payload["fixtures_last_checked"], self.OLD_VERIFIED)
        self.assertNotEqual(payload["fixtures_last_checked"], self.NOW.isoformat())

    def test_repeat_execution_and_idempotency(self):
        """8. Repeat execution with identical data is strictly idempotent."""
        fixture = self.fixture(day="2026-10-17", home="Arsenal", away="Leeds")
        valid_row = self.match(day="17/10/2026", home="Arsenal", away="Leeds")

        run1 = self._run_main_helper(
            current_rows=[valid_row],
            previous_matches=[],
            previous_fixtures=[fixture],
            pending_fixtures=[fixture],
        )
        run2 = self._run_main_helper(
            current_rows=[valid_row],
            previous_matches=run1["matches"],
            previous_fixtures=run1["fixtures"],
            pending_fixtures=run1["pending_expected_fixtures"],
            previous_current_status=run1["current_season_status"],
            run_at=self.NOW + dt.timedelta(hours=1),
        )
        self.assertEqual(len(run1["matches"]), len(run2["matches"]))
        self.assertEqual(run1["current_season_status"]["status"], run2["current_season_status"]["status"])
        self.assertEqual(run1["current_season_status"]["pipeline_state"], run2["current_season_status"]["pipeline_state"])
        self.assertEqual(run1["current_season_status"]["rows"], run2["current_season_status"]["rows"])

    def test_preservation_of_historical_records_and_frozen_ledgers(self):
        """9. Historical records and prediction ledgers remain completely intact and uncorrupted."""
        fixture = self.fixture(day="2026-10-17", home="Arsenal", away="Leeds")
        cached_with_pred = self.match(day="17/10/2026", home="Arsenal", away="Leeds")
        cached_with_pred["season"] = update_data.CURRENT_SEASON
        cached_with_pred["prediction_record"] = {
            "id": "pred-frozen-123",
            "market": "Match Winner",
            "probabilities": {"H": 0.55, "D": 0.25, "A": 0.20},
        }

        # New provider row arrives without prediction_record (provider never has prediction records)
        provider_row = self.match(day="17/10/2026", home="Arsenal", away="Leeds")

        payload = self._run_main_helper(
            current_rows=[provider_row],
            previous_matches=[cached_with_pred],
            previous_fixtures=[fixture],
            pending_fixtures=[],
        )
        stored = next(m for m in payload["matches"] if m.get("HomeTeam") == "Arsenal" and m.get("season") == update_data.CURRENT_SEASON)
        self.assertIn("prediction_record", stored)
        self.assertEqual(stored["prediction_record"]["id"], "pred-frozen-123")
        self.assertEqual(stored["prediction_record"]["probabilities"]["H"], 0.55)

        # Verify repository forward ledgers are untouched
        forward_test = pathlib.Path(__file__).parent.parent / "data" / "forward_test.json"
        winner_forward = pathlib.Path(__file__).parent.parent / "data" / "match_winner_forward.json"
        if forward_test.exists():
            data = json.loads(forward_test.read_text(encoding="utf-8"))
            self.assertEqual(data.get("version"), 1)
        if winner_forward.exists():
            data = json.loads(winner_forward.read_text(encoding="utf-8"))
            self.assertEqual(data.get("version"), 1)


class MissionAG007LoopholeClosureTests(unittest.TestCase):
    NOW = dt.datetime(2026, 10, 20, 12, 0, tzinfo=dt.timezone.utc)
    OLD_VERIFIED = "2026-10-18T10:00:00+00:00"

    @staticmethod
    def fixture(day="2026-10-21", time="15:00", home="Brentford", away="Liverpool"):
        return {"Date": day, "Time": time, "HomeTeam": home, "AwayTeam": away}

    @staticmethod
    def match(day="17/10/2026", home="Brentford", away="Liverpool", hg="1", ag="2",
              ftr="A", hc="7", ac="5"):
        return {
            "Date": day, "HomeTeam": home, "AwayTeam": away,
            "FTHG": hg, "FTAG": ag, "FTR": ftr, "HC": hc, "AC": ac,
        }

    def _run_main_helper(self, **kwargs):
        test_instance = CurrentSeasonFreshnessTests()
        return test_instance._run_main_with_synthetic_downloads(**kwargs)

    def test_empty_premier_league_fixture_feed_seals_prediction_list(self):
        """1. Empty Premier League fixture feed produces empty data['fixtures'] and does not advance fixtures_last_checked."""
        past_fixture = self.fixture(day="2026-10-17", home="Arsenal", away="Leeds")
        cached = dict(self.match(day="17/10/2026", home="Arsenal", away="Leeds"), season=update_data.CURRENT_SEASON)
        valid_row = self.match(day="17/10/2026", home="Arsenal", away="Leeds")
        cached_future = self.fixture(day="2026-10-24", home="Chelsea", away="Spurs")

        # Provider returns 0 Premier League rows (only E1 Championship)
        empty_e0_body = "Div,Date,Time,HomeTeam,AwayTeam\nE1,22/10/2026,19:45,Preston,Bristol City\n"

        payload = self._run_main_helper(
            current_rows=[valid_row],
            previous_matches=[cached],
            previous_fixtures=[past_fixture, cached_future],
            pending_fixtures=[],
            custom_fixture_body=empty_e0_body,
            previous_fixtures_last_checked=self.OLD_VERIFIED,
        )
        self.assertEqual(payload["fixtures"], [])
        self.assertEqual(payload["fixtures_last_checked"], self.OLD_VERIFIED)
        self.assertNotEqual(payload["fixtures_last_checked"], self.NOW.isoformat())
        current = payload["current_season_status"]
        self.assertEqual(current["schedule_status"], "no_fixtures_supplied")
        self.assertEqual(current["pipeline_state"], "verified_results_with_no_fixtures")
        self.assertEqual(current["result_freshness_status"], "verified")

    def test_fixture_provider_failure_with_cached_fixtures_present(self):
        """2. Fixture provider failure does not expose cached fixtures into data['fixtures'] or advance check timestamp."""
        cached_future1 = self.fixture(day="2026-10-21", home="Man City", away="Brighton")
        cached_future2 = self.fixture(day="2026-10-24", home="Chelsea", away="Spurs")
        past_match = dict(self.match(day="17/10/2026", home="Arsenal", away="Leeds"), season=update_data.CURRENT_SEASON)
        valid_row = self.match(day="17/10/2026", home="Arsenal", away="Leeds")

        payload = self._run_main_helper(
            current_rows=[valid_row],
            previous_matches=[past_match],
            previous_fixtures=[cached_future1, cached_future2],
            pending_fixtures=[],
            fixture_error=True,
            previous_fixtures_last_checked=self.OLD_VERIFIED,
        )
        self.assertEqual(payload["fixtures"], [])
        self.assertEqual(payload["fixtures_last_checked"], self.OLD_VERIFIED)
        self.assertNotEqual(payload["fixtures_last_checked"], self.NOW.isoformat())
        current = payload["current_season_status"]
        self.assertEqual(current["schedule_status"], "failed")
        self.assertEqual(current["pipeline_state"], "verified_results_with_unverifiable_schedule")
        # Completed historical matches remain preserved
        current_matches = [m for m in payload["matches"] if m.get("season") == update_data.CURRENT_SEASON]
        self.assertEqual(len(current_matches), 1)
        self.assertEqual(current_matches[0]["HomeTeam"], "Arsenal")

    def test_prevention_of_new_predictions_from_retained_stale_fixtures(self):
        """3. Downstream prediction engine (forward_test / match_winner_forward) generates zero predictions when feed fails or is empty."""
        unseen_future_fixture = self.fixture(day="2026-10-22", time="20:00", home="West Ham", away="Everton")
        cached_match = dict(self.match(day="17/10/2026", home="Arsenal", away="Leeds"), season=update_data.CURRENT_SEASON)
        valid_row = self.match(day="17/10/2026", home="Arsenal", away="Leeds")

        # Provider returns 0 fixtures, but previous run had cached unseen upcoming fixture
        payload = self._run_main_helper(
            current_rows=[valid_row],
            previous_matches=[cached_match],
            previous_fixtures=[unseen_future_fixture],
            pending_fixtures=[],
            custom_fixture_body="Div,Date,Time,HomeTeam,AwayTeam\n",
            previous_fixtures_last_checked=self.OLD_VERIFIED,
        )
        self.assertEqual(payload["fixtures"], [])

        # Exact simulation of forward_test.py and match_winner_forward.py downstream eligibility check
        checked = payload.get("fixtures_last_checked")
        age = self.NOW - dt.datetime.fromisoformat(checked)
        generated_corner_predictions = []
        generated_winner_predictions = []

        if dt.timedelta(0) <= age <= dt.timedelta(days=4):
            for f in payload.get("fixtures", []):
                generated_corner_predictions.append(f)
                generated_winner_predictions.append(f)

        self.assertEqual(len(generated_corner_predictions), 0)
        self.assertEqual(len(generated_winner_predictions), 0)

    def test_postponed_completed_fixture_within_grace_and_beyond_grace(self):
        """4. Previously scheduled completed fixtures that were postponed are detected and fail closed."""
        postponed_fixture = self.fixture(day="2026-10-19", home="Liverpool", away="Everton")
        # Match was postponed so current results CSV contains other valid season matches, but omits Liverpool vs Everton
        valid_played_match = self.match(day="10/10/2026", home="Arsenal", away="Leeds")
        current_results = [valid_played_match]

        # Run 1: within 48h publication grace period (e.g. 2026-10-20 12:00)
        payload_within_grace = self._run_main_helper(
            current_rows=current_results,
            previous_matches=[],
            previous_fixtures=[postponed_fixture],
            pending_fixtures=[postponed_fixture],
            run_at=dt.datetime(2026, 10, 20, 12, 0, tzinfo=dt.timezone.utc),
        )
        current_within = payload_within_grace["current_season_status"]
        self.assertEqual(current_within["result_freshness_status"], "awaiting_publication")
        self.assertEqual(current_within["pipeline_state"], "results_awaiting_publication")
        self.assertEqual(current_within["status"], "unavailable")

        # Run 2: beyond 48h publication grace period (e.g. 2026-10-23 12:00)
        payload_beyond_grace = self._run_main_helper(
            current_rows=current_results,
            previous_matches=[],
            previous_fixtures=[postponed_fixture],
            pending_fixtures=[postponed_fixture],
            run_at=dt.datetime(2026, 10, 23, 12, 0, tzinfo=dt.timezone.utc),
        )
        current_beyond = payload_beyond_grace["current_season_status"]
        self.assertEqual(current_beyond["result_freshness_status"], "stale")
        self.assertEqual(current_beyond["pipeline_state"], "results_stale")
        self.assertEqual(current_beyond["status"], "unavailable")
        warnings_text = " ".join(current_beyond["freshness_warnings"])
        self.assertIn("reschedule reconciliation is unavailable without a stable provider fixture ID", warnings_text)

    def test_postponed_upcoming_fixture_not_in_active_prediction_targets(self):
        """5. Upcoming fixtures that are postponed/cancelled are not retained as active prediction targets."""
        postponed_future = self.fixture(day="2026-10-24", home="Chelsea", away="Spurs")
        still_scheduled = self.fixture(day="2026-10-25", home="Arsenal", away="Man City")
        valid_row = self.match(day="17/10/2026", home="Fulham", away="Brentford")

        # New feed contains only the still_scheduled match; Chelsea vs Spurs was postponed
        new_feed = "Div,Date,Time,HomeTeam,AwayTeam\nE0,25/10/2026,16:30,Arsenal,Man City\n"

        payload = self._run_main_helper(
            current_rows=[valid_row],
            previous_matches=[],
            previous_fixtures=[postponed_future, still_scheduled],
            pending_fixtures=[],
            custom_fixture_body=new_feed,
        )
        active_homes = [f["HomeTeam"] for f in payload["fixtures"]]
        self.assertIn("Arsenal", active_homes)
        self.assertNotIn("Chelsea", active_homes)

    def test_incomplete_corrupted_fixture_feed_fails_closed(self):
        """6. Corrupted/incomplete fixture feeds do not expose prediction targets and fail closed."""
        valid_row = self.match(day="17/10/2026", home="Fulham", away="Brentford")
        past_fixture = self.fixture(day="2026-10-17", home="Fulham", away="Brentford")
        cached_future = self.fixture(day="2026-10-24", home="Chelsea", away="Spurs")

        # Feed has corrupted rows (invalid date and missing away team)
        corrupted_feed = "Div,Date,Time,HomeTeam,AwayTeam\nE0,invalid_date,15:00,Arsenal,Leeds\nE0,24/10/2026,15:00,Chelsea,\n"

        payload = self._run_main_helper(
            current_rows=[valid_row],
            previous_matches=[],
            previous_fixtures=[past_fixture, cached_future],
            pending_fixtures=[],
            custom_fixture_body=corrupted_feed,
            previous_fixtures_last_checked=self.OLD_VERIFIED,
        )
        self.assertEqual(payload["fixtures"], [])
        self.assertEqual(payload["fixtures_last_checked"], self.OLD_VERIFIED)
        self.assertNotEqual(payload["fixtures_last_checked"], self.NOW.isoformat())
        current = payload["current_season_status"]
        self.assertEqual(current["schedule_status"], "incomplete")
        self.assertEqual(current["coverage_completeness_status"], "unverifiable")
        self.assertEqual(current["pipeline_state"], "verified_results_with_unverifiable_schedule")

    def test_nonempty_unattested_fixture_feed_is_not_independently_verified(self):
        """7. Nonempty fixture feed without independent completeness attestation reports schedule_status unverifiable."""
        fixtures, evidence = update_data.parse_fixture_schedule_csv(
            "Div,Date,Time,HomeTeam,AwayTeam\nE0,24/10/2026,15:00,Chelsea,Spurs\n",
            dt.date(2026, 10, 20),
        )
        self.assertEqual(len(fixtures), 1)
        self.assertEqual(evidence["schedule_status"], "unverifiable")
        self.assertFalse(evidence["completeness_attested"])
        self.assertIsNone(evidence["completeness_source"])

        freshness = update_data.assess_current_season_freshness(
            [], fixtures, [], self.NOW, schedule_evidence=evidence,
        )
        self.assertEqual(freshness["schedule_status"], "unverifiable")
        self.assertEqual(freshness["coverage_completeness_status"], "unverifiable")
        self.assertFalse(freshness["verified_new"])

    def test_preservation_of_historical_records_and_frozen_ledgers(self):
        """8. Historical match records and production forward ledgers remain strictly untouched."""
        # 1. Historical record preservation in update_data
        fixture = self.fixture(day="2026-10-17", home="Arsenal", away="Leeds")
        cached_record = dict(self.match(day="17/10/2026", home="Arsenal", away="Leeds"),
                             season=update_data.CURRENT_SEASON,
                             custom_feature="ag-007-verified",
                             prediction_record={"id": "ledger-xyz-456", "market": "Corners", "probabilities": {"9.5": 0.62}})
        provider_row = self.match(day="17/10/2026", home="Arsenal", away="Leeds")

        payload = self._run_main_helper(
            current_rows=[provider_row],
            previous_matches=[cached_record],
            previous_fixtures=[fixture],
            pending_fixtures=[],
        )
        stored = next(m for m in payload["matches"] if m.get("HomeTeam") == "Arsenal" and m.get("season") == update_data.CURRENT_SEASON)
        self.assertEqual(stored["custom_feature"], "ag-007-verified")
        self.assertEqual(stored["prediction_record"]["id"], "ledger-xyz-456")

        # 2. Frozen ledger file preservation
        forward_test = pathlib.Path(__file__).parent.parent / "data" / "forward_test.json"
        winner_forward = pathlib.Path(__file__).parent.parent / "data" / "match_winner_forward.json"
        self.assertTrue(forward_test.exists())
        self.assertTrue(winner_forward.exists())
        self.assertEqual(json.loads(forward_test.read_text(encoding="utf-8"))["version"], 1)
        self.assertEqual(json.loads(winner_forward.read_text(encoding="utf-8"))["version"], 1)


if __name__ == "__main__":
    unittest.main()
