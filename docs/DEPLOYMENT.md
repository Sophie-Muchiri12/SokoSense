# SokoSense — Deployment (Render + Vercel + Supabase)

Production topology:

| Layer    | Platform | What runs there |
|----------|----------|-----------------|
| Backend  | **Render** (Web Service, `render.yaml`) | FastAPI (`uvicorn main:app --host 0.0.0.0 --port $PORT`), health check `/health` |
| Frontend | **Vercel** (project root: `frontend/`) | TanStack Start SSR (Nitro `vercel` preset, set in `frontend/vercel.json`) |
| Database | **Supabase** | Postgres + **pgvector**: `users` (accounts), advisory knowledge (`crops`/`diseases`/…), RAG `document_chunks` |

> Market prices are **not** in Postgres — the single source of truth is
> `data/market_prices.csv` served by the backend (see §4).

## 0. Pre-flight (verified 2026-10-21)

- Backend: `pytest` → 35 passed; `GET /health` → `{"status":"ok",…}`.
- Frontend: `npm run build` in `frontend/` → succeeds (SSR/Nitro output).
- Responsive: viewport meta in `frontend/src/routes/__root.tsx`, Tailwind
  `sm:`/`md:`/`lg:` breakpoints on every route, desktop nav (`hidden lg:flex`)
  + mobile menu (`lg:hidden`) in `site-header.tsx`.
- Secrets: root `.env` is git-ignored and untracked — never commit it, and
  never put backend secrets in Vercel (only `VITE_API_URL`, which is public).

## 1. Database — Supabase

1. Create a project at [supabase.com](https://supabase.com) (note the DB password).
2. **SQL Editor → New query** → paste `db/schema.sql` → Run.
   (Creates the `vector` extension, `users`, `crops`, `diseases`,
   `crop_diseases`, `locations`, `location_crops`, `document_chunks` +
   HNSW cosine index. All statements are idempotent.)
3. **Project Settings → Database → Connection string → Transaction pooler
   (port 6543)** — copy the URI. This is `DATABASE_URL`:
   `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`
   (Transaction pooler is required: `db/postgres.py` connects with
   `prepare_threshold=None`, which PgBouncer needs.)
4. Seed + load data from your machine (put the Supabase `DATABASE_URL` in
   local `.env` first):
   ```bash
   python scripts/setup_db.py            # schema + crop/disease knowledge seed
   python scripts/setup_db.py --ingest   # + PDF guides → document_chunks (pgvector)
   ```

> The app also runs the same schema bootstrap on startup (`main.py` lifespan
> → `postgres.init_db()`), so step 2 is belt-and-braces. Without
> `DATABASE_URL` the engines still run on local fallbacks, but
> register/login return **503** — production must always set it.

## 2. Backend — Render

1. Render Dashboard → **New → Blueprint** → select this repo (`render.yaml`
   creates the `sokosense-api` web service, Python 3.12.4, free plan,
   health check `/health`).
2. Set every `sync: false` secret in **Render → sokosense-api → Environment**:

   | Variable | Where to get it | Required? |
   |---|---|---|
   | `DATABASE_URL` | Supabase §1.3 (transaction pooler, port **6543**) | ✅ Yes — accounts + RAG |
   | `AUTH_SECRET` | `openssl rand -hex 32` | ✅ Yes — signs login sessions; without it sessions die on every restart |
   | `ADMIN_PIN` | Any **exactly 7 digits** you choose | ✅ Yes — for `/admin-login`; admin is disabled without it |
   | `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) | ✅ Yes — agent (`/api/agent`) + advisory |
   | `TAVILY_API_KEY` | [tavily.com](https://tavily.com) | Optional — KAMIS search fallback |
   | `AT_API_KEY` | [africastalking.com](https://africastalking.com) | Optional — SMS/USSD sending |
   | `AT_SMS_SHORTCODE` | Africa's Talking sender ID/shortcode | Optional — with `AT_API_KEY` |

   Already set by `render.yaml` (no action needed): `PYTHON_VERSION=3.12.4`,
   `GROQ_MODEL=llama-3.3-70b-versatile`, `AT_USERNAME=sandbox`
   (change `AT_USERNAME` to your live Africa's Talking username in production).
   Render sets `PORT` itself — do not set it.

3. Deploy. Verify:
   ```bash
   curl https://sokosense-api.onrender.com/health
   # → {"status":"ok","service":"sokosense-api",
   #    "database":{"configured":true,"status":"ok","pgvector":"0.x.x"}}
   ```
   If `database.status` is not `"ok"`, `DATABASE_URL` is wrong/unreachable.
   Note: the free plan sleeps when idle — the first request may take ~30–60s.

## 3. Frontend — Vercel

1. Vercel Dashboard → **Add New → Project** → import this repo.
2. **Root Directory: `frontend`** (`frontend/vercel.json` already sets
   `installCommand: npm install`, `buildCommand: npm run build`, and
   `NITRO_PRESET=vercel` — do not override the build/output settings).
3. Environment variable (**Settings → Environment Variables**, Production):

   | Variable | Value | Required? |
   |---|---|---|
   | `VITE_API_URL` | `https://sokosense-api.onrender.com` (your Render URL from §2) | ✅ Yes |

   `VITE_*` values are baked in at **build time** and are public — changing
   `VITE_API_URL` requires a redeploy. No other frontend env vars are needed;
   never add `DATABASE_URL`, `AUTH_SECRET`, or API keys here.
4. Deploy. The SSR app calls the Render API directly via `VITE_API_URL`
   (backend CORS is `allow_origins=["*"]`, so the Vercel domain works
   out of the box; tighten it to your Vercel domain in `main.py` after launch
   if desired).
5. Smoke-test on a real phone / DevTools device toolbar (≤375px, 768px,
   ≥1280px): landing, `/market`, `/loans`, `/simulator` — nav collapses to
   the mobile menu below `lg`, grids stack below `sm`.

## 4. KAMIS market data (CSV)

Market prices live in `data/market_prices.csv` in the backend repo, built
from KAMIS:

- manually: `python scripts/collect_market_data.py` (all commodities) or
  `--commodity maize` (merge one commodity's top-10-per-market rows);
- or from the admin portal (`/admin` → **Refresh market data**), which runs
  the same full pipeline via `POST /api/admin/market-refresh`.

A refresh builds a staging CSV and atomically swaps it over the old file;
a failed/empty run keeps the old CSV. Note the CSV lives on the backend's
disk — on Render it is reset by redeploys, so run a refresh after deploying
(a copy is committed in the repo, so prices work immediately, just stale).

## 5. Africa's Talking webhooks (optional, after §2)

Point the Africa's Talking app callbacks at the Render URL (these routes
are public by design — a gateway can't log in):

- USSD callback: `https://sokosense-api.onrender.com/ussd`
- SMS callback: `https://sokosense-api.onrender.com/webhook/sms`

## Local development

```bash
cp .env.example .env          # defaults DATABASE_URL to the local Docker DB
docker compose up -d db       # local Postgres + pgvector on localhost:5434
python scripts/setup_db.py    # schema + seed (optional: app also bootstraps on startup)
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload   # backend
cd frontend && npm install && npm run dev              # UI at :5173, proxies /api → :8000
```

Local Postgres runs in Docker (`docker-compose.yml`, image
`pgvector/pgvector:pg16`, host port **5434** to avoid clashing with a local
Postgres install); Supabase is **production only** — on Render, `DATABASE_URL`
is overridden with the Supabase pooler string (section 1). Registration/login
require `DATABASE_URL` (either one), otherwise they return 503.
