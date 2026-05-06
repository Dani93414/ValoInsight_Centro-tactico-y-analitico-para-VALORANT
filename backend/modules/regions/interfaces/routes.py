from fastapi import APIRouter, Query
from modules.regions.application.agent_stats_service import get_global_agent_stats
from modules.regions.infrastructure import mongo_region_repo

router = APIRouter()

@router.get("/")
def get_regions():
    """
    Devuelve las estadísticas globales de todas las regiones 
    recalculadas por el motor central.
    """
    return mongo_region_repo.get_all_sorted()


@router.get("/agent-stats")
def get_agent_stats(
    region: str | None = Query(default=None, max_length=32),
    rank: str | None = Query(default=None, max_length=64),
    map: str | None = Query(default=None, max_length=128),
    act: str | None = Query(default=None, max_length=128),
    role: str | None = Query(default=None, max_length=64),
):
    """Global agent stats aggregated from matches_collection with global filters."""
    return get_global_agent_stats(
        region=region,
        rank=rank,
        map_id=map,
        act_id=act,
        role=role,
    )
