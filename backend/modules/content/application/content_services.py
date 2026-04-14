from modules.content.infrastructure import mongo_content_repo
from modules.content.domain.services import (
    sanitize_segment as _sanitize_segment,
    local_agent_image as _local_agent_image,
    local_agent_role_icon as _local_agent_role_icon,
    local_agent_ability_icon as _local_agent_ability_icon,
    local_weapon_image as _local_weapon_image,
    local_competitive_tier_icon as _local_competitive_tier_icon,
    classify_maps,
    filter_geo_maps,
    normalize_weapon_category as _normalizar_categoria_arma,
)


CONTENT_FIELDS_SUMMARY = (
    "agents.uuid",
    "maps.uuid",
    "weapons.uuid",
    "acts.id",
)

CONTENT_FIELDS_ACTS = (
    "acts.id",
    "acts.name",
    "acts.type",
    "acts.parent",
    "acts.parentId",
    "acts.parent_id",
    "acts.parentName",
    "acts.isActive",
)

CONTENT_FIELDS_AGENTS = (
    "agents.uuid",
    "agents.id",
    "agents.displayName",
    "agents.description",
    "agents.role.displayName",
    "agents.role.description",
    "agents.abilities.slot",
    "agents.abilities.displayName",
    "agents.abilities.description",
)

CONTENT_FIELDS_MAPS = (
    "maps.uuid",
    "maps.mapUrl",
    "maps.displayName",
    "maps.displayIcon",
    "maps.name",
    "maps.coordinates",
    "maps.tacticalDescription",
    "maps.xMultiplier",
    "maps.xScalarToAdd",
    "maps.yMultiplier",
    "maps.yScalarToAdd",
)

CONTENT_FIELDS_WEAPONS = (
    "weapons.uuid",
    "weapons.id",
    "weapons.displayName",
    "weapons.category",
    "weapons.shopData.categoryText",
    "weapons.shopData.cost",
    "weapons.weaponStats.fireRate",
    "weapons.weaponStats.magazineSize",
    "weapons.weaponStats.runSpeedMultiplier",
    "weapons.weaponStats.equipTimeSeconds",
    "weapons.weaponStats.reloadTimeSeconds",
    "weapons.weaponStats.firstBulletAccuracy",
    "weapons.weaponStats.shotgunPelletCount",
    "weapons.weaponStats.wallPenetration",
    "weapons.weaponStats.feature",
    "weapons.weaponStats.fireMode",
    "weapons.weaponStats.altFireType",
    "weapons.weaponStats.adsStats.zoomMultiplier",
    "weapons.weaponStats.adsStats.fireRate",
    "weapons.weaponStats.adsStats.runSpeedMultiplier",
    "weapons.weaponStats.adsStats.firstBulletAccuracy",
    "weapons.weaponStats.adsStats.burstCount",
    "weapons.weaponStats.damageRanges.rangeStartMeters",
    "weapons.weaponStats.damageRanges.rangeEndMeters",
    "weapons.weaponStats.damageRanges.headDamage",
    "weapons.weaponStats.damageRanges.bodyDamage",
    "weapons.weaponStats.damageRanges.legDamage",
)

CONTENT_FIELDS_COMP_TIERS = (
    "competitive_tiers.uuid",
    "competitive_tiers.id",
    "competitive_tiers.tiers.tier",
    "competitive_tiers.tiers.tierName",
    "competitive_tiers.tiers.divisionName",
)


def _get_latest_content(projected_fields: tuple[str, ...]) -> dict:
    return mongo_content_repo.get_latest_content(projected_fields)


def get_contenido_resumen():
    ultimo = _get_latest_content(CONTENT_FIELDS_SUMMARY)
    if not ultimo:
        return None

    agents = ultimo.get("agents", [])
    weapons = ultimo.get("weapons", [])
    maps = ultimo.get("maps", [])
    acts = ultimo.get("acts", [])

    return {
        "total_agentes": len(agents),
        "total_mapas": len(maps),
        "total_armas": len(weapons),
        "total_actos": len(acts),
    }

def get_actos():
    ultimo = _get_latest_content(CONTENT_FIELDS_ACTS)
    if not ultimo:
        return []

    actos = []

    for act in ultimo.get("acts", []):
        parent_raw = act.get("parent") or {}
        parent_id = (
            act.get("parentId")
            or act.get("parent_id")
            or parent_raw.get("id")
        )
        parent_name = (
            act.get("parentName")
            or parent_raw.get("name")
            or parent_raw.get("displayName")
        )

        actos.append({
            "id": act.get("id"),
            "name": act.get("name"),
            "type": act.get("type"),
            "parentId": parent_id,
            "parentName": parent_name,
            "isActive": act.get("isActive", False)
        })

    return actos

