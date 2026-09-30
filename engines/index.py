import os
import sys
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from engines.agent import agent_graph
from engines.rate_limiter import agent_query_limiter

def run_query(query: str):
    # Enforce max 5 agent queries per minute
    agent_query_limiter.acquire()

    print("=" * 60)
    print(f"USER QUERY: {query}")
    print("=" * 60)
    
    # Initialize the state with the user's message
    state = {
        "messages": [HumanMessage(content=query)]
    }
    
    # Stream the events from the graph to see the agent's progress
    try:
        for event in agent_graph.stream(state, stream_mode="values"):
            # Check the last message in the streamed state
            if "messages" in event and event["messages"]:
                last_msg = event["messages"][-1]
                
                # Print information about what node just ran
                if last_msg.type == "ai":
                    if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
                        for tool_call in last_msg.tool_calls:
                            print(f"\nAgent is calling tool '{tool_call['name']}' with arguments:")
                            print(f"   {tool_call['args']}")
                    else:
                        print("\nAgent response:")
                        print(last_msg.content)
                elif last_msg.type == "tool":
                    print(f"\nTool '{last_msg.name}' returned output:")
                    # Truncate output if it is very long to avoid cluttered terminal
                    output_str = str(last_msg.content)
                    if len(output_str) > 500:
                        print(output_str[:500] + "\n... [TRUNCATED FOR BREVITY] ...")
                    else:
                        print(output_str)
                        
    except Exception as e:
        err_str = str(e)
        if "rate_limit_exceeded" in err_str or "429" in err_str:
            import re
            retry_match = re.search(r"try again in (\S+)", err_str)
            retry_in = retry_match.group(1) if retry_match else "a few minutes"
            print(f"\nLLM API rate limit reached. Please try again in {retry_in}.")
            print("   (This is a free-tier quota limit — your query and data retrieval worked fine.)")
        elif "recursion_limit" in err_str.lower() or "GraphRecursionError" in err_str:
            print("\nThe agent made too many tool calls without finishing. Please rephrase your query.")
        else:
            print(f"\nAn error occurred during execution: {e}")
    print("=" * 60 + "\n")

def main():
    load_dotenv()
    
    # If a query is passed as a command-line argument, run it
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        run_query(query)
        return
        
    print("Welcome to the SokoSense KAMIS Market Price Agent!")
    print("Type your query below (e.g. 'What is the price of Tomatoes in Meru county?')")
    print("Type 'exit' or 'quit' to close.\n")
    
    while True:
        try:
            query = input("Ask SokoSense> ").strip()
            if not query:
                continue
            if query.lower() in ["exit", "quit"]:
                break
            run_query(query)
        except KeyboardInterrupt:
            print("\nExiting...")
            break

if __name__ == "__main__":
    main()
