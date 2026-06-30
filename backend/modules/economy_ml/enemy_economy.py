from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class EnemyEconomyContext:
    available: bool
    enemy_team_id: str | None = None
    enemy_credits_by_player: dict[str, float] = field(default_factory=dict)
    enemy_observed_previous_loadout: dict[str, dict] = field(default_factory=dict)
    enemy_projected_buy: dict = field(default_factory=dict)
    enemy_buy_recommendation: str | None = None
    enemy_full_buy_probability: float = 0.0
    enemy_force_probability: float = 0.0
    enemy_save_probability: float = 0.0
    enemy_anti_eco_probability: float = 0.0
    confidence: float = 0.0
    source: str = "unavailable"
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_enemy_economy_context(enemy_state: dict | None, *, previous_round: dict | None = None) -> EnemyEconomyContext:
    if not enemy_state:
        return EnemyEconomyContext(False, warnings=["enemy_economy_unavailable"])
    credits = {str(key): float(value or 0) for key, value in
               (enemy_state.get("team_player_credit_estimates") or {}).items()}
    if not credits:
        return EnemyEconomyContext(False, str(enemy_state.get("team_id") or "") or None,
                                   warnings=["enemy_economy_unavailable"])
    average = sum(credits.values()) / len(credits)
    full = max(0.0, min(1.0, (average - 2500) / 1800))
    save = max(0.0, min(1.0, (2400 - average) / 1800))
    force = max(0.0, 1.0 - full - save)
    if full >= .6:
        label = "ENEMY_FULL_BUY"
    elif save >= .6:
        label = "ENEMY_ECO"
    elif average < 3300:
        label = "ENEMY_HALF_BUY"
    else:
        label = "ENEMY_FORCE"
    return EnemyEconomyContext(True, str(enemy_state.get("team_id") or "") or None, credits, {},
                               {"average_credits": round(average, 2)}, label, round(full, 4),
                               round(force, 4), round(save, 4), round(save * .8, 4),
                               .7, "shared_economy_ledger", [])
