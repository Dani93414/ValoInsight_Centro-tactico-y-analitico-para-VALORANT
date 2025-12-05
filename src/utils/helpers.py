# helpers.py
import uuid
import time
import random

def uid():
    return str(uuid.uuid4())

def now_ms():
    return int(time.time() * 1000)

def clamp(v, lo, hi):
    return max(lo, min(hi, v))
