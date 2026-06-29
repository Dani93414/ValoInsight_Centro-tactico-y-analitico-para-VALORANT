import unittest
from unittest.mock import patch

from modules.economy_ml.economy_income_rules import fixed_round_start_credits, save_penalty_applies
from modules.economy_ml.inventory import PlayerInventoryState, advance_inventory
from modules.economy_ml.legal_purchase import LegalPurchaseGenerator
from modules.economy_ml.purchase_inference import PurchaseInferenceEngine
from modules.economy_ml.recommendation_explainer import RecommendationExplainer
from modules.economy_ml.schemas import FORBIDDEN_FEATURES, MODEL_FEATURES, SCHEMA_VERSION
from modules.economy_ml.team_buy_solver import TeamBuySolver
from modules.economy_ml.team_buy_solver import BuyScorer
from modules.economy_ml.display_normalizer import (
    normalize_armor_display, normalize_observed_economy,
    normalize_purchase_for_display, normalize_warning_list, normalize_weapon_display,
)
from modules.economy_ml.ability_catalog import agent_abilities, clear_ability_catalog_cache
from modules.economy_ml.round_recommender import recommend_match_economy
from backend.tests.test_economy_ml import _match as economy_match


WEAPONS = {
    "classic": {"displayName": "Classic", "cost": 0},
    "spectre": {"displayName": "Spectre", "cost": 1600},
    "vandal": {"displayName": "Vandal", "cost": 2900},
}
GEAR = {
    "light": {"displayName": "Light Shield", "cost": 400},
    "regen": {"displayName": "Regen Shield", "cost": 650},
    "heavy": {"displayName": "Heavy Shield", "cost": 1000},
}


def inv(puuid, credits, weapon=None, survived=None):
    return PlayerInventoryState(puuid, credits, weapon_before_buy=weapon, survived_previous_round=survived)


