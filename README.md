# SokoSense — Farmer Decision Engine for AgriFin

SokoSense turns raw market data into **one clear instruction** for Kenyan smallholder farmers — via SMS, USSD, and demo UI. Three rule-based engines (market, timing, loan) return ≤320-character decisions. Built for Kenya AI Challenge 2026 · AgriFin Track.

## Quick start (FastAPI — under 5 minutes)

1. **Clone and enter the repo:**
   ```bash
   cd SokoSense
   ```

2. **Virtual environment and dependencies:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Environment (optional for mock API):**
   ```bash
   cp .env.example .env
   ```
   Mock endpoints work without API keys. Add keys when wiring LLM parser, Neo4j, and Africa's Talking.

4. **Run the API:**
   ```bash
   uvicorn main:app --reload
   ```
   Open [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) for interactive Swagger UI.

5. **Smoke test:**
   ```bash
   pytest tests/test_api.py -q
   ```

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| POST | `/api/market` | Where to sell — `{ "crop": "maize", "location": "nakuru" }` |
| POST | `/api/timing` | When to sell — `{ "crop": "maize", "market": "nakuru" }` |
| POST | `/api/loan` | Loan APR verdict — `{ "monthly_rate_percent": 10 }` |
| GET | `/api/logs` | Query log (empty until logging middleware) |
| GET | `/api/market-prices?crop=maize` | Map price table for Ian's dashboard |

Request/response shapes: see **`contract.json`** in the repo root.

### Example — Wanjiku's market decision

```bash
curl -s -X POST http://127.0.0.1:8000/api/market \
  -H "Content-Type: application/json" \
  -d '{"crop":"maize","location":"nakuru"}' | python3 -m json.tool
```

Expected `short_reply`: *SELL IN ELDORET. KSh 600 more per bag. Worth the trip.*

## Project structure

```
engines/          # Decision engines  — market, timing, loan
models/           # Shared Pydantic schemas
routes/           # FastAPI route handlers
middleware/       # Query logging (Sophie D1 17:00)
main.py           # App entry — uvicorn main:app
contract.json     # API contract for Ian, Lucy, Job
```

## Legacy CLI — KAMIS Market Price Agent

Job's LangGraph KAMIS scraper still runs separately (research / data prototyping):

```bash
python index.py "maize nairobi"
```

---

## Features (KAMIS CLI agent)
- **Multi-crop / Variety Resolution**: Resolves broad crop queries (e.g., "maize") into specific product varieties (e.g., "Dry Maize", "Green Maize", "Maize Flour") automatically.
- **Robust Case Insensitivity**: Processes crop names and locations regardless of how they are capitalized (e.g., `dRy MAiZe kAkAmEgA`).
- **Adaptive Page Sizing**: Smart pagination (`per_page=10` by default to prevent overloading the server; `per_page=100` dynamically when location filtering is needed).
- **Dual-Layer Rate Limiting**: Built-in sliding-window rate limiting (max 5 requests/minute) for both user queries and outgoing KAMIS server requests.
- **Structured JSON Response**: Returns a clean JSON block mapping crops to their wholesale/retail prices, county, market, and date.
- **Fail-safe Search fallback**: Uses Tavily API to look up broader agricultural context on the KAMIS domain if direct scraping returns no data.

---

## Installation & Setup

1. **Clone the repository** (or navigate to the project folder):
   ```bash
   cd SokoSense
   ```

2. **Initialize a virtual environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
   *(Ensure you have `pandas`, `beautifulsoup4`, `lxml`, `requests`, `langchain`, `langgraph`, `langchain-groq`, `tavily-python`, and `python-dotenv` installed).*

4. **Configure Environment Variables**:
   Create a `.env` file in the root directory based on `.env.example`:
   ```bash
   cp .env.example .env
   Fill in your credentials:
   ```env
   FEATHERLSS_API_KEY=your_featherless_api_key_here
   LLM_MODEL_FEATHERLESS=MiniMaxAI/MiniMax-M3
   GROQ_API_KEY=your_groq_api_key_here
   TAVILY_API_KEY=your_tavily_api_key_here
   ```

---

## How to Run

You can run SokoSense in two ways:

### 1. Single-Shot CLI Query
Pass your query directly as a command-line argument:
```bash
python index.py "maize nairobi"
```

### 2. Interactive CLI Mode
Run the script without arguments to enter an interactive session:
```bash
python index.py
```
You can then ask questions sequentially:
```text
Welcome to the SokoSense KAMIS Market Price Agent!
Type your query below (e.g. 'What is the price of Tomatoes in Meru county?')
Type 'exit' or 'quit' to close.

Ask SokoSense> What is the price of tomatoes in Meru?
...
```

---

## Example JSON Output

When querying for prices in a location, SokoSense outputs a structured JSON block:

```json
{
  "location": "Nairobi",
  "date": "2026-06-15",
  "prices": [
    {
      "commodity": "Dry Maize",
      "market": "Kawangware",
      "wholesale": "55.00/Kg",
      "retail": "65.00/Kg",
      "county": "Nairobi"
    },
    {
      "commodity": "Maize Flour",
      "market": "Nairobi Supermarkets",
      "wholesale": "-",
      "retail": "79.50/Kg",
      "county": "Nairobi"
    }
  ]
}
```
