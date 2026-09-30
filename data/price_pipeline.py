"""
SokoSense — Live Price Pipeline

Reads KAMIS prices from the local SQLite cache populated by
`data/refresh_market_db.py` (GitHub Actions every 3 hours).

Usage:
    from data.price_pipeline import get_live_prices, get_best_market, nearest_market
    prices = get_live_prices("maize")
    # {"nakuru": 3600, "nairobi": 3200, ...}
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone
from time import time

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# MARKET → COUNTY MAPPING
# Maps our contract.json market names to KAMIS county names (space form).
# KAMIS sometimes stores hyphenated counties (Uasin-Gishu); we normalise.
# ---------------------------------------------------------------------------

MARKET_TO_COUNTY = {
    "nairobi": "Nairobi",
    "nakuru": "Nakuru",
    "eldoret": "Uasin Gishu",
    "kisumu": "Kisumu",
    "mombasa": "Mombasa",
    "kitale": "Trans Nzoia",
    "nyeri": "Nyeri",
}

COUNTY_TO_MARKET = {v: k for k, v in MARKET_TO_COUNTY.items()}

# Prices older than this are treated as missing → nearest_market() kicks in.
MAX_PRICE_AGE_DAYS = 90

# Approximate GPS for focus markets + a few common farmer locations
# used by nearest_market() when the requested place has no price.
MARKET_COORDS: dict[str, tuple[float, float]] = {
    "nairobi": (-1.2864, 36.8172),
    "nakuru": (-0.3031, 36.0800),
    "eldoret": (0.5143, 35.2698),
    "kisumu": (-0.1022, 34.7617),
    "mombasa": (-4.0435, 39.6682),
    "kitale": (1.0167, 35.0000),
    "nyeri": (-0.4197, 36.9475),
    # Common non-focus locations (for nearest-market fallback)
    "meru": (0.0467, 37.6556),
    "embu": (-0.5396, 37.4519),
    "thika": (-1.0333, 37.0693),
    "kakamega": (0.2827, 34.7519),
    "kericho": (-0.3670, 35.2830),
    "nandi": (0.1860, 35.1200),
    "bungoma": (0.5635, 34.5606),
    "machakos": (-1.5177, 37.2634),
    "kiambu": (-1.1714, 36.8356),
    "muranga": (-0.7202, 37.1526),
    "kirinyaga": (-0.6591, 37.3827),
    "laikipia": (0.3600, 36.7800),
    "uasin gishu": (0.5143, 35.2698),
    "trans nzoia": (1.0167, 35.0000),
}

# Aliases → focus market keys
_LOCATION_ALIASES: dict[str, str] = {
    "uasin gishu": "eldoret",
    "trans nzoia": "kitale",
    "nairobi county": "nairobi",
    "nakuru county": "nakuru",
    "kisumu county": "kisumu",
    "mombasa county": "mombasa",
    "nyeri county": "nyeri",
}

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
# NORMALISATION HELPERS
# ---------------------------------------------------------------------------

def normalize_county(name: str) -> str:
    """Canonical county label: hyphens → spaces, collapsed whitespace.

    KAMIS stores both "Uasin-Gishu" and "Uasin Gishu"; we treat them as one.
    """
    if not name:
        return ""
    return " ".join(str(name).replace("-", " ").replace("_", " ").split())


def _normalize_key(name: str) -> str:
    return normalize_county(name).lower()


def _canonical_market_key(location: str) -> str:
    """Map a farmer location string to a focus-market key when possible."""
    key = _normalize_key(location)
    if key in MARKET_TO_COUNTY:
        return key
    if key in _LOCATION_ALIASES:
        return _LOCATION_ALIASES[key]
    for alias, market in _LOCATION_ALIASES.items():
        if alias in key or key in alias:
            return market
    for market in MARKET_TO_COUNTY:
        if market in key:
            return market
    return key


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


def _resolve_tracked_county(market: str, county: str) -> str | None:
    """Map a KAMIS market/county label to one of our tracked counties."""
    haystack = _normalize_key(f"{market} {county}")
    for market_key, county_name in MARKET_TO_COUNTY.items():
        if market_key in haystack or _normalize_key(county_name) in haystack:
            return county_name
    return None


def _row_price(row: dict) -> float | None:
    return _parse_price(row.get("Wholesale")) or _parse_price(row.get("Retail"))


def _latest_wholesale_by_county(rows: list[dict]) -> dict[str, dict]:
    """Latest KAMIS price per tracked county (median across markets).

    Drops counties whose newest report is older than ``MAX_PRICE_AGE_DAYS`` so
    callers fall through to nearest_market() instead of quoting stale figures.
    """
    by_county: dict[str, list[dict]] = {}
    for row in rows:
        county = _resolve_tracked_county(
            str(row.get("Market", "")),
            str(row.get("County", "")),
        )
        if not county:
            continue
        price = _row_price(row)
        dt = _parse_kamis_date(row.get("Date"))
        if price is None or dt is None:
            continue
        by_county.setdefault(county, []).append(
            {"price": price, "date": dt, "market": row.get("Market", "")}
        )

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
        days=MAX_PRICE_AGE_DAYS
    )
    result: dict[str, dict] = {}
    for county, items in by_county.items():
        latest_dt = max(i["date"] for i in items)
        if latest_dt < cutoff:
            logger.info(
                "Skipping stale %s price from %s (>%d days old)",
                county,
                latest_dt.strftime("%Y-%m-%d"),
                MAX_PRICE_AGE_DAYS,
            )
            continue
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
        resolved = _resolve_tracked_county(
            str(row.get("Market", "")),
            str(row.get("County", "")),
        )
        raw_county = normalize_county(str(row.get("County", "")))
        if raw_county != county and resolved != county:
            continue
        dt = _parse_kamis_date(row.get("Date"))
        if dt is None or dt.date() != target_day:
            continue
        price = _row_price(row)
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
        if _resolve_tracked_county(
            str(row.get("Market", "")),
            str(row.get("County", "")),
        ) != county:
            continue
        dt = _parse_kamis_date(row.get("Date"))
        if dt is None or dt > latest_dt:
            continue
        price = _row_price(row)
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


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance in km between two (lat, lng) points."""
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    return 6371.0 * 2 * math.asin(math.sqrt(h))


