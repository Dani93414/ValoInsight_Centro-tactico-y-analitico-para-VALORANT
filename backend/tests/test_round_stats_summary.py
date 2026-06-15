import unittest

from modules.players.application.player_dashboard_service import (
    _compute_round_overview_from_round_results,
    _compute_rounds_panel_summary,
)


def _kill(
    ts: int,
    killer: str,
    victim: str,
    assistants: list[str] | None = None,
    player_locations: list[dict] | None = None,
    victim_location: dict | None = None,
) -> dict:
    return {
        "timeSinceRoundStartMillis": ts,
        "killer": killer,
        "victim": victim,
        "assistants": assistants or [],
        "playerLocations": player_locations or [],
        "victimLocation": victim_location,
    }


def _pstat(puuid: str, kills: list[dict] | None = None) -> dict:
    return {
        "puuid": puuid,
        "kills": kills or [],
    }


class RoundStatsSummaryTest(unittest.TestCase):
    def test_round_overview_classifies_rounds_and_summary_is_consistent(self):
        puuid = "P1"

        match_obj = {
            "roundResults": [
                # R1: solo kill
                {
                    "playerStats": [
                        _pstat(puuid, [_kill(100, puuid, "E1")]),
                    ]
                },
                # R2: solo assist
                {
                    "playerStats": [
                        _pstat(puuid, []),
                        _pstat("P2", [_kill(120, "P2", "E2", [puuid])]),
                    ]
                },
                # R3: solo death
                {
                    "playerStats": [
                        _pstat(puuid, []),
                        _pstat("E1", [_kill(140, "E1", puuid)]),
                    ]
                },
                # R4: kill + assist
                {
                    "playerStats": [
                        _pstat(puuid, [_kill(100, puuid, "E1")]),
                        _pstat("P2", [_kill(200, "P2", "E2", [puuid])]),
                    ]
                },
                # R5: kill + death
                {
                    "playerStats": [
                        _pstat(puuid, [_kill(100, puuid, "E1")]),
                        _pstat("E3", [_kill(300, "E3", puuid)]),
                    ]
                },
                # R6: assist + death
                {
                    "playerStats": [
                        _pstat(puuid, []),
                        _pstat("P2", [_kill(120, "P2", "E2", [puuid])]),
                        _pstat("E3", [_kill(300, "E3", puuid)]),
                    ]
                },
                # R7: kill + assist + death
                {
                    "playerStats": [
                        _pstat(puuid, [_kill(100, puuid, "E1")]),
                        _pstat("P2", [_kill(200, "P2", "E2", [puuid])]),
                        _pstat("E3", [_kill(300, "E3", puuid)]),
                    ]
                },
                # R8: no direct participation (none)
                {
                    "playerStats": [
                        _pstat(puuid, []),
                        _pstat("E1", [_kill(100, "E1", "P2")]),
                    ]
                },
                # R9: ace (5 kills) -> also solo kill category
                {
                    "playerStats": [
                        _pstat(
                            puuid,
                            [
                                _kill(100, puuid, "E1"),
                                _kill(150, puuid, "E2"),
                                _kill(200, puuid, "E3"),
                                _kill(250, puuid, "E4"),
                                _kill(300, puuid, "E5"),
                            ],
                        )
                    ]
                },
            ]
        }

        round_overview = _compute_round_overview_from_round_results(match_obj, puuid)

        self.assertEqual(round_overview["rounds"], 9)
        self.assertEqual(round_overview["rounds_with_kill"], 5)
        self.assertEqual(round_overview["rounds_with_assist"], 4)
        self.assertEqual(round_overview["rounds_with_death"], 4)
        self.assertEqual(round_overview["rounds_with_direct_participation"], 7)
        self.assertEqual(round_overview["rounds_without_direct_participation"], 2)
        self.assertEqual(round_overview["rounds_only_kill"], 2)
        self.assertEqual(round_overview["rounds_only_assist"], 1)
        self.assertEqual(round_overview["rounds_only_death"], 1)
        self.assertEqual(round_overview["rounds_kill_assist"], 1)
        self.assertEqual(round_overview["rounds_kill_death"], 1)
        self.assertEqual(round_overview["rounds_assist_death"], 1)
        self.assertEqual(round_overview["rounds_kill_assist_death"], 1)
        self.assertEqual(round_overview["rounds_none"], 1)
        self.assertEqual(round_overview["rounds_combined_or_none"], 5)
        self.assertEqual(round_overview["first_kills"], 5)
        self.assertEqual(round_overview["multi_5k"], 1)

        summary = _compute_rounds_panel_summary([{"overview": round_overview}])

        self.assertEqual(summary["total_rounds"], 9)
        self.assertEqual(summary["rounds_with_kill"], 5)
        self.assertEqual(summary["rounds_with_assist"], 4)
        self.assertEqual(summary["rounds_with_death"], 4)
        self.assertEqual(summary["direct_participation_rounds"], 7)
        self.assertEqual(summary["no_direct_participation_rounds"], 2)
        self.assertEqual(summary["first_bloods"], 5)
        self.assertEqual(summary["aces"], 1)
        self.assertEqual(summary["distribution_only_kills_rounds"], 2)
        self.assertEqual(summary["distribution_only_assists_rounds"], 1)
        self.assertEqual(summary["distribution_only_deaths_rounds"], 1)
        self.assertEqual(summary["distribution_kill_assist_rounds"], 1)
        self.assertEqual(summary["distribution_kill_death_rounds"], 1)
        self.assertEqual(summary["distribution_assist_death_rounds"], 1)
        self.assertEqual(summary["distribution_kill_assist_death_rounds"], 1)
        self.assertEqual(summary["distribution_none_rounds"], 1)
        self.assertEqual(summary["distribution_combined_or_none_rounds"], 5)

        distribution_sum = (
            summary["distribution_only_kills_rounds"]
            + summary["distribution_only_assists_rounds"]
            + summary["distribution_only_deaths_rounds"]
            + summary["distribution_kill_assist_rounds"]
            + summary["distribution_kill_death_rounds"]
            + summary["distribution_assist_death_rounds"]
            + summary["distribution_kill_assist_death_rounds"]
            + summary["distribution_none_rounds"]
        )
        self.assertEqual(distribution_sum, summary["total_rounds"])
        self.assertEqual(
            summary["distribution_combined_or_none_rounds"],
            summary["distribution_kill_assist_rounds"]
            + summary["distribution_kill_death_rounds"]
            + summary["distribution_assist_death_rounds"]
            + summary["distribution_kill_assist_death_rounds"]
            + summary["distribution_none_rounds"],
        )

        self.assertAlmostEqual(summary["rounds_with_kill_pct"], 55.5556, places=4)
        self.assertAlmostEqual(summary["rounds_with_assist_pct"], 44.4444, places=4)
        self.assertAlmostEqual(summary["rounds_with_death_pct"], 44.4444, places=4)
        self.assertAlmostEqual(summary["direct_participation_pct"], 77.7778, places=4)
        self.assertAlmostEqual(summary["no_direct_participation_pct"], 22.2222, places=4)
        self.assertAlmostEqual(summary["distribution_kill_assist_pct"], 11.1111, places=4)
        self.assertAlmostEqual(summary["distribution_kill_death_pct"], 11.1111, places=4)
        self.assertAlmostEqual(summary["distribution_assist_death_pct"], 11.1111, places=4)
        self.assertAlmostEqual(
            summary["distribution_kill_assist_death_pct"],
            11.1111,
            places=4,
        )
        self.assertAlmostEqual(summary["distribution_none_pct"], 11.1111, places=4)

    def test_round_summary_handles_zero_rounds(self):
        summary = _compute_rounds_panel_summary(
            [
                {"overview": {"rounds": 0}},
                {"overview": {}},
            ]
        )

        self.assertEqual(summary["total_rounds"], 0)
        self.assertEqual(summary["rounds_with_kill"], 0)
        self.assertEqual(summary["rounds_with_assist"], 0)
        self.assertEqual(summary["rounds_with_death"], 0)
        self.assertEqual(summary["direct_participation_rounds"], 0)
        self.assertEqual(summary["no_direct_participation_rounds"], 0)
        self.assertEqual(summary["distribution_only_kills_rounds"], 0)
        self.assertEqual(summary["distribution_only_assists_rounds"], 0)
        self.assertEqual(summary["distribution_only_deaths_rounds"], 0)
        self.assertEqual(summary["distribution_kill_assist_rounds"], 0)
        self.assertEqual(summary["distribution_kill_death_rounds"], 0)
        self.assertEqual(summary["distribution_assist_death_rounds"], 0)
        self.assertEqual(summary["distribution_kill_assist_death_rounds"], 0)
        self.assertEqual(summary["distribution_none_rounds"], 0)
        self.assertEqual(summary["distribution_combined_or_none_rounds"], 0)

        self.assertEqual(summary["rounds_with_kill_pct"], 0.0)
        self.assertEqual(summary["rounds_with_assist_pct"], 0.0)
        self.assertEqual(summary["rounds_with_death_pct"], 0.0)
        self.assertEqual(summary["direct_participation_pct"], 0.0)
        self.assertEqual(summary["no_direct_participation_pct"], 0.0)
        self.assertEqual(summary["distribution_only_kills_pct"], 0.0)
        self.assertEqual(summary["distribution_only_assists_pct"], 0.0)
        self.assertEqual(summary["distribution_only_deaths_pct"], 0.0)
        self.assertEqual(summary["distribution_kill_assist_pct"], 0.0)
        self.assertEqual(summary["distribution_kill_death_pct"], 0.0)
        self.assertEqual(summary["distribution_assist_death_pct"], 0.0)
        self.assertEqual(summary["distribution_kill_assist_death_pct"], 0.0)
        self.assertEqual(summary["distribution_none_pct"], 0.0)
        self.assertEqual(summary["distribution_combined_or_none_pct"], 0.0)

    def test_round_overview_counts_plant_and_defuse_opportunities_only_when_alive(self):
        puuid = "P1"
        teammate = "P2"
        enemy = "E1"

        match_obj = {
            "players": [
                {"puuid": puuid, "teamId": "Blue"},
                {"puuid": teammate, "teamId": "Blue"},
                {"puuid": enemy, "teamId": "Red"},
            ],
            "roundResults": [
                # Teammate plants while player is alive (dies later) -> opportunity.
                {
                    "bombPlanter": teammate,
                    "plantRoundTime": 1000,
                    "playerStats": [
                        _pstat(enemy, [_kill(1500, enemy, puuid)]),
                    ],
                },
                # Teammate plants after player already died -> no opportunity.
                {
                    "bombPlanter": teammate,
                    "plantRoundTime": 1000,
                    "playerStats": [
                        _pstat(enemy, [_kill(800, enemy, puuid)]),
                    ],
                },
                # Self plant should count as both plant and opportunity.
                {
                    "bombPlanter": puuid,
                    "plantRoundTime": 900,
                    "playerStats": [
                        _pstat(puuid, []),
                    ],
                },
                # Teammate defuses while player is alive -> opportunity.
                {
                    "bombDefuser": teammate,
                    "defuseRoundTime": 700,
                    "playerStats": [
                        _pstat(puuid, []),
                    ],
                },
                # Teammate defuses after player already died -> no opportunity.
                {
                    "bombDefuser": teammate,
                    "defuseRoundTime": 1000,
                    "playerStats": [
                        _pstat(enemy, [_kill(600, enemy, puuid)]),
                    ],
                },
                # Self defuse should count as both defuse and opportunity.
                {
                    "bombDefuser": puuid,
                    "defuseRoundTime": 750,
                    "playerStats": [
                        _pstat(puuid, []),
                    ],
                },
            ],
        }

        round_overview = _compute_round_overview_from_round_results(match_obj, puuid)

        self.assertEqual(round_overview["plants"], 1)
        self.assertEqual(round_overview["defuses"], 1)
        self.assertEqual(round_overview["plant_opportunities"], 2)
        self.assertEqual(round_overview["defuse_opportunities"], 2)

        summary = _compute_rounds_panel_summary([{"overview": round_overview}])

        self.assertEqual(summary["plants"], 1)
        self.assertEqual(summary["defuses"], 1)
        self.assertEqual(summary["plant_opportunities"], 2)
        self.assertEqual(summary["defuse_opportunities"], 2)
        self.assertEqual(summary["plants_per_opportunity_pct"], 50.0)
        self.assertEqual(summary["defuses_per_opportunity_pct"], 50.0)

    def test_round_overview_includes_realistic_trade_opportunities_and_conversion_rate(self):
        puuid = "P1"
        teammate = "P2"

        match_obj = {
            "players": [
                {"puuid": puuid, "teamId": "Blue"},
                {"puuid": teammate, "teamId": "Blue"},
                {"puuid": "E1", "teamId": "Red"},
                {"puuid": "E2", "teamId": "Red"},
            ],
            "roundResults": [
                {
                    "playerStats": [
                        _pstat(
                            "E1",
                            [
                                _kill(
                                    1000,
                                    "E1",
                                    teammate,
                                    player_locations=[
                                        {
                                            "puuid": puuid,
                                            "location": {"x": 150, "y": 150},
                                        }
                                    ],
                                    victim_location={"x": 0, "y": 0},
                                )
                            ],
                        ),
                        _pstat(puuid, []),
                        _pstat(teammate, []),
                    ]
                },
                {
                    "playerStats": [
                        _pstat(
                            "E2",
                            [
                                _kill(
                                    1200,
                                    "E2",
                                    teammate,
                                    player_locations=[
                                        {
                                            "puuid": puuid,
                                            "location": {"x": 5000, "y": 5000},
                                        }
                                    ],
                                    victim_location={"x": 50, "y": 50},
                                )
                            ],
                        ),
                        _pstat(
                            puuid,
                            [
                                _kill(
                                    1800,
                                    puuid,
                                    "E2",
                                    player_locations=[
                                        {
                                            "puuid": puuid,
                                            "location": {"x": 60, "y": 60},
                                        }
                                    ],
                                    victim_location={"x": 55, "y": 55},
                                )
                            ],
                        ),
                        _pstat(teammate, []),
                    ]
                },
            ],
        }

        round_overview = _compute_round_overview_from_round_results(match_obj, puuid)

        self.assertEqual(round_overview["trade_kills"], 1)
        self.assertEqual(round_overview["trade_opportunities"], 2)
        self.assertEqual(round_overview["missed_trade_opportunities"], 1)
        self.assertEqual(round_overview["trade_conversion_rate"], 50.0)

    def test_round_overview_keeps_raw_trade_kill_when_trade_happens_outside_spatial_threshold(self):
        puuid = "P1"
        teammate = "P2"

        match_obj = {
            "players": [
                {"puuid": puuid, "teamId": "Blue"},
                {"puuid": teammate, "teamId": "Blue"},
                {"puuid": "E1", "teamId": "Red"},
            ],
            "roundResults": [
                {
                    "playerStats": [
                        _pstat(
                            "E1",
                            [
                                _kill(
                                    1000,
                                    "E1",
                                    teammate,
                                    player_locations=[
                                        {
                                            "puuid": puuid,
                                            "location": {"x": 5000, "y": 5000},
                                        }
                                    ],
                                    victim_location={"x": 0, "y": 0},
                                )
                            ],
                        ),
                        _pstat(
                            puuid,
                            [
                                _kill(
                                    1800,
                                    puuid,
                                    "E1",
                                    player_locations=[
                                        {
                                            "puuid": puuid,
                                            "location": {"x": 5000, "y": 5000},
                                        }
                                    ],
                                    victim_location={"x": 4900, "y": 4900},
                                )
                            ],
                        ),
                        _pstat(teammate, []),
                    ]
                }
            ],
        }

        round_overview = _compute_round_overview_from_round_results(match_obj, puuid)

        self.assertEqual(round_overview["trade_kills"], 1)
        self.assertEqual(round_overview["trade_opportunities"], 1)
        self.assertEqual(round_overview["missed_trade_opportunities"], 0)
        self.assertEqual(round_overview["trade_conversion_rate"], 100.0)

    def test_round_overview_counts_trade_only_round_as_kast(self):
        puuid = "P1"
        teammate = "P2"
        enemy = "E1"

        match_obj = {
            "players": [
                {"puuid": puuid, "teamId": "Blue"},
                {"puuid": teammate, "teamId": "Blue"},
                {"puuid": enemy, "teamId": "Red"},
            ],
            "roundResults": [
                {
                    "playerStats": [
                        _pstat(enemy, [_kill(1000, enemy, puuid)]),
                        _pstat(teammate, [_kill(1500, teammate, enemy)]),
                    ]
                },
                {
                    "playerStats": [
                        _pstat(enemy, [_kill(1000, enemy, puuid)]),
                    ]
                },
            ],
        }

        round_overview = _compute_round_overview_from_round_results(match_obj, puuid)

        self.assertEqual(round_overview["rounds"], 2)
        self.assertEqual(round_overview["traded_deaths"], 1)
        self.assertEqual(round_overview["rounds_with_kast"], 1)


if __name__ == "__main__":
    unittest.main()
