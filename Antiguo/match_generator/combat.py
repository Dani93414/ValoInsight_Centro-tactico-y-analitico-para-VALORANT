import random
import math

import math

# --- UTILIDADES DE POSICIONAMIENTO ---

def build_player_locations(state):
    """
    Genera snapshot de posiciones de todos los jugadores vivos.
    Compatible con PlayerLocationsDto de Valorant.
    """
    locations = []

    if state is None:
        return locations

    for puuid in state.alive_players:

        pos = state.get_position(puuid)

        locations.append({
            "puuid": puuid,
            "viewRadians": random.uniform(0, 2*math.pi),
            "location": {
                "x": pos["x"],
                "y": pos["y"]
            }
        })

    return locations


def build_victim_location(state, victim):
    """
    Devuelve la localización del jugador eliminado.
    """
    if state is None:
        return {"x": 0, "y": 0}

    pos = state.get_position(victim)

    if pos is None:
        return {"x": 0, "y": 0}

    return {
        "x": pos["x"],
        "y": pos["y"]
    }

# --- FUNCIONES AUXILIARES DE COMBATE ---

def pick_players_for_duel(alive_red, alive_blue):
    """Selecciona aleatoriamente dos jugadores de equipos contrarios para un duelo."""
    if not alive_red or not alive_blue:
        return None, None

    prob_red_initiates = len(alive_red) / (len(alive_red) + len(alive_blue))
    if random.random() < prob_red_initiates:
        p1 = random.choice(alive_red)
        p2 = random.choice(alive_blue)
    else:
        p1 = random.choice(alive_blue)
        p2 = random.choice(alive_red)
        
    return p1, p2

def pick_duel_winner_combined(p1, p2, alive_red, alive_blue, health):
    """Decide quién gana el duelo basándose en su HP actual y la ventaja numérica de su equipo."""
    hp1 = max(health[p1], 1)
    hp2 = max(health[p2], 1)
    p_hp = hp1 / (hp1 + hp2)

    team1 = "Red" if p1 in alive_red else "Blue"
    team2 = "Red" if p2 in alive_red else "Blue"
    n1 = len(alive_red) if team1 == "Red" else len(alive_blue)
    n2 = len(alive_red) if team2 == "Red" else len(alive_blue)
    p_num = n1 / (n1 + n2)

    S1 = p_hp * p_num
    S2 = (1 - p_hp) * (1 - p_num)
    
    if (S1 + S2) == 0:
        P_final = 0.5
    else:
        P_final = S1 / (S1 + S2)

    return (p1, p2) if random.random() < P_final else (p2, p1)

def calculate_realistic_damage(weapon_mongo, target_hp):
    """
    Simula el impacto de balas reales usando las stats de MongoDB.
    """
    # SEGURIDAD: Si weapon_mongo es una lista, extraemos el primer elemento
    if isinstance(weapon_mongo, list):
        weapon_mongo = weapon_mongo[0] if len(weapon_mongo) > 0 else {}

    # Valores por defecto (Classic) si el objeto está vacío o no es un dict
    head_dmg, body_dmg, leg_dmg = 78, 26, 22 

    if isinstance(weapon_mongo, dict) and "weaponStats" in weapon_mongo:
        stats = weapon_mongo.get("weaponStats")
        if stats:
            dmg_ranges = stats.get("damageRanges", [])
            if dmg_ranges:
                # Usamos el rango 0 (0-30m)
                head_dmg = dmg_ranges[0].get("headDamage", head_dmg)
                body_dmg = dmg_ranges[0].get("bodyDamage", body_dmg)
                leg_dmg = dmg_ranges[0].get("legDamage", leg_dmg)

    shots = {"headshots": 0, "bodyshots": 0, "legshots": 0}
    total_dmg = 0
    
    # Simular ráfaga de balas hasta superar la vida del objetivo
    # Limitamos a un máximo de 20 iteraciones para evitar bucles infinitos si el daño es 0
    attempts = 0
    while total_dmg < target_hp and attempts < 20:
        attempts += 1
        roll = random.random()
        if roll < 0.15: # 15% Headshot
            shots["headshots"] += 1
            total_dmg += head_dmg
        elif roll < 0.75: # 60% Bodyshot
            shots["bodyshots"] += 1
            total_dmg += body_dmg
        else: # 25% Legshot
            shots["legshots"] += 1
            total_dmg += leg_dmg

    return {
        "damage": int(total_dmg),
        "legshots": shots["legshots"],
        "bodyshots": shots["bodyshots"],
        "headshots": shots["headshots"]
    }