class EconomyEngineV10Tests(unittest.TestCase):
    def setUp(self):
        self.catalogs = patch.multiple(
            "modules.economy_ml.legal_purchase",
            load_weapon_catalog=lambda: WEAPONS,
            load_gear_catalog=lambda: GEAR,
            find_weapon=lambda value: next((w for w in WEAPONS.values() if w["displayName"] == value), None),
            agent_abilities=lambda agent: [],
        )
        self.catalogs.start()

    def tearDown(self):
        self.catalogs.stop()

    def test_inventory_carries_weapon_after_survival(self):
        previous = PlayerInventoryState("p", 1000, weapon_after_buy="Vandal", armor_after_buy="Light Shield")
        current = advance_inventory(previous, puuid="p", credits_before_buy=3000,
                                    observed_weapon="Vandal", observed_armor="Light Shield", survived_previous_round=True)
        self.assertEqual(current.weapon_before_buy, "Vandal")
        self.assertEqual(current.weapon_source, "carried")

    @patch("modules.economy_ml.display_normalizer.find_weapon")
    def test_classic_uuid_is_normalized_for_display(self, find):
        find.return_value = {"uuid": "29a0cfab-485b-f5d5-779a-b59f85e204a8", "displayName": "Classic", "cost": 0}
        result = normalize_weapon_display("29a0cfab-485b-f5d5-779a-b59f85e204a8")
        self.assertEqual(result["displayName"], "Classic")
        self.assertTrue(result["known"])

    def test_placeholder_armor_becomes_no_shield(self):
        result = normalize_armor_display("string")
        self.assertEqual(result["displayName"], "Sin escudo")
        self.assertNotEqual(result["displayName"], "string")
        observed = normalize_observed_economy({"weapon": None, "armor": "string"})
        self.assertEqual(observed["armor"], "Sin escudo")
        self.assertEqual(normalize_weapon_display("string")["displayName"], "Arma no observada")

    def test_death_loses_weapon(self):
        previous = PlayerInventoryState("p", 1000, weapon_after_buy="Vandal")
        current = advance_inventory(previous, puuid="p", credits_before_buy=3000,
                                    observed_weapon="Classic", observed_armor=None, survived_previous_round=False)
        self.assertIsNone(current.weapon_before_buy)
        self.assertTrue(current.died_previous_round)

    @patch("modules.economy_ml.purchase_inference.find_weapon", lambda value: WEAPONS.get(str(value).lower()))
    def test_pickup_hypothesis_when_upgrade_has_insufficient_spend(self):
        state = PlayerInventoryState("p", 1200, weapon_before_buy="Classic", weapon_after_buy="Vandal",
                                     survived_previous_round=True)
        result = PurchaseInferenceEngine().infer(state, observed_spent=100)
        self.assertEqual(result[0]["weapon_source"], "picked_up")
        self.assertLess(result[0]["confidence"], 1)

    @patch("modules.economy_ml.purchase_inference.find_weapon", lambda value: WEAPONS.get(str(value).lower()))
    def test_pistol_classic_is_default_spawn_not_purchase(self):
        state = PlayerInventoryState("p", 800, weapon_after_buy="Classic")
        result = PurchaseInferenceEngine().infer(state, observed_spent=0, context={"is_pistol_round": True})
        self.assertEqual(result[0]["weapon_source"], "default_spawn_weapon")
        self.assertEqual(result[0]["estimated_self_spend"], 0)
        self.assertNotEqual(result[0]["weapon_source"], "bought_self")

    @patch("modules.economy_ml.purchase_inference.find_weapon", lambda value: WEAPONS.get(str(value).lower()))
    def test_team_inference_can_mark_probable_drop_buyer(self):
        receiver = PlayerInventoryState("poor", 400, weapon_after_buy="Vandal", died_previous_round=True)
        donor = PlayerInventoryState("rich", 9000, weapon_before_buy="Vandal", weapon_after_buy="Vandal",
                                     survived_previous_round=True)
        result = PurchaseInferenceEngine().infer_team(
            [receiver, donor], {"poor": {"spent": 0}, "rich": {"spent": 3000}}
        )
        self.assertEqual(result["poor"][0]["weapon_source"], "bought_by_teammate")
        self.assertTrue(result["rich"][0]["buys_for_teammate"])
        self.assertIn("team_drop_inferred_not_observed", result["rich"][0]["warnings"])

    def test_armor_variants_are_generated_and_budgeted(self):
        plans = LegalPurchaseGenerator().generate(inv("p", 1000), limit=100)
        armor_names = {(p.get("armor") or {}).get("displayName") for p in plans}
        self.assertTrue({"Light Shield", "Regen Shield", "Heavy Shield"}.issubset(armor_names))
        self.assertTrue(all(p["self_cost"] <= 1000 for p in plans if not p.get("requires_weapon_drop")))

    def test_carried_vandal_costs_zero_but_keeps_tactical_value(self):
        plans = LegalPurchaseGenerator().generate(inv("p", 2000, "Vandal", True), limit=200)
        kept = next(p for p in plans if p["keep_weapon"] and (p["weapon"] or {}).get("displayName") == "Vandal"
                    and p["armor"] is None and p["ability_cost"] == 0)
        self.assertEqual(kept["weapon_source"], "carried")
        self.assertEqual(kept["weapon_cost"], 0)
        self.assertEqual(kept["weapon_purchase_cost"], 0)
        self.assertEqual(kept["weapon_value"], 2900)
        self.assertEqual(kept["self_cost"], 0)
        self.assertEqual(kept["expected_remaining"], 2000)

    def test_only_actual_spectre_is_marked_as_carried(self):
        plans = LegalPurchaseGenerator().generate(inv("p", 2000, "Spectre", True), limit=200)
        kept = [p for p in plans if p["keep_weapon"]]
        self.assertTrue(kept)
        self.assertEqual({(p["weapon"] or {}).get("displayName") for p in kept}, {"Spectre"})
        classic = next(p for p in plans if (p["weapon"] or {}).get("displayName") == "Classic"
                       and not p["keep_weapon"])
        self.assertEqual(classic["weapon_cost"], 0)
        self.assertEqual(classic["weapon_source"], "bought_self")

    @patch("modules.economy_ml.legal_purchase.agent_abilities")
    def test_omen_has_one_free_and_one_purchasable_smoke(self, abilities):
        abilities.return_value = [{"name": "Dark Cover", "free_charges_at_round_start": 1,
                                   "max_charges": 2, "purchasable_charges": 1,
                                   "cost_per_charge": 150, "is_purchasable": True}]
        options = LegalPurchaseGenerator._ability_options("Omen", 500)
        bought = next(option for option in options if option[1] == 150)
        self.assertEqual(sum(a["charges"] for a in bought[0] if a["name"] == "Dark Cover"), 2)

    @patch("modules.economy_ml.legal_purchase.agent_abilities")
    def test_killjoy_turret_is_free_but_has_inventory_value(self, abilities):
        abilities.return_value = [{"name": "Turret", "free_charges_at_round_start": 1,
                                   "max_charges": 1, "purchasable_charges": 0,
                                   "cost_per_charge": 0, "is_purchasable": False}]
        option = LegalPurchaseGenerator._ability_options("Killjoy", 0)[0]
        self.assertEqual(option[1], 0)
        self.assertEqual(option[0][0]["name"], "Turret")
        self.assertEqual(option[0][0]["charges"], 1)
        self.assertEqual(option[0][0]["cost"], 0)

    @patch("modules.economy_ml.legal_purchase.agent_abilities")
    def test_multiple_abilities_and_charges_can_share_one_purchase(self, abilities):
        abilities.return_value = [
            {"name": "Owl Drone", "max_charges": 1, "purchasable_charges": 1, "cost_per_charge": 400, "is_purchasable": True},
            {"name": "Shock Bolt", "max_charges": 2, "purchasable_charges": 2, "cost_per_charge": 150, "is_purchasable": True},
            {"name": "Recon Bolt", "ability_kind": "signature", "free_charges_at_round_start": 1, "is_purchasable": False},
        ]
        options = LegalPurchaseGenerator._ability_options("Sova", 700)
        full = next(option for option in options if option[1] == 700)
        by_name = {item["name"]: item for item in full[0]}
        self.assertEqual(by_name["Owl Drone"]["charges"], 1)
        self.assertEqual(by_name["Shock Bolt"]["charges"], 2)
        self.assertEqual(by_name["Recon Bolt"]["cost"], 0)

    @patch("modules.economy_ml.legal_purchase.agent_abilities")
    def test_missing_ability_cost_warns_without_crashing(self, abilities):
        abilities.return_value = [{"name": "Unknown Utility", "max_charges": 1,
                                   "purchasable_charges": 1, "cost_per_charge": None,
                                   "cost_credits": None, "is_purchasable": True}]
        options = LegalPurchaseGenerator._ability_options("Agent", 1000)
        self.assertIn("missing_cost:Unknown Utility", options[0][2])

    def test_weapon_drop_can_fund_receiver_but_not_armor_or_abilities(self):
        inventories = [inv("rich", 9000), inv("poor", 400)]
        plan = TeamBuySolver().solve(inventories, alternatives=2)
        self.assertTrue(plan["valid"])
        for player in plan["players"]:
            self.assertLessEqual(player["self_cost"], next(i.credits_before_buy for i in inventories if i.puuid == player["puuid"]))
            if player.get("bought_by"):
                self.assertEqual(player["weapon_cost"], 0)
                self.assertEqual(player["self_cost"], player["armor_cost"] + player["ability_cost"])

    def test_vandal_drop_charges_donor_and_preserves_receiver_weapon_value(self):
        generator = LegalPurchaseGenerator()
        rich_plans = generator.generate(inv("rich", 9000), limit=200)
        poor_plans = generator.generate(inv("poor", 400), limit=200)
        donor = next(p for p in rich_plans if p["weapon"] is None and p["armor"] is None and p["ability_cost"] == 0)
        receiver = next(p for p in poor_plans if (p["weapon"] or {}).get("displayName") == "Vandal"
                        and p["armor"] is None and p["ability_cost"] == 0 and p["requires_weapon_drop"])
        TeamBuySolver._resolve_weapon_drops([donor, receiver], [inv("rich", 9000), inv("poor", 400)])
        self.assertEqual(receiver["weapon_cost"], 0)
        self.assertEqual(receiver["weapon_purchase_cost"], 2900)
        self.assertEqual(receiver["weapon_value"], 2900)
        self.assertEqual(receiver["self_cost"], 0)
        self.assertEqual(receiver["bought_by"], "rich")
        self.assertEqual(receiver["weapon_source"], "dropped")
        self.assertEqual(donor["self_cost"], 2900)
        self.assertEqual(donor["expected_remaining"], 6100)

    def test_non_weapon_drop_is_rejected(self):
        players = [{"puuid": "poor", "self_cost": 0, "expected_remaining": 400, "bought_by": "rich",
                    "weapon_cost": 0, "armor_cost": 400, "ability_cost": 0, "requires_weapon_drop": False}]
        result = TeamBuySolver.validate(players, [inv("poor", 400)])
        self.assertFalse(result["valid"])

    def test_operator_stack_receives_strong_penalty(self):
        operator = {"displayName": "Operator", "cost": 4700}
        rifle = {"displayName": "Vandal", "cost": 2900}
        base = {"armor": GEAR["heavy"], "abilities": [], "ability_cost": 0,
                "self_cost": 5700, "expected_remaining": 0, "keep_weapon": False}
        stacked = [{**base, "puuid": str(i), "weapon": operator} for i in range(3)]
        balanced = [{**base, "puuid": str(i), "weapon": operator if i == 0 else rifle} for i in range(3)]
        scorer = BuyScorer()
        self.assertGreater(scorer.score(stacked, {})["rule_penalty"], scorer.score(balanced, {})["rule_penalty"])

    def test_future_economy_preserves_each_player_distribution(self):
        players = [
            {"puuid": "a", "weapon": None, "armor": None, "abilities": [], "ability_cost": 0,
             "self_cost": 0, "expected_remaining": 8000, "keep_weapon": False},
            {"puuid": "b", "weapon": None, "armor": None, "abilities": [], "ability_cost": 0,
             "self_cost": 0, "expected_remaining": 200, "keep_weapon": False},
        ]
        projection = BuyScorer().score(players, {"loss_income": 1900})
        by_id = {item["puuid"]: item for item in projection["players"]}
        self.assertEqual(by_id["a"]["credits_if_loss"], 9000)
        self.assertEqual(by_id["b"]["credits_if_loss"], 2100)

    def test_carried_weapon_value_improves_score_without_increasing_spend(self):
        carried = {"puuid": "p", "weapon": {"displayName": "Vandal", "cost": 0, "weapon_value": 2900, "source": "carried"},
                   "weapon_value": 2900, "weapon_cost": 0, "weapon_purchase_cost": 0,
                   "armor": None, "abilities": [], "ability_cost": 0, "self_cost": 0,
                   "expected_remaining": 2000, "keep_weapon": True}
        empty = {**carried, "weapon": None, "weapon_value": 0, "keep_weapon": False}
        carried_score = BuyScorer().score([carried], {})
        empty_score = BuyScorer().score([empty], {})
        self.assertGreater(carried_score["round_win_probability"], empty_score["round_win_probability"])
        self.assertGreater(carried_score["score"], empty_score["score"])
        self.assertEqual(carried_score["weapon_value"], 2900)
        self.assertEqual(empty_score["weapon_value"], 0)
        self.assertEqual(carried_score["team_spend"], 0)

    def test_overtime_underinvestment_is_penalized(self):
        players = [{"puuid": str(i), "weapon": None, "armor": None, "abilities": [],
                    "ability_cost": 0, "self_cost": 0, "expected_remaining": 5000, "keep_weapon": False}
                   for i in range(5)]
        result = BuyScorer().score(players, {"is_overtime": True})
        self.assertIn("decisive_round_underinvestment", result["warnings"])

    def test_pistol_utility_plan_has_specific_label(self):
        players = [{"puuid": "p", "weapon": None, "weapon_value": 0, "self_cost": 700,
                    "ability_cost": 700, "armor_cost": 0, "keep_weapon": False}]
        label = TeamBuySolver._summarize(players, [inv("p", 800)], {"is_pistol_round": True})
        self.assertEqual(label, "PISTOL_UTILITY")

    def test_sova_localized_abilities_reuse_seed_costs_by_slot(self):
        clear_ability_catalog_cache()
        abilities = {item["slot"]: item for item in agent_abilities("Sova") if item["slot"] in {"C", "Q", "E"}}
        self.assertEqual(abilities["Q"]["cost_per_charge"], 150)
        self.assertEqual(abilities["C"]["cost_per_charge"], 400)
        self.assertFalse(any(item.get("missing_cost") for item in abilities.values()))
        self.assertIn("Shock Bolt", abilities["Q"]["aliases"])

    def test_warning_codes_are_deduplicated_and_humanized(self):
        result = normalize_warning_list([
            "missing_cost:Flecha explosiva", "missing_cost:Flecha explosiva",
            "missing_cost:Dron", "ability_purchase_not_observable",
            "ability_purchase_not_observable",
        ])
        self.assertEqual(len(result), 2)
        self.assertTrue(any("costes de habilidad" in item for item in result))
        self.assertTrue(any("Compra de habilidades estimada" in item for item in result))

    def test_pistol_empty_purchase_has_classic_free_display(self):
        display = normalize_purchase_for_display({"weapon": None, "armor": None, "abilities": [], "self_cost": 0}, is_pistol_round=True)
        self.assertEqual(display["loadout_label"], "Classic gratis + Sin escudo")
        self.assertEqual(display["source_label"], "Arma inicial gratis")

    def test_match_response_exposes_normalized_observed_display_and_global_ml_limitation(self):
        result = recommend_match_economy(economy_match())
        self.assertEqual(result["limitations"].count("Reglas activas; ML auxiliar no cargado."), 1)
        self.assertTrue(result["rounds"])
        observed = next(iter(result["rounds"][0]["real_team_buy_observed"].values()))
        self.assertTrue(observed["weapon_display"]["displayName"])
        self.assertTrue(observed["armor_display"]["displayName"])
        self.assertNotIn("ml_auxiliary_unavailable_rules_only", result["rounds"][0]["warnings"])

    def test_bonus_keeps_real_inventory_instead_of_buying_five_shields(self):
        inventories = [inv(str(i), 2000, "Spectre", True) for i in range(5)]
        plan = TeamBuySolver().solve(inventories, context={"is_bonus_candidate": True})
        self.assertEqual(plan["plan_kind"], "BONUS_KEEP_INVENTORY")
        kept = [p for p in plan["players"] if p["keep_weapon"]]
        self.assertGreaterEqual(len(kept), 3)
        self.assertTrue(all((p["weapon"] or {}).get("displayName") == "Spectre" for p in kept))
        self.assertTrue(all(p["weapon_cost"] == 0 and p["weapon_value"] == 1600 for p in kept))
        self.assertTrue(all(p["self_cost"] == p["armor_cost"] + p["ability_cost"] for p in kept))

    def test_pistol_plan_never_exceeds_800_per_player(self):
        inventories = [inv(str(i), 800) for i in range(5)]
        plan = TeamBuySolver().solve(inventories, context={"is_pistol_round": True})
        self.assertTrue(all(p["self_cost"] <= 800 for p in plan["players"]))

    def test_save_penalty_and_overtime_constants(self):
        self.assertTrue(save_penalty_applies(side="attack", team_won=False, player_survived=True,
                                            spike_planted=False, round_result="RoundResult_TimeExpired", round_ceremony=None))
        self.assertEqual(fixed_round_start_credits(25), 5000)

    def test_no_observed_post_buy_labels_in_model_features(self):
        self.assertEqual(SCHEMA_VERSION, 10)
        leaked = {"target_loadout_case", "cashflow_case", "enemy_target_loadout_case", "enemy_cashflow_case"}
        self.assertTrue(leaked.issubset(FORBIDDEN_FEATURES))
        self.assertTrue(leaked.isdisjoint(MODEL_FEATURES))

    def test_explainer_plan_and_players_are_coherent(self):
        purchase = {"puuid": "p", "self_cost": 400, "expected_remaining": 400, "weapon": None,
                    "armor": GEAR["light"], "abilities": [], "warnings": []}
        result = RecommendationExplainer().explain(round_number=1, team_id="A", side="attack", score_before="0-0",
            observed={"p": {"weapon": "Classic", "armor": None}},
            inferred={"p": [{"weapon_source": "default", "confidence": .8}]},
            plan={"players": [purchase], "plan_kind": "PISTOL", "team_plan_score": .5, "alternatives": [], "economy_projection": {}},
            player_meta={"p": {"credits_before_buy": 800}})
        self.assertIs(result["players"][0]["recommended_purchase"], purchase)
        self.assertEqual(result["recommended_team_buy"], "PISTOL")


if __name__ == "__main__":
    unittest.main()
