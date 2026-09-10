import unittest
from unittest.mock import patch

from shared.damage_attribution import can_source_produce_kill, resolve_damage_source
from shared.weapon_attribution import compute_precise_weapon_stats_core


class DamageAttributionTest(unittest.TestCase):
    @patch("shared.damage_attribution.resolve_weapon_name")
    @patch("shared.damage_attribution.weapons_by_uuid")
    def test_damage_source_with_weapon_still_resolves_as_weapon(
        self,
        weapons_mock,
        weapon_name_mock,
    ):
        """Identifica como arma una fuente de daño que contiene un arma."""
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
        """Resuelve el nombre y el icono de una habilidad causante de daño."""
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
        """Incluye las categorías de habilidades en las estadísticas de armas."""
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

        stats = compute_precise_weapon_stats_core(
            rounds,
            "P1",
            {"P1": "A", "E1": "B"},
            {"P1": "sova"},
        )
        bucket = stats["sova:ShockBolt"]

        self.assertEqual(bucket["kills"], 1)
        self.assertEqual(bucket["source_type"], "ability")
        self.assertTrue(bucket["is_ability"])
        self.assertEqual(bucket["weapon_id"], "sova:ShockBolt")
        self.assertEqual(bucket["weapon_name"], "Shock Bolt")
        self.assertNotIn("headshot_kills", bucket)
        self.assertNotIn("bodyshot_kills", bucket)
        self.assertNotIn("legshot_kills", bucket)

    def test_thrash_is_explicitly_non_lethal(self):
        """Identifica Thrash como habilidad no letal."""
        self.assertFalse(
            can_source_produce_kill(
                {
                    "source_id": "e370fa57-4757-3604-3648-499e1f642d3f:Ultimate",
                    "source_name": "Thrash",
                    "is_ability": True,
                }
            )
        )

    def test_provider_only_non_lethal_ability_attributions_are_rejected(self):
        """Rechaza atribuciones letales a habilidades no letales indicadas solo por el proveedor."""
        for source_id, source_name in (
            ("1dbf2edd-4729-0984-3115-daa5eed44993:Ultimate", "No me voy"),
            ("eb93336a-449b-9c1b-0a54-a891f7921d69:Ability2", "Bola curva"),
        ):
            with self.subTest(source=source_name):
                self.assertFalse(
                    can_source_produce_kill(
                        {
                            "source_id": source_id,
                            "source_name": source_name,
                            "is_ability": True,
                        }
                    )
                )

    @patch("shared.damage_attribution.find_ability")
    @patch("shared.damage_attribution.weapons_by_uuid")
    def test_generic_ability_slot_uses_killer_agent(
        self,
        weapons_mock,
        ability_mock,
    ):
        """Resuelve una ranura genérica de habilidad usando el agente del atacante."""
        weapons_mock.return_value = {}
        ability_mock.return_value = {
            "uuid": "killjoy:GrenadeAbility",
            "displayName": "Nanoenjambre",
            "displayIcon": "/nanoswarm.png",
        }

        source = resolve_damage_source(
            {
                "finishingDamage": {
                    "damageType": "Ability",
                    "damageItem": "GrenadeAbility",
                }
            },
            killer_agent_id="killjoy",
        )

        ability_mock.assert_called_once_with("GrenadeAbility", agent_id="killjoy")
        self.assertEqual(source["source_name"], "Nanoenjambre")
        self.assertTrue(source["is_ability"])

    @patch("modules.analytics.infrastructure.reference_data.abilities_by_uuid")
    @patch("shared.damage_attribution.weapons_by_uuid")
    def test_generic_ultimate_prefers_the_killer_agent(
        self,
        weapons_mock,
        abilities_mock,
    ):
        """Asocia una definitiva genérica con el agente del atacante."""
        weapons_mock.return_value = {}
        abilities_mock.return_value = {
            "Ultimate": {
                "uuid": "gekko:Ultimate",
                "slot": "Ultimate",
                "displayName": "Thrash",
                "agentUuid": "gekko",
            },
            "raze:ultimate": {
                "uuid": "raze:Ultimate",
                "slot": "Ultimate",
                "displayName": "Cierratelones",
                "agentUuid": "raze",
            },
        }

        source = resolve_damage_source(
            {
                "finishingDamage": {
                    "damageType": "Ability",
                    "damageItem": "Ultimate",
                }
            },
            killer_agent_id="raze",
        )

        self.assertEqual(source["source_name"], "Cierratelones")
        self.assertEqual(source["source_id"], "raze:Ultimate")

    @patch("modules.analytics.infrastructure.reference_data.abilities_by_uuid")
    @patch("shared.damage_attribution.weapons_by_uuid")
    def test_every_generic_slot_is_scoped_to_the_killer_agent(
        self,
        weapons_mock,
        abilities_mock,
    ):
        """Resuelve cada ranura genérica dentro del agente del atacante."""
        weapons_mock.return_value = {}
        abilities = {}
        for agent_id in ("agent-a", "agent-b"):
            for slot in ("Ability1", "Ability2", "Grenade", "Ultimate"):
                payload = {
                    "uuid": f"{agent_id}:{slot}",
                    "slot": slot,
                    "displayName": f"{agent_id}-{slot}",
                    "agentUuid": agent_id,
                }
                abilities[f"{agent_id}:{slot.lower()}"] = payload
                abilities.setdefault(slot, payload)
        abilities_mock.return_value = abilities

        raw_slots = {
            "Ability1": "Ability1",
            "Ability2": "Ability2",
            "GrenadeAbility": "Grenade",
            "Ultimate": "Ultimate",
        }
        for agent_id in ("agent-a", "agent-b"):
            for raw_slot, expected_slot in raw_slots.items():
                with self.subTest(agent=agent_id, slot=raw_slot):
                    source = resolve_damage_source(
                        {
                            "finishingDamage": {
                                "damageType": "Ability",
                                "damageItem": raw_slot,
                            }
                        },
                        killer_agent_id=agent_id,
                    )
                    self.assertEqual(
                        source["source_name"],
                        f"{agent_id}-{expected_slot}",
                    )

    @patch("modules.analytics.infrastructure.reference_data.abilities_by_uuid")
    @patch("shared.damage_attribution.weapons_by_uuid")
    def test_generic_slot_without_agent_does_not_guess_an_ability(
        self,
        weapons_mock,
        abilities_mock,
    ):
        """No inventa una habilidad cuando falta el agente de una ranura genérica."""
        weapons_mock.return_value = {}
        abilities_mock.return_value = {
            "Ultimate": {
                "uuid": "gekko:Ultimate",
                "slot": "Ultimate",
                "displayName": "Thrash",
                "agentUuid": "gekko",
            }
        }

        source = resolve_damage_source(
            {
                "finishingDamage": {
                    "damageType": "Ability",
                    "damageItem": "Ultimate",
                }
            }
        )

        self.assertEqual(source["source_name"], "Ultimate")
        self.assertEqual(source["source_id"], "Ultimate")

    @patch("modules.analytics.infrastructure.reference_data.agents_by_uuid")
    @patch("shared.damage_attribution.weapons_by_uuid")
    def test_agent_ability_weapon_id_resolves_to_local_ability(
        self,
        weapons_mock,
        agents_mock,
    ):
        """Resuelve el identificador de un arma de habilidad como habilidad del catálogo local."""
        weapons_mock.return_value = {}
        agents_mock.return_value = {
            "other-agent": {
                "uuid": "other-agent",
                "displayName": "Otro agente",
                "abilities": [
                    {
                        "slot": "Ability1",
                        "displayName": "Habilidad señuelo",
                    }
                ],
            },
            "22697a3d-45bf-8dd7-4fec-84a9e28c69d7": {
                "uuid": "22697a3d-45bf-8dd7-4fec-84a9e28c69d7",
                "displayName": "Chamber",
                "abilities": [
                    {
                        "slot": "Ability1",
                        "displayName": "Cazador de cabezas",
                    },
                    {
                        "slot": "Ultimate",
                        "displayName": "Tour de force",
                    },
                ],
            },
            "bb2a4828-46eb-8cd1-e765-15848195d751": {
                "uuid": "bb2a4828-46eb-8cd1-e765-15848195d751",
                "displayName": "Neon",
                "abilities": [
                    {
                        "slot": "Ultimate",
                        "displayName": "Sobrecarga",
                    }
                ],
            },
        }

        cases = (
            ("856d9a7e-4b06-dc37-15dc-9d809c37cb90", "Cazador de cabezas"),
            ("39099fb5-4293-def4-1e09-2e9080ce7456", "Tour de force"),
            ("95336ae4-45d4-1032-cfaf-6bad01910607", "Sobrecarga"),
        )
        for raw_id, expected_name in cases:
            with self.subTest(raw_id=raw_id):
                source = resolve_damage_source(
                    {
                        "finishingDamage": {
                            "damageType": "Weapon",
                            "damageItem": raw_id,
                        }
                    }
                )
                self.assertEqual(source["source_type"], "ability")
                self.assertTrue(source["is_ability"])
                self.assertEqual(source["source_name"], expected_name)
                self.assertIn("/content/agents/", source["icon"])


if __name__ == "__main__":
    unittest.main()
