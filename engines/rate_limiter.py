import time
import threading
from collections import deque


class RateLimiter:

    def __init__(self, max_calls: int, period_seconds: float, name: str = "RateLimiter"):
        self.max_calls = max_calls
        self.period = period_seconds
        self.name = name
        self._lock = threading.Lock()
        self._calls: deque = deque()  # stores timestamps of recent calls

    def acquire(self) -> None:
        """
        Block until a call slot is available, then record the call.
        Prints a warning if the caller has to wait.
        """
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
                    return

                # Window is full — calculate how long to wait
                oldest = self._calls[0]
                wait_time = self.period - (now - oldest)

            # Release the lock while sleeping so other threads can check
            print(
                f"\n⏳ [{self.name}] Rate limit reached "
                f"({self.max_calls} calls/{self.period:.0f}s). "
                f"Waiting {wait_time:.1f}s..."
            )
            time.sleep(max(wait_time, 0.05))

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
