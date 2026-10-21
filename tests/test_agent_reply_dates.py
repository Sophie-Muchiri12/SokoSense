"""Farmer-facing commodity price replies must not quote report dates."""

from __future__ import annotations

from routes.agent import _format_kamis_rows_deterministic, _strip_price_dates


def test_deterministic_price_reply_has_no_date():
    rows = [
        {"Commodity": "Tomatoes", "Market": "Kangeta", "County": "Meru",
         "Wholesale": "30.00/Kg", "Retail": "40.00/Kg", "Date": "2026-09-30"},
    ]
    reply = _format_kamis_rows_deterministic(rows)
    assert "2026" not in reply and "As of" not in reply
    assert "Kangeta" in reply and "30.00/Kg" in reply


def test_strip_price_dates_iso_and_long_forms():
    assert "2026" not in _strip_price_dates(
        "Tomatoes (Kangeta): wholesale KSh 30.00/Kg (2026-09-30)."
    )
    assert "September" not in _strip_price_dates(
        "Maize in Kakamega is Ksh 44.44/kg as of 30 September 2026."
    )
    assert "Sept" not in _strip_price_dates(
        "Maize is Ksh 44.44/kg (Sept 30, 2026)"
    )
    # Prices themselves are untouched.
    assert "44.44" in _strip_price_dates("Maize is Ksh 44.44/kg (2026-10-21).")
