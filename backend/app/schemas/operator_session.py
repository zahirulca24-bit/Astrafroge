"""Operator session request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import SecretStr

from app.schemas.common import StrictResponseModel


class OperatorLoginRequest(StrictResponseModel):
    operator_token: SecretStr


class OperatorSessionStatusResponse(StrictResponseModel):
    status: Literal["authenticated"]
    authenticated: bool = True
    issued_at: datetime
    expires_at: datetime
    last_seen_at: datetime