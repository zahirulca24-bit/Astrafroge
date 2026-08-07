"""Phase 5 backend contract guard for the merged Scanner & Signals page."""

from fastapi.testclient import TestClient


def test_scanner_signals_merged_page_routes_remain_available(client: TestClient) -> None:
    response = client.get("/api/v1/openapi.json")

    assert response.status_code == 200
    paths = set(response.json()["paths"])
    assert {
        "/api/v1/scanner/evaluations/latest",
        "/api/v1/signals/status",
        "/api/v1/signals/cards",
        "/api/v1/signals/links",
    }.issubset(paths)
