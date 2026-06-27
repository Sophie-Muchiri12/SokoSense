"""
SokoSense Loan Decision Engine
Matches farmers to the best agricultural lender based on APR and eligibility.

Usage:
    from engines.loan_engine import match_lenders, get_sms_response
    result = get_sms_response("LOAN 10")
    print(result["message_1"])
    print(result["message_2"])  # sent if farmer replies MORE/ZAIDI
"""

import json
import math
import os
from typing import Optional

# ── Load lender data ──────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(BASE_DIR, "lenders.json")) as f:
    LENDERS = json.load(f)["lenders"]

# ── CBK benchmark ─────────────────────────────────────────────────────────────
CBK_RATE_APR = 13.0  # CBK base rate as of June 2026


# ── APR Conversion ────────────────────────────────────────────────────────────

def monthly_to_apr(monthly_rate: float) -> float:
    """Convert monthly interest rate (%) to APR using compound interest."""
    return round((math.pow(1 + monthly_rate / 100, 12) - 1) * 100, 1)


def weekly_to_apr(weekly_rate: float) -> float:
    """Convert weekly interest rate (%) to APR."""
    return round((math.pow(1 + weekly_rate / 100, 52) - 1) * 100, 1)


def daily_to_apr(daily_rate: float) -> float:
    """Convert daily interest rate (%) to APR."""
    return round((math.pow(1 + daily_rate / 100, 365) - 1) * 100, 1)


def parse_loan_sms(text: str) -> Optional[dict]:
    """
    Parse incoming SMS:
        LOAN 10          -> 10% per month (default)
        LOAN 10 WEEK     -> 10% per week
        LOAN 10 DAY      -> 10% per day
        LOAN 10 YEAR     -> 10% per year (already annual)
        MKOPO 10         -> Swahili input, 10% per month
    Returns dict with rate info or None if unparseable.
    """
    parts = text.strip().upper().split()

    if len(parts) < 2 or parts[0] not in ("LOAN", "MKOPO"):
        return None

    try:
        rate = float(parts[1])
    except ValueError:
        return None

    period = parts[2] if len(parts) > 2 else "MONTH"

    if period in ("MONTH", "MWEZI"):
        apr = monthly_to_apr(rate)
        period_label = "per month"
    elif period in ("WEEK", "WIKI"):
        apr = weekly_to_apr(rate)
        period_label = "per week"
    elif period in ("DAY", "SIKU"):
        apr = daily_to_apr(rate)
        period_label = "per day"
    elif period in ("YEAR", "MWAKA"):
        apr = round(rate, 1)
        period_label = "per year"
    else:
        apr = monthly_to_apr(rate)
        period_label = "per month"

    return {
        "stated_rate":      rate,
        "period":           period_label,
        "apr":              apr,
        "cbk_rate":         CBK_RATE_APR,
        "times_cbk":        round(apr / CBK_RATE_APR, 1),
        "is_dangerous":     apr > 60,    # >60% APR = high risk
        "is_very_dangerous": apr > 100,  # >100% APR = very high risk
    }


# ── Lender Matching ───────────────────────────────────────────────────────────

# Agricultural lenders always considered regardless of tag match
AGRI_PRIORITY_IDS = {
    "afc",           # 10% p.a. — cheapest formal option
    "hustler_fund",  # 8% p.a. — no collateral
    "digifarm",      # inputs only — no collateral
    "juhudi_kilimo", # no title deed needed
    "pezesha",       # rural informal borrowers
    "kwft",          # women farmers
}


def match_lenders(
    tags: list[str] = None,
    has_collateral: bool = False,
    is_woman: bool = False,
    max_results: int = 3,
) -> list[dict]:
    """
    Return best-matched agricultural lenders sorted by APR (lowest first).

    Sort logic:
    - Primary: lowest APR first (cheapest lender wins)
    - Lenders with no published APR ranked after those with APR
    - Tag overlap used as tiebreaker only
    - High-cost digital lenders (M-Shwari 90%, MobiGrow 49%) naturally rank low

    Args:
        tags:           List of purpose tags e.g. ["inputs", "no_collateral"]
        has_collateral: Whether farmer has title deed or other collateral
        is_woman:       Whether farmer is a woman (enables KWFT)
        max_results:    Max lenders to return

    Returns:
        List of lender dicts sorted by APR ascending
    """
    tags = set(tags or ["working_capital", "inputs", "cash", "no_collateral"])
    results = []
    for lender in LENDERS:
        # Skip women-only product unless farmer is a woman
        if lender["id"] == "kwft" and not is_woman:
            continue

        # Never recommend high-cost lenders as alternatives
        if lender["id"] in ("mshwari", "kcb_mobigrow"):
            continue

        # Skip if collateral required but farmer has none
        # EXCEPTION: AFC is always shown — it's the gold standard agricultural lender
        if lender["collateral_required"] and not has_collateral:
            if lender["id"] != "afc":
                continue

        lender_tags = set(lender.get("tags", []))
        overlap = len(tags & lender_tags)

        # Always include priority agricultural lenders if they pass filters
        if overlap == 0 and lender["id"] not in AGRI_PRIORITY_IDS:
            continue

        results.append({
            "lender":   lender,
            "overlap":  overlap,
            "sort_apr": lender["apr"] if lender["apr"] is not None else 999,
        })
    # Sort: lowest APR first (cheapest agricultural lender at top)
    # Overlap is tiebreaker only — we never put a 90% APR lender above 10% AFC
    results.sort(key=lambda x: (x["sort_apr"], -x["overlap"]))
    return [r["lender"] for r in results[:max_results]]


