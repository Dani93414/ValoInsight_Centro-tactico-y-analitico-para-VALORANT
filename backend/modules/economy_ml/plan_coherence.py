from __future__ import annotations

from typing import Any


def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def evaluate_plan_coherence(plan: dict[str, Any], state: dict[str, Any] | None = None) -> dict[str, Any]:
    state = state or {}
    macro = str(plan.get("macro_case") or plan.get("team_buy_case") or "UNKNOWN")
    weapon_spend = _num(plan.get("estimated_weapon_spend") or plan.get("weapon_spend_estimate"))
    armor_spend = _num(plan.get("estimated_armor_spend") or plan.get("armor_spend_estimate"))
    regen_spend = _num(plan.get("estimated_regen_armor_spend"))
    ability_spend = plan.get("estimated_ability_spend", plan.get("ability_spend_estimate"))
    ability_unknown = bool(plan.get("ability_budget_unknown"))
    total = _num(plan.get("estimated_total_spend") or plan.get("total_team_spend"))
    remaining = _num(plan.get("expected_remaining") or plan.get("expected_remaining_after_buy"))
    warnings: list[str] = list(plan.get("warnings") or plan.get("coherence_warnings") or [])
    penalty = 0.0

    if macro == "ECO" and weapon_spend >= 6000:
        penalty += 0.35
        warnings.append("ECO con demasiada inversion en armas.")
    if macro == "FULLBUY" and weapon_spend < 12000:
        penalty += 0.25
        warnings.append("FULLBUY sin armas principales suficientes.")
    if macro == "FULLBUY" and armor_spend < 3000:
        penalty += 0.15
        warnings.append("FULLBUY sin escudos suficientes.")
    if macro == "FULLBUY" and regen_spend > 0:
        penalty += min(0.16, regen_spend / 6500)
        warnings.append("Regen Shield en FULLBUY se considera downgrade de escudo pesado.")
    if macro == "FULLBUY" and not ability_unknown and _num(ability_spend) < 1000:
        penalty += 0.12
        warnings.append("FULLBUY sin margen minimo de utilidad.")
    if macro in {"SEMIBUY", "STABILIZATION"} and remaining < 3500 and not state.get("is_match_point"):
        penalty += 0.18
        warnings.append("Compra parcial que deja poca economia futura.")
    if macro == "STABILIZATION" and total > _num(state.get("team_estimated_credits_before_buy")) * 0.65:
        penalty += 0.16
        warnings.append("STABILIZATION gasta demasiado para resetear economia.")
    if macro == "FORCE" and not (state.get("is_match_point") or state.get("is_last_round_before_switch") or state.get("is_overtime")):
        penalty += 0.1
        warnings.append("FORCE sin contexto claro de cierre.")
    if macro == "BONUS" and weapon_spend > 6000:
        penalty += 0.12
        warnings.append("BONUS actualiza demasiadas armas.")
    if armor_spend > 0 and weapon_spend < 1000 and macro not in {"ECO", "BONUS"}:
        penalty += 0.14
        warnings.append("Exceso de escudos sin armas minimas.")
    coherence = round(max(0.0, 1.0 - min(1.0, penalty)), 4)
    return {
        "coherence_score": coherence,
        "incoherence_penalty": round(min(1.0, penalty), 4),
        "warnings": list(dict.fromkeys(warnings)),
    }
