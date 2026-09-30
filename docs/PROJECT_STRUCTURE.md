# SokoSense — Project Folder Structure

**Single source of truth for repo layout.** Everyone builds inside these folders.

---

## Repo layout

```
SokoSense/
│
├── contract.json                 # Sophie — API JSON shapes, everyone reviews
├── main.py                       # Sophie — FastAPI entry: uvicorn main:app
├── requirements.txt
├── .env.example
├── README.md
│
├── agent.py                      # Job — LangGraph CLI agent (stays at root)
├── index.py                      # Job — CLI entry: python index.py "maize nairobi"
├── kamis_tool.py                 # Job — KAMIS price scrape + crop mapping (stays at root)
├── rate_limiter.py               # Job — sliding-window rate limits (stays at root)
├── sms_integration_plan.md       # Job — SMS architecture doc (stays at root for now)
│
├── models/                       # Sophie — Pydantic API schemas only
│   ├── __init__.py
│   ├── common.py
│   ├── market.py
│   ├── timing.py
│   ├── loan.py
│   ├── logs.py
│   └── market_map.py
│
├── engines/                      # Job — all three decision engines
│   ├── __init__.py
│   ├── market.py                 # Where to sell
│   ├── timing.py                 # When to sell
│   ├── loaning.py                # APR + verdict (+ decide_loan for API)
│   └── market_prices.py          # Price table for Ian's map
│
├── data/                         # Lucy (+ Job integrations as needed)
│   ├── neo4j_client.py           # Lucy — AuraDB connection
│   ├── price_pipeline.py         # Lucy — load prices into Neo4j
│   ├── trends.py                 # Lucy — get_trend(crop, market) → float
│   └── masumi_hook.py            # Lucy — payment log on /api/loan
│
├── parser/                       # Sophie + Job — SMS input only (NOT decisions)
│   ├── prompts.py
│   └── regex_fallback.py
│
├── routes/                       # Sophie + Lucy — HTTP handlers only
│   ├── __init__.py
│   ├── decisions.py              # POST /api/market, /timing, /loan
│   ├── logs.py                   # GET /api/logs
│   ├── market_data.py            # GET /api/market-prices
│   ├── webhook.py                # SMS parser + USSD handler (rule-based, EN/SW)
│   ├── webhook_sms.py            # POST /webhook/sms — Lucy (Africa's Talking)
│   └── webhook_ussd.py           # POST /webhook/ussd — Lucy (*384*543#)
│
├── middleware/                   # Sophie
│   ├── __init__.py
│   └── query_logger.py           # SQLite log on every API call
│
├── tests/                        # All
│   ├── test_api.py
│   ├── test_market_engine.py     # Job
│   ├── test_timing_engine.py     # Job
│   ├── test_loan_engine.py       # Job
│   └── test_sms_parser.py        # Sophie + Job
│
├── docs/                         # All
│   ├── PROJECT_STRUCTURE.md      # This file
│   ├── sms_templates.md          # Ian — EN/SW copy (≤320 chars)
│   └── demo_script.md            # Sophie — 5-min demo
│
└── frontend/                     # Ian — demo screens
    ├── design-tokens.css
    ├── sms-simulator/
    ├── market-map/
    ├── loan-explainer/
    ├── ussd-flow/
    └── admin-dashboard/
```

---

## Root files (stay at repo root)

| File | Owner | Purpose |
|------|-------|---------|
| `agent.py` | Job | LangGraph agent — uses `kamis_tool` + `engines/loaning` tools |
| `index.py` | Job | CLI runner for `agent.py` |
| `kamis_tool.py` | Job | Scrape KAMIS prices, crop ID mapping |
| `rate_limiter.py` | Job | Rate-limit KAMIS HTTP + agent queries |
| `sms_integration_plan.md` | Job | AT webhook architecture & SMS formatting rules |

These are **not** moved into `data/` or `legacy/` — they remain at root for Job's CLI and KAMIS tooling.

---

## File-by-file: who owns it & what it does

| File | Owner | Purpose |
|------|-------|---------|
| `main.py` | Sophie | FastAPI app |
| `contract.json` | Sophie | JSON contract for whole team |
| `models/*` | Sophie | API request/response schemas |
| `routes/*` | Sophie + Lucy | FastAPI endpoints + AT webhooks |
| `middleware/*` | Sophie | Query logging |
| `engines/market.py` | Job | Market decision engine |
| `engines/timing.py` | Job | Timing decision engine |
| `engines/loaning.py` | Job | Loan APR calculation, agent tool, `decide_loan()` |
| `engines/market_prices.py` | Job | Map price data for frontend |
| `data/*` | Lucy | Neo4j, price pipeline, trends, Masumi |
| `parser/*` | Sophie + Job | SMS text → `{crop, location, intent}` |
| `frontend/*` | Ian | Demo UI screens |
| `docs/*` | All | Plans, templates, demo script |

---

## Who owns what (folders)

| Folder | Owner | Contains |
|--------|-------|----------|
| `engines/` | **Job** | `market.py`, `timing.py`, `loaning.py` — all decision logic |
| `data/` | **Lucy** | Neo4j, price pipeline, trends, Masumi hooks |
| `parser/` | **Sophie + Job** | SMS text → structured `{crop, location, intent}` |
| `models/` | **Sophie** | Pydantic schemas only — no logic |
| `routes/` | **Sophie + Lucy** | HTTP + AT webhooks (handlers call engines/parser) |
| `middleware/` | **Sophie** | Query logging |
| `frontend/` | **Ian** | UI screens |
| `docs/` | **All** | Plans, templates, demo script |

---

## SMS flow (production path)

```
Farmer SMS
    ↓
Africa's Talking  →  routes/webhook_sms.py     (Lucy — see sms_integration_plan.md)
    ↓
parser/sms_parser.py                            (Sophie + Job — extract crop/location/intent)
    ↓
engines/market.py | timing.py | loaning.py      (Job — one clear decision)
    ↓
models/* Response                               (Sophie — fixed JSON shape)
    ↓
Format ≤320 chars  →  AT Send SMS  →  Farmer
```

Ian’s SMS Simulator hits the same path via `POST /webhook/sms` or `POST /api/market`.

**Note:** `agent.py` + `index.py` are Job's **CLI dev tools** for testing KAMIS/loan tools locally. Production SMS goes through `parser/` + `engines/`, not `agent_graph`.

---

## Naming rules

1. **Job owns all decision logic** in `engines/` — one file per engine.
2. **Public engine functions:** `decide_market()`, `decide_timing()`, `decide_loan()` (in `loaning.py`).
3. **No root-level `*_engine/` folders** — loan logic lives in `engines/loaning.py`.
4. **`kamis_tool.py`, `rate_limiter.py`, `agent.py`, `index.py` stay at root** — Job's CLI and KAMIS tooling.
5. **All API types** in `models/` — engines import from `models`, never invent their own shapes.
6. **`data/` is for Lucy's integrations** — Neo4j, trends, Masumi; not a home for root CLI files.

---

*Kenya AI Challenge 2026 · SokoSense · update this file when the team agrees changes.*

<!-- 


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

--- -->