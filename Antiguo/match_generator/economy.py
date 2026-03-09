# src/match_generator/economy.py

import random

def process_buy_phase(player_state, mongo_weapons, mongo_shields):
    start_credits = player_state.credits
    spent = 0
    
    # 1. Gestión de muerte anterior
    if not player_state.is_alive:
        player_state.current_weapon_id = ""
        player_state.current_armor_id = ""
        # Marcamos como vivo para esta ronda
        player_state.is_alive = True

    # 2. Lógica de Compra de Arma (Solo si no tiene una)
    if not player_state.current_weapon_id:
        if start_credits >= 3900: 
            # Presupuesto para Rifle (coste 2900)
            rifle = next((w for w in mongo_weapons if w.get("shopData") and w["shopData"].get("cost") == 2900), None)
            if rifle:
                player_state.current_weapon_id = rifle.get("uuid", "")
                spent += rifle["shopData"].get("cost", 2900)
        else:
            # Si no hay dinero, compramos un arma secundaria/gratis (coste 0, como la Classic)
            pistola = next((w for w in mongo_weapons if w.get("shopData") and w["shopData"].get("cost") == 0), None)
            if pistola:
                player_state.current_weapon_id = pistola.get("uuid", "")
                spent += pistola["shopData"].get("cost", 0)

    # 3. Lógica de Compra de Escudo (Si no tiene)
    if not player_state.current_armor_id:
        remaining_after_weapon = start_credits - spent
        
        # Filtramos los escudos que nos podemos permitir
        valid_shields = []
        for s in mongo_shields:
            if isinstance(s, dict):
                # Extraemos el coste de shopData
                s_cost = s.get("shopData", {}).get("cost", 9999) if s.get("shopData") else 9999
                if s_cost <= remaining_after_weapon:
                    valid_shields.append(s)
        
        # Si hay escudos válidos, compramos el más caro que podamos permitirnos
        if valid_shields:
            best_shield = max(valid_shields, key=lambda x: x.get("shopData", {}).get("cost", 0) if x.get("shopData") else 0)
            player_state.current_armor_id = best_shield.get("uuid", "")
            spent += best_shield.get("shopData", {}).get("cost", 0) if best_shield.get("shopData") else 0

    # 4. Actualizar créditos del jugador
    player_state.credits -= spent

    # 5. Buscamos el objeto completo del arma para que combat.py pueda usar sus stats de daño
    full_weapon_obj = next((w for w in mongo_weapons if w.get("uuid") == player_state.current_weapon_id), {"displayName": "Classic"})

    return {
        "loadoutValue": spent, 
        "weapon": full_weapon_obj, # El simulador de combate necesita el dict completo
        "armor": player_state.current_armor_id, # Devolvemos solo el UUID del escudo
        "remaining": player_state.credits,
        "spent": spent
    }


def calculate_round_income(is_winner, loss_streak, kills, was_plant, is_attacker):
    """
    Calcula exactamente cuántos créditos gana un jugador al final de una ronda 
    siguiendo las reglas oficiales de Valorant.
    """
    income = 0
    
    # Ingresos base por ganar o perder (con bono por racha)
    if is_winner:
        income += 3000
    else:
        if loss_streak >= 3:
            income += 2900
        elif loss_streak == 2:
            income += 2400
        else:
            income += 1900
            
    # Bonus por kills (200 por cabeza)
    income += kills * 200
    
    # Bonus por plantar (solo para los atacantes, ganen o pierdan)
    if was_plant and is_attacker:
        income += 300
        
    return income