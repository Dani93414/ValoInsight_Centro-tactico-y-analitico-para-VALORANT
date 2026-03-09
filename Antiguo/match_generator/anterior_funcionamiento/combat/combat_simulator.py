# combat_simulator.py
import random
from utils.helpers import clamp

# Añadimos player_weapons como parámetro
def simulate_realistic_combat(player_objs, winning_team, initial_hp_dict, player_weapons):
    """
    Combate realista combinado:
    🔹 Vida persistente y precisa basada en escudos comprados.
    🔹 Probabilidad de ganar el duelo dependiente de ventaja.
    🔹 Reloj de muertes secuencial (no hay viajes en el tiempo).
    🔹 El arma final coincide con la economía de esa ronda.
    """

    alive_red = [p["puuid"] for p in player_objs if p["teamId"] == "Red"]
    alive_blue = [p["puuid"] for p in player_objs if p["teamId"] == "Blue"]

    health = {p["puuid"]: initial_hp_dict.get(p["puuid"], 100) for p in player_objs}

    kill_events = []
    damage_log = {p["puuid"]: {} for p in player_objs}

    red_deaths = 0
    blue_deaths = 0

    # Inicializamos el reloj de la ronda (el primer combate suele ocurrir entre el 5s y el 20s)
    current_time_ms = random.randint(5000, 20000)

    def pick_players_for_duel():
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

    def pick_duel_winner_combined(p1, p2):
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
        
        # Evitar divisiones por 0 en casos extremos
        if (S1 + S2) == 0:
            P_final = 0.5
        else:
            P_final = S1 / (S1 + S2)

        return (p1, p2) if random.random() < P_final else (p2, p1)

    while alive_red and alive_blue:
        if red_deaths >= 5 or blue_deaths >= 5:
            break

        p1, p2 = pick_players_for_duel()
        if p1 is None:
            break

        killer, victim = pick_duel_winner_combined(p1, p2)

        final_damage = random.randint(80, 150)
        health[victim] = 0

        damage_to_killer = random.randint(0, 90)
        health[killer] = max(0, health[killer] - damage_to_killer)

        damage_log[victim][killer] = final_damage

        assistants = [
            attacker
            for attacker, dmg in damage_log[victim].items()
            if attacker != killer and dmg > 50
        ]

        if random.random() < 0.18:
            posibles = [
                p for p in (alive_red + alive_blue)
                if p != killer and p != victim and p not in assistants
            ]
            if posibles:
                assistants.append(random.choice(posibles))
                
        # --- NUEVA LÓGICA DE TIEMPO SECUENCIAL Y ARMAS ---
        
        # Avanzamos el reloj de combate (entre 2 y 12 segundos desde el último kill)
        current_time_ms += random.randint(2000, 12000)
        
        # Rescatamos el arma que el asesino compró en la fase de compra
        killer_weapon = player_weapons.get(killer, "Classic")

        kill_events.append({
            "timeSinceGameStartMillis": current_time_ms,
            "timeSinceRoundStartMillis": current_time_ms,
            "killer": killer,
            "victim": victim,
            "assistants": assistants,
            "victimLocation": {
                "x": random.randint(-900, 900),
                "y": random.randint(-900, 900)
            },
            "playerLocations": [],
            "finishingDamage": {
                "damageType": "Weapon",
                "damageItem": killer_weapon, # Ahora el arma es la real
                "isSecondaryFireMode": False
            }
        })

        if victim in alive_red:
            alive_red.remove(victim)
            red_deaths += 1
        else:
            alive_blue.remove(victim)
            blue_deaths += 1

    return kill_events, damage_log, health