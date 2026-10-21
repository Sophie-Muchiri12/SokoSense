"""Auth primitives — password hashing, JWTs, admin PIN, FastAPI guards.

Standard library only (PBKDF2-HMAC for passwords, HS256 JWTs) so auth adds
no new dependencies. Tokens are bearer JWTs signed with ``AUTH_SECRET``.

Two separate identities:
* **users** — farmers / SACCO partners, phone + password, role in the JWT;
* **admin** — no account: a 7-digit PIN from ``ADMIN_PIN`` in .env, exchanged
  for a short-lived ``role="admin"`` JWT at POST /api/auth/admin-login.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

USER_ROLES = ("farmer", "sacco")
TOKEN_TTL_SECONDS = 7 * 24 * 3600  # 7 days
ADMIN_TOKEN_TTL_SECONDS = 12 * 3600  # 12 hours

_bearer = HTTPBearer(auto_error=False)
_ephemeral_secret: str | None = None


def _secret() -> str:
    global _ephemeral_secret
    configured = (os.getenv("AUTH_SECRET") or "").strip()
    if configured:
        return configured
    if _ephemeral_secret is None:
        _ephemeral_secret = secrets.token_hex(32)
        logger.warning(
            "AUTH_SECRET is not set — using an ephemeral secret; "
            "all sessions will be invalidated on restart."
        )
    return _ephemeral_secret


# ── passwords (PBKDF2-HMAC-SHA256) ──────────────────────────────────────

_PBKDF2_ROUNDS = 210_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return f"pbkdf2${_PBKDF2_ROUNDS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, rounds, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds)
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(digest.hex(), digest_hex)


# ── JWT (HS256) ─────────────────────────────────────────────────────────


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _b64decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def create_token(subject: str, role: str, ttl_seconds: int = TOKEN_TTL_SECONDS, **claims) -> str:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": subject, "role": role, "iat": now, "exp": now + ttl_seconds, **claims}
    signing_input = f"{_b64encode(json.dumps(header).encode())}.{_b64encode(json.dumps(payload).encode())}"
    signature = hmac.new(_secret().encode(), signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{_b64encode(signature)}"


def decode_token(token: str) -> dict | None:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
        signing_input = f"{header_b64}.{payload_b64}"
        expected = hmac.new(_secret().encode(), signing_input.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64decode(signature_b64)):
            return None
        payload = json.loads(_b64decode(payload_b64))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


# ── admin PIN ───────────────────────────────────────────────────────────


def admin_pin() -> str | None:
    """The configured 7-digit admin PIN, or None when unset/misconfigured."""
    pin = (os.getenv("ADMIN_PIN") or "").strip()
    if not pin:
        return None
    if len(pin) != 7 or not pin.isdigit():
        logger.warning("ADMIN_PIN must be exactly 7 digits — admin login disabled.")
        return None
    return pin


def verify_admin_pin(pin: str) -> bool:
    configured = admin_pin()
    return configured is not None and hmac.compare_digest(pin.strip(), configured)


# ── FastAPI dependencies ────────────────────────────────────────────────


def _unauthorized(detail: str = "Authentication required") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """Any signed-in identity (farmer, sacco, or admin)."""
    if credentials is None:
        raise _unauthorized()
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise _unauthorized("Invalid or expired session — please log in again.")
    return payload


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access only — sign in with the admin PIN.",
        )
    return user


def require_roles(*roles: str):
    """Dependency factory: signed-in user whose role is one of ``roles``."""

    async def _check(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This area requires one of: {', '.join(roles)}.",
            )
        return user

    return _check
