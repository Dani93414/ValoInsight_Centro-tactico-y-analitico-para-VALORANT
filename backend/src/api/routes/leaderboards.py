from fastapi import APIRouter, Query, HTTPException
from src.services.content_services import get_leaderboard_acto

router = APIRouter()

@router.get("/{act_id}")
def leaderboard_acto(act_id: str, limit: int = 200):
    """
    Devuelve el leaderboard de un acto concreto.
    """
    data = get_leaderboard_acto(act_id, limit=limit)

    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"No existe leaderboard para el acto {act_id}"
        )

    return data
