"""Read-only Mongo extraction, reproducible player dataset and temporal training."""
from __future__ import annotations

import argparse
import gzip
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "4")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=10000)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--audit-only", action="store_true")
    args = parser.parse_args()
    from infrastructure.mongo_client import matches_collection
    from modules.economy_ml.player_buy_dataset import build_dataset, catalog_snapshot
    from modules.economy_ml.player_buy_model import ARTIFACT_DIR, train
    cache = ROOT / "data" / "player_buy_matches.json.gz"
    cache.parent.mkdir(parents=True, exist_ok=True)
    if cache.exists() and not args.refresh:
        with gzip.open(cache, "rt", encoding="utf-8") as stream:
            matches = json.load(stream)
    else:
        print("Leyendo partidas ranked, sin escribir en MongoDB...", flush=True)
        projection = {"_id": 0, "matchInfo": 1, "players.puuid": 1, "players.teamId": 1,
                      "players.characterId": 1, "players.competitiveTier": 1, "teams": 1,
                      "roundResults.roundNum": 1, "roundResults.roundResult": 1,
                      "roundResults.winningTeam": 1, "roundResults.winningTeamRole": 1,
                      "roundResults.bombPlanter": 1, "roundResults.bombDefuser": 1,
                      "roundResults.playerStats.puuid": 1, "roundResults.playerStats.economy": 1,
                      "roundResults.playerStats.damage": 1,
                      "roundResults.playerStats.kills.killer": 1, "roundResults.playerStats.kills.victim": 1,
                      "roundResults.playerStats.kills.timeSinceRoundStartMillis": 1,
                      "roundResults.playerStats.kills.finishingDamage": 1}
        matches = list(matches_collection.find({"matchInfo.isRanked": True}, projection)
                       .sort("matchInfo.gameStartMillis", -1).limit(args.limit))
        with gzip.open(cache, "wt", encoding="utf-8") as stream:
            json.dump(matches, stream)
    print(f"Partidas: {len(matches)}. Construyendo historial cronológico...", flush=True)
    catalog = catalog_snapshot()
    frame = build_dataset(matches, catalog)
    audit = {"matches": int(frame.match_id.nunique()), "rows": len(frame),
             "money_sources": frame.money_source.value_counts().to_dict(),
             "unknown_weapons": int(frame.weapon_value.isna().sum()),
             "unknown_armors": int(frame.armor_value.isna().sum()),
             "weapons": len(catalog["weapons"]), "armors": len(catalog["armors"])}
    print(json.dumps(audit, ensure_ascii=False), flush=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    (ARTIFACT_DIR / "audit.json").write_text(json.dumps(audit, indent=2), encoding="utf-8")
    if not args.audit_only:
        report = train(frame, catalog)
        print(json.dumps({k: report[k] for k in ("available", "test", "baseline_test", "selected_parameters", "history_coverage")}), flush=True)


if __name__ == "__main__":
    main()
