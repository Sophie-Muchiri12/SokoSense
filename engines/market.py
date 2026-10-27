"""Market decision engine — latest prices + nearest better market."""

from datetime import datetime, timedelta, timezone

from models.common import truncate_sms
from models.market import MarketDecisionRequest, MarketDecisionResponse

# Farmer-facing sell-by window: today + a few days (never a past KAMIS report date).
SELL_BY_DAYS = 3


def parse_price(val: str | float | None) -> float | None:
    """Convert a KAMIS price string to KSh per 90kg bag (None if unparseable)."""
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


def _sell_by_dates() -> tuple[str, str]:
    """Return (ISO date, display date) for today + SELL_BY_DAYS."""
    target = datetime.now(timezone.utc).date() + timedelta(days=SELL_BY_DAYS)
    return target.isoformat(), target.strftime("%d %b %Y")


def _local_price_lead(
    crop: str,
    location: str,
    local: float | None,
    local_market: str | None = None,
) -> str:
    """Open the SMS with the farmer's own location price when known."""
    crop_label = crop.strip().title() or "Crop"
    place = location
    if local_market and _normalize_place(local_market) != _normalize_place(location):
        place = f"{location} ({local_market})"
    if local is None:
        return f"No local {crop_label} price for {location}."
    return f"{crop_label} in {place}: KSh {local:,.0f}/bag."


def _normalize_place(name: str) -> str:
    return " ".join(name.lower().replace("-", " ").split())


def _display_market(name: str) -> str:
    """Keep market labels readable without mangling '(County)' suffixes."""
    raw = (name or "").strip()
    if not raw:
        return raw
    if "(" in raw and raw.endswith(")"):
        main, _, rest = raw.partition("(")
        return f"{main.strip().title()} ({rest[:-1].strip().title()})"
    return raw.title()


def _build_short_reply(rec: dict, sell_by_display: str) -> str:
    """Farmer-facing SMS: local price first, then sell-by + market + profit."""
    crop = rec.get("crop") or "crop"
    location = (rec.get("location") or "").title()
    sell_market = _display_market(rec.get("sell_market") or location)
    by_date = f" by {sell_by_display}" if sell_by_display else ""
    local = rec.get("local_price_kes")
    sell_price = rec.get("sell_price_kes")
    profit = rec.get("profit_kes")
    dist = rec.get("distance_km")
    recommendation = rec.get("recommendation")
    lead = _local_price_lead(
        str(crop), location, local, rec.get("local_market")
    )

    if recommendation == "SELL_HERE" and sell_price is not None:
        return truncate_sms(
            f"{lead} Sell{by_date} at {sell_market} market — best nearby price. "
            f"No extra profit from travelling."
        )

    if recommendation == "SELL_IN_MARKET" and sell_price is not None:
        dist_bit = f" (~{dist:.0f} km)" if dist is not None else ""
        if profit is not None and local is not None:
            return truncate_sms(
                f"{lead} You can sell the produce{by_date} at {sell_market} market"
                f"{dist_bit} and get a profit of KSh {profit:,.0f}/bag "
                f"vs selling in {location}."
            )
        return truncate_sms(
            f"{lead} You can sell the produce{by_date} at the nearest market "
            f"{sell_market}{dist_bit} at KSh {sell_price:,.0f}/bag."
        )

    return truncate_sms(
        f"{lead} "
        + (
            rec.get("note")
            or "No recent market price data is available right now. Please try again later."
        )
    )


def decide_market(request: MarketDecisionRequest) -> MarketDecisionResponse:
    """Return where to sell from latest KAMIS data + distance."""
    crop = request.crop.strip().lower()
    location = request.location.strip().lower()
    sell_by_iso, sell_by_display = _sell_by_dates()

    try:
        from data.price_pipeline import recommend_nearest_sell

        rec = recommend_nearest_sell(crop, location)
    except Exception:
        rec = {
            "crop": crop,
            "location": location,
            "recommendation": "WAIT",
            "sell_market": None,
            "sell_price_kes": None,
            "local_price_kes": None,
            "profit_kes": None,
            "distance_km": None,
            "price_date": None,
            "price_date_display": None,
            "note": "No recent market price data is available right now.",
        }

    display_location = (rec.get("location") or location).title()
    sell_market = rec.get("sell_market")
    display_sell = _display_market(sell_market) if sell_market else display_location
    recommendation = rec.get("recommendation") or "WAIT"
    if recommendation not in ("SELL_HERE", "SELL_IN_MARKET", "WAIT"):
        recommendation = "WAIT"

    return MarketDecisionResponse(
        crop=crop,
        location=display_location,
        recommendation=recommendation,
        short_reply=_build_short_reply(rec, sell_by_display),
        market_name=display_location,
        best_market=display_sell if sell_market else None,
        local_price_kes=rec.get("local_price_kes"),
        best_price_kes=rec.get("sell_price_kes"),
        price_diff_kes=rec.get("profit_kes"),
        price_date=rec.get("price_date"),
        sell_by_date=sell_by_iso,
        distance_km=rec.get("distance_km"),
    )
