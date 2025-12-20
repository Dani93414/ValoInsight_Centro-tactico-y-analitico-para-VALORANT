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

    print(f"✅ Conectado a MongoDB Atlas — DB: {DB_NAME}")

except errors.OperationFailure as e:
    print("❌ Error de autenticación (usuario/contraseña)")
    raise e

except errors.ServerSelectionTimeoutError as e:
    print("❌ No se pudo conectar al cluster (IP / red)")
    raise e
