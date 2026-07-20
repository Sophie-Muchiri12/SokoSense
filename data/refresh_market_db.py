"""Fetch KAMIS prices and persist them to SQLite."""

from __future__ import annotations

import io
import logging
import time

import pandas as pd
import requests
import urllib3

from data.market_db import init_db, insert_market_rows, prune_old_data, utc_now_iso
from data.price_pipeline import _parse_kamis_date, _parse_price
from engines.kamis_tool import CROP_MAPPING

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

KAMIS_URL = "https://kamis.kilimo.go.ke/site/market"
ROW_LIMIT_PER_CROP = 10
REQUEST_DELAY_SECONDS = 0.25


def _normalize_date(raw: str | None) -> str | None:
    dt = _parse_kamis_date(raw)
    return dt.strftime("%Y-%m-%d") if dt else None


def fetch_rows_for_product(product_id: int, fetched_at: str) -> list[dict]:
    try:
        response = requests.get(
            KAMIS_URL,
            params={"product": product_id, "per_page": ROW_LIMIT_PER_CROP},
            verify=False,
            timeout=20,
        )
        if response.status_code != 200:
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
    for _, row in df.head(ROW_LIMIT_PER_CROP).iterrows():
        commodity = str(row.get("Commodity", "")).strip()
        market = str(row.get("Market", "")).strip()
        county = str(row.get("County", "")).strip()
        if not commodity or not market or not county:
            continue

        wholesale_raw = str(row.get("Wholesale", "")).strip() or None
        retail_raw = str(row.get("Retail", "")).strip() or None
        out.append(
            {
                "product_id": product_id,
                "commodity": commodity,
                "market": market,
                "county": county,
                "wholesale_raw": wholesale_raw,
                "retail_raw": retail_raw,
                "wholesale_kes_90kg": _parse_price(wholesale_raw),
                "retail_kes_90kg": _parse_price(retail_raw),
                "date_reported": _normalize_date(str(row.get("Date", "")).strip()),
                "fetched_at": fetched_at,
            }
        )
    return out


def run_refresh() -> dict[str, int]:
    init_db()
    fetched_at = utc_now_iso()
    product_ids = sorted(set(CROP_MAPPING.values()))

    all_rows: list[dict] = []
    for idx, pid in enumerate(product_ids, start=1):
        all_rows.extend(fetch_rows_for_product(pid, fetched_at=fetched_at))
        if idx < len(product_ids):
            time.sleep(REQUEST_DELAY_SECONDS)

    inserted = insert_market_rows(all_rows)
    deleted = prune_old_data(keep_days=7)

    return {
        "products_scanned": len(product_ids),
        "rows_inserted": inserted,
        "rows_deleted": deleted,
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    stats = run_refresh()
    logger.info("KAMIS refresh complete: %s", stats)
