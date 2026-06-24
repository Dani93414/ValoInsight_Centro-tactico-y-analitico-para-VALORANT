from __future__ import annotations

from typing import Any


ACTION_TO_MACRO = {
    "ECO_CLASSIC": ("ECO", "ECO_SAVE"),
    "ECO_PISTOL_UPGRADE": ("ECO", "ECO_WITH_PISTOLS"),
    "ECO_ONE_SHERIFF": ("ECO", "ECO_ONE_SHERIFF"),
    "ECO_TWO_SHERIFFS": ("ECO", "ECO_TWO_SHERIFFS"),
    "ECO_SHERIFF": ("ECO", "ECO_WITH_PISTOLS"),
    "ECO_SHERIFF_STACK": ("ECO", "ECO_SHERIFF_STACK"),
    "SEMI_SMG": ("SEMIBUY", "SEMIBUY_CONTEST"),
    "SEMI_MARSHAL": ("SEMIBUY", "SEMIBUY_CONTEST"),
    "MIXED_LOW_BUY": ("STABILIZATION", "STABILIZATION_RESET"),
    "FORCE_OUTLAW": ("FORCE", "FORCE_RISK"),
    "FORCE_RIFLE_LIGHT": ("FORCE", "FORCE_RISK"),
    "FORCE_2_RIFLES": ("FORCE", "FORCE_RISK"),
    "FULL_RIFLES": ("FULLBUY", "FULLBUY_STANDARD"),
    "FULL_OPERATOR": ("FULLBUY", "FULLBUY_WITH_SNIPER"),
    "BONUS_KEEP_WEAPONS": ("BONUS", "BONUS_CONSERVE"),
}


def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def classify_economy_case(state: dict[str, Any], action: str | None = None) -> dict[str, str]:
    if state.get("is_overtime"):
        round_context = "OVERTIME_STANDARD"
    elif state.get("is_match_point"):
        round_context = "MATCH_POINT_FORCE"
    elif state.get("is_last_round_before_switch"):
        round_context = "LAST_ROUND_FORCE"
    elif state.get("is_bonus_candidate"):
        round_context = "BONUS_CONSERVE"
    else:
        round_context = "STANDARD"

    if action and action in ACTION_TO_MACRO:
        macro, intent = ACTION_TO_MACRO[action]
    else:
        credits = _num(state.get("team_estimated_credits_before_buy"))
        full_buyers = int(_num(state.get("team_players_can_full_buy_estimate")))
        low_money = int(_num(state.get("team_players_low_money")))
        desync = low_money >= 2 and full_buyers >= 1
        if state.get("is_overtime"):
            macro, intent = "OVERTIME", "OVERTIME_STANDARD"
        elif state.get("is_match_point") or state.get("is_last_round_before_switch"):
            macro, intent = "SPECIAL_ROUND", "MATCH_POINT_FORCE" if state.get("is_match_point") else "LAST_ROUND_FORCE"
        elif state.get("is_bonus_candidate"):
            macro, intent = "BONUS", "BONUS_CONSERVE"
        elif full_buyers >= 4 and credits >= 18000:
            macro, intent = "FULLBUY", "FULLBUY_STANDARD"
        elif desync:
            macro, intent = "STABILIZATION", "STABILIZATION_RESET"
        elif credits >= 9000:
            macro, intent = "SEMIBUY", "SEMIBUY_STABILIZE"
        else:
            macro, intent = "ECO", "ECO_SAVE"
    return {
        "macro_buy_case": macro,
        "economy_intent": intent,
        "round_context_case": round_context,
    }
