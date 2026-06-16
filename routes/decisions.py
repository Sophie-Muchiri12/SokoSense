from fastapi import APIRouter

from engines import loaning, market, timing
from models import (
    LoanRequest,
    LoanResponse,
    MarketDecisionRequest,
    MarketDecisionResponse,
    TimingRequest,
    TimingResponse,
)

router = APIRouter(prefix="/api", tags=["decisions"])


@router.post("/market", response_model=MarketDecisionResponse)
def post_market_decision(body: MarketDecisionRequest) -> MarketDecisionResponse:
    return market.decide_market(body)


@router.post("/timing", response_model=TimingResponse)
def post_timing_decision(body: TimingRequest) -> TimingResponse:
    return timing.decide_timing(body)


@router.post("/loan", response_model=LoanResponse)
def post_loan_decision(body: LoanRequest) -> LoanResponse:
    return loaning.decide_loan(body)
