"""Market map price feed — reads from the KAMIS market CSV."""

from datetime import date, timedelta

from engines.market import parse_price
from models.market_map import MarketMapResponse, MarketPricePoint

# A market only appears on the map when its newest CSV report is this
# recent — older rows (the CSV keeps 10 per market, some years old) must
# not be presented as current prices. Mirrors price_pipeline's rule.
MAX_PRICE_AGE_DAYS = 90

# GPS coords for Leaflet map markers
_MARKET_LOCATIONS: dict[str, tuple[float, float]] = {
    "Nairobi": (-1.2864, 36.8172),
    "Nakuru": (-0.3031, 36.0800),
    "Eldoret": (0.5143, 35.2698),
    "Kisumu": (-0.1022, 34.7617),
    "Mombasa": (-4.0435, 39.6682),
    "Kitale": (1.0167, 35.0000),
    "Nyeri": (-0.4197, 36.9475),
    "Meru": (0.0467, 37.6556),
    "Kakamega": (0.2827, 34.7519),
}

_MARKET_ALIASES: dict[str, str] = {
    "nairobi": "Nairobi",
    "nakuru": "Nakuru",
    "eldoret": "Eldoret",
    "uasin gishu": "Eldoret",
    "uasin-gishu": "Eldoret",
    "kisumu": "Kisumu",
    "mombasa": "Mombasa",
    "kitale": "Kitale",
    "trans-nzoia": "Kitale",
    "trans nzoia": "Kitale",
    "nyeri": "Nyeri",
    "meru": "Meru",
    "kakamega": "Kakamega",
}


def _canonical_market(market: str, county: str) -> str | None:
    """Map a KAMIS market/county label to one of our tracked map markets."""
    # Normalise hyphens so "Uasin-Gishu" matches "uasin gishu".
    haystack = f"{market} {county}".lower().replace("-", " ").replace("_", " ")
    for alias, canonical in _MARKET_ALIASES.items():
        if alias.replace("-", " ") in haystack:
            return canonical
    for name in _MARKET_LOCATIONS:
        if name.lower() in haystack:
            return name
    return None


def _fetch_csv_prices(crop: str) -> tuple[dict[str, float], str | None]:
    """Read KAMIS rows from the market CSV and map them to tracked markets.

    Each market's price is the median of its rows on its most recent report
    date (not the highest price ever seen). Markets whose newest report is
    older than MAX_PRICE_AGE_DAYS are dropped — they are not recent data —
    and the returned date is the newest date among the markets shown.
    All CSV rows for the crop are considered (not just the newest 500
    globally, which crowded out slower-reporting markets).
    """
    prices: dict[str, float] = {}
    latest_date: str | None = None
    by_market_date: dict[str, dict[str, list[float]]] = {}

    try:
        from data.market_csv import query_crop_history

        rows = query_crop_history(crop, max_rows=100_000)
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

        row_date = row.get("Date")
        if not isinstance(row_date, str) or not row_date:
            continue
        by_market_date.setdefault(canonical, {}).setdefault(row_date, []).append(price)

    cutoff = (date.today() - timedelta(days=MAX_PRICE_AGE_DAYS)).isoformat()
    for canonical, by_date in by_market_date.items():
        newest = max(by_date)
        if newest < cutoff:
            continue  # stale — not recent data, keep it off the map
        if latest_date is None or newest > latest_date:
            latest_date = newest
        day_prices = sorted(by_date[newest])
        mid = len(day_prices) // 2
        prices[canonical] = (
            day_prices[mid]
            if len(day_prices) % 2
            else (day_prices[mid - 1] + day_prices[mid]) / 2
        )

    return prices, latest_date


def get_market_prices(crop: str = "maize") -> MarketMapResponse:
    """Return price table for the map from the market CSV."""
    crop_key = crop.strip().lower()
    db_prices, db_date = _fetch_csv_prices(crop_key)
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
