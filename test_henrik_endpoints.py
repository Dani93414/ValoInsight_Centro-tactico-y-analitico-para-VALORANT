#!/usr/bin/env python3
"""
test_henrik_endpoints.py

Prueba una vez los endpoints indicados de HenrikDev Valorant API y genera:

1. henrik_endpoints_report.md
   Informe Markdown con estado, código HTTP, estructura del JSON y observaciones.

2. henrik_endpoints_results.json
   Resultados completos saneados por endpoint, sin API key y con PUUID enmascarado.

Requisitos:
    pip install requests python-dotenv

Uso:
    python test_henrik_endpoints.py

Variables de entorno:
    HENRY_API_KEY=<tu_api_key>
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

BASE_URL = "https://api.henrikdev.xyz"
REPORT_FILE = "henrik_endpoints_report.md"
RESULTS_FILE = "henrik_endpoints_results.json"

TIMEOUT_SECONDS = 25

# 60 requests/minuto con un 10 % de margen para no rozar el límite.
REQUESTS_PER_MINUTE = 60
RATE_LIMIT_SAFETY_FACTOR = 1.10
REQUEST_SLEEP_SECONDS = (60.0 / REQUESTS_PER_MINUTE) * RATE_LIMIT_SAFETY_FACTOR

# Reintentos automáticos si la API devuelve 429.
MAX_RETRIES_429 = 3

# Si hay 429 y la API no devuelve Retry-After, espera 65s.
DEFAULT_RATE_LIMIT_WAIT_SECONDS = 65

# Valores de prueba solicitados
NAME = "No Screams"
TAG = "GFS"
AFFINITY = "eu"
PLATFORM = "pc"
COUNTRY_CODE = "es"
EVENT_ID = 2863
MATCH_ID = 644734
TEAM_ID = 1001
PLAYER_ID = 10971


@dataclass
class Endpoint:
    name: str
    category: str
    method: str
    path_template: str
    description: str = ""
    recommended: bool = True
    alternative: str = ""
    requires_puuid: bool = False
    requires_db_id: bool = False
    auto_test: bool = True
    body: Optional[Dict[str, Any]] = None
    query: Optional[Dict[str, Any]] = None
    notes: List[str] = field(default_factory=list)


@dataclass
class EndpointResult:
    endpoint: Endpoint
    url: str
    status_label: str
    http_status: Optional[int]
    usable: bool
    structure: Any = None
    observations: List[str] = field(default_factory=list)
    error: str = ""
    raw_result: Any = None
    attempts: int = 0


def type_name(value: Any) -> str:
    """Devuelve un nombre simple de tipo JSON/Python."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int) and not isinstance(value, bool):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "str"
    if isinstance(value, list):
        return "list"
    if isinstance(value, dict):
        return "dict"
    return type(value).__name__


def summarize_json_structure(data: Any, max_depth: int = 4) -> Any:
    """
    Recorre un JSON y devuelve solo su estructura.

    Ejemplos:
      {"status": 200, "data": {"name": "abc"}}
      -> {"status": "int", "data": {"name": "str"}}

      [{"id": 1, "name": "x"}, {"id": 2, "name": "y"}]
      -> [{"id": "int", "name": "str"}]
    """
    def _walk(value: Any, depth: int) -> Any:
        if depth >= max_depth:
            return type_name(value)

        if isinstance(value, dict):
            return {str(k): _walk(v, depth + 1) for k, v in value.items()}

        if isinstance(value, list):
            if not value:
                return []
            return [_walk(value[0], depth + 1)]

        return type_name(value)

    return _walk(data, 0)


def flatten_structure(structure: Any, prefix: str = "") -> List[Tuple[str, str]]:
    """Convierte la estructura resumida en líneas campo: tipo."""
    rows: List[Tuple[str, str]] = []

    if isinstance(structure, dict):
        for key, value in structure.items():
            path = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                rows.append((path, "object"))
                rows.extend(flatten_structure(value, path))
            elif isinstance(value, list):
                rows.append((path, "array"))
                if value:
                    if isinstance(value[0], dict):
                        rows.extend(flatten_structure(value[0], f"{path}[]"))
                    else:
                        rows.append((f"{path}[]", str(value[0])))
            else:
                rows.append((path, str(value)))
    elif isinstance(structure, list):
        rows.append((prefix or "root", "array"))
        if structure:
            rows.extend(flatten_structure(structure[0], f"{prefix or 'root'}[]"))
    else:
        rows.append((prefix or "root", str(structure)))

    return rows


