import datetime as dt
import io
import json
import os
import unittest

from pipeline import odds

NOW = dt.datetime(2026, 10, 28, 9, tzinfo=dt.timezone.utc)
EVENTS = [
    {"home_team": "Arsenal", "away_team": "Chelsea", "commence_time": "2026-10-31T12:30:00Z", "bookmakers": [
        {"title": "A", "markets": [
            {"key": "h2h", "outcomes": [{"name": "Arsenal", "price": 2.0}, {"name": "Draw", "price": 3.5}, {"name": "Chelsea", "price": 4.0}]},
            {"key": "totals", "outcomes": [{"name": "Over", "point": 2.5, "price": 1.8}, {"name": "Over", "point": 4.5, "price": 9.0}]}]},
        {"title": "B", "markets": [{"key": "h2h", "outcomes": [{"name": "Arsenal", "price": 2.1}]}]}]},
    {"home_team": "Everton", "away_team": "Fulham", "commence_time": "2026-10-27T12:30:00Z", "bookmakers": [
        {"title": "A", "markets": [{"key": "h2h", "outcomes": [{"name": "Everton", "price": 2.0}]}]}]}]


class Resp(io.BytesIO):
    headers = {"x-requests-remaining": "490"}

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class OddsTests(unittest.TestCase):
    def test_parse_best_price_and_filters(self):
        m = odds.parse_events(EVENTS, NOW)
        self.assertEqual(len(m), 1)  # started match dropped
        s = next(iter(m.values()))["selections"]
        self.assertEqual(s["result:H"]["bookmaker"], "B")
        self.assertEqual(s["result:H"]["fractional"], "11/10")
        self.assertIn("goals:over:2.5", s)
        self.assertNotIn("goals:over:4.5", s)

    def test_no_key_is_inactive(self):
        os.environ.pop("ODDS_API_KEY", None)
        cache, note = odds.refresh({}, NOW)
        self.assertEqual(cache, {})
        self.assertIn("not configured", note)

    def test_cache_interval_and_cap(self):
        self.assertFalse(odds.plan_call({"fetched_at": (NOW - dt.timedelta(hours=1)).isoformat()}, NOW)[0])
        self.assertTrue(odds.plan_call({"fetched_at": (NOW - dt.timedelta(hours=13)).isoformat()}, NOW)[0])
        capped = {"credits": {"spent_by_month": {"2026-10": 400}}}
        self.assertFalse(odds.plan_call(capped, NOW)[0])
        self.assertTrue(odds.plan_call(capped, NOW + dt.timedelta(days=10))[0])  # new month

    def test_refresh_counts_credits_and_never_stores_key(self):
        body = Resp(json.dumps(EVENTS).encode())
        cache, note = odds.refresh({}, NOW, key="SECRET", opener=lambda r, timeout: body)
        self.assertIsNone(note)
        self.assertEqual(cache["credits"]["spent_by_month"]["2026-10"], 2)
        self.assertEqual(cache["credits"]["provider_remaining"], 490)
        self.assertNotIn("SECRET", json.dumps(cache))

    def test_failure_keeps_cache(self):
        def boom(r, timeout):
            raise OSError("down")
        old = {"fetched_at": "2026-10-20T00:00:00+00:00", "matches": {"x": 1}}
        cache, note = odds.refresh(old, NOW, key="k", opener=boom)
        self.assertIs(cache, old)
        self.assertTrue(note.startswith("failed"))


if __name__ == "__main__":
    unittest.main()
