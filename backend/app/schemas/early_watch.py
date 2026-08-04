"""Non-executable developing setup contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class EarlyWatchItem(BaseModel):
    """One developing setup derived from scanner audit evidence."""

    symbol: str
    lifecycle: Literal["EARLY_WATCH"] = "EARLY_WATCH"
    executable: Literal[False] = False
    source_code: str
    reason: str
    timeframe: str | None = None
    reference_time: datetime | None = None
    observed: str | None = None
    threshold: str | None = None


class EarlyWatchList(BaseModel):
    """Latest full-scan developing setups, isolated from execution candidates."""

    count: int = Field(ge=0)
    source_run_id: str | None = None
    generated_at: datetime | None = None
    items: list[EarlyWatchItem]