def markdown_escape(text: Any) -> str:
    return str(text).replace("|", "\\|").replace("\n", " ")


def mask_sensitive_text(text: str, puuid: Optional[str]) -> str:
    """Enmascara identificadores sensibles conocidos."""
    if puuid:
        text = text.replace(puuid, "<PUUID>")
    return text


def sanitize_json(value: Any, puuid: Optional[str]) -> Any:
    """
    Devuelve una copia saneada de una respuesta JSON.

    No conoce la API key porque nunca se guarda en respuestas, pero enmascara:
    - PUUID real obtenido
    - campos cuyo nombre parezca sensible
    """
    sensitive_keys = {
        "authorization",
        "api_key",
        "apikey",
        "key",
        "token",
        "access_token",
        "refresh_token",
        "secret",
    }

    if isinstance(value, dict):
        cleaned: Dict[str, Any] = {}
        for key, item in value.items():
            key_str = str(key)
            if key_str.lower() in sensitive_keys:
                cleaned[key_str] = "<REDACTED>"
            else:
                cleaned[key_str] = sanitize_json(item, puuid)
        return cleaned

    if isinstance(value, list):
        return [sanitize_json(item, puuid) for item in value]

    if isinstance(value, str):
        return mask_sensitive_text(value, puuid)

    return value


