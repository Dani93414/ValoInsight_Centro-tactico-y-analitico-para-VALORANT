import unittest

from modules.players.application.update_player_from_match import (
    _compute_best_weapon_by_kd,
    _extract_player_weapon_stats,
)


def _kill(ts: int, killer: str, victim: str, damage_item: str) -> dict:
    return {
        "timeSinceRoundStartMillis": ts,
        "killer": killer,
        "victim": victim,
        "finishingDamage": {"damageItem": damage_item},
    }


def _pstat(puuid: str, weapon: str, kills: list[dict] | None = None) -> dict:
    return {
        "puuid": puuid,
        "economy": {"weapon": weapon},
        "kills": kills or [],
    }


class WeaponLifetimeSemanticsTest(unittest.TestCase):
    def test_deaths_follow_player_held_weapon_and_best_weapon_updates(self):
        puuid = "P1"

        match_obj = {
            "roundResults": [
                {
                    "playerStats": [
                        _pstat(puuid, "Phantom", [_kill(100, puuid, "E1", "Phantom")]),
                        _pstat("E2", "Vandal", [_kill(300, "E2", puuid, "Vandal")]),
                    ]
                },
                {
                    "playerStats": [
                        _pstat(puuid, "Phantom", [_kill(120, puuid, "E3", "Phantom")]),
                        _pstat("E4", "Vandal", [_kill(280, "E4", puuid, "Vandal")]),
                    ]
                },
                {
                    "playerStats": [
                        _pstat(
                            puuid,
                            "Vandal",
                            [
                                _kill(110, puuid, "E5", "Vandal"),
                                _kill(160, puuid, "E6", "Vandal"),
                                _kill(220, puuid, "E7", "Vandal"),
                            ],
                        ),
                    ]
                },
            ]
        }

        weapon_stats = _extract_player_weapon_stats(match_obj, puuid)

        self.assertEqual(weapon_stats["Phantom"]["uses"], 2)
        self.assertEqual(weapon_stats["Phantom"]["kills"], 2)
        self.assertEqual(weapon_stats["Phantom"]["deaths"], 2)

        self.assertEqual(weapon_stats["Vandal"]["uses"], 1)
        self.assertEqual(weapon_stats["Vandal"]["kills"], 3)
        self.assertEqual(weapon_stats["Vandal"]["deaths"], 0)

        best_weapon = _compute_best_weapon_by_kd(weapon_stats, min_uses=1)
        self.assertIsNotNone(best_weapon)
        self.assertEqual(best_weapon["weaponId"], "Vandal")

    def test_kills_use_finishing_weapon_and_deaths_fall_back_to_last_known_or_purchased_weapon(self):
        puuid = "P1"

        match_obj = {
            "roundResults": [
                {
                    "playerStats": [
                        _pstat(puuid, "Phantom", [_kill(100, puuid, "E1", "Vandal")]),
                        _pstat("E2", "Operator", [_kill(300, "E2", puuid, "Operator")]),
                    ]
                },
                {
                    "playerStats": [
                        _pstat(puuid, "Bulldog", []),
                        _pstat("E3", "Phantom", [_kill(200, "E3", puuid, "Phantom")]),
                    ]
                },
            ]
        }

        weapon_stats = _extract_player_weapon_stats(match_obj, puuid)

        self.assertEqual(weapon_stats["Vandal"]["uses"], 1)
        self.assertEqual(weapon_stats["Vandal"]["kills"], 1)
        self.assertEqual(weapon_stats["Vandal"]["deaths"], 1)

        self.assertEqual(weapon_stats["Phantom"]["uses"], 1)
        self.assertEqual(weapon_stats["Phantom"]["kills"], 0)
        self.assertEqual(weapon_stats["Phantom"]["deaths"], 0)

        self.assertEqual(weapon_stats["Bulldog"]["uses"], 1)
        self.assertEqual(weapon_stats["Bulldog"]["kills"], 0)
        self.assertEqual(weapon_stats["Bulldog"]["deaths"], 1)


if __name__ == "__main__":
    unittest.main()
