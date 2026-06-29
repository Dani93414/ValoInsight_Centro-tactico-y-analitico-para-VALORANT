import unittest
from unittest.mock import patch

from modules.economy_ml.economy_income_rules import fixed_round_start_credits, save_penalty_applies
from modules.economy_ml.inventory import PlayerInventoryState, advance_inventory
from modules.economy_ml.legal_purchase import LegalPurchaseGenerator
from modules.economy_ml.purchase_inference import PurchaseInferenceEngine
from modules.economy_ml.recommendation_explainer import RecommendationExplainer
from modules.economy_ml.schemas import FORBIDDEN_FEATURES, MODEL_FEATURES, SCHEMA_VERSION
from modules.economy_ml.team_buy_solver import TeamBuySolver


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

    def test_armor_variants_are_generated_and_budgeted(self):
        plans = LegalPurchaseGenerator().generate(inv("p", 1000), limit=100)
        armor_names = {(p.get("armor") or {}).get("displayName") for p in plans}
        self.assertTrue({"Light Shield", "Regen Shield", "Heavy Shield"}.issubset(armor_names))
        self.assertTrue(all(p["self_cost"] <= 1000 for p in plans if not p.get("requires_weapon_drop")))

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
        self.assertEqual(option[0][0], {"name": "Turret", "charges": 1, "cost": 0, "source": "free_round_start"})

    def test_weapon_drop_can_fund_receiver_but_not_armor_or_abilities(self):
        inventories = [inv("rich", 9000), inv("poor", 400)]
        plan = TeamBuySolver().solve(inventories, alternatives=2)
        self.assertTrue(plan["valid"])
        for player in plan["players"]:
            self.assertLessEqual(player["self_cost"], next(i.credits_before_buy for i in inventories if i.puuid == player["puuid"]))
            if player.get("bought_by"):
                self.assertEqual(player["weapon_cost"], 0)
                self.assertEqual(player["self_cost"], player["armor_cost"] + player["ability_cost"])

    def test_non_weapon_drop_is_rejected(self):
        players = [{"puuid": "poor", "self_cost": 0, "expected_remaining": 400, "bought_by": "rich",
                    "weapon_cost": 0, "armor_cost": 400, "ability_cost": 0, "requires_weapon_drop": False}]
        result = TeamBuySolver.validate(players, [inv("poor", 400)])
        self.assertFalse(result["valid"])

    def test_bonus_keeps_real_inventory_instead_of_buying_five_shields(self):
        inventories = [inv(str(i), 2000, "Spectre", True) for i in range(5)]
        plan = TeamBuySolver().solve(inventories, context={"is_bonus_candidate": True})
        self.assertEqual(plan["plan_kind"], "BONUS_KEEP_INVENTORY")
        self.assertTrue(any(p["keep_weapon"] for p in plan["players"]))

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