def get_leaderboard_acto(act_id: str, region: str = "eu", limit: int = 100):
    entry = mongo_content_repo.find_leaderboard(act_id, region)
    if not entry:
        return None

    players_raw = entry.get("data", {}).get("players", [])
    total_players = len(players_raw)

    players = []

    for p in players_raw[:limit]:
        players.append({
            "gameName": p.get("gameName", "Unknown"),
            "tagLine": p.get("tagLine", ""),
            "leaderboardRank": p.get("leaderboardRank"),
            "rankedRating": p.get("rankedRating"),
            "numberOfWins": p.get("numberOfWins"),
        })

    return {
        "act_id": act_id,
        "act_name": entry.get("act_name", act_id),
        "total_players": total_players,
        "returned_players": len(players),
        "players": players
    }

def get_region_stats():
    """
    Obtiene las estadísticas derivadas de cada región 
    calculadas durante el fetch_data.
    """
    return mongo_content_repo.get_all_regions()

def get_player_profile(puuid: str):
    """
    Obtiene el perfil detallado de un jugador con sus 
    estadísticas calculadas de Tracker.
    """
    return mongo_content_repo.find_player_by_puuid(puuid)

def get_matches_by_player(puuid: str, limit: int = 10):
    return mongo_content_repo.find_matches_by_player(puuid, limit)

def get_agentes():
    ultimo = _get_latest_content(CONTENT_FIELDS_AGENTS)
    if not ultimo:
        return []

    agentes_response = []

    for ag in ultimo.get("agents", []):
        agent_uuid = ag.get("uuid") or ag.get("id")
        agente = {
            # Identificadores para mapear partidas/analytics con el nombre del agente.
            "uuid": agent_uuid,
            "id": ag.get("id") or ag.get("uuid"),
            "displayName": ag.get("displayName", "—"),
            "description": ag.get("description", "—"),

            # Local image paths under frontend/public/content.
            "displayIcon": _local_agent_image(agent_uuid, "displayIcon"),
            "displayIconSmall": _local_agent_image(agent_uuid, "displayIconSmall"),
            "fullPortrait": _local_agent_image(agent_uuid, "fullPortrait"),
            "background": _local_agent_image(agent_uuid, "background"),
            "bustPortrait": _local_agent_image(agent_uuid, "bustPortrait"),

            # 🔹 Rol del agente
            "role": {
                "displayName": ag.get("role", {}).get("displayName", "—"),
                "description": ag.get("role", {}).get("description", "—"),
                "displayIcon": _local_agent_role_icon(agent_uuid)
            },

            # 🔹 Habilidades
            "abilities": []
        }

        for hab in ag.get("abilities", []):
            ability_name = hab.get("displayName", "—")
            agente["abilities"].append({
                "slot": hab.get("slot", "—"),
                "displayName": ability_name,
                "description": hab.get("description", "—"),
                "displayIcon": _local_agent_ability_icon(agent_uuid, ability_name)
            })

        agentes_response.append(agente)

    return agentes_response




def get_mapas_clasificados():
    ultimo = _get_latest_content(CONTENT_FIELDS_MAPS)
    if not ultimo:
        return None
    return classify_maps(ultimo.get("maps", []))


def get_mapas_geo():
    """Return core playable maps with coordinate-transform parameters for heatmaps."""
    ultimo = _get_latest_content(CONTENT_FIELDS_MAPS)
    if not ultimo:
        return []
    return filter_geo_maps(ultimo.get("maps", []))


