"""Shared API dependency factories."""

from functools import lru_cache

from app.core.config import get_settings
from app.integrations.binance.private_demo_client import BinanceDemoPrivateClient
from app.integrations.binance.public_client import BinancePublicClient
from app.persistence.repositories import TradingStateRepositories
from app.persistence.service_adapters import (
    PersistentExecutionService,
    PersistentRiskService,
    PersistentSignalService,
)
from app.services.execution import DemoExecutionService
from app.services.indicators import IndicatorService
from app.services.journal_performance import JournalPerformanceService
from app.services.market_data import MarketDataService
from app.services.risk import RiskService
from app.services.scanner import ScannerService
from app.services.signals import SignalService
from app.services.trade_management import TradeManagementService
from app.services.universe import UniverseService

_runtime_repositories: TradingStateRepositories | None = None


def configure_runtime_repositories(repositories: TradingStateRepositories | None) -> None:
    """Set the app-scoped persistence boundary and rebuild dependent service caches."""

    global _runtime_repositories
    _runtime_repositories = repositories
    get_signal_service.cache_clear()
    get_risk_service.cache_clear()
    get_execution_service.cache_clear()
    get_trade_management_service.cache_clear()
    get_journal_performance_service.cache_clear()


@lru_cache
def get_public_market_client() -> BinancePublicClient:
    """Build one process-scoped Binance public client."""

    settings = get_settings()
    return BinancePublicClient(
        base_url=settings.binance_public_base_url,
        timeout_seconds=settings.market_request_timeout_seconds,
        retry_attempts=settings.market_retry_attempts,
        retry_base_delay_seconds=settings.market_retry_base_delay_seconds,
        rate_limit_max_delay_seconds=settings.market_rate_limit_max_delay_seconds,
    )


@lru_cache
def get_private_demo_client() -> BinanceDemoPrivateClient | None:
    """Build one process-scoped Binance demo private client when configured."""

    settings = get_settings()
    if not settings.demo_credentials_configured or settings.binance_demo_base_url is None:
        return None
    assert settings.binance_demo_api_key is not None
    assert settings.binance_demo_api_secret is not None
    return BinanceDemoPrivateClient(
        base_url=settings.binance_demo_base_url,
        api_key=settings.binance_demo_api_key.get_secret_value(),
        api_secret=settings.binance_demo_api_secret.get_secret_value(),
        timeout_seconds=settings.market_request_timeout_seconds,
        recv_window_ms=settings.binance_demo_recv_window_ms,
    )


@lru_cache
def get_market_service() -> MarketDataService:
    """Build one process-scoped Market Data service and cache."""

    settings = get_settings()
    return MarketDataService(
        get_public_market_client(),
        cache_ttl_seconds=settings.market_cache_ttl_seconds,
        stale_ttl_seconds=settings.market_stale_ttl_seconds,
    )


@lru_cache
def get_universe_service() -> UniverseService:
    """Build one process-scoped Universe service."""

    settings = get_settings()
    return UniverseService(
        get_public_market_client(),
        max_symbols=settings.universe_max_symbols,
        min_quote_volume=settings.universe_min_quote_volume,
        max_spread_bps=settings.universe_max_spread_bps,
    )


@lru_cache
def get_indicator_service() -> IndicatorService:
    """Build one process-scoped Indicator service."""

    return IndicatorService(get_market_service())


@lru_cache
def get_scanner_service() -> ScannerService:
    """Build one process-scoped deterministic Scanner runtime."""

    return ScannerService(
        get_market_service(),
        get_universe_service(),
        get_indicator_service(),
    )


@lru_cache
def get_signal_service() -> SignalService:
    """Build the Signal Engine with durable recovery when persistence is configured."""

    scanner = get_scanner_service()
    if _runtime_repositories is None:
        return SignalService(scanner)
    return PersistentSignalService(scanner, _runtime_repositories)


@lru_cache
def get_risk_service() -> RiskService:
    """Build the account-backed Risk Engine with durable decision audit records."""

    signal_service = get_signal_service()
    settings = get_settings()
    private_client = get_private_demo_client()
    if _runtime_repositories is None:
        return RiskService(signal_service, settings, private_client)
    return PersistentRiskService(
        signal_service,
        settings,
        private_client,
        _runtime_repositories,
    )


@lru_cache
def get_execution_service() -> DemoExecutionService:
    """Build Demo Execution with durable order, fill, position, and trade recovery."""

    risk_service = get_risk_service()
    settings = get_settings()
    private_client = get_private_demo_client()
    if _runtime_repositories is None:
        return DemoExecutionService(risk_service, settings, private_client)
    return PersistentExecutionService(
        risk_service,
        settings,
        private_client,
        _runtime_repositories,
    )


@lru_cache
def get_trade_management_service() -> TradeManagementService:
    """Build exchange-authoritative Trade Management over the durable execution store."""

    return TradeManagementService(get_execution_service(), get_private_demo_client())


@lru_cache
def get_journal_performance_service() -> JournalPerformanceService:
    """Build one process-scoped truthful Journal/Performance Engine."""

    return JournalPerformanceService(get_trade_management_service())
