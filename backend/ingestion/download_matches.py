# descargar_matches.py
import argparse
import json
import os
import re
import time
from pathlib import Path
from urllib.parse import quote

import requests
from dotenv import load_dotenv

# =======================
# CONFIG
# =======================
load_dotenv()

# Accept common env var names to avoid hardcoding the key in source code.
API_KEY = (
    os.getenv("HENRY_API_KEY")
    or os.getenv("HENRIK_API_KEY")
    or os.getenv("API_KEY")
)
REGION = "eu"
PLATFORM = "pc"

DEFAULT_PLAYERS = [
    ("No Screams", "GFS"),
    ("No Baiting", "NNG"),
    ("No Smoking", "Camel"),
    ("No Enemies", "11111"),
    ("No Filling", "GFS"),
    ("No AFK", "zzz"),
    ("No Reason", "GFS"),
    ("TA JLodbrok", "8674")
]

MATCHES_PER_PLAYER = 20
PAGE_SIZE = 10  # max 10
COMPETITIVE_QUEUE_ID = "competitive"

# Guardamos los RAW junto al script para que el pipeline pueda renombrar/convertir/borrar en un solo flujo.
OUT_DIR = Path(__file__).resolve().parent

# Tu límite:
REQUESTS_PER_MINUTE = 30
SAFETY_FACTOR = 1.05  # un pelín más lento para ir seguro

# Reintentos
MAX_RETRIES = 12
# =======================

API_BASE = "https://api.henrikdev.xyz"


