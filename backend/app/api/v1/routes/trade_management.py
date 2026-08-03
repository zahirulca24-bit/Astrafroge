"""Trade Management Engine API routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from app.api.v1.dependencies import get_trade_management_service
from app.core.security import MutationAuthorization, authorize_mutation
from app.schemas.execution import DemoTradeRecord
from app.schemas.scanner import ScannerDirection, ScannerGrade
from app.schemas.trade_management import (
    ManagedTradeRecordList,
    TradeCloseRequest,
    TradeListFilters,
    TradeManagementStatusResponse,
    TradeSortBy,
)
from app.services.trade_management import TradeManagementService

router = APIRouter(prefix="/trade-management", tags=["trade-management"])


@router.get("/status", response_model=TradeManagementStatusResponse)
async def trade_management_status(
    service: TradeManagementService = Depends(get_trade_management_service),  # noqa: B008
) -> TradeManagementStatusResponse:
    """Return current trade-management readiness and summary counts."""

    return service.status()


@router.get("/trades", response_model=ManagedTradeRecordList)
async def tracked_trades(
    service: TradeManagementService = Depends(get_trade_management_service),  # noqa: B008
    symbol: Annotated[str | None, Query()] = None,
    direction: Annotated[ScannerDirection | None, Query()] = None,
    min_grade: Annotated[ScannerGrade | None, Query()] = None,
    include_closed: Annotated[bool, Query()] = False,
    sort_by: Annotated[TradeSortBy, Query()] = TradeSortBy.OPENED_AT_DESC,
) -> ManagedTradeRecordList:
    """Return filtered tracked demo trades for the Active Trades page."""

    normalized_symbol = symbol.strip().upper() if symbol is not None else None
    if normalized_symbol is not None and (
        not normalized_symbol or not normalized_symbol.isalnum()
    ):
        raise HTTPException(status_code=422, detail="Invalid symbol")
    return service.trades(
        TradeListFilters(
            symbol=normalized_symbol,
            direction=direction,
            min_grade=min_grade,
            include_closed=include_closed,
            sort_by=sort_by,
        )
    )


@router.post("/close/{trade_id}", response_model=DemoTradeRecord)
async def close_trade(
    trade_id: Annotated[str, Path(min_length=36, max_length=36)],
    request: TradeCloseRequest,
    service: TradeManagementService = Depends(get_trade_management_service),  # noqa: B008
    _authorization: MutationAuthorization = Depends(authorize_mutation),  # noqa: B008
) -> DemoTradeRecord:
    """Close a tracked Demo trade only after an authorized single-use request."""

    return service.close_trade(trade_id, request)
