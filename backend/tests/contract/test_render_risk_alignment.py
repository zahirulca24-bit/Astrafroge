"""Deployment contract for fail-closed Demo risk alignment."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
RENDER_BLUEPRINT = ROOT / "render.yaml"


def test_render_blueprint_keeps_execution_disabled() -> None:
    content = RENDER_BLUEPRINT.read_text(encoding="utf-8")

    assert "- key: ASTRAFORGE_EXECUTION_ENABLED\n        value: \"false\"" in content


def test_render_blueprint_declares_demo_risk_limits() -> None:
    content = RENDER_BLUEPRINT.read_text(encoding="utf-8")

    expected = {
        "ASTRAFORGE_EXECUTION_TAKE_PROFIT_R_MULTIPLE": "2",
        "ASTRAFORGE_RISK_PER_TRADE_PERCENT": "0.25",
        "ASTRAFORGE_RISK_DAILY_LOSS_LIMIT_PERCENT": "2",
        "ASTRAFORGE_RISK_DAILY_PROFIT_LOCK_PERCENT": "5",
        "ASTRAFORGE_RISK_MAX_OPEN_TRADES": "4",
        "ASTRAFORGE_RISK_MAX_MARGIN_EXPOSURE_USDT": "1000",
    }

    for key, value in expected.items():
        declaration = f'- key: {key}\n        value: "{value}"'
        assert declaration in content, f"Missing or misaligned Render setting: {key}"


def test_credentialed_cors_remains_enabled() -> None:
    content = RENDER_BLUEPRINT.read_text(encoding="utf-8")

    assert "- key: ASTRAFORGE_CORS_ALLOW_CREDENTIALS\n        value: \"true\"" in content
