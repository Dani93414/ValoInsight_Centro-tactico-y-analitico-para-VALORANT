import argparse
import json
import os
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parents[1]
backend_root = project_root / "backend"

for path in (str(project_root), str(backend_root)):
    if path not in sys.path:
        sys.path.append(path)

from backend.modules.matches.application.match_processor import process_single_match_with_status


VALID_STATUSES = {"inserted", "already_exists", "failed"}


def iter_match_files(base_dir: Path, recursive: bool):
    pattern = "**/*.json" if recursive else "*.json"
    return sorted(base_dir.glob(pattern))


def main():
    parser = argparse.ArgumentParser(
        description="Upload local match JSON files to MongoDB and delete inserted files safely."
    )
    parser.add_argument(
        "--input-dir",
        default="data/BaseDatos_Partidas",
        help="Directory containing match JSON files.",
    )
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Process JSON files recursively under input-dir.",
    )
    parser.add_argument(
        "--no-delete",
        action="store_true",
        help="Do not delete files after successful insert.",
    )
    args = parser.parse_args()

    # Resolve input directory relative to project root when a relative path is provided.
    project_root = Path(__file__).resolve().parents[1]
    input_path = Path(args.input_dir)
    if not input_path.is_absolute():
        input_dir = (project_root / input_path).resolve()
    else:
        input_dir = input_path.resolve()

    if not input_dir.exists() or not input_dir.is_dir():
        print(f"[ERROR] Invalid input directory: {input_dir}")
        raise SystemExit(1)

    files = list(iter_match_files(input_dir, args.recursive))
    if not files:
        print(f"[INFO] No JSON files found in: {input_dir}")
        return

    stats = {
        "processed": 0,
        "inserted": 0,
        "already_exists": 0,
        "failed": 0,
        "deleted": 0,
        "read_errors": 0,
        "delete_errors": 0,
    }

    print(f"[INFO] Input dir: {input_dir}")
    print(f"[INFO] Files found: {len(files)}")

    for idx, file_path in enumerate(files, start=1):
        stats["processed"] += 1

        try:
            with file_path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except Exception as exc:
            stats["read_errors"] += 1
            stats["failed"] += 1
            print(f"[{idx}/{len(files)}] [FAILED] {file_path.name} -> read/json error: {exc}")
            continue

        status = process_single_match_with_status(payload)
        if status not in VALID_STATUSES:
            status = "failed"

        stats[status] += 1

        if status == "inserted":
            print(f"[{idx}/{len(files)}] [INSERTED] {file_path.name}")
            if not args.no_delete:
                try:
                    file_path.unlink()
                    stats["deleted"] += 1
                except Exception as exc:
                    stats["delete_errors"] += 1
                    print(f"[{idx}/{len(files)}] [WARN] Could not delete {file_path.name}: {exc}")
        elif status == "already_exists":
            print(f"[{idx}/{len(files)}] [DUPLICATE] {file_path.name}")
        else:
            print(f"[{idx}/{len(files)}] [FAILED] {file_path.name}")

    print("\n[SUMMARY]")
    print(f"processed: {stats['processed']}")
    print(f"inserted: {stats['inserted']}")
    print(f"already_exists: {stats['already_exists']}")
    print(f"failed: {stats['failed']}")
    print(f"deleted: {stats['deleted']}")
    print(f"read_errors: {stats['read_errors']}")
    print(f"delete_errors: {stats['delete_errors']}")


if __name__ == "__main__":
    main()
