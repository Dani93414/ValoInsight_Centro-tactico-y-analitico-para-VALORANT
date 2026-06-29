from __future__ import annotations

from dataclasses import asdict, dataclass, field
from itertools import product
from typing import Any

from .ability_catalog import agent_abilities
from .content_catalog import find_gear, find_weapon, load_gear_catalog, load_weapon_catalog
from .inventory import PlayerInventoryState


def _price(item: dict | None) -> float:
    value = (item or {}).get("cost")
    return float(value or 0)


@dataclass
class LegalPlayerPurchase:
    puuid: str
    weapon: dict[str, Any] | None
    armor: dict[str, Any] | None
    abilities: list[dict[str, Any]]
    keep_weapon: bool
    self_cost: float
    weapon_cost: float
    armor_cost: float
    ability_cost: float
    expected_remaining: float
    bought_by: str | None = None
    buys_for: str | None = None
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class LegalPurchaseGenerator:
    """Enumerates player-level legal choices. Team drops are solved later."""
    def generate(self, state: PlayerInventoryState, *, agent: str = "", limit: int = 48,
                 ability_combination_limit: int = 64) -> list[dict[str, Any]]:
        credits = state.credits_before_buy
        weapons = [None]
        if state.weapon_before_buy:
            weapons.append(find_weapon(state.weapon_before_buy) or {"displayName": state.weapon_before_buy, "cost": 0, "source": "carried"})
        # A weapon can exceed the receiver's own budget because the team solver
        # may fund it as a legal weapon-only drop.
        purchasable = [w for w in load_weapon_catalog().values() if w.get("cost") is not None]
        purchasable.sort(key=_price)
        weapons.extend(purchasable)
        armors = [None]
        armors.extend(g for g in load_gear_catalog().values() if g.get("cost") is not None and _price(g) <= credits)
        ability_options = self._ability_options(agent, credits, max_combinations=ability_combination_limit)
        plans: list[dict[str, Any]] = []
        seen: set[tuple] = set()
        for weapon in weapons:
            keep = bool(state.weapon_before_buy and _price(weapon) == 0 and weapon is not None)
            wc = 0 if keep else _price(weapon)
            for armor in armors:
                ac = 0 if state.armor_before_buy and armor and str(armor.get("displayName")) == state.armor_before_buy else _price(armor)
                for abilities, ability_cost, warnings in ability_options:
                    total = wc + ac + ability_cost
                    requires_drop = bool(wc and total > credits and ac + ability_cost <= credits)
                    if total > credits + 1e-6 and not requires_drop:
                        continue
                    key = ((weapon or {}).get("displayName"), (armor or {}).get("displayName"), tuple((a["name"], a["charges"]) for a in abilities))
                    if key in seen:
                        continue
                    seen.add(key)
                    self_cost = ac + ability_cost if requires_drop else total
                    payload = LegalPlayerPurchase(state.puuid, weapon, armor, abilities, keep, self_cost, wc, ac, ability_cost, credits-self_cost, warnings=warnings)
                    item = payload.to_dict()
                    item["requires_weapon_drop"] = requires_drop
                    plans.append(item)
        plans.sort(key=lambda p: (p.get("self_cost", 0), _price(p.get("weapon")), p.get("ability_cost", 0)))
        if len(plans) <= limit:
            return plans
        indices = {round(i * (len(plans) - 1) / max(1, limit - 1)) for i in range(limit)}
        selected = [plans[i] for i in sorted(indices)]
        # Always retain the strongest utility plan and carried/no-buy choices.
        must_keep = [
            max(plans, key=lambda p: (p.get("ability_cost", 0), -p.get("self_cost", 0))),
            min(plans, key=lambda p: p.get("self_cost", 0)),
        ]
        carried = next((p for p in plans if p.get("keep_weapon")), None)
        if carried:
            must_keep.append(carried)
        required = []
        for item in must_keep:
            if item not in required:
                required.append(item)
        remainder = [item for item in selected if item not in required]
        return (required + remainder)[:limit]

    @staticmethod
    def _ability_options(agent: str, credits: float, *, max_combinations: int = 64) -> list[tuple[list[dict], float, list[str]]]:
        free: list[dict] = []
        purchase_axes: list[list[dict | None]] = []
        warnings: list[str] = []
        for ability in agent_abilities(agent):
            if str(ability.get("ability_kind") or "").lower() == "ultimate":
                continue
            free_count = int(ability.get("free_charges_at_round_start") or 0)
            if free_count:
                free.append({"name": ability.get("name"), "charges": free_count, "cost": 0,
                             "cost_per_charge": 0, "source": "free_round_start",
                             "tactical_types": ability.get("tactical_types") or []})
            if not ability.get("is_purchasable"):
                continue
            cost = ability.get("cost_per_charge") if ability.get("cost_per_charge") is not None else ability.get("cost_credits")
            if cost is None:
                warnings.append(f"missing_cost:{ability.get('name')}")
                continue
            max_buy = int(ability.get("purchasable_charges") or max(0, int(ability.get("max_charges") or 0)-free_count))
            axis: list[dict | None] = [None]
            for count in range(1, max_buy + 1):
                total = float(cost) * count
                if total <= credits:
                    axis.append({"name": ability.get("name"), "charges": count, "cost": total,
                                 "cost_per_charge": float(cost), "source": "bought",
                                 "tactical_types": ability.get("tactical_types") or []})
            if len(axis) > 1:
                purchase_axes.append(axis)

        raw = product(*purchase_axes) if purchase_axes else [()]
        options: list[tuple[list[dict], float, list[str]]] = []
        for combination in raw:
            bought = [item for item in combination if item]
            cost = sum(float(item["cost"]) for item in bought)
            if cost <= credits:
                # Merge free and bought charges of the same ability for a stable UI contract.
                merged: dict[str, dict] = {item["name"]: dict(item) for item in free}
                for item in bought:
                    existing = merged.get(item["name"])
                    if existing:
                        existing["charges"] += item["charges"]
                        existing["cost"] += item["cost"]
                        existing["cost_per_charge"] = item["cost_per_charge"]
                        existing["source"] = "free_and_bought"
                    else:
                        merged[item["name"]] = dict(item)
                options.append((list(merged.values()), cost, list(warnings)))
        options.sort(key=lambda item: (item[1], len(item[0])))
        if len(options) <= max_combinations:
            return options
        if max_combinations <= 1:
            return [options[-1]]
        # Preserve the economic spectrum, not merely the cheapest combinations.
        indices = {round(i * (len(options) - 1) / (max_combinations - 1)) for i in range(max_combinations)}
        return [options[i] for i in sorted(indices)]
