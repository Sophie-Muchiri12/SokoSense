"""Market decision engine — Job replaces stub logic with KACE/KAMIS rules."""

from models.market import MarketDecisionRequest, MarketDecisionResponse

# Mock prices per 90kg bag (KSh) — replaced by live KACE data
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
}

_MARKET_COORDS = {
    "nairobi": "Nairobi",
    "nakuru": "Nakuru",
    "eldoret": "Eldoret",
    "kisumu": "Kisumu",
    "mombasa": "Mombasa",
    "kitale": "Kitale",
    "nyeri": "Nyeri",
}

_PRICE_DIFF_THRESHOLD = 0.08  # 8% minimum to recommend travel


def _normalize_location(location: str) -> str:
    key = location.strip().lower()
    return _MARKET_COORDS.get(key, location.strip().title())


def decide_market(request: MarketDecisionRequest) -> MarketDecisionResponse:
    """Return where to sell. Stub uses mock prices; Job wires KACE + 8–15% threshold."""
    crop = request.crop.strip().lower()
    location = _normalize_location(request.location)

    prices = _MOCK_PRICES.get(crop, _MOCK_PRICES["maize"])
    local_price = prices.get(location, prices["Nakuru"])
    best_market = max(prices, key=prices.get)
    best_price = prices[best_market]

    if best_market == location:
        short_reply = f"SELL HERE. {location} has the best price at KSh {local_price:,.0f}/bag today."
        return MarketDecisionResponse(
            crop=crop,
            location=location,
            recommendation="SELL_HERE",
            short_reply=short_reply,
            market_name=location,
            best_market=location,
            local_price_kes=local_price,
            best_price_kes=local_price,
            price_diff_kes=0,
        )

    diff = best_price - local_price
    pct = diff / local_price if local_price else 0

    if pct >= _PRICE_DIFF_THRESHOLD:
        short_reply = (
            f"SELL IN {best_market.upper()}. KSh {diff:,.0f} more per bag. Worth the trip."
        )
        return MarketDecisionResponse(
            crop=crop,
            location=location,
            recommendation="SELL_IN_MARKET",
            short_reply=short_reply,
            market_name=location,
            best_market=best_market,
            local_price_kes=local_price,
            best_price_kes=best_price,
            price_diff_kes=diff,
        )

    short_reply = f"WAIT. Local price at {location} is competitive. No better market nearby today."
    return MarketDecisionResponse(
        crop=crop,
        location=location,
        recommendation="WAIT",
        short_reply=short_reply,
        market_name=location,
        best_market=best_market,
        local_price_kes=local_price,
        best_price_kes=best_price,
        price_diff_kes=diff,
    )
