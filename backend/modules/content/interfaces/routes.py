from fastapi import APIRouter, Query, HTTPException

from modules.content.application.content_services import (
    get_contenido_resumen,
    get_actos,
    get_agentes,
    get_mapas_clasificados,
    get_mapas_geo,
    get_armas_detalladas,
    get_buddies,
    get_bundles_filtrados,
    get_ceremonies,
    get_competitive_tiers,
    get_content_tiers,
    get_contracts,
    get_currencies,
    get_events,
    get_flex,
    get_gamemodes,
    get_gear,
    get_levelborders,
    get_playercards,
    get_playertitles,
    get_sprays,
    get_themes,
    get_version
)

router = APIRouter()

@router.get("/resumen")
def resumen():
    data = get_contenido_resumen()
    if not data:
        raise HTTPException(status_code=404, detail="No hay contenido disponible")
    return data

@router.get("/actos")
def actos():
    return get_actos()

@router.get("/agentes")
def agentes():
    return get_agentes()

@router.get("/mapas")
def mapas():
    data = get_mapas_clasificados()
    if not data:
        raise HTTPException(status_code=404, detail="No hay mapas disponibles")
    return data


@router.get("/mapas-geo")
def mapas_geo():
    data = get_mapas_geo()
    if not data:
        raise HTTPException(status_code=404, detail="No hay datos geográficos de mapas")
    return data


@router.get("/armas")
def armas():
    return get_armas_detalladas()


@router.get("/buddies")
def buddies():
    return get_buddies()


@router.get("/bundles")
def bundles():
    return get_bundles_filtrados()


@router.get("/ceremonies")
def ceremonies():
    return get_ceremonies()


@router.get("/competitive-tiers")
def competitive_tiers():
    return get_competitive_tiers()


@router.get("/content-tiers")
def content_tiers():
    return get_content_tiers()


@router.get("/contracts")
def contracts():
    return get_contracts()


@router.get("/currencies")
def currencies():
    return get_currencies()


@router.get("/events")
def events():
    return get_events()


@router.get("/flex")
def flex(
    limit: int | None = Query(default=None, ge=1)
):
    return get_flex(limit)


@router.get("/gamemodes")
def gamemodes(
    limit: int | None = Query(default=None, ge=1)
):
    return get_gamemodes(limit)


@router.get("/gear")
def gear(
    limit: int | None = Query(default=None, ge=1)
):
    return get_gear(limit)


@router.get("/levelborders")
def levelborders(
    limit: int | None = Query(default=None, ge=1)
):
    return get_levelborders(limit)


@router.get("/playercards")
def playercards(
    limit: int | None = Query(default=None, ge=1)
):
    return get_playercards(limit)


@router.get("/playertitles")
def playertitles(
    limit: int | None = Query(default=None, ge=1)
):
    return get_playertitles(limit)


@router.get("/sprays")
def sprays(
    limit: int | None = Query(default=None, ge=1)
):
    return get_sprays(limit)


@router.get("/themes")
def themes(
    limit: int | None = Query(default=None, ge=1)
):
    return get_themes(limit)


@router.get("/version")
def version():
    data = get_version()
    if not data:
        raise HTTPException(status_code=404, detail="No hay información de versión")
    return data


