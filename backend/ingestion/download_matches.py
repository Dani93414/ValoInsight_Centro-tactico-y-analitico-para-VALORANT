# descargar_matches.py
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
import re
import time
from threading import Lock
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
MAX_API_ENTRIES = 2000
COMPETITIVE_QUEUE_ID = "competitive"

# Guardamos los RAW junto al script para que el pipeline pueda renombrar/convertir/borrar en un solo flujo.
OUT_DIR = Path(__file__).resolve().parent

DEFAULT_REQUESTS_PER_MINUTE = int(os.getenv("HENRIK_REQUESTS_PER_MINUTE", "30"))
DEFAULT_SAFETY_FACTOR = float(os.getenv("HENRIK_RATE_LIMIT_SAFETY_FACTOR", "1.10"))
DEFAULT_DOWNLOAD_WORKERS = int(os.getenv("HENRIK_DOWNLOAD_WORKERS", "4"))

# Reintentos
MAX_RETRIES = 12
# =======================

API_BASE = "https://api.henrikdev.xyz"


def safe_name(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", s).strip("_")


def progress_label(done: int, total: int) -> str:
    pct = (done / total * 100.0) if total else 100.0
    return f"[{pct:5.1f}%] [{done}/{total}]"


class ThreadSafeRateLimiter:
    """
    Rate limiter global para una sola API key.
    Todos los workers comparten este limitador.
    """
    def __init__(self, rpm: int, safety_factor: float = 1.10):
        if rpm <= 0:
            raise ValueError("rpm must be > 0")

        self.min_interval = (60.0 / float(rpm)) * float(safety_factor)
        self._next_time = 0.0
        self._lock = Lock()

    def wait(self):
        with self._lock:
            now = time.monotonic()

            if now < self._next_time:
                time.sleep(self._next_time - now)

            self._next_time = time.monotonic() + self.min_interval


limiter = ThreadSafeRateLimiter(DEFAULT_REQUESTS_PER_MINUTE, DEFAULT_SAFETY_FACTOR)


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "Authorization": API_KEY,
        "Accept": "application/json",
        "User-Agent": "match-downloader/parallel",
    })
    return session


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


