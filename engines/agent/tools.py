"""Tool definitions for the SokoSense LangGraph agent.

All tools return JSON-serializable dicts for easy integration with
USSD and SMS gateways. Tool strings are wrapped in JSON.
"""

import json
import logging
from typing import Any

from langchain_core.tools import tool

from engines.loaning import _assess_loan
from engines.weather import get_farmer_weather as raw_weather
from engines.advisory import answer_farmer_question as raw_advisory
from engines.timing import decide_timing as raw_timing
from engines.market import decide_market as raw_market

logger = logging.getLogger(__name__)


def _try_json(val: Any) -> str:
    """Try to parse string as JSON; if it fails, wrap in JSON."""
    if isinstance(val, dict) or isinstance(val, list):
        return json.dumps(val, default=str)
    s = str(val)
    # Check if already valid JSON
    try:
        json.loads(s)
        return s
    except (json.JSONDecodeError, ValueError):
        return json.dumps({"text": s}, default=str)


@tool
def scrape_kamis_prices(
    crop_name: str | None = None,
    market_name: str | None = None,
    county_name: str | None = None,
    limit: int = 10,
) -> str:
    """Queries the local KAMIS SQLite cache and returns price data.

    Use this to find the latest crop prices from Kenyan markets.

    Args:
        crop_name: The crop name (e.g. 'Tomatoes', 'Maize'). Case-insensitive.
        market_name: Optional market location name (e.g. 'Maua', 'Kibuye').
        county_name: Optional county name (e.g. 'Meru', 'Nairobi').
        limit: Max records (default 10, max 10). Do not change this.
    """
    # Import the actual implementation from engines.kamis_tool
    from engines.kamis_tool import scrape_kamis_prices as _kamis_impl

    raw = _kamis_impl.invoke({
        "crop_name": crop_name,
        "market_name": market_name,
        "county_name": county_name,
        "limit": limit,
    })

    # Wrap string result in JSON
    try:
        parsed = json.loads(raw)
        return json.dumps(
            {"tool": "scrape_kamis_prices", "data": parsed, "status": "ok"},
            default=str,
        )
    except (json.JSONDecodeError, ValueError):
        return json.dumps(
            {"tool": "scrape_kamis_prices", "data": [{"message": raw}], "status": "ok"},
            default=str,
        )


@tool
def advise_on_loan(
    principal: float,
    interest_rate: float,
    rate_period: str,
    term_value: float,
    term_unit: str,
    compounding_frequency: str = "monthly",
    is_simple_interest: bool = False,
) -> str:
    """Analyzes a loan for a farmer and returns a structured risk assessment.

    Calculates the real APR, benchmarks against CBK rate, and provides
    a safety verdict.

    Args:
        principal: Loan amount in KES (e.g. 50000).
        interest_rate: Stated interest rate as percentage (e.g. 5 for 5%).
        rate_period: 'annual', 'monthly', 'weekly', or 'daily'.
        term_value: Duration number (e.g. 12).
        term_unit: 'years', 'months', 'weeks', or 'days'.
        compounding_frequency: 'annually', 'monthly', 'weekly', 'daily'.
        is_simple_interest: Use simple instead of compound interest.
    """
    try:
        result = _assess_loan(
            principal=principal,
            interest_rate=interest_rate,
            rate_period=rate_period,
            term_value=term_value,
            term_unit=term_unit,
            compounding_frequency=compounding_frequency,
            is_simple_interest=is_simple_interest,
        )
        return json.dumps(
            {"tool": "advise_on_loan", "data": result, "status": "ok"},
            default=str,
        )
    except Exception as exc:
        return json.dumps(
            {"tool": "advise_on_loan", "error": str(exc), "status": "error"},
            default=str,
        )


