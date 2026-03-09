from fastapi import APIRouter, HTTPException, Query
from db.mongo_client import players_collection, player_match_analytics_collection
from src.services.player_dashboard_service import get_player_dashboard

router = APIRouter()


def _aggregate_player_overview(player_docs: list[dict]) -> dict:
    """Agrega métricas numéricas de `overview` para devolver una vista rápida por jugador."""
    totals: dict[str, float] = {}

    for doc in player_docs:
        overview = doc.get("overview", {})
        if not isinstance(overview, dict):
            continue

        for key, value in overview.items():
            if isinstance(value, (int, float)):
                totals[key] = totals.get(key, 0.0) + float(value)

    matches = len(player_docs)
    rounds = int(totals.get("rounds", 0))
    deaths = max(float(totals.get("deaths", 0)), 1.0)

    totals["matches"] = float(matches)
    totals["kd_ratio"] = round(float(totals.get("kills", 0)) / deaths, 4)
    totals["win_rate"] = round((float(totals.get("wins", 0)) / rounds) * 100.0, 2) if rounds else 0.0
    totals["acs"] = round(float(totals.get("score", 0)) / rounds, 2) if rounds else 0.0
    totals["adr"] = round(float(totals.get("damage_dealt", 0)) / rounds, 2) if rounds else 0.0

    # Devuelve int cuando no hay decimales para mejor visualización en frontend
    normalized: dict[str, int | float] = {}
    for key, value in totals.items():
        normalized[key] = int(value) if float(value).is_integer() else value
    return normalized

@router.get("/")
def get_players_list(
    gameName: str | None = Query(default=None),
    tagLine: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
):
    """Lista jugadores o busca por gameName/tagLine con coincidencia parcial (case-insensitive)."""
    query: dict = {}

    if gameName:
        query["gameName"] = {"$regex": gameName, "$options": "i"}

    if tagLine:
        query["tagLine"] = {"$regex": tagLine, "$options": "i"}

    cursor = players_collection.find(query, {"_id": 0}).limit(limit)
    return list(cursor)


@router.get("/search")
def search_players(
    gameName: str | None = Query(default=None),
    tagLine: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
):
    """Búsqueda optimizada para autocompletado en frontend."""
    if not gameName and not tagLine:
        return []

    query: dict = {}
    if gameName:
        query["gameName"] = {"$regex": gameName, "$options": "i"}
    if tagLine:
        query["tagLine"] = {"$regex": tagLine, "$options": "i"}

    cursor = players_collection.find(
        query,
        {
            "_id": 0,
            "puuid": 1,
            "gameName": 1,
            "tagLine": 1,
        },
    ).limit(limit)
    return list(cursor)

@router.get("/{puuid}")
def get_player_detail(puuid: str):
    """Obtiene el perfil detallado de un jugador específico"""
    player = players_collection.find_one({"puuid": puuid}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    return player


@router.get("/{puuid}/stats")
def get_player_stats(puuid: str):
    """Devuelve perfil + analytics del jugador unificados por puuid."""
    player = players_collection.find_one({"puuid": puuid}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")

    player_docs = list(
        player_match_analytics_collection.find(
            {"puuid": puuid},
            {
                "_id": 0,
                "match_id": 1,
                "won_match": 1,
                "is_ranked": 1,
                "queue_id": 1,
                "game_mode": 1,
                "region": 1,
                "game_start_millis": 1,
                "season_id": 1,
                "map_id": 1,
                "map_name": 1,
                "agent_id": 1,
                "agent_name": 1,
                "overview": 1,
                "role": 1,
                "competitive_tier": 1,
                "account_level": 1,
                "player_totals_from_match": 1,
            },
        )
    )

    overview = _aggregate_player_overview(player_docs)

    # Conteo por rol para aportar contexto útil sin cómputo pesado
    by_role: dict[str, int] = {}
    for doc in player_docs:
        role = doc.get("role") or "Desconocido"
        by_role[role] = by_role.get(role, 0) + 1

    analytics = {
        "puuid": puuid,
        "matches": player_docs,
        "sample": {
            "matches": len(player_docs),
            "rounds": int(overview.get("rounds", 0)) if isinstance(overview.get("rounds", 0), (int, float)) else 0,
        },
        "overview": overview,
        "rating": {},
        "by_role": by_role,
    }

    return {
        "player": player,
        "analytics": analytics,
    }


@router.get("/{puuid}/dashboard")
def get_player_dashboard_data(
    puuid: str,
    limit: int = Query(default=500, ge=1, le=2000),
):
    """Devuelve un payload ya calculado para renderizar Estadisticas.tsx sin logica pesada en frontend."""
    player = players_collection.find_one({"puuid": puuid}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")

    dashboard = get_player_dashboard(puuid=puuid, player=player, limit=limit)
    return dashboard