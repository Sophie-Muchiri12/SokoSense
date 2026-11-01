"""SokoSense FastAPI application — farmer decision engine for AgriFin."""

import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import postgres
from routes import admin_market, advisory, auth, decisions, logs, market_data, webhook, agent

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Best-effort Postgres (Supabase) bootstrap: creates pgvector + tables
    # when DATABASE_URL is set. Never fatal — without it the engines use
    # their local fallbacks so the API still serves.
    if postgres.database_url():
        try:
            postgres.init_db()
        except Exception as exc:  # pragma: no cover - network dependent
            logger.warning("Postgres init on startup failed: %s", exc)
    yield


app = FastAPI(
    title="SokoSense",
    description=(
        "Farmer decision engine for Kenya — market and loan recommendations "
        "via SMS-ready API responses (max 320 chars)."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin_market.router)
app.include_router(advisory.router)
app.include_router(decisions.router)
app.include_router(logs.router)
app.include_router(market_data.router)
app.include_router(webhook.router)
app.include_router(agent.router)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "sokosense-api",
        "database": postgres.health(),
    }
