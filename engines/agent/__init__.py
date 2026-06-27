"""SokoSense Agent — LangGraph-based agricultural AI assistant.

This package contains the agent graph, tools, and state definitions.
The agent orchestrates KAMIS price scraping, loan advisory, weather,
and the RAG advisory pipeline.

Usage:
    from engines.agent import agent_graph
    result = agent_graph.invoke({"messages": [HumanMessage(content="...")]})
"""

from engines.agent.graph import agent_graph

__all__ = ["agent_graph"]
