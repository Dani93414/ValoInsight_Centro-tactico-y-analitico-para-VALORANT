import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.api.riot_client import (
    get_puuid,
    get_valorant_content,
    get_platform_status,
    get_leaderboard
)

from db.mongo_client import (
    content_collection,
    leaderboards_collection
)

from src.api.valorant_api_client import (
    get_agents_es,
    get_maps_es,
    get_weapons_es,
    get_buddies_es,
    get_bundles_es,
    get_ceremonies_es,
    get_competitivetiers_es,
    get_contenttiers_es,
    get_contracts_es,
    get_currencies_es,
    get_events_es,
    get_flex_es,
    get_gamemodes_es,
    get_gear_es,
    get_levelborders_es,
    get_playercards_es,
    get_playertitles_es,
    get_sprays_es,
    get_themes_es,
    get_version_es
)


# ================================
#  OPCIÓN 1 → Obtener datos
# ================================
def obtener_datos():
    print("🗑️ Borrando datos anteriores...")

    content_collection.delete_many({})
    leaderboards_collection.delete_many({})

    print("✔ Base de datos limpia.\n")

    # ---------------------------------------
    # 1. Obtener PUUID
    # ---------------------------------------
    game_name = "No Screams"
    tag_line = "GFS"

    print(f"\n🔎 Obteniendo datos de {game_name}#{tag_line}…")
    puuid = get_puuid(game_name, tag_line)
    print(f"✅ PUUID obtenido: {puuid}")

    # ---------------------------------------
    # 2. Obtener contenido de Valorant
    # ---------------------------------------
    print("\n📦 Obteniendo contenido de Valorant…")
    content = get_valorant_content()

    print("\n🧍 Obteniendo agentes desde Valorant-API (ES)...")
    agents = get_agents_es()

    print("\n🗺️ Obteniendo mapas desde Valorant-API (ES)...")
    maps_data = get_maps_es()

    print("\n🔫 Obteniendo armas desde Valorant-API (ES)...")
    weapons_vapi = get_weapons_es()
    
    print("\n🎒 Obteniendo buddies desde Valorant-API (ES)...")
    buddies = get_buddies_es()

    print("\n🎁 Obteniendo bundles desde Valorant-API (ES)...")
    bundles = get_bundles_es()

    print("\n🎉 Obteniendo ceremonias desde Valorant-API (ES)...")
    ceremonies = get_ceremonies_es()

    print("\n🏆 Obteniendo competitive tiers desde Valorant-API (ES)...")
    competitive_tiers = get_competitivetiers_es()

    print("\n⬆️ Obteniendo content tiers desde Valorant-API (ES)...")
    content_tiers = get_contenttiers_es()

    print("\n📜 Obteniendo contratos desde Valorant-API (ES)...")
    contracts = get_contracts_es()

    print("\n💰 Obteniendo monedas desde Valorant-API (ES)...")
    currencies = get_currencies_es()

    print("\n🎟️ Obteniendo eventos desde Valorant-API (ES)...")
    events = get_events_es()

    print("\n🌀 Obteniendo flex desde Valorant-API (ES)...")
    flex = get_flex_es()

    print("\n🎮 Obteniendo modos de juego desde Valorant-API (ES)...")
    gamemodes = get_gamemodes_es()

    print("\n⚙️ Obteniendo gear desde Valorant-API (ES)...")
    gear = get_gear_es()

    print("\n🎖️ Obteniendo bordes de nivel desde Valorant-API (ES)...")
    levelborders = get_levelborders_es()

    print("\n🖼️ Obteniendo player cards desde Valorant-API (ES)...")
    playercards = get_playercards_es()

    print("\n🏅 Obteniendo player titles desde Valorant-API (ES)...")
    playertitles = get_playertitles_es()

    print("\n🌈 Obteniendo sprays desde Valorant-API (ES)...")
    sprays = get_sprays_es()

    print("\n🎨 Obteniendo themes desde Valorant-API (ES)...")
    themes = get_themes_es()

    print("\n🔍 Obteniendo versión del juego desde Valorant-API (ES)...")
    version = get_version_es()
    acts = content.get("acts", [])

    print(f"✔ Agentes (Valorant-API): {len(agents)}")
    print(f"✔ Mapas (Valorant-API): {len(maps_data)}")
    print(f"✔ Armas (Valorant-API): {len(weapons_vapi)}")
    print(f"✔ Buddies (Valorant-API): {len(buddies)}")
    print(f"✔ Bundles (Valorant-API): {len(bundles)}")
    print(f"✔ Ceremonias (Valorant-API): {len(ceremonies)}")
    print(f"✔ Competitive Tiers (Valorant-API): {len(competitive_tiers)}")
    print(f"✔ Content Tiers (Valorant-API): {len(content_tiers)}")
    print(f"✔ Contratos (Valorant-API): {len(contracts)}")
    print(f"✔ Monedas (Valorant-API): {len(currencies)}")
    print(f"✔ Eventos (Valorant-API): {len(events)}")
    print(f"✔ Flex (Valorant-API): {len(flex)}")
    print(f"✔ Modos de juego (Valorant-API): {len(gamemodes)}")
    print(f"✔ Gear (Valorant-API): {len(gear)}")
    print(f"✔ Bordes de nivel (Valorant-API): {len(levelborders)}")
    print(f"✔ Player Cards (Valorant-API): {len(playercards)}")
    print(f"✔ Player Titles (Valorant-API): {len(playertitles)}")
    print(f"✔ Sprays (Valorant-API): {len(sprays)}")
    print(f"✔ Themes (Valorant-API): {len(themes)}")
    print(f"✔ Versión del juego (Valorant-API): {version.get('version', '—')}")
    print(f"✔ Actos: {len(acts)}")

    # Filtrar solo agentes jugables
    agents_data = [
        ag for ag in agents if ag.get("isPlayableCharacter")
    ]


    content_collection.insert_one({
        "type": "valorant_content",
        "agents": agents_data,
        "maps": maps_data,
        "weapons": weapons_vapi,
        "acts": acts,
        "buddies": buddies,
        "bundles": bundles,
        "ceremonies": ceremonies,
        "competitive_tiers": competitive_tiers,
        "content_tiers": content_tiers,
        "contracts": contracts,
        "currencies": currencies,
        "events": events,
        "flex": flex,
        "gamemodes": gamemodes,
        "gear": gear,
        "levelborders": levelborders,
        "playercards": playercards,
        "playertitles": playertitles,
        "sprays": sprays,
        "themes": themes,
        "version": version
    })

    print("💾 Contenido guardado en 'content'.")
    # ---------------------------------------
    # 3. Guardar leaderboards
    # ---------------------------------------
    print("\n🏆 Guardando leaderboards de TODOS los actos…")

    real_acts = [a for a in acts if a.get("type") == "act"]
    print(f"📌 Total de actos reales: {len(real_acts)}\n")

    for act in real_acts:
        act_id = act["id"]
        act_name = act["name"]
        is_active = act.get("isActive", False)

        print(f"🏅 {act_name} ({act_id})…")

        try:
            leaderboard = get_leaderboard(act_id)

            leaderboards_collection.insert_one({
                "type": "leaderboard",
                "act_id": act_id,
                "act_name": act_name,
                "isActive": is_active,
                "data": leaderboard
            })

            print(f"   ✔ Guardado — Jugadores: {len(leaderboard.get('players', []))}")

        except Exception as e:
            print(f"   ⚠️ No se pudo obtener: {e}")

    print("\n🎉 Proceso completado.\n")


