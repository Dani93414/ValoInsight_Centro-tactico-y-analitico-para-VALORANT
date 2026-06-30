from __future__ import annotations

from typing import Any

import pandas as pd

from .round_win_model import FORBIDDEN_ROUND_WIN_FEATURES, validate_round_win_features


ROUND_WIN_FEATURES = [
    "team_weapon_value", "team_armor_value", "team_utility_value",
    "enemy_projected_weapon_value", "enemy_projected_armor_value", "enemy_projected_utility_value",
    "rifle_count", "operator_count", "smg_count", "sidearm_count", "heavy_weapon_count",
    "heavy_shield_count", "regen_shield_count", "light_shield_count", "ultimate_ready_count",
    "map", "side", "round_number", "score_diff", "loss_streak",
    "team_credits_total", "team_credits_median", "enemy_credits_total", "enemy_credits_median",
    "agent_roles", "utility_types_available", "player_weapon_fit_scores", "enemy_buy_class",
]
CATEGORICAL_ROUND_WIN_FEATURES = ["map", "side", "agent_roles", "utility_types_available", "enemy_buy_class"]
NUMERIC_ROUND_WIN_FEATURES = [name for name in ROUND_WIN_FEATURES if name not in CATEGORICAL_ROUND_WIN_FEATURES]


def _series(frame: pd.DataFrame, name: str, default: Any = 0) -> pd.Series:
    if name in frame:
        return frame[name]
    return pd.Series([default] * len(frame), index=frame.index)


def validate_round_win_dataset(frame: pd.DataFrame) -> dict[str, Any]:
    leaked = sorted(FORBIDDEN_ROUND_WIN_FEATURES.intersection(frame.columns))
    missing = [name for name in ROUND_WIN_FEATURES + ["round_won"] if name not in frame]
    valid_labels = int(pd.to_numeric(frame.get("round_won"), errors="coerce").notna().sum()) if "round_won" in frame else 0
    return {"valid": not leaked and not missing and valid_labels > 0, "rows": len(frame),
            "valid_labels": valid_labels, "forbidden_features": leaked, "missing_features": missing,
            "feature_version": "round-win-loadout-v1"}


def build_round_win_dataset(economy_dataset: pd.DataFrame) -> pd.DataFrame:
    source = economy_dataset.copy()
    result = pd.DataFrame(index=source.index)
    # Observed action fields are the historical treatment. At inference these are
    # replaced by each legal simulated candidate, never by unknown future data.
    result["team_weapon_value"] = pd.to_numeric(_series(source, "action_total_loadout"), errors="coerce").fillna(0)
    result["team_armor_value"] = (
        pd.to_numeric(_series(source, "action_heavy_armor_count"), errors="coerce").fillna(0) * 1000
        + pd.to_numeric(_series(source, "action_regen_armor_count"), errors="coerce").fillna(0) * 650
        + pd.to_numeric(_series(source, "action_light_armor_count"), errors="coerce").fillna(0) * 400
    )
    result["team_utility_value"] = pd.to_numeric(_series(source, "plan_estimated_ability_spend"), errors="coerce").fillna(0)
    result["enemy_projected_weapon_value"] = 0
    result["enemy_projected_armor_value"] = 0
    result["enemy_projected_utility_value"] = 0
    mappings = {
        "rifle_count": "action_rifle_count", "operator_count": "action_operator_count",
        "smg_count": "action_smg_count", "heavy_shield_count": "action_heavy_armor_count",
        "regen_shield_count": "action_regen_armor_count", "light_shield_count": "action_light_armor_count",
        "round_number": "round_number", "score_diff": "score_diff", "loss_streak": "loss_streak",
        "team_credits_total": "team_estimated_credits_before_buy",
        "enemy_credits_total": "enemy_estimated_credits_before_buy",
    }
    for target, origin in mappings.items():
        result[target] = pd.to_numeric(_series(source, origin), errors="coerce").fillna(0)
    result["sidearm_count"] = pd.to_numeric(_series(source, "action_sheriff_count"), errors="coerce").fillna(0)
    result["heavy_weapon_count"] = 0
    result["ultimate_ready_count"] = pd.to_numeric(_series(source, "team_ultimates_ready"), errors="coerce").fillna(0)
    result["team_credits_median"] = pd.to_numeric(_series(source, "team_player_credits_median"), errors="coerce").fillna(0)
    result["enemy_credits_median"] = pd.to_numeric(_series(source, "enemy_player_credits_median"), errors="coerce").fillna(0)
    result["map"] = _series(source, "map_name", "UNKNOWN").fillna("UNKNOWN").astype(str)
    result["side"] = _series(source, "side", "unknown").fillna("unknown").astype(str)
    result["agent_roles"] = _series(source, "team_role_signature", "unknown").fillna("unknown").astype(str)
    result["utility_types_available"] = _series(source, "team_utility_signature", "unknown").fillna("unknown").astype(str)
    result["player_weapon_fit_scores"] = pd.to_numeric(_series(source, "team_avg_weapon_fit_score"), errors="coerce").fillna(.5)
    result["enemy_buy_class"] = _series(source, "enemy_economy_case", "ENEMY_UNKNOWN").fillna("ENEMY_UNKNOWN").astype(str)
    result["round_won"] = pd.to_numeric(_series(source, "round_won", None), errors="coerce")
    result["game_start_millis"] = pd.to_numeric(_series(source, "game_start_millis"), errors="coerce").fillna(0)
    result["match_id"] = _series(source, "match_id", "UNKNOWN").astype(str)
    validate_round_win_features({name: None for name in ROUND_WIN_FEATURES}, raise_on_error=True)
    return result
