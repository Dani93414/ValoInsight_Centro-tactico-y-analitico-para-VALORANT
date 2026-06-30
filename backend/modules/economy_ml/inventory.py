from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class AbilityChargeState:
    name: str
    charges: int = 0
    source: str = "unknown"
    cost_per_charge: float | None = None


@dataclass
class PlayerInventoryState:
    puuid: str
    credits_before_buy: float
    credits_after_buy: float | None = None
    weapon_before_buy: str | None = None
    weapon_after_buy: str | None = None
    weapon_source: str = "unknown"
    armor_before_buy: str | None = None
    armor_after_buy: str | None = None
    armor_source: str = "unknown"
    armor_durability: float | None = None
    abilities_before_buy: dict[str, AbilityChargeState] = field(default_factory=dict)
    abilities_after_buy: dict[str, AbilityChargeState] = field(default_factory=dict)
    free_abilities_granted: dict[str, int] = field(default_factory=dict)
    abilities_bought: dict[str, int] = field(default_factory=dict)
    abilities_used: dict[str, int] = field(default_factory=dict)
    ability_charges_before_buy: dict[str, int] = field(default_factory=dict)
    ability_charges_confidence: float = 0.0
    survived_previous_round: bool | None = None
    died_previous_round: bool | None = None
    ultimate_points: int | None = None
    confidence: float = 0.5
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def advance_inventory(
    previous: PlayerInventoryState | None,
    *,
    puuid: str,
    credits_before_buy: float,
    observed_weapon: str | None,
    observed_armor: str | None,
    survived_previous_round: bool | None,
) -> PlayerInventoryState:
    """Create a pre-buy state without pretending a post-buy loadout is a purchase."""
    carried_weapon = previous.weapon_after_buy if previous and survived_previous_round else None
    carried_armor = previous.armor_after_buy if previous and survived_previous_round else None
    return PlayerInventoryState(
        puuid=puuid,
        credits_before_buy=max(0.0, float(credits_before_buy)),
        weapon_before_buy=carried_weapon,
        weapon_after_buy=observed_weapon,
        weapon_source="carried" if carried_weapon and carried_weapon == observed_weapon else "unknown",
        armor_before_buy=carried_armor,
        armor_after_buy=observed_armor,
        armor_source="carried" if carried_armor and carried_armor == observed_armor else "unknown",
        survived_previous_round=survived_previous_round,
        died_previous_round=None if survived_previous_round is None else not survived_previous_round,
        confidence=0.85 if survived_previous_round is not None else 0.45,
    )
