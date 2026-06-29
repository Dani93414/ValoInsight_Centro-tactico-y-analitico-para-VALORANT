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
    explicit = plan.get("weapon_value")
    if explicit is not None:
        return _num(explicit)
    nested = (plan.get("weapon") or {}).get("weapon_value")
    if nested is not None:
        return _num(nested)
    return _num((plan.get("weapon") or {}).get("cost"))


def _weapon_purchase_cost(plan: dict) -> float:
    explicit = plan.get("weapon_purchase_cost")
    if explicit is not None:
        return _num(explicit)
    nested = (plan.get("weapon") or {}).get("purchase_cost")
    if nested is not None:
        return _num(nested)
    return _num(plan.get("weapon_cost")) or _weapon_value(plan)


def _weapon_text(plan: dict) -> str:
    weapon = plan.get("weapon") or {}
    return " ".join(str(weapon.get(key) or "") for key in ("displayName", "category", "shopCategory")).lower()


def _is_operator(plan: dict) -> bool:
    return "operator" in _weapon_text(plan)


def _is_sniper(plan: dict) -> bool:
    return any(name in _weapon_text(plan) for name in ("operator", "outlaw", "marshal", "sniper"))


def _is_useful_weapon(plan: dict) -> bool:
    return bool(plan.get("keep_weapon") or _weapon_value(plan) >= 1600)


def _strong_armor(plan: dict) -> bool:
    text = str((plan.get("armor") or {}).get("displayName") or "").lower()
    return "heavy" in text or "regen" in text


