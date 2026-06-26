from __future__ import annotations

from typing import Any

from modules.analytics.infrastructure.reference_data import resolve_agent_role

from .agent_utility import agent_utility
from .ability_planner import estimate_minimum_key_utility_budget, recommend_ability_purchase
from .content_catalog import load_gear_catalog, load_weapon_catalog, weapon_catalog_role
from .economy_rules import (
    GHOST_COST,
    LIGHT_ARMOR_COST,
    SHERIFF_COST,
    is_light_armor_item,
    is_pistol_round,
    item_cost,
)
from .player_form import build_player_form
from .player_style import build_match_player_style, player_weapon_fit_score
from .recommendation_validation import validate_team_plan_allocation


def _number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _pick_weapon_by_name(name: str, budget: float) -> dict[str, Any] | None:
    normalized = name.lower()
    candidates = [
        weapon for weapon in load_weapon_catalog().values()
        if normalized in str(weapon.get("displayName") or "").lower()
        and weapon.get("cost") is not None
        and _number(weapon.get("cost")) <= budget
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda item: _number(item.get("cost")))


def _pick_weapon_by_profile(profile: str, budget: float) -> dict[str, Any] | None:
    candidates = [
        weapon for weapon in load_weapon_catalog().values()
        if profile in (weapon.get("usage_profile") or [])
        and weapon.get("cost") is not None
        and _number(weapon.get("cost")) <= budget
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda item: _number(item.get("cost")))


def _pick_armor(level: str, budget: float) -> dict[str, Any] | None:
    candidates = [
        gear for gear in load_gear_catalog().values()
        if gear.get("armor_level") == level
        and gear.get("cost") is not None
        and _number(gear.get("cost")) <= budget
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda item: _number(item.get("cost")))


def action_slots(action: str) -> dict[str, int]:
    slots = {
        "ECO_CLASSIC": {"classic": 5},
        "ECO_PISTOL_UPGRADE": {"pistol_upgrade": 2, "classic": 3},
        "ECO_ONE_SHERIFF": {"sheriff": 1, "classic": 4},
        "ECO_TWO_SHERIFFS": {"sheriff": 2, "classic": 3},
        "ECO_SHERIFF": {"sheriff": 2, "classic": 3},
        "ECO_SHERIFF_STACK": {"sheriff": 5},
        "SEMI_SMG": {"smg_light": 3, "classic": 2},
        "SEMI_MARSHAL": {"marshal_light": 2, "classic": 3},
        "FORCE_OUTLAW": {"outlaw_light": 2, "classic": 3},
        "FORCE_RIFLE_LIGHT": {"rifle_light": 2, "light": 3},
        "FORCE_2_RIFLES": {"rifle_heavy": 2, "light": 3},
        "FULL_RIFLES": {"rifle_heavy": 5},
        "FULL_OPERATOR": {"operator_heavy": 1, "rifle_heavy": 4},
        "BONUS_KEEP_WEAPONS": {"light": 5},
        "MIXED_LOW_BUY": {"rifle_light": 1, "smg_light": 1, "classic": 3},
    }
    return dict(slots.get(action, {"classic": 5}))


def _expanded_slots(action: str, player_count: int) -> list[str]:
    result: list[str] = []
    for slot, count in action_slots(action).items():
        result.extend([slot] * int(count))
    if len(result) < player_count:
        result.extend(["classic"] * (player_count - len(result)))
    return result[:player_count]


def _player_priority(match: dict[str, Any], state: dict[str, Any], player: dict[str, Any]) -> float:
    puuid = str(player.get("puuid") or "")
    agent_id = str(player.get("characterId") or "UNKNOWN")
    role = resolve_agent_role(agent_id)
    utility = agent_utility(agent_id)
    style = build_match_player_style(player)
    form = build_player_form(match, puuid, int(state.get("round_number") or 1))
    credits = _number((state.get("team_player_credit_estimates") or {}).get(puuid))
    weapon_fit = player_weapon_fit_score(style, "Sheriff")
    form_score = max(
        0.0,
        min(
            1.0,
            0.5
            + _number(form.get("hot_streak_score")) * 0.25
            - _number(form.get("cold_streak_score")) * 0.25,
        ),
    )
    role_bonus = 0.05 if "duelist" in str(role or "").lower() else 0.0
    return (
        weapon_fit * 0.35
        + form_score * 0.25
        + _number(utility.get("weapon_dependency_score")) * 0.20
        + min(1.0, credits / 9000.0) * 0.15
        + role_bonus
    )