# ================================
#  OPCIÓN 2 → Mostrar datos
# ================================
def mostrar_menu_visualizacion():

    while True:
        print("\n📊 MOSTRAR DATOS")
        print("1. Mostrar contenido general")
        print("2. Mostrar actos disponibles")
        print("3. Mostrar leaderboard de un acto")
        print("4. Mostrar agentes")
        print("5. Mostrar mapas")
        print("6. Mostrar armas")
        print("7. Mostrar llaveros")
        print("8. Mostrar Paquete de Skins de la tienda")
        print("9. Mostrar Ceremonias tras ronda")
        print("10. Mostrar los diferentes rangos en el juego")
        print("11. Mostrar los rangos del paquete de skins")
        print("12. Mostrar los diferentes contratos")
        print("13. Mostrar los recursos de compra")
        print("14. Mostrar los diferentes eventos")
        print("15. Mostrar flex")
        print("16. Mostrar modos de juego")
        print("17. Mostrar escudos")
        print("18. Mostrar bordes de nivel")
        print("19. Mostrar tarjeta de jugador")
        print("20. Mostrar títulos de jugador")
        print("21. Mostrar grafitis")
        print("22 Mostrar las diferentes líneas de Skins")
        print("23. Mostrar la versión del juego")
        print("24. Volver al menú principal")

        opcion = input("Selecciona una opción: ")

        if opcion == "1":
            mostrar_contenido()

        elif opcion == "2":
            mostrar_actos()

        elif opcion == "3":
            mostrar_leaderboard_acto()

        elif opcion == "4":
            mostrar_agentes()

        elif opcion == "5":
            mostrar_mapas()

        elif opcion == "6":
            mostrar_armas()

        elif opcion == "7":
            mostrar_buddies()

        elif opcion == "8":
            mostrar_bundles()

        elif opcion == "9":
            mostrar_ceremonies()

        elif opcion == "10":
            mostrar_competitivetiers()

        elif opcion == "11":
            mostrar_contenttiers()

        elif opcion == "12":
            mostrar_contracts()

        elif opcion == "13":
            mostrar_currencies()

        elif opcion == "14":
            mostrar_events()

        elif opcion == "15":
            mostrar_flex()

        elif opcion == "16":
            mostrar_gamemodes()

        elif opcion == "17":
            mostrar_gear()

        elif opcion == "18":
            mostrar_levelborders()

        elif opcion == "19":
            mostrar_playercards()

        elif opcion == "20":
            mostrar_playertitles()

        elif opcion == "21":
            mostrar_sprays()

        elif opcion == "22":
            mostrar_themes()

        elif opcion == "23":
            mostrar_version()

        elif opcion == "24":
            return

        else:
            print("❌ Opción no válida.")


