# SokoSense — Farmer Decision Engine for AgriFin

SokoSense turns raw market data into **one clear instruction** for Kenyan smallholder farmers — via SMS, USSD, and demo UI. Rule-based engines (market, loan) return ≤320-character decisions. Built for Kenya AI Challenge 2026 · AgriFin Track.

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
   *(This installs everything, including `psycopg`/`pgvector` for the Supabase Postgres backend.)*

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
The UI is served at `http://localhost:5173` and talks to the backend live.

The frontend reads the backend URL from `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
```
Start the backend first so the UI can reach it. Pages wired to the live API:
- **Simulator** (`/simulator`) → `POST /api/agent` (full LangGraph agent)
- **Loan Analyzer** (`/loans`) → `POST /api/loan` (live APR + risk verdict)
- **Market Map** (`/market`) → `GET /api/market-prices` (KAMIS market CSV feed)
- **Operations** (`/admin`) → `GET /health` (live API status badge)

### Market data (KAMIS → CSV / live)

By default, market prices come from **one CSV file** (`data/market_prices.csv`,
path override: `MARKET_CSV_PATH`), built by the collector below. Engines, the
market map, and the agent read it via `data/market_csv.py`. Each commodity
keeps its **10 most recent rows per market/county** (by KAMIS report date).

Set **`USE_LIVE=true`** in `.env` to pull from the live KAMIS portal
(`https://kamis.kilimo.go.ke`) on price requests (short-cached ~5 min). If the
portal is unreachable or returns nothing, the CSV is used as fallback.

Collect it manually (run from the project root):

```bash
python scripts/collect_market_data.py                  # every KAMIS commodity → rebuild CSV
python scripts/collect_market_data.py --commodity maize  # refresh one commodity, merged in
python scripts/collect_market_data.py --list           # list what KAMIS offers
```

Or use the **Refresh market data** button in the admin portal (`/admin`),
which runs the full pipeline via `POST /api/admin/market-refresh`. Either
way the new CSV is built first and atomically swapped in — the old file is
removed from the serving path only once the new one is ready, and a failed
or empty scrape leaves the old CSV serving.

### Accounts, roles & admin access

The landing page (`/`) is the only public page. Everything else requires an
account, enforced in the UI **and** on the API (unauthenticated calls to
`/api/market`, `/api/loan`, `/api/agent`, `/api/market-prices`, … return 401):

- **Register / log in** (`/register`, `/login`) — phone number + password.
  Roles: **farmer** (market, loans, advisory, simulator, USSD) and
  **sacco** (everything a farmer has, plus the SACCO dashboard at `/sacco`).
  Accounts live in Postgres (`users` table) — `DATABASE_URL` must be set;
  without it register/login respond 503 by design. **Locally** run it in
  Docker: `docker compose up -d db`, with
  `DATABASE_URL=postgresql://sokosense:sokosense_dev@localhost:5434/sokosense`
  in `.env` (the `.env.example` default). **In production** `DATABASE_URL`
  is the Supabase connection string, set on Render — see
  [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- **Admin** — the **Admin** button in the footer opens `/admin-login`, where
  the 7-digit `ADMIN_PIN` from `.env` is exchanged for an admin session that
  unlocks `/admin` (including logs and the market-data refresh). Set it and
  `AUTH_SECRET` (session signing) in `.env`:
  `AUTH_SECRET=<openssl rand -hex 32>`, `ADMIN_PIN=<7 digits>`.

Kept public on purpose: `/health` and the Africa's Talking webhooks
(`/ussd`, `/webhook/sms`) — a gateway can't log in.

### Available API endpoints
| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/health` | Service health check |
| POST | `/api/agent` | Full LangGraph agent (price, advisory, weather, loan) |
| POST | `/api/market` | Market decision engine |
| POST | `/api/loan` | Loan-risk engine |
| POST | `/api/advisory` | RAG crop advisory |
| GET  | `/api/market-prices` | KAMIS market prices (from CSV) |
| POST/GET | `/api/admin/market-refresh` | Start / poll a KAMIS → CSV refresh (admin) |
| GET  | `/api/logs` | Decision logs (admin PIN session) |
| POST | `/api/auth/register` · `/api/auth/login` | Create account / log in (phone + password) |
| POST | `/api/auth/admin-login` | Exchange the 7-digit `ADMIN_PIN` for an admin session |
| POST | `/ussd` | Africa's Talking USSD webhook |
| POST | `/webhook/sms` | Africa's Talking SMS webhook |

> **Note:** Some features need credentials in `.env` (Groq for the agent and advisory,
> a Postgres `DATABASE_URL` for accounts/pgvector storage, Africa's Talking for
> SMS/USSD). Copy `.env.example` to `.env` and fill them in. For local dev the
> database is the Docker container (`docker compose up -d db`); production uses
> Supabase via `DATABASE_URL` on Render. Without `DATABASE_URL`
> the platform falls back to the bundled SQLite price cache + in-code seed
> knowledge, and the rule-based engines (`/api/loan`, `/api/market`)
> work without any keys — but registration/login return 503.
>
> **Deploy:** Backend on **Render** (`render.yaml`), frontend on **Vercel**
> (`frontend/vercel.json`), database on **Supabase** — see
> [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). One-time DB setup:
> `python scripts/setup_db.py --ingest`

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
