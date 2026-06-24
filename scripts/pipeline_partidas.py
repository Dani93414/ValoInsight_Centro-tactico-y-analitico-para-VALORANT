#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import subprocess
import sys
from pathlib import Path


def run_step(command: list[str], cwd: Path, step_name: str) -> None:
    print(f"\n[STEP] {step_name}")
    print("[CMD]", " ".join(command))
    result = subprocess.run(command, cwd=str(cwd))
    if result.returncode != 0:
        raise RuntimeError(f"Fallo en {step_name} (exit code={result.returncode})")


def collect_staging_files(staging_dir: Path) -> list[Path]:
    candidates: list[Path] = []
    for pattern in ("*_match_*.json", "*_match_ids_*.json"):
        candidates.extend(staging_dir.glob(pattern))

    unique: dict[str, Path] = {}
    for path in candidates:
        unique[str(path.resolve())] = path

    return sorted(unique.values(), key=lambda item: item.name.lower())


def cleanup_staging_files(staging_dir: Path, stage_label: str) -> int:
    files = collect_staging_files(staging_dir)
    if not files:
        print(f"[INFO] Limpieza {stage_label}: no hay JSON residuales en {staging_dir}")
        return 0

    deleted = 0
    for path in files:
        try:
            path.unlink()
            deleted += 1
        except Exception as exc:
            print(f"[WARN] No se pudo borrar {path.name}: {exc}")

    print(f"[INFO] Limpieza {stage_label}: borrados {deleted}/{len(files)} archivos residuales")
    return deleted


def ask_positive_int(prompt: str) -> int:
    while True:
        raw_value = input(prompt).strip()
        try:
            value = int(raw_value)
        except ValueError:
            print("[WARN] Introduce un numero entero mayor que 0.")
            continue

        if value > 0:
            return value

        print("[WARN] Introduce un numero mayor que 0.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Pipeline final de partidas en un solo comando: "
            "descarga (con check en DB), conversion, subida y verificacion opcional."
        )
    )
    parser.add_argument(
        "--players",
        nargs="+",
        help=(
            "Lista de jugadores en formato GameName#TagLine. "
            "Ejemplo: --players \"No Screams#GFS\" \"No Baiting#NNG\""
        ),
    )
    parser.add_argument(
        "--matches-per-player",
        type=int,
        default=30,
        help="Cantidad de partidas a solicitar por jugador (default: 30).",
    )
    parser.add_argument(
        "--ask-matches",
        action="store_true",
        help="Pregunta interactivamente cuantas partidas quieres por jugador.",
    )
    parser.add_argument(
        "--fill-requested",
        action="store_true",
        help=(
            "Modo recomendado para completar el numero pedido: consulta Mongo, "
            "descarta repetidas y sigue buscando en historico hasta llegar al objetivo "
            "o agotar la API."
        ),
    )
    parser.add_argument(
        "--tz",
        default="Europe/Madrid",
        help="Zona horaria usada en los nombres de salida (default: Europe/Madrid).",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Sobrescribe archivos ya existentes en data/BaseDatos_Partidas.",
    )
    parser.add_argument(
        "--skip-db-check",
        action="store_true",
        help="No consulta MongoDB antes de descargar (no recomendado).",
    )
    parser.add_argument(
        "--backfill-from-history",
        action="store_true",
        help=(
            "Si las ultimas --matches-per-player competitivas ya existen, "
            "sigue buscando partidas mas antiguas hasta completar nuevas o agotar historico."
        ),
    )
    parser.add_argument(
        "--max-history-scan",
        type=int,
        help="Maximo de entradas del historial a revisar por jugador.",
    )
    parser.add_argument(
        "--no-max-history-scan",
        action="store_true",
        help="Sin limite artificial de entradas historicas; pagina hasta agotar la API.",
    )
    parser.add_argument(
        "--skip-upload",
        action="store_true",
        help="No sube a Mongo tras convertir (solo descarga y formatea).",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Ejecuta verificacion de integridad al final (--expected-per-player requerido).",
    )
    parser.add_argument(
        "--expected-per-player",
        type=int,
        help="Conteo total esperado por jugador para verify_match_integrity.py.",
    )
    parser.add_argument(
        "--keep-staging-files",
        action="store_true",
        help="No borra JSON residuales en backend/ingestion.",
    )
    args = parser.parse_args()

    matches_per_player = (
        ask_positive_int("Cuantas partidas quieres por jugador? ")
        if args.ask_matches
        else args.matches_per_player
    )

    if matches_per_player <= 0:
        raise RuntimeError("--matches-per-player debe ser mayor que 0")

    if args.fill_requested and args.skip_db_check:
        raise RuntimeError("--fill-requested necesita consultar Mongo; no lo uses con --skip-db-check")

    if args.verify and (args.expected_per_player is None or args.expected_per_player <= 0):
        raise RuntimeError("Con --verify debes indicar --expected-per-player (>0)")

    if args.max_history_scan is not None and args.max_history_scan <= 0:
        raise RuntimeError("--max-history-scan debe ser mayor que 0")

    project_root = Path(__file__).resolve().parents[1]
    staging_dir = project_root / "backend" / "ingestion"
    scripts_dir = project_root / "scripts"

    if not staging_dir.exists():
        raise RuntimeError(f"No existe directorio de staging: {staging_dir}")

    python_exe = sys.executable

    if not args.keep_staging_files:
        cleanup_staging_files(staging_dir, "previa")

    download_cmd = [
        python_exe,
        str(scripts_dir / "descarga_formateo_partidas.py"),
        "--matches-per-player",
        str(matches_per_player),
        "--tz",
        args.tz,
    ]

    if args.players:
        download_cmd.extend(["--players", *args.players])

    if args.overwrite:
        download_cmd.append("--overwrite")

    if not args.skip_db_check:
        download_cmd.append("--check-db-before-download")

    if args.backfill_from_history or args.fill_requested:
        download_cmd.append("--backfill-from-history")

    if args.max_history_scan is not None:
        download_cmd.extend(["--max-history-scan", str(args.max_history_scan)])

    if args.no_max_history_scan:
        download_cmd.append("--no-max-history-scan")

    run_step(download_cmd, project_root, "Descarga y conversion")

    if not args.keep_staging_files:
        cleanup_staging_files(staging_dir, "posterior")

    if not args.skip_upload:
        upload_cmd = [
            python_exe,
            str(scripts_dir / "upload_matches_to_mongo.py"),
            "--input-dir",
            "data/BaseDatos_Partidas",
        ]
        if args.fill_requested:
            upload_cmd.append("--delete-duplicates")
        run_step(upload_cmd, project_root, "Subida a MongoDB")

    if args.verify:
        verify_cmd = [
            python_exe,
            str(scripts_dir / "verify_match_integrity.py"),
            "--expected-per-player",
            str(args.expected_per_player),
            "--strict",
        ]
        run_step(verify_cmd, project_root, "Verificacion de integridad")

    print("\n[DONE] Pipeline final completado.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[STOP] Interrumpido por usuario.")
        raise SystemExit(130)
    except Exception as exc:
        print(f"\n[ERROR] {exc}")
        raise SystemExit(1)
