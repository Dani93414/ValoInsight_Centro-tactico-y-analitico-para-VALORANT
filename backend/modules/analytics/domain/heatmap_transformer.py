from __future__ import annotations

from typing import Any, Dict


def transform_coords(game_x: float, game_y: float, tf: Dict[str, float]) -> tuple[float, float]:
    """
    Convert in-game coordinates to normalised 0-1 image coordinates.

    IMPORTANT: the game axes are swapped - game_y feeds x, game_x feeds y.
    """
    nx = game_y * tf["x_mult"] + tf["x_add"]
    ny = game_x * tf["y_mult"] + tf["y_add"]
    return (nx, ny)


def build_transform_meta(tf: Dict[str, float]) -> Dict[str, Any]:
    return {
        "xMultiplier": tf["x_mult"],
        "xScalarToAdd": tf["x_add"],
        "yMultiplier": tf["y_mult"],
        "yScalarToAdd": tf["y_add"],
        "axis_swap": {
            "x_from": "game_y",
            "y_from": "game_x",
        },
        "origin": "top-left",
        "invert_y": False,
    }
