import copy

from fastapi import APIRouter, HTTPException, Query
from modules.players.infrastructure import mongo_player_repo
from modules.players.application.player_dashboard_service import (
    get_player_dashboard,
    get_player_rank_comparison,
)

router = APIRouter()


@router.get("/")
def get_players_list(
    gameName: str | None = Query(default=None),
    tagLine: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
):
    """Lista jugadores o busca por gameName/tagLine con coincidencia parcial (case-insensitive)."""
    return mongo_player_repo.list_players(game_name=gameName, tag_line=tagLine, limit=limit)


@router.get("/search")
def search_players(
    gameName: str | None = Query(default=None),
    tagLine: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
):
    """Búsqueda optimizada para autocompletado en frontend."""
    return mongo_player_repo.search_players(game_name=gameName, tag_line=tagLine, limit=limit)


@router.get("/{puuid}")
def get_player_detail(puuid: str):
    """Obtiene el perfil detallado de un jugador específico"""
    player = mongo_player_repo.find_by_puuid(puuid)
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    return player


@router.get("/{puuid}/stats")
def get_player_stats(puuid: str):
    """Devuelve perfil + analytics del jugador unificados por puuid."""
    player = mongo_player_repo.find_by_puuid(puuid)
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")

    player_docs = mongo_player_repo.find_ranked_matches_for_player(puuid)
    overview = mongo_player_repo.aggregate_player_overview(player_docs)

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
    queue_id: str | None = Query(default=None, description="Filter matches by queue type (e.g. 'competitive')"),
    agent_id: str | None = Query(default=None, description="Filter matches by agent UUID"),
    map_name: str | None = Query(default=None, description="Filter matches by map name"),
    season_id: str | None = Query(default=None, description="Filter matches by act/season id"),
    page: int = Query(default=1, ge=1, description="Page number for match cards"),
    page_size: int | None = Query(
        default=None,
        ge=1,
        le=5000,
        description="Match cards per page. If omitted, returns all matches.",
    ),
):
    """Devuelve un payload ya calculado para renderizar Estadisticas.tsx sin logica pesada en frontend."""
    player = mongo_player_repo.find_by_puuid(puuid)
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")

    # Work on a copy to avoid mutating the cached base dashboard.
    dashboard = copy.deepcopy(get_player_dashboard(puuid=puuid, player=player))

    # ---- Post-filter actSections matches (global stats stay untouched) ----
    has_filters = any([queue_id, agent_id, map_name, season_id])
    if has_filters:
        act_sections = dashboard.get("actSections", {})
        for act_id, section in list(act_sections.items()):
            matches = section.get("matches", [])
            filtered = matches
            if queue_id:
                filtered = [m for m in filtered if (m.get("queue") or "").lower() == queue_id.lower()]
            if agent_id:
                filtered = [m for m in filtered if m.get("agentId") == agent_id]
            if map_name:
                filtered = [m for m in filtered if (m.get("map") or "").lower() == map_name.lower()]
            if season_id:
                # If filtering by season, only keep the matching act section
                if act_id != season_id:
                    filtered = []
            section["matches"] = filtered
            section["summary"]["matches"] = len(filtered)

        # Remove empty act sections after filtering
        dashboard["actSections"] = {
            k: v for k, v in act_sections.items() if v.get("matches")
        }

    # ---- Paginate match cards ----
    all_filtered = []
    for section in dashboard.get("actSections", {}).values():
        all_filtered.extend(section.get("matches", []))
    all_filtered.sort(key=lambda m: int(m.get("timestamp") or 0), reverse=True)

    total_matches = len(all_filtered)
    if page_size is not None:
        total_pages = max(1, -(-total_matches // page_size))
        current_page = min(page, total_pages)
        start = (current_page - 1) * page_size
        end = start + page_size
        paged_matches = all_filtered[start:end]
        paged_match_ids = {
            str(m.get("id") or m.get("match_id") or "") for m in paged_matches
        }
        paged_match_ids.discard("")

        # Trim sections to only include paged matches
        for section in dashboard.get("actSections", {}).values():
            section["matches"] = [
                m for m in section.get("matches", [])
                if str(m.get("id") or m.get("match_id") or "") in paged_match_ids
            ]

        # Keep analyticsList aligned with paginated match cards.
        analytics_list = dashboard.get("analyticsList", [])
        if isinstance(analytics_list, list):
            dashboard["analyticsList"] = [
                m
                for m in analytics_list
                if str(m.get("id") or m.get("match_id") or "") in paged_match_ids
            ]

        effective_page_size = page_size
    else:
        current_page = 1
        total_pages = 1
        effective_page_size = total_matches

    dashboard["matchPagination"] = {
        "page": current_page,
        "pageSize": effective_page_size,
        "totalMatches": total_matches,
        "totalPages": total_pages,
    }

    return dashboard


@router.get("/{puuid}/rank-comparison")
def get_player_rank_comparison_data(
    puuid: str,
    queue_id: str | None = Query(default=None, description="Filter matches by queue type (e.g. 'competitive')"),
    agent_id: str | None = Query(default=None, description="Filter matches by agent UUID"),
    map_name: str | None = Query(default=None, description="Filter matches by map name"),
    season_id: str | None = Query(default=None, description="Filter matches by act/season id"),
    party_size: str | None = Query(
        default=None,
        description="Filter matches by party bucket: solo, duo, trio or team",
    ),
):
    """Devuelve la comparativa de cohorte para el bloque Perfil de rendimiento."""
    player = mongo_player_repo.find_by_puuid(puuid)
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")

    return get_player_rank_comparison(
        puuid,
        queue_id=queue_id,
        agent_id=agent_id,
        map_name=map_name,
        season_id=season_id,
        party_size=party_size,
    )