"""Structured fallback chain for Kenyan market price lookups."""

from __future__ import annotations

from typing import Callable, Optional

from engines.kamis_excel_tool import get_kamis_excel_prices


def _wfp_fallback(crop, market, county, limit) -> Optional[str]:
    try:
        from engines.wfp_tool import get_wfp_prices

        return get_wfp_prices(crop, market, county, limit)
    except Exception:
        return None


def run_price_fallback_chain(
    crop_name: Optional[str],
    market_name: Optional[str],
    county_name: Optional[str],
    limit: int,
    *,
    try_kamis_excel: bool = False,
    had_fetch_error: bool = False,
    tavily_kamis_prefix: str | None = None,
    build_tavily_query: Callable[..., str] | None = None,
    search_kamis_via_tavily: Callable[[str], str] | None = None,
    open_web_fallback: Callable[..., Optional[str]] | None = None,
) -> Optional[str]:
    """Try backup price sources in reliability order.

    Order: KAMIS Excel (optional) -> WFP -> Tavily (KAMIS site) -> Tavily (open web).
    """
    if try_kamis_excel:
        excel_text = get_kamis_excel_prices(
            crop_name, market_name, county_name, limit
        )
        if excel_text:
            return excel_text

    wfp_text = _wfp_fallback(crop_name, market_name, county_name, limit)
    if wfp_text:
        return wfp_text

    if build_tavily_query and search_kamis_via_tavily:
        should_try_tavily = had_fetch_error or tavily_kamis_prefix is not None
        if should_try_tavily:
            fallback_query = build_tavily_query(crop_name, market_name, county_name)
            tavily_text = search_kamis_via_tavily(fallback_query)
            if tavily_text and not tavily_text.startswith(
                ("Error:", "An error occurred")
            ):
                prefix = tavily_kamis_prefix or (
                    "Direct KAMIS access was unavailable; results below come from a "
                    "Tavily web search of the KAMIS site and may be less precise.\n\n"
                )
                return prefix + tavily_text

    if open_web_fallback:
        return open_web_fallback(crop_name, market_name, county_name)

    return None
