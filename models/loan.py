from enum import Enum

from pydantic import BaseModel, Field, field_validator

from models.common import truncate_sms


class RiskVerdict(str, Enum):
    SAFE = "SAFE"
    CAUTION = "CAUTION"
    HIGH_RISK = "HIGH_RISK"
    AVOID = "AVOID"


class LoanRequest(BaseModel):
    monthly_rate_percent: float = Field(..., ge=0, examples=[10.0])


class LoanResponse(BaseModel):
    monthly_rate_percent: float
    apr_percent: float
    cbk_rate_percent: float = 13.0
    risk_verdict: RiskVerdict
    short_reply: str = Field(..., max_length=320)
    comparison_phrase: str = Field(..., max_length=320)
    payment_id: str | None = None

    @field_validator("short_reply", "comparison_phrase")
    @classmethod
    def enforce_sms_limit(cls, value: str) -> str:
        return truncate_sms(value)
