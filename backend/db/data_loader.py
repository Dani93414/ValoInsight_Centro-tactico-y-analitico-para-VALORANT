# db/data_loader.py

import os
import certifi 
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

DB_URI = os.getenv("DB_URI")
DB_NAME = os.getenv("DB_NAME")

# Añade tlsCAFile=certifi.where() para arreglar los errores SSL
client = MongoClient(DB_URI, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000)
db = client[DB_NAME]

client = MongoClient(DB_URI)
db = client[DB_NAME]

# --- SISTEMA DE CACHÉ EN MEMORIA ---
_CACHED_CONTENT = None

def _get_content():
    global _CACHED_CONTENT
    if _CACHED_CONTENT is None:
        print("🚀 Consultando MongoDB (Caché inicial optimizada)...")
        # 🔥 PROYECCIÓN: Solo descargamos los campos que usamos.
        # Esto reduce el tamaño de descarga de MBs a unos pocos KBs, evitando el error SSL.
        proyeccion = {
            "agents.displayName": 1, 
            "agents.uuid": 1, 
            "agents.role.displayName": 1,
            
            "maps.displayName": 1, 
            "maps.uuid": 1, 
            "maps.assetPath": 1,
            
            "weapons.displayName": 1, 
            "weapons.uuid": 1, 
            "weapons.shopData.cost": 1, 
            "weapons.weaponStats.damageRanges": 1,
            
            "gear.displayName": 1,
            "gear.uuid": 1, 
            "gear.shopData.cost": 1,
            
            "playerCards.uuid": 1,
            "playerTitles.uuid": 1,
            
            "_id": 0 # No necesitamos el ID interno de Mongo
        }
        
        # Le pasamos la proyección al find_one
        _CACHED_CONTENT = db.content.find_one({"type": "valorant_content"}, proyeccion)
        
    return _CACHED_CONTENT
# -----------------------------------

# -------------------------
#  Funciones de carga
# -------------------------

def load_agents(return_roles=False):
    doc = _get_content()
    if not doc: return []

    agents_data = doc.get("agents", [])
    final_list = []

    for ag in agents_data:
        if isinstance(ag, dict) and ag.get("uuid"): # Solo si es un diccionario válido con UUID
            base = {
                "name": ag.get("displayName", "Unknown"), 
                "id": ag.get("uuid", "")
            }
            if return_roles:
                role_data = ag.get("role", {})
                base["role"] = role_data.get("displayName", "Unknown") if isinstance(role_data, dict) else "Unknown"
            final_list.append(base)

    return final_list


def load_player_cards():
    doc = _get_content()
    if not doc: return []
    
    cards = doc.get("playerCards", [])
    return [c.get("uuid") for c in cards if isinstance(c, dict) and c.get("uuid")]


def load_player_titles():
    doc = _get_content()
    if not doc: return []
    
    titles = doc.get("playerTitles", [])
    return [t.get("uuid") for t in titles if isinstance(t, dict) and t.get("uuid")]


def get_current_season_id():
    doc = db.leaderboards.find_one({"isActive": True})
    return doc.get("act_id") if isinstance(doc, dict) else None


def load_shop_weapons():
    doc = _get_content()
    if not doc: return []

    weapons_data = doc.get("weapons", [])
    armas = []
    
    for w in weapons_data:
        if isinstance(w, dict) and w.get("uuid"):
            armas.append(w)
            
    return armas


def load_shields():
    doc = _get_content()
    if not doc: return []

    # 🚀 CORRECCIÓN CLAVE: La armadura está en "gear", no en "weapons"
    gear_data = doc.get("gear", [])
    escudos = []
    
    for g in gear_data:
        if isinstance(g, dict) and g.get("uuid"):
            escudos.append(g)
            
    return escudos


def load_maps():
    doc = _get_content()
    if not doc: return []

    maps_data = doc.get("maps", [])
    final_list = []

    for m in maps_data:
        if isinstance(m, dict) and m.get("uuid"):
            final_list.append({
                "name": m.get("displayName", "Unknown"),
                "id": m.get("uuid", ""),
                "assetName": m.get("assetPath", "").split("/")[-1] if m.get("assetPath") else "",
                "assetPath": m.get("assetPath", "")
            })

    return final_list