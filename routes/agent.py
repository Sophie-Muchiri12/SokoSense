"""SokoSense Agent API route — full LangGraph agent via HTTP.

All responses are in JSON format for USSD/SMS gateway integration.
"""

import json
import logging
from typing import Any

from fastapi import APIRouter
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from engines.agent import agent_graph, get_summarizer_llm
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

        kamis_reply = _format_kamis_tool_reply(result, body.message)
        if kamis_reply:
            response_text = kamis_reply
            resp_type = "market"

        return AgentResponse(
            response=response_text,
            type=resp_type,
            raw=_build_raw(result),
        )

    except Exception as exc:
        logger.exception("Agent invocation failed: %s", exc)
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


def _format_kamis_tool_reply(result: dict[str, Any], user_message: str = "") -> str | None:
    """Build a market reply grounded in the real KAMIS rows.

    A broad query like "price of beans in Nairobi" can return several varieties
    and markets. Rather than surfacing only the first row, this summarizes the
    scraped rows: it asks a tool-free LLM to write a concise SMS from ONLY the
    real numbers (Option B), and falls back to a deterministic multi-row summary
    if the LLM is unavailable or fails — so the reply is always grounded.
    """
    payload = _latest_kamis_payload(result)
    if not payload:
        return None

    rows = payload.get("data")
    if not isinstance(rows, list) or not rows:
        return None

    first = rows[0]
    if not isinstance(first, dict):
        return None

    # Fallback paths (WFP / Tavily / "no data" notes) arrive as a single
    # pre-formatted text blob — pass those straight through unchanged.
    message = first.get("message")
    if isinstance(message, str):
        return truncate_sms(message)

    price_rows = [r for r in rows if isinstance(r, dict) and r.get("Commodity")]
    if not price_rows:
        return None

    llm_reply = _summarize_kamis_rows_with_llm(price_rows, user_message)
    if llm_reply:
        return truncate_sms(llm_reply)

    return truncate_sms(_format_kamis_rows_deterministic(price_rows))


def _summarize_kamis_rows_with_llm(rows: list[dict[str, Any]], user_message: str) -> str | None:
    """Summarize KAMIS price rows into one SMS using only the real numbers.

    Returns ``None`` on any failure (no LLM configured, empty output, exception)
    so the caller can fall back to deterministic formatting.
    """
    llm = get_summarizer_llm()
    if llm is None:
        return None

    # Cap rows fed to the LLM to keep the prompt small and fast.
    rows_for_prompt = rows[:8]

    system = SystemMessage(content=(
        "You are an SMS assistant for Kenyan farmers. Summarize the market price "
        "rows below into ONE concise reply under 300 characters, no emojis, no "
        "markdown. Use ONLY the commodities, markets, counties, prices and dates "
        "given in the data. NEVER invent, estimate, average, or round prices. If "
        "several varieties or markets are present, mention the most relevant few. "
        "Always include the most recent price date. Reply with the SMS text only."
    ))
    human = HumanMessage(content=(
        f"Farmer asked: {user_message}\n\n"
        f"KAMIS price data (JSON):\n{json.dumps(rows_for_prompt, default=str)}"
    ))

    try:
        response = llm.invoke([system, human])
    except Exception as exc:
        logger.warning("KAMIS summary LLM call failed: %s", exc)
        return None

    text = getattr(response, "content", None)
    if not isinstance(text, str):
        return None
    text = text.strip().strip("`").strip()
    return text or None


def _format_kamis_rows_deterministic(rows: list[dict[str, Any]]) -> str:
    """Build a grounded multi-row market summary without an LLM (safety net)."""
    def _row_text(row: dict[str, Any]) -> str:
        commodity = row.get("Commodity") or "Commodity"
        market = row.get("Market") or "market"
        price_parts = []
        if row.get("Wholesale"):
            price_parts.append(f"wholesale KSh {row['Wholesale']}")
        if row.get("Retail"):
            price_parts.append(f"retail KSh {row['Retail']}")
        if not price_parts and row.get("Price"):
            price_parts.append(str(row["Price"]))
        prices = ", ".join(price_parts) if price_parts else "price available"
        return f"{commodity} ({market}): {prices}"

    head = rows[:3]
    body = "; ".join(_row_text(r) for r in head)
    date = next((r.get("Date") for r in head if r.get("Date")), None)
    if date:
        body = f"{body}. As of {date}."
    return body


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
