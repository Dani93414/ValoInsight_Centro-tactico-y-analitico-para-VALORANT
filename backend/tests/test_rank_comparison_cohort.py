import unittest
from unittest.mock import patch

from modules.players.infrastructure.dashboard_queries import (
    _build_rank_comparison_player_match_stages,
)
from modules.players.application.player_dashboard_service import (
    _build_rank_comparison_payload_from_players,
    _build_rank_metric_values,
    get_player_rank_comparison,
)


class RankComparisonCohortTest(unittest.TestCase):
    @patch("modules.players.application.player_dashboard_service.dashboard_queries")
    def test_unranked_current_season_uses_previous_rank_for_cohort(self, queries):
        queries.find_player_latest_rank_reference.return_value = {
            "latestTier": 0,
            "timestamp": 2000,
            "seasonId": "act-new",
        }
        queries.find_player_latest_valid_rank.side_effect = [
            {},
            {"latestTier": 19, "timestamp": 1000, "seasonId": "act-old"},
            {"latestTier": 19, "timestamp": 1000, "seasonId": "act-old"},
        ]
        queries.find_player_first_match_timestamp.return_value = 2000
        queries.aggregate_rank_cohort_metric_players.return_value = [
            {
                "puuid": "target",
                "latestTier": 0,
                "matchCount": 1,
                "wins": 1,
                "kills": 20,
                "deaths": 10,
                "assists": 3,
                "rounds": 22,
                "score": 5000,
                "headshots": 8,
                "bodyshots": 12,
                "legshots": 0,
                "roundBasedKastRounds": 15,
                "roundBasedKastSourceRounds": 22,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": 40,
            }
        ]
        queries.find_latest_valid_ranks_for_players.return_value = {
            "target": {"latestTier": 19, "timestamp": 1000, "seasonId": "act-old"}
        }

        payload = get_player_rank_comparison("target", season_id="act-new")

        self.assertEqual(payload["baseTier"], 19)
        self.assertEqual(payload["baseTierSource"], "previous_valid_rank")
        self.assertEqual(payload["baseRankName"], "Diamond 2")
        self.assertEqual(payload["visualRankName"], "Sin rango")
        self.assertEqual(payload["cohortReferenceRankName"], "Diamond 2")
        self.assertTrue(
            any("ultimo rango valido anterior" in note for note in payload["notes"])
        )
        self.assertEqual(payload["metricComparisons"]["k"]["rawValue"], 20.0)

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

    def test_hs_percentile_uses_adjusted_value_and_can_invert_raw_order(self):
        cohort_rows = [
            {
                "puuid": "target-low-sample-high-raw",
                "latestTier": 19,
                "matchCount": 5,
                "wins": 2,
                "kills": 40,
                "deaths": 40,
                "assists": 10,
                "rounds": 100,
                "score": 18000,
                "headshots": 5,   # 50% sobre 10 impactos
                "bodyshots": 5,
                "legshots": 0,
                "roundBasedKastRounds": 60,
                "roundBasedKastSourceRounds": 100,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": 0,
            },
            {
                "puuid": "high-sample-lower-raw",
                "latestTier": 19,
                "matchCount": 10,
                "wins": 6,
                "kills": 100,
                "deaths": 90,
                "assists": 20,
                "rounds": 220,
                "score": 43000,
                "headshots": 40,  # 40% sobre 100 impactos
                "bodyshots": 60,
                "legshots": 0,
                "roundBasedKastRounds": 140,
                "roundBasedKastSourceRounds": 220,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": 30,
            },
            # Cohorte adicional con HS bajo para mover la media hacia abajo
            {
                "puuid": "low-hs-1",
                "latestTier": 19,
                "matchCount": 8,
                "wins": 3,
                "kills": 70,
                "deaths": 75,
                "assists": 14,
                "rounds": 180,
                "score": 32000,
                "headshots": 10,
                "bodyshots": 90,
                "legshots": 0,
                "roundBasedKastRounds": 100,
                "roundBasedKastSourceRounds": 180,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": -40,
            },
            {
                "puuid": "low-hs-2",
                "latestTier": 19,
                "matchCount": 8,
                "wins": 4,
                "kills": 75,
                "deaths": 78,
                "assists": 16,
                "rounds": 190,
                "score": 34000,
                "headshots": 10,
                "bodyshots": 90,
                "legshots": 0,
                "roundBasedKastRounds": 104,
                "roundBasedKastSourceRounds": 190,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": -20,
            },
        ]

        payload_target = _build_rank_comparison_payload_from_players(
            "target-low-sample-high-raw",
            19,
            cohort_rows,
        )
        payload_high_sample = _build_rank_comparison_payload_from_players(
            "high-sample-lower-raw",
            19,
            cohort_rows,
        )

        hs_target = payload_target["metricComparisons"]["hsPct"]
        hs_high_sample = payload_high_sample["metricComparisons"]["hsPct"]

        # Raw: target (50) > high_sample (40)
        self.assertGreater(hs_target["rawValue"], hs_high_sample["rawValue"])
        # Adjusted: target < high_sample por fiabilidad de muestra
        self.assertLess(hs_target["adjustedValue"], hs_high_sample["adjustedValue"])
        # El percentil usa adjusted, por eso target queda por debajo
        self.assertLess(hs_target["percentile"], hs_high_sample["percentile"])

    def test_best_adjusted_gets_100_and_worst_gets_0_without_ties(self):
        cohort_rows = [
            {
                "puuid": "best",
                "latestTier": 19,
                "matchCount": 12,
                "wins": 10,
                "kills": 220,
                "deaths": 120,
                "assists": 70,
                "rounds": 300,
                "score": 72000,
                "headshots": 90,
                "bodyshots": 120,
                "legshots": 30,
                "roundBasedKastRounds": 230,
                "roundBasedKastSourceRounds": 300,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": 500,
            },
            {
                "puuid": "mid",
                "latestTier": 19,
                "matchCount": 12,
                "wins": 6,
                "kills": 160,
                "deaths": 160,
                "assists": 45,
                "rounds": 300,
                "score": 60000,
                "headshots": 60,
                "bodyshots": 140,
                "legshots": 40,
                "roundBasedKastRounds": 190,
                "roundBasedKastSourceRounds": 300,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": 80,
            },
            {
                "puuid": "worst",
                "latestTier": 19,
                "matchCount": 12,
                "wins": 2,
                "kills": 120,
                "deaths": 220,
                "assists": 30,
                "rounds": 300,
                "score": 50000,
                "headshots": 30,
                "bodyshots": 150,
                "legshots": 60,
                "roundBasedKastRounds": 140,
                "roundBasedKastSourceRounds": 300,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": -350,
            },
        ]

        best_payload = _build_rank_comparison_payload_from_players("best", 19, cohort_rows)
        worst_payload = _build_rank_comparison_payload_from_players("worst", 19, cohort_rows)

        self.assertEqual(best_payload["metricComparisons"]["wr"]["percentile"], 100.0)
        self.assertEqual(worst_payload["metricComparisons"]["wr"]["percentile"], 0.0)

    def test_less_is_better_metric_inverts_ranking_correctly(self):
        cohort_rows = [
            {
                "puuid": "few-deaths",
                "latestTier": 19,
                "matchCount": 10,
                "wins": 5,
                "kills": 120,
                "deaths": 60,
                "assists": 30,
                "rounds": 240,
                "score": 50000,
                "headshots": 40,
                "bodyshots": 110,
                "legshots": 40,
                "roundBasedKastRounds": 170,
                "roundBasedKastSourceRounds": 240,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": 100,
            },
            {
                "puuid": "many-deaths",
                "latestTier": 19,
                "matchCount": 10,
                "wins": 5,
                "kills": 120,
                "deaths": 120,
                "assists": 30,
                "rounds": 240,
                "score": 50000,
                "headshots": 40,
                "bodyshots": 110,
                "legshots": 40,
                "roundBasedKastRounds": 170,
                "roundBasedKastSourceRounds": 240,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": 100,
            },
        ]
        few_payload = _build_rank_comparison_payload_from_players("few-deaths", 19, cohort_rows)
        many_payload = _build_rank_comparison_payload_from_players("many-deaths", 19, cohort_rows)

        self.assertGreater(
            few_payload["metricComparisons"]["d"]["percentile"],
            many_payload["metricComparisons"]["d"]["percentile"],
        )

    def test_kills_assists_deaths_display_totals_but_rank_per_round(self):
        cohort_rows = [
            {
                "puuid": "fast-impact",
                "latestTier": 19,
                "matchCount": 2,
                "wins": 1,
                "kills": 40,
                "deaths": 20,
                "assists": 10,
                "rounds": 40,
                "score": 9000,
                "headshots": 10,
                "bodyshots": 30,
                "legshots": 0,
                "roundBasedKastRounds": 28,
                "roundBasedKastSourceRounds": 40,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": 40,
            },
            {
                "puuid": "slow-volume",
                "latestTier": 19,
                "matchCount": 4,
                "wins": 2,
                "kills": 40,
                "deaths": 20,
                "assists": 10,
                "rounds": 80,
                "score": 16000,
                "headshots": 10,
                "bodyshots": 30,
                "legshots": 0,
                "roundBasedKastRounds": 50,
                "roundBasedKastSourceRounds": 80,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": 20,
            },
        ]

        fast_payload = _build_rank_comparison_payload_from_players("fast-impact", 19, cohort_rows)
        slow_payload = _build_rank_comparison_payload_from_players("slow-volume", 19, cohort_rows)

        self.assertEqual(fast_payload["metricComparisons"]["k"]["rawValue"], 40.0)
        self.assertEqual(slow_payload["metricComparisons"]["k"]["rawValue"], 40.0)
        self.assertGreater(
            fast_payload["metricComparisons"]["k"]["rankingValue"],
            slow_payload["metricComparisons"]["k"]["rankingValue"],
        )
        self.assertGreater(
            fast_payload["metricComparisons"]["k"]["percentile"],
            slow_payload["metricComparisons"]["k"]["percentile"],
        )

    def test_wins_losses_display_totals_but_rank_per_match(self):
        cohort_rows = [
            {
                "puuid": "efficient-wins",
                "latestTier": 19,
                "matchCount": 5,
                "wins": 4,
                "kills": 80,
                "deaths": 60,
                "assists": 20,
                "rounds": 120,
                "score": 25000,
                "headshots": 20,
                "bodyshots": 60,
                "legshots": 0,
                "roundBasedKastRounds": 80,
                "roundBasedKastSourceRounds": 120,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": 50,
            },
            {
                "puuid": "volume-wins",
                "latestTier": 19,
                "matchCount": 10,
                "wins": 4,
                "kills": 160,
                "deaths": 120,
                "assists": 40,
                "rounds": 240,
                "score": 50000,
                "headshots": 40,
                "bodyshots": 120,
                "legshots": 0,
                "roundBasedKastRounds": 150,
                "roundBasedKastSourceRounds": 240,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": 20,
            },
        ]

        efficient_payload = _build_rank_comparison_payload_from_players("efficient-wins", 19, cohort_rows)
        volume_payload = _build_rank_comparison_payload_from_players("volume-wins", 19, cohort_rows)

        self.assertEqual(efficient_payload["metricComparisons"]["wins"]["rawValue"], 4.0)
        self.assertEqual(volume_payload["metricComparisons"]["wins"]["rawValue"], 4.0)
        self.assertGreater(
            efficient_payload["metricComparisons"]["wins"]["rankingValue"],
            volume_payload["metricComparisons"]["wins"]["rankingValue"],
        )
        self.assertGreater(
            efficient_payload["metricComparisons"]["wins"]["percentile"],
            volume_payload["metricComparisons"]["wins"]["percentile"],
        )
        self.assertEqual(efficient_payload["metricComparisons"]["losses"]["rawValue"], 1.0)
        self.assertEqual(volume_payload["metricComparisons"]["losses"]["rawValue"], 6.0)
        self.assertLess(
            efficient_payload["metricComparisons"]["losses"]["rankingValue"],
            volume_payload["metricComparisons"]["losses"]["rankingValue"],
        )
        self.assertGreater(
            efficient_payload["metricComparisons"]["losses"]["percentile"],
            volume_payload["metricComparisons"]["losses"]["percentile"],
        )

    def test_players_without_hs_denominator_are_excluded_for_hs_metric(self):
        cohort_rows = [
            {
                "puuid": "target",
                "latestTier": 19,
                "matchCount": 5,
                "wins": 3,
                "kills": 80,
                "deaths": 70,
                "assists": 15,
                "rounds": 150,
                "score": 30000,
                "headshots": 30,
                "bodyshots": 30,
                "legshots": 0,
                "roundBasedKastRounds": 100,
                "roundBasedKastSourceRounds": 150,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": 10,
            },
            {
                "puuid": "no-shots-1",
                "latestTier": 19,
                "matchCount": 5,
                "wins": 2,
                "kills": 70,
                "deaths": 80,
                "assists": 14,
                "rounds": 150,
                "score": 28000,
                "headshots": 0,
                "bodyshots": 0,
                "legshots": 0,
                "roundBasedKastRounds": 95,
                "roundBasedKastSourceRounds": 150,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": -10,
            },
            {
                "puuid": "no-shots-2",
                "latestTier": 19,
                "matchCount": 5,
                "wins": 2,
                "kills": 72,
                "deaths": 82,
                "assists": 13,
                "rounds": 150,
                "score": 27500,
                "headshots": 0,
                "bodyshots": 0,
                "legshots": 0,
                "roundBasedKastRounds": 94,
                "roundBasedKastSourceRounds": 150,
                "rawKastFallbackSum": 0,
                "rawKastFallbackCount": 0,
                "damageDelta": -20,
            },
        ]
        payload = _build_rank_comparison_payload_from_players("target", 19, cohort_rows)
        hs_metric = payload["metricComparisons"]["hsPct"]
        # Solo el target tiene denominador de HS válido
        self.assertEqual(hs_metric["sampleSize"], 1)
        self.assertTrue(hs_metric["isNeutral"])
        self.assertEqual(hs_metric["percentile"], 50.0)


if __name__ == "__main__":
    unittest.main()
