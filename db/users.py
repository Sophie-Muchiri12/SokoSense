"""User accounts in Postgres (the `users` table, see db/schema.sql).

Postgres is the only account store: when ``DATABASE_URL`` is unset,
registration/login respond 503 rather than falling back to a local store.
"""

from __future__ import annotations

import re
from typing import Any

from db import postgres


class AuthStoreUnavailable(RuntimeError):
    """DATABASE_URL unset/unreachable — auth cannot be served."""


def _ensure_store() -> None:
    if not postgres.database_url():
        raise AuthStoreUnavailable(
            "User accounts live in Postgres, but DATABASE_URL is not set. "
            "For local dev run `docker compose up -d db` and set "
            "DATABASE_URL=postgresql://sokosense:sokosense_dev@localhost:5434/sokosense "
            "in .env (in production, set the Supabase DATABASE_URL instead) "
            "to enable registration and login."
        )
    # Idempotent: make sure the users table exists (same DDL as db/schema.sql,
    # run standalone so auth doesn't depend on the pgvector parts of the schema).
    try:
        _create_table()
    except AuthStoreUnavailable:
        raise
    except Exception as exc:
        raise AuthStoreUnavailable(f"Postgres is unreachable: {exc}") from exc


def _create_table() -> None:
    with postgres.get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            BIGSERIAL PRIMARY KEY,
                name          TEXT NOT NULL,
                phone         TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role          TEXT NOT NULL CHECK (role IN ('farmer', 'sacco')),
                created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )


def normalize_phone(raw: str) -> str:
    """Canonical Kenyan phone: +2547XXXXXXXX (accepts 07…, 2547…, +2547…)."""
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("254"):
        digits = digits[3:]
    if digits.startswith("0"):
        digits = digits[1:]
    if len(digits) != 9 or not digits.startswith(("7", "1")):
        raise ValueError("Enter a valid Kenyan phone number, e.g. 0712 345 678.")
    return f"+254{digits}"


def create_user(name: str, phone: str, password_hash: str, role: str) -> dict[str, Any]:
    _ensure_store()
    with postgres.get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO users (name, phone, password_hash, role)
            VALUES (%s, %s, %s, %s)
            RETURNING id, name, phone, role, created_at
            """,
            (name, phone, password_hash, role),
        ).fetchone()
    return _public(row)


def get_user_by_phone(phone: str) -> dict[str, Any] | None:
    _ensure_store()
    with postgres.get_conn() as conn:
        row = conn.execute(
            "SELECT id, name, phone, role, password_hash, created_at FROM users WHERE phone = %s",
            (phone,),
        ).fetchone()
    return row


def get_user_by_id(user_id: int) -> dict[str, Any] | None:
    _ensure_store()
    with postgres.get_conn() as conn:
        row = conn.execute(
            "SELECT id, name, phone, role, created_at FROM users WHERE id = %s",
            (user_id,),
        ).fetchone()
    return _public(row) if row else None


def _public(row: dict[str, Any]) -> dict[str, Any]:
    created = row.get("created_at")
    return {
        "id": row["id"],
        "name": row["name"],
        "phone": row["phone"],
        "role": row["role"],
        "created_at": created.isoformat() if hasattr(created, "isoformat") else created,
    }
