import os
import requests
import time
from pathlib import Path
from dotenv import load_dotenv

# Carga .env desde la raiz del proyecto (TFG/.env), sin depender del cwd.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

# ===========================
# REGIONES POR DEFECTO
# ===========================
ACCOUNT_REGION = "europe"
VAL_REGION = "eu"

ACCOUNT_BASE = f"https://{ACCOUNT_REGION}.api.riotgames.com"
VAL_BASE = f"https://{VAL_REGION}.api.riotgames.com"
HENRIK_BASE = "https://api.henrikdev.xyz"
LEADERBOARD_SIZE = 15000
RIOT_LEADERBOARD_PAGE_SIZE = 200


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


def _get_henrik_headers() -> dict:
    api_key = (
        os.getenv("HENRY_API_KEY")
        or os.getenv("HENRIK_API_KEY")
        or os.getenv("API_KEY")
        or ""
    ).strip().strip('"').strip("'")

    if not api_key:
        raise RuntimeError("HENRY_API_KEY no esta definida en .env.")

    return {
        "Authorization": api_key,
        "Accept": "application/json",
        "User-Agent": "tfg-valorant-leaderboards/1.0",
    }


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
#  Leaderboard (HenrikDev principal, Riot fallback)
# ============================================================
def _empty_to_none(value):
    return value if value not in ("", None) else None


def _normalize_leaderboard_player(player: dict, source: str) -> dict:
    if source == "henrik":
        player_card = _empty_to_none(player.get("card"))
        player_title = _empty_to_none(player.get("title"))
        return {
            "PlayerCardID": player_card,
            "TitleID": player_title,
            "playerCard": player_card,
            "playerTitle": player_title,
            "IsBanned": player.get("is_banned"),
            "IsAnonymized": player.get("is_anonymized"),
            "puuid": player.get("puuid"),
            "gameName": player.get("name"),
            "tagLine": player.get("tag"),
            "leaderboardRank": player.get("leaderboard_rank"),
            "rankedRating": player.get("rr"),
            "numberOfWins": player.get("wins"),
            "competitiveTier": player.get("tier"),
            "updatedAt": player.get("updated_at"),
        }

    return {
        "PlayerCardID": None,
        "TitleID": None,
        "playerCard": None,
        "playerTitle": None,
        "IsBanned": player.get("IsBanned"),
        "IsAnonymized": player.get("IsAnonymized"),
        "puuid": player.get("puuid"),
        "gameName": player.get("gameName"),
        "tagLine": player.get("tagLine"),
        "leaderboardRank": player.get("leaderboardRank"),
        "rankedRating": player.get("rankedRating"),
        "numberOfWins": player.get("numberOfWins"),
        "competitiveTier": player.get("competitiveTier"),
        "updatedAt": player.get("updatedAt"),
    }


def _normalize_henrik_leaderboard(payload: dict) -> dict:
    data = payload.get("data") if isinstance(payload, dict) else {}
    players = data.get("players", []) if isinstance(data, dict) else []

    return {
        "source": "henrik",
        "updated_at": data.get("updated_at") if isinstance(data, dict) else None,
        "thresholds": data.get("thresholds", []) if isinstance(data, dict) else [],
        "totalPlayers": len(players),
        "players": [_normalize_leaderboard_player(player, "henrik") for player in players if isinstance(player, dict)],
    }


def _normalize_riot_leaderboard(payload: dict) -> dict:
    players = payload.get("players", []) if isinstance(payload, dict) else []
    return {
        "source": "riot",
        "updated_at": None,
        "thresholds": [],
        "totalPlayers": payload.get("totalPlayers", len(players)) if isinstance(payload, dict) else len(players),
        "players": [_normalize_leaderboard_player(player, "riot") for player in players if isinstance(player, dict)],
    }


def get_henrik_leaderboard(
    act_id: str,
    region: str = "eu",
    platform: str = "pc",
    size: int = LEADERBOARD_SIZE,
    start_index: int = 0,
) -> dict:
    region_code = region.lower()
    url = f"{HENRIK_BASE}/valorant/v3/leaderboard/{region_code}/{platform}"
    params = {
        "season_id": act_id,
        "size": size,
        "start_index": start_index,
    }

    retries = 5
    for i in range(retries):
        response = requests.get(url, headers=_get_henrik_headers(), params=params, timeout=45)

        if response.status_code == 200:
            return _normalize_henrik_leaderboard(response.json())

        if response.status_code == 429:
            wait = int(response.headers.get("Retry-After") or (5 * (i + 1)))
            print(f"Rate limit HenrikDev. Esperando {wait}s...")
            time.sleep(wait)
            continue

        raise Exception(f"Error HenrikDev leaderboard ({region.upper()}): {response.status_code} - {response.text}")

    raise Exception(f"No se pudo obtener leaderboard HenrikDev para {region.upper()} tras varios intentos.")


def _get_riot_leaderboard_page(act_id: str, region: str, size: int, start_index: int) -> dict:
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
            return _normalize_riot_leaderboard(response.json())

        if response.status_code == 429:
            wait = 5 * (i + 1)
            print(f"⛔ Rate limit. Esperando {wait}s…")
            time.sleep(wait)
            continue

        _raise_riot_error(f"Error al obtener leaderboard ({region.upper()})", response)

    raise Exception(f"🚫 No se pudo obtener leaderboard para {region.upper()} tras varios intentos.")


def get_riot_leaderboard(act_id: str, region: str = "eu", size: int = LEADERBOARD_SIZE, start_index: int = 0) -> dict:
    remaining = max(int(size), 0)
    current_start = max(int(start_index), 0)
    merged_players = []
    total_players = 0

    while remaining > 0:
        page_size = min(remaining, RIOT_LEADERBOARD_PAGE_SIZE)
        page = _get_riot_leaderboard_page(act_id, region, page_size, current_start)
        players = page.get("players", [])
        total_players = page.get("totalPlayers", total_players)

        if not players:
            break

        merged_players.extend(players)
        fetched_count = len(players)

        if fetched_count < page_size:
            break

        current_start += fetched_count
        remaining -= fetched_count

        if total_players and current_start >= total_players:
            break

    return {
        "source": "riot",
        "updated_at": None,
        "thresholds": [],
        "totalPlayers": total_players or len(merged_players),
        "players": merged_players,
    }


# ============================================================
#  Estado de la plataforma
# ============================================================
def get_leaderboard(
    act_id: str,
    region: str = "eu",
    platform: str = "pc",
    size: int = LEADERBOARD_SIZE,
    start_index: int = 0,
) -> dict:
    platform = platform.lower()
    try:
        return get_henrik_leaderboard(act_id, region, platform=platform, size=size, start_index=start_index)
    except Exception as henrik_error:
        if platform != "pc":
            raise Exception(
                f"HenrikDev no disponible para {region.upper()} ({act_id}, {platform}) "
                "y Riot no ofrece fallback por plataforma de consola."
            ) from henrik_error
        print(f"HenrikDev no disponible para {region.upper()} ({act_id}). Fallback Riot: {henrik_error}")
        return get_riot_leaderboard(act_id, region, size=size, start_index=start_index)


def get_platform_status() -> dict:
    url = f"{VAL_BASE}/val/status/v1/platform-data"
    response = requests.get(url, headers=_get_headers())

    if response.status_code == 200:
        return response.json()

    _raise_riot_error("Error al obtener el estado de la plataforma", response)
