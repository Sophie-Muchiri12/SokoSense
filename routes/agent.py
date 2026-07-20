"""SokoSense Agent API route — full LangGraph agent via HTTP.

All responses are in JSON format for USSD/SMS gateway integration.
"""

import json
import logging
from typing import Any

from fastapi import APIRouter
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field

from engines.agent import agent_graph
from models.common import truncate_sms

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["agent"])


class AgentRequest(BaseModel):
    """Request to the SokoSense agent."""
    message: str = Field(
        ...,
        min_length=1,
        examples=["What are the current maize prices in Nakuru?"],
        description="User's message to the agricultural AI agent.",
    )


class AgentResponse(BaseModel):
    """Structured JSON response from the agent."""
    response: str = Field(
        ...,
        description="Agent's answer in plain text or JSON string.",
    )
    type: str = Field(
        default="general",
        description="Type of response: advisory, market, weather, loan, or general.",
    )
    raw: dict[str, Any] | None = Field(
        default=None,
        description="Raw agent output including tool call results.",
    )


@router.post("/agent", response_model=AgentResponse)
def post_agent(body: AgentRequest) -> AgentResponse:
    """Send a message to the SokoSense agent.

    The agent has tools for:
    - Crop price lookups via cached KAMIS SQLite data
    - Agricultural advisory via Neo4j RAG + weather
    - Loan assessment
    - Weather forecasts

    All responses are returned as JSON.
    """
    try:
        # Invoke the agent graph
        result = agent_graph.invoke({
            "messages": [HumanMessage(content=body.message)],
        })

        parsed_terminal = _parse_terminal_json_tool_call(result)
        kamis_reply = _format_kamis_tool_reply(result, body.message)

        if parsed_terminal:
            # Trust the agent's final answer — do not replace it with unrelated
            # KAMIS rows from a broader fallback query in another county.
            response_text, resp_type = parsed_terminal
        elif kamis_reply:
            response_text = kamis_reply
            resp_type = "market"
        else:
            # Extract the final AI response. The agent may emit JSON for SMS
            # gateways, but this HTTP route returns plain text to clients.
            final_message = result["messages"][-1]
            response_text = (
                final_message.content
                if hasattr(final_message, "content")
                else str(final_message)
            )

            parsed_response = _parse_agent_response(response_text)
            if parsed_response:
                response_text, resp_type = parsed_response
            else:
                resp_type = _detect_type(body.message, response_text)

        return AgentResponse(
            response=response_text,
            type=resp_type,
            raw=_build_raw(result),
        )

    except Exception as exc:
        logger.error("Agent invocation failed: %s", exc)
        recovered = _recover_from_failed_json_tool(exc)
        if recovered:
            response_text, resp_type = recovered
            return AgentResponse(
                response=response_text,
                type=resp_type,
                raw={"recovered_from_error": str(exc)},
            )
        return AgentResponse(
            response=f"Sorry, I encountered an error processing your request. Please try again.",
            type="general",
            raw={"error": str(exc)},
        )


def _detect_type(user_message: str, response: str) -> str:
    """Detect the type of agent response based on user message and AI response."""
    msg_lower = user_message.lower()
    resp_lower = response.lower()

    if any(w in msg_lower for w in ["price", "cost", "sell", "market", "kamis"]):
        return "market"
    if any(w in msg_lower for w in ["loan", "interest", "apr", "borrow", "credit"]):
        return "loan"
    if any(w in msg_lower for w in ["weather", "rain", "temperature", "humidity", "sunny"]):
        return "weather"
    if any(w in msg_lower for w in ["disease", "pest", "crop", "plant", "fertilizer",
                                     "farm", "seed", "harvest", "soil", "irrigation"]):
        return "advisory"
    if '"type": "advisory"' in resp_lower or "advisory" in resp_lower[:100]:
        return "advisory"
    if '"type": "market"' in resp_lower:
        return "market"
    if '"type": "weather"' in resp_lower:
        return "weather"
    if '"type": "loan"' in resp_lower:
        return "loan"

    return "general"


