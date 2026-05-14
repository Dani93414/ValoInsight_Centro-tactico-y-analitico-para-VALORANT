import re
import unicodedata

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


def _normalize_leaderboard_search(value) -> str:
    text = str(value or "").replace("\u00a0", " ").strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", text)

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

    raw_acts = ultimo.get("acts", []) or []
    episodes_by_id = {
        act.get("id"): act
        for act in raw_acts
        if str(act.get("type") or "").lower() == "episode" and act.get("id")
    }
    actos = []

    for act in raw_acts:
        parent_raw = act.get("parent") or {}
        parent_id = (
            act.get("parentId")
            or act.get("parent_id")
            or (parent_raw.get("id") if isinstance(parent_raw, dict) else parent_raw)
        )
        parent_doc = episodes_by_id.get(parent_id)
        parent_name = (
            act.get("parentName")
            or (parent_raw.get("name") if isinstance(parent_raw, dict) else None)
            or (parent_raw.get("displayName") if isinstance(parent_raw, dict) else None)
            or (parent_doc.get("name") if parent_doc else None)
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

def get_leaderboard_acto(
    act_id: str,
    region: str = "eu",
    platform: str = "pc",
    limit: int = 100,
    page: int = 1,
    search: str = "",
    game_name: str = "",
    tag_line: str = "",
):
    entry = mongo_content_repo.find_leaderboard(act_id, region, platform)
    if not entry:
        return None

    players_raw = entry.get("data", {}).get("players", [])
    total_players = len(players_raw)
    search_norm = _normalize_leaderboard_search(search)
    game_name_clean = (game_name or "").strip()
    tag_line_clean = (tag_line or "").strip()
    if "#" in game_name_clean and not tag_line_clean:
        split_name, split_tag = game_name_clean.split("#", 1)
        game_name_clean = split_name.strip()
        tag_line_clean = split_tag.strip()

    game_name_norm = _normalize_leaderboard_search(game_name_clean)
    tag_line_norm = _normalize_leaderboard_search(tag_line_clean)
    has_structured_search = bool(game_name_norm or tag_line_norm)
    if has_structured_search:
        require_exact_identity = bool(game_name_norm and tag_line_norm)
        players_filtered = [
            p for p in players_raw
            if (
                (
                    _normalize_leaderboard_search(p.get("gameName", "")) == game_name_norm
                    if require_exact_identity and game_name_norm
                    else not game_name_norm or game_name_norm in _normalize_leaderboard_search(p.get("gameName", ""))
                )
                and (
                    _normalize_leaderboard_search(p.get("tagLine", "")) == tag_line_norm
                    if require_exact_identity and tag_line_norm
                    else not tag_line_norm or tag_line_norm in _normalize_leaderboard_search(p.get("tagLine", ""))
                )
            )
        ]
    elif search_norm:
        players_filtered = [
            p for p in players_raw
            if search_norm in _normalize_leaderboard_search(f"{p.get('gameName', '')}#{p.get('tagLine', '')}")
            or search_norm in _normalize_leaderboard_search(p.get("gameName", ""))
            or search_norm in _normalize_leaderboard_search(p.get("tagLine", ""))
        ]
    else:
        players_filtered = players_raw

    page_size = min(max(int(limit or 100), 1), 500)
    page = max(int(page or 1), 1)
    filtered_total = len(players_filtered)
    total_pages = max(1, (filtered_total + page_size - 1) // page_size)
    page = min(page, total_pages)
    start = (page - 1) * page_size
    players_page = players_filtered[start:start + page_size]
    target_player_page = None

    if has_structured_search:
        for index, candidate in enumerate(players_raw):
            candidate_name = _normalize_leaderboard_search(candidate.get("gameName"))
            candidate_tag = _normalize_leaderboard_search(candidate.get("tagLine"))
            name_matches = (
                candidate_name == game_name_norm
                if game_name_norm
                else True
            )
            tag_matches = (
                candidate_tag == tag_line_norm
                if tag_line_norm
                else True
            )
            if name_matches and tag_matches:
                target_player_page = (index // page_size) + 1
                break

    local_players = mongo_content_repo.find_local_leaderboard_players(players_page)
    previous_entry = (
        mongo_content_repo.find_previous_leaderboard(act_id, region, platform, entry.get("_id"))
        if entry.get("isActive")
        else None
    )
    previous_ranks = {
        p.get("puuid"): p.get("leaderboardRank")
        for p in ((previous_entry or {}).get("data", {}).get("players", []) or [])
        if p.get("puuid") and isinstance(p.get("leaderboardRank"), int)
    }
    players = []

    original_indexes_by_identity = {
        id(player): index
        for index, player in enumerate(players_raw)
        if isinstance(player, dict)
    }

    for p in players_page:
        original_index = original_indexes_by_identity.get(id(p))
        leaderboard_page = (
            (original_index // page_size) + 1
            if isinstance(original_index, int)
            else None
        )
        player_key = f"{str(p.get('gameName') or '').lower()}#{str(p.get('tagLine') or '').lower()}"
        local = local_players.get(player_key, {})
        player_card = p.get("playerCard") or p.get("PlayerCardID")
        player_title = p.get("playerTitle") or p.get("TitleID")
        game_name_value = str(p.get("gameName") or "").strip() or "Desconocido"
        tag_line_value = str(p.get("tagLine") or "").strip()
        fallback_seed = (
            p.get("puuid")
            or f"{game_name_value.lower()}#{tag_line_value.lower()}#{p.get('leaderboardRank') or ''}"
        )
        player_card_icon = (
            local.get("playerCardIcon")
            or mongo_content_repo.local_player_card_icon(player_card)
            or mongo_content_repo.fallback_player_card_icon(str(fallback_seed))
        )
        players.append({
            "prefix": p.get("prefix"),
            "gameName": game_name_value,
            "tagLine": tag_line_value,
            "premierRosterType": p.get("premierRosterType"),
            "leaderboardRank": p.get("leaderboardRank"),
            "leaderboardPage": leaderboard_page,
            "rankedRating": p.get("rankedRating"),
            "numberOfWins": p.get("numberOfWins"),
            "competitiveTier": p.get("competitiveTier"),
            "rankDelta24h": (
                previous_ranks[p.get("puuid")] - p.get("leaderboardRank")
                if p.get("puuid") in previous_ranks and isinstance(p.get("leaderboardRank"), int)
                else None
            ),
            "puuid": local.get("puuid"),
            "hasProfile": bool(local.get("hasProfile")),
            "playerCard": player_card,
            "playerTitle": player_title,
            "playerCardIcon": player_card_icon,
        })

    return {
        "act_id": act_id,
        "act_name": entry.get("act_name", act_id),
        "region": entry.get("region", region.upper()),
        "platform": entry.get("platform", platform.lower()),
        "total_players": total_players,
        "filtered_players": filtered_total,
        "returned_players": len(players),
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "target_player_page": target_player_page,
        "rank_distribution": mongo_content_repo.get_rank_distribution_for_acts([act_id]),
        "players": players
    }


def get_leaderboard_regions():
    return mongo_content_repo.get_leaderboard_regions()


def get_leaderboard_platforms():
    return mongo_content_repo.get_leaderboard_platforms()


def get_rank_distribution(act_ids: list[str]):
    return mongo_content_repo.get_rank_distribution_for_acts(act_ids)

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

def _iter_bundle_item_uuids(bundle: dict) -> set[str]:
    uuids: set[str] = set()

    def _maybe_add(raw_uuid):
        if isinstance(raw_uuid, str) and raw_uuid:
            uuids.add(raw_uuid)

    for key in ("items", "bundleItems", "bundleItemsData"):
        raw_items = bundle.get(key)
        if not isinstance(raw_items, list):
            continue
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            _maybe_add(item.get("uuid") or item.get("itemUuid") or item.get("id"))

            inner = item.get("item")
            if isinstance(inner, dict):
                _maybe_add(inner.get("uuid") or inner.get("id"))

            nested = item.get("itemData")
            if isinstance(nested, dict):
                _maybe_add(nested.get("uuid") or nested.get("id"))

    return uuids


def _bundle_promo_image(bundle: dict, bundle_uuid: str | None):
    if not bundle_uuid:
        return None
    return (
        _local_content_image("bundles", bundle_uuid, "displayIcon")
        or _local_content_image("bundles", bundle_uuid, "displayIcon2")
        or _local_content_image("bundles", bundle_uuid, "verticalPromoImage")
    )


def _normalize_collection_key(value: str | None) -> str:
    if not value:
        return ""
    return (
        str(value)
        .casefold()
        .replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
        .strip()
    )


def _theme_asset_token(asset_path: str | None) -> str:
    if not asset_path:
        return ""
    tail = str(asset_path).rsplit("/", 1)[-1]
    tail = tail.removeprefix("Theme_").removesuffix("_PrimaryAsset")
    return _normalize_collection_key(tail)


def _bundle_asset_token(asset_path: str | None) -> str:
    if not asset_path:
        return ""
    tail = str(asset_path).rsplit("/", 1)[-1]
    for prefix in ("StorefrontItem_", "Storefrontitem_"):
        tail = tail.removeprefix(prefix)
    tail = tail.removesuffix("_ThemeBundle_DataAsset")
    tail = tail.removesuffix("ThemeBundle_DataAsset")
    return _normalize_collection_key(tail)


def _build_bundle_indexes(bundles: list[dict]) -> tuple[dict[str, dict], dict[str, list[dict]]]:
    by_theme_token = {}
    by_name: dict[str, list[dict]] = {}

    for bundle in bundles:
        bundle_name = bundle.get("displayName")
        name_key = _normalize_collection_key(bundle_name)
        token = _bundle_asset_token(bundle.get("assetPath"))

        if token and name_key:
            by_theme_token[f"{name_key}:{token}"] = bundle
        if name_key:
            by_name.setdefault(name_key, []).append(bundle)

    return by_theme_token, by_name


def _resolve_bundle_for_theme(
    theme: dict | None,
    bundles_by_theme_token: dict[str, dict],
    bundles_by_name: dict[str, list[dict]],
) -> dict | None:
    if not theme:
        return None

    name_key = _normalize_collection_key(theme.get("displayName"))
    token = _theme_asset_token(theme.get("assetPath"))
    if name_key and token:
        bundle = bundles_by_theme_token.get(f"{name_key}:{token}")
        if bundle:
            return bundle

    matches = bundles_by_name.get(name_key, []) if name_key else []
    if len(matches) == 1:
        return matches[0]
    return None


def _skin_image_path_if_present(
    weapon_uuid: str | None,
    skin_uuid: str | None,
    skin: dict,
    field_name: str,
) -> str | None:
    if not skin.get(field_name):
        return None
    return _local_weapon_skin_image(weapon_uuid, skin_uuid, field_name)


def _skin_bundle_item_candidates(skin: dict) -> set[str]:
    candidates: set[str] = set()

    def _maybe_add(raw_uuid):
        if isinstance(raw_uuid, str) and raw_uuid:
            candidates.add(raw_uuid)

    _maybe_add(skin.get("uuid") or skin.get("id"))
    for chroma in skin.get("chromas", []) or []:
        if isinstance(chroma, dict):
            _maybe_add(chroma.get("uuid") or chroma.get("id"))
    for level in skin.get("levels", []) or []:
        if isinstance(level, dict):
            _maybe_add(level.get("uuid") or level.get("id"))

    return candidates


def _nested_weapon_skin_image_if_present(
    weapon_uuid: str | None,
    skin_uuid: str | None,
    collection: str,
    item_uuid: str | None,
    item: dict,
    field_name: str,
) -> str | None:
    if not item.get(field_name):
        return None
    return (
        f"/content/weapons/{weapon_uuid}/skins/{skin_uuid}/"
        f"{collection}/{item_uuid}/{field_name}.png"
    )


def get_skins(limit=None):
    ultimo = mongo_content_repo.get_raw_latest()
    if not ultimo:
        return []

    themes = ultimo.get("themes", []) or []
    themes_by_uuid = {
        theme_uuid: theme
        for theme in themes
        for theme_uuid in (theme.get("uuid") or theme.get("id"),)
        if theme_uuid
    }
    bundles = ultimo.get("bundles", []) or []
    bundles_by_theme_token, bundles_by_name = _build_bundle_indexes(bundles)
    bundle_links: dict[str, dict] = {}
    for bundle in bundles:
        bundle_uuid = bundle.get("uuid") or bundle.get("id")
        bundle_name = bundle.get("displayName") or "Sin coleccion"
        for item_uuid in _iter_bundle_item_uuids(bundle):
            bundle_links[item_uuid] = {
                "uuid": bundle_uuid,
                "name": bundle_name,
                "promoImage": _bundle_promo_image(bundle, bundle_uuid),
            }

    skins = []

    for weapon in ultimo.get("weapons", []):
        weapon_uuid = weapon.get("uuid") or weapon.get("id")
        weapon_name = weapon.get("displayName", "—")

        for skin in weapon.get("skins", []):
            skin_uuid = skin.get("uuid") or skin.get("id")
            name = skin.get("displayName")
            if not name:
                continue

            theme_uuid = skin.get("themeUuid") or skin.get("themeUUID")
            theme = themes_by_uuid.get(theme_uuid) if theme_uuid else None
            theme_name = theme.get("displayName") if theme else None
            bundle_info = next(
                (
                    bundle_links[item_uuid]
                    for item_uuid in _skin_bundle_item_candidates(skin)
                    if item_uuid in bundle_links
                ),
                None,
            )
            matched_bundle = (
                None
                if bundle_info
                else _resolve_bundle_for_theme(
                    theme,
                    bundles_by_theme_token,
                    bundles_by_name,
                )
            )
            if bundle_info:
                collection_uuid = bundle_info.get("uuid")
                collection_name = bundle_info.get("name") or "Sin coleccion"
                collection_source = "bundle"
                collection_promo_image = bundle_info.get("promoImage")
            elif matched_bundle:
                bundle_uuid = matched_bundle.get("uuid") or matched_bundle.get("id")
                collection_uuid = bundle_uuid
                collection_name = matched_bundle.get("displayName") or theme_name or "Sin coleccion"
                collection_source = "bundle"
                collection_promo_image = _bundle_promo_image(matched_bundle, bundle_uuid)
            elif theme_uuid and theme_name:
                collection_uuid = theme_uuid
                collection_name = theme_name
                collection_source = "theme"
                collection_promo_image = None
            else:
                collection_uuid = None
                collection_name = "Sin coleccion"
                collection_source = "none"
                collection_promo_image = None

            chromas = []
            for chroma in skin.get("chromas", []) or []:
                chroma_uuid = chroma.get("uuid") or chroma.get("id")
                if not chroma_uuid:
                    continue
                chromas.append({
                    "uuid": chroma_uuid,
                    "displayName": chroma.get("displayName") or "Chroma",
                    "displayIcon": _nested_weapon_skin_image_if_present(
                        weapon_uuid,
                        skin_uuid,
                        "chromas",
                        chroma_uuid,
                        chroma,
                        "displayIcon",
                    ),
                    "fullRender": _nested_weapon_skin_image_if_present(
                        weapon_uuid,
                        skin_uuid,
                        "chromas",
                        chroma_uuid,
                        chroma,
                        "fullRender",
                    ),
                    "swatch": _nested_weapon_skin_image_if_present(
                        weapon_uuid,
                        skin_uuid,
                        "chromas",
                        chroma_uuid,
                        chroma,
                        "swatch",
                    ),
                    "streamedVideo": chroma.get("streamedVideo"),
                    "assetPath": chroma.get("assetPath"),
                })

            levels = []
            for level in skin.get("levels", []) or []:
                level_uuid = level.get("uuid") or level.get("id")
                if not level_uuid:
                    continue
                levels.append({
                    "uuid": level_uuid,
                    "displayName": level.get("displayName") or "Nivel",
                    "displayIcon": _nested_weapon_skin_image_if_present(
                        weapon_uuid,
                        skin_uuid,
                        "levels",
                        level_uuid,
                        level,
                        "displayIcon",
                    ),
                    "levelItem": level.get("levelItem"),
                    "streamedVideo": level.get("streamedVideo"),
                    "assetPath": level.get("assetPath"),
                })

            display_icon = _skin_image_path_if_present(
                weapon_uuid,
                skin_uuid,
                skin,
                "displayIcon",
            )
            wallpaper = _skin_image_path_if_present(
                weapon_uuid,
                skin_uuid,
                skin,
                "wallpaper",
            )
            first_chroma_image = next(
                (
                    chroma.get("fullRender")
                    or chroma.get("displayIcon")
                    for chroma in chromas
                    if (
                        chroma.get("fullRender")
                        or chroma.get("displayIcon")
                    )
                ),
                None,
            )
            first_level_image = next(
                (
                    level.get("displayIcon")
                    for level in levels
                    if level.get("displayIcon")
                ),
                None,
            )
            card_image = (
                display_icon
                or first_chroma_image
                or wallpaper
                or first_level_image
            )
            detail_image = (
                display_icon
                or first_chroma_image
                or wallpaper
                or first_level_image
            )

            skins.append({
                "uuid": skin_uuid,
                "displayName": name,
                "weaponUuid": weapon_uuid,
                "weaponName": weapon_name,
                "weaponImage": _local_weapon_image(weapon_uuid),
                "contentTierUuid": (
                    skin.get("contentTierUuid")
                    or skin.get("contentTierUUID")
                ),
                "themeUuid": theme_uuid,
                "themeName": theme_name or "Default",
                "displayIcon": display_icon,
                "wallpaper": wallpaper,
                "cardImage": card_image,
                "detailImage": detail_image,
                "chromasCount": len(chromas),
                "levelsCount": len(levels),
                "collectionUuid": collection_uuid,
                "collectionName": collection_name,
                "collectionSource": collection_source,
                "collectionPromoImage": collection_promo_image,
                "chromas": chromas,
                "levels": levels,
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
        item_uuid = b.get("uuid") or b.get("id")
        if not item_uuid:
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

        if item_uuid in vistos:
            continue

        vistos.add(item_uuid)
        resultado.append({
            "uuid": item_uuid,
            "displayName": nombre,
            "displayIcon": _local_content_image("bundles", item_uuid, "displayIcon"),
            "displayIcon2": _local_content_image("bundles", item_uuid, "displayIcon2"),
            "verticalPromoImage": _local_content_image(
                "bundles", item_uuid, "verticalPromoImage"
            ),
            "assetPath": b.get("assetPath"),
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
            "animationGif": _local_content_image("sprays", item_uuid, "animationGif", "gif"),
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
        theme_uuid = t.get("uuid") or t.get("id")
        resultado.append({
            "uuid": theme_uuid,
            "displayName": nombre,
            "displayIcon": _local_content_image(
                "themes",
                theme_uuid,
                "displayIcon",
            ) if t.get("displayIcon") else None,
            "storeFeaturedImage": _local_content_image(
                "themes",
                theme_uuid,
                "storeFeaturedImage",
            ) if t.get("storeFeaturedImage") else None,
            "assetPath": t.get("assetPath"),
        })

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
