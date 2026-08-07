"""Candidate-to-signal linkage regression tests for Phase 4."""

import asyncio
from types import SimpleNamespace

from app.api.v1.routes.signals import signal_links
from app.schemas.scanner import ScannerGrade
from app.schemas.signals import SignalLifecycle


def _record(candidate_id: str, signal_id: str, lifecycle: SignalLifecycle, grade: ScannerGrade):
    return SimpleNamespace(
        candidate_id=candidate_id,
        signal_id=signal_id,
        symbol="BTCUSDT",
        lifecycle=lifecycle,
        grade=grade,
    )


def test_signal_links_keep_only_card_eligible_identity_pairs() -> None:
    service = SimpleNamespace(
        signals=lambda: SimpleNamespace(
            signals=[
                _record("candidate-a", "a" * 64, SignalLifecycle.ACTIVE, ScannerGrade.A),
                _record("candidate-watch", "b" * 64, SignalLifecycle.WATCH, ScannerGrade.B_PLUS),
                _record("candidate-rejected", "c" * 64, SignalLifecycle.REJECTED, ScannerGrade.A),
            ]
        )
    )

    result = asyncio.run(signal_links(service))

    assert result.count == 2
    assert [(link.candidate_id, link.signal_id) for link in result.links] == [
        ("candidate-a", "a" * 64),
        ("candidate-watch", "b" * 64),
    ]
