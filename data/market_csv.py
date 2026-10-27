"""CSV store for KAMIS market prices — default offline source of truth.

Request-time reads normally go through this module and the one active CSV
file (default ``data/market_prices.csv``, override with ``MARKET_CSV_PATH``).
When ``USE_LIVE=true``, ``data/price_pipeline`` / the agent price tool hit
the KAMIS portal first and fall back here if live fetch fails.

* Collection is manual / admin-triggered — see
  ``scripts/collect_market_data.py`` and ``data/kamis_collect.py``.
* Writers build a staging file and atomically ``os.replace()`` it over the
  active CSV, so the old file is removed from the serving path the moment
  the new one is ready — readers never see a half-written file.

CSV schema (one row per commodity × market report):

    product_id, commodity, market, county,
    wholesale_raw, retail_raw,            e.g. "45/Kg" (as reported by KAMIS)
    wholesale_kes_90kg, retail_kes_90kg,  normalised KSh per 90kg bag
    date_reported,                        YYYY-MM-DD (KAMIS report date)
    fetched_at                            ISO timestamp of the collecting run

Only the 10 most recent rows per (commodity, market, county) are kept,
ranked by ``date_reported`` — see ``trim_recent``.
"""

from __future__ import annotations

import csv
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CSV_COLUMNS = [
    "product_id",
    "commodity",
    "market",
    "county",
    "wholesale_raw",
    "retail_raw",
    "wholesale_kes_90kg",
    "retail_kes_90kg",
    "date_reported",
    "fetched_at",
]

# Rows kept per (commodity, market, county) — the 10 most recent by date.
TOP_N_PER_GROUP = 10

_lock = threading.Lock()
_read_cache: dict[str, Any] = {"key": None, "rows": []}


def csv_path() -> Path:
    return Path(os.getenv("MARKET_CSV_PATH", "data/market_prices.csv"))


def csv_version() -> str:
    """Cheap change token (mtime+size) so callers can invalidate caches."""
    try:
        st = csv_path().stat()
    except OSError:
        return "missing"
    return f"{st.st_mtime_ns}:{st.st_size}"


# ── reading ─────────────────────────────────────────────────────────────


def read_rows() -> list[dict[str, Any]]:
    """All rows in the active CSV (internal column names), newest first."""
    path = csv_path()
    key = csv_version()
    with _lock:
        if _read_cache["key"] == key:
            return list(_read_cache["rows"])
    if not path.exists():
        rows: list[dict[str, Any]] = []
    else:
        with path.open(newline="", encoding="utf-8") as fh:
            rows = [
                {col: (row.get(col) or None) for col in CSV_COLUMNS}
                for row in csv.DictReader(fh)
            ]
        rows.sort(key=lambda r: (r.get("date_reported") or "", r.get("fetched_at") or ""), reverse=True)
    with _lock:
        _read_cache.update(key=key, rows=rows)
    return list(rows)


def _to_legacy(row: dict[str, Any]) -> dict[str, Any]:
    """Shape rows the way the price pipeline has always consumed them."""
    return {
        "Commodity": row.get("commodity") or "",
        "Market": row.get("market") or "",
        "County": row.get("county") or "",
        "Wholesale": row.get("wholesale_raw"),
        "Retail": row.get("retail_raw"),
        "Date": row.get("date_reported"),
        "fetched_at": row.get("fetched_at"),
    }


