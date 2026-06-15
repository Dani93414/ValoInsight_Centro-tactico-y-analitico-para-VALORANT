import unittest

from modules.analytics.domain.extractor import (
    _did_player_die,
    _get_player_damage_dealt_and_shots,
    _get_player_damage_received,
    _get_player_kills_count,
    _get_round_assists_from_kills,
)
from modules.players.application.player_dashboard_service import (
    _compute_round_overview_from_round_results,
)
from shared.combat_events import is_enemy_damage, is_valid_kill, valid_kills
from shared.weapon_attribution import compute_precise_weapon_stats_core


TEAMS = {
    "P1": "A",
    "P2": "A",
    "E1": "B",
    "E2": "B",
}


class CombatEventValidationTest(unittest.TestCase):
    def test_valid_kill_requires_distinct_opposing_players(self):
        self.assertTrue(is_valid_kill({"killer": "P1", "victim": "E1"}, TEAMS))
        self.assertFalse(is_valid_kill({"killer": "P1", "victim": "P1"}, TEAMS))
        self.assertFalse(is_valid_kill({"killer": "P1", "victim": "P2"}, TEAMS))
        self.assertFalse(is_valid_kill({"killer": "", "victim": "E1"}, TEAMS))

    def test_suicide_is_death_but_not_kill_assist_or_first_kill_candidate(self):
        suicide = {"killer": "P1", "victim": "P1", "assistants": ["P2"]}
        normal = {"killer": "E1", "victim": "P2", "assistants": ["E2"]}
        all_kills = [suicide, normal]
        competitive = valid_kills(all_kills, TEAMS)

        self.assertTrue(_did_player_die(all_kills, "P1"))
        self.assertEqual(_get_player_kills_count(all_kills, "P1", TEAMS), 0)
        self.assertEqual(_get_round_assists_from_kills(all_kills, "P2", TEAMS), 0)
        self.assertEqual(competitive, [normal])

    def test_enemy_damage_only_contributes_to_adr_and_hit_distribution(self):
        player_stat = {
            "damage": [
                {
                    "receiver": "E1",
                    "damage": 120,
                    "headshots": 1,
                    "bodyshots": 2,
                    "legshots": 0,
                },
                {
                    "receiver": "P1",
                    "damage": 50,
                    "headshots": 1,
                    "bodyshots": 0,
                    "legshots": 0,
                },
                {
                    "receiver": "P2",
                    "damage": 30,
                    "headshots": 0,
                    "bodyshots": 1,
                    "legshots": 0,
                },
            ]
        }
        dealt = _get_player_damage_dealt_and_shots(player_stat, "P1", TEAMS)

        self.assertEqual(dealt, (120, 1, 2, 0))
        self.assertTrue(is_enemy_damage("P1", "E1", TEAMS))
        self.assertFalse(is_enemy_damage("P1", "P1", TEAMS))
        self.assertFalse(is_enemy_damage("P1", "P2", TEAMS))

    def test_damage_received_only_counts_enemy_damage(self):
        round_obj = {
            "playerStats": [
                {"puuid": "E1", "damage": [{"receiver": "P1", "damage": 90}]},
                {"puuid": "P2", "damage": [{"receiver": "P1", "damage": 40}]},
                {"puuid": "P1", "damage": [{"receiver": "P1", "damage": 20}]},
            ]
        }
        self.assertEqual(_get_player_damage_received(round_obj, "P1", TEAMS), 90)

    def test_suicide_does_not_add_weapon_kill_but_keeps_weapon_death(self):
        rounds = [
            {
                "playerStats": [
                    {
                        "puuid": "P1",
                        "economy": {"weapon": "rifle"},
                        "kills": [
                            {
                                "killer": "P1",
                                "victim": "P1",
                                "timeSinceRoundStartMillis": 1000,
                            }
                        ],
                    }
                ]
            }
        ]
        stats = compute_precise_weapon_stats_core(rounds, "P1", TEAMS)

        self.assertEqual(stats["rifle"]["kills"], 0)
        self.assertEqual(stats["rifle"]["deaths"], 1)

    def test_kast_counts_kill_assist_survival_and_traded_death_only(self):
        def player_stat(puuid, kills=None):
            return {"puuid": puuid, "kills": kills or []}

        def kill(killer, victim, assistants=None, time_ms=1000):
            return {
                "killer": killer,
                "victim": victim,
                "assistants": assistants or [],
                "timeSinceRoundStartMillis": time_ms,
            }

        match_obj = {
            "players": [
                {"puuid": "P1", "teamId": "A"},
                {"puuid": "P2", "teamId": "A"},
                {"puuid": "E1", "teamId": "B"},
                {"puuid": "E2", "teamId": "B"},
            ],
            "roundResults": [
                {"playerStats": [player_stat("P1", [kill("P1", "E1")])]},
                {
                    "playerStats": [
                        player_stat("P2", [kill("P2", "E1", ["P1"])])
                    ]
                },
                {"playerStats": []},
                {
                    "playerStats": [
                        player_stat("E1", [kill("E1", "P1", time_ms=1000)]),
                        player_stat("P2", [kill("P2", "E1", time_ms=4000)]),
                    ]
                },
                {
                    "playerStats": [
                        player_stat("P1", [kill("P1", "P1", time_ms=1000)])
                    ]
                },
            ],
        }

        overview = _compute_round_overview_from_round_results(match_obj, "P1")

        self.assertEqual(overview["rounds"], 5)
        self.assertEqual(overview["rounds_with_kill"], 1)
        self.assertEqual(overview["rounds_with_assist"], 1)
        self.assertEqual(overview["traded_deaths"], 1)
        self.assertEqual(overview["rounds_with_kast"], 4)


if __name__ == "__main__":
    unittest.main()
