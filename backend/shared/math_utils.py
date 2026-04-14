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
