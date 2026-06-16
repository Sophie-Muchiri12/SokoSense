from typing import Literal

from pydantic import BaseModel, Field, field_validator

from models.common import truncate_sms


class MarketDecisionRequest(BaseModel):
    crop: str = Field(..., min_length=1, examples=["maize"])
    location: str = Field(..., min_length=1, examples=["nakuru"])


class MarketDecisionResponse(BaseModel):
    crop: str
    location: str
    recommendation: Literal["SELL_HERE", "SELL_IN_MARKET", "WAIT"]
    short_reply: str = Field(..., max_length=320)
    market_name: str | None = None
    best_market: str | None = None
    local_price_kes: float | None = None
    best_price_kes: float | None = None
    price_diff_kes: float | None = None

    @field_validator("short_reply")
    @classmethod
    def enforce_sms_limit(cls, value: str) -> str:
        return truncate_sms(value)
