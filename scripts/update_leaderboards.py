import argparse
import logging
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from backend.infrastructure.mongo_client import content_collection, leaderboards_collection
from scripts.fetch_data_incremental import sync_incremental_leaderboards


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def update_leaderboards_only(*, rebuild: bool = False) -> None:
    content_doc = content_collection.find_one(
        {"type": "valorant_content"},
        {"_id": 0, "acts": 1},
        sort=[("_id", -1)],
    )
    if not content_doc:
        raise RuntimeError("No existe valorant_content en MongoDB. Ejecuta primero la carga de content.")

    if rebuild:
        result = leaderboards_collection.delete_many({})
        logger.info("Coleccion leaderboards borrada. Documentos eliminados: %s", result.deleted_count)

    report = sync_incremental_leaderboards(content_doc.get("acts", []))
    logger.info("Leaderboards actualizados sin modificar content: %s", report)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Actualiza solo leaderboards de PC y consola sin tocar la colección content.",
    )
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Borra leaderboards y los reconstruye desde los acts ya guardados en content.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Confirma el borrado de leaderboards cuando se usa --rebuild.",
    )
    args = parser.parse_args()

    if args.rebuild and not args.force:
        parser.error("Debes indicar --force para reconstruir leaderboards con --rebuild.")

    update_leaderboards_only(rebuild=args.rebuild)


if __name__ == "__main__":
    main()
