"""Signal card eligibility regression tests for Phase 3."""

from types import SimpleNamespace

from app.api.v1.routes.signals import _card_eligible
from app.schemas.scanner import ScannerGrade
from app.schemas.signals import SignalLifecycle


def _signal(lifecycle: SignalLifecycle, grade: ScannerGrade | None):
    return SimpleNamespace(lifecycle=lifecycle, grade=grade)


def test_signal_cards_allow_only_actionable_and_watch_grades() -> None:
    assert _card_eligible(_signal(SignalLifecycle.ACTIVE, ScannerGrade.A_PLUS)) is True
    assert _card_eligible(_signal(SignalLifecycle.ACTIVE, ScannerGrade.A)) is True
    assert _card_eligible(_signal(SignalLifecycle.WATCH, ScannerGrade.B_PLUS)) is True


def test_signal_cards_reject_terminal_and_mismatched_states() -> None:
    assert _card_eligible(_signal(SignalLifecycle.REJECTED, ScannerGrade.A)) is False
    assert _card_eligible(_signal(SignalLifecycle.INVALIDATED, ScannerGrade.A_PLUS)) is False
    assert _card_eligible(_signal(SignalLifecycle.EXPIRED, ScannerGrade.B_PLUS)) is False
    assert _card_eligible(_signal(SignalLifecycle.RISK_BLOCKED, ScannerGrade.A)) is False
    assert _card_eligible(_signal(SignalLifecycle.ACTIVE, ScannerGrade.B_PLUS)) is False
    assert _card_eligible(_signal(SignalLifecycle.WATCH, ScannerGrade.A)) is False
