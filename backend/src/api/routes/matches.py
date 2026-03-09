from fastapi import APIRouter, HTTPException, Query

from db.mongo_client import matches_collection
from src.services.content_services import get_matches_by_player

router = APIRouter()


@router.get("/")
def list_matches(limit: int = Query(default=20, ge=1, le=200)):
    """Lista partidas guardadas en MongoDB (más recientes primero)."""
    cursor = (
        matches_collection.find({}, {"_id": 0})
        .sort("matchInfo.gameStartMillis", -1)
        .limit(limit)
    )
    return list(cursor)


@router.get("/player/{puuid}")
def list_matches_by_player(puuid: str, limit: int = Query(default=50, ge=1, le=1000)):
    """Devuelve las últimas partidas de un jugador usando su puuid."""
    return get_matches_by_player(puuid, limit=limit)


@router.get("/{match_id}")
def get_match_detail(match_id: str):
    """Obtiene el detalle de una partida por matchInfo.matchId."""
    match_doc = matches_collection.find_one({"matchInfo.matchId": match_id}, {"_id": 0})
    if not match_doc:
        raise HTTPException(status_code=404, detail="Partida no encontrada")
    return match_doc