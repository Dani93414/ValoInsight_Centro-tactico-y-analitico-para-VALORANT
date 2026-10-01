#!/usr/bin/env python3
"""Incremental history → RAW Riot → schema-v2 Mongo ingestion.

The old disk formatter remains available exclusively for legacy recovery.  New
details and legacy upgrades are written directly through the v2 adapter.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
for candidate in (ROOT, ROOT / "backend"):
    if str(candidate) not in sys.path:
        sys.path.append(str(candidate))

from backend.ingestion import download_matches as history
from backend.infrastructure.henrik_rate_limit import ThreadSafeRateLimiter
from backend.infrastructure.riot_raw_client import (RiotRawBadRequest,
    RiotRawError, RiotRawNotFound, RiotRawTemporaryError, get_henrik_match, get_raw_match)
from backend.ingestion.riot_raw_adapter import adapt_riot_raw_match
from backend.modules.matches.application.riot_raw_refresh import (
    enrich_riot_raw_with_henrik_match,
    merge_riot_raw_match,
    needs_henrik_enrichment,
)
from backend.modules.matches.domain.schema import (LEGACY_CANDIDATE, NEW, REFRESH_FAILED_PREVIOUSLY,
    UP_TO_DATE, classify_match, refresh_stamp)


def _parse_player(value: str) -> tuple[str, str]:
    if "#" not in value:
        raise argparse.ArgumentTypeError("Jugador debe tener formato GameName#TagLine")
    name, tag = (item.strip() for item in value.split("#", 1))
    if not name or not tag:
        raise argparse.ArgumentTypeError("Jugador debe tener formato GameName#TagLine")
    return name, tag


def _existing_for_ids(ids: list[str]) -> dict[str, dict[str, Any]]:
    if not ids:
        return {}
    from backend.infrastructure.mongo_client import matches_collection
    return {str((doc.get("matchInfo") or {}).get("matchId")): doc for doc in matches_collection.find({"matchInfo.matchId": {"$in": ids}})}


def _legacy_for_players(players: list[tuple[str, str]]) -> list[dict[str, Any]]:
    from backend.infrastructure.mongo_client import matches_collection
    clauses = [{"players": {"$elemMatch": {"gameName": name, "tagLine": tag}}} for name, tag in players]
    if not clauses:
        return []
    query = {"$and": [{"$or": clauses}, {"$or": [{"dataSchema.version": {"$lt": 2}}, {"dataSchema": {"$exists": False}}, {"dataSchema.source": {"$ne": "riot_raw"}}]}]}
    return list(matches_collection.find(query))


def _save_raw(match_id: str, payload: dict[str, Any]) -> None:
    if os.getenv("SAVE_RIOT_RAW_MATCHES", "false").lower() not in {"1", "true", "yes", "on"}:
        return
    folder = ROOT / "data" / "raw_matches"
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f"{match_id}.json"
    temporary = target.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(target)


def _fetch_one(match_id: str, region: str, platform: str, limiter: ThreadSafeRateLimiter) -> tuple[str, dict[str, Any] | None, Exception | None]:
    try:
        return match_id, get_raw_match(match_id, region, platform, limiter=limiter), None
    except Exception as exc:  # Categorised by the caller and persisted for resumption.
        return match_id, None, exc


def _rebuild_derived() -> None:
    from backend.modules.analytics.application.service import rebuild_all_player_match_analytics
    from backend.modules.players.application.rebuild_players import rebuild_players_from_matches
    from scripts.regions_update import update_regions
    print("[REBUILD] analytics", rebuild_all_player_match_analytics(batch_size=200))
    print("[REBUILD] players", rebuild_players_from_matches())
    update_regions()
    print("[REBUILD] regions/global stats rebuilt")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingesta incremental Riot RAW para ValoInsight.")
    parser.add_argument("--players", nargs="+", type=_parse_player)
    parser.add_argument("--match-ids", nargs="+", help="IDs concretos a refrescar; evita consultar el historial.")
    parser.add_argument("--matches-per-player", type=int, default=30)
    parser.add_argument("--refresh-legacy", action="store_true", help="Incluye legacy del historial solicitado (comportamiento por defecto).")
    parser.add_argument("--refresh-all-legacy", action="store_true", help="Audita todos los legacy asociados a los jugadores.")
    parser.add_argument("--refresh-missing-performance", action="store_true")
    parser.add_argument("--force-refresh", action="store_true")
    parser.add_argument("--backfill-from-history", action="store_true")
    parser.add_argument("--max-history-scan", type=int, default=2000)
    parser.add_argument("--no-max-history-scan", action="store_true")
    parser.add_argument("--download-workers", type=int, default=int(os.getenv("HENRIK_DOWNLOAD_WORKERS", "4")))
    parser.add_argument("--requests-per-minute", type=int, default=int(os.getenv("HENRIK_REQUESTS_PER_MINUTE", "60")))
    parser.add_argument("--rate-limit-safety-factor", type=float, default=float(os.getenv("HENRIK_RATE_LIMIT_SAFETY_FACTOR", "1.10")))
    parser.add_argument("--region", default=os.getenv("VALORANT_RAW_REGION", "eu"))
    parser.add_argument("--platform", default=os.getenv("VALORANT_RAW_PLATFORM", "pc"))
    parser.add_argument("--no-henrik-match-enrichment", action="store_true", help="No completa huecos de identidad/perfil con Henrik v4/match.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-rebuild-derived", action="store_true")
    args = parser.parse_args()
    # Keep --help usable without a MongoDB configuration.
    from backend.modules.matches.infrastructure import mongo_match_repo
    if not args.players and not args.match_ids:
        parser.error("Debes indicar --players o --match-ids")
    if args.players and args.match_ids:
        parser.error("Usa --players o --match-ids, no ambos")
    if args.matches_per_player <= 0 or args.download_workers <= 0 or args.requests_per_minute <= 0:
        parser.error("--matches-per-player, --download-workers y --requests-per-minute deben ser > 0")
    if args.rate_limit_safety_factor < 1.0:
        parser.error("--rate-limit-safety-factor debe ser >= 1.0")

    # History and RAW details use a single limiter for the whole process.
    limiter = ThreadSafeRateLimiter(args.requests_per_minute, args.rate_limit_safety_factor)
    history.limiter = limiter
    history_failures: list[str] = []
    if args.match_ids:
        history_ids = list(dict.fromkeys(str(match_id).strip() for match_id in args.match_ids if str(match_id).strip()))
    else:
        session = history.build_session()
        all_ids: list[str] = []
        for name, tag in args.players or []:
            try:
                ids = history.fetch_match_ids(session, name, tag, args.matches_per_player,
                    backfill_from_history=args.backfill_from_history,
                    max_api_entries=None if args.no_max_history_scan else args.max_history_scan)
            except Exception as exc:
                riot_id = f"{name}#{tag}"
                history_failures.append(riot_id)
                print(f"[WARN] {riot_id}: historial no disponible; se omite sin abortar el lote ({exc})")
                continue
            all_ids.extend(ids)
        history_ids = list(dict.fromkeys(all_ids))
    existing = _existing_for_ids(history_ids)
    if args.refresh_all_legacy:
        for doc in _legacy_for_players(args.players or []):
            match_id = str((doc.get("matchInfo") or {}).get("matchId") or "")
            if match_id:
                existing[match_id] = doc
                if match_id not in history_ids:
                    history_ids.append(match_id)

    classifications: dict[str, str] = {
        match_id: classify_match(existing.get(match_id), force=args.force_refresh, missing_performance=args.refresh_missing_performance)
        for match_id in history_ids
    }
    targets = [match_id for match_id, state in classifications.items() if state in {NEW, LEGACY_CANDIDATE}]
    print("[BUDGET] Nuevas: {0} | Legacy a refrescar: {1} | Ya actualizadas: {2} | Fallos previos: {3} | Requests RAW estimadas: {4}".format(
        sum(s == NEW for s in classifications.values()), sum(s == LEGACY_CANDIDATE for s in classifications.values()),
        sum(s == UP_TO_DATE for s in classifications.values()), sum(s == REFRESH_FAILED_PREVIOUSLY for s in classifications.values()), len(targets)))
    if history_failures:
        print(f"[WARN] Jugadores omitidos por error de historial: {', '.join(history_failures)}")
    if args.dry_run:
        return

    metrics = {"history": len(history_ids), "new": 0, "audited": 0, "migrated": 0, "no_change": 0, "up_to_date": sum(s == UP_TO_DATE for s in classifications.values()), "errors": 0, "requests": 0, "henrik_enrichments": 0, "henrik_enrichment_errors": 0}
    changed = False
    with ThreadPoolExecutor(max_workers=args.download_workers) as executor:
        futures = {executor.submit(_fetch_one, match_id, args.region, args.platform, limiter): match_id for match_id in targets}
        for future in as_completed(futures):
            match_id, raw, error = future.result()
            metrics["requests"] += 1
            previous = existing.get(match_id)
            if error:
                metrics["errors"] += 1
                # Credentials and proxy-contract failures are recoverable after a
                # configuration/deployment fix, so do not permanently poison rows.
                status = "not_available" if isinstance(error, RiotRawNotFound) else "temporary_error" if isinstance(error, RiotRawError) else "permanent_error"
                if previous:
                    mongo_match_repo.set_raw_refresh(match_id, refresh_stamp(status))
                print(f"[WARN] {match_id}: {status}: {error}")
                continue
            _save_raw(match_id, raw or {})
            try:
                normalized = adapt_riot_raw_match(raw or {}, region=args.region, platform=args.platform)
            except ValueError as exc:
                metrics["no_change"] += 1
                if previous:
                    mongo_match_repo.set_raw_refresh(match_id, refresh_stamp("temporary_error"))
                print(f"[WARN] {match_id}: RAW incompatible; se reintentara ({exc})")
                continue
            normalized_id = (normalized.get("matchInfo") or {}).get("matchId")
            if normalized_id != match_id:
                metrics["errors"] += 1
                if previous:
                    mongo_match_repo.set_raw_refresh(match_id, refresh_stamp("temporary_error"))
                print(f"[WARN] {match_id}: RAW devolvio matchId distinto ({normalized_id!r}); no se escribio")
                continue
            if not args.no_henrik_match_enrichment and needs_henrik_enrichment(normalized):
                try:
                    legacy_detail = get_henrik_match(match_id, args.region, limiter=limiter)
                    filled = enrich_riot_raw_with_henrik_match(normalized, legacy_detail)
                    metrics["henrik_enrichments"] += 1
                    if filled:
                        print(f"[ENRICH] {match_id}: Henrik v4 completo {', '.join(filled)}")
                except RiotRawError as exc:
                    # RAW is still a valid authoritative match.  A failed
                    # presentation fallback must never discard its gameplay.
                    metrics["henrik_enrichment_errors"] += 1
                    print(f"[WARN] {match_id}: no se pudo completar con Henrik v4; se conserva RAW ({exc})")
            merged, changes = merge_riot_raw_match(previous, normalized)
            if previous:
                if not mongo_match_repo.replace(merged):
                    raise RuntimeError(f"{match_id}: el documento desaparecio durante el refresh")
                metrics["audited"] += 1
                metrics["migrated"] += 1
                print(f"[UPGRADE] {match_id}: {', '.join(changes) or 'schema v2'}")
            else:
                if not mongo_match_repo.insert(merged):
                    # A concurrent process won the insert; do not create a duplicate.
                    print(f"[SKIP] {match_id}: inserted by another process")
                    continue
                metrics["new"] += 1
                print(f"[NEW] {match_id} descargado desde Riot RAW")
            changed = True
    if changed and not args.skip_rebuild_derived:
        _rebuild_derived()
    print("[SUMMARY] Historial revisado: {history} | Nuevas descargadas: {new} | Legacy auditadas: {audited} | Legacy migradas: {migrated} | Legacy sin nuevos datos: {no_change} | Ya actualizadas: {up_to_date} | Errores: {errors} | Requests RAW realizadas: {requests} | Consultas Henrik v4: {henrik_enrichments} | Fallos Henrik v4: {henrik_enrichment_errors}".format(**metrics))


if __name__ == "__main__":
    main()
