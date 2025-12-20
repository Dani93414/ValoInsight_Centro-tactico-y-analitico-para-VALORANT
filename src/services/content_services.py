from db.mongo_client import content_collection, leaderboards_collection

def get_contenido_resumen():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
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
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        return []

    actos = []

    for act in ultimo.get("acts", []):
        actos.append({
            "id": act.get("id"),
            "name": act.get("name"),
            "isActive": act.get("isActive", False)
        })

    return actos

def get_leaderboard_acto(act_id: str, limit: int = 100):
    entry = leaderboards_collection.find_one({"act_id": act_id})
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

def get_agentes():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        return []

    agentes_response = []

    for ag in ultimo.get("agents", []):
        agente = {
            "displayName": ag.get("displayName", "—"),
            "description": ag.get("description", "—"),
            "displayIcon": ag.get("displayIcon"),  
            "role": {
                "displayName": ag.get("role", {}).get("displayName", "—")
            },
            "abilities": []
        }

        for hab in ag.get("abilities", []):
            agente["abilities"].append({
                "slot": hab.get("slot", "—"),
                "displayName": hab.get("displayName", "—"),
                "description": hab.get("description", "—")
            })

        agentes_response.append(agente)

    return agentes_response


def get_mapas_clasificados():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        return None

    raw_maps = ultimo.get("maps", [])

    core_maps = []
    skirmish_maps = []
    tdm_maps = []
    training_maps = []

    for mp in raw_maps:
        name = mp.get("displayName", "") or mp.get("name", "")

        mapa_data = {
            "displayName": mp.get("displayName", "—"),
            "coordinates": mp.get("coordinates", "—"),
            "tacticalDescription": mp.get("tacticalDescription", "—"),
        }

        if any(k in name for k in ["Campo de tiro", "Entrenamiento", "Práctica"]):
            training_maps.append(mapa_data)
            continue

        if "Escaramuza" in name:
            skirmish_maps.append(mapa_data)
            continue

        if any(k in name for k in ["District", "Kasbah", "Piazza", "Drift", "Glitch"]):
            tdm_maps.append(mapa_data)
            continue

        core_maps.append(mapa_data)

    return {
        "core": core_maps,
        "skirmish": skirmish_maps,
        "tdm": tdm_maps,
        "training": training_maps
    }


def get_armas_detalladas():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        return []

    armas = []

    for w in ultimo.get("weapons", []):
        shop = w.get("shopData") or {}
        stats = w.get("weaponStats") or {}
        ads = stats.get("adsStats") or {}
        damage_ranges = stats.get("damageRanges") or []

        armas.append({
            "displayName": w.get("displayName", "—"),
            "category": shop.get("categoryText", "—"),
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
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        return []

    return [
        {"displayName": b.get("displayName", "—")}
        for b in ultimo.get("buddies", [])
        if b.get("displayName")
    ]

def get_bundles_filtrados():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
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
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        return []

    return [
        {"displayName": c.get("displayName", "—")}
        for c in ultimo.get("ceremonies", [])
        if c.get("displayName")
    ]

def get_competitive_tiers():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        return []

    comp = ultimo.get("competitive_tiers", [])
    if not comp:
        return []

    ultimo_tier = comp[-1]
    tiers = ultimo_tier.get("tiers", [])

    resultado = []
    for t in tiers:
        division = t.get("divisionName", "")
        if division and "unused" in division.lower():
            continue

        resultado.append({
            "tierName": t.get("tierName", "—"),
            "divisionName": division
        })

    return resultado

def get_content_tiers():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        return []

    return [
        {"displayName": t.get("displayName", "—")}
        for t in ultimo.get("content_tiers", [])
    ]


def get_contracts():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
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
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        return []

    return [
        {"displayName": c.get("displayName", "—")}
        for c in ultimo.get("currencies", [])
    ]


def get_events():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
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
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
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
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
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
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
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
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        return []

    levelborders = ultimo.get("levelborders", [])
    to_iter = levelborders if limit is None else levelborders[:limit]

    return [
        {"displayName": lb.get("displayName", "—")}
        for lb in to_iter
    ]

def get_playercards(limit=None):
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        return []

    playercards = ultimo.get("playercards", [])
    to_iter = playercards if limit is None else playercards[:limit]

    return [
        {"displayName": pc.get("displayName", "—")}
        for pc in to_iter
    ]

def get_playertitles(limit=None):
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
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
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
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
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
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
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
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
