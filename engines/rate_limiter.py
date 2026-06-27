import time
import threading
from collections import deque
from typing import Optional


class RateLimiter:

    def __init__(self, max_calls: int, period_seconds: float, name: str = "RateLimiter"):
        self.max_calls = max_calls
        self.period = period_seconds
        self.name = name
        self._lock = threading.Lock()
        self._calls: deque = deque()  # stores timestamps of recent calls

    def acquire(self, timeout: Optional[float] = None) -> bool:
        """Reserve a call slot, waiting for one to free up if necessary.

        Args:
            timeout: Maximum number of seconds to wait for a slot. ``None``
                (the default) blocks indefinitely until a slot is available —
                the original behaviour. When a budget is given, the limiter
                fails fast instead of hanging: if the next slot would only
                free up *after* the budget elapses, it returns immediately
                without consuming a slot.

        Returns:
            ``True`` if a slot was reserved, ``False`` if the timeout budget
            was exhausted before one became available.
        """
        deadline = None if timeout is None else time.monotonic() + timeout

        while True:
            with self._lock:
                now = time.monotonic()
                window_start = now - self.period

                # Drop timestamps that are outside the current window
                while self._calls and self._calls[0] <= window_start:
                    self._calls.popleft()

                if len(self._calls) < self.max_calls:
                    # Slot available — record this call and proceed
                    self._calls.append(now)
                    return True

                # Window is full — calculate how long to wait
                oldest = self._calls[0]
                wait_time = max(self.period - (now - oldest), 0.05)

            # Fail fast: if waiting for the slot would blow the budget, give up
            # now rather than sleeping and hanging the caller (e.g. /api/agent).
            if deadline is not None and time.monotonic() + wait_time > deadline:
                print(
                    f"\n⚠️  [{self.name}] Rate limit reached "
                    f"({self.max_calls} calls/{self.period:.0f}s) and wait "
                    f"(~{wait_time:.1f}s) exceeds budget — skipping this call."
                )
                return False

            # Release the lock while sleeping so other threads can check
            print(
                f"\n⏳ [{self.name}] Rate limit reached "
                f"({self.max_calls} calls/{self.period:.0f}s). "
                f"Waiting {wait_time:.1f}s..."
            )
            time.sleep(wait_time)

    def __enter__(self):
        self.acquire()
        return self

    def __exit__(self, *args):
        pass


# ── Pre-built shared limiters ────────────────────────────────────────────────

# Applied to every outgoing HTTP request to the KAMIS website
kamis_http_limiter = RateLimiter(
    max_calls=5,
    period_seconds=60,
    name="KAMIS HTTP"
)

# Applied to every user query processed by the agent
agent_query_limiter = RateLimiter(
    max_calls=5,
    period_seconds=60,
    name="Agent Query"
)
