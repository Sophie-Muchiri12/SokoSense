"""
SokoSense — Live Price Pipeline

Reads KAMIS prices from the market CSV (`data/market_prices.csv`), built by
`scripts/collect_market_data.py` (manual) or the admin portal's refresh
button — see `data/kamis_collect.py` / `data/market_csv.py`.

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
    # Counties + common market towns (for nearest-market distance)
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
    "bomet": (-0.7813, 35.3416),
    "kwale": (-4.1737, 39.4521),
    "kitui": (-1.3670, 38.0100),
    "taita taveta": (-3.3167, 38.4833),
    "chebunyo": (-0.8500, 35.2200),
    "mogogosiek": (-0.7200, 35.2800),
    "ndanai": (-0.8500, 35.0500),
    "kibuye": (-0.0910, 34.7680),
    "muhoroni": (-0.1550, 35.1980),
    "katito": (-0.2200, 34.9600),
    "butere": (0.2100, 34.4900),
    "langas": (0.4800, 35.2700),
    "eldoret main": (0.5143, 35.2698),
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
# Live portal rows (USE_LIVE) — short TTL so prices stay fresh without
# hammering KAMIS on every SMS.
_live_row_cache: dict[str, tuple[float, list]] = {}
LIVE_CACHE_TTL = 5 * 60


def _cache_get(key: str, ttl: float | None = None) -> dict | None:
    if key in _cache:
        ts, val = _cache[key]
        limit = CACHE_TTL if ttl is None else ttl
        if time() - ts < limit:
            return val
    return None


def _cache_set(key: str, val: dict) -> None:
    _cache[key] = (time(), val)


def _live_rows_get(crop: str) -> list | None:
    key = crop.strip().lower()
    hit = _live_row_cache.get(key)
    if not hit:
        return None
    ts, rows = hit
    if time() - ts < LIVE_CACHE_TTL:
        return list(rows)
    return None


def _live_rows_set(crop: str, rows: list) -> None:
    _live_row_cache[crop.strip().lower()] = (time(), list(rows))


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


def _location_rows(rows: list[dict], location: str) -> list[dict]:
    """CSV rows for ANY county/market in the file (not just focus markets).

    Matches when the row's county *or* market equals the requested location
    (normalised), e.g. location="meru" matches County=Meru rows from Maua,
    Nkubu, Kangeta… and location="maua" matches Market=Maua rows.
    """
    needle = _normalize_key(location)
    if not needle:
        return []
    return [
        r
        for r in rows
        if _normalize_key(str(r.get("County", ""))) == needle
        or _normalize_key(str(r.get("Market", ""))) == needle
    ]


def _price_series_by_date(rows: list[dict]) -> dict[datetime, list[float]]:
    """Median-ready wholesale prices grouped by report date."""
    series: dict[datetime, list[float]] = {}
    for row in rows:
        dt = _parse_kamis_date(row.get("Date"))
        price = _row_price(row)
        if dt is None or price is None:
            continue
        series.setdefault(dt, []).append(price)
    return series


def _latest_location_price(
    rows: list[dict], location: str
) -> tuple[float | None, str | None, dict[datetime, list[float]]]:
    """(latest median price, latest date, full series) for a location.

    Applies the same staleness rule as the focus-market path: a location
    whose newest report is older than MAX_PRICE_AGE_DAYS counts as missing.
    """
    series = _price_series_by_date(_location_rows(rows, location))
    if not series:
        return None, None, series
    latest_dt = max(series)
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
        days=MAX_PRICE_AGE_DAYS
    )
    if latest_dt < cutoff:
        return None, None, series
    median = _median(series[latest_dt])
    if median is None:
        return None, None, series
    return round(median, 0), latest_dt.strftime("%Y-%m-%d"), series


def _historical_from_series(
    series: dict[datetime, list[float]], latest_dt: datetime, lookback_days: int = 14
) -> tuple[float | None, str | None]:
    """Median price on the report date closest to lookback_days before latest."""
    if not series:
        return None, None
    target = latest_dt - timedelta(days=lookback_days)
    candidates = [d for d in series if d <= latest_dt]
    if not candidates:
        return None, None
    best_dt = min(candidates, key=lambda d: abs((d - target).days))
    if abs((best_dt - target).days) > 10 or best_dt == latest_dt:
        return None, None
    median = _median(series[best_dt])
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
    """Load KAMIS rows for a crop — live portal when ``USE_LIVE=true``, else CSV.

    Live failures fall back to the market CSV so decisions keep working.
    """
    try:
        from data.kamis_collect import fetch_live_crop_rows, use_live_kamis
    except Exception:
        use_live_kamis = lambda: False  # noqa: E731
        fetch_live_crop_rows = None  # type: ignore

    if use_live_kamis() and fetch_live_crop_rows is not None:
        cached = _live_rows_get(crop)
        if cached is not None:
            logger.info("USE_LIVE cache hit for %s (%d rows)", crop, len(cached))
            return cached
        try:
            live = fetch_live_crop_rows(crop)
            if live:
                _live_rows_set(crop, live)
                logger.info("USE_LIVE portal returned %d rows for crop=%s", len(live), crop)
                return live
            logger.warning(
                "USE_LIVE returned no rows for %s — falling back to market CSV", crop
            )
        except Exception as exc:
            logger.warning(
                "USE_LIVE fetch failed for %s (%s) — falling back to market CSV",
                crop,
                exc,
            )

    try:
        from data.market_csv import query_crop_history

        rows = query_crop_history(
            crop,
            max_rows=8000,
            prefer_counties=list(MARKET_TO_COUNTY.values()),
        )
        logger.info("Market CSV returned %d rows for crop=%s", len(rows), crop)
        return rows
    except Exception as exc:
        logger.error("Price fetch failed for %s: %s", crop, exc)
        return []


# ---------------------------------------------------------------------------
# MAIN FUNCTIONS
# ---------------------------------------------------------------------------

def get_live_prices(crop: str) -> dict[str, float]:
    """
    Fetch prices for a crop from the price cache, aggregated by market.

    Returns:
        dict mapping market name (lowercase) → price in KSh per 90kg bag
        e.g. {"nairobi": 4950, "nakuru": 3600, "eldoret": 3900}

    Falls back to empty dict on any error — callers use mock fallback.
    """
    from data.market_csv import csv_version

    try:
        from data.kamis_collect import use_live_kamis

        live = use_live_kamis()
    except Exception:
        live = False

    cache_key = (
        f"prices:live:v1:{crop.lower()}"
        if live
        else f"prices:v3:{crop.lower()}:{csv_version()}"
    )
    cached = _cache_get(cache_key, ttl=LIVE_CACHE_TTL if live else None)
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
    if current_price is None:
        # Location may be a non-focus county/market with CSV rows (e.g. Meru).
        current_price = get_trend(crop, current_market).get("price_kes")
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


def _format_sell_date(iso_date: str | None) -> str | None:
    """Turn YYYY-MM-DD into a short farmer-facing date, e.g. 27 Oct 2026."""
    if not iso_date:
        return None
    try:
        return datetime.strptime(iso_date, "%Y-%m-%d").strftime("%d %b %Y")
    except ValueError:
        return iso_date


def _market_price_date(crop: str, market: str) -> str | None:
    """Latest KAMIS report date for a crop/market, if available."""
    try:
        return get_trend(crop, market).get("kamis_date")
    except Exception:
        return None


def _coords_for(name: str) -> tuple[float, float] | None:
    """Lookup GPS for a market or county label."""
    key = _normalize_key(name)
    if key in MARKET_COORDS:
        return MARKET_COORDS[key]
    # Strip common suffixes: "Mogogosiek Market" → "mogogosiek"
    for suffix in (" market", " livestock market", " retail market", " town"):
        if key.endswith(suffix):
            trimmed = key[: -len(suffix)].strip(" -_")
            if trimmed in MARKET_COORDS:
                return MARKET_COORDS[trimmed]
    return None


def _latest_market_quotes(crop: str, max_age_days: int = 14) -> list[dict]:
    """Latest wholesale quote per KAMIS market town (not county medians).

    Each item: market, county, price_kes, date, coords (if known).
    Only keeps quotes within ``max_age_days`` of today.
    """
    rows = _fetch_kamis(crop)
    if not rows:
        return []

    by_market: dict[tuple[str, str], dict] = {}
    for row in rows:
        market = str(row.get("Market") or "").strip()
        county = normalize_county(str(row.get("County") or ""))
        if not market:
            continue
        price = _row_price(row)
        dt = _parse_kamis_date(row.get("Date"))
        if price is None or dt is None:
            continue
        key = (_normalize_key(market), _normalize_key(county))
        prev = by_market.get(key)
        if prev is None or dt > prev["dt"]:
            by_market[key] = {
                "market": market,
                "county": county,
                "price_kes": float(price),
                "date": dt.strftime("%Y-%m-%d"),
                "dt": dt,
                "coords": _coords_for(market) or _coords_for(county),
            }

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=max_age_days)
    quotes: list[dict] = []
    for item in by_market.values():
        if item["dt"] < cutoff:
            continue
        quotes.append(
            {
                "market": item["market"],
                "county": item["county"],
                "price_kes": item["price_kes"],
                "date": item["date"],
                "coords": item["coords"],
            }
        )
    return quotes


def _quote_matches_location(quote: dict, location: str) -> bool:
    """True if a market quote belongs to the farmer's place (county or market)."""
    needle = _normalize_key(location)
    if not needle:
        return False
    market = _normalize_key(quote.get("market") or "")
    county = _normalize_key(quote.get("county") or "")
    return (
        needle == market
        or needle == county
        or needle in market
        or needle in county
        or market in needle
        or county in needle
    )


