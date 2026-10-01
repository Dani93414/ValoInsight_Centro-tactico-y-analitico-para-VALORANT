#!/usr/bin/env python3
"""Explicit, resumable collection-level legacy RAW backfill."""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for item in (ROOT, ROOT / "backend"):
    if str(item) not in sys.path:
        sys.path.append(str(item))


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill RAW de candidatos legacy en un unico lote.")
    parser.add_argument("--all", action="store_true", required=True, help="Confirma el backfill de candidatos legacy.")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force-refresh", action="store_true")
    args = parser.parse_args()
    if args.limit <= 0:
        parser.error("--limit debe ser mayor que cero")

    # Import after parsing so --help remains usable without MongoDB settings.
    from backend.modules.matches.infrastructure import mongo_match_repo

    docs = list(mongo_match_repo.find_legacy_by_player())[:args.limit]
    match_ids = [str((doc.get("matchInfo") or {}).get("matchId") or "").strip() for doc in docs]
    match_ids = [match_id for match_id in match_ids if match_id]
    print(f"[BUDGET] legacy candidatos: {len(match_ids)} (limite {args.limit})")
    if not match_ids:
        return

    # A single child process shares one limiter and rebuilds derived state once,
    # instead of doing a full rebuild after every individual match.
    cmd = [sys.executable, str(ROOT / "scripts" / "ingest_riot_raw_matches.py"), "--match-ids", *match_ids]
    if args.force_refresh:
        cmd.append("--force-refresh")
    if args.dry_run:
        cmd.append("--dry-run")
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode:
        raise SystemExit("El lote RAW fallo; los errores transitorios quedan marcados para reanudar.")


if __name__ == "__main__":
    main()