def get_armas_detalladas():
    ultimo = _get_latest_content(CONTENT_FIELDS_WEAPONS)
    if not ultimo:
        return []

    armas = []

    for w in ultimo.get("weapons", []):
        weapon_uuid = w.get("uuid") or w.get("id")
        shop = w.get("shopData") or {}
        stats = w.get("weaponStats") or {}
        ads = stats.get("adsStats") or {}
        damage_ranges = stats.get("damageRanges") or []

        armas.append({
            "displayName": w.get("displayName", "—"),
            "displayIcon": _local_weapon_image(weapon_uuid),
            "category": _normalizar_categoria_arma(w, shop),
            "cost": shop.get("cost", "—"),
            "stats": {
                "fireRate": stats.get("fireRate"),
                "magazineSize": stats.get("magazineSize"),
                "runSpeedMultiplier": stats.get("runSpeedMultiplier"),
                "equipTimeSeconds": stats.get("equipTimeSeconds"),
                "reloadTimeSeconds": stats.get("reloadTimeSeconds"),
                "firstBulletAccuracy": stats.get("firstBulletAccuracy"),
                "shotgunPelletCount": stats.get("shotgunPelletCount"),
                "wallPenetration": stats.get("wallPenetration"),
                "feature": stats.get("feature"),
                "fireMode": stats.get("fireMode"),
                "altFireType": stats.get("altFireType"),
            },
            "adsStats": {
                "zoomMultiplier": ads.get("zoomMultiplier"),
                "fireRate": ads.get("fireRate"),
                "runSpeedMultiplier": ads.get("runSpeedMultiplier"),
                "firstBulletAccuracy": ads.get("firstBulletAccuracy"),
                "burstCount": ads.get("burstCount"),
            },
            "damageRanges": [
                {
                    "rangeStartMeters": dr.get("rangeStartMeters"),
                    "rangeEndMeters": dr.get("rangeEndMeters"),
                    "headDamage": dr.get("headDamage"),
                    "bodyDamage": dr.get("bodyDamage"),
                    "legDamage": dr.get("legDamage"),
                }
                for dr in damage_ranges
            ]
        })

    return armas

def get_buddies():
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    return [
        {"displayName": b.get("displayName", "—")}
        for b in ultimo.get("buddies", [])
        if b.get("displayName")
    ]

def get_bundles_filtrados():
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    bundles = ultimo.get("bundles", [])
    vistos = set()
    resultado = []

    for b in bundles:
        nombre = b.get("displayName")
        if not nombre:
            continue

        nombre_norm = (
            nombre.lower()
            .replace("á", "a")
            .replace("é", "e")
            .replace("í", "i")
            .replace("ó", "o")
            .replace("ú", "u")
        )

        if "capsulas" in nombre_norm:
            continue

        if nombre in vistos:
            continue

        vistos.add(nombre)
        resultado.append({"displayName": nombre})

    return resultado

def get_ceremonies():
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    return [
        {"displayName": c.get("displayName", "—")}
        for c in ultimo.get("ceremonies", [])
        if c.get("displayName")
    ]

def get_competitive_tiers():
    ultimo = _get_latest_content(CONTENT_FIELDS_COMP_TIERS)
    if not ultimo:
        return []

    comp = ultimo.get("competitive_tiers", [])
    if not comp:
        return []

    ultimo_tier = comp[-1]
    tier_set_uuid = ultimo_tier.get("uuid") or ultimo_tier.get("id")
    tiers = ultimo_tier.get("tiers", [])

    resultado = []
    for t in tiers:
        division = t.get("divisionName", "")
        if division and "unused" in division.lower():
            continue

        tier_name = t.get("tierName", "—")
        sanitized_tier_name = _sanitize_segment(tier_name)

        resultado.append({
            "tier": t.get("tier"),
            "tierName": tier_name,
            "divisionName": division,
            "smallIcon": _local_competitive_tier_icon(
                tier_set_uuid,
                sanitized_tier_name,
                "smallIcon",
            ),
            "largeIcon": _local_competitive_tier_icon(
                tier_set_uuid,
                sanitized_tier_name,
                "largeIcon",
            ),
            "rankTriangleUpIcon": _local_competitive_tier_icon(
                tier_set_uuid,
                sanitized_tier_name,
                "rankTriangleUpIcon",
            ),
            "rankTriangleDownIcon": _local_competitive_tier_icon(
                tier_set_uuid,
                sanitized_tier_name,
                "rankTriangleDownIcon",
            ),
        })

    return resultado

def get_content_tiers():
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    return [
        {"displayName": t.get("displayName", "—")}
        for t in ultimo.get("content_tiers", [])
    ]


