"""Demo Execution Engine API routes."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import ROUND_UP, Decimal, InvalidOperation
from typing import Annotated
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import SecretStr

from app.api.v1.dependencies import get_execution_service, get_private_demo_client
from app.core.config import Settings, get_settings
from app.core.security import MutationAuthorization, authorize_mutation
from app.integrations.binance.private_demo_client import (
    BinanceDemoPrivateClient,
    BinanceDemoPrivateClientError,
)
from app.schemas.execution import (
    DemoAccountDiagnosticResponse,
    DemoExecutionAccountResponse,
    DemoExecutionActivateRequest,
    DemoExecutionPlanList,
    DemoExecutionStatusResponse,
    DemoPlanState,
    DemoTradeRecord,
    DemoTradeRecordList,
)
from app.schemas.scanner import ScannerDirection, ScannerGrade, ScannerSetup
from app.schemas.signals import SignalLifecycle
from app.services.exchange_rules import ExchangeRuleError, parse_symbol_trading_rules
from app.services.execution import DemoExecutionService

router = APIRouter(prefix="/execution/demo", tags=["execution"])


def _secret_configured(value: SecretStr | None) -> bool:
    return bool(value and value.get_secret_value())


def _exchange_decimal(value: object, *, field: str) -> Decimal:
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise HTTPException(status_code=502, detail=f"Invalid Binance Demo field: {field}") from exc
    if not parsed.is_finite():
        raise HTTPException(status_code=502, detail=f"Invalid Binance Demo field: {field}")
    return parsed


@router.get("/status", response_model=DemoExecutionStatusResponse)
async def execution_status(
    service: DemoExecutionService = Depends(get_execution_service),  # noqa: B008
) -> DemoExecutionStatusResponse:
    """Return current demo execution orchestration state."""

    return service.status()


@router.get("/account", response_model=DemoExecutionAccountResponse)
async def execution_account(
    service: DemoExecutionService = Depends(get_execution_service),  # noqa: B008
) -> DemoExecutionAccountResponse:
    """Return current Binance demo account and position snapshot."""

    return service.account()


@router.get(
    "/diagnostics/account",
    response_model=DemoAccountDiagnosticResponse,
    include_in_schema=False,
)
async def execution_account_diagnostic(
    settings: Settings = Depends(get_settings),  # noqa: B008
    client: BinanceDemoPrivateClient | None = Depends(get_private_demo_client),  # noqa: B008
) -> DemoAccountDiagnosticResponse:
    """Return a secret-safe diagnostic for Binance Demo account connectivity."""

    checked_at = datetime.now(UTC)
    api_key_configured = _secret_configured(settings.binance_demo_api_key)
    api_secret_configured = _secret_configured(settings.binance_demo_api_secret)
    base_url_host = (
        urlparse(settings.binance_demo_base_url).netloc
        if settings.binance_demo_base_url is not None
        else None
    )

    if client is None:
        missing = []
        if settings.binance_demo_base_url is None:
            missing.append("DEMO_BASE_URL_MISSING")
        if not api_key_configured:
            missing.append("DEMO_API_KEY_MISSING")
        if not api_secret_configured:
            missing.append("DEMO_API_SECRET_MISSING")
        error_code = "+".join(missing) or "DEMO_PRIVATE_API_NOT_CONFIGURED"
        return DemoAccountDiagnosticResponse(
            diagnostic_status="CONFIGURATION_LOCKED",
            demo_base_url_configured=settings.binance_demo_base_url is not None,
            demo_base_url_host=base_url_host,
            demo_api_key_configured=api_key_configured,
            demo_api_secret_configured=api_secret_configured,
            demo_credentials_configured=settings.demo_credentials_configured,
            private_client_available=False,
            execution_enabled=settings.execution_enabled,
            take_profit_r_multiple=settings.execution_take_profit_r_multiple,
            account_endpoint_status="NOT_TESTED",
            account_error_code=error_code,
            account_error_message=(
                "Demo private client is unavailable. Configure the Binance Demo base URL "
                "and both Demo API credential fields."
            ),
            checked_at=checked_at,
        )

    try:
        account_payload = client.account()
    except BinanceDemoPrivateClientError as exc:
        return DemoAccountDiagnosticResponse(
            diagnostic_status="ACCOUNT_API_ERROR",
            demo_base_url_configured=settings.binance_demo_base_url is not None,
            demo_base_url_host=base_url_host,
            demo_api_key_configured=api_key_configured,
            demo_api_secret_configured=api_secret_configured,
            demo_credentials_configured=settings.demo_credentials_configured,
            private_client_available=True,
            execution_enabled=settings.execution_enabled,
            take_profit_r_multiple=settings.execution_take_profit_r_multiple,
            account_endpoint_status="ERROR",
            account_error_code="DEMO_PRIVATE_ACCOUNT_REQUEST_FAILED",
            account_error_message=str(exc),
            account_error_status_code=exc.status_code,
            account_exchange_code=exc.exchange_code,
            checked_at=checked_at,
        )

    return DemoAccountDiagnosticResponse(
        diagnostic_status="CONNECTED",
        demo_base_url_configured=settings.binance_demo_base_url is not None,
        demo_base_url_host=base_url_host,
        demo_api_key_configured=api_key_configured,
        demo_api_secret_configured=api_secret_configured,
        demo_credentials_configured=settings.demo_credentials_configured,
        private_client_available=True,
        execution_enabled=settings.execution_enabled,
        take_profit_r_multiple=settings.execution_take_profit_r_multiple,
        account_endpoint_status="CONNECTED",
        account_can_trade=bool(account_payload.get("canTrade", False)),
        checked_at=checked_at,
    )


@router.post("/manual-test", response_model=dict[str, str])
async def execution_manual_test(
    symbol: Annotated[str, Query(min_length=6, max_length=20)] = "BTCUSDT",
    direction: Annotated[ScannerDirection, Query()] = ScannerDirection.LONG,
    settings: Settings = Depends(get_settings),  # noqa: B008
    client: BinanceDemoPrivateClient | None = Depends(get_private_demo_client),  # noqa: B008
    _authorization: MutationAuthorization = Depends(authorize_mutation),  # noqa: B008
) -> dict[str, str]:
    """Open one smallest-valid Binance Demo/Testnet market position for manual verification."""

    normalized_symbol = symbol.strip().upper()
    if not normalized_symbol.isalnum():
        raise HTTPException(status_code=422, detail="Invalid symbol")
    if client is None or settings.binance_demo_base_url is None:
        raise HTTPException(status_code=409, detail="Binance Demo private API is not configured")

    demo_host = urlparse(settings.binance_demo_base_url).netloc.lower()
    public_host = urlparse(settings.binance_public_base_url).netloc.lower()
    if demo_host == public_host or ("demo" not in demo_host and "testnet" not in demo_host):
        raise HTTPException(
            status_code=409,
            detail="Manual test trade is locked to an explicit Binance Demo/Testnet host",
        )

    try:
        mode = client.position_mode()
        if mode.get("dualSidePosition") is not False:
            raise HTTPException(
                status_code=409,
                detail="Manual Demo test requires Binance One-way position mode",
            )

        account_payload = client.account()
        if account_payload.get("canTrade") is not True:
            raise HTTPException(status_code=409, detail="Binance Demo account cannot trade")
        available_balance = _exchange_decimal(
            account_payload.get("availableBalance", "0"),
            field="availableBalance",
        )
        if available_balance <= 0:
            raise HTTPException(status_code=409, detail="Binance Demo available balance is zero")

        rules = parse_symbol_trading_rules(
            client.exchange_info(),
            symbol=normalized_symbol,
        )
        mark_price = _exchange_decimal(
            client.mark_price(normalized_symbol).get("markPrice"),
            field="markPrice",
        )
        if mark_price <= 0:
            raise HTTPException(status_code=502, detail="Binance Demo mark price is unavailable")

        raw_notional_quantity = rules.min_notional / mark_price
        notional_steps = (
            raw_notional_quantity / rules.quantity_step
        ).to_integral_value(rounding=ROUND_UP)
        quantity = max(
            rules.quantity_min,
            notional_steps * rules.quantity_step,
        )
        if quantity > rules.quantity_max:
            raise HTTPException(status_code=409, detail="Minimum valid order exceeds symbol limits")
        rules.validate_market_notional(quantity=quantity, mark_price=mark_price)

        side = "BUY" if direction is ScannerDirection.LONG else "SELL"
        client_order_id = f"af-manual-{uuid4().hex[:18]}"
        order_payload = client.place_market_order(
            symbol=normalized_symbol,
            side=side,
            quantity=format(quantity, "f"),
            new_client_order_id=client_order_id,
        )
    except HTTPException:
        raise
    except ExchangeRuleError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except BinanceDemoPrivateClientError as exc:
        detail = "Binance Demo manual test order was rejected"
        if exc.exchange_code is not None:
            detail += f" (exchange code {exc.exchange_code})"
        raise HTTPException(status_code=502, detail=detail) from exc

    if order_payload.get("clientOrderId") != client_order_id:
        raise HTTPException(status_code=502, detail="Binance Demo order identity was not verified")
    if order_payload.get("status") != "FILLED":
        raise HTTPException(status_code=502, detail="Binance Demo manual test order was not fully filled")

    executed_quantity = _exchange_decimal(
        order_payload.get("executedQty", "0"),
        field="executedQty",
    )
    average_price = _exchange_decimal(order_payload.get("avgPrice", "0"), field="avgPrice")
    if executed_quantity <= 0 or average_price <= 0:
        raise HTTPException(status_code=502, detail="Binance Demo fill was not verified")

    return {
        "mode": "BINANCE_DEMO_MANUAL_TEST",
        "symbol": normalized_symbol,
        "direction": direction.value,
        "side": side,
        "requested_quantity": format(quantity, "f"),
        "executed_quantity": format(executed_quantity, "f"),
        "mark_price": format(mark_price, "f"),
        "average_price": format(average_price, "f"),
        "estimated_notional_usdt": format(quantity * mark_price, "f"),
        "available_balance_usdt": format(available_balance, "f"),
        "order_id": str(order_payload.get("orderId", "")),
        "client_order_id": client_order_id,
        "status": "FILLED",
        "opened_at": datetime.now(UTC).isoformat(),
    }


@router.get("/plans", response_model=DemoExecutionPlanList)
async def execution_plans(
    service: DemoExecutionService = Depends(get_execution_service),  # noqa: B008
    symbol: Annotated[str | None, Query()] = None,
    direction: Annotated[ScannerDirection | None, Query()] = None,
    setup: Annotated[ScannerSetup | None, Query()] = None,
    grade: Annotated[ScannerGrade | None, Query()] = None,
    lifecycle: Annotated[SignalLifecycle | None, Query()] = None,
    plan_state: Annotated[DemoPlanState | None, Query()] = None,
) -> DemoExecutionPlanList:
    """Return filtered demo execution plans."""

    normalized_symbol = symbol.strip().upper() if symbol is not None else None
    if normalized_symbol is not None and (
        not normalized_symbol or not normalized_symbol.isalnum()
    ):
        raise HTTPException(status_code=422, detail="Invalid symbol")
    plans = [
        plan
        for plan in service.plans().plans
        if (normalized_symbol is None or plan.symbol == normalized_symbol)
        and (direction is None or plan.direction is direction)
        and (setup is None or plan.setup is setup)
        and (grade is None or plan.grade is grade)
        and (lifecycle is None or plan.signal_lifecycle is lifecycle)
        and (plan_state is None or plan.plan_state is plan_state)
    ]
    return DemoExecutionPlanList(count=len(plans), plans=plans)


@router.get("/trades", response_model=DemoTradeRecordList)
async def execution_trades(
    service: DemoExecutionService = Depends(get_execution_service),  # noqa: B008
) -> DemoTradeRecordList:
    """Return tracked demo trades."""

    return service.trades()


@router.post("/activate/{signal_id}", response_model=DemoTradeRecord)
async def execution_activate(
    signal_id: Annotated[str, Path(min_length=64, max_length=64)],
    request: DemoExecutionActivateRequest | None = None,
    service: DemoExecutionService = Depends(get_execution_service),  # noqa: B008
    _authorization: MutationAuthorization = Depends(authorize_mutation),  # noqa: B008
) -> DemoTradeRecord:
    """Activate a Demo order only after authorization and replay protection."""

    return service.activate(signal_id, request)
