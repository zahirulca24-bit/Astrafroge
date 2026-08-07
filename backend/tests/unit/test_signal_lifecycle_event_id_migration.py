"""Regression coverage for lifecycle event IDs longer than 64 characters."""

from __future__ import annotations

from sqlalchemy import inspect

from app.core.config import Settings
from app.persistence.database import Persistence


def test_latest_schema_accepts_extended_signal_lifecycle_event_ids(tmp_path, monkeypatch) -> None:
    database_url = f"sqlite+pysqlite:///{tmp_path / 'lifecycle-event-id.db'}"
    monkeypatch.setenv("ASTRAFORGE_DATABASE_URL", database_url)

    settings = Settings(_env_file=None, environment="test")
    persistence = Persistence.from_settings(settings)
    assert persistence is not None

    try:
        persistence.upgrade_schema()
        columns = {
            column["name"]: column
            for column in inspect(persistence.engine).get_columns("signal_lifecycle_history")
        }
        event_id_type = columns["event_id"]["type"]
        assert getattr(event_id_type, "length", None) == 128
    finally:
        persistence.close()
