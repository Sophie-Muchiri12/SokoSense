"""Market map price feed — reads from local KAMIS SQLite cache."""

from datetime import date

from engines.market import parse_price
from models.market_map import MarketMapResponse, MarketPricePoint

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


def _fetch_db_prices(crop: str) -> tuple[dict[str, float], str | None]:
    """Read cached KAMIS rows and map them to our seven markets."""
    prices: dict[str, float] = {}
    latest_date: str | None = None

    try:
        from data.market_db import init_db, query_crop_history

        init_db()
        rows = query_crop_history(crop, max_rows=500)
    except Exception:
        return prices, latest_date

    for row in rows:
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
    """Return price table for the map from SQLite cache only."""
    crop_key = crop.strip().lower()
    db_prices, db_date = _fetch_db_prices(crop_key)
    if not db_prices:
        return MarketMapResponse(
            crop=crop_key,
            date=db_date or date.today().isoformat(),
            markets=[],
        )

    best_market = max(db_prices, key=db_prices.get)

    markets = [
        MarketPricePoint(
            name=name,
            lat=coords[0],
            lng=coords[1],
            price_kes=db_prices[name],
            recommended=(name == best_market),
        )
        for name, coords in _MARKET_LOCATIONS.items()
        if name in db_prices
    ]

    return MarketMapResponse(
        crop=crop_key,
        date=db_date or date.today().isoformat(),
        markets=markets,
    )
