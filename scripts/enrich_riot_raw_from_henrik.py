#!/usr/bin/env python3
"""Fill missing RAW presentation fields from Henrik v4/match, resumably."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for item in (ROOT, ROOT / "backend"):
    if str(item) not in sys.path:
        sys.path.append(str(item))

from backend.infrastructure.henrik_rate_limit import ThreadSafeRateLimiter
from backend.infrastructure.riot_raw_client import RiotRawError, get_henrik_match
from backend.modules.matches.application.riot_raw_refresh import (
    enrich_riot_raw_with_henrik_match,
    needs_henrik_enrichment,
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all", action="store_true", required=True, help="Confirma la revisión de partidas RAW guardadas.")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--requests-per-minute", type=int, default=60)
    parser.add_argument("--rate-limit-safety-factor", type=float, default=1.10)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-rebuild-derived", action="store_true")
    args = parser.parse_args()
    if args.limit < 1 or args.requests_per_minute < 1 or args.rate_limit_safety_factor < 1:
        parser.error("--limit y --requests-per-minute deben ser > 0; safety factor debe ser >= 1")

    from backend.infrastructure.mongo_client import matches_collection
    from backend.modules.matches.infrastructure import mongo_match_repo

    candidates = [
        document for document in matches_collection.find({"dataSchema.source": "riot_raw"})
        if needs_henrik_enrichment(document)
    ][:args.limit]
    print(f"[BUDGET] Partidas RAW con campos de presentación incompletos: {len(candidates)} (límite {args.limit})")
    if args.dry_run or not candidates:
        return

    limiter = ThreadSafeRateLimiter(args.requests_per_minute, args.rate_limit_safety_factor)
    updated = unavailable = unchanged = 0
    for index, match in enumerate(candidates, start=1):
        info = match.get("matchInfo") or {}
        match_id = str(info.get("matchId") or "").strip()
        if not match_id:
            continue
        try:
            detail = get_henrik_match(match_id, str(info.get("region") or "eu"), limiter=limiter)
        except RiotRawError as exc:
            unavailable += 1
            print(f"[WARN] [{index}/{len(candidates)}] {match_id}: {exc}")
            continue
        fields = enrich_riot_raw_with_henrik_match(match, detail)
        if fields:
            if not mongo_match_repo.replace(match):
                raise RuntimeError(f"{match_id}: la partida desapareció durante la actualización")
            updated += 1
            print(f"[ENRICH] [{index}/{len(candidates)}] {match_id}: {', '.join(fields)}")
        else:
            unchanged += 1

    if updated and not args.skip_rebuild_derived:
        from scripts.ingest_riot_raw_matches import _rebuild_derived
        _rebuild_derived()
    print(f"[SUMMARY] actualizadas={updated} sin_campos_v4={unchanged} fallos_v4={unavailable}")


if __name__ == "__main__":
    main()
