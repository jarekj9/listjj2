import logging
import math
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .db import init_db
from .mcp_server import mcp
from .routers import auth, categories, external, files, items, meta, users
from .services import BadRequest, NotFound, Unauthorized

logging.basicConfig(level=logging.INFO)


def _json_safe(value):
    if isinstance(value, float) and not math.isfinite(value):
        return repr(value)
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    init_db()
    # the mounted MCP app does not run its own lifespan, so the session manager is started here
    async with mcp.session_manager.run():
        yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Listjj API",
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or ["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    for module in (auth, users, categories, items, files, external, meta):
        app.include_router(module.router, prefix="/api")
    app.include_router(external.legacy_router, prefix="/api")
    app.include_router(auth.settings_router, prefix="/api")

    @app.exception_handler(NotFound)
    async def _not_found(_: Request, exc: NotFound) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(BadRequest)
    async def _bad_request(_: Request, exc: BadRequest) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(Unauthorized)
    async def _unauthorized(_: Request, exc: Unauthorized) -> JSONResponse:
        return JSONResponse(status_code=401, content={"detail": str(exc)})

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": jsonable_encoder(_json_safe(exc.errors()))})

    # MCP endpoint is served at /mcp (mounted last so API routes win)
    app.mount("/", mcp.streamable_http_app())
    return app


app = create_app()
