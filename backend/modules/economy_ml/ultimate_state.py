from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from .ability_catalog import agent_abilities


@dataclass
class UltimateState:
    puuid: str
    agent: str
    round_number: int
    available: bool
    ultimate_points: int | None = None
    ultimate_cost: int | None = None
    ultimate_ready: bool | None = None
    source: str = "unavailable"
    confidence: float = 0.0
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_ultimate_state(previous_round: dict | None, *, puuid: str, agent: str,
                         round_number: int) -> UltimateState:
    stat = next((item for item in (previous_round or {}).get("playerStats") or []
                 if str(item.get("puuid")) == str(puuid)), {})
    points = stat.get("ultimatePoints")
    if points is None:
        points = (stat.get("ability") or {}).get("ultimatePoints") if isinstance(stat.get("ability"), dict) else None
    ultimate = next((item for item in agent_abilities(agent)
                     if str(item.get("ability_kind") or "").lower() == "ultimate"), {})
    cost = (ultimate.get("ultimate_points") or ultimate.get("ultimate_cost")
            or ultimate.get("required_points"))
    if points is None:
        return UltimateState(str(puuid), agent, round_number, False, ultimate_cost=int(cost) if cost else None,
                             warnings=["ultimate_state_unavailable"])
    points, cost = int(points), int(cost) if cost else None
    warnings = [] if cost else ["ultimate_cost_unavailable"]
    return UltimateState(str(puuid), agent, round_number, True, points, cost,
                         points >= cost if cost else None, "previous_round_player_stats",
                         .8 if cost else .55, warnings)
