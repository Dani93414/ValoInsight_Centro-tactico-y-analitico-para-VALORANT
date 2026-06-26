from __future__ import annotations

from pathlib import Path

import pandas as pd

from .content_catalog import CONTENT_UNAVAILABLE_REASON, content_available
from .dataset_builder import DEFAULT_DATASET_PATH
from .model_registry import load_metadata, status
from .player_recommendations import build_player_recommendations
from .plan_evaluator import evaluate_plan_value
from .policy import recommend_economy_action
from .similar_rounds import find_similar_rounds, summarize_similar_rounds
from .state_extractor import extract_match_round_states


def _decision_type(real: str, recommended: str) -> str:
    if real == recommended:
        return "matched"
    conservative = {"ECO_CLASSIC", "ECO_PISTOL_UPGRADE", "ECO_SHERIFF"}
    if real in conservative and recommended not in conservative:
        return "too_conservative"
    return "different_strategy"


def _utility_summary(state: dict) -> dict:
    return {
        "team_total_utility_score": state.get("team_total_utility_score"),
        "enemy_total_utility_score": state.get("enemy_total_utility_score"),
        "utility_score_diff": state.get("utility_score_diff"),
        "team_low_economy_resilience": state.get("team_low_economy_resilience"),
        "enemy_low_economy_resilience": state.get("enemy_low_economy_resilience"),
        "team_weapon_dependency_score": state.get("team_weapon_dependency_score"),
        "enemy_weapon_dependency_score": state.get("enemy_weapon_dependency_score"),
        "team_smoke_utility_score": state.get("team_smoke_utility_score"),
        "team_recon_utility_score": state.get("team_recon_utility_score"),
        "team_flash_utility_score": state.get("team_flash_utility_score"),
        "team_stall_utility_score": state.get("team_stall_utility_score"),
    }


def _count_models(models: dict, key: str) -> int:
    value = models.get(key)
    if key == "global":
        return int(bool(value))
    return len(value) if isinstance(value, dict) else int(bool(value))


def _metadata_payload(metadata: dict) -> dict:
    models = metadata.get("models") if isinstance(metadata.get("models"), dict) else {}
    metrics = ((models.get("global") or {}).get("metrics") or {}) if isinstance(models.get("global"), dict) else {}
    global_metrics = metrics.get("global") if isinstance(metrics.get("global"), dict) else {}
    return {
        "schema_version": metadata.get("schema_version"),
        "created_at": metadata.get("created_at"),
        "dataset_rows": metadata.get("dataset_rows"),
        "estimation_type": metadata.get("estimation_type"),
        "includes_agent_utility": bool(metadata.get("includes_agent_utility")),
        "prebuy_credit_source": metadata.get("prebuy_credit_source"),
        "supports_regen_shield": bool(metadata.get("supports_regen_shield")),
        "weapon_taxonomy_version": metadata.get("weapon_taxonomy_version"),
        "planned_cashflow_available": bool(metadata.get("planned_cashflow_available")),
        "agent_utility_features_count": len(metadata.get("agent_utility_features") or []),
        "model_counts": {
            "global": _count_models(models, "global"),
            "rank_groups": _count_models(models, "rank_groups"),
            "rank_names": _count_models(models, "rank_names"),
        },
        "global_metrics": {
            "accuracy": global_metrics.get("accuracy"),
            "roc_auc": global_metrics.get("roc_auc"),
            "log_loss": global_metrics.get("log_loss"),
            "brier_score": global_metrics.get("brier_score"),
            "samples": global_metrics.get("samples"),
            "positive_rate": global_metrics.get("positive_rate"),
        },
        "limitations": metadata.get("limitations", []),
    }


