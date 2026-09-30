"""LangGraph agent workflow for SokoSense agricultural AI assistant.

Defines the state graph, LLM binding, system prompt, and compilation.
All responses are wrapped in JSON format for USSD/SMS integration.
"""

import logging
import uuid

from dotenv import load_dotenv
from langchain_core.messages import SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode

from engines.agent.state import AgentState
from engines.agent.tools import TOOLS
from engines.llm import DEFAULT_GROQ_MODEL, get_groq_llm

load_dotenv()

logger = logging.getLogger(__name__)

# ── LLM initialisation ─────────────────────────────────────────────────────

_groq_llm = get_groq_llm(temperature=0.0)
if _groq_llm is not None:
    logger.info("Using Groq LLM: %s", DEFAULT_GROQ_MODEL)
    llm_with_tools = _groq_llm.bind_tools(TOOLS)
else:
    raise ValueError("No LLM provider configured. Set GROQ_API_KEY in .env")

# Plain, tool-free LLM used to summarize tool output (e.g. scraped KAMIS rows)
# into a useful SMS reply. Built lazily and memoized so importing this module
# stays cheap and a missing summarizer never breaks the agent.
_summarizer_llm = None
_summarizer_built = False


def get_summarizer_llm():
    """Return a tool-free LLM for grounded post-tool summarization, or ``None``.

    Memoized; returns ``None`` if GROQ_API_KEY is not set so callers can fall
    back to deterministic formatting.
    """
    global _summarizer_llm, _summarizer_built
    if _summarizer_built:
        return _summarizer_llm
    _summarizer_built = True
    _summarizer_llm = get_groq_llm(temperature=0.0)
    return _summarizer_llm

# ── System prompt ──────────────────────────────────────────────────────────

SYSTEM_PROMPT = SystemMessage(
    content=(
        "You are a friendly agricultural helper for Kenyan farmers. "
        "Your job is to give practical advice on crop prices, markets, loans, weather, and farming problems.\n\n"
        "You have access to seven tools:\n"
        "1. `scrape_kamis_prices`: Reads the local KAMIS SQLite cache. Matches crop names, returns up to 10 rows, and filters by crop/market/county.\n"
        "2. `advise_on_loan`: Analyzes a farmer's loan request (principal, interest rate, term, compounding) and returns a structured risk verdict.\n"
        "3. `get_farmer_weather`: Fetches current weather + 3-day forecast for a Kenyan location with farming-specific advice.\n"
        "4. `answer_farmer_question`: Runs the full RAG advisory pipeline — queries Neo4j graph & vector store, fetches local weather, and calls LLM.\n"
        "5. `advise_on_sell_timing`: Analyzes historical price trends to recommend whether the farmer should sell today or wait/hold.\n"
        "6. `advise_on_best_market`: Compares the local market price for a crop against other Kenyan markets to find the most profitable location.\n"
        "7. `json`: Submit your final SMS reply once you are done calling data tools. Pass `response` (plain text) and `type` (advisory|market|weather|loan|general).\n\n"
        "HOW TO WRITE ANSWERS:\n"
        "- Match the farmer's language: Swahili question → Swahili answer; English question → English answer.\n"
        "- Use simple, everyday language — short sentences, no jargon unless you explain it in the same language.\n"
        "- For farming advice: say what the problem is, then 2–3 clear steps the farmer can take.\n"
        "- For prices/markets/loans: lead with the key number or recommendation, then one line of context.\n"
        "- If `scrape_kamis_prices` returns no rows for the requested county or market, say clearly that "
        "local data is unavailable. Do NOT quote prices from other counties as if they are local.\n"
        "- Be warm and practical, like talking to a neighbour.\n"
        "- DO NOT use emojis.\n\n"
        "FORMAT (for SMS/USSD gateways):\n"
        "- After using data tools, call `json` with your final answer: "
        '{"response": "your plain-language answer", "type": "advisory|market|weather|loan|general"}\n'
        "- Keep SMS replies under 320 characters when possible; for complex farming answers, "
        "prioritise clarity over brevity (up to ~500 characters).\n"
    )
)

# ── Graph nodes ────────────────────────────────────────────────────────────


def _ensure_tool_call_ids(message):
    """Guarantee every tool call has a non-empty string id.

    Some models intermittently emit tool calls with a missing/``None`` id.
    LangGraph's ToolNode builds a ``ToolMessage(tool_call_id=call["id"])`` for
    these calls and a ``None`` id raises a pydantic ValidationError. Backfilling
    a valid id keeps the agent loop alive so the model can recover.
    """
    for tc in (getattr(message, "tool_calls", None) or []):
        if not tc.get("id"):
            tc["id"] = f"call_{uuid.uuid4().hex}"
    for tc in (getattr(message, "invalid_tool_calls", None) or []):
        if not tc.get("id"):
            tc["id"] = f"call_{uuid.uuid4().hex}"
    return message


def call_model(state: AgentState):
    """Call the LLM with the current message history."""
    messages = state["messages"]

    # Prepend system prompt if not already present
    if not any(isinstance(m, SystemMessage) for m in messages):
        messages_to_send = [SYSTEM_PROMPT] + list(messages)
    else:
        messages_to_send = list(messages)

    response = llm_with_tools.invoke(messages_to_send)
    return {"messages": [_ensure_tool_call_ids(response)]}


def should_continue(state: AgentState) -> str:
    """Route to tools or end based on whether the LLM requested tool calls."""
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        # Terminal `json` tool carries the final SMS payload — no execution needed.
        if any(tc.get("name") == "json" for tc in last_message.tool_calls):
            return "end"
        return "continue"
    return "end"


# ── Graph construction ─────────────────────────────────────────────────────

workflow = StateGraph(AgentState)

workflow.add_node("agent", call_model)
workflow.add_node("tools", ToolNode(EXECUTABLE_TOOLS))

workflow.set_entry_point("agent")

workflow.add_conditional_edges(
    "agent",
    should_continue,
    {
        "continue": "tools",
        "end": END,
    },
)

workflow.add_edge("tools", "agent")

agent_graph = workflow.compile()
agent_graph = agent_graph.with_config({"recursion_limit": 25})