def _slot_loadout(slot: str, credits: float) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    weapon: dict[str, Any] | None = None
    armor: dict[str, Any] | None = None
    if slot == "sheriff":
        weapon = _pick_weapon_by_name("sheriff", credits)
    elif slot == "pistol_upgrade":
        weapon = _pick_weapon_by_name("ghost", credits) or _pick_weapon_by_profile("sidearm", credits)
    elif slot == "smg_light":
        weapon = _pick_weapon_by_profile("close_range", credits)
        armor = _pick_armor("light", max(0.0, credits - item_cost(weapon)))
    elif slot == "marshal_light":
        weapon = _pick_weapon_by_name("marshal", credits)
        armor = _pick_armor("light", max(0.0, credits - item_cost(weapon)))
    elif slot == "outlaw_light":
        weapon = _pick_weapon_by_name("outlaw", credits)
        armor = _pick_armor("light", max(0.0, credits - item_cost(weapon)))
    elif slot == "rifle_light":
        weapon = _pick_weapon_by_profile("rifle_default", credits)
        armor = _pick_armor("light", max(0.0, credits - item_cost(weapon)))
    elif slot == "rifle_heavy":
        weapon = _pick_weapon_by_profile("rifle_default", credits)
        remaining = max(0.0, credits - item_cost(weapon))
        armor = _pick_armor("heavy", remaining) or _pick_armor("light", remaining)
    elif slot == "operator_heavy":
        weapon = _pick_weapon_by_name("operator", credits)
        remaining = max(0.0, credits - item_cost(weapon))
        armor = _pick_armor("heavy", remaining) or _pick_armor("light", remaining)
    elif slot == "light":
        armor = _pick_armor("light", credits)
    return weapon, armor


def _pistol_free_exception_for_player(state: dict[str, Any], puuid: str) -> bool:
    exceptions = state.get("team_player_free_light_armor_exceptions") or {}
    return bool(exceptions.get(puuid))


def _context_from_action(action: str, state: dict[str, Any]) -> str:
    if is_pistol_round(state):
        return "pistol"
    if state.get("is_match_point") or state.get("is_last_round_before_switch") or state.get("is_overtime"):
        return "match_point_or_overtime"
    if action.startswith("ECO"):
        return "eco"
    if action.startswith("FULL"):
        return "fullbuy"
    if action == "BONUS_KEEP_WEAPONS":
        return "bonus"
    if action == "MIXED_LOW_BUY":
        return "stabilization"
    return "normal"


def _weapon_name(weapon: dict[str, Any] | None) -> str:
    return str((weapon or {}).get("displayName") or "")


def _allocation_hard_constraint_violations(action: str, assignments: list[dict[str, Any]]) -> list[str]:
    weapons = [item.get("weapon") for item in assignments]
    roles = [weapon_catalog_role(weapon) for weapon in weapons if weapon]
    names = [_weapon_name(weapon).strip().lower() for weapon in weapons if weapon]
    violations: list[str] = []
    if action == "FULL_RIFLES":
        sniper_count = sum(role == "sniper" for role in roles)
        rifle_count = sum(role == "rifle" for role in roles)
        if sniper_count:
            violations.append("FULL_RIFLES no puede asignar snipers.")
        if rifle_count < 4:
            violations.append("FULL_RIFLES debe asignar al menos 4 rifles.")
    if action == "FULL_OPERATOR":
        operator_count = sum(name == "operator" for name in names)
        if operator_count != 1:
            violations.append("FULL_OPERATOR debe asignar exactamente una Operator.")
    if action == "FORCE_RIFLE_LIGHT":
        if any(name == "outlaw" for name in names):
            violations.append("FORCE_RIFLE_LIGHT no puede asignar Outlaw.")
    return violations


