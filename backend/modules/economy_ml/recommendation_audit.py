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
