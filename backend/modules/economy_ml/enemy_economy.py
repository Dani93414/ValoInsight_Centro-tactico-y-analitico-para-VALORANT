from __future__ import annotations

from dataclasses import asdict, dataclass, field
from statistics import median
from typing import Any

from .display_normalizer import normalize_observed_economy
from .economy_ledger import infer_player_survived_round


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
    enemy_players: list[dict] = field(default_factory=list)
    enemy_can_full_buy_count: int = 0
    enemy_can_rifle_count: int = 0
    enemy_can_operator_count: int = 0
    enemy_low_credit_count: int = 0
    enemy_median_credits: float = 0.0
    enemy_credit_spread: float = 0.0
    enemy_saved_weapon_count: int = 0
    enemy_bonus_candidate: bool = False
    confidence: float = 0.0
    source: str = "unavailable"
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_enemy_economy_context(enemy_state: dict | None, *, previous_round: dict | None = None,
                                round_number: int | None = None,
                                is_pistol_round: bool = False) -> EnemyEconomyContext:
    if not enemy_state:
        return EnemyEconomyContext(False, warnings=["enemy_economy_unavailable"])
    credits = {str(key): float(value or 0) for key, value in
               (enemy_state.get("team_player_credit_estimates") or {}).items()}
    if not credits:
        return EnemyEconomyContext(False, str(enemy_state.get("team_id") or "") or None,
                                   warnings=["enemy_economy_unavailable"])
    enemy_players = []
    projected_weapon_value = projected_armor_value = projected_utility_value = 0.0
    projected_rifle_count = projected_operator_count = 0
    for puuid, value in credits.items():
        if value >= 5700:
            capacity, weapon = "operator_heavy", "operator"
            weapon_value, armor_value, utility_value = 4700, 1000, 500
            projected_operator_count += 1
        elif value >= 3900:
            capacity, weapon = "rifle_heavy", "rifle"
            weapon_value, armor_value, utility_value = 2900, 1000, 500
            projected_rifle_count += 1
        elif value >= 3300:
            capacity, weapon = "rifle_light", "rifle"
            weapon_value, armor_value, utility_value = 2900, 400, 300
            projected_rifle_count += 1
        elif value >= 2400:
            capacity, weapon = "smg_armor", "smg"
            weapon_value, armor_value, utility_value = 1600, 650, 300
        elif value >= 1400:
            capacity, weapon = "pistol_force", "sidearm"
            weapon_value, armor_value, utility_value = 800, 400, 200
        else:
            capacity, weapon = "pistol_save", "sidearm"
            weapon_value, armor_value, utility_value = 0, 0, min(200, value)
        projected_weapon_value += weapon_value
        projected_armor_value += armor_value
        projected_utility_value += utility_value
        enemy_players.append({"puuid": puuid, "credits": value, "buy_capacity": capacity,
                              "can_full_buy": value >= 3900, "can_force": value >= 1400,
                              "can_operator": value >= 5700, "projected_weapon_class": weapon})
    full_count = sum(item["can_full_buy"] for item in enemy_players)
    rifle_count = sum(item["credits"] >= 3300 for item in enemy_players)
    operator_count = sum(item["can_operator"] for item in enemy_players)
    low_count = sum(item["credits"] < 2000 for item in enemy_players)
    previous_loadout: dict[str, dict] = {}
    saved_count = 0
    previous_stats = {str(item.get("puuid")): item for item in (previous_round or {}).get("playerStats") or []}
    for puuid in credits:
        stat = previous_stats.get(puuid) or {}
        normalized = normalize_observed_economy(stat.get("economy") or {})
        if stat:
            previous_loadout[puuid] = {"weapon": normalized["weapon"], "armor": normalized["armor"]}
        if stat and infer_player_survived_round(previous_round, puuid) and normalized["weapon"] not in {"Classic", "Arma no observada"}:
            saved_count += 1
    bonus = saved_count >= 3
    if is_pistol_round or round_number in {1, 13}:
        label = "ENEMY_PISTOL"
        projected_weapon_value, projected_armor_value, projected_utility_value = 0, 0, 1000
        projected_rifle_count = projected_operator_count = 0
    elif bonus:
        label = "ENEMY_BONUS"
    elif full_count >= 4 or rifle_count >= 4:
        label = "ENEMY_FULL_BUY"
    elif low_count >= max(1, (len(enemy_players) + 1) // 2):
        label = "ENEMY_ECO"
    elif sum(item["can_force"] for item in enemy_players) >= 4 and rifle_count < 3:
        label = "ENEMY_FORCE"
    else:
        label = "ENEMY_HALF_BUY"
    values = list(credits.values())
    full = full_count / len(values)
    save = low_count / len(values)
    force = sum(item["can_force"] for item in enemy_players) / len(values) * (1 - full)
    projected = {"total_credits": sum(values), "average_credits": round(sum(values) / len(values), 2),
                 "median_credits": float(median(values)), "buy_class": label,
                 "projected_weapon_value": projected_weapon_value,
                 "projected_armor_value": projected_armor_value,
                 "projected_utility_value": projected_utility_value,
                 "projected_total_loadout_value": projected_weapon_value + projected_armor_value + projected_utility_value,
                 "projected_rifle_count": projected_rifle_count,
                 "projected_operator_count": projected_operator_count}
    return EnemyEconomyContext(
        available=True, enemy_team_id=str(enemy_state.get("team_id") or "") or None,
        enemy_credits_by_player=credits, enemy_observed_previous_loadout=previous_loadout,
        enemy_projected_buy=projected, enemy_buy_recommendation=label,
        enemy_full_buy_probability=round(full, 4), enemy_force_probability=round(force, 4),
        enemy_save_probability=round(save, 4), enemy_anti_eco_probability=round(save * .8, 4),
        enemy_players=enemy_players, enemy_can_full_buy_count=full_count,
        enemy_can_rifle_count=rifle_count, enemy_can_operator_count=operator_count,
        enemy_low_credit_count=low_count, enemy_median_credits=float(median(values)),
        enemy_credit_spread=max(values) - min(values), enemy_saved_weapon_count=saved_count,
        enemy_bonus_candidate=bonus, confidence=.82 if len(values) >= 5 else .65,
        source="shared_economy_ledger+previous_round_inventory", warnings=[] if len(values) >= 5 else ["enemy_roster_incomplete"],
    )
