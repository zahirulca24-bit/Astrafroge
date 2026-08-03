"""Journal and Performance Engine unit tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app.schemas.execution import (
    DemoProtectionState,
    DemoTradeCloseReason,
    DemoTradeLifecycle,
    DemoTradeRecord,
)
from app.schemas.journal_performance import JournalFilters, JournalPerformanceState
from app.schemas.scanner import ScannerDirection, ScannerGrade, ScannerSetup
from app.schemas.trade_management import (
    ManagedTradeRecordList,
    TradeManagementState,
    TradeManagementStatusResponse,
    TradeManagementSummary,
)
from app.services.journal_performance import JournalPerformanceService

NOW = datetime(2026, 7, 16, 12, 0, tzinfo=UTC)


def _trade(
    *,
    trade_id: str,
    signal_id: str,
    symbol: str,
    direction: ScannerDirection,
    lifecycle: DemoTradeLifecycle,
    grade: ScannerGrade,
    entry_price: Decimal,
    exit_price: Decimal | None,
    margin: Decimal,
    unrealized: Decimal,
    realized: Decimal,
    gross_realized: Decimal = Decimal("0"),
    commission: Decimal = Decimal("0"),
    funding: Decimal = Decimal("0"),
    opened_at: datetime,
    updated_at: datetime,
    closed_at: datetime | None = None,
    close_reason: DemoTradeCloseReason | None = None,
) -> DemoTradeRecord:
    return DemoTradeRecord(
        trade_id=trade_id,
        signal_id=signal_id,
        symbol=symbol,
        direction=direction,
        setup=ScannerSetup.TREND_PULLBACK,
        setup_name="Trend Pullback",
        lifecycle=lifecycle,
        protection_state=DemoProtectionState.PROTECTED,
        grade=grade,
        entry_price=entry_price,
        stop_loss_price=Decimal("95") if direction is ScannerDirection.LONG else Decimal("105"),
        take_profit_price=(
            Decimal("110") if direction is ScannerDirection.LONG else Decimal("90")
        ),
        exit_price=exit_price,
        exchange_order_id=f"entry-{trade_id[:4]}",
        client_order_id=f"af-e-{signal_id[:20]}",
        stop_order_id=f"stop-{trade_id[:4]}",
        stop_client_order_id=f"af-s-{signal_id[:20]}",
        take_profit_order_id=f"take-{trade_id[:4]}",
        take_profit_client_order_id=f"af-t-{signal_id[:20]}",
        requested_quantity=Decimal("1"),
        executed_quantity=Decimal("1"),
        order_status="FILLED",
        tracked_margin_usdt=margin,
        unrealized_pnl_usdt=unrealized,
        realized_pnl_usdt=realized,
        gross_realized_pnl_usdt=gross_realized,
        commission_usdt=commission,
        funding_fees_usdt=funding,
        opened_at=opened_at,
        closed_at=closed_at,
        closed_reason=close_reason,
        updated_at=updated_at,
    )


class StubTradeManagement:
    def __init__(self) -> None:
        self._trades = [
            _trade(
                trade_id="a" * 36,
                signal_id="1" * 64,
                symbol="BTCUSDT",
                direction=ScannerDirection.LONG,
                lifecycle=DemoTradeLifecycle.CLOSED,
                grade=ScannerGrade.A_PLUS,
                entry_price=Decimal("101"),
                exit_price=Decimal("105"),
                margin=Decimal("25"),
                unrealized=Decimal("0"),
                realized=Decimal("4"),
                gross_realized=Decimal("4.1"),
                commission=Decimal("-0.1"),
                opened_at=NOW - timedelta(hours=2),
                closed_at=NOW - timedelta(hours=1),
                close_reason=DemoTradeCloseReason.TAKE_PROFIT,
                updated_at=NOW - timedelta(hours=1),
            ),
            _trade(
                trade_id="b" * 36,
                signal_id="2" * 64,
                symbol="ETHUSDT",
                direction=ScannerDirection.SHORT,
                lifecycle=DemoTradeLifecycle.CLOSED,
                grade=ScannerGrade.A,
                entry_price=Decimal("99"),
                exit_price=Decimal("101"),
                margin=Decimal("15"),
                unrealized=Decimal("0"),
                realized=Decimal("-2"),
                gross_realized=Decimal("-1.9"),
                commission=Decimal("-0.1"),
                opened_at=NOW - timedelta(days=2, hours=3),
                closed_at=NOW - timedelta(days=2, hours=1),
                close_reason=DemoTradeCloseReason.STOP_LOSS,
                updated_at=NOW - timedelta(days=2, hours=1),
            ),
            _trade(
                trade_id="c" * 36,
                signal_id="3" * 64,
                symbol="SOLUSDT",
                direction=ScannerDirection.LONG,
                lifecycle=DemoTradeLifecycle.OPEN,
                grade=ScannerGrade.B_PLUS,
                entry_price=Decimal("150"),
                exit_price=None,
                margin=Decimal("10"),
                unrealized=Decimal("1"),
                realized=Decimal("0"),
                opened_at=NOW,
                updated_at=NOW,
            ),
        ]

    def status(self) -> TradeManagementStatusResponse:
        return TradeManagementStatusResponse(
            state=TradeManagementState.READY,
            execution_engine_state="READY",
            max_open_trades_limit=4,
            tracked_trade_count=3,
            open_trade_count=1,
            available_tracking_slots=3,
            updated_at=NOW,
            summary=TradeManagementSummary(manual_demo_trades=1),
        )

    def trades(self, filters):  # type: ignore[no-untyped-def]
        return ManagedTradeRecordList(count=len(self._trades), trades=self._trades)


def test_journal_performance_status_uses_closed_trades() -> None:
    service = JournalPerformanceService(StubTradeManagement())  # type: ignore[arg-type]

    status = service.status()
    assert status.state is JournalPerformanceState.READY
    assert status.summary.closed_trade_count == 2
    assert status.summary.winning_trades == 1
    assert status.summary.losing_trades == 1
    assert status.summary.realized_pnl_usdt == Decimal("2")


def test_journal_performance_filters_closed_trade_entries() -> None:
    service = JournalPerformanceService(StubTradeManagement())  # type: ignore[arg-type]

    journal = service.journal(
        JournalFilters(
            symbol="BTCUSDT",
            direction=ScannerDirection.LONG,
            min_grade=ScannerGrade.A,
            close_reason=DemoTradeCloseReason.TAKE_PROFIT,
        )
    )

    assert journal.count == 1
    assert journal.entries[0].hold_minutes == 60
    assert journal.entries[0].gross_realized_pnl_usdt == Decimal("4.1")
    assert journal.entries[0].commission_usdt == Decimal("-0.1")


def test_journal_performance_window_metrics() -> None:
    service = JournalPerformanceService(StubTradeManagement())  # type: ignore[arg-type]

    snapshot = service.performance(lookback_days=30)
    assert snapshot.summary.win_rate_percent == Decimal("50.00")
    assert snapshot.summary.average_win_usdt == Decimal("4")
    assert snapshot.summary.average_loss_usdt == Decimal("-2")
    assert snapshot.summary.commission_usdt == Decimal("-0.2")
