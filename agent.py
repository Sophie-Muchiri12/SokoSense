import os
from typing import TypedDict, Annotated, Sequence
from dotenv import load_dotenv
from langchain_core.messages import BaseMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

# Import the custom tools
from kamis_tool import scrape_kamis_prices, search_kamis_via_tavily

# Load environment variables from .env
load_dotenv()

# Define the State of the graph
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]

# Initialize the Groq model
# We can read the model name from env or default to a standard Groq Llama 3 model.
groq_api_key = os.getenv("GROQ_API_KEY")
model_name = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

if not groq_api_key:
    raise ValueError("GROQ_API_KEY is not set in the environment variables.")

# Create the LLM instance
llm = ChatGroq(
    model=model_name,
    temperature=0.0,
    groq_api_key=groq_api_key
)

# Define the tools list
tools = [scrape_kamis_prices, search_kamis_via_tavily]

# Bind the tools to the LLM
llm_with_tools = llm.bind_tools(tools)

# Define system prompt
SYSTEM_PROMPT = SystemMessage(
    content=(
        "You are an advanced agricultural AI assistant specializing in the Kenyan market. "
        "Your goal is to help users find accurate crop prices and market locations using the KAMIS website (https://kamis.kilimo.go.ke/site/market).\n\n"
        "You have access to two tools:\n"
        "1. `scrape_kamis_prices`: Directly queries the KAMIS website. It matches crop names, pulls up to 3000 rows, "
        "and filters the data by crop, market, and county. It handles case sensitivity automatically.\n"
        "2. `search_kamis_via_tavily`: Performs web search on the KAMIS domain.\n\n"
        "Handling Multi-Variety and Specific Queries:\n"
        "- If a user enters a general term like 'maize' or 'beans', you must check for all matching varieties "
        "(e.g., 'Dry Maize', 'Green Maize', 'Maize Flour' for maize; 'Beans Rosecoco', 'Beans Yellow-Green', etc. for beans).\n"
        "- If a user specifies a location (e.g. 'maize nairobi' or 'tomato Kiambu'), resolve the location and crop name "
        "ignoring case sensitivity (e.g., 'mAiZe' -> 'Maize', 'nAiRoBi' -> 'Nairobi'). Always pass the location value "
        "to BOTH `market_name` and `county_name` in `scrape_kamis_prices` tool call. This allows the tool to match either "
        "field and returns complete results in a single call.\n"
        "- **IMPORTANT**: When calling `scrape_kamis_prices`, NEVER include the `limit` argument. "
        "Omit it completely and let the tool use its built-in default of 10 rows.\n"
        "- For queries looking for crop prices in a location, you MUST return the pricing information in a valid JSON block "
        "mapping the varieties to their wholesale and retail prices, county, market, and date. "
        "For example:\n"
        "```json\n"
        "{\n"
        "  \"location\": \"Nairobi\",\n"
        "  \"date\": \"2026-06-15\",\n"
        "  \"prices\": [\n"
        "    {\n"
        "      \"commodity\": \"Dry Maize\",\n"
        "      \"market\": \"Nairobi Grain Market\",\n"
        "      \"wholesale\": \"50.00/Kg\",\n"
        "      \"retail\": \"65.00/Kg\",\n"
        "      \"county\": \"Nairobi\"\n"
        "    },\n"
        "    {\n"
        "      \"commodity\": \"Green Maize\",\n"
        "      \"market\": \"Nairobi City Market\",\n"
        "      \"wholesale\": \"40.00/Kg\",\n"
        "      \"retail\": \"50.00/Kg\",\n"
        "      \"county\": \"Nairobi\"\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "```\n"
        "- Ensure the JSON is well-formatted and enclosed in standard ```json ... ``` tags.\n"
        "- Ensure that case sensitivity does not prevent matching. Treat 'MaIzE' the same as 'maize' and 'NaiROBi' the same as 'Nairobi'.\n"
        "- **CRITICAL**: Do not call the same tool with the same arguments in a loop. If the tool returns data for only a subset of varieties (e.g. only Dry Maize) or returns no matching data, this means no other varieties or data exist in the database for that location. Accept this output and formulate your final response immediately."
    )
)

# Define the node that calls the model
def call_model(state: AgentState):
    messages = state["messages"]
    
    # Prepend the system prompt if it's the start
    if not any(isinstance(m, SystemMessage) for m in messages):
        messages_to_send = [SYSTEM_PROMPT] + list(messages)
    else:
        messages_to_send = list(messages)
        
    response = llm_with_tools.invoke(messages_to_send)
    return {"messages": [response]}

# Define the conditional edge router
def should_continue(state: AgentState):
    last_message = state["messages"][-1]
    # If the model requested tool calls, route to "tools" node
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "continue"
    # Otherwise, stop
    return "end"

# Construct the graph workflow
workflow = StateGraph(AgentState)

# Add the agent and tools nodes
workflow.add_node("agent", call_model)
workflow.add_node("tools", ToolNode(tools))

# Set the entry point
workflow.set_entry_point("agent")

# Add conditional edge from agent
workflow.add_conditional_edges(
    "agent",
    should_continue,
    {
        "continue": "tools",
        "end": END
    }
)

# Add edge from tools back to agent
workflow.add_edge("tools", "agent")

# Compile the graph with a recursion limit to prevent infinite tool-call loops
agent_graph = workflow.compile()
agent_graph = agent_graph.with_config({"recursion_limit": 6})
