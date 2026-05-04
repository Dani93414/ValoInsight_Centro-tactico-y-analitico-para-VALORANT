"""Prepare a safe local .env file for backend development."""

from __future__ import annotations

import secrets
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = PROJECT_ROOT / ".env"

DEFAULTS = {
    "JWT_EXPIRES_MINUTES": "1440",
    "AUTH_COOKIE_SECURE": "false",
    "CORS_ORIGINS": "http://localhost:5173",
}


def parse_env_lines(lines: list[str]) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue

        key, value = stripped.split("=", 1)
        key = key.strip()
        if not key:
            continue

        values[key] = value.strip().strip("\"'")

    return values


def main() -> None:
    if ENV_PATH.exists():
        lines = ENV_PATH.read_text(encoding="utf-8").splitlines()
    else:
        lines = []

    current_values = parse_env_lines(lines)
    missing_values: dict[str, str] = {}

    if not current_values.get("JWT_SECRET_KEY"):
        missing_values["JWT_SECRET_KEY"] = secrets.token_urlsafe(64)

    for key, value in DEFAULTS.items():
        if not current_values.get(key):
            missing_values[key] = value

    if missing_values:
        if lines and lines[-1].strip():
            lines.append("")

        lines.extend(f"{key}={value}" for key, value in missing_values.items())
        ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print("Entorno local preparado")


if __name__ == "__main__":
    main()
