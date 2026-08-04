"""Fail-closed authorization, replay protection, and audit context for mutations."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import re
import secrets
from collections import OrderedDict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Annotated

from fastapi import Cookie, Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.persistence.models import OperatorSessionRow
from app.persistence.repositories import TradingStateRepositories

_IDEMPOTENCY_KEY_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{16,128}$")
_BEARER = HTTPBearer(auto_error=False)
OPERATOR_SESSION_COOKIE = "astraforge_operator_session"
MUTATION_OPENAPI_PATHS = (
    "/scanner/start",
    "/scanner/stop",
    "/scanner/run-now",
    "/execution/demo/activate/{signal_id}",
    "/trade-management/close/{trade_id}",
)


class ReplayClaimResult(StrEnum):
    """Result of claiming a single-use idempotency key."""

    ACCEPTED = "ACCEPTED"
    REPLAY = "REPLAY"
    REUSED_FOR_DIFFERENT_REQUEST = "REUSED_FOR_DIFFERENT_REQUEST"
    CAPACITY_EXHAUSTED = "CAPACITY_EXHAUSTED"


@dataclass(frozen=True)
class MutationAuthorization:
    """Authorized mutation metadata attached to the current request."""

    request_id: str
    actor: str
    action: str
    idempotency_key_hash: str
    request_fingerprint: str
    authorized_at: datetime


@dataclass(frozen=True)
class OperatorSessionAuthorization:
    """Validated operator session metadata."""

    session_hash: str
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime


class OperatorLoginRateLimiter:
    """Per-process brute-force guard for the operator login endpoint."""

    def __init__(self, *, max_attempts: int, window_seconds: int) -> None:
        if max_attempts < 1:
            raise ValueError("Operator login max attempts must be positive")
        if window_seconds < 1:
            raise ValueError("Operator login window must be positive")
        self._max_attempts = max_attempts
        self._window = timedelta(seconds=window_seconds)
        self._lock = asyncio.Lock()
        self._attempts: dict[str, list[datetime]] = {}

    async def check(
        self, *, client_id: str, now: datetime | None = None
    ) -> tuple[bool, int | None]:
        current = (now or datetime.now(UTC)).astimezone(UTC)
        async with self._lock:
            attempts = [
                attempt
                for attempt in self._attempts.get(client_id, [])
                if attempt > current - self._window
            ]
            self._attempts[client_id] = attempts
            if len(attempts) >= self._max_attempts:
                oldest = min(attempts)
                retry_after = max(1, int((oldest + self._window - current).total_seconds()))
                return False, retry_after
            return True, None

    async def record_failure(self, *, client_id: str, now: datetime | None = None) -> None:
        current = (now or datetime.now(UTC)).astimezone(UTC)
        async with self._lock:
            attempts = [
                attempt
                for attempt in self._attempts.get(client_id, [])
                if attempt > current - self._window
            ]
            attempts.append(current)
            self._attempts[client_id] = attempts

    async def clear(self, *, client_id: str) -> None:
        async with self._lock:
            self._attempts.pop(client_id, None)


@dataclass(frozen=True)
class _ReplayEntry:
    fingerprint: str
    expires_at: datetime


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class MutationReplayGuard:
    """Bounded process-scoped registry of single-use mutation idempotency keys."""

    def __init__(
        self,
        *,
        ttl_seconds: int,
        cache_limit: int,
        repositories: TradingStateRepositories | None = None,
    ) -> None:
        if ttl_seconds < 1:
            raise ValueError("Replay TTL must be positive")
        if cache_limit < 1:
            raise ValueError("Replay cache limit must be positive")
        self._ttl = timedelta(seconds=ttl_seconds)
        self._cache_limit = cache_limit
        self._repositories = repositories
        self._entries: OrderedDict[str, _ReplayEntry] = OrderedDict()
        self._lock = asyncio.Lock()

    async def claim(
        self,
        *,
        key_hash: str,
        fingerprint: str,
        action: str,
        now: datetime | None = None,
    ) -> ReplayClaimResult:
        """Atomically reserve one idempotency key and reject duplicates."""

        current = (now or datetime.now(UTC)).astimezone(UTC)
        if self._repositories is not None:
            return self._claim_durable(
                key_hash=key_hash,
                fingerprint=fingerprint,
                action=action,
                current=current,
            )
        async with self._lock:
            self._prune(current)
            existing = self._entries.get(key_hash)
            if existing is not None:
                if hmac.compare_digest(existing.fingerprint, fingerprint):
                    return ReplayClaimResult.REPLAY
                return ReplayClaimResult.REUSED_FOR_DIFFERENT_REQUEST
            if len(self._entries) >= self._cache_limit:
                return ReplayClaimResult.CAPACITY_EXHAUSTED

            self._entries[key_hash] = _ReplayEntry(
                fingerprint=fingerprint,
                expires_at=current + self._ttl,
            )
            return ReplayClaimResult.ACCEPTED

    def _claim_durable(
        self,
        *,
        key_hash: str,
        fingerprint: str,
        action: str,
        current: datetime,
    ) -> ReplayClaimResult:
        assert self._repositories is not None
        accepted, existing = self._repositories.claim_mutation_replay(
            key_hash=key_hash,
            fingerprint=fingerprint,
            action=action,
            now=current,
            expires_at=current + self._ttl,
            cache_limit=self._cache_limit,
        )
        if accepted:
            return ReplayClaimResult.ACCEPTED
        if existing is None:
            return ReplayClaimResult.CAPACITY_EXHAUSTED
        if _as_utc(existing.expires_at) <= current:
            return ReplayClaimResult.ACCEPTED
        if hmac.compare_digest(existing.fingerprint, fingerprint):
            return ReplayClaimResult.REPLAY
        return ReplayClaimResult.REUSED_FOR_DIFFERENT_REQUEST

    def _prune(self, now: datetime) -> None:
        expired = [key for key, entry in self._entries.items() if entry.expires_at <= now]
        for key in expired:
            self._entries.pop(key, None)


def _request_id(request: Request) -> str:
    value = getattr(request.state, "request_id", None)
    return value if isinstance(value, str) and value else "unavailable"


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",", 1)[0].strip() or None
    return request.client.host if request.client is not None else None


def _operator_session_hash(session_token: str) -> str:
    return hashlib.sha256(session_token.encode()).hexdigest()


def _operator_session_cookie_secure(settings: Settings) -> bool:
    return settings.environment in {"staging", "production"}


def _operator_session_cookie_max_age(settings: Settings) -> int:
    return settings.operator_session_ttl_seconds


def _operator_session_cookie_value() -> str:
    return secrets.token_urlsafe(32)


def _operator_session_repository(request: Request) -> TradingStateRepositories:
    repositories = getattr(request.app.state, "trading_state_repositories", None)
    if not isinstance(repositories, TradingStateRepositories):
        raise AppError(
            status_code=503,
            code="OPERATOR_SESSION_UNAVAILABLE",
            message="Operator session storage is unavailable",
        )
    return repositories


def _fingerprint(request: Request, body: bytes) -> str:
    payload = b"\0".join(
        (
            request.method.upper().encode(),
            request.url.path.encode(),
            request.url.query.encode(),
            body,
        )
    )
    return hashlib.sha256(payload).hexdigest()


def _set_audit_context(
    request: Request,
    *,
    actor: str,
    idempotency_key_hash: str | None,
) -> None:
    request.state.mutation_audit = {
        "audit_event": "mutation_request",
        "actor": actor,
        "action": f"{request.method.upper()} {request.url.path}",
        "resource": request.url.path,
        "idempotency_key_hash": idempotency_key_hash,
        "client_ip": _client_ip(request),
    }


def _valid_token(
    credentials: HTTPAuthorizationCredentials | None,
    configured_token: str,
) -> bool:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return False
    try:
        supplied = credentials.credentials.encode("ascii")
        configured = configured_token.encode("ascii")
    except UnicodeEncodeError:
        return False
    return hmac.compare_digest(supplied, configured)


def _valid_operator_secret(candidate: str, configured_token: str) -> bool:
    try:
        supplied = candidate.encode("ascii")
        configured = configured_token.encode("ascii")
    except UnicodeEncodeError:
        return False
    return hmac.compare_digest(supplied, configured)


async def _mutation_session_context(
    request: Request,
    session_token: Annotated[str | None, Cookie(alias=OPERATOR_SESSION_COOKIE)] = None,
    settings: Settings = Depends(get_settings),  # noqa: B008
) -> OperatorSessionAuthorization:
    if not settings.mutation_auth_required or not settings.mutation_token_configured:
        current = datetime.now(UTC)
        return OperatorSessionAuthorization(
            session_hash="bypass",
            created_at=current,
            last_seen_at=current,
            expires_at=current,
        )
    return await _validate_operator_session(
        request,
        session_token=session_token,
        settings=settings,
    )


async def login_operator_session(
    request: Request,
    *,
    operator_token: str,
    settings: Settings,
) -> OperatorSessionAuthorization:
    """Validate the operator secret and create a durable session cookie payload."""

    if not settings.mutation_auth_required:
        raise AppError(
            status_code=503,
            code="OPERATOR_SESSION_DISABLED",
            message="Operator sessions are disabled while mutation authentication is bypassed",
        )
    if not settings.mutation_token_configured:
        raise AppError(
            status_code=503,
            code="OPERATOR_SESSION_NOT_CONFIGURED",
            message="Operator session login is unavailable until authorization is configured",
        )

    limiter = getattr(request.app.state, "operator_login_rate_limiter", None)
    if not isinstance(limiter, OperatorLoginRateLimiter):
        raise AppError(
            status_code=503,
            code="OPERATOR_SESSION_UNAVAILABLE",
            message="Operator session login is unavailable",
        )
    client_id = _client_ip(request) or "unknown"
    permitted, retry_after = await limiter.check(client_id=client_id)
    if not permitted:
        raise AppError(
            status_code=429,
            code="OPERATOR_LOGIN_RATE_LIMITED",
            message="Too many failed operator login attempts. Please wait before trying again.",
            headers={"Retry-After": str(retry_after or settings.operator_login_window_seconds)},
        )

    configured = settings.mutation_api_token
    assert configured is not None
    if not _valid_operator_secret(operator_token.strip(), configured.get_secret_value()):
        await limiter.record_failure(client_id=client_id)
        raise AppError(
            status_code=401,
            code="INVALID_OPERATOR_CREDENTIALS",
            message="The operator token is invalid",
        )

    await limiter.clear(client_id=client_id)
    repositories = _operator_session_repository(request)
    now = datetime.now(UTC)
    session_token = _operator_session_cookie_value()
    session_hash = _operator_session_hash(session_token)
    expires_at = now + timedelta(seconds=settings.operator_session_ttl_seconds)
    created = repositories.create_operator_session(
        session_hash=session_hash,
        created_at=now,
        last_seen_at=now,
        expires_at=expires_at,
    )
    if not created:
        raise AppError(
            status_code=503,
            code="OPERATOR_SESSION_UNAVAILABLE",
            message="Operator session storage is unavailable",
        )
    request.state.operator_session_cookie = session_token
    return OperatorSessionAuthorization(
        session_hash=session_hash,
        created_at=now,
        last_seen_at=now,
        expires_at=expires_at,
    )


async def validate_operator_session(
    request: Request,
    session_token: Annotated[str | None, Cookie(alias=OPERATOR_SESSION_COOKIE)] = None,
    settings: Settings = Depends(get_settings),  # noqa: B008
) -> OperatorSessionAuthorization:
    """Fail closed when the operator session cookie is absent, invalid, or expired."""

    return await _validate_operator_session(request, session_token=session_token, settings=settings)


async def _validate_operator_session(
    request: Request,
    *,
    session_token: str | None,
    settings: Settings,
) -> OperatorSessionAuthorization:
    """Validate an operator session using a resolved cookie value."""

    if not settings.mutation_auth_required:
        raise AppError(
            status_code=503,
            code="OPERATOR_SESSION_DISABLED",
            message="Operator sessions are disabled while mutation authentication is bypassed",
        )
    if not settings.mutation_token_configured:
        raise AppError(
            status_code=503,
            code="OPERATOR_SESSION_NOT_CONFIGURED",
            message="Operator session validation is unavailable until authorization is configured",
        )
    if session_token is None or not session_token.strip():
        raise AppError(
            status_code=401,
            code="OPERATOR_SESSION_REQUIRED",
            message="An authenticated operator session is required",
        )

    repositories = _operator_session_repository(request)
    now = datetime.now(UTC)
    session_hash = _operator_session_hash(session_token.strip())
    row = repositories.operator_session(session_hash, now=now)
    if row is None:
        raise AppError(
            status_code=401,
            code="OPERATOR_SESSION_EXPIRED",
            message="The operator session has expired or is no longer valid",
        )
    assert isinstance(row, OperatorSessionRow)
    return OperatorSessionAuthorization(
        session_hash=row.session_hash,
        created_at=row.created_at,
        last_seen_at=now,
        expires_at=row.expires_at,
    )


async def revoke_operator_session(
    request: Request,
    session_token: Annotated[str | None, Cookie(alias=OPERATOR_SESSION_COOKIE)] = None,
) -> bool:
    """Delete the current operator session if a token is present."""

    if session_token is None or not session_token.strip():
        return False
    repositories = _operator_session_repository(request)
    return repositories.delete_operator_session(_operator_session_hash(session_token.strip()))


async def authorize_mutation(
    request: Request,
    _session: Annotated[
        OperatorSessionAuthorization,
        Depends(_mutation_session_context),
    ],
    idempotency_key: Annotated[
        str | None,
        Header(alias="Idempotency-Key"),
    ] = None,
    settings: Settings = Depends(get_settings),  # noqa: B008
) -> MutationAuthorization:
    """Authorize one mutation and atomically reserve its idempotency key."""

    request_id = _request_id(request)
    action = f"{request.method.upper()} {request.url.path}"
    _set_audit_context(request, actor="unauthenticated", idempotency_key_hash=None)

    if not settings.mutation_auth_required:
        _set_audit_context(
            request,
            actor="security-bypass-test",
            idempotency_key_hash="disabled",
        )
        return MutationAuthorization(
            request_id=request_id,
            actor="security-bypass-test",
            action=action,
            idempotency_key_hash="disabled",
            request_fingerprint="disabled",
            authorized_at=datetime.now(UTC),
        )

    if not settings.mutation_token_configured:
        raise AppError(
            status_code=503,
            code="MUTATION_AUTH_NOT_CONFIGURED",
            message="Mutation endpoints are locked until operator authorization is configured",
        )

    configured = settings.mutation_api_token
    assert configured is not None
    if idempotency_key is None:
        raise AppError(
            status_code=400,
            code="IDEMPOTENCY_KEY_REQUIRED",
            message="Idempotency-Key is required for mutation requests",
        )
    normalized_key = idempotency_key.strip()
    if not _IDEMPOTENCY_KEY_PATTERN.fullmatch(normalized_key):
        raise AppError(
            status_code=400,
            code="INVALID_IDEMPOTENCY_KEY",
            message="Idempotency-Key must be 16-128 safe ASCII characters",
        )

    body = await request.body()
    fingerprint = _fingerprint(request, body)
    key_hash = hashlib.sha256(normalized_key.encode()).hexdigest()
    _set_audit_context(request, actor="operator", idempotency_key_hash=key_hash)

    guard = getattr(request.app.state, "mutation_replay_guard", None)
    if not isinstance(guard, MutationReplayGuard):
        raise AppError(
            status_code=503,
            code="MUTATION_SECURITY_UNAVAILABLE",
            message="Mutation replay protection is unavailable",
        )
    result = await guard.claim(key_hash=key_hash, fingerprint=fingerprint, action=action)
    if result is ReplayClaimResult.REPLAY:
        raise AppError(
            status_code=409,
            code="REPLAY_DETECTED",
            message="This mutation request has already been submitted",
        )
    if result is ReplayClaimResult.REUSED_FOR_DIFFERENT_REQUEST:
        raise AppError(
            status_code=409,
            code="IDEMPOTENCY_KEY_REUSED",
            message="This Idempotency-Key was already used for another request",
        )
    if result is ReplayClaimResult.CAPACITY_EXHAUSTED:
        raise AppError(
            status_code=503,
            code="REPLAY_GUARD_CAPACITY_EXHAUSTED",
            message="Mutation replay protection is at capacity; request was not accepted",
        )

    return MutationAuthorization(
        request_id=request_id,
        actor="operator",
        action=action,
        idempotency_key_hash=key_hash,
        request_fingerprint=fingerprint,
        authorized_at=datetime.now(UTC),
    )
