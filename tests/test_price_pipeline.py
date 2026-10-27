"""Tests for Wave 1 market price pipeline repairs."""

from __future__ import annotations

from data.price_pipeline import (
    MARKET_TO_COUNTY,
    _latest_wholesale_by_county,
    _resolve_tracked_county,
    get_live_prices,
    get_trend,
    nearest_market,
    normalize_county,
)


def test_normalize_county_hyphen_vs_space():
    assert normalize_county("Uasin-Gishu") == "Uasin Gishu"
    assert normalize_county("Uasin Gishu") == "Uasin Gishu"
    assert normalize_county("Trans-Nzoia") == "Trans Nzoia"
    assert normalize_county("  Taita-Taveta ") == "Taita Taveta"


def test_resolve_tracked_county_hyphenated():
    assert _resolve_tracked_county("Eldoret", "Uasin-Gishu") == "Uasin Gishu"
    assert _resolve_tracked_county("Kitale", "Trans-Nzoia") == "Trans Nzoia"
    assert _resolve_tracked_county("Wakulima", "Nyeri") == "Nyeri"
    assert _resolve_tracked_county("Unknown", "Meru") is None


def test_latest_wholesale_maps_hyphenated_eldoret():
    # Recent date (dynamic) so the >90-day staleness filter doesn't age out.
    from datetime import datetime, timezone

    recent = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rows = [
        {
            "Commodity": "Dry Maize",
            "Market": "Eldoret",
            "County": "Uasin-Gishu",
            "Wholesale": "45/Kg",
            "Retail": "50/Kg",
            "Date": recent,
        },
        {
            "Commodity": "Dry Maize",
            "Market": "Kitale",
            "County": "Trans Nzoia",
            "Wholesale": "40/Kg",
            "Retail": "48/Kg",
            "Date": recent,
        },
    ]
    latest = _latest_wholesale_by_county(rows)
    assert "Uasin Gishu" in latest
    assert "Trans Nzoia" in latest
    assert latest["Uasin Gishu"]["price"] == 45 * 90
    assert latest["Trans Nzoia"]["price"] == 40 * 90


def test_nearest_market_for_meru_when_nairobi_has_price(monkeypatch):
    monkeypatch.setattr(
        "data.price_pipeline.get_live_prices",
        lambda crop: {"nairobi": 5000.0, "nakuru": 4200.0, "nyeri": 4500.0},
    )
    result = nearest_market("maize", "Meru")
    assert result["has_local_price"] is False
    assert result["nearest_market"] in {"nyeri", "nairobi", "nakuru"}
    assert result["nearest_price"] is not None
    assert "No price for Meru" in result["note"]
    # Meru is closest to Nyeri among the priced markets above
    assert result["nearest_market"] == "nyeri"


def test_nearest_market_local_hit(monkeypatch):
    monkeypatch.setattr(
        "data.price_pipeline.get_live_prices",
        lambda crop: {"eldoret": 3900.0, "nairobi": 5000.0},
    )
    result = nearest_market("maize", "Uasin-Gishu")
    assert result["has_local_price"] is True
    assert result["nearest_market"] == "eldoret"
    assert result["nearest_price"] == 3900.0
    assert result["note"] == ""


def test_latest_wholesale_skips_stale_prices():
    rows = [
        {
            "Commodity": "Dry Maize",
            "Market": "Molo",
            "County": "Nakuru",
            "Wholesale": "40/Kg",
            "Retail": "-",
            "Date": "2025-05-23",  # older than MAX_PRICE_AGE_DAYS
        },
        {
            "Commodity": "Dry Maize",
            "Market": "Nairobi",
            "County": "Nairobi",
            "Wholesale": "50/Kg",
            "Retail": "-",
            "Date": "2026-09-20",
        },
    ]
    latest = _latest_wholesale_by_county(rows)
    assert "Nakuru" not in latest
    assert "Nairobi" in latest


def test_get_trend_for_non_focus_county_in_csv(monkeypatch):
    # Meru is not one of the seven focus markets, but its CSV rows must
    # still resolve a trend (regression: it used to say "no market found").
    from datetime import datetime, timedelta, timezone

    today = datetime.now(timezone.utc).replace(tzinfo=None)
    latest = today.strftime("%Y-%m-%d")
    earlier = (today - timedelta(days=14)).strftime("%Y-%m-%d")
    rows = [
        {"Commodity": "Tomatoes", "Market": "Maua", "County": "Meru",
         "Wholesale": "30.00/Kg", "Retail": "50.00/Kg", "Date": latest},
        {"Commodity": "Tomatoes", "Market": "Maua", "County": "Meru",
         "Wholesale": "20.00/Kg", "Retail": "40.00/Kg", "Date": earlier},
    ]
    monkeypatch.setattr("data.price_pipeline._fetch_kamis", lambda crop: rows)
    trend = get_trend("tomatoes", "meru")
    assert trend["price_kes"] == 30 * 90
    assert trend["kamis_date"] == latest
    assert trend["trend"] == "rising"


def test_get_live_prices_reads_price_cache_without_crash():
    # Smoke: must not raise (empty DB / missing crop → {}).
    prices = get_live_prices("maize")
    assert isinstance(prices, dict)
    for key in prices:
        assert key in MARKET_TO_COUNTY
