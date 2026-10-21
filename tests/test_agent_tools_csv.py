"""The LLM agent's price tool must read the market CSV (not KAMIS live).

Regression: engines/agent/tools.py delegated to engines/kamis_tool, whose
top-level imports (`kamis_http_limiter`, price-fallback chain) no longer
existed, so every SMS-simulator price query crashed with ImportError.
"""

from __future__ import annotations

import json


def test_agent_price_tool_returns_csv_rows_for_tomato_meru():
    from engines.agent.tools import scrape_kamis_prices

    out = json.loads(
        scrape_kamis_prices.invoke(
            {"crop_name": "tomato", "county_name": "Meru", "limit": 5}
        )
    )
    assert out["status"] == "ok"
    assert out["tool"] == "scrape_kamis_prices"
    rows = out["data"]
    assert rows, "expected tomato rows for Meru from data/market_prices.csv"
    assert all(r["County"] == "Meru" for r in rows)
    assert all("Tomato" in r["Commodity"] for r in rows)


def test_kamis_tool_imports_without_live_fallback_deps():
    # Importing the CSV tool must not require the live-KAMIS fallback chain.
    import engines.kamis_tool as kt

    assert callable(kt.fetch_csv_prices)
    text = kt.fetch_csv_prices("tomato", county_name="Meru", limit=2)
    rows = json.loads(text)
    assert rows and rows[0]["County"] == "Meru"
