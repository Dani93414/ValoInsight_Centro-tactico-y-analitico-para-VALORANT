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

import os
import sys

AGENT_ROLES = {
    "Gekko": "Iniciador",
    "Fade": "Iniciador",
    "Breach": "Iniciador",
    "Deadlock": "Centinela",
    "Tejo": "Iniciador",
    "Raze": "Duelista",
    "Chamber": "Centinela",
    "KAY/O": "Iniciador",
    "Skye": "Iniciador",
    "Cypher": "Centinela",
    "Sova": "Iniciador",
    "Killjoy": "Centinela",
    "Harbor": "Controlador",
    "Vyse": "Centinela",
    "Viper": "Controlador",
    "Phoenix": "Duelista",
    "Veto": "Centinela",
    "Astra": "Controlador",
    "Brimstone": "Controlador",
    "Iso": "Duelista",
    "Clove": "Controlador",
    "Neon": "Duelista",
    "Yoru": "Duelista",
    "Waylay": "Duelista",
    "Sage": "Centinela",
    "Reyna": "Duelista",
    "Omen": "Controlador",
    "Jett": "Duelista",
}

armas_tienda = {
    "Cuerpo a cuerpo",
    "Classic",
    "Odin",
    "Ares",
    "Vandal",
    "Bulldog",
    "Phantom",
    "Judge",
    "Bucky",
    "Frenzy",
    "Ghost",
    "Sheriff",
    "Shorty",
    "Operator",
    "Guardian",
    "Outlaw",
    "Marshal",
    "Spectre",
    "Stinger",
}

escudos = {
    "Arm. ligera",
    "Arm. pesada",
    "Escudo regen."
}

habilidades_armas = {
    "KAY/O núcleo",
    "Sobrecarga",
    "Flecha explosiva",
    "Cierratelones",
    "Fardo explosivo",
    "Bot explosivo",
    "Balas de pintura",
    "Lanzabolas de nieve",
    "Cazador de cabezas",
    "Tour de force",
    "CUCHILLO GRANDE",
    "Arma dorada"
}

spike = {"SPIKE"}

# --- SUBCATEGORÍAS SOLO PARA ARMAS DE TIENDA ---
armas_mano = {"Classic", "Shorty", "Frenzy", "Ghost", "Sheriff"}
subfusiles = {"Spectre", "Stinger"}
rifles = {"Vandal", "Phantom", "Bulldog", "Guardian"}
ametralladoras = {"Ares", "Odin"}
escopetas = {"Judge", "Bucky"}
francotiradores = {"Operator", "Marshal", "Outlaw"}
cuerpo_a_cuerpo = {"Cuerpo a cuerpo"}

# --- PRECIOS DE LAS ARMAS
WEAPON_PRICES = {
    "Cuerpo a cuerpo": 0,
    "Classic": 0,
    "Shorty": 300,
    "Frenzy": 450,
    "Ghost": 500,
    "Sheriff": 800,
    "Stinger": 950,
    "Bucky": 850,
    "Judge": 1850,
    "Spectre": 1600,
    "Bulldog": 2050,
    "Guardian": 2250,
    "Phantom": 2900,
    "Vandal": 2900,
    "Marshal": 950,
    "Outlaw": 2400,
    "Operator": 4700,
    "Ares": 1600,
    "Odin": 3200,
}

SHIELD_PRICES = {
    "Arm. ligera": 400,
    "Arm. pesada": 1000,
    "Escudo regen.": 600
}


