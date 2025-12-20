# damage_system.py
# -----------------------------
# Calcular un combat score
# -----------------------------
def compute_combat_score(kill_events, damage_events, did_damage_assist):
    """
    - 1 punto por daño infligido
    - Kill value según enemigos restantes (150..70)
    - +50 por cada kill adicional (multikill)
    - Asistencia sin daño = 25
    - Asistencia con daño = solo suma el daño
    """
    # -----------------------------
    # 1) Daño → 1 punto por 1 daño
    # -----------------------------
    damage_score = sum(d["damage"] for d in damage_events)

    # -----------------------------
    # 2) Kill value + multikill
    # -----------------------------
    # kill_events ya son eventos individuales
    kill_count = len(kill_events)
    kill_score = 0

    # valores por cantidad de enemigos vivos al momento del kill
    # 5 → 150, 4 → 130, 3 → 110, 2 → 90, 1 → 70
    kill_value_table = {5:150, 4:130, 3:110, 2:90, 1:70}

    # simulación simplificada: cada kill reduce enemigos vivos
    enemies_alive = 5
    for _ in range(kill_count):
        kill_score += kill_value_table[enemies_alive]
        enemies_alive = max(1, enemies_alive - 1)

    # multikills
    if kill_count >= 2:
        kill_score += (kill_count - 1) * 50

    # -----------------------------
    # 3) Asistencias sin daño
    # -----------------------------
    assist_score = 25 if did_damage_assist and sum(d["damage"] for d in damage_events) == 0 else 0

    return damage_score + kill_score + assist_score
