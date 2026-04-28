from modules.content.infrastructure import mongo_content_repo
from modules.content.domain.services import (
    sanitize_segment as _sanitize_segment,
    local_agent_image as _local_agent_image,
    local_agent_role_icon as _local_agent_role_icon,
    local_agent_ability_icon as _local_agent_ability_icon,
    local_weapon_image as _local_weapon_image,
    local_competitive_tier_icon as _local_competitive_tier_icon,
    local_content_image as _local_content_image,
    local_weapon_skin_image as _local_weapon_skin_image,
    classify_maps,
    filter_geo_maps,
    normalize_weapon_category as _normalizar_categoria_arma,
)


CONTENT_FIELDS_SUMMARY = (
    "agents.uuid",
    "maps.uuid",
    "weapons.uuid",
    "acts.id",
    "buddies.uuid",
    "bundles.uuid",
    "ceremonies.uuid",
    "competitive_tiers.uuid",
    "content_tiers.uuid",
    "contracts.uuid",
    "currencies.uuid",
    "events.uuid",
    "flex.uuid",
    "gamemodes.uuid",
    "gear.uuid",
    "levelborders.uuid",
    "playercards.uuid",
    "playertitles.uuid",
    "sprays.uuid",
    "themes.uuid",
    "version.version",
    "version.buildVersion",
    "version.buildDate",
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
    "agents.releaseDate",
    "agents.characterTags",
    "agents.isBaseContent",
    "agents.isAvailableForTest",
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
    "maps.narrativeDescription",
    "maps.tacticalDescription",
    "maps.callouts.regionName",
    "maps.callouts.superRegionName",
    "maps.callouts.location.x",
    "maps.callouts.location.y",
    "maps.listViewIcon",
    "maps.listViewIconTall",
    "maps.premierBackgroundImage",
    "maps.stylizedBackgroundImage",
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
    "weapons.defaultSkinUuid",
    "weapons.killStreamIcon",
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

    counts = {
        "agents": len(ultimo.get("agents", []) or []),
        "maps": len(ultimo.get("maps", []) or []),
        "weapons": len(ultimo.get("weapons", []) or []),
        "acts": len(ultimo.get("acts", []) or []),
        "buddies": len(ultimo.get("buddies", []) or []),
        "bundles": len(ultimo.get("bundles", []) or []),
        "ceremonies": len(ultimo.get("ceremonies", []) or []),
        "competitive_tiers": len(ultimo.get("competitive_tiers", []) or []),
        "content_tiers": len(ultimo.get("content_tiers", []) or []),
        "contracts": len(ultimo.get("contracts", []) or []),
        "currencies": len(ultimo.get("currencies", []) or []),
        "events": len(ultimo.get("events", []) or []),
        "flex": len(ultimo.get("flex", []) or []),
        "gamemodes": len(ultimo.get("gamemodes", []) or []),
        "gear": len(ultimo.get("gear", []) or []),
        "levelborders": len(ultimo.get("levelborders", []) or []),
        "playercards": len(ultimo.get("playercards", []) or []),
        "playertitles": len(ultimo.get("playertitles", []) or []),
        "sprays": len(ultimo.get("sprays", []) or []),
        "themes": len(ultimo.get("themes", []) or []),
    }

    # Keep legacy Spanish keys for existing callers while exposing a structured
    # shape for richer dashboards.
    return {
        "total_agentes": counts["agents"],
        "total_mapas": counts["maps"],
        "total_armas": counts["weapons"],
        "total_actos": counts["acts"],
        "counts": counts,
        "version": ultimo.get("version") or {},
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
            "releaseDate": ag.get("releaseDate"),
            "characterTags": ag.get("characterTags") or [],
            "isBaseContent": ag.get("isBaseContent"),
            "isAvailableForTest": ag.get("isAvailableForTest"),

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
            "uuid": weapon_uuid,
            "displayName": w.get("displayName", "—"),
            "displayIcon": _local_weapon_image(weapon_uuid),
            "killStreamIcon": _local_content_image(
                "weapons", weapon_uuid, "killStreamIcon"
            ),
            "defaultSkinUuid": w.get("defaultSkinUuid"),
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

def get_skins(limit=None):
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    skins = []

    for weapon in ultimo.get("weapons", []):
        weapon_uuid = weapon.get("uuid") or weapon.get("id")
        weapon_name = weapon.get("displayName", "—")

        for skin in weapon.get("skins", []):
            skin_uuid = skin.get("uuid") or skin.get("id")
            name = skin.get("displayName")
            if not name:
                continue

            skins.append({
                "uuid": skin_uuid,
                "displayName": name,
                "weaponUuid": weapon_uuid,
                "weaponName": weapon_name,
                "contentTierUuid": (
                    skin.get("contentTierUuid")
                    or skin.get("contentTierUUID")
                ),
                "themeUuid": skin.get("themeUuid"),
                "displayIcon": _local_weapon_skin_image(
                    weapon_uuid,
                    skin_uuid,
                    "displayIcon",
                ),
                "wallpaper": _local_weapon_skin_image(
                    weapon_uuid,
                    skin_uuid,
                    "wallpaper",
                ),
                "chromasCount": len(skin.get("chromas", []) or []),
                "levelsCount": len(skin.get("levels", []) or []),
            })

            if limit is not None and len(skins) >= limit:
                return skins

    return skins

def get_buddies():
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    return [
        {
            "uuid": b.get("uuid") or b.get("id"),
            "displayName": b.get("displayName", "—"),
            "themeUuid": b.get("themeUuid"),
            "isHiddenIfNotOwned": b.get("isHiddenIfNotOwned"),
            "displayIcon": _local_content_image(
                "buddies",
                b.get("uuid") or b.get("id"),
                "displayIcon",
            ),
            "levelsCount": len(b.get("levels", []) or []),
        }
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
        item_uuid = b.get("uuid") or b.get("id")
        resultado.append({
            "uuid": item_uuid,
            "displayName": nombre,
            "displayIcon": _local_content_image("bundles", item_uuid, "displayIcon"),
            "displayIcon2": _local_content_image("bundles", item_uuid, "displayIcon2"),
            "verticalPromoImage": _local_content_image(
                "bundles", item_uuid, "verticalPromoImage"
            ),
        })

    return resultado

def get_ceremonies():
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    return [
        {
            "uuid": c.get("uuid") or c.get("id"),
            "displayName": c.get("displayName", "—"),
            "assetPath": c.get("assetPath"),
        }
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
        {
            "uuid": t.get("uuid") or t.get("id"),
            "displayName": t.get("displayName", "—"),
            "rank": t.get("rank"),
            "highlightColor": t.get("highlightColor"),
            "displayIcon": _local_content_image(
                "contenttiers",
                t.get("uuid") or t.get("id"),
                "displayIcon",
            ),
        }
        for t in ultimo.get("content_tiers", [])
    ]


def get_contracts():
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    contracts = []

    for c in ultimo.get("contracts", []):
        contract_uuid = c.get("uuid") or c.get("id")
        contract_data = {
            "uuid": contract_uuid,
            "displayName": c.get("displayName", "—"),
            "displayIcon": _local_content_image(
                "contracts",
                contract_uuid,
                "displayIcon",
            ),
            "chapters": []
        }

        content = c.get("content", {})
        chapters = content.get("chapters", [])

        for chapter_index, chapter in enumerate(chapters, start=1):
            chapter_data = {
                "chapter": chapter_index,
                "levels": []
            }

            for level_index, lvl in enumerate(chapter.get("levels", []), start=1):
                xp = lvl.get("xp")
                vp_cost = lvl.get("vpCost", -1)
                dough_cost = lvl.get("doughCost", -1)

                chapter_data["levels"].append({
                    "level": level_index,
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
        {
            "uuid": c.get("uuid") or c.get("id"),
            "displayName": c.get("displayName", "—"),
            "displayIcon": _local_content_image(
                "currencies",
                c.get("uuid") or c.get("id"),
                "displayIcon",
            ),
            "largeIcon": _local_content_image(
                "currencies",
                c.get("uuid") or c.get("id"),
                "largeIcon",
            ),
            "rewardPreviewIcon": _local_content_image(
                "currencies",
                c.get("uuid") or c.get("id"),
                "rewardPreviewIcon",
            ),
            "assetPath": c.get("assetPath"),
        }
        for c in ultimo.get("currencies", [])
    ]


def get_events():
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    eventos = []
    for e in ultimo.get("events", []):
        eventos.append({
            "uuid": e.get("uuid") or e.get("id"),
            "displayName": e.get("displayName", "—"),
            "shortDisplayName": e.get("shortDisplayName"),
            "startTime": e.get("startTime", "—"),
            "endTime": e.get("endTime", "—"),
            "assetPath": e.get("assetPath"),
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

        item_uuid = f.get("uuid") or f.get("id")
        resultado.append({
            "uuid": item_uuid,
            "displayName": nombre,
            "displayNameAllCaps": f.get("displayNameAllCaps"),
            "displayIcon": _local_content_image("flex", item_uuid, "displayIcon"),
        })

    return resultado


def get_gamemodes(limit=None):
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    gamemodes = ultimo.get("gamemodes", [])
    to_iter = gamemodes if limit is None else gamemodes[:limit]

    resultado = []
    for g in to_iter:
        item_uuid = g.get("uuid") or g.get("id")
        resultado.append({
            "uuid": item_uuid,
            "displayName": g.get("displayName", "—"),
            "description": g.get("description", "—"),
            "duration": g.get("duration", "—"),
            "roundsPerHalf": g.get("roundsPerHalf"),
            "economyType": g.get("economyType"),
            "orbCount": g.get("orbCount"),
            "teamRoles": g.get("teamRoles") or [],
            "isTeamVoiceAllowed": g.get("isTeamVoiceAllowed"),
            "isMinimapHidden": g.get("isMinimapHidden"),
            "allowsMatchTimeouts": g.get("allowsMatchTimeouts"),
            "allowsCustomGameReplays": g.get("allowsCustomGameReplays"),
            "displayIcon": _local_content_image(
                "gamemodes",
                item_uuid,
                "displayIcon",
            ),
            "listViewIconTall": _local_content_image(
                "gamemodes",
                item_uuid,
                "listViewIconTall",
            ),
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
        item_uuid = item.get("uuid") or item.get("id")
        shop = item.get("shopData") or {}
        resultado.append({
            "uuid": item_uuid,
            "displayName": item.get("displayName", "—"),
            "description": item.get("description", "—"),
            "descriptions": item.get("descriptions") or [],
            "details": item.get("details") or {},
            "cost": shop.get("cost", "—"),
            "category": item.get("category"),
            "displayIcon": _local_content_image("gear", item_uuid, "displayIcon"),
            "shopImage": (
                f"/content/gear/{item_uuid}/shopData/newImage.png"
                if item_uuid else None
            ),
        })

    return resultado

def get_levelborders(limit=None):
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    levelborders = ultimo.get("levelborders", [])
    to_iter = levelborders if limit is None else levelborders[:limit]

    return [
        {
            "uuid": lb.get("uuid") or lb.get("id"),
            "displayName": lb.get("displayName", "—"),
            "startingLevel": lb.get("startingLevel"),
            "levelNumber": lb.get("levelNumber"),
            "levelNumberAppearance": _local_content_image(
                "levelborders",
                lb.get("uuid") or lb.get("id"),
                "levelNumberAppearance",
            ),
            "smallPlayerCardAppearance": _local_content_image(
                "levelborders",
                lb.get("uuid") or lb.get("id"),
                "smallPlayerCardAppearance",
            ),
        }
        for lb in to_iter
    ]

def get_playercards(limit=None):
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    playercards = ultimo.get("playercards", [])
    to_iter = playercards if limit is None else playercards[:limit]

    return [
        {
            "uuid": pc.get("uuid") or pc.get("id"),
            "displayName": pc.get("displayName", "—"),
            "themeUuid": pc.get("themeUuid"),
            "isHiddenIfNotOwned": pc.get("isHiddenIfNotOwned"),
            "displayIcon": _local_content_image(
                "playercards",
                pc.get("uuid") or pc.get("id"),
                "displayIcon",
            ),
            "smallArt": _local_content_image(
                "playercards",
                pc.get("uuid") or pc.get("id"),
                "smallArt",
            ),
            "wideArt": _local_content_image(
                "playercards",
                pc.get("uuid") or pc.get("id"),
                "wideArt",
            ),
            "largeArt": _local_content_image(
                "playercards",
                pc.get("uuid") or pc.get("id"),
                "largeArt",
            ),
        }
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
            "uuid": t.get("uuid") or t.get("id"),
            "displayName": nombre,
            "titleText": t.get("titleText", "—"),
            "isHiddenIfNotOwned": t.get("isHiddenIfNotOwned"),
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
        item_uuid = s.get("uuid") or s.get("id")
        nombre = s.get("displayName", "—")

        if nombre and nombre.lower() in prohibidas:
            continue

        is_animated = bool(
            s.get("animationPng") or s.get("animationGif")
        )

        resultado.append({
            "uuid": item_uuid,
            "displayName": nombre,
            "category": s.get("category"),
            "themeUuid": s.get("themeUuid"),
            "hideIfNotOwned": s.get("hideIfNotOwned"),
            "isNullSpray": s.get("isNullSpray"),
            "levelsCount": len(s.get("levels", []) or []),
            "displayIcon": _local_content_image("sprays", item_uuid, "displayIcon"),
            "fullIcon": _local_content_image("sprays", item_uuid, "fullIcon"),
            "fullTransparentIcon": _local_content_image(
                "sprays",
                item_uuid,
                "fullTransparentIcon",
            ),
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