def recommend_nearest_sell(crop: str, location: str) -> dict:
    """Recommend where to sell using latest *market-level* prices + distance.

    Rules:
    - Baseline = latest price at the farmer's location (named KAMIS market).
    - If local is best (or tied), recommend selling there.
    - Otherwise recommend the *nearest* other market that pays more
      (haversine). Never fall back to a distant highest-paying county median.
    - Quotes use real market wholesale prices from the CSV (e.g. Chebunyo,
      Kibuye), not blended county averages.
    """
    crop_key = crop.strip().lower()
    requested = location.strip().lower()
    resolved = _canonical_market_key(requested) or _normalize_key(requested)
    quotes = _latest_market_quotes(crop_key)

    empty = {
        "crop": crop_key,
        "location": resolved or requested,
        "local_market": None,
        "recommendation": "WAIT",
        "sell_market": None,
        "sell_price_kes": None,
        "local_price_kes": None,
        "profit_kes": None,
        "distance_km": None,
        "price_date": None,
        "price_date_display": None,
        "note": "No recent market price data is available right now.",
    }
    if not quotes:
        return empty

    local_quotes = [q for q in quotes if _quote_matches_location(q, requested)]
    # Prefer the newest local report; if several markets share that date, take median.
    local_price: float | None = None
    local_date: str | None = None
    local_market: str | None = None
    if local_quotes:
        newest = max(q["date"] for q in local_quotes)
        on_day = [q for q in local_quotes if q["date"] == newest]
        prices_on_day = [q["price_kes"] for q in on_day]
        med = _median(prices_on_day)
        local_price = round(med, 0) if med is not None else on_day[0]["price_kes"]
        local_date = newest
        # Name the highest-volume-looking / highest price market on that day for clarity
        local_market = max(on_day, key=lambda q: q["price_kes"])["market"]

    origin = (
        _coords_for(resolved)
        or _coords_for(requested)
        or next((q["coords"] for q in local_quotes if q.get("coords")), None)
    )

    local_county = _normalize_key(
        (local_quotes[0]["county"] if local_quotes else "") or requested
    )

    def _elsewhere(q: dict) -> bool:
        county = _normalize_key(q.get("county") or "")
        market = _normalize_key(q.get("market") or "")
        if local_county and county == local_county:
            return False
        if resolved and (market == resolved or county == resolved):
            return False
        return True

    elsewhere = [q for q in quotes if _elsewhere(q) and q.get("coords")]

    if local_price is not None:
        better = [q for q in elsewhere if q["price_kes"] > local_price]
        if not better or not origin:
            # No better reachable market (or no GPS) → sell locally.
            sell_name = local_market or (resolved or requested)
            return {
                "crop": crop_key,
                "location": resolved or requested,
                "local_market": local_market,
                "recommendation": "SELL_HERE",
                "sell_market": sell_name,
                "sell_price_kes": local_price,
                "local_price_kes": local_price,
                "profit_kes": 0.0,
                "distance_km": 0.0,
                "price_date": local_date,
                "price_date_display": _format_sell_date(local_date),
                "note": "",
            }

        # Nearest market that pays more; ties → higher price.
        def _rank(q: dict) -> tuple[float, float]:
            dist = _haversine_km(origin, q["coords"])
            return (dist, -q["price_kes"])

        chosen = min(better, key=_rank)
        dist = round(_haversine_km(origin, chosen["coords"]), 0)
        sell_label = chosen["market"]
        county = chosen.get("county") or ""
        if county and _normalize_key(county) not in _normalize_key(sell_label):
            sell_label = f"{chosen['market']} ({county})"

        return {
            "crop": crop_key,
            "location": resolved or requested,
            "local_market": local_market,
            "recommendation": "SELL_IN_MARKET",
            "sell_market": sell_label,
            "sell_price_kes": chosen["price_kes"],
            "local_price_kes": local_price,
            "profit_kes": round(chosen["price_kes"] - local_price, 0),
            "distance_km": dist,
            "price_date": chosen["date"],
            "price_date_display": _format_sell_date(chosen["date"]),
            "note": "",
        }

    # No local price — nearest market with any quote + coords.
    if not origin:
        # Unknown place: pick highest paying named market (honest about price).
        best = max(quotes, key=lambda q: q["price_kes"])
        return {
            "crop": crop_key,
            "location": resolved or requested,
            "local_market": None,
            "recommendation": "SELL_IN_MARKET",
            "sell_market": best["market"],
            "sell_price_kes": best["price_kes"],
            "local_price_kes": None,
            "profit_kes": None,
            "distance_km": None,
            "price_date": best["date"],
            "price_date_display": _format_sell_date(best["date"]),
            "note": (
                f"No price for {requested.title()}. "
                f"Showing {best['market']} at KSh {best['price_kes']:,.0f}/bag."
            ),
        }

    with_coords = [q for q in quotes if q.get("coords")]
    if not with_coords:
        return empty
    nearest = min(with_coords, key=lambda q: _haversine_km(origin, q["coords"]))
    dist = round(_haversine_km(origin, nearest["coords"]), 0)
    return {
        "crop": crop_key,
        "location": resolved or requested,
        "local_market": None,
        "recommendation": "SELL_IN_MARKET",
        "sell_market": nearest["market"],
        "sell_price_kes": nearest["price_kes"],
        "local_price_kes": None,
        "profit_kes": None,
        "distance_km": dist,
        "price_date": nearest["date"],
        "price_date_display": _format_sell_date(nearest["date"]),
        "note": "",
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
        "data_source": "KAMIS CSV (data/market_prices.csv)",
    }

    rows = _fetch_kamis(crop)
    if not rows:
        return empty

    latest_by_county = _latest_wholesale_by_county(rows)

    if county:
        county_info = latest_by_county.get(county)
        if not county_info:
            return empty
        latest_price = county_info["price"]
        kamis_date = county_info["date"]
        latest_dt = datetime.strptime(kamis_date, "%Y-%m-%d")
        past_price, compare_date = _historical_price_for_county(
            rows, county, latest_dt
        )
    else:
        # Any other county/market present in the CSV (e.g. Meru, Kakamega,
        # or a market town like Maua) — read its rows directly instead of
        # declaring "no market found" just because it isn't a focus market.
        latest_price, kamis_date, series = _latest_location_price(rows, market)
        if latest_price is None or kamis_date is None:
            return empty
        latest_dt = datetime.strptime(kamis_date, "%Y-%m-%d")
        past_price, compare_date = _historical_from_series(series, latest_dt)

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
        "data_source": "KAMIS CSV (data/market_prices.csv)",
    }
