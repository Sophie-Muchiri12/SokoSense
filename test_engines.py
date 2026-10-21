import json
from models import LoanRequest, MarketDecisionRequest, TimingRequest
from engines import loaning, market, timing

def test_all_engines():
    print("=" * 60)
    print("1. TESTING LOANING ENGINE...")
    print("=" * 60)
    # A loan request of 1.5% monthly interest
    loan_req = LoanRequest(monthly_rate_percent=1.5)
    loan_res = loaning.decide_loan(loan_req)
    print("Response type:", type(loan_res))
    print(loan_res.model_dump_json(indent=2))
    print()

    print("=" * 60)
    print("2. TESTING MARKET DECISION ENGINE...")
    print("=" * 60)
    # Market decision for crop tomatoes in Meru
    market_req = MarketDecisionRequest(crop="tomatoes", location="Meru")
    market_res = market.decide_market(market_req)
    print("Response type:", type(market_res))
    print(market_res.model_dump_json(indent=2))
    print()

    print("=" * 60)
    print("3. TESTING TIMING DECISION ENGINE...")
    print("=" * 60)
    # Timing decision for crop tomatoes in Meru
    timing_req = TimingRequest(crop="tomatoes", market="Meru")
    timing_res = timing.decide_timing(timing_req)
    print("Response type:", type(timing_res))
    print(timing_res.model_dump_json(indent=2))
    print("=" * 60)

if __name__ == "__main__":
    test_all_engines()
