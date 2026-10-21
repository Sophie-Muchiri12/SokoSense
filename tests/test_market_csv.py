"""Tests for the CSV market-data store and collection pipeline merge."""

from __future__ import annotations

import pytest

from data import kamis_collect, market_csv


def _row(commodity="Dry Maize", market="Kakamega Town", county="Kakamega", date="2026-09-01", wholesale="40/Kg"):
    return {
        "product_id": 1,
        "commodity": commodity,
        "market": market,
        "county": county,
        "wholesale_raw": wholesale,
        "retail_raw": "60/Kg",
        "wholesale_kes_90kg": 3600.0,
        "retail_kes_90kg": 5400.0,
        "date_reported": date,
        "fetched_at": "2026-09-30T00:00:00+00:00",
    }


@pytest.fixture()
def csv_file(tmp_path, monkeypatch):
    path = tmp_path / "market_prices.csv"
    monkeypatch.setenv("MARKET_CSV_PATH", str(path))
    return path


def test_trim_recent_keeps_top_10_per_market_by_date():
    rows = [_row(date=f"2026-09-{d:02d}") for d in range(1, 16)]  # 15 rows, one market
    rows += [_row(market="Mumias", date="2026-08-01")]  # different market: kept separately
    trimmed = market_csv.trim_recent(rows)
    kakamega = [r for r in trimmed if r["market"] == "Kakamega Town"]
    assert len(kakamega) == 10
    assert kakamega[0]["date_reported"] == "2026-09-15"  # newest first
    assert kakamega[-1]["date_reported"] == "2026-09-06"
    assert len([r for r in trimmed if r["market"] == "Mumias"]) == 1


def test_write_atomic_replaces_old_and_queries_read_new(csv_file):
    market_csv.write_rows_atomic([_row(date="2026-09-01")])
    assert market_csv.status()["rows"] == 1

    market_csv.write_rows_atomic([_row(date="2026-09-02"), _row(date="2026-09-03", market="Mumias")])
    status = market_csv.status()
    assert status["rows"] == 2
    assert status["latest_date_reported"] == "2026-09-03"
    # no staging leftovers next to the active file
    assert [p.name for p in csv_file.parent.iterdir()] == ["market_prices.csv"]

    rows = market_csv.query_crop_history("maize")
    assert rows[0]["Commodity"] == "Dry Maize"
    assert rows[0]["Date"] == "2026-09-03"

    prices = market_csv.query_prices(crop_name="maize", county_name="kakamega", limit=1)
    assert len(prices) == 1


def test_write_atomic_refuses_empty(csv_file):
    market_csv.write_rows_atomic([_row()])
    with pytest.raises(ValueError):
        market_csv.write_rows_atomic([])
    assert market_csv.status()["rows"] == 1  # old file untouched


def test_single_commodity_run_merges_and_failed_run_keeps_old(csv_file, monkeypatch):
    market_csv.write_rows_atomic(
        [_row(), _row(commodity="Tomatoes", market="Eldoret", county="Uasin Gishu", date="2026-09-01")]
    )
    catalogue = [
        {"product_id": 1, "commodity": "Dry Maize"},
        {"product_id": 61, "commodity": "Tomatoes"},
    ]
    monkeypatch.setattr(kamis_collect, "discover_products", lambda: catalogue)
    monkeypatch.setattr(
        kamis_collect,
        "fetch_rows_for_product",
        lambda pid, fetched_at, per_page=1500: [
            _row(date="2026-10-01"), _row(date="2026-10-02")
        ],
    )

    stats = kamis_collect.run_pipeline(commodity="maize", delay_seconds=0)
    assert stats["mode"] == "commodity"
    rows = market_csv.read_rows()
    commodities = {r["commodity"] for r in rows}
    assert commodities == {"Dry Maize", "Tomatoes"}  # tomatoes untouched
    assert max(r["date_reported"] for r in rows if r["commodity"] == "Dry Maize") == "2026-10-02"

    # A run that fetches nothing must not touch the active CSV.
    monkeypatch.setattr(kamis_collect, "fetch_rows_for_product", lambda *a, **k: [])
    with pytest.raises(RuntimeError):
        kamis_collect.run_pipeline(commodity="maize", delay_seconds=0)
    assert market_csv.status()["rows"] == len(rows)


def test_full_run_rebuilds_csv(csv_file, monkeypatch):
    market_csv.write_rows_atomic([_row(commodity="Old Crop")])
    monkeypatch.setattr(
        kamis_collect, "discover_products", lambda: [{"product_id": 61, "commodity": "Tomatoes"}]
    )
    monkeypatch.setattr(
        kamis_collect,
        "fetch_rows_for_product",
        lambda pid, fetched_at, per_page=1500: [
            _row(commodity="Tomatoes", market="Eldoret", county="Uasin Gishu")
        ],
    )
    stats = kamis_collect.run_pipeline(delay_seconds=0)
    assert stats["mode"] == "full"
    assert {r["commodity"] for r in market_csv.read_rows()} == {"Tomatoes"}
