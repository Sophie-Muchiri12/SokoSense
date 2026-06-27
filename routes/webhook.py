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
    parts = [p for p in text.split("*")] if text else []
    depth = len(parts)

    CROPS_EN = {"1": "maize", "2": "beans", "3": "potatoes", "4": "tomatoes"}
    CROPS_SW = {"1": "maize", "2": "beans", "3": "viazi",    "4": "nyanya"}
    LOCS     = {"1": "nairobi", "2": "nakuru", "3": "eldoret", "4": "kisumu"}

    # Level 0: Language selection
    if depth == 0 or text == "":
        return "CON Welcome to SokoSense!\n1. English\n2. Kiswahili"

    lang  = parts[0]
    is_sw = lang == "2"

    # Level 1: Main menu
    if depth == 1:
        if lang == "1":
            return "CON Select service:\n1. Market Price\n2. When to Sell\n3. Loan Check"
        if lang == "2":
            return "CON Chagua huduma:\n1. Bei ya Soko\n2. Wakati wa Kuuza\n3. Mkopo"
        return "END Invalid input."

    service = parts[1]
    crops   = CROPS_SW if is_sw else CROPS_EN

    # Option 1: Market Price / Bei ya Soko
    if service == "1":
        if depth == 2:
            if is_sw:
                return "CON Chagua zao:\n1.Mahindi 2.Maharagwe\n3.Viazi 4.Nyanya"
            return "CON Select crop:\n1.Maize 2.Beans\n3.Potatoes 4.Tomatoes"
        if depth == 3:
            crop = crops.get(parts[2], "maize")
            if is_sw:
                return f"CON Soko la {crop.upper()}:\n1.Nairobi 2.Nakuru\n3.Eldoret 4.Kisumu"
            return f"CON {crop.upper()} market:\n1.Nairobi 2.Nakuru\n3.Eldoret 4.Kisumu"
        if depth == 4:
            req = MarketDecisionRequest(
                crop=crops.get(parts[2], "maize"),
                location=LOCS.get(parts[3], "nairobi"),
            )
            result = market.decide_market(req)
            return f"END {result.short_reply}"

    # Option 2: When to Sell / Wakati wa Kuuza
    if service == "2":
        if depth == 2:
            if is_sw:
                return "CON Chagua zao:\n1.Mahindi 2.Maharagwe\n3.Viazi 4.Nyanya"
            return "CON Select crop:\n1.Maize 2.Beans\n3.Potatoes 4.Tomatoes"
        if depth == 3:
            req = TimingRequest(
                crop=crops.get(parts[2], "maize"),
                market="nairobi",
            )
            result = timing.decide_timing(req)
            return f"END {result.short_reply}"

    # Option 3: Loan Check / Mkopo
    if service == "3":
        if depth == 2:
            if is_sw:
                return "CON Ingiza kiwango cha riba kwa mwezi\n(mfano: 5 kwa 5%):"
            return "CON Enter monthly rate\n(e.g. 5 for 5%):"
        if depth == 3:
            try:
                req = LoanRequest(monthly_rate_percent=float(parts[2]))
                result = loaning.decide_loan(req)
                return f"END {result.short_reply}"
            except ValueError:
                if is_sw:
                    return "END Kiwango batili. Jaribu tena."
                return "END Invalid rate. Try again."

    if is_sw:
        return "END Ingizo batili. Tuma HELP kwa maagizo."
    return "END Invalid input. Text HELP for commands."

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
