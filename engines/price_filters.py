"""Shared crop/location filtering for KAMIS price DataFrames."""

from __future__ import annotations

from typing import Optional

import pandas as pd


def apply_price_filters(
    df: pd.DataFrame,
    crop_name: Optional[str],
    market_name: Optional[str],
    county_name: Optional[str],
) -> tuple[pd.DataFrame, str]:
    """Filter a KAMIS-style price table by crop and location.

    Returns the filtered frame and an optional note when the requested market
    was missing and county-level rows were substituted instead.
    """
    clean_crop = crop_name.strip() if crop_name else None
    clean_market = market_name.strip() if market_name else None
    clean_county = county_name.strip() if county_name else None

    if clean_crop and "Commodity" in df.columns:
        df = df[df["Commodity"].str.contains(clean_crop, case=False, na=False)]

    substitution_note = ""

    if clean_market and "Market" in df.columns:
        market_mask = df["Market"].str.contains(clean_market, case=False, na=False)
        if market_mask.any():
            df = df[market_mask]
        elif (
            not clean_county
            and "County" in df.columns
            and df["County"].str.contains(clean_market, case=False, na=False).any()
        ):
            df = df[df["County"].str.contains(clean_market, case=False, na=False)]
        else:
            county_hint = clean_county or clean_market
            if "County" in df.columns:
                county_df = df[
                    df["County"].str.contains(county_hint, case=False, na=False)
                ]
                if not county_df.empty:
                    df = county_df
                    substitution_note = (
                        f"Note: '{clean_market}' has no recent KAMIS price reports, "
                        f"so the prices below are from other markets in "
                        f"{county_hint.title()} county.\n\n"
                    )
                else:
                    df = county_df
    elif clean_county and "County" in df.columns:
        df = df[df["County"].str.contains(clean_county, case=False, na=False)]

    return df, substitution_note
