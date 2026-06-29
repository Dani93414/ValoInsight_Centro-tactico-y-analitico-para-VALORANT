from __future__ import annotations

from typing import Any

from .ability_catalog import agent_abilities, get_agent_ability_catalog


ROLE_CORE_TYPES = {
    "controller": ("smoke", "vision_denial"),
    "initiator": ("recon", "flash", "info"),
    "sentinel": ("trap", "stall", "anchor", "flank_control"),
    "duelist": ("entry", "mobility", "flash", "space_creation"),
}


def _number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


def _role_key(role: str | None, agent_payload: dict[str, Any] | None = None) -> str:
    role_text = _norm(role)
    if role_text in {"", "unknown", "desconocido"}:
        role_text = _norm((agent_payload or {}).get("role"))
    text = role_text
    if "controlador" in text:
        return "controller"
    if "iniciador" in text:
        return "initiator"
    if "centinela" in text:
        return "sentinel"
    if "duelista" in text:
        return "duelist"
    for key in ROLE_CORE_TYPES:
        if key in text:
            return key
    return "unknown"


def _context_budget_factor(context: str) -> float:
    normalized = _norm(context)
    if normalized in {"eco", "eco_classic"}:
        return 0.55
    if normalized == "pistol":
        return 0.85
    if normalized in {"match_point_or_overtime", "overtime", "last_round"}:
        return 1.25
    if normalized in {"fullbuy", "normal"}:
        return 1.0
    return 0.9


def _ability_priority(
    ability: dict[str, Any],
    *,
    role_key: str,
    side: str | None,
    context: str,
    team_needs: dict[str, Any] | None,
) -> tuple[float, str]:
    tactical_types = set(str(item) for item in ability.get("tactical_types") or [])
    core = set(ROLE_CORE_TYPES.get(role_key, ()))
    score = 0.35
    reason = "Utilidad situacional de bajo coste."
    if tactical_types & core:
        score += 0.35
        reason = "Habilidad clave por rol para ejecutar, defender o recuperar espacio."
    if _norm(side) == "attack" and tactical_types & {"smoke", "vision_denial", "flash", "recon", "entry"}:
        score += 0.12
    if _norm(side) == "defense" and tactical_types & {"smoke", "vision_denial", "trap", "stall", "recon"}:
        score += 0.12
    if _norm(context) in {"eco", "pistol"} and tactical_types & {"smoke", "vision_denial", "recon", "trap", "stall"}:
        score += 0.10
    if _norm(context) in {"match_point_or_overtime", "overtime", "last_round"}:
        score += 0.08
    needs = set(str(item) for item in (team_needs or {}).get("tactical_types", []) or [])
    if tactical_types & needs:
        score += 0.15
        reason = "Cubre una necesidad tactica declarada del equipo."
    if ability.get("is_signature") or ability.get("is_free_at_round_start"):
        score -= 0.08
    return min(1.0, score), reason


def _catalog(agent_name: str | None, agent_id: str | None) -> dict[str, Any] | None:
    return get_agent_ability_catalog(agent_id or "") or get_agent_ability_catalog(agent_name or "")


def estimate_minimum_key_utility_budget(
    agent_name: str | None = None,
    agent_id: str | None = None,
    role: str | None = None,
    side: str | None = None,
    context: str = "normal",
) -> float:
    payload = _catalog(agent_name, agent_id)
    role_key = _role_key(role, payload)
    core = set(ROLE_CORE_TYPES.get(role_key, ()))
    if not core:
        return 0.0
    costs = []
    for ability in (payload or {}).get("abilities") or agent_abilities(agent_id or agent_name):
        if ability.get("ability_kind") == "ultimate" or not ability.get("is_purchasable", True):
            continue
        if ability.get("is_free_at_round_start") and _number(ability.get("free_charges_at_round_start")) > 0:
            continue
        cost = ability.get("cost_credits")
        if cost is None:
            continue
        if set(ability.get("tactical_types") or []) & core:
            costs.append(_number(cost))
    if not costs:
        return 0.0
    base = sum(sorted(costs)[:2])
    return round(min(800.0, base * _context_budget_factor(context)), 2)


def recommend_ability_purchase(
    *,
    agent_name: str | None,
    agent_id: str | None,
    role: str | None,
    side: str | None,
    available_credits_after_loadout: float,
    context: str,
    team_needs: dict | None = None,
) -> dict:
    catalog = _catalog(agent_name, agent_id)
    warnings: list[str] = []
    if not catalog:
        return {
            "abilities": [],
            "total_cost": 0.0,
            "utility_value_score": 0.5,
            "warnings": ["Catalogo de habilidades no disponible para este agente."],
            "ability_cost_available": False,
            "ability_budget_unknown": True,
        }
    role_key = _role_key(role, catalog)
    candidates = []
    missing_cost = False
    for ability in catalog.get("abilities") or []:
        if ability.get("ability_kind") == "ultimate" or not ability.get("is_purchasable", True):
            continue
        free_charges = int(_number(ability.get("free_charges_at_round_start")))
        if (ability.get("is_free_at_round_start") and free_charges > 0
                and int(_number(ability.get("purchasable_charges"))) <= 0):
            continue
        cost = ability.get("cost_credits")
        if cost is None:
            missing_cost = True
            continue
        priority, reason = _ability_priority(
            ability,
            role_key=role_key,
            side=side,
            context=context,
            team_needs=team_needs,
        )
        candidates.append((priority, _number(cost), reason, ability))
    if missing_cost:
        warnings.append("Hay habilidades sin coste trazable; se excluyen del presupuesto recomendado.")
    budget = max(0.0, _number(available_credits_after_loadout))
    if _norm(context) == "eco":
        budget = min(budget, max(0.0, budget * 0.65))
    selected = []
    spent = 0.0
    for priority, cost, reason, ability in sorted(candidates, key=lambda item: (item[0], -item[1]), reverse=True):
        if priority < 0.45 or cost <= 0 or spent + cost > budget + 1e-6:
            continue
        selected.append({
            "name": ability.get("name"),
            "cost": cost,
            "tactical_types": ability.get("tactical_types") or ["unknown"],
            "priority": "core" if priority >= 0.7 else "situational",
            "reason": reason,
            "ability_cost_available": True,
        })
        spent += cost
        if len(selected) >= 3:
            break
    utility_value = 0.5 if not selected else min(1.0, 0.5 + len(selected) * 0.1 + min(0.2, spent / 1500))
    return {
        "abilities": selected,
        "total_cost": round(spent, 2),
        "utility_value_score": round(utility_value, 4),
        "warnings": warnings,
        "ability_cost_available": not missing_cost,
        "ability_budget_unknown": bool(missing_cost and not selected),
    }