def build_endpoints() -> List[Endpoint]:
    """Lista de endpoints agrupados por categoría."""
    return [
        # account
        Endpoint("Account v1 by name/tag", "account", "GET", "/valorant/v1/account/{name}/{tag}", "Cuenta por nombre y tag.", False, "/valorant/v2/account/{name}/{tag}"),
        Endpoint("Account v1 by puuid", "account", "GET", "/valorant/v1/by-puuid/account/{puuid}", "Cuenta por PUUID.", False, "/valorant/v2/by-puuid/account/{puuid}", requires_puuid=True),
        Endpoint("Account v2 by name/tag", "account", "GET", "/valorant/v2/account/{name}/{tag}", "Cuenta por nombre y tag; usado para obtener PUUID."),
        Endpoint("Account v2 by puuid", "account", "GET", "/valorant/v2/by-puuid/account/{puuid}", "Cuenta por PUUID.", requires_puuid=True),

        # mmr
        Endpoint("MMR v1 by name/tag", "mmr", "GET", "/valorant/v1/mmr/{affinity}/{name}/{tag}", "MMR por nombre/tag.", False, "/valorant/v3/mmr/{affinity}/{platform}/{name}/{tag}"),
        Endpoint("MMR v1 by puuid", "mmr", "GET", "/valorant/v1/by-puuid/mmr/{affinity}/{puuid}", "MMR por PUUID.", False, "/valorant/v3/by-puuid/mmr/{affinity}/{platform}/{puuid}", requires_puuid=True),
        Endpoint("MMR v2 by name/tag", "mmr", "GET", "/valorant/v2/mmr/{affinity}/{name}/{tag}", "MMR por nombre/tag.", False, "/valorant/v3/mmr/{affinity}/{platform}/{name}/{tag}"),
        Endpoint("MMR v2 by puuid", "mmr", "GET", "/valorant/v2/by-puuid/mmr/{affinity}/{puuid}", "MMR por PUUID.", False, "/valorant/v3/by-puuid/mmr/{affinity}/{platform}/{puuid}", requires_puuid=True),
        Endpoint("MMR v3 by name/tag", "mmr", "GET", "/valorant/v3/mmr/{affinity}/{platform}/{name}/{tag}", "MMR con affinity y platform."),
        Endpoint("MMR v3 by puuid", "mmr", "GET", "/valorant/v3/by-puuid/mmr/{affinity}/{platform}/{puuid}", "MMR con PUUID, affinity y platform.", requires_puuid=True),

        # mmr-history
        Endpoint("MMR history v1 by name/tag", "mmr-history", "GET", "/valorant/v1/mmr-history/{affinity}/{name}/{tag}", "Historial MMR.", False, "/valorant/v2/mmr-history/{affinity}/{platform}/{name}/{tag}"),
        Endpoint("MMR history v1 by puuid", "mmr-history", "GET", "/valorant/v1/by-puuid/mmr-history/{affinity}/{puuid}", "Historial MMR por PUUID.", False, "/valorant/v2/by-puuid/mmr-history/{affinity}/{platform}/{puuid}", requires_puuid=True),
        Endpoint("MMR history v2 by name/tag", "mmr-history", "GET", "/valorant/v2/mmr-history/{affinity}/{platform}/{name}/{tag}", "Historial MMR con platform."),
        Endpoint("MMR history v2 by puuid", "mmr-history", "GET", "/valorant/v2/by-puuid/mmr-history/{affinity}/{platform}/{puuid}", "Historial MMR por PUUID con platform.", requires_puuid=True),

        # matches
        Endpoint("Matches v3 by name/tag", "matches", "GET", "/valorant/v3/matches/{affinity}/{name}/{tag}", "Partidas recientes.", False, "/valorant/v4/matches/{affinity}/{platform}/{name}/{tag}"),
        Endpoint("Matches v3 by puuid", "matches", "GET", "/valorant/v3/by-puuid/matches/{affinity}/{puuid}", "Partidas recientes por PUUID.", False, "/valorant/v4/by-puuid/matches/{affinity}/{platform}/{puuid}", requires_puuid=True),
        Endpoint("Matches v4 by name/tag", "matches", "GET", "/valorant/v4/matches/{affinity}/{platform}/{name}/{tag}", "Partidas recientes con platform."),
        Endpoint("Matches v4 by puuid", "matches", "GET", "/valorant/v4/by-puuid/matches/{affinity}/{platform}/{puuid}", "Partidas recientes por PUUID con platform.", requires_puuid=True),

        # match detail
        Endpoint("Match detail v2", "match detail", "GET", "/valorant/v2/match/{match_id}", "Detalle de partida.", False, "/valorant/v4/match/{affinity}/{match_id}"),
        Endpoint("Match detail v4", "match detail", "GET", "/valorant/v4/match/{affinity}/{match_id}", "Detalle de partida con affinity."),

        # leaderboard
        Endpoint("Leaderboard v1", "leaderboard", "GET", "/valorant/v1/leaderboard/{affinity}", "Clasificación competitiva.", False, "/valorant/v3/leaderboard/{affinity}/{platform}"),
        Endpoint("Leaderboard v2", "leaderboard", "GET", "/valorant/v2/leaderboard/{affinity}", "Clasificación competitiva.", False, "/valorant/v3/leaderboard/{affinity}/{platform}"),
        Endpoint("Leaderboard v3", "leaderboard", "GET", "/valorant/v3/leaderboard/{affinity}/{platform}", "Clasificación competitiva con platform."),

        # premier
        Endpoint("Premier search", "premier", "GET", "/valorant/v1/premier/search", "Búsqueda Premier.", query={"name": NAME}),
        Endpoint("Premier leaderboard", "premier", "GET", "/valorant/v1/premier/leaderboard/{affinity}", "Leaderboard Premier."),
        Endpoint("Premier by name/tag", "premier", "GET", "/valorant/v1/premier/{name}/{tag}", "Premier por nombre/tag."),
        Endpoint("Premier by id", "premier", "GET", "/valorant/v1/premier/{id}", "Premier por ID. Usa team_id como id de prueba."),
        Endpoint("Premier history by name/tag", "premier", "GET", "/valorant/v1/premier/{name}/{tag}/history", "Historial Premier por nombre/tag."),
        Endpoint("Premier history by id", "premier", "GET", "/valorant/v1/premier/{id}/history", "Historial Premier por ID. Usa team_id como id de prueba."),

        # esports/vlr
        Endpoint("Esports schedule", "esports/vlr", "GET", "/valorant/v1/esports/schedule", "Calendario esports."),
        Endpoint("VLR events", "esports/vlr", "GET", "/valorant/v2/esports/vlr/events", "Eventos VLR."),
        Endpoint("VLR event matches", "esports/vlr", "GET", "/valorant/v2/esports/vlr/events/{event_id}/matches", "Partidos de un evento VLR."),
        Endpoint("VLR match", "esports/vlr", "GET", "/valorant/v2/esports/vlr/matches/{match_id}", "Detalle de partido VLR."),
        Endpoint("VLR team", "esports/vlr", "GET", "/valorant/v2/esports/vlr/teams/{team_id}", "Equipo VLR."),
        Endpoint("VLR team matches", "esports/vlr", "GET", "/valorant/v2/esports/vlr/teams/{team_id}/matches", "Partidos de equipo VLR."),
        Endpoint("VLR team transactions", "esports/vlr", "GET", "/valorant/v2/esports/vlr/teams/{team_id}/transactions", "Transacciones de equipo VLR."),
        Endpoint("VLR player", "esports/vlr", "GET", "/valorant/v2/esports/vlr/players/{player_id}", "Jugador VLR."),
        Endpoint("VLR player matches", "esports/vlr", "GET", "/valorant/v2/esports/vlr/players/{player}/matches", "Partidos de jugador VLR."),

        # stored data
        Endpoint("Stored matches by name/tag", "stored data", "GET", "/valorant/v1/stored-matches/{affinity}/{name}/{tag}", "Partidas almacenadas."),
        Endpoint("Stored matches by puuid", "stored data", "GET", "/valorant/v1/by-puuid/stored-matches/{affinity}/{puuid}", "Partidas almacenadas por PUUID.", requires_puuid=True),
        Endpoint("Stored MMR history v1 by name/tag", "stored data", "GET", "/valorant/v1/stored-mmr-history/{affinity}/{name}/{tag}", "Historial MMR almacenado.", False, "/valorant/v2/stored-mmr-history/{affinity}/{platform}/{name}/{tag}"),
        Endpoint("Stored MMR history v1 by puuid", "stored data", "GET", "/valorant/v1/by-puuid/stored-mmr-history/{affinity}/{puuid}", "Historial MMR almacenado por PUUID.", False, "/valorant/v2/by-puuid/stored-mmr-history/{affinity}/{platform}/{puuid}", requires_puuid=True),
        Endpoint("Stored MMR history v2 by name/tag", "stored data", "GET", "/valorant/v2/stored-mmr-history/{affinity}/{platform}/{name}/{tag}", "Historial MMR almacenado con platform."),
        Endpoint("Stored MMR history v2 by puuid", "stored data", "GET", "/valorant/v2/by-puuid/stored-mmr-history/{affinity}/{platform}/{puuid}", "Historial MMR almacenado por PUUID con platform.", requires_puuid=True),

        # content
        Endpoint("Content", "content", "GET", "/valorant/v1/content", "Contenido de Valorant."),

        # store
        Endpoint("Store featured", "store", "GET", "/valorant/v1/store-featured", "Tienda destacada."),
        Endpoint("Store offers", "store", "GET", "/valorant/v1/store-offers", "Ofertas de tienda."),

        # crosshair
        Endpoint("Crosshair generate", "crosshair", "GET", "/valorant/v1/crosshair/generate", "Generador de crosshair. Se prueba sin parámetros porque no se indicó código de crosshair."),

        # status
        Endpoint("Status", "status", "GET", "/valorant/v1/status/{affinity}", "Estado de servicios."),
        Endpoint("Queue status", "status", "GET", "/valorant/v1/queue-status/{affinity}", "Estado de colas."),
        Endpoint("Version", "status", "GET", "/valorant/v1/version/{affinity}", "Versión por affinity."),

        # website
        Endpoint("Website country", "website", "GET", "/valorant/v1/website/{country_code}", "Noticias/web por país."),
        Endpoint("Website country db_id", "website", "GET", "/valorant/v1/website/{country_code}/{db_id}", "Detalle web por db_id obtenido previamente.", requires_db_id=True),

        # raw
        Endpoint(
            "Raw",
            "raw",
            "POST",
            "/valorant/v1/raw",
            "Endpoint raw; no probado automáticamente porque requiere un cuerpo específico.",
            recommended=False,
            auto_test=False,
            notes=["No se envía body ambiguo para evitar una petición insegura o inválida."],
        ),
    ]


