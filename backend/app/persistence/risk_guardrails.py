"""Persistence adapter for the complete guarded Risk Engine."""

from __future__ import annotations

import hashlib

from app.core.config import Settings
from app.persistence.repositories import TradingStateRepositories
from app.persistence.service_adapters import _json, _payload
from app.schemas.risk import RiskAssessmentList, RiskStatusResponse
from app.services.risk import RiskPrivateClient
from app.services.risk_guardrails import (
    GuardedRiskService,
    RepositoryRiskGuardrailStateProvider,
)
from app.services.signals import SignalService


class PersistentGuardedRiskService(GuardedRiskService):
    """Complete guardrails plus durable deterministic assessment records."""

    def __init__(
        self,
        signal_service: SignalService,
        settings: Settings,
        private_client: RiskPrivateClient | None,
        repositories: TradingStateRepositories,
    ) -> None:
        self._repositories = repositories
        super().__init__(
            signal_service,
            settings,
            private_client,
            state_provider=RepositoryRiskGuardrailStateProvider(repositories),
        )

    def assessments(self) -> RiskAssessmentList:
        result = super().assessments()
        self._persist(result)
        return result

    def status(self) -> RiskStatusResponse:
        result = super().status()
        self.assessments()
        return result

    def _persist(self, result: RiskAssessmentList) -> None:
        for assessment in result.assessments:
            payload = _payload(assessment)
            digest = hashlib.sha256(_json(payload).encode()).hexdigest()
            self._repositories.save_risk_decision(
                decision_id=digest,
                signal_id=assessment.signal_id,
                decision=assessment.decision.value,
                audit_codes=list(assessment.audit_codes),
                payload=payload,
                assessed_at=assessment.updated_at,
            )
