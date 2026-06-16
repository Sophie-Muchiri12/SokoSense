from typing import Literal

from pydantic import BaseModel, Field, field_validator

from models.common import truncate_sms


class TimingRequest(BaseModel):
    crop: str = Field(..., min_length=1, examples=["maize"])
    market: str = Field(..., min_length=1, examples=["nakuru"])


class TimingResponse(BaseModel):
    crop: str
    market: str
    recommendation: Literal["SELL_TODAY", "WAIT"]
    short_reply: str = Field(..., max_length=320)
    wait_days: int | None = None
    reason: str

    @field_validator("short_reply")
    @classmethod
    def enforce_sms_limit(cls, value: str) -> str:
        return truncate_sms(value)
