"""USE_LIVE toggles portal fetch with CSV fallback."""

from data.kamis_collect import use_live_kamis
from data.price_pipeline import _fetch_kamis


def test_use_live_flag_parses_truthy(monkeypatch):
    monkeypatch.setenv("USE_LIVE", "true")
    assert use_live_kamis() is True
    monkeypatch.setenv("USE_LIVE", "0")
    assert use_live_kamis() is False


def test_fetch_kamis_uses_live_when_enabled(monkeypatch):
    live_rows = [
        {
            "Commodity": "Tomatoes",
            "Market": "Chebunyo",
            "County": "Bomet",
            "Wholesale": "75.00/Kg",
            "Retail": "100.00/Kg",
            "Date": "2026-10-26",
        }
    ]
    monkeypatch.setenv("USE_LIVE", "true")
    monkeypatch.setattr(
        "data.kamis_collect.fetch_live_crop_rows", lambda crop, **kwargs: live_rows
    )
    # Clear any prior live cache for this crop
    from data import price_pipeline as pp

    pp._live_row_cache.clear()

    rows = _fetch_kamis("tomatoes")
    assert rows == live_rows


def test_fetch_kamis_falls_back_to_csv_when_live_empty(monkeypatch):
    csv_rows = [
        {
            "Commodity": "Tomatoes",
            "Market": "Chebunyo",
            "County": "Bomet",
            "Wholesale": "75.00/Kg",
            "Retail": "100.00/Kg",
            "Date": "2026-10-26",
        }
    ]
    monkeypatch.setenv("USE_LIVE", "true")
    monkeypatch.setattr(
        "data.kamis_collect.fetch_live_crop_rows", lambda crop, **kwargs: []
    )
    monkeypatch.setattr(
        "data.market_csv.query_crop_history",
        lambda crop, max_rows=8000, prefer_counties=None: csv_rows,
    )
    from data import price_pipeline as pp

    pp._live_row_cache.clear()

    rows = _fetch_kamis("tomatoes")
    assert rows == csv_rows
