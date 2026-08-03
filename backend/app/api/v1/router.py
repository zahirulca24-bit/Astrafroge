"""Version 1 API router."""

from fastapi import APIRouter

from app.api.v1.routes import (
    execution,
    health,
    indicators,
    journal_performance,
    market,
    risk,
    scanner,
    signals,
    system,
    trade_management,
    universe,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(system.router)
api_router.include_router(market.router)
api_router.include_router(universe.router)
api_router.include_router(indicators.router)
api_router.include_router(scanner.router)
api_router.include_router(signals.router)
api_router.include_router(risk.router)
api_router.include_router(execution.router)
api_router.include_router(trade_management.router)
api_router.include_router(journal_performance.router)