def _parse_terminal_json_tool_call(result: dict[str, Any]) -> tuple[str, str] | None:
    """Extract the farmer reply from a terminal `json` tool call."""
    for message in reversed(result.get("messages", [])):
        tool_calls = getattr(message, "tool_calls", None)
        if not tool_calls:
            continue

        for tool_call in tool_calls:
            if tool_call.get("name") != "json":
                continue

            args = tool_call.get("args", {})
            if not isinstance(args, dict):
                continue

            reply = args.get("response")
            if not isinstance(reply, str) or not reply.strip():
                continue

            resp_type = args.get("type", "general")
            if resp_type not in {"advisory", "market", "weather", "loan", "general"}:
                resp_type = "general"
            return reply, resp_type

    return None


def _recover_from_failed_json_tool(exc: Exception) -> tuple[str, str] | None:
    """Recover a reply when Groq rejected an unregistered `json` tool call."""
    payload: Any = getattr(exc, "body", None)
    if not isinstance(payload, dict):
        return None

    error = payload.get("error", {})
    if not isinstance(error, dict):
        return None

    failed_generation = error.get("failed_generation")
    if not isinstance(failed_generation, str):
        return None

    try:
        parsed = json.loads(failed_generation)
    except (json.JSONDecodeError, TypeError):
        return None

    if not isinstance(parsed, dict) or parsed.get("name") != "json":
        return None

    args = parsed.get("arguments", parsed.get("args", {}))
    if not isinstance(args, dict):
        return None

    reply = args.get("response")
    if not isinstance(reply, str) or not reply.strip():
        return None

    resp_type = args.get("type", "general")
    if resp_type not in {"advisory", "market", "weather", "loan", "general"}:
        resp_type = "general"
    return reply, resp_type


def _parse_agent_response(response: str) -> tuple[str, str] | None:
    """Unwrap the agent's final JSON response into API fields."""
    text = response.strip()
    if text.startswith("```"):
        text = text.strip("`").strip()
        if text.lower().startswith("json"):
            text = text[4:].strip()

    try:
        parsed = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None

    if not isinstance(parsed, dict):
        return None

    reply = parsed.get("response")
    resp_type = parsed.get("type", "general")
    if not isinstance(reply, str):
        return None
    if resp_type not in {"advisory", "market", "weather", "loan", "general"}:
        resp_type = "general"
    return reply, resp_type


def _format_kamis_tool_reply(result: dict[str, Any], user_message: str = "") -> str | None:
    """Build a market reply from location-matched KAMIS rows only."""
    payload, call_args = _best_kamis_payload(result, user_message)
    if not payload:
        return _format_kamis_no_data_reply(result, user_message)

    rows = payload.get("data")
    if not isinstance(rows, list) or not rows:
        return _format_kamis_no_data_reply(result, user_message)

    first = rows[0]
    if not isinstance(first, dict):
        return None

    message = first.get("message")
    if isinstance(message, str):
        return truncate_sms(message)

    commodity = first.get("Commodity") or "Commodity"
    market = first.get("Market") or "market"
    county = first.get("County") or "Kenya"
    wholesale = first.get("Wholesale")
    retail = first.get("Retail")
    date = first.get("Date")

    price_parts = []
    if wholesale:
        price_parts.append(f"wholesale KSh {wholesale}")
    if retail:
        price_parts.append(f"retail KSh {retail}")

    prices = ", ".join(price_parts) if price_parts else "price available"
    reply = f"{commodity} in {market}, {county}: {prices}"
    if date:
        reply = f"{reply} on {date}."
    else:
        reply = f"{reply}."

    if _location_requested(call_args):
        location = call_args.get("county_name") or call_args.get("market_name")
        if location and not _row_matches_location(first, location):
            return _format_kamis_no_data_reply(result, user_message)

    return truncate_sms(reply)


