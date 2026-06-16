from __future__ import annotations

from pathlib import Path

import pandas as pd

from .dataset_builder import DEFAULT_DATASET_PATH
from .model_registry import load_metadata, status
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


def predict_match_economy_recommendations(match: dict) -> dict:
    current_status = status()
    match_id = str((match.get("matchInfo") or {}).get("matchId") or "UNKNOWN")
    if not current_status["available"]:
        return {**current_status, "match_id": match_id, "rounds": []}
    dataset_path = Path(DEFAULT_DATASET_PATH)
    dataset = pd.read_parquet(dataset_path) if dataset_path.exists() else pd.DataFrame()
    recommendations = []
    for state in extract_match_round_states(match):
        result = recommend_economy_action(state)
        if not result.get("available"):
            continue
        real_action = state["real_buy_action"]
        real_alternative = next(
            (item for item in result["alternatives"] if item["action"] == real_action), None
        )
        real_probability = real_alternative and real_alternative["estimated_match_win_probability"]
        similar = find_similar_rounds(state, dataset)
        recommendations.append({
            "round_number": state["round_number"], "team_id": state["team_id"],
            "team_label": state["team_id"], "rank_name": state["rank_name"],
            "rank_group": state["rank_group"], "real_buy_action": real_action,
            "recommended_action": result["recommended_action"],
            "decision_type": _decision_type(real_action, result["recommended_action"]),
            "model_scope": result["model_scope"], "confidence": result["confidence"],
            "estimated_match_win_probability": result["estimated_match_win_probability"],
            "real_action_estimated_match_win_probability": real_probability,
            "delta_vs_real": (
                result["estimated_match_win_probability"] - real_probability
                if real_probability is not None else None
            ),
            "alternatives": result["alternatives"],
            "similar_rounds_summary": summarize_similar_rounds(similar),
            "explanation": result["explanation"], "round_won": bool(state["round_won"]),
            "match_won": bool(state["match_won"]),
        })
    metadata = load_metadata()
    return {
        "available": True, "match_id": match_id,
        "model_metadata": {
            "created_at": metadata.get("created_at"),
            "dataset_rows": metadata.get("dataset_rows"),
            "estimation_type": metadata.get("estimation_type"),
            "limitations": metadata.get("limitations", []),
        },
        "rounds": recommendations,
    }
