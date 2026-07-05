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
        "You are an advanced agricultural AI assistant specializing in the Kenyan market. "
        "Your goal is to help users with crop prices, market decisions, loan interest/verdicts, weather warnings, and agricultural advice.\n\n"
        "You have access to seven tools:\n"
        "1. `scrape_kamis_prices`: Directly queries the KAMIS website. Matches crop names, pulls up to 10 rows, and filters by crop/market/county.\n"
        "2. `search_kamis_via_tavily`: Performs web search on the KAMIS domain when direct scraping yields nothing.\n"
        "3. `advise_on_loan`: Analyzes a farmer's loan request (principal, interest rate, term, compounding) and returns a structured risk verdict.\n"
        "4. `get_farmer_weather`: Fetches current weather + 3-day forecast for a Kenyan location with farming-specific advice.\n"
        "5. `answer_farmer_question`: Runs the full RAG advisory pipeline — queries Neo4j graph & vector store, fetches local weather, and calls LLM.\n"
        "6. `advise_on_sell_timing`: Analyzes historical price trends to recommend whether the farmer should sell today or wait/hold.\n"
        "7. `advise_on_best_market`: Compares the local market price for a crop against other Kenyan markets to find the most profitable location.\n\n"
        "IMPORTANT FORMAT RULES:\n"
        "- ALL responses must be in valid JSON format for USSD/SMS gateway integration.\n"
        "- Each tool returns JSON already. Pass it through to the user when appropriate.\n"
        "- For final responses, use this format:\n"
        "  {\"response\": \"your answer here\", \"type\": \"advisory|market|weather|loan\"}\n"
        "- Keep answers concise and actionable (under 320 chars when possible for SMS).\n"
        "- DO NOT use any emojis in your response under any circumstances.\n"
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
        return "continue"
    return "end"


# ── Graph construction ─────────────────────────────────────────────────────

workflow = StateGraph(AgentState)

workflow.add_node("agent", call_model)
workflow.add_node("tools", ToolNode(TOOLS))

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