def mostrar_contenido():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])

    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    agents_data = ultimo["agents"]
    weapons = ultimo["weapons"]
    maps = ultimo["maps"]
    acts = ultimo["acts"]

    total_agentes = len(agents_data)

    print("\n====== CONTENIDO ======")
    print(f"Agentes: {total_agentes}")
    print(f"Mapas: {len(maps)}")
    print(f"Armas: {len(weapons)}")
    print(f"Actos: {len(acts)}")
    print("=======================\n")


def mostrar_actos():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])

    if not ultimo:
        print("⚠️ No hay actos guardados.")
        return

    acts = ultimo["acts"]
    print("\n====== ACTOS ======")
    for act in acts:
        print(f"- {act['name']} ({act['id']}) — Activo: {act.get('isActive', False)}")
    print("===================\n")


def mostrar_leaderboard_acto():
    act_id = input("\n📥 Introduce el ID del acto: ")

    entry = leaderboards_collection.find_one({"act_id": act_id})

    if not entry:
        print("⚠️ No se encontró leaderboard para ese acto.")
        return

    act_name = entry.get("act_name", act_id)
    players = entry.get("data", {}).get("players", [])

    total_to_show = min(100, len(players))

    print(f"\n🏅 Leaderboard de {act_name} — Top {total_to_show} jugadores (de {len(players)})\n")

    for i, p in enumerate(players[:total_to_show], start=1):
        game_name = p.get("gameName", "Unknown")
        tag_line = p.get("tagLine", "")
        rank = p.get("leaderboardRank", "?")
        rr = p.get("rankedRating", "?")
        wins = p.get("numberOfWins", "?")

        print(
            f"{i}. {game_name}#{tag_line} | "
            f"Rank: {rank} | RR: {rr} | Wins: {wins}"
        )

    print("\n")


