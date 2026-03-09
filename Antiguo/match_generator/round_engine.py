# match_generator/round_engine.py

import random
from src.match_generator.economy import process_buy_phase, calculate_round_income
from src.match_generator.combat import simulate_realistic_combat, compute_combat_score
from src.match_generator.map_engine import (
    generate_player_positions,
    generate_kill_position,
    generate_player_locations,
    generate_plant_location
)

def simulate_round(match_state, players_data, round_num, attacking_team, mongo_weapons, mongo_shields):
    """
    Simula una ronda completa conectando la economía de supervivencia y la balística real.
    """
    # ---------------------------------------------------------
    # 1. MACRO-ESTRATEGIA (Ganador y Bomba)
    # ---------------------------------------------------------
    base = 0.49
    win_prob_attacker = base + 0.06
    winning_team = "Red" if random.random() < (win_prob_attacker if attacking_team == "Red" else base) else "Blue"

    was_plant = random.random() < (0.60 if winning_team == attacking_team else 0.30)
    
    planter_puuid = ""
    defuser_puuid = ""
    round_result_str = "Eliminations"

    attackers = [p["puuid"] for p in players_data if p["teamId"] == attacking_team]
    defenders = [p["puuid"] for p in players_data if p["teamId"] != attacking_team]

    # 🔥 Generamos las posiciones iniciales de la ronda ANTES de evaluar la bomba
    all_players = [p["puuid"] for p in players_data]
    player_positions = generate_player_positions(all_players)

    # 🔥 Inicializamos variables por defecto (Para evitar el UnboundLocalError)
    plant_location = {"x": 0, "y": 0}
    plant_player_locations = []

    if was_plant:
        planter_puuid = random.choice(attackers)
        site = random.choice(["A", "B"])
        plant_location = generate_plant_location(site)
        plant_player_locations = generate_player_locations(player_positions)
        
        if winning_team != attacking_team:
            round_result_str = "BombDefused"
            defuser_puuid = random.choice(defenders)
        else:
            round_result_str = "BombExecution"

    # ---------------------------------------------------------
    # 2. FASE DE COMPRA Y EQUIPAMIENTO (Survival Logic)
    # ---------------------------------------------------------
    round_economies = {}
    initial_hp_dict = {}
    player_weapons_objs = {} 

    for p in players_data:
        puuid = p["puuid"]
        player_state = match_state.players[puuid]

        # Comprar (o mantener arma si sobrevivió)
        buy_decision = process_buy_phase(player_state, mongo_weapons, mongo_shields)
        
        current_weapon = buy_decision.get("weapon", {})
        
        round_economies[puuid] = buy_decision
        player_weapons_objs[puuid] = current_weapon

        # HP = 100 + Vida de escudo
        shield_hp = 0
        armor_id = buy_decision.get("armor", "")
        if armor_id:
            # Asumimos +50 por simplicidad, aunque en Valorant hay de +25
            shield_hp = 50 
        
        initial_hp_dict[puuid] = 100 + shield_hp

    # ---------------------------------------------------------
    # 3. FASE DE COMBATE (Balística Real)
    # ---------------------------------------------------------
    alive_red = [p["puuid"] for p in players_data if p["teamId"] == "Red"]
    alive_blue = [p["puuid"] for p in players_data if p["teamId"] == "Blue"]

    kill_events, damage_log, health_final = simulate_realistic_combat(
        alive_red, alive_blue, initial_hp_dict, player_weapons_objs
    )

    # ---------------------------------------------------------
    # AÑADIR POSICIONES A LOS EVENTOS DE KILL
    # ---------------------------------------------------------
    for k in kill_events:
        victim = k["victim"]
        k["victimLocation"] = generate_kill_position(player_positions, victim)
        k["playerLocations"] = generate_player_locations(player_positions)

    # ---------------------------------------------------------
    # 4. ACTUALIZACIÓN DE ESTADO Y STATS (DTO)
    # ---------------------------------------------------------
    player_round_stats_raw = []

    for p in players_data:
        puuid = p["puuid"]
        player_state = match_state.players[puuid]
        
        # Actualizar estado de vida según el simulador de combate
        hp_end = health_final.get(puuid, 0)
        if hp_end <= 0:
            player_state.is_alive = False
            player_state.deaths += 1
            # Importante: resetear arma y escudo en el estado persistente
            player_state.current_weapon_id = ""
            player_state.current_armor_id = ""
        else:
            player_state.is_alive = True

        # Extraer Kills y Asistencias de la lista de eventos
        my_kills = [k for k in kill_events if k["killer"] == puuid]
        my_assists_count = sum(1 for k in kill_events if puuid in k["assistants"])
        
        player_state.kills += len(my_kills)
        player_state.assists += my_assists_count

        # Extraer daño real del log (formato compatible con DamageDto)
        my_damage_entries = []
        
        for victim_id, victim_attackers in damage_log.items():
            if puuid in victim_attackers:
                d_data = victim_attackers[puuid]
                my_damage_entries.append({
                    "receiver": victim_id,
                    "damage": d_data.get("damage", 0),
                    "legshots": d_data.get("legshots", 0),
                    "bodyshots": d_data.get("bodyshots", 0),
                    "headshots": d_data.get("headshots", 0)
                })

        # Calcular ACS (Puntuación de combate)
        score_value = compute_combat_score(my_kills, my_damage_entries, my_assists_count > 0, kill_events)
        player_state.round_scores.append(score_value)
        player_state.rounds_played += 1
        
        # Calcular ingresos para el inicio de la siguiente ronda
        is_winner = (p["teamId"] == winning_team)
        income = calculate_round_income(
            is_winner, 
            match_state.teams[p["teamId"]].loss_streak, 
            len(my_kills), 
            was_plant, 
            p["teamId"] == attacking_team
        )
        player_state.add_credits(income)

        # 🔥 Simulación de uso de habilidades en ESTA ronda
        r_grenade = random.choice([0, 1])
        r_ability1 = random.choice([0, 1, 2]) # La que se recarga gratis
        r_ability2 = random.choice([0, 1])
        r_ult = 1 if random.random() < 0.08 else 0 # 8% de probabilidad de tirar ulti

        player_state.grenade_casts += r_grenade
        player_state.ability1_casts += r_ability1
        player_state.ability2_casts += r_ability2
        player_state.ultimate_casts += r_ult

        # Empaquetado de datos crudos para el DTO final del orquestador
        player_round_stats_raw.append({
            "puuid": puuid,
            "kills": my_kills,
            "damage": my_damage_entries,
            "score": score_value,
            "economy": round_economies.get(puuid, {}),
            # 🔥 Formato oficial de Riot (Strings)
            "ability": {
                "grenadeEffects": "",
                "ability1Effects": "",
                "ability2Effects": "",
                "ultimateEffects": ""
            }
        })

    # Actualizar rachas de victoria/derrota en los equipos
    match_state.teams[winning_team].win_round()
    match_state.teams["Blue" if winning_team == "Red" else "Red"].lose_round()

    # Determinamos el rol del equipo ganador de forma lógica
    winning_team_role = "Attack" if winning_team == attacking_team else "Defend"

    return {
        "roundNum": round_num,
        "roundResult": round_result_str,
        "winningTeam": winning_team,
        "winningTeamRole": winning_team_role,
        "bombPlanter": planter_puuid,
        "bombDefuser": defuser_puuid,
        "plantLocation": plant_location,
        "plantPlayerLocations": plant_player_locations,
        "playerStats": player_round_stats_raw
    }