# ---------------------------------------------------------------------------
# LOCAL SQLITE FETCH
# ---------------------------------------------------------------------------

def _fetch_kamis(crop: str) -> list[dict]:
    """Read stored KAMIS rows for a crop from SQLite."""
    try:
        from data.market_db import init_db, query_crop_history

        init_db()
        rows = query_crop_history(
            crop,
            max_rows=8000,
            prefer_counties=list(MARKET_TO_COUNTY.values()),
        )
        logger.info("SQLite returned %d rows for crop=%s", len(rows), crop)
        return rows
    except Exception as exc:
        logger.error("SQLite price fetch failed for %s: %s", crop, exc)
        return []


# ---------------------------------------------------------------------------
# MAIN FUNCTIONS
# ---------------------------------------------------------------------------

def get_live_prices(crop: str) -> dict[str, float]:
    """
    Fetch prices for a crop from the local SQLite cache, aggregated by market.

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
        market = COUNTY_TO_MARKET.get(county)
        if market:
            result[market] = info["price"]

    if result:
        _cache_set(cache_key, result)
        logger.info("Live DB prices for %s: %s", crop, result)
    else:
        logger.warning("No matching counties in KAMIS data for %s", crop)

    return result


def nearest_market(crop: str, requested_market: str) -> dict:
    """
    Suggest the nearest tracked market that has a usable price for ``crop``.

    Used when the farmer's market/county has no fresh KAMIS row — e.g. Meru
    maize → nearest of the seven focus markets that actually has a price.

    Returns:
        {
            "requested_market": str,
            "resolved_market": str,          # canonical key if known
            "has_local_price": bool,
            "nearest_market": str | None,
            "nearest_price": float | None,
            "distance_km": float | None,
            "note": str,
        }
    """
    requested = requested_market.strip().lower()
    resolved = _canonical_market_key(requested)
    prices = get_live_prices(crop)

    empty = {
        "requested_market": requested,
        "resolved_market": resolved,
        "has_local_price": False,
        "nearest_market": None,
        "nearest_price": None,
        "distance_km": None,
        "note": "No cached market price data is available right now.",
    }

    if not prices:
        return empty

    if resolved in prices:
        return {
            "requested_market": requested,
            "resolved_market": resolved,
            "has_local_price": True,
            "nearest_market": resolved,
            "nearest_price": prices[resolved],
            "distance_km": 0.0,
            "note": "",
        }

    origin = MARKET_COORDS.get(resolved) or MARKET_COORDS.get(_normalize_key(requested))
    priced_markets = [m for m in prices if m in MARKET_COORDS]

    if not priced_markets:
        # Shouldn't happen if prices keys are focus markets, but be safe.
        best = max(prices, key=prices.get)
        return {
            "requested_market": requested,
            "resolved_market": resolved,
            "has_local_price": False,
            "nearest_market": best,
            "nearest_price": prices[best],
            "distance_km": None,
            "note": (
                f"No price for {requested.title()}. "
                f"Showing {best.title()} at KSh {prices[best]:,.0f}/bag."
            ),
        }

    if origin is None:
        # Unknown location — fall back to highest-paying focus market.
        best = max(priced_markets, key=lambda m: prices[m])
        return {
            "requested_market": requested,
            "resolved_market": resolved,
            "has_local_price": False,
            "nearest_market": best,
            "nearest_price": prices[best],
            "distance_km": None,
            "note": (
                f"No price for {requested.title()}. "
                f"Nearest tracked option with data: {best.title()} "
                f"at KSh {prices[best]:,.0f}/bag."
            ),
        }

    nearest = min(
        priced_markets,
        key=lambda m: _haversine_km(origin, MARKET_COORDS[m]),
    )
    dist = round(_haversine_km(origin, MARKET_COORDS[nearest]), 0)
    return {
        "requested_market": requested,
        "resolved_market": resolved,
        "has_local_price": False,
        "nearest_market": nearest,
        "nearest_price": prices[nearest],
        "distance_km": dist,
        "note": (
            f"No price for {requested.title()}. "
            f"Nearest market with data: {nearest.title()} "
            f"(~{dist:.0f} km) at KSh {prices[nearest]:,.0f}/bag."
        ),
    }


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
    prices = get_live_prices(crop)
    current = _canonical_market_key(current_market)

    if not prices:
        return {
            "current_market": current,
            "current_price": None,
            "best_market": current,
            "best_price": None,
            "price_diff_kes": 0,
        }

    current_price = prices.get(current)
    best_market = max(prices, key=prices.get)
    best_price = prices[best_market]
    diff = (best_price - current_price) if current_price else 0

    return {
        "current_market": current,
        "current_price": current_price,
        "best_market": best_market,
        "best_price": best_price,
        "price_diff_kes": max(diff, 0),
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
    market = _canonical_market_key(market)
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
        "data_source": "KAMIS cache (SQLite)",
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
        "data_source": "KAMIS cache (SQLite)",
    }
