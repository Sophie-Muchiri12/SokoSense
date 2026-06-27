"""
SokoSense — Masumi Payment Hook (Mock)
Lucy Kamau · Data Layer Owner

Simulates Masumi's per-query micropayment settlement.
Real integration: Masumi AI agent charges the requesting MFI/SACCO
automatically when a paid endpoint (loan, credit score) is queried.

For the hackathon demo: generates a realistic payment_id and logs the
transaction so the Lovable partner dashboard can display "billing active."
"""

import hashlib
import time
import uuid

# Mock per-query pricing (KSh) — matches the SokoSense business model docs
QUERY_PRICING = {
    "loan":   15,   # KSh 15 per loan risk check
    "credit": 25,   # KSh 25 per ACIS credit score query (higher value)
    "market": 5,    # KSh 5 per market price query
    "timing": 5,    # KSh 5 per timing query
}

# In-memory transaction log for demo purposes
_TRANSACTION_LOG: list[dict] = []


def generate_payment_id(query_type: str, payer: str = "demo-sacco") -> str:
    """
    Generates a mock Masumi payment ID.
    Format mirrors real Masumi transaction IDs: masumi_<hash>
    """
    raw = f"{query_type}-{payer}-{time.time()}-{uuid.uuid4()}"
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"masumi_{digest}"


def charge_query(query_type: str, payer: str = "demo-sacco") -> dict:
    """
    Simulates billing a partner organisation for a single query.
    Call this from any paid engine (loan, credit) after a successful decision.

    Returns:
        {
            "payment_id": str,
            "amount_kes": int,
            "payer": str,
            "query_type": str,
            "status": "settled",
            "timestamp": float,
        }
    """
    amount = QUERY_PRICING.get(query_type, 5)
    payment_id = generate_payment_id(query_type, payer)

    transaction = {
        "payment_id": payment_id,
        "amount_kes": amount,
        "payer": payer,
        "query_type": query_type,
        "status": "settled",
        "timestamp": time.time(),
    }

    _TRANSACTION_LOG.append(transaction)
    return transaction


def get_transaction_log(limit: int = 50) -> list[dict]:
    """Returns recent mock transactions — for partner dashboard billing view."""
    return _TRANSACTION_LOG[-limit:]


def get_revenue_summary() -> dict:
    """
    Aggregates mock revenue — for demo'ing the business model live.
    Shows judges: 'every query just generated automated revenue.'
    """
    total = sum(t["amount_kes"] for t in _TRANSACTION_LOG)
    by_type = {}
    for t in _TRANSACTION_LOG:
        by_type[t["query_type"]] = by_type.get(t["query_type"], 0) + t["amount_kes"]

    return {
        "total_revenue_kes": total,
        "total_queries": len(_TRANSACTION_LOG),
        "revenue_by_type": by_type,
    }


if __name__ == "__main__":
    # Quick manual test
    print("Simulating 3 queries...")
    print(charge_query("loan", "kitale-sacco"))
    print(charge_query("credit", "kitale-sacco"))
    print(charge_query("market", "nakuru-mfi"))
    print()
    print("Revenue summary:")
    print(get_revenue_summary())