def predict_match_economy_recommendations(match: dict) -> dict:
    current_status = status()
    match_id = str((match.get("matchInfo") or {}).get("matchId") or "UNKNOWN")
    if not content_available():
        return {"available": False, "reason": CONTENT_UNAVAILABLE_REASON, "match_id": match_id, "rounds": []}
    if not current_status["available"]:
        return {**current_status, "match_id": match_id, "rounds": []}
    dataset_path = Path(DEFAULT_DATASET_PATH)
    dataset = pd.read_parquet(dataset_path) if dataset_path.exists() else pd.DataFrame()
    metadata = load_metadata()
    in_sample = match_id in set(str(value) for value in metadata.get("training_match_ids") or [])
    recommendations = []
    for state in extract_match_round_states(match):
        result = recommend_economy_action(state, match=match)
        if not result.get("available"):
            continue
        real_action = state["real_buy_action"]
        real_alternative = next(
            (item for item in result["alternatives"] if item["action"] == real_action), None
        )
        real_probability = real_alternative and real_alternative["estimated_match_win_probability"]
        similar = find_similar_rounds(state, dataset)
        player_recommendations = build_player_recommendations(
            match, state, result["recommended_action"]
        )
        recommended_team_plan = dict(result.get("team_plan") or {})
        pre_player_plan_value = recommended_team_plan.get("team_plan_value")
        recommended_team_plan["players"] = player_recommendations
        recommended_team_plan.update(evaluate_plan_value(recommended_team_plan, state))
        post_player_plan_value = recommended_team_plan.get("team_plan_value")
        plan_value_delta = (
            post_player_plan_value - pre_player_plan_value
            if pre_player_plan_value is not None and post_player_plan_value is not None
            else None
        )
        plan_value_warning = (
            "El valor del plan cambio tras incorporar player_fit; la seleccion se hizo antes de esta recalibracion."
            if plan_value_delta is not None and abs(plan_value_delta) >= 0.04
            else None
        )
        recommendations.append({
            "round_number": state["round_number"], "team_id": state["team_id"],
            "team_label": state["team_id"], "rank_name": state["rank_name"],
            "rank_group": state["rank_group"], "real_buy_action": real_action,
            "team_credits_before_buy": state.get("team_estimated_credits_before_buy"),
            "prebuy_credits_observed": state.get("prebuy_credits_observed"),
            "prebuy_credits_rules": state.get("prebuy_credits_rules"),
            "prebuy_credits_selected": state.get("prebuy_credits_selected"),
            "team_prebuy_credits_observed": state.get("team_prebuy_credits_observed"),
            "team_prebuy_credits_rules": state.get("team_prebuy_credits_rules"),
            "team_prebuy_credits_selected": state.get("team_prebuy_credits_selected"),
            "team_spent": state.get("action_total_spent"),
            "team_loadout": state.get("action_total_loadout"),
            "recommended_action": result["recommended_action"],
            "decision_type": _decision_type(real_action, result["recommended_action"]),
            "model_scope": result["model_scope"], "confidence": result["confidence"],
            "confidence_kind": result.get("confidence_kind"),
            "recommendation_strength": result.get("recommendation_strength"),
            "recommendation_margin": result.get("recommendation_margin"),
            "recommendation_status": result.get("recommendation_status"),
            "num_viable_alternatives": result.get("num_viable_alternatives"),
            "delta_team_plan_value": result.get("delta_team_plan_value"),
            "delta_round_win": result.get("delta_round_win"),
            "delta_next_fullbuy": result.get("delta_next_fullbuy"),
            "support_count_best_action": result.get("support_count_best_action"),
            "credit_estimate_quality": result.get("credit_estimate_quality"),
            "credit_estimate_inconsistency_reason": state.get("credit_estimate_inconsistency_reason"),
            "team_drop_reconciliation_status": state.get("team_drop_reconciliation_status"),
            "team_possible_drop_credit_gap": state.get("team_possible_drop_credit_gap"),
            "team_spent_over_prebuy": state.get("team_spent_over_prebuy"),
            "target_loadout_case": state.get("target_loadout_case"),
            "cashflow_case": state.get("cashflow_case"),
            "observed_cashflow_case": state.get("cashflow_case"),
            "planned_cashflow_case": recommended_team_plan.get("planned_cashflow_case"),
            "action_regen_armor_count": recommended_team_plan.get("action_regen_armor_count"),
            "in_sample": in_sample,
            "support_factor": result.get("support_factor"),
            "credit_quality_factor": result.get("credit_quality_factor"),
            "low_confidence_reason": result.get("low_confidence_reason"),
            "estimated_match_win_probability": result["estimated_match_win_probability"],
            "estimated_round_win_probability": recommended_team_plan.get("predicted_round_win"),
            "estimated_fullbuy_next_round_probability": recommended_team_plan.get("next_round_fullbuy_probability"),
            "team_plan": recommended_team_plan,
            "recommended_team_plan": recommended_team_plan,
            "post_player_fit_plan_value_delta": plan_value_delta,
            "post_player_fit_plan_value_warning": plan_value_warning,
            "real_action_estimated_match_win_probability": real_probability,
            "delta_vs_real": (
                result["estimated_match_win_probability"] - real_probability
                if real_probability is not None else None
            ),
            "alternatives": result["alternatives"],
            "similar_rounds_summary": summarize_similar_rounds(similar),
            "utility_summary": _utility_summary(state),
            "player_recommendations": player_recommendations,
            "explanation": result["explanation"], "round_won": bool(state["round_won"]),
            "match_won": bool(state["match_won"]),
            "limitations": result.get("limitations", []),
        })
    return {
        "available": True, "match_id": match_id,
        "model_metadata": _metadata_payload(metadata),
        "rounds": recommendations,
    }
