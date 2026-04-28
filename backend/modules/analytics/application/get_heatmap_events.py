"""Use case: retrieve spatial events for heatmap rendering."""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Optional

from modules.analytics.infrastructure import mongo_analytics_repo
from modules.analytics.infrastructure.heatmap_extractor import (
    extract_spatial_events,
    ALL_EVENT_TYPES,
    _get_map_transform,
)
from modules.analytics.domain.heatmap_transformer import build_transform_meta, transform_coords


FRACTURE_MAP_UUID = "b529448b-4d60-346e-e89e-00a4c527a405"
FRACTURE_BRIDGE_SAMPLE = {
    "game_x": 11473.0,
    "game_y": -2897.0,
    "expected_x": 0.3315,
    "expected_y": 0.2615,
}


def build_debug_payload(map_id: str, tf: dict[str, float]) -> dict[str, Any]:
    debug_payload: dict[str, Any] = {
        "map_id": map_id,
        "transform": build_transform_meta(tf),
    }
    if map_id == FRACTURE_MAP_UUID:
        nx, ny = transform_coords(
            FRACTURE_BRIDGE_SAMPLE["game_x"],
            FRACTURE_BRIDGE_SAMPLE["game_y"],
            tf,
        )
        debug_payload["fracture_bridge_reference"] = {
            "callout": "Bridge",
            "game_x": FRACTURE_BRIDGE_SAMPLE["game_x"],
            "game_y": FRACTURE_BRIDGE_SAMPLE["game_y"],
            "normalized_x": nx,
            "normalized_y": ny,
            "expected_approx": {
                "x": FRACTURE_BRIDGE_SAMPLE["expected_x"],
                "y": FRACTURE_BRIDGE_SAMPLE["expected_y"],
            },
            "delta": {
                "x": nx - FRACTURE_BRIDGE_SAMPLE["expected_x"],
                "y": ny - FRACTURE_BRIDGE_SAMPLE["expected_y"],
            },
        }
    return debug_payload


def _player_agent_for_match(match: dict[str, Any], puuid: str) -> Optional[str]:
    for player in match.get("players", []):
        if player.get("puuid") == puuid:
            agent_id = player.get("characterId")
            return str(agent_id) if agent_id else None
    return None


def _filter_matches(
    matches: list[dict[str, Any]],
    puuid: str,
    *,
    agent_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    if not agent_id:
        return matches
    return [
        m for m in matches
        if _player_agent_for_match(m, puuid) == agent_id
    ]


def get_heatmap_events(
    puuid: str,
    *,
    map_id: str,
    event_types: Optional[set[str]] = None,
    agent_id: Optional[str] = None,
    side_filter: Optional[str] = None,
    season_ids: Optional[list[str]] = None,
    round_phase_filter: Optional[str] = None,
    requested_match_ids: Optional[set[str]] = None,
    debug: bool = False,
) -> dict[str, Any]:
    """Core use case — returns events + meta for heatmap rendering."""
    tf = _get_map_transform(map_id)
    if tf is None:
        return {"error": f"Map {map_id} not found or missing coordinate transform data"}

    # Resolve matches from ranked analytics rows
    analytics_rows = mongo_analytics_repo.find_ranked_analytics_rows(
        puuid,
        map_id=map_id,
        season_ids=season_ids or None,
        agent_id=agent_id,
        limit=mongo_analytics_repo.MAX_HEATMAP_MATCHES_PER_MAP,
    )
    allowed_match_ids = {
        str(row.get("match_id") or "").strip()
        for row in analytics_rows
        if str(row.get("match_id") or "").strip()
    }
    if requested_match_ids:
        allowed_match_ids &= requested_match_ids
    total_matches_available = len(allowed_match_ids)

    if allowed_match_ids:
        matches = mongo_analytics_repo.find_heatmap_matches(
            puuid, match_ids=allowed_match_ids, map_id=map_id,
        )
    elif analytics_rows:
        matches = []
    else:
        # Fallback
        matches = mongo_analytics_repo.find_heatmap_matches_fallback(
            puuid, map_id=map_id, season_ids=season_ids,
            match_ids=requested_match_ids, ranked_only=True,
        )
        if not matches:
            matches = mongo_analytics_repo.find_heatmap_matches_fallback(
                puuid, map_id=map_id, season_ids=season_ids,
                match_ids=requested_match_ids, ranked_only=False,
            )

    if agent_id and matches:
        matches = _filter_matches(matches, puuid, agent_id=agent_id)

    events = extract_spatial_events(
        matches,
        puuid,
        map_transform=tf,
        event_types=event_types,
        agent_id=agent_id,
        side_filter=side_filter,
        round_phase_filter=round_phase_filter,
    )

    seen_matches: set[str] = set()
    seen_rounds: set[tuple[str, int]] = set()
    for ev in events:
        seen_matches.add(ev.get("match_id", ""))
        seen_rounds.add((ev.get("match_id", ""), ev.get("round_num", 0)))

    map_catalog = mongo_analytics_repo.heatmap_maps_by_uuid()
    map_label = (map_catalog.get(map_id) or {}).get("displayName") or map_id

    response_meta: dict[str, Any] = {
        "max_matches_per_map": mongo_analytics_repo.MAX_HEATMAP_MATCHES_PER_MAP,
        "total_matches_available": total_matches_available,
        "total_matches_queried": len(matches),
        "is_truncated": total_matches_available > len(matches),
        "total_matches_with_events": len(seen_matches),
        "total_rounds_with_events": len(seen_rounds),
        "total_events": len(events),
        "map_id": map_id,
        "map_name": map_label,
        "transform": build_transform_meta(tf),
    }
    if debug:
        response_meta["debug"] = build_debug_payload(map_id, tf)

    return {"events": events, "meta": response_meta}


def get_agent_stats(
    puuid: str,
    *,
    map_id: str,
    season_ids: Optional[list[str]] = None,
) -> list[dict[str, Any]]:
    """Per-agent match counts for a player on a specific map."""
    matches = mongo_analytics_repo.find_agent_stats_for_player(
        puuid, map_id=map_id, season_ids=season_ids,
    )

    agent_counts: dict[str, int] = {}
    for match in matches:
        for player in match.get("players", []):
            if player.get("puuid") == puuid:
                aid = player.get("characterId", "")
                if aid:
                    agent_counts[aid] = agent_counts.get(aid, 0) + 1
                break

    result = [
        {"agent_id": aid, "match_count": count}
        for aid, count in agent_counts.items()
    ]
    result.sort(key=lambda x: x["match_count"], reverse=True)
    return result
