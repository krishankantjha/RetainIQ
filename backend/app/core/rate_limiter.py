import hashlib
import logging
import sys
import threading
import time

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

logger = logging.getLogger("backend.app.core.rate_limiter")


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Thread-safe, in-memory sliding-window rate limiting middleware.

    Restricts request frequency on ingestion, prediction, and authentication
    endpoints per client IP or hashed JWT session identity.

    Limits:
      - ``limit``           (default 60/min) for upload and explain paths.
      - ``auth_limit``      (default 10/min) for login.
      - ``recovery_limit``  (default 5/min) for register, reset, security-question.
    """

    def __init__(
        self,
        app,
        limit: int = 60,
        window_seconds: int = 60,
        auth_limit: int = 10,
        recovery_limit: int = 5,
    ):
        super().__init__(app)
        self.limit = limit
        self.auth_limit = auth_limit
        self.recovery_limit = recovery_limit
        self.window_seconds = window_seconds
        self.requests: dict = {}
        self.lock = threading.Lock()
        self._request_counter = 0
        self._api_prefix = settings.API_V1_STR.rstrip("/")

    def _auth_path(self, suffix: str) -> str:
        return f"{self._api_prefix}/auth{suffix}"

    def _get_client_key(self, request: Request, *, ip_only: bool = False) -> str:
        if not ip_only:
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                try:
                    token = auth_header.split(" ", 1)[1]
                    if token:
                        return hashlib.sha256(token.encode()).hexdigest()
                except IndexError:
                    pass
        client = request.client
        return client.host if client else "unknown"

    def _evict_stale_keys(self, now: float) -> None:
        stale = [
            k for k, ts_list in self.requests.items()
            if not any(now - t < self.window_seconds for t in ts_list)
        ]
        for k in stale:
            del self.requests[k]

    def _is_rate_limited(self, client_key: str, now: float, effective_limit: int) -> bool:
        history = self.requests.get(client_key, [])
        history = [t for t in history if now - t < self.window_seconds]

        if len(history) >= effective_limit:
            return True

        history.append(now)
        self.requests[client_key] = history
        return False

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        is_upload_or_explain = (
            path.startswith(f"{self._api_prefix}/upload") or "/explain" in path
        )
        is_login = path == self._auth_path("/login")
        is_auth_recovery = (
            path == self._auth_path("/register")
            or path == self._auth_path("/reset-password")
            or path.startswith(self._auth_path("/security-question/"))
        )

        should_limit = is_upload_or_explain or is_login or is_auth_recovery
        is_main_app = getattr(request.app, "title", "") == settings.APP_NAME
        if should_limit and ("pytest" not in sys.modules or not is_main_app):
            ip_only = is_login or is_auth_recovery
            client_key = self._get_client_key(request, ip_only=ip_only)
            if is_login:
                effective_limit = self.auth_limit
            elif is_auth_recovery:
                effective_limit = self.recovery_limit
            else:
                effective_limit = self.limit
            now = time.time()

            with self.lock:
                self._request_counter += 1
                if self._request_counter % 500 == 0:
                    self._evict_stale_keys(now)

                if self._is_rate_limited(client_key, now, effective_limit):
                    logger.warning(
                        f"Rate limit exceeded for client {client_key[:16]}... "
                        f"on path {path} (limit={effective_limit}/min)"
                    )
                    return JSONResponse(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        content={"detail": "Too many requests. Please try again later."},
                    )

        return await call_next(request)