def make_headers(api_key: str) -> Dict[str, str]:
    return {
        "Authorization": api_key,
        "accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "henrik-endpoint-structure-tester/1.0",
    }


def fill_path(template: str, puuid: Optional[str], db_id: Optional[str]) -> str:
    values = {
        "name": NAME,
        "tag": TAG,
        "affinity": AFFINITY,
        "platform": PLATFORM,
        "country_code": COUNTRY_CODE,
        "event_id": EVENT_ID,
        "match_id": MATCH_ID,
        "team_id": TEAM_ID,
        "player_id": PLAYER_ID,
        "player": PLAYER_ID,
        "id": TEAM_ID,
        "puuid": puuid or "PUUID_NOT_AVAILABLE",
        "db_id": db_id or "DB_ID_NOT_AVAILABLE",
    }
    return template.format(**values)


def classify_status(http_status: Optional[int], data: Any, error: str = "") -> Tuple[str, bool, List[str]]:
    observations: List[str] = []

    if http_status is None:
        return "error", False, observations

    if http_status == 401:
        observations.append("401 Unauthorized: revisa HENRY_API_KEY y que se envíe en Authorization.")
        return "error", False, observations
    if http_status == 404:
        observations.append("404 Not Found: endpoint inexistente, parámetros sin datos o ruta antigua.")
        return "error", False, observations
    if http_status == 429:
        observations.append("429 Rate Limit: se han aplicado esperas y reintentos automáticos.")
        return "error", False, observations

    usable = 200 <= http_status < 300
    label = "usable" if usable else "error"

    if isinstance(data, dict):
        msg = str(data.get("message", "") or data.get("error", "") or "").lower()
        if "deprecated" in msg:
            label = "deprecated"
            observations.append("La respuesta menciona deprecated/deprecado.")

    return label, usable, observations


