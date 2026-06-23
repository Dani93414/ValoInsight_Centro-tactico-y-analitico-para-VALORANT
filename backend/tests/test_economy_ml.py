import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import numpy as np
import joblib

from modules.economy_ml.action_profiles import simulate_action_features
from modules.economy_ml.buy_classifier import classify_team_buy_action, is_operator, is_heavy_armor
from modules.economy_ml.agent_utility import classify_agent_utility_profile
from modules.economy_ml.dataset_builder import (
    build_economy_dataset_from_matches,
    build_player_economy_dataset_from_matches,
    save_dataset,
    validate_dataset,
)
from modules.economy_ml.similar_rounds import find_similar_rounds
from modules.economy_ml.policy import recommend_economy_action
from modules.economy_ml.train import train_models
from modules.economy_ml import model_registry
from modules.economy_ml.rank_mapping import get_rank_group, get_rank_name, normalize_rank_tier
from modules.economy_ml.schemas import FORBIDDEN_FEATURES, MODEL_FEATURES, PREBUY_NUMERIC_FEATURES
from modules.economy_ml.state_extractor import extract_match_round_states
from modules.economy_ml.team_plan import evaluate_team_plan_from_action
from modules.economy_ml.ability_catalog import (
    ability_costs_available,
    build_ability_catalog_report,
    classify_ability_profiles,
    get_agent_ability_catalog,
    validate_ability_catalog,
)
from modules.economy_ml.data_contract import build_data_contract_report, validate_feature_contract
from modules.economy_ml.data_availability import build_data_availability_report
from modules.economy_ml.economy_cases import classify_economy_case
from modules.economy_ml.plan_coherence import evaluate_plan_coherence
from modules.economy_ml.ultimate_inference import infer_ultimate_state
from modules.economy_ml.utility_budget import estimate_player_utility_budget


def _match():
    players = [
        {"puuid": f"A{i}", "teamId": "A", "competitiveTier": 13} for i in range(5)
    ] + [{"puuid": f"B{i}", "teamId": "B", "competitiveTier": 14} for i in range(5)]
    stats = []
    for player in players:
        stats.append({
            "puuid": player["puuid"],
            "economy": {"loadoutValue": 1000, "weapon": "Sheriff", "armor": "Light", "remaining": 1200, "spent": 800},
        })
    return {
        "matchInfo": {
            "matchId": "m1", "mapId": "map", "seasonId": "s",
            "queueId": "competitive", "isRanked": True, "gameStartMillis": 1000,
        },
        "players": players,
        "teams": [{"teamId": "A", "won": True}, {"teamId": "B", "won": False}],
        "roundResults": [{"roundNum": 0, "winningTeam": "A", "bombPlanter": "A0", "playerStats": stats}],
    }


