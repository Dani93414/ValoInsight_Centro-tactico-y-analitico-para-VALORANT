#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import json
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
        "--overwrite",
        action="store_true",
        help="Sobrescribe salidas ya existentes en data/BaseDatos_Partidas/",
    )
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parents[1]
    root_dir = project_root / "backend" / "src" / "obtener_partidas"
    output_dir = project_root / "data" / "BaseDatos_Partidas"
    output_dir.mkdir(parents=True, exist_ok=True)

    if not root_dir.exists() or not root_dir.is_dir():
        raise RuntimeError(f"No existe el directorio de scripts de partidas: {root_dir}")

    python_exe = sys.executable

    # 1) Descargar partidas nuevas (ya deduplica por match_id guardado)
    run_step([python_exe, "descargar_matches.py"], root_dir, "Descarga")

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
    files = collect_match_files(root_dir, args.recursive)

    if not files:
        print("[INFO] No se encontraron archivos de partida para convertir.")
        print("\n[DONE] Pipeline completado.")
        return

    converted = 0
    deleted_raw = 0
    skipped_existing = 0

    for i, (src, match_id, started_at) in enumerate(files, start=1):
        out_name = build_output_name(started_at, match_id, args.tz)
        out_path = output_dir / out_name

        if out_path.exists() and not args.overwrite:
            skipped_existing += 1
            print(f"[{i}/{len(files)}] [SKIP] Ya existe: {out_path.name}")
            if delete_raw_file(src, reason=f"ya existe {match_id} en destino"):
                deleted_raw += 1
            continue

        cmd = [
            python_exe,
            "change_to_good_format.py",
            "-t",
            str(template_path),
            "-i",
            str(src),
            "-o",
            str(out_path),
        ]

        result = subprocess.run(cmd, cwd=str(root_dir))
        if result.returncode != 0:
            raise RuntimeError(f"Fallo convirtiendo {src.name} (exit code={result.returncode})")

        converted += 1
        print(f"[{i}/{len(files)}] [OK] {src.name} -> {out_path.name}")
        if delete_raw_file(src, reason=f"convertido {match_id}"):
            deleted_raw += 1

    print("\n[SUMMARY]")
    print(f"Convertidos: {converted}")
    print(f"Saltados (ya existian): {skipped_existing}")
    print(f"RAW eliminados: {deleted_raw}")
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