def parse_retry_after(response: requests.Response) -> int:
    retry_after = response.headers.get("Retry-After")
    if retry_after and retry_after.isdigit():
        return max(1, int(retry_after))
    return DEFAULT_RATE_LIMIT_WAIT_SECONDS


def send_request_with_rate_limit_retry(
    session: requests.Session,
    endpoint: Endpoint,
    url: str,
    api_key: str,
) -> Tuple[requests.Response, int]:
    """
    Envía la petición y, si recibe 429, espera y reintenta.

    Devuelve:
      - response final
      - número de intentos realizados
    """
    last_response: Optional[requests.Response] = None

    for attempt in range(1, MAX_RETRIES_429 + 2):
        if endpoint.method.upper() == "GET":
            response = session.get(
                url,
                headers=make_headers(api_key),
                params=endpoint.query,
                timeout=TIMEOUT_SECONDS,
            )
        elif endpoint.method.upper() == "POST":
            response = session.post(
                url,
                headers=make_headers(api_key),
                json=endpoint.body or {},
                timeout=TIMEOUT_SECONDS,
            )
        else:
            raise ValueError(f"Método no soportado: {endpoint.method}")

        last_response = response

        if response.status_code != 429:
            return response, attempt

        if attempt > MAX_RETRIES_429:
            return response, attempt

        wait_seconds = parse_retry_after(response)
        print(
            f"429 Rate Limit recibido en {endpoint.path_template}. "
            f"Esperando {wait_seconds}s antes de reintentar "
            f"({attempt}/{MAX_RETRIES_429})..."
        )
        time.sleep(wait_seconds)

    # No debería alcanzarse, pero evita problemas de tipado.
    assert last_response is not None
    return last_response, MAX_RETRIES_429 + 1


