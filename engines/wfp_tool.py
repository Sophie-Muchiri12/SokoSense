"""WFP food-price backup source.

KAMIS is the primary market-price source, but it can be unavailable (host
firewalls, downtime) or simply lack recent data for a given market. This module
provides a structured fallback using the World Food Programme (WFP) food-price
dataset published on the Humanitarian Data Exchange (HDX).

The data is monthly (mid-month snapshots) rather than daily, so it is used only
as a backup. The CSV is downloaded once and cached locally, then refreshed
weekly. If a refresh fails, any existing (stale) cache is still used.
"""

import os
import re
import json
import time
import difflib
import logging
from typing import Optional

import requests
import urllib3
import pandas as pd

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

# WFP "Kenya - Food Prices" resource on HDX (CKAN). Structured, free, no key.
WFP_CSV_URL = (
    "https://data.humdata.org/dataset/e0d3fba6-f9a2-45d7-b949-140c455197ff/"
    "resource/517ee1bf-2437-4f8c-aa1b-cb9925b9d437/download/wfp_food_prices_ken.csv"
)

_CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "cache")
_CACHE_PATH = os.path.join(_CACHE_DIR, "wfp_food_prices_ken.csv")
_CACHE_MAX_AGE_SECONDS = 7 * 24 * 3600  # refresh weekly

# In-process memo so repeated lookups don't re-read the CSV from disk.
_DF: Optional[pd.DataFrame] = None
_DF_MTIME: Optional[float] = None

_TOKEN_RE = re.compile(r"[a-z0-9]+")
# How close a place name must be to count as a fuzzy match (0-1). 0.8 tolerates
# common single-letter typos like "Garisa" -> "Garissa" without over-matching.
_FUZZY_CUTOFF = 0.8


def _location_matches(term: str, candidates) -> set:
    """Return the candidate location strings that ``term`` should match.

    Matching is forgiving so farmer/SMS spellings still resolve: a candidate
    matches if ``term`` is a substring of it, or if ``term`` is a close fuzzy
    match for any individual word in it (e.g. "Garisa" -> "Garissa", which also
    catches "Garissa town (Garissa)").
    """
    term = term.lower().strip()
    if not term:
        return set()
    matched = set()
    for cand in candidates:
        cand_lower = str(cand).lower()
        if term in cand_lower:
            matched.add(cand)
            continue
        tokens = _TOKEN_RE.findall(cand_lower)
        if difflib.get_close_matches(term, tokens, n=1, cutoff=_FUZZY_CUTOFF):
            matched.add(cand)
    return matched


def _download_csv() -> bool:
    """Download the WFP CSV into the cache (atomic). Returns True on success."""
    try:
        os.makedirs(_CACHE_DIR, exist_ok=True)
        resp = requests.get(WFP_CSV_URL, timeout=60, verify=False)
        if resp.status_code != 200 or not resp.content:
            logger.warning("WFP CSV download returned HTTP %s", resp.status_code)
            return False
        tmp_path = _CACHE_PATH + ".tmp"
        with open(tmp_path, "wb") as fh:
            fh.write(resp.content)
        os.replace(tmp_path, _CACHE_PATH)
        return True
    except Exception as exc:  # network error, disk error, etc.
        logger.warning("WFP CSV download failed: %s", exc)
        return False


def _ensure_cache() -> Optional[str]:
    """Ensure a usable cache file exists; refresh if stale. Returns path or None."""
    fresh = (
        os.path.exists(_CACHE_PATH)
        and (time.time() - os.path.getmtime(_CACHE_PATH)) < _CACHE_MAX_AGE_SECONDS
    )
    if fresh:
        return _CACHE_PATH

    if _download_csv():
        return _CACHE_PATH

    # Download failed — fall back to a stale cache if we have one.
    if os.path.exists(_CACHE_PATH):
        logger.info("Using stale WFP cache (refresh failed).")
        return _CACHE_PATH

    return None


def _load_df() -> Optional[pd.DataFrame]:
    """Load the cached WFP dataset as a cleaned DataFrame, or None if unavailable."""
    global _DF, _DF_MTIME

    path = _ensure_cache()
    if not path:
        return None

    mtime = os.path.getmtime(path)
    if _DF is not None and _DF_MTIME == mtime:
        return _DF

    try:
        df = pd.read_csv(path, low_memory=False)
    except Exception as exc:
        logger.warning("WFP CSV parse failed: %s", exc)
        return None

    # The first data line on HDX files is sometimes an HXL "#tag" row; keep only
    # rows whose date column is a real ISO date.
    if "date" not in df.columns:
        return None
    df = df[df["date"].astype(str).str.match(r"\d{4}-\d{2}-\d{2}", na=False)].copy()

    _DF = df
    _DF_MTIME = mtime
    return df


def get_wfp_prices(
    crop_name: Optional[str] = None,
    market_name: Optional[str] = None,
    county_name: Optional[str] = None,
    limit: int = 10,
) -> Optional[str]:
    """Look up market prices from the WFP backup dataset.

    Returns a human/LLM-readable string (a short source note followed by JSON
    records), or ``None`` when the dataset is unavailable or nothing matches —
    in which case the caller can continue down the fallback chain.
    """
    df = _load_df()
    if df is None or df.empty:
        return None

    crop = (crop_name or "").strip()
    market = (market_name or "").strip()
    county = (county_name or "").strip()

    if crop:
        df = df[df["commodity"].astype(str).str.contains(crop, case=False, na=False)]

    # WFP stores location as market + admin1 (region) + admin2 (county-ish). The
    # caller's market/county hints are matched broadly against all three.
    location_terms = [t for t in (market, county) if t]
    if location_terms:
        mask = pd.Series(False, index=df.index)
        for term in location_terms:
            for col in ("market", "admin2", "admin1"):
                if col not in df.columns:
                    continue
                col_vals = df[col].astype(str)
                # Exact substring is the fast, precise path.
                col_mask = col_vals.str.contains(re.escape(term), case=False, na=False)
                # Only fall back to fuzzy matching when the exact match misses,
                # so we don't accidentally widen results that already matched.
                if not col_mask.any():
                    fuzzy = _location_matches(term, col_vals.unique())
                    if fuzzy:
                        col_mask = col_vals.isin(fuzzy)
                mask |= col_mask
        df = df[mask]

    if df.empty:
        return None

    if "date" in df.columns:
        df = df.sort_values(by="date", ascending=False)

    limit = max(1, min(limit, 10))
    records = []
    for _, row in df.head(limit).iterrows():
        price = row.get("price")
        currency = row.get("currency", "KES")
        unit = row.get("unit", "")
        records.append({
            "Commodity": row.get("commodity"),
            "Market": row.get("market"),
            "County": row.get("admin2"),
            "Region": row.get("admin1"),
            "PriceType": row.get("pricetype"),
            "Price": f"{price} {currency}/{unit}".strip(),
            "Date": row.get("date"),
            "Source": "WFP via HDX (monthly)",
        })

    note = (
        "Source: WFP monthly food-price data (Humanitarian Data Exchange), used "
        "as a backup because KAMIS had no matching data. These are monthly "
        "snapshots, so they may be a few weeks old.\n\n"
    )
    return note + json.dumps(records, indent=2, default=str)
