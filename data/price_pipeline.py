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
from datetime import datetime, timedelta
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
    """Convert KAMIS wholesale price string to KSh per 90kg bag."""
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


def _parse_kamis_date(val) -> datetime | None:
    if not val or str(val).strip() in ("-", "", "nan"):
        return None
    try:
        return datetime.strptime(str(val).strip()[:10], "%Y-%m-%d")
    except ValueError:
        return None


def _median(values: list[float]) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2


def _latest_wholesale_by_county(rows: list[dict]) -> dict[str, dict]:
    """Latest KAMIS wholesale price per tracked county (median across markets)."""
    by_county: dict[str, list[dict]] = {}
    for row in rows:
        county = str(row.get("County", "")).strip()
        if county not in COUNTY_TO_MARKET:
            continue
        price = _parse_price(row.get("Wholesale"))
        dt = _parse_kamis_date(row.get("Date"))
        if price is None or dt is None:
            continue
        by_county.setdefault(county, []).append(
            {"price": price, "date": dt, "market": row.get("Market", "")}
        )

    result: dict[str, dict] = {}
    for county, items in by_county.items():
        latest_dt = max(i["date"] for i in items)
        latest_prices = [i["price"] for i in items if i["date"] == latest_dt]
        median_price = _median(latest_prices)
        if median_price is None:
            continue
        result[county] = {
            "price": round(median_price, 0),
            "date": latest_dt.strftime("%Y-%m-%d"),
            "markets": len(latest_prices),
        }
    return result


def _county_wholesale_on_date(
    rows: list[dict], county: str, target: datetime
) -> float | None:
    """Median wholesale price for a county on a specific KAMIS report date."""
    prices: list[float] = []
    target_day = target.date()
    for row in rows:
        if str(row.get("County", "")).strip() != county:
            continue
        dt = _parse_kamis_date(row.get("Date"))
        if dt is None or dt.date() != target_day:
            continue
        price = _parse_price(row.get("Wholesale"))
        if price is not None:
            prices.append(price)
    median = _median(prices)
    return round(median, 0) if median is not None else None


def _historical_price_for_county(
    rows: list[dict], county: str, latest_dt: datetime, lookback_days: int = 14
) -> tuple[float | None, str | None]:
    """Find wholesale price closest to lookback_days before latest_dt."""
    target = latest_dt - timedelta(days=lookback_days)
    candidates: dict[datetime, list[float]] = {}
    for row in rows:
        if str(row.get("County", "")).strip() != county:
            continue
        dt = _parse_kamis_date(row.get("Date"))
        if dt is None or dt > latest_dt:
            continue
        price = _parse_price(row.get("Wholesale"))
        if price is None:
            continue
        candidates.setdefault(dt, []).append(price)

    if not candidates:
        return None, None

    best_dt = min(candidates, key=lambda d: abs((d - target).days))
    # Only use if within 10 days of target window
    if abs((best_dt - target).days) > 10:
        return None, None

    median = _median(candidates[best_dt])
    if median is None:
        return None, None
    return round(median, 0), best_dt.strftime("%Y-%m-%d")


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
    cache_key = f"prices:v2:{crop.lower()}"
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.info("Cache hit for %s", crop)
        return cached

    rows = _fetch_kamis(crop)

    if not rows:
        logger.warning("No KAMIS rows returned for %s", crop)
        return {}

    latest = _latest_wholesale_by_county(rows)
    result: dict[str, float] = {}
    for county, info in latest.items():
        market = COUNTY_TO_MARKET[county]
        result[market] = info["price"]

    if result:
        _cache_set(cache_key, result)
        logger.info("Live KAMIS prices for %s: %s", crop, result)
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
    Returns price trend for a crop at a market from KAMIS historical wholesale data.

    Compares the latest KAMIS wholesale price to the price ~14 days earlier.

    Returns:
        {
            "crop": str,
            "market": str,
            "price_kes": float | None,
            "kamis_date": str | None,
            "compare_date": str | None,
            "compare_price_kes": float | None,
            "trend": "rising" | "falling" | "stable",
            "pct_change": float | None,
            "wait_days": int,
            "national_avg_kes": float | None,
            "data_source": str,
        }
    """
    market = market.lower().strip()
    county = MARKET_TO_COUNTY.get(market)
    empty = {
        "crop": crop,
        "market": market,
        "price_kes": None,
        "kamis_date": None,
        "compare_date": None,
        "compare_price_kes": None,
        "trend": "stable",
        "pct_change": None,
        "wait_days": 0,
        "national_avg_kes": None,
        "data_source": "KAMIS (kamis.kilimo.go.ke)",
    }

    if not county:
        return empty

    rows = _fetch_kamis(crop)
    if not rows:
        return empty

    latest_by_county = _latest_wholesale_by_county(rows)
    county_info = latest_by_county.get(county)
    if not county_info:
        return empty

    latest_price = county_info["price"]
    kamis_date = county_info["date"]
    latest_dt = datetime.strptime(kamis_date, "%Y-%m-%d")

    past_price, compare_date = _historical_price_for_county(rows, county, latest_dt)

    trend = "stable"
    pct_change = None
    wait_days = 0

    if past_price and past_price > 0:
        pct_change = round((latest_price - past_price) / past_price * 100, 1)
        if pct_change >= 3:
            trend, wait_days = "rising", 7
        elif pct_change <= -3:
            trend, wait_days = "falling", 0
        else:
            trend, wait_days = "stable", 3

    all_prices = [info["price"] for info in latest_by_county.values()]
    national_avg = round(sum(all_prices) / len(all_prices), 0) if all_prices else None

    return {
        "crop": crop,
        "market": market,
        "price_kes": latest_price,
        "kamis_date": kamis_date,
        "compare_date": compare_date,
        "compare_price_kes": past_price,
        "trend": trend,
        "pct_change": pct_change,
        "wait_days": wait_days,
        "national_avg_kes": national_avg,
        "data_source": "KAMIS (kamis.kilimo.go.ke)",
    }