# ================================
#  FUNCIONES EXTRA — AGENTES/MAPAS/ARMAS
# ================================
import textwrap

def mostrar_agentes():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])

    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    agents = ultimo.get("agents", [])

    print("\n====== AGENTES ======\n")

    for ag in agents:

        nombre = ag.get("displayName", "—")
        descripcion = ag.get("description", "—")

        rol = ag.get("role", {})
        rol_nombre = rol.get("displayName", "—")

        print(f"🧩 Agente: {nombre}")
        print(f"    🎭 Rol: {rol_nombre}")
        print("    📝 Descripción:")

        # Ajustar el texto para que respete sangría en nuevas líneas
        wrapper = textwrap.TextWrapper(width=80, initial_indent="        ", subsequent_indent="        ")
        print(wrapper.fill(descripcion))

        print(f"    ⭐ Habilidades:")

        habilidades = ag.get("abilities", [])

        if not habilidades:
            print("        (Sin habilidades)")
        else:
            for hab in habilidades:
                slot = hab.get("slot", "—")          # Ability1, Ultimate…
                hab_nombre = hab.get("displayName", "—")
                hab_desc = hab.get("description", "—")

                print(f"        • {slot} → {hab_nombre}")
                desc_wrapper = textwrap.TextWrapper(width=80, initial_indent="             ", subsequent_indent="             ")
                print(desc_wrapper.fill(hab_desc))

        print("-" * 60)

    print("\n======================\n")

def mostrar_mapas():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])

    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    raw_maps = ultimo.get("maps", [])

    # Contenedores de clasificación dinámica
    core_maps = []
    skirmish_maps = []
    tdm_maps = []
    training_maps = []

    # Clasificar SOLO al mostrar
    for mp in raw_maps:
        name = mp.get("displayName", "") or mp.get("name", "")

        # Entrenamiento
        if any(k in name for k in ["Campo de tiro", "Entrenamiento", "Práctica"]):
            training_maps.append(mp)
            continue

        # Escaramuza
        if "Escaramuza" in name:
            skirmish_maps.append(mp)
            continue

        # TDM
        if any(k in name for k in ["District", "Kasbah", "Piazza", "Drift", "Glitch"]):
            tdm_maps.append(mp)
            continue

        # El resto → core
        core_maps.append(mp)

    print("\n====== MAPAS (CLASIFICADOS) ======\n")

    print("🌍 MODOS NORMALES / COMPETITIVO:")
    if core_maps:
        for m in core_maps:
            nombre = m.get("displayName", "—")
            coords = m.get("coordinates", "—")
            tactica = m.get("tacticalDescription", "—")

            print(f"🗺️ Mapa: {nombre}")
            print(f"   📍 Coordenadas: {coords}")
            print(f"   🎯 Explicación táctica: {tactica}")
            print("-" * 60)
    else:
        print("(Ninguno)")
    print()

    print("⚔️ ESCARAMUZA:")
    if skirmish_maps:
        for m in skirmish_maps:
            nombre = m.get("displayName", "—")
            coords = m.get("coordinates", "—")
            tactica = m.get("tacticalDescription", "—")

            print(f"🗺️ Mapa: {nombre}")
            print(f"   📍 Coordenadas: {coords}")
            print(f"   🎯 Explicación táctica: {tactica}")
            print("-" * 60)
    else:
        print("(Ninguno)")
    print()

    print("🔫 COMBATE A MUERTE POR EQUIPOS (TDM):")
    if tdm_maps:
        for m in tdm_maps:
            nombre = m.get("displayName", "—")
            coords = m.get("coordinates", "—")
            tactica = m.get("tacticalDescription", "—")

            print(f"🗺️ Mapa: {nombre}")
            print(f"   📍 Coordenadas: {coords}")
            print(f"   🎯 Explicación táctica: {tactica}")
            print("-" * 60)
    else:
        print("(Ninguno)")
    print()

    print("🎯 ENTRENAMIENTO / CAMPO DE TIRO:")
    if training_maps:
        for m in training_maps:
            nombre = m.get("displayName", "—")
            coords = m.get("coordinates", "—")
            tactica = m.get("tacticalDescription", "—")

            print(f"🗺️ Mapa: {nombre}")
            print(f"   📍 Coordenadas: {coords}")
            print(f"   🎯 Explicación táctica: {tactica}")
            print("-" * 60)
    else:
        print("(Ninguno)")
    print()

    print("===================================\n")

