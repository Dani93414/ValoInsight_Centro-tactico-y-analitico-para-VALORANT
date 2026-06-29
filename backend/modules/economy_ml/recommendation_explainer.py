from __future__ import annotations

from typing import Any

from .display_normalizer import normalize_purchase_for_display, normalize_warning_list


class RecommendationExplainer:
    def explain(self, *, round_number: int, team_id: str, side: str, score_before: Any,
                observed: dict[str, dict], inferred: dict[str, list[dict]], plan: dict,
                player_meta: dict[str, dict] | None = None,
                context: dict[str, Any] | None = None) -> dict:
        meta = player_meta or {}
        players = []
        public_inferred: dict[str, list[dict]] = {}
        for puuid, hypotheses in inferred.items():
            public_inferred[puuid] = []
            for hypothesis in hypotheses:
                payload = dict(hypothesis)
                raw = list(dict.fromkeys(payload.get("warnings") or []))
                payload["debug_warnings"] = raw
                payload["warnings"] = normalize_warning_list(raw)
                public_inferred[puuid].append(payload)
        for purchase in plan.get("players") or []:
            puuid = purchase["puuid"]
            hypotheses = public_inferred.get(puuid) or []
            best = hypotheses[0] if hypotheses else {"weapon_source": "unknown", "confidence": .2, "reasons": ["no_inference"]}
            obs = observed.get(puuid) or {}
            raw_warnings = list(dict.fromkeys(
                (purchase.get("warnings") or []) + (best.get("debug_warnings") or best.get("warnings") or []) +
                (obs.get("debug_warnings") or [])
            ))
            purchase["display"] = normalize_purchase_for_display(
                purchase, is_pistol_round=bool((context or {}).get("is_pistol_round")),
            )
            players.append({
                "puuid": puuid, "player_name": meta.get(puuid, {}).get("player_name"),
                "agent": meta.get(puuid, {}).get("agent"), "role": meta.get(puuid, {}).get("role"),
                "credits_before_buy": meta.get(puuid, {}).get("credits_before_buy"),
                "observed_weapon": obs.get("weapon"), "observed_armor": obs.get("armor"),
                "observed_weapon_display": obs.get("weapon_display"),
                "observed_armor_display": obs.get("armor_display"),
                "inferred_real_purchase": best, "recommended_purchase": purchase,
                "reason": self._reason(purchase, plan),
                "warnings": normalize_warning_list(raw_warnings),
                "debug_warnings": raw_warnings,
                "confidence": best.get("confidence"),
            })
        inference_confidence = min([p["confidence"] for p in players] or [.2])
        projection = plan.get("economy_projection") or {}
        data_confidence = float(projection.get("data_confidence") or .5)
        ml_factor = 1.0 if projection.get("ml_support") is not None else .82
        confidence = round(max(.1, min(1.0, inference_confidence * .65 + data_confidence * .35)) * ml_factor, 4)
        alternatives = plan.get("alternatives") or []
        for alternative in alternatives:
            for purchase in alternative.get("players") or []:
                purchase["display"] = normalize_purchase_for_display(
                    purchase, is_pistol_round=bool((context or {}).get("is_pistol_round")),
                )
        return {
            "round_number": round_number, "team_id": team_id, "side": side, "score_before": score_before,
            "real_team_buy_observed": observed, "inferred_team_buy": public_inferred,
            "recommended_team_buy": plan.get("plan_kind"), "team_plan_score": plan.get("team_plan_score"),
            "confidence": confidence, "players": players, "alternatives": alternatives,
            "economy_projection": projection,
            "warnings": normalize_warning_list(plan.get("warnings") or []),
            "debug_warnings": list(dict.fromkeys(plan.get("warnings") or [])),
        }

    @staticmethod
    def _reason(purchase: dict, plan: dict) -> str:
        if purchase.get("bought_by"):
            return "Recibe un drop de arma; conserva sus creditos para escudo, utilidad y economia futura."
        if purchase.get("buys_for"):
            return "Compra un arma para un companero sin transferir escudo ni habilidades."
        if purchase.get("keep_weapon"):
            return "Conserva el arma existente y limita la inversion."
        return f"Compra legal dentro del plan {plan.get('plan_kind') or 'de equipo'}."