def request_endpoint(
    session: requests.Session,
    endpoint: Endpoint,
    api_key: str,
    puuid: Optional[str],
    db_id: Optional[str],
) -> EndpointResult:
    if not endpoint.auto_test:
        path = fill_path(endpoint.path_template, puuid, db_id)
        url = f"{BASE_URL}{path}"
        return EndpointResult(
            endpoint=endpoint,
            url=mask_sensitive_text(url, puuid),
            status_label="no probado automáticamente",
            http_status=None,
            usable=False,
            observations=list(endpoint.notes),
            error="Requiere body específico; no se ejecuta automáticamente.",
            raw_result=None,
            attempts=0,
        )

    if endpoint.requires_puuid and not puuid:
        path = fill_path(endpoint.path_template, puuid, db_id)
        url = f"{BASE_URL}{path}"
        return EndpointResult(
            endpoint=endpoint,
            url=mask_sensitive_text(url, puuid),
            status_label="error",
            http_status=None,
            usable=False,
            observations=["Requiere PUUID previo obtenido desde /valorant/v2/account/{name}/{tag}."],
            error="PUUID no disponible.",
            raw_result=None,
            attempts=0,
        )

    if endpoint.requires_db_id and not db_id:
        path = fill_path(endpoint.path_template, puuid, db_id)
        url = f"{BASE_URL}{path}"
        return EndpointResult(
            endpoint=endpoint,
            url=mask_sensitive_text(url, puuid),
            status_label="error",
            http_status=None,
            usable=False,
            observations=["Requiere db_id previo obtenido desde /valorant/v1/website/es."],
            error="db_id no disponible.",
            raw_result=None,
            attempts=0,
        )

    path = fill_path(endpoint.path_template, puuid, db_id)
    url = f"{BASE_URL}{path}"
    safe_url = mask_sensitive_text(url, puuid)

    try:
        response, attempts = send_request_with_rate_limit_retry(session, endpoint, url, api_key)
        http_status = response.status_code

        try:
            data = response.json()
            safe_data = sanitize_json(data, puuid)
            structure = summarize_json_structure(safe_data)
            status_label, usable, observations = classify_status(http_status, safe_data)

            if isinstance(safe_data, list):
                observations.append("Devuelve una lista en la raíz; se resume solo el primer elemento.")
            elif isinstance(safe_data, dict):
                observations.append("Devuelve un objeto JSON en la raíz.")
                if isinstance(safe_data.get("data"), list):
                    observations.append("El campo data es una lista; se resume solo el primer elemento.")
                elif isinstance(safe_data.get("data"), dict):
                    observations.append("El campo data es un objeto.")

            if attempts > 1:
                observations.append(f"La petición necesitó {attempts} intentos por rate limit u otro reintento.")

            if endpoint.requires_puuid:
                observations.append("Requiere PUUID previo.")
            if endpoint.requires_db_id:
                observations.append("Requiere db_id previo.")
            if not endpoint.recommended and endpoint.alternative:
                observations.append("Parece endpoint antiguo frente a una versión más moderna.")

            return EndpointResult(
                endpoint=endpoint,
                url=safe_url,
                status_label=status_label,
                http_status=http_status,
                usable=usable,
                structure=structure,
                observations=observations,
                error="",
                raw_result=safe_data,
                attempts=attempts,
            )

        except ValueError:
            status_label, usable, observations = classify_status(http_status, None)
            observations.append("La respuesta no es JSON válido o no usa Content-Type JSON.")
            if attempts > 1:
                observations.append(f"La petición necesitó {attempts} intentos.")
            return EndpointResult(
                endpoint=endpoint,
                url=safe_url,
                status_label=status_label,
                http_status=http_status,
                usable=usable,
                structure=None,
                observations=observations,
                error="JSON inválido",
                raw_result=None,
                attempts=attempts,
            )

    except requests.exceptions.Timeout:
        return EndpointResult(endpoint, safe_url, "error", None, False, None, ["Timeout de conexión."], "Timeout", None, 0)
    except requests.exceptions.ConnectionError as exc:
        return EndpointResult(endpoint, safe_url, "error", None, False, None, ["Error de conexión."], str(exc), None, 0)
    except requests.exceptions.RequestException as exc:
        return EndpointResult(endpoint, safe_url, "error", None, False, None, ["Error HTTP/requests."], str(exc), None, 0)
    except ValueError as exc:
        return EndpointResult(endpoint, safe_url, "error", None, False, None, ["Error de configuración del endpoint."], str(exc), None, 0)


def extract_puuid_from_account(data: Any) -> Optional[str]:
    """Intenta extraer puuid de respuestas de account v2."""
    if not isinstance(data, dict):
        return None

    candidates = [
        data.get("puuid"),
        data.get("data", {}).get("puuid") if isinstance(data.get("data"), dict) else None,
        data.get("data", {}).get("account", {}).get("puuid")
        if isinstance(data.get("data"), dict) and isinstance(data.get("data", {}).get("account"), dict)
        else None,
    ]

    for candidate in candidates:
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()

    return None


def find_first_key_recursive(data: Any, key_names: Tuple[str, ...]) -> Optional[Any]:
    """Busca el primer valor de cualquiera de las claves indicadas en un JSON."""
    if isinstance(data, dict):
        for key, value in data.items():
            if key in key_names and value not in (None, ""):
                return value
        for value in data.values():
            found = find_first_key_recursive(value, key_names)
            if found not in (None, ""):
                return found

    elif isinstance(data, list):
        for item in data:
            found = find_first_key_recursive(item, key_names)
            if found not in (None, ""):
                return found

    return None


def get_puuid(session: requests.Session, api_key: str) -> Tuple[Optional[str], Optional[str]]:
    endpoint = Endpoint(
        name="Account v2 by name/tag",
        category="account",
        method="GET",
        path_template="/valorant/v2/account/{name}/{tag}",
    )
    url = f"{BASE_URL}/valorant/v2/account/{NAME}/{TAG}"

    try:
        response, _attempts = send_request_with_rate_limit_retry(session, endpoint, url, api_key)

        try:
            data = response.json()
        except ValueError:
            return None, f"No se pudo obtener PUUID: respuesta no JSON, HTTP {response.status_code}."

        puuid = extract_puuid_from_account(data)
        if puuid:
            return puuid, None

        return None, f"No se pudo extraer PUUID desde account v2, HTTP {response.status_code}."

    except requests.exceptions.RequestException as exc:
        return None, f"No se pudo obtener PUUID por error de conexión: {exc}"


