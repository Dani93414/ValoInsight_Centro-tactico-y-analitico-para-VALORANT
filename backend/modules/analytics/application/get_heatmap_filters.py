"""Use case: build dynamic filter options for the heatmap UI."""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Optional

from modules.analytics.infrastructure import mongo_analytics_repo
from modules.analytics.infrastructure.heatmap_extractor import _get_map_transform


def _empty_filter_options_payload() -> dict[str, list[dict[str, Any]]]:
    return {
        "maps": [],
        "acts": [],
        "agents": [],
        "eventTypes": [],
        "sides": [],
        "phases": [],
    }


def get_heatmap_filter_options(
    puuid: str,
    *,
    map_filter: Optional[str] = None,
    season_ids: Optional[list[str]] = None,
    agent_filter: Optional[str] = None,
) -> dict[str, list[dict[str, Any]]]:
    """Return available filter options based on the player's ranked match universe."""
    analytics_rows = mongo_analytics_repo.find_ranked_analytics_rows(puuid)
    if not analytics_rows:
        return _empty_filter_options_payload()

    maps_catalog = mongo_analytics_repo.heatmap_maps_by_uuid()
    season_set = set(season_ids or [])

    rows_meta: list[dict[str, str]] = []
    for row in analytics_rows:
        candidate_map_id = str(row.get("map_id") or "").strip()
        if not candidate_map_id:
            continue
        if _get_map_transform(candidate_map_id) is None:
            continue
        rows_meta.append({
            "map_id": candidate_map_id,
            "season_id": str(row.get("season_id") or "").strip(),
            "agent_id": str(row.get("agent_id") or "").strip(),
        })

    if not rows_meta:
        return _empty_filter_options_payload()

    def row_matches(
        row: dict[str, str],
        *,
        include_map: bool = True,
        include_season: bool = True,
        include_agent: bool = True,
    ) -> bool:
        if include_map and map_filter and row["map_id"] != map_filter:
            return False
        if include_season and season_set and row["season_id"] not in season_set:
            return False
        if include_agent and agent_filter and row["agent_id"] != agent_filter:
            return False
        return True

    # Map options
    map_match_counts: dict[str, int] = defaultdict(int)
    for row in rows_meta:
        if not row_matches(row, include_map=False):
            continue
        map_match_counts[row["map_id"]] += 1

    map_options: list[dict[str, Any]] = []
    for candidate_map_id, match_count in map_match_counts.items():
        if match_count <= 0:
            continue
        map_item = maps_catalog.get(candidate_map_id) or {}
        map_options.append({
            "id": candidate_map_id,
            "label": map_item.get("displayName") or candidate_map_id,
            "event_count": match_count,
        })
    map_options.sort(key=lambda item: (-int(item["event_count"]), str(item["label"]).lower()))

    # Act options
    act_counts: dict[str, int] = defaultdict(int)
    for row in rows_meta:
        if not row_matches(row, include_season=False):
            continue
        if row["season_id"]:
            act_counts[row["season_id"]] += 1

    act_options = [
        {"id": act_id_value, "event_count": count}
        for act_id_value, count in act_counts.items()
        if count > 0
    ]
    act_options.sort(key=lambda item: -int(item["event_count"]))

    # Agent options
    agent_counts: dict[str, int] = defaultdict(int)
    for row in rows_meta:
        if not row_matches(row, include_agent=False):
            continue
        if row["agent_id"]:
            agent_counts[row["agent_id"]] += 1

    agent_options = [
        {"id": candidate_agent_id, "event_count": count}
        for candidate_agent_id, count in agent_counts.items()
        if count > 0
    ]
    agent_options.sort(key=lambda item: -int(item["event_count"]))

    return {
        "maps": map_options,
        "acts": act_options,
        "agents": agent_options,
        "eventTypes": [],
        "sides": [],
        "phases": [],
    }