class EconomyMlTests(unittest.TestCase):
    def test_rank_mapping(self):
        self.assertEqual(get_rank_name(13), "Gold 2")
        self.assertEqual(get_rank_group(27), "Immortal+")
        self.assertIsNone(normalize_rank_tier("bad"))

    def test_buy_classifier_is_granular(self):
        economies = [{"weapon": "Sheriff", "armor": None, "loadoutValue": 800, "spent": 800}] * 5
        self.assertEqual(classify_team_buy_action(economies), "ECO_SHERIFF")
        self.assertTrue(is_operator("a03b24d3-4319-996d-0f8c-94bbfba1dfc7"))
        self.assertTrue(is_heavy_armor("822bcab2-40a2-324e-c137-e09195ad7692"))

    def test_buy_classifier_handles_non_rifle_weapon_families(self):
        bucky_buy = [
            {"weapon": "910be174-449b-c412-ab22-d0873436b21b", "armor": "Light", "loadoutValue": 2500, "spent": 2500}
        ] * 5
        odin_buy = [
            {"weapon": "Odin", "armor": "822bcab2-40a2-324e-c137-e09195ad7692", "loadoutValue": 4500, "spent": 4500}
        ] * 5
        self.assertEqual(classify_team_buy_action(bucky_buy), "SEMI_SMG")
        self.assertEqual(classify_team_buy_action(odin_buy), "FULL_RIFLES")

    def test_agent_utility_classification_uses_role_and_abilities(self):
        omen = {
            "uuid": "agent-omen",
            "displayName": "Omen",
            "role": {"displayName": "Controller"},
            "abilities": [
                {"displayName": "Dark Cover", "description": "Lanza una esfera de humo que bloquea vision."},
                {"displayName": "Paranoia", "description": "Ciega a los jugadores alcanzados."},
            ],
        }
        result = classify_agent_utility_profile(omen)
        self.assertIn("smoke", result["utility_profiles"])
        self.assertIn("vision_denial", result["utility_profiles"])
        self.assertGreaterEqual(result["base_utility_score"], 0.5)

    def test_agent_utility_unknown_fallback_is_neutral(self):
        result = classify_agent_utility_profile({"uuid": "x", "displayName": "Mystery"})
        self.assertEqual(result["utility_profiles"], ["unknown"])
        self.assertEqual(result["base_utility_score"], 0.5)

    def test_data_contract_blocks_post_round_leakage(self):
        report = build_data_contract_report()
        self.assertIn("kills", report["forbidden_pre_round"])
        leakage = validate_feature_contract(["round_number", "kills", "round_won"])
        self.assertFalse(leakage["valid"])
        self.assertIn("round_won", leakage["forbidden_features"])

    def test_ability_profiles_do_not_require_costs(self):
        ability = {"displayName": "Dark Cover", "description": "Lanza una smoke que bloquea vision."}
        profiles = classify_ability_profiles(ability, "Controller")
        self.assertIn("smoke", profiles)

    def test_manual_seed_astra_costs_and_round_start_smoke(self):
        astra = get_agent_ability_catalog("Astra")
        self.assertIsNotNone(astra)
        abilities = astra["abilities"]
        by_name = {str(item.get("name")).lower(): item for item in abilities}
        nebula = next(item for item in abilities if "nebula" in str(item.get("name")).lower() or "nebulosa" in str(item.get("name")).lower())
        self.assertIn("smoke", nebula["tactical_types"])
        manual_nebula = by_name.get("nebula / dissipate")
        self.assertIsNotNone(manual_nebula)
        self.assertEqual(manual_nebula["max_charges"], 2)
        self.assertEqual(manual_nebula["free_charges_at_round_start"], 1)
        self.assertEqual(manual_nebula["cost_credits"], 150.0)
        self.assertEqual(by_name["nova pulse"]["max_charges"], 1)
        self.assertEqual(by_name["nova pulse"]["cost_credits"], 150.0)
        self.assertEqual(by_name["gravity well"]["max_charges"], 1)
        self.assertEqual(by_name["gravity well"]["cost_credits"], 150.0)

    def test_ultimates_have_points_not_credit_cost(self):
        validation = validate_ability_catalog()
        self.assertTrue(validation["valid"])
        for agent_name in ("Astra", "Sova", "Chamber"):
            agent = get_agent_ability_catalog(agent_name)
            ultimates = [item for item in agent["abilities"] if item.get("ability_kind") == "ultimate"]
            self.assertTrue(ultimates)
            for ultimate in ultimates:
                self.assertIsNone(ultimate["cost_credits"])
                self.assertIsNotNone(ultimate.get("ultimate_points"))

    def test_ability_catalog_report_counts_manual_costs_and_review(self):
        report = build_ability_catalog_report()
        self.assertGreaterEqual(report["agents_loaded"], 29)
        self.assertGreater(report["abilities_with_cost"], 0)
        self.assertIn("agents_incomplete", report)
        self.assertIn("validation", report)
        self.assertGreaterEqual(report["needs_review_count"], 1)

    def test_utility_budget_uses_manual_seed_costs(self):
        payload = estimate_player_utility_budget("Astra", "attack", 800, "FULLBUY")
        self.assertFalse(payload["ability_budget_unknown"])
        self.assertTrue(payload["ability_cost_available"])
        self.assertEqual(payload["free_round_start_ability"], "Nebula / Dissipate")
        self.assertIn("smoke", payload["free_round_start_ability_types"])
        self.assertGreater(payload["minimum_key_utility_budget"], 0)

    def test_ability_cost_source_is_manual_catalog_not_database(self):
        report = build_data_availability_report()
        self.assertTrue(report["summary"]["ability_cost_available"])
        self.assertFalse(report["summary"]["content_ability_cost_available"])
        self.assertEqual(report["summary"]["ability_cost_source"], "manual_versioned_catalog")
        cost_field = next(item for item in report["fields"] if item["field"] == "ability cost")
        self.assertEqual(cost_field["source"], "backend/modules/economy_ml/data/ability_catalog_seed.json")
        self.assertEqual(cost_field["usable_as"], "pre_round_plan_feature")

    def test_economy_case_distinguishes_stabilization(self):
        case = classify_economy_case({
            "team_estimated_credits_before_buy": 12000,
            "team_players_can_full_buy_estimate": 1,
            "team_players_low_money": 3,
        })
        self.assertEqual(case["macro_buy_case"], "STABILIZATION")

    def test_plan_coherence_penalizes_eco_with_expensive_weapons(self):
        result = evaluate_plan_coherence({
            "macro_case": "ECO",
            "estimated_weapon_spend": 8000,
            "estimated_armor_spend": 0,
            "estimated_total_spend": 8000,
            "expected_remaining": 1000,
        })
        self.assertLess(result["coherence_score"], 1)
        self.assertTrue(result["warnings"])

    def test_ultimate_inference_is_estimated_not_asserted(self):
        match = _match()
        result = infer_ultimate_state(match, "A0", "Jett", 1)
        self.assertEqual(result["availability_certainty"], "estimated_not_observed")
        self.assertIn("estimated_ult_available_probability", result)

    def test_state_is_pre_round_and_estimates_credits(self):
        rows = extract_match_round_states(_match())
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["team_score_before"], 0)
        self.assertEqual(rows[0]["team_estimated_credits_before_buy"], 4000)
        self.assertEqual(rows[0]["team_credit_estimate_quality"], "rules_based")
        self.assertEqual(rows[0]["round_won"], 1)
        self.assertEqual(rows[0]["side"], "attack")
        self.assertEqual(rows[1]["side"], "defense")
        self.assertIn("team_total_utility_score", rows[0])
        self.assertIn("enemy_smoke_utility_score", rows[0])
        self.assertTrue(FORBIDDEN_FEATURES.isdisjoint(MODEL_FEATURES))
        self.assertNotIn("action_total_loadout", PREBUY_NUMERIC_FEATURES)
        self.assertIn("team_total_utility_score", PREBUY_NUMERIC_FEATURES)

    def test_skipped_round_still_advances_score_and_streak(self):
        match = _match()
        valid_round = match["roundResults"][0]
        match["roundResults"] = [
            {"roundNum": 0, "winningTeam": "A", "bombPlanter": "A0", "playerStats": []},
            {**valid_round, "roundNum": 1, "winningTeam": "B"},
        ]
        rows = extract_match_round_states(match)
        team_a = next(row for row in rows if row["team_id"] == "A")
        self.assertEqual(team_a["team_score_before"], 1)
        self.assertEqual(team_a["win_streak"], 1)

    def test_counterfactual_profiles_are_coherent_and_distinct(self):
        state = extract_match_round_states(_match())[0]
        eco = simulate_action_features(state, "ECO_CLASSIC")
        full = simulate_action_features({**state, "team_estimated_credits_before_buy": 25000}, "FULL_RIFLES")
        self.assertEqual(eco["action_rifle_count"], 0)
        self.assertEqual(eco["action_total_spent"], 0)
        self.assertEqual(full["action_rifle_count"], 5)
        self.assertEqual(full["action_heavy_armor_count"], 5)

    def test_team_plan_evaluates_collective_costs_and_future_economy(self):
        state = {
            **extract_match_round_states(_match())[0],
            "team_estimated_credits_before_buy": 25000,
            "team_total_utility_score": 0.8,
            "team_low_economy_resilience": 0.7,
        }
        plan = evaluate_team_plan_from_action(state, "FULL_RIFLES", 0.62)
        self.assertEqual(plan["team_buy_case"], "FULLBUY")
        if ability_costs_available():
            self.assertGreater(plan["ability_spend_estimate"], 0)
        else:
            self.assertIsNone(plan["ability_spend_estimate"])
            self.assertTrue(plan["ability_budget_unknown"])
        self.assertLessEqual(plan["total_team_spend"], state["team_estimated_credits_before_buy"])
        self.assertIn("team_plan_value", plan)
        self.assertEqual(plan["ability_purchase_certainty"], "estimated_plan_not_observed")

    def test_dataset_save_and_missing_model_fallback(self):
        frame = build_economy_dataset_from_matches([_match()])
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "dataset.parquet"
            save_dataset(frame, output)
            self.assertEqual(len(pd.read_parquet(output)), 2)
        self.assertTrue(validate_dataset(frame)["valid"])
        with patch("modules.economy_ml.policy.load_model_candidates", return_value=[]):
            result = recommend_economy_action(frame.iloc[0].to_dict())
        self.assertFalse(result["available"])
        self.assertIn("No hay modelo", result["reason"])

    def test_player_dataset_includes_agent_utility_features(self):
        frame = build_player_economy_dataset_from_matches([_match()])
        self.assertFalse(frame.empty)
        self.assertIn("agent_base_utility_score", frame.columns)
        self.assertIn("agent_weapon_dependency_score", frame.columns)

    def test_policy_generates_alternatives_and_rejects_impossible_full_buy(self):
        class FakePipeline:
            seen = {}

            def predict_proba(self, frame):
                action = frame.iloc[0]["buy_action"]
                self.seen[action] = frame.iloc[0].to_dict()
                probability = 0.6 if action == "ECO_CLASSIC" else 0.5
                return np.array([[1 - probability, probability]])

        state = extract_match_round_states(_match())[0]
        with patch(
            "modules.economy_ml.policy.load_model_candidates",
            return_value=[({
                "pipeline": FakePipeline(),
                "action_support": {"ECO_CLASSIC": 100, "FULL_RIFLES": 100},
                "min_action_support": 25,
            }, "rank_group")],
        ):
            result = recommend_economy_action(state, ["ECO_CLASSIC", "FULL_RIFLES"])
        self.assertTrue(result["available"])
        self.assertEqual(result["recommended_action"], "ECO_CLASSIC")
        self.assertIsNotNone(result["team_plan"])
        self.assertEqual(result["team_plan"]["team_buy_case"], "ECO")
        self.assertIsNotNone(result["alternatives"][0]["team_plan"])
        full_buy = next(item for item in result["alternatives"] if item["action"] == "FULL_RIFLES")
        self.assertFalse(full_buy["is_available"])

    def test_policy_rejects_action_without_historical_support(self):
        state = {**extract_match_round_states(_match())[0], "team_estimated_credits_before_buy": 25000}
        with patch(
            "modules.economy_ml.policy.load_model_candidates",
            return_value=[({
                "pipeline": object(), "action_support": {"FULL_RIFLES": 2},
                "min_action_support": 25,
            }, "global")],
        ):
            result = recommend_economy_action(state, ["FULL_RIFLES"])
        self.assertFalse(result["available"])
        self.assertIn("soporte histórico", result["reason"])

    def test_policy_falls_back_when_exact_scope_has_no_support(self):
        class FakePipeline:
            def predict_proba(self, _frame):
                return np.array([[0.4, 0.6]])

        state = extract_match_round_states(_match())[0]
        unsupported = {"pipeline": FakePipeline(), "action_support": {}, "min_action_support": 25}
        supported = {
            "pipeline": FakePipeline(), "action_support": {"ECO_CLASSIC": 100},
            "min_action_support": 25,
        }
        with patch(
            "modules.economy_ml.policy.load_model_candidates",
            return_value=[(unsupported, "rank_name"), (supported, "rank_group")],
        ):
            result = recommend_economy_action(state, ["ECO_CLASSIC"])
        self.assertTrue(result["available"])
        self.assertEqual(result["model_scope"], "rank_group")

    def test_registry_rejects_partial_or_old_artifacts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            joblib.dump({"schema_version": 1}, root / "global_model.joblib")
            with patch.object(model_registry, "ARTIFACTS_DIR", root), patch.object(
                model_registry, "METADATA_PATH", root / "metadata.json"
            ):
                self.assertEqual(model_registry.load_model_candidates("Gold 2", "Gold"), [])
                self.assertFalse(model_registry.status()["available"])

    def test_failed_training_preserves_previous_artifacts(self):
        frame = build_economy_dataset_from_matches([_match()])
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            root.mkdir(exist_ok=True)
            previous = {"schema_version": model_registry.SCHEMA_VERSION, "sentinel": True}
            joblib.dump(previous, root / "global_model.joblib")
            (root / "metadata.json").write_text(
                '{"schema_version": %d}' % model_registry.SCHEMA_VERSION,
                encoding="utf-8",
            )
            with patch.object(model_registry, "ARTIFACTS_DIR", root), patch.object(
                model_registry, "METADATA_PATH", root / "metadata.json"
            ):
                with self.assertRaises(ValueError):
                    train_models(frame, enforce_minimums=False)
                self.assertEqual(joblib.load(root / "global_model.joblib"), previous)
                self.assertTrue(model_registry.status()["available"])

    def test_similar_rounds_excludes_same_match(self):
        state = extract_match_round_states(_match())[0]
        dataset = pd.DataFrame([
            {**state, "match_id": state["match_id"]},
            {**state, "match_id": "other-match"},
        ])
        similar = find_similar_rounds(state, dataset)
        self.assertEqual([row["match_id"] for row in similar], ["other-match"])


if __name__ == "__main__":
    unittest.main()
