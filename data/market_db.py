"""SQLite storage and query helpers for KAMIS market prices."""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

DB_PATH = Path(os.getenv("MARKET_DB_PATH", "data/market_prices.db"))


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS market_prices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                commodity TEXT NOT NULL,
                market TEXT NOT NULL,
                county TEXT NOT NULL,
                wholesale_raw TEXT,
                retail_raw TEXT,
                wholesale_kes_90kg REAL,
                retail_kes_90kg REAL,
                date_reported TEXT,
                fetched_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_market_prices_lookup
            ON market_prices (commodity, market, county, date_reported, fetched_at);
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_market_prices_fetched_at
            ON market_prices (fetched_at);
            """
        )
        conn.commit()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def prune_old_data(keep_days: int = 7) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=keep_days)
    cutoff_iso = cutoff.replace(microsecond=0).isoformat()
    with _connect() as conn:
        cur = conn.execute(
            "DELETE FROM market_prices WHERE fetched_at < ?",
            (cutoff_iso,),
        )
        conn.commit()
        return cur.rowcount


def insert_market_rows(rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    with _connect() as conn:
        cur = conn.executemany(
            """
            INSERT INTO market_prices (
                product_id,
                commodity,
                market,
                county,
                wholesale_raw,
                retail_raw,
                wholesale_kes_90kg,
                retail_kes_90kg,
                date_reported,
                fetched_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    row.get("product_id"),
                    row.get("commodity", ""),
                    row.get("market", ""),
                    row.get("county", ""),
                    row.get("wholesale_raw"),
                    row.get("retail_raw"),
                    row.get("wholesale_kes_90kg"),
                    row.get("retail_kes_90kg"),
                    row.get("date_reported"),
                    row.get("fetched_at"),
                )
                for row in rows
            ],
        )
        conn.commit()
        return cur.rowcount


def query_crop_history(
    crop_name: str,
    max_rows: int = 1000,
) -> list[dict[str, Any]]:
    """Return recent stored rows for a crop (used by trend/aggregation engines)."""
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT commodity, market, county, wholesale_raw, retail_raw,
                   wholesale_kes_90kg, retail_kes_90kg, date_reported, fetched_at
            FROM market_prices
            WHERE LOWER(commodity) LIKE ?
            ORDER BY date_reported DESC, fetched_at DESC
            LIMIT ?
            """,
            (f"%{crop_name.lower().strip()}%", max_rows),
        ).fetchall()
        return [
            {
                "Commodity": r["commodity"],
                "Market": r["market"],
                "County": r["county"],
                "Wholesale": r["wholesale_raw"],
                "Retail": r["retail_raw"],
                "Date": r["date_reported"],
                "fetched_at": r["fetched_at"],
            }
            for r in rows
        ]


def query_prices(
    crop_name: str | None = None,
    market_name: str | None = None,
    county_name: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    limit = min(max(limit, 1), 10)
    filters: list[str] = []
    params: list[Any] = []

    if crop_name:
        filters.append("LOWER(commodity) LIKE ?")
        params.append(f"%{crop_name.lower().strip()}%")
    if market_name:
        filters.append(
            "(LOWER(market) LIKE ? OR LOWER(county) LIKE ?)"
        )
        term = f"%{market_name.lower().strip()}%"
        params.extend([term, term])
    if county_name:
        filters.append("LOWER(county) LIKE ?")
        params.append(f"%{county_name.lower().strip()}%")

    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
    sql = f"""
        SELECT commodity, market, county, wholesale_raw, retail_raw, date_reported, fetched_at
        FROM market_prices
        {where_clause}
        ORDER BY date_reported DESC, fetched_at DESC
        LIMIT ?
    """
    params.append(limit)

    with _connect() as conn:
        rows = conn.execute(sql, params).fetchall()
        return [
            {
                "Commodity": r["commodity"],
                "Market": r["market"],
                "County": r["county"],
                "Wholesale": r["wholesale_raw"],
                "Retail": r["retail_raw"],
                "Date": r["date_reported"],
                "fetched_at": r["fetched_at"],
            }
            for r in rows
        ]
