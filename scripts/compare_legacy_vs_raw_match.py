#!/usr/bin/env python3
"""Show an auditable diff between Mongo's stable document and a fresh RAW v2 match."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for item in (ROOT, ROOT / "backend"):
    if str(item) not in sys.path:
        sys.path.append(str(item))
from backend.infrastructure.riot_raw_client import get_raw_match
from backend.ingestion.riot_raw_adapter import adapt_riot_raw_match
from backend.modules.matches.infrastructure import mongo_match_repo


def _count(match: dict, key: str) -> int:
    return sum(int((p.get("stats") or {}).get(key, 0) or 0) for p in match.get("players") or [])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("match_id")
    parser.add_argument("--region", default="eu")
    parser.add_argument("--platform", default="pc")
    args = parser.parse_args()
    old = mongo_match_repo.find_by_id(args.match_id)
    if not old:
        raise SystemExit("Partida no encontrada")
    new = adapt_riot_raw_match(get_raw_match(args.match_id, args.region, args.platform), region=args.region, platform=args.platform)
    for key in ("kills", "deaths", "assists", "score"):
        print(f"{key}: legacy={_count(old, key)} raw={_count(new, key)}")
    print(f"players: legacy={len(old.get('players') or [])} raw={len(new.get('players') or [])}")
    print(f"rounds: legacy={len(old.get('roundResults') or [])} raw={len(new.get('roundResults') or [])}")
    old_info, new_info = old.get("matchInfo") or {}, new.get("matchInfo") or {}
    print("map:", old_info.get("mapId"), "→", new_info.get("mapId"))
    print("queue:", old_info.get("queueId"), "→", new_info.get("queueId"))
    print("new matchInfo fields:", sorted(set(new_info) - set(old_info)))
    print("performance players:", sum(bool((p.get("performance") or {}).get("available")) for p in new.get("players") or []))


if __name__ == "__main__":
    main()
