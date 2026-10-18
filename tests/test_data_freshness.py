"""Deterministic tests for per-season refresh reporting. No network or repository writes."""
import unittest

import update_data


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
        self.assertEqual(metadata["current_season_status"]["status"], "updated")
        self.assertEqual(metadata["current_season_status"]["rows"], 61)
        self.assertEqual(metadata["last_successful_refresh"], self.now)
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
        self.assertEqual(current["last_successful_refresh"], self.old_time)
        self.assertEqual(metadata["last_successful_refresh"], self.old_time)
        self.assertNotEqual(metadata["last_successful_refresh"], self.now)
        self.assertEqual(metadata["historical_seasons_updated"], ["2425", "2526"])

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


if __name__ == "__main__":
    unittest.main()
