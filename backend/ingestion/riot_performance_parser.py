"""The only location allowed to interpret Riot's provisional TempValue fields."""
from __future__ import annotations

from typing import Any

TEMP_COMPONENTS = {
    "TempValueA": ("damage", "confirmed_by_fixture_pending"),
    "TempValueB": ("trades", "inferred"),
    "TempValueC": ("assists", "inferred"),
    "TempValueD": ("utilityUsage", "inferred"),
    "TempValueE": ("plants", "inferred"),
    "TempValueI": ("killImpact", "inferred"),
    "TempValueJ": ("deathImpact", "inferred"),
    "TempValueK": ("defuses", "inferred"),
}
KNOWN_UNKNOWN = {"TempValueF", "TempValueH", "TempValueM", "TempValueN"}
DEFAULT_THRESHOLDS = {"pass": 0, "merit": 330, "distinction": 420, "max": 500}


def _rating(value: Any) -> str:
    """Keep Riot's directional rating even when the RAW payload changes casing/shape."""
    if isinstance(value, dict):
        value = next(
            (value.get(key) for key in ("rating", "value", "direction", "trend") if value.get(key) is not None),
            None,
        )
    normalized = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "doubleup": "double_up",
        "double_up": "double_up",
        "up": "up",
        "neutral": "neutral",
        "down": "down",
        "doubledown": "double_down",
        "double_down": "double_down",
    }
    return aliases.get(normalized, "neutral")


def _component_rating(raw: dict[str, Any], ratings: dict[str, Any], temp_key: str, name: str, value: Any) -> str:
    """Read the currently observed RAW rating layouts without deriving one ourselves."""
    candidate = ratings.get(temp_key) or ratings.get(name)
    if candidate is None and isinstance(value, dict):
        candidate = value
    if candidate is None:
        # Current Riot RAW nests the per-component directions in TempValueL,
        # split across TempValueP and TempValueQ.  Preserve the provider value.
        nested = raw.get("TempValueL")
        if isinstance(nested, dict):
            for group in nested.values():
                if isinstance(group, dict) and name in group:
                    candidate = group[name]
                    break
    return _rating(candidate)


def parse_riot_performance(score_row: dict[str, Any] | None, *, game_version: str | None = None) -> dict[str, Any]:
    row = score_row or {}
    raw = row.get("scores") if isinstance(row.get("scores"), dict) else row
    has_temp = any(str(key).startswith("TempValue") for key in raw)
    thresholds = raw.get("thresholds") if isinstance(raw.get("thresholds"), dict) else DEFAULT_THRESHOLDS
    ratings = raw.get("ratings") if isinstance(raw.get("ratings"), dict) else {}
    components = {}
    for temp_key, (name, confidence) in TEMP_COMPONENTS.items():
        value = raw.get(temp_key)
        components[name] = {
            "value": value,
            "rating": _component_rating(raw, ratings, temp_key, name, value),
            "mappingConfidence": confidence,
        }
    # G is the aggregate score, not an unknown component.  All other unknown
    # TempValue* fields are retained verbatim for later fixture-backed work.
    unknown = {key: value for key, value in raw.items() if str(key).startswith("TempValue") and key not in TEMP_COMPONENTS and key != "TempValueG"}
    performance_score = raw.get("performanceScore", raw.get("TempValueG"))
    return {
        "available": performance_score is not None,
        "source": "riot_raw" if has_temp or performance_score is not None else None,
        "system": "riot-performance-score" if performance_score is not None else None,
        "systemVersion": raw.get("systemVersion") or game_version,
        "score": performance_score,
        "tier": raw.get("tier") or raw.get("performanceTier"),
        "components": components,
        "thresholds": thresholds,
        "rawUnknownValues": unknown,
        "hasTempValues": has_temp,
    }
