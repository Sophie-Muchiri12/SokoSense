"""Tests for price filtering and fallback chain ordering."""

import json

import pandas as pd

from engines.price_filters import apply_price_filters
from engines.price_fallbacks import run_price_fallback_chain


def _sample_df() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "Commodity": "Beans Rosecoco",
                "Market": "Kawangware",
                "County": "Nairobi",
                "Wholesale": "100/Kg",
                "Retail": "130/Kg",
                "Date": "2026-07-05",
            },
            {
                "Commodity": "Beans Rosecoco",
                "Market": "Mutindwa",
                "County": "Nairobi",
                "Wholesale": "95/Kg",
                "Retail": "120/Kg",
                "Date": "2026-07-04",
            },
        ]
    )


def test_apply_price_filters_exact_market():
    df, note = apply_price_filters(_sample_df(), "beans", "Mutindwa", None)
    assert len(df) == 1
    assert df.iloc[0]["Market"] == "Mutindwa"
    assert note == ""


def test_apply_price_filters_county_substitution_note():
    df = _sample_df().drop(index=1)
    filtered, note = apply_price_filters(df, "beans", "Mutindwa", "Nairobi")
    assert len(filtered) == 1
    assert filtered.iloc[0]["Market"] == "Kawangware"
    assert "Mutindwa" in note
    assert "Nairobi county" in note


def test_fallback_chain_prefers_wfp_over_tavily():
    calls: list[str] = []

    def fake_wfp(*_args, **_kwargs):
        calls.append("wfp")
        return "wfp-data"

    def fake_tavily(_query: str) -> str:
        calls.append("tavily")
        return "tavily-data"

    import engines.price_fallbacks as pf

    original = pf._wfp_fallback
    pf._wfp_fallback = fake_wfp
    try:
        result = run_price_fallback_chain(
            "beans",
            "Mutindwa",
            "Nairobi",
            10,
            tavily_kamis_prefix="prefix\n\n",
            build_tavily_query=lambda *a: "beans price",
            search_kamis_via_tavily=fake_tavily,
        )
    finally:
        pf._wfp_fallback = original

    assert result == "wfp-data"
    assert calls == ["wfp"]


def test_fallback_chain_open_web_is_last():
    calls: list[str] = []

    def fake_open_web(*_args, **_kwargs):
        calls.append("open")
        return "open-data"

    import engines.price_fallbacks as pf

    original = pf._wfp_fallback
    pf._wfp_fallback = lambda *_a, **_k: None
    try:
        result = run_price_fallback_chain(
            "beans",
            "Mutindwa",
            "Nairobi",
            10,
            tavily_kamis_prefix="prefix\n\n",
            build_tavily_query=lambda *a: "beans price",
            search_kamis_via_tavily=lambda _q: "Error: no key",
            open_web_fallback=fake_open_web,
        )
    finally:
        pf._wfp_fallback = original

    assert result == "open-data"
    assert calls == ["open"]


def test_kamis_excel_output_is_json_records(monkeypatch):
    from engines import kamis_excel_tool as excel_tool

    sample = pd.DataFrame(
        [
            {
                "Commodity": "Beans Rosecoco",
                "Market": "Mutindwa",
                "County": "Nairobi",
                "Wholesale": "95/Kg",
                "Retail": "120/Kg",
                "Date": "2026-07-04",
            }
        ]
    )

    monkeypatch.setattr(excel_tool, "_fetch_excel_table", lambda _pid: sample)
    monkeypatch.setattr(
        excel_tool,
        "resolve_crop_ids",
        lambda _crop: [64],
        raising=False,
    )

    # resolve_crop_ids is imported lazily inside the function
    import engines.kamis_tool as kamis_tool

    monkeypatch.setattr(kamis_tool, "resolve_crop_ids", lambda _crop: [64])

    text = excel_tool.get_kamis_excel_prices("beans", "Mutindwa", "Nairobi", 5)
    assert text is not None
    assert "KAMIS Excel export" in text
    payload = json.loads(text.split("\n\n")[-1])
    assert payload[0]["Market"] == "Mutindwa"
