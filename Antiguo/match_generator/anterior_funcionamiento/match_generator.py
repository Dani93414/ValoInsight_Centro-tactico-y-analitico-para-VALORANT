# match_generator.py

import json
import uuid
import random
import time
import os
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

# ---- IMPORTS DE TUS MÓDULOS ----
from utils.helpers import (
    uid,
    now_ms,
    clamp,
)

from db.data_loader import (
    load_agents,
    load_player_cards,
    load_player_titles,
    get_current_season_id,
    load_maps
)

from src.match_generator.anterior_funcionamiento.combat.combat_simulator import simulate_realistic_combat
from src.match_generator.anterior_funcionamiento.combat.damage_system import compute_combat_score

from src.match_generator.anterior_funcionamiento.economy.economy_manager import (
    pick_initial_weapon,
    pick_shield
)

# Para generate_round, si moviste estrategia:
#from utils.strategy.round_strategy import (
#    decide_winning_team,
#    decide_round_result,
#    pick_planter,
#    pick_defuser
#)

# API externa
from api.riot_client import get_valorant_content

load_dotenv()

random.seed()  # si quieres reproducibilidad, usa random.seed(n)

RANK_MIN = 5
RANK_MAX = 27
RANK_SPREAD = 2 

base_rank = random.randint(RANK_MIN, RANK_MAX)
low_rank  = max(RANK_MIN, base_rank - RANK_SPREAD)
high_rank = min(RANK_MAX, base_rank + RANK_SPREAD)

# -----------------------------
# Recursos
# -----------------------------

MAPS = load_maps()
AGENTS = load_agents(return_roles = False)
PLAYER_CARDS = load_player_cards()
PLAYER_TITLES = load_player_titles()

# Test players fallback (30)
TEST_PLAYERS = [
    {"puuid": f"test-puuid-{i}", "gameName": f"Player{i}", "tagLine": "EU"} for i in range(1, 31)
]

# -----------------------------
# Estructuras útiles
# -----------------------------
def empty_player_stats():
    return {
        "score": 0,
        "roundsPlayed": 0,
        "kills": 0,
        "deaths": 0,
        "assists": 0,
        "playtimeMillis": 0,
        "abilityCasts": {
            "grenadeCasts": 0,
            "ability1Casts": 0,
            "ability2Casts": 0,
            "ultimateCasts": 0
        }
    }


