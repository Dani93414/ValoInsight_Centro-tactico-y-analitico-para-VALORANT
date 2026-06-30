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


def build_enemy_economy_context(enemy_state: dict | None, *, previous_round: dict | None = None) -> EnemyEconomyContext:
    if not enemy_state:
        return EnemyEconomyContext(False, warnings=["enemy_economy_unavailable"])
    credits = {str(key): float(value or 0) for key, value in
               (enemy_state.get("team_player_credit_estimates") or {}).items()}
    if not credits:
        return EnemyEconomyContext(False, str(enemy_state.get("team_id") or "") or None,
                                   warnings=["enemy_economy_unavailable"])
    enemy_players = []
    for puuid, value in credits.items():
        if value >= 5700:
            capacity, weapon = "operator_heavy", "operator"
        elif value >= 3900:
            capacity, weapon = "rifle_heavy", "rifle"
        elif value >= 3300:
            capacity, weapon = "rifle_light", "rifle"
        elif value >= 2400:
            capacity, weapon = "smg_armor", "smg"
        elif value >= 1400:
            capacity, weapon = "pistol_force", "sidearm"
        else:
            capacity, weapon = "pistol_save", "sidearm"
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
    if bonus:
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
                 "median_credits": float(median(values)), "buy_class": label}
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
