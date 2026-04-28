from fastapi import APIRouter, HTTPException, Query
from typing import Any, Optional

from modules.analytics.application.filters import AnalyticsFilters
from modules.analytics.application.service import get_player_performance
from modules.analytics.application.get_heatmap_events import get_heatmap_events, get_agent_stats
from modules.analytics.application.get_heatmap_filters import get_heatmap_filter_options
from modules.analytics.infrastructure.heatmap_extractor import ALL_EVENT_TYPES
from modules.analytics.infrastructure.mongo_analytics_repo import (
    MAX_HEATMAP_MATCHES_PER_MAP,
)

router = APIRouter()

ROUND_PHASE_ORDER = ["early", "mid", "post_plant", "late"]
MAX_CSV_VALUES = 100
MAX_IDENTIFIER_LENGTH = 128


def _parse_csv_values(
    raw_value: Optional[str],
    *,
    field_name: str,
    max_values: int = MAX_CSV_VALUES,
    max_length: int = MAX_IDENTIFIER_LENGTH,
) -> list[str]:
    if not raw_value:
        return []
    values = [value.strip() for value in raw_value.split(",") if value.strip()]
    if len(values) > max_values:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} accepts at most {max_values} comma-separated values",
        )
    too_long = next((value for value in values if len(value) > max_length), None)
    if too_long:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} values must be {max_length} characters or fewer",
        )
    return values


@router.get("/player/{puuid}")
def player_performance(
    puuid: str,
    map_id: str | None = Query(default=None, max_length=MAX_IDENTIFIER_LENGTH),
    agent_id: str | None = Query(default=None, max_length=MAX_IDENTIFIER_LENGTH),
    season_id: str | None = Query(default=None, max_length=MAX_IDENTIFIER_LENGTH),
    weapon_id: str | None = Query(default=None, max_length=MAX_IDENTIFIER_LENGTH),
    side: str | None = Query(default=None, max_length=16, description="attack | defense"),
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
    map_id: str = Query(..., max_length=MAX_IDENTIFIER_LENGTH, description="Map UUID (required)"),
    event_type: Optional[str] = Query(
        default=None,
        max_length=512,
        description="Comma-separated: kill,kill_enemy_position,death,first_blood,plant,defuse",
    ),
    agent_id: Optional[str] = Query(default=None, max_length=MAX_IDENTIFIER_LENGTH),
    side: Optional[str] = Query(default=None, max_length=16, description="attack | defense"),
    season_id: Optional[str] = Query(default=None, max_length=2048),
    round_phase: Optional[str] = Query(
        default=None,
        max_length=16,
        description="early | mid | post_plant | late",
    ),
    match_ids: Optional[str] = Query(
        default=None,
        max_length=8192,
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
        requested_types = set(
            _parse_csv_values(event_type, field_name="event_type", max_values=len(ALL_EVENT_TYPES))
        )
        invalid_types = requested_types - ALL_EVENT_TYPES
        if not requested_types or invalid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid event_type. Must be comma-separated subset of: {', '.join(sorted(ALL_EVENT_TYPES))}",
            )
        wanted_types = requested_types

    season_ids = _parse_csv_values(season_id, field_name="season_id")
    requested_match_ids_set = set(
        _parse_csv_values(
            match_ids,
            field_name="match_ids",
            max_values=MAX_HEATMAP_MATCHES_PER_MAP,
        )
    ) or None
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
    map_id: str = Query(..., max_length=MAX_IDENTIFIER_LENGTH, description="Map UUID (required)"),
    season_id: Optional[str] = Query(default=None, max_length=2048),
):
    """
    Return per-agent match counts for a player on a specific map.
    Used to populate the agent filter with only relevant agents and to
    auto-select the most-played agent.
    """
    season_ids = _parse_csv_values(season_id, field_name="season_id") or None
    return get_agent_stats(puuid, map_id=map_id, season_ids=season_ids)


@router.get("/heatmap/{puuid}/filter-options")
def heatmap_filter_options(
    puuid: str,
    map_id: Optional[str] = Query(default=None, max_length=MAX_IDENTIFIER_LENGTH),
    event_type: Optional[str] = Query(
        default=None,
        max_length=512,
        description="Comma-separated: kill,kill_enemy_position,death,first_blood,plant,defuse",
    ),
    agent_id: Optional[str] = Query(default=None, max_length=MAX_IDENTIFIER_LENGTH),
    side: Optional[str] = Query(default=None, max_length=16, description="attack | defense"),
    season_id: Optional[str] = Query(default=None, max_length=2048),
    round_phase: Optional[str] = Query(
        default=None,
        max_length=16,
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
        parsed = set(
            _parse_csv_values(event_type, field_name="event_type", max_values=len(ALL_EVENT_TYPES))
        )
        if not parsed or (parsed - ALL_EVENT_TYPES):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid event_type. Must be comma-separated subset of: "
                    f"{', '.join(sorted(ALL_EVENT_TYPES))}"
                ),
            )

    season_ids = _parse_csv_values(season_id, field_name="season_id")
    map_filter = (map_id or "").strip() or None
    agent_filter = (agent_id or "").strip() or None

    return get_heatmap_filter_options(
        puuid,
        map_filter=map_filter,
        season_ids=season_ids or None,
        agent_filter=agent_filter,
    )
