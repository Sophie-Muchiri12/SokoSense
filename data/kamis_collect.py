"""KAMIS collection pipeline — scrape, clean, build the market CSV.

This is the *only* code that talks to the KAMIS website. It is driven two
ways, both of which end in the same atomic CSV swap (``data/market_csv.py``):

* manually:   ``python scripts/collect_market_data.py [--commodity maize]``
* admin UI:   ``POST /api/admin/market-refresh`` (runs a full collection)

Per commodity we keep the 10 most recent rows per market/county (by KAMIS
report date). A single-commodity run *merges*: that commodity's rows in the
active CSV are replaced with the fresh top-10, every other commodity is
left untouched. A full run rebuilds the CSV from scratch. If a run fetches
no rows, it raises and the old CSV keeps serving — an empty/stale-scrape
CSV is never activated.
"""

from __future__ import annotations

import io
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Callable

import pandas as pd
import requests
import urllib3

from data import market_csv
from data.price_pipeline import _parse_kamis_date, _parse_price, normalize_county

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

KAMIS_URL = "https://kamis.kilimo.go.ke/site/market"

# Deep pull: KAMIS returns the most recent N rows nationwide per product
# (no server-side market/county filter), so a small page misses markets
# that report infrequently — and we need enough history to pick each
# market's 10 most recent rows.
ROW_LIMIT_PER_PRODUCT = 1500
# On-demand live reads (USE_LIVE=true) use a smaller page to stay fast.
LIVE_ROW_LIMIT_PER_PRODUCT = 400
LIVE_MAX_PRODUCTS = 4
REQUEST_DELAY_SECONDS = 0.5
REQUEST_TIMEOUT_SECONDS = 40


def use_live_kamis() -> bool:
    """True when ``USE_LIVE=true`` — request-time reads hit the KAMIS portal."""
    return os.getenv("USE_LIVE", "").strip().lower() in {"1", "true", "yes", "on"}

ProgressFn = Callable[[dict], None] | None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


# ── KAMIS product catalogue ─────────────────────────────────────────────

_OPTION_RE = re.compile(r'<option[^>]*value="(\d+)"[^>]*>([^<]+)</option>')