@tool
def get_farmer_weather(location: str) -> str:
    """Fetch current weather + 3-day forecast for a Kenyan location.

    Returns farming-relevant advice based on conditions. Call this when
    the user asks about weather, spraying conditions, or disease risk.

    Args:
        location: Town or county name in Kenya (e.g. 'Nakuru', 'Meru').
    """
    try:
        raw = raw_weather.invoke({"location": location})
        return json.dumps(
            {"tool": "get_farmer_weather", "data": [{"message": raw}], "status": "ok"},
            default=str,
        )
    except Exception as exc:
        return json.dumps(
            {"tool": "get_farmer_weather", "error": str(exc), "status": "error"},
            default=str,
        )


@tool
def answer_farmer_question(query: str, include_weather: bool = True) -> str:
    """Runs the full RAG advisory pipeline for agricultural questions.

    Extracts crop/disease/location from the query, retrieves knowledge
    from Neo4j (graph + vector search), fetches weather data, and calls
    the LLM to generate a complete answer.

    Use this as the primary tool for any farming/crop/disease/pest question.

    Args:
        query: Farmer's natural language question.
        include_weather: Whether to fetch weather for the detected location.
    """
    try:
        result = raw_advisory(query, include_weather=include_weather)
        return json.dumps(
            {"tool": "answer_farmer_question", "data": result, "status": "ok"},
            default=str,
        )
    except Exception as exc:
        return json.dumps(
            {"tool": "answer_farmer_question", "error": str(exc), "status": "error"},
            default=str,
        )


@tool
def advise_on_sell_timing(crop: str, market: str) -> str:
    """Performs price trend analysis to advise a farmer on the best time to sell a crop (e.g. SELL_TODAY, WAIT/HOLD).

    Args:
        crop: The name of the crop (e.g. 'Tomatoes', 'Maize', 'Beans').
        market: The local market or location name (e.g. 'Meru', 'Nakuru').
    """
    try:
        from models.timing import TimingRequest
        req = TimingRequest(crop=crop, market=market)
        result = raw_timing(req)
        return json.dumps(
            {"tool": "advise_on_sell_timing", "data": result.model_dump(), "status": "ok"},
            default=str,
        )
    except Exception as exc:
        return json.dumps(
            {"tool": "advise_on_sell_timing", "error": str(exc), "status": "error"},
            default=str,
        )


@tool
def advise_on_best_market(crop: str, location: str) -> str:
    """Compares the crop price in the farmer's local location with other markets in Kenya
    and advises on the best market to sell in.

    Args:
        crop: The name of the crop (e.g. 'Tomatoes', 'Maize', 'Beans').
        location: The farmer's local location/town (e.g. 'Meru', 'Nakuru').
    """
    try:
        from models.market import MarketDecisionRequest
        req = MarketDecisionRequest(crop=crop, location=location)
        result = raw_market(req)
        return json.dumps(
            {"tool": "advise_on_best_market", "data": result.model_dump(), "status": "ok"},
            default=str,
        )
    except Exception as exc:
        return json.dumps(
            {"tool": "advise_on_best_market", "error": str(exc), "status": "error"},
            default=str,
        )


@tool("json")
def format_sms_json(response: str, type: str = "general") -> str:
    """Submit the final farmer-facing SMS reply as structured JSON.

    Call this once you have gathered all needed data and are ready to reply.
    Do not call any other tools after this.

    Args:
        response: Plain-language answer for the farmer (under 320 chars when possible).
        type: One of advisory, market, weather, loan, or general.
    """
    if type not in {"advisory", "market", "weather", "loan", "general"}:
        type = "general"
    return json.dumps({"response": response, "type": type})


# Terminal tool is bound to the LLM but not executed by ToolNode (see graph.py).
TERMINAL_TOOL_NAMES = {"json"}

# List of all tools for binding to the LLM
TOOLS = [
    scrape_kamis_prices,
    advise_on_loan,
    get_farmer_weather,
    answer_farmer_question,
    advise_on_sell_timing,
    advise_on_best_market,
    format_sms_json,
]

# Tools that perform real work and are executed by the ToolNode
EXECUTABLE_TOOLS = [t for t in TOOLS if t.name not in TERMINAL_TOOL_NAMES]
