"""Authoritative per-symbol scanner table contracts for the merged Scanner & Signals UI."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field

from app.schemas.scanner import ScannerDirection, ScannerGrade, ScannerRunStatus


class ScannerTableStatus(StrEnum):
    READY = "READY"
    NEAR_SETUP = "NEAR_SETUP"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


class ScannerTableRow(BaseModel):
    universe_rank: int = Field(ge=1)
    symbol: str
    direction: ScannerDirection | None = None
    setup_name: str | None = None
    trend_1h: str
    setup_15m: str
    entry_5m: str
    grade: ScannerGrade | None = None
    score: int | None = Field(default=None, ge=0, le=100)
    confidence: int | None = Field(default=None, ge=0, le=100)
    status: ScannerTableStatus
    candidate_id: str | None = None
    primary_reason_code: str | None = None
    primary_reason: str | None = None
    audit_codes: list[str] = Field(default_factory=list)


class ScannerTableSummary(BaseModel):
    run_id: str
    run_status: ScannerRunStatus
    total: int = Field(ge=0)
    ready: int = Field(ge=0)
    near_setup: int = Field(ge=0)
    rejected: int = Field(ge=0)
    failed: int = Field(ge=0)


class ScannerTableSnapshot(BaseModel):
    summary: ScannerTableSummary
    rows: list[ScannerTableRow]
