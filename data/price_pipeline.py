"""
SokoSense — Live Price Pipeline
Lucy Kamau · Data Layer Owner

Wraps Job's KAMIS scraper to aggregate live prices by county.
Called by engines/market.py and engines/timing.py via get_live_prices().

Usage:
    from data.price_pipeline import get_live_prices, get_best_market
    prices = get_live_prices("maize")
    # {"nakuru": 3600, "nairobi": 3200, ...}
"""

import io
import json
import logging
import urllib3
from time import time

import pandas as pd
import requests

logger = logging.getLogger(__name__)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ---------------------------------------------------------------------------
# MARKET → COUNTY MAPPING
# Maps our contract.json market names to KAMIS county names
# ---------------------------------------------------------------------------

MARKET_TO_COUNTY = {
    "nairobi":  "Nairobi",
    "nakuru":   "Nakuru",
    "eldoret":  "Uasin Gishu",
    "kisumu":   "Kisumu",
    "mombasa":  "Mombasa",
    "kitale":   "Trans Nzoia",
    "nyeri":    "Nyeri",
}

COUNTY_TO_MARKET = {v: k for k, v in MARKET_TO_COUNTY.items()}

KAMIS_URL = "https://kamis.kilimo.go.ke/site/market"

# ---------------------------------------------------------------------------
# PRICE CACHE (12-hour TTL)
# ---------------------------------------------------------------------------

_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL = 12 * 60 * 60


def _cache_get(key: str) -> dict | None:
    if key in _cache:
        ts, val = _cache[key]
        if time() - ts < CACHE_TTL:
            return val
    return None


def _cache_set(key: str, val: dict) -> None:
    _cache[key] = (time(), val)


# ---------------------------------------------------------------------------
# PRICE PARSER
# ---------------------------------------------------------------------------

def _parse_price(val) -> float | None:
    """Convert KAMIS price string to KSh per 90kg bag."""
    if not val or str(val).strip() in ("-", "", "nan"):
        return None
    try:
        cleaned = "".join(c for c in str(val) if c.isdigit() or c == ".")
        if cleaned:
            price = float(cleaned)
            # KAMIS reports per KG — convert to 90kg bag
            if price < 500:
                price = price * 90
            return round(price, 0)
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# DIRECT KAMIS FETCH (bypasses tool's 10-row cap)
# ---------------------------------------------------------------------------

def _fetch_kamis(crop: str) -> list[dict]:
    """
    Fetch all available KAMIS rows for a crop directly.
    Requests per_page=500 to capture all counties.
    Returns list of raw row dicts.
    """
    try:
        from engines.kamis_tool import resolve_crop_ids
        product_ids = resolve_crop_ids(crop.strip().lower())
    except Exception as e:
        logger.error("Could not resolve crop IDs for %s: %s", crop, e)
        return []

    dfs = []
    if product_ids:
        for pid in product_ids:
            try:
                resp = requests.get(
                    KAMIS_URL,
                    params={"product": pid, "per_page": 500},
                    verify=False,
                    timeout=20,
                )
                if resp.status_code == 200:
                    tables = pd.read_html(io.StringIO(resp.text))
                    if tables:
                        dfs.append(tables[0])
            except Exception as e:
                logger.warning("KAMIS fetch failed for product_id=%s: %s", pid, e)
    else:
        # No ID resolved — try generic fetch
        try:
            resp = requests.get(
                KAMIS_URL,
                params={"per_page": 500},
                verify=False,
                timeout=20,
            )
            if resp.status_code == 200:
                tables = pd.read_html(io.StringIO(resp.text))
                if tables:
                    dfs.append(tables[0])
        except Exception as e:
            logger.error("KAMIS generic fetch failed: %s", e)

    if not dfs:
        return []

    df = pd.concat(dfs, ignore_index=True)
    df.columns = [c.strip() for c in df.columns]
    df = df.drop_duplicates()

    # Filter to this crop
    df = df[df["Commodity"].str.contains(crop, case=False, na=False)]

    return df.to_dict(orient="records")


# ---------------------------------------------------------------------------
# MAIN FUNCTIONS
# ---------------------------------------------------------------------------

def get_live_prices(crop: str) -> dict[str, float]:
    """
    Fetch live prices for a crop from KAMIS, aggregated by our market names.

    Returns:
        dict mapping market name (lowercase) → price in KSh per 90kg bag
        e.g. {"nairobi": 4950, "nakuru": 3600, "eldoret": 3900}

    Falls back to empty dict on any error — callers use mock fallback.
    """
    cache_key = f"prices:{crop.lower()}"
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.info("Cache hit for %s", crop)
        return cached

    rows = _fetch_kamis(crop)

    if not rows:
        logger.warning("No KAMIS rows returned for %s", crop)
        return {}

    # Aggregate: average wholesale price per county
    county_prices: dict[str, list[float]] = {}
    for row in rows:
        county = str(row.get("County", "")).strip()
        if county not in COUNTY_TO_MARKET:
            continue
        price = _parse_price(row.get("Wholesale")) or _parse_price(row.get("Retail"))
        if price:
            county_prices.setdefault(county, []).append(price)

    result: dict[str, float] = {}
    for county, prices in county_prices.items():
        market = COUNTY_TO_MARKET[county]
        result[market] = round(sum(prices) / len(prices), 0)

    if result:
        _cache_set(cache_key, result)
        logger.info("Live prices for %s: %s", crop, result)
    else:
        logger.warning("No matching counties in KAMIS data for %s", crop)

    return result


def get_best_market(crop: str, current_market: str) -> dict:
    """
    Find the highest-paying market for a crop from live KAMIS data.

    Returns:
        {
            "current_market": str,
            "current_price": float | None,
            "best_market": str,
            "best_price": float | None,
            "price_diff_kes": float,
        }
    """
    prices  = get_live_prices(crop)
    current = current_market.lower().strip()

    if not prices:
        return {
            "current_market":  current,
            "current_price":   None,
            "best_market":     current,
            "best_price":      None,
            "price_diff_kes":  0,
        }

    current_price = prices.get(current)
    best_market   = max(prices, key=prices.get)
    best_price    = prices[best_market]
    diff          = (best_price - current_price) if current_price else 0

    return {
        "current_market":  current,
        "current_price":   current_price,
        "best_market":     best_market,
        "best_price":      best_price,
        "price_diff_kes":  max(diff, 0),
    }


def get_trend(crop: str, market: str) -> dict:
    """
    Returns price trend signal for a crop at a market.
    Derived from cross-market variance as a proxy for trend direction.

    Returns:
        {
            "crop": str,
            "market": str,
            "price_kes": float | None,
            "trend": "up" | "down" | "flat",
            "wait_days": int,
        }
    """
    prices = get_live_prices(crop)
    market = market.lower().strip()
    price  = prices.get(market)

    if not prices or price is None:
        return {
            "crop": crop, "market": market,
            "price_kes": None, "trend": "flat", "wait_days": 0,
        }

    avg  = sum(prices.values()) / len(prices)
    diff = price - avg

    # Below average → price likely to rise → worth waiting
    # Above average → already at peak → sell now
    if diff < -avg * 0.05:
        trend, wait = "up", 3
    elif diff > avg * 0.05:
        trend, wait = "flat", 0
    else:
        trend, wait = "flat", 1

    return {
        "crop":      crop,
        "market":    market,
        "price_kes": price,
        "trend":     trend,
        "wait_days": wait,
    }
