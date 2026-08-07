"""Contract regression tests for the merged Scanner & Signals milestone."""

from __future__ import annotations

from datetime import UTC, datetime

from app.schemas.scanner import (
    ScannerAuditRecord,
    ScannerCandidateSummary,
    ScannerDirection,
    ScannerRunStatus,
    ScannerRunType,
    ScannerState,
)


def test_scanner_audit_preserves_universe_rank_for_rejected_rows() -> None:
    audit = ScannerAuditRecord(
        code="TREND_SIDEWAYS",
        detail="1H regime is SIDEWAYS",
        symbol="BTCUSDT",
        universe_rank=7,
        timeframe="1h",
    )

    assert audit.symbol == "BTCUSDT"
    assert audit.universe_rank == 7


def test_candidate_summary_exposes_authoritative_full_run_identity() -> None:
    started = datetime(2026, 8, 8, 0, 0, tzinfo=UTC)
    summary = ScannerCandidateSummary(
        state=ScannerState.ON,
        run_id="run-123",
        run_status=ScannerRunStatus.COMPLETED,
        run_type=ScannerRunType.FULL_UNIVERSE_SCAN,
        run_started_at=started,
        evaluated_symbols=50,
        successful_symbols=49,
        failed_symbols=1,
        audits=[
            ScannerAuditRecord(
                code="TREND_MIXED",
                detail="1H regime is MIXED",
                symbol="ETHUSDT",
                universe_rank=2,
                direction=ScannerDirection.LONG,
                timeframe="1h",
            )
        ],
    )

    assert summary.run_id == "run-123"
    assert summary.evaluated_symbols == 50
    assert summary.audits[0].universe_rank == 2
