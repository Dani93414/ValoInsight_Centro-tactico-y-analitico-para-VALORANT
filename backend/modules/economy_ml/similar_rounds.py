from __future__ import annotations

from typing import Any

import pandas as pd


def find_similar_rounds(state: dict, dataset: pd.DataFrame, limit: int = 50) -> list[dict]:
    if dataset.empty:
        return []
    candidates = dataset
    if "match_id" in candidates:
        candidates = candidates[candidates["match_id"].astype(str) != str(state.get("match_id"))]
        if candidates.empty:
            return []
    rank_name = state.get("rank_name")
    exact = candidates[candidates["rank_name"] == rank_name] if "rank_name" in candidates else candidates.iloc[0:0]
    if len(exact) >= min(limit, 20):
        candidates = exact
    elif "rank_group" in candidates:
        grouped = candidates[candidates["rank_group"] == state.get("rank_group")]
        if not grouped.empty:
            candidates = grouped
    scored = candidates.copy()
    weights = {
        "round_number": 0.25, "score_diff": 0.8,
        "credits_before_buy_diff": 0.00012,
        "enemy_estimated_credits_before_buy": 0.00008,
        "team_players_can_full_buy_estimate": 0.8,
        "enemy_players_can_full_buy_estimate": 0.8,
    }
    scored["_distance"] = 0.0
    for column, weight in weights.items():
        if column in scored:
            scored["_distance"] += (pd.to_numeric(scored[column], errors="coerce").fillna(0) - float(state.get(column) or 0)).abs() * weight
    if "side" in scored:
        scored["_distance"] += (scored["side"].astype(str) != str(state.get("side"))).astype(float)
    return scored.nsmallest(limit, "_distance").drop(columns=["_distance"]).to_dict("records")


def summarize_similar_rounds(similar_rounds: list[dict]) -> dict[str, Any]:
    by_action: dict[str, dict[str, float | int]] = {}
    for row in similar_rounds:
        action = str(row.get("real_buy_action") or "UNKNOWN")
        bucket = by_action.setdefault(action, {"samples": 0, "wins": 0})
        bucket["samples"] += 1
        bucket["wins"] += int(bool(row.get("match_won")))
    return {
        "similar_rounds_found": len(similar_rounds),
        "by_action": {
            action: {"samples": values["samples"], "match_win_rate": values["wins"] / values["samples"]}
            for action, values in by_action.items()
        },
    }
