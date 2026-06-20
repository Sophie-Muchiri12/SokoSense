"""
SokoSense — Africa's Talking SMS + USSD Webhook
Lucy Kamau · Data Layer Owner

Parses incoming SMS text, routes to the correct engine, returns SMS-ready reply.
Matches contract.json: POST /webhook/sms
"""

import re
from fastapi import APIRouter, Request, Form
from fastapi.responses import PlainTextResponse

from engines import market, timing, loaning
from models.market import MarketDecisionRequest
from models.timing import TimingRequest
from models.loan import LoanRequest
from masumi_hook import charge_query

router = APIRouter(tags=["webhook"])

# ---------------------------------------------------------------------------
# PARSER — rule-based, matches contract markets/crops
# ---------------------------------------------------------------------------

KNOWN_CROPS = {"maize", "beans", "sorghum", "millet", "potatoes", "tomatoes"}
KNOWN_MARKETS = {"nairobi", "nakuru", "eldoret", "kisumu", "mombasa", "kitale", "nyeri"}

CROP_ALIASES = {
    "mahindi": "maize", "corn": "maize",
    "maharagwe": "beans",
    "mtama": "sorghum",
    "uwele": "millet",
    "viazi": "potatoes",
    "nyanya": "tomatoes",
}

TIMING_KEYWORDS = {"TIMING", "WHEN", "SHOULD I SELL", "WAIT", "LINI"}
LOAN_KEYWORDS   = {"LOAN", "INTEREST", "MKOPO", "BORROW", "%"}
HELP_KEYWORDS   = {"HELP", "MSAADA", "START", "HI", "HELLO"}


def parse_sms(text: str) -> dict:
    clean  = text.strip().upper()
    tokens = clean.split()

    if any(kw in clean for kw in HELP_KEYWORDS) and len(tokens) <= 2:
        return {"intent": "help"}

    if any(kw in clean for kw in LOAN_KEYWORDS):
        match = re.search(r"(\d+\.?\d*)", clean)
        if match:
            return {"intent": "loan", "monthly_rate_percent": float(match.group(1))}

    for crop_raw in KNOWN_CROPS | set(CROP_ALIASES.keys()):
        if crop_raw.upper() in clean and any(kw in clean for kw in TIMING_KEYWORDS):
            crop = CROP_ALIASES.get(crop_raw.lower(), crop_raw.lower())
            market_found = next((m for m in KNOWN_MARKETS if m.upper() in clean), "nairobi")
            return {"intent": "timing", "crop": crop, "market": market_found}

    found_crop, found_market = None, None
    for token in tokens:
        t = token.lower()
        if t in KNOWN_CROPS or t in CROP_ALIASES:
            found_crop = CROP_ALIASES.get(t, t)
        if t in KNOWN_MARKETS:
            found_market = t

    if found_crop and found_market:
        return {"intent": "market", "crop": found_crop, "location": found_market}
    if found_crop:
        return {"intent": "market", "crop": found_crop, "location": "nairobi"}

    return {"intent": "unknown"}


HELP_TEXT = (
    "SokoSense:\n"
    "PRICE: MAIZE NAKURU\n"
    "TIMING: BEANS TIMING\n"
    "LOAN: LOAN 5\n"
    "Free. No app needed."
)


def route_sms(text: str) -> str:
    """Pure routing function — testable without HTTP, reusable by USSD handler."""
    parsed = parse_sms(text)
    intent = parsed.get("intent")

    if intent == "market":
        req = MarketDecisionRequest(crop=parsed["crop"], location=parsed["location"])
        return market.decide_market(req).short_reply

    if intent == "timing":
        req = TimingRequest(crop=parsed["crop"], market=parsed["market"])
        return timing.decide_timing(req).short_reply

    if intent == "loan":
        req = LoanRequest(monthly_rate_percent=parsed["monthly_rate_percent"])
        result = loaning.decide_loan(req)
        charge_query("loan", payer="demo-sacco")
        return result.short_reply

    return HELP_TEXT


# ---------------------------------------------------------------------------
# SMS WEBHOOK  (matches contract.json: POST /webhook/sms)
# ---------------------------------------------------------------------------

@router.post("/webhook/sms")
async def sms_webhook(request: Request):
    """
    Africa's Talking inbound SMS webhook.
    AT POSTs form-encoded: from, to, text, date, id, linkId
    """
    form   = await request.form()
    text   = form.get("text", "").strip()
    sender = form.get("from", "unknown")

    reply = route_sms(text)
    return {"short_reply": reply}


# ---------------------------------------------------------------------------
# USSD HANDLER
# ---------------------------------------------------------------------------

@router.post("/ussd", response_class=PlainTextResponse)
async def ussd_handler(
    sessionId: str = Form(...),
    serviceCode: str = Form(...),
    phoneNumber: str = Form(...),
    text: str = Form(default=""),
):
    """
    Africa's Talking USSD session handler.
    Screens kept under contract.json's 182-char limit.
    """
    parts = text.split("*") if text else []
    depth = len(parts)

    if depth == 0 or text == "":
        return "CON SokoSense\n1. Market Price\n2. When to Sell\n3. Loan Check"

    if parts[0] == "1":
        if depth == 1:
            return "CON Select crop:\n1.Maize 2.Beans\n3.Potatoes 4.Tomatoes"
        if depth == 2:
            crops = {"1": "maize", "2": "beans", "3": "potatoes", "4": "tomatoes"}
            return f"CON {crops.get(parts[1],'maize').upper()} market:\n1.Nairobi 2.Nakuru\n3.Eldoret 4.Kisumu"
        if depth == 3:
            crops = {"1": "maize", "2": "beans", "3": "potatoes", "4": "tomatoes"}
            locs  = {"1": "nairobi", "2": "nakuru", "3": "eldoret", "4": "kisumu"}
            req = MarketDecisionRequest(
                crop=crops.get(parts[1], "maize"),
                location=locs.get(parts[2], "nairobi"),
            )
            result = market.decide_market(req)
            return f"END {result.short_reply}"

    if parts[0] == "2":
        if depth == 1:
            return "CON Select crop:\n1.Maize 2.Beans\n3.Potatoes 4.Tomatoes"
        if depth == 2:
            crops = {"1": "maize", "2": "beans", "3": "potatoes", "4": "tomatoes"}
            req = TimingRequest(crop=crops.get(parts[1], "maize"), market="nairobi")
            result = timing.decide_timing(req)
            return f"END {result.short_reply}"

    if parts[0] == "3":
        if depth == 1:
            return "CON Enter monthly rate\n(e.g. 5 for 5%):"
        if depth == 2:
            try:
                req = LoanRequest(monthly_rate_percent=float(parts[1]))
                result = loaning.decide_loan(req)
                return f"END {result.short_reply}"
            except ValueError:
                return "END Invalid rate. Try again."

    return "END Invalid input.\nText HELP for commands."
# ---------------------------------------------------------------------------
# MASUMI REVENUE CHECK  (for demo — shows live billing activity)
# ---------------------------------------------------------------------------

from masumi_hook import get_revenue_summary, get_transaction_log

@router.get("/webhook/revenue")
def revenue_summary():
    """Live revenue dashboard data — shows judges automated billing in action."""
    return {
        "summary": get_revenue_summary(),
        "recent_transactions": get_transaction_log(limit=10),
    }
