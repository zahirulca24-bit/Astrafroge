"""Scanner runtime persistence and restart recovery tests."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import insert

from app.persistence.database import Persistence
from app.persistence.scanner_state import (
    PersistentScannerService,
    ScannerRuntimeStateStore,
    ScannerStateRecoveryError,
    scanner_runtime_snapshots,
)
from app.schemas.scanner import (
    CandidateLifecycle,
    ScannerCandidate,
    ScannerDirection,
    ScannerGrade,
    ScannerRunStatus,
    ScannerRunSummary,
    ScannerRunType,
    ScannerSetup,
    ScannerState,
)


def _service(persistence: Persistence) -> PersistentScannerService:
    return PersistentScannerService(
        object(),
        object(),
        object(),
        state_store=ScannerRuntimeStateStore(persistence),
    )


def _candidate(now: datetime) -> ScannerCandidate:
    return ScannerCandidate(
        candidate_id="candidate-1",
        symbol="BTCUSDT",
        direction=ScannerDirection.LONG,
        setup=ScannerSetup.TREND_PULLBACK,
        setup_name="Trend Pullback",
        reference_close_time=now,
        setup_confirmed_at=now,
        expires_at=now + timedelta(minutes=45),
        lifecycle=CandidateLifecycle.QUALIFIED,
        score=91,
        confidence=82,
        grade=ScannerGrade.A_PLUS,
        entry_ready=True,
        universe_rank=1,
        quote_volume=Decimal("100000000"),
        spread_bps=Decimal("1.2"),
        entry_trigger_price=Decimal("65000"),
        evaluated_at=now,
    )


def test_scanner_runtime_is_restored_after_restart(tmp_path) -> None:
    persistence = Persistence(f"sqlite:///{tmp_path / 'scanner.db'}")
    scanner_runtime_snapshots.create(persistence.engine)
    now = datetime(2026, 8, 6, 16, 0, tzinfo=UTC)

    original = _service(persistence)
    candidate = _candidate(now)
    original._state = ScannerState.ON
    original._candidates[candidate.candidate_id] = candidate
    original._terminal_keys.add("terminal-candidate")
    original._terminal_history[
        ("ETHUSDT", ScannerDirection.SHORT, ScannerSetup.BREAKOUT_RETEST)
    ] = now
    original._runs.append(
        ScannerRunSummary(
            run_id="run-1",
            run_type=ScannerRunType.FULL_UNIVERSE_SCAN,
            status=ScannerRunStatus.COMPLETED,
            run_started_at=now,
            completed_at=now + timedelta(seconds=5),
            universe_size=50,
            evaluated_symbols=50,
            successful_symbols=50,
        )
    )
    original._next_full_scan_at = now + timedelta(hours=1)
    original._next_refresh_at = now + timedelta(minutes=5)
    original._last_refresh_boundary = now
    original._state_store.save(original)

    recovered = _service(persistence)

    assert recovered._state is ScannerState.ON
    assert recovered._run_active is False
    assert recovered._candidates[candidate.candidate_id] == candidate
    assert recovered._terminal_keys == {"terminal-candidate"}
    assert recovered._terminal_history[
        ("ETHUSDT", ScannerDirection.SHORT, ScannerSetup.BREAKOUT_RETEST)
    ] == now
    assert recovered._runs[0].run_id == "run-1"
    assert recovered._next_full_scan_at == now + timedelta(hours=1)
    assert recovered._next_refresh_at == now + timedelta(minutes=5)
    assert recovered._last_refresh_boundary == now

    persistence.close()


def test_invalid_snapshot_fails_closed(tmp_path) -> None:
    persistence = Persistence(f"sqlite:///{tmp_path / 'invalid.db'}")
    scanner_runtime_snapshots.create(persistence.engine)
    with persistence.transaction() as session:
        session.execute(
            insert(scanner_runtime_snapshots).values(
                snapshot_key="primary",
                schema_version=99,
                payload_json="{}",
                updated_at=datetime.now(UTC),
            )
        )

    with pytest.raises(ScannerStateRecoveryError):
        _service(persistence)

    persistence.close()