def mostrar_armas():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])

    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    weapons = ultimo.get("weapons", [])

    print("\n====== ARMAS ======\n")

    for w in weapons:
        nombre = w.get("displayName", "—")

        # shopData está al mismo nivel que weaponStats
        shop = w.get("shopData") or {}
        categoria = shop.get("categoryText", "—")
        coste = shop.get("cost", "—")  # ← NUEVO

        # weaponStats contiene adsStats y damageRanges
        stats = w.get("weaponStats") or {}
        ads = stats.get("adsStats") or {}
        damage_ranges = stats.get("damageRanges") or []

        print(f"🔫 Arma: {nombre}")
        print(f"   📦 Categoría: {categoria}")
        print(f"   💰 Coste: {coste}")  # ← NUEVO

        print("   📊 Estadísticas:")

        if stats:
            print(f"      • Cadencia de tiro (Disparos/s): {stats.get('fireRate', '—')}")
            print(f"      • Capacidad del cargador: {stats.get('magazineSize', '—')}")
            print(f"      • Multiplicador de velocidad al correr: {stats.get('runSpeedMultiplier', '—')}")
            print(f"      • Tiempo para equipar (s): {stats.get('equipTimeSeconds', '—')}")
            print(f"      • Tiempo de recarga (s): {stats.get('reloadTimeSeconds', '—')}")
            print(f"      • Precisión de la primera bala: {stats.get('firstBulletAccuracy', '—')}")
            print(f"      • Perdigones por disparo: {stats.get('shotgunPelletCount', '—')}")
            print(f"      • Penetración de paredes: {stats.get('wallPenetration', '—')}")
            print(f"      • Característica especial: {stats.get('feature', '—')}")
            print(f"      • Modo alternativo de fuego: {stats.get('fireMode', '—')}")
            print(f"      • Tipo de mira (ADS): {stats.get('altFireType', '—')}")
        else:
            print("      (Sin stats disponibles)")

        print("   🎯 Datos con mira:")
        if ads:
            print(f"      • Multiplicador de zoom: {ads.get('zoomMultiplier', '—')}")
            print(f"      • Cadencia: {ads.get('fireRate', '—')}")
            print(f"      • Velocidad al correr: {ads.get('runSpeedMultiplier', '—')}")
            print(f"      • Precisión primera bala: {ads.get('firstBulletAccuracy', '—')}")
            print(f"      • Balas por ráfaga: {ads.get('burstCount', '—')}")
        else:
            print("      (Arma sin mira)")

        print("   💥 Daño por rango:")
        if damage_ranges:
            for dr in damage_ranges:
                print(f"      • {dr.get('rangeStartMeters', '—')}m - {dr.get('rangeEndMeters', '—')}m:")
                print(f"           - Cabeza: {dr.get('headDamage', '—')}")
                print(f"           - Cuerpo: {dr.get('bodyDamage', '—')}")
                print(f"           - Piernas: {dr.get('legDamage', '—')}")
        else:
            print("      (Sin rangos de daño disponibles)")

        print("-" * 60)

    print("\n===================\n")

