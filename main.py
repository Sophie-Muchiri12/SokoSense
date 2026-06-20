"""SokoSense FastAPI application — farmer decision engine for AgriFin."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import decisions, logs, market_data, webhook

app = FastAPI(
    title="SokoSense",
    description=(
        "Farmer decision engine for Kenya — market, timing, and loan recommendations "
        "via SMS-ready API responses (max 320 chars)."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(decisions.router)
app.include_router(logs.router)
app.include_router(market_data.router)
app.include_router(webhook.router)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "sokosense-api"}
