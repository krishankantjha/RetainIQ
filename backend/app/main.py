import os
import sys

# Project root (parent of backend/) — required for configs/ and ml/ imports
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.core.logging  # Trigger logging configuration
from app.api.routes.analytics import router as analytics_router
from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.api.routes.predict import router as predict_router
from app.core.config import settings
from app.core.rate_limiter import RateLimiterMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    startup_event()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

_allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
if settings.APP_ENV != "production":
    for default_origin in [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost",
    ]:
        if default_origin not in _allowed_origins:
            _allowed_origins.append(default_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.add_middleware(
    RateLimiterMiddleware,
    limit=60,
    window_seconds=60,
)

app.include_router(health_router)
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(predict_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)


def startup_event():
    """Eagerly load and validate all ML artifacts on application boot."""
    import logging
    import sys

    logger = logging.getLogger("backend.app.main")
    logger.info("Initializing startup validation: Eagerly loading ML artifacts...")
    try:
        from app.services.prediction_service import load_artifacts
        load_artifacts()
        logger.info("Startup validation succeeded. All artifacts verified and loaded.")
    except Exception as e:
        logger.critical(
            f"Startup validation failed! Critical ML artifacts are missing or corrupt: {e}",
            exc_info=True,
        )
        sys.exit(1)
