from __future__ import annotations

from typing import Any

import pandas as pd

from .action_profiles import minimum_action_credits, simulate_action_features
from .buy_classifier import BUY_ACTIONS
from .config import MIN_PROPENSITY
from .model_registry import load_model_candidates
from .schemas import MODEL_FEATURES, PROPENSITY_FEATURES
from .team_plan import evaluate_team_plan_from_action

MIN_RECOMMENDATION_MARGIN = 0.04


def _availability(action: str, state: dict, bundle: dict) -> tuple[bool, str | None, int]:
    credits = float(state.get("team_estimated_credits_before_buy") or 0)
    minimum = minimum_action_credits(action)
    support = int(bundle.get("action_support", {}).get(action, 0))
    required_support = int(bundle.get("min_action_support", 25))
    if credits < minimum:
        return False, f"Créditos estimados insuficientes ({credits:.0f} < {minimum:.0f})", support
    if action == "BONUS_KEEP_WEAPONS" and not state.get("is_bonus_candidate"):
        return False, "No es una ronda bonus candidata", support
    required_full_buyers = {
        "FORCE_2_RIFLES": 2, "FULL_RIFLES": 4, "FULL_OPERATOR": 4,
    }.get(action, 0)
    if int(state.get("team_players_can_full_buy_estimate") or 0) < required_full_buyers:
        return False, "La distribución estimada de créditos no permite equipar al equipo", support
    if support < required_support:
        return False, f"Soporte histórico insuficiente ({support} < {required_support})", support
    propensity = bundle.get("propensity_pipeline")
    if propensity is not None:
        probabilities = propensity.predict_proba(pd.DataFrame([{key: state.get(key) for key in PROPENSITY_FEATURES}]))[0]
        classes = list(propensity.named_steps["model"].classes_)
        probability = float(probabilities[classes.index(action)]) if action in classes else 0.0
        if probability < MIN_PROPENSITY:
            return False, f"Acción fuera de soporte para este estado ({probability:.1%})", support
    return True, None, support


def _eco_sheriff_guardrail(action: str, state: dict, team_plan: dict) -> tuple[bool, str | None]:
    sheriff_actions = {
        "ECO_SHERIFF", "ECO_ONE_SHERIFF", "ECO_TWO_SHERIFFS", "ECO_SHERIFF_STACK",
    }
    if action not in sheriff_actions:
        return True, None
    if state.get("is_match_point") or state.get("is_last_round_before_switch") or state.get("is_overtime"):
        return True, None

    future = float(team_plan.get("future_economy_score") or 0)
    round_win = float(team_plan.get("predicted_round_win") or 0)
    credits = float(state.get("team_estimated_credits_before_buy") or 0)

    if action == "ECO_SHERIFF_STACK":
        return False, "Stack de Sheriffs bloqueado fuera de rondas limite"
    if credits < 7000 and action in {"ECO_TWO_SHERIFFS", "ECO_SHERIFF"}:
        return False, "Eco con varias Sheriffs bloqueada: creditos bajos y prioridad de ahorro"
    if future < 0.55 and round_win < 0.38 and action in {"ECO_TWO_SHERIFFS", "ECO_SHERIFF"}:
        return False, "Eco Sheriff bloqueada: bajo beneficio inmediato y mala economia futura"
    return True, None


def _predict_probability(bundle: dict, scenario: dict, model_key: str = "match_win_model") -> float | None:
    model_bundle = (bundle.get("models") or {}).get(model_key)
    if model_bundle is None:
        if model_key != "match_win_model":
            return None
        model_bundle = bundle
    raw = float(model_bundle["pipeline"].predict_proba(pd.DataFrame([scenario]))[0, 1])
    calibrator = model_bundle.get("calibrator")
    if calibrator is None:
        return raw
    return float(calibrator.predict_proba([[raw]])[0, 1])


def _utility_explanations(state: dict) -> list[str]:
    explanations: list[str] = []
    utility = float(state.get("team_total_utility_score") or 0)
    utility_diff = float(state.get("utility_score_diff") or 0)
    low_resilience = float(state.get("team_low_economy_resilience") or 0)
    weapon_dependency = float(state.get("team_weapon_dependency_score") or 0)
    if utility >= 0.68:
        explanations.append(
            "La composicion aliada tiene alta utilidad potencial pre-ronda; no se asume compra real de habilidades."
        )
    if utility_diff >= 0.12:
        explanations.append("La composicion aliada muestra ventaja de utilidad potencial frente al rival.")
    if low_resilience >= 0.68:
        explanations.append("El equipo conserva valor potencial incluso con economia baja por su perfil de utilidad.")
    if weapon_dependency >= 0.62:
        explanations.append("La composicion depende mas del impacto con arma, lo que puede favorecer compras mas fuertes.")
    return explanations


