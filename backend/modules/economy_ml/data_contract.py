from __future__ import annotations

from .schemas import FORBIDDEN_FEATURES

DIRECT_AVAILABLE = "DIRECT_AVAILABLE"
DERIVED_PRE_ROUND = "DERIVED_PRE_ROUND"
DERIVED_POST_ROUND_ONLY = "DERIVED_POST_ROUND_ONLY"
CONTENT_AVAILABLE = "CONTENT_AVAILABLE"
CONTENT_MISSING = "CONTENT_MISSING"
NOT_AVAILABLE = "NOT_AVAILABLE"
UNSAFE_LEAKAGE = "UNSAFE_LEAKAGE"

POST_ROUND_ONLY_COLUMNS = {
    "round_won", "match_won", "winningTeam", "roundResult", "roundCeremony",
    "kills", "damage", "score", "bombPlanter", "bombDefuser", "plant",
    "defuse", "ability", "ultimateEffects", "used_ultimate_this_round",
}

PRE_ROUND_ALLOWED = {
    "map_id", "season_id", "queue_id", "rank_name", "rank_group", "side",
    "round_number", "is_ranked", "rank_tier_avg", "rank_tier_median",
    "team_score_before", "enemy_score_before", "score_diff",
    "previous_round_won", "win_streak", "loss_streak", "enemy_win_streak",
    "enemy_loss_streak", "is_pistol_round", "is_second_round",
    "is_bonus_candidate", "is_last_round_before_switch", "is_match_point",
    "is_overtime", "team_estimated_credits_before_buy",
    "enemy_estimated_credits_before_buy", "credits_before_buy_diff",
    "team_players_can_full_buy_estimate", "enemy_players_can_full_buy_estimate",
    "team_players_low_money", "enemy_players_low_money",
    "team_credit_estimate_quality", "enemy_credit_estimate_quality",
    "credit_estimate_quality", "target_loadout_case", "cashflow_case",
    "enemy_target_loadout_case", "enemy_cashflow_case",
    "prebuy_credits_observed", "prebuy_credits_rules", "prebuy_credits_selected",
    "team_prebuy_credits_observed", "team_prebuy_credits_rules", "team_prebuy_credits_selected",
    "enemy_prebuy_credits_observed", "enemy_prebuy_credits_rules", "enemy_prebuy_credits_selected",
    "team_previous_round_reconciliation_quality", "enemy_previous_round_reconciliation_quality",
    "team_drop_reconciliation_status", "enemy_drop_reconciliation_status",
    "team_economy_reconciliation_abs_delta_mean",
    "team_economy_reconciliation_abs_delta_max",
    "team_economy_reconciliation_quality_score",
    "team_possible_afk_bonus",
    "team_possible_afk_bonus_value",
    "team_free_light_armor_exception_count",
    "team_possible_drop_credit_gap",
    "team_spent_over_prebuy",
    "enemy_economy_reconciliation_abs_delta_mean",
    "enemy_economy_reconciliation_abs_delta_max",
    "enemy_economy_reconciliation_quality_score",
    "enemy_possible_afk_bonus",
    "enemy_possible_afk_bonus_value",
    "enemy_free_light_armor_exception_count",
    "enemy_possible_drop_credit_gap",
    "enemy_spent_over_prebuy",
    "agent_composition", "agent_roles", "weapon_catalog", "gear_catalog",
    "ability_catalog", "player_style_prior", "player_form_before_round",
    "estimated_ultimate_available_probability",
}


def validate_feature_contract(features: list[str]) -> dict:
    forbidden = sorted(set(features).intersection(FORBIDDEN_FEATURES))
    post_round = sorted(set(features).intersection(POST_ROUND_ONLY_COLUMNS))
    return {
        "valid": not forbidden and not post_round,
        "forbidden_features": forbidden,
        "post_round_only_features": post_round,
    }


def build_data_contract_report() -> dict:
    return {
        "statuses": [
            DIRECT_AVAILABLE, DERIVED_PRE_ROUND, DERIVED_POST_ROUND_ONLY,
            CONTENT_AVAILABLE, CONTENT_MISSING, NOT_AVAILABLE, UNSAFE_LEAKAGE,
        ],
        "pre_round_allowed": sorted(PRE_ROUND_ALLOWED),
        "post_round_only": sorted(POST_ROUND_ONLY_COLUMNS),
        "forbidden_pre_round": sorted(FORBIDDEN_FEATURES.union(POST_ROUND_ONLY_COLUMNS)),
        "rules": [
            "No usar datos posteriores a la ronda para predecir esa misma ronda.",
            "No afirmar compras de habilidades si no existe compra explicita verificable.",
            "No inventar costes de habilidades; si faltan, solo se recomienda foco de utilidad.",
            "Si hay duda, clasificar el dato como no seguro para pre-ronda.",
        ],
    }
