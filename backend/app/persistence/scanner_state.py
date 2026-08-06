"""Durable scanner runtime snapshot and restart recovery."""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, Text, insert, select, update

from app.persistence.database import Persistence
from app.schemas.indicators import IndicatorPoint
from app.schemas.market import MarketCandle
from app.schemas.scanner import ScannerCandidate, ScannerDirection, ScannerRunSummary, ScannerSetup, ScannerState
from app.schemas.universe import UniverseCandidate
from app.services.scanner import ScannerService
from app.services.scanner_base import EvaluationContext, Frame

_SNAPSHOT_KEY = "primary"
_SCHEMA_VERSION = 1
_metadata = MetaData()
scanner_runtime_snapshots = Table(
    "scanner_runtime_snapshots",
    _metadata,
    Column("snapshot_key", String(32), primary_key=True),
    Column("schema_version", Integer, nullable=False),
    Column("payload_json", Text, nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)


class ScannerStateRecoveryError(RuntimeError):
    """Stored scanner state is malformed or incompatible."""


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("Scanner persistence timestamps must be timezone-aware")
    return value.astimezone(UTC)


def _frame_payload(frame: Frame) -> dict[str, Any]:
    return {
        "candle": frame.candle.model_dump(mode="json"),
        "indicator": frame.indicator.model_dump(mode="json"),
    }


def _frame_from_payload(payload: dict[str, Any]) -> Frame:
    return Frame(
        candle=MarketCandle.model_validate(payload["candle"]),
        indicator=IndicatorPoint.model_validate(payload["indicator"]),
    )


def _context_payload(context: EvaluationContext) -> dict[str, Any]:
    return {
        "direction": context.direction.value,
        "h": [_frame_payload(item) for item in context.h],
        "s": [_frame_payload(item) for item in context.s],
        "e": [_frame_payload(item) for item in context.e],
        "universe": context.universe.model_dump(mode="json"),
        "exchange_time": context.exchange_time.isoformat(),
        "counts": dict(context.counts),
        "freshness": {key: format(value, "f") for key, value in context.freshness.items()},
    }


def _context_from_payload(payload: dict[str, Any]) -> EvaluationContext:
    return EvaluationContext(
        direction=ScannerDirection(payload["direction"]),
        h=[_frame_from_payload(item) for item in payload["h"]],
        s=[_frame_from_payload(item) for item in payload["s"]],
        e=[_frame_from_payload(item) for item in payload["e"]],
        universe=UniverseCandidate.model_validate(payload["universe"]),
        exchange_time=datetime.fromisoformat(payload["exchange_time"]),
        counts={str(key): int(value) for key, value in payload["counts"].items()},
        freshness={str(key): Decimal(str(value)) for key, value in payload["freshness"].items()},
    )


def _dt(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value is not None else None


class ScannerRuntimeStateStore:
    """Persist the complete bounded scanner runtime as one atomic snapshot."""

    def __init__(self, persistence: Persistence) -> None:
        self._persistence = persistence

    def save(self, scanner: ScannerService) -> None:
        payload = {
            "state": scanner._state.value,
            "candidates": [
                candidate.model_dump(mode="json") for candidate in scanner._candidates.values()
            ],
            "candidate_contexts": {
                candidate_id: _context_payload(context)
                for candidate_id, context in scanner._candidate_contexts.items()
            },
            "terminal_keys": sorted(scanner._terminal_keys),
            "terminal_history": [
                {
                    "symbol": symbol,
                    "direction": direction.value,
                    "setup": setup.value,
                    "terminal_at": terminal_at.isoformat(),
                }
                for (symbol, direction, setup), terminal_at in scanner._terminal_history.items()
            ],
            "runs": [run.model_dump(mode="json") for run in scanner._runs],
            "next_full_scan_at": (
                scanner._next_full_scan_at.isoformat()
                if scanner._next_full_scan_at is not None
                else None
            ),
            "next_refresh_at": (
                scanner._next_refresh_at.isoformat()
                if scanner._next_refresh_at is not None
                else None
            ),
            "last_refresh_boundary": (
                scanner._last_refresh_boundary.isoformat()
                if scanner._last_refresh_boundary is not None
                else None
            ),
        }
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        now = datetime.now(UTC)
        with self._persistence.transaction() as session:
            existing = session.execute(
                select(scanner_runtime_snapshots.c.snapshot_key).where(
                    scanner_runtime_snapshots.c.snapshot_key == _SNAPSHOT_KEY
                )
            ).first()
            if existing is None:
                session.execute(
                    insert(scanner_runtime_snapshots).values(
                        snapshot_key=_SNAPSHOT_KEY,
                        schema_version=_SCHEMA_VERSION,
                        payload_json=encoded,
                        updated_at=now,
                    )
                )
            else:
                session.execute(
                    update(scanner_runtime_snapshots)
                    .where(scanner_runtime_snapshots.c.snapshot_key == _SNAPSHOT_KEY)
                    .values(
                        schema_version=_SCHEMA_VERSION,
                        payload_json=encoded,
                        updated_at=now,
                    )
                )

    def restore(self, scanner: ScannerService) -> bool:
        with self._persistence.transaction() as session:
            row = session.execute(
                select(
                    scanner_runtime_snapshots.c.schema_version,
                    scanner_runtime_snapshots.c.payload_json,
                ).where(scanner_runtime_snapshots.c.snapshot_key == _SNAPSHOT_KEY)
            ).mappings().first()
        if row is None:
            return False
        if int(row["schema_version"]) != _SCHEMA_VERSION:
            raise ScannerStateRecoveryError("Unsupported scanner snapshot schema version")
        try:
            payload = json.loads(str(row["payload_json"]))
            scanner._state = ScannerState(payload["state"])
            scanner._run_active = False
            scanner._candidates = {
                item["candidate_id"]: ScannerCandidate.model_validate(item)
                for item in payload["candidates"]
            }
            scanner._candidate_contexts = {
                candidate_id: _context_from_payload(context)
                for candidate_id, context in payload["candidate_contexts"].items()
                if candidate_id in scanner._candidates
            }
            scanner._terminal_keys = set(payload["terminal_keys"])
            scanner._terminal_history = {
                (
                    item["symbol"],
                    ScannerDirection(item["direction"]),
                    ScannerSetup(item["setup"]),
                ): _utc(datetime.fromisoformat(item["terminal_at"]))
                for item in payload["terminal_history"]
            }
            scanner._runs = [ScannerRunSummary.model_validate(item) for item in payload["runs"]]
            scanner._next_full_scan_at = _dt(payload["next_full_scan_at"])
            scanner._next_refresh_at = _dt(payload["next_refresh_at"])
            scanner._last_refresh_boundary = _dt(payload["last_refresh_boundary"])
            scanner._scheduler_task = None
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise ScannerStateRecoveryError("Scanner runtime snapshot is invalid") from exc
        return True


class PersistentScannerService(ScannerService):
    """Scanner service that atomically saves and restores bounded runtime state."""

    def __init__(self, *args: Any, state_store: ScannerRuntimeStateStore, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._state_store = state_store
        self._state_store.restore(self)
        if self._state is ScannerState.ON:
            try:
                asyncio.get_running_loop()
            except RuntimeError:
                pass
            else:
                self._ensure_scheduler()

    async def start(self):  # type: ignore[no-untyped-def]
        response = await super().start()
        if self._state is ScannerState.ON:
            self._ensure_scheduler()
        self._state_store.save(self)
        return response

    async def stop(self):  # type: ignore[no-untyped-def]
        response = await super().stop()
        self._state_store.save(self)
        return response

    async def full_scan(self):  # type: ignore[no-untyped-def]
        try:
            return await super().full_scan()
        finally:
            self._state_store.save(self)

    async def active_refresh(self):  # type: ignore[no-untyped-def]
        try:
            return await super().active_refresh()
        finally:
            self._state_store.save(self)

    async def _scheduler_loop(self) -> None:  # pragma: no cover - integration clock loop
        try:
            while self._state is ScannerState.ON:
                now = self._clock.now()
                if self._next_full_scan_at is not None and now >= self._next_full_scan_at:
                    await self.full_scan()
                if self._next_refresh_at is not None and now >= self._next_refresh_at:
                    boundary = self._next_refresh_at
                    run = await self.active_refresh()
                    if run.status.value != "SKIPPED":
                        self._last_refresh_boundary = boundary
                    while boundary <= self._clock.now():
                        boundary += self._active_refresh_interval()
                    self._next_refresh_at = boundary
                    self._state_store.save(self)
                await self._clock.sleep(1)
        except asyncio.CancelledError:
            return

    @staticmethod
    def _active_refresh_interval():  # type: ignore[no-untyped-def]
        from app.services.scanner_contract import ACTIVE_REFRESH_INTERVAL

        return ACTIVE_REFRESH_INTERVAL
