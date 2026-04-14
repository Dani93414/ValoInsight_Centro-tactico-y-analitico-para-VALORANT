# helpers.py
import uuid
import time


def uid() -> str:
    return str(uuid.uuid4())

def now_ms() -> int:
    return int(time.time() * 1000)

def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))
