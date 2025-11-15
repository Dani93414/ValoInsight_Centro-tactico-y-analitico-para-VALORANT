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

    content_collection.insert_one({
        "type": "valorant_content",
        "agents": agents,
        "maps": maps,
        "weapons": weapons,
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

    print("\n====== CONTENIDO ======")
    print(f"Agentes: {len(ultimo['agents'])}")
    print(f"Mapas: {len(ultimo['maps'])}")
    print(f"Armas: {len(ultimo['weapons'])}")
    print(f"Actos: {len(ultimo['acts'])}")
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

    agents = ultimo.get("agents", [])

    print(f"\n====== AGENTES ({len(agents)}) ======\n")
    for ag in agents:
        print(f"- {ag.get('name')} ({ag.get('id')})")
    print("\n===================\n")


def mostrar_mapas():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])

    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    maps = ultimo.get("maps", [])

    print(f"\n====== MAPAS ({len(maps)}) ======\n")
    for mp in maps:
        name = mp.get("name")
        asset = mp.get("assetName")
        print(f"- {name}  | asset: {asset}")
    print("\n===================\n")


def mostrar_armas():
    ultimo = content_collection.find_one({}, sort=[("_id", -1)])

    if not ultimo:
        print("⚠️ No hay contenido guardado.")
        return

    weapons = ultimo.get("weapons", [])

    print(f"\n====== ARMAS ({len(weapons)}) ======\n")
    for w in weapons:
        print(f"- {w.get('name')} ({w.get('id')})")
    print("\n===================\n")


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
