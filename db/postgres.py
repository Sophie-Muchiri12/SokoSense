"""Postgres (Supabase) connection + schema bootstrap.

Single source of truth for database access across the platform:

  * ``crops`` / ``diseases`` / ``crop_diseases`` — advisory knowledge
  * ``document_chunks`` — RAG chunks with pgvector embeddings

Configuration (`.env` / Render / Supabase):

    DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres

Get it from Supabase Dashboard → Project Settings → Database → Connection
string → "Transaction" pooler (port 6543, right choice for Render's
ephemeral instances). When ``DATABASE_URL`` is unset the platform degrades
gracefully: market prices fall back to the bundled SQLite cache and the
advisory engine falls back to its in-code seed knowledge, so local dev and
tests keep working with zero setup.
"""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_SCHEMA_PATH = Path(__file__).with_name("schema.sql")

_enabled_cache: bool | None = None


def database_url() -> str | None:
    """Normalised DATABASE_URL, or None when Postgres is not configured."""
    url = (os.getenv("DATABASE_URL") or "").strip()
    if not url:
        return None
    # SQLAlchemy-style / Heroku-style scheme → psycopg scheme.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    return url


def is_enabled() -> bool:
    """True when DATABASE_URL is set *and* Postgres answers."""
    global _enabled_cache
    if _enabled_cache is not None:
        return _enabled_cache
    if not database_url():
        _enabled_cache = False
        return False
    try:
        with get_conn() as conn:
            conn.execute("SELECT 1")
        _enabled_cache = True
    except Exception as exc:  # pragma: no cover - network dependent
        logger.warning("Postgres unreachable (%s) — using local fallbacks", exc)
        _enabled_cache = False
    return _enabled_cache


def reset_enabled_cache() -> None:
    global _enabled_cache
    _enabled_cache = None


@contextmanager
def get_conn() -> Iterator[Any]:
    """Yield a psycopg (v3) connection. Raises if DATABASE_URL is unset.

    ``prepare_threshold=None`` disables server-side prepared statements,
    which Supabase's transaction pooler (PgBouncer) does not support.
    """
    import psycopg
    from psycopg.rows import dict_row

    url = database_url()
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    conn = psycopg.connect(
        url, row_factory=dict_row, autocommit=True, prepare_threshold=None
    )
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> bool:
    """Create extensions/tables/indexes (idempotent). False if no Postgres."""
    if not database_url():
        logger.info("DATABASE_URL not set — skipping Postgres schema init")
        return False
    try:
        sql = _SCHEMA_PATH.read_text(encoding="utf-8")
        with get_conn() as conn:
            conn.execute(sql)
        reset_enabled_cache()
        logger.info("Postgres schema ready (pgvector + tables)")
        return True
    except Exception as exc:  # pragma: no cover - network dependent
        logger.warning("Postgres schema init failed: %s", exc)
        return False


def health() -> dict[str, Any]:
    """Database status block for /health."""
    if not database_url():
        return {"configured": False, "status": "not_configured"}
    try:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
            ).fetchone()
        return {
            "configured": True,
            "status": "ok",
            "pgvector": row["extversion"] if row else None,
        }
    except Exception as exc:  # pragma: no cover - network dependent
        return {"configured": True, "status": f"error: {exc}"}
