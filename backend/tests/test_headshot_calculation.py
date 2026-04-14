import unittest

from modules.analytics.domain.extractor import _finalize_stats_block, new_scope_stats


class HeadshotCalculationTest(unittest.TestCase):
    def test_headshot_pct_uses_hit_distribution(self):
        stats = new_scope_stats()
        stats["rounds"] = 10
        stats["kills"] = 30
        stats["headshots"] = 12
        stats["bodyshots"] = 18
        stats["legshots"] = 10

        finalized = _finalize_stats_block(stats)

        self.assertAlmostEqual(finalized["headshot_pct"], 30.0, places=4)

    def test_headshot_pct_zero_when_no_shots(self):
        stats = new_scope_stats()
        stats["rounds"] = 8
        stats["kills"] = 25
        stats["headshots"] = 0
        stats["bodyshots"] = 0
        stats["legshots"] = 0

        finalized = _finalize_stats_block(stats)

        self.assertEqual(finalized["headshot_pct"], 0.0)


if __name__ == "__main__":
    unittest.main()
