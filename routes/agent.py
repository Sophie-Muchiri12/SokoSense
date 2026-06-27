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
    - Crop price lookups via KAMIS
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

        # Extract the final AI response. The agent is prompted to emit JSON for
        # SMS gateways, but this HTTP route should return plain text to clients.
        final_message = result["messages"][-1]
        response_text = final_message.content if hasattr(final_message, "content") else str(final_message)

        parsed_response = _parse_agent_response(response_text)
        if parsed_response:
            response_text, resp_type = parsed_response
        else:
            resp_type = _detect_type(body.message, response_text)

        kamis_reply = _format_kamis_tool_reply(result)
        if kamis_reply:
            response_text = kamis_reply
            resp_type = "market"

        return AgentResponse(
            response=response_text,
            type=resp_type,
            raw=_build_raw(result),
        )

    except Exception as exc:
        logger.error("Agent invocation failed: %s", exc)
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


def _format_kamis_tool_reply(result: dict[str, Any]) -> str | None:
    """Build a market reply from real KAMIS rows instead of LLM prose."""
    payload = _latest_kamis_payload(result)
    if not payload:
        return None

    rows = payload.get("data")
    if not isinstance(rows, list) or not rows:
        return None

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

    return truncate_sms(reply)


def _latest_kamis_payload(result: dict[str, Any]) -> dict[str, Any] | None:
    """Find the most recent scrape_kamis_prices ToolMessage payload."""
    for message in reversed(result.get("messages", [])):
        name = getattr(message, "name", None)
        if name != "scrape_kamis_prices":
            continue

        content = getattr(message, "content", None)
        if not isinstance(content, str):
            continue

        try:
            parsed = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            continue

        if isinstance(parsed, dict) and parsed.get("tool") == "scrape_kamis_prices":
            return parsed

    return None


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