def get_website_db_id(session: requests.Session, api_key: str) -> Tuple[Optional[str], Optional[str]]:
    endpoint = Endpoint(
        name="Website country",
        category="website",
        method="GET",
        path_template="/valorant/v1/website/{country_code}",
    )
    url = f"{BASE_URL}/valorant/v1/website/{COUNTRY_CODE}"

    try:
        response, _attempts = send_request_with_rate_limit_retry(session, endpoint, url, api_key)

        try:
            data = response.json()
        except ValueError:
            return None, f"No se pudo obtener db_id: respuesta no JSON, HTTP {response.status_code}."

        # Prioriza db_id. Solo usa id si no hay db_id.
        db_id = find_first_key_recursive(data, ("db_id",))
        if db_id is None:
            db_id = find_first_key_recursive(data, ("id",))

        if db_id is not None:
            return str(db_id), None

        return None, f"No se encontró db_id/id en website/{COUNTRY_CODE}, HTTP {response.status_code}."

    except requests.exceptions.RequestException as exc:
        return None, f"No se pudo obtener db_id por error de conexión: {exc}"


def generate_report(
    results: List[EndpointResult],
    puuid_available: bool,
    db_id_available: bool,
    warnings: List[str],
) -> str:
    lines: List[str] = []

    lines.append("# HenrikDev Valorant API - Endpoint Structure Report")
    lines.append("")
    lines.append(f"Generado: {datetime.now(timezone.utc).isoformat()}")
    lines.append(f"Base URL: `{BASE_URL}`")
    lines.append("")
    lines.append("La API key no se imprime ni se guarda en este informe.")
    lines.append("El PUUID real se enmascara como `<PUUID>` en URLs y resultados guardados.")
    lines.append("")
    lines.append(f"PUUID obtenido previamente: {'sí' if puuid_available else 'no'}")
    lines.append(f"db_id de website obtenido previamente: {'sí' if db_id_available else 'no'}")
    lines.append(
        f"Límite configurado: {REQUESTS_PER_MINUTE} requests/minuto, "
        f"con {REQUEST_SLEEP_SECONDS:.2f}s entre peticiones."
    )
    lines.append(f"Reintentos ante 429: {MAX_RETRIES_429}")
    lines.append("")

    if warnings:
        lines.append("## Avisos iniciales")
        for warning in warnings:
            lines.append(f"- {warning}")
        lines.append("")

    for result in results:
        ep = result.endpoint

        lines.append(f"## {ep.name}")
        lines.append("")
        lines.append(f"Categoría: `{ep.category}`")
        lines.append(f"Método: `{ep.method}`")
        lines.append(f"URL probada: `{result.url}`")
        lines.append(f"Estado: `{result.status_label}`")
        lines.append(f"Código HTTP: `{result.http_status if result.http_status is not None else 'N/A'}`")
        lines.append(f"Intentos realizados: `{result.attempts}`")
        lines.append(f"Descripción: {ep.description or 'Sin descripción.'}")
        lines.append("")
        lines.append("Formato devuelto:")

        if result.structure is None:
            lines.append("- No disponible.")
        else:
            flat_rows = flatten_structure(result.structure)
            if flat_rows:
                for field_path, field_type in flat_rows[:160]:
                    lines.append(f"- `{field_path}`: `{field_type}`")
                if len(flat_rows) > 160:
                    lines.append(f"- ... estructura truncada: {len(flat_rows) - 160} campos adicionales")
            else:
                lines.append("- Estructura vacía.")

        lines.append("")
        lines.append("Observaciones:")

        observations = list(dict.fromkeys(result.observations + ep.notes))
        if result.error:
            observations.append(f"Error capturado: {result.error}")
        if ep.alternative:
            observations.append(f"Alternativa recomendada: `{ep.alternative}`")
        if not observations:
            observations.append("Sin observaciones adicionales.")

        for obs in observations:
            lines.append(f"- {obs}")

        lines.append("")

    lines.append("# Tabla resumen")
    lines.append("")
    lines.append("| endpoint | método | estado HTTP | usable | categoría | endpoint recomendado | alternativa recomendada |")
    lines.append("|---|---:|---:|---:|---|---:|---|")

    for result in results:
        ep = result.endpoint
        http = result.http_status if result.http_status is not None else "N/A"
        usable = "sí" if result.usable else "no"
        recommended = "sí" if ep.recommended else "no"

        lines.append(
            "| "
            f"{markdown_escape(ep.path_template)} | "
            f"{markdown_escape(ep.method)} | "
            f"{markdown_escape(http)} | "
            f"{usable} | "
            f"{markdown_escape(ep.category)} | "
            f"{recommended} | "
            f"{markdown_escape(ep.alternative or '-')} |"
        )

    lines.append("")
    return "\n".join(lines)