def mostrar_buddies():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay buddies guardados.")
        return

    buddies = ultimo.get("buddies", [])

    print("\n====== BUDDIES ======\n")
    for b in buddies:
        print(f"- {b.get('displayName', '—')}")
    print("\n======================\n")

def mostrar_bundles():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay bundles guardados.")
        return

    bundles = ultimo.get("bundles", [])

    print("\n====== BUNDLES ======\n")

    vistos = set()  # Para evitar duplicados

    for b in bundles:
        nombre = b.get("displayName", "—")

        # Normalizar para comparar (lowercase + quitar acentos)
        if nombre:
            nombre_norm = (
                nombre.lower()
                .replace("á", "a")
                .replace("é", "e")
                .replace("í", "i")
                .replace("ó", "o")
                .replace("ú", "u")
            )
        else:
            continue  # ignorar si nombre es None

        # ❌ Filtrar los que contengan "capsulas"
        if "capsulas" in nombre_norm:
            continue

        # ❌ Evitar duplicados
        if nombre in vistos:
            continue

        vistos.add(nombre)
        print(f"- {nombre}")

    print("\n======================\n")


def mostrar_ceremonies():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay ceremonias guardadas.")
        return

    ceremonies = ultimo.get("ceremonies", [])

    print("\n====== CEREMONIAS ======\n")
    for c in ceremonies:
        print(f"- {c.get('displayName', '—')}")
    print("\n=========================\n")

def mostrar_competitivetiers():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay competitive tiers guardados.")
        return

    comp = ultimo.get("competitive_tiers", [])

    if not comp:
        print("⚠️ Lista vacía.")
        return

    ultimo_tier = comp[-1]
    tiers = ultimo_tier.get("tiers", [])

    print("\n====== COMPETITIVE TIERS ======\n")

    for t in tiers:
        nombre = t.get("tierName", "—")
        division = t.get("divisionName", "")

        # Evitar imprimir si divisionName contiene "unused" (case-insensitive)
        if division and "unused" in division.lower():
            continue

        print(f"- {nombre}")

    print("\n==============================================\n")



def mostrar_contenttiers():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay content tiers guardados.")
        return

    tiers = ultimo.get("content_tiers", [])

    print("\n====== CONTENT TIERS ======\n")
    for t in tiers:
        print(f"- {t.get('displayName', '—')}")
    print("\n===========================\n")

def mostrar_contracts():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay contratos guardados.")
        return

    contracts = ultimo.get("contracts", [])

    print("\n====== CONTRATOS ======\n")

    for c in contracts:
        display_name = c.get("displayName", "—")
        content = c.get("content", {})
        chapters = content.get("chapters", [])

        print(f"📜 {display_name}")
        print(f"   📂 Chapters: {len(chapters)}")

        # Recorremos capítulos
        for i, chapter in enumerate(chapters):
            print(f"   ├─ 📘 Chapter {i + 1}")

            levels = chapter.get("levels", [])
            print(f"   │    🔢 Niveles: {len(levels)}")

            # Recorremos niveles
            for idx, lvl in enumerate(levels):

                # XP y cost están en el propio nivel, NO en "reward"
                xp = lvl.get("xp", None)
                vp_cost = lvl.get("vpCost", -1)
                dough_cost = lvl.get("doughCost", -1)

                # Lógica de coste
                if (vp_cost and vp_cost > 0) and (dough_cost and dough_cost > 0):
                    cost_str = f"{vp_cost} VP **o** {dough_cost} Créditos Kingdom"
                elif vp_cost and vp_cost > 0:
                    cost_str = f"{vp_cost} VP"
                elif dough_cost and dough_cost > 0:
                    cost_str = f"{dough_cost} Créditos Kingdom"
                else:
                    cost_str = "Gratis / No comprable"

                print(f"   │       • Level {idx + 1}:")
                print(f"   │           - XP: {xp if xp is not None else '—'}")
                print(f"   │           - Coste: {cost_str}")

        print("-" * 60)

    print("\n=========================\n")



