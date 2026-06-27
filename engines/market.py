"""Market decision engine — uses live KAMIS data via price pipeline, falls back to mock."""

from models.market import MarketDecisionRequest, MarketDecisionResponse

# ---------------------------------------------------------------------------
# MOCK FALLBACK PRICES per 90kg bag (KSh)
# Used only when live KAMIS data is unavailable
# ---------------------------------------------------------------------------

_MOCK_PRICES: dict[str, dict[str, float]] = {
    "maize":    {"nairobi": 3200, "nakuru": 2900, "eldoret": 3500, "kisumu": 3100, "mombasa": 3300, "kitale": 3400, "nyeri": 3000},
    "beans":    {"nairobi": 8500, "nakuru": 8200, "eldoret": 9100, "kisumu": 8400, "mombasa": 8600, "kitale": 9000, "nyeri": 8300},
    "sorghum":  {"nairobi": 4500, "nakuru": 4300, "eldoret": 4800, "kisumu": 4400, "mombasa": 4600, "kitale": 4700, "nyeri": 4350},
    "millet":   {"nairobi": 5200, "nakuru": 5000, "eldoret": 5500, "kisumu": 5100, "mombasa": 5300, "kitale": 5450, "nyeri": 5050},
    "potatoes": {"nairobi": 2800, "nakuru": 2600, "eldoret": 3100, "kisumu": 2700, "mombasa": 2900, "kitale": 3000, "nyeri": 2650},
    "tomatoes": {"nairobi": 6500, "nakuru": 6200, "eldoret": 7000, "kisumu": 6400, "mombasa": 6600, "kitale": 6800, "nyeri": 6300},
}

_PRICE_DIFF_THRESHOLD = 0.08  # 8% minimum to recommend travel


def parse_price(val) -> float | None:
    """Convert a KAMIS price string to KSh per 90kg bag (None if unparseable)."""
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


def decide_market(request: MarketDecisionRequest) -> MarketDecisionResponse:
    """Return where to sell. Live KAMIS data first, mock fallback if unavailable."""
    crop     = request.crop.strip().lower()
    location = request.location.strip().lower()

    # ── 1. Try live prices from pipeline ─────────────────────────────────
    live_prices: dict[str, float] = {}
    try:
        from data.price_pipeline import get_live_prices
        live_prices = get_live_prices(crop)
    except Exception:
        pass

    # ── 2. Extract local + best from live data ────────────────────────────
    local_price: float | None = None
    best_market: str | None   = None
    best_price:  float | None = None

    if live_prices:
        local_price = live_prices.get(location)
        best_market = max(live_prices, key=live_prices.get)
        best_price  = live_prices[best_market]

    # ── 3. Fallback to mock if live data missing ──────────────────────────
    if local_price is None or best_price is None:
        mock = _MOCK_PRICES.get(crop, _MOCK_PRICES["maize"])
        local_price = mock.get(location, list(mock.values())[0])
        best_market = max(mock, key=mock.get)
        best_price  = mock[best_market]

    # ── 4. Decision ───────────────────────────────────────────────────────
    display_location = location.title()
    display_best     = best_market.title() if best_market else display_location

    if best_market == location or best_price <= local_price:
        return MarketDecisionResponse(
            crop=crop,
            location=display_location,
            recommendation="SELL_HERE",
            short_reply=f"SELL HERE. {display_location} has the best price at KSh {local_price:,.0f}/bag today.",
            market_name=display_location,
            best_market=display_location,
            local_price_kes=local_price,
            best_price_kes=local_price,
            price_diff_kes=0,
        )

    diff = best_price - local_price
    pct  = diff / local_price if local_price else 0

    if pct >= _PRICE_DIFF_THRESHOLD:
        return MarketDecisionResponse(
            crop=crop,
            location=display_location,
            recommendation="SELL_IN_MARKET",
            short_reply=f"SELL IN {display_best.upper()}. KSh {diff:,.0f} more per bag. Worth the trip.",
            market_name=display_location,
            best_market=display_best,
            local_price_kes=local_price,
            best_price_kes=best_price,
            price_diff_kes=diff,
        )

    return MarketDecisionResponse(
        crop=crop,
        location=display_location,
        recommendation="WAIT",
        short_reply=f"WAIT. {display_location} price is competitive at KSh {local_price:,.0f}/bag. No better market today.",
        market_name=display_location,
        best_market=display_best,
        local_price_kes=local_price,
        best_price_kes=best_price,
        price_diff_kes=diff,
    )
