"""API contract tests for verified runtime endpoints."""

from fastapi.testclient import TestClient


def test_live_contract(client: TestClient) -> None:
    response = client.get("/api/v1/health/live")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "AstraForge Crypto Backend"
    assert body["version"] == "0.4.0"
    assert body["timestamp"].endswith("Z")
    assert response.headers["X-Request-ID"]


def test_ready_contract_is_honest(client: TestClient) -> None:
    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "service": "AstraForge Crypto Backend",
        "version": "0.4.0",
        "execution_status": "blocked",
        "market_data_status": "not_configured",
        "demo_account_status": "not_configured",
        "timestamp": response.json()["timestamp"],
    }


def test_system_status_contract_is_fail_closed(client: TestClient) -> None:
    response = client.get("/api/v1/system/status")

    assert response.status_code == 200
    body = response.json()
    assert body["environment"] == "test"
    assert body["execution_enabled"] is False
    assert body["market_data_status"] == "not_configured"
    assert body["demo_account_status"] == "not_configured"
    assert "balance" not in body
    assert "position" not in body
    assert "pnl" not in body


def test_openapi_contains_verified_runtime_routes(client: TestClient) -> None:
    response = client.get("/api/v1/openapi.json")

    assert response.status_code == 200
    paths = set(response.json()["paths"])
    assert paths == {
        "/api/v1/health",
        "/api/v1/health/live",
        "/api/v1/health/ready",
        "/api/v1/indicators/{symbol}",
        "/api/v1/journal-performance/journal",
        "/api/v1/journal-performance/performance",
        "/api/v1/journal-performance/status",
        "/api/v1/operator-session/login",
        "/api/v1/operator-session/logout",
        "/api/v1/operator-session/status",
        "/api/v1/market/klines/{symbol}",
        "/api/v1/market/status",
        "/api/v1/market/symbols",
        "/api/v1/market/ticker/{symbol}",
        "/api/v1/execution/demo/activate/{signal_id}",
        "/api/v1/execution/demo/account",
        "/api/v1/execution/demo/plans",
        "/api/v1/execution/demo/status",
        "/api/v1/execution/demo/trades",
        "/api/v1/risk/assessments",
        "/api/v1/risk/status",
        "/api/v1/scanner/candidates",
        "/api/v1/scanner/early-watch",
        "/api/v1/scanner/evaluations/latest",
        "/api/v1/scanner/run-now",
        "/api/v1/scanner/runs/latest",
        "/api/v1/scanner/start",
        "/api/v1/scanner/status",
        "/api/v1/scanner/stop",
        "/api/v1/signals",
        "/api/v1/signals/cards",
        "/api/v1/signals/links",
        "/api/v1/signals/{signal_id}",
        "/api/v1/signals/status",
        "/api/v1/system/status",
        "/api/v1/trade-management/close/{trade_id}",
        "/api/v1/trade-management/status",
        "/api/v1/trade-management/trades",
        "/api/v1/trade-management/trades-journal",
        "/api/v1/universe",
    }
