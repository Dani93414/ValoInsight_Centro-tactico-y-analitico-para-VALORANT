#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# ZoneInfo puede fallar en Windows si no tienes tzdata instalado.
try:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError  # Python 3.9+
except ImportError:
    ZoneInfo = None
    ZoneInfoNotFoundError = Exception

project_root = Path(__file__).resolve().parents[1]
backend_root = project_root / "backend"
for path in (str(project_root), str(backend_root)):
    if path not in sys.path:
        sys.path.append(path)

from backend.ingestion.format_matches import build_output, load_template

DEFAULT_CONVERT_WORKERS = int(os.getenv("MATCH_CONVERT_WORKERS", "4"))
DEFAULT_DOWNLOAD_WORKERS = int(os.getenv("HENRIK_DOWNLOAD_WORKERS", "4"))
DEFAULT_REQUESTS_PER_MINUTE = int(os.getenv("HENRIK_REQUESTS_PER_MINUTE", "30"))
DEFAULT_RATE_LIMIT_SAFETY_FACTOR = float(os.getenv("HENRIK_RATE_LIMIT_SAFETY_FACTOR", "1.10"))


def progress_label(done: int, total: int) -> str:
    pct = (done / total * 100.0) if total else 100.0
    return f"[{pct:5.1f}%] [{done}/{total}]"


def run_step(command: list[str], cwd: Path, step_name: str) -> None:
    print(f"\n[STEP] {step_name}")
    print("[CMD]", " ".join(command))
    result = subprocess.run(command, cwd=str(cwd))
    if result.returncode != 0:
        raise RuntimeError(f"Fallo en {step_name} (exit code={result.returncode})")


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def extract_match_metadata(payload: dict) -> tuple[str, str] | None:
    md = ((payload.get("data") or {}).get("metadata") or {})
    match_id = md.get("match_id") or md.get("matchid")
    started_at = md.get("started_at")
    if not match_id or not started_at:
        return None
    return str(match_id), str(started_at)


def parse_started_at(value: str) -> datetime:
    if isinstance(value, str) and value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def prefix_hora_dia_mes_anyo(dt_utc: datetime, tz_name: str) -> str:
    dt_local = dt_utc

    if ZoneInfo is not None:
        try:
            dt_local = dt_utc.astimezone(ZoneInfo(tz_name))
        except ZoneInfoNotFoundError:
            try:
                local_tz = datetime.now().astimezone().tzinfo
                if local_tz is not None:
                    dt_local = dt_utc.astimezone(local_tz)
            except Exception:
                dt_local = dt_utc

    return dt_local.strftime("%H-%M_%d-%m-%Y")


def build_output_name(started_at: str, match_id: str, tz_name: str) -> str:
    dt_utc = parse_started_at(started_at)
    prefix = prefix_hora_dia_mes_anyo(dt_utc, tz_name)
    return f"{prefix}_{match_id}_formato.json"


