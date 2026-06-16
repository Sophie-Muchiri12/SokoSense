from typing import Literal

from pydantic import BaseModel


class LogEntry(BaseModel):
    timestamp: str
    raw_input: str
    engine: Literal["market", "timing", "loan", "sms"]
    short_reply: str
    latency_ms: int
    error: str | None = None


class LogListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[LogEntry]
