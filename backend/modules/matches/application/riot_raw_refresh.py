"""Safe legacy-to-v2 replacement, preserving useful non-RAW state."""
from __future__ import annotations

import copy
from typing import Any

from ingestion.riot_raw_adapter import adapt_riot_raw_match
from modules.matches.domain.schema import refresh_stamp


def _present(value: Any) -> bool:
    return value not in (None, "", [], {})


_HENRIK_PLAYER_FIELDS: dict[str, tuple[str, ...]] = {
    "gameName": ("name", "gameName", "game_name"),
    "tagLine": ("tag", "tagLine", "tag_line"),
    "competitiveTier": ("currenttier", "competitiveTier", "competitive_tier"),
    "playerCard": ("player_card", "playerCard", "card"),
    "playerTitle": ("player_title", "playerTitle", "title"),
    "accountLevel": ("account_level", "accountLevel", "level"),
}


def needs_henrik_enrichment(match: dict[str, Any]) -> bool:
    """Whether a RAW-normalised match lacks v4 presentation metadata."""
    return any(
        any(not _present(player.get(field)) for field in _HENRIK_PLAYER_FIELDS)
        for player in (match.get("players") or [])
        if isinstance(player, dict)
    )


def enrich_riot_raw_with_henrik_match(match: dict[str, Any], henrik_match: dict[str, Any]) -> list[str]:
    """Fill absent presentation fields from v4 without replacing RAW gameplay."""
    candidates = henrik_match.get("players") or []
    by_puuid = {
        str(player.get("puuid") or "").strip(): player
        for player in candidates
        if isinstance(player, dict) and str(player.get("puuid") or "").strip()
    }
    filled: list[str] = []
    for player in match.get("players") or []:
        if not isinstance(player, dict):
            continue
        fallback = by_puuid.get(str(player.get("puuid") or "").strip())
        if not fallback:
            continue
        for target, aliases in _HENRIK_PLAYER_FIELDS.items():
            if _present(player.get(target)):
                continue
            value = next((fallback.get(alias) for alias in aliases if _present(fallback.get(alias))), None)
            if _present(value):
                player[target] = copy.deepcopy(value)
                filled.append(target)

    # Keep the RAW map path as matchInfo.mapId.  v4 labels are useful only as
    # supplemental display metadata; map matching remains based on mapUrl.
    metadata = henrik_match.get("metadata") or {}
    map_data = metadata.get("map") or {}
    match_info = match.get("matchInfo") or {}
    if not _present(match_info.get("legacyMapName")) and _present(map_data.get("name")):
        match_info["legacyMapName"] = map_data["name"]
        match["matchInfo"] = match_info
        filled.append("legacyMapName")
    return sorted(set(filled))


def merge_riot_raw_match(existing: dict[str, Any] | None, normalized: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """Prefer meaningful RAW values while never losing legacy names or analytics."""
    old = existing or {}
    old_match_id = (old.get("matchInfo") or {}).get("matchId")
    raw_match_id = (normalized.get("matchInfo") or {}).get("matchId")
    if old_match_id and raw_match_id != old_match_id:
        raise ValueError(f"RAW matchId mismatch: requested {old_match_id!r}, received {raw_match_id!r}")
    merged = copy.deepcopy(normalized)
    changes: list[str] = []
    old_players = {p.get("puuid"): p for p in (old.get("players") or []) if p.get("puuid")}
    for player in merged.get("players") or []:
        previous = old_players.get(player.get("puuid")) or {}
        # RAW is authoritative only when it actually supplies a value.  Some
        # historical RAW responses omit presentation/account metadata that the
        # legacy Henrik document already has.
        for field in (
            "gameName",
            "tagLine",
            "competitiveTier",
            "playerCard",
            "playerTitle",
            "accountLevel",
        ):
            if not _present(player.get(field)) and _present(previous.get(field)):
                player[field] = previous[field]
        # Analytics are derived but preserving them makes a failed later rebuild non-destructive.
        if _present(previous.get("analytics")):
            player["analytics"] = copy.deepcopy(previous["analytics"])
    # Preserve unknown application-owned fields only; RAW remains authoritative for base match data.
    raw_owned = {"dataSchema", "rawRefresh", "matchInfo", "players", "coaches", "teams", "roundResults", "riotPerformance"}
    for field, value in old.items():
        if field not in raw_owned and field not in merged:
            merged[field] = copy.deepcopy(value)
    if old:
        changes.append("schema v1 → v2" if (old.get("dataSchema") or {}).get("version", 1) < 2 else "riot_raw refreshed")
    if merged.get("matchInfo", {}).get("gamePodId"):
        changes.append("server metadata")
    if any((p.get("performance") or {}).get("available") for p in merged.get("players") or []):
        changes.append("performance")
    if any((s.get("economy") or {}).get("spentSource") == "riot_raw" for r in merged.get("roundResults") or [] for s in r.get("playerStats") or []):
        changes.append("observed economy")
    merged["rawRefresh"] = refresh_stamp("success")
    return merged, changes


def normalize_and_merge(raw: dict[str, Any], existing: dict[str, Any] | None, *, region: str, platform: str) -> tuple[dict[str, Any], list[str]]:
    return merge_riot_raw_match(existing, adapt_riot_raw_match(raw, region=region, platform=platform))
