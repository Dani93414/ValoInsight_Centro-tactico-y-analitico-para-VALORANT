# match_saver.py

import os, sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
import time
import json
from datetime import datetime, UTC

# Importamos tu generador
from src.match_generator.orchestrator import generate_match
from src.match_generator.matchmaking import TEST_PLAYERS

# 🔥 IMPORTAMOS EL NUEVO MOTOR CENTRAL
from src.services.match_processor import process_single_match, recalculate_global_stats

OUTPUT_DIR = os.path.abspath("data/random_matches")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def save_match_to_file(match_obj, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    ts = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    fname = f"match_{ts}_{match_obj['matchInfo']['matchId']}.json"
    path = os.path.join(output_dir, fname)
    with open(path, "w", encoding="utf8") as f:
        json.dump(match_obj, f, ensure_ascii=False, indent=2)
    return path

def generate_and_store_matches(n=1, save_json=True):
    for i in range(n):
        # 1. Creamos la partida falsa
        match = generate_match(TEST_PLAYERS)
        
        # 2. Guardamos en local si queremos
        if save_json:
            save_match_to_file(match, OUTPUT_DIR)
            
        # 3. 🔥 SE LA PASAMOS AL MOTOR CENTRAL
        process_single_match(match)
        time.sleep(0.1)
    
    # 4. Al terminar todas las partidas simuladas, actualizamos el mundo
    print("🌍 Partidas generadas. Recalculando mundo...")
    recalculate_global_stats()

if __name__ == "__main__":
    try:
        n = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    except:
        n = 1

    generate_and_store_matches(n)