def generate_results_json(
    results: List[EndpointResult],
    puuid_available: bool,
    db_id_available: bool,
    warnings: List[str],
) -> Dict[str, Any]:
    """Construye el JSON de resultados completos saneados."""
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": BASE_URL,
        "api_key_saved": False,
        "puuid_masked": True,
        "puuid_available": puuid_available,
        "db_id_available": db_id_available,
        "rate_limit": {
            "configured_requests_per_minute": REQUESTS_PER_MINUTE,
            "sleep_between_requests_seconds": REQUEST_SLEEP_SECONDS,
            "max_retries_429": MAX_RETRIES_429,
            "default_429_wait_seconds": DEFAULT_RATE_LIMIT_WAIT_SECONDS,
        },
        "warnings": warnings,
        "endpoints": [
            {
                "name": result.endpoint.name,
                "category": result.endpoint.category,
                "method": result.endpoint.method,
                "path_template": result.endpoint.path_template,
                "url_tested": result.url,
                "status_label": result.status_label,
                "http_status": result.http_status,
                "usable": result.usable,
                "recommended": result.endpoint.recommended,
                "alternative": result.endpoint.alternative or None,
                "attempts": result.attempts,
                "description": result.endpoint.description,
                "observations": result.observations,
                "error": result.error or None,
                "structure": result.structure,
                "result": result.raw_result,
            }
            for result in results
        ],
    }


def main() -> int:
    load_dotenv()

    api_key = os.getenv("HENRY_API_KEY")
    if not api_key:
        print("ERROR: No existe HENRY_API_KEY en el entorno o en .env")
        return 1

    session = requests.Session()
    warnings: List[str] = []

    print("Obteniendo PUUID desde /valorant/v2/account/{name}/{tag}...")
    puuid, puuid_error = get_puuid(session, api_key)
    if puuid_error:
        warnings.append(puuid_error)
        print(f"Aviso: {puuid_error}")
    else:
        print("PUUID obtenido correctamente. No se mostrará en consola ni en los archivos.")

    time.sleep(REQUEST_SLEEP_SECONDS)

    print(f"Obteniendo db_id desde /valorant/v1/website/{COUNTRY_CODE}...")
    db_id, db_id_error = get_website_db_id(session, api_key)
    if db_id_error:
        warnings.append(db_id_error)
        print(f"Aviso: {db_id_error}")
    else:
        print("db_id obtenido correctamente.")

    time.sleep(REQUEST_SLEEP_SECONDS)

    endpoints = build_endpoints()
    results: List[EndpointResult] = []

    print(f"Probando {len(endpoints)} endpoints una vez...")
    print(f"Rate limit configurado: pausa de {REQUEST_SLEEP_SECONDS}s entre peticiones.")

    for idx, endpoint in enumerate(endpoints, start=1):
        print(f"[{idx}/{len(endpoints)}] {endpoint.method} {endpoint.path_template}")

        result = request_endpoint(session, endpoint, api_key, puuid, db_id)
        results.append(result)

        time.sleep(REQUEST_SLEEP_SECONDS)

    report = generate_report(
        results,
        puuid_available=bool(puuid),
        db_id_available=bool(db_id),
        warnings=warnings,
    )

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(report)

    results_json = generate_results_json(
        results,
        puuid_available=bool(puuid),
        db_id_available=bool(db_id),
        warnings=warnings,
    )

    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(results_json, f, ensure_ascii=False, indent=2)

    usable_count = sum(1 for r in results if r.usable)

    print(f"Informe generado: {REPORT_FILE}")
    print(f"Resultados guardados: {RESULTS_FILE}")
    print(f"Endpoints usables: {usable_count}/{len(results)}")
    print("La API key no se ha guardado.")
    print("El PUUID se ha enmascarado como <PUUID>.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
