import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parents[1]
backend_root = project_root / "backend"

for path in (str(project_root), str(backend_root)):
    if path not in sys.path:
        sys.path.append(path)

from backend.infrastructure.mongo_client import ensure_indexes
from backend.modules.analytics.application.service import rebuild_all_player_match_analytics
from backend.modules.matches.application.ingest_match import (
    insert_match_only_with_status,
    recalculate_global_stats,
)
from backend.modules.players.application.rebuild_players import rebuild_players_from_matches


VALID_STATUSES = {"inserted", "already_exists", "failed"}
DEFAULT_SAFE_INPUT_ROOT = project_root / "data" / "BaseDatos_Partidas"
DEFAULT_UPLOAD_WORKERS = int(os.getenv("MONGO_UPLOAD_WORKERS", "6"))


def progress_label(done: int, total: int) -> str:
    pct = (done / total * 100.0) if total else 100.0
    return f"[{pct:5.1f}%] [{done}/{total}]"


def iter_match_files(base_dir: Path, recursive: bool) -> list[Path]:
    pattern = "**/*.json" if recursive else "*.json"
    return sorted(base_dir.glob(pattern))


def resolve_input_dir(raw_input_dir: str) -> Path:
    input_path = Path(raw_input_dir)
    if not input_path.is_absolute():
        return (project_root / input_path).resolve()
    return input_path.resolve()


def upload_one_file(
    file_path: Path,
    input_dir: Path,
    delete_duplicates: bool,
    no_delete: bool,
) -> dict:
    try:
        with file_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except Exception as exc:
        return {
            "file": str(file_path),
            "status": "failed",
            "read_error": True,
            "deleted": False,
            "delete_error": None,
            "error": str(exc),
        }

    status = insert_match_only_with_status(payload)
    if status not in VALID_STATUSES:
        status = "failed"

    should_delete = status == "inserted" or (
        status == "already_exists" and delete_duplicates
    )

    deleted = False
    delete_error = None
    if should_delete and not no_delete:
        try:
            resolved_file = file_path.resolve()
            if not resolved_file.is_relative_to(input_dir):
                raise RuntimeError("resolved file path escaped input directory")
            resolved_file.unlink()
            deleted = True
        except Exception as exc:
            delete_error = str(exc)

    return {
        "file": str(file_path),
        "status": status,
        "read_error": False,
        "deleted": deleted,
        "delete_error": delete_error,
        "error": None,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Upload match JSON files to MongoDB in parallel without rebuilding derived state per file."
    )
    parser.add_argument("--input-dir", default="data/BaseDatos_Partidas")
    parser.add_argument("--recursive", action="store_true")
    parser.add_argument("--workers", type=int, default=DEFAULT_UPLOAD_WORKERS)
    parser.add_argument("--no-delete", action="store_true")
    parser.add_argument("--delete-duplicates", action="store_true")
    parser.add_argument("--allow-external-dir", action="store_true")
    parser.add_argument("--rebuild-derived", action="store_true")
    args = parser.parse_args()

    if args.workers <= 0:
        raise SystemExit("--workers debe ser mayor que 0.")

    input_dir = resolve_input_dir(args.input_dir)

    if not input_dir.exists() or not input_dir.is_dir():
        print(f"[ERROR] Invalid input directory: {input_dir}")
        raise SystemExit(1)

    safe_root = DEFAULT_SAFE_INPUT_ROOT.resolve()
    if not args.allow_external_dir and not input_dir.is_relative_to(safe_root):
        print(
            "[ERROR] Refusing to process an external input directory without "
            f"--allow-external-dir: {input_dir}"
        )
        raise SystemExit(1)

    ensure_indexes()
    files = iter_match_files(input_dir, args.recursive)

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
    print(f"[INFO] Workers: {args.workers}")

    if files:
        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures = {
                executor.submit(
                    upload_one_file,
                    file_path,
                    input_dir,
                    args.delete_duplicates,
                    args.no_delete,
                ): file_path
                for file_path in files
            }

            total_files = len(futures)
            for idx, future in enumerate(as_completed(futures), start=1):
                file_path = futures[future]
                progress = progress_label(idx, total_files)
                stats["processed"] += 1

                try:
                    result = future.result()
                except Exception as exc:
                    stats["failed"] += 1
                    print(f"{progress} [FAILED] {file_path.name}: {exc}")
                    continue

                status = result["status"]
                stats[status] += 1
                if result["read_error"]:
                    stats["read_errors"] += 1
                if result["deleted"]:
                    stats["deleted"] += 1
                if result["delete_error"]:
                    stats["delete_errors"] += 1

                if status == "inserted":
                    label = "INSERTED"
                elif status == "already_exists":
                    label = "DUPLICATE"
                else:
                    label = "FAILED"

                suffix = ""
                if result["deleted"]:
                    suffix = " deleted"
                elif result["delete_error"]:
                    suffix = f" delete_error={result['delete_error']}"
                elif result["error"]:
                    suffix = f" error={result['error']}"

                print(f"{progress} [{label}] {file_path.name}{suffix}")
    else:
        print(f"[INFO] No JSON files found in: {input_dir}")

    print("\n[SUMMARY]")
    print(f"processed: {stats['processed']}")
    print(f"inserted: {stats['inserted']}")
    print(f"already_exists: {stats['already_exists']}")
    print(f"failed: {stats['failed']}")
    print(f"deleted: {stats['deleted']}")
    print(f"read_errors: {stats['read_errors']}")
    print(f"delete_errors: {stats['delete_errors']}")

    if args.rebuild_derived:
        print("\n[STEP] Rebuilding derived state sequentially")
        analytics_result = rebuild_all_player_match_analytics(batch_size=200)
        print(f"[OK] analytics: {analytics_result}")
        players_result = rebuild_players_from_matches()
        print(f"[OK] players: {players_result}")
        recalculate_global_stats()
        print("[OK] regions/global stats rebuilt")


if __name__ == "__main__":
    main()