def _recommend_with_bundle(
    state: dict, actions: list[str], bundle: dict, scope: str
) -> dict[str, Any] | None:
    alternatives = []
    for action in actions:
        viable, reason, support = _availability(action, state, bundle)
        probability = None
        team_plan = None
        round_probability = None
        fullbuy_probability = None
        if viable:
            scenario = {feature: state.get(feature) for feature in MODEL_FEATURES}
            scenario.update(simulate_action_features(state, action))
            scenario["buy_action"] = action
            probability = _predict_probability(bundle, scenario, "match_win_model")
            round_probability = _predict_probability(bundle, scenario, "round_win_model")
            fullbuy_probability = _predict_probability(bundle, scenario, "fullbuy_next_round_model")
            team_plan = evaluate_team_plan_from_action(state, action, probability)
            if round_probability is not None:
                team_plan["predicted_round_win"] = round_probability
            if fullbuy_probability is not None:
                team_plan["next_round_fullbuy_probability"] = fullbuy_probability
                team_plan["future_economy_score"] = fullbuy_probability
            from .plan_evaluator import evaluate_plan_value
            team_plan.update(evaluate_plan_value(team_plan, state))
            viable, guardrail_reason = _eco_sheriff_guardrail(action, state, team_plan)
            if not viable:
                reason = guardrail_reason
        alternatives.append({
            "action": action, "estimated_match_win_probability": probability,
            "estimated_round_win_probability": round_probability,
            "estimated_fullbuy_next_round_probability": fullbuy_probability,
            "is_available": viable, "reason_if_unavailable": reason, "historical_support": support,
            "team_plan": team_plan,
        })
    viable = [item for item in alternatives if item["is_available"]]
    if not viable:
        return None
    best = max(viable, key=lambda item: item["team_plan"]["team_plan_value"])
    ordered = sorted(viable, key=lambda item: item["team_plan"]["team_plan_value"], reverse=True)
    margin = (
        ordered[0]["team_plan"]["team_plan_value"] - ordered[1]["team_plan"]["team_plan_value"]
        if len(ordered) > 1 else 0.0
    )
    support_factor = min(1.0, best["historical_support"] / 200)
    confidence = min(1.0, margin * 4) * support_factor
    if margin < MIN_RECOMMENDATION_MARGIN:
        strength = "low"
        low_confidence_reason = "Margen insuficiente entre alternativas"
    elif confidence >= 0.6:
        strength = "high"
        low_confidence_reason = None
    else:
        strength = "medium"
        low_confidence_reason = None
    return {
        "available": True, "recommended_action": best["action"], "model_scope": scope,
        "confidence": float(confidence), "confidence_kind": "support_adjusted_margin",
        "recommendation_margin": float(margin),
        "support_factor": float(support_factor),
        "recommendation_strength": strength,
        "low_confidence_reason": low_confidence_reason,
        "estimated_match_win_probability": best["estimated_match_win_probability"],
        "team_plan": best["team_plan"],
        "alternatives": alternatives,
        "explanation": [
            f"Recomendación observacional calibrada con modelo {scope}; no constituye una garantía causal ni una acción óptima demostrada.",
            f"La acción recomendada tiene {best['historical_support']} observaciones de soporte en entrenamiento.",
            "Cada alternativa se evaluo como plan de equipo: armas, escudos, utilidad potencial, ahorro y riesgo futuro.",
            "La compra de habilidades se modela como inversion potencial; no se afirma que esas habilidades se compraran historicamente.",
            "La eleccion final usa team_plan_value, no solo la probabilidad estimada de ganar partida.",
            *_utility_explanations(state),
        ],
        "limitations": [
            "Modelo observacional: no prueba causalidad.",
            "Compra historica de habilidades no observable salvo dato explicito verificable.",
        ],
    }


def recommend_economy_action(state: dict, available_actions: list[str] | None = None) -> dict[str, Any]:
    candidates = load_model_candidates(state.get("rank_name"), state.get("rank_group"))
    if not candidates:
        return {"available": False, "reason": "No hay modelo compatible entrenado todavía"}
    actions = available_actions or [action for action in BUY_ACTIONS if action != "UNKNOWN"]
    for bundle, scope in candidates:
        recommendation = _recommend_with_bundle(state, actions, bundle, scope)
        if recommendation:
            return recommendation
    return {
        "available": False,
        "reason": "No hay acciones con economía y soporte histórico suficientes en ningún scope",
    }
