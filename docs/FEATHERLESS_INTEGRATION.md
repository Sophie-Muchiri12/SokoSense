# Featherless Integration — SokoSense

## How You Used Featherless

We use Featherless through `https://api.featherless.ai/v1` in our **LangGraph agent** (`POST /api/agent`, SMS Intelligence Simulator) and **advisory engine** (`POST /api/advisory`, `/advisory` page).

When a farmer enters a message or question, we send it to **MiniMaxAI/MiniMax-M3** (`LLM_MODEL_FEATHERLESS`) via the Featherless API. For the agent, input includes the farmer text, system prompt, and tool schemas; the model routes intent and calls backend tools for KAMIS prices, loans, weather, sell timing, markets, or Neo4j advisory RAG. For advisory, input adds graph facts, PDF extracts, and local weather context.

Featherless returns JSON: `{"response": "...", "type": "market|loan|advisory|weather|general"}`. That answer is shown in the simulator Agent reply panel, the Advisory page, and SMS/USSD-ready API responses—all from live Featherless API calls with retrieved context, not copied output.
