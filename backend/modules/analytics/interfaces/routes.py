from fastapi import APIRouter, HTTPException, Query
from typing import Any, Optional

from modules.analytics.application.filters import AnalyticsFilters
from modules.analytics.application.service import get_player_performance
from modules.analytics.application.get_heatmap_events import get_heatmap_events, get_agent_stats
from modules.analytics.application.get_heatmap_filters import get_heatmap_filter_options
from modules.analytics.infrastructure.heatmap_extractor import ALL_EVENT_TYPES

router = APIRouter()

ROUND_PHASE_ORDER = ["early", "mid", "post_plant", "late"]


def _parse_csv_values(raw_value: Optional[str]) -> list[str]:
    if not raw_value:
        return []
    return [value.strip() for value in raw_value.split(",") if value.strip()]


@router.get("/player/{puuid}")
def player_performance(
    puuid: str,
    map_id: str | None = Query(default=None),
    agent_id: str | None = Query(default=None),
    season_id: str | None = Query(default=None),
    weapon_id: str | None = Query(default=None),
    side: str | None = Query(default=None, description="attack | defense"),
):
    try:
        filters = AnalyticsFilters(
            map_id=map_id,
            agent_id=agent_id,
            season_id=season_id,
            weapon_id=weapon_id,
            side=side,
        )
        return get_player_performance(puuid=puuid, filters=filters)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/heatmap/{puuid}")
def heatmap_events_endpoint(
    puuid: str,
    map_id: str = Query(..., description="Map UUID (required)"),
    event_type: Optional[str] = Query(
        default=None,
        description="Comma-separated: kill,kill_enemy_position,death,first_blood,plant,defuse",
    ),
    agent_id: Optional[str] = Query(default=None),
    side: Optional[str] = Query(default=None, description="attack | defense"),
    season_id: Optional[str] = Query(default=None),
    round_phase: Optional[str] = Query(
        default=None,
        description="early | mid | post_plant | late",
    ),
    match_ids: Optional[str] = Query(
        default=None,
        description="Comma-separated match IDs",
    ),
    debug: bool = Query(
        default=False,
        description="Include debug metadata (transform params and validation sample)",
    ),
):
    """
    Return spatial events for a player on a specific map, suitable for heatmap
    rendering.  Coordinates are normalised 0-1 (top-left origin).
    """
    map_filter = (map_id or "").strip()
    if not map_filter:
        raise HTTPException(status_code=400, detail="map_id is required")

    side_filter = (side or "").strip().lower() or None
    if side_filter and side_filter not in {"attack", "defense"}:
        raise HTTPException(status_code=400, detail="Invalid side. Use attack | defense")

    round_phase_filter = (round_phase or "").strip().lower() or None
    if round_phase_filter and round_phase_filter not in set(ROUND_PHASE_ORDER):
        raise HTTPException(
            status_code=400,
            detail="Invalid round_phase. Use early | mid | post_plant | late",
        )

    # Parse event types
    wanted_types: Optional[set[str]] = None
    if event_type:
        wanted_types = {
            e.strip() for e in event_type.split(",") if e.strip() in ALL_EVENT_TYPES
        }
        if not wanted_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid event_type. Must be comma-separated subset of: {', '.join(ALL_EVENT_TYPES)}",
            )

    season_ids = _parse_csv_values(season_id)
    requested_match_ids_set = set(_parse_csv_values(match_ids)) or None
    agent_filter = (agent_id or "").strip() or None

    result = get_heatmap_events(
        puuid,
        map_id=map_filter,
        event_types=wanted_types,
        agent_id=agent_filter,
        side_filter=side_filter,
        season_ids=season_ids or None,
        round_phase_filter=round_phase_filter,
        requested_match_ids=requested_match_ids_set,
        debug=debug,
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.get("/heatmap/{puuid}/agent-stats")
def heatmap_agent_stats(
    puuid: str,
    map_id: str = Query(..., description="Map UUID (required)"),
    season_id: Optional[str] = Query(default=None),
):
    """
    Return per-agent match counts for a player on a specific map.
    Used to populate the agent filter with only relevant agents and to
    auto-select the most-played agent.
    """
    season_ids = _parse_csv_values(season_id) or None
    return get_agent_stats(puuid, map_id=map_id, season_ids=season_ids)


@router.get("/heatmap/{puuid}/filter-options")
def heatmap_filter_options(
    puuid: str,
    map_id: Optional[str] = Query(default=None),
    event_type: Optional[str] = Query(
        default=None,
        description="Comma-separated: kill,kill_enemy_position,death,first_blood,plant,defuse",
    ),
    agent_id: Optional[str] = Query(default=None),
    side: Optional[str] = Query(default=None, description="attack | defense"),
    season_id: Optional[str] = Query(default=None),
    round_phase: Optional[str] = Query(
        default=None,
        description="early | mid | post_plant | late",
    ),
):
    side_filter = (side or "").strip().lower() or None
    if side_filter and side_filter not in {"attack", "defense"}:
        raise HTTPException(status_code=400, detail="Invalid side. Use attack | defense")

    round_phase_filter = (round_phase or "").strip().lower() or None
    if round_phase_filter and round_phase_filter not in set(ROUND_PHASE_ORDER):
        raise HTTPException(
            status_code=400,
            detail="Invalid round_phase. Use early | mid | post_plant | late",
        )

    if event_type:
        parsed = {
            value.strip()
            for value in event_type.split(",")
            if value.strip() in ALL_EVENT_TYPES
        }
        if not parsed:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid event_type. Must be comma-separated subset of: "
                    f"{', '.join(sorted(ALL_EVENT_TYPES))}"
                ),
            )

    season_ids = _parse_csv_values(season_id)
    map_filter = (map_id or "").strip() or None
    agent_filter = (agent_id or "").strip() or None

    return get_heatmap_filter_options(
        puuid,
        map_filter=map_filter,
        season_ids=season_ids or None,
        agent_filter=agent_filter,
    )
