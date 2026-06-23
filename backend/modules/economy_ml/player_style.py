from __future__ import annotations

from typing import Any


NEUTRAL_STYLE = {
    "entry_score": 0.5,
    "support_score": 0.5,
    "retake_score": 0.5,
    "anchor_score": 0.5,
    "clutch_score": 0.5,
    "sniper_score": 0.5,
    "rifle_score": 0.5,
    "eco_impact_score": 0.5,
    "utility_player_score": 0.5,
    "survivor_score": 0.5,
    "trader_score": 0.5,
    "source": "neutral_fallback",
    "samples": 0,
}


def _rate(num: Any, den: Any) -> float:
    try:
        return max(0.0, min(1.0, float(num or 0) / max(float(den or 0), 1.0)))
    except (TypeError, ValueError):
        return 0.0


def build_player_style_from_analytics(analytics: dict[str, Any] | None) -> dict[str, Any]:
    overview = (analytics or {}).get("overview") or {}
    rounds = int(overview.get("rounds") or 0)
    if rounds < 5:
        return dict(NEUTRAL_STYLE)
    weapon_stats = overview.get("weapon_stats") or {}
    sniper_rounds = sum(
        int(item.get("rounds") or 0)
        for item in weapon_stats.values()
        if any(name in str(item.get("weapon_name") or "").lower() for name in ("operator", "marshal", "outlaw"))
    )
    rifle_rounds = sum(
        int(item.get("rounds") or 0)
        for item in weapon_stats.values()
        if "rifle" in str(item.get("weapon_name") or "").lower()
    )
    return {
        "entry_score": _rate(overview.get("first_kills"), rounds),
        "support_score": _rate(overview.get("assists"), rounds),
        "retake_score": 0.5,
        "anchor_score": _rate(overview.get("survival_rounds"), rounds),
        "clutch_score": _rate(overview.get("clutches_won"), overview.get("clutch_opportunities")),
        "sniper_score": _rate(sniper_rounds, rounds),
        "rifle_score": _rate(rifle_rounds, rounds),
        "eco_impact_score": _rate(((overview.get("buy_buckets") or {}).get("eco") or {}).get("kills"), ((overview.get("buy_buckets") or {}).get("eco") or {}).get("rounds")),
        "utility_player_score": _rate(overview.get("assists"), rounds),
        "survivor_score": _rate(overview.get("survival_rounds"), rounds),
        "trader_score": _rate(overview.get("trade_kills"), overview.get("trade_opportunities")),
        "source": "embedded_player_analytics",
        "samples": rounds,
    }


def build_match_player_style(player: dict[str, Any]) -> dict[str, Any]:
    return build_player_style_from_analytics(player.get("analytics"))


def player_weapon_fit_score(style: dict[str, Any], weapon_name: str | None) -> float:
    name = str(weapon_name or "").lower()
    if any(term in name for term in ("operator", "marshal", "outlaw")):
        return float(style.get("sniper_score") or 0.5)
    if any(term in name for term in ("phantom", "vandal", "guardian", "bulldog")):
        return float(style.get("rifle_score") or 0.5)
    if any(term in name for term in ("sheriff", "ghost", "classic")):
        return float(style.get("eco_impact_score") or 0.5)
    return 0.5