# -----------------------------
# -----------------------------
# Generador de una ronda (competitiva)
# -----------------------------
# Añadimos ultimate_points como parámetro
def generate_round(player_objs, round_num, attacking_team, map_name, prev_economies, ultimate_points):
    base = 0.49
    win_prob_attacker = base + 0.06
    if random.random() < (win_prob_attacker if attacking_team else base):
        winning_team = attacking_team
    else:
        winning_team = "Red" if attacking_team == "Blue" else "Blue"

    round_result_str = "Eliminations"
    was_plant = False

    if winning_team == attacking_team:
        was_plant = random.random() < 0.60
    else:
        was_plant = random.random() < 0.30

    round_entry = {
        "roundNum": round_num,
        "roundResult": round_result_str,
        "roundCeremony": "RoundCeremonyDefault",
        "winningTeam": winning_team,
        "bombPlanter": "",
        "bombDefuser": "",
        "plantRoundTime": 0,
        "plantPlayerLocations": [],
        "plantLocation": None,
        "plantSite": "",
        "defuseRoundTime": 0,
        "defusePlayerLocations": [],
        "defuseLocation": None,
        "playerStats": [],
        "roundResultCode": "Generic"
    }

    if was_plant:
        attackers = [p for p in player_objs if p["teamId"] == attacking_team]
        planter = random.choice(attackers)
        round_entry["bombPlanter"] = planter["puuid"]
        round_entry["plantSite"] = random.choice(["A", "B", "C"])
        round_entry["plantRoundTime"] = random.randint(15000, 80000)
        round_entry["plantLocation"] = {"x": random.randint(-1000, 1000), "y": random.randint(-1000, 1000)}

    # --- NUEVO: FASE DE COMPRA ANTES DEL COMBATE ---
    round_economies = {}
    initial_hp_dict = {}
    player_weapons = {} # Guardaremos el nombre del arma comprada para pasarlo al simulador
    used_ultimates_round = {} # Rastrear quién usó ulti esta ronda

    for p in player_objs:
        puuid = p["puuid"]
        prev = prev_economies.get(puuid, {})
        start_credits = prev.get("remaining", 800)

        # Decisión de gasto
        if start_credits >= 3900: spent = random.randint(2900, start_credits)
        elif start_credits >= 1500: spent = random.randint(1000, start_credits)
        else: spent = random.randint(0, start_credits)

        # Presupuesto de escudo
        if spent >= 3900: armor_budget = 1000
        elif spent >= 2500: armor_budget = 650
        elif spent >= 1500: armor_budget = 400
        else: armor_budget = 0
            
        weapon_budget = spent - armor_budget

        # Comprar items
        weapon_info = pick_initial_weapon(weapon_budget)
        leftover_for_armor = spent - weapon_info["price"]
        armor_info = pick_shield(leftover_for_armor)

        real_spent = weapon_info["price"] + armor_info["price"]
        end_buy_phase_credits = start_credits - real_spent

        # Lógica de Ultimate: Usarla si la tiene cargada (coste estándar 8)
        used_ultimate = False
        if ultimate_points.get(puuid, 0) >= 8:
            if random.random() < 0.40: # 40% de usarla esta ronda
                used_ultimate = True
                ultimate_points[puuid] = 0 # Consume puntos
        used_ultimates_round[puuid] = used_ultimate

        # Guardar economía de la ronda
        round_economies[puuid] = {
            "loadoutValue": real_spent,
            "weapon": weapon_info["weapon_id"],
            "armor": armor_info["armor_id"],
            "remaining": end_buy_phase_credits,
            "spent": real_spent
        }

        # Guardar arma para el simulador
        player_weapons[puuid] = weapon_info["weapon"]

        # Calcular HP real (100 base + Escudo)
        hp = 100
        if armor_info["price"] >= 650:
            hp = 150 # Pesado o Regen
        elif armor_info["price"] >= 400:
            hp = 125 # Ligero
        initial_hp_dict[puuid] = hp
    # -----------------------------------------------

    # Llamada al simulador pasándole las armas reales (NUEVO ARGUMENTO)
    kills_feed, damage_log, remaining_health = simulate_realistic_combat(
        player_objs,
        winning_team,
        initial_hp_dict,
        player_weapons 
    )

    per_player_kills = {p["puuid"]: 0 for p in player_objs}
    per_player_deaths = {p["puuid"]: 0 for p in player_objs}
    per_player_assists = {p["puuid"]: 0 for p in player_objs}

    for k in kills_feed:
        per_player_kills[k["killer"]] += 1
        per_player_deaths[k["victim"]] += 1
        for a in k["assistants"]:
            per_player_assists[a] += 1

    # Reconstrucción de estadísticas finales
    for p in player_objs:
        puuid = p["puuid"]
        kills = per_player_kills.get(puuid, 0)
        deaths = per_player_deaths.get(puuid, 0)
        assists = per_player_assists.get(puuid, 0)

        damage_total = kills * random.randint(80, 220) + random.randint(0, 120)

        pr_kills = [k for k in kills_feed if k["killer"] == puuid]

        damage_entry = [{
            "receiver": random.choice([x["puuid"] for x in player_objs if x["puuid"] != puuid]),
            "damage": damage_total,
            "legshots": random.randint(0, max(0, int(damage_total // 40))),
            "bodyshots": max(0, int(damage_total/50)),
            "headshots": random.randint(0, min(3, kills))
        }]
        
        did_damage_assist = (assists > 0)
        # Calculamos el ACS oficial pasando la lista de todos los kills de la ronda
        score_value = compute_combat_score(
            player_kills = pr_kills,
            damage_events = damage_entry,
            did_damage_assist = did_damage_assist,
            all_round_kills = kills_feed # <--- Pasamos todas las muertes de la ronda
        )

        prs = {
            "puuid": puuid,
            "kills": pr_kills,
            "damage": damage_entry,
            "score": score_value,
            "economy": round_economies[puuid], # Usamos la que ya calculamos
            "ability": {
                "grenadeEffects": "",
                "ability1Effects": "",
                "ability2Effects": "",
                "ultimateEffects": ""
            },
            "used_ultimate": used_ultimates_round[puuid] # Marcador interno para sumar estadística luego
        }
        round_entry["playerStats"].append(prs)

    # Bomb defuse logic
    if was_plant and winning_team != attacking_team:
        round_entry["roundResult"] = "BombDefused"
        defenders = [p for p in player_objs if p["teamId"] != attacking_team]
        defuser = random.choice(defenders)
        round_entry["bombDefuser"] = defuser["puuid"]
        
        plant_time = round_entry["plantRoundTime"]
        round_entry["defuseRoundTime"] = plant_time + random.randint(7500, 44000)
        
        plant_loc = round_entry["plantLocation"]
        round_entry["defuseLocation"] = {
            "x": plant_loc["x"] + random.randint(-50, 50),
            "y": plant_loc["y"] + random.randint(-50, 50)
        }
    elif was_plant and winning_team == attacking_team:
        round_entry["roundResult"] = "BombExecution"

    return round_entry

# -----------------------------
# Generador de parties
# -----------------------------
def generate_parties(players):
    """
    Recibe la lista de 10 jugadores (dicts) y asigna partyId coherentes.
    Devuelve una lista de parties: lista de listas de jugadores.
    """

    # Probabilidades de configuración
    p_mix = 0.65        # soloQ, duoQ y trioQ mezclados
    p_big = 0.25        # puede haber parties de 3
    p_fullstack = 0.10  # 5-stack obligatorio en ambos equipos

    roll = random.random()

    parties = []

    # --- Caso FULL 5-stack ---
    if roll < p_fullstack:
        # Dos parties de 5
        random.shuffle(players)
        party1 = players[:5]
        party2 = players[5:]

        pid1 = uid()
        pid2 = uid()
        for p in party1: p["partyId"] = pid1
        for p in party2: p["partyId"] = pid2

        return [party1, party2]

    # --- Caso parties grandes (trios) ---
    if roll < p_mix + p_big:
        sizes = []
        # Siempre meter un trio
        sizes.append(3)
        # Restantes hasta 10 rellenados con 1,1,2,3 posibles
        remaining = 7
        while remaining > 0:
            s = random.choice([1,2,3])
            if s <= remaining:
                sizes.append(s)
                remaining -= s

    # --- Caso MIX normal ---
    else:
        sizes = []
        remaining = 10
        while remaining > 0:
            s = random.choice([1,2,3])
            if s <= remaining:
                sizes.append(s)
                remaining -= s

    # Ahora asignamos las parties según los tamaños generados
    random.shuffle(players)
    idx = 0
    parties = []
    for s in sizes:
        group = players[idx:idx+s]
        idx += s
        pid = uid()
        for p in group:
            p["partyId"] = pid
        parties.append(group)

    return parties

# -----------------------------
# Asignar equipos sin romper parties
# -----------------------------
def assign_teams_from_parties(parties):
    """
    Devuelve dos listas: team_red, team_blue
    Cada party debe asignarse completa a un equipo.
    """
    team_red = []
    team_blue = []

    # Orden aleatorio
    random.shuffle(parties)

    for party in parties:
        if len(team_red) + len(party) <= 5:
            team_red.extend(party)
        else:
            team_blue.extend(party)

    return team_red, team_blue

# -----------------------------
# Generador de match completo (Competitivo-like, non-ranked)
# -----------------------------
def generate_match(test_players=TEST_PLAYERS, map_name=None, seed=None):
    """
    Genera un MatchDto "competitivo" (no ranked) con:
    - 10 players (5 Red, 5 Blue)
    - primer equipo atacante elegido al azar, lados cambian a la mitad (rondas > 12)
    - rounds hasta que un equipo llegue a 13 (máx 24)
    """
    if seed is not None:
        random.seed(seed)

    selected = random.sample(test_players, 10)

    # Primero creamos los jugadores sin teamId todavía
    players = []
    agents_red = AGENTS.copy()
    agents_blue = AGENTS.copy()

    for tp in selected:
        p = {
            "puuid": tp["puuid"],
            "gameName": tp["gameName"],
            "tagLine": tp.get("tagLine", "EU"),
            "partyId": None,  # se asignará luego
            "characterId": None,  # también luego
            "stats": empty_player_stats(),
            "_roundScores": [],
            "competitiveTier": random.randint(low_rank, high_rank),
            "playerCard": random.choice(PLAYER_CARDS) if PLAYER_CARDS else uid(),
            "playerTitle": random.choice(PLAYER_TITLES) if PLAYER_TITLES else uid(),
        }
        # seed small ability cast counts
        p["stats"]["abilityCasts"] = {
            "grenadeCasts": random.randint(1, 6),
            "ability1Casts": random.randint(1, 6),
            "ability2Casts": random.randint(1, 6),
            "ultimateCasts": 0 # Las ultis empiezan en 0
        }
        players.append(p)

    # --- Generar parties ---
    parties = generate_parties(players)

    # --- Asignar equipos respetando las parties ---
    team_red, team_blue = assign_teams_from_parties(parties)

    # Asignar agentes a cada equipo sin repetir
    for p in team_red:
        agent = random.choice(agents_red)
        agents_red.remove(agent)
        p["characterId"] = agent["id"]
        p["teamId"] = "Red"

    for p in team_blue:
        agent = random.choice(agents_blue)
        agents_blue.remove(agent)
        p["characterId"] = agent["id"]
        p["teamId"] = "Blue"

        match_id = uid()
        # Seleccionar mapa por ID (si map_name viene como string nombre, lo buscamos)
        if map_name:
            # soporta búsqueda por nombre si se lo pasas manualmente
            chosen_map = next((m for m in MAPS if m["name"].lower() == map_name.lower()), None)
        else:
            chosen_map = random.choice(MAPS)

        # Fallback en caso de que el nombre no exista en la BD
        if not chosen_map:
            chosen_map = random.choice(MAPS)

        match_start = now_ms() - random.randint(300000, 7200000)
        is_ranked = True
        season_id = get_current_season_id() or uid()

        match_info = {
            "matchId": match_id,
            "mapId": chosen_map["id"],
            "gameLengthMillis": 0,
            "gameStartMillis": match_start,
            "provisioningFlowId": "Matchmaking",
            "isCompleted": True,
            "customGameName": "",
            "queueId": "competitive",
            "gameMode": "Bomb",
            "isRanked": is_ranked,
            "seasonId": season_id
        }

    # teams summary
    teams = [
        {"teamId":"Red", "won": False, "roundsPlayed": 0, "roundsWon": 0, "numPoints": 0},
        {"teamId":"Blue","won": False, "roundsPlayed": 0, "roundsWon": 0, "numPoints": 0}
    ]

    round_results = []
    
    # --- INICIALIZACIÓN DE ECONOMÍA Y RACHAS OFICIAL ---
    prev_economies = {p["puuid"]: {"remaining": 800, "spent": 0} for p in players}
    loss_streaks = {"Red": 0, "Blue": 0}
    ultimate_points = {p["puuid"]: 0 for p in players} # Inicializamos el contador de puntos de ulti
    
    red_wins = 0
    blue_wins = 0

    # Probabilidades configurables
    SURRENDER_PROB = 0.05      # 5% de probabilidad de surrender por match
    FORCE_OT_PROB = 0.2        # 20% de probabilidad de que lleguen 12-12 voluntariamente

    surrender_team = None       # "Red" o "Blue" si rinden
    trigger_surrender = random.random() < SURRENDER_PROB
    force_overtime = random.random() < FORCE_OT_PROB

    # choose initial attackers randomly
    attackers_start = random.choice(["Red", "Blue"])
    for r in range(1, 25):  # 1..24
        # decide current attacking team: attackers_start for rounds 1..12, then swapped for >=13
        attacking_team = attackers_start if r <= 12 else ("Red" if attackers_start == "Blue" else "Blue")
        
        # Reseteo de Ronda 13 (Cambio de lado) a 800 créditos y puntos de ulti a 0
        if r == 13:
            for p in players:
                prev_economies[p["puuid"]]["remaining"] = 800
                ultimate_points[p["puuid"]] = 0 
            loss_streaks = {"Red": 0, "Blue": 0}

        # Pasamos ultimate_points a generate_round
        rnd = generate_round(players, r, attacking_team, map_name, prev_economies, ultimate_points)

        # update winner counts from rnd
        if rnd["winningTeam"] == "Red":
            red_wins += 1
            loss_streaks["Red"] = 0
            loss_streaks["Blue"] += 1
        else:
            blue_wins += 1
            loss_streaks["Blue"] = 0
            loss_streaks["Red"] += 1

        # --- SURRENDER LOGIC ---
        # Se puede rendir a partir de ronda 6
        if trigger_surrender and surrender_team is None and r >= 5:
            # El equipo que va perdiendo tiene alta probabilidad de rendirse
            if red_wins - blue_wins >= 4:
                surrender_team = "Blue"
            elif blue_wins - red_wins >= 4:
                surrender_team = "Red"
            else:
                # Si están parejos, 10% de chance igualmente
                if random.random() < 0.10:
                    surrender_team = random.choice(["Red", "Blue"])

            if surrender_team:
                # Equipo contrario gana automáticamente
                if surrender_team == "Red":
                    blue_wins = 13
                else:
                    red_wins = 13

                round_results.append({
                    "roundNum": r + 1,
                    "roundResult": "Surrender",
                    "roundCeremony": "Surrender",
                    "winningTeam": "Blue" if surrender_team == "Red" else "Red",
                    "playerStats": []
                })
                break  # se termina el match

        # --- OVERTIME LOGIC ---
        if red_wins == 12 and blue_wins == 12:
            # Si ya iban a OT o la probabilidad forzó OT
            if force_overtime or random.random() < 0.50:
                # OT al mejor de 2, diferencia de 2
                # Round 25+
                ot_red = 0
                ot_blue = 0
                ot_round = r + 1

                while True:
                    # En Overtime, TODOS los jugadores se resetean a 5000 créditos
                    for p in players:
                        prev_economies[p["puuid"]]["remaining"] = 5000

                    attacking_ot = "Red" if ot_round % 2 == 1 else "Blue"
                    rnd_ot = generate_round(players, ot_round, attacking_ot, map_name, prev_economies, ultimate_points)
                    round_results.append(rnd_ot)

                    if rnd_ot["winningTeam"] == "Red":
                        ot_red += 1
                    else:
                        ot_blue += 1

                    ot_round += 1

                    # Condición de victoria con diferencia de 2
                    if abs(ot_red - ot_blue) >= 2:
                        if ot_red > ot_blue:
                            red_wins = 13
                        else:
                            blue_wins = 13
                        break
                break
            else:
                # Sin overtime → victoria del que llegue a 13 normalmente
                pass

        # --- CÁLCULO DE INGRESOS PARA LA SIGUIENTE RONDA Y ACTUALIZACIÓN DE ESTADÍSTICAS ---
        win_team = rnd["winningTeam"]
        lose_team = "Blue" if win_team == "Red" else "Red"
        
        # Calcular el bono por racha de derrotas
        loss_income = 1900
        if loss_streaks[lose_team] == 2:
            loss_income = 2400
        elif loss_streaks[lose_team] >= 3:
            loss_income = 2900

        was_plant = rnd["roundResult"] == "BombExecution" or rnd.get("bombPlanter") != ""

        # aggregate round stats into player stats and update prev_economies
        for prs in rnd["playerStats"]:
            puuid = prs["puuid"]
            player = next((p for p in players if p["puuid"] == puuid), None)
            if not player:
                continue

            p_team = player["teamId"]

            # compute kills/deaths from round details
            kills = len(prs.get("kills", []))
            
            # deaths roughly damage based? we used per-round calculation earlier, but
            # for safety derive deaths increment if other players killed them in this round
            deaths = 0
            for other in rnd["playerStats"]:
                if other["puuid"] == puuid:
                    continue
                for k in other.get("kills", []):
                    if k["victim"] == puuid:
                        deaths += 1

            assists = 0
            for k in rnd["playerStats"]:
                for kill in k.get("kills", []):
                    if puuid in kill.get("assistants", []):
                        assists += 1            

            # Score already in prs["score"]
            player["stats"]["kills"] += kills
            player["stats"]["deaths"] += deaths
            player["stats"]["assists"] += assists
            player["_roundScores"].append(prs.get("score", 0))
            player["stats"]["roundsPlayed"] += 1
            player["stats"]["playtimeMillis"] += random.randint(20000, 100000)

            # --- Sumar casting de Ultimate si la usó ---
            used_ult = prs.pop("used_ultimate", False) # Extraemos y eliminamos la variable temporal
            if used_ult:
                player["stats"]["abilityCasts"]["ultimateCasts"] += 1

            # ability casts random small bump
            ac = player["stats"]["abilityCasts"]
            ac["grenadeCasts"] += random.randint(0, 1)
            ac["ability1Casts"] += random.randint(0, 1)
            ac["ability2Casts"] += random.randint(0, 1)

            # --- LÓGICA DE INGRESOS DE LA RONDA ---
            income = 0
            if p_team == win_team:
                income += 3000
            else:
                income += loss_income
                
            income += kills * 200
            
            if was_plant and p_team == attacking_team:
                income += 300
                
            # Cap oficial de Valorant: 9000 créditos
            current_remaining = prs.get("economy", {}).get("remaining", 0)
            new_total = clamp(current_remaining + income, 0, 9000)
            
            prev_economies[puuid] = {
                "remaining": new_total,
                "spent": 0
            }

            # --- RECOLECCIÓN DE PUNTOS DE ULTIMATE ---
            ultimate_points[puuid] += kills
            if deaths > 0:
                ultimate_points[puuid] += 1
            if rnd.get("bombPlanter") == puuid:
                ultimate_points[puuid] += 1
            if rnd.get("bombDefuser") == puuid:
                ultimate_points[puuid] += 1
            if random.random() < 0.15: # Chance de haber cogido un orbe
                ultimate_points[puuid] += 1

            # Limitar puntos al coste máximo de la ulti (asumiendo 8)
            ultimate_points[puuid] = min(ultimate_points[puuid], 8)
            # ------------------------------------------

        round_results.append(rnd)

        # stop condition: first to 13
        if red_wins >= 13 or blue_wins >= 13:
            break

    # finalize match duration roughly proportional to rounds
    avg_round_ms = 120000
    total_rounds_played = len(round_results)
    match_info["gameLengthMillis"] = total_rounds_played * avg_round_ms + random.randint(-30000, 30000)

    # finalize teams object
    teams = [
        {"teamId":"Red", "won": red_wins > blue_wins, "roundsPlayed": total_rounds_played, "roundsWon": red_wins, "numPoints": red_wins},
        {"teamId":"Blue","won": blue_wins > red_wins, "roundsPlayed": total_rounds_played, "roundsWon": blue_wins, "numPoints": blue_wins}
    ]
    
    # --- Calcular score medio por jugador ---
    for p in players:
        scores = p.pop("_roundScores", [])
        if scores:
            p["stats"]["score"] = int(sum(scores) / len(scores))
        else:
            p["stats"]["score"] = 0

    match = {
        "matchInfo": match_info,
        "players": players,
        "coaches": [],
        "teams": teams,
        "roundResults": round_results
    }

    return match

# -----------------------------
# Guardar match (opcional)
# -----------------------------
def save_match_to_file(match_obj, output_dir):
    import os
    os.makedirs(output_dir, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    fname = f"match_{ts}_{match_obj['matchInfo']['matchId']}.json"
    path = os.path.join(output_dir, fname)
    with open(path, "w", encoding="utf8") as f:
        json.dump(match_obj, f, ensure_ascii=False, indent=2)
    return path

# -----------------------------
# CLI rápido para probar
# -----------------------------
if __name__ == "__main__":
    # genera 1 match y lo imprime en stdout
    match = generate_match(TEST_PLAYERS)
    print(json.dumps(match, ensure_ascii=False, indent=2))