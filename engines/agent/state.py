"""Agent state definition for the LangGraph agricultural assistant."""

from typing import TypedDict, Annotated, Sequence

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """State of the LangGraph agent.

    Contains the conversation message history. Each node in the graph
    reads from and appends to messages.
    """
    messages: Annotated[Sequence[BaseMessage], add_messages]
