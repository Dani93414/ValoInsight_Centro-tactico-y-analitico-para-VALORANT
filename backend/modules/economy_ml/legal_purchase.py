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


def _weapon_purchase_cost(item: dict | None) -> float:
    value = (item or {}).get("purchase_cost")
    return float(value if value is not None else _price(item))


def _weapon_value(item: dict | None) -> float:
    value = (item or {}).get("weapon_value")
    return float(value if value is not None else _price(item))


def _armor_value(item: dict | None) -> float:
    value = (item or {}).get("armor_value")
    return float(value if value is not None else _price(item))


@dataclass
class LegalPlayerPurchase:
    puuid: str
    weapon: dict[str, Any] | None
    armor: dict[str, Any] | None
    abilities: list[dict[str, Any]]
    keep_weapon: bool
    self_cost: float
    weapon_cost: float
    weapon_purchase_cost: float
    weapon_value: float
    weapon_source: str
    armor_cost: float
    armor_purchase_cost: float
    armor_value: float
    armor_source: str
    keep_armor: bool
    ability_cost: float
    expected_remaining: float
    bought_by: str | None = None
    buys_for: str | list[str] | None = None
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class LegalPurchaseGenerator:
    """Enumerates player-level legal choices. Team drops are solved later."""
    def generate(self, state: PlayerInventoryState, *, agent: str = "", limit: int = 48,
                 ability_combination_limit: int = 64, context: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        credits = state.credits_before_buy
        weapons = [None]
        if state.weapon_before_buy:
            catalog_weapon = find_weapon(state.weapon_before_buy)
            catalog_value = _price(catalog_weapon)
            carried = {
                **(catalog_weapon or {}),
                "displayName": (catalog_weapon or {}).get("displayName") or state.weapon_before_buy,
                "cost": 0,
                "purchase_cost": 0,
                "weapon_value": catalog_value,
                "source": "carried",
            }
            if not catalog_weapon:
                carried["warnings"] = ["carried_weapon_missing_catalog"]
            weapons.append(carried)
        # A weapon can exceed the receiver's own budget because the team solver
        # may fund it as a legal weapon-only drop.
        purchasable = [w for w in load_weapon_catalog().values() if w.get("cost") is not None]
        purchasable.sort(key=_price)
        weapons.extend({
            **weapon,
            "purchase_cost": _price(weapon),
            "weapon_value": _price(weapon),
            "source": "bought_self",
        } for weapon in purchasable)
        armors = [None]
        if state.armor_before_buy and state.armor_before_buy != "Sin escudo":
            catalog_armor = find_gear(state.armor_before_buy)
            catalog_value = _price(catalog_armor)
            carried_armor = {
                **(catalog_armor or {}),
                "displayName": (catalog_armor or {}).get("displayName") or state.armor_before_buy,
                "cost": 0,
                "purchase_cost": 0,
                "armor_value": catalog_value,
                "source": "carried",
            }
            if not catalog_armor:
                carried_armor["warnings"] = ["carried_armor_missing_catalog"]
            armors.append(carried_armor)
        armors.extend({
            **gear,
            "purchase_cost": _price(gear),
            "armor_value": _price(gear),
            "source": "bought_self",
        } for gear in load_gear_catalog().values() if gear.get("cost") is not None and _price(gear) <= credits)
        ability_options = self._ability_options(agent, credits, max_combinations=ability_combination_limit)
        if (context or {}).get("is_pistol_round"):
            # A pistol plan buys a key piece of utility, not an automatic full kit.
            pistol_cap = float((context or {}).get("pistol_utility_cap_per_player") or 500)
            ability_options = [option for option in ability_options if option[1] <= pistol_cap]
        plans: list[dict[str, Any]] = []
        seen: set[tuple] = set()
        for weapon in weapons:
            source = str((weapon or {}).get("source") or "none")
            keep = source == "carried"
            purchase_cost = _weapon_purchase_cost(weapon)
            equipped_value = _weapon_value(weapon)
            wc = 0 if keep else purchase_cost
            for armor in armors:
                armor_source = str((armor or {}).get("source") or "none")
                keep_armor = armor_source == "carried"
                armor_purchase_cost = float((armor or {}).get("purchase_cost") if (armor or {}).get("purchase_cost") is not None else _price(armor))
                armor_value = _armor_value(armor)
                ac = 0 if keep_armor else armor_purchase_cost
                for abilities, ability_cost, warnings in ability_options:
                    total = wc + ac + ability_cost
                    requires_drop = bool(wc and total > credits and ac + ability_cost <= credits)
                    if total > credits + 1e-6 and not requires_drop:
                        continue
                    key = ((weapon or {}).get("displayName"), source, (armor or {}).get("displayName"), armor_source, tuple((a["name"], a["charges"]) for a in abilities))
                    if key in seen:
                        continue
                    seen.add(key)
                    self_cost = ac + ability_cost if requires_drop else total
                    item_warnings = list((weapon or {}).get("warnings") or []) + list((armor or {}).get("warnings") or [])
                    payload = LegalPlayerPurchase(
                        state.puuid, weapon, armor, abilities, keep, self_cost, wc,
                        purchase_cost, equipped_value, source, ac, armor_purchase_cost,
                        armor_value, armor_source, keep_armor, ability_cost,
                        credits-self_cost, warnings=list(dict.fromkeys(warnings + item_warnings)),
                    )
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
        carried_armor = next((p for p in plans if p.get("keep_armor")), None)
        if carried_armor:
            must_keep.append(carried_armor)
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
            ability_name = ability.get("canonical_name") or ability.get("name")
            if free_count:
                free.append({"name": ability_name, "charges": free_count, "cost": 0,
                             "cost_per_charge": 0, "source": "free_round_start",
                             "tactical_types": ability.get("tactical_types") or []})
            if not ability.get("is_purchasable"):
                continue
            cost = ability.get("cost_per_charge") if ability.get("cost_per_charge") is not None else ability.get("cost_credits")
            if cost is None:
                warnings.append(f"missing_cost:{ability_name}")
                continue
            max_buy = int(ability.get("purchasable_charges") or max(0, int(ability.get("max_charges") or 0)-free_count))
            axis: list[dict | None] = [None]
            for count in range(1, max_buy + 1):
                total = float(cost) * count
                if total <= credits:
                    axis.append({"name": ability_name, "charges": count, "cost": total,
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
