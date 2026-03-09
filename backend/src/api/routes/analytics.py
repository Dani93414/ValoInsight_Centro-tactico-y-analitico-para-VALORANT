from fastapi import APIRouter, HTTPException, Query

from src.api.analytic.schemas import AnalyticsFilters
from src.api.analytic.service import get_player_performance

router = APIRouter()


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
