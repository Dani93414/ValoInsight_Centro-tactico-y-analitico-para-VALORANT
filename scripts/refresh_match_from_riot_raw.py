#!/usr/bin/env python3
"""Refresh one stored match from RAW Riot, optionally without writing."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for item in (ROOT, ROOT / "backend"):
    if str(item) not in sys.path:
        sys.path.append(str(item))

from backend.infrastructure.riot_raw_client import get_henrik_match, get_raw_match
from backend.ingestion.riot_raw_adapter import adapt_riot_raw_match
from backend.modules.matches.application.riot_raw_refresh import (
    enrich_riot_raw_with_henrik_match,
    merge_riot_raw_match,
    needs_henrik_enrichment,
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("match_id")
    parser.add_argument("--region", default="eu")
    parser.add_argument("--platform", default="pc")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-rebuild-derived", action="store_true")
    parser.add_argument("--no-henrik-match-enrichment", action="store_true")
    args = parser.parse_args()
    # Keep --help usable without a MongoDB configuration.
    from backend.modules.matches.infrastructure import mongo_match_repo
    existing = mongo_match_repo.find_raw_by_match_id(args.match_id)
    if not existing:
        raise SystemExit(f"No existe {args.match_id} en MongoDB")
    raw = get_raw_match(args.match_id, args.region, args.platform)
    normalized = adapt_riot_raw_match(raw, region=args.region, platform=args.platform)
    if (normalized.get("matchInfo") or {}).get("matchId") != args.match_id:
        raise SystemExit("RAW devolvio un matchId distinto; no se ha modificado MongoDB")
    if not args.no_henrik_match_enrichment and needs_henrik_enrichment(normalized):
        filled = enrich_riot_raw_with_henrik_match(
            normalized, get_henrik_match(args.match_id, args.region)
        )
        if filled:
            print("Campos completados desde Henrik v4:", ", ".join(filled))
    merged, changes = merge_riot_raw_match(existing, normalized)
    print("Cambios:", ", ".join(changes) or "ningún campo material")
    if args.dry_run:
        print("[DRY-RUN] No se ha actualizado MongoDB.")
        return
    if not mongo_match_repo.replace(merged):
        raise SystemExit("La partida desaparecio durante el refresh; no se han reconstruido derivados")
    if not args.skip_rebuild_derived:
        from scripts.ingest_riot_raw_matches import _rebuild_derived
        _rebuild_derived()
    print(f"[UPGRADE] {args.match_id} actualizado" + (" y derivados reconstruidos." if not args.skip_rebuild_derived else "."))


if __name__ == "__main__":
    main()
