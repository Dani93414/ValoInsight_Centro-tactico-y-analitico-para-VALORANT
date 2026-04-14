from pymongo import MongoClient, errors
from dotenv import load_dotenv
import os

# Cargar variables de entorno
load_dotenv()

DB_URI = os.getenv("DB_URI")
DB_NAME = os.getenv("DB_NAME")

if not DB_URI or not DB_NAME:
    raise ValueError("❌ Faltan variables de entorno: DB_URI o DB_NAME")

_is_localhost = "localhost" in DB_URI or "127.0.0.1" in DB_URI

try:
    connect_kwargs: dict = {"serverSelectionTimeoutMS": 5000}
    if not _is_localhost:
        connect_kwargs["tls"] = True

    client = MongoClient(DB_URI, **connect_kwargs)

    # Fuerza conexión
    client.admin.command("ping")

    db = client[DB_NAME]

    # Colecciones
    players_collection = db["players"]
    matches_collection = db["matches"]
    content_collection = db["content"]
    leaderboards_collection = db["leaderboards"]
    regions_collection = db["regions"]

    # ==========================================
    # 🔥 ÍNDICES DE ESCALABILIDAD (O(1) Lookup)
    # ==========================================
    def _index_exists(collection, key_spec):
        if isinstance(key_spec, str):
            desired = {key_spec: 1}
        else:
            if isinstance(key_spec, tuple) and len(key_spec) == 2 and isinstance(key_spec[0], str):
                desired = {key_spec[0]: key_spec[1]}
            else:
                try:
                    desired = {k: v for k, v in key_spec}
                except Exception:
                    try:
                        desired = {k: 1 for k in key_spec}
                    except Exception:
                        raise ValueError(f"Unsupported key_spec format for index check: {key_spec!r}")

        for idx in collection.list_indexes():
            existing = dict(idx['key'])
            if existing == desired:
                return True
        return False

    # --- players ---
    if not _index_exists(players_collection, "puuid"):
        players_collection.create_index("puuid", unique=True)

    # --- matches ---
    if not _index_exists(matches_collection, ("matchInfo.matchId", 1)):
        matches_collection.create_index("matchInfo.matchId", unique=True)
    if not _index_exists(matches_collection, [("players.puuid", 1), ("matchInfo.matchId", 1), ("matchInfo.mapId", 1)]):
        matches_collection.create_index([
            ("players.puuid", 1),
            ("matchInfo.matchId", 1),
            ("matchInfo.mapId", 1),
        ])
    if not _index_exists(matches_collection, [("players.puuid", 1), ("matchInfo.gameStartMillis", -1)]):
        matches_collection.create_index([
            ("players.puuid", 1),
            ("matchInfo.gameStartMillis", -1),
        ])
    if not _index_exists(matches_collection, [("players.puuid", 1), ("matchInfo.isRanked", 1), ("matchInfo.mapId", 1), ("matchInfo.seasonId", 1)]):
        matches_collection.create_index([
            ("players.puuid", 1),
            ("matchInfo.isRanked", 1),
            ("matchInfo.mapId", 1),
            ("matchInfo.seasonId", 1),
        ])

    label = "MongoDB Local" if _is_localhost else "MongoDB Atlas"
    print(f"✅ Conectado a {label} — DB: {DB_NAME} (Índices listos)")

except errors.OperationFailure as e:
    print("❌ Error de autenticación (usuario/contraseña)")
    raise e

except errors.ServerSelectionTimeoutError as e:
    print("❌ No se pudo conectar al cluster (IP / red)")
    raise e