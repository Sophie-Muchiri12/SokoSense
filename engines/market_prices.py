"""Market map price feed — live KAMIS data with mock fallback."""

import io
from datetime import date

import pandas as pd
import requests

from engines.kamis_tool import resolve_crop_ids
from engines.market import parse_price
from engines.rate_limiter import kamis_http_limiter
from models.market_map import MarketMapResponse, MarketPricePoint

KAMIS_URL = "https://kamis.kilimo.go.ke/site/market"

# GPS coords for Leaflet map markers
_MARKET_LOCATIONS: dict[str, tuple[float, float]] = {
    "Nairobi": (-1.2864, 36.8172),
    "Nakuru": (-0.3031, 36.0800),
    "Eldoret": (0.5143, 35.2698),
    "Kisumu": (-0.1022, 34.7617),
    "Mombasa": (-4.0435, 39.6682),
    "Kitale": (1.0167, 35.0000),
    "Nyeri": (-0.4197, 36.9475),
}

_MARKET_ALIASES: dict[str, str] = {
    "nairobi": "Nairobi",
    "nakuru": "Nakuru",
    "eldoret": "Eldoret",
    "uasin gishu": "Eldoret",
    "kisumu": "Kisumu",
    "mombasa": "Mombasa",
    "kitale": "Kitale",
    "trans-nzoia": "Kitale",
    "trans nzoia": "Kitale",
    "nyeri": "Nyeri",
}

_MOCK_PRICES: dict[str, dict[str, float]] = {
    "maize": {
        "Nairobi": 3200,
        "Nakuru": 2900,
        "Eldoret": 3500,
        "Kisumu": 3100,
        "Mombasa": 3300,
        "Kitale": 3400,
        "Nyeri": 3000,
    },
    "beans": {
        "Nairobi": 8500,
        "Nakuru": 8200,
        "Eldoret": 9100,
        "Kisumu": 8400,
        "Mombasa": 8600,
        "Kitale": 9000,
        "Nyeri": 8300,
    },
    "sorghum": {
        "Nairobi": 4500,
        "Nakuru": 4300,
        "Eldoret": 4800,
        "Kisumu": 4400,
        "Mombasa": 4600,
        "Kitale": 4700,
        "Nyeri": 4350,
    },
    "millet": {
        "Nairobi": 5200,
        "Nakuru": 5000,
        "Eldoret": 5500,
        "Kisumu": 5100,
        "Mombasa": 5300,
        "Kitale": 5450,
        "Nyeri": 5050,
    },
    "potatoes": {
        "Nairobi": 2800,
        "Nakuru": 2600,
        "Eldoret": 3100,
        "Kisumu": 2700,
        "Mombasa": 2900,
        "Kitale": 3000,
        "Nyeri": 2650,
    },
    "tomatoes": {
        "Nairobi": 6500,
        "Nakuru": 6200,
        "Eldoret": 7000,
        "Kisumu": 6400,
        "Mombasa": 6600,
        "Kitale": 6800,
        "Nyeri": 6300,
    },
}


def _canonical_market(market: str, county: str) -> str | None:
    """Map a KAMIS market/county label to one of our seven map markets."""
    haystack = f"{market} {county}".lower()
    for alias, canonical in _MARKET_ALIASES.items():
        if alias in haystack:
            return canonical
    for name in _MARKET_LOCATIONS:
        if name.lower() in haystack:
            return name
    return None


def _fetch_kamis_prices(crop: str) -> tuple[dict[str, float], str | None]:
    """Scrape KAMIS with a single HTTP request and map rows to our seven markets."""
    prices: dict[str, float] = {}
    latest_date: str | None = None

    product_ids = resolve_crop_ids(crop)
    params: dict[str, int] = {"per_page": 100}
    if product_ids:
        params["product"] = product_ids[0]

    try:
        kamis_http_limiter.acquire()
        response = requests.get(KAMIS_URL, params=params, verify=False, timeout=20)
        if response.status_code != 200:
            return prices, latest_date
        tables = pd.read_html(io.StringIO(response.text))
        if not tables:
            return prices, latest_date
        df = tables[0]
        df.columns = [c.strip() for c in df.columns]
    except Exception:
        return prices, latest_date

    crop_lower = crop.lower()
    if "Commodity" in df.columns:
        df = df[df["Commodity"].str.contains(crop_lower, case=False, na=False)]

    for _, row in df.iterrows():
        canonical = _canonical_market(
            str(row.get("Market", "")),
            str(row.get("County", "")),
        )
        if not canonical:
            continue

        price = parse_price(str(row.get("Wholesale", ""))) or parse_price(
            str(row.get("Retail", ""))
        )
        if price is None:
            continue

        existing = prices.get(canonical)
        if existing is None or price > existing:
            prices[canonical] = price

        row_date = row.get("Date")
        if isinstance(row_date, str) and row_date:
            latest_date = row_date

    return prices, latest_date


def get_market_prices(crop: str = "maize") -> MarketMapResponse:
    """Return price table for the map — live KAMIS with mock fallback per market."""
    crop_key = crop.strip().lower()
    kamis_prices, kamis_date = _fetch_kamis_prices(crop_key)
    mock_prices = _MOCK_PRICES.get(crop_key, _MOCK_PRICES["maize"])

    merged: dict[str, float] = {}
    for name in _MARKET_LOCATIONS:
        merged[name] = kamis_prices.get(name, mock_prices[name])

    best_market = max(merged, key=merged.get)

    markets = [
        MarketPricePoint(
            name=name,
            lat=coords[0],
            lng=coords[1],
            price_kes=merged[name],
            recommended=(name == best_market),
        )
        for name, coords in _MARKET_LOCATIONS.items()
    ]

    return MarketMapResponse(
        crop=crop_key,
        date=kamis_date or date.today().isoformat(),
        markets=markets,
    )
