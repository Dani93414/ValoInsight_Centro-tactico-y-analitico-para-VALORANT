import random
from utils.helpers import clamp

from db.data_loader import load_shop_weapons, load_shields


def pick_shield():
    escudos = load_shields()

    elegido = random.choices(
        escudos,
        weights=[0.6, 0.25, 0.15],  # ligero, pesado, regenerativo
        k=1
    )[0]

    return {
        "armor_name": elegido["name"],
        "armor_id": elegido["id"],
        "price": elegido.get("price", 0)
    }


def pick_initial_weapon():
    armas = load_shop_weapons()

    arma = random.choice(armas)

    return {
        "weapon": arma["name"],
        "weapon_id": arma["id"],
        "price": arma.get("price", 0)
    }