def download_match_detail(match_id: str, riot_id_safe: str, output_index: int) -> tuple[str, bool, str | None]:
    """
    Descarga una partida concreta y la guarda como RAW JSON.
    Devuelve: (match_id, success, error)
    """
    session = build_session()

    try:
        path = f"/valorant/v4/match/{REGION}/{match_id}"
        detail = henrik_get(session, path)

        match_file = OUT_DIR / f"{riot_id_safe}_match_{output_index:03d}_{match_id}.json"
        tmp_file = match_file.with_suffix(".json.tmp")

        tmp_file.write_text(
            json.dumps(detail, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        tmp_file.replace(match_file)

        return match_id, True, None

    except Exception as exc:
        return match_id, False, str(exc)


def _extract_competitive_match_id(match_summary: dict) -> tuple[str | None, bool]:
    metadata = match_summary.get("metadata", {}) or {}
    queue = metadata.get("queue") or {}
    queue_id = (queue.get("id") or "").lower()

    if queue_id != COMPETITIVE_QUEUE_ID:
        return None, False

    match_id = (
        metadata.get("matchid")
        or metadata.get("match_id")
        or match_summary.get("matchid")
        or match_summary.get("match_id")
    )
    return (str(match_id), True) if match_id else (None, True)


def fetch_match_ids(
    session: requests.Session,
    name: str,
    tag: str,
    total: int,
    *,
    known_match_ids: set[str] | None = None,
    db_matches_collection=None,
    backfill_from_history: bool = False,
    max_api_entries: int | None = MAX_API_ENTRIES,
) -> list[str]:
    """
    Page through the API until we accumulate `total` competitive match IDs.
    The API may return non-competitive matches, so we keep paging beyond `total`
    entries until we have enough competitive ones or the API is exhausted.

    With backfill_from_history=True, the first `total` competitive matches are
    still scanned, then older pages are requested until `total` non-existing
    matches are found or the API is exhausted.
    """
    match_ids: list[str] = []
    seen = set()
    new_seen = set()
    skipped_non_competitive = 0
    start = 0
    known_match_ids = known_match_ids or set()
    announced_backfill = False

    while max_api_entries is None or start < max_api_entries:
        remaining = PAGE_SIZE if max_api_entries is None else max_api_entries - start
        size = min(PAGE_SIZE, remaining)

        path = f"/valorant/v4/matches/{REGION}/{PLATFORM}/{quote(name, safe='')}/{quote(tag, safe='')}"
        payload = henrik_get(session, path, params={"size": size, "start": start})

        data = payload.get("data", []) or []
        if not data:
            break

        page_competitive_ids: list[str] = []
        for m in data:
            match_id, is_competitive = _extract_competitive_match_id(m)
            if not is_competitive:
                skipped_non_competitive += 1
                continue

            if match_id and match_id not in seen:
                seen.add(match_id)
                match_ids.append(match_id)
                page_competitive_ids.append(match_id)
                if not backfill_from_history and len(match_ids) >= total:
                    break

        page_existing_db: set[str] = set()
        if db_matches_collection is not None and page_competitive_ids:
            page_existing_db = collect_existing_match_ids_from_db(
                db_matches_collection,
                page_competitive_ids,
            )

        for match_id in page_competitive_ids:
            if (
                match_id not in known_match_ids
                and match_id not in page_existing_db
                and match_id not in new_seen
            ):
                new_seen.add(match_id)

        if not backfill_from_history and len(match_ids) >= total:
            break

        if backfill_from_history and len(match_ids) >= total and len(new_seen) >= total:
            break

        start += len(data)

        if len(data) < size:
            break

        if (
            backfill_from_history
            and len(match_ids) >= total
            and len(new_seen) < total
            and not announced_backfill
        ):
            riot_id = f"{name}#{tag}"
            missing = total - len(new_seen)
            print(
                f"[INFO] {riot_id}: en las ultimas {total} competitivas hay "
                f"{len(new_seen)} nuevas; buscando {missing} mas en historico..."
            )
            announced_backfill = True

    if skipped_non_competitive:
        riot_id = f"{name}#{tag}"
        print(f"[INFO] {riot_id}: descartadas no-competitive: {skipped_non_competitive}")

    if backfill_from_history and len(new_seen) < total:
        riot_id = f"{name}#{tag}"
        scan_limit = "sin limite" if max_api_entries is None else str(max_api_entries)
        print(
            f"[WARN] {riot_id}: solo se encontraron {len(new_seen)} partidas nuevas "
            f"tras revisar hasta {len(match_ids)} competitivas historicas "
            f"(limite de escaneo: {scan_limit} entradas API)."
        )

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
    parser.add_argument(
        "--backfill-from-history",
        action="store_true",
        help=(
            "Primero revisa las ultimas --matches-per-player competitivas y, "
            "si algunas ya existen, sigue paginando hacia partidas mas antiguas "
            "hasta completar esa cantidad de partidas nuevas o agotar el historico."
        ),
    )
    parser.add_argument(
        "--max-history-scan",
        type=int,
        default=MAX_API_ENTRIES,
        help=(
            "Maximo de entradas del endpoint de historial a revisar por jugador "
            f"cuando se pagina (default: {MAX_API_ENTRIES})."
        ),
    )
    parser.add_argument(
        "--no-max-history-scan",
        action="store_true",
        help=(
            "Sin limite artificial de entradas historicas: pagina hasta completar "
            "las partidas nuevas pedidas o hasta que la API no devuelva mas datos."
        ),
    )
    parser.add_argument(
        "--requests-per-minute",
        type=int,
        default=DEFAULT_REQUESTS_PER_MINUTE,
        help="Limite global de requests por minuto para Henrik API.",
    )
    parser.add_argument(
        "--rate-limit-safety-factor",
        type=float,
        default=DEFAULT_SAFETY_FACTOR,
        help="Factor de seguridad aplicado al rate limit.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=DEFAULT_DOWNLOAD_WORKERS,
        help="Numero de workers para descargar detalles de partidas.",
    )
    args = parser.parse_args()

    if args.matches_per_player <= 0:
        raise SystemExit("--matches-per-player debe ser mayor que 0.")
    if args.max_history_scan <= 0 and not args.no_max_history_scan:
        raise SystemExit("--max-history-scan debe ser mayor que 0.")
    if args.requests_per_minute <= 0:
        raise SystemExit("--requests-per-minute debe ser mayor que 0.")
    if args.rate_limit_safety_factor < 1.0:
        raise SystemExit("--rate-limit-safety-factor debe ser mayor o igual que 1.0.")
    if args.workers <= 0:
        raise SystemExit("--workers debe ser mayor que 0.")

    global limiter
    limiter = ThreadSafeRateLimiter(
        args.requests_per_minute,
        args.rate_limit_safety_factor,
    )

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

    session = build_session()
    scheduled_match_ids: set[str] = set()

    try:
        for name, tag in players:
            riot_id = f"{name}#{tag}"
            riot_id_safe = safe_name(riot_id)
            print(f"\n[INFO] {riot_id} -> pidiendo {args.matches_per_player} partidas...")

            fetched_match_ids = fetch_match_ids(
                session,
                name,
                tag,
                args.matches_per_player,
                known_match_ids=existing_match_ids,
                db_matches_collection=db_matches_collection,
                backfill_from_history=args.backfill_from_history,
                max_api_entries=None if args.no_max_history_scan else args.max_history_scan,
            )
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

            known_match_ids = existing_match_ids | db_existing_match_ids | scheduled_match_ids
            new_candidate_match_ids: list[str] = []
            for mid in fetched_match_ids:
                if mid in known_match_ids:
                    continue
                new_candidate_match_ids.append(mid)
                known_match_ids.add(mid)
            match_ids = new_candidate_match_ids
            if args.backfill_from_history:
                match_ids = match_ids[:args.matches_per_player]
            scheduled_match_ids.update(match_ids)
            skipped_existing = len(fetched_match_ids) - len(new_candidate_match_ids)

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
            failed = 0

            with ThreadPoolExecutor(max_workers=args.workers) as executor:
                futures = {
                    executor.submit(download_match_detail, match_id, riot_id_safe, i): match_id
                    for i, match_id in enumerate(match_ids, start=1)
                }

                total_downloads = len(futures)
                for completed, future in enumerate(as_completed(futures), start=1):
                    match_id = futures[future]
                    progress = progress_label(completed, total_downloads)

                    try:
                        downloaded_match_id, ok, error = future.result()
                    except Exception as exc:
                        failed += 1
                        print(f"{progress} [FAILED] {match_id}: {exc}")
                        continue

                    if ok:
                        saved += 1
                        existing_match_ids.add(downloaded_match_id)
                        print(f"{progress} [OK] {downloaded_match_id}")
                    else:
                        failed += 1
                        print(f"{progress} [FAILED] {downloaded_match_id}: {error}")

            print(f"[OK] {riot_id}: guardadas {saved}, fallidas {failed} en: {OUT_DIR.resolve()}")
    finally:
        if db_client is not None:
            db_client.close()

    print("\n[DONE]")


if __name__ == "__main__":
    main()

