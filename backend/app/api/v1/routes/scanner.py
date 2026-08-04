"""Scanner Engine Runtime API routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from app.api.v1.dependencies import get_scanner_service
from app.core.security import MutationAuthorization, authorize_mutation
from app.schemas.early_watch import EarlyWatchList
from app.schemas.scanner import (
    CandidateLifecycle,
    ScannerCandidateList,
    ScannerCandidateSummary,
    ScannerDirection,
    ScannerRunStatus,
    ScannerRunSummary,
    ScannerRunType,
    ScannerSetup,
    ScannerStatusResponse,
)
from app.services.early_watch import build_early_watch
from app.services.scanner import ScannerService

router = APIRouter(prefix="/scanner", tags=["scanner"])


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
    # The candidate table represents discovery by a full-universe scan. An empty
    # five-minute active refresh must not overwrite that result with zeroes.
    latest = _latest_full_run(service) or service.latest_run()
    status = service.status()
    if latest is None:
        return ScannerCandidateSummary(state=status.state)
    return ScannerCandidateSummary(
        state=status.state,
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
    service: ScannerService = Depends(get_scanner_service),  # noqa: B008
    _authorization: MutationAuthorization = Depends(authorize_mutation),  # noqa: B008
) -> ScannerRunSummary:
    """Run one authorized Full Universe Scan without changing ON/OFF state."""

    return await service.run_now()


@router.get("/candidates", response_model=ScannerCandidateList)
async def scanner_candidates(
    service: ScannerService = Depends(get_scanner_service),  # noqa: B008
    symbol: Annotated[str | None, Query()] = None,
    direction: Annotated[ScannerDirection | None, Query()] = None,
    setup: Annotated[ScannerSetup | None, Query()] = None,
    lifecycle: Annotated[CandidateLifecycle | None, Query()] = None,
) -> ScannerCandidateList:
    """Return filtered deterministic Scanner candidates."""

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
