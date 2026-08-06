"""Additional fail-closed risk guardrails over the account-backed Risk Engine."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation
from typing import Protocol

from sqlalchemy import select

from app.core.config import Settings
from app.persistence.models import TradeRow
from app.persistence.repositories import TradingStateRepositories
from app.schemas.risk import RiskAssessment, RiskDecision, RiskRejectionCode
from app.services.risk import RiskPrivateClient, RiskService, _AccountSnapshot
from app.services.signals import SignalService


class RiskGuardrailStateProvider(Protocol):
    """Historical state required by daily and loss-streak guardrails."""

    def symbol_trade_count(self, symbol: str, trading_day: date) -> int: ...

    def consecutive_losses(self, trading_day: date) -> int: ...


class EmptyRiskGuardrailStateProvider:
    """State provider used when durable trading history is unavailable."""

    def symbol_trade_count(self, symbol: str, trading_day: date) -> int:
        del symbol, trading_day
        return 0

    def consecutive_losses(self, trading_day: date) -> int:
        del trading_day
        return 0


class RepositoryRiskGuardrailStateProvider:
    """Derive guardrail counters from durable closed-trade payloads."""

    def __init__(self, repositories: TradingStateRepositories) -> None:
        self._repositories = repositories

    def _closed_trades(self, trading_day: date) -> list[dict[str, object]]:
        with self._repositories.persistence.transaction() as session:
            rows = list(session.scalars(select(TradeRow).order_by(TradeRow.updated_at.desc())))
        records: list[dict[str, object]] = []
        for row in rows:
            try:
                payload = json.loads(row.payload_json)
            except (TypeError, json.JSONDecodeError):
                continue
            if not isinstance(payload, dict):
                continue
            closed_at = payload.get("closed_at") or payload.get("updated_at")
            if not isinstance(closed_at, str):
                continue
            try:
                closed_day = datetime.fromisoformat(closed_at.replace("Z", "+00:00")).date()
            except ValueError:
                continue
            if closed_day == trading_day:
                records.append(payload)
        return records

    def symbol_trade_count(self, symbol: str, trading_day: date) -> int:
        return sum(1 for item in self._closed_trades(trading_day) if item.get("symbol") == symbol)

    def consecutive_losses(self, trading_day: date) -> int:
        losses = 0
        for item in self._closed_trades(trading_day):
            raw = item.get("realized_pnl_usdt", item.get("pnl", item.get("realized_pnl")))
            try:
                pnl = Decimal(str(raw))
            except (InvalidOperation, TypeError, ValueError):
                break
            if pnl < 0:
                losses += 1
            else:
                break
        return losses


@dataclass(frozen=True)
class RiskGuardrailPolicy:
    """Validated deployment policy for the additional guardrails."""

    maximum_leverage: int = 5
    per_symbol_daily_trade_limit: int = 2
    consecutive_loss_pause_count: int = 3
    minimum_risk_reward: Decimal = Decimal("2")
    account_snapshot_max_age_seconds: int = 30
    emergency_stop: bool = False

    @classmethod
    def from_environment(cls) -> "RiskGuardrailPolicy":
        def integer(name: str, default: int, minimum: int, maximum: int) -> int:
            raw = os.getenv(name, str(default))
            value = int(raw)
            if not minimum <= value <= maximum:
                raise ValueError(f"{name} must be between {minimum} and {maximum}")
            return value

        rr = Decimal(os.getenv("ASTRAFORGE_RISK_MINIMUM_RR", "2"))
        if rr <= 0 or rr > 20:
            raise ValueError("ASTRAFORGE_RISK_MINIMUM_RR must be greater than 0 and at most 20")
        emergency = os.getenv("ASTRAFORGE_RISK_EMERGENCY_STOP", "false").strip().lower()
        if emergency not in {"true", "false"}:
            raise ValueError("ASTRAFORGE_RISK_EMERGENCY_STOP must be true or false")
        return cls(
            maximum_leverage=integer("ASTRAFORGE_RISK_MAX_LEVERAGE", 5, 1, 125),
            per_symbol_daily_trade_limit=integer(
                "ASTRAFORGE_RISK_PER_SYMBOL_DAILY_TRADE_LIMIT", 2, 1, 50
            ),
            consecutive_loss_pause_count=integer(
                "ASTRAFORGE_RISK_CONSECUTIVE_LOSS_PAUSE_COUNT", 3, 1, 20
            ),
            minimum_risk_reward=rr,
            account_snapshot_max_age_seconds=integer(
                "ASTRAFORGE_RISK_ACCOUNT_SNAPSHOT_MAX_AGE_SECONDS", 30, 1, 300
            ),
            emergency_stop=emergency == "true",
        )


class GuardedRiskService(RiskService):
    """Risk service with leverage, RR, daily-limit, loss-pause and stop guards."""

    def __init__(
        self,
        signal_service: SignalService,
        settings: Settings,
        private_client: RiskPrivateClient | None = None,
        *,
        state_provider: RiskGuardrailStateProvider | None = None,
        policy: RiskGuardrailPolicy | None = None,
    ) -> None:
        super().__init__(signal_service, settings, private_client)
        self._guardrail_state = state_provider or EmptyRiskGuardrailStateProvider()
        self._guardrail_policy = policy or RiskGuardrailPolicy.from_environment()

    def _build_assessments(
        self,
        snapshot: _AccountSnapshot | None,
        snapshot_error: RiskRejectionCode | None,
    ) -> list[RiskAssessment]:
        base = super()._build_assessments(snapshot, snapshot_error)
        return self._apply_guardrails(base, snapshot)

    def _apply_guardrails(
        self,
        assessments: list[RiskAssessment],
        snapshot: _AccountSnapshot | None,
    ) -> list[RiskAssessment]:
        now = self._now().astimezone(UTC)
        trading_day = now.date()
        loss_count = self._guardrail_state.consecutive_losses(trading_day)
        result: list[RiskAssessment] = []
        for assessment in assessments:
            if assessment.decision is not RiskDecision.APPROVED:
                result.append(assessment)
                continue
            reason: str | None = None
            if self._guardrail_policy.emergency_stop:
                reason = "EMERGENCY_STOP_ACTIVE"
            elif loss_count >= self._guardrail_policy.consecutive_loss_pause_count:
                reason = "CONSECUTIVE_LOSS_PAUSE_ACTIVE"
            elif self._guardrail_state.symbol_trade_count(
                assessment.symbol, trading_day
            ) >= self._guardrail_policy.per_symbol_daily_trade_limit:
                reason = "PER_SYMBOL_DAILY_TRADE_LIMIT_REACHED"
            elif self._settings.execution_take_profit_r_multiple < self._guardrail_policy.minimum_risk_reward:
                reason = "MINIMUM_RISK_REWARD_NOT_MET"
            elif snapshot is None:
                reason = "ACCOUNT_SNAPSHOT_UNAVAILABLE"
            elif (now - snapshot.captured_at).total_seconds() > self._guardrail_policy.account_snapshot_max_age_seconds:
                reason = "ACCOUNT_SNAPSHOT_STALE"
            else:
                leverage = snapshot.leverage_by_symbol.get(assessment.symbol)
                if leverage is None:
                    reason = "SYMBOL_LEVERAGE_UNAVAILABLE"
                elif leverage > self._guardrail_policy.maximum_leverage:
                    reason = "MAXIMUM_LEVERAGE_EXCEEDED"
            if reason is None:
                result.append(assessment)
                continue
            audit_codes = list(assessment.audit_codes)
            if reason not in audit_codes:
                audit_codes.append(reason)
            result.append(
                assessment.model_copy(
                    update={
                        "decision": RiskDecision.BLOCKED,
                        "blocked_reason": reason,
                        "approved_for_execution": False,
                        "recommended_quantity": None,
                        "position_notional_usdt": None,
                        "required_margin_usdt": None,
                        "audit_codes": audit_codes,
                        "updated_at": now,
                    }
                )
            )
        return result
