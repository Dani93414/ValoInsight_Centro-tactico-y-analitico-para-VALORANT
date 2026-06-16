from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Any

import joblib

from .schemas import SCHEMA_VERSION

ARTIFACTS_DIR = Path(__file__).parent / "artifacts"
METADATA_PATH = ARTIFACTS_DIR / "metadata.json"


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def model_path(scope: str, value: str | None = None, artifacts_dir: Path | None = None) -> Path:
    root = artifacts_dir or ARTIFACTS_DIR
    if scope == "global":
        return root / "global_model.joblib"
    return root / f"{scope}_{_slug(value or 'unknown')}.joblib"


def save_model(
    bundle: dict, scope: str, value: str | None = None, artifacts_dir: Path | None = None
) -> Path:
    path = model_path(scope, value, artifacts_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, path)
    return path


def load_metadata() -> dict:
    if not METADATA_PATH.exists():
        return {}
    try:
        return json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save_metadata(metadata: dict, artifacts_dir: Path | None = None) -> None:
    root = artifacts_dir or ARTIFACTS_DIR
    root.mkdir(parents=True, exist_ok=True)
    (root / "metadata.json").write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def clear_model_artifacts(artifacts_dir: Path | None = None) -> None:
    root = artifacts_dir or ARTIFACTS_DIR
    root.mkdir(parents=True, exist_ok=True)
    for path in root.glob("*.joblib"):
        path.unlink()
    metadata_path = root / "metadata.json"
    if metadata_path.exists():
        metadata_path.unlink()


def publish_model_artifacts(staging_dir: Path) -> None:
    """Replace live model files only after a complete staging directory exists."""
    metadata_path = staging_dir / "metadata.json"
    staged_models = list(staging_dir.glob("*.joblib"))
    if not staged_models or not metadata_path.exists():
        raise ValueError("No hay modelos entrenados para publicar")

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    backup_dir = ARTIFACTS_DIR / ".previous_models"
    if backup_dir.exists():
        shutil.rmtree(backup_dir)
    backup_dir.mkdir()
    moved_live: list[Path] = []
    try:
        for path in list(ARTIFACTS_DIR.glob("*.joblib")) + [METADATA_PATH]:
            if path.exists():
                shutil.move(str(path), str(backup_dir / path.name))
                moved_live.append(path)
        for path in staged_models + [metadata_path]:
            shutil.move(str(path), str(ARTIFACTS_DIR / path.name))
    except Exception:
        for path in list(ARTIFACTS_DIR.glob("*.joblib")) + [METADATA_PATH]:
            if path.exists():
                path.unlink()
        for original_path in moved_live:
            backup_path = backup_dir / original_path.name
            if backup_path.exists():
                shutil.move(str(backup_path), str(original_path))
        raise
    finally:
        if backup_dir.exists():
            shutil.rmtree(backup_dir)


def load_model_candidates(rank_name: str | None, rank_group: str | None) -> list[tuple[dict, str]]:
    if load_metadata().get("schema_version") != SCHEMA_VERSION:
        return []
    loaded: list[tuple[dict, str]] = []
    candidates = [
        ("rank_name", rank_name), ("rank_group", rank_group), ("global", None),
    ]
    for scope, value in candidates:
        path = model_path(scope, value)
        if path.exists():
            try:
                bundle = joblib.load(path)
                if bundle.get("schema_version") == SCHEMA_VERSION:
                    loaded.append((bundle, scope))
            except Exception:
                continue
    return loaded


def load_best_model(rank_name: str | None, rank_group: str | None) -> tuple[dict | None, str | None]:
    candidates = load_model_candidates(rank_name, rank_group)
    return candidates[0] if candidates else (None, None)


def status() -> dict[str, Any]:
    metadata = load_metadata()
    paths = list(ARTIFACTS_DIR.glob("*.joblib")) if ARTIFACTS_DIR.exists() else []
    if not paths or metadata.get("schema_version") != SCHEMA_VERSION:
        return {"available": False, "reason": "No hay modelo entrenado todavía"}
    return {"available": True, "metadata": metadata, "artifacts": [path.name for path in paths]}
