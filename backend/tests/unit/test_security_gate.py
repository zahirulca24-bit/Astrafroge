"""Regression tests for protected mutation endpoints and replay controls."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError

from app.core.config import Settings
from app.core.logging import JsonFormatter
from app.core.security import (
    MUTATION_OPENAPI_PATHS,
    OPERATOR_SESSION_COOKIE,
    MutationReplayGuard,
    ReplayClaimResult,
    _valid_token,
)
from app.main import create_app
from app.persistence.models import MutationReplayKeyRow, OperatorSessionRow

_TOKEN = "astraforge-test-operator-token-2026"


def _settings(*, token: str | None = _TOKEN, auth_required: bool = True) -> Settings:
    return Settings(
        _env_file=None,
        environment="test",
        cors_origins=["http://localhost:5173"],
        mutation_auth_required=auth_required,
        mutation_api_token=SecretStr(token) if token is not None else None,
    )


def _auth_settings(*, token: str | None = _TOKEN, auth_required: bool = True) -> Settings:
    return Settings(
        _env_file=None,
        environment="test",
        cors_origins=["http://localhost:5173"],
        cors_allow_credentials=True,
        mutation_auth_required=auth_required,
        mutation_api_token=SecretStr(token) if token is not None else None,
    )


def _login(client: TestClient, token: str = _TOKEN) -> None:
    response = client.post("/api/v1/operator-session/login", json={"operator_token": token})
    assert response.status_code == 200
    assert response.json()["status"] == "authenticated"


def _error_code(response) -> str:  # type: ignore[no-untyped-def]
    return str(response.json()["error"]["code"])


def _idempotency_parameter(operation: dict[str, Any]) -> dict[str, Any]:
    parameters = operation.get("parameters")
    assert isinstance(parameters, list)
    for parameter in parameters:
        if (
            isinstance(parameter, dict)
            and parameter.get("in") == "header"
            and str(parameter.get("name", "")).lower() == "idempotency-key"
        ):
            return parameter
    raise AssertionError("Idempotency-Key parameter is missing")


def test_read_only_scanner_status_remains_public() -> None:
    with TestClient(create_app(_settings())) as client:
        response = client.get("/api/v1/scanner/status")

    assert response.status_code == 200


def test_mutation_fails_closed_when_operator_token_is_not_configured() -> None:
    with TestClient(create_app(_settings(token=None))) as client:
        response = client.post(
            "/api/v1/scanner/stop",
            headers={"Idempotency-Key": "security-test-key-0002"},
        )

    assert response.status_code == 503
    assert _error_code(response) == "MUTATION_AUTH_NOT_CONFIGURED"


def test_mutation_requires_valid_operator_session_cookie(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ASTRAFORGE_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'auth.db'}")
    with TestClient(create_app(_auth_settings())) as client:
        missing = client.post(
            "/api/v1/scanner/stop",
            headers={"Idempotency-Key": "security-test-key-0003"},
        )

    assert missing.status_code == 401
    assert _error_code(missing) == "OPERATOR_SESSION_REQUIRED"


def test_non_ascii_bearer_credentials_are_rejected_without_type_error() -> None:
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials="tést-operator-token",
    )

    assert _valid_token(credentials, _TOKEN) is False


def test_successful_operator_login_sets_a_cookie(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ASTRAFORGE_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'auth.db'}")
    with TestClient(create_app(_auth_settings())) as client:
        response = client.post("/api/v1/operator-session/login", json={"operator_token": _TOKEN})

    assert response.status_code == 200
    assert response.json()["status"] == "authenticated"
    assert OPERATOR_SESSION_COOKIE in response.cookies


def test_failed_operator_login_is_rejected(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ASTRAFORGE_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'auth.db'}")
    with TestClient(create_app(_auth_settings())) as client:
        response = client.post(
            "/api/v1/operator-session/login",
            json={"operator_token": "wrong-token"},
        )

    assert response.status_code == 401
    assert _error_code(response) == "INVALID_OPERATOR_CREDENTIALS"


def test_rate_limited_operator_login(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ASTRAFORGE_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'auth.db'}")
    settings = _auth_settings()
    settings.operator_login_max_attempts = 2
    with TestClient(create_app(settings)) as client:
        first = client.post(
            "/api/v1/operator-session/login",
            json={"operator_token": "wrong-token"},
        )
        second = client.post(
            "/api/v1/operator-session/login",
            json={"operator_token": "wrong-token"},
        )
        limited = client.post(
            "/api/v1/operator-session/login",
            json={"operator_token": "wrong-token"},
        )

    assert first.status_code == 401
    assert second.status_code == 401
    assert limited.status_code == 429
    assert _error_code(limited) == "OPERATOR_LOGIN_RATE_LIMITED"


def test_session_validation_and_logout(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ASTRAFORGE_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'auth.db'}")
    with TestClient(create_app(_auth_settings())) as client:
        _login(client)
        validation = client.get("/api/v1/operator-session/status")
        logout = client.post("/api/v1/operator-session/logout")
        expired = client.get("/api/v1/operator-session/status")

    assert validation.status_code == 200
    assert validation.json()["status"] == "authenticated"
    assert logout.status_code == 204
    assert expired.status_code == 401
    assert _error_code(expired) == "OPERATOR_SESSION_REQUIRED"


def test_expired_operator_session_is_rejected(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ASTRAFORGE_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'auth.db'}")
    app = create_app(_auth_settings())
    with TestClient(app) as client:
        _login(client)
        repository = app.state.trading_state_repositories
        assert repository is not None
        session_cookie = client.cookies.get(OPERATOR_SESSION_COOKIE)
        assert session_cookie is not None
        session_hash = hashlib.sha256(session_cookie.encode()).hexdigest()
        with repository.persistence.transaction() as db:
            row = db.get(OperatorSessionRow, session_hash)
            assert row is not None
            row.expires_at = datetime.now(UTC) - timedelta(seconds=1)

        validation = client.get("/api/v1/operator-session/status")

    assert validation.status_code == 401
    assert _error_code(validation) == "OPERATOR_SESSION_EXPIRED"


def test_authenticated_protected_mutation(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ASTRAFORGE_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'auth.db'}")
    with TestClient(create_app(_auth_settings())) as client:
        _login(client)
        response = client.post(
            "/api/v1/scanner/stop",
            headers={"Idempotency-Key": "security-test-key-0004"},
        )

    assert response.status_code == 200


def test_session_is_required_for_authenticated_mutation(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ASTRAFORGE_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'auth.db'}")
    with TestClient(create_app(_auth_settings())) as client:
        response = client.post(
            "/api/v1/scanner/stop",
            headers={"Idempotency-Key": "security-test-key-0005"},
        )

    assert response.status_code == 401
    assert _error_code(response) == "OPERATOR_SESSION_REQUIRED"


def test_mutation_requires_a_valid_idempotency_key(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ASTRAFORGE_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'auth.db'}")
    with TestClient(create_app(_auth_settings())) as client:
        _login(client)
        missing = client.post("/api/v1/scanner/stop")
        invalid = client.post(
            "/api/v1/scanner/stop",
            headers={"Idempotency-Key": "too-short"},
        )

    assert missing.status_code == 400
    assert invalid.status_code == 400
    assert _error_code(missing) == "IDEMPOTENCY_KEY_REQUIRED"
    assert _error_code(invalid) == "INVALID_IDEMPOTENCY_KEY"


def test_identical_mutation_replay_is_rejected(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ASTRAFORGE_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'auth.db'}")
    with TestClient(create_app(_auth_settings())) as client:
        _login(client)
        headers = {"Idempotency-Key": "security-test-key-0001"}
        first = client.post("/api/v1/scanner/stop", headers=headers)
        replay = client.post("/api/v1/scanner/stop", headers=headers)

    assert first.status_code == 200
    assert replay.status_code == 409
    assert _error_code(replay) == "REPLAY_DETECTED"
    assert first.headers["x-request-id"]
    assert replay.headers["x-request-id"]


def test_idempotency_key_cannot_be_reused_for_another_mutation(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ASTRAFORGE_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'auth.db'}")
    trade_id = "00000000-0000-0000-0000-000000000000"
    headers = {"Idempotency-Key": "security-test-key-0005"}
    with TestClient(create_app(_auth_settings())) as client:
        _login(client)
        first = client.post(
            f"/api/v1/trade-management/close/{trade_id}",
            headers=headers,
            json={},
        )
        reused = client.post("/api/v1/scanner/stop", headers=headers)

    assert first.status_code == 404
    assert reused.status_code == 409
    assert _error_code(reused) == "IDEMPOTENCY_KEY_REUSED"


def test_replay_guard_fails_closed_at_capacity_and_recovers_after_expiry() -> None:
    guard = MutationReplayGuard(ttl_seconds=60, cache_limit=2)
    now = datetime(2026, 7, 17, tzinfo=UTC)

    async def exercise() -> tuple[
        ReplayClaimResult,
        ReplayClaimResult,
        ReplayClaimResult,
        ReplayClaimResult,
    ]:
        first = await guard.claim(key_hash="a", fingerprint="one", action="POST /a", now=now)
        second = await guard.claim(key_hash="b", fingerprint="two", action="POST /b", now=now)
        capacity = await guard.claim(
            key_hash="c",
            fingerprint="three",
            action="POST /c",
            now=now,
        )
        recovered = await guard.claim(
            key_hash="c",
            fingerprint="three",
            action="POST /c",
            now=now + timedelta(seconds=61),
        )
        return first, second, capacity, recovered

    first, second, capacity, recovered = asyncio.run(exercise())
    assert first is ReplayClaimResult.ACCEPTED
    assert second is ReplayClaimResult.ACCEPTED
    assert capacity is ReplayClaimResult.CAPACITY_EXHAUSTED
    assert recovered is ReplayClaimResult.ACCEPTED


def test_production_cannot_disable_mutation_authentication() -> None:
    with pytest.raises(ValidationError, match="Mutation authentication cannot be disabled"):
        Settings(
            _env_file=None,
            environment="production",
            cors_origins=["https://frontend.example.com"],
            mutation_auth_required=False,
        )


def test_mutation_token_must_be_strong_ascii_and_unpadded() -> None:
    with pytest.raises(ValidationError, match="at least 32 characters"):
        _settings(token="short-token")
    with pytest.raises(ValidationError, match="surrounding whitespace"):
        _settings(token=f" {_TOKEN}")
    with pytest.raises(ValidationError, match="ASCII characters only"):
        _settings(token=f"é{_TOKEN}")


def test_mutation_token_is_redacted_from_structured_logs() -> None:
    formatter = JsonFormatter([_TOKEN])
    record = logging.LogRecord(
        name="astraforge.mutation_audit",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg=f"Authorization: Bearer {_TOKEN}",
        args=(),
        exc_info=None,
    )
    record.audit_event = "mutation_request"
    record.actor = "operator"
    record.action = "POST /api/v1/scanner/stop"
    record.outcome = "success"
    record.status_code = 200

    payload = json.loads(formatter.format(record))
    assert _TOKEN not in json.dumps(payload)
    assert payload["audit_event"] == "mutation_request"
    assert payload["outcome"] == "success"
    assert payload["status_code"] == 200


def test_openapi_marks_mutations_as_bearer_protected_with_required_idempotency() -> None:
    with TestClient(create_app(_settings())) as client:
        document = client.get("/api/v1/openapi.json").json()

    for relative_path in MUTATION_OPENAPI_PATHS:
        operation = document["paths"][f"/api/v1{relative_path}"]["post"]
        parameter = _idempotency_parameter(operation)
        assert parameter["required"] is True
        parameter_schema = parameter["schema"]
        assert parameter_schema["minLength"] == 16
        assert parameter_schema["maxLength"] == 128
        assert parameter_schema["pattern"] == r"^[A-Za-z0-9._:-]{16,128}$"

    status_operation = document["paths"]["/api/v1/scanner/status"]["get"]
    assert "security" not in status_operation


def test_operator_session_routes_are_documented() -> None:
    with TestClient(create_app(_auth_settings())) as client:
        document = client.get("/api/v1/openapi.json").json()

    login_operation = document["paths"]["/api/v1/operator-session/login"]["post"]
    status_operation = document["paths"]["/api/v1/operator-session/status"]["get"]
    logout_operation = document["paths"]["/api/v1/operator-session/logout"]["post"]

    assert login_operation["responses"]["200"]
    assert status_operation["responses"]["200"]
    assert logout_operation["responses"]["204"]


def test_replay_state_is_durable_across_app_restart(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database_url = f"sqlite+pysqlite:///{tmp_path / 'replay.db'}"
    monkeypatch.setenv("ASTRAFORGE_DATABASE_URL", database_url)
    settings = _auth_settings()

    first_app = create_app(settings)
    with TestClient(first_app) as client:
        _login(client)
        headers = {"Idempotency-Key": "security-test-key-0001"}
        first = client.post("/api/v1/scanner/stop", headers=headers)
    assert first.status_code == 200

    second_app = create_app(settings)
    with TestClient(second_app) as client:
        _login(client)
        replay = client.post("/api/v1/scanner/stop", headers=headers)
        repository = second_app.state.trading_state_repositories
        assert repository is not None
        row = repository.active_mutation_replay(
            hashlib.sha256(headers["Idempotency-Key"].encode()).hexdigest(),
            now=datetime.now(UTC),
        )

    assert replay.status_code == 409
    assert _error_code(replay) == "REPLAY_DETECTED"
    assert row is not None
    assert isinstance(row, MutationReplayKeyRow)
    assert row.action == "POST /api/v1/scanner/stop"


def test_idempotency_key_reuse_for_different_request_is_durable_across_restart(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database_url = f"sqlite+pysqlite:///{tmp_path / 'replay-reuse.db'}"
    monkeypatch.setenv("ASTRAFORGE_DATABASE_URL", database_url)
    settings = _auth_settings()
    headers = {"Idempotency-Key": "security-test-key-0099"}
    trade_id = "00000000-0000-0000-0000-000000000000"

    first_app = create_app(settings)
    with TestClient(first_app) as client:
        _login(client)
        first = client.post(
            f"/api/v1/trade-management/close/{trade_id}",
            headers=headers,
            json={},
        )
    assert first.status_code == 404

    second_app = create_app(settings)
    with TestClient(second_app) as client:
        _login(client)
        reused = client.post("/api/v1/scanner/stop", headers=headers)

    assert reused.status_code == 409
    assert _error_code(reused) == "IDEMPOTENCY_KEY_REUSED"
