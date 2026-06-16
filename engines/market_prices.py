from datetime import date

from models.market_map import MarketMapResponse, MarketPricePoint

# GPS coords for Ian's Leaflet map
_MARKET_LOCATIONS: dict[str, tuple[float, float]] = {
    "Nairobi": (-1.2864, 36.8172),
    "Nakuru": (-0.3031, 36.0800),
    "Eldoret": (0.5143, 35.2698),
    "Kisumu": (-0.1022, 34.7617),
    "Mombasa": (-4.0435, 39.6682),
    "Kitale": (1.0167, 35.0000),
    "Nyeri": (-0.4197, 36.9475),
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


def get_market_prices(crop: str = "maize") -> MarketMapResponse:
    """Return price table for map. Stub data until Job/Lucy wire live KACE/Neo4j."""
    crop_key = crop.strip().lower()
    prices = _MOCK_PRICES.get(crop_key, _MOCK_PRICES["maize"])
    best_market = max(prices, key=prices.get)

    markets = [
        MarketPricePoint(
            name=name,
            lat=coords[0],
            lng=coords[1],
            price_kes=price,
            recommended=(name == best_market),
        )
        for name, coords in _MARKET_LOCATIONS.items()
        for price in [prices[name]]
    ]

    return MarketMapResponse(
        crop=crop_key,
        date=date.today().isoformat(),
        markets=markets,
    )
