"""Sell timing engine — Job replaces stub with get_trend() from Lucy's Neo4j module."""

from models.timing import TimingRequest, TimingResponse


def decide_timing(request: TimingRequest) -> TimingResponse:
    """Return when to sell. Stub returns Wanjiku-style wait advice."""
    crop = request.crop.strip().lower()
    market = request.market.strip().title()

    # Stub: rising trend → wait; Job calls Lucy's get_trend(crop, market)
    short_reply = f"WAIT 3 DAYS. Peak demand in 3 days. {crop.title()} price still rising in {market}."
    return TimingResponse(
        crop=crop,
        market=market,
        recommendation="WAIT",
        short_reply=short_reply,
        wait_days=3,
        reason="Weekly price trend is positive; harvest glut easing in 3 days.",
    )
