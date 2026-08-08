"""Scanner Engine Runtime API routes."""

from __future__ import annotations

from collections import defaultdict
from time import perf_counter
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response

from app.api.v1.dependencies import get_scanner_service
from app.core.security import MutationAuthorization, authorize_mutation
from app.schemas.early_watch import EarlyWatchList
from app.schemas.scanner import (
    CandidateLifecycle,
    ScannerAuditRecord,
    ScannerCandidateList,
    ScannerCandidateSummary,
    ScannerDirection,
    ScannerRunStatus,
    ScannerRunSummary,
    ScannerRunType,
    ScannerSetup,
    ScannerStatusResponse,
)
from app.schemas.scanner_table import (
    ScannerTableRow,
    ScannerTableSnapshot,
    ScannerTableStatus,
    ScannerTableSummary,
)
from app.services.early_watch import build_early_watch
from app.services.scanner import ScannerService

router = APIRouter(prefix="/scanner", tags=["scanner"])

_SYMBOL_DATA_FAILURE_CODES = {
    "MISSING_1H_CANDLES",
    "MISSING_15M_CANDLES",
    "MISSING_5M_CANDLES",
    "MISSING_3M_CANDLES",
    "MISSING_1M_CANDLES",
    "INSUFFICIENT_1H_HISTORY",
    "INSUFFICIENT_15M_HISTORY",
    "INSUFFICIENT_5M_HISTORY",
    "INSUFFICIENT_3M_HISTORY",
    "INSUFFICIENT_1M_HISTORY",
    "STALE_1H_DATA",
    "STALE_15M_DATA",
    "STALE_5M_DATA",
    "STALE_3M_DATA",
    "STALE_1M_DATA",
    "INVALID_1H_OHLCV",
    "INVALID_15M_OHLCV",
    "INVALID_5M_OHLCV",
    "INVALID_3M_OHLCV",
    "INVALID_1M_OHLCV",
    "MISSING_REQUIRED_INDICATOR",
    "INDICATOR_CALCULATION_FAILED",
    "STRUCTURE_INSUFFICIENT",
    "UNIVERSE_ELIGIBILITY_FAILED",
}


def _latest_full_run(service: ScannerService) -> ScannerRunSummary | None:
    """Return the newest full-universe run without letting refreshes hide it."""

    runs = getattr(service, "_runs", ())
    return next(
        (
            run
            for run in reversed(runs)
            if run.run_type is ScannerRunType.FULL_UNIVERSE_SCAN
            and run.status is not ScannerRunStatus.SKIPPED
        ),
        None,
    )


def _candidate_summary(service: ScannerService) -> ScannerCandidateSummary:
    """Expose the latest full-scan truth used by the merged Scanner & Signals UI."""

    latest = _latest_full_run(service) or service.latest_run()
    status = service.status()
    if latest is None:
        return ScannerCandidateSummary(state=status.state)
    return ScannerCandidateSummary(
        state=status.state,
        run_id=latest.run_id,
        run_status=latest.status,
        run_type=latest.run_type,
        run_started_at=latest.run_started_at,
        completed_at=latest.completed_at,
        evaluated_symbols=latest.evaluated_symbols,
        successful_symbols=latest.successful_symbols,
        failed_symbols=latest.failed_symbols,
        discovered_candidates=latest.discovered_candidates,
        selected_candidates=latest.selected_candidates,
        updated_candidates=latest.updated_candidates,
        qualified_candidates=latest.qualified_candidates,
        audits=latest.audits,
    )


def _humanize(code: str) -> str:
    return code.replace("_", " ").title()


