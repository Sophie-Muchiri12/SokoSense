import os
import sys
import json
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from engines.agent import agent_graph

# Example queries representing typical farmer interactions
SCENARIOS = [
    {
        "title": "Scenario 1: Crop Price Search",
        "query": "What is the price of tomatoes in Meru county?"
    },
    {
        "title": "Scenario 2: Timing Analysis",
        "query": "Should I sell my maize today in Nakuru or wait?"
    },
    {
        "title": "Scenario 3: Loan Assessment",
        "query": "I want to borrow KSh 50,000 at 1.5% monthly interest for 6 months compounded monthly. Is it safe?"
    },
    {
        "title": "Scenario 4: Weather & Advisory RAG Pipeline",
        "query": "I am in Meru. My maize leaves are showing orange-brown pustules. What is the cause and remedy?"
    }
]

def run_query(query: str):
    state = {"messages": [HumanMessage(content=query)]}
    print("-" * 50)
    print(f"Farmer Query: {query}")
    print("-" * 50)

    try:
        for event in agent_graph.stream(state, stream_mode="values"):
            if "messages" in event and event["messages"]:
                last_msg = event["messages"][-1]
                
                # Check for tool calls or final AI response
                if last_msg.type == "ai":
                    if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
                        for tool_call in last_msg.tool_calls:
                            print(f"  [Tool Call] -> {tool_call['name']}({tool_call['args']})")
                    else:
                        print("\nAgent Final JSON Response:")
                        # Attempt to pretty print JSON if response is a JSON string
                        try:
                            parsed = json.loads(last_msg.content)
                            print(json.dumps(parsed, indent=2))
                        except Exception:
                            print(last_msg.content)
                elif last_msg.type == "tool":
                    # Tool output summary
                    content_str = str(last_msg.content)
                    if len(content_str) > 200:
                        content_str = content_str[:200] + "..."
                    print(f"  [Tool Output] <- {last_msg.name}: {content_str}")
    except Exception as e:
        print(f"Error executing query: {e}")
    print("\n" + "="*70 + "\n")

def run_interactive():
    print("SokoSense Farmer Agent Interactive Test CLI")
    print("===========================================")
    print("Type your query or 'exit'/'quit' to stop.\n")
    while True:
        try:
            query = input("Farmer> ").strip()
            if not query:
                continue
            if query.lower() in ["exit", "quit"]:
                break
            run_query(query)
        except KeyboardInterrupt:
            break
    print("\nExiting interactive test.")

def main():
    load_dotenv()
    
    # Check if a custom query is passed
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        if query.lower() == "--scenario":
            print("Running Predefined Farmer Scenarios...\n" + "="*70 + "\n")
            for sc in SCENARIOS:
                print(f"=== {sc['title']} ===")
                run_query(sc["query"])
        else:
            run_query(query)
    else:
        # Default to interactive mode with hint on how to run scenarios
        print("To run all predefined scenarios, run: python test_agent.py --scenario\n")
        run_interactive()

if __name__ == "__main__":
    main()
