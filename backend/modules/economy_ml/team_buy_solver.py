from __future__ import annotations

from dataclasses import dataclass, field
from itertools import product
from typing import Any, Callable

from .legal_purchase import LegalPurchaseGenerator
from .inventory import PlayerInventoryState
from .contextual_scorer import apply_contextual_adjustments
from .round_win_model import RoundWinLoadoutModel
from .buy_classifier import classify_team_buy_action


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


def _weapon_name(plan: dict) -> str:
    return str((plan.get("weapon") or {}).get("displayName") or "").strip().lower()


def _armor_value(plan: dict) -> float:
    effective = plan.get("armor_effective_value")
    if effective is not None:
        return _num(effective)
    nested_effective = (plan.get("armor") or {}).get("armor_effective_value")
    if nested_effective is not None:
        return _num(nested_effective)
    explicit = plan.get("armor_value")
    if explicit is not None:
        return _num(explicit)
    nested = (plan.get("armor") or {}).get("armor_value")
    if nested is not None:
        return _num(nested)
    return _num((plan.get("armor") or {}).get("cost"))


def _is_operator(plan: dict) -> bool:
    return "operator" in _weapon_text(plan)


def _is_sniper(plan: dict) -> bool:
    return any(name in _weapon_text(plan) for name in ("operator", "outlaw", "marshal", "sniper"))


def _is_useful_weapon(plan: dict) -> bool:
    return bool(plan.get("keep_weapon") or _weapon_value(plan) >= 1600)


def _strong_armor(plan: dict) -> bool:
    text = str((plan.get("armor") or {}).get("displayName") or "").lower()
    return "heavy" in text or "regen" in text


def _action_family(action: str | None) -> str:
    value = str(action or "").upper()
    if value.startswith("ECO_"):
        return "eco"
    if value.startswith("FULL_"):
        return "full"
    if value.startswith("FORCE_"):
        return "force"
    if value.startswith("SEMI_") or value == "MIXED_LOW_BUY":
        return "semi"
    if value.startswith("BONUS_"):
        return "bonus"
    return "unknown"


def _candidate_action(players: list[dict], context: dict) -> str:
    economies = [{
        "weapon": (player.get("weapon") or {}).get("displayName"),
        "armor": (player.get("armor") or {}).get("displayName"),
        "loadoutValue": _weapon_value(player) + _armor_value(player) + _num(player.get("ability_cost")),
        "spent": _num(player.get("self_cost")),
    } for player in players]
    return classify_team_buy_action(economies, {"won": bool(context.get("previous_round_won"))})


