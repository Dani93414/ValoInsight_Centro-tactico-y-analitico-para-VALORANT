from __future__ import annotations

from dataclasses import dataclass, field
from itertools import product
from typing import Any, Callable

from .legal_purchase import LegalPurchaseGenerator
from .inventory import PlayerInventoryState


def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _weapon_value(plan: dict) -> float:
    return _num((plan.get("weapon") or {}).get("cost"))


class BuyScorer:
    """Rules govern validity; an optional ML estimate only adjusts plan utility."""
    def score(self, players: list[dict], context: dict, ml_estimator: Callable[[dict], float] | None = None) -> dict:
        spend = sum(_num(p.get("self_cost")) for p in players)
        remaining = [_num(p.get("expected_remaining")) for p in players]
        weapon_value = sum(_weapon_value(p) for p in players)
        armor_value = sum(_num((p.get("armor") or {}).get("cost")) for p in players)
        utility_value = sum(_num(p.get("ability_cost")) for p in players)
        reserve_target = _num(context.get("next_round_reserve", 3900))
        future_win = sum(min(9000, value + 3000) for value in remaining)
        loss_income = _num(context.get("loss_income", 1900))
        future_loss = sum(min(9000, value + loss_income) for value in remaining)
        synchronized = sum(value >= reserve_target for value in remaining) / max(1, len(remaining))
        risk = max(0.0, 1.0 - synchronized)
        keep_ratio = sum(bool(p.get("keep_weapon")) for p in players) / max(1, len(players))
        round_win = min(.92, .18 + weapon_value / 18000 + armor_value / 12000 + utility_value / 7000)
        ml_support = None
        warnings: list[str] = []
        if ml_estimator:
            try:
                ml_support = max(0.0, min(1.0, float(ml_estimator({"players": players, "context": context}))))
                round_win = round_win * .7 + ml_support * .3
            except Exception:
                warnings.append("ml_estimator_unavailable")
        score = round_win * .52 + synchronized * .18 + min(1, utility_value/1500) * .12 + min(1, weapon_value/14500) * .10 - risk * .08
        if context.get("is_bonus_candidate"):
            # A bonus is inventory preservation, not a fixed shield template.
            score += keep_ratio * .32 - min(1.0, spend / 6000.0) * .20
        return {
            "score": round(score, 5), "round_win_probability": round(round_win, 4),
            "ml_support": ml_support, "future_if_win": future_win,
            "future_if_loss": future_loss, "synchronization": round(synchronized, 4),
            "economic_risk": round(risk, 4), "team_spend": spend, "warnings": warnings,
        }


@dataclass
class TeamBuySolver:
    generator: LegalPurchaseGenerator = field(default_factory=LegalPurchaseGenerator)
    scorer: BuyScorer = field(default_factory=BuyScorer)

    def solve(self, inventories: list[PlayerInventoryState], *, agents: dict[str, str] | None = None,
              context: dict | None = None, alternatives: int = 5,
              ml_estimator: Callable[[dict], float] | None = None) -> dict:
        agents, context = agents or {}, context or {}
        choices = [self._reduced_choices(self.generator.generate(inv, agent=agents.get(inv.puuid, ""))) for inv in inventories]
        candidates: list[dict] = []
        # Keep the search bounded while still constructing plans player-first.
        for combination in product(*choices):
            players = [dict(item) for item in combination]
            self._resolve_weapon_drops(players, inventories)
            validation = self.validate(players, inventories)
            if not validation["valid"]:
                continue
            score = self.scorer.score(players, context, ml_estimator)
            candidates.append({"players": players, "team_plan_score": score["score"], "economy_projection": score,
                               "valid": True, "warnings": validation["warnings"] + score["warnings"]})
        candidates.sort(key=lambda item: item["team_plan_score"], reverse=True)
        if not candidates:
            fallback = [self._zero_plan(inv) for inv in inventories]
            candidates = [{"players": fallback, "team_plan_score": 0.0, "economy_projection": {}, "valid": True,
                           "warnings": ["no_scored_plan_available"]}]
        best = candidates[0]
        best["alternatives"] = candidates[1:alternatives+1]
        best["plan_kind"] = self._summarize(best["players"], inventories, context)
        return best

    @staticmethod
    def _reduced_choices(plans: list[dict]) -> list[dict]:
        if not plans:
            return []
        ordered = sorted(plans, key=lambda p: _num(p.get("self_cost")))
        picks = [ordered[0], ordered[len(ordered)//2], ordered[-1]]
        carried = next((p for p in ordered if p.get("keep_weapon")), None)
        if carried:
            picks.append(carried)
        result: list[dict] = []
        for item in picks:
            if item not in result:
                result.append(item)
        return result

    @staticmethod
    def _resolve_weapon_drops(players: list[dict], inventories: list[PlayerInventoryState]) -> None:
        by_id = {inv.puuid: inv for inv in inventories}
        needy = [p for p in players if p.get("requires_weapon_drop") and not p.get("keep_weapon")]
        donors = sorted(players, key=lambda p: _num(p.get("expected_remaining")), reverse=True)
        for receiver in needy:
            cost = _weapon_value(receiver)
            donor = next((p for p in donors if p["puuid"] != receiver["puuid"] and _num(p.get("expected_remaining")) >= cost), None)
            if not donor:
                continue
            receiver["weapon_cost"] = 0
            receiver["bought_by"] = donor["puuid"]
            receiver["requires_weapon_drop"] = False
            donor["self_cost"] += cost
            donor["expected_remaining"] -= cost
            donor["buys_for"] = receiver["puuid"]

    @staticmethod
    def validate(players: list[dict], inventories: list[PlayerInventoryState]) -> dict:
        credits = {inv.puuid: inv.credits_before_buy for inv in inventories}
        warnings: list[str] = []
        for player in players:
            puuid = player.get("puuid")
            if _num(player.get("self_cost")) > credits.get(puuid, 0) + 1e-6 or _num(player.get("expected_remaining")) < -1e-6:
                return {"valid": False, "warnings": [f"over_budget:{puuid}"]}
            if player.get("requires_weapon_drop"):
                return {"valid": False, "warnings": [f"unfunded_weapon_drop:{puuid}"]}
            if player.get("bought_by") and (_num(player.get("armor_cost")) or _num(player.get("ability_cost"))):
                # Those costs remain charged to the receiver; only weapon_cost becomes zero.
                expected = _num(player.get("armor_cost")) + _num(player.get("ability_cost"))
                if abs(_num(player.get("self_cost")) - expected) > 1e-6:
                    return {"valid": False, "warnings": [f"non_weapon_drop:{puuid}"]}
        return {"valid": True, "warnings": warnings}

    @staticmethod
    def _zero_plan(inv: PlayerInventoryState) -> dict:
        return {"puuid": inv.puuid, "weapon": None, "armor": None, "abilities": [], "keep_weapon": False,
                "self_cost": 0, "weapon_cost": 0, "armor_cost": 0, "ability_cost": 0,
                "expected_remaining": inv.credits_before_buy, "bought_by": None, "buys_for": None, "warnings": []}

    @staticmethod
    def _summarize(players: list[dict], inventories: list[PlayerInventoryState], context: dict) -> str:
        if context.get("is_bonus_candidate") and any(p.get("keep_weapon") for p in players):
            return "BONUS_KEEP_INVENTORY"
        spend = sum(_num(p.get("self_cost")) for p in players)
        weapons = sum(_weapon_value(p) >= 2700 or p.get("keep_weapon") for p in players)
        if weapons >= 4:
            return "FULL_BUY"
        if spend <= 1500:
            return "ECO"
        return "MIXED_OR_FORCE"