def safe_name(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", s).strip("_")


class RateLimiter:
    """
    Rate limit simple por intervalo mínimo entre requests.
    Para 30/min -> 2.0s por request (con factor de seguridad).
    """
    def __init__(self, rpm: int, safety_factor: float = 1.0):
        self.min_interval = (60.0 / float(rpm)) * float(safety_factor)
        self._next_time = 0.0

    def wait(self):
        now = time.monotonic()
        if now < self._next_time:
            time.sleep(self._next_time - now)
        # programa el siguiente “slot”
        self._next_time = time.monotonic() + self.min_interval


limiter = RateLimiter(REQUESTS_PER_MINUTE, SAFETY_FACTOR)


def henrik_get(session: requests.Session, path: str, params=None) -> dict:
    url = f"{API_BASE}{path}"
    last_status = None
    last_text = None

    for attempt in range(1, MAX_RETRIES + 1):
        # ✅ aquí aplicamos el rate limit ANTES de cada request
        limiter.wait()

        try:
            r = session.get(url, params=params, timeout=30)
        except (requests.Timeout, requests.ConnectionError) as e:
            # pequeño backoff si es red
            wait = min(20.0, 1.5 ** attempt)
            print(f"[NET] {e} -> espero {wait:.1f}s (try {attempt}/{MAX_RETRIES})")
            time.sleep(wait)
            continue

        last_status = r.status_code
        last_text = r.text[:500]

        # Headers útiles
        remaining = r.headers.get("x-ratelimit-remaining") or r.headers.get("X-RateLimit-Remaining")
        reset = r.headers.get("x-ratelimit-reset") or r.headers.get("X-RateLimit-Reset")

        # Si nos pasamos
        if r.status_code == 429:
            # si tenemos reset (suele ser segundos), lo respetamos
            if reset is not None:
                try:
                    wait = float(reset) + 1.0
                except ValueError:
                    wait = 5.0
            else:
                wait = 5.0

            print(f"[429] Rate limit. remaining={remaining} reset={reset} -> espero {wait:.1f}s (try {attempt}/{MAX_RETRIES})")
            time.sleep(wait)
            continue

        # Server errors
        if 500 <= r.status_code <= 599:
            wait = min(20.0, 1.5 ** attempt)
            print(f"[5xx] HTTP {r.status_code} remaining={remaining} reset={reset} -> espero {wait:.1f}s (try {attempt}/{MAX_RETRIES})")
            time.sleep(wait)
            continue

        # Parse JSON
        try:
            payload = r.json()
        except Exception:
            r.raise_for_status()
            raise RuntimeError(f"Respuesta no-JSON en {url}: {r.text[:200]}")

        ok = (r.status_code == 200) and (payload.get("status") in (200, "200"))
        if not ok:
            raise RuntimeError(
                f"Error HTTP {r.status_code} en {url} params={params}:\n"
                f"{json.dumps(payload, ensure_ascii=False, indent=2)[:1500]}"
            )

        # ✅ Si el server dice remaining=0, nos adelantamos y dormimos hasta reset
        if remaining == "0" and reset is not None:
            try:
                wait = float(reset) + 1.0
                print(f"[INFO] remaining=0 -> espero {wait:.1f}s para reset")
                time.sleep(wait)
            except ValueError:
                pass

        return payload

    raise RuntimeError(
        f"Demasiados reintentos en {url}.\n"
        f"Último status: {last_status}\n"
        f"Última respuesta (recorte): {last_text}"
    )


def fetch_match_ids(session: requests.Session, name: str, tag: str, total: int) -> list[str]:
    """
    Page through the API until we accumulate `total` competitive match IDs.
    The API may return non-competitive matches, so we keep paging beyond `total`
    entries until we have enough competitive ones or the API is exhausted.
    """
    match_ids: list[str] = []
    seen = set()
    skipped_non_competitive = 0
    start = 0
    # Safety cap: never request more than 2000 pages to avoid infinite loops
    MAX_API_ENTRIES = 2000

    while len(match_ids) < total and start < MAX_API_ENTRIES:
        size = min(PAGE_SIZE, MAX_API_ENTRIES - start)

        path = f"/valorant/v4/matches/{REGION}/{PLATFORM}/{quote(name, safe='')}/{quote(tag, safe='')}"
        payload = henrik_get(session, path, params={"size": size, "start": start})

        data = payload.get("data", []) or []
        if not data:
            break

        for m in data:
            metadata = m.get("metadata", {}) or {}
            queue = metadata.get("queue") or {}
            queue_id = (queue.get("id") or "").lower()

            if queue_id != COMPETITIVE_QUEUE_ID:
                skipped_non_competitive += 1
                continue

            match_id = (
                metadata.get("matchid")
                or metadata.get("match_id")
                or m.get("matchid")
                or m.get("match_id")
            )
            if match_id and match_id not in seen:
                seen.add(match_id)
                match_ids.append(match_id)
                if len(match_ids) >= total:
                    break

        if len(match_ids) >= total:
            break

        start += len(data)

        if len(data) < size:
            break

    if skipped_non_competitive:
        riot_id = f"{name}#{tag}"
        print(f"[INFO] {riot_id}: descartadas no-competitive: {skipped_non_competitive}")

    return match_ids


def extract_match_id_from_payload(payload: dict) -> str | None:
    metadata = ((payload.get("data") or {}).get("metadata") or {})
    return metadata.get("match_id") or metadata.get("matchid")


def collect_existing_match_ids(directory: Path) -> set[str]:
    existing: set[str] = set()

    for path in directory.glob("*_match_*.json"):
        # Ignora archivos resumen (si alguna vez matchean por nombre).
        if "_match_ids_" in path.name:
            continue

        match_id = None

        # 1) Intento principal: leer el match_id del contenido JSON.
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            match_id = extract_match_id_from_payload(payload)
        except Exception:
            match_id = None

        # 2) Fallback: extraer del nombre (..._{match_id}.json).
        if not match_id:
            tail = path.stem.rsplit("_", 1)
            if len(tail) == 2 and tail[1]:
                match_id = tail[1]

        if match_id:
            existing.add(match_id)

    return existing


def init_db_matches_collection():
    db_uri = os.getenv("DB_URI")
    db_name = os.getenv("DB_NAME")

    if not db_uri or not db_name:
        raise SystemExit(
            "Faltan DB_URI o DB_NAME para usar --check-db-existing. "
            "Define ambas variables en .env."
        )

    try:
        from pymongo import MongoClient
    except Exception as exc:
        raise SystemExit(
            "No se pudo importar pymongo para usar --check-db-existing. "
            "Instala dependencias del backend (pip install -r backend/requirements.txt)."
        ) from exc

    connect_kwargs: dict = {"serverSelectionTimeoutMS": 5000}
    if "localhost" not in db_uri and "127.0.0.1" not in db_uri:
        connect_kwargs["tls"] = True

    client = MongoClient(db_uri, **connect_kwargs)
    client.admin.command("ping")
    collection = client[db_name]["matches"]
    return client, collection


def collect_existing_match_ids_from_db(matches_collection, candidate_match_ids: list[str]) -> set[str]:
    clean_ids = [mid for mid in candidate_match_ids if mid]
    if not clean_ids:
        return set()

    existing: set[str] = set()
    cursor = matches_collection.find(
        {"matchInfo.matchId": {"$in": clean_ids}},
        {"_id": 0, "matchInfo.matchId": 1},
    )

    for doc in cursor:
        match_info = doc.get("matchInfo") or {}
        match_id = str(match_info.get("matchId") or "").strip()
        if match_id:
            existing.add(match_id)

    return existing


def parse_players_arg(players_arg: list[str] | None) -> list[tuple[str, str]]:
    if not players_arg:
        return DEFAULT_PLAYERS

    parsed: list[tuple[str, str]] = []
    for riot_id in players_arg:
        if "#" not in riot_id:
            raise SystemExit(
                f"Formato de jugador invalido: '{riot_id}'. Usa GameName#TagLine."
            )

        name, tag = riot_id.split("#", 1)
        name = name.strip()
        tag = tag.strip()

        if not name or not tag:
            raise SystemExit(
                f"Formato de jugador invalido: '{riot_id}'. Usa GameName#TagLine."
            )

        parsed.append((name, tag))

    return parsed


def main():
    parser = argparse.ArgumentParser(
        description="Descarga partidas competitivas desde Henrik API para una lista de jugadores."
    )
    parser.add_argument(
        "--players",
        nargs="+",
        help=(
            "Lista de jugadores en formato GameName#TagLine. "
            "Si no se pasa, usa la lista por defecto del script."
        ),
    )
    parser.add_argument(
        "--matches-per-player",
        type=int,
        default=MATCHES_PER_PLAYER,
        help=f"Cantidad de partidas por jugador (default: {MATCHES_PER_PLAYER}).",
    )
    parser.add_argument(
        "--check-db-existing",
        action="store_true",
        help=(
            "Consulta MongoDB (DB_URI/DB_NAME) y evita descargar partidas cuyo "
            "matchInfo.matchId ya exista en la coleccion matches."
        ),
    )
    args = parser.parse_args()

    if args.matches_per_player <= 0:
        raise SystemExit("--matches-per-player debe ser mayor que 0.")

    players = parse_players_arg(args.players)

    if not API_KEY or "PON_AQUI" in API_KEY:
        raise SystemExit(
            "Falta API key. Define HENRY_API_KEY (o HENRIK_API_KEY/API_KEY) en el archivo .env."
        )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    existing_match_ids = collect_existing_match_ids(OUT_DIR)
    print(f"[INFO] Match IDs ya guardados: {len(existing_match_ids)}")

    db_client = None
    db_matches_collection = None
    if args.check_db_existing:
        try:
            db_client, db_matches_collection = init_db_matches_collection()
            print("[INFO] Validacion previa contra MongoDB activada.")
        except Exception as exc:
            raise SystemExit(f"No se pudo conectar a MongoDB para --check-db-existing: {exc}")

    session = requests.Session()
    session.headers.update({
        "Authorization": API_KEY,
        "Accept": "application/json",
        "User-Agent": "match-downloader/onefile"
    })

    try:
        for name, tag in players:
            riot_id = f"{name}#{tag}"
            riot_id_safe = safe_name(riot_id)
            print(f"\n[INFO] {riot_id} -> pidiendo {args.matches_per_player} partidas...")

            fetched_match_ids = fetch_match_ids(session, name, tag, args.matches_per_player)
            if not fetched_match_ids:
                print(f"[WARN] Sin partidas para {riot_id} (privado/sin datos/región mal).")
                continue

            db_existing_match_ids: set[str] = set()
            if db_matches_collection is not None:
                db_existing_match_ids = collect_existing_match_ids_from_db(
                    db_matches_collection,
                    fetched_match_ids,
                )

            skipped_local = sum(1 for mid in fetched_match_ids if mid in existing_match_ids)
            skipped_db = sum(
                1
                for mid in fetched_match_ids
                if mid in db_existing_match_ids and mid not in existing_match_ids
            )

            known_match_ids = existing_match_ids | db_existing_match_ids
            match_ids = [mid for mid in fetched_match_ids if mid not in known_match_ids]
            skipped_existing = len(fetched_match_ids) - len(match_ids)

            if db_matches_collection is not None:
                print(
                    f"[INFO] {riot_id}: recibidas {len(fetched_match_ids)}, "
                    f"saltadas locales {skipped_local}, saltadas DB {skipped_db}, "
                    f"nuevas {len(match_ids)}"
                )
            else:
                print(
                    f"[INFO] {riot_id}: recibidas {len(fetched_match_ids)}, "
                    f"saltadas por existentes {skipped_existing}, nuevas {len(match_ids)}"
                )

            if not match_ids:
                print(f"[OK] {riot_id}: no hay partidas nuevas que guardar.")
                continue

            list_file = OUT_DIR / f"{riot_id_safe}_match_ids_{REGION}_{PLATFORM}_{len(fetched_match_ids)}.json"
            list_file.write_text(json.dumps({
                "player": riot_id,
                "region": REGION,
                "platform": PLATFORM,
                "requested": args.matches_per_player,
                "received": len(fetched_match_ids),
                "new_to_download": len(match_ids),
                "already_present": skipped_existing,
                "already_present_local": skipped_local,
                "already_present_db": skipped_db,
                "match_ids": fetched_match_ids
            }, ensure_ascii=False, indent=2), encoding="utf-8")

            saved = 0
            for i, match_id in enumerate(match_ids, start=1):
                print(f"[{riot_id}] {i}/{len(match_ids)} -> {match_id}")
                path = f"/valorant/v4/match/{REGION}/{match_id}"
                detail = henrik_get(session, path)

                match_file = OUT_DIR / f"{riot_id_safe}_match_{i:03d}_{match_id}.json"
                match_file.write_text(json.dumps(detail, ensure_ascii=False, indent=2), encoding="utf-8")
                saved += 1
                existing_match_ids.add(match_id)

            print(f"[OK] {riot_id}: guardadas {saved} partidas en: {OUT_DIR.resolve()}")
    finally:
        if db_client is not None:
            db_client.close()

    print("\n[DONE]")


if __name__ == "__main__":
    main()