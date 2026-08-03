"""Closed-trade journal and performance reporting."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from app.schemas.execution import DemoTradeLifecycle, DemoTradeRecord
from app.schemas.journal_performance import (
    JournalEntry,
    JournalEntryList,
    JournalFilters,
    JournalPerformanceState,
    JournalPerformanceStatusResponse,
    JournalPerformanceSummary,
    JournalSortBy,
    PerformanceSnapshotResponse,
)
from app.schemas.scanner import ScannerGrade
from app.schemas.trade_management import TradeListFilters, TradeManagementState
from app.services.trade_management import TradeManagementService


class JournalPerformanceService:
    """Project closed tracked demo trades into journal and performance views."""

    def __init__(self, trade_management_service: TradeManagementService) -> None:
        self._trade_management = trade_management_service

    def status(self) -> JournalPerformanceStatusResponse:
        trade_management_status = self._trade_management.status()
        closed_trades = self._closed_trades()
        snapshot = self.performance()
        latest_closed_trade_at = max(
            (trade.closed_at for trade in closed_trades if trade.closed_at is not None),
            default=None,
        )
        updated_at = max(
            (
                trade.updated_at
                for trade in closed_trades
            ),
            default=trade_management_status.updated_at,
        )
        return JournalPerformanceStatusResponse(
            state=self._state_from_trade_management(trade_management_status.state),
            trade_management_state=trade_management_status.state,
            lookback_days=snapshot.lookback_days,
            latest_closed_trade_at=latest_closed_trade_at,
            updated_at=updated_at,
            summary=snapshot.summary,
        )

    def journal(self, filters: JournalFilters) -> JournalEntryList:
        trades = self._closed_trades()
        if filters.symbol is not None:
            trades = [trade for trade in trades if trade.symbol == filters.symbol]
        if filters.direction is not None:
            trades = [trade for trade in trades if trade.direction is filters.direction]
        if filters.min_grade is not None:
            trades = [
                trade
                for trade in trades
                if self._meets_min_grade(trade, filters.min_grade)
            ]
        if filters.close_reason is not None:
            trades = [trade for trade in trades if trade.closed_reason is filters.close_reason]

        if filters.sort_by is JournalSortBy.REALIZED_PNL_DESC:
            trades = sorted(
                trades,
                key=lambda trade: (trade.realized_pnl_usdt, trade.closed_at),
                reverse=True,
            )
        elif filters.sort_by is JournalSortBy.REALIZED_PNL_ASC:
            trades = sorted(
                trades,
                key=lambda trade: (trade.realized_pnl_usdt, trade.closed_at),
            )
        else:
            trades = sorted(
                trades,
                key=lambda trade: trade.closed_at or trade.updated_at,
                reverse=True,
            )

        entries = [self._to_journal_entry(trade) for trade in trades]
        return JournalEntryList(count=len(entries), entries=entries)

    def performance(self, lookback_days: int = 30) -> PerformanceSnapshotResponse:
        now = datetime.now(UTC)
        window_started_at = now - timedelta(days=lookback_days)
        window_trades = [
            trade
            for trade in self._closed_trades()
            if trade.closed_at is not None and trade.closed_at >= window_started_at
        ]

        winning = [trade for trade in window_trades if trade.realized_pnl_usdt > 0]
        losing = [trade for trade in window_trades if trade.realized_pnl_usdt < 0]
        breakeven = [trade for trade in window_trades if trade.realized_pnl_usdt == 0]
        closed_count = len(window_trades)
        realized_pnl = sum((trade.realized_pnl_usdt for trade in window_trades), Decimal("0"))
        win_rate = (
            (Decimal(len(winning)) / Decimal(closed_count) * Decimal("100")).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )
            if closed_count
            else Decimal("0")
        )
        average_win = (
            sum((trade.realized_pnl_usdt for trade in winning), Decimal("0"))
            / Decimal(len(winning))
            if winning
            else None
        )
        average_loss = (
            sum((trade.realized_pnl_usdt for trade in losing), Decimal("0"))
            / Decimal(len(losing))
            if losing
            else None
        )
        summary = JournalPerformanceSummary(
            closed_trade_count=closed_count,
            winning_trades=len(winning),
            losing_trades=len(losing),
            breakeven_trades=len(breakeven),
            realized_pnl_usdt=realized_pnl,
            commission_usdt=sum(
                (trade.commission_usdt for trade in window_trades),
                Decimal("0"),
            ),
            funding_fees_usdt=sum(
                (trade.funding_fees_usdt for trade in window_trades),
                Decimal("0"),
            ),
            win_rate_percent=win_rate,
            average_win_usdt=average_win,
            average_loss_usdt=average_loss,
            best_trade_pnl_usdt=max(
                (trade.realized_pnl_usdt for trade in window_trades),
                default=None,
            ),
            worst_trade_pnl_usdt=min(
                (trade.realized_pnl_usdt for trade in window_trades),
                default=None,
            ),
        )
        return PerformanceSnapshotResponse(
            lookback_days=lookback_days,
            window_started_at=window_started_at,
            window_ended_at=now,
            summary=summary,
        )

    def _closed_trades(self) -> list[DemoTradeRecord]:
        return [
            trade
            for trade in self._trade_management.trades(
                TradeListFilters(include_closed=True)
            ).trades
            if trade.lifecycle is DemoTradeLifecycle.CLOSED and trade.closed_at is not None
        ]

    @staticmethod
    def _to_journal_entry(trade: DemoTradeRecord) -> JournalEntry:
        closed_at = trade.closed_at or trade.updated_at
        hold_minutes = max(
            0,
            int((closed_at - trade.opened_at).total_seconds() // 60),
        )
        return JournalEntry(
            trade_id=trade.trade_id,
            signal_id=trade.signal_id,
            symbol=trade.symbol,
            direction=trade.direction,
            setup=trade.setup,
            setup_name=trade.setup_name,
            grade=trade.grade,
            entry_price=trade.entry_price,
            exit_price=trade.exit_price,
            tracked_margin_usdt=trade.tracked_margin_usdt,
            realized_pnl_usdt=trade.realized_pnl_usdt,
            gross_realized_pnl_usdt=trade.gross_realized_pnl_usdt,
            commission_usdt=trade.commission_usdt,
            funding_fees_usdt=trade.funding_fees_usdt,
            opened_at=trade.opened_at,
            closed_at=closed_at,
            closed_reason=trade.closed_reason,
            hold_minutes=hold_minutes,
        )

    @staticmethod
    def _state_from_trade_management(
        trade_management_state: TradeManagementState,
    ) -> JournalPerformanceState:
        if trade_management_state is TradeManagementState.WAITING_FOR_EXECUTION:
            return JournalPerformanceState.WAITING_FOR_TRADE_MANAGEMENT
        return JournalPerformanceState.READY

    @staticmethod
    def _meets_min_grade(trade: DemoTradeRecord, minimum: ScannerGrade) -> bool:
        ranking = {
            "A+": 3,
            "A": 2,
            "B+": 1,
            "Reject": 0,
        }
        trade_rank = ranking.get(trade.grade.value, -1) if trade.grade is not None else -1
        return trade_rank >= ranking[minimum.value]
