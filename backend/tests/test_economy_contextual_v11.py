import unittest
from unittest.mock import patch

from modules.economy_ml.ability_usage import build_ability_usage_state, carried_charges
from modules.economy_ml.armor_durability import build_armor_durability_state
from modules.economy_ml.contextual_scorer import apply_contextual_adjustments
from modules.economy_ml.enemy_economy import build_enemy_economy_context
from modules.economy_ml.map_context import build_map_context
from modules.economy_ml.player_profile import build_player_profile
from modules.economy_ml.round_recommender import recommend_match_economy
from modules.economy_ml.round_win_model import RoundWinLoadoutModel
from modules.economy_ml.site_tendencies import build_site_tendencies
from backend.tests.test_economy_ml import _match


class ContextualEconomyV11Tests(unittest.TestCase):
    @patch("modules.economy_ml.map_context.load_map_catalog")
    def test_map_context_available_and_missing_fallback(self, catalog):
        catalog.return_value = {"map-1": {"displayName": "Breeze", "mapUrl": "/Game/Breeze"}}
        available = build_map_context({"matchInfo": {"mapId": "map-1"}}, round_number=5, side="attack")
        self.assertTrue(available.available)
        self.assertEqual(available.map_name, "Breeze")
        self.assertEqual(available.map_profile["range_profile"], "long")
        missing = build_map_context({"matchInfo": {}}, round_number=5, side="attack")
        self.assertFalse(missing.available)
        self.assertIn("map_context_unavailable", missing.warnings)

    def test_site_tendencies_use_only_prior_rounds(self):
        match = {"roundResults": [
            {"plantSite": "A", "winningTeam": "A"},
            {"plantSite": "A", "winningTeam": "A"},
            {"plantSite": "B", "winningTeam": "B"},
        ]}
        result = build_site_tendencies(match, round_number=3, team_id="A")
        self.assertTrue(result.available)
        self.assertEqual(result.rounds_observed, 2)
        self.assertEqual(result.likely_attack_site, "A")
        self.assertNotIn("B", result.plant_site_counts)
        self.assertFalse(build_site_tendencies({"roundResults": [{}]}, round_number=2).available)

    def test_player_profile_is_prior_round_only_and_confidence_gated(self):
        rounds = []
        for weapon, kills in [("Operator", 2), ("Operator", 1), ("Operator", 2), ("Vandal", 0)]:
            rounds.append({"playerStats": [{"puuid": "p", "kills": kills,
                                             "economy": {"weapon": weapon}}]})
        profile = build_player_profile({"roundResults": rounds}, "p", round_number=4)
        self.assertTrue(profile.available)
        self.assertEqual(profile.sample_size, 3)
        self.assertEqual(profile.preferred_weapons[0], "Operator")
        # Round four is excluded, proving the current round cannot alter the profile.
        self.assertNotIn("Vandal", profile.weapon_usage_counts)
        self.assertFalse(build_player_profile({"roundResults": rounds}, "p", round_number=2).available)

    def test_contextual_adjustments_are_moderate_and_enemy_sensitive(self):
        base = {"team_plan_value": .6, "team_plan_score": .6, "round_win_probability": .5,
                "weapon_value": 3200, "armor_value": 0, "utility_value": 0,
                "synchronization": .5, "rule_penalty": 0, "data_confidence": .7,
                "warnings": [], "debug_warnings": []}
        odin = {"puuid": "p", "weapon": {"displayName": "Odin"}, "weapon_value": 3200,
                "armor_value": 0, "ability_cost": 0, "keep_weapon": False}
        eco = {"advanced_context": {"enemy_economy": {"available": True, "enemy_buy_recommendation": "ENEMY_ECO"}}}
        result = apply_contextual_adjustments(base, [odin], eco)
        self.assertLess(result["team_plan_value"], base["team_plan_value"])
        self.assertGreaterEqual(result["contextual_adjustment"], -.35)
        self.assertLessEqual(result["team_plan_score"], 1)

        weak = {**odin, "weapon": None, "weapon_value": 0}
        full = {"advanced_context": {"enemy_economy": {"available": True, "enemy_buy_recommendation": "ENEMY_FULL_BUY"}}}
        self.assertLess(apply_contextual_adjustments(base, [weak], full)["enemy_adjustment"], 0)

    def test_long_range_map_has_small_positive_sniper_adjustment(self):
        base = {"team_plan_value": .5, "team_plan_score": .5, "round_win_probability": .5,
                "weapon_value": 4700, "armor_value": 1000, "utility_value": 0,
                "synchronization": .5, "rule_penalty": 0, "data_confidence": .7,
                "warnings": [], "debug_warnings": []}
        player = {"puuid": "p", "weapon": {"displayName": "Operator"}, "weapon_value": 4700,
                  "armor_value": 1000, "ability_cost": 0, "keep_weapon": False}
        context = {"advanced_context": {"map_context": {"available": True,
                    "map_profile": {"operator_affinity": .10}}}}
        result = apply_contextual_adjustments(base, [player], context)
        self.assertGreater(result["map_adjustment"], 0)
        self.assertLess(result["map_adjustment"], .05)

    def test_operator_fit_and_ready_chamber_ultimate_adjust_score(self):
        base = {"team_plan_value": .6, "team_plan_score": .6, "round_win_probability": .5,
                "weapon_value": 4700, "armor_value": 1000, "utility_value": 0,
                "synchronization": .5, "rule_penalty": 0, "data_confidence": .7,
                "warnings": [], "debug_warnings": []}
        op = {"puuid": "p", "weapon": {"displayName": "Operator"}, "weapon_value": 4700,
              "armor_value": 1000, "ability_cost": 0, "keep_weapon": False}
        good = {"available": True, "confidence": .8, "sniper_tendency": .9,
                "weapon_kill_rate": {"Operator": 1.0}}
        good_result = apply_contextual_adjustments(base, [op], {"advanced_context": {"player_profiles": {"p": good}}})
        bad = {**good, "sniper_tendency": .05, "weapon_kill_rate": {"Operator": .1}}
        bad_result = apply_contextual_adjustments(base, [op], {"advanced_context": {"player_profiles": {"p": bad}}})
        self.assertGreater(good_result["player_fit_adjustment"], bad_result["player_fit_adjustment"])
        chamber = apply_contextual_adjustments(base, [op], {"advanced_context": {
            "ultimates": {"p": {"available": True, "agent": "Chamber", "ultimate_ready": True}}
        }})
        self.assertLess(chamber["ultimate_adjustment"], 0)
        jett = apply_contextual_adjustments(base, [op], {"advanced_context": {
            "ultimates": {"p": {"available": True, "agent": "Jett", "ultimate_ready": True}}
        }})
        self.assertLess(jett["ultimate_adjustment"], 0)

    def test_armor_and_ability_state_fallbacks(self):
        intact = build_armor_durability_state({}, puuid="p", round_number=4,
                                              armor_name="Heavy Shield", survived=True)
        self.assertTrue(intact.available)
        self.assertEqual(intact.armor_value_remaining, 50)
        damaged = build_armor_durability_state(
            {"playerStats": [{"puuid": "p", "damageReceived": 35}]}, puuid="p", round_number=4,
            armor_name="Heavy Shield", survived=True,
        )
        self.assertLess(damaged.armor_value_remaining, 25)
        self.assertFalse(build_armor_durability_state({}, puuid="p", round_number=13,
                                                     armor_name="Heavy Shield", survived=True, reset=True).available)
        self.assertEqual(carried_charges({"Shock": 2}, {"Shock": 1}), {"Shock": 1})
        self.assertFalse(build_ability_usage_state({}, puuid="p", agent="Sova", round_number=4).available)

    def test_enemy_economy_and_round_model_fallback(self):
        enemy = build_enemy_economy_context({"team_id": "B", "team_player_credit_estimates": {"x": 500, "y": 1000}})
        self.assertTrue(enemy.available)
        self.assertEqual(enemy.enemy_buy_recommendation, "ENEMY_ECO")
        model = RoundWinLoadoutModel("does-not-exist.joblib")
        fallback = model.predict_round_win({"team_weapon_value": 5000})
        self.assertFalse(fallback["available"])
        self.assertIn("round_win_model_unavailable", fallback["warnings"])
        leakage = model.predict_round_win({"current_round_kills": 5})
        self.assertIn("round_win_feature_leakage_blocked", leakage["warnings"])

        class FakeModel:
            def predict_proba(self, rows):
                return [[.2, .8]]
        model.model = FakeModel()
        prediction = model.predict_round_win({"team_weapon_value": 5000})
        self.assertTrue(prediction["available"])
        self.assertEqual(prediction["round_win_probability"], .8)

    def test_endpoint_exposes_optional_context_without_breaking_v10(self):
        result = recommend_match_economy(_match())
        self.assertEqual(result["engine"], "player_first_v10")
        self.assertEqual(result["advanced_engine"], "player_first_v11_contextual")
        self.assertTrue(result["rounds"])
        advanced = result["rounds"][0]["advanced_context"]
        self.assertIn("map_context", advanced)
        self.assertIn("enemy_economy", advanced)
        self.assertIn("ml_prediction", advanced)


if __name__ == "__main__":
    unittest.main()
