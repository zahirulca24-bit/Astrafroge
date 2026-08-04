"""Early Watch developing-setup tests."""

from datetime import UTC, datetime

from app.schemas.scanner import (
    ScannerAuditRecord,
    ScannerRunStatus,
    ScannerRunSummary,
    ScannerRunType,
)
from app.services.early_watch import build_early_watch


def _run(*audits: ScannerAuditRecord) -> ScannerRunSummary:
    now = datetime(2026, 8, 5, tzinfo=UTC)
    return ScannerRunSummary(
        run_id="run-early-watch",
        run_type=ScannerRunType.FULL_UNIVERSE_SCAN,
        status=ScannerRunStatus.COMPLETED,
        run_started_at=now,
        completed_at=now,
        audits=list(audits),
    )


def test_early_watch_is_non_executable_and_deduplicated() -> None:
    result = build_early_watch(
        _run(
            ScannerAuditRecord(
                code="TREND_MIXED",
                detail="1H regime is MIXED",
                symbol="btcusdt",
                timeframe="1h",
            ),
            ScannerAuditRecord(
                code="BREAKOUT_NOT_CONFIRMED",
                detail="Breakout is still developing",
                symbol="BTCUSDT",
                timeframe="15m",
            ),
            ScannerAuditRecord(
                code="TREND_SIDEWAYS",
                detail="Sideways markets are rejected, not watched",
                symbol="ETHUSDT",
                timeframe="1h",
            ),
        )
    )

    assert result.count == 1
    assert result.items[0].symbol == "BTCUSDT"
    assert result.items[0].lifecycle == "EARLY_WATCH"
    assert result.items[0].executable is False
    assert result.items[0].source_code == "TREND_MIXED"


def test_early_watch_empty_without_full_run() -> None:
    result = build_early_watch(None)
    assert result.count == 0
    assert result.items == []
    assert result.source_run_id is None
