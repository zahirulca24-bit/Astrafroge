"""Derive a safe, non-executable developing-setup layer from scanner audits."""

from __future__ import annotations

from app.schemas.early_watch import EarlyWatchItem, EarlyWatchList
from app.schemas.scanner import ScannerRunSummary

_DEVELOPING_CODES: tuple[str, ...] = (
    "TREND_MIXED",
    "PULLBACK_SEQUENCE_FAILED",
    "PULLBACK_ZONE_MISSED",
    "BREAKOUT_NOT_CONFIRMED",
    "RETEST_NOT_CONFIRMED",
    "EMA_REJECTION_NOT_CONFIRMED",
    "LIQUIDITY_SWEEP_NOT_CONFIRMED",
    "CONTINUATION_COMPRESSION_FAILED",
    "CONTINUATION_BREAKOUT_FAILED",
    "VOLUME_BELOW_MINIMUM",
)
_CODE_PRIORITY = {code: index for index, code in enumerate(_DEVELOPING_CODES)}


def build_early_watch(run: ScannerRunSummary | None) -> EarlyWatchList:
    """Build one best developing reason per symbol from the latest full scan.

    These records are deliberately separate from ScannerCandidate and therefore
    cannot enter signal, risk, planning, or execution services.
    """

    if run is None:
        return EarlyWatchList(count=0, items=[])

    selected: dict[str, EarlyWatchItem] = {}
    selected_priority: dict[str, int] = {}
    for audit in run.audits:
        if audit.symbol is None or audit.code not in _CODE_PRIORITY:
            continue
        symbol = audit.symbol.upper()
        priority = _CODE_PRIORITY[audit.code]
        if symbol in selected and selected_priority[symbol] <= priority:
            continue
        selected[symbol] = EarlyWatchItem(
            symbol=symbol,
            source_code=audit.code,
            reason=audit.detail,
            timeframe=audit.timeframe,
            reference_time=audit.reference_time,
            observed=audit.observed,
            threshold=audit.threshold,
        )
        selected_priority[symbol] = priority

    items = sorted(
        selected.values(),
        key=lambda item: (_CODE_PRIORITY[item.source_code], item.symbol),
    )
    return EarlyWatchList(
        count=len(items),
        source_run_id=run.run_id,
        generated_at=run.completed_at or run.run_started_at,
        items=items,
    )
