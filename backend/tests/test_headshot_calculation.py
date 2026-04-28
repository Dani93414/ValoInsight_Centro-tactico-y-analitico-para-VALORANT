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

    def test_kast_uses_exact_round_count_when_available(self):
        stats = new_scope_stats()
        stats["rounds"] = 4
        stats["rounds_with_kast"] = 3

        finalized = _finalize_stats_block(stats)

        self.assertEqual(finalized["rounds_with_kast"], 3)
        self.assertAlmostEqual(finalized["kast"], 75.0, places=4)
        self.assertAlmostEqual(finalized["kast_pct"], 75.0, places=4)
        self.assertAlmostEqual(
            finalized["kill_assist_survive_trade_pct"],
            75.0,
            places=4,
        )

    def test_weapon_scope_contains_trade_opportunity_counters(self):
        stats = new_scope_stats()
        stats["rounds"] = 1
        stats["trade_kills"] = 1
        stats["trade_opportunities"] = 2
        stats["missed_trade_opportunities"] = 1
        stats["weapon_stats"]["rifle"] = {
            "weapon_id": "rifle",
            "weapon_name": "Rifle",
            "rounds": 1,
            "kills": 1,
            "deaths": 0,
            "trade_kills": 1,
            "trade_opportunities": 2,
            "missed_trade_opportunities": 1,
        }

        finalized = _finalize_stats_block(stats)

        weapon = finalized["weapon_stats"]["rifle"]
        self.assertEqual(weapon["trade_opportunities"], 2)
        self.assertEqual(weapon["missed_trade_opportunities"], 1)
        self.assertAlmostEqual(weapon["trade_conversion_rate"], 50.0, places=4)


if __name__ == "__main__":
    unittest.main()
