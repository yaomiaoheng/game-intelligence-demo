"""Freshness checks for public mini-game last-success snapshots."""

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import update_mini_snapshot as module


class MiniSnapshotFreshnessTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 4, 2, 0, tzinfo=timezone.utc)

    def stamp(self, hours):
        return (self.now - timedelta(hours=hours)).isoformat()

    def test_eleven_hours_fresh_thirteen_hours_stale(self):
        self.assertFalse(module.is_stale(self.stamp(11), now=self.now))
        self.assertTrue(module.is_stale(self.stamp(13), now=self.now))

    def test_missing_time_or_upstream_failure_is_stale(self):
        self.assertTrue(module.is_stale(None, now=self.now))
        self.assertTrue(module.is_stale(self.stamp(1), upstream_stale=True, now=self.now))

    def test_one_provider_stale_does_not_rewrite_other_provider(self):
        source = {
            "status": {"configured": True, "running": True},
            "latest?provider=douyin": {"observed_at": self.stamp(11), "source_date": "2026-10-03", "rows": [{"rank_type": "freshGameList", "rank": 1}]},
            "latest?provider=wechat": {"observed_at": self.stamp(13), "source_date": "2026-10-03", "rows": [{"rank_type": "mostPlayedList", "rank": 2}]},
        }
        with patch.object(module, "fetch", side_effect=lambda name: source[name]), \
                patch.object(module, "datetime") as clock:
            clock.now.return_value = self.now
            clock.fromisoformat.side_effect = datetime.fromisoformat
            result = module.build()
        self.assertFalse(result["connection"]["provider_stale"]["douyin"])
        self.assertTrue(result["connection"]["provider_stale"]["wechat"])
        self.assertTrue(result["connection"]["stale"])
        self.assertEqual(result["providers"]["wechat"]["rows"][0]["rank"], 2)


if __name__ == "__main__":
    unittest.main()
