import unittest

from modules.players.infrastructure.dashboard_queries import (
    _build_rank_comparison_player_match_stages,
)
from modules.players.application.player_dashboard_service import (
    _build_rank_comparison_payload_from_players,
    _build_rank_metric_values,
)


class RankComparisonCohortTest(unittest.TestCase):
    def test_rank_comparison_payload_builds_player_percentiles_per_metric(self):
        cohort_rows = [
            {
                "puuid": "target",
                "latestTier": 19,
                "matchCount": 5,
                "wins": 3,
                "kills": 90,
                "deaths": 45,
                "assists": 20,
                "rounds": 120,
                "score": 24000,
                "headshots": 45,
                "bodyshots": 45,
                "legshots": 10,
                "roundBasedKastRounds": 84,
                "roundBasedKastSourceRounds": 120,
                "rawKastFallbackSum": 20,
                "rawKastFallbackCount": 1,
                "damageDelta": 150,
            },
            {
                "puuid": "lower-1",
                "latestTier": 18,
                "matchCount": 5,
                "wins": 2,
                "kills": 60,
                "deaths": 60,
                "assists": 15,
                "rounds": 125,
                "score": 19000,
                "headshots": 20,
                "bodyshots": 60,
                "legshots": 20,
                "roundBasedKastRounds": 68,
                "roundBasedKastSourceRounds": 125,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": -20,
            },
            {
                "puuid": "higher-1",
                "latestTier": 20,
                "matchCount": 5,
                "wins": 4,
                "kills": 110,
                "deaths": 35,
                "assists": 25,
                "rounds": 118,
                "score": 27000,
                "headshots": 55,
                "bodyshots": 35,
                "legshots": 10,
                "roundBasedKastRounds": 96,
                "roundBasedKastSourceRounds": 118,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": 260,
            },
            {
                "puuid": "same-tier",
                "latestTier": 19,
                "matchCount": 5,
                "wins": 1,
                "kills": 70,
                "deaths": 70,
                "assists": 18,
                "rounds": 122,
                "score": 21000,
                "headshots": 28,
                "bodyshots": 52,
                "legshots": 20,
                "roundBasedKastRounds": 74,
                "roundBasedKastSourceRounds": 122,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": 20,
            },
        ]

        payload = _build_rank_comparison_payload_from_players(
            "target",
            19,
            cohort_rows,
        )

        self.assertEqual(payload["baseTier"], 19)
        self.assertEqual(payload["baseRankName"], "Diamond 2")
        self.assertEqual(payload["cohortTiers"], [18, 19, 20])
        self.assertEqual(payload["cohortLabels"], ["Diamond 1", "Diamond 2", "Diamond 3"])
        self.assertEqual(payload["sampleSize"], 4)
        self.assertEqual(payload["notes"], [])

        kd_metric = payload["metricComparisons"]["kd"]
        deaths_metric = payload["metricComparisons"]["d"]
        losses_metric = payload["metricComparisons"]["losses"]
        wr_metric = payload["metricComparisons"]["wr"]

        self.assertFalse(kd_metric["isNeutral"])
        self.assertEqual(kd_metric["sampleSize"], 4)
        self.assertAlmostEqual(kd_metric["percentile"], 66.667, places=3)
        self.assertAlmostEqual(deaths_metric["percentile"], 66.667, places=3)
        self.assertAlmostEqual(losses_metric["percentile"], 66.667, places=3)
        self.assertAlmostEqual(wr_metric["percentile"], 66.667, places=3)

    def test_rank_metric_values_prioritize_round_based_kast_and_neutralize_small_samples(self):
        target_row = {
            "puuid": "solo-player",
            "latestTier": 21,
            "matchCount": 3,
            "wins": 2,
            "kills": 45,
            "deaths": 30,
            "assists": 12,
            "rounds": 60,
            "score": 12000,
            "headshots": 0,
            "bodyshots": 0,
            "legshots": 0,
            "roundBasedKastRounds": 42,
            "roundBasedKastSourceRounds": 60,
            "rawKastFallbackSum": 15,
            "rawKastFallbackCount": 1,
            "damageDelta": 90,
        }

        metrics = _build_rank_metric_values(target_row)
        self.assertAlmostEqual(metrics["kast"], 70.0, places=3)
        self.assertAlmostEqual(metrics["incDamage"], 1.5, places=3)
        self.assertIsNone(metrics["hsPct"])

        payload = _build_rank_comparison_payload_from_players(
            "solo-player",
            21,
            [target_row],
        )

        self.assertEqual(payload["sampleSize"], 1)
        self.assertTrue(payload["metricComparisons"]["kd"]["isNeutral"])
        self.assertEqual(payload["metricComparisons"]["kd"]["percentile"], 50.0)
        self.assertEqual(payload["metricComparisons"]["hsPct"]["sampleSize"], 0)
        self.assertTrue(payload["metricComparisons"]["hsPct"]["isNeutral"])
        self.assertIn("La cohorte tiene menos de 2 jugadores validos", payload["notes"][0])
        self.assertIn("Algunas metricas usan menos jugadores validos", payload["notes"][1])

    def test_rank_comparison_pipeline_includes_extended_kast_fallback_field(self):
        pipeline = _build_rank_comparison_player_match_stages()
        pipeline_text = str(pipeline)

        self.assertIn("$players.analytics.overview.kast", pipeline_text)
        self.assertIn("$players.analytics.overview.kast_pct", pipeline_text)
        self.assertIn(
            "$players.analytics.overview.kill_assist_survive_trade_pct",
            pipeline_text,
        )

    def test_rank_comparison_pipeline_checks_missing_kast_fields_via_type(self):
        pipeline = _build_rank_comparison_player_match_stages()
        pipeline_text = str(pipeline)

        self.assertIn("'$type': '$players.analytics.overview.rounds_with_kast'", pipeline_text)
        self.assertIn("'$type': '$players.analytics.overview.survival_rounds'", pipeline_text)
        self.assertIn("'$type': '$players.analytics.overview.rounds_with_kill'", pipeline_text)
        self.assertIn("'$type': '$players.analytics.overview.rounds_with_assist'", pipeline_text)
        self.assertNotIn(
            "'$ne': ['$players.analytics.overview.rounds_with_kast', None]",
            pipeline_text,
        )


if __name__ == "__main__":
    unittest.main()