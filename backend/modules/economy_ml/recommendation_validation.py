from __future__ import annotations

from typing import Any

from .content_catalog import weapon_catalog_role
from .economy_rules import armor_cost, item_cost, weapon_cost


def _number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _weapon_cost(recommendation: dict[str, Any]) -> float:
    if "weapon_cost" in recommendation:
        return _number(recommendation.get("weapon_cost"))
    weapon = recommendation.get("weapon") or recommendation.get("recommended_weapon")
    if isinstance(weapon, dict):
        return item_cost(weapon)
    return weapon_cost(weapon or recommendation.get("recommended_weapon_id"))


def _armor_cost(recommendation: dict[str, Any]) -> float:
    if recommendation.get("armor_is_free_exception") or recommendation.get("recommended_armor_is_free_exception"):
        return 0.0
    if "armor_cost" in recommendation:
        return _number(recommendation.get("armor_cost"))
    armor = recommendation.get("armor") or recommendation.get("recommended_armor")
    if isinstance(armor, dict):
        return item_cost(armor)
    return armor_cost(armor or recommendation.get("recommended_armor_id"))


def _ability_cost(recommendation: dict[str, Any]) -> float:
    if "ability_cost" in recommendation:
        return _number(recommendation.get("ability_cost"))
    abilities = recommendation.get("abilities") or recommendation.get("recommended_abilities") or []
    if abilities:
        return sum(_number(item.get("cost")) for item in abilities if isinstance(item, dict))
    return _number(recommendation.get("ability_budget") or recommendation.get("recommended_ability_budget"))


def player_recommendation_total_cost(recommendation: dict[str, Any]) -> dict[str, float]:
    weapon = _weapon_cost(recommendation)
    armor = _armor_cost(recommendation)
    ability = _ability_cost(recommendation)
    return {
        "weapon_cost": round(weapon, 2),
        "armor_cost": round(armor, 2),
        "ability_cost": round(ability, 2),
        "total_cost": round(weapon + armor + ability, 2),
    }


def validate_player_recommendation_budget(
    recommendation: dict,
    *,
    estimated_credits: float,
) -> tuple[bool, list[str]]:
    costs = player_recommendation_total_cost(recommendation)
    if costs["total_cost"] <= _number(estimated_credits) + 1e-6:
        return True, []
    return False, ["La compra recomendada supera los creditos estimados del jugador."]


def _weapon_name(weapon: Any) -> str:
    if isinstance(weapon, dict):
        return str(weapon.get("displayName") or weapon.get("name") or "").strip().lower()
    return str(weapon or "").strip().lower()


def _armor_level(armor: Any) -> str:
    if isinstance(armor, dict):
        return str(armor.get("armor_level") or "").strip().lower()
    return str(armor or "").strip().lower()


def validate_macro_composition(action: str, allocation: dict) -> dict:
    players = allocation.get("players") or []
    weapons = [player.get("weapon") for player in players]
    armors = [player.get("armor") for player in players]
    roles = [weapon_catalog_role(weapon) for weapon in weapons if weapon]
    names = [_weapon_name(weapon) for weapon in weapons if weapon]
    armor_levels = [_armor_level(armor) for armor in armors if armor]
    violations: list[str] = []
    warnings: list[str] = []

    if action == "FULL_RIFLES":
        sniper_count = sum(role == "sniper" for role in roles)
        rifle_count = sum(role == "rifle" for role in roles)
        if sniper_count:
            violations.append("FULL_RIFLES no puede asignar snipers.")
        if rifle_count < 4:
            violations.append("FULL_RIFLES debe asignar al menos 4 rifles.")
        if "light" in armor_levels:
            violations.append("FULL_RIFLES no acepta escudo ligero como armadura principal.")
    elif action == "FULL_OPERATOR":
        operator_count = sum(name == "operator" for name in names)
        rifle_count = sum(role == "rifle" for role in roles)
        if operator_count != 1:
            violations.append("FULL_OPERATOR debe asignar exactamente una Operator.")
        if rifle_count < 3:
            violations.append("FULL_OPERATOR debe asignar al menos 3 rifles reales adicionales si hay presupuesto.")
    elif action == "FORCE_RIFLE_LIGHT":
        if any(name in {"operator", "outlaw", "marshal"} for name in names):
            violations.append("FORCE_RIFLE_LIGHT no puede asignar snipers en slots de rifle.")

    expected_exact = {
        "FORCE_OUTLAW": ("outlaw", 2),
        "SEMI_MARSHAL": ("marshal", 2),
        "ECO_ONE_SHERIFF": ("sheriff", 1),
        "ECO_TWO_SHERIFFS": ("sheriff", 2),
        "ECO_SHERIFF": ("sheriff", 2),
        "ECO_SHERIFF_STACK": ("sheriff", 5),
    }.get(action)
    if expected_exact:
        name, expected = expected_exact
        actual = sum(item == name for item in names)
        if actual != expected:
            violations.append(f"{action} debe asignar exactamente {expected} {name}.")

    if action in {"FULL_RIFLES", "FULL_OPERATOR"} and "regen" in armor_levels:
        warnings.append("Regen Shield usado como downgrade de escudo pesado.")

    return {"valid": not violations, "violations": violations, "warnings": warnings}


def validate_team_plan_allocation(allocation: dict) -> dict:
    violations = list(allocation.get("violations") or [])
    warnings = list(allocation.get("warnings") or [])
    action = str(allocation.get("action") or "")
    if action:
        macro = validate_macro_composition(action, allocation)
        violations.extend(macro["violations"])
        warnings.extend(macro["warnings"])
    team_budget = _number(allocation.get("team_estimated_credits_before_buy"))
    team_total = _number(allocation.get("team_total_cost"))
    if team_budget and team_total > team_budget + 1e-6:
        violations.append(f"team: recommended cost {team_total:.0f} exceeds estimated credits {team_budget:.0f}")
    for player in allocation.get("players") or []:
        estimated = _number(player.get("estimated_credits"))
        valid, reasons = validate_player_recommendation_budget(player, estimated_credits=estimated)
        if not valid:
            total = player_recommendation_total_cost(player)["total_cost"]
            violations.append(
                f"{player.get('puuid')}: recommended cost {total:.0f} exceeds estimated credits {estimated:.0f}"
            )
            warnings.extend(reasons)
    return {"valid": not violations, "violations": violations, "warnings": warnings}


def conservative_player_recommendation(*, puuid: str, estimated_credits: float) -> dict[str, Any]:
    return {
        "puuid": puuid,
        "estimated_credits": _number(estimated_credits),
        "weapon": None,
        "armor": None,
        "abilities": [],
        "ability_budget": 0.0,
        "total_cost": 0.0,
        "expected_remaining": _number(estimated_credits),
        "slot": "classic_utility",
        "reasons": ["Fallback conservador: Classic y solo utilidad clave si cabe."],
    }
