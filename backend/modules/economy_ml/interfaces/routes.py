from __future__ import annotations

import os
import secrets
from threading import Lock

from fastapi import APIRouter, Header, HTTPException

from modules.economy_ml.analysis_reports import build_map_rank_report
from modules.economy_ml.content_catalog import build_content_report
from modules.economy_ml.dataset_builder import (
    build_economy_dataset_from_matches, build_player_economy_dataset_from_matches,
    save_dataset, validate_dataset,
)
from modules.economy_ml.model_registry import status
from modules.economy_ml.predict import predict_match_economy_recommendations
from modules.economy_ml.train import train_models
from modules.matches.infrastructure import mongo_match_repo

router = APIRouter()
_training_lock = Lock()


@router.get("/status")
def economy_ml_status():
    return status()


@router.get("/content-report")
def economy_ml_content_report():
    return build_content_report()


@router.post("/build-dataset")
def build_economy_ml_dataset():
    limit = int(os.getenv("ECONOMY_ML_TRAIN_MATCH_LIMIT", "10000"))
    matches = mongo_match_repo.list_training_matches(limit)
    team_dataset = build_economy_dataset_from_matches(matches)
    player_dataset = build_player_economy_dataset_from_matches(matches)
    validation = validate_dataset(team_dataset)
    if validation["valid"]:
        save_dataset(team_dataset)
    return {
        "saved": bool(validation["valid"]),
        "team_dataset": validation,
        "player_dataset": {
            "rows": len(player_dataset),
            "matches": int(player_dataset["match_id"].nunique()) if "match_id" in player_dataset else 0,
        },
    }


@router.get("/map-rank-report")
def economy_ml_map_rank_report():
    return build_map_rank_report()


@router.post("/train")
def train_economy_ml(x_economy_ml_train_token: str | None = Header(default=None)):
    expected_token = os.getenv("ECONOMY_ML_TRAIN_TOKEN")
    if not expected_token:
        raise HTTPException(status_code=503, detail="Entrenamiento por API deshabilitado")
    if not x_economy_ml_train_token or not secrets.compare_digest(x_economy_ml_train_token, expected_token):
        raise HTTPException(status_code=403, detail="Token de entrenamiento inválido")
    if not _training_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Ya hay un entrenamiento en curso")
    limit = int(os.getenv("ECONOMY_ML_TRAIN_MATCH_LIMIT", "10000"))
    try:
        matches = mongo_match_repo.list_training_matches(limit)
        dataset = build_economy_dataset_from_matches(matches)
        validation = validate_dataset(dataset)
        if not validation["valid"]:
            raise HTTPException(
                status_code=422,
                detail={"message": "Dataset inválido", "validation": validation},
            )
        save_dataset(dataset)
        try:
            return train_models(dataset)
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail={"message": "No se pudo entrenar el modelo", "error": str(exc)},
            ) from exc
    finally:
        _training_lock.release()


@router.get("/matches/{match_id}")
def match_economy_ml(match_id: str):
    match = mongo_match_repo.find_by_id(match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Partida no encontrada")
    return predict_match_economy_recommendations(match)
