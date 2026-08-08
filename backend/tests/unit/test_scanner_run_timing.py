"""Regression coverage for manual Scanner request timing diagnostics."""

import asyncio
from datetime import UTC, datetime

from fastapi import Response

from app.api.v1.routes.scanner import scanner_run_now
from app.schemas.scanner import ScannerRunStatus, ScannerRunSummary, ScannerRunType


class _StubScanner:
    async def run_now(self) -> ScannerRunSummary:
        await asyncio.sleep(0)
        now = datetime.now(UTC)
        return ScannerRunSummary(
            run_id="timing-run",
            run_type=ScannerRunType.FULL_UNIVERSE_SCAN,
            status=ScannerRunStatus.COMPLETED,
            run_started_at=now,
            completed_at=now,
        )


def test_manual_scan_response_exposes_server_duration() -> None:
    response = Response()

    run = asyncio.run(
        scanner_run_now(
            response=response,
            service=_StubScanner(),  # type: ignore[arg-type]
            _authorization=None,  # type: ignore[arg-type]
        )
    )

    assert run.run_id == "timing-run"
    assert response.headers["server-timing"].startswith("scanner;dur=")
    assert float(response.headers["x-scanner-duration-ms"]) >= 0