def _scanner_table_snapshot(service: ScannerService) -> ScannerTableSnapshot:
    """Build one authoritative row for every symbol represented by the latest full scan."""

    latest = _latest_full_run(service)
    if latest is None:
        raise HTTPException(status_code=404, detail="No full Scanner run is available")

    candidates = [
        candidate
        for candidate in service.candidates()
        if candidate.evidence.get("source_run_id") == latest.run_id
    ]
    candidates_by_symbol = {candidate.symbol: candidate for candidate in candidates}
    audits_by_symbol: dict[str, list[ScannerAuditRecord]] = defaultdict(list)
    for audit in latest.audits:
        if audit.symbol:
            audits_by_symbol[audit.symbol].append(audit)

    symbols = set(candidates_by_symbol) | set(audits_by_symbol)
    rows: list[ScannerTableRow] = []
    for symbol in symbols:
        candidate = candidates_by_symbol.get(symbol)
        audits = audits_by_symbol.get(symbol, [])
        audit_codes = [audit.code for audit in audits]
        failed = any(code in _SYMBOL_DATA_FAILURE_CODES for code in audit_codes)

        if failed:
            status = ScannerTableStatus.FAILED
        elif candidate is not None and candidate.lifecycle is CandidateLifecycle.QUALIFIED:
            status = ScannerTableStatus.READY
        elif candidate is not None and candidate.lifecycle in {
            CandidateLifecycle.DETECTED,
            CandidateLifecycle.WATCH_NEAR,
        }:
            status = ScannerTableStatus.NEAR_SETUP
        else:
            status = ScannerTableStatus.REJECTED

        first_audit = audits[0] if audits else None
        direction = candidate.direction if candidate is not None else (
            first_audit.direction if first_audit is not None else None
        )
        rank = candidate.universe_rank if candidate is not None else next(
            (audit.universe_rank for audit in audits if audit.universe_rank is not None),
            None,
        )
        if rank is None:
            continue

        candidate_codes = list(candidate.audit_codes) if candidate is not None else []
        primary_code = candidate_codes[0] if candidate_codes else (
            first_audit.code if first_audit is not None else None
        )
        primary_reason = (
            first_audit.detail
            if first_audit is not None and primary_code == first_audit.code
            else _humanize(primary_code) if primary_code else None
        )

        if any(audit.code == "TREND_SIDEWAYS" for audit in audits):
            trend = "Sideways"
        elif any(audit.code == "TREND_MIXED" for audit in audits):
            trend = "Mixed"
        elif direction is ScannerDirection.LONG:
            trend = "Bullish"
        elif direction is ScannerDirection.SHORT:
            trend = "Bearish"
        else:
            trend = "Unavailable"

        rows.append(
            ScannerTableRow(
                universe_rank=rank,
                symbol=symbol,
                direction=direction,
                setup_name=candidate.setup_name if candidate is not None else None,
                trend_1h=trend,
                setup_15m=(
                    candidate.setup_name
                    if candidate is not None
                    else "Unavailable"
                    if failed
                    else "No setup"
                    if any(audit.timeframe in {"15m", "5m"} for audit in audits)
                    else "Not evaluated"
                ),
                entry_5m=(
                    f"Entry Ready ({candidate.evidence.get('entry_interval', '1m')})"
                    if candidate is not None and candidate.entry_ready
                    else "Awaiting 1M/3M Trigger"
                    if candidate is not None
                    else "Unavailable"
                    if failed
                    else "Not evaluated"
                ),
                grade=candidate.grade if candidate is not None else None,
                score=candidate.score if candidate is not None else None,
                confidence=candidate.confidence if candidate is not None else None,
                status=status,
                candidate_id=candidate.candidate_id if candidate is not None else None,
                primary_reason_code=primary_code,
                primary_reason=primary_reason,
                audit_codes=[*candidate_codes, *audit_codes],
            )
        )

    rows.sort(key=lambda row: (row.universe_rank, row.symbol))
    summary = ScannerTableSummary(
        run_id=latest.run_id,
        run_status=latest.status,
        total=len(rows),
        ready=sum(row.status is ScannerTableStatus.READY for row in rows),
        near_setup=sum(row.status is ScannerTableStatus.NEAR_SETUP for row in rows),
        rejected=sum(row.status is ScannerTableStatus.REJECTED for row in rows),
        failed=sum(row.status is ScannerTableStatus.FAILED for row in rows),
    )
    return ScannerTableSnapshot(summary=summary, rows=rows)


