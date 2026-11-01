from fastapi import APIRouter, Depends

from auth.security import get_current_user

from engines import loaning, market
from models import (
    LoanRequest,
    LoanResponse,
    MarketDecisionRequest,
    MarketDecisionResponse,
)

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/api", tags=["decisions"])


@router.post("/market", response_model=MarketDecisionResponse)
def post_market_decision(body: MarketDecisionRequest) -> MarketDecisionResponse:
    return market.decide_market(body)


@router.post("/loan", response_model=LoanResponse)
def post_loan_decision(body: LoanRequest) -> LoanResponse:
    return loaning.decide_loan(body)
