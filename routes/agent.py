"""SokoSense Agent API route — full LangGraph agent via HTTP.

All responses are in JSON format for USSD/SMS gateway integration.
"""

import json
import logging
import re
from typing import Any

from fastapi import APIRouter, Depends

from auth.security import get_current_user
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from engines.agent import agent_graph, get_summarizer_llm
from models.common import truncate_sms, unwrap_llm_json_answer

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/api", tags=["agent"])


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
    - Crop price lookups from the KAMIS market CSV (data/market_prices.csv)
    - Agricultural advisory via Postgres/pgvector RAG + weather
    - Loan assessment
    - Weather forecasts

    All responses are returned as JSON.
    """
    try:
        # Invoke the agent graph
        result = agent_graph.invoke({
            "messages": [HumanMessage(content=body.message)],
        })

        # Prefer the nearest-market recommendation (date + market + profit/bag)
        # when advise_on_best_market ran. If the agent only scraped prices for a
        # located crop query, still build that recommendation from the engine.
        # Otherwise fall back to grounded KAMIS rows, then terminal json.
        market_rec_reply = (
            _format_best_market_tool_reply(result)
            or _fallback_market_recommendation(result, body.message)
        )
        kamis_reply = None if market_rec_reply else _format_kamis_tool_reply(result, body.message)
        parsed_terminal = _parse_terminal_json_tool_call(result)

        if market_rec_reply:
            response_text, resp_type = market_rec_reply, "market"
        elif parsed_terminal and not kamis_reply:
            response_text, resp_type = parsed_terminal
            return AgentResponse(
                response=response_text,
                type=resp_type,
                raw=_build_raw(result),
            )
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
    return unwrap_llm_json_answer(reply), resp_type


_MONTHS = (
    "January|February|March|April|May|June|July|August|September|October|"
    "November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec"
)


def _strip_price_dates(text: str) -> str:
    """Remove dates from a farmer-facing price reply.

    Price answers must quote the commodity, market and price only — the
    report date is internal metadata, so strip ISO dates (2026-09-30),
    long dates (30 September 2026 / September 30, 2026) and "as of …"
    clauses whether they came from the LLM summariser or the fallback.
    """
    text = re.sub(r"\s*\(?\b\d{4}-\d{2}-\d{2}\b\)?", "", text)
    text = re.sub(
        rf"\s*\(?\b(?:\d{{1,2}}(?:st|nd|rd|th)?\s+(?:{_MONTHS})(?:,?\s+\d{{4}})?"
        rf"|(?:{_MONTHS})\s+\d{{1,2}}(?:st|nd|rd|th)?(?:,?\s+\d{{4}})?)\)?",
        "",
        text,
    )
    text = re.sub(r"\s*\bAs of\b[^.;]*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\(\s*\)", "", text)
    text = re.sub(r"\s{2,}", " ", text)
    text = re.sub(r"\s+([,.;])", r"\1", text)
    text = text.strip()
    if text and text[-1] not in ".!?":
        text += "."
    return text


def _format_best_market_tool_reply(result: dict[str, Any]) -> str | None:
    """Use advise_on_best_market.short_reply when the tool ran successfully.

    This is the farmer-facing recommendation: sell-by date, nearest/best
    market name, and extra KSh per bag vs selling where they are.
    """
    for message in reversed(result.get("messages", [])):
        if getattr(message, "name", None) != "advise_on_best_market":
            continue
        content = getattr(message, "content", None)
        if not isinstance(content, str):
            continue
        try:
            parsed = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(parsed, dict) or parsed.get("status") != "ok":
            continue
        data = parsed.get("data")
        if not isinstance(data, dict):
            continue
        reply = data.get("short_reply")
        if isinstance(reply, str) and reply.strip():
            return truncate_sms(reply.strip())
    return None


def _fallback_market_recommendation(
    result: dict[str, Any], user_message: str
) -> str | None:
    """Build a sell recommendation when the agent scraped prices but skipped
    advise_on_best_market — common for 'price of X in Y' simulator queries.
    """
    crop, location = _extract_crop_location(result, user_message)
    if not crop or not location:
        return None
    try:
        from engines.market import decide_market
        from models.market import MarketDecisionRequest

        decision = decide_market(MarketDecisionRequest(crop=crop, location=location))
        return truncate_sms(decision.short_reply)
    except Exception as exc:
        logger.warning("Market recommendation fallback failed: %s", exc)
        return None


def _extract_crop_location(
    result: dict[str, Any], user_message: str
) -> tuple[str | None, str | None]:
    """Pull crop + place from KAMIS tool args, else from the user message."""
    for args, _payload in reversed(list(_iter_kamis_tool_results(result))):
        crop = args.get("crop_name")
        location = args.get("market_name") or args.get("county_name")
        if isinstance(crop, str) and crop.strip() and isinstance(location, str) and location.strip():
            return crop.strip().lower(), location.strip().lower()

    # advise_on_best_market args (even if the tool errored)
    for message in result.get("messages", []):
        for tool_call in getattr(message, "tool_calls", None) or []:
            if tool_call.get("name") != "advise_on_best_market":
                continue
            args = tool_call.get("args") or {}
            crop = args.get("crop")
            location = args.get("location")
            if isinstance(crop, str) and crop.strip() and isinstance(location, str) and location.strip():
                return crop.strip().lower(), location.strip().lower()

    msg = user_message.lower()
    crops = (
        "maize", "beans", "tomatoes", "potatoes", "sorghum", "millet",
        "mahindi", "maharagwe", "nyanya", "viazi",
    )
    places = (
        "nairobi", "nakuru", "eldoret", "kisumu", "mombasa", "kitale", "nyeri",
        "meru", "kakamega", "kiambu", "machakos", "kericho", "thika", "embu",
    )
    crop = next((c for c in crops if c in msg), None)
    location = next((p for p in places if p in msg), None)
    aliases = {"mahindi": "maize", "maharagwe": "beans", "nyanya": "tomatoes", "viazi": "potatoes"}
    if crop:
        crop = aliases.get(crop, crop)
    return crop, location


def _format_kamis_tool_reply(result: dict[str, Any], user_message: str = "") -> str | None:
    """Build a market reply grounded in the real KAMIS rows.

    A broad query like "price of beans in Nairobi" can return several varieties
    and markets. Rather than surfacing only the first row, this summarizes the
    scraped rows: it asks a tool-free LLM to write a concise SMS from ONLY the
    real numbers (Option B), and falls back to a deterministic multi-row summary
    if the LLM is unavailable or fails — so the reply is always grounded.
    """
    payload, _args = _best_kamis_payload(result, user_message)
    if not payload:
        return _format_kamis_no_data_reply(result, user_message)

    rows = payload.get("data")
    if not isinstance(rows, list) or not rows:
        return _format_kamis_no_data_reply(result, user_message)

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
        return truncate_sms(_strip_price_dates(llm_reply))

    return truncate_sms(_strip_price_dates(_format_kamis_rows_deterministic(price_rows)))


def _summarize_kamis_rows_with_llm(rows: list[dict[str, Any]], user_message: str) -> str | None:
    """Summarize KAMIS price rows into one SMS using only the real numbers.

    Returns ``None`` on any failure (no LLM configured, empty output, exception)
    so the caller can fall back to deterministic formatting.
    """
    llm = get_summarizer_llm()
    if llm is None:
        return None

    # Cap rows fed to the LLM to keep the prompt small and fast. Dates are
    # stripped before the prompt: the farmer-facing reply must not quote them.
    rows_for_prompt = [
        {k: v for k, v in row.items() if k != "Date"} for row in rows[:8]
    ]

    system = SystemMessage(content=(
        "You are an SMS assistant for Kenyan farmers. Summarize the market price "
        "rows below into ONE concise reply under 300 characters, no emojis, no "
        "markdown. Use ONLY the commodities, markets, counties and prices "
        "given in the data. NEVER invent, estimate, average, or round prices. If "
        "several varieties or markets are present, mention the most relevant few. "
        "Do NOT include any date in your reply. Reply with the SMS text only."
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
    return "; ".join(_row_text(r) for r in head)


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
