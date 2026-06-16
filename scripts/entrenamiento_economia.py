from __future__ import annotations

import argparse
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"

for path in (PROJECT_ROOT, BACKEND_ROOT):
    value = str(path)
    if value not in sys.path:
        sys.path.insert(0, value)

from modules.economy_ml.dataset_builder import (  # noqa: E402
    build_economy_dataset_from_matches,
    save_dataset,
    validate_dataset,
)
from modules.economy_ml.model_registry import status  # noqa: E402
from modules.economy_ml.train import train_models  # noqa: E402
from modules.matches.infrastructure import mongo_match_repo  # noqa: E402


def _print_validation(validation: dict) -> None:
    print("Validacion del dataset:")
    print(f"  valido: {validation.get('valid')}")
    print(f"  filas: {validation.get('rows')}")
    print(f"  partidas: {validation.get('matches')}")
    print(f"  cobertura timestamps: {validation.get('timestamp_coverage')}")
    print(f"  unknown_action_rate: {validation.get('unknown_action_rate')}")
    missing = validation.get("missing_model_columns") or []
    forbidden = validation.get("forbidden_model_features") or []
    if missing:
        print(f"  columnas faltantes: {missing}")
    if forbidden:
        print(f"  features prohibidas: {forbidden}")


def _print_training_summary(metadata: dict) -> None:
    models = metadata.get("models") or {}
    print("Entrenamiento completado:")
    print(f"  filas entrenadas: {metadata.get('dataset_rows')}")
    print(f"  modelo global: {bool(models.get('global'))}")
    print(f"  modelos por grupo de rango: {len(models.get('rank_groups') or {})}")
    print(f"  modelos por rango exacto: {len(models.get('rank_names') or {})}")


def _print_status() -> None:
    current = status()
    print("Estado publicado:")
    print(f"  available: {current.get('available')}")
    print(f"  artefactos: {len(current.get('artifacts') or [])}")
    metadata = current.get("metadata") or {}
    if metadata:
        models = metadata.get("models") or {}
        print(f"  dataset_rows: {metadata.get('dataset_rows')}")
        print(f"  rank_groups: {len(models.get('rank_groups') or {})}")
        print(f"  rank_names: {len(models.get('rank_names') or {})}")
    elif current.get("reason"):
        print(f"  motivo: {current.get('reason')}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Entrena el modelo de economia desde las partidas ranked guardadas "
            "en MongoDB."
        )
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10000,
        help="Maximo de partidas ranked con economia a leer desde MongoDB.",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Solo construye y valida el dataset; no guarda ni entrena.",
    )
    parser.add_argument(
        "--allow-invalid",
        action="store_true",
        help="Permite intentar entrenar aunque validate_dataset marque invalid.",
    )
    args = parser.parse_args()

    print("Leyendo partidas desde MongoDB...")
    matches = mongo_match_repo.list_training_matches(args.limit)
    print(f"Partidas encontradas: {len(matches)}")
    if not matches:
        print("No hay partidas ranked con economia para entrenar.")
        return 1

    print("Construyendo dataset de economia...")
    dataset = build_economy_dataset_from_matches(matches)
    validation = validate_dataset(dataset)
    _print_validation(validation)

    if not validation.get("valid") and not args.allow_invalid:
        print("Dataset invalido. No se entrena el modelo.")
        return 1

    if args.validate_only:
        print("Validacion finalizada. No se ha entrenado por --validate-only.")
        return 0

    print("Guardando dataset parquet...")
    save_dataset(dataset)

    print("Entrenando modelos y publicando artefactos...")
    try:
        metadata = train_models(dataset)
    except ValueError as exc:
        print(f"No se pudo entrenar el modelo: {exc}")
        print("Los modelos anteriores se conservan si existian.")
        return 1

    _print_training_summary(metadata)
    _print_status()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
