from __future__ import annotations

from typing import Any

from .config import PLAN_VALUE_WEIGHTS


def _num(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def context_key(state: dict[str, Any], plan: dict[str, Any]) -> str:
    macro = plan.get("macro_case") or plan.get("team_buy_case")
    if state.get("is_match_point") or state.get("is_overtime") or macro in {"OVERTIME", "SPECIAL_ROUND"}:
        return "match_point_or_overtime"
    if state.get("is_pistol_round"):
        return "pistol"
    if macro == "ECO":
        return "eco"
    if macro == "BONUS":
        return "bonus"
    if macro in {"STABILIZATION", "ESTABILIZACION"}:
        return "stabilization"
    return "normal"


def evaluate_plan_value(plan: dict[str, Any], state: dict[str, Any]) -> dict[str, Any]:
    key = context_key(state, plan)
    weights = PLAN_VALUE_WEIGHTS[key]
    player_scores = [
        _num(player.get("player_fit_score"), 0.5)
        for player in plan.get("players") or []
        if isinstance(player, dict)
    ]
    average_player_fit = sum(player_scores) / len(player_scores) if player_scores else _num(plan.get("player_fit_score"), 0.5)
    uncertainty = _num(plan.get("uncertainty_penalty"), 0.0)
    value = (
        weights["match_win"] * _num(plan.get("predicted_match_win"), 0.5)
        + weights["round_win"] * _num(plan.get("predicted_round_win"), 0.5)
        + weights["future_economy"] * _num(plan.get("next_round_fullbuy_probability") or plan.get("future_economy_score"), 0.5)
        + weights["utility"] * _num(plan.get("utility_value_score"), 0.5)
        + weights.get("weapon", 0.0) * _num(plan.get("weapon_value_score"), 0.5)
        + weights.get("armor", 0.0) * _num(plan.get("armor_value_score"), 0.5)
        + weights["player_fit"] * average_player_fit
        + weights["coherence"] * _num(plan.get("coherence_score"), 0.5)
        - weights["risk"] * _num(plan.get("economic_risk_score"), 0.5)
        - weights["uncertainty"] * uncertainty
        - _num(plan.get("incoherence_penalty"), 0.0)
    )
    return {
        "team_plan_value": round(max(0.0, min(1.0, value)), 6),
        "plan_value_context": key,
        "plan_value_weights": weights,
        "average_player_fit_score": round(average_player_fit, 4),
    }
