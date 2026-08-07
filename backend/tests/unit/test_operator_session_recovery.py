"""Regression coverage for operator-session repository recovery."""

from __future__ import annotations

from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import Settings
from app.main import create_app
from app.persistence import TradingStateRepositories

_TOKEN = "astraforge-test-operator-token-2026"


def _settings() -> Settings:
    return Settings(
        _env_file=None,
        environment="test",
        cors_origins=["http://localhost:5173"],
        cors_allow_credentials=True,
        mutation_auth_required=True,
        mutation_api_token=SecretStr(_TOKEN),
    )


def test_operator_login_recovers_repository_from_active_persistence(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv(
        "ASTRAFORGE_DATABASE_URL",
        f"sqlite+pysqlite:///{tmp_path / 'operator-session.db'}",
    )
    app = create_app(_settings())

    with TestClient(app) as client:
        assert app.state.persistence is not None
        app.state.trading_state_repositories = None

        response = client.post(
            "/api/v1/operator-session/login",
            json={"operator_token": _TOKEN},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "authenticated"
        assert isinstance(app.state.trading_state_repositories, TradingStateRepositories)

        status = client.get("/api/v1/operator-session/status")
        assert status.status_code == 200
        assert status.json()["status"] == "authenticated"
