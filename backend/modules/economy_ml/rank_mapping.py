from __future__ import annotations

from typing import Any

RANK_NAMES = {
    3: "Iron 1", 4: "Iron 2", 5: "Iron 3",
    6: "Bronze 1", 7: "Bronze 2", 8: "Bronze 3",
    9: "Silver 1", 10: "Silver 2", 11: "Silver 3",
    12: "Gold 1", 13: "Gold 2", 14: "Gold 3",
    15: "Platinum 1", 16: "Platinum 2", 17: "Platinum 3",
    18: "Diamond 1", 19: "Diamond 2", 20: "Diamond 3",
    21: "Ascendant 1", 22: "Ascendant 2", 23: "Ascendant 3",
    24: "Immortal 1", 25: "Immortal 2", 26: "Immortal 3", 27: "Radiant",
}


def normalize_rank_tier(value: Any) -> int | None:
    try:
        tier = int(round(float(value)))
    except (TypeError, ValueError):
        return None
    return tier if 3 <= tier <= 27 else None


def get_rank_name(tier: int | None) -> str:
    normalized = normalize_rank_tier(tier)
    return RANK_NAMES.get(normalized, "Unknown")


def get_rank_group(tier: int | None) -> str:
    normalized = normalize_rank_tier(tier)
    if normalized is None:
        return "Unknown"
    if normalized >= 24:
        return "Immortal+"
    return get_rank_name(normalized).split()[0]
