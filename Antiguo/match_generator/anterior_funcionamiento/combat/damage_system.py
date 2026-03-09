# damage_system.py

def compute_combat_score(player_kills, damage_events, did_damage_assist, all_round_kills):
    """
    Calcula el ACS basado en las reglas oficiales de Valorant:
    - 1 punto por cada 1 de daño infligido.
    - Kill score basado en cuántos enemigos vivos quedan:
        * 150/130/110/90/70 según si es el 1º, 2º, 3º, 4º o 5º en morir.
    - +50 puntos adicionales por cada kill a partir de la segunda (Multikill).
    - 25 puntos por asistencia sin daño (non-damage assist).
    """
    
    # ---------------------------------------------------------
    # 1) Daño: 1 punto por cada punto de daño
    # ---------------------------------------------------------
    damage_score = sum(d["damage"] for d in damage_events)

    # ---------------------------------------------------------
    # 2) Kills: Basado en el orden temporal de la ronda
    # ---------------------------------------------------------
    kill_score = 0
    # Ordenamos todos los kills de la ronda por tiempo para saber el orden real
    sorted_round_kills = sorted(all_round_kills, key=lambda x: x["timeSinceRoundStartMillis"])
    
    # Tabla oficial de puntos por kill según orden
    # 1st death = 150, 2nd death = 130, etc.
    kill_value_table = [150, 130, 110, 90, 70]

    for my_kill in player_kills:
        # Buscamos qué posición ocupa mi kill en el total de la ronda
        try:
            # Encontramos el índice de esta kill en la cronología de la ronda
            index_in_round = sorted_round_kills.index(my_kill)
            # Si es el primer muerto de la ronda, index es 0 -> 150 puntos
            if index_in_round < len(kill_value_table):
                kill_score += kill_value_table[index_in_round]
            else:
                kill_score += 70 # Fallback por si hay más de 5 (raro, pero por seguridad)
        except ValueError:
            kill_score += 70

    # ---------------------------------------------------------
    # 3) Multikills: +50 por cada kill después de la primera
    # ---------------------------------------------------------
    if len(player_kills) >= 2:
        kill_score += (len(player_kills) - 1) * 50

    # ---------------------------------------------------------
    # 4) Asistencias sin daño (No-damage assists): 25 puntos
    # ---------------------------------------------------------
    # Valorant da 25 puntos si ayudaste (ej. flash, revelado) pero no hiciste daño
    assist_score = 0
    total_damage_done = sum(d["damage"] for d in damage_events)
    if did_damage_assist and total_damage_done == 0:
        assist_score = 25

    return damage_score + kill_score + assist_score