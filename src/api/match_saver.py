import os, sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
import time
import copy
from dotenv import load_dotenv

# Cargar generación de partidas
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from utils.match_generator import generate_match, TEST_PLAYERS, save_match_to_file

# 🔥 Importamos colecciones listas desde mongo_client
from db.mongo_client import players_collection, matches_collection

load_dotenv()

OUTPUT_DIR = os.path.abspath("data/random_matches")
os.makedirs(OUTPUT_DIR, exist_ok=True)
print("📂 Guardando JSON en:", OUTPUT_DIR)


# ============================================================
# Guardar match: JSON primero → Mongo después
# ============================================================
def save_match(match_obj, save_json=True):
    """
    Guarda la partida en un JSON limpio ANTES de que MongoDB
    le inserte un _id. Después la inserta en Mongo.
    """

    # 1️⃣ Guardar JSON limpio
    if save_json:
        path = save_match_to_file(match_obj, output_dir=OUTPUT_DIR)
        print(f"✔ Partida {match_obj['matchInfo']['matchId']} guardada como JSON en {path}")

    # 2️⃣ Guardar en MongoDB
    if matches_collection is None:
        print("❌ No hay conexión a MongoDB para guardar partidas")
        return

    try:
        match_clean_copy = copy.deepcopy(match_obj)  # evitar contaminación de _id
        matches_collection.insert_one(match_clean_copy)
        print(f"✔ Partida {match_obj['matchInfo']['matchId']} guardada en MongoDB")
    except Exception as e:
        print(f"⚠️ Error guardando partida en MongoDB: {e}")


# ============================================================
# Actualizar estadísticas de jugadores
# ============================================================
def update_player_stats(match_obj):
    if players_collection is None:
        print("❌ No hay conexión a MongoDB para actualizar jugadores")
        return

    winning_team = next((t["teamId"] for t in match_obj["teams"] if t["won"]), None)

    for p in match_obj["players"]:
        puuid = p["puuid"]
        partyId = p.get("partyId", puuid)
        s = p.get("stats", {})

        kills   = s.get("kills", 0)
        deaths  = s.get("deaths", 0)
        assists = s.get("assists", 0)
        score   = s.get("score", 0)
        playtime = s.get("playtimeMillis", 0)
        roundsPlayed = s.get("roundsPlayed", 0)

        player = players_collection.find_one({"puuid": puuid})

        # ---------------- NUEVO JUGADOR ----------------
        if not player:
            players_collection.insert_one({
                "puuid": puuid,
                "gameName": p.get("gameName"),
                "tagLine": p.get("tagLine"),
                "totalMatches": 1,
                "totalKills": kills,
                "totalDeaths": deaths,
                "totalAssists": assists,
                "totalScore": score,
                "totalPlaytimeMillis": playtime,
                "totalRoundsPlayed": roundsPlayed,
                "matches": [match_obj["matchInfo"]["matchId"]],
                "partyStats": {
                    partyId: {
                        "matchesTogether": 1,
                        "winsTogether": 1 if p["teamId"] == winning_team else 0
                    }
                }
            })
            continue

        # ---------------- JUGADOR EXISTENTE ----------------
        update = {
            "totalMatches": player["totalMatches"] + 1,
            "totalKills": player["totalKills"] + kills,
            "totalDeaths": player["totalDeaths"] + deaths,
            "totalAssists": player["totalAssists"] + assists,
            "totalScore": player["totalScore"] + score,
            "totalPlaytimeMillis": player["totalPlaytimeMillis"] + playtime,
            "totalRoundsPlayed": player["totalRoundsPlayed"] + roundsPlayed,
        }

        matches = player.get("matches", [])
        matches.append(match_obj["matchInfo"]["matchId"])
        update["matches"] = matches

        party_stats = player.get("partyStats", {})
        if partyId not in party_stats:
            party_stats[partyId] = {"matchesTogether": 0, "winsTogether": 0}

        party_stats[partyId]["matchesTogether"] += 1
        if p["teamId"] == winning_team:
            party_stats[partyId]["winsTogether"] += 1

        update["partyStats"] = party_stats

        players_collection.update_one({"puuid": puuid}, {"$set": update})


# ============================================================
# Generar N partidas
# ============================================================
def generate_and_store_matches(n=1, save_json=True):
    for i in range(n):
        match = generate_match(TEST_PLAYERS)
        save_match(match, save_json=save_json)
        update_player_stats(match)
        time.sleep(0.1)


# ============================================================
# CLI
# ============================================================
if __name__ == "__main__":
    try:
        n = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    except:
        n = 1

    generate_and_store_matches(n)
