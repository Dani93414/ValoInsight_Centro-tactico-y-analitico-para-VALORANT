from __future__ import annotations

from dataclasses import asdict, dataclass, field
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
    def generate(self, state: PlayerInventoryState, *, agent: str = "", limit: int = 32) -> list[dict[str, Any]]:
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
        ability_options = self._ability_options(agent, credits)
        plans: list[LegalPlayerPurchase] = []
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
        plans.sort(key=lambda p: (_price(p.get("weapon")), p.get("self_cost", 0), p.get("armor_cost", 0)), reverse=True)
        essentials = [p for p in plans if p.get("self_cost") == 0]
        return plans[:limit] + essentials[:1]

    @staticmethod
    def _ability_options(agent: str, credits: float) -> list[tuple[list[dict], float, list[str]]]:
        free: list[dict] = []
        purchasable: list[dict] = []
        warnings: list[str] = []
        for ability in agent_abilities(agent):
            free_count = int(ability.get("free_charges_at_round_start") or 0)
            if free_count:
                free.append({"name": ability.get("name"), "charges": free_count, "cost": 0, "source": "free_round_start"})
            if not ability.get("is_purchasable"):
                continue
            cost = ability.get("cost_per_charge") if ability.get("cost_per_charge") is not None else ability.get("cost_credits")
            if cost is None:
                warnings.append(f"missing_cost:{ability.get('name')}")
                continue
            max_buy = int(ability.get("purchasable_charges") or max(0, int(ability.get("max_charges") or 0)-free_count))
            if max_buy and float(cost) <= credits:
                purchasable.append({"name": ability.get("name"), "charges": 1, "cost": float(cost), "source": "bought"})
        options = [(free, 0.0, list(warnings))]
        for ability in purchasable:
            options.append((free + [ability], float(ability["cost"]), list(warnings)))
        return options
