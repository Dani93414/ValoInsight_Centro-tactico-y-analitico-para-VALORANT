from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from src.api.analytic.service import rebuild_all_player_match_analytics


def main():
    parser = argparse.ArgumentParser(
        description="Reconstruye la colección player_match_analytics desde matches_collection."
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=200,
        help="Tamaño de batch para el cursor de Mongo.",
    )
    args = parser.parse_args()

    result = rebuild_all_player_match_analytics(batch_size=args.batch_size)

    print("[ANALYTICS REBUILD SUMMARY]")
    print(f"processed_matches: {result['processed_matches']}")
    print(f"inserted_docs: {result['inserted_docs']}")
    print(f"failed_matches: {result['failed_matches']}")


if __name__ == "__main__":
    main()