# ── Danger Label ──────────────────────────────────────────────────────────────

def build_danger_label(apr: float) -> str:
    if apr > 200:
        return "HATARI SANA"   # Very dangerous (Swahili)
    elif apr > 100:
        return "HATARI"        # Dangerous
    else:
        return "ANGALIA"       # Be careful


# ── SMS Response Builder ──────────────────────────────────────────────────────

def get_sms_response(
    sms_text: str,
    has_collateral: bool = False,
    is_woman: bool = False,
    loan_purpose: str = None,
) -> dict:
    """
    Main entry point for SMS loan check.
    Returns message_1 (immediate reply ≤320 chars)
    and message_2 (full shortlist, sent if farmer replies MORE/ZAIDI).
    """
    parsed = parse_loan_sms(sms_text)

    if not parsed:
        return {
            "status":    "error",
            "message_1": (
                "Send: LOAN [rate] e.g. LOAN 10 (10% per month). "
                "Tuma: MKOPO [kiwango] mfano MKOPO 10."
            ),
            "message_2": None,
        }

    apr       = parsed["apr"]
    stated    = parsed["stated_rate"]
    period    = parsed["period"]
    times_cbk = parsed["times_cbk"]
    label     = build_danger_label(apr)

    # Build purpose tags
    purpose_map = {
        "inputs":    ["inputs", "seeds", "fertilizer", "working_capital"],
        "cash":      ["cash", "working_capital", "no_collateral"],
        "equipment": ["equipment", "asset_finance", "working_capital"],
        "emergency": ["emergency", "cash", "instant", "no_collateral"],
        "livestock": ["livestock", "asset_finance", "no_collateral"],
    }
    purpose_tags = purpose_map.get(
        loan_purpose.lower() if loan_purpose else "",
        ["working_capital", "inputs", "cash", "no_collateral"],
    )
    if not has_collateral:
        purpose_tags.append("no_collateral")
    if is_woman:
        purpose_tags.append("women")

    best_lenders = match_lenders(
        tags=purpose_tags,
        has_collateral=has_collateral,
        is_woman=is_woman,
        max_results=3,
    )

    # ── Message 1: Danger alert + single best option ──────────────────────────
    if parsed["is_dangerous"]:
        if best_lenders:
            top     = best_lenders[0]
            apr_str = f"{top['apr']}% p.a." if top["apr"] else "lower rate"
            msg1 = (
                f"{label}: {stated}% {period} = {apr}% APR ({times_cbk}x CBK). "
                f"BETTER: {top['name']} at {apr_str}. "
                f"{top['sms_blurb']} "
                f"Reply MORE for 3 options."
            )
        else:
            msg1 = (
                f"{label}: {stated}% {period} = {apr}% APR ({times_cbk}x CBK). "
                f"AFC is better: 10% per YEAR. Dial *234# or call 0800 723 573 FREE."
            )
    else:
        msg1 = (
            f"RATE CHECK: {stated}% {period} = {apr}% APR. "
            f"CBK benchmark: {CBK_RATE_APR}% APR. "
            f"Rate is acceptable. Reply MORE for cheaper alternatives."
        )

    msg1 = msg1[:320]

    # ── Message 2: Full shortlist (sent on MORE/ZAIDI reply) ─────────────────
    if best_lenders:
        lines = ["BETTER OPTIONS:"]
        for i, lender in enumerate(best_lenders, 1):
            apr_str = f"{lender['apr']}% p.a." if lender["apr"] else "ask lender"
            col_str = "no collateral" if not lender["collateral_required"] else lender["collateral"]
            lines.append(
                f"{i}. {lender['name']}: {apr_str}, {col_str}. {lender['sms_blurb']}"
            )
        msg2 = " | ".join(lines)[:320]
    else:
        msg2 = (
            "1. AFC: 10% p.a., dial *234# FREE. "
            "2. Hustler Fund: 8% p.a., via M-Pesa. "
            "3. DigiFarm: inputs only, no collateral, dial *944#."
        )[:320]

    return {
        "status":          "ok",
        "parsed":          parsed,
        "matched_lenders": [l["name"] for l in best_lenders],
        "message_1":       msg1,
        "message_2":       msg2,
    }


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    test_cases = [
        ("LOAN 10",      False, False, None),           # broker — dangerous
        ("LOAN 5 MONTH", False, True,  "inputs"),       # 5%/month inputs
        ("LOAN 10 YEAR", True,  False, "equipment"),    # 10% p.a. — safe
        ("LOAN 3 WEEK",  False, False, "emergency"),    # 3%/week — very dangerous
        ("MKOPO 10",     False, True,  None),           # Swahili
        ("LOAN 2",       False, False, "livestock"),    # 2%/month livestock
    ]
    for sms, collateral, woman, purpose in test_cases:
        print(f"\n{'='*60}")
        print(f"SMS: '{sms}' | Collateral: {collateral} | Woman: {woman} | Purpose: {purpose}")
        result = get_sms_response(sms, collateral, woman, purpose)
        print(f"MSG 1 ({len(result['message_1'])} chars):\n  {result['message_1']}")
        if result["message_2"]:
            print(f"MSG 2 ({len(result['message_2'])} chars):\n  {result['message_2']}")
        print(f"Matched: {result['matched_lenders']}")
