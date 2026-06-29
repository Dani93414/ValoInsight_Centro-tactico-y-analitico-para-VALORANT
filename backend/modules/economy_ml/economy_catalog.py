from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .ability_catalog import get_agent_ability_catalog
from .content_catalog import find_gear, find_weapon, load_gear_catalog, load_weapon_catalog
from .economy_income_rules import (
    KILL_REWARD, MAX_CREDITS, OVERTIME_STARTING_CREDITS, ROUND_WIN_REWARD,
    SAVE_PENALTY_REWARD, SPIKE_PLANT_REWARD, STANDARD_STARTING_CREDITS,
    loss_reward,
)


@dataclass(frozen=True)
class ValorantEconomyCatalog:
    """Versioned boundary for all economy constants used by the engine."""
    version: str = "valorant-economy-v10"
    patch: str = "content_collection+manual_review"
    starting_credits: float = STANDARD_STARTING_CREDITS
    maximum_credits: float = MAX_CREDITS
    overtime_credits: float = OVERTIME_STARTING_CREDITS
    win_reward: float = ROUND_WIN_REWARD
    kill_reward: float = KILL_REWARD
    plant_reward: float = SPIKE_PLANT_REWARD
    save_penalty_reward: float = SAVE_PENALTY_REWARD

    def weapon(self, value: Any) -> dict | None:
        return find_weapon(value)

    def armor(self, value: Any) -> dict | None:
        return find_gear(value)

    def weapons(self) -> dict[str, dict]:
        return load_weapon_catalog()

    def armors(self) -> dict[str, dict]:
        return load_gear_catalog()

    def abilities(self, agent: str) -> dict | None:
        return get_agent_ability_catalog(agent)

    def loss_reward(self, streak: int) -> float:
        return loss_reward(streak)
