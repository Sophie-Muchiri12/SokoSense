"""Pydantic models for the advisory (RAG + weather) engine."""

from pydantic import BaseModel, Field


class AdvisoryRequest(BaseModel):
    """Request from a farmer — a question about crops, diseases, or farming advice."""
    query: str = Field(
        ...,
        min_length=3,
        examples=["What causes maize rust in Nakuru?"],
        description="Farmer's question, may include a location.",
    )


class AdvisoryResponse(BaseModel):
    """Structured JSON response from the advisory engine."""
    query: str
    answer: str
    location: str | None = None
    weather: dict | None = None
    market: dict | None = None
    sources: list[str] = []
