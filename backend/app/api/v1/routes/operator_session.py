"""Operator session login, validation, and logout routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.security import (
    OPERATOR_SESSION_COOKIE,
    OperatorSessionAuthorization,
    login_operator_session,
    revoke_operator_session,
    validate_operator_session,
)
from app.schemas.operator_session import OperatorLoginRequest, OperatorSessionStatusResponse

router = APIRouter(prefix="/operator-session", tags=["operator-session"])


def _set_session_cookie(response: Response, *, session_token: str, settings: Settings) -> None:
    response.set_cookie(
        key=OPERATOR_SESSION_COOKIE,
        value=session_token,
        httponly=True,
        secure=settings.environment in {"staging", "production"},
        samesite="lax",
        max_age=settings.operator_session_ttl_seconds,
        path="/",
    )


def _clear_session_cookie(response: Response, *, settings: Settings) -> None:
    response.delete_cookie(
        key=OPERATOR_SESSION_COOKIE,
        path="/",
        samesite="lax",
    )


def _to_status_response(session: OperatorSessionAuthorization) -> OperatorSessionStatusResponse:
    return OperatorSessionStatusResponse(
        status="authenticated",
        issued_at=session.created_at,
        expires_at=session.expires_at,
        last_seen_at=session.last_seen_at,
    )


@router.post("/login", response_model=OperatorSessionStatusResponse)
async def operator_login(
    request: Request,
    payload: OperatorLoginRequest,
    settings: Settings = Depends(get_settings),  # noqa: B008
) -> JSONResponse:
    session = await login_operator_session(
        request,
        operator_token=payload.operator_token.get_secret_value(),
        settings=settings,
    )
    response = JSONResponse(content=_to_status_response(session).model_dump(mode="json"))
    session_token = getattr(request.state, "operator_session_cookie", None)
    if not isinstance(session_token, str) or not session_token:
        raise AppError(
            status_code=503,
            code="OPERATOR_SESSION_UNAVAILABLE",
            message="Operator session storage is unavailable",
        )
    _set_session_cookie(response, session_token=session_token, settings=settings)
    return response


@router.get("/status", response_model=OperatorSessionStatusResponse)
async def operator_status(
    session: OperatorSessionAuthorization = Depends(validate_operator_session),  # noqa: B008
) -> OperatorSessionStatusResponse:
    return _to_status_response(session)


@router.post("/logout", status_code=204)
async def operator_logout(
    request: Request,
    response: Response,
    settings: Settings = Depends(get_settings),  # noqa: B008
) -> Response:
    await revoke_operator_session(request)
    _clear_session_cookie(response, settings=settings)
    response.status_code = 204
    return response