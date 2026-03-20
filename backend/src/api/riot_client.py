import os
import requests
import time
from pathlib import Path
from dotenv import load_dotenv

# Carga .env desde la raiz del proyecto (TFG/.env), sin depender del cwd.
PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")

# ===========================
# REGIONES POR DEFECTO
# ===========================
ACCOUNT_REGION = "europe"
VAL_REGION = "eu"

ACCOUNT_BASE = f"https://{ACCOUNT_REGION}.api.riotgames.com"
VAL_BASE = f"https://{VAL_REGION}.api.riotgames.com"


def _get_headers() -> dict:
    api_key = (os.getenv("RIOT_API_KEY") or "").strip().strip('"').strip("'")

    if not api_key:
        raise RuntimeError(
            "❌ RIOT_API_KEY no esta definida en .env. Agrega una clave valida de Riot Developer Portal."
        )

    if not api_key.startswith("RGAPI-"):
        raise RuntimeError(
            "❌ RIOT_API_KEY tiene formato invalido. Debe comenzar por 'RGAPI-'."
        )

    return {"X-Riot-Token": api_key}


def _raise_riot_error(prefix: str, response: requests.Response) -> None:
    if response.status_code == 401:
        raise Exception(
            f"❌ {prefix}: 401 — API key invalida o expirada. "
            "Genera una nueva clave en Riot Developer Portal y actualiza RIOT_API_KEY en .env."
        )

    raise Exception(f"❌ {prefix}: {response.status_code} — {response.text}")


# ============================================================
#  PUUID (FUNCIONA CON DEV KEY)
# ============================================================
def get_puuid(game_name: str, tag_line: str) -> str:
    url = f"{ACCOUNT_BASE}/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}"
    response = requests.get(url, headers=_get_headers())

    if response.status_code == 200:
        return response.json()["puuid"]

    _raise_riot_error("Error al obtener PUUID", response)


# ============================================================
#  /val/content/v1/contents
# ============================================================
def get_valorant_content(locale: str = "es-ES") -> dict:
    url = f"{VAL_BASE}/val/content/v1/contents?locale={locale}"
    response = requests.get(url, headers=_get_headers())

    if response.status_code == 200:
        return response.json()

    _raise_riot_error("Error al obtener contenido de Valorant", response)


# ============================================================
#  Obtener actos anteriores
# ============================================================
def get_previous_acts(content: dict) -> list:
    """
    Devuelve los actos *anteriores*, excluyendo el acto activo.
    Ordenados del más reciente al más antiguo.
    """
    acts = content.get("acts", [])
    active_act = next((a for a in acts if a.get("isActive")), None)

    if not active_act:
        raise Exception("⚠️ No se encontró ningún acto activo.")

    active_index = acts.index(active_act)
    previous_acts = acts[:active_index]

    return list(reversed(previous_acts))


# ============================================================
#  Leaderboard (AHORA SOPORTA MÚLTIPLES REGIONES)
# ============================================================
def get_leaderboard(act_id, region="eu", size=200, start_index=0):
    # Construimos la URL base de forma dinámica según la región pasada
    region_code = region.lower()
    dynamic_val_base = f"https://{region_code}.api.riotgames.com"
    
    url = (
        f"{dynamic_val_base}/val/ranked/v1/leaderboards/by-act/{act_id}"
        f"?size={size}&startIndex={start_index}"
    )

    retries = 5

    for i in range(retries):
        response = requests.get(url, headers=_get_headers())

        if response.status_code == 200:
            return response.json()

        if response.status_code == 429:
            wait = 5 * (i + 1)
            print(f"⛔ Rate limit. Esperando {wait}s…")
            time.sleep(wait)
            continue

        _raise_riot_error(f"Error al obtener leaderboard ({region.upper()})", response)

    raise Exception(f"🚫 No se pudo obtener leaderboard para {region.upper()} tras varios intentos.")


# ============================================================
#  Estado de la plataforma
# ============================================================
def get_platform_status() -> dict:
    url = f"{VAL_BASE}/val/status/v1/platform-data"
    response = requests.get(url, headers=_get_headers())

    if response.status_code == 200:
        return response.json()

    _raise_riot_error("Error al obtener el estado de la plataforma", response)