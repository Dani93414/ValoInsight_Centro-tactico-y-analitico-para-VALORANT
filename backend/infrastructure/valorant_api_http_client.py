from __future__ import annotations

from typing import Any, Dict, List

import requests

BASE_URL = "https://valorant-api.com/v1"


def _fetch_es(
    endpoint: str,
    extra_params: Dict[str, str] | None = None,
) -> List[Dict[str, Any]] | Dict[str, Any]:
    params = {"language": "es-ES"}
    if extra_params:
        params.update(extra_params)
    resp = requests.get(f"{BASE_URL}/{endpoint}", params=params)
    resp.raise_for_status()
    return resp.json()["data"]


def get_agents_es():
    return _fetch_es("agents", {"isPlayableCharacter": "true"})

def get_maps_es():
    return _fetch_es("maps")

def get_weapons_es():
    return _fetch_es("weapons")

def get_buddies_es():
    return _fetch_es("buddies")

def get_bundles_es():
    return _fetch_es("bundles")

def get_ceremonies_es():
    return _fetch_es("ceremonies")

def get_competitivetiers_es():
    return _fetch_es("competitivetiers")

def get_contenttiers_es():
    return _fetch_es("contenttiers")

def get_contracts_es():
    return _fetch_es("contracts")

def get_currencies_es():
    return _fetch_es("currencies")

def get_events_es():
    return _fetch_es("events")

def get_flex_es():
    return _fetch_es("flex")

def get_gamemodes_es():
    return _fetch_es("gamemodes")

def get_gear_es():
    return _fetch_es("gear")

def get_levelborders_es():
    return _fetch_es("levelborders")

def get_playercards_es():
    return _fetch_es("playercards")

def get_playertitles_es():
    return _fetch_es("playertitles")

def get_sprays_es():
    return _fetch_es("sprays")

def get_themes_es():
    return _fetch_es("themes")

def get_version_es():
    return _fetch_es("version")