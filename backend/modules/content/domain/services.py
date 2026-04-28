"""Pure domain logic for content: image path resolution, map classification."""

import re


def sanitize_segment(value) -> str:
    text = str(value if value is not None else "item").strip()
    text = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", text)
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"_+", "_", text)
    text = text.strip("._")
    return text[:120] if text else "item"


# ── Image path resolution ────────────────────────────────────────────

def local_agent_image(agent_uuid: str | None, field_name: str | None) -> str | None:
    if not agent_uuid or not field_name:
        return None
    return f"/content/agents/{agent_uuid}/{field_name}.png"


def local_agent_role_icon(agent_uuid: str | None) -> str | None:
    if not agent_uuid:
        return None
    return f"/content/agents/{agent_uuid}/role/displayIcon.png"


def local_agent_ability_icon(agent_uuid: str | None, ability_display_name: str | None) -> str | None:
    if not agent_uuid or not ability_display_name:
        return None
    sanitized = sanitize_segment(ability_display_name)
    return f"/content/agents/{agent_uuid}/abilities/{sanitized}/displayIcon.png"


def local_weapon_image(weapon_uuid: str | None) -> str | None:
    if not weapon_uuid:
        return None
    return f"/content/weapons/{weapon_uuid}/displayIcon.png"


def local_content_image(
    collection: str | None,
    item_uuid: str | None,
    field_name: str | None,
    extension: str = "png",
) -> str | None:
    if not collection or not item_uuid or not field_name:
        return None
    safe_extension = extension.lstrip(".") or "png"
    return f"/content/{collection}/{item_uuid}/{field_name}.{safe_extension}"


def local_weapon_skin_image(
    weapon_uuid: str | None,
    skin_uuid: str | None,
    field_name: str | None,
    extension: str = "png",
) -> str | None:
    if not weapon_uuid or not skin_uuid or not field_name:
        return None
    safe_extension = extension.lstrip(".") or "png"
    return (
        f"/content/weapons/{weapon_uuid}/skins/{skin_uuid}/"
        f"{field_name}.{safe_extension}"
    )


def local_competitive_tier_icon(
    tier_set_uuid: str | None,
    tier_name_sanitized: str | None,
    icon_field: str | None,
) -> str | None:
    if not tier_set_uuid or not tier_name_sanitized or not icon_field:
        return None
    return (
        f"/content/competitive_tiers/{tier_set_uuid}/tiers/"
        f"{tier_name_sanitized}/{icon_field}.png"
    )


# ── Map classification ───────────────────────────────────────────────

_TRAINING_KEYWORDS = ("Campo de tiro", "Entrenamiento", "Práctica")
_SKIRMISH_KEYWORD = "Escaramuza"
_TDM_KEYWORDS = ("District", "Kasbah", "Piazza", "Drift", "Glitch")
_NON_CORE_KEYWORDS = _TRAINING_KEYWORDS + (_SKIRMISH_KEYWORD,) + _TDM_KEYWORDS


def classify_maps(raw_maps: list[dict]) -> dict[str, list[dict]]:
    core, skirmish, tdm, training = [], [], [], []

    for mp in raw_maps:
        name = mp.get("displayName", "") or mp.get("name", "")
        uuid = mp.get("uuid") or mp.get("mapUrl", "").rsplit("/", 1)[-1]
        mapa_data = {
            "uuid": uuid,
            "displayName": mp.get("displayName", "—"),
            "coordinates": mp.get("coordinates", "—"),
            "narrativeDescription": mp.get("narrativeDescription"),
            "tacticalDescription": mp.get("tacticalDescription", "—"),
            "callouts": mp.get("callouts") or [],
            "displayIcon": local_content_image("maps", uuid, "displayIcon"),
            "listViewIcon": local_content_image("maps", uuid, "listViewIcon"),
            "listViewIconTall": local_content_image("maps", uuid, "listViewIconTall"),
            "splash": local_content_image("maps", uuid, "splash"),
            "stylizedBackgroundImage": local_content_image(
                "maps", uuid, "stylizedBackgroundImage"
            ),
            "premierBackgroundImage": local_content_image(
                "maps", uuid, "premierBackgroundImage"
            ),
        }

        if any(k in name for k in _TRAINING_KEYWORDS):
            training.append(mapa_data)
        elif _SKIRMISH_KEYWORD in name:
            skirmish.append(mapa_data)
        elif any(k in name for k in _TDM_KEYWORDS):
            tdm.append(mapa_data)
        else:
            core.append(mapa_data)

    return {"core": core, "skirmish": skirmish, "tdm": tdm, "training": training}


def filter_geo_maps(raw_maps: list[dict]) -> list[dict]:
    result = []
    for mp in raw_maps:
        name = mp.get("displayName", "") or mp.get("name", "")
        if any(k in name for k in _NON_CORE_KEYWORDS):
            continue

        uuid = mp.get("uuid") or mp.get("mapUrl", "").rsplit("/", 1)[-1]
        x_mult = mp.get("xMultiplier")
        x_add = mp.get("xScalarToAdd")
        y_mult = mp.get("yMultiplier")
        y_add = mp.get("yScalarToAdd")
        if x_mult is None or x_add is None or y_mult is None or y_add is None:
            continue

        result.append({
            "uuid": uuid,
            "displayName": mp.get("displayName", "—"),
            "displayIcon": mp.get("displayIcon"),
            "xMultiplier": x_mult,
            "xScalarToAdd": x_add,
            "yMultiplier": y_mult,
            "yScalarToAdd": y_add,
        })
    return result


def normalize_weapon_category(w: dict, shop: dict) -> str:
    raw = shop.get("categoryText") or w.get("category") or ""
    raw_str = str(raw).strip()
    if not raw_str or raw_str in {"-", "--", "---", "-", "—", "–"}:
        return "CUERPO A CUERPO"
    if "melee" in raw_str.lower():
        return "CUERPO A CUERPO"
    return raw_str
