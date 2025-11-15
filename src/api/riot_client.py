import os
import requests
import time
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("RIOT_API_KEY")

# ===========================
# REGIONES
# ===========================
ACCOUNT_REGION = "europe"
VAL_REGION = "eu"

ACCOUNT_BASE = f"https://{ACCOUNT_REGION}.api.riotgames.com"
VAL_BASE = f"https://{VAL_REGION}.api.riotgames.com"

HEADERS = {"X-Riot-Token": API_KEY}


# ============================================================
#  PUUID (FUNCIONA CON DEV KEY)
# ============================================================
def get_puuid(game_name: str, tag_line: str) -> str:
    url = f"{ACCOUNT_BASE}/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}"
    response = requests.get(url, headers=HEADERS)

    if response.status_code == 200:
        return response.json()["puuid"]

    raise Exception(
        f"❌ Error al obtener PUUID: {response.status_code} — {response.text}"
    )


# ============================================================
#  /val/content/v1/contents
# ============================================================
def get_valorant_content(locale: str = "es-ES") -> dict:
    url = f"{VAL_BASE}/val/content/v1/contents?locale={locale}"
    response = requests.get(url, headers=HEADERS)

    if response.status_code == 200:
        return response.json()

    raise Exception(
        f"❌ Error al obtener contenido de Valorant: {response.status_code} — {response.text}"
    )


# ============================================================
#  NUEVA FUNCIÓN → Obtener actos anteriores
# ============================================================
def get_previous_acts(content: dict) -> list:
    """
    Devuelve los actos *anteriores*, excluyendo el acto activo.
    Ordenados del más reciente al más antiguo.
    """

    acts = content.get("acts", [])

    # Acto activo
    active_act = next((a for a in acts if a.get("isActive")), None)

    if not active_act:
        raise Exception("⚠️ No se encontró ningún acto activo.")

    active_index = acts.index(active_act)

    # Actos anteriores (posición menor en la lista)
    previous_acts = acts[:active_index]

    # Invertimos para que el más reciente salga primero
    return list(reversed(previous_acts))


# ============================================================
#  Leaderboard
# ============================================================
def get_leaderboard(act_id, size=200, start_index=0):
    url = (
        f"{VAL_BASE}/val/ranked/v1/leaderboards/by-act/{act_id}"
        f"?size={size}&startIndex={start_index}"
    )

    retries = 5

    for i in range(retries):
        response = requests.get(url, headers=HEADERS)

        if response.status_code == 200:
            return response.json()

        if response.status_code == 429:
            wait = 5 * (i + 1)
            print(f"⛔ Rate limit. Esperando {wait}s…")
            time.sleep(wait)
            continue

        raise Exception(
            f"❌ Error al obtener leaderboard: {response.status_code} — {response.text}"
        )

    raise Exception("🚫 No se pudo obtener leaderboard tras varios intentos.")


# ============================================================
#  Estado de la plataforma
# ============================================================
def get_platform_status() -> dict:
    url = f"{VAL_BASE}/val/status/v1/platform-data"
    response = requests.get(url, headers=HEADERS)

    if response.status_code == 200:
        return response.json()

    raise Exception(
        f"❌ Error al obtener el estado de la plataforma: {response.status_code} — {response.text}"
    )
