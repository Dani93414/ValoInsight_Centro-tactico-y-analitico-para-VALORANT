#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import json
from pathlib import Path
from datetime import datetime, timezone

# ZoneInfo puede fallar en Windows si no tienes tzdata instalado.
try:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError  # Python 3.9+
except ImportError:
    ZoneInfo = None
    ZoneInfoNotFoundError = Exception


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def parse_started_at(value: str) -> datetime:
    # '2026-02-20T16:35:51.556Z' -> datetime aware UTC
    if isinstance(value, str) and value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def prefix_hora_dia_mes_anyo(dt_utc: datetime, tz_name: str) -> str:
    """
    Devuelve prefijo hora/dia/mes/año pero seguro para nombre de archivo (sin '/').
    - Intenta usar tz_name (por defecto Europe/Madrid).
    - Si no existe (Windows sin tzdata), usa:
        1) zona horaria local del PC
        2) si falla, UTC
    """
    dt_local = dt_utc

    if ZoneInfo is not None:
        try:
            dt_local = dt_utc.astimezone(ZoneInfo(tz_name))
        except ZoneInfoNotFoundError:
            # Fallback 1: zona local del PC
            try:
                local_tz = datetime.now().astimezone().tzinfo
                if local_tz is not None:
                    dt_local = dt_utc.astimezone(local_tz)
            except Exception:
                # Fallback 2: UTC (ya está)
                dt_local = dt_utc

    # Pedido: hora/dia/mes/año -> en filename sin barras
    return dt_local.strftime("%H-%M_%d-%m-%Y")


def unique_path(target: Path) -> Path:
    """Si existe, añade _2, _3, ..."""
    if not target.exists():
        return target
    stem, suffix = target.stem, target.suffix
    i = 2
    while True:
        cand = target.with_name(f"{stem}_{i}{suffix}")
        if not cand.exists():
            return cand
        i += 1


def should_skip_by_name(path: Path) -> bool:
    """
    Opcional: ignora archivos "resumen" típicos que no son partidas.
    Puedes ajustar/añadir patrones aquí.
    """
    name = path.name.lower()
    return "match_ids" in name  # ej: *_match_ids_eu_pc_50.json


def process_directory(
    directory: Path,
    tz_name: str,
    delete_duplicates: bool,
    dry_run: bool,
    recursive: bool,
):
    seen_match_ids = set()

    it = directory.rglob("*.json") if recursive else directory.glob("*.json")
    files = sorted(it)

    if not files:
        print("No se encontraron .json en la carpeta indicada.")
        return

    for path in files:
        if should_skip_by_name(path):
            # Si no quieres que lo ignore, comenta estas 2 líneas
            print(f"[SKIP] (resumen) {path.name}")
            continue

        try:
            data = load_json(path)
        except Exception as e:
            print(f"[SKIP] No pude leer JSON: {path.name} ({e})")
            continue

        # Tu estructura: data.metadata.match_id / data.metadata.started_at
        md = ((data.get("data") or {}).get("metadata") or {})
        match_id = md.get("match_id")
        started_at = md.get("started_at")

        if not match_id or not started_at:
            print(f"[SKIP] Falta data.metadata.match_id o data.metadata.started_at en {path.name}")
            continue

        # Duplicados por match_id
        if match_id in seen_match_ids:
            if delete_duplicates:
                if dry_run:
                    print(f"[DRY] DUPLICADO -> borraría: {path.name} (match_id={match_id})")
                else:
                    try:
                        path.unlink()
                        print(f"[DEL] DUPLICADO -> borrado: {path.name} (match_id={match_id})")
                    except Exception as e:
                        print(f"[ERR] No pude borrar {path.name}: {e}")
            else:
                print(f"[DUP] {path.name} (match_id={match_id})")
            continue

        seen_match_ids.add(match_id)

        # Fecha -> prefijo
        try:
            dt_utc = parse_started_at(started_at)
        except Exception as e:
            print(f"[SKIP] started_at inválido en {path.name}: {started_at!r} ({e})")
            continue

        prefix = prefix_hora_dia_mes_anyo(dt_utc, tz_name)

        # Nuevo nombre: hora_fecha_matchId.json
        new_name = f"{prefix}_{match_id}{path.suffix}"
        target_base = path.with_name(new_name)

        if target_base == path:
            print(f"[SKIP] Ya tiene el formato objetivo: {path.name}")
            continue

        target = unique_path(target_base)

        if dry_run:
            print(f"[DRY] REN: {path.name} -> {target.name}")
        else:
            try:
                path.rename(target)
                print(f"[REN] {path.name} -> {target.name}")
            except Exception as e:
                print(f"[ERR] No pude renombrar {path.name}: {e}")


def main():
    ap = argparse.ArgumentParser(
        description="Renombra JSONs por fecha/hora (data.metadata.started_at) y elimina duplicados por match_id."
    )
    ap.add_argument("directory", type=Path, help="Carpeta que contiene los .json")
    ap.add_argument("--tz", default="Europe/Madrid", help="Zona horaria deseada (por defecto Europe/Madrid)")
    ap.add_argument("--delete-duplicates", action="store_true", help="Borra duplicados si se repite match_id")
    ap.add_argument("--dry-run", action="store_true", help="Simula (no borra ni renombra)")
    ap.add_argument("--recursive", action="store_true", help="Incluye subcarpetas")
    args = ap.parse_args()

    process_directory(args.directory, args.tz, args.delete_duplicates, args.dry_run, args.recursive)


if __name__ == "__main__":
    main()