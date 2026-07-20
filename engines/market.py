"""Market decision engine — compares prices from the cached KAMIS SQLite data."""

from models.market import MarketDecisionRequest, MarketDecisionResponse

_PRICE_DIFF_THRESHOLD = 0.08  # 8% minimum to recommend travel


def parse_price(val: str | float | None) -> float | None:
    """Convert KAMIS price string to KSh per 90kg bag."""
    if val is None or str(val).strip() in ("-", "", "nan"):
        return None
    try:
        cleaned = "".join(c for c in str(val) if c.isdigit() or c == ".")
        if not cleaned:
            return None
        price = float(cleaned)
        # KAMIS reports per KG — convert to 90kg bag
        if price < 500:
            price = price * 90
        return round(price, 0)
    except (ValueError, TypeError):
        return None


def decide_market(request: MarketDecisionRequest) -> MarketDecisionResponse:
    """Return where to sell based on cached KAMIS market data."""
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

    # ── 3. Handle missing market data ─────────────────────────────────────
    if not live_prices or best_market is None or best_price is None:
        return MarketDecisionResponse(
            crop=crop,
            location=location.title(),
            recommendation="WAIT",
            short_reply=(
                "No cached market price data is available right now. "
                "Please try again after the next background sync."
            ),
            market_name=location.title(),
            best_market=None,
            local_price_kes=None,
            best_price_kes=None,
            price_diff_kes=None,
        )

    if local_price is None:
        return MarketDecisionResponse(
            crop=crop,
            location=location.title(),
            recommendation="WAIT",
            short_reply="There is no market found in that area.",
            market_name=location.title(),
            best_market=best_market.title(),
            local_price_kes=None,
            best_price_kes=best_price,
            price_diff_kes=None,
        )

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
