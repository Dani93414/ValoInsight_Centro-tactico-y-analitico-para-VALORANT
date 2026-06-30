from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from .content_catalog import load_map_catalog


MAP_PROFILES: dict[str, dict[str, Any]] = {
    "ascent": {"range_profile": "mixed", "operator_affinity": .08, "rifle_affinity": .06, "shotgun_affinity": -.02, "smoke_value": .08, "recon_value": .06},
    "breeze": {"range_profile": "long", "operator_affinity": .10, "rifle_affinity": .07, "shotgun_affinity": -.05, "smoke_value": .09, "recon_value": .07},
    "icebox": {"range_profile": "mixed_long", "operator_affinity": .07, "rifle_affinity": .06, "shotgun_affinity": .01, "smoke_value": .07, "recon_value": .05},
    "bind": {"range_profile": "close_mixed", "operator_affinity": .02, "rifle_affinity": .04, "shotgun_affinity": .05, "smoke_value": .08, "recon_value": .03},
    "split": {"range_profile": "close", "operator_affinity": .01, "rifle_affinity": .04, "shotgun_affinity": .07, "smoke_value": .08, "recon_value": .03},
    "haven": {"range_profile": "mixed", "operator_affinity": .06, "rifle_affinity": .06, "shotgun_affinity": .00, "smoke_value": .08, "recon_value": .05},
    "lotus": {"range_profile": "mixed", "operator_affinity": .04, "rifle_affinity": .05, "shotgun_affinity": .03, "smoke_value": .08, "recon_value": .04},
    "sunset": {"range_profile": "mixed", "operator_affinity": .04, "rifle_affinity": .06, "shotgun_affinity": .02, "smoke_value": .08, "recon_value": .04},
    "pearl": {"range_profile": "mixed_long", "operator_affinity": .07, "rifle_affinity": .06, "shotgun_affinity": -.01, "smoke_value": .08, "recon_value": .05},
}


@dataclass
class MapContext:
    available: bool
    map_id: str | None
    map_name: str | None
    map_url: str | None
    side: str | None
    round_number: int
    half: int | None
    map_profile: dict = field(default_factory=dict)
    weapon_map_affinities: dict = field(default_factory=dict)
    agent_map_affinities: dict = field(default_factory=dict)
    confidence: float = 0.0
    source: str = "unavailable"
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_map_context(match: dict, *, round_number: int, side: str | None) -> MapContext:
    info = match.get("matchInfo") or {}
    map_id = info.get("mapId") or info.get("map_id")
    map_name = info.get("mapName") or info.get("map_name")
    map_url = info.get("mapUrl") or info.get("map_url")
    catalog = load_map_catalog()
    item = catalog.get(str(map_id)) if map_id else None
    if not item and map_id:
        item = next((value for key, value in catalog.items() if str(key).lower() == str(map_id).lower()), None)
    map_name = map_name or (item or {}).get("displayName")
    map_url = map_url or (item or {}).get("mapUrl")
    if not map_name and not map_id:
        return MapContext(False, None, None, None, side, round_number, None,
                          warnings=["map_context_unavailable"])
    profile = dict(MAP_PROFILES.get(str(map_name or "").strip().lower(), {}))
    warnings = [] if profile else ["map_profile_unknown"]
    return MapContext(True, str(map_id) if map_id else None, str(map_name) if map_name else None,
                      str(map_url) if map_url else None, side, round_number,
                      1 if round_number <= 12 else 2, profile,
                      {key: value for key, value in profile.items() if key.endswith("_affinity")}, {},
                      .9 if item else .65, "match_info+content_catalog" if item else "match_info", warnings)