def mostrar_currencies():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay monedas guardadas.")
        return

    curr = ultimo.get("currencies", [])

    print("\n====== MONEDAS ======\n")
    for c in curr:
        print(f"- {c.get('displayName', '—')}")
    print("\n======================\n")

def mostrar_events():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay eventos guardados.")
        return

    events = ultimo.get("events", [])

    print("\n====== EVENTOS ======\n")
    for e in events:
        nombre = e.get("displayName", "—")
        inicio = e.get("startTime", "—")
        fin = e.get("endTime", "—")
        print(f"📌 {nombre}")
        print(f"   ⏳ Inicio: {inicio}")
        print(f"   🏁 Fin: {fin}")
        print("-" * 50)
    print("\n======================\n")


# --------------------------
# Mostrar Flex
# --------------------------
def mostrar_flex(limit=None):
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    flex = ultimo.get("flex", [])
    total = len(flex)
    print(f"\n====== FLEX ====== (Total: {total})\n")

    to_iter = flex if limit is None else flex[:limit]

    # Palabras prohibidas (lowercase comparison)
    prohibidas = {"ninguno", "none"}

    for f in to_iter:
        nombre = f.get("displayName", f.get("displayNameAllCaps", "—"))

        # Normalizar para comparar
        if nombre and nombre.lower() in prohibidas:
            continue  # ❌ Saltar este elemento

        print(f"- {nombre}")

    print("\n===================\n")



# --------------------------
# Mostrar GameModes (nombre, descripción, duración)
# --------------------------
def mostrar_gamemodes(limit=None):
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    gamemodes = ultimo.get("gamemodes", [])
    total = len(gamemodes)
    print(f"\n====== GAME MODES ====== (Total: {total})\n")

    to_iter = gamemodes if limit is None else gamemodes[:limit]
    for g in to_iter:
        nombre = g.get("displayName", "—")
        descripcion = g.get("description", "—")
        duracion = g.get("duration", "—")
        uuid = g.get("uuid", "—")

        print(f"- {nombre} ({uuid})")

        desc_wrapper = textwrap.TextWrapper(
            width=80,
            initial_indent="    ",
            subsequent_indent="    "
        )

        print(desc_wrapper.fill(f"Descripción: {descripcion}"))
        print(f"    ⏱ Duración: {duracion}")
        print("-" * 60)

    print("\n========================\n")


# --------------------------
# Mostrar Gear (escudos) — nombre, descripción, coste
# --------------------------
def mostrar_gear(limit=None):
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    gear = ultimo.get("gear", [])
    total = len(gear)
    print(f"\n====== GEAR (ESCUDOS) ====== (Total: {total})\n")

    to_iter = gear if limit is None else gear[:limit]
    for item in to_iter:
        nombre = item.get("displayName", "—")
        descripcion = item.get("description", "—")

        shop = item.get("shopData") or {}
        coste = shop.get("cost", "—")

        print(f"- {nombre}")
        print(f"    Descripción: {descripcion}")
        print(f"    Coste: {coste}")
        print("-" * 60)

    print("\n============================\n")



# --------------------------
# Mostrar Level Borders (nombre)
# --------------------------
def mostrar_levelborders(limit=None):
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    levelborders = ultimo.get("levelborders", [])
    total = len(levelborders)
    print(f"\n====== LEVEL BORDERS ====== (Total: {total})\n")

    to_iter = levelborders if limit is None else levelborders[:limit]
    for lb in to_iter:
        nombre = lb.get("displayName", "—")
        print(f"- {nombre}")

    print("\n===========================\n")


# --------------------------
# Mostrar Player Cards (nombre)
# --------------------------
def mostrar_playercards(limit=None):
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    playercards = ultimo.get("playercards", [])
    total = len(playercards)
    print(f"\n====== PLAYER CARDS ====== (Total: {total})\n")

    to_iter = playercards if limit is None else playercards[:limit]
    for pc in to_iter:
        nombre = pc.get("displayName", "—")
        print(f"- {nombre}")

    print("\n==========================\n")



