"""LangGraph agent workflow for SokoSense agricultural AI assistant.

Defines the state graph, LLM binding, system prompt, and compilation.
All responses are wrapped in JSON format for USSD/SMS integration.
"""

import os
import logging

from dotenv import load_dotenv
from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode

from engines.agent.state import AgentState
from engines.agent.tools import EXECUTABLE_TOOLS, TOOLS

load_dotenv()

logger = logging.getLogger(__name__)

# ── LLM initialisation ─────────────────────────────────────────────────────

groq_api_key = os.getenv("GROQ_API_KEY")
groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

featherless_api_key = os.getenv("FEATHERLSS_API_KEY")
featherless_model = os.getenv("LLM_MODEL_FEATHERLESS", "deepseek-ai/DeepSeek-V4-Flash")

# Prefer Groq (as requested), fallback to Featherless if Groq key is missing.
if groq_api_key:
    llm = ChatOpenAI(
        model=groq_model,
        temperature=0.0,
        openai_api_key=groq_api_key,
        openai_api_base="https://api.groq.com/openai/v1",
    )
    logger.info("Using Groq LLM: %s", groq_model)
elif featherless_api_key:
    llm = ChatOpenAI(
        model=featherless_model,
        temperature=0.0,
        openai_api_key=featherless_api_key,
        openai_api_base="https://api.featherless.ai/v1",
    )
    logger.info("Using Featherless LLM: %s", featherless_model)
else:
    raise ValueError(
        "No LLM API key configured. Set GROQ_API_KEY (preferred) or FEATHERLSS_API_KEY in .env."
    )

llm_with_tools = llm.bind_tools(TOOLS)

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


def call_model(state: AgentState):
    """Call the LLM with the current message history."""
    messages = state["messages"]

    # Prepend system prompt if not already present
    if not any(isinstance(m, SystemMessage) for m in messages):
        messages_to_send = [SYSTEM_PROMPT] + list(messages)
    else:
        messages_to_send = list(messages)

    response = llm_with_tools.invoke(messages_to_send)
    return {"messages": [response]}


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