def query_crop_history(
    crop_name: str,
    max_rows: int = 1000,
    *,
    prefer_counties: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Recent CSV rows for a crop (legacy dict shape), newest first.

    Mirrors the old ``market_db.query_crop_history`` contract, including the
    per-county top-up so infrequently reporting focus markets are not
    crowded out of a global LIMIT.
    """
    needle = crop_name.lower().strip()
    rows = [r for r in read_rows() if needle in (r.get("commodity") or "").lower()]
    result = [_to_legacy(r) for r in rows[:max_rows]]

    if prefer_counties:
        seen = {
            (r["Commodity"], r["Market"], r["County"], r["Date"], r["Wholesale"], r["Retail"])
            for r in result
        }
        for county in prefer_counties:
            county_norm = county.lower().replace("-", " ")
            extra = [
                r
                for r in rows
                if (r.get("county") or "").lower().replace("-", " ") == county_norm
            ][:200]
            for item in (_to_legacy(r) for r in extra):
                key = (item["Commodity"], item["Market"], item["County"], item["Date"], item["Wholesale"], item["Retail"])
                if key not in seen:
                    seen.add(key)
                    result.append(item)
    return result


def query_prices(
    crop_name: str | None = None,
    market_name: str | None = None,
    county_name: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Filtered CSV rows (legacy dict shape), newest first."""
    rows = read_rows()
    if crop_name:
        needle = crop_name.lower().strip()
        rows = [r for r in rows if needle in (r.get("commodity") or "").lower()]
    if market_name:
        needle = market_name.lower().strip()
        rows = [
            r
            for r in rows
            if needle in (r.get("market") or "").lower()
            or needle in (r.get("county") or "").lower()
        ]
    if county_name:
        needle = county_name.lower().strip()
        rows = [r for r in rows if needle in (r.get("county") or "").lower()]
    return [_to_legacy(r) for r in rows[: max(limit, 1)]]


# ── trimming / writing ──────────────────────────────────────────────────


def _row_sort_key(row: dict[str, Any]) -> tuple[str, str]:
    return (row.get("date_reported") or "", row.get("fetched_at") or "")


def trim_recent(
    rows: list[dict[str, Any]], per_group: int = TOP_N_PER_GROUP
) -> list[dict[str, Any]]:
    """Dedupe, then keep the ``per_group`` most recent rows per
    (commodity, market, county) ranked by report date."""
    seen: set[tuple] = set()
    unique: list[dict[str, Any]] = []
    for row in rows:
        key = (
            row.get("product_id"),
            (row.get("commodity") or "").lower(),
            (row.get("market") or "").lower(),
            (row.get("county") or "").lower(),
            row.get("date_reported"),
            row.get("wholesale_raw"),
            row.get("retail_raw"),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)

    groups: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    for row in unique:
        group = (
            (row.get("commodity") or "").lower(),
            (row.get("market") or "").lower(),
            (row.get("county") or "").lower(),
        )
        groups.setdefault(group, []).append(row)

    trimmed: list[dict[str, Any]] = []
    for group_rows in groups.values():
        group_rows.sort(key=_row_sort_key, reverse=True)
        trimmed.extend(group_rows[:per_group])
    trimmed.sort(key=_row_sort_key, reverse=True)
    return trimmed


def validate_rows(rows: list[dict[str, Any]]) -> None:
    """Refuse to activate a CSV that would leave the system with no data."""
    if not rows:
        raise ValueError("No rows to write — refusing to replace the active CSV.")
    bad = [r for r in rows if not r.get("commodity") or not r.get("market") or not r.get("county")]
    if bad:
        raise ValueError(f"{len(bad)} row(s) missing commodity/market/county.")


def write_rows_atomic(rows: list[dict[str, Any]]) -> Path:
    """Write ``rows`` to a staging file, then atomically swap it in.

    ``os.replace`` removes the old active CSV from the serving path in the
    same operation — there is never a window with no (or a partial) file.
    """
    validate_rows(rows)
    path = csv_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    staging = path.with_name(f".{path.name}.staging-{os.getpid()}")
    try:
        with staging.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=CSV_COLUMNS)
            writer.writeheader()
            for row in rows:
                writer.writerow({col: row.get(col) for col in CSV_COLUMNS})
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(staging, path)
    finally:
        staging.unlink(missing_ok=True)
    with _lock:
        _read_cache.update(key=None, rows=[])
    return path


# ── status (admin portal) ───────────────────────────────────────────────


def status() -> dict[str, Any]:
    path = csv_path()
    rows = read_rows()
    dates = [r["date_reported"] for r in rows if r.get("date_reported")]
    fetched = [r["fetched_at"] for r in rows if r.get("fetched_at")]
    updated_at = None
    size_bytes = None
    if path.exists():
        st = path.stat()
        size_bytes = st.st_size
        updated_at = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat()
    return {
        "path": str(path),
        "exists": path.exists(),
        "rows": len(rows),
        "commodities": len({(r.get("commodity") or "").lower() for r in rows}),
        "markets": len({(r.get("market") or "").lower() for r in rows}),
        "latest_date_reported": max(dates) if dates else None,
        "last_fetched_at": max(fetched) if fetched else None,
        "updated_at": updated_at,
        "size_bytes": size_bytes,
    }
