#data_loader.py

import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# -------------------------
#  Conexión global a Mongo
# -------------------------
DB_URI = os.getenv("DB_URI")
DB_NAME = os.getenv("DB_NAME")

client = MongoClient(DB_URI)
db = client[DB_NAME]

# -------------------------
#  Funciones de carga
# -------------------------

def load_agents(return_roles=False):
    """Carga agentes desde content.valorant_content."""
    content_doc = db.content.find_one({"type": "valorant_content"})
    if not content_doc:
        print("⚠️ No existe valorant_content en la BD.")
        return []

    agents_by_role = content_doc.get("agents", {})
    final_list = []

    for role, agent_list in agents_by_role.items():
        for ag in agent_list:
            base = {"name": ag["name"], "id": ag["id"]}
            if return_roles:
                base["role"] = ag.get("role", role)
            final_list.append(base)

    return final_list


def load_player_cards():
    """IDs de playerCards"""
    content = db.content.find_one({"type": "valorant_content"})
    if not content:
        print("⚠️ No existe valorant_content en la BD.")
        return []

    cards = content.get("raw", {}).get("playerCards", [])
    return [c["id"] for c in cards if "id" in c]


def load_player_titles():
    """IDs de playerTitles"""
    content = db.content.find_one({"type": "valorant_content"})
    if not content:
        print("⚠️ No existe valorant_content en la BD.")
        return []

    titles = content.get("raw", {}).get("playerTitles", [])
    return [t["id"] for t in titles if "id" in t]


def get_current_season_id():
    """Devuelve la season activa desde leaderboards."""
    doc = db.leaderboards.find_one({"isActive": True})
    return doc.get("act_id") if doc else None

def load_shop_weapons():
    """
    Devuelve la lista completa de armas de tienda (20 total).
    """
    doc = db.content.find_one({"type": "valorant_content"})
    if not doc:
        raise ValueError("❌ No existe valorant_content en la BD.")

    weapons = doc.get("weapons", {})
    tienda = weapons.get("tienda", {})
    return tienda.get("todas", [])


def load_shields():
    """
    Devuelve los 3 escudos del contenido.
    """
    doc = db.content.find_one({"type": "valorant_content"})
    if not doc:
        raise ValueError("❌ No existe valorant_content en la BD.")

    weapons = doc.get("weapons", {})
    return weapons.get("escudos", [])


def load_maps():
    """
    Devuelve los mapas del modo core (map pool principal).
    """
    doc = db.content.find_one({"type": "valorant_content"})
    if not doc:
        raise ValueError("❌ No existe valorant_content en la BD.")

    maps = doc.get("maps", {})
    core = maps.get("core", [])

    # Devuelve solo name, id, assetName, assetPath (tal como están en la BD)
    final_list = []
    for m in core:
        final_list.append({
            "name": m.get("name"),
            "id": m.get("id"),
            "assetName": m.get("assetName"),
            "assetPath": m.get("assetPath")
        })

    return final_list
