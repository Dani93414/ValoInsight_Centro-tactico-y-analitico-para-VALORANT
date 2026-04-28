from fastapi import APIRouter, Query, HTTPException
from modules.content.application.content_services import get_leaderboard_acto

router = APIRouter()

@router.get("/{act_id}")
def leaderboard_acto(
    act_id: str,
    region: str = Query(default="eu", max_length=16),
    limit: int = Query(default=200, ge=1, le=500),
):
    """
    Devuelve el leaderboard de un acto concreto.
    """
    data = get_leaderboard_acto(act_id, region=region, limit=limit)

    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"No existe leaderboard para el acto {act_id}"
        )

    return data
