from __future__ import annotations

from typing import Any

from .buy_classifier import BUY_ACTIONS
from .economy_cases import classify_economy_case


def candidate_actions_for_state(state: dict[str, Any]) -> list[str]:
    credits = float(state.get("team_estimated_credits_before_buy") or 0)
    actions = ["ECO_CLASSIC", "ECO_PISTOL_UPGRADE", "ECO_SHERIFF"]
    if credits >= 7000:
        actions.extend(["MIXED_LOW_BUY", "SEMI_MARSHAL"])
    if credits >= 9000:
        actions.append("SEMI_SMG")
    if credits >= 10500:
        actions.append("FORCE_OUTLAW")
    if credits >= 13500:
        actions.extend(["FORCE_RIFLE_LIGHT", "FORCE_2_RIFLES"])
    if credits >= 20000:
        actions.append("FULL_RIFLES")
    if credits >= 23000:
        actions.append("FULL_OPERATOR")
    if state.get("is_bonus_candidate"):
        actions.append("BONUS_KEEP_WEAPONS")
    if state.get("is_match_point") or state.get("is_last_round_before_switch") or state.get("is_overtime"):
        actions.extend(["FORCE_RIFLE_LIGHT", "FULL_RIFLES"])
    return [action for action in BUY_ACTIONS if action in dict.fromkeys(actions) and action != "UNKNOWN"]


def generated_plan_shells(state: dict[str, Any]) -> list[dict[str, Any]]:
    shells = []
    for action in candidate_actions_for_state(state):
        case = classify_economy_case(state, action)
        shells.append({
            "source_action": action,
            "macro_case": case["macro_buy_case"],
            "subtype": case["economy_intent"],
            "round_context_case": case["round_context_case"],
        })
    return shells
