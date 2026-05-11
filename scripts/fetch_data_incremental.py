import json
import logging
import os
import sys
from collections import Counter
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Tuple

# 1. PRIMERO configuramos el path para que Python encuentre el paquete backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# 2. AHORA ya podemos importar desde backend
from backend.infrastructure.mongo_client import content_collection
from backend.infrastructure.riot_http_client import get_puuid, get_valorant_content
from backend.infrastructure.valorant_api_http_client import (
    get_agents_es,
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
    get_maps_es,
    get_playercards_es,
    get_playertitles_es,
    get_sprays_es,
    get_themes_es,
    get_version_es,
    get_weapons_es,
)

# ================================
# LOGGING
# ================================
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

IDENTITY_KEYS = (
    "uuid",
    "id",
    "_id",
    "levelUuid",
    "relationUuid",
    "themeUuid",
    "assetObjectName",
)
CHANGE_REPORT_PATH = Path(__file__).resolve().parent / "last_incremental_content_changes.json"


def stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str)


def get_item_identity(item: Any) -> str | None:
    if not isinstance(item, dict):
        return None

    for key in IDENTITY_KEYS:
        val = item.get(key)
        if val not in (None, ""):
            return f"{key}:{val}"

    return None


def get_item_identity_value(item: Any) -> str | None:
    """Return only the raw identity value for reporting/filtering."""
    identity = get_item_identity(item)
    if not identity:
        return None
    _, _, value = identity.partition(":")
    return value or None


def merge_incremental_list(existing: List[Any], incoming: List[Any]) -> Tuple[List[Any], Dict[str, int]]:
    """
    Actualiza o añade elementos de incoming sobre existing.
    Nunca elimina elementos que ya existan en existing.
    """
    report = {
        "added": 0,
        "updated": 0,
        "unchanged": 0,
        "kept_existing": 0,
    }

    existing = existing or []
    incoming = incoming or []

    existing_by_identity: Dict[str, Any] = {}
    existing_no_identity: List[Any] = []

    for item in existing:
        identity = get_item_identity(item)
        if identity:
            existing_by_identity[identity] = item
        else:
            existing_no_identity.append(item)

    remaining_no_identity = Counter(stable_json(item) for item in existing_no_identity)

    merged: List[Any] = []
    seen_identity: set[str] = set()

    for item in incoming:
        identity = get_item_identity(item)

        if identity and identity in existing_by_identity:
            seen_identity.add(identity)
            old_item = existing_by_identity[identity]

            if stable_json(old_item) == stable_json(item):
                report["unchanged"] += 1
                merged.append(old_item)
            else:
                report["updated"] += 1
                merged.append(item)

            continue

        if identity:
            seen_identity.add(identity)
            report["added"] += 1
            merged.append(item)
            continue

        signature = stable_json(item)
        if remaining_no_identity.get(signature, 0) > 0:
            remaining_no_identity[signature] -= 1
            report["unchanged"] += 1
            merged.append(item)
        else:
            report["added"] += 1
            merged.append(item)

    # Conservamos lo que no vino en incoming: no se borra nada.
    for identity, item in existing_by_identity.items():
        if identity not in seen_identity:
            report["kept_existing"] += 1
            merged.append(item)

    if existing_no_identity:
        original_no_identity_counter = Counter(stable_json(item) for item in existing_no_identity)
        consumed_counter = Counter(stable_json(item) for item in merged if get_item_identity(item) is None)

        for signature, total_existing in original_no_identity_counter.items():
            remaining = total_existing - consumed_counter.get(signature, 0)
            if remaining > 0:
                report["kept_existing"] += remaining
                value = next(item for item in existing_no_identity if stable_json(item) == signature)
                merged.extend([value] * remaining)

    return merged, report


def build_new_content_document() -> Dict[str, Any]:
    game_name = os.getenv("RIOT_GAME_NAME")
    tag_line = os.getenv("RIOT_TAG_LINE")

    if not game_name or not tag_line:
        raise ValueError("❌ RIOT_GAME_NAME o RIOT_TAG_LINE no están definidos en el entorno")

    logger.info(f"🔎 Obteniendo datos de {game_name}#{tag_line}…")
    puuid = get_puuid(game_name, tag_line)
    logger.info(f"✅ PUUID obtenido: {puuid}")

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
    agents_data = [ag for ag in agents if ag.get("isPlayableCharacter")]

    return {
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
        "version": version,
    }


def sync_incremental_content() -> None:
    new_doc = build_new_content_document()
    existing_doc = content_collection.find_one({"type": "valorant_content"})

    if not existing_doc:
        content_collection.insert_one(new_doc)
        logger.info("💾 No existía content. Insertado documento nuevo.")
        return

    set_fields: Dict[str, Any] = {}
    summary: Dict[str, Dict[str, int]] = {}
    changed_items: Dict[str, Dict[str, List[str]]] = {}

    for field, incoming_value in new_doc.items():
        if field == "type":
            continue

        existing_value = existing_doc.get(field)

        if isinstance(incoming_value, list):
            merged_list, report = merge_incremental_list(existing_value or [], incoming_value)
            summary[field] = report

            existing_by_identity = {
                get_item_identity(item): item
                for item in (existing_value or [])
                if get_item_identity(item)
            }
            incoming_by_identity = {
                get_item_identity(item): item
                for item in (incoming_value or [])
                if get_item_identity(item)
            }
            added_ids: List[str] = []
            updated_ids: List[str] = []
            for identity, incoming_item in incoming_by_identity.items():
                existing_item = existing_by_identity.get(identity)
                identity_value = get_item_identity_value(incoming_item)
                if not identity_value:
                    continue
                if existing_item is None:
                    added_ids.append(identity_value)
                elif stable_json(existing_item) != stable_json(incoming_item):
                    updated_ids.append(identity_value)

            if added_ids or updated_ids:
                changed_items[field] = {
                    "added": sorted(set(added_ids)),
                    "updated": sorted(set(updated_ids)),
                }

            if stable_json(existing_value or []) != stable_json(merged_list):
                set_fields[field] = merged_list
            continue

        if stable_json(existing_value) != stable_json(incoming_value):
            set_fields[field] = deepcopy(incoming_value)

    if set_fields:
        content_collection.update_one(
            {"_id": existing_doc["_id"]},
            {"$set": set_fields},
        )
        logger.info(f"✅ Content actualizado incrementalmente. Campos modificados: {len(set_fields)}")
    else:
        logger.info("✅ Content ya estaba sincronizado. No hubo cambios.")

    for field, report in summary.items():
        if report["added"] or report["updated"]:
            logger.info(
                f"[{field}] +{report['added']} nuevos, {report['updated']} actualizados, "
                f"{report['unchanged']} sin cambios, {report['kept_existing']} conservados"
            )

    report_payload = {
        "changed_fields": sorted(changed_items.keys()),
        "changed_items": changed_items,
    }
    CHANGE_REPORT_PATH.write_text(
        json.dumps(report_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    logger.info(f"📝 Reporte de cambios incremental guardado en: {CHANGE_REPORT_PATH}")


def main() -> None:
    sync_incremental_content()


if __name__ == "__main__":
    main()