# ================================
#  OPCIÓN 1 → Obtener datos
# ================================
def obtener_datos():
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

    agents = content.get("characters", [])
    maps = content.get("maps", [])
    weapons = content.get("equips", [])
    acts = content.get("acts", [])

    print(f"✔ Agentes: {len(agents)}")
    print(f"✔ Mapas: {len(maps)}")
    print(f"✔ Armas: {len(weapons)}")
    print(f"✔ Actos: {len(acts)}")

    # ==========================================
    # CLASIFICACIÓN MANUAL DE AGENTES
    # ==========================================

    duelistas = []
    controladores = []
    iniciadores = []
    centinelas = []

    for ag in agents:
        name = ag.get("name")
        role = AGENT_ROLES.get(name, "Desconocido")  # asignación manual

        ag["role"] = role  # añadimos el rol directamente

        if role == "Duelista":
            duelistas.append(ag)
        elif role == "Controlador":
            controladores.append(ag)
        elif role == "Iniciador":
            iniciadores.append(ag)
        elif role == "Centinela":
            centinelas.append(ag)

    agents_data = {
        "duelistas": duelistas,
        "controladores": controladores,
        "iniciadores": iniciadores,
        "centinelas": centinelas,
    }

    # ==========================================
    # CLASIFICACIÓN COMPLETA DE ARMAS
    # ==========================================

    tienda = []
    shields = []
    habilidades = []
    spikes = []
    otros = []

    # subclasificación solo para armas de tienda
    tienda_clasificacion = {
        "armas_mano": [],
        "subfusiles": [],
        "rifles": [],
        "ametralladoras": [],
        "escopetas": [],
        "francotiradores": [],
        "cuerpo_a_cuerpo": [],
    }

    def asignar_precio(weapon):
        nombre = weapon.get("name", "")
        if nombre in WEAPON_PRICES:
            weapon["price"] = WEAPON_PRICES[nombre]
        elif nombre in SHIELD_PRICES:
            weapon["price"] = SHIELD_PRICES[nombre]
        else:
            weapon["price"] = None  # o 0 si prefieres
        return weapon

    for w in weapons:
        w = asignar_precio(w)
        nombre = w.get("name", "")

        # -- Armas de tienda
        if nombre in armas_tienda:
            tienda.append(w)

            if nombre in armas_mano:
                tienda_clasificacion["armas_mano"].append(w)
            elif nombre in subfusiles:
                tienda_clasificacion["subfusiles"].append(w)
            elif nombre in rifles:
                tienda_clasificacion["rifles"].append(w)
            elif nombre in ametralladoras:
                tienda_clasificacion["ametralladoras"].append(w)
            elif nombre in escopetas:
                tienda_clasificacion["escopetas"].append(w)
            elif nombre in francotiradores:
                tienda_clasificacion["francotiradores"].append(w)
            elif nombre in cuerpo_a_cuerpo:
                tienda_clasificacion["cuerpo_a_cuerpo"].append(w)

        # -- Escudos
        elif nombre in escudos:
            shields.append(w)

        # -- Habilidades / armas especiales
        elif nombre in habilidades_armas:
            habilidades.append(w)

        # -- Spike
        elif nombre in spike:
            spikes.append(w)

        # -- Otros
        else:
            otros.append(w)

    # Objeto final que SÍ se guardará en MongoDB
    weapons_data = {
        "tienda": {
            "todas": tienda,
            "armas_mano": tienda_clasificacion["armas_mano"],
            "subfusiles": tienda_clasificacion["subfusiles"],
            "rifles": tienda_clasificacion["rifles"],
            "ametralladoras": tienda_clasificacion["ametralladoras"],
            "escopetas": tienda_clasificacion["escopetas"],
            "francotiradores": tienda_clasificacion["francotiradores"],
            "cuerpo_a_cuerpo": tienda_clasificacion["cuerpo_a_cuerpo"],
        },
        "escudos": shields,
        "habilidades": habilidades,
        "spike": spikes,
        "otros": otros
    }

    # ==========================================
    # CLASIFICACIÓN AUTOMÁTICA DE MAPAS
    # ==========================================

    core_maps = []
    skirmish_maps = []
    tdm_maps = []
    training_maps = []

    for mp in maps:
        name = mp.get("name")
        asset = mp.get("assetName")

        # ❌ Saltar el mapa "Null UI Data!"
        if name == "Null UI Data!":
            continue

        if asset.startswith("Skirmish"):
            skirmish_maps.append(mp)

        elif asset.startswith("HURM"):
            tdm_maps.append(mp)

        elif asset in ["Range", "RangeV2", "NPEV2"]:
            training_maps.append(mp)

        else:
            core_maps.append(mp)

    maps_data = {
        "core": core_maps,
        "skirmish": skirmish_maps,
        "tdm": tdm_maps,
        "training": training_maps
    }

    content_collection.insert_one({
        "type": "valorant_content",
        "agents": agents_data,
        "maps": maps_data,
        "weapons": weapons_data,
        "acts": acts,
        "raw": content
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
        print("7. Volver al menú principal")

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
            return

        else:
            print("❌ Opción no válida.")


def mostrar_contenido():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])

    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    agents_data = ultimo["agents"]
    weapons_data = ultimo["weapons"]
    maps = ultimo["maps"]
    acts = ultimo["acts"]

    # Contar agentes correctamente (sumar todas las listas)
    total_agentes = (
        len(agents_data.get("duelistas", [])) +
        len(agents_data.get("controladores", [])) +
        len(agents_data.get("iniciadores", [])) +
        len(agents_data.get("centinelas", []))
    )

    # Contar armas correctamente
    #  Todas = armas de tienda + escudos + habilidades + spike + otros
    tienda = weapons_data.get("tienda", {})
    armas_tienda = tienda.get("todas", [])

    total_armas = (
        len(armas_tienda) +
        len(weapons_data.get("escudos", [])) +
        len(weapons_data.get("habilidades", [])) +
        len(weapons_data.get("spike", [])) +
        len(weapons_data.get("otros", []))
    )

    print("\n====== CONTENIDO ======")
    print(f"Agentes: {total_agentes}")
    print(f"Mapas: {len(maps)}")
    print(f"Armas: {total_armas}")
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
def mostrar_agentes():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])

    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    agents_data = ultimo.get("agents", {})

    duelistas = agents_data.get("duelistas", [])
    controladores = agents_data.get("controladores", [])
    iniciadores = agents_data.get("iniciadores", [])
    centinelas = agents_data.get("centinelas", [])

    print("\n====== AGENTES CLASIFICADOS ======\n")

    print("🔥 DUELISTAS:")
    for ag in duelistas:
        print(f"- {ag.get('name')}")
    print()

    print("🌫 CONTROLADORES:")
    for ag in controladores:
        print(f"- {ag.get('name')}")
    print()

    print("⚡ INICIADORES:")
    for ag in iniciadores:
        print(f"- {ag.get('name')}")
    print()

    print("🛡 CENTINELAS:")
    for ag in centinelas:
        print(f"- {ag.get('name')}")
    print()

    print("==================================\n")


