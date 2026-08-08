"""Scanner table contract tests for Phase 2."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

from app.api.v1.routes.scanner import _scanner_table_snapshot
from app.schemas.scanner import (
    CandidateLifecycle,
    ScannerAuditRecord,
    ScannerDirection,
    ScannerGrade,
    ScannerRunStatus,
    ScannerRunSummary,
    ScannerRunType,
)
from app.schemas.scanner_table import ScannerTableStatus

NOW = datetime(2026, 8, 8, tzinfo=UTC)


def _candidate(symbol: str, rank: int, lifecycle: CandidateLifecycle):
    return SimpleNamespace(
        evidence={"source_run_id": "run-1"},
        universe_rank=rank,
        symbol=symbol,
        direction=ScannerDirection.LONG,
        setup_name="Trend Pullback",
        entry_ready=lifecycle is CandidateLifecycle.QUALIFIED,
        grade=ScannerGrade.A if lifecycle is CandidateLifecycle.QUALIFIED else ScannerGrade.B_PLUS,
        score=88 if lifecycle is CandidateLifecycle.QUALIFIED else 82,
        confidence=74,
        lifecycle=lifecycle,
        candidate_id=f"candidate-{rank}",
        audit_codes=[] if lifecycle is CandidateLifecycle.QUALIFIED else ["ENTRY_NOT_READY"],
    )


def test_latest_table_rows_cover_ready_near_rejected_and_failed() -> None:
    run = ScannerRunSummary(
        run_id="run-1",
        run_type=ScannerRunType.FULL_UNIVERSE_SCAN,
        status=ScannerRunStatus.DEGRADED,
        run_started_at=NOW,
        evaluated_symbols=4,
        successful_symbols=3,
        failed_symbols=1,
        discovered_candidates=2,
        selected_candidates=2,
        qualified_candidates=1,
        audits=[
            ScannerAuditRecord(
                code="TREND_SIDEWAYS",
                detail="1H regime is SIDEWAYS",
                symbol="XRPUSDT",
                universe_rank=3,
            ),
            ScannerAuditRecord(
                code="MISSING_5M_CANDLES",
                detail="5m candles are unavailable",
                symbol="ADAUSDT",
                universe_rank=4,
            ),
        ],
    )
    service = SimpleNamespace(
        _runs=[run],
        candidates=lambda: [
            _candidate("BTCUSDT", 1, CandidateLifecycle.QUALIFIED),
            _candidate("ETHUSDT", 2, CandidateLifecycle.WATCH_NEAR),
        ],
    )

    snapshot = _scanner_table_snapshot(service)

    assert [row.symbol for row in snapshot.rows] == [
        "BTCUSDT",
        "ETHUSDT",
        "XRPUSDT",
        "ADAUSDT",
    ]
    assert [row.status for row in snapshot.rows] == [
        ScannerTableStatus.READY,
        ScannerTableStatus.NEAR_SETUP,
        ScannerTableStatus.REJECTED,
        ScannerTableStatus.FAILED,
    ]
    assert snapshot.summary.total == 4
    assert snapshot.summary.ready == 1
    assert snapshot.summary.near_setup == 1
    assert snapshot.summary.rejected == 1
    assert snapshot.summary.failed == 1
    xrp = next(row for row in snapshot.rows if row.symbol == "XRPUSDT")
    assert xrp.trend_1h == "Sideways"
    assert xrp.setup_15m == "Not evaluated"
    assert xrp.entry_5m == "Not evaluated"


def test_latest_table_marks_15m_no_setup_only_after_setup_evaluation() -> None:
    run = ScannerRunSummary(
        run_id="run-1",
        run_type=ScannerRunType.FULL_UNIVERSE_SCAN,
        status=ScannerRunStatus.COMPLETED,
        run_started_at=NOW,
        evaluated_symbols=1,
        successful_symbols=1,
        audits=[
            ScannerAuditRecord(
                code="PULLBACK_SEQUENCE_FAILED",
                detail="Three-candle pullback sequence failed",
                symbol="SOLUSDT",
                universe_rank=1,
                direction=ScannerDirection.LONG,
                timeframe="15m",
            ),
            ScannerAuditRecord(
                code="SETUP_NOT_DETECTED",
                detail="No approved deterministic setup matched",
                symbol="SOLUSDT",
                universe_rank=1,
                direction=ScannerDirection.LONG,
                timeframe="15m",
            ),
        ],
    )
    service = SimpleNamespace(_runs=[run], candidates=lambda: [])

    snapshot = _scanner_table_snapshot(service)

    assert snapshot.rows[0].setup_15m == "No setup"
    assert snapshot.rows[0].entry_5m == "Not evaluated"
