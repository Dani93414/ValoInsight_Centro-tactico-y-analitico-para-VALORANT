from __future__ import annotations

from typing import Any


class RecommendationExplainer:
    def explain(self, *, round_number: int, team_id: str, side: str, score_before: Any,
                observed: dict[str, dict], inferred: dict[str, list[dict]], plan: dict,
                player_meta: dict[str, dict] | None = None) -> dict:
        meta = player_meta or {}
        players = []
        for purchase in plan.get("players") or []:
            puuid = purchase["puuid"]
            hypotheses = inferred.get(puuid) or []
            best = hypotheses[0] if hypotheses else {"weapon_source": "unknown", "confidence": .2, "reasons": ["no_inference"]}
            obs = observed.get(puuid) or {}
            players.append({
                "puuid": puuid, "player_name": meta.get(puuid, {}).get("player_name"),
                "agent": meta.get(puuid, {}).get("agent"), "role": meta.get(puuid, {}).get("role"),
                "credits_before_buy": meta.get(puuid, {}).get("credits_before_buy"),
                "observed_weapon": obs.get("weapon"), "observed_armor": obs.get("armor"),
                "inferred_real_purchase": best, "recommended_purchase": purchase,
                "reason": self._reason(purchase, plan),
                "warnings": list(dict.fromkeys((purchase.get("warnings") or []) + (best.get("warnings") or []))),
                "confidence": best.get("confidence"),
            })
        confidence = min([p["confidence"] for p in players] or [.2])
        return {
            "round_number": round_number, "team_id": team_id, "side": side, "score_before": score_before,
            "real_team_buy_observed": observed, "inferred_team_buy": inferred,
            "recommended_team_buy": plan.get("plan_kind"), "team_plan_score": plan.get("team_plan_score"),
            "confidence": confidence, "players": players, "alternatives": plan.get("alternatives") or [],
            "economy_projection": plan.get("economy_projection") or {}, "warnings": plan.get("warnings") or [],
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
