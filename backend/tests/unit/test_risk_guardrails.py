from datetime import UTC, datetime
from decimal import Decimal

from app.core.config import Settings
from app.schemas.risk import RiskAssessment, RiskDecision
from app.schemas.scanner import ScannerDirection, ScannerGrade, ScannerSetup
from app.schemas.signals import SignalLifecycle
from app.services.risk import _AccountSnapshot
from app.services.risk_guardrails import (
    EmptyRiskGuardrailStateProvider,
    GuardedRiskService,
    RiskGuardrailPolicy,
)

NOW = datetime(2026, 8, 6, 12, 0, tzinfo=UTC)


def assessment() -> RiskAssessment:
    return RiskAssessment(
        signal_id="sig-1",
        symbol="BTCUSDT",
        direction=ScannerDirection.LONG,
        setup=ScannerSetup.TREND_PULLBACK,
        setup_name="Trend Pullback",
        signal_lifecycle=SignalLifecycle.ACTIVE,
        grade=ScannerGrade.A,
        score=88,
        confidence=75,
        decision=RiskDecision.APPROVED,
        blocked_reason=None,
        approved_for_execution=True,
        entry_trigger_price=Decimal("100"),
        stop_loss_price=Decimal("99"),
        stop_distance=Decimal("1"),
        risk_percent=Decimal("0.25"),
        risk_budget_usdt=Decimal("2.5"),
        recommended_quantity=Decimal("2.5"),
        position_notional_usdt=Decimal("250"),
        required_margin_usdt=Decimal("50"),
        wallet_balance_usdt=Decimal("1000"),
        available_balance_usdt=Decimal("900"),
        open_position_count=0,
        current_margin_exposure_usdt=Decimal("0"),
        max_open_trades_limit=4,
        updated_at=NOW,
        audit_codes=["RISK_APPROVED"],
    )


def snapshot(*, leverage: int = 5) -> _AccountSnapshot:
    return _AccountSnapshot(
        captured_at=NOW,
        can_trade=True,
        wallet_balance_usdt=Decimal("1000"),
        available_balance_usdt=Decimal("900"),
        daily_realized_pnl_usdt=Decimal("0"),
        daily_unrealized_pnl_usdt=Decimal("0"),
        daily_net_pnl_usdt=Decimal("0"),
        daily_pnl_percent=Decimal("0"),
        current_margin_exposure_usdt=Decimal("0"),
        open_positions=(),
        leverage_by_symbol={"BTCUSDT": leverage},
    )


def service(policy: RiskGuardrailPolicy) -> GuardedRiskService:
    instance = GuardedRiskService.__new__(GuardedRiskService)
    instance._settings = Settings(
        environment="test",
        execution_take_profit_r_multiple=Decimal("2"),
    )
    instance._guardrail_policy = policy
    instance._guardrail_state = EmptyRiskGuardrailStateProvider()
    instance._now = lambda: NOW
    return instance


def test_emergency_stop_blocks_approved_assessment() -> None:
    guarded = service(RiskGuardrailPolicy(emergency_stop=True))._apply_guardrails(
        [assessment()], snapshot()
    )

    assert guarded[0].decision is RiskDecision.BLOCKED
    assert guarded[0].blocked_reason == "EMERGENCY_STOP_ACTIVE"
    assert guarded[0].approved_for_execution is False
    assert guarded[0].recommended_quantity is None


def test_maximum_leverage_blocks_approved_assessment() -> None:
    guarded = service(RiskGuardrailPolicy(maximum_leverage=3))._apply_guardrails(
        [assessment()], snapshot(leverage=5)
    )

    assert guarded[0].decision is RiskDecision.BLOCKED
    assert guarded[0].blocked_reason == "MAXIMUM_LEVERAGE_EXCEEDED"


def test_compliant_assessment_remains_approved() -> None:
    guarded = service(RiskGuardrailPolicy())._apply_guardrails(
        [assessment()], snapshot(leverage=5)
    )

    assert guarded[0].decision is RiskDecision.APPROVED
    assert guarded[0].approved_for_execution is True
