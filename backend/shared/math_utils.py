import math


def safe_div(
    numerator: float,
    denominator: float,
    ndigits: int | None = None,
) -> float:
    """Return *numerator / denominator*, or 0.0 when *denominator* is zero."""
    if not denominator:
        return 0.0
    result = numerator / denominator
    return round(result, ndigits) if ndigits is not None else result


def euclidean_distance_2d(
    loc1: dict | None,
    loc2: dict | None,
) -> float | None:
    """Return the 2D euclidean distance between two location payloads."""
    if not loc1 or not loc2:
        return None

    x1 = loc1.get("x")
    y1 = loc1.get("y")
    x2 = loc2.get("x")
    y2 = loc2.get("y")

    if None in {x1, y1, x2, y2}:
        return None

    try:
        return math.hypot(float(x2) - float(x1), float(y2) - float(y1))
    except (TypeError, ValueError):
        return None
