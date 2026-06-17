"""Market decision engine — Job replaces stub logic with live KAMIS rules."""

import json
from models.market import MarketDecisionRequest, MarketDecisionResponse
from kamis_tool import scrape_kamis_prices

# Mock prices per 90kg bag (KSh) — fallback if live KAMIS data is unavailable
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


def parse_price(val: str) -> float | None:
    if not val or val == "-":
        return None
    try:
        cleaned = "".join(c for c in val if c.isdigit() or c == ".")
        if cleaned:
            price = float(cleaned)
            # If unit is per Kg (usually < 500 KSh), convert to 90kg bag
            if price < 500:
                price *= 90
            return price
    except Exception:
        pass
    return None


def decide_market(request: MarketDecisionRequest) -> MarketDecisionResponse:
    """Return where to sell. Uses live KAMIS price scraping and falls back to mock data."""
    crop = request.crop.strip().lower()
    location = _normalize_location(request.location)

    # 1. Try to scrape live prices from KAMIS
    live_prices = {}
    try:
        scrape_res = scrape_kamis_prices.invoke({"crop_name": crop})
        if scrape_res.strip().startswith("["):
            price_entries = json.loads(scrape_res)
            for entry in price_entries:
                mkt = entry.get("Market", "")
                cty = entry.get("County", "")
                mkt_norm = _normalize_location(mkt)
                cty_norm = _normalize_location(cty)

                price = parse_price(entry.get("Wholesale")) or parse_price(entry.get("Retail"))
                if price is not None:
                    # Store by market and county normalizations
                    if mkt_norm not in live_prices:
                        live_prices[mkt_norm] = price
                    if cty_norm not in live_prices:
                        live_prices[cty_norm] = price
    except Exception:
        pass

    # 2. Extract local and best prices
    local_price = None
    best_market = None
    best_price = None

    if live_prices:
        local_price = live_prices.get(location)
        # Find maximum price in the live prices dictionary
        best_market = max(live_prices, key=live_prices.get)
        best_price = live_prices[best_market]

    # 3. Fallback to mock prices if live data doesn't have local price or best price
    if local_price is None or best_price is None:
        prices = _MOCK_PRICES.get(crop, _MOCK_PRICES["maize"])
        local_price = prices.get(location, prices.get("Nakuru", 3200))
        best_market = max(prices, key=prices.get)
        best_price = prices[best_market]

    # 4. Make decision
    if best_market == location or best_price <= local_price:
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
