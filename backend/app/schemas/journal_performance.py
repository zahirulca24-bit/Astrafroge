"""Typed Journal and Performance Engine contracts."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field

from app.schemas.execution import DemoTradeCloseReason
from app.schemas.scanner import ScannerDirection, ScannerGrade, ScannerSetup
from app.schemas.trade_management import TradeManagementState


class JournalPerformanceState(StrEnum):
    """Current readiness of the journal and performance layer."""

    READY = "READY"
    WAITING_FOR_TRADE_MANAGEMENT = "WAITING_FOR_TRADE_MANAGEMENT"


class JournalSortBy(StrEnum):
    """Supported journal sorting modes."""

    CLOSED_AT_DESC = "CLOSED_AT_DESC"
    REALIZED_PNL_DESC = "REALIZED_PNL_DESC"
    REALIZED_PNL_ASC = "REALIZED_PNL_ASC"


class JournalEntry(BaseModel):
    """One closed tracked demo trade rendered for journal review."""

    trade_id: str
    signal_id: str
    symbol: str
    direction: ScannerDirection
    setup: ScannerSetup
    setup_name: str
    grade: ScannerGrade | None = None
    entry_price: Decimal
    exit_price: Decimal | None = None
    tracked_margin_usdt: Decimal = Field(ge=0)
    realized_pnl_usdt: Decimal = Field(default=Decimal("0"))
    gross_realized_pnl_usdt: Decimal = Field(default=Decimal("0"))
    commission_usdt: Decimal = Field(default=Decimal("0"))
    funding_fees_usdt: Decimal = Field(default=Decimal("0"))
    opened_at: datetime
    closed_at: datetime
    closed_reason: DemoTradeCloseReason
    hold_minutes: int = Field(ge=0)


class JournalEntryList(BaseModel):
    """Filtered closed-trade journal response."""

    count: int = Field(ge=0)
    entries: list[JournalEntry]


class JournalPerformanceSummary(BaseModel):
    """Headline summary metrics for dashboard and journal UI."""

    closed_trade_count: int = Field(default=0, ge=0)
    winning_trades: int = Field(default=0, ge=0)
    losing_trades: int = Field(default=0, ge=0)
    breakeven_trades: int = Field(default=0, ge=0)
    realized_pnl_usdt: Decimal = Field(default=Decimal("0"))
    commission_usdt: Decimal = Field(default=Decimal("0"))
    funding_fees_usdt: Decimal = Field(default=Decimal("0"))
    win_rate_percent: Decimal = Field(default=Decimal("0"))
    average_win_usdt: Decimal | None = None
    average_loss_usdt: Decimal | None = None
    best_trade_pnl_usdt: Decimal | None = None
    worst_trade_pnl_usdt: Decimal | None = None


class JournalPerformanceStatusResponse(BaseModel):
    """Current journal-performance readiness and 30-day headline metrics."""

    state: JournalPerformanceState
    journal_performance_implemented: bool = True
    trade_management_state: TradeManagementState
    lookback_days: int = Field(default=30, ge=1, le=365)
    latest_closed_trade_at: datetime | None = None
    updated_at: datetime | None = None
    summary: JournalPerformanceSummary


class PerformanceSnapshotResponse(BaseModel):
    """Windowed performance metrics derived from closed tracked trades."""

    lookback_days: int = Field(ge=1, le=365)
    window_started_at: datetime
    window_ended_at: datetime
    summary: JournalPerformanceSummary


class JournalFilters(BaseModel):
    """Normalized closed-trade journal filters."""

    symbol: str | None = None
    direction: ScannerDirection | None = None
    min_grade: ScannerGrade | None = None
    close_reason: DemoTradeCloseReason | None = None
    sort_by: JournalSortBy = JournalSortBy.CLOSED_AT_DESC