# --- SIMULADOR PRINCIPAL ---

def simulate_realistic_combat(alive_red, alive_blue, initial_hp_dict, player_weapons, state=None):
    current_red = alive_red.copy()
    current_blue = alive_blue.copy()
    health = initial_hp_dict.copy()

    kill_events = []
    all_players = current_red + current_blue
    damage_log = {p: {} for p in all_players}

    red_deaths = 0
    blue_deaths = 0
    current_time_ms = random.randint(5000, 20000)

    while current_red and current_blue:
        # ACTUALIZAR POSICIONES DEL ROUND
        if state is not None:
            state.update_positions()

        if red_deaths >= 5 or blue_deaths >= 5:
            break

        p1, p2 = pick_players_for_duel(current_red, current_blue)
        if not p1 or not p2:
            break

        killer, victim = pick_duel_winner_combined(p1, p2, current_red, current_blue, health)

        # Obtenemos las armas (asegurando que sean dicts)
        killer_weapon = player_weapons.get(killer, {})
        victim_weapon = player_weapons.get(victim, {})

        # 1. El asesino hace daño letal
        burst_to_victim = calculate_realistic_damage(killer_weapon, health[victim])
        health[victim] = 0
        damage_log[victim][killer] = burst_to_victim

        # 2. Daño de represalia
        if health[killer] > 1:
            retaliation_target = random.randint(0, int(health[killer] - 1))
            if retaliation_target > 0:
                burst_to_killer = calculate_realistic_damage(victim_weapon, retaliation_target)
                health[killer] -= burst_to_killer["damage"]
                damage_log[killer][victim] = burst_to_killer

        # 3. Asistencias
        assistants = [
            attacker for attacker, burst_data in damage_log[victim].items()
            if attacker != killer and isinstance(burst_data, dict) and burst_data.get("damage", 0) > 50
        ]

        if random.random() < 0.18:
            posibles = [p for p in all_players if p != killer and p != victim and p not in assistants]
            if posibles:
                assistants.append(random.choice(posibles))
                
        current_time_ms += random.randint(2000, 12000)
        
        # 4. Registrar evento
        # Aseguramos extraer el UUID del arma si es un diccionario
        w_uuid = killer_weapon.get("uuid", "") if isinstance(killer_weapon, dict) else ""

        victim_location = build_victim_location(state, victim)
        player_locations = build_player_locations(state)

        kill_events.append({
            "timeSinceGameStartMillis": current_time_ms,
            "timeSinceRoundStartMillis": current_time_ms,
            "killer": killer,
            "victim": victim,
            "victimLocation": victim_location,
            "assistants": assistants,
            "playerLocations": player_locations,
            "weapon_uuid": w_uuid
        })

        if victim in current_red:
            current_red.remove(victim)
            red_deaths += 1
        else:
            current_blue.remove(victim)
            blue_deaths += 1

        if state is not None:
            state.kill_player(victim)
            
    return kill_events, damage_log, health

# --- SISTEMA DE PUNTUACIÓN (ACS) ---

def compute_combat_score(player_kills, damage_events, did_damage_assist, all_round_kills):
    # Sumar daño de la ráfaga
    damage_score = sum(d.get("damage", 0) for d in damage_events if isinstance(d, dict))

    kill_score = 0
    sorted_round_kills = sorted(all_round_kills, key=lambda x: x["timeSinceRoundStartMillis"])
    kill_value_table = [150, 130, 110, 90, 70]

    for my_kill in player_kills:
        try:
            index_in_round = sorted_round_kills.index(my_kill)
            if index_in_round < len(kill_value_table):
                kill_score += kill_value_table[index_in_round]
            else:
                kill_score += 70 
        except (ValueError, KeyError):
            kill_score += 70

    if len(player_kills) >= 2:
        kill_score += (len(player_kills) - 1) * 50

    assist_score = 25 if did_damage_assist and damage_score == 0 else 0

    return damage_score + kill_score + assist_score