class BuyScorer:
    """Rules govern validity; an optional ML estimate only adjusts plan utility."""
    def score(self, players: list[dict], context: dict, ml_estimator: Callable[[dict], float] | None = None) -> dict:
        spend = sum(_num(p.get("self_cost")) for p in players)
        remaining = [_num(p.get("expected_remaining")) for p in players]
        weapon_value = sum(_weapon_value(p) for p in players)
        armor_value = sum(_armor_value(p) for p in players)
        utility_value = sum(_num(p.get("ability_cost")) for p in players)
        team_score = int(_num(context.get("team_score_before")))
        enemy_score = int(_num(context.get("enemy_score_before")))
        elimination = enemy_score >= 12 and team_score < 12
        closing = team_score >= 12 and enemy_score < 12
        decisive_round = bool(elimination or context.get("is_last_round_before_switch") or context.get("is_overtime"))
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
        macro_guidance = context.get("macro_model_guidance") or {}
        candidate_action = _candidate_action(players, context)
        recommended_action = str(macro_guidance.get("recommended_action") or "")
        macro_confidence = max(0.0, min(1.0, _num(macro_guidance.get("confidence"))))
        macro_adjustment = 0.0
        if macro_guidance.get("available") and recommended_action:
            if candidate_action == recommended_action:
                macro_adjustment = .12 * macro_confidence
            elif _action_family(candidate_action) == _action_family(recommended_action):
                macro_adjustment = .06 * macro_confidence
            elif _action_family(candidate_action) != "unknown":
                macro_adjustment = -.06 * macro_confidence
        operator_count = sum(_is_operator(p) for p in players)
        sniper_count = sum(_is_sniper(p) for p in players)
        useful_weapons = sum(_is_useful_weapon(p) for p in players)
        strong_armor = sum(_strong_armor(p) for p in players)
        can_full_buy = sum(_num(inv_credit) >= 3900 for inv_credit in (
            context.get("team_player_credit_estimates") or {}
        ).values())
        if not can_full_buy:
            can_full_buy = int(_num(context.get("team_can_full_buy_count")))
        bonus_candidate = bool(context.get("is_bonus_candidate"))
        pistol = bool(context.get("is_pistol_round"))
        enemy_buy = ((context.get("advanced_context") or {}).get("enemy_economy") or {}).get("enemy_buy_recommendation")
        average_remaining = sum(remaining) / max(1, len(remaining))
        full_buy = weapon_value >= 10500 or useful_weapons >= 4
        post_pistol = bool(context.get("is_post_pistol_conversion") or context.get("is_second_round") or _num(context.get("round_number")) in {2, 14})
        anti_eco = bool(context.get("is_anti_eco"))
        last_round = bool(context.get("is_last_round_before_switch") or context.get("is_match_point"))
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
        expensive_unarmored = [p for p in players if _weapon_value(p) >= 2400 and _armor_value(p) <= 0 and not p.get("keep_weapon")]
        rifles_underarmored = [p for p in players if _weapon_value(p) >= 2900 and _armor_value(p) < 400 and not p.get("keep_weapon")]
        heavy_unarmored = [p for p in players if _weapon_name(p) in {"odin", "operator"} and _armor_value(p) <= 0]
        if expensive_unarmored:
            penalty += .18 * len(expensive_unarmored); penalties.append("weapon_without_armor_penalty")
        if rifles_underarmored:
            penalty += .10 * len(rifles_underarmored); penalties.append("underarmor_penalty")
        if heavy_unarmored:
            penalty += .28 * len(heavy_unarmored); penalties.append("operator_without_armor_penalty")
        if post_pistol or anti_eco:
            early_heavy = [p for p in players if _weapon_name(p) in {"odin", "operator"}]
            if early_heavy and not context.get("allow_early_heavy_weapon"):
                penalty += .35 * len(early_heavy); penalties.append("heavy_weapon_early_penalty")
            overbought = [p for p in players if _weapon_value(p) >= 2400 and _num(p.get("expected_remaining")) < 400]
            if overbought:
                penalty += .16 * len(overbought); penalties.append("post_pistol_overbuy_penalty")
        if context.get("is_pistol_round"):
            full_utility = sum(_num(p.get("ability_cost")) > 500 for p in players)
            all_utility = bool(players) and all(_num(p.get("ability_cost")) >= 400 and _weapon_value(p) <= 0 and _armor_value(p) <= 0 for p in players)
            if full_utility:
                penalty += .12 * full_utility; penalties.append("pistol_full_utility_penalty")
            if all_utility:
                penalty += .25; penalties.append("pistol_team_composition_penalty")
        if context.get("is_bonus_candidate"):
            upgrades = sum(not p.get("keep_weapon") and _weapon_value(p) >= 2400 for p in players)
            if upgrades > 2:
                penalty += .18 * (upgrades - 2); penalties.append("bonus_upgrade_penalty")
        if not pistol and not bonus_candidate and can_full_buy >= 4:
            if useful_weapons < 4:
                penalty += .20 + .08 * (4 - useful_weapons); penalties.append("team_full_buy_available_but_half_buy_penalty")
            if strong_armor < 3:
                penalty += .12; penalties.append("high_credit_weak_armor_penalty")
        if not pistol and not bonus_candidate and enemy_buy == "ENEMY_FULL_BUY" and useful_weapons < 4:
            penalty += .16; penalties.append("enemy_full_buy_underinvestment_penalty")
        if not pistol and not bonus_candidate and average_remaining > 5000 and useful_weapons < 4:
            penalty += .18; penalties.append("excessive_saving_penalty")
        heavy = [p for p in players if _weapon_name(p) in {"odin", "operator"}]
        early_non_decisive = int(_num(context.get("round_number"))) <= 4 and not (decisive_round or closing)
        if heavy and early_non_decisive:
            penalty += .20 * len(heavy); penalties.append("early_heavy_weapon_context_penalty")
        if heavy and enemy_buy in {"ENEMY_ECO", "ENEMY_HALF_BUY", "ENEMY_PISTOL"}:
            penalty += .18 * len(heavy); penalties.append("heavy_weapon_enemy_low_buy_penalty")
        if not last_round:
            stranded = sum(0 < value < 400 for value in remaining)
            if stranded:
                penalty += .05 * stranded; penalties.append("overinvestment_penalty")
        if decisive_round:
            # Saving has no strategic value at overtime, match point or the last half round.
            current_power = min(1.0, (weapon_value + armor_value + utility_value) / 19000)
            penalty += max(0.0, .75 - current_power) * .30
            if current_power < .75: penalties.append("decisive_round_underinvestment")
        round_power = round_win
        future_economy = sum(min(1.0, value / max(1.0, reserve_target or 3900)) for value in remaining) / max(1, len(remaining))
        armor_quality = min(1.0, armor_value / max(1, len(players) * 1000))
        raw_value = round_power * .48 + future_economy * .14 + synchronized * .12 + min(1, utility_value/1500) * .08 + armor_quality * .08 + composition_value + macro_adjustment - risk * .06 - penalty
        if context.get("is_bonus_candidate"):
            # A bonus is inventory preservation, not a fixed shield template.
            raw_value += keep_ratio * .32 - min(1.0, spend / 6000.0) * .20
        score = max(0.0, min(1.0, raw_value))
        return {
            "score": round(score, 5), "team_plan_score": round(score, 5),
            "team_plan_value": round(raw_value, 5), "round_win_probability": round(round_win, 4),
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
            "macro_model_available": bool(macro_guidance.get("available")),
            "macro_model_action": recommended_action or None,
            "macro_model_candidate_action": candidate_action,
            "macro_model_scope": macro_guidance.get("model_scope"),
            "macro_model_confidence": round(macro_confidence, 4) if macro_guidance.get("available") else None,
            "macro_model_adjustment": round(macro_adjustment, 5),
            "rule_penalty": round(penalty, 4), "warnings": warnings + penalties,
            "debug_warnings": warnings + penalties,
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
        round_win_model = RoundWinLoadoutModel() if context.get("advanced_context") else None
        choices = [self._reduced_choices(self.generator.generate(
            inv, agent=agents.get(inv.puuid, ""), context=context, ability_combination_limit=12,
        )) for inv in inventories]
        candidates: list[dict] = []
        # Keep the search bounded while still constructing plans player-first.
        for combination in product(*choices):
            players = [dict(item) for item in combination]
            self._resolve_weapon_drops(players, inventories, context)
            validation = self.validate(players, inventories)
            if not validation["valid"]:
                continue
            score = self.scorer.score(players, context, ml_estimator)
            if context.get("advanced_context"):
                score = apply_contextual_adjustments(score, players, context, round_win_model)
            candidates.append({"players": players, "team_plan_score": score["team_plan_score"],
                               "team_plan_value": score["team_plan_value"], "economy_projection": score,
                               "valid": True, "warnings": validation["warnings"] + score["warnings"]})
        # The raw value preserves ranking detail; the capped score is an UI metric.
        candidates.sort(key=lambda item: item["team_plan_value"], reverse=True)
        if not candidates:
            fallback = [self._zero_plan(inv) for inv in inventories]
            candidates = [{"players": fallback, "team_plan_score": 0.0, "team_plan_value": 0.0, "economy_projection": {}, "valid": True,
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
        picks = [ordered[0]]
        max_utility = max(plans, key=lambda p: (_num(p.get("ability_cost")), _num(p.get("self_cost"))))
        carried_loadout = max((p for p in plans if p.get("keep_weapon") or p.get("keep_armor")),
                              key=lambda p: (_weapon_value(p) + _armor_value(p), -_num(p.get("self_cost"))), default=None)
        if carried_loadout:
            picks.append(carried_loadout)
        protected_weapon = max((p for p in plans if _weapon_value(p) >= 1600 and _armor_value(p) >= 400),
                               key=lambda p: (_weapon_value(p) + _armor_value(p), -_num(p.get("self_cost"))), default=None)
        if protected_weapon:
            picks.append(protected_weapon)
        picks.extend([max_utility, ordered[len(ordered)//2], ordered[-1]])
        result: list[dict] = []
        for item in picks:
            if item not in result:
                result.append(item)
        # At most 3^5 team combinations. Preserve meaningful economic anchors
        # instead of sampling thousands of near-duplicate item permutations.
        return result[:3]

    @staticmethod
    def _resolve_weapon_drops(players: list[dict], inventories: list[PlayerInventoryState],
                              context: dict | None = None) -> None:
        by_id = {inv.puuid: inv for inv in inventories}
        enemy_buy = ((((context or {}).get("advanced_context") or {}).get("enemy_economy") or {})
                     .get("enemy_buy_recommendation"))
        needy = [p for p in players if p.get("requires_weapon_drop") and not p.get("keep_weapon")]
        donors = sorted(players, key=lambda p: _num(p.get("expected_remaining")), reverse=True)
        for receiver in needy:
            cost = _weapon_purchase_cost(receiver)
            receiver_state = by_id.get(str(receiver.get("puuid")))
            if cost < 1600 or (receiver_state and receiver_state.credits_before_buy >= cost):
                continue
            donor = next((p for p in donors
                          if p["puuid"] != receiver["puuid"]
                          and not p.get("buys_for")
                          and _num(p.get("expected_remaining")) - cost >= 400
                          and _is_useful_weapon(p)
                          and (enemy_buy != "ENEMY_FULL_BUY" or _armor_value(p) >= 400)), None)
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
        inventory_by_id = {inv.puuid: inv for inv in inventories}
        warnings: list[str] = []
        for player in players:
            puuid = player.get("puuid")
            inventory = inventory_by_id.get(puuid)
            if inventory and inventory.weapon_before_buy and not player.get("weapon"):
                return {"valid": False, "warnings": [f"invalid_no_buy_discards_weapon:{puuid}"]}
            if inventory and inventory.armor_before_buy and inventory.armor_before_buy != "Sin escudo" and not player.get("armor"):
                return {"valid": False, "warnings": [f"invalid_no_buy_discards_armor:{puuid}"]}
            source = player.get("weapon_source") or (player.get("weapon") or {}).get("source") or "none"
            if bool(player.get("keep_weapon")) != (source == "carried"):
                return {"valid": False, "warnings": [f"invalid_keep_weapon_source:{puuid}"]}
            if source == "carried" and (_num(player.get("weapon_cost")) or _num(player.get("weapon_purchase_cost"))):
                return {"valid": False, "warnings": [f"carried_weapon_has_purchase_cost:{puuid}"]}
            armor_source = player.get("armor_source") or (player.get("armor") or {}).get("source") or "none"
            if bool(player.get("keep_armor")) != (armor_source == "carried"):
                return {"valid": False, "warnings": [f"invalid_keep_armor_source:{puuid}"]}
            if armor_source == "carried" and (_num(player.get("armor_cost")) or _num(player.get("armor_purchase_cost"))):
                return {"valid": False, "warnings": [f"carried_armor_has_purchase_cost:{puuid}"]}
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
        if inv.weapon_before_buy or (inv.armor_before_buy and inv.armor_before_buy != "Sin escudo"):
            generated = LegalPurchaseGenerator().generate(inv, limit=1)
            if generated:
                return generated[0]
        return {"puuid": inv.puuid, "weapon": None, "armor": None, "abilities": [], "keep_weapon": False,
                "self_cost": 0, "weapon_cost": 0, "weapon_purchase_cost": 0,
                "weapon_value": 0, "weapon_source": "none", "armor_cost": 0,
                "armor_purchase_cost": 0, "armor_value": 0, "armor_source": "none", "keep_armor": False,
                "armor_effective_value": 0, "armor_full_value": 0, "armor_durability_ratio": None,
                "ability_cost": 0,
                "expected_remaining": inv.credits_before_buy, "bought_by": None, "buys_for": None, "warnings": []}

    @staticmethod
    def _summarize(players: list[dict], inventories: list[PlayerInventoryState], context: dict) -> str:
        spend = sum(_num(p.get("self_cost")) for p in players)
        round_number = int(_num(context.get("round_number")))
        if context.get("is_overtime") or round_number >= 25:
            return "OVERTIME_BUY"
        if context.get("is_last_round_before_switch") or round_number in {12, 24}:
            return "LAST_HALF_ROUND_BUY"
        team_score = int(_num(context.get("team_score_before")))
        enemy_score = int(_num(context.get("enemy_score_before")))
        if enemy_score >= 12 and team_score < 12:
            return "ELIMINATION_BUY"
        if team_score >= 12 and enemy_score < 12:
            return "CLOSING_BUY"
        if context.get("is_pistol_round"):
            names = " ".join(_weapon_text(player) for player in players)
            utility = sum(_num(player.get("ability_cost")) for player in players)
            armor = sum(_num(player.get("armor_cost")) for player in players)
            if any(name in names for name in ("ghost", "sheriff", "frenzy", "shorty")):
                return "PISTOL_SIDEARM"
            if utility > 0:
                return "PISTOL_UTILITY"
            if armor > 0:
                return "PISTOL_ARMOR"
            return "PISTOL_DEFAULT"
        kept = sum(bool(p.get("keep_weapon")) for p in players)
        upgrades = sum(not p.get("keep_weapon") and _weapon_value(p) >= 2400 for p in players)
        if context.get("is_bonus_candidate") and kept >= max(1, len(players) // 2):
            return "BONUS_UPGRADE" if 1 <= upgrades <= 2 else "BONUS_KEEP_INVENTORY"
        post_pistol = bool(context.get("is_post_pistol_conversion") or context.get("is_second_round") or round_number in {2, 14})
        if post_pistol and (context.get("won_pistol") or context.get("previous_round_won") or context.get("team_win_streak", 0)):
            return "ANTI_ECO" if context.get("is_anti_eco") else "POST_PISTOL_CONVERSION"
        weapons = sum(_weapon_value(p) >= 2400 or p.get("keep_weapon") for p in players)
        armored = sum(_armor_value(p) >= 400 for p in players)
        if weapons >= 4 and armored >= 3:
            return "FULL_BUY"
        total_credits = sum(inv.credits_before_buy for inv in inventories)
        remaining = sum(_num(p.get("expected_remaining")) for p in players)
        full_buy_capable = sum(inv.credits_before_buy >= 3900 or bool(inv.weapon_before_buy) for inv in inventories)
        if full_buy_capable >= 4 and (weapons < 4 or armored < 3):
            return "UNDERINVESTED_BUY" if weapons >= 3 else "BROKEN_BUY"
        if spend <= 1500:
            return "ECO"
        if spend <= max(4000, total_credits * .45) and remaining >= 7000:
            return "HALF_BUY"
        synchronized = max([_num(p.get("expected_remaining")) for p in players] or [0]) - min([_num(p.get("expected_remaining")) for p in players] or [0])
        if synchronized > 3000 or (weapons < 3 and spend > 7000):
            return "BROKEN_BUY"
        return "FORCE_BUY"
