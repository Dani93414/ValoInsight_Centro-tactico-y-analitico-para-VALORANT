# combat_simulator.py
import random
from utils.helpers import clamp
from db.data_loader import load_shop_weapons

def simulate_realistic_combat(player_objs, winning_team, initial_hp_dict):
    """
    Combate realista combinado:

    🔹 Vida persistente (HP viene de initial_hp_dict)
    🔹 Probabilidad de ganar el duelo depende de:
         - Su vida frente al rival
         - La ventaja numérica de su equipo
    🔹 Ambos jugadores reciben daño en el duelo
    🔹 Máximo 5 muertes por equipo
    🔹 Nadie muere dos veces
    🔹 Asistencias basadas en daño previo real
    """

    # --- Estado inicial -----------------------------------------------------

    alive_red = [p["puuid"] for p in player_objs if p["teamId"] == "Red"]
    alive_blue = [p["puuid"] for p in player_objs if p["teamId"] == "Blue"]

    # HP inicial configurable
    health = {p["puuid"]: initial_hp_dict.get(p["puuid"], 100) for p in player_objs}

    kill_events = []
    damage_log = {p["puuid"]: {} for p in player_objs}  # victim → {attacker: damage}

    red_deaths = 0
    blue_deaths = 0

    # --- Funciones auxiliares ---------------------------------------------

    def pick_players_for_duel():
        """
        Selección de jugadores influida por ventaja numérica.
        Solo decide quién se enfrenta contra quién.
        """

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
        """
        Decide el ganador usando vida + ventaja numérica en una única fórmula.
        """

        hp1 = max(health[p1], 1)
        hp2 = max(health[p2], 1)

        # Probabilidad basada en vida
        p_hp = hp1 / (hp1 + hp2)

        # Equipo de cada jugador
        team1 = "Red" if p1 in alive_red else "Blue"
        team2 = "Red" if p2 in alive_red else "Blue"

        # Probabilidad basada en número de vivos
        n1 = len(alive_red) if team1 == "Red" else len(alive_blue)
        n2 = len(alive_red) if team2 == "Red" else len(alive_blue)

        p_num = n1 / (n1 + n2)

        # Combinación vida + ventaja numérica
        S1 = p_hp * p_num
        S2 = (1 - p_hp) * (1 - p_num)

        P_final = S1 / (S1 + S2)

        return (p1, p2) if random.random() < P_final else (p2, p1)

    # --- Bucle principal ----------------------------------------------------

    while alive_red and alive_blue:

        if red_deaths >= 5 or blue_deaths >= 5:
            break

        p1, p2 = pick_players_for_duel()
        if p1 is None:
            break

        killer, victim = pick_duel_winner_combined(p1, p2)

        # --- Daño real del duelo ------------------------------------------

        final_damage = random.randint(80, 150)
        health[victim] = 0

        # El killer también recibe daño real
        damage_to_killer = random.randint(0, 90)
        health[killer] = max(0, health[killer] - damage_to_killer)

        # Registrar daño para futuros assists
        damage_log[victim][killer] = final_damage

        # --- Calcular asistencias -----------------------------------------

        assistants = [
            attacker
            for attacker, dmg in damage_log[victim].items()
            if attacker != killer and dmg > 50
        ]

        # --- Posibilidad de asistencia sin daño
        if random.random() < 0.18:  # 18% de probabilidad
            posibles = [
                p for p in (alive_red + alive_blue)
                if p != killer and p != victim and p not in assistants
            ]
            if posibles:
                assistants.append(random.choice(posibles))
                
        # --- Crear evento de kill -----------------------------------------

        kill_time = random.randint(2000, 90000)
        weapons_dict = load_shop_weapons()
        kill_events.append({
            "timeSinceGameStartMillis": kill_time,
            "timeSinceRoundStartMillis": kill_time,
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
                "damageItem": random.choice([w["name"] for w in weapons_dict]),
                "isSecondaryFireMode": False
            }
        })

        # --- Eliminar al muerto -------------------------------------------

        if victim in alive_red:
            alive_red.remove(victim)
            red_deaths += 1
        else:
            alive_blue.remove(victim)
            blue_deaths += 1

    # --- Resultado final ----------------------------------------------------

    return kill_events, damage_log, health