class BuyScorer:
    """Rules govern validity; an optional ML estimate only adjusts plan utility."""
    def score(self, players: list[dict], context: dict, ml_estimator: Callable[[dict], float] | None = None) -> dict:
        spend = sum(_num(p.get("self_cost")) for p in players)
        remaining = [_num(p.get("expected_remaining")) for p in players]
        weapon_value = sum(_weapon_value(p) for p in players)
        armor_value = sum(_num((p.get("armor") or {}).get("cost")) for p in players)
        utility_value = sum(_num(p.get("ability_cost")) for p in players)
        decisive_round = bool(context.get("is_match_point") or context.get("is_last_round_before_switch") or context.get("is_overtime"))
        reserve_target = 0.0 if decisive_round else _num(context.get("next_round_reserve", 3900))
        future_win_values = [min(9000, value + 3000) for value in remaining]
        loss_income = _num(context.get("loss_income", 1900))
        future_loss_values = [min(9000, value + loss_income) for value in remaining]
        synchronized = sum(value >= reserve_target for value in remaining) / max(1, len(remaining))
        risk = max(0.0, 1.0 - synchronized)
        keep_ratio = sum(bool(p.get("keep_weapon")) for p in players) / max(1, len(players))
        utility_types = {
            tactical
            for player in players
            for ability in player.get("abilities") or []
            for tactical in ability.get("tactical_types") or []
        }
        composition_value = 0.0
        if {"smoke", "vision_denial"} & utility_types: composition_value += .06
        if {"flash", "nearsight"} & utility_types: composition_value += .04
        if {"recon", "info", "reveal"} & utility_types: composition_value += .04
        if {"trap", "anchor", "stall"} & utility_types: composition_value += .03
        if {"entry", "space_creation"} & utility_types: composition_value += .03
        round_win = min(.94, .16 + weapon_value / 19000 + armor_value / 13000 + utility_value / 7500 + composition_value)
        ml_support = None
        warnings: list[str] = []
        if ml_estimator:
            try:
                ml_support = max(0.0, min(1.0, float(ml_estimator({"players": players, "context": context}))))
                round_win = round_win * .7 + ml_support * .3
            except Exception:
                warnings.append("ml_estimator_unavailable")
        penalties: list[str] = []
        penalty = 0.0
        operator_count = sum(_is_operator(p) for p in players)
        sniper_count = sum(_is_sniper(p) for p in players)
        useful_weapons = sum(_is_useful_weapon(p) for p in players)
        strong_armor = sum(_strong_armor(p) for p in players)
        full_buy = weapon_value >= 10500 or useful_weapons >= 4
        if operator_count > 1 and not context.get("allow_multi_operator"):
            penalty += .22 * (operator_count - 1); penalties.append("multiple_operators_without_exception")
        if sniper_count > 2:
            penalty += .10 * (sniper_count - 2); penalties.append("too_many_snipers")
        if full_buy and _num(context.get("team_controller_count")) > 0 and not ({"smoke", "vision_denial"} & utility_types):
            penalty += .16; penalties.append("full_buy_without_controller_smokes")
        if full_buy and useful_weapons < 4:
            penalty += .14 * (4 - useful_weapons); penalties.append("full_buy_players_without_useful_weapon")
        if full_buy and strong_armor < 3:
            penalty += .07 * (3 - strong_armor); penalties.append("full_buy_weak_armor")
        if decisive_round:
            # Saving has no strategic value at overtime, match point or the last half round.
            current_power = min(1.0, (weapon_value + armor_value + utility_value) / 19000)
            penalty += max(0.0, .75 - current_power) * .30
            if current_power < .75: penalties.append("decisive_round_underinvestment")
        score = round_win * .52 + synchronized * .14 + min(1, utility_value/1500) * .10 + min(1, weapon_value/14500) * .10 + composition_value - risk * .06 - penalty
        if context.get("is_bonus_candidate"):
            # A bonus is inventory preservation, not a fixed shield template.
            score += keep_ratio * .32 - min(1.0, spend / 6000.0) * .20
        return {
            "score": round(score, 5), "round_win_probability": round(round_win, 4),
            "match_win_probability": round(min(.98, max(.02, .5 + (_num(context.get("score_diff")) * .035) + (round_win-.5)*.22)), 4),
            "ml_support": ml_support, "future_if_win": sum(future_win_values),
            "future_if_loss": sum(future_loss_values), "synchronization": round(synchronized, 4),
            "players": [
                {"puuid": player.get("puuid"), "credits_after_buy": remaining[index],
                 "credits_if_win": future_win_values[index], "credits_if_loss": future_loss_values[index],
                 "can_full_buy_if_win": future_win_values[index] >= 3900,
                 "can_full_buy_if_loss": future_loss_values[index] >= 3900,
                 "economic_risk": round(max(0, 3900-future_loss_values[index])/3900, 4),
                 "drop_bought_for": player.get("buys_for"), "drop_received_from": player.get("bought_by")}
                for index, player in enumerate(players)
            ],
            "players_can_full_buy_if_win": sum(value >= 3900 for value in future_win_values),
            "players_can_full_buy_if_loss": sum(value >= 3900 for value in future_loss_values),
            "players_desynchronized_if_loss": sum(value < 3900 for value in future_loss_values),
            "economic_risk": round(risk, 4), "team_spend": spend,
            "weapon_value": weapon_value, "armor_value": armor_value,
            "utility_value": utility_value,
            "rule_penalty": round(penalty, 4), "warnings": warnings + penalties,
            "data_confidence": round(max(.2, min(1.0, _num(context.get("team_economy_reconciliation_quality_score", .6)))), 4),
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
        for candidate in candidates:
            candidate["plan_kind"] = self._summarize(candidate["players"], inventories, context)
        best = candidates[0]
        best["alternatives"] = candidates[1:alternatives+1]
        return best

    @staticmethod
    def _reduced_choices(plans: list[dict]) -> list[dict]:
        if not plans:
            return []
        ordered = sorted(plans, key=lambda p: _num(p.get("self_cost")))
        picks = [ordered[0], ordered[len(ordered)//2], ordered[-1]]
        max_utility = max(plans, key=lambda p: (_num(p.get("ability_cost")), _num(p.get("self_cost"))))
        picks.append(max_utility)
        non_operator = max((p for p in plans if not _is_operator(p)), key=lambda p: _weapon_value(p), default=None)
        if non_operator:
            picks.append(non_operator)
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
            cost = _weapon_purchase_cost(receiver)
            donor = next((p for p in donors if p["puuid"] != receiver["puuid"] and _num(p.get("expected_remaining")) >= cost), None)
            if not donor:
                continue
            receiver["weapon_cost"] = 0
            receiver["weapon_source"] = "dropped"
            receiver["weapon"] = {**(receiver.get("weapon") or {}), "source": "dropped"}
            receiver["bought_by"] = donor["puuid"]
            receiver["requires_weapon_drop"] = False
            donor["self_cost"] += cost
            donor["expected_remaining"] -= cost
            existing = donor.get("buys_for")
            donor["buys_for"] = ([existing] if isinstance(existing, str) else list(existing or [])) + [receiver["puuid"]]

    @staticmethod
    def validate(players: list[dict], inventories: list[PlayerInventoryState]) -> dict:
        credits = {inv.puuid: inv.credits_before_buy for inv in inventories}
        warnings: list[str] = []
        for player in players:
            puuid = player.get("puuid")
            source = player.get("weapon_source") or (player.get("weapon") or {}).get("source") or "none"
            if bool(player.get("keep_weapon")) != (source == "carried"):
                return {"valid": False, "warnings": [f"invalid_keep_weapon_source:{puuid}"]}
            if source == "carried" and (_num(player.get("weapon_cost")) or _num(player.get("weapon_purchase_cost"))):
                return {"valid": False, "warnings": [f"carried_weapon_has_purchase_cost:{puuid}"]}
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
                "self_cost": 0, "weapon_cost": 0, "weapon_purchase_cost": 0,
                "weapon_value": 0, "weapon_source": "none", "armor_cost": 0, "ability_cost": 0,
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
