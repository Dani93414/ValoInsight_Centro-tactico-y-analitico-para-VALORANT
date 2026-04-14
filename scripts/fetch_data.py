import os
import sys
import logging
import argparse
from pathlib import Path

# 1. PRIMERO configuramos el path para que Python encuentre backend y src
project_root = Path(__file__).resolve().parents[1]
backend_root = project_root / "backend"

for path in (str(project_root), str(backend_root)):
    if path not in sys.path:
        sys.path.append(path)

# 2. AHORA ya podemos importar desde backend
from backend.infrastructure.mongo_client import (
    db,
    content_collection,
    leaderboards_collection,
    regions_collection, 
    players_collection# Asegúrate de haberla añadido a mongo_client.py
)

from backend.infrastructure.riot_http_client import (
    get_puuid,
    get_valorant_content,
    get_leaderboard
)

from backend.infrastructure.valorant_api_http_client import (
    get_agents_es, get_maps_es, get_weapons_es, get_buddies_es,
    get_bundles_es, get_ceremonies_es, get_competitivetiers_es,
    get_contenttiers_es, get_contracts_es, get_currencies_es,
    get_events_es, get_flex_es, get_gamemodes_es, get_gear_es,
    get_levelborders_es, get_playercards_es, get_playertitles_es,
    get_sprays_es, get_themes_es, get_version_es
)
from backend.modules.analytics.application.service import rebuild_all_player_match_analytics

# ================================
# LOGGING
# ================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# ================================
# OBTENER DATOS
# ================================
def obtener_datos(*, force: bool = False):
    if not force:
        logger.error(
            "Este script borra content y leaderboards. "
            "Usa --force para confirmar."
        )
        sys.exit(1)

    logger.info("🗑️ Borrando datos anteriores...")

    content_collection.delete_many({})
    leaderboards_collection.delete_many({})

    logger.info("✔ Base de datos limpia.")

    # ---------------------------------------
    # 1. Obtener PUUID
    # ---------------------------------------
    game_name = os.getenv("RIOT_GAME_NAME")
    tag_line = os.getenv("RIOT_TAG_LINE")

    if not game_name or not tag_line:
        raise ValueError(
            "❌ RIOT_GAME_NAME o RIOT_TAG_LINE no están definidos en el entorno"
        )

    logger.info(f"🔎 Obteniendo datos de {game_name}#{tag_line}…")
    puuid = get_puuid(game_name, tag_line)
    logger.info(f"✅ PUUID obtenido: {puuid}")

    # ---------------------------------------
    # 2. Obtener contenido de Valorant
    # ---------------------------------------
    logger.info("📦 Obteniendo contenido de Valorant…")
    content = get_valorant_content()

    logger.info("🧍 Obteniendo agentes...")
    agents = get_agents_es()

    logger.info("🗺️ Obteniendo mapas...")
    maps_data = get_maps_es()

    logger.info("🔫 Obteniendo armas...")
    weapons_vapi = get_weapons_es()

    logger.info("🎒 Obteniendo buddies...")
    buddies = get_buddies_es()

    logger.info("🎁 Obteniendo bundles...")
    bundles = get_bundles_es()

    logger.info("🎉 Obteniendo ceremonias...")
    ceremonies = get_ceremonies_es()

    logger.info("🏆 Obteniendo competitive tiers...")
    competitive_tiers = get_competitivetiers_es()

    logger.info("⬆️ Obteniendo content tiers...")
    content_tiers = get_contenttiers_es()

    logger.info("📜 Obteniendo contratos...")
    contracts = get_contracts_es()

    logger.info("💰 Obteniendo monedas...")
    currencies = get_currencies_es()

    logger.info("🎟️ Obteniendo eventos...")
    events = get_events_es()

    logger.info("🌀 Obteniendo flex...")
    flex = get_flex_es()

    logger.info("🎮 Obteniendo modos de juego...")
    gamemodes = get_gamemodes_es()

    logger.info("⚙️ Obteniendo gear...")
    gear = get_gear_es()

    logger.info("🎖️ Obteniendo bordes de nivel...")
    levelborders = get_levelborders_es()

    logger.info("🖼️ Obteniendo player cards...")
    playercards = get_playercards_es()

    logger.info("🏅 Obteniendo player titles...")
    playertitles = get_playertitles_es()

    logger.info("🌈 Obteniendo sprays...")
    sprays = get_sprays_es()

    logger.info("🎨 Obteniendo themes...")
    themes = get_themes_es()

    logger.info("🔍 Obteniendo versión del juego...")
    version = get_version_es()

    acts = content.get("acts", [])

    # ---------------------------------------
    # Filtrar agentes jugables
    # ---------------------------------------
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

    logger.info("💾 Contenido guardado en MongoDB.")

    # Si matches se cargaron antes que content, este rebuild corrige campos "Unknown"
    # en matches.players[].analytics (map_name, agent_name, weapon_name, role, etc.).
    logger.info("♻ Recalculando analytics embebidas para refrescar nombres de referencia...")
    rebuild_result = rebuild_all_player_match_analytics(batch_size=200)
    logger.info(
        "✔ Analytics rebuild completado | processed_matches=%s embedded_players=%s failed_matches=%s",
        rebuild_result.get("processed_matches", 0),
        rebuild_result.get("embedded_players", 0),
        rebuild_result.get("failed_matches", 0),
    )

    # ---------------------------------------
    # 3. Leaderboards (Todas las Regiones)
    # ---------------------------------------
    logger.info("🏆 Guardando leaderboards de todos los actos y regiones…")

    real_acts = [a for a in acts if a.get("type") == "act"]
    logger.info(f"📌 Total de actos reales: {len(real_acts)}")

    # Definimos los servidores oficiales de Riot
    REGIONES = ["AP", "EU", "LATAM", "NA", "BR", "KR"]

    for act in real_acts:
        act_id = act["id"]
        act_name = act["name"]
        is_active = act.get("isActive", False)

        for region in REGIONES:
            logger.info(f"🏅 Acto: {act_name} | Región: {region}")

            try:
                # IMPORTANTE: get_leaderboard debe aceptar la region ahora
                leaderboard = get_leaderboard(act_id, region)

                if leaderboard and "players" in leaderboard:
                    leaderboards_collection.insert_one({
                        "type": "leaderboard",
                        "region": region, # Guardamos la región
                        "act_id": act_id,
                        "act_name": act_name,
                        "isActive": is_active,
                        "data": leaderboard
                    })
                    logger.info(f"✔ Guardado — Jugadores: {len(leaderboard.get('players', []))}")
                else:
                    logger.info(f"➖ Sin datos para {act_name} en {region}")

            except Exception as e:
                logger.warning(f"⚠️ Error obteniendo leaderboard ({act_name} - {region}): {e}")


# ================================
# ENTRY POINT
# ================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Descarga contenido y leaderboards de Valorant (borra datos previos).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Confirma el borrado de content y leaderboards antes de recargar.",
    )
    args = parser.parse_args()
    obtener_datos(force=args.force)
