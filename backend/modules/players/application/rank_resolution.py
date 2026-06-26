from __future__ import annotations

import unicodedata
from typing import Any


def _normalize_label(value: Any) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    normalized = unicodedata.normalize("NFD", text)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return " ".join(normalized.split())


def coerce_raw_tier(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value >= 0 else None
    if isinstance(value, float):
        tier = int(value)
        return tier if tier >= 0 else None
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            tier = int(float(text))
        except (TypeError, ValueError):
            return None
        return tier if tier >= 0 else None
    return None


def is_ranked_tier(value: Any) -> bool:
    tier = coerce_raw_tier(value)
    return tier is not None and tier >= 3


def coerce_rank_tier_or_none(value: Any) -> int | None:
    tier = coerce_raw_tier(value)
    return tier if tier is not None and tier >= 3 else None


def format_rank_name(tier: int | None) -> str:
    if tier is None or tier < 3:
        return "Sin rango"
    names = {
        3: "Iron 1",
        4: "Iron 2",
        5: "Iron 3",
        6: "Bronze 1",
        7: "Bronze 2",
        8: "Bronze 3",
        9: "Silver 1",
        10: "Silver 2",
        11: "Silver 3",
        12: "Gold 1",
        13: "Gold 2",
        14: "Gold 3",
        15: "Platinum 1",
        16: "Platinum 2",
        17: "Platinum 3",
        18: "Diamond 1",
        19: "Diamond 2",
        20: "Diamond 3",
        21: "Ascendant 1",
        22: "Ascendant 2",
        23: "Ascendant 3",
        24: "Immortal 1",
        25: "Immortal 2",
        26: "Immortal 3",
        27: "Radiant",
    }
    return names.get(tier, f"Tier {tier}")


def resolve_unranked_icon(
    rank_icon_map: dict[int, str],
    rank_icon_by_name_map: dict[str, str],
) -> str | None:
    for tier in (0, 1, 2):
        icon = rank_icon_map.get(tier)
        if icon:
            return icon
    for name in ("sin rango", "unranked", "unrated", "unused"):
        icon = rank_icon_by_name_map.get(_normalize_label(name))
        if icon:
            return icon
    return None


def _rank_icon(
    tier: int | None,
    rank_icon_map: dict[int, str],
    rank_icon_by_name_map: dict[str, str],
) -> str | None:
    if tier is None:
        return resolve_unranked_icon(rank_icon_map, rank_icon_by_name_map)
    return rank_icon_map.get(tier) or rank_icon_by_name_map.get(
        _normalize_label(format_rank_name(tier))
    )


def _latest_by_timestamp(items: list[dict[str, Any]]) -> dict[str, Any]:
    if not items:
        return {}
    return max(
        items,
        key=lambda item: int(
            item.get("game_start_millis")
            or item.get("timestamp")
            or item.get("gameStartMillis")
            or 0
        ),
    )


def resolve_current_visual_rank(
    *,
    current_act_docs: list[dict[str, Any]],
    mapped_matches: list[dict[str, Any]],
    player: dict[str, Any],
    rank_icon_map: dict[int, str],
    rank_icon_by_name_map: dict[str, str],
) -> dict[str, Any]:
    if current_act_docs:
        latest_current_doc = _latest_by_timestamp(current_act_docs)
        tier = coerce_rank_tier_or_none(
            latest_current_doc.get("competitive_tier")
            if "competitive_tier" in latest_current_doc
            else latest_current_doc.get("competitiveTier")
        )
        if tier is not None:
            icon = _rank_icon(tier, rank_icon_map, rank_icon_by_name_map)
            return {
                "tier": tier,
                "name": format_rank_name(tier),
                "image": icon,
                "smallIcon": icon,
                "source": "current_act_ranked",
                "isUnranked": False,
            }

        icon = resolve_unranked_icon(rank_icon_map, rank_icon_by_name_map)
        return {
            "tier": None,
            "name": "Sin rango",
            "image": icon,
            "smallIcon": icon,
            "source": "current_act_unranked",
            "isUnranked": True,
        }

    ranked_matches = [
        match for match in mapped_matches if is_ranked_tier(match.get("competitiveTier"))
    ]
    if ranked_matches:
        latest_ranked = _latest_by_timestamp(ranked_matches)
        tier = coerce_rank_tier_or_none(latest_ranked.get("competitiveTier"))
        icon = (
            latest_ranked.get("competitiveTierImage")
            or _rank_icon(tier, rank_icon_map, rank_icon_by_name_map)
        )
        return {
            "tier": tier,
            "name": format_rank_name(tier),
            "image": icon,
            "smallIcon": _rank_icon(tier, rank_icon_map, rank_icon_by_name_map),
            "source": "latest_global_ranked",
            "isUnranked": False,
        }

    tier = coerce_rank_tier_or_none(
        player.get("competitiveTier", player.get("competitive_tier"))
    )
    if tier is not None:
        icon = (
            player.get("competitiveTierImage")
            or player.get("competitive_tier_image")
            or _rank_icon(tier, rank_icon_map, rank_icon_by_name_map)
        )
        return {
            "tier": tier,
            "name": format_rank_name(tier),
            "image": icon,
            "smallIcon": _rank_icon(tier, rank_icon_map, rank_icon_by_name_map),
            "source": "latest_global_ranked",
            "isUnranked": False,
        }

    icon = resolve_unranked_icon(rank_icon_map, rank_icon_by_name_map)
    return {
        "tier": None,
        "name": "Sin rango",
        "image": icon,
        "smallIcon": icon,
        "source": "unknown",
        "isUnranked": True,
    }
