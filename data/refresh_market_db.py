"""Fetch KAMIS prices and persist them to SQLite."""

from __future__ import annotations

import io
import logging
import sys
import time

import pandas as pd
import requests
import urllib3

from data.market_db import init_db, insert_market_rows, prune_old_data, utc_now_iso
from data.price_pipeline import _parse_kamis_date, _parse_price, normalize_county

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

KAMIS_URL = "https://kamis.kilimo.go.ke/site/market"

# Deep pull so infrequently reporting markets (Nyeri, Nakuru, Kitale, Eldoret)
# still land in the cache. KAMIS has no server-side county filter — it returns
# the most recent N rows nationwide — so a tiny per_page misses whole counties.
ROW_LIMIT_PER_PRODUCT = 1500
REQUEST_DELAY_SECONDS = 0.5
REQUEST_TIMEOUT_SECONDS = 40

# contract.json focus crops → primary KAMIS product IDs
# (kept here so the sync job does not import engines/, which needs API keys)
FOCUS_PRODUCT_IDS: list[int] = sorted(
    {
        1,  # dry maize
        149,  # green maize
        2,  # red sorghum
        51,  # pearl rush millet
        29,  # beans red haricot
        30,  # beans yellow-green
        64,  # beans rosecoco
        65,  # beans mwitemania
        66,  # beans mwezi moja
        67,  # beans canadian wonder
        183,  # beans rosecoco (nyayo)
        246,  # mixed beans
        57,  # red irish potato
        59,  # sweet potatoes
        163,  # white irish potatoes
        61,  # tomatoes
    }
)


def _normalize_date(raw: str | None) -> str | None:
    dt = _parse_kamis_date(raw)
    return dt.strftime("%Y-%m-%d") if dt else None


def fetch_rows_for_product(product_id: int, fetched_at: str) -> list[dict]:
    try:
        response = requests.get(
            KAMIS_URL,
            params={"product": product_id, "per_page": ROW_LIMIT_PER_PRODUCT},
            verify=False,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        if response.status_code != 200:
            logger.warning(
                "KAMIS HTTP %s for product_id=%s", response.status_code, product_id
            )
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

        county = normalize_county(county_raw)
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
                "county": county,
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


def run_refresh() -> dict[str, int]:
    init_db()
    fetched_at = utc_now_iso()
    product_ids = FOCUS_PRODUCT_IDS

    all_rows: list[dict] = []
    for idx, pid in enumerate(product_ids, start=1):
        all_rows.extend(fetch_rows_for_product(pid, fetched_at=fetched_at))
        if idx < len(product_ids):
            time.sleep(REQUEST_DELAY_SECONDS)

    inserted = insert_market_rows(all_rows)
    deleted = prune_old_data(keep_days=14)

    stats = {
        "products_scanned": len(product_ids),
        "rows_fetched": len(all_rows),
        "rows_inserted": inserted,
        "rows_deleted": deleted,
    }

    if inserted == 0:
        logger.error("KAMIS refresh inserted 0 rows — aborting. Stats: %s", stats)
        raise RuntimeError(
            "KAMIS refresh inserted 0 rows. Refusing to commit an empty sync."
        )

    # Coverage check for the seven focus markets (any focus crop).
    focus_counties = {
        "Nairobi",
        "Nakuru",
        "Uasin Gishu",
        "Kisumu",
        "Mombasa",
        "Trans Nzoia",
        "Nyeri",
    }
    present = {r["county"] for r in all_rows if r["county"] in focus_counties}
    missing = sorted(focus_counties - present)
    stats["focus_counties_present"] = len(present)
    stats["focus_counties_missing"] = ",".join(missing) if missing else ""
    if missing:
        logger.warning(
            "Focus counties still missing after deep pull: %s", ", ".join(missing)
        )

    return stats


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    try:
        stats = run_refresh()
    except RuntimeError as exc:
        logger.error("%s", exc)
        sys.exit(1)
    logger.info("KAMIS refresh complete: %s", stats)
