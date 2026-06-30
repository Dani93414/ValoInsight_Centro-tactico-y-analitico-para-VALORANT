from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from .ability_catalog import agent_abilities


@dataclass
class AbilityUsageState:
    puuid: str
    agent: str
    round_number: int
    available: bool
    used_abilities_by_slot: dict[str, int] = field(default_factory=dict)
    used_abilities_by_name: dict[str, int] = field(default_factory=dict)
    charges_used_estimated: dict[str, int] = field(default_factory=dict)
    charges_carried_after_round: dict[str, int] = field(default_factory=dict)
    purchased_charges_estimated: dict[str, int] = field(default_factory=dict)
    free_charges_granted: dict[str, int] = field(default_factory=dict)
    confidence: float = 0.0
    source: str = "unavailable"
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_ability_usage_state(previous_round: dict | None, *, puuid: str, agent: str,
                              round_number: int) -> AbilityUsageState:
    free = {str(item.get("canonical_name") or item.get("name")): int(item.get("free_charges_at_round_start") or 0)
            for item in agent_abilities(agent) if int(item.get("free_charges_at_round_start") or 0) > 0}
    stat = next((item for item in (previous_round or {}).get("playerStats") or []
                 if str(item.get("puuid")) == str(puuid)), None)
    raw = (stat or {}).get("ability") or (stat or {}).get("abilityCasts") or {}
    inventory = (stat or {}).get("abilityInventory") or (stat or {}).get("abilityCharges") or {}
    if not isinstance(raw, dict) or not raw:
        return AbilityUsageState(str(puuid), agent, round_number, False, free_charges_granted=free,
                                 warnings=["ability_usage_unavailable"])
    by_slot = {str(key).upper(): int(value or 0) for key, value in raw.items()
               if isinstance(value, (int, float)) and str(key).upper() in {"C", "Q", "E", "X"}}
    by_name = {str(key): int(value or 0) for key, value in raw.items()
               if isinstance(value, (int, float)) and str(key).upper() not in {"C", "Q", "E", "X"}}
    used = {**by_name, **by_slot}
    carried = {str(key): max(0, int(value or 0)) for key, value in inventory.items()
               if isinstance(value, (int, float))} if isinstance(inventory, dict) else {}
    warnings = [] if carried else ["ability_inventory_unavailable"]
    return AbilityUsageState(str(puuid), agent, round_number, True, by_slot, by_name, used, carried, {}, free,
                             .82 if carried else .6, "previous_round_player_stats", warnings)


def carried_charges(previous_charges: dict[str, int], used: dict[str, int], *, carries_over: bool = True) -> dict[str, int]:
    if not carries_over:
        return {}
    return {name: max(0, int(count) - int(used.get(name, 0))) for name, count in previous_charges.items()}