def mostrar_mapas():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])

    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    maps = ultimo.get("maps", {})

    core_maps = maps.get("core", [])
    skirmish_maps = maps.get("skirmish", [])
    tdm_maps = maps.get("tdm", [])
    training_maps = maps.get("training", [])

    print("\n====== MAPAS (CLASIFICADOS) ======\n")

    print("🌍 MODOS NORMALES / COMPETITIVO:")
    for m in core_maps:
        print(f"- {m['name']}")
    print()

    print("⚔️ ESCARAMUZA:")
    for m in skirmish_maps:
        print(f"- {m['name']}")
    print()

    print("🔫 COMBATE A MUERTE POR EQUIPOS (TDM):")
    for m in tdm_maps:
        print(f"- {m['name']}")
    print()

    print("🎯 ENTRENAMIENTO / CAMPO DE TIRO:")
    for m in training_maps:
        print(f"- {m['name']}")
    print()

    print("===================================\n")

    # ===============================
    # IMPRESIÓN DE RESULTADOS
    # ===============================
    print("\n====== MAPAS (CLASIFICADOS) ======\n")

    print("🌍 MODOS NORMALES / COMPETITIVO:")
    for m in core_maps:
        print(f"- {m['name']}")
    print()

    print("⚔️ ESCARAMUZA:")
    for m in skirmish_maps:
        print(f"- {m['name']}")
    print()

    print("🔫 COMBATE A MUERTE POR EQUIPOS (TDM):")
    for m in tdm_maps:
        print(f"- {m['name']}")
    print()

    print("🎯 ENTRENAMIENTO / CAMPO DE TIRO:")
    for m in training_maps:
        print(f"- {m['name']}")
    print()

    print("===================================\n")


def mostrar_armas():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])

    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    weapons = ultimo.get("weapons", {})

    tienda = weapons.get("tienda", {})
    escudos = weapons.get("escudos", [])
    habilidades = weapons.get("habilidades", [])
    spike = weapons.get("spike", [])
    otros = weapons.get("otros", [])

    print("\n====== ARMAS CLASIFICADAS ======\n")

    # ------------------------------
    # TIENDA — con subcategorías
    # ------------------------------
    print("🟦 ARMAS DE TIENDA:")

    if "todas" in tienda:
        print("\n  → TODAS:")
        for w in tienda["todas"]:
            price = w.get("price", None)
            if price is not None:
                print(f"   - {w['name']} ({w['id']}) — Precio: {price}")
            else:
                print(f"   - {w['name']} ({w['id']})")

    categorias = [
        "armas_mano",
        "subfusiles",
        "rifles",
        "ametralladoras",
        "escopetas",
        "francotiradores",
        "cuerpo_a_cuerpo",
    ]

    for cat in categorias:
        lista = tienda.get(cat, [])
        print(f"\n  → {cat.replace('_',' ').title()}:")
        for w in lista:
            price = w.get("price", None)
            if price is not None:
                print(f"   - {w['name']} ({w['id']}) — Precio: {price}")
            else:
                print(f"   - {w['name']} ({w['id']})")

    # ------------------------------
    # ESCUDOS
    # ------------------------------
    print("\n🟩 ESCUDOS:")
    for w in escudos:
        price = w.get("price", None)
        if price is not None:
            print(f"- {w['name']} ({w['id']}) — Precio: {price}")
        else:
            print(f"- {w['name']} ({w['id']})")

    # ------------------------------
    # HABILIDADES / OBJETOS
    # ------------------------------
    print("\n🟪 HABILIDADES / OBJETOS:")
    for w in habilidades:
        print(f"- {w['name']} ({w['id']})")

    # ------------------------------
    # SPIKE
    # ------------------------------
    print("\n💣 SPIKE:")
    for w in spike:
        print(f"- {w['name']} ({w['id']})")

    # ------------------------------
    # OTROS
    # ------------------------------
    print("\n⬜ OTROS:")
    for w in otros:
        print(f"- {w['name']} ({w['id']})")

    print("\n================================\n")

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
