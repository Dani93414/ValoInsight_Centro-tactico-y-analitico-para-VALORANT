from fastapi import APIRouter, Query, HTTPException
from modules.content.application.content_services import (
    get_leaderboard_acto,
    get_leaderboard_regions,
    get_rank_distribution,
)

router = APIRouter()

@router.get("/meta/regions")
def leaderboard_regions():
    return get_leaderboard_regions()


@router.get("/meta/rank-distribution")
def leaderboard_rank_distribution(act_ids: str = Query(default="", max_length=4096)):
    ids = [act_id.strip() for act_id in act_ids.split(",") if act_id.strip()]
    return get_rank_distribution(ids)

@router.get("/{act_id}")
def leaderboard_acto(
    act_id: str,
    region: str = Query(default="eu", max_length=16),
    platform: str = Query(default="pc", pattern="^pc$"),
    limit: int = Query(default=200, ge=1, le=500),
    page: int = Query(default=1, ge=1),
    search: str = Query(default="", max_length=128),
    game_name: str = Query(default="", max_length=64),
    tag_line: str = Query(default="", max_length=32),
):
    """
    Devuelve el leaderboard de un acto concreto.
    """
    data = get_leaderboard_acto(
        act_id,
        region=region,
        platform=platform,
        limit=limit,
        page=page,
        search=search,
        game_name=game_name,
        tag_line=tag_line,
    )

    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"No existe leaderboard para el acto {act_id}"
        )

    return data
