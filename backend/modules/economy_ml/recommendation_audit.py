from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any


SHERIFF_ECO_ACTIONS = {
    "ECO_SHERIFF", "ECO_ONE_SHERIFF", "ECO_TWO_SHERIFFS", "ECO_SHERIFF_STACK",
}


def _pct(count: int, total: int) -> float:
    return round(count / total, 4) if total else 0.0


def summarize_recommendation_distribution(recommendations: list[dict[str, Any]]) -> dict[str, Any]:
    recommended = Counter(str(item.get("recommended_action") or "UNKNOWN") for item in recommendations)
    real = Counter(str(item.get("real_buy_action") or "UNKNOWN") for item in recommendations)
    matrix: dict[str, Counter] = defaultdict(Counter)
    for item in recommendations:
        real_action = str(item.get("real_buy_action") or "UNKNOWN")
        recommended_action = str(item.get("recommended_action") or "UNKNOWN")
        matrix[real_action][recommended_action] += 1

    total = len(recommendations)
    eco_recommendations = sum(
        count for action, count in recommended.items()
        if action.startswith("ECO_")
    )
    sheriff_eco_recommendations = sum(
        count for action, count in recommended.items()
        if action in SHERIFF_ECO_ACTIONS
    )
    return {
        "total_recommendations": total,
        "recommended_action_counts": dict(recommended),
        "recommended_action_percentages": {
            action: _pct(count, total)
            for action, count in recommended.items()
        },
        "real_buy_action_counts": dict(real),
        "real_vs_recommended_matrix": {
            real_action: dict(values)
            for real_action, values in matrix.items()
        },
        "eco_recommendations": eco_recommendations,
        "sheriff_eco_recommendations": sheriff_eco_recommendations,
        "sheriff_share_within_eco_recommendations": _pct(
            sheriff_eco_recommendations, eco_recommendations
        ),
    }


def summarize_pistol_recommendation_safety(recommendations: list[dict[str, Any]]) -> dict[str, Any]:
    pistol_total = 0
    sheriff_count = 0
    sheriff_light_count = 0
    free_light_count = 0
    impossible_count = 0

    for recommendation in recommendations:
        round_number = int(recommendation.get("round_number") or 0)
        if round_number not in {1, 13}:
            continue
        pistol_total += 1
        for player in recommendation.get("player_recommendations") or []:
            weapon = str(player.get("recommended_weapon") or "").lower()
            armor = str(player.get("recommended_armor") or "").lower()
            has_sheriff = "sheriff" in weapon
            has_light = "light" in armor
            free_light = bool(player.get("recommended_armor_is_free_exception"))
            if has_sheriff:
                sheriff_count += 1
            if has_sheriff and has_light:
                sheriff_light_count += 1
                if free_light:
                    free_light_count += 1
                else:
                    impossible_count += 1
            expected_spend = float(player.get("expected_spend") or 0)
            estimated_credits = float(player.get("estimated_credits") or 0)
            if expected_spend > estimated_credits and not free_light:
                impossible_count += 1

    return {
        "pistol_recommendations": pistol_total,
        "pistol_sheriff_player_recommendations": sheriff_count,
        "pistol_sheriff_light_player_recommendations": sheriff_light_count,
        "pistol_free_light_exceptions": free_light_count,
        "pistol_impossible_player_recommendations": impossible_count,
        "pistol_invalid_recommendation_percentage": _pct(impossible_count, pistol_total),
    }
