import requests

BASE_URL = "https://valorant-api.com/v1"

def get_agents_es():
    """
    Obtiene TODOS los agentes jugables en español desde Valorant-API
    y devuelve la lista ya traducida.
    """
    url = f"{BASE_URL}/agents"
    params = {
        "isPlayableCharacter": "true",
        "language": "es-ES"
    }

    response = requests.get(url, params=params)
    response.raise_for_status()

    data = response.json()
    return data["data"]

def get_maps_es():
    """
    Obtiene TODOS los mapas desde Valorant-API
    y devuelve la lista en español.
    """
    url = f"{BASE_URL}/maps"
    params = {
        "language": "es-ES"
    }

    response = requests.get(url, params=params)
    response.raise_for_status()

    data = response.json()
    return data["data"]

def get_weapons_es():
    """
    Obtiene TODAS las armas desde Valorant-API en español
    y devuelve la lista de datos traducidos.
    """
    url = f"{BASE_URL}/weapons"
    params = {
        "language": "es-ES"
    }

    response = requests.get(url, params=params)
    response.raise_for_status()

    data = response.json()
    return data["data"]

def get_buddies_es():
    url = f"{BASE_URL}/buddies"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_bundles_es():
    url = f"{BASE_URL}/bundles"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_ceremonies_es():
    url = f"{BASE_URL}/ceremonies"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_competitivetiers_es():
    url = f"{BASE_URL}/competitivetiers"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_contenttiers_es():
    url = f"{BASE_URL}/contenttiers"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_contracts_es():
    url = f"{BASE_URL}/contracts"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_currencies_es():
    url = f"{BASE_URL}/currencies"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_events_es():
    url = f"{BASE_URL}/events"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_flex_es():
    url = f"{BASE_URL}/flex"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_gamemodes_es():
    url = f"{BASE_URL}/gamemodes"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_gear_es():
    url = f"{BASE_URL}/gear"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_levelborders_es():
    url = f"{BASE_URL}/levelborders"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_playercards_es():
    url = f"{BASE_URL}/playercards"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_playertitles_es():
    url = f"{BASE_URL}/playertitles"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_sprays_es():
    url = f"{BASE_URL}/sprays"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_themes_es():
    url = f"{BASE_URL}/themes"
    params = {"language": "es-ES"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_version_es():
    url = f"{BASE_URL}/version"
    params = {"language": "es-ES"}  # este endpoint también soporta language
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["data"]