def discover_products() -> list[dict]:
    """Every commodity KAMIS offers, parsed from its own product dropdown.

    Returns ``[{"product_id": 1, "commodity": "Dry Maize"}, ...]``.
    """
    response = requests.get(KAMIS_URL, verify=False, timeout=REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()
    products = [
        {"product_id": int(pid), "commodity": label.strip()}
        for pid, label in _OPTION_RE.findall(response.text)
        if label.strip() and label.strip() != "--Please select--"
    ]
    if not products:
        raise RuntimeError("Could not parse the KAMIS product list.")
    return products


def _matches(commodity_label: str, query: str) -> bool:
    label = commodity_label.lower()
    q = query.lower().strip()
    return q in label or label in q


# ── fetching / cleaning ─────────────────────────────────────────────────


def _normalize_date(raw: str | None) -> str | None:
    dt = _parse_kamis_date(raw)
    return dt.strftime("%Y-%m-%d") if dt else None


def fetch_rows_for_product(
    product_id: int, fetched_at: str, per_page: int = ROW_LIMIT_PER_PRODUCT
) -> list[dict]:
    try:
        response = requests.get(
            KAMIS_URL,
            params={"product": product_id, "per_page": per_page},
            verify=False,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        if response.status_code != 200:
            logger.warning("KAMIS HTTP %s for product_id=%s", response.status_code, product_id)
            return []
        tables = pd.read_html(io.StringIO(response.text))
        if not tables:
            return []
        df = tables[0]
        df.columns = [c.strip() for c in df.columns]
    except Exception as exc:
        logger.warning("Failed fetching product_id=%s: %s", product_id, exc)
        return []

    out: list[dict] = []
    for _, row in df.iterrows():
        commodity = str(row.get("Commodity", "")).strip()
        market = str(row.get("Market", "")).strip()
        county_raw = str(row.get("County", "")).strip()
        if not commodity or not market or not county_raw or county_raw.lower() == "nan":
            continue
        wholesale_raw = str(row.get("Wholesale", "")).strip() or None
        retail_raw = str(row.get("Retail", "")).strip() or None
        if wholesale_raw in ("-", "nan"):
            wholesale_raw = None
        if retail_raw in ("-", "nan"):
            retail_raw = None
        out.append(
            {
                "product_id": product_id,
                "commodity": commodity,
                "market": market,
                "county": normalize_county(county_raw),
                "wholesale_raw": wholesale_raw,
                "retail_raw": retail_raw,
                "wholesale_kes_90kg": _parse_price(wholesale_raw),
                "retail_kes_90kg": _parse_price(retail_raw),
                "date_reported": _normalize_date(str(row.get("Date", "")).strip()),
                "fetched_at": fetched_at,
            }
        )
    logger.info("product_id=%s → %d rows", product_id, len(out))
    return out


# ── on-demand live fetch (USE_LIVE) ─────────────────────────────────────


def _to_pipeline_row(row: dict) -> dict:
    """Shape a collector row the way ``price_pipeline`` / agent tools expect."""
    return {
        "Commodity": row.get("commodity") or "",
        "Market": row.get("market") or "",
        "County": row.get("county") or "",
        "Wholesale": row.get("wholesale_raw"),
        "Retail": row.get("retail_raw"),
        "Date": row.get("date_reported"),
        "fetched_at": row.get("fetched_at"),
    }


def fetch_live_crop_rows(
    crop: str,
    *,
    per_page: int = LIVE_ROW_LIMIT_PER_PRODUCT,
    max_products: int = LIVE_MAX_PRODUCTS,
    delay_seconds: float = REQUEST_DELAY_SECONDS,
) -> list[dict]:
    """Pull current KAMIS portal rows for ``crop`` (legacy dict shape).

    Used when ``USE_LIVE=true``. Does not write the CSV. Returns [] on
    failure so callers can fall back to the cached CSV.
    """
    crop = (crop or "").strip()
    if not crop:
        return []

    try:
        from engines.rate_limiter import kamis_http_limiter

        kamis_http_limiter.wait_if_needed()
    except Exception:
        pass

    try:
        catalogue = discover_products()
    except Exception as exc:
        logger.warning("USE_LIVE: could not load KAMIS catalogue: %s", exc)
        return []

    targets = [p for p in catalogue if _matches(p["commodity"], crop)]
    if not targets:
        logger.warning("USE_LIVE: no KAMIS commodity matches '%s'", crop)
        return []

    targets = targets[: max(1, max_products)]
    fetched_at = utc_now_iso()
    out: list[dict] = []
    for idx, product in enumerate(targets):
        try:
            from engines.rate_limiter import kamis_http_limiter

            kamis_http_limiter.wait_if_needed()
        except Exception:
            pass
        rows = fetch_rows_for_product(
            product["product_id"], fetched_at=fetched_at, per_page=per_page
        )
        out.extend(_to_pipeline_row(r) for r in rows)
        if idx < len(targets) - 1 and delay_seconds:
            time.sleep(delay_seconds)

    out.sort(key=lambda r: str(r.get("Date") or ""), reverse=True)
    logger.info(
        "USE_LIVE: crop=%s products=%d rows=%d",
        crop,
        len(targets),
        len(out),
    )
    return out


# ── pipeline ────────────────────────────────────────────────────────────


def run_pipeline(
    commodity: str | None = None,
    *,
    per_page: int = ROW_LIMIT_PER_PRODUCT,
    delay_seconds: float = REQUEST_DELAY_SECONDS,
    on_progress: ProgressFn = None,
) -> dict:
    """Collect from KAMIS and atomically swap in a rebuilt market CSV.

    ``commodity=None`` collects every KAMIS commodity and rebuilds the
    whole CSV. With a commodity name, only that commodity's rows are
    refreshed (top-10 most recent per market) and merged into the CSV.

    Returns run stats. Raises (leaving the old CSV in place) if nothing
    usable was fetched.
    """
    fetched_at = utc_now_iso()
    catalogue = discover_products()

    if commodity:
        targets = [p for p in catalogue if _matches(p["commodity"], commodity)]
        if not targets:
            available = ", ".join(sorted(p["commodity"] for p in catalogue)[:20])
            raise ValueError(
                f"No KAMIS commodity matches '{commodity}'. Examples: {available}…"
            )
    else:
        targets = catalogue

    fresh: list[dict] = []
    products_with_rows = 0
    for idx, product in enumerate(targets, start=1):
        if on_progress:
            on_progress(
                {
                    "current": idx,
                    "total": len(targets),
                    "commodity": product["commodity"],
                }
            )
        rows = fetch_rows_for_product(
            product["product_id"], fetched_at=fetched_at, per_page=per_page
        )
        if rows:
            products_with_rows += 1
        fresh.extend(rows)
        if idx < len(targets) and delay_seconds:
            time.sleep(delay_seconds)

    rows_fetched = len(fresh)
    fresh = market_csv.trim_recent(fresh)

    if commodity:
        # Merge: drop the refreshed commodities' old rows, keep the rest.
        refreshed = {(r.get("commodity") or "").lower() for r in fresh}
        if not refreshed:
            raise RuntimeError(
                f"KAMIS returned no rows for '{commodity}' — keeping the existing CSV."
            )
        kept = [
            r
            for r in market_csv.read_rows()
            if (r.get("commodity") or "").lower() not in refreshed
        ]
        final_rows = market_csv.trim_recent(kept + fresh)
        mode = "commodity"
    else:
        if not fresh:
            raise RuntimeError(
                "KAMIS returned no rows at all — keeping the existing CSV."
            )
        final_rows = fresh
        mode = "full"

    path = market_csv.write_rows_atomic(final_rows)

    stats = {
        "mode": mode,
        "commodity": commodity,
        "products_scanned": len(targets),
        "products_with_rows": products_with_rows,
        "rows_fetched": rows_fetched,
        "rows_written": len(final_rows),
        "commodities_in_csv": len({(r.get("commodity") or "").lower() for r in final_rows}),
        "csv_path": str(path),
        "fetched_at": fetched_at,
    }
    logger.info("KAMIS collection complete: %s", stats)
    return stats
