from pymongo import MongoClient, errors
from dotenv import load_dotenv
import os

load_dotenv()

DB_URI = os.getenv("DB_URI")
DB_NAME = os.getenv("DB_NAME")

if not DB_URI or not DB_NAME:
    raise ValueError("❌ Faltan variables de entorno: asegúrate de tener DB_URI y DB_NAME en tu .env")

try:
    client = MongoClient(DB_URI, serverSelectionTimeoutMS=3000)
    client.server_info()  # fuerza conexión inmediata
    db = client[DB_NAME]

    # Colecciones
    players_collection = db["players"]
    matches_collection = db["matches"]
    content_collection = db["content"]
    leaderboards_collection = db["leaderboards"]

    print(f"✅ Conexión a MongoDB '{DB_NAME}' establecida correctamente")

except errors.ServerSelectionTimeoutError as e:
    print(f"❌ Error de conexión a MongoDB: {e}")
    client = None
    db = None

def save_match(match_data):
    """Guarda una partida en la colección 'matches' de MongoDB."""
    if matches_collection is None:
        print("❌ No hay conexión a MongoDB.")
        return

    try:
        matches_collection.insert_one(match_data)
        print(f"✅ Partida guardada correctamente en la base de datos.")
    except Exception as e:
        print(f"⚠️ Error al guardar la partida: {e}")