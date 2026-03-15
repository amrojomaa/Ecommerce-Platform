import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, max_requests: int, window_seconds: int) -> None:
        now = time.time()
        window_start = now - window_seconds

        with self._lock:
            timestamps = self._hits[key]
            while timestamps and timestamps[0] < window_start:
                timestamps.popleft()

            if len(timestamps) >= max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later.",
                )

            timestamps.append(now)


rate_limiter = InMemoryRateLimiter()


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    client = request.client
    return client.host if client else "unknown"


def auth_rate_limit_dependency(max_requests: int, window_seconds: int):
    async def _dependency(request: Request) -> None:
        ip = _client_ip(request)
        key = f"auth:{request.url.path}:{ip}"
        rate_limiter.check(key, max_requests=max_requests, window_seconds=window_seconds)

    return _dependency