def convert_one_match_file(
    src: Path,
    match_id: str,
    started_at: str,
    template: dict,
    output_dir: Path,
    tz_name: str,
    overwrite: bool,
) -> tuple[str, str, str | None]:
    """
    Devuelve: (match_id, status, error)
    status: converted | skipped_existing | failed
    """
    try:
        out_name = build_output_name(started_at, match_id, tz_name)
        out_path = output_dir / out_name

        if out_path.exists() and not overwrite:
            delete_raw_file(src, reason=f"ya existe {match_id} en destino")
            return match_id, "skipped_existing", None

        payload = load_json(src)
        out = build_output(template, payload)

        tmp_path = out_path.with_suffix(".json.tmp")
        tmp_path.write_text(
            json.dumps(out, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        tmp_path.replace(out_path)

        delete_raw_file(src, reason=f"convertido {match_id}")

        return match_id, "converted", None

    except Exception as exc:
        return match_id, "failed", str(exc)


def collect_match_files(root: Path, recursive: bool) -> list[tuple[Path, str, str]]:
    files = root.rglob("*.json") if recursive else root.glob("*.json")
    selected = []

    for path in sorted(files):
        name = path.name.lower()
        if "_match_ids_" in name:
            continue
        if "_formato" in path.stem:
            continue

        try:
            payload = load_json(path)
        except Exception:
            print(f"[SKIP] JSON no valido: {path.name}")
            continue

        metadata = extract_match_metadata(payload)
        if not metadata:
            print(f"[SKIP] Sin metadata de partida: {path.name}")
            continue

        match_id, started_at = metadata
        selected.append((path, match_id, started_at))

    return selected


def delete_raw_file(path: Path, reason: str) -> bool:
    try:
        path.unlink()
        print(f"[DEL] RAW eliminado ({reason}): {path.name}")
        return True
    except Exception as exc:
        print(f"[WARN] No se pudo borrar RAW {path.name}: {exc}")
        return False


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
            "Ejecuta el pipeline completo: descargar_matches.py, rename_matches.py "
            "y conversion por lote con change_to_good_format.py"
        )
    )
    parser.add_argument("--tz", default="Europe/Madrid", help="Zona horaria para rename_matches.py")
    parser.add_argument("--recursive", action="store_true", help="Busca JSON recursivamente")
    parser.add_argument(
        "--players",
        nargs="+",
        help=(
            "Lista de jugadores en formato GameName#TagLine para descargar_matches.py. "
            "Ejemplo: --players \"No Screams#GFS\" \"No Baiting#NNG\""
        ),
    )
    parser.add_argument(
        "--matches-per-player",
        type=int,
        help="Cantidad de partidas por jugador para descargar_matches.py.",
    )
    parser.add_argument(
        "--ask-matches",
        action="store_true",
        help="Pregunta interactivamente cuantas partidas quieres por jugador.",
    )
    parser.add_argument(
        "--check-db-before-download",
        action="store_true",
        help=(
            "Consulta MongoDB antes de descargar detalles para evitar bajar "
            "partidas ya presentes en la coleccion matches."
        ),
    )
    parser.add_argument(
        "--backfill-from-history",
        action="store_true",
        help=(
            "Si las ultimas --matches-per-player competitivas ya tienen repetidas, "
            "sigue buscando partidas mas antiguas hasta completar nuevas o agotar historico."
        ),
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
        "--overwrite",
        action="store_true",
        help="Sobrescribe salidas ya existentes en data/BaseDatos_Partidas/",
    )
    parser.add_argument(
        "--convert-workers",
        type=int,
        default=DEFAULT_CONVERT_WORKERS,
        help="Numero de workers para convertir partidas en paralelo.",
    )
    parser.add_argument("--download-workers", type=int, default=DEFAULT_DOWNLOAD_WORKERS)
    parser.add_argument("--requests-per-minute", type=int, default=DEFAULT_REQUESTS_PER_MINUTE)
    parser.add_argument("--rate-limit-safety-factor", type=float, default=DEFAULT_RATE_LIMIT_SAFETY_FACTOR)
    args = parser.parse_args()

    matches_per_player = args.matches_per_player
    if args.ask_matches:
        matches_per_player = ask_positive_int("Cuantas partidas quieres por jugador? ")

    root_dir = project_root / "backend" / "ingestion"
    output_dir = project_root / "data" / "BaseDatos_Partidas"
    output_dir.mkdir(parents=True, exist_ok=True)

    if not root_dir.exists() or not root_dir.is_dir():
        raise RuntimeError(f"No existe el directorio de scripts de partidas: {root_dir}")
    if args.convert_workers <= 0:
        raise RuntimeError("--convert-workers debe ser mayor que 0")
    if args.download_workers <= 0:
        raise RuntimeError("--download-workers debe ser mayor que 0")
    if args.requests_per_minute <= 0:
        raise RuntimeError("--requests-per-minute debe ser mayor que 0")
    if args.rate_limit_safety_factor < 1.0:
        raise RuntimeError("--rate-limit-safety-factor debe ser mayor o igual que 1.0")

    python_exe = sys.executable

    # 1) Descargar partidas nuevas (ya deduplica por match_id guardado)
    download_cmd = [python_exe, "download_matches.py"]
    if args.players:
        download_cmd.extend(["--players", *args.players])
    if matches_per_player is not None:
        if matches_per_player <= 0:
            raise RuntimeError("--matches-per-player debe ser mayor que 0")
        download_cmd.extend(["--matches-per-player", str(matches_per_player)])
    if args.check_db_before_download or args.fill_requested:
        download_cmd.append("--check-db-existing")
    if args.backfill_from_history or args.fill_requested:
        download_cmd.append("--backfill-from-history")
    if args.max_history_scan is not None:
        if args.max_history_scan <= 0:
            raise RuntimeError("--max-history-scan debe ser mayor que 0")
        download_cmd.extend(["--max-history-scan", str(args.max_history_scan)])
    if args.no_max_history_scan:
        download_cmd.append("--no-max-history-scan")
    download_cmd.extend(["--workers", str(args.download_workers)])
    download_cmd.extend(["--requests-per-minute", str(args.requests_per_minute)])
    download_cmd.extend(["--rate-limit-safety-factor", str(args.rate_limit_safety_factor)])

    run_step(download_cmd, root_dir, "Descarga")

    # 2) Renombrar por fecha y eliminar duplicados residuales
    run_step(
        [
            python_exe,
            "rename_matches.py",
            str(root_dir),
            "--tz",
            args.tz,
            "--delete-duplicates",
            *( ["--recursive"] if args.recursive else [] ),
        ],
        root_dir,
        "Renombrado y deduplicacion",
    )

    # 3) Transformar todos los matches al formato final
    print("\n[STEP] Conversion a formato final")
    template_path = root_dir / "FormatoPartida.txt"
    template = load_template(template_path)
    files = collect_match_files(root_dir, args.recursive)

    if not files:
        print("[INFO] No se encontraron archivos de partida para convertir.")
        print("\n[DONE] Pipeline completado.")
        return

    converted = 0
    skipped_existing = 0
    failed = 0

    with ThreadPoolExecutor(max_workers=args.convert_workers) as executor:
        futures = {
            executor.submit(
                convert_one_match_file,
                src,
                match_id,
                started_at,
                template,
                output_dir,
                args.tz,
                args.overwrite,
            ): (src, match_id)
            for src, match_id, started_at in files
        }

        total_files = len(futures)
        for i, future in enumerate(as_completed(futures), start=1):
            src, fallback_match_id = futures[future]
            progress = progress_label(i, total_files)
            try:
                match_id, status, error = future.result()
            except Exception as exc:
                failed += 1
                print(f"{progress} [FAILED] {src.name}: {exc}")
                continue

            if status == "converted":
                converted += 1
                print(f"{progress} [OK] {src.name} -> {match_id}")
            elif status == "skipped_existing":
                skipped_existing += 1
                print(f"{progress} [SKIP] Ya existe: {match_id}")
            else:
                failed += 1
                print(f"{progress} [FAILED] {src.name} ({fallback_match_id}): {error}")

    print("\n[SUMMARY]")
    print(f"Convertidos: {converted}")
    print(f"Saltados (ya existian): {skipped_existing}")
    print(f"Fallidos: {failed}")
    print(f"Total evaluados: {len(files)}")
    print("\n[DONE] Pipeline completado.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[STOP] Interrumpido por usuario.")
        raise SystemExit(130)
    except Exception as exc:
        print(f"\n[ERROR] {exc}")
        raise SystemExit(1)