@router.get("/status", response_model=ScannerStatusResponse)
async def scanner_status(
    service: ScannerService = Depends(get_scanner_service),  # noqa: B008
) -> ScannerStatusResponse:
    """Return honest process-scoped Scanner state."""

    return service.status()


@router.post("/start", response_model=ScannerStatusResponse)
async def scanner_start(
    background_tasks: BackgroundTasks,
    service: ScannerService = Depends(get_scanner_service),  # noqa: B008
    _authorization: MutationAuthorization = Depends(authorize_mutation),  # noqa: B008
) -> ScannerStatusResponse:
    """Enable Scanner and request the initial full scan without blocking the client."""

    status = await service.start()
    if _latest_full_run(service) is None:
        background_tasks.add_task(service.run_now)
    return status


@router.post("/stop", response_model=ScannerStatusResponse)
async def scanner_stop(
    service: ScannerService = Depends(get_scanner_service),  # noqa: B008
    _authorization: MutationAuthorization = Depends(authorize_mutation),  # noqa: B008
) -> ScannerStatusResponse:
    """Disable recurring Scanner work after an authorized mutation request."""

    return await service.stop()


@router.post("/run-now", response_model=ScannerRunSummary)
async def scanner_run_now(
    response: Response,
    service: ScannerService = Depends(get_scanner_service),  # noqa: B008
    _authorization: MutationAuthorization = Depends(authorize_mutation),  # noqa: B008
) -> ScannerRunSummary:
    """Run one authorized Full Universe Scan and expose its measured server duration."""

    started = perf_counter()
    run = await service.run_now()
    elapsed_ms = max(0.0, (perf_counter() - started) * 1000)
    response.headers["Server-Timing"] = f"scanner;dur={elapsed_ms:.1f}"
    response.headers["X-Scanner-Duration-Ms"] = f"{elapsed_ms:.1f}"
    return run


@router.get("/evaluations/latest", response_model=ScannerTableSnapshot)
async def scanner_latest_evaluations(
    service: ScannerService = Depends(get_scanner_service),  # noqa: B008
) -> ScannerTableSnapshot:
    """Return authoritative latest full-scan rows for the Scanner table."""

    return _scanner_table_snapshot(service)


@router.get("/candidates", response_model=ScannerCandidateList)
async def scanner_candidates(
    service: ScannerService = Depends(get_scanner_service),  # noqa: B008
    symbol: Annotated[str | None, Query()] = None,
    direction: Annotated[ScannerDirection | None, Query()] = None,
    setup: Annotated[ScannerSetup | None, Query()] = None,
    lifecycle: Annotated[CandidateLifecycle | None, Query()] = None,
) -> ScannerCandidateList:
    """Return filtered deterministic Scanner candidates and latest full-run audit truth."""

    normalized_symbol = symbol.strip().upper() if symbol is not None else None
    if normalized_symbol is not None and (
        not normalized_symbol or not normalized_symbol.isalnum()
    ):
        raise HTTPException(status_code=422, detail="Invalid symbol")
    candidates = [
        candidate
        for candidate in service.candidates()
        if (normalized_symbol is None or candidate.symbol == normalized_symbol)
        and (direction is None or candidate.direction is direction)
        and (setup is None or candidate.setup is setup)
        and (lifecycle is None or candidate.lifecycle is lifecycle)
    ]
    return ScannerCandidateList(
        count=len(candidates),
        candidates=candidates,
        summary=_candidate_summary(service),
    )


@router.get("/early-watch", response_model=EarlyWatchList)
async def scanner_early_watch(
    service: ScannerService = Depends(get_scanner_service),  # noqa: B008
) -> EarlyWatchList:
    """Return developing setups isolated from all executable candidate flows."""

    return build_early_watch(_latest_full_run(service))


@router.get("/runs/latest", response_model=ScannerRunSummary)
async def scanner_latest_run(
    service: ScannerService = Depends(get_scanner_service),  # noqa: B008
) -> ScannerRunSummary:
    """Return the latest Scanner run summary of any type."""

    latest = service.latest_run()
    if latest is None:
        raise HTTPException(status_code=404, detail="No Scanner run is available")
    return latest