def _format_kamis_no_data_reply(result: dict[str, Any], user_message: str) -> str | None:
    """Return a clear no-data message when a location-specific lookup failed."""
    for args, payload in reversed(list(_iter_kamis_tool_results(result))):
        if not _location_requested(args):
            continue
        if _has_price_rows(payload):
            continue

        rows = payload.get("data")
        if isinstance(rows, list) and rows:
            first = rows[0]
            if isinstance(first, dict):
                message = first.get("message")
                if isinstance(message, str) and message.strip():
                    return truncate_sms(message)

        location = args.get("county_name") or args.get("market_name") or "that area"
        crop = args.get("crop_name") or "that crop"
        return truncate_sms(
            f"No cached price data for {crop} in {location}. "
            "Try again later or check a nearby major market."
        )

    if _user_requested_location(user_message):
        return truncate_sms(
            "No cached price data for that crop in the requested area. "
            "Try again later or check a nearby major market."
        )

    return None


def _iter_kamis_tool_results(result: dict[str, Any]):
    """Yield (call_args, payload) for each scrape_kamis_prices invocation."""
    pending_calls: dict[str, dict[str, Any]] = {}

    for message in result.get("messages", []):
        tool_calls = getattr(message, "tool_calls", None) or []
        for tool_call in tool_calls:
            if tool_call.get("name") != "scrape_kamis_prices":
                continue
            call_id = tool_call.get("id")
            if call_id:
                pending_calls[call_id] = tool_call.get("args") or {}

        if getattr(message, "name", None) != "scrape_kamis_prices":
            continue

        content = getattr(message, "content", None)
        if not isinstance(content, str):
            continue

        try:
            parsed = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            continue

        if not isinstance(parsed, dict) or parsed.get("tool") != "scrape_kamis_prices":
            continue

        tool_call_id = getattr(message, "tool_call_id", None)
        args = pending_calls.get(tool_call_id, {}) if tool_call_id else {}
        yield args, parsed


def _has_price_rows(payload: dict[str, Any]) -> bool:
    rows = payload.get("data")
    if not isinstance(rows, list) or not rows:
        return False

    first = rows[0]
    if not isinstance(first, dict):
        return False
    if first.get("message"):
        return False

    return bool(first.get("Commodity") or first.get("Market"))


def _location_requested(args: dict[str, Any]) -> bool:
    return bool(args.get("county_name") or args.get("market_name"))


def _user_requested_location(user_message: str) -> bool:
    msg = user_message.lower()
    location_hints = (
        " in ", " at ", " kwa ", " meru", " nakuru", " nairobi", " kisumu",
        " mombasa", " eldoret", " kakamega", " machakos", " nyeri", " kiambu",
    )
    return any(hint in msg for hint in location_hints)


def _row_matches_location(row: dict[str, Any], location: str) -> bool:
    needle = location.lower().strip()
    if not needle:
        return True

    county = str(row.get("County") or "").lower()
    market = str(row.get("Market") or "").lower()
    return needle in county or needle in market or county in needle or market in needle


def _best_kamis_payload(
    result: dict[str, Any],
    user_message: str = "",
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    """Pick KAMIS data that matches the farmer's requested location."""
    candidates = list(_iter_kamis_tool_results(result))
    location_filter_used = any(_location_requested(args) for args, _ in candidates)
    user_wants_location = _user_requested_location(user_message)

    for args, payload in reversed(candidates):
        if not _location_requested(args):
            continue
        if _has_price_rows(payload):
            return payload, args

    if location_filter_used or user_wants_location:
        return None, {}

    for args, payload in reversed(candidates):
        if _has_price_rows(payload):
            return payload, args

    return None, {}


def _build_raw(result: dict[str, Any]) -> dict[str, Any]:
    """Build a simplified raw output from the agent state."""
    messages = result.get("messages", [])
    raw_messages = []
    for m in messages:
        entry: dict[str, Any] = {
            "role": m.type if hasattr(m, "type") else "unknown",
            "content_preview": (m.content[:500] if hasattr(m, "content") else str(m)[:500]),
        }
        if hasattr(m, "tool_calls") and m.tool_calls:
            entry["tool_calls"] = [
                {"name": tc["name"], "args": tc.get("args", {})}
                for tc in m.tool_calls
            ]
        raw_messages.append(entry)

    return {"messages": raw_messages}
