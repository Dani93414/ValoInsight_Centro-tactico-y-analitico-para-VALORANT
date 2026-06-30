from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from typing import Any

from .content_catalog import weapon_role
from .display_normalizer import normalize_weapon_display


def _event_count(value: Any) -> int:
    if isinstance(value, list):
        return len(value)
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _damage_total(value: Any) -> float:
    if isinstance(value, list):
        return sum(float(item.get("damage") or item.get("damageDealt") or 0)
                   for item in value if isinstance(item, dict))
    if isinstance(value, dict):
        return float(value.get("damage") or value.get("damageDealt") or 0)
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


@dataclass
class PlayerStyleProfile:
    puuid: str
    available: bool
    sample_size: int = 0
    preferred_weapons: list[str] = field(default_factory=list)
    weapon_usage_counts: dict[str, int] = field(default_factory=dict)
    weapon_kill_rate: dict[str, float] = field(default_factory=dict)
    weapon_damage_efficiency: dict[str, float] = field(default_factory=dict)
    headshot_rate_by_weapon: dict[str, float] = field(default_factory=dict)
    sniper_tendency: float = 0.0
    rifle_tendency: float = 0.0
    smg_tendency: float = 0.0
    sidearm_tendency: float = 0.0
    utility_usage_tendency: float = 0.0
    aggression_score: float = 0.0
    save_tendency: float = 0.0
    clutch_score: float | None = None
    confidence: float = 0.0
    source: str = "unavailable"
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_player_profile(match: dict, puuid: str, *, round_number: int, minimum_sample: int = 3) -> PlayerStyleProfile:
    usage: Counter[str] = Counter()
    kills: Counter[str] = Counter()
    damage: defaultdict[str, float] = defaultdict(float)
    headshots: Counter[str] = Counter()
    shots: Counter[str] = Counter()
    utility_casts = 0
    # Only prior rounds are evidence for the recommendation.
    for obj in (match.get("roundResults") or [])[:max(0, round_number - 1)]:
        stat = next((item for item in obj.get("playerStats") or [] if str(item.get("puuid")) == str(puuid)), None)
        if not stat:
            continue
        economy = stat.get("economy") or {}
        weapon = normalize_weapon_display(economy.get("weapon"))["displayName"]
        if weapon not in {"Arma no observada", "Classic"}:
            usage[weapon] += 1
            kills[weapon] += _event_count(stat.get("kills"))  # estimated attribution when kill events lack weapon.
            damage[weapon] += _damage_total(stat.get("damage") or stat.get("damageDealt"))
            headshots[weapon] += _event_count(stat.get("headshots"))
            shots[weapon] += (_event_count(stat.get("headshots")) + _event_count(stat.get("bodyshots"))
                              + _event_count(stat.get("legshots")))
        ability = stat.get("ability") or stat.get("abilityCasts") or {}
        if isinstance(ability, dict):
            utility_casts += sum(int(value or 0) for value in ability.values() if isinstance(value, (int, float)))
    sample = sum(usage.values())
    if sample < minimum_sample:
        return PlayerStyleProfile(str(puuid), False, sample, list(usage), dict(usage),
                                  confidence=min(.3, sample * .1), source="prior_rounds_estimated",
                                  warnings=["player_profile_insufficient_history"])
    roles = Counter()
    for weapon, count in usage.items():
        roles[weapon_role(weapon)] += count
    preferred = [name for name, _ in usage.most_common(3)]
    return PlayerStyleProfile(
        str(puuid), True, sample, preferred, dict(usage),
        {name: round(kills[name] / count, 4) for name, count in usage.items()},
        {name: round(damage[name] / count, 4) for name, count in usage.items()},
        {name: round(headshots[name] / shots[name], 4) if shots[name] else 0 for name in usage},
        roles["sniper"] / sample, roles["rifle"] / sample, roles["smg"] / sample, roles["sidearm"] / sample,
        min(1.0, utility_casts / max(1, sample * 2)), min(1.0, sum(kills.values()) / max(1, sample * 2)),
        0.0, None, min(.85, .3 + sample * .06), "prior_rounds_estimated",
        ["weapon_kills_estimated_from_round_loadout"],
    )
