# economy_manager.py
import random
from utils.helpers import clamp
from db.data_loader import load_shop_weapons, load_shields

def pick_shield(budget):
    escudos = load_shields()
    
    # Ordenamos los escudos de más caro a más barato usando el precio de tu DB
    escudos_ordenados = sorted(escudos, key=lambda x: x.get("price", 0), reverse=True)
    
    for escudo in escudos_ordenados:
        if budget >= escudo.get("price", 0):
            return {
                "armor_name": escudo["name"],
                "armor_id": escudo["id"],
                "price": escudo.get("price", 0)
            }
            
    # Si no le llega para nada
    return {"armor_name": "None", "armor_id": "", "price": 0}

def pick_initial_weapon(budget):
    armas = load_shop_weapons()
    
    # Filtramos las armas que puede permitirse según los datos de tu Mongo
    opciones = [a for a in armas if a.get("price", 0) <= budget]
    
    if not opciones:
        # Fallback a la pistola gratuita (ordenando por precio ascendente, la de coste 0)
        armas_baratas = sorted(armas, key=lambda x: x.get("price", 0))
        elegido = armas_baratas[0]
    else:
        # Lógica realista: De las opciones disponibles, prioriza comprar algo que cueste
        # como máximo 500 créditos menos de su presupuesto (para no comprar una pistola si tiene 3000)
        opciones_caras = [a for a in opciones if a.get("price", 0) >= budget - 500]
        elegido = random.choice(opciones_caras) if opciones_caras else random.choice(opciones)

    return {
        "weapon": elegido["name"],
        "weapon_id": elegido["id"],
        "price": elegido.get("price", 0)
    }