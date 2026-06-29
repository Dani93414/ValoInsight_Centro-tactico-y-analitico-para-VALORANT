from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from .content_catalog import find_weapon
from .inventory import PlayerInventoryState


def _cost(weapon: Any) -> float | None:
    payload = find_weapon(weapon)
    value = (payload or {}).get("cost")
    return float(value) if value is not None else None


@dataclass
class PurchaseHypothesis:
    weapon_source: str
    confidence: float
    estimated_self_spend: float | None
    reasons: list[str] = field(default_factory=list)
    armor_source: str = "unknown"
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class PurchaseInferenceEngine:
    def infer(self, state: PlayerInventoryState, *, observed_spent: float | None = None) -> list[dict[str, Any]]:
        weapon = state.weapon_after_buy
        before = state.weapon_before_buy
        cost = _cost(weapon)
        spent = None if observed_spent is None else max(0.0, float(observed_spent))
        hypotheses: list[PurchaseHypothesis] = []
        if before and before == weapon and state.survived_previous_round:
            hypotheses.append(PurchaseHypothesis("carried", .94, 0, ["same_weapon_after_survival"]))
        elif state.died_previous_round and weapon:
            if cost is not None and spent is not None and spent + 100 >= cost:
                hypotheses.append(PurchaseHypothesis("bought_self", .78, cost, ["weapon_lost_on_death", "spend_supports_purchase"]))
            else:
                hypotheses.extend([
                    PurchaseHypothesis("bought_by_teammate", .58, 0, ["weapon_lost_on_death", "insufficient_observed_spend"]),
                    PurchaseHypothesis("picked_up", .24, 0, ["possible_pickup_not_provable"]),
                ])
        elif weapon and weapon != before:
            if cost is not None and spent is not None and spent + 100 < cost:
                hypotheses.extend([
                    PurchaseHypothesis("picked_up", .52, 0, ["weapon_upgrade_without_sufficient_spend"]),
                    PurchaseHypothesis("bought_by_teammate", .42, 0, ["drop_also_explains_credit_gap"]),
                ])
            else:
                hypotheses.append(PurchaseHypothesis("bought_self", .68, cost, ["new_weapon_and_spend_is_compatible"]))
        else:
            hypotheses.append(PurchaseHypothesis("unknown", .25, None, ["insufficient_inventory_evidence"], warnings=["low_confidence"]))
        for item in hypotheses:
            if state.armor_before_buy and state.armor_before_buy == state.armor_after_buy:
                item.armor_source = "carried"
            elif state.armor_after_buy:
                item.armor_source = "bought_self"
        return [item.to_dict() for item in sorted(hypotheses, key=lambda h: h.confidence, reverse=True)]
