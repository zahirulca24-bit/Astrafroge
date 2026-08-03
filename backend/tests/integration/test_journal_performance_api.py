"""Journal and Performance API integration tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient

from app.api.v1.dependencies import get_journal_performance_service
from app.main import create_app
from app.schemas.execution import DemoTradeCloseReason
from app.schemas.journal_performance import (
    JournalEntry,
    JournalEntryList,
    JournalPerformanceState,
    JournalPerformanceStatusResponse,
    JournalPerformanceSummary,
    PerformanceSnapshotResponse,
)
from app.schemas.scanner import ScannerDirection, ScannerGrade, ScannerSetup
from app.schemas.trade_management import TradeManagementState

NOW = datetime(2026, 7, 16, 12, 0, tzinfo=UTC)


class StubJournalPerformance:
    def __init__(self) -> None:
        self.entry = JournalEntry(
            trade_id="a" * 36,
            signal_id="1" * 64,
            symbol="BTCUSDT",
            direction=ScannerDirection.LONG,
            setup=ScannerSetup.TREND_PULLBACK,
            setup_name="Trend Pullback",
            grade=ScannerGrade.A_PLUS,
            entry_price=Decimal("101"),
            exit_price=Decimal("105"),
            tracked_margin_usdt=Decimal("25"),
            realized_pnl_usdt=Decimal("4"),
            opened_at=NOW - timedelta(hours=2),
            closed_at=NOW - timedelta(hours=1),
            closed_reason=DemoTradeCloseReason.TAKE_PROFIT,
            hold_minutes=60,
        )

    def status(self) -> JournalPerformanceStatusResponse:
        return JournalPerformanceStatusResponse(
            state=JournalPerformanceState.READY,
            trade_management_state=TradeManagementState.READY,
            lookback_days=30,
            latest_closed_trade_at=NOW - timedelta(hours=1),
            updated_at=NOW,
            summary=JournalPerformanceSummary(
                closed_trade_count=1,
                winning_trades=1,
                realized_pnl_usdt=Decimal("4"),
                win_rate_percent=Decimal("100.00"),
                average_win_usdt=Decimal("4"),
                best_trade_pnl_usdt=Decimal("4"),
                worst_trade_pnl_usdt=Decimal("4"),
            ),
        )

    def journal(self, filters):  # type: ignore[no-untyped-def]
        return JournalEntryList(count=1, entries=[self.entry])

    def performance(self, lookback_days: int = 30) -> PerformanceSnapshotResponse:
        return PerformanceSnapshotResponse(
            lookback_days=lookback_days,
            window_started_at=NOW - timedelta(days=lookback_days),
            window_ended_at=NOW,
            summary=JournalPerformanceSummary(
                closed_trade_count=1,
                winning_trades=1,
                realized_pnl_usdt=Decimal("4"),
                win_rate_percent=Decimal("100.00"),
                average_win_usdt=Decimal("4"),
                best_trade_pnl_usdt=Decimal("4"),
                worst_trade_pnl_usdt=Decimal("4"),
            ),
        )


def test_journal_performance_api_contract(settings) -> None:  # type: ignore[no-untyped-def]
    stub = StubJournalPerformance()
    app = create_app(settings)
    app.dependency_overrides[get_journal_performance_service] = lambda: stub
    with TestClient(app) as client:
        status = client.get("/api/v1/journal-performance/status")
        assert status.status_code == 200
        assert status.json()["state"] == "READY"
        journal = client.get(
            "/api/v1/journal-performance/journal",
            params={
                "symbol": "btcusdt",
                "direction": "LONG",
                "min_grade": "A",
                "close_reason": "TAKE_PROFIT",
                "sort_by": "CLOSED_AT_DESC",
            },
        )
        assert journal.status_code == 200
        assert journal.json()["count"] == 1
        performance = client.get(
            "/api/v1/journal-performance/performance",
            params={"lookback_days": 30},
        )
        assert performance.status_code == 200
        invalid_symbol = client.get(
            "/api/v1/journal-performance/journal",
            params={"symbol": "***"},
        )
        assert invalid_symbol.status_code == 422
