from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from .content_catalog import armor_role


ARMOR_MAX = {"light": 25.0, "regen": 25.0, "heavy": 50.0}


@dataclass
class ArmorDurabilityState:
    puuid: str
    round_number: int
    available: bool
    armor_type: str | None = None
    armor_value_remaining: float | None = None
    armor_max_value: float | None = None
    durability_estimated: bool = False
    source: str = "unavailable"
    confidence: float = 0.0
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_armor_durability_state(previous_round: dict | None, *, puuid: str, round_number: int,
                                 armor_name: str | None, survived: bool | None,
                                 reset: bool = False) -> ArmorDurabilityState:
    if reset or not armor_name or armor_name == "Sin escudo":
        return ArmorDurabilityState(str(puuid), round_number, False,
                                    warnings=["armor_durability_reset" if reset else "armor_durability_unavailable"])
    kind = armor_role(armor_name)
    maximum = ARMOR_MAX.get(kind)
    stat = next((item for item in (previous_round or {}).get("playerStats") or []
                 if str(item.get("puuid")) == str(puuid)), {})
    economy = stat.get("economy") or {}
    direct = economy.get("armorRemaining") or stat.get("armorRemaining")
    if direct is not None:
        return ArmorDurabilityState(str(puuid), round_number, True, armor_name, float(direct), maximum,
                                    False, "payload", .95, [])
    if survived and maximum:
        received = stat.get("damageReceived")
        if received is not None:
            remaining = max(0.0, maximum - min(maximum, float(received)))
            return ArmorDurabilityState(str(puuid), round_number, True, armor_name, remaining, maximum,
                                        True, "previous_round_damage_estimate", .5,
                                        ["armor_durability_estimated"])
        return ArmorDurabilityState(str(puuid), round_number, True, armor_name, maximum, maximum, True,
                                    "conservative_intact_estimate", .3,
                                    ["armor_durability_unknown_assumed_intact"])
    return ArmorDurabilityState(str(puuid), round_number, False, armor_name, None, maximum, True,
                                warnings=["armor_durability_unavailable"])
