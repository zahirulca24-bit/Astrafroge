"""FastAPI application factory."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.dependencies import (
    configure_runtime_repositories,
    get_execution_service,
    get_scanner_service,
)
from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import AppError, register_exception_handlers
from app.core.logging import configure_logging
from app.core.security import MUTATION_OPENAPI_PATHS, MutationReplayGuard
from app.persistence import Persistence, TradingStateRepositories

mutation_logger = logging.getLogger("astraforge.mutation_audit")
execution_logger = logging.getLogger("astraforge.execution")
scanner_logger = logging.getLogger("astraforge.scanner")


def _audit_mutation(request: Request, *, request_id: str, status_code: int) -> None:
    audit = getattr(request.state, "mutation_audit", None)
    if not isinstance(audit, dict):
        return
    outcome = (
        "success"
        if status_code < 400
        else "rejected"
        if status_code < 500
        else "failed"
    )
    mutation_logger.info(
        "Mutation request audited",
        extra={
            "request_id": request_id,
            **audit,
            "outcome": outcome,
            "status_code": status_code,
        },
    )


def _configure_mutation_openapi(application: FastAPI, *, api_prefix: str) -> None:
    """Publish the runtime-required Idempotency-Key contract accurately."""

    original_openapi = application.openapi

    def custom_openapi() -> dict[str, Any]:
        schema = original_openapi()
        paths = schema.get("paths")
        if not isinstance(paths, dict):
            return schema

        for relative_path in MUTATION_OPENAPI_PATHS:
            path_item = paths.get(f"{api_prefix}{relative_path}")
            if not isinstance(path_item, dict):
                continue
            operation = path_item.get("post")
            if not isinstance(operation, dict):
                continue
            parameters = operation.get("parameters")
            if not isinstance(parameters, list):
                continue
            for parameter in parameters:
                if not isinstance(parameter, dict):
                    continue
                name = parameter.get("name")
                location = parameter.get("in")
                if (
                    isinstance(name, str)
                    and name.lower() == "idempotency-key"
                    and location == "header"
                ):
                    parameter["required"] = True
                    parameter_schema = parameter.get("schema")
                    if isinstance(parameter_schema, dict):
                        parameter_schema["minLength"] = 16
                        parameter_schema["maxLength"] = 128
                        parameter_schema["pattern"] = r"^[A-Za-z0-9._:-]{16,128}$"
        return schema

    application.openapi = custom_openapi  # type: ignore[method-assign]


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure the AstraForge FastAPI application."""

    resolved_settings = settings or get_settings()
    configure_logging(resolved_settings)
    persistence = Persistence.from_settings(resolved_settings)
    repositories = TradingStateRepositories(persistence) if persistence is not None else None
    configure_runtime_repositories(repositories)

    async def auto_execute_loop() -> None:
        service = get_execution_service()
        while True:
            try:
                activated = service.auto_execute_pending()
                if activated:
                    execution_logger.info(
                        "Auto-executed approved demo plans",
                        extra={"activated_count": activated},
                    )
            except AppError as exc:
                execution_logger.warning(
                    "Auto execution cycle failed closed",
                    extra={"code": exc.code, "message": str(exc)},
                )
            except Exception:
                execution_logger.exception("Unexpected auto execution cycle failure")
            await asyncio.sleep(5)

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        startup_tasks: list[asyncio.Task[None]] = []
        if persistence is not None:
            persistence.initialize(
                migrate_schema=resolved_settings.database_migrate_on_startup
            )
            application.state.persistence = persistence
            application.state.trading_state_repositories = repositories
        else:
            application.state.persistence = None
            application.state.trading_state_repositories = None
        if resolved_settings.scanner_auto_start:
            service = get_scanner_service()

            async def start_scanner() -> None:
                await service.start()
                await asyncio.sleep(5)
                latest_run = service.latest_run()
                if latest_run is None or latest_run.universe_size == 0:
                    retry_run = await service.run_now()
                    scanner_logger.info(
                        "Initial full-universe scanner run retried after startup",
                        extra={
                            "run_id": retry_run.run_id,
                            "status": retry_run.status.value,
                            "universe_size": retry_run.universe_size,
                            "evaluated_symbols": retry_run.evaluated_symbols,
                        },
                    )

            startup_tasks.append(asyncio.create_task(start_scanner()))
            await asyncio.sleep(0)
        if resolved_settings.execution_enabled:
            startup_tasks.append(asyncio.create_task(auto_execute_loop()))
        try:
            yield
        finally:
            for startup_task in startup_tasks:
                if not startup_task.done():
                    startup_task.cancel()
                    with suppress(asyncio.CancelledError):
                        await startup_task
            if resolved_settings.scanner_auto_start:
                with suppress(asyncio.CancelledError):
                    await get_scanner_service().stop()
            configure_runtime_repositories(None)
            if persistence is not None:
                persistence.close()

    application = FastAPI(
        title=resolved_settings.app_name,
        version=resolved_settings.app_version,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url=f"{resolved_settings.api_prefix}/openapi.json",
        lifespan=lifespan,
    )
    application.state.settings = resolved_settings
    application.state.mutation_replay_guard = MutationReplayGuard(
        ttl_seconds=resolved_settings.mutation_replay_ttl_seconds,
        cache_limit=resolved_settings.mutation_replay_cache_limit,
        repositories=repositories,
    )
    application.dependency_overrides[get_settings] = lambda: resolved_settings

    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origins,
        allow_credentials=resolved_settings.cors_allow_credentials,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Idempotency-Key",
            "X-Request-ID",
        ],
    )

    @application.middleware("http")
    async def request_id_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        request.state.request_id = request_id
        try:
            response = await call_next(request)
        except Exception:
            _audit_mutation(request, request_id=request_id, status_code=500)
            raise
        response.headers["X-Request-ID"] = request_id
        _audit_mutation(
            request,
            request_id=request_id,
            status_code=response.status_code,
        )
        return response

    register_exception_handlers(application)
    application.include_router(api_router, prefix=resolved_settings.api_prefix)
    _configure_mutation_openapi(
        application,
        api_prefix=resolved_settings.api_prefix,
    )
    return application


app = create_app()