# --------------------------
# Mostrar Player Titles (nombre y titleText)
# --------------------------
def mostrar_playertitles(limit=None):
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    titles = ultimo.get("playertitles", [])
    total = len(titles)
    print(f"\n====== PLAYER TITLES ====== (Total: {total})\n")

    to_iter = titles if limit is None else titles[:limit]

    # Palabras a ignorar (case-insensitive)
    prohibidas = {"ninguno", "none", "null"}

    for t in to_iter:
        nombre = t.get("displayName")

        # ❌ Ignorar si el nombre es None o vacío
        if nombre is None or nombre == "":
            continue

        # ❌ Ignorar si coincide con palabras prohibidas
        if nombre.lower() in prohibidas:
            continue

        print(f"- {nombre}")

    print("\n==========================\n")



# --------------------------
# Mostrar Sprays / Grafitis (nombre y si es animado)
# --------------------------
def mostrar_sprays(limit=None):
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    sprays = ultimo.get("sprays", [])
    total = len(sprays)
    print(f"\n====== SPRAYS / GRAFITIS ====== (Total: {total})\n")

    to_iter = sprays if limit is None else sprays[:limit]

    # Palabras prohibidas (case-insensitive)
    prohibidas = {"ninguno", "none"}

    for s in to_iter:
        nombre = s.get("displayName", "—")

        # Saltar sprays cuyo nombre sea "Ninguno", "None", etc.
        if nombre and nombre.lower() in prohibidas:
            continue

        anim_png = s.get("animationPng")
        anim_gif = s.get("animationGif")
        is_animated = bool(anim_png or anim_gif)

        print(f"- {nombre} — Animado: {is_animated}")

    print("\n==============================\n")

# --------------------------
# Mostrar Themes (nombre)
# --------------------------
def mostrar_themes(limit=None):
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    themes = ultimo.get("themes", [])
    total = len(themes)
    print(f"\n====== THEMES ====== (Total: {total})\n")

    to_iter = themes if limit is None else themes[:limit]

    vistos = set()  # Para evitar duplicados

    for t in to_iter:
        nombre = t.get("displayName", "—")

        if nombre in vistos:
            continue  # Saltar duplicados

        vistos.add(nombre)
        print(f"- {nombre}")

    print("\n=====================\n")



# --------------------------
# Mostrar Version (todos los datos)
# --------------------------
def mostrar_version():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])
    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    version = ultimo.get("version") or {}
    if not version:
        print("⚠️ No hay versión guardada.")
        return

    print("\n====== VERSION DEL JUEGO ======\n")
    # Mostrar todos los campos relevantes si existen
    campos = [
        "manifestId", "branch", "version", "buildVersion",
        "engineVersion", "riotClientVersion", "riotClientBuild", "buildDate"
    ]
    for c in campos:
        print(f"{c}: {version.get(c, '—')}")

    # Mostrar cualquier otro campo no listado anteriormente
    extras = {k: v for k, v in version.items() if k not in campos}
    if extras:
        print("\nOtros campos:")
        for k, v in extras.items():
            print(f"  {k}: {v}")

    print("\n==============================\n")


# ================================
#  MENÚ PRINCIPAL
# ================================
def main_menu():
    while True:
        print("\n===============================")
        print("        MENÚ PRINCIPAL")
        print("===============================\n")
        print("1. Obtener datos de Riot")
        print("2. Mostrar datos guardados")
        print("3. Salir\n")

        opcion = input("Selecciona una opción: ")

        if opcion == "1":
            obtener_datos()

        elif opcion == "2":
            mostrar_menu_visualizacion()

        elif opcion == "3":
            print("👋 Saliendo...")
            sys.exit()

        else:
            print("❌ Opción no válida.")


if __name__ == "__main__":
    main_menu()
