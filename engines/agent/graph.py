"""LangGraph agent workflow for SokoSense agricultural AI assistant.

Defines the state graph, LLM binding, system prompt, and compilation.
All responses are wrapped in JSON format for USSD/SMS integration.
"""

import os
import logging
import uuid

from dotenv import load_dotenv
from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode

from engines.agent.state import AgentState
from engines.agent.tools import TOOLS

load_dotenv()

logger = logging.getLogger(__name__)

# ── LLM initialisation ─────────────────────────────────────────────────────

featherless_api_key = os.getenv("FEATHERLSS_API_KEY")
featherless_model = os.getenv("LLM_MODEL_FEATHERLESS", "deepseek-ai/DeepSeek-V4-Flash")

if not featherless_api_key:
    raise ValueError("FEATHERLSS_API_KEY is not set in .env")

# Bounded timeout + retries so an unreachable/slow LLM provider fails fast with a
# clean error instead of hanging the SMS/USSD request path for ~90s (the default
# client retries with exponential backoff, which is unusable for a gateway).
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "45"))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "1"))

llm = ChatOpenAI(
    model=featherless_model,
    temperature=0.0,
    openai_api_key=featherless_api_key,
    openai_api_base="https://api.featherless.ai/v1",
    timeout=LLM_TIMEOUT_SECONDS,
    max_retries=LLM_MAX_RETRIES,
)
logger.info("Using Featherless LLM: %s", featherless_model)

llm_with_tools = llm.bind_tools(TOOLS)


def _build_fallback_llm_with_tools():
    """Optional Groq fallback so the agent keeps working when Featherless is
    unreachable. Activated only when GROQ_API_KEY is set and langchain-groq is
    installed; otherwise the agent runs on Featherless alone.
    """
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        return None
    try:
        from langchain_groq import ChatGroq
    except ImportError:
        logger.warning("GROQ_API_KEY set but langchain-groq not installed; skipping fallback.")
        return None
    try:
        groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        groq_llm = ChatGroq(
            model=groq_model,
            temperature=0.0,
            api_key=groq_api_key,
            timeout=LLM_TIMEOUT_SECONDS,
            max_retries=LLM_MAX_RETRIES,
        )
        logger.info("Groq fallback LLM enabled: %s", groq_model)
        return groq_llm.bind_tools(TOOLS)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Failed to initialise Groq fallback LLM: %s", exc)
        return None


_fallback_llm_with_tools = _build_fallback_llm_with_tools()
if _fallback_llm_with_tools is not None:
    # LangChain runs the primary first and only invokes the fallback if the
    # primary raises (e.g. connection error / timeout).
    llm_with_tools = llm_with_tools.with_fallbacks([_fallback_llm_with_tools])

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

    Some OpenAI-compatible models (e.g. MiniMax via Featherless) intermittently
    emit tool calls with a missing/``None`` id. LangGraph's ToolNode builds a
    ``ToolMessage(tool_call_id=call["id"])`` for these calls — most notably when
    validating a hallucinated tool name — and a ``None`` id raises a pydantic
    ValidationError that crashes the whole graph. Backfilling a valid id keeps
    the agent loop alive so the model can recover from its own bad output.
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
