from __future__ import annotations

from typing import Any

import pandas as pd

from .action_profiles import minimum_action_credits, simulate_action_features
from .buy_classifier import BUY_ACTIONS
from .model_registry import load_model_candidates
from .schemas import MODEL_FEATURES, PROPENSITY_FEATURES

MIN_PROPENSITY = 0.03


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


def _predict_probability(bundle: dict, scenario: dict) -> float:
    raw = float(bundle["pipeline"].predict_proba(pd.DataFrame([scenario]))[0, 1])
    calibrator = bundle.get("calibrator")
    if calibrator is None:
        return raw
    return float(calibrator.predict_proba([[raw]])[0, 1])


def _recommend_with_bundle(
    state: dict, actions: list[str], bundle: dict, scope: str
) -> dict[str, Any] | None:
    alternatives = []
    for action in actions:
        viable, reason, support = _availability(action, state, bundle)
        probability = None
        if viable:
            scenario = {feature: state.get(feature) for feature in MODEL_FEATURES}
            scenario.update(simulate_action_features(state, action))
            scenario["buy_action"] = action
            probability = _predict_probability(bundle, scenario)
        alternatives.append({
            "action": action, "estimated_match_win_probability": probability,
            "is_available": viable, "reason_if_unavailable": reason, "historical_support": support,
        })
    viable = [item for item in alternatives if item["is_available"]]
    if not viable:
        return None
    best = max(viable, key=lambda item: item["estimated_match_win_probability"])
    ordered = sorted(viable, key=lambda item: item["estimated_match_win_probability"], reverse=True)
    margin = (
        ordered[0]["estimated_match_win_probability"] - ordered[1]["estimated_match_win_probability"]
        if len(ordered) > 1 else 0.0
    )
    support_factor = min(1.0, best["historical_support"] / 200)
    confidence = min(1.0, margin * 4) * support_factor
    return {
        "available": True, "recommended_action": best["action"], "model_scope": scope,
        "confidence": float(confidence), "confidence_kind": "support_adjusted_margin",
        "estimated_match_win_probability": best["estimated_match_win_probability"],
        "alternatives": alternatives,
        "explanation": [
            f"Recomendación observacional calibrada con modelo {scope}; no constituye una garantía causal ni una acción óptima demostrada.",
            f"La acción recomendada tiene {best['historical_support']} observaciones de soporte en entrenamiento.",
            "Cada alternativa se evaluó con un perfil de compra contrafactual coherente.",
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
