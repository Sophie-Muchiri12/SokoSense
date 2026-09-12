# SokoSense — Farmer Decision Engine for AgriFin

SokoSense turns raw market data into **one clear instruction** for Kenyan smallholder farmers — via SMS, USSD, and demo UI. Three rule-based engines (market, timing, loan) return ≤320-character decisions. Built for Kenya AI Challenge 2026 · AgriFin Track.

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
   *(Ensure you have `pandas`, `beautifulsoup4`, `lxml`, `requests`, `langchain`, `langgraph`, `langchain-openai`, `tavily-python`, and `python-dotenv` installed).*

4. **Configure Environment Variables**:
   Create a `.env` file in the root directory based on `.env.example`:
   ```bash
   cp .env.example .env
   Fill in your credentials:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   GROQ_MODEL=llama-3.3-70b-versatile
   TAVILY_API_KEY=your_tavily_api_key_here
   ```

---

## How to Run (Full Stack)

SokoSense has two parts: a **FastAPI backend** (decision engines + agent API) and a
**React/Vite frontend** (demo UI). Run them in two separate terminals.

### 1. Backend API (FastAPI)
From the project root, with the virtual environment activated and dependencies installed:
```bash
source venv/bin/activate          # or: python3 -m venv venv && pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
- API root: `http://localhost:8000`
- Health check: `http://localhost:8000/health`
- Interactive API docs (Swagger): `http://localhost:8000/docs`

Quick test:
```bash
curl -X POST http://localhost:8000/api/loan \
  -H "Content-Type: application/json" \
  -d '{"monthly_rate_percent": 10.0}'

curl -X POST http://localhost:8000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"message": "What are the current maize prices in Nakuru?"}'
```

### 2. Frontend (React + Vite)
In a second terminal:
```bash
cd frontend
npm install        # first time only (bun also works if installed)
npm run dev
```
The UI is served at `http://localhost:8080` and talks to the backend live.

The frontend reads the backend URL from `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
```
Start the backend first so the UI can reach it. Pages wired to the live API:
- **Simulator** (`/simulator`) → `POST /api/agent` (full LangGraph agent)
- **Loan Analyzer** (`/loans`) → `POST /api/loan` (live APR + risk verdict)
- **Market Map** (`/market`) → `GET /api/market-prices` (live price feed)
- **Operations** (`/admin`) → `GET /health` (live API status badge)

### Available API endpoints
| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/health` | Service health check |
| POST | `/api/agent` | Full LangGraph agent (price, advisory, weather, loan) |
| POST | `/api/market` | Market decision engine |
| POST | `/api/timing` | Sell-timing engine |
| POST | `/api/loan` | Loan-risk engine |
| POST | `/api/advisory` | RAG crop advisory |
| GET  | `/api/market-prices` | KAMIS market prices |
| GET  | `/api/logs` | Decision logs |
| POST | `/ussd` | Africa's Talking USSD webhook |
| POST | `/webhook/sms` | Africa's Talking SMS webhook |

> **Note:** Some features need API keys in `.env` (Groq for the agent and advisory,
> Neo4j for advisory, Africa's Talking for SMS/USSD). Copy `.env.example` to `.env`
> and fill in credentials. The rule-based engines (`/api/loan`, `/api/timing`,
> `/api/market`) work without any keys.
>
> **Deploy:** See [docs/RAILWAY.md](docs/RAILWAY.md) for Railway (two services) or use `render.yaml` for Render.

---

## CLI agent (KAMIS price tool, optional)

The standalone KAMIS market-price agent can also be run directly:
```bash
python engines/index.py "maize nairobi"     # single query
python engines/index.py                      # interactive mode
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
