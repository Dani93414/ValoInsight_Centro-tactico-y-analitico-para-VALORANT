"""One process-wide HenrikDev limiter shared by history and RAW detail calls."""
from __future__ import annotations

import time
from threading import Lock


class ThreadSafeRateLimiter:
    def __init__(self, rpm: int, safety_factor: float = 1.10) -> None:
        if rpm <= 0:
            raise ValueError("rpm must be > 0")
        self.min_interval = (60.0 / float(rpm)) * float(safety_factor)
        self._next_time = 0.0
        self._lock = Lock()

    def wait(self) -> None:
        with self._lock:
            delay = self._next_time - time.monotonic()
            if delay > 0:
                time.sleep(delay)
            self._next_time = time.monotonic() + self.min_interval

