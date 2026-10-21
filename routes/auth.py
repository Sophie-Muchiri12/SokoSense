"""Auth routes — register, login, me, and the admin-PIN login.

Users (farmer / SACCO) live in Postgres and sign in with phone + password.
Admin has no account: the 7-digit ``ADMIN_PIN`` from .env is exchanged for
a short-lived admin JWT. Both yield bearer tokens for the guarded APIs.
"""

from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException, Request, status

from auth.security import (
    ADMIN_TOKEN_TTL_SECONDS,
    create_token,
    get_current_user,
    hash_password,
    verify_admin_pin,
    verify_password,
    admin_pin,
)
from db import users as users_db
from models.auth import AdminLoginRequest, LoginRequest, RegisterRequest, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Simple in-memory throttle for admin PIN attempts (per client IP).
_pin_attempts: dict[str, list[float]] = {}
_PIN_MAX_ATTEMPTS = 5
_PIN_WINDOW_SECONDS = 300


def _store_guard(exc: users_db.AuthStoreUnavailable) -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest) -> TokenResponse:
    try:
        phone = users_db.normalize_phone(body.phone)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        if users_db.get_user_by_phone(phone):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this phone number already exists — log in instead.",
            )
        user = users_db.create_user(
            name=body.name.strip(),
            phone=phone,
            password_hash=hash_password(body.password),
            role=body.role,
        )
    except users_db.AuthStoreUnavailable as exc:
        raise _store_guard(exc) from exc
    token = create_token(str(user["id"]), user["role"], phone=user["phone"], name=user["name"])
    return TokenResponse(access_token=token, user=UserOut(**user))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest) -> TokenResponse:
    try:
        phone = users_db.normalize_phone(body.phone)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        row = users_db.get_user_by_phone(phone)
    except users_db.AuthStoreUnavailable as exc:
        raise _store_guard(exc) from exc
    # Same message for unknown phone and wrong password (no user enumeration).
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phone number or password is incorrect.",
        )
    user = users_db._public(row)
    token = create_token(str(user["id"]), user["role"], phone=user["phone"], name=user["name"])
    return TokenResponse(access_token=token, user=UserOut(**user))


@router.get("/me", response_model=UserOut)
def me(current: dict = Depends(get_current_user)) -> UserOut:
    if current.get("role") == "admin":
        return UserOut(name="Administrator", phone="", role="admin")
    try:
        user = users_db.get_user_by_id(int(current["sub"]))
    except (users_db.AuthStoreUnavailable, ValueError, KeyError) as exc:
        raise HTTPException(status_code=401, detail="Session user no longer exists.") from exc
    if user is None:
        raise HTTPException(status_code=401, detail="Session user no longer exists.")
    return UserOut(**user)


@router.post("/admin-login", response_model=TokenResponse)
def admin_login(body: AdminLoginRequest, request: Request) -> TokenResponse:
    if admin_pin() is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin login is not configured — set a 7-digit ADMIN_PIN in .env.",
        )
    client = request.client.host if request.client else "unknown"
    now = time.time()
    attempts = [t for t in _pin_attempts.get(client, []) if now - t < _PIN_WINDOW_SECONDS]
    if len(attempts) >= _PIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many PIN attempts — try again in a few minutes.",
        )
    if not verify_admin_pin(body.pin):
        attempts.append(now)
        _pin_attempts[client] = attempts
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect admin PIN."
        )
    _pin_attempts.pop(client, None)
    token = create_token("admin", "admin", ttl_seconds=ADMIN_TOKEN_TTL_SECONDS)
    return TokenResponse(
        access_token=token,
        user=UserOut(name="Administrator", phone="", role="admin"),
    )