def allocate_player_loadouts(
    match: dict[str, Any],
    state: dict[str, Any],
    action: str,
) -> dict[str, Any]:
    players = [
        player for player in match.get("players") or []
        if player.get("puuid") and player.get("teamId") == state.get("team_id")
    ]
    credit_estimates = state.get("team_player_credit_estimates") or {}
    if not credit_estimates:
        per_player = _number(state.get("team_estimated_credits_before_buy")) / max(len(players), 1)
        credit_estimates = {str(player.get("puuid")): per_player for player in players}

    ordered = sorted(
        enumerate(players),
        key=lambda item: (_player_priority(match, state, item[1]), -item[0]),
        reverse=True,
    )
    slot_order = _expanded_slots(action, len(players))
    assignments_by_index: dict[int, dict[str, Any]] = {}
    violations: list[str] = []

    for slot, (original_index, player) in zip(slot_order, ordered):
        puuid = str(player.get("puuid") or "")
        estimated_credits = _number(credit_estimates.get(puuid))
        agent_id = str(player.get("characterId") or "")
        role = resolve_agent_role(agent_id)
        agent_name = str(
            player.get("characterName")
            or player.get("agentName")
            or player.get("agent")
            or (agent_id if "-" not in agent_id else "")
            or ""
        )
        context = _context_from_action(action, state)
        reserve = estimate_minimum_key_utility_budget(
            agent_name=agent_name,
            agent_id=agent_id,
            role=role,
            side=str(state.get("side") or "unknown"),
            context=context,
        )
        if state.get("is_match_point") or state.get("is_last_round_before_switch") or state.get("is_overtime"):
            reserve = min(reserve, max(0.0, estimated_credits * 0.25))
        loadout_budget = max(0.0, estimated_credits - reserve)
        weapon, armor = _slot_loadout(slot, loadout_budget)
        reasons: list[str] = []

        if is_pistol_round(state) and slot == "sheriff" and armor and is_light_armor_item(armor):
            if _pistol_free_exception_for_player(state, puuid):
                reasons.append("Escudo ligero permitido por excepcion inferida de escudo gratuito en pistol round.")
            else:
                armor = None
                reasons.append("En pistol round normal, Sheriff + escudo ligero no es legal con 800 creditos.")
        elif is_pistol_round(state) and slot == "sheriff" and _pistol_free_exception_for_player(state, puuid):
            armor = _pick_armor("light", LIGHT_ARMOR_COST)
            reasons.append("Escudo ligero permitido por excepcion inferida de escudo gratuito en pistol round.")

        weapon_cost = item_cost(weapon)
        armor_is_free_exception = bool(
            armor
            and is_light_armor_item(armor)
            and is_pistol_round(state)
            and _pistol_free_exception_for_player(state, puuid)
        )
        armor_cost = 0.0 if armor_is_free_exception else item_cost(armor)
        loadout_cost = weapon_cost + armor_cost
        ability_plan = recommend_ability_purchase(
            agent_name=agent_name,
            agent_id=agent_id,
            role=role,
            side=str(state.get("side") or "unknown"),
            available_credits_after_loadout=max(0.0, estimated_credits - loadout_cost),
            context=context,
        )
        ability_cost = _number(ability_plan.get("total_cost"))
        total_cost = loadout_cost + ability_cost
        expected_remaining = estimated_credits - total_cost
        if total_cost > estimated_credits + 1e-6:
            violations.append(
                f"{puuid}: loadout costs {total_cost:.0f} but player has {estimated_credits:.0f}"
            )

        assignments_by_index[original_index] = {
            "puuid": puuid,
            "estimated_credits": estimated_credits,
            "weapon": weapon,
            "armor": armor,
            "armor_is_free_exception": armor_is_free_exception,
            "abilities": ability_plan.get("abilities") or [],
            "ability_budget": ability_cost,
            "ability_plan": ability_plan,
            "reserved_utility_budget": round(reserve, 2),
            "loadout_budget_after_utility_reserve": round(loadout_budget, 2),
            "total_cost": max(0.0, total_cost),
            "expected_remaining": max(0.0, expected_remaining),
            "slot": slot,
            "reasons": reasons + list(ability_plan.get("warnings") or []),
        }

    assignments = [assignments_by_index[index] for index in sorted(assignments_by_index)]
    violations.extend(_allocation_hard_constraint_violations(action, assignments))
    allocation = {
        "valid": not violations,
        "team_total_cost": round(sum(_number(item.get("total_cost")) for item in assignments), 2),
        "team_estimated_credits_before_buy": _number(state.get("team_estimated_credits_before_buy")),
        "violations": violations,
        "players": assignments,
    }
    validation = validate_team_plan_allocation(allocation)
    allocation["valid"] = bool(allocation["valid"] and validation["valid"])
    allocation["violations"] = list(dict.fromkeys(violations + validation["violations"]))
    allocation["warnings"] = validation["warnings"]
    return allocation
