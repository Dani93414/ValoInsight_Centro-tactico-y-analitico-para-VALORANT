from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import pandas as pd

from .schemas import FORBIDDEN_FEATURES, MODEL_FEATURES
from .state_extractor import extract_match_round_states

LOGGER = logging.getLogger(__name__)
DEFAULT_DATASET_PATH = Path(__file__).parent / "artifacts" / "economy_round_dataset.parquet"


def build_economy_dataset_from_matches(matches: list[dict]) -> pd.DataFrame:
    rows: list[dict] = []
    discarded = {
        "missing_rounds": 0, "not_ranked": 0,
        "invalid_teams_or_economy": 0, "unknown_action_rows": 0,
    }
    for match in matches:
        if not isinstance(match, dict) or not match.get("roundResults"):
            discarded["missing_rounds"] += 1
            continue
        if not bool((match.get("matchInfo") or {}).get("isRanked")):
            discarded["not_ranked"] += 1
            continue
        extracted = extract_match_round_states(match)
        if not extracted:
            discarded["invalid_teams_or_economy"] += 1
            continue
        valid_rows = [row for row in extracted if row.get("real_buy_action") != "UNKNOWN"]
        discarded["unknown_action_rows"] += len(extracted) - len(valid_rows)
        rows.extend(valid_rows)
    LOGGER.info("Economy dataset: %s rows; discarded=%s", len(rows), discarded)
    return pd.DataFrame(rows)


def build_economy_dataset_from_folder(input_dir: str | Path) -> pd.DataFrame:
    matches: list[dict] = []
    for path in Path(input_dir).rglob("*.json"):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            matches.append(payload.get("data", payload) if isinstance(payload, dict) else {})
        except (OSError, json.JSONDecodeError) as exc:
            LOGGER.warning("Ignoring %s: %s", path, exc)
    return build_economy_dataset_from_matches(matches)


def save_dataset(df: pd.DataFrame, output_path: str | Path = DEFAULT_DATASET_PATH) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path, index=False)


def validate_dataset(df: pd.DataFrame) -> dict:
    expected = {feature for feature in MODEL_FEATURES if feature != "buy_action"}
    missing = sorted(expected - set(df.columns))
    leaked = sorted(FORBIDDEN_FEATURES.intersection(MODEL_FEATURES))
    timestamp_coverage = (
        float((pd.to_numeric(df["game_start_millis"], errors="coerce").fillna(0) > 0).mean())
        if "game_start_millis" in df and len(df) else 0.0
    )
    return {
        "valid": not missing and not leaked and not df.empty and timestamp_coverage >= 0.9,
        "rows": len(df),
        "matches": int(df["match_id"].nunique()) if "match_id" in df else 0,
        "missing_model_columns": missing,
        "forbidden_model_features": leaked,
        "timestamp_coverage": timestamp_coverage,
        "unknown_action_rate": (
            float((df["real_buy_action"] == "UNKNOWN").mean())
            if "real_buy_action" in df and len(df) else 0.0
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the economy ML round dataset.")
    parser.add_argument("input_dir")
    parser.add_argument("--output", default=str(DEFAULT_DATASET_PATH))
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    dataset = build_economy_dataset_from_folder(args.input_dir)
    save_dataset(dataset, args.output)
    print(f"Saved {len(dataset)} rows to {args.output}")


if __name__ == "__main__":
    main()