def get_contracts():
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    contracts = []

    for c in ultimo.get("contracts", []):
        contract_data = {
            "displayName": c.get("displayName", "—"),
            "chapters": []
        }

        content = c.get("content", {})
        chapters = content.get("chapters", [])

        for chapter in chapters:
            chapter_data = {
                "levels": []
            }

            for lvl in chapter.get("levels", []):
                xp = lvl.get("xp")
                vp_cost = lvl.get("vpCost", -1)
                dough_cost = lvl.get("doughCost", -1)

                chapter_data["levels"].append({
                    "xp": xp,
                    "vpCost": vp_cost,
                    "doughCost": dough_cost
                })

            contract_data["chapters"].append(chapter_data)

        contracts.append(contract_data)

    return contracts

def get_currencies():
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    return [
        {"displayName": c.get("displayName", "—")}
        for c in ultimo.get("currencies", [])
    ]


def get_events():
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    eventos = []
    for e in ultimo.get("events", []):
        eventos.append({
            "displayName": e.get("displayName", "—"),
            "startTime": e.get("startTime", "—"),
            "endTime": e.get("endTime", "—")
        })

    return eventos


def get_flex(limit=None):
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    flex = ultimo.get("flex", [])
    prohibidas = {"ninguno", "none"}

    resultado = []
    to_iter = flex if limit is None else flex[:limit]

    for f in to_iter:
        nombre = f.get("displayName") or f.get("displayNameAllCaps")
        if not nombre:
            continue

        if nombre.lower() in prohibidas:
            continue

        resultado.append({"displayName": nombre})

    return resultado


def get_gamemodes(limit=None):
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    gamemodes = ultimo.get("gamemodes", [])
    to_iter = gamemodes if limit is None else gamemodes[:limit]

    resultado = []
    for g in to_iter:
        resultado.append({
            "uuid": g.get("uuid", "—"),
            "displayName": g.get("displayName", "—"),
            "description": g.get("description", "—"),
            "duration": g.get("duration", "—")
        })

    return resultado


def get_gear(limit=None):
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    gear = ultimo.get("gear", [])
    to_iter = gear if limit is None else gear[:limit]

    resultado = []
    for item in to_iter:
        shop = item.get("shopData") or {}
        resultado.append({
            "displayName": item.get("displayName", "—"),
            "description": item.get("description", "—"),
            "cost": shop.get("cost", "—")
        })

    return resultado

def get_levelborders(limit=None):
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    levelborders = ultimo.get("levelborders", [])
    to_iter = levelborders if limit is None else levelborders[:limit]

    return [
        {"displayName": lb.get("displayName", "—")}
        for lb in to_iter
    ]

def get_playercards(limit=None):
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    playercards = ultimo.get("playercards", [])
    to_iter = playercards if limit is None else playercards[:limit]

    return [
        {"displayName": pc.get("displayName", "—")}
        for pc in to_iter
    ]

def get_playertitles(limit=None):
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    titles = ultimo.get("playertitles", [])
    to_iter = titles if limit is None else titles[:limit]

    prohibidas = {"ninguno", "none", "null"}
    resultado = []

    for t in to_iter:
        nombre = t.get("displayName")

        if not nombre:
            continue

        if nombre.lower() in prohibidas:
            continue

        resultado.append({
            "displayName": nombre,
            "titleText": t.get("titleText", "—")
        })

    return resultado


def get_sprays(limit=None):
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    sprays = ultimo.get("sprays", [])
    to_iter = sprays if limit is None else sprays[:limit]

    prohibidas = {"ninguno", "none"}
    resultado = []

    for s in to_iter:
        nombre = s.get("displayName", "—")

        if nombre and nombre.lower() in prohibidas:
            continue

        is_animated = bool(
            s.get("animationPng") or s.get("animationGif")
        )

        resultado.append({
            "displayName": nombre,
            "isAnimated": is_animated
        })

    return resultado


def get_themes(limit=None):
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    themes = ultimo.get("themes", [])
    to_iter = themes if limit is None else themes[:limit]

    vistos = set()
    resultado = []

    for t in to_iter:
        nombre = t.get("displayName", "—")

        if nombre in vistos:
            continue

        vistos.add(nombre)
        resultado.append({"displayName": nombre})

    return resultado


def get_version():
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return None

    version = ultimo.get("version")
    if not version:
        return None

    campos_principales = [
        "manifestId", "branch", "version", "buildVersion",
        "engineVersion", "riotClientVersion",
        "riotClientBuild", "buildDate"
    ]

    resultado = {
        "main": {c: version.get(c, "—") for c in campos_principales},
        "extra": {k: v for k, v in version.items() if k not in campos_principales}
    }

    return resultado
