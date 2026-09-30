"""KAMIS Excel export fallback — same official source, alternate transport."""

from __future__ import annotations

import io
import json
import logging
from typing import Optional

import pandas as pd
import requests

from engines.price_filters import apply_price_filters
from engines.rate_limiter import kamis_http_limiter

logger = logging.getLogger(__name__)

KAMIS_SEARCH_URL = "https://kamis.kilimo.go.ke/site/market_search"
_MAX_PRODUCT_FETCHES = 4
_ESSENTIAL_COLS = ["Commodity", "Market", "County", "Wholesale", "Retail", "Date"]


def _fetch_excel_table(product_id: int, timeout: int = 30) -> Optional[pd.DataFrame]:
    """Download one KAMIS Excel export for a product ID."""
    try:
        kamis_http_limiter.acquire()
        response = requests.get(
            KAMIS_SEARCH_URL,
            params={"product[]": product_id, "export": "excel"},
            verify=False,
            timeout=timeout,
        )
        if response.status_code != 200 or not response.content:
            return None
        df = pd.read_excel(io.BytesIO(response.content))
        if df.empty:
            return None
        df.columns = [str(c).strip() for c in df.columns]
        return df
    except Exception as exc:
        logger.warning("KAMIS Excel fetch failed for product %s: %s", product_id, exc)
        return None


def get_kamis_excel_prices(
    crop_name: Optional[str] = None,
    market_name: Optional[str] = None,
    county_name: Optional[str] = None,
    limit: int = 10,
) -> Optional[str]:
    """Fetch recent KAMIS prices via the official Excel export endpoint.

    Used when the HTML scrape path fails. Returns JSON records with a source
    note, or None when nothing matches.
    """
    limit = max(1, min(limit, 10))
    from engines.kamis_tool import resolve_crop_ids

    product_ids = resolve_crop_ids(crop_name.strip()) if crop_name else []
    if len(product_ids) > _MAX_PRODUCT_FETCHES:
        product_ids = product_ids[:_MAX_PRODUCT_FETCHES]

    frames: list[pd.DataFrame] = []
    if product_ids:
        for pid in product_ids:
            table = _fetch_excel_table(pid)
            if table is not None:
                frames.append(table)
    else:
        try:
            kamis_http_limiter.acquire()
            response = requests.get(
                KAMIS_SEARCH_URL,
                params={"export": "excel"},
                verify=False,
                timeout=30,
            )
            if response.status_code == 200 and response.content:
                table = pd.read_excel(io.BytesIO(response.content))
                if not table.empty:
                    table.columns = [str(c).strip() for c in table.columns]
                    frames.append(table)
        except Exception as exc:
            logger.warning("KAMIS Excel generic fetch failed: %s", exc)

    if not frames:
        return None

    df = pd.concat(frames, ignore_index=True).drop_duplicates()
    df, substitution_note = apply_price_filters(df, crop_name, market_name, county_name)
    if df.empty:
        return None

    if "Date" in df.columns:
        df = df.sort_values(by="Date", ascending=False)

    cols = [c for c in _ESSENTIAL_COLS if c in df.columns]
    records = df[cols].head(limit).to_dict(orient="records")

    note = (
        "Source: KAMIS Excel export (Ministry of Agriculture), used because the "
        "HTML price table could not be retrieved.\n\n"
    )
    return note + substitution_note + json.dumps(records, indent=2, default=str)
