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
from engines.agent.tools import TOOLS

load_dotenv()

logger = logging.getLogger(__name__)

# ── LLM initialisation ─────────────────────────────────────────────────────

featherless_api_key = os.getenv("FEATHERLSS_API_KEY")
featherless_model = os.getenv("LLM_MODEL_FEATHERLESS", "deepseek-ai/DeepSeek-V4-Flash")

if not featherless_api_key:
    raise ValueError("FEATHERLSS_API_KEY is not set in .env")

llm = ChatOpenAI(
    model=featherless_model,
    temperature=0.0,
    openai_api_key=featherless_api_key,
    openai_api_base="https://api.featherless.ai/v1",
)
logger.info("Using Featherless LLM: %s", featherless_model)

llm_with_tools = llm.bind_tools(TOOLS)

# ── System prompt ──────────────────────────────────────────────────────────

SYSTEM_PROMPT = SystemMessage(
    content=(
        "You are a friendly agricultural helper for Kenyan farmers. "
        "Your job is to give practical advice on crop prices, markets, loans, weather, and farming problems.\n\n"
        "You have access to seven tools:\n"
        "1. `scrape_kamis_prices`: Directly queries the KAMIS website. Matches crop names, pulls up to 10 rows, and filters by crop/market/county.\n"
        "2. `search_kamis_via_tavily`: Performs web search on the KAMIS domain when direct scraping yields nothing.\n"
        "3. `advise_on_loan`: Analyzes a farmer's loan request (principal, interest rate, term, compounding) and returns a structured risk verdict.\n"
        "4. `get_farmer_weather`: Fetches current weather + 3-day forecast for a Kenyan location with farming-specific advice.\n"
        "5. `answer_farmer_question`: Runs the full RAG advisory pipeline — queries Neo4j graph & vector store, fetches local weather, and calls LLM.\n"
        "6. `advise_on_sell_timing`: Analyzes historical price trends to recommend whether the farmer should sell today or wait/hold.\n"
        "7. `advise_on_best_market`: Compares the local market price for a crop against other Kenyan markets to find the most profitable location.\n\n"
        "HOW TO WRITE ANSWERS:\n"
        "- Match the farmer's language: Swahili question → Swahili answer; English question → English answer.\n"
        "- Use simple, everyday language — short sentences, no jargon unless you explain it in the same language.\n"
        "- For farming advice: say what the problem is, then 2–3 clear steps the farmer can take.\n"
        "- For prices/markets/loans: lead with the key number or recommendation, then one line of context.\n"
        "- Be warm and practical, like talking to a neighbour.\n"
        "- DO NOT use emojis.\n\n"
        "FORMAT (for SMS/USSD gateways):\n"
        "- Final replies must be valid JSON: "
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
