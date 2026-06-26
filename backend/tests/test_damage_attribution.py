import unittest
from unittest.mock import patch

from shared.damage_attribution import resolve_damage_source
from shared.weapon_attribution import compute_precise_weapon_stats_core


class DamageAttributionTest(unittest.TestCase):
    @patch("shared.damage_attribution.resolve_weapon_name")
    @patch("shared.damage_attribution.weapons_by_uuid")
    def test_damage_source_with_weapon_still_resolves_as_weapon(
        self,
        weapons_mock,
        weapon_name_mock,
    ):
        weapons_mock.return_value = {"weapon-1": {"displayIcon": "/vandal.png"}}
        weapon_name_mock.return_value = "Vandal"

        source = resolve_damage_source(
            {
                "finishingDamage": {
                    "damageType": "Weapon",
                    "damageItem": "weapon-1",
                }
            }
        )

        self.assertEqual(source["source_type"], "weapon")
        self.assertFalse(source["is_ability"])
        self.assertEqual(source["source_name"], "Vandal")

    @patch("shared.damage_attribution.find_ability")
    @patch("shared.damage_attribution.weapons_by_uuid")
    def test_damage_source_with_ability_resolves_ability_name_and_icon(
        self,
        weapons_mock,
        ability_mock,
    ):
        weapons_mock.return_value = {}
        ability_mock.return_value = {
            "uuid": "sova:ShockBolt",
            "displayName": "Shock Bolt",
            "displayIcon": "/shock-bolt.png",
        }

        source = resolve_damage_source(
            {
                "finishingDamage": {
                    "damageType": "Ability",
                    "damageItem": "Shock Bolt",
                }
            },
            killer_agent_id="sova",
        )

        self.assertEqual(source["source_type"], "ability")
        self.assertTrue(source["is_ability"])
        self.assertEqual(source["source_name"], "Shock Bolt")
        self.assertEqual(source["icon"], "/shock-bolt.png")

    @patch("shared.damage_attribution.find_ability")
    @patch("shared.damage_attribution.weapons_by_uuid")
    def test_weapon_stats_include_ability_buckets(
        self,
        weapons_mock,
        ability_mock,
    ):
        weapons_mock.return_value = {}
        ability_mock.return_value = {
            "uuid": "sova:ShockBolt",
            "displayName": "Shock Bolt",
            "displayIcon": "/shock-bolt.png",
        }
        rounds = [
            {
                "playerStats": [
                    {
                        "puuid": "P1",
                        "economy": {"weapon": "weapon-1"},
                        "kills": [
                            {
                                "killer": "P1",
                                "victim": "E1",
                                "timeSinceRoundStartMillis": 1000,
                                "finishingDamage": {
                                    "damageType": "Ability",
                                    "damageItem": "Shock Bolt",
                                },
                            }
                        ],
                    }
                ]
            }
        ]

        stats = compute_precise_weapon_stats_core(rounds, "P1", {"P1": "A", "E1": "B"})
        bucket = stats["sova:ShockBolt"]

        self.assertEqual(bucket["kills"], 1)
        self.assertEqual(bucket["source_type"], "ability")
        self.assertTrue(bucket["is_ability"])
        self.assertEqual(bucket["weapon_id"], "sova:ShockBolt")
        self.assertEqual(bucket["weapon_name"], "Shock Bolt")

    @patch("modules.analytics.infrastructure.reference_data.agents_by_uuid")
    @patch("shared.damage_attribution.weapons_by_uuid")
    def test_agent_ability_weapon_id_resolves_to_local_ability(
        self,
        weapons_mock,
        agents_mock,
    ):
        weapons_mock.return_value = {}
        agents_mock.return_value = {
            "22697a3d-45bf-8dd7-4fec-84a9e28c69d7": {
                "uuid": "22697a3d-45bf-8dd7-4fec-84a9e28c69d7",
                "displayName": "Chamber",
                "abilities": [
                    {
                        "slot": "Ability1",
                        "displayName": "Cazador de cabezas",
                    }
                ],
            }
        }

        source = resolve_damage_source(
            {
                "finishingDamage": {
                    "damageType": "Weapon",
                    "damageItem": "856d9a7e-4b06-dc37-15dc-9d809c37cb90",
                }
            },
            killer_agent_id="22697a3d-45bf-8dd7-4fec-84a9e28c69d7",
        )

        self.assertEqual(source["source_type"], "ability")
        self.assertTrue(source["is_ability"])
        self.assertEqual(source["source_name"], "Cazador de cabezas")
        self.assertIn("/content/agents/", source["icon"])


if __name__ == "__main__":
    unittest.main()
