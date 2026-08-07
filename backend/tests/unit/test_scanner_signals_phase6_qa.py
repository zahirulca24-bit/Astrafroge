"""Final Scanner & Signals QA guards for Phase 6."""

from types import SimpleNamespace

from app.api.v1.routes.signals import _card_eligible
from app.schemas.scanner import ScannerGrade
from app.schemas.signals import SignalLifecycle


def _signal(lifecycle: SignalLifecycle, grade: ScannerGrade | None):
    return SimpleNamespace(lifecycle=lifecycle, grade=grade)


def test_only_actionable_or_watch_signal_states_can_render_cards() -> None:
    allowed = {
        (SignalLifecycle.ACTIVE, ScannerGrade.A_PLUS),
        (SignalLifecycle.ACTIVE, ScannerGrade.A),
        (SignalLifecycle.WATCH, ScannerGrade.B_PLUS),
    }

    for lifecycle in SignalLifecycle:
        for grade in (ScannerGrade.A_PLUS, ScannerGrade.A, ScannerGrade.B_PLUS, None):
            assert _card_eligible(_signal(lifecycle, grade)) is ((lifecycle, grade) in allowed)


def test_terminal_signal_states_never_render_normal_cards() -> None:
    for lifecycle in (
        SignalLifecycle.EXPIRED,
        SignalLifecycle.INVALIDATED,
        SignalLifecycle.REJECTED,
        SignalLifecycle.RISK_BLOCKED,
    ):
        assert _card_eligible(_signal(lifecycle, ScannerGrade.A_PLUS)) is False
        assert _card_eligible(_signal(lifecycle, ScannerGrade.A)) is False
        assert _card_eligible(_signal(lifecycle, ScannerGrade.B_PLUS)) is False
