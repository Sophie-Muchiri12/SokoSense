"""Sell timing engine — uses live KAMIS data via price pipeline, falls back to stable signal."""

from models.timing import TimingRequest, TimingResponse


def decide_timing(request: TimingRequest) -> TimingResponse:
    """Return when to sell. Uses cross-market price variance from live KAMIS data."""
    crop   = request.crop.strip().lower()
    market = request.market.strip().lower()

    # ── 1. Fetch live prices ──────────────────────────────────────────────
    prices: dict[str, float] = {}
    try:
        from data.price_pipeline import get_live_prices
        prices = get_live_prices(crop)
    except Exception:
        pass

    # ── 2. Derive trend from cross-market variance ────────────────────────
    recommendation = "WAIT"
    wait_days      = 3
    action         = "HOLD"
    reason         = "Trend: STABLE/RISING. Peak demand in 3 days. Sellers: HOLD for 3 days. Buyers: HOLD/WAIT."

    if prices:
        market_price = prices.get(market)
        avg_price    = sum(prices.values()) / len(prices)
        best_market  = max(prices, key=prices.get)
        best_price   = prices[best_market]

        if market_price is None:
            # Farmer's market not in live data — compare best vs average
            diff = best_price - avg_price
            if diff > avg_price * 0.05:
                recommendation = "WAIT"
                wait_days      = 3
                action         = "HOLD/BUY"
                reason = (
                    f"Trend: RISING. "
                    f"Sellers: HOLD — {best_market.title()} paying KSh {best_price:,.0f}/bag. "
                    f"Buyers: BUY today before prices rise further."
                )
            else:
                recommendation = "SELL_TODAY"
                wait_days      = None
                action         = "SELL/BUY"
                reason = (
                    f"Trend: STABLE. "
                    f"Sellers: SELL today at KSh {avg_price:,.0f}/bag avg. "
                    f"Buyers: BUY or HOLD depending on immediate needs."
                )
        else:
            diff = market_price - avg_price

            if diff < -avg_price * 0.05:
                # Local price below average — prices likely to rise here
                recommendation = "WAIT"
                wait_days      = 3
                action         = "HOLD/BUY"
                reason = (
                    f"Trend: RISING. "
                    f"Sellers: HOLD (prices up KSh {abs(diff):,.0f}/bag vs avg). "
                    f"Buyers: BUY today before prices rise further."
                )
            elif diff > avg_price * 0.05:
                # Local price above average — already at peak, sell now
                recommendation = "SELL_TODAY"
                wait_days      = None
                action         = "SELL/HOLD"
                reason = (
                    f"Trend: FALLING. "
                    f"Sellers: SELL today — {market.title()} at KSh {market_price:,.0f}/bag, above avg KSh {avg_price:,.0f}. "
                    f"Buyers: HOLD/WAIT for prices to drop."
                )
            else:
                recommendation = "SELL_TODAY"
                wait_days      = None
                action         = "SELL/BUY"
                reason = (
                    f"Trend: STABLE. "
                    f"Sellers: SELL today to lock in KSh {market_price:,.0f}/bag. "
                    f"Buyers: BUY or HOLD depending on immediate needs."
                )

    short_reply = f"{action}. {reason}"

    return TimingResponse(
        crop=crop,
        market=market,
        recommendation=recommendation,
        short_reply=short_reply[:320],
        wait_days=wait_days if recommendation == "WAIT" else None,
        reason=reason,
    )
