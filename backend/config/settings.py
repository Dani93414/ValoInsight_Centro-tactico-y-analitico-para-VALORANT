"""Centralised environment variable loading for the entire backend."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Resolve project root (TFG/) regardless of cwd
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]

# Load .env from project root
load_dotenv(PROJECT_ROOT / ".env")

# ── Database ─────────────────────────────────────────────────────────
DB_URI: str = os.getenv("DB_URI", "")
DB_NAME: str = os.getenv("DB_NAME", "")

# ── Riot API ─────────────────────────────────────────────────────────
RIOT_API_KEY: str = os.getenv("RIOT_API_KEY", "")
HENRY_API_KEY: str = os.getenv("HENRY_API_KEY", "")

# ── Server ───────────────────────────────────────────────────────────
API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
API_PORT: int = int(os.getenv("API_PORT", "8000"))
CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
