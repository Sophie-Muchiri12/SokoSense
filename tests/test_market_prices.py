"""Market map feed: real, recent CSV data only — no stale markets."""

from __future__ import annotations

from datetime import date, timedelta

import engines.market_prices as mp


def _row(market, county, wholesale, days_ago):
    return {
        "Commodity": "Tomatoes",
        "Market": market,
        "County": county,
        "Wholesale": wholesale,
        "Retail": "-",
        "Date": (date.today() - timedelta(days=days_ago)).isoformat(),
    }


def test_map_uses_latest_median_and_drops_stale_markets(monkeypatch):
    rows = [
        _row("Kangeta", "Meru", "30.00/Kg", 1),          # recent Meru
        _row("Maua", "Meru", "50.00/Kg", 1),             # same day -> median 40*90
        _row("Kangeta", "Meru", "99.00/Kg", 40),         # older, must not win
        _row("Kitale", "Trans Nzoia", "70.00/Kg", 200),  # stale (>90d) -> dropped
    ]
    monkeypatch.setattr(
        "data.market_csv.query_crop_history", lambda crop, max_rows=500: rows
    )
    result = mp.get_market_prices("tomatoes")
    names = {m.name: m.price_kes for m in result.markets}
    assert names == {"Meru": 40 * 90}
    assert result.date == (date.today() - timedelta(days=1)).isoformat()


def test_map_reads_real_csv_for_maize():
    result = mp.get_market_prices("maize")
    assert result.markets, "expected maize markets from data/market_prices.csv"
    # Newest maize report in the CSV drives the feed date.
    from data.market_csv import query_prices

    assert result.date == query_prices("maize", limit=1)[0]["Date"]
