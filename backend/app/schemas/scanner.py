"""Typed Scanner Engine Runtime contracts."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class ScannerState(StrEnum):
    OFF = "OFF"
    ON = "ON"


class ScannerRunType(StrEnum):
    FULL_UNIVERSE_SCAN = "FULL_UNIVERSE_SCAN"
    ACTIVE_CANDIDATE_REFRESH = "ACTIVE_CANDIDATE_REFRESH"


class ScannerRunStatus(StrEnum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    DEGRADED = "DEGRADED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class ScannerDirection(StrEnum):
    LONG = "LONG"
    SHORT = "SHORT"


class ScannerSetup(StrEnum):
    TREND_PULLBACK = "trend_pullback"
    BREAKOUT_RETEST = "breakout_retest"
    EMA_REJECTION = "ema_rejection"
    LIQUIDITY_SWEEP_REVERSAL = "liquidity_sweep_reversal"
    CONTINUATION_SETUP = "continuation_setup"


class CandidateLifecycle(StrEnum):
    DETECTED = "DETECTED"
    WATCH_NEAR = "WATCH_NEAR"
    QUALIFIED = "QUALIFIED"
    REJECTED = "REJECTED"
    INVALIDATED = "INVALIDATED"
    EXPIRED = "EXPIRED"


class ScannerGrade(StrEnum):
    A_PLUS = "A+"
    A = "A"
    B_PLUS = "B+"
    REJECT = "Reject"


class ScannerRegime(StrEnum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    SIDEWAYS = "SIDEWAYS"
    MIXED = "MIXED"


class ScannerRejectionCode(StrEnum):
    MARKET_TIME_UNAVAILABLE = "MARKET_TIME_UNAVAILABLE"
    CLOCK_SKEW_EXCEEDED = "CLOCK_SKEW_EXCEEDED"
    UNIVERSE_UNAVAILABLE = "UNIVERSE_UNAVAILABLE"
    UNIVERSE_STALE = "UNIVERSE_STALE"
    RATE_LIMIT_EXHAUSTED = "RATE_LIMIT_EXHAUSTED"
    FULL_MARKET_DATA_FAILURE = "FULL_MARKET_DATA_FAILURE"
    MISSING_1H_CANDLES = "MISSING_1H_CANDLES"
    MISSING_15M_CANDLES = "MISSING_15M_CANDLES"
    MISSING_5M_CANDLES = "MISSING_5M_CANDLES"
    INSUFFICIENT_1H_HISTORY = "INSUFFICIENT_1H_HISTORY"
    INSUFFICIENT_15M_HISTORY = "INSUFFICIENT_15M_HISTORY"
    INSUFFICIENT_5M_HISTORY = "INSUFFICIENT_5M_HISTORY"
    STALE_1H_DATA = "STALE_1H_DATA"
    STALE_15M_DATA = "STALE_15M_DATA"
    STALE_5M_DATA = "STALE_5M_DATA"
    INVALID_1H_OHLCV = "INVALID_1H_OHLCV"
    INVALID_15M_OHLCV = "INVALID_15M_OHLCV"
    INVALID_5M_OHLCV = "INVALID_5M_OHLCV"
    MISSING_REQUIRED_INDICATOR = "MISSING_REQUIRED_INDICATOR"
    INDICATOR_CALCULATION_FAILED = "INDICATOR_CALCULATION_FAILED"
    STRUCTURE_INSUFFICIENT = "STRUCTURE_INSUFFICIENT"
    UNIVERSE_ELIGIBILITY_FAILED = "UNIVERSE_ELIGIBILITY_FAILED"
    TREND_SIDEWAYS = "TREND_SIDEWAYS"
    TREND_MIXED = "TREND_MIXED"
    TREND_DIRECTION_MISMATCH = "TREND_DIRECTION_MISMATCH"
    VOLATILITY_BELOW_MINIMUM = "VOLATILITY_BELOW_MINIMUM"
    VOLATILITY_ABOVE_MAXIMUM = "VOLATILITY_ABOVE_MAXIMUM"
    PULLBACK_SEQUENCE_FAILED = "PULLBACK_SEQUENCE_FAILED"
    PULLBACK_ZONE_MISSED = "PULLBACK_ZONE_MISSED"
    BREAKOUT_NOT_CONFIRMED = "BREAKOUT_NOT_CONFIRMED"
    RETEST_NOT_CONFIRMED = "RETEST_NOT_CONFIRMED"
    EMA_REJECTION_NOT_CONFIRMED = "EMA_REJECTION_NOT_CONFIRMED"
    LIQUIDITY_SWEEP_NOT_CONFIRMED = "LIQUIDITY_SWEEP_NOT_CONFIRMED"
    CONTINUATION_COMPRESSION_FAILED = "CONTINUATION_COMPRESSION_FAILED"
    CONTINUATION_BREAKOUT_FAILED = "CONTINUATION_BREAKOUT_FAILED"
    VOLUME_BELOW_MINIMUM = "VOLUME_BELOW_MINIMUM"
    STRUCTURE_CONDITION_FAILED = "STRUCTURE_CONDITION_FAILED"
    SETUP_INVALIDATED = "SETUP_INVALIDATED"
    SETUP_NOT_DETECTED = "SETUP_NOT_DETECTED"
    SCORE_BELOW_80 = "SCORE_BELOW_80"
    CONFIDENCE_BELOW_60 = "CONFIDENCE_BELOW_60"
    REENTRY_COOLDOWN_ACTIVE = "REENTRY_COOLDOWN_ACTIVE"


class ScannerWatchCode(StrEnum):
    ENTRY_NOT_READY = "ENTRY_NOT_READY"
    ENTRY_OVEREXTENDED = "ENTRY_OVEREXTENDED"
    GRADE_B_PLUS_WATCH_ONLY = "GRADE_B_PLUS_WATCH_ONLY"
    CONFIDENCE_WATCH_ONLY = "CONFIDENCE_WATCH_ONLY"


class ScannerTerminalCode(StrEnum):
    CANDIDATE_INVALIDATED = "CANDIDATE_INVALIDATED"
    CANDIDATE_EXPIRED = "CANDIDATE_EXPIRED"


class ScannerSelectionCode(StrEnum):
    SCAN_ALREADY_RUNNING = "SCAN_ALREADY_RUNNING"
    DUPLICATE_CANDIDATE_UPDATED = "DUPLICATE_CANDIDATE_UPDATED"
    SUPERSEDED_BY_HIGHER_RANKED_SETUP = "SUPERSEDED_BY_HIGHER_RANKED_SETUP"
    PARTIAL_SYMBOL_FAILURE = "PARTIAL_SYMBOL_FAILURE"


class ScannerAuditRecord(BaseModel):
    """Deterministic rejection, invalidation, expiry, or selection evidence."""

    code: str
    detail: str
    symbol: str | None = None
    universe_rank: int | None = Field(default=None, ge=1)
    direction: ScannerDirection | None = None
    setup: ScannerSetup | None = None
    timeframe: str | None = None
    reference_time: datetime | None = None
    observed: str | None = None
    threshold: str | None = None


class ScannerCandidate(BaseModel):
    """One deterministic Scanner candidate."""

    candidate_id: str
    symbol: str
    direction: ScannerDirection
    setup: ScannerSetup
    setup_name: str
    timeframe: str = "15m"
    reference_close_time: datetime
    setup_confirmed_at: datetime
    expires_at: datetime
    qualification_expires_at: datetime | None = None
    lifecycle: CandidateLifecycle
    score: int | None = Field(default=None, ge=0, le=100)
    confidence: int | None = Field(default=None, ge=0, le=100)
    grade: ScannerGrade | None = None
    entry_ready: bool
    stale: bool = False
    universe_rank: int = Field(ge=1)
    quote_volume: Decimal = Field(ge=0)
    spread_bps: Decimal = Field(ge=0)
    level: Decimal | None = None
    selected_ema: Decimal | None = None
    entry_trigger_price: Decimal
    evaluated_at: datetime
    accepted_reasons: list[str] = Field(default_factory=list)
    audit_codes: list[str] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    score_components: dict[str, Decimal] = Field(default_factory=dict)


class ScannerRunSummary(BaseModel):
    """Scanner run summary and partial failure detail."""

    run_id: str
    run_type: ScannerRunType
    status: ScannerRunStatus
    run_started_at: datetime
    completed_at: datetime | None = None
    universe_size: int = Field(default=0, ge=0)
    evaluated_symbols: int = Field(default=0, ge=0)
    successful_symbols: int = Field(default=0, ge=0)
    failed_symbols: int = Field(default=0, ge=0)
    discovered_candidates: int = Field(default=0, ge=0)
    selected_candidates: int = Field(default=0, ge=0)
    updated_candidates: int = Field(default=0, ge=0)
    qualified_candidates: int = Field(default=0, ge=0)
    audits: list[ScannerAuditRecord] = Field(default_factory=list)


class ScannerStatusResponse(BaseModel):
    """Current process-scoped scanner runtime state."""

    state: ScannerState
    contract_version: str = "1"
    scanner_runtime_implemented: bool = True
    run_active: bool = False
    scheduler_running: bool = False
    next_full_scan_at: datetime | None = None
    next_refresh_at: datetime | None = None
    last_refresh_boundary: datetime | None = None
    active_candidate_count: int = Field(ge=0)
    terminal_candidate_count: int = Field(default=0, ge=0)
    latest_run: ScannerRunSummary | None = None


class ScannerCandidateSummary(BaseModel):
    """Frontend-friendly latest scanner run summary for empty-state visibility."""

    state: ScannerState
    run_id: str | None = None
    run_status: ScannerRunStatus | None = None
    run_type: ScannerRunType | None = None
    run_started_at: datetime | None = None
    completed_at: datetime | None = None
    evaluated_symbols: int = Field(default=0, ge=0)
    successful_symbols: int = Field(default=0, ge=0)
    failed_symbols: int = Field(default=0, ge=0)
    discovered_candidates: int = Field(default=0, ge=0)
    selected_candidates: int = Field(default=0, ge=0)
    updated_candidates: int = Field(default=0, ge=0)
    qualified_candidates: int = Field(default=0, ge=0)
    audits: list[ScannerAuditRecord] = Field(default_factory=list)


class ScannerCandidateList(BaseModel):
    """Filtered Scanner candidate response."""

    count: int = Field(ge=0)
    candidates: list[ScannerCandidate]
    summary: ScannerCandidateSummary
