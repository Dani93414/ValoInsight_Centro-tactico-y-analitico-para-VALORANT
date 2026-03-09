from __future__ import annotations

from statistics import median
from typing import Dict, Iterable, List

from .constants import RATING_WEIGHTS, ROLE_UNKNOWN


def safe_div(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator else 0.0


def percentile_rank(value: float, population: List[float]) -> float:
    """
    Devuelve 0..100.
    Si hay pocos datos o todos iguales, devuelve 50.
    """
    clean = [float(x) for x in population if x is not None]
    if not clean:
        return 50.0

    clean.sort()
    if clean[0] == clean[-1]:
        return 50.0

    below = sum(1 for x in clean if x < value)
    equal = sum(1 for x in clean if x == value)
    rank = (below + 0.5 * equal) / len(clean)
    return max(0.0, min(100.0, rank * 100.0))


def score_role_block(
    aggregate_block: dict,
    baseline_blocks: Iterable[dict],
    role: str,
) -> dict:
    weights = RATING_WEIGHTS.get(role, RATING_WEIGHTS[ROLE_UNKNOWN])
    metrics = list(weights.keys())

    baseline_list = list(baseline_blocks)

    metric_scores = {}
    weighted_total = 0.0

    for metric_name, weight in weights.items():
        baseline_population = [float(item.get(metric_name, 0.0) or 0.0) for item in baseline_list]
        player_value = float(aggregate_block.get(metric_name, 0.0) or 0.0)
        pct = percentile_rank(player_value, baseline_population)
        metric_scores[metric_name] = {
            "value": round(player_value, 4),
            "percentile": round(pct, 2),
            "weight": weight,
        }
        weighted_total += pct * weight

    score_0_100 = round(weighted_total, 2)
    rating_1000 = max(100, min(1000, round(100 + score_0_100 * 9)))

    return {
        "role": role,
        "score_0_100": score_0_100,
        "rating_1000": rating_1000,
        "metric_scores": metric_scores,
        "baseline_size": len(baseline_list),
    }


def combine_role_scores(role_scores: List[dict]) -> dict:
    """
    Combina ratings de varios roles usando rounds como peso.
    Cada item debe traer:
      {
        "rating_payload": {...},
        "rounds": int,
      }
    """
    valid = [item for item in role_scores if item.get("rounds", 0) > 0]
    if not valid:
        return {
            "score_0_100": 50.0,
            "rating_1000": 550,
            "role_breakdown": [],
        }

    total_rounds = sum(item["rounds"] for item in valid)
    combined_score = sum(item["rating_payload"]["score_0_100"] * item["rounds"] for item in valid) / total_rounds
    combined_rating = max(100, min(1000, round(100 + combined_score * 9)))

    return {
        "score_0_100": round(combined_score, 2),
        "rating_1000": combined_rating,
        "role_breakdown": [
            {
                "role": item["rating_payload"]["role"],
                "rounds": item["rounds"],
                "score_0_100": item["rating_payload"]["score_0_100"],
                "rating_1000": item["rating_payload"]["rating_1000"],
                "baseline_size": item["rating_payload"]["baseline_size"],
            }
            for item in valid
        ],
    }