from pymongo import MongoClient, errors
from dotenv import load_dotenv
import os

# Cargar variables de entorno
load_dotenv()

DB_URI = os.getenv("DB_URI")
DB_NAME = os.getenv("DB_NAME")

if not DB_URI or not DB_NAME:
    raise ValueError("❌ Faltan variables de entorno: DB_URI o DB_NAME")

try:
    client = MongoClient(
        DB_URI,
        serverSelectionTimeoutMS=5000,
        tls=True
    )

    # Fuerza conexión
    client.admin.command("ping")

    db = client[DB_NAME]

    # Colecciones
    players_collection = db["players"]
    matches_collection = db["matches"]
    content_collection = db["content"]
    leaderboards_collection = db["leaderboards"]
    regions_collection = db["regions"]
    player_match_analytics_collection = db["player_match_analytics"]

    # ==========================================
    # 🔥 ÍNDICES DE ESCALABILIDAD (O(1) Lookup)
    # ==========================================
    # Garantizan búsquedas instantáneas y evitan duplicados
    def _index_exists(collection, key_spec):
        # Normalize key_spec to dict form for comparison
        if isinstance(key_spec, str):
            desired = {key_spec: 1}
        else:
            # Handle several possible formats for key_spec:
            # - a tuple like ("field", 1)
            # - an iterable of (field, order) pairs
            # - an iterable of field names (assume order 1)
            if isinstance(key_spec, tuple) and len(key_spec) == 2 and isinstance(key_spec[0], str):
                desired = {key_spec[0]: key_spec[1]}
            else:
                try:
                    # Try interpreting as iterable of (k, v)
                    desired = {k: v for k, v in key_spec}
                except Exception:
                    # Fallback: iterable of field names
                    try:
                        desired = {k: 1 for k in key_spec}
                    except Exception:
                        raise ValueError(f"Unsupported key_spec format for index check: {key_spec!r}")

        for idx in collection.list_indexes():
            existing = dict(idx['key'])
            if existing == desired:
                return True
        return False

    if not _index_exists(players_collection, "puuid"):
        players_collection.create_index("puuid", unique=True)
    if not _index_exists(matches_collection, ("matchInfo.matchId", 1)):
        matches_collection.create_index("matchInfo.matchId", unique=True)
    if not _index_exists(player_match_analytics_collection, "puuid"):
        player_match_analytics_collection.create_index("puuid")
    if not _index_exists(player_match_analytics_collection, [("puuid", 1), ("game_start_millis", -1)]):
        player_match_analytics_collection.create_index([
            ("puuid", 1),
            ("game_start_millis", -1),
        ])

    print(f"✅ Conectado a MongoDB Atlas — DB: {DB_NAME} (Índices listos)")

except errors.OperationFailure as e:
    print("❌ Error de autenticación (usuario/contraseña)")
    raise e

except errors.ServerSelectionTimeoutError as e:
    print("❌ No se pudo conectar al cluster (IP / red)")
    raise e