"""Nearest-market sell recommendation (distance + profit vs local)."""

from datetime import datetime, timedelta, timezone

from data.price_pipeline import recommend_nearest_sell
from engines.market import SELL_BY_DAYS, decide_market
from models.market import MarketDecisionRequest


def test_local_best_recommends_sell_here(monkeypatch):
    quotes = [
        {
            "market": "Chebunyo",
            "county": "Bomet",
            "price_kes": 6750.0,
            "date": "2026-10-26",
            "coords": (-0.7813, 35.3416),
        },
        {
            "market": "Ngurubani Market",
            "county": "Kirinyaga",
            "price_kes": 3375.0,
            "date": "2026-10-26",
            "coords": (-0.6591, 37.3827),
        },
    ]
    monkeypatch.setattr(
        "data.price_pipeline._latest_market_quotes", lambda crop, max_age_days=14: quotes
    )

    rec = recommend_nearest_sell("tomatoes", "bomet")
    assert rec["recommendation"] == "SELL_HERE"
    assert rec["local_price_kes"] == 6750.0
    assert rec["profit_kes"] == 0.0

    decision = decide_market(MarketDecisionRequest(crop="tomatoes", location="bomet"))
    assert decision.recommendation == "SELL_HERE"
    assert "KSh 6,750/bag" in decision.short_reply
    expected = (datetime.now(timezone.utc).date() + timedelta(days=SELL_BY_DAYS)).isoformat()
    assert decision.sell_by_date == expected


def test_nearest_better_named_market_not_county_median(monkeypatch):
    # Muhoroni is nearer to Bomet than Kibuye; both beat local Chebunyo.
    # Must pick Muhoroni at its real wholesale — not a Kisumu county median.
    quotes = [
        {
            "market": "Chebunyo",
            "county": "Bomet",
            "price_kes": 6750.0,
            "date": "2026-10-26",
            "coords": (-0.8500, 35.2200),
        },
        {
            "market": "Muhoroni",
            "county": "Kisumu",
            "price_kes": 8229.0,
            "date": "2026-10-25",
            "coords": (-0.1550, 35.1980),
        },
        {
            "market": "Kibuye",
            "county": "Kisumu",
            "price_kes": 12857.0,
            "date": "2026-10-25",
            "coords": (-0.0910, 34.7680),
        },
        {
            "market": "Eldoret Main",
            "county": "Uasin Gishu",
            "price_kes": 9000.0,
            "date": "2026-10-26",
            "coords": (0.5143, 35.2698),
        },
    ]
    monkeypatch.setattr(
        "data.price_pipeline._latest_market_quotes", lambda crop, max_age_days=14: quotes
    )

    rec = recommend_nearest_sell("tomatoes", "bomet")
    assert rec["recommendation"] == "SELL_IN_MARKET"
    assert "Muhoroni" in rec["sell_market"]
    assert rec["sell_price_kes"] == 8229.0
    assert rec["profit_kes"] == 1479.0
    assert rec["distance_km"] is not None

    decision = decide_market(MarketDecisionRequest(crop="tomatoes", location="bomet"))
    assert "Chebunyo" in decision.short_reply or "Bomet" in decision.short_reply
    assert "6,750" in decision.short_reply
    assert "Muhoroni" in decision.short_reply
    assert "1,479" in decision.short_reply
    assert "10,543" not in decision.short_reply  # old false county median
