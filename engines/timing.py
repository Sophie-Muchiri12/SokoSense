"""Sell timing engine — uses live KAMIS wholesale prices and historical trend."""

from models.timing import TimingRequest, TimingResponse

_TREND_LABEL = {
    "rising": "RISING",
    "falling": "FALLING",
    "stable": "STABLE",
}


def decide_timing(request: TimingRequest) -> TimingResponse:
    """Return when to sell based on KAMIS wholesale price trend."""
    crop = request.crop.strip().lower()
    market = request.market.strip().lower()
    display_market = market.title()

    try:
        from data.price_pipeline import get_trend
        signal = get_trend(crop, market)
    except Exception:
        signal = {
            "price_kes": None,
            "kamis_date": None,
            "compare_date": None,
            "compare_price_kes": None,
            "trend": "stable",
            "pct_change": None,
            "wait_days": 0,
            "national_avg_kes": None,
            "data_source": "KAMIS cache (SQLite)",
        }

    price = signal.get("price_kes")
    trend = signal.get("trend", "stable")
    kamis_date = signal.get("kamis_date")
    pct = signal.get("pct_change")
    past_price = signal.get("compare_price_kes")
    compare_date = signal.get("compare_date")
    national_avg = signal.get("national_avg_kes")
    wait_days = signal.get("wait_days", 0)

    if price is None:
        recommendation = "WAIT"
        reason = "There is no market found in that area."
        short_reply = reason
        return TimingResponse(
            crop=crop,
            market=market,
            recommendation=recommendation,
            short_reply=short_reply[:320],
            wait_days=None,
            reason=reason,
            price_kes=None,
            trend=None,
            kamis_date=None,
        )

    trend_label = _TREND_LABEL.get(trend, "STABLE")

    if trend == "rising":
        recommendation = "WAIT"
        wait_days = wait_days or 7
        change = f"+{pct}%" if pct is not None else "up"
        reason = (
            f"KAMIS wholesale {display_market}: KSh {price:,.0f}/90kg bag ({kamis_date}). "
            f"Price is {change} vs {compare_date or '2 weeks ago'} "
            f"(was KSh {past_price:,.0f}/bag). Trend: {trend_label} — hold 7 days if you can."
        )
    elif trend == "falling":
        recommendation = "SELL_TODAY"
        wait_days = None
        change = f"{pct}%" if pct is not None else "down"
        reason = (
            f"KAMIS wholesale {display_market}: KSh {price:,.0f}/90kg bag ({kamis_date}). "
            f"Price is {change} vs {compare_date or '2 weeks ago'} "
            f"(was KSh {past_price:,.0f}/bag). Trend: {trend_label} — sell today."
        )
    else:
        recommendation = "SELL_TODAY"
        wait_days = None
        if pct is not None and past_price is not None:
            trend_detail = (
                f"Price flat ({pct:+.1f}% vs {compare_date}, was KSh {past_price:,.0f}/bag). "
            )
        else:
            trend_detail = "Price stable over recent KAMIS reports. "
        avg_note = (
            f"National KAMIS avg: KSh {national_avg:,.0f}/bag. "
            if national_avg
            else ""
        )
        reason = (
            f"KAMIS wholesale {display_market}: KSh {price:,.0f}/90kg bag ({kamis_date}). "
            f"{trend_detail}{avg_note}Trend: {trend_label} — reasonable to sell today."
        )

    short_reply = (
        f"{'WAIT' if recommendation == 'WAIT' else 'SELL TODAY'}. "
        f"{display_market} KSh {price:,.0f}/bag (KAMIS {kamis_date}). {trend_label}."
    )

    return TimingResponse(
        crop=crop,
        market=market,
        recommendation=recommendation,
        short_reply=short_reply[:320],
        wait_days=wait_days if recommendation == "WAIT" else None,
        reason=reason,
        price_kes=price,
        trend=trend,
        kamis_date=kamis_date,
        data_source=signal.get("data_source", "KAMIS cache (SQLite)